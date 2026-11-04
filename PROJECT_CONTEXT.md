# Auravedic Performance Dashboard: project context

Last updated 4 Nov 2026 (branch `windsor-api-direct`, on top of `a6f2b5e`). Written so a person or an AI coding assistant on a machine that has never seen this project can pick it up. It contains no keys, passwords or sheet ids, and none should ever be added to it.

---

## 0. How to use this file

Paste this whole file at the start of the session, then say what you want. A good opening message:

> Read PROJECT_CONTEXT.md first. It is the brief for this project. Follow section 9 (rules) strictly. Then help me with: <your task>. Before changing code, tell me which files you will touch. After changing code, run `npm run build` and tell me what you could and could not verify. Do not push to `main` without asking me.

If the platform can read the repo, the same file is `PROJECT_CONTEXT.md` in the repo root. Deeper background is in `README.md`, `Auravedic_Dashboard_Context_Handbook.md` and `Auravedic_External_Dashboard_Scope.md` in the repo root.

---

## 1. What this is, and the objective

**Auravedic** is an Indian Ayurvedic skincare brand (hero product: Kumkumadi Tailam 100ml, code K100). It sells through its own Shopify store (auravedic.com) and through Amazon.in, Flipkart, Nykaa and Myntra (Purplle and Snapdeal are minor and stale). Everything is in rupees, IST.

This project is an **independent cross-channel dashboard** that lives outside Claude, so the executive, marketing, marketplace, warehouse and finance teams can run it without depending on anyone. It answers four questions:

1. What did we sell, on every channel?
2. What did we spend to get those sales, and was it worth it? (Meta, Google, Amazon Ads, Flipkart ads)
3. What is the real profit, after returns, COGS, shipping, marketplace fees and ads?
4. What should someone do today? (the **Today's Actions** page, written in plain English for operators who do not read numbers)

Audiences: management reads Executive Summary, P&L and Advertising; operators read Today's Actions and Warehouse; finance reads P&L and Data Health.

**Live site:** https://dmauravedic.github.io/auravedic-performance-os/
**Repo (public):** https://github.com/dmauravedic/auravedic-performance-os (it moved from `adw0y/...`; the old URL redirects)

---

## 2. How it works (architecture)

It is a **static site**. There is no backend, and the browser never calls any API or holds any credential.

```
Sources                          Google Sheets                    GitHub Action                 Site
------------------------------   ------------------------------   --------------------------   --------------
Shopify (Claude scheduled task)  Feed workbook "Auravedic         .github/workflows/deploy.yml  GitHub Pages
Windsor: Meta, Amazon sales,       Dashboard Data" (Windsor tabs) runs on push to main, daily
  Amazon settlement, Amazon Ads  Google Ads sheet (_GoogleAds_    06:30 IST, and by hand:
Google Ads script                  Daily tab)                       1. scripts/sync_from_sheet.py
Shan's report sheet (manual)     Shan's report sheet (bounded       (read-only service account)
Slack reports (Flipkart, stock)    ranges only)                     2. writes src/data/*.json|ts
                                                                    3. npm run build, deploy
```

- **Windsor directly (4 Nov):** with the secret `WINDSOR_API_KEY`, the Action pulls Meta, Amazon sales and Amazon Ads from Windsor's API (`scripts/windsor_api.py`), no sheet involved. These win over the Windsor tabs in the feed workbook. Amazon Ads is pulled once per ad type and summed.
- With no secrets set, the sync prints "not configured" and the build keeps the **bundled snapshot** in `src/data/`. That is the state today.
- A tab that is missing or empty keeps its bundled snapshot. A tab that is present but malformed **fails the run** with the tab, row and column, so the last good site stays up.
- Sheet ids and the service-account key live only in GitHub **Secrets** (never Variables: the workflow log of a public repo is public).

**Stack:** Vite, React 18, TypeScript, Tailwind, Recharts, lucide-react, papaparse and xlsx (uploads and exports). Python 3.12 for the sync (`gspread`, `google-auth`, only in Google mode).

**Run it:**
```bash
git clone https://github.com/dmauravedic/auravedic-performance-os.git
cd auravedic-performance-os
npm install
npm run dev        # hot reload; Vite prints the local URL
npm run build      # production build into dist/
npx tsc --noEmit   # typecheck: exactly ONE known error today (src/data/initialData.ts, TS2352); the build is unaffected
```

**Preview another date:** add `?now=2026-10-26T10:00` to the URL. It reruns every freshness check as of that moment (useful because the bundled data ends 25 Oct).

**Test the sync without Google:**
```bash
python scripts/sync_from_sheet.py --export-csv ./tmp --include-daily           # current data as template CSVs
python scripts/sync_from_sheet.py --csv-dir ./tmp --out-dir ./out --dry-run    # validate; add --out-dir to write elsewhere, not into src/data
```
Tab CSVs are named after tabs (`google_daily.csv`, `amz_ads_daily.csv`, `meta_daily.csv`, `daily.csv`, ...). If you write into `src/data` while testing, restore it afterwards with `git checkout -- src/data/dailyData.ts src/data/dashboardData.json`.

---

## 3. Key files

| Area | Files |
|---|---|
| Pages | `src/components/views/*View.tsx` (Actions, Executive, ProfitLoss, Advertising, ShopifyStore, Marketplaces, ProductsRecipes, InventoryOps, DataHealthIngestion). Routing is a `currentView` string in `src/context/DashboardContext.tsx`; `App.tsx` renders the page. The default page is `actions`. |
| Today's Actions | `src/utils/actions.ts` (all rules and thresholds, plain-English wording), `useActionPlan.ts`, `components/views/ActionsView.tsx` |
| Maths | `src/utils/calculations.ts` (metrics, P&L), `adsAnalytics.ts` (ad findings), `periods.ts` (date windows), `unitEconomics.ts`, `inventoryPlan.ts`, `exportWorkbooks.ts` |
| Freshness | `src/utils/freshness.ts` (status logic), `src/data/channelLatency.ts` (rules per source), `src/data/dataSources.ts` (the table on Data Health), `components/layout/FreshnessStrip.tsx`, `StaleBanner.tsx` |
| Data (baked) | `src/data/dailyData.ts` (60-day daily series), `dashboardData.json` (everything else), `assumptions.ts`, `adLevelData.ts` (illustrative ad sets) |
| Sync | `scripts/sync_from_sheet.py` (entry), `windsor_api.py` (Windsor API pulls), `windsor_daily.py` (daily merges and the Google/Amazon Ads readers), `marketplace_ads.py` (Shan's monthly ad tabs), `data_io.py`, `build_seed_data.py` |
| Deploy | `.github/workflows/deploy.yml` |

---

## 4. The rules the numbers follow (do not change silently)

- **Periods follow the data.** Yesterday, 7/14/30 days, MTD and MoM all hang off the newest date in `dailyRecords` (`periods.ts`), each against an equal prior span. Records must be oldest to newest. Labels show real dates.
- **COGS:** Shopify is a flat **₹125 per unit** (aggregates assume 1.3 units per order); marketplaces are **27.5% of sales** by default (the 25 to 30% range, slider on the P&L page, constants in `assumptions.ts`). Both are placeholders until finance supplies real landed costs.
- **Shipping:** ₹65 per order over ₹499 (aggregates use 0.8 shipped orders per order).
- **Marketplace fees:** Amazon from settlement; Flipkart 22%, Nykaa 25%, Myntra 28% of sales are assumed rates.
- **Ad spend:** Meta is 5 accounts (the Admin account is excluded everywhere; any Meta ad-day over ₹50,000 of purchase value per purchase is dropped as a glitch). Google is one daily total. **Amazon ad spend is the `amazonBilledAds` field**: the Windsor Amazon Ads export once loaded, otherwise settlement billing (13 to 25 Oct) and a flat-rate estimate before that. Flipkart ads are monthly.
- **Blended MER** = (Shopify pre-returns sales + Amazon sales) divided by (Meta + Google + Amazon ads). Executive Summary, Advertising and net profit all use it, so a change to Amazon ad spend moves headline numbers. Shopify-only views use Meta + Google. The daily `totalAdsIncluded` field is Meta + Google but the UI does not read it.
- **Headline Shopify sales is gross minus discounts, before returns,** so batch refund days do not distort it.
- **Freshness:** every source has an accepted delay (`FRESHNESS_RULES`): fresh, behind-by-design (a blue note, never a flag), or stale (red). Examples: Meta, Google and Shopify stale after 36 hours; Amazon stale after 72 hours (1 to 2 days behind is normal); Flipkart runs about a day behind; the stock desk skips Sundays; monthly reports are dated by month. The freshness strip is stamped from the data each sync (newest day each export fed in the series).
- **Estimates are labelled** (Golden Rule 4 below), never presented as facts.

---

## 5. What has been built

1. **Eight pages** (Executive Summary, P&L with a dual view and waterfall, Advertising and ROAS, Shopify D2C with funnel and COD/RTO, Marketplaces, Products and combo recipes, Warehouse and stock, Data Health), plus a ninth, **Today's Actions**, now the default page.
2. **Freshness and provenance:** a freshness strip, a stale banner, a last-updated time on every card, a "Data from" line on every card (automatic vs manual), and a sources table on Data Health.
3. **A real sync pipeline:** Google Sheets to JSON, with a read-only service account, bounded reads of Shan's sheet, Windsor tabs merged over the daily series, strict validation, a daily 06:30 IST rebuild and a manual trigger.
4. **Date-driven periods** (3 Nov 2026) and **COGS models** (flat ₹125 per unit, then marketplace COGS at 25 to 30% with a slider).
5. **Warehouse planning:** days of cover, CBE/Mumbai split, planning period, factory requirement, FBA projection, and two Excel exports with live formulas.
6. **Today's Actions** (3 Nov 2026): ranked plain-English cards (Do today, this week, keep an eye on) with lane chips (Ads, Stock, Orders and COD, Marketplaces, Data), a "what is working" list, a "do not trust these yet" list, and a glossary. At most one figure per card, an "Old data" or "Rough figure" note when it applies. Creative-fatigue cards are left out on purpose because the ad-set split is illustrative.
7. **Google Ads and Amazon Ads wiring** (3 Nov 2026): Google Ads is read from the `_GoogleAds_Daily` tab of its own sheet (columns `date, cost, conversions, conversion_value, exported_at`, filled by a Google Ads script, from 2026-09-01). Amazon Ads comes from a Windsor `amazon_ads` export into a new `amz_ads_daily` tab in the feed workbook and replaces the estimate. Tested end to end on sample data.
8. The repo was moved to the `dmauravedic` account.
9. **Windsor API direct** (4 Nov 2026, branch `windsor-api-direct`): Meta, Amazon sales and Amazon Ads (Sponsored Products, Brands, Brands video, Display, summed) pulled from Windsor's API at each build with `WINDSOR_API_KEY`. A 30-minute budget for all pulls; a source not ready is skipped and keeps its bundled data; Amazon Ads is skipped whole if any ad type is not ready. Tested on real Windsor data for 20 to 25 Oct through a saved fixture (`--windsor-fixture`), not yet against the live API from GitHub.

Recent commits (newest first): `a6f2b5e` Google Ads sheet + Amazon Ads Windsor + freshness follows data; `6ea4884` Today's Actions; `0342dec` date-driven periods and marketplace COGS; `bedbd70` red stale notes and flat ₹125 COGS; `cb98bec` data sources table, warehouse and FBA exports.

---

## 6. Where each channel's data really comes from

| Channel / metric | How it arrives | Notes |
|---|---|---|
| Shopify orders, sales | Claude scheduled task, daily ~05:25 IST, writes `data/shopify_daily.csv` | Daily totals only; the build reads the file |
| Meta Ads | Windsor API `facebook` (fallback: `meta_daily` tab) | Daily; 5 accounts; live to 3 Nov in Windsor |
| Google Ads | Google Ads script into `_GoogleAds_Daily` (separate sheet) | Daily; one row per day; read via secret `GOOGLE_ADS_SHEET_ID` |
| Amazon sales | Windsor API `amazon_sp` (fallback: `amz_sales_date` tab) | 1 to 2 days behind; live to 2 Nov in Windsor |
| Amazon settlement | Windsor `amazon_sp` | Day-level only for 13 to 25 Oct; earlier months use flat rates (refunds 4.8%, fees 27.2%) |
| Amazon Ads (daily) | Windsor API `amazon_ads`, one pull per ad type | Two accounts connected; only account ...2908 has spend. Sponsored Products about ₹21k to 24k a day, Display from 30 Oct (about ₹1k a day), Brands non-video ₹0. Brands video not checked (pull did not finish). A sheet export (`amz_ads_daily`) can only carry one ad type |
| Amazon Ads (monthly report) | Shan's sheet, tab `Amazon Ads` | Manual; kept as a cross-check |
| Flipkart | Reports posted in Slack and parsed by a task | Manual; rupee values are estimates (units x price) that ran about 8% high on 28 Oct |
| Nykaa, Myntra | Shan's sheet, monthly rows | Manual |
| Purplle, Snapdeal ads | Shan's sheet | Stale (last entries Jun 2024 and Dec 2023) |
| Warehouse stock | Nightly Slack stock report, typed-in constants in the app | Mon to Sat 23:00 IST |
| Amazon FBA plan, unit economics | Shan's sheet (`Amz-Inventory Plan`, `Sheet31`) | Manual |
| Amazon ASIN business report | Uploaded on Data Health | Session only |

---

## 7. Current state (3 Nov 2026)

- The site is live and up to date with the code, but it shows the **bundled snapshot to 25 Oct**. Every daily source reads stale, and the pages say so.
- **The repo has no GitHub secrets**, so the sync skips itself. Adding `WINDSOR_API_KEY` alone is enough for Meta, Amazon sales and Amazon Ads. As far as I know the service account has not been created or shared with any sheet, and the Windsor `amazon_ads` export is not yet pointed at `amz_ads_daily`.
- The sync, the Google reader and the Amazon Ads merge have been tested only on **sample files**, not against the live sheets.
- Dates will **not advance past 25 Oct** even after the secrets are set (gap 1 below).

---

## 8. Gaps and open items

### A. To make real data flow (nothing here is code)
0. **Fastest route:** add the repository secret `WINDSOR_API_KEY` (Windsor dashboard, API key) through the GitHub web page, merge the `windsor-api-direct` pull request, then run "Deploy to GitHub Pages" and read the "Sync data" step. In Windsor, turn the `amazon_ads` cache back on (it is deactivated, which makes each Amazon Ads pull take 15 minutes or more). Steps 1 to 4 are then only needed for Google Ads, Shan's sheet and Shopify.
1. In Google Cloud (project "dashboard", Sheets API already enabled), create a service account and a JSON key.
2. Share the feed workbook and the Google Ads sheet with the service account's email as **Viewer** (and Shan's sheet if its tabs are wanted; only its owner can share it).
3. In the GitHub repo, Settings, Secrets and variables, Actions, add: `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_SHEET_ID`, `GOOGLE_ADS_SHEET_ID`, and `SHAN_SHEET_ID` (optional).
4. (Not needed with the Windsor API route.) In Windsor, point the `amazon_ads` export at the `amz_ads_daily` tab (daily, last 90 days; fields date, campaign_id, campaign, cost, impressions, clicks, purchases, sales).
5. Run "Deploy to GitHub Pages" from the Actions tab and read the "Sync data" step. A failure names the tab and column.

### B. Data gaps
1. **New days (decided 4 Nov: option "show as incomplete").** The sync adds every day after the series end that any source covers and lists the sources with no figures in the row's `missing` field. The app counts each figure only over days where all its sources are reported (`src/utils/coverage.ts`), names the missing days, hides % changes for part-periods, shows "Not reported yet" when nothing is complete, and draws gaps in charts. Until Shopify is automated, Shopify-based figures (All channels, Shopify, P&L, Advertising) stop at 25 Oct while Amazon and Meta move forward.
2. **The bundled daily series is not a real export.** Block totals match the handbook (27 to 31 Aug, 1 to 25 Sep, 26 to 30 Sep, 1 to 25 Oct) but the day-to-day values are seeded noise. Real days replace it only where a live export overwrites them (Google from 1 Sep; Amazon Ads for its 90 days).
3. **Shopify (4 Nov):** real daily totals from `data/shopify_daily.csv`, refreshed each morning (~05:25 IST) by a Claude scheduled task through the Shopify connector and committed to `main`. This replaces the seeded Shopify days too. Windsor's Shopify app would not install from the account available (store probably owned by another login); revisit with the store owner if the dashboard should stop depending on Claude for Shopify.
4. **Meta ad-set detail is illustrative** (`adLevelData.ts`): spend, purchases and ROAS tie to the real accounts but CTR, frequency and the ad-set split are generated. A Windsor `facebook` ad-set export is needed.
5. **Costs are placeholders:** flat ₹125 per unit and 27.5% of marketplace sales. Real landed costs per SKU (a `dim_costs` tab was proposed, not built) would replace them. Not confirmed whether the 27.5% applies to gross sales before refunds (assumed so).
6. **Amazon settlement (4 Nov):** now pulled daily from Windsor (refunds, fees, billed ads by posted date). **Missing reports:** payment gateway and COD fees, Flipkart settlement reports, Flipkart cancellation and return reasons, stock reports for Flipkart, Nykaa, Myntra, Purplle and Snapdeal, the Amazon 21 Oct ₹1.94L fee adjustment (unclassified, excluded), full Amazon settlement history.
7. **Amazon ad spend, daily vs settlement:** for 20 to 25 Oct, Amazon Ads reports ₹21k to 23k a day; the settlement billing in the series is ₹28k to 37k a day, so loading the Windsor figure lowers Amazon ad cost and lifts profit and MER for those days. The gap may be GST (18%) and billing timing, or Brands video spend not yet checked. Confirm before trusting either.
   **Amazon ad spend, monthly view:** Shan's monthly report runs 13 to 46% below the settlement-based estimate in the `monthly` tab (Sep 2026: 5.33L vs 7.80L). The Advertising page flags it "Needs check". The daily figure will use the Windsor export once loaded; the monthly roll-up estimate is unchanged.
8. **Warehouse stock (4 Nov):** real counts from the stock desk via `data/warehouse_stock.csv` (morning task). Run rates now come from the stock desk's own demand (Shopify plus inferred marketplace units, 30-day basis) via `scripts/stock_desk_export.cjs`; on 4 Nov that put K100 at ~4 days of cover. Mumbai's sheet has not been posted since 21 Oct, so the warehouse shows stale until it is. The CBE/Mumbai demand split (37%) is an estimate.
9. **Existing merge behaviour:** when Amazon sales are loaded for a day, the day's refunds, fees and (without an Amazon Ads row) billed ads are rescaled by the sales ratio, even on 13 to 25 Oct where they came from settlement. Not changed yet.
10. Settlement, Amazon inventory planning, FBA inventory and the ASIN business report are all cached daily in Windsor (`amazon_sp`) but not read by the sync yet. They could close the settlement-history, FBA-plan and ASIN-upload gaps.
11. Shopify: the Shopify connector in Claude returns daily orders, gross, discounts and returns to 3 Nov; nothing feeds `shop_daily` yet.
12. Whether the Google Ads script's newest row is a full day or a partial one is not confirmed (matters once new days are added).

### C. Product gaps
- **Not mobile-responsive:** the fixed 256px sidebar leaves about 119px for content at 375px. Operators on phones need a collapsible menu (touches every page).
- The Warehouse badge "2 Alerts" is hard-coded; the data shows three products under 14 days of cover.
- The Executive Summary menu sublabel says "KPIs, mix & actions" but there is no actions block there.
- Some Marketplaces cards are typed-in constants (for example the Amazon Ads deduction tile).
- The known TypeScript error `TS2352` in `src/data/initialData.ts` (fix: `as unknown as DashboardDataBundle`).
- The JS bundle is over 500 kB (no code-splitting). No automated tests: checks are the build, sample-CSV sync runs and a browser look.
- Today's Actions is English only. Hindi was discussed, not planned.

### D. Security (do these soon)
- **Shan's report sheet holds a plaintext payment-portal password** and customer and order tabs (MP Credentials, Payment List, Website Orders, Klaviyo, WhatsApp). Rotate the password and tighten the sharing.
- The Google Ads sheet is a **copy of Shan's sheet** and is shared view-only to anyone with the link. If that copy still has those tabs, they are publicly readable. Delete them from the copy, or move `_GoogleAds_Daily` into a clean sheet.
- The repo and site are **public**: never commit ids, keys, passwords or customer data.

---

## 9. Rules for whoever (or whatever) works on this

**Golden rules of the product**
1. Read-only on store and ad accounts.
2. **Zero PII:** no customer names, phones, emails or addresses are ever stored or shown.
3. Every view states which ad platforms it includes.
4. **Label estimates** (Flipkart rupees, pre-13 Oct Amazon settlement, flat COGS) and flag stale data. Never hide either, and never invent data to fill a gap.
5. Headline Shopify sales is before returns.
6. Keep the Meta glitch filter (over ₹50,000 per purchase) and the Admin-account exclusion.

**Working rules**
- **Never read, open, copy or print** a credential, a sheet id, or any sensitive tab of Shan's sheet. Read only the fixed ranges listed in `SHAN_RANGES` (`sync_from_sheet.py`) and `ADS_RANGES` (`marketplace_ads.py`), and the single `_GoogleAds_Daily` range. If you see a password anywhere, do not repeat it.
- Wording on **Today's Actions** is plain English: no RTO, MER or ROAS without explaining it. One figure per card. No cards built on illustrative data.
- Do not change a number's meaning (COGS, periods, MER, ad-spend basis) without saying so and updating the README, the Data Health table and this file.
- Prefer small changes; match the surrounding style. After any change run `npm run build` and `npx tsc --noEmit` (one known error) and say what you did not verify.
- **A push to `main` deploys live** within a minute. On a shared or borrowed machine, work on a branch and open a pull request instead.

**Safe use on someone else's computer**
- Do not stay signed in to GitHub, Google or Windsor. Use a private window and sign out when you finish.
- Do not download the service-account JSON key onto that machine; add it as a secret through the GitHub web page and delete any copy.
- Do not paste secrets, sheet ids or the Shan sheet's contents into the coding platform: it is a third party and may keep your prompts.
- Delete the cloned folder afterwards.

---

## 10. Glossary

- **COD:** cash on delivery. **RTO:** a parcel that comes back undelivered (usually a refused COD order). The high-RTO states flagged are Bihar, Rajasthan, Assam, West Bengal and J&K.
- **MER:** sales per rupee of ads, all channels blended. **ROAS:** sales attributed to an ad platform per rupee of its spend. Break-even is the return per rupee needed to cover product and shipping.
- **TACOS:** ad spend as a percent of total channel sales. **CPP:** cost per purchase.
- **FBA / FBF:** stock held in Amazon's / Flipkart's own warehouses. **DOC:** days of cover (stock divided by daily run rate). Red under 7 days, amber 7 to 14, green over 14; reorders top up to 45 days.
- **CBE:** the Coimbatore warehouse (ships South India: TN, KA, KL, AP, TS, PY); the rest ship from Mumbai.
- **Windsor:** the Windsor.ai connector service that exports ad and sales data into Google Sheets.
- **Snapshot:** the data baked into the repo, shown whenever the sync is not connected.
