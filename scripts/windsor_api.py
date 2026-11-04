# -*- coding: utf-8 -*-
"""
Windsor.ai REST API -> the same tables the Windsor tabs used to hold.

With WINDSOR_API_KEY set, the sync asks Windsor for the data directly instead of reading Windsor's
exports out of the feed workbook. Each pull is turned into a table (a header row, then rows) under the
tab name its reader in windsor_daily.py already understands, so the readers, the defences (excluded
Meta accounts, the Rs 50,000-per-purchase glitch rule, repeated rows) and the merge are unchanged.

  meta_daily      facebook     account x campaign x day
  amz_sales_date  amazon_sp    Sales & Traffic by date
  amz_ads_daily   amazon_ads   one pull per ad type, stacked with an ad_type column
  amz_settlement  amazon_sp    settlement lines (posted date, type, description, amount)

All pulls run at the same time.

Why Amazon Ads needs several pulls: Windsor keeps each Amazon ad type in its own report (Sponsored
Products, Sponsored Brands, Sponsored Brands video, Sponsored Display) and refuses to combine fields
from different reports in one request. A single export can therefore only ever hold one ad type. Here
every type is pulled and stacked, so `amazonBilledAds` is the sum of all of them.

The key is sent as Windsor asks (an `api_key` query parameter). It is never printed: URLs are not
logged and error text has the key removed.

What a failure does:
  - a bad key or a refused request stops the run, so the last good site stays up;
  - a source that is still being prepared by Windsor (Amazon Ads pulls can take many minutes when
    Windsor's cache is cold) or times out is skipped with a warning, and that source keeps its
    bundled snapshot / estimate, the same as an empty tab did. An Amazon ad type that is not ready
    skips Amazon Ads as a whole, so a part-sum never replaces the estimate.
"""

import datetime
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

from data_io import SyncError

API_URL = "https://connectors.windsor.ai"

META_FIELDS = ["date", "account_id", "account_name", "campaign_id", "spend", "actions_purchase", "action_values_purchase"]

AMZ_SALES_FIELDS = [
    "date",
    "sales_and_traffic_report_by_date__salesbydate_orderedproductsales_amount",
    "sales_and_traffic_report_by_date__salesbydate_totalorderitems",
]

SETTLE = "v2_settlement_report_data_flat_file_v2__"
SETTLEMENT_FIELDS = [SETTLE + f for f in ("posted_date", "transaction_type", "amount_type", "amount_description", "amount")]

# ad type label -> (Windsor report prefix, campaign id field suffix)
AMZ_AD_REPORTS = {
    "sponsored_products": ("sponsored_products_campaign", "campaignid"),
    "sponsored_brands": ("sponsored_brands_campaign_non_video", "campaignid"),
    "sponsored_brands_video": ("sponsored_brands_campaign_video", "campaignid"),
    "sponsored_display": ("sponsored_display_campaign", "campaign_id"),
}


class NotReady(Exception):
    """Windsor has not finished preparing this pull (or it timed out). The source is skipped."""


def _scrub(text, key):
    return str(text).replace(key, "***") if key else str(text)


def fetch(connector, fields, date_from, date_to, key, deadline=None, timeout=900, attempts=3, wait=30):
    """Rows (a list of dicts) for one Windsor pull. Raises SyncError for a refused request and
    NotReady when Windsor is still preparing the data after every attempt, or the run's time
    budget (deadline, a time.monotonic() value) is spent."""
    params = urllib.parse.urlencode({
        "api_key": key,
        "fields": ",".join(fields),
        "date_from": date_from,
        "date_to": date_to,
    })
    url = f"{API_URL}/{connector}?{params}"
    last = "no answer"
    for attempt in range(1, attempts + 1):
        if deadline is not None and time.monotonic() > deadline:
            raise NotReady(f"Windsor {connector}: the sync's time budget ran out ({last})")
        # Windsor holds the request open while it prepares a cold report (Amazon Ads can take 10 minutes
        # or more), so a short timeout gives up on pulls that would have finished
        wait_for = timeout if deadline is None else max(30, min(timeout, deadline - time.monotonic()))
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"Accept": "application/json"}), timeout=wait_for) as resp:
                body = resp.read().decode("utf-8")
        except urllib.error.HTTPError as e:
            detail = _scrub(e.read().decode("utf-8", "replace")[:300], key)
            if e.code in (401, 403):
                raise SyncError(f"Windsor {connector}: the API key was refused (HTTP {e.code}). Check the WINDSOR_API_KEY secret. {detail}")
            if e.code in (400, 404, 422):
                raise SyncError(f"Windsor {connector}: request refused (HTTP {e.code}): {detail}")
            last = f"HTTP {e.code}"
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            last = _scrub(getattr(e, "reason", e), key)
        else:
            try:
                reply = json.loads(body)
            except ValueError:
                raise SyncError(f"Windsor {connector}: the answer is not JSON: {_scrub(body[:200], key)}")
            rows, state = _rows(reply)
            if rows is not None:
                return rows
            if state == "error":
                raise SyncError(f"Windsor {connector}: {_scrub(reply.get('error') or reply.get('message'), key)}")
            last = f"status {state}"
        if attempt < attempts:
            time.sleep(wait * attempt)
    raise NotReady(f"Windsor {connector}: not ready after {attempts} tries ({last})")


def _rows(reply):
    """(rows, state). rows is None when the reply holds no finished data."""
    if isinstance(reply, list):
        return reply, "done"
    if not isinstance(reply, dict):
        return None, "error"
    if reply.get("error"):
        return None, "error"
    status = str(reply.get("status", "")).lower()
    if status in ("pending", "running", "queued", "processing"):
        return None, status
    data = reply.get("data")
    if isinstance(data, list):
        return data, "done"
    if isinstance(data, dict) and isinstance(data.get("data"), list):
        return data["data"], "done"
    return None, status or "error"


def _table(header, rows):
    return [header] + [["" if v is None else str(v) for v in row] for row in rows]


def meta_table(rows):
    return _table(META_FIELDS, ([r.get(f) for f in META_FIELDS] for r in rows))


def amz_sales_table(rows):
    return _table(["date", "ordered_product_sales", "total_order_items"], ([r.get(f) for f in AMZ_SALES_FIELDS] for r in rows))


def settlement_table(rows):
    return _table(["posted_date", "transaction_type", "amount_type", "amount_description", "amount"],
                  ([r.get(f) for f in SETTLEMENT_FIELDS] for r in rows))


def amz_ads_table(pulls):
    """pulls: {ad type: rows}. One row per account x campaign x ad type x day, so the reader's
    repeated-row key (date, campaign, ad type) never folds two accounts together."""
    out = []
    for ad_type, rows in pulls.items():
        prefix, camp = AMZ_AD_REPORTS[ad_type]
        for r in rows:
            account = str(r.get("account_name") or r.get("account_id") or "").strip()
            campaign = str(r.get(f"{prefix}__{camp}") or "").strip()
            out.append([r.get("date"), f"{account}|{campaign}", ad_type, r.get(f"{prefix}__cost")])
    return _table(["date", "campaign", "ad_type", "cost"], out)


# Amazon's advertising API only serves the last 60 days and refuses the whole request if it starts
# earlier. 58 leaves room for the runner (UTC) and Windsor counting the day differently.
AMAZON_ADS_DAYS = 58


def read_windsor_api(key, date_from, date_to=None, fetcher=fetch, budget_seconds=1800, today=None):
    """{tab: table} for every source Windsor could serve, plus notes. date_to defaults to yesterday.
    budget_seconds caps the whole set of pulls so a slow Windsor cannot hold the daily deploy."""
    today = today or datetime.date.today()
    date_to = date_to or (today - datetime.timedelta(days=1)).isoformat()
    ads_from = max(date_from, (today - datetime.timedelta(days=AMAZON_ADS_DAYS)).isoformat())
    deadline = time.monotonic() + budget_seconds
    tables, notes = {}, []

    def pull(label, connector, fields, start=date_from):
        try:
            rows = fetcher(connector, fields, start, date_to, key, deadline=deadline)
        except NotReady as e:
            notes.append(f"WARNING {e}; {label} keeps its bundled data this run")
            return None
        if not isinstance(rows, list) or any(not isinstance(r, dict) for r in rows):
            raise SyncError(f"Windsor {connector}: expected a list of rows")
        # A field missing from every row would read as zero and quietly replace real numbers
        missing = [f for f in fields if rows and not any(f in r for r in rows)]
        if missing:
            raise SyncError(f"Windsor {connector}: no row has {', '.join(missing)}. First row has: {', '.join(rows[0])}")
        return rows

    # Every pull runs at the same time: the slow Amazon Ads reports no longer queue behind each other
    jobs = {
        "meta": ("Meta", "facebook", META_FIELDS, date_from),
        "sales": ("Amazon sales", "amazon_sp", AMZ_SALES_FIELDS, date_from),
        "settlement": ("Amazon settlement", "amazon_sp", SETTLEMENT_FIELDS, date_from),
    }
    for ad_type, (prefix, camp) in AMZ_AD_REPORTS.items():
        jobs[ad_type] = (f"Amazon Ads ({ad_type})", "amazon_ads", ["date", "account_name", f"{prefix}__{camp}", f"{prefix}__cost"], ads_from)
    with ThreadPoolExecutor(max_workers=len(jobs)) as pool:
        futures = {name: pool.submit(pull, label, connector, fields, start) for name, (label, connector, fields, start) in jobs.items()}
        got = {name: f.result() for name, f in futures.items()}

    if got["meta"] is not None:
        tables["meta_daily"] = meta_table(got["meta"])
        notes.append(f"windsor api: facebook {len(got['meta'])} rows")
    if got["sales"] is not None:
        tables["amz_sales_date"] = amz_sales_table(got["sales"])
        notes.append(f"windsor api: amazon_sp {len(got['sales'])} rows")
    if got["settlement"] is not None:
        tables["amz_settlement"] = settlement_table(got["settlement"])
        notes.append(f"windsor api: amazon settlement {len(got['settlement'])} rows")

    pulls = {t: got[t] for t in AMZ_AD_REPORTS}
    if any(rows is None for rows in pulls.values()):
        notes.append("WARNING Amazon Ads skipped: not every ad type was ready, and a part-sum would understate spend")
    else:
        tables["amz_ads_daily"] = amz_ads_table(pulls)
        spend = {t: round(sum(float(r.get(f"{AMZ_AD_REPORTS[t][0]}__cost") or 0) for r in rows)) for t, rows in pulls.items()}
        notes.append(f"windsor api: amazon_ads from {ads_from} (Amazon keeps 60 days; older days keep the estimate): " + ", ".join(f"{t} Rs {v:,}" for t, v in spend.items()))

    return tables, notes
