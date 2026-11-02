# Auravedic Cross-Channel Performance & Commerce Dashboard

An independent, production-grade analytics web application covering every Auravedic sales and marketing channel. Designed to live outside Claude so anyone across the executive, marketing, marketplace, warehouse, and finance teams can run it without dependencies.

---

## 🚀 Quick Start (Local Launch)

### Option 1: One-Click Launch (Windows)
Double-click `start-dashboard.bat` (production build) or `start-dev.bat` (hot-reload dev server) in this directory.

### Option 2: Command Line
```bash
# 1. Install dependencies (already installed)
npm install

# 2. Start development server (http://localhost:3000)
npm run dev

# 3. Or build & run production preview
npm run build
npm run preview
```

---

## 📊 The 8 Core Pages

1. **Executive Summary**:
   - High-level KPIs: Total Gross Sales (pre-returns), Blended Ad Spend, Blended MER, Realistic Net Profit, Contribution Margin %, Total Orders, Blended AOV, CAC, Amazon TACOS.
   - Channel Sales Mix: Stacked multi-channel volume over time (Shopify vs Amazon vs Flipkart vs Others).
   - Target Pacing: MTD pacing against monthly targets with run-rate projections.
   - Daily Executive Intelligence: Top 5 algorithmic findings and top 3 prioritized tactical actions.

2. **Profit & Loss (P&L)**:
   - Dual P&L view: Dashboard-basis (Sales pre-returns minus ad spend) vs Realistic P&L (Net sales minus COGS, shipping, marketplace fees, and ads).
   - Interactive Waterfall Chart: Step-by-step margin erosion from gross billings down to net profit.
   - Channel P&L Cards: Dedicated Shopify and Amazon standalone P&Ls.
   - Dynamic Sensitivity Simulator: Adjust unit COGS (₹80–₹220), shipping rates, and monthly overheads in real time.

3. **Advertising & ROAS**:
   - What the data says: findings computed from the figures on the page (platform over-claim, store ads vs break-even, Amazon ad load, MER trend, creative fatigue).
   - Platform scorecard: spend share, return per ₹1 and cost per result for Meta, Amazon Ads, Google Ads and Flipkart Ads, with the basis (attributed vs estimate) stated.
   - Daily spend and daily ROAS charts (one axis each, break-even line), plus an April-to-October trend from the handbook's monthly figures. Every chart has a table view.
   - Meta account league: spend, purchases, CPP and ROAS for `New26`, `Auravedic Internal`, `MP2`, `Auravedic GC` and `Fresh Pixel`, ranked against the Meta average and break-even. `Auravedic Admin` is excluded from every figure per the handbook. Fresh Pixel is judged on its Initiate Checkout objective, not purchase ROAS.
   - Budget reallocation simulator: test a move between accounts with diminishing returns built in.
   - Creative and funnel diagnostics: CTR, CPM, click-to-purchase rate, frequency and a fatigue / leak diagnosis per ad set. **This section runs on an illustrative ad-set sample** (`src/data/adLevelData.ts`): spend, purchases and ROAS tie to the real account figures, but the ad-set split, impressions, clicks and frequency are generated until a Windsor `facebook` ad-set export is loaded.

4. **Shopify D2C Store**:
   - E-commerce Funnel: Sessions → Product Views → Add to Cart → Initiated Checkout → Completed Orders with drop-off percentages.
   - COD vs Prepaid Economics: State-wise COD share and RTO risk matrix (flagging critical high-RTO states: Bihar 24.5%, Rajasthan 18.2%, Assam 22%, West Bengal 17.8%, J&K 21.5%).
   - Reversal Audit: Historical analysis of large refund/cancellation batches (e.g. August 2026 43% reversal event).
   - Helio AI Chatbot: Attributed orders, revenue, and top customer inquiries/objections.

5. **Marketplaces (Amazon, Flipkart, Nykaa, Myntra)**:
   - Amazon ASIN Deep Dive: 55+ product listings parsed directly from Seller Central Business Reports.
   - Settlement Reconciler: Item principal vs refunds, promos, fees (~27%), and billed ads (~28%). 21 Oct ₹1.94L fee adjustment isolated.
   - Flipkart Seller Hub: Delivered lines, return rates (13.5%), FBF stock, and real vs estimated sales gap.
   - Emerging Channels: Dedicated tracking for Nykaa and Myntra.

6. **Products & Combo Recipes**:
   - 43 Base Products Master Table: Complete catalog of base items with landed costs and MRPs.
   - Combo Recipe Deconstruction Engine: Explodes 190 finished SKUs and combo bundles into physical base units. Select any base product to see every listing across channels that draws from its factory stock.
   - Unit Economic Margin Traps: Real SKU economics from Sheet31 exposing loss-making bundles (e.g. `KNS+KNC` combo losing ₹235 per order after RTO).

7. **Warehouse & Stock Operations**:
   - Warehouse level filter (All / Coimbatore / Mumbai) drives the cards, the days-of-cover table and the factory requirement. A hub's cover counts only the share of sales that ships from it (CBE share starts from the Shopify order mix by state and can be overwritten).
   - Dispatch Rule: South India orders (TN, KA, KL, AP, TS, PY) ship from CBE; rest ship from Mumbai.
   - Days of Cover (DOC): Color-coded alerts (Red &lt;7d, Amber 7–14d, Green &gt;14d). Reorder batches top stock up to 45 days.
   - **Planning period and factory requirement**: pick a date range and safety stock; the page works out units to produce per product for the chosen warehouse (demand, plus safety stock, minus stock expected on day one, after sales since the last stock report). **Download for factory (.xlsx)** exports it with live formulas, so the dates can also be changed inside Excel.
   - **Marketplace inventory**: Amazon FBA stock projected over the same period (days of cover, stock at end, units to send, beside what the plan sheet suggests), with **Download marketplace plan (.xlsx)**. Flipkart, Nykaa, Myntra, Purplle and Snapdeal have no stock report yet; the download includes a fill-in sheet for them wired to the same dates.

8. **Data Health & In-App Ingestion**:
   - In-App Report Uploader: Drag and drop Amazon Business Reports (`.csv`), Windsor exports, or `Shan-Report-Sheet.xlsx` to parse and update dashboard state on the fly.
   - Governance & Assumptions: Flat ₹125 COGS default, ₹65 shipping for orders &gt; ₹499.
   - Missing Reports Checklist: Outstanding data stream audits.

---

## 🛡️ Enforced Golden Rules

1. **Read-Only on Store & Ad Accounts**: Direct integrations and data processing are strictly read-only.
2. **Zero PII**: No customer names, phone numbers, email addresses, or street addresses are ever stored or presented.
3. **Explicit Ad Attribution Badges**: Every view displays an attribution badge specifying active ad channels.
4. **Label Estimates**: Flipkart rupee figures, pre-13 Oct settlement estimates, and flat COGS figures are clearly badged as estimates.
5. **Pre-returns Headline vs Net Sales**: Headline Shopify sales is Gross − Discounts (pre-returns) to eliminate distortion from batch refund processing days.
6. **Glitch Filters**: Drops Meta ad-days exceeding ₹50k purchase value per purchase.

---

## 🔄 Going live from a Google Sheet

The dashboard is a static site, so "live" means the data files are refreshed before every build. A scheduled GitHub Action (`.github/workflows/deploy.yml`, 06:30 IST daily) runs `scripts/sync_from_sheet.py`, builds and deploys. Nothing is fetched in the browser and no credentials reach it.

**Data tabs** (header names in row 1; extra columns are ignored; a missing or empty tab keeps the bundled snapshot):

| Tab | Feeds | Who fills it |
|---|---|---|
| `marketplaces` | Executive scorecard, Marketplaces page (Nykaa / Myntra figures) | Whoever owns the marketplace reports |
| `monthly` | Monthly trend charts and insights | Monthly, from the finance roll-up |
| `meta_accounts` | Meta account league | When account shares change |
| `freshness` | Data freshness strip and assumptions | Updated by whatever loads the sheet |
| `daily` | All daily charts, P&L, Advertising | Windsor / Shopify daily exports, once real data replaces the seeded series |

Format long IDs (`accountId`) and dates (`YYYY-MM-DD`) as plain text so Sheets does not turn them into numbers or dates.

**One-time setup**
1. In Google Cloud, create a project, enable the Google Sheets API, and create a service account. Download its JSON key.
2. Share the sheet with the service account's email address, as a Viewer.
3. In the GitHub repo, go to Settings > Secrets and variables > Actions > Secrets. Add `GOOGLE_SERVICE_ACCOUNT_JSON` (the whole key file) and `GOOGLE_SHEET_ID` (the long id in the sheet's URL). Use secrets, not variables: a variable's value is printed in the workflow log, which is public for a public repository.
4. Run the workflow once from the Actions tab to check it.

If the sheet has bad data (a non-number in a number column, a missing column, a duplicate date), the sync fails with the tab, row and column, and the deploy stops, so the last good site stays up.

**Shan's report sheet** is an optional second source (secret `SHAN_SHEET_ID`, shared with the same service account as Viewer). It is a working sheet with many other tabs, so the script reads only these, in fixed ranges, and never a whole tab:

| Tab and range | Feeds |
|---|---|
| `Sheet31` A1:K11 | Unit economics on the Products page (the `DEFAULT` baseline row is kept) |
| `Amz-Inventory Plan` A1:I12 | Amazon inventory plan |
| `Nykaa Ads` A1:L200 | Nykaa sales, orders, AOV, ad spend and ROAS (latest month with orders) |
| `Myntra Ads` A1:I200 | The same for Myntra |
| `Amazon Ads` A1:BD12, `FKT` A1:H70, `Purplle Ads` A1:F80, `Snapdeal Ads` A1:F80 (and Nykaa / Myntra Ads again) | The monthly "Marketplace ads" section on the Advertising page: spend, ad revenue, ROAS and TACOS, last 24 reported months each. A marketplace with no recent report is flagged. |

**Windsor.ai exports** write straight into the feed workbook, one tab each, and replace the built-in daily figures for the source they cover. Set them up in Windsor's own dashboard (destination Google Sheets, this workbook, the tab name below, daily at 06:00 IST, last 90 days). The workbook's README tab lists the exact fields to select.

| Tab | Windsor connector | Overwrites |
|---|---|---|
| `meta_daily` | `facebook` | Meta spend, purchases, purchase value. The excluded account and rows over ₹50,000 per purchase are dropped. |
| `google_daily` | `google_ads` | Google spend, conversions, conversion value |
| `amz_sales_date` | `amazon_sp` (Sales and Traffic by date) | Amazon sales and order items. Refunds, fees and billed ads follow sales until a settlement export is added. |
| `shop_daily` | `shopify` | Shopify gross sales, discounts, returns, orders |

Column names are matched loosely (case, spaces and underscores are ignored), a missing required column stops the run and lists what was found, and repeated rows from an appending export are ignored. A source with no rows leaves the built-in figures alone. **Only days already in the dashboard (27 Aug to 25 Oct) are overwritten for now**: days after that are reported in the run log and not added, because the app's period logic (MTD, last 7 days, prior periods) is still tied to the bundled 60-day window.

The month each channel's figures cover is shown next to them. Channel shares are recomputed across the listed channels so they add to 100%. Keep the `Sheet31` table within rows 1 to 11 and put nothing sensitive in these tabs or ranges. **Do not keep passwords or payment-portal logins in any sheet that is shared with the service account or with a link.**

**Is the data current?** Every card and section shows when its data was last updated and checks that against how late the source is allowed to be. The Data Health page lists every source, where it comes from and whether it is current. A source can be in one of three states:

| State | Meaning | Examples |
|---|---|---|
| Fresh | Inside its normal schedule | Shopify, Meta, Google within 36 hours |
| Note (blue) | Behind, but by design, so it is **not** flagged | Flipkart runs about a day behind (stale after 3 days). Amazon runs 1–2 days behind (stale after 3). The stock desk skips Sunday. Monthly reports are entered after the month closes |
| Stale (red) | Past its accepted delay: the figures are not current. A red banner appears at the top | Shopify not updated for more than 36 hours. A missed nightly stock report |

The limits live in `FRESHNESS_RULES` in `src/data/channelLatency.ts`, and the table of sources in `src/data/dataSources.ts`. The dashboard shows a bundled snapshot until the sheet sync is switched on, so with the snapshot ending on 25 Oct every daily source will read as stale from the 27th until the sync is live. To see how the page looks on another day, add `?now=2026-10-27T10:00` to the address.

**Local use**

```bash
python scripts/sync_from_sheet.py --export-csv sheet-template --include-daily   # current data as a template
python scripts/sync_from_sheet.py --csv-dir sheet-template --dry-run             # validate without writing
python scripts/sync_from_sheet.py --csv-dir sheet-template                       # write src/data from CSVs
```

**Hosting and privacy.** The dashboard holds business numbers, so keep the repository private. GitHub Pages is not available for private repositories on the free plan, and on paid plans the site address stays public unless you use an enterprise access-controlled setup. For a private site, deploy the `dist` folder to a host with a login in front of it, or run `start-dashboard.bat` locally.
