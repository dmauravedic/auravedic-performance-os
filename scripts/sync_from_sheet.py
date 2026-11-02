# -*- coding: utf-8 -*-
"""
Sync dashboard data from a Google Sheet (or a folder of CSV exports) into the app's data files.

The dashboard is a static site, so "live" means: the data files are refreshed before each build.
GitHub Actions runs this script on a schedule (see .github/workflows/deploy.yml), then builds and
deploys. Nothing is fetched in the browser and no credentials ever reach it.

Sheet layout: one tab per table, header names in row 1 (extra columns are ignored).

  marketplaces   -> marketplaceSummary   channel, type, monthlyRevenue, sharePercent, orders, aov,
                                         returnRate, status, [adSpend, adRoas, skusMapped]
  monthly        -> monthlyPerformance   month, shopifyPreReturns, ... (see MONTHLY below)
  meta_accounts  -> metaAccounts         name, accountId, status, share, spendOct, purchasesOct,
                                         roasOct, strategy
  freshness      -> freshness            key, value  (keys like metaAds, assumptions.defaultCOGS)
  daily          -> src/data/dailyData.ts  one row per day, columns as in scripts/data_io.py

Windsor.ai exports land in their own tabs (see scripts/windsor_daily.py) and are merged over the
daily series: meta_daily, google_daily, amz_sales_date, shop_daily.

A tab that is missing or has no data rows is skipped and the bundled snapshot is kept for it. A tab
that is present but malformed stops the run with an error naming the tab, row and column.

Shan's report sheet (SHAN_SHEET_ID) is a second, optional source. It is a working sheet that holds
other tabs too, so only named tabs and fixed ranges are read, never whole tabs:

  Sheet31             A1:K11   -> unitEconomics        (keeps the DEFAULT baseline row)
  Amz-Inventory Plan  A1:I12   -> amazonInventoryPlan
  Nykaa Ads           A1:L200  -> Nykaa row of marketplaceSummary  (latest month with orders)
  Myntra Ads          A1:I200  -> Myntra row of marketplaceSummary (latest month with orders)

Usage
  python scripts/sync_from_sheet.py                         # Google Sheet(s) from the environment
  python scripts/sync_from_sheet.py --csv-dir DIR           # CSV exports, one <tab>.csv each
  python scripts/sync_from_sheet.py --shan-csv-dir DIR      # Shan's tabs as CSVs (testing)
  python scripts/sync_from_sheet.py --export-csv DIR        # write the current data as a template
  python scripts/sync_from_sheet.py --csv-dir DIR --out-dir OUT   # write somewhere else (testing)

Environment (Google mode)
  GOOGLE_SERVICE_ACCOUNT_JSON   the service account key (JSON text); share each sheet with its email
  GOOGLE_SHEET_ID               the dashboard feed workbook
  SHAN_SHEET_ID                 Shan's report sheet (optional)
Sheet ids are never printed, because the workflow log of a public repository is public.
With neither sheet configured, the script exits cleanly and the build keeps the bundled snapshot.
"""

import argparse
import csv
import json
import os
import re
import sys

sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from data_io import DAILY_FIELDS, SyncError, parse_number, read_daily_ts, write_daily_ts  # noqa: E402
from windsor_daily import WINDSOR_TABS, merge_into_daily, parse_windsor  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, "src", "data")

STR, NUM = "str", "num"


def col(name, kind=NUM, optional=False):
    return (name, kind, optional)


MONTHLY = [
    col("month", STR), col("shopifyPreReturns"), col("shopifyNet"), col("amazonSales"), col("totalSales"),
    col("flipkartSalesEst"), col("metaSpend"), col("googleSpend"), col("totalAdsIncluded"),
    col("amazonAdsSpendEst"), col("flipkartAdsSpend"), col("salesPerRupeeAd"), col("amazonShare"),
    col("shopifyOrders"), col("amazonOrders"), col("metaROAS"), col("googleROAS"),
    col("realisticNetProfit"), col("contributionMargin"),
]

TABLES = {
    "marketplaces": {
        "target": "marketplaceSummary",
        "unique": "channel",
        "columns": [
            col("channel", STR), col("type", STR), col("monthlyRevenue"), col("sharePercent"), col("orders"),
            col("aov"), col("returnRate"), col("status", STR),
            col("adSpend", NUM, True), col("adRoas", NUM, True), col("skusMapped", NUM, True),
        ],
    },
    "monthly": {"target": "monthlyPerformance", "unique": "month", "columns": MONTHLY, "min_rows": 2},
    "meta_accounts": {
        "target": "metaAccounts",
        "unique": "name",
        "columns": [
            col("name", STR), col("accountId", STR), col("status", STR), col("share"), col("spendOct"),
            col("purchasesOct"), col("roasOct"), col("strategy", STR),
        ],
    },
}

CANONICAL_CHANNELS = ["Shopify D2C", "Amazon.in", "Flipkart", "Nykaa", "Myntra"]


# ---------------------------------------------------------------------------
# Parsing and validation
# ---------------------------------------------------------------------------

def table_rows(tab, table):
    """Turn a list-of-lists (header first) into (header map, data rows), skipping blank rows."""
    if not table or not any(str(c).strip() for c in table[0]):
        return None
    header = {str(h).strip().lower(): i for i, h in enumerate(table[0]) if str(h).strip()}
    rows = [(n + 2, r) for n, r in enumerate(table[1:]) if any(str(c).strip() for c in r)]
    return header, rows


def parse_table(tab, spec, table):
    parsed = table_rows(tab, table)
    if parsed is None:
        return None
    header, rows = parsed
    if not rows:
        return None

    missing = [name for name, _, optional in spec["columns"] if not optional and name.lower() not in header]
    if missing:
        raise SyncError(f"{tab}: missing column(s) {', '.join(missing)} in row 1")

    out = []
    for line, row in rows:
        item = {}
        for name, kind, optional in spec["columns"]:
            idx = header.get(name.lower())
            raw = row[idx].strip() if idx is not None and idx < len(row) else ""
            if raw == "":
                if optional:
                    continue
                raise SyncError(f"{tab} row {line}: column {name} is empty")
            item[name] = raw if kind == STR else parse_number(raw, f"{tab} row {line}, column {name}")
        out.append(item)

    key = spec.get("unique")
    if key:
        seen = set()
        for item in out:
            if item[key] in seen:
                raise SyncError(f"{tab}: {key} '{item[key]}' appears more than once")
            seen.add(item[key])
    if len(out) < spec.get("min_rows", 1):
        raise SyncError(f"{tab}: needs at least {spec.get('min_rows', 1)} data rows, found {len(out)}")
    return out


def check_extra(tab, items):
    if tab == "meta_accounts":
        for it in items:
            if not re.fullmatch(r"\d{10,}", it["accountId"]):
                raise SyncError(
                    f"meta_accounts: accountId '{it['accountId']}' for {it['name']} is not a plain digit string. "
                    "Format the column as plain text so long IDs are not turned into numbers."
                )
        if not any(it["status"].lower() == "active" for it in items):
            raise SyncError("meta_accounts: no account has status Active")
    if tab == "marketplaces":
        absent = [c for c in CANONICAL_CHANNELS if c not in {it["channel"] for it in items}]
        if absent:
            print(f"  note: marketplaces has no row for {', '.join(absent)}; the dashboard will show nothing for it")


def parse_freshness(table):
    parsed = table_rows("freshness", table)
    if parsed is None:
        return None
    header, rows = parsed
    if "key" not in header or "value" not in header:
        raise SyncError("freshness: needs columns key and value in row 1")
    out = {}
    for line, row in rows:
        k = row[header["key"]].strip() if header["key"] < len(row) else ""
        v = row[header["value"]].strip() if header["value"] < len(row) else ""
        if not k:
            continue
        if k.startswith("assumptions."):
            out.setdefault("assumptions", {})[k.split(".", 1)[1]] = parse_number(v, f"freshness row {line}, {k}")
        else:
            if not v:
                raise SyncError(f"freshness row {line}: value for {k} is empty")
            out[k] = v
    return out or None


def parse_daily(table):
    parsed = table_rows("daily", table)
    if parsed is None:
        return None
    header, rows = parsed
    if not rows:
        return None
    missing = [name for name, _ in DAILY_FIELDS if name.lower() not in header]
    if missing:
        raise SyncError(f"daily: missing column(s) {', '.join(missing)} in row 1")

    out = []
    for line, row in rows:
        item = {}
        for name, kind in DAILY_FIELDS:
            idx = header[name.lower()]
            raw = row[idx].strip() if idx < len(row) else ""
            if raw == "":
                raise SyncError(f"daily row {line}: column {name} is empty")
            if kind == "string":
                if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", raw):
                    raise SyncError(
                        f"daily row {line}: date '{raw}' is not YYYY-MM-DD. Format the date column as plain text."
                    )
                item[name] = raw
            else:
                item[name] = parse_number(raw, f"daily row {line}, column {name}")
        out.append(item)

    dates = [r["date"] for r in out]
    if len(set(dates)) != len(dates):
        raise SyncError("daily: a date appears more than once")
    out.sort(key=lambda r: r["date"])
    if len(out) < 14:
        raise SyncError(f"daily: needs at least 14 days (the 14-day view and prior periods), found {len(out)}")
    return out


# ---------------------------------------------------------------------------
# Sources
# ---------------------------------------------------------------------------

def read_csv_tables(directory):
    tables = {}
    for tab in list(TABLES) + ["freshness", "daily"] + WINDSOR_TABS:
        path = os.path.join(directory, f"{tab}.csv")
        if os.path.exists(path):
            with open(path, newline="", encoding="utf-8-sig") as f:
                tables[tab] = list(csv.reader(f))
    return tables


def read_google_tables(sheet_id, credentials_json):
    try:
        import gspread
        from google.oauth2.service_account import Credentials
    except ImportError:
        raise SyncError("Google mode needs: pip install gspread google-auth")
    try:
        info = json.loads(credentials_json)
    except json.JSONDecodeError:
        raise SyncError("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON")
    creds = Credentials.from_service_account_info(
        info, scopes=["https://www.googleapis.com/auth/spreadsheets.readonly"]
    )
    book = gspread.authorize(creds).open_by_key(sheet_id)
    tables = {}
    for tab in list(TABLES) + ["freshness", "daily"] + WINDSOR_TABS:
        try:
            ws = book.worksheet(tab)
            if tab in WINDSOR_TABS:
                # Raw values, so Windsor's date columns arrive as serial numbers whatever the locale
                try:
                    tables[tab] = ws.get_all_values(value_render_option="UNFORMATTED_VALUE")
                except TypeError:
                    tables[tab] = ws.get_all_values()
            else:
                tables[tab] = ws.get_all_values()
        except gspread.WorksheetNotFound:
            print(f"  tab '{tab}' not found in the sheet: keeping the bundled snapshot for it")
    return tables


# ---------------------------------------------------------------------------
# Export (template / round-trip) and apply
# ---------------------------------------------------------------------------

def export_csv(directory, include_daily):
    os.makedirs(directory, exist_ok=True)
    with open(os.path.join(DATA_DIR, "dashboardData.json"), encoding="utf-8") as f:
        data = json.load(f)

    def write(tab, header, rows):
        with open(os.path.join(directory, f"{tab}.csv"), "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(header)
            w.writerows(rows)

    for tab, spec in TABLES.items():
        names = [c[0] for c in spec["columns"]]
        write(tab, names, [[item.get(n, "") for n in names] for item in data[spec["target"]]])

    fresh = data["freshness"]
    rows = [[k, v] for k, v in fresh.items() if k != "assumptions"]
    rows += [[f"assumptions.{k}", v] for k, v in fresh.get("assumptions", {}).items()]
    write("freshness", ["key", "value"], rows)

    daily_names = [n for n, _ in DAILY_FIELDS]
    daily = read_daily_ts(os.path.join(DATA_DIR, "dailyData.ts")) if include_daily else []
    write("daily", daily_names, [[r[n] for n in daily_names] for r in daily])
    print(f"Wrote template CSVs to {directory}")


# ---------------------------------------------------------------------------
# Shan's report sheet: named tabs, bounded ranges, never whole tabs
# ---------------------------------------------------------------------------

# The Sheet31 range stops at row 11 on purpose: the rows below the table are notes, not data.
SHAN_RANGES = {
    "Sheet31": "A1:K11",
    "Amz-Inventory Plan": "A1:I12",
    "Nykaa Ads": "A1:L200",
    "Myntra Ads": "A1:I200",
}


def norm(cell):
    return str(cell).strip().lower()


def find_header(table, required):
    """Index of the first row that contains every required column name, or None."""
    for i, row in enumerate(table or []):
        names = {norm(c) for c in row}
        if all(r in names for r in required):
            return i
    return None


def shan_rows(tab, table, required, key):
    """(column map, data rows) up to the first row whose key column is blank; None if no table."""
    h = find_header(table, required)
    if h is None:
        return None
    header = {norm(c): i for i, c in enumerate(table[h]) if norm(c)}
    rows = []
    for line, row in enumerate(table[h + 1:], start=h + 2):
        kidx = header[key]
        if kidx >= len(row) or not str(row[kidx]).strip():
            break
        rows.append((line, row))
    return header, rows


def cell(row, header, name, where, optional=False):
    idx = header.get(name)
    raw = row[idx].strip() if idx is not None and idx < len(row) else ""
    if raw == "":
        if optional:
            return None
        raise SyncError(f"{where}: column '{name}' is empty")
    return parse_number(raw, f"{where}, column '{name}'")


MONTH_NAMES = {m.lower(): m for m in "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split()}


def month_label(text):
    m = re.fullmatch(r"([A-Za-z]{3})[A-Za-z]*[\s_\-']*(\d{2}|\d{4})", str(text).strip())
    if not m or m.group(1).lower() not in MONTH_NAMES:
        return str(text).strip()
    year = m.group(2) if len(m.group(2)) == 4 else f"20{m.group(2)}"
    return f"{MONTH_NAMES[m.group(1).lower()]} {year}"


def shan_unit_economics(table, existing):
    parsed = shan_rows("Sheet31", table, ["name", "cogs", "rto", "sp"], "name")
    if parsed is None:
        return None
    header, rows = parsed
    out = {}
    for line, row in rows:
        where = f"Sheet31 row {line}"
        key = row[header["name"]].strip()
        sp = cell(row, header, "sp", where)
        total_cost = cell(row, header, "total cost", where)
        with_rto = cell(row, header, "balance with rto", where)
        out[key] = {
            "name": existing.get(key, {}).get("name", key),
            "cogs": cell(row, header, "cogs", where),
            "shipping": cell(row, header, "shipping", where),
            "metaCAC": cell(row, header, "meta cost", where),
            "sellingPrice": sp,
            "rtoCost": cell(row, header, "rto", where) - total_cost,
            "netProfitWithRTO": with_rto,
            "netProfitWithoutRTO": cell(row, header, "balance without rto", where),
            "marginPercent": round(with_rto / sp * 100, 1) if sp else 0,
        }
    if "DEFAULT" in existing:  # baseline assumption row, not a sheet row
        out["DEFAULT"] = existing["DEFAULT"]
    return out or None


def shan_inventory(table):
    parsed = shan_rows("Amz-Inventory Plan", table, ["asin", "product", "current inventory"], "asin")
    if parsed is None:
        return None
    header, rows = parsed
    out = []
    for line, row in rows:
        where = f"Amz-Inventory Plan row {line}"
        current = cell(row, header, "current inventory", where)
        avg = cell(row, header, "avg monthly sale", where)
        out.append({
            "asin": row[header["asin"]].strip(),
            "product": row[header["product"]].strip(),
            "currentInventory": current,
            "inbound": cell(row, header, "inbound", where),
            "avgMonthlySale": avg,
            "neededToSend": cell(row, header, "needed to be send", where),
            "daysOfCover": round(current / (avg / 30.0), 1) if avg > 0 else 99,
        })
    return out or None


def shan_marketplace(tab, table, roas_names):
    """Latest month that has total orders and revenue, as the fields of a marketplaceSummary row."""
    h = find_header(table, ["month", "total orders", "total revenue"])
    if h is None:
        return None
    header = {norm(c): i for i, c in enumerate(table[h]) if norm(c)}
    roas_col = next((n for n in roas_names if n in header), None)
    if roas_col is None or "spent" not in header:
        raise SyncError(f"{tab}: needs columns Spent and {' / '.join(roas_names)}")
    latest = None
    for line, row in enumerate(table[h + 1:], start=h + 2):
        try:
            orders = cell(row, header, "total orders", f"{tab} row {line}")
            revenue = cell(row, header, "total revenue", f"{tab} row {line}")
        except SyncError:
            continue
        if orders > 0 and revenue > 0:
            latest = (line, row, orders, revenue)
    if latest is None:
        return None
    line, row, orders, revenue = latest
    where = f"{tab} row {line}"
    return {
        "periodLabel": month_label(row[header["month"]]),
        "monthlyRevenue": int(round(revenue)),
        "orders": int(round(orders)),
        "aov": int(round(revenue / orders)),
        "adSpend": cell(row, header, "spent", where),
        "adRoas": round(cell(row, header, roas_col, where), 2),
    }


def apply_shan(data, tables):
    notes = []
    ue = shan_unit_economics(tables.get("Sheet31"), data.get("unitEconomics", {}))
    if ue:
        data["unitEconomics"] = ue
        notes.append(f"Sheet31: {len([k for k in ue if k != 'DEFAULT'])} rows -> unitEconomics")
    inv = shan_inventory(tables.get("Amz-Inventory Plan"))
    if inv:
        data["amazonInventoryPlan"] = inv
        notes.append(f"Amz-Inventory Plan: {len(inv)} rows -> amazonInventoryPlan")

    changed = False
    for channel, tab, roas in (("Nykaa", "Nykaa Ads", ["ad-roas", "roas"]), ("Myntra", "Myntra Ads", ["roas", "ad-roas"])):
        fields = shan_marketplace(tab, tables.get(tab), roas)
        if not fields:
            continue
        row = next((r for r in data["marketplaceSummary"] if r["channel"] == channel), None)
        if row is None:
            notes.append(f"{tab}: no {channel} row in marketplaceSummary, skipped")
            continue
        row.update(fields)
        changed = True
        notes.append(f"{tab}: {fields['periodLabel']} -> {channel} ({fields['orders']} orders)")
    if changed:
        # Shares of the listed channels, so they add to 100% (the old figures summed to 118%)
        total = sum(r["monthlyRevenue"] for r in data["marketplaceSummary"])
        for r in data["marketplaceSummary"]:
            r["sharePercent"] = round(r["monthlyRevenue"] / total * 100, 1) if total else 0
        notes.append("sharePercent recomputed across the listed channels")
    return notes


def read_shan_csv(directory):
    tables = {}
    for tab in SHAN_RANGES:
        path = os.path.join(directory, f"{tab}.csv")
        if os.path.exists(path):
            with open(path, newline="", encoding="utf-8-sig") as f:
                tables[tab] = list(csv.reader(f))
    return tables


def read_shan_google(sheet_id, credentials_json):
    try:
        import gspread
        from google.oauth2.service_account import Credentials
    except ImportError:
        raise SyncError("Google mode needs: pip install gspread google-auth")
    creds = Credentials.from_service_account_info(
        json.loads(credentials_json), scopes=["https://www.googleapis.com/auth/spreadsheets.readonly"]
    )
    book = gspread.authorize(creds).open_by_key(sheet_id)
    ranges = [f"'{tab}'!{rng}" for tab, rng in SHAN_RANGES.items()]
    reply = book.values_batch_get(ranges)
    return {tab: vr.get("values", []) for tab, vr in zip(SHAN_RANGES, reply.get("valueRanges", []))}


def apply(tables, shan_tables, out_dir, dry_run):
    results = {}
    for tab, spec in TABLES.items():
        items = parse_table(tab, spec, tables.get(tab))
        if items is not None:
            check_extra(tab, items)
            results[tab] = items
    fresh = parse_freshness(tables.get("freshness"))
    daily = parse_daily(tables.get("daily"))

    with open(os.path.join(DATA_DIR, "dashboardData.json"), encoding="utf-8") as f:
        data = json.load(f)

    windsor_sources, windsor_notes = parse_windsor(tables, data)
    if windsor_sources:
        base = daily or read_daily_ts(os.path.join(DATA_DIR, "dailyData.ts"))
        daily, merge_notes = merge_into_daily(base, windsor_sources)
        for note in windsor_notes + merge_notes:
            print(f"  {note}")

    for tab, items in results.items():
        data[TABLES[tab]["target"]] = items
        print(f"  {tab}: {len(items)} rows -> {TABLES[tab]['target']}")
    if fresh:
        merged = {**data["freshness"], **{k: v for k, v in fresh.items() if k != "assumptions"}}
        merged["assumptions"] = {**data["freshness"].get("assumptions", {}), **fresh.get("assumptions", {})}
        data["freshness"] = merged
        print(f"  freshness: {len(fresh)} keys")
    for tab in ("marketplaces", "monthly", "meta_accounts", "freshness", "daily") if tables else ():
        if tab not in results and not (tab == "freshness" and fresh) and not (tab == "daily" and daily):
            print(f"  {tab}: empty or missing, keeping the bundled snapshot")
    if daily:
        print(f"  daily: {len(daily)} days ({daily[0]['date']} to {daily[-1]['date']}) -> dailyData.ts")

    if shan_tables:
        notes = apply_shan(data, shan_tables)
        for note in notes:
            print(f"  {note}")
        if not notes:
            print("  Shan's sheet: nothing usable found, keeping the bundled snapshot for it")

    if dry_run:
        print("Dry run: nothing written.")
        return
    os.makedirs(out_dir, exist_ok=True)
    with open(os.path.join(out_dir, "dashboardData.json"), "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    if daily:
        write_daily_ts(
            daily,
            os.path.join(out_dir, "dailyData.ts"),
            header=(
                "// Synced from the Google Sheet by scripts/sync_from_sheet.py. Do not edit by hand:\n"
                "// the next sync overwrites it.\n"
            ),
        )
    print(f"Wrote data files to {out_dir}")


def main():
    ap = argparse.ArgumentParser(description="Sync dashboard data from a Google Sheet or CSV exports.")
    ap.add_argument("--csv-dir", help="read <tab>.csv files from this folder instead of Google")
    ap.add_argument("--shan-csv-dir", help="read Shan's tabs (<tab>.csv) from this folder instead of Google")
    ap.add_argument("--export-csv", metavar="DIR", help="write the current data as template CSVs and exit")
    ap.add_argument("--include-daily", action="store_true", help="with --export-csv, include the daily rows")
    ap.add_argument("--out-dir", default=DATA_DIR, help="where to write the data files (default src/data)")
    ap.add_argument("--dry-run", action="store_true", help="validate and report without writing")
    args = ap.parse_args()

    try:
        if args.export_csv:
            export_csv(args.export_csv, args.include_daily)
            return 0
        creds = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON", "").strip()
        feed_id = os.environ.get("GOOGLE_SHEET_ID", "").strip()
        shan_id = os.environ.get("SHAN_SHEET_ID", "").strip()

        tables = shan_tables = None
        if args.csv_dir:
            print(f"Reading CSV exports from {args.csv_dir}")
            tables = read_csv_tables(args.csv_dir)
        elif feed_id and creds:
            print("Reading the dashboard feed workbook")
            tables = read_google_tables(feed_id, creds)
        if args.shan_csv_dir:
            print(f"Reading Shan's tabs from {args.shan_csv_dir}")
            shan_tables = read_shan_csv(args.shan_csv_dir)
        elif shan_id and creds:
            print("Reading Shan's report sheet (named tabs and fixed ranges only)")
            shan_tables = read_shan_google(shan_id, creds)

        if tables is None and shan_tables is None:
            print("Google Sheet sync is not configured (GOOGLE_SERVICE_ACCOUNT_JSON plus GOOGLE_SHEET_ID")
            print("and / or SHAN_SHEET_ID). Keeping the bundled snapshot.")
            return 0
        apply(tables or {}, shan_tables, args.out_dir, args.dry_run)
        return 0
    except SyncError as e:
        print(f"SYNC FAILED: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
