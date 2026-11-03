# -*- coding: utf-8 -*-
"""
Windsor.ai exports -> the dashboard's daily series.

Windsor writes each export into its own tab of the feed workbook (a landing zone: nothing in these
tabs is edited by hand). This module reads those tabs, aggregates them to one row per day, and merges
them over the daily series. The tab names follow the scope document (section 4.1):

  meta_daily      Windsor `facebook`    account x campaign x day
  google_daily    Windsor `google_ads`  campaign x day
  amz_sales_date  Windsor `amazon_sp`   Sales & Traffic by date
  shop_daily      Windsor `shopify`     day

Windsor's header names are not fixed, so columns are found by name with several accepted spellings
(case, spaces and underscores ignored). A missing required column stops the run with a message that
lists what was found. Defences against the usual traps:

  - excluded Meta accounts (status Excluded in metaAccounts) are dropped;
  - the handbook glitch rule drops a Meta row whose purchase value per purchase exceeds Rs 50,000;
  - if Windsor appends instead of replacing, repeated rows for the same key keep only the last copy.

A day is only overwritten where it already exists in the series. Days after the end of the series are
reported but not added: a new day needs columns Windsor does not supply (Flipkart, Nykaa and Myntra
sales, Amazon settlement), so extend the series by adding the day to the daily tab. The app's periods
follow the newest date in the series, so they roll forward as soon as the day is there.
"""

import datetime
import re

from data_io import SyncError, parse_number

WINDSOR_TABS = ["meta_daily", "google_daily", "amz_sales_date", "shop_daily"]

# Amazon days without settlement rows are estimated at the handbook rates (same as the seed series)
AMAZON_REFUND_RATE, AMAZON_FEE_RATE, AMAZON_ADS_RATE = 0.048, 0.272, 0.275
GLITCH_VALUE_PER_PURCHASE = 50000


def squash(text):
    return re.sub(r"[^a-z0-9]", "", str(text).lower())


def find_col(header, aliases=(), contains=(), avoid=()):
    names = [squash(h) for h in header]
    for alias in aliases:
        if alias in names:
            return names.index(alias)
    for needle in contains:
        for i, n in enumerate(names):
            if needle in n and not any(a in n for a in avoid):
                return i
    return None


def parse_date(value, where):
    s = str(value).strip()
    try:
        if re.fullmatch(r"\d{5}(\.\d+)?", s) and 20000 <= float(s) <= 80000:  # Google Sheets date serial
            return (datetime.date(1899, 12, 30) + datetime.timedelta(days=int(float(s)))).isoformat()
        m = re.match(r"(\d{4})[-/](\d{1,2})[-/](\d{1,2})", s)
        if m:
            return datetime.date(int(m.group(1)), int(m.group(2)), int(m.group(3))).isoformat()
        m = re.fullmatch(r"(\d{1,2})[./-](\d{1,2})[./-](\d{4})", s)
        if m:  # day first, the Indian convention
            return datetime.date(int(m.group(3)), int(m.group(2)), int(m.group(1))).isoformat()
    except ValueError:
        pass
    raise SyncError(f"{where}: cannot read the date '{value}'")


def table_body(table):
    if not table or len(table) < 2:
        return None, []
    rows = [(i + 2, r) for i, r in enumerate(table[1:]) if any(str(c).strip() for c in r)]
    return table[0], rows


def at(row, idx):
    return row[idx] if idx is not None and idx < len(row) else ""


def metric(row, idx, tab, line, name):
    raw = str(at(row, idx)).strip()
    return 0 if raw in ("", "-") else parse_number(raw, f"{tab} row {line}, column {name}")


def need(tab, header, **cols):
    missing = [label for label, idx in cols.items() if idx is None]
    if missing:
        found = ", ".join(str(h) for h in header if str(h).strip()) or "(empty header row)"
        raise SyncError(f"{tab}: cannot find a column for {', '.join(missing)}. Row 1 has: {found}")


# ---------------------------------------------------------------------------


def meta_daily(table, excluded):
    header, rows = table_body(table)
    if not rows:
        return None, None
    c = dict(
        date=find_col(header, ["date", "day"]),
        spend=find_col(header, ["spend", "amountspent"]),
        purchases=find_col(header, ["actionspurchase", "purchases", "purchase", "actionsomnipurchase", "websitepurchases"]),
        value=find_col(header, ["actionvaluespurchase", "purchasevalue", "purchasesconversionvalue",
                                "actionvaluesomnipurchase", "websitepurchasesconversionvalue"]),
    )
    need("meta_daily", header, **{"date": c["date"], "spend": c["spend"], "purchases": c["purchases"], "purchase value": c["value"]})
    c_id = find_col(header, ["accountid"])
    c_name = find_col(header, ["accountname", "account"])
    c_camp = find_col(header, ["campaignid", "campaign", "campaignname"])
    if c_id is None and c_name is None:
        raise SyncError("meta_daily: needs an account_name or account_id column so excluded accounts can be dropped")

    ex_names = {n.strip().lower() for n in excluded["names"]}
    ex_ids = {str(i).strip() for i in excluded["ids"]}
    kept, admin, glitch, processed = {}, 0, 0, 0
    for line, row in rows:
        date = parse_date(at(row, c["date"]), f"meta_daily row {line}")
        acc_id, acc = str(at(row, c_id)).strip(), str(at(row, c_name)).strip()
        if acc_id in ex_ids or acc.lower() in ex_names:
            admin += 1
            continue
        spend = metric(row, c["spend"], "meta_daily", line, "spend")
        purchases = metric(row, c["purchases"], "meta_daily", line, "purchases")
        value = metric(row, c["value"], "meta_daily", line, "purchase value")
        if value > GLITCH_VALUE_PER_PURCHASE * purchases:
            glitch += 1
            continue
        processed += 1
        kept[(date, acc_id or acc.lower(), str(at(row, c_camp)).strip().lower())] = (date, spend, purchases, value)

    agg = {}
    for date, spend, purchases, value in kept.values():
        a = agg.setdefault(date, [0, 0, 0])
        a[0] += spend
        a[1] += purchases
        a[2] += value
    out = {d: {"metaSpend": round(a[0], 2), "metaPurchases": int(round(a[1])), "metaPurchaseValue": round(a[2], 2)} for d, a in agg.items()}
    note = f"meta_daily: {len(out)} days; dropped {admin} excluded-account and {glitch} glitch rows, {processed - len(kept)} repeated rows"
    return out, note


def google_daily(table):
    header, rows = table_body(table)
    if not rows:
        return None, None
    c = dict(
        date=find_col(header, ["date", "day"]),
        spend=find_col(header, ["spend", "cost"]),
        conv=find_col(header, ["conversions"]),
        value=find_col(header, ["conversionsvalue", "conversionvalue", "allconversionsvalue"]),
    )
    need("google_daily", header, **{"date": c["date"], "spend": c["spend"], "conversions": c["conv"], "conversions value": c["value"]})
    c_camp = find_col(header, ["campaignid", "campaign", "campaignname"])
    kept, processed = {}, 0
    for line, row in rows:
        date = parse_date(at(row, c["date"]), f"google_daily row {line}")
        processed += 1
        kept[(date, str(at(row, c_camp)).strip().lower())] = (
            date,
            metric(row, c["spend"], "google_daily", line, "spend"),
            metric(row, c["conv"], "google_daily", line, "conversions"),
            metric(row, c["value"], "google_daily", line, "conversions value"),
        )
    agg = {}
    for date, spend, conv, value in kept.values():
        a = agg.setdefault(date, [0, 0, 0])
        a[0] += spend
        a[1] += conv
        a[2] += value
    out = {d: {"googleSpend": round(a[0], 2), "googleConversions": round(a[1], 1), "googleConversionValue": round(a[2], 2)} for d, a in agg.items()}
    return out, f"google_daily: {len(out)} days; {processed - len(kept)} repeated rows ignored"


def amz_sales_date(table):
    header, rows = table_body(table)
    if not rows:
        return None, None
    c_date = find_col(header, ["date", "day"])
    c_sales = find_col(header, ["orderedproductsales"], contains=["orderedproductsales"], avoid=["b2b", "currency", "code"])
    c_orders = find_col(header, ["totalorderitems"], contains=["totalorderitems", "unitsordered"], avoid=["b2b"])
    need("amz_sales_date", header, **{"date": c_date, "ordered product sales": c_sales, "total order items": c_orders})
    kept = {}
    for line, row in rows:
        date = parse_date(at(row, c_date), f"amz_sales_date row {line}")
        kept[date] = (
            metric(row, c_sales, "amz_sales_date", line, "ordered product sales"),
            metric(row, c_orders, "amz_sales_date", line, "total order items"),
        )
    out = {d: {"amazonSales": round(s, 2), "amazonOrders": int(round(o))} for d, (s, o) in kept.items()}
    return out, f"amz_sales_date: {len(out)} days; refunds, fees and billed ads follow sales until settlement rows are added"


def shop_daily(table):
    header, rows = table_body(table)
    if not rows:
        return None, None
    c = dict(
        date=find_col(header, ["date", "day"]),
        gross=find_col(header, ["grosssales", "gross"]),
        discounts=find_col(header, ["discounts", "discount"]),
        orders=find_col(header, ["orders", "ordercount", "numberoforders"]),
    )
    c_ret = find_col(header, ["returns", "refunds"])
    c_net = find_col(header, ["netsales"])
    need("shop_daily", header, **{"date": c["date"], "gross sales": c["gross"], "discounts": c["discounts"], "orders": c["orders"]})
    if c_ret is None and c_net is None:
        raise SyncError("shop_daily: needs a returns column, or a net_sales column to work returns out from")
    kept = {}
    for line, row in rows:
        date = parse_date(at(row, c["date"]), f"shop_daily row {line}")
        gross = metric(row, c["gross"], "shop_daily", line, "gross sales")
        discounts = abs(metric(row, c["discounts"], "shop_daily", line, "discounts"))
        if c_ret is not None:
            returns = abs(metric(row, c_ret, "shop_daily", line, "returns"))
        else:
            returns = max(gross - discounts - metric(row, c_net, "shop_daily", line, "net sales"), 0)
        kept[date] = (gross, discounts, returns, metric(row, c["orders"], "shop_daily", line, "orders"))
    out = {
        d: {"shopifyGross": round(g, 2), "shopifyDiscounts": round(x, 2), "shopifyReturns": round(r, 2), "shopifyOrders": int(round(o))}
        for d, (g, x, r, o) in kept.items()
    }
    return out, f"shop_daily: {len(out)} days"


def parse_windsor(tables, data):
    """Aggregate every Windsor tab that has rows. Returns ({source: {date: fields}}, notes)."""
    excluded = {
        "names": [a["name"] for a in data.get("metaAccounts", []) if a.get("status") == "Excluded"],
        "ids": [a["accountId"] for a in data.get("metaAccounts", []) if a.get("status") == "Excluded"],
    }
    parsers = {
        "meta": lambda: meta_daily(tables.get("meta_daily"), excluded),
        "google": lambda: google_daily(tables.get("google_daily")),
        "amazon": lambda: amz_sales_date(tables.get("amz_sales_date")),
        "shopify": lambda: shop_daily(tables.get("shop_daily")),
    }
    sources, notes = {}, []
    for name, parse in parsers.items():
        agg, note = parse()
        if agg:
            sources[name] = agg
            notes.append(note)
    return sources, notes


def merge_into_daily(base_rows, sources):
    """Overwrite the columns each source supplies, for days already in the series."""
    rows = {r["date"]: dict(r) for r in base_rows}
    touched = {}
    beyond = set()
    old_sales = {}
    for name, agg in sources.items():
        for date, fields in agg.items():
            row = rows.get(date)
            if row is None:
                beyond.add(date)
                continue
            if name == "amazon":
                old_sales[date] = row["amazonSales"]
            row.update(fields)
            touched.setdefault(date, set()).add(name)

    for date, names in touched.items():
        r = rows[date]
        if "shopify" in names:
            r["shopifyPreReturns"] = round(r["shopifyGross"] - r["shopifyDiscounts"], 2)
            r["shopifyNet"] = round(r["shopifyPreReturns"] - r["shopifyReturns"], 2)
        if "amazon" in names:
            # Refunds, fees and billed ads come from settlement, not from this export. Until settlement
            # rows are added they follow sales: scaled from the series' own estimate, or at the handbook
            # rates if that day had no sales.
            old = old_sales.get(date, 0)
            if old > 0:
                ratio = r["amazonSales"] / old
                for key in ("amazonRefunds", "amazonFees", "amazonBilledAds"):
                    r[key] = round(r[key] * ratio, 2)
            else:
                r["amazonRefunds"] = round(r["amazonSales"] * AMAZON_REFUND_RATE, 2)
                r["amazonFees"] = round(r["amazonSales"] * AMAZON_FEE_RATE, 2)
                r["amazonBilledAds"] = round(r["amazonSales"] * AMAZON_ADS_RATE, 2)
        r["totalAdsIncluded"] = round(r["metaSpend"] + r["googleSpend"], 2)
        r["totalSales"] = round(r["shopifyPreReturns"] + r["amazonSales"], 2)
        r["salesPerRupeeAd"] = round(r["totalSales"] / r["totalAdsIncluded"], 2) if r["totalAdsIncluded"] > 0 else 0

    merged = [rows[d] for d in sorted(rows)]
    ahead = sorted(d for d in beyond if d > merged[-1]["date"])
    notes = [f"daily: {len(touched)} of {len(merged)} days overwritten from Windsor ({', '.join(sorted(sources))})"]
    if ahead:
        notes.append(
            f"daily: {len(ahead)} day(s) after {merged[-1]['date']} ({ahead[0]} to {ahead[-1]}) are in Windsor but not added: "
            "a new day also needs the columns Windsor does not supply, so add it to the daily tab"
        )
    return merged, notes
