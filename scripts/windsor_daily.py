# -*- coding: utf-8 -*-
"""
Daily ad and sales exports -> the dashboard's daily series.

Windsor writes each export into its own tab of the feed workbook (a landing zone: nothing in these
tabs is edited by hand). This module reads those tabs, aggregates them to one row per day, and merges
them over the daily series. The tab names follow the scope document (section 4.1):

  meta_daily      Windsor `facebook`    account x campaign x day
  amz_sales_date  Windsor `amazon_sp`   Sales & Traffic by date
  amz_ads_daily   Windsor `amazon_ads`  campaign x day (advertising cost)
  shop_daily      Windsor `shopify`     day

Google Ads is the exception: it is read from the `_GoogleAds_Daily` tab of a separate sheet (see
sync_from_sheet.py), not from Windsor, and is handed in under the key `google_daily`.

Windsor's header names are not fixed, so columns are found by name with several accepted spellings
(case, spaces and underscores ignored). A missing required column stops the run with a message that
lists what was found. Defences against the usual traps:

  - excluded Meta accounts (status Excluded in metaAccounts) are dropped;
  - the handbook glitch rule drops a Meta row whose purchase value per purchase exceeds Rs 50,000;
  - if an export appends instead of replacing, repeated rows for the same key keep only the last copy.

Days already in the series are overwritten. Days after the end of the series that any source covers are
added as new days: the sources that have the day fill their fields, and every source that does not is
listed in the row's `missing` field (its numbers stay 0, and the app shows them as "not reported yet",
never as zero). Flipkart, Nykaa and Myntra have no daily feed, so they are always missing on new days.
Amazon refunds, fees and (without an Amazon Ads row) billed ads on a new day are estimated at the
handbook rates, as for any day without settlement rows. The app's periods follow the newest date.

Amazon Ads spend replaces the flat-rate / settlement estimate in `amazonBilledAds` for every day the
export covers, so the P&L and the ad pages use what Amazon Ads reports. Total ad spend and MER keep
meaning Meta + Google.
"""

import datetime
import re

from data_io import DAILY_FIELDS, SyncError, parse_number

WINDSOR_TABS = ["meta_daily", "amz_sales_date", "amz_ads_daily", "amz_settlement", "shop_daily"]
GOOGLE_TAB = "google_daily"  # the key Google Ads rows are filed under; not a Windsor tab any more

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


def table_body(table, header_at=0):
    """(header, [(sheet row number, row)]). Row numbers count from the top of the tab, for messages."""
    if not table or len(table) < header_at + 2:
        return None, []
    rows = [(i + 1, r) for i, r in enumerate(table) if i > header_at and any(str(c).strip() for c in r)]
    return table[header_at], rows


def header_index(table, needed, scan=15):
    """Row that holds the column names, for tabs with a title or note above them. 0 if none looks right."""
    for i, row in enumerate((table or [])[:scan]):
        names = [squash(c) for c in row]
        if all(any(n in names for n in aliases) for aliases in needed):
            return i
    return 0


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


GOOGLE_SPEND = ["spend", "cost", "amountspent", "totalcost", "costinr"]
GOOGLE_MICROS = ["costmicros", "metricscostmicros"]  # Google Ads API cost, in millionths of the currency
GOOGLE_CONV = ["conversions", "allconversions", "metricsconversions"]
GOOGLE_VALUE = [
    "conversionsvalue", "conversionvalue", "allconversionsvalue", "allconversionvalue", "convvalue",
    "allconvvalue", "metricsconversionsvalue", "totalconversionvalue",
]


def google_daily(table):
    """Google Ads daily rows (the `_GoogleAds_Daily` tab). Campaign x day or one row a day; the tab
    may carry a title or note above its header row, and cost may be in rupees or in micros."""
    at_row = header_index(table, [["date", "day", "segmentsdate"], GOOGLE_SPEND + GOOGLE_MICROS])
    header, rows = table_body(table, at_row)
    if not rows:
        return None, None
    micros = find_col(header, GOOGLE_MICROS)
    c = dict(
        date=find_col(header, ["date", "day", "segmentsdate"]),
        spend=find_col(header, GOOGLE_SPEND, contains=["cost", "spend"], avoid=["per", "cpc", "cpm", "cpa", "conv", "micros", "avg", "average"]),
        conv=find_col(header, GOOGLE_CONV, contains=["conversions"], avoid=["value", "rate", "per", "cost"]),
        value=find_col(header, GOOGLE_VALUE, contains=["convvalue", "conversionvalue", "conversionsvalue"], avoid=["per", "rate"]),
    )
    if c["spend"] is None and micros is not None:
        c["spend"] = micros
    need("google_daily", header, **{"date": c["date"], "spend": c["spend"], "conversions": c["conv"], "conversions value": c["value"]})
    scale = 1e-6 if c["spend"] == micros else 1
    c_camp = find_col(header, ["campaignid", "campaign", "campaignname"])
    kept, processed = {}, 0
    for line, row in rows:
        if not str(at(row, c["date"])).strip():
            continue  # a blank date cell: a spacer or a totals line, not a day
        date = parse_date(at(row, c["date"]), f"google_daily row {line}")
        processed += 1
        kept[(date, str(at(row, c_camp)).strip().lower())] = (
            date,
            metric(row, c["spend"], "google_daily", line, "spend") * scale,
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


AMAZON_ADS_SPEND = ["cost", "spend", "adspend", "totalcost", "adcost", "advertisingcost"]


def amz_ads_daily(table):
    """Amazon Ads (Windsor `amazon_ads`), campaign x day. Only the daily spend is used."""
    header, rows = table_body(table)
    if not rows:
        return None, None
    c_date = find_col(header, ["date", "day"])
    c_spend = find_col(header, AMAZON_ADS_SPEND, contains=["cost", "spend"], avoid=["per", "cpc", "acos", "roas", "micros", "conv"])
    need("amz_ads_daily", header, **{"date": c_date, "cost (spend)": c_spend})
    c_camp = find_col(header, ["campaignid", "campaign", "campaignname"])
    c_type = find_col(header, ["adtype", "campaigntype", "adproduct", "type"])
    kept, processed = {}, 0
    for line, row in rows:
        if not str(at(row, c_date)).strip():
            continue
        date = parse_date(at(row, c_date), f"amz_ads_daily row {line}")
        processed += 1
        key = (date, str(at(row, c_camp)).strip().lower(), str(at(row, c_type)).strip().lower())
        kept[key] = (date, metric(row, c_spend, "amz_ads_daily", line, "cost"))
    agg = {}
    for date, spend in kept.values():
        agg[date] = agg.get(date, 0) + spend
    out = {d: {"amazonBilledAds": round(s, 2)} for d, s in agg.items()}
    return out, f"amz_ads_daily: {len(out)} days; {processed - len(kept)} repeated rows ignored; replaces the estimated Amazon ad spend"


def amz_ads_months(ads_table, sales_table, today=None):
    """Amazon's monthly ad report from the daily Windsor `amazon_ads` rows, in the same shape as the
    months typed into Shan's sheet: ad spend, ad revenue (attributed sales), ad orders, ROAS, and
    TACOS against Amazon's ordered product sales (Windsor `amazon_sp`) for the same days.

    Amazon Ads keeps 60 days, so only months the rows cover from the 1st are returned (a month that
    starts before the window would be a part-month against the sheet's full one). The newest month is
    returned while it is still running, with `through` set to its last day. TACOS and channel revenue
    use only the days that have both ads and sales (Amazon sales can run a day behind the ads).
    Returns (records, notes); records are [] when the export has no sales column (an old export)."""
    header, rows = table_body(ads_table)
    if not rows:
        return [], []
    c_date = find_col(header, ["date", "day"])
    c_spend = find_col(header, AMAZON_ADS_SPEND, contains=["cost", "spend"], avoid=["per", "cpc", "acos", "roas", "micros", "conv"])
    c_sales = find_col(header, ["adsales", "attributedsales", "sales"])
    c_orders = find_col(header, ["adorders", "attributedorders", "orders", "purchases", "conversions"])
    if c_date is None or c_spend is None or c_sales is None:
        return [], ["amz_ads monthly: the export has no ad sales column, so the monthly report stays on Shan's sheet"]
    c_camp = find_col(header, ["campaignid", "campaign", "campaignname"])
    c_type = find_col(header, ["adtype", "campaigntype", "adproduct", "type"])
    if not any(str(at(row, c_sales)).strip() for _, row in rows):
        # Windsor left the attributed sales out: a month of spend with no revenue would read as 0x ROAS
        return [], ["amz_ads monthly: Windsor sent no ad sales this run, so the monthly report stays on Shan's sheet"]
    kept = {}
    for line, row in rows:
        if not str(at(row, c_date)).strip():
            continue
        date = parse_date(at(row, c_date), f"amz_ads_daily row {line}")
        key = (date, str(at(row, c_camp)).strip().lower(), str(at(row, c_type)).strip().lower())
        sales = metric(row, c_sales, "amz_ads_daily", line, "ad sales")
        orders = metric(row, c_orders, "amz_ads_daily", line, "ad orders") if c_orders is not None else 0
        kept[key] = (date, metric(row, c_spend, "amz_ads_daily", line, "cost"), sales, orders)
    days = {}
    for date, spend, sales, orders in kept.values():
        d = days.setdefault(date, [0.0, 0.0, 0.0])
        d[0] += spend
        d[1] += sales
        d[2] += orders
    amazon_sales = (amz_sales_date(sales_table)[0] or {}) if sales_table else {}

    first, last = min(days), max(days)
    months = sorted({d[:7] for d in days})
    out, notes = [], []
    for key in months:
        if f"{key}-01" < first:
            notes.append(f"amz_ads monthly: {key} starts before Amazon's 60-day window, so it stays on Shan's sheet")
            continue
        mdays = sorted(d for d in days if d[:7] == key)
        spend = sum(days[d][0] for d in mdays)
        sales = sum(days[d][1] for d in mdays)
        orders = sum(days[d][2] for d in mdays)
        y, m = int(key[:4]), int(key[5:])
        rec = {"channel": "Amazon.in", "month": f"{MONTH_ABBR[m - 1]} {y}", "monthKey": key,
               "adSpend": round(spend), "adRevenue": round(sales), "adOrders": int(round(orders)), "source": "windsor"}
        if spend > 0:
            rec["adRoas"] = round(sales / spend, 2)
        both = [d for d in mdays if d in amazon_sales]
        if both:
            revenue = sum(amazon_sales[d]["amazonSales"] for d in both)
            rec["totalRevenue"] = round(revenue)
            rec["totalOrders"] = int(sum(amazon_sales[d]["amazonOrders"] for d in both))
            if revenue > 0:
                rec["tacos"] = round(sum(days[d][0] for d in both) / revenue * 100, 2)
        month_end = (datetime.date(y + (m == 12), m % 12 + 1, 1) - datetime.timedelta(days=1)).isoformat()
        if mdays[-1] < month_end:
            rec["through"] = mdays[-1]
        out.append(rec)
    if out:
        notes.append(f"amz_ads monthly: {', '.join(r['month'] for r in out)} from Windsor (to {last}) -> marketplaceAds (Amazon.in)")
    return out, notes


MONTH_ABBR = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split()


def merge_amazon_months(existing, months):
    """Windsor's Amazon months replace the sheet's for the same month and add the newer ones; the
    sheet's older months stay. Returns (records, notes comparing any month both have)."""
    if not months:
        return existing, []
    by_key = {m["monthKey"]: m for m in months}
    notes = []
    kept = []
    for r in existing:
        if r.get("channel") == "Amazon.in" and r.get("monthKey") in by_key:
            w = by_key[r["monthKey"]]
            if not w.get("through") and r.get("adSpend"):
                diff = (w["adSpend"] - r["adSpend"]) / r["adSpend"] * 100
                notes.append(f"amz_ads monthly: {w['month']} spend Windsor Rs {w['adSpend']:,} vs sheet Rs {r['adSpend']:,} ({diff:+.1f}%)")
            continue
        kept.append(r)
    others = [r for r in kept if r.get("channel") != "Amazon.in"]
    amazon = sorted([r for r in kept if r.get("channel") == "Amazon.in"] + months, key=lambda r: r["monthKey"])[-24:]
    return amazon + others, notes


def amz_settlement(table):
    """Amazon settlement lines (Windsor `amazon_sp`, settlement report v2), summed per posted date into
    refunds, fees and billed advertising. These replace the flat-rate estimates for every date the
    report covers. Definitions (all as positive rupees):
      refunds  = principal refunded to customers (Refund, ItemPrice, Principal);
      fees     = everything Amazon charges for selling: ItemFees and fee adjustments (commission,
                 closing, FBA pick-pack and weight handling, shipping chargeback, technology fee,
                 with their GST), net of fees Amazon returns on refunds, plus other-transaction fees
                 (advisory fee, inbound transport) and their GST;
      ads      = Cost of Advertising (used only for days without the daily Amazon Ads export).
    Promotions, taxes collected (TCS/TDS) and reimbursements are not fees and are left out."""
    header, rows = table_body(table)
    if not rows:
        return None, None
    c = dict(
        date=find_col(header, ["posteddate", "date"]),
        ttype=find_col(header, ["transactiontype"]),
        atype=find_col(header, ["amounttype"]),
        desc=find_col(header, ["amountdescription"]),
        amount=find_col(header, ["amount"]),
    )
    need("amz_settlement", header, **{"posted date": c["date"], "transaction type": c["ttype"], "amount type": c["atype"],
                                       "amount description": c["desc"], "amount": c["amount"]})
    agg = {}
    for line, row in rows:
        raw_date = str(at(row, c["date"])).strip()
        if not raw_date:
            continue
        date = parse_date(raw_date, f"amz_settlement row {line}")
        ttype, atype, desc = (str(at(row, c[k])).strip().lower() for k in ("ttype", "atype", "desc"))
        amount = metric(row, c["amount"], "amz_settlement", line, "amount")
        a = agg.setdefault(date, {"refunds": 0.0, "fees": 0.0, "ads": 0.0})
        if desc == "cost of advertising" or atype == "cost of advertising":
            a["ads"] -= amount
        elif ttype == "refund" and atype == "itemprice" and desc == "principal":
            a["refunds"] -= amount
        elif atype in ("itemfees", "item fee adjustment"):
            a["fees"] -= amount
        elif (ttype == "other-transaction" or atype == "other-transaction") and "reimbursement" not in atype and "reimbursement" not in desc:
            a["fees"] -= amount
    out = {d: {"_settleRefunds": round(v["refunds"], 2), "_settleFees": round(v["fees"], 2), "_settleAds": round(v["ads"], 2)}
           for d, v in agg.items()}
    return out, f"amz_settlement: {len(out)} posted days; refunds and fees replace the flat-rate estimates for those days"


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
        "google": lambda: google_daily(tables.get(GOOGLE_TAB)),
        "amazon": lambda: amz_sales_date(tables.get("amz_sales_date")),
        "amazonads": lambda: amz_ads_daily(tables.get("amz_ads_daily")),
        "settlement": lambda: amz_settlement(tables.get("amz_settlement")),
        "shopify": lambda: shop_daily(tables.get("shop_daily")),
    }
    sources, notes = {}, []
    for name, parse in parsers.items():
        agg, note = parse()
        if agg:
            sources[name] = agg
            notes.append(note)
    return sources, notes


# Daily sources the app checks for each day, and which merge source fills each of them
REPORTED_SOURCES = ["shopify", "amazon", "flipkart", "nykaa", "myntra", "meta", "google"]
FED_BY = {"shopify": "shopify", "amazon": "amazon", "meta": "meta", "google": "google"}  # the rest have no daily feed


def blank_day(date):
    return {name: (date if name == "date" else 0) for name, _ in DAILY_FIELDS}


def merge_into_daily(base_rows, sources):
    """Overwrite the columns each source supplies for days already in the series, and add the days
    after its end that any source covers, with the sources that do not cover them listed in `missing`."""
    rows = {r["date"]: dict(r) for r in base_rows}
    end = max(rows)
    touched = {}
    old_sales = {}
    added = set()
    for name, agg in sources.items():
        for date, fields in agg.items():
            row = rows.get(date)
            if row is None:
                if date < end:
                    continue  # before the series or a hole in it: not a new day
                row = rows[date] = blank_day(date)
                added.add(date)
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
            # rates if that day had no sales. A day the Amazon Ads export covers keeps that export's spend.
            own_ads = "amazonads" in names
            old = old_sales.get(date, 0)
            if old > 0:
                ratio = r["amazonSales"] / old
                for key in ("amazonRefunds", "amazonFees") + (() if own_ads else ("amazonBilledAds",)):
                    r[key] = round(r[key] * ratio, 2)
            else:
                r["amazonRefunds"] = round(r["amazonSales"] * AMAZON_REFUND_RATE, 2)
                r["amazonFees"] = round(r["amazonSales"] * AMAZON_FEE_RATE, 2)
                if not own_ads:
                    r["amazonBilledAds"] = round(r["amazonSales"] * AMAZON_ADS_RATE, 2)
        if "settlement" in names:
            # Real settlement for the day beats the estimate; Amazon Ads' own daily spend still wins
            # over the advertising Amazon billed that day (billing lands in lumps, not by spend day)
            r["amazonRefunds"] = r.pop("_settleRefunds")
            r["amazonFees"] = r.pop("_settleFees")
            settle_ads = r.pop("_settleAds")
            if "amazonads" not in names:
                r["amazonBilledAds"] = settle_ads
        if date in added:
            r["missing"] = [s for s in REPORTED_SOURCES if FED_BY.get(s) not in names]
            if "amazon" in r["missing"]:
                r["amazonBilledAds"] = 0  # Amazon Ads alone, without sales, is not a reported Amazon day
        r["totalAdsIncluded"] = round(r["metaSpend"] + r["googleSpend"], 2)
        r["totalSales"] = round(r["shopifyPreReturns"] + r["amazonSales"], 2)
        r["salesPerRupeeAd"] = round(r["totalSales"] / r["totalAdsIncluded"], 2) if r["totalAdsIncluded"] > 0 else 0

    # A new day needs at least one source the app reports on (Amazon Ads alone, ahead of Amazon's
    # sales, does not make a day)
    for date in [d for d in added if len(rows[d]["missing"]) == len(REPORTED_SOURCES)]:
        del rows[date]
        del touched[date]
        added.discard(date)

    merged = [rows[d] for d in sorted(rows)]
    old = len(touched) - len(added)
    notes = [f"daily: {old} of {len(base_rows)} days overwritten from the exports ({', '.join(sorted(sources))})"]
    if added:
        new = sorted(added)
        gaps = {}
        for d in new:
            for s in rows[d]["missing"]:
                gaps.setdefault(s, []).append(d)
        notes.append(
            f"daily: added {len(new)} new day(s), {new[0]} to {new[-1]}. Not reported yet (shown as such, not as zero): "
            + ("; ".join(f"{s} {len(ds)} day(s)" for s, ds in gaps.items()) or "nothing")
        )
    # Newest day of the series each source actually fed: what the freshness strip should say
    covered = {}
    for date, names in touched.items():
        for name in names:
            covered[name] = max(covered.get(name, date), date)
    return merged, notes, covered


# Which `freshness` key each source's newest loaded day is written to (see sync_from_sheet.apply)
FRESHNESS_KEYS = {
    "meta": "metaAds",
    "google": "googleAds",
    "amazon": "amazonSales",
    "amazonads": "amazonAds",
    "settlement": "amazonSettlement",
    "shopify": "shopifySales",
}
