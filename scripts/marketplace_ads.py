# -*- coding: utf-8 -*-
"""
Monthly marketplace ad reports from Shan's report sheet -> `marketplaceAds` in dashboardData.json.

One tab per marketplace, typed by hand each month, so the formats are mixed: "₹243.9K", "₹15.26L",
"₹1.3M", "2.2k", "28,79,674", plain numbers, and "_" for a month with nothing to report. Everything
is read leniently and a month without an ad-spend figure is skipped. Only fixed ranges are read.

  Amazon Ads    months across the top, one metric per row (Orders, Spent, Revenue, ..., Total Orders)
  FKT           Flipkart Seller Ads, months down the side
  Nykaa Ads     months down the side (platform "Spent" only; the sheet's T.Spent adds Meta spend)
  Myntra Ads    months down the side, title row above the header
  Purplle Ads   months down the side (no data after mid-2024)
  Snapdeal Ads  months down the side (no data after late 2023)

Each record: channel, month, monthKey, adSpend, and when the sheet has them adRevenue, adRoas
(ad revenue / ad spend), adOrders, totalOrders, totalRevenue, tacos (ad spend / channel revenue, %).
The last 24 reported months of each channel are kept.
"""

import re

ADS_RANGES = {
    "Amazon Ads": "A1:BD12",
    "FKT": "A1:H70",
    "Nykaa Ads": "A1:L200",
    "Myntra Ads": "A1:I200",
    "Purplle Ads": "A1:F80",
    "Snapdeal Ads": "A1:F80",
}

KEEP_MONTHS = 24
MONTH_NAMES = dict(enumerate("Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(), start=1))
MONTHS = {name.lower(): number for number, name in MONTH_NAMES.items()}
UNITS = {"": 1, "k": 1e3, "l": 1e5, "lac": 1e5, "lakh": 1e5, "m": 1e6, "cr": 1e7}


def ads_number(text):
    """A number from the sheet's mixed formats, or None for blanks, '_' and notes."""
    s = str(text).replace("\r", " ").strip()
    if s in ("", "_", "-", "—"):
        return None
    s = s.replace("₹", "").replace(",", "").replace("%", "").strip()
    m = re.fullmatch(r"(-?\d+(?:\.\d+)?)\s*(k|l|lac|lakh|m|cr)?", s, re.I)
    if not m:
        return None
    return float(m.group(1)) * UNITS[(m.group(2) or "").lower()]


def month_info(text):
    """('Sep 2026', '2026-09') from labels like SEP_26, Sep-25, June-22, Aug26, July26."""
    m = re.fullmatch(r"([A-Za-z]{3})[A-Za-z]*[\s_\-']*(\d{2}|\d{4})", str(text).strip())
    if not m or m.group(1).lower() not in MONTHS:
        return None
    month = MONTHS[m.group(1).lower()]
    year = int(m.group(2)) if len(m.group(2)) == 4 else 2000 + int(m.group(2))
    return f"{MONTH_NAMES[month]} {year}", f"{year}-{month:02d}"


def clean(v):
    return int(round(v)) if abs(v - round(v)) < 0.005 else round(v, 2)


def norm(cell):
    return str(cell).strip().lower()


def record(channel, info, spend, revenue=None, orders=None, total_orders=None, total_revenue=None):
    label, key = info
    out = {"channel": channel, "month": label, "monthKey": key, "adSpend": clean(spend)}
    if revenue is not None:
        out["adRevenue"] = clean(revenue)
        if spend > 0:
            out["adRoas"] = round(revenue / spend, 2)
    if orders is not None:
        out["adOrders"] = clean(orders)
    if total_orders is not None:
        out["totalOrders"] = clean(total_orders)
    if total_revenue is not None:
        out["totalRevenue"] = clean(total_revenue)
        if total_revenue > 0:
            out["tacos"] = round(spend / total_revenue * 100, 2)
    return out


def header_row(table, first="month"):
    for i, row in enumerate(table or []):
        if row and norm(row[0]) == first:
            return i
    return None


def monthly_down(channel, table):
    """Months down the side, one row each, until the first blank month cell."""
    h = header_row(table)
    if h is None:
        return []
    header = {norm(c): i for i, c in enumerate(table[h]) if norm(c)}

    def col(*names):
        return next((header[n] for n in names if n in header), None)

    c_spend = col("spent")
    if c_spend is None:
        return []
    c_orders = col("orders", "ad orders", "direct orders")
    c_rev = col("revenue", "ad-revenue (mrp)", "direct revenue")
    c_tord, c_trev = col("total orders"), col("total revenue")

    def val(row, idx):
        return ads_number(row[idx]) if idx is not None and idx < len(row) else None

    out = []
    blanks = 0
    for row in table[h + 1:]:
        if not row or not str(row[0]).strip():
            # One stray blank row does not end the table; a gap of two or more does (Flipkart's
            # second table sits below a six-row gap and must not be read)
            blanks += 1
            if blanks >= 2:
                break
            continue
        blanks = 0
        info = month_info(row[0])
        spend = val(row, c_spend)
        if info is None or spend is None:
            continue
        out.append(record(channel, info, spend, val(row, c_rev), val(row, c_orders), val(row, c_tord), val(row, c_trev)))
    return out


def monthly_across(channel, table):
    """Amazon Ads: months across row 'Month', one metric per labelled row beneath it."""
    h = header_row(table)
    if h is None:
        return []
    rows = {}
    seen_revenue = 0
    for row in table[h + 1:]:
        label = norm(row[0]) if row else ""
        if not label:
            break
        if label == "revenue":  # the sheet uses the label twice: ad revenue first, then channel revenue
            key = "adRevenue" if seen_revenue == 0 else "totalRevenue"
            seen_revenue += 1
        else:
            key = {"orders": "adOrders", "spent": "adSpend", "total orders": "totalOrders"}.get(label)
        if key:
            rows[key] = row
    if "adSpend" not in rows:
        return []

    def val(key, i):
        r = rows.get(key)
        return ads_number(r[i]) if r is not None and i < len(r) else None

    out = []
    for i, cell in enumerate(table[h]):
        info = month_info(cell) if i > 0 else None
        spend = val("adSpend", i)
        if info is None or spend is None:
            continue
        out.append(record(channel, info, spend, val("adRevenue", i), val("adOrders", i), val("totalOrders", i), val("totalRevenue", i)))
    return out


SOURCES = [
    ("Amazon.in", "Amazon Ads", monthly_across),
    ("Flipkart", "FKT", monthly_down),
    ("Nykaa", "Nykaa Ads", monthly_down),
    ("Myntra", "Myntra Ads", monthly_down),
    ("Purplle", "Purplle Ads", monthly_down),
    ("Snapdeal", "Snapdeal Ads", monthly_down),
]


def build_marketplace_ads(tables):
    """(records, notes). Records are grouped by channel, oldest month first."""
    records, notes = [], []
    for channel, tab, parse in SOURCES:
        rows = parse(channel, tables.get(tab))
        if not rows:
            continue
        by_month = {r["monthKey"]: r for r in rows}  # a repeated month keeps its last entry
        kept = [by_month[k] for k in sorted(by_month)][-KEEP_MONTHS:]
        records.extend(kept)
        notes.append(f"{tab}: {len(kept)} months to {kept[-1]['month']} -> marketplaceAds ({channel})")
    return records, notes
