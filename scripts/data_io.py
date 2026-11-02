# -*- coding: utf-8 -*-
"""Shared helpers for the data scripts (generate_daily_series.py, sync_from_sheet.py)."""

import json

# Field order of DailyRecord in src/data/dailyData.ts
DAILY_FIELDS = [
    ("date", "string"),
    ("shopifyGross", "number"),
    ("shopifyDiscounts", "number"),
    ("shopifyPreReturns", "number"),
    ("shopifyReturns", "number"),
    ("shopifyNet", "number"),
    ("shopifyOrders", "number"),
    ("amazonSales", "number"),
    ("amazonOrders", "number"),
    ("amazonRefunds", "number"),
    ("amazonFees", "number"),
    ("amazonBilledAds", "number"),
    ("flipkartSales", "number"),
    ("flipkartOrders", "number"),
    ("flipkartAds", "number"),
    ("nykaaSales", "number"),
    ("nykaaOrders", "number"),
    ("nykaaAds", "number"),
    ("myntraSales", "number"),
    ("myntraOrders", "number"),
    ("myntraAds", "number"),
    ("metaSpend", "number"),
    ("metaPurchases", "number"),
    ("metaPurchaseValue", "number"),
    ("googleSpend", "number"),
    ("googleConversions", "number"),
    ("googleConversionValue", "number"),
    ("totalAdsIncluded", "number"),
    ("totalSales", "number"),
    ("salesPerRupeeAd", "number"),
]


def write_daily_ts(rows, path, header=None):
    """Write the daily series as src/data/dailyData.ts."""
    header = header or (
        "// Auto-generated 60-day daily dataset calibrated to Auravedic Handbook benchmarks.\n"
        "// Block totals (Aug 27-31, Sep 1-25, Sep 26-30, Oct 1-25) match the handbook; day-to-day ad\n"
        "// variance is seeded noise (scripts/generate_daily_series.py), not a real export. Replace with\n"
        "// the Windsor / Shopify daily pulls when they are wired in.\n"
    )
    interface = "\n".join(f"  {name}: {kind};" for name, kind in DAILY_FIELDS)
    ts_code = (
        f"{header}"
        f"export interface DailyRecord {{\n{interface}\n}}\n\n"
        f"export const dailyRecords: DailyRecord[] = {json.dumps(rows, indent=2)};\n"
    )
    with open(path, "w", encoding="utf-8") as f:
        f.write(ts_code)


def read_daily_ts(path):
    """Read the daily series back out of dailyData.ts (the array literal is plain JSON)."""
    text = open(path, encoding="utf-8").read()
    marker = "dailyRecords: DailyRecord[] = "
    body = text[text.index(marker) + len(marker):].rstrip()
    if body.endswith(";"):
        body = body[:-1]
    return json.loads(body)


class SyncError(Exception):
    """Bad or unusable sheet data: the run stops and names the tab, row and column."""


def parse_number(text, where):
    s = str(text).strip().replace(",", "").replace("₹", "").replace("%", "")
    scale = 1
    if s[-1:] in ("k", "K"):  # "₹15.6K" style entries in the report sheet
        s, scale = s[:-1], 1000
    try:
        v = float(s) * scale
    except ValueError:
        raise SyncError(f"{where}: '{text}' is not a number")
    if v != v or v in (float("inf"), float("-inf")):
        raise SyncError(f"{where}: '{text}' is not a finite number")
    return int(v) if v.is_integer() else v
