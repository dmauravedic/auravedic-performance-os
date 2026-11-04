import type { DashboardDataBundle } from './initialData';
import type { LatencySourceKey } from './channelLatency';

/**
 * Every place the dashboard takes data from, written down once. The Data Health page renders this
 * as the "where does this come from" table. Origins and schedules come from the Context Handbook
 * (§2.4 scheduled tasks, §5 source notes) and the sync scripts; `today` says what the page is
 * actually showing, which is not always the live source.
 */
export type SourceGroup = 'Sales' | 'Advertising' | 'Inventory' | 'Costs & reference';
export type Arrival = 'Automated' | 'API + manual' | 'Manual' | 'Not connected' | 'Static';

export interface SourceRow {
  group: SourceGroup;
  name: string;
  provides: string;
  origin: string;
  arrives: Arrival;
  schedule: string;
  /** What this dashboard is showing right now for this source. */
  today: string | ((d: DashboardDataBundle) => string);
  /** Ties the row to a freshness check. Rows without one are either static or carry no date. */
  freshnessKey?: LatencySourceKey;
  /** Shown in "Last updated" for a row with no freshness check, instead of "Not dated". */
  lastNote?: string;
  usedOn: string;
}

const lastReport = (d: DashboardDataBundle, channel: string): string => {
  const rows = (d.marketplaceAds ?? []).filter(a => a.channel === channel).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  return rows.length ? rows[rows.length - 1].month : 'none';
};

export const SOURCE_ROWS: SourceRow[] = [
  // ───────────── Sales
  {
    group: 'Sales',
    name: 'Shopify orders and sales',
    provides: 'Orders, gross sales, discounts, returns, COD vs prepaid mix',
    origin: "Shopify Analytics, read each morning by a Claude scheduled task and saved as data/shopify_daily.csv in the repo (daily totals only)",
    arrives: 'Automated',
    schedule: 'Daily at about 05:25 IST, through yesterday; the 06:30 build picks it up',
    today: 'Real daily Shopify totals from 27 Aug. If the morning task fails, the file stops moving and this source turns stale.',
    freshnessKey: 'shopify',
    usedOn: 'Executive, P&L, Advertising, Shopify'
  },
  {
    group: 'Sales',
    name: 'Amazon sales',
    provides: 'Ordered product sales, units, order items',
    origin: 'Windsor API, connector amazon_sp (Sales and Traffic by date), pulled at each build',
    arrives: 'Automated',
    schedule: 'Daily. Amazon reports about a day behind; two days is normal',
    today: 'Bundled snapshot to 25 Oct until the WINDSOR_API_KEY secret is set.',
    freshnessKey: 'amazonSales',
    usedOn: 'Executive, P&L, Marketplaces'
  },
  {
    group: 'Sales',
    name: 'Amazon ASIN business report',
    provides: 'Units and sales for each of the 55+ listings',
    origin: 'Seller Central Business Report (CSV), uploaded on the Data Health page',
    arrives: 'Manual',
    schedule: 'When someone uploads it',
    today: 'Bundled snapshot. An upload replaces it for the session only.',
    usedOn: 'Marketplaces (Amazon)'
  },
  {
    group: 'Sales',
    name: 'Amazon settlement',
    provides: 'Fees, refunds, promotions, billed advertising',
    origin: 'Windsor API, connector amazon_sp (Settlement v2), pulled at each build',
    arrives: 'Automated',
    schedule: 'Daily, by posted date (1–2 days after the order day)',
    today: 'Real refunds and fees per posted day wherever the report covers it; days it does not cover use the flat rates. Fees land on posting days, so single days swing; periods even out.',
    freshnessKey: 'amazonSettlement',
    usedOn: 'P&L, Marketplaces, Advertising'
  },
  {
    group: 'Sales',
    name: 'Flipkart orders and sales',
    provides: 'Orders report and daily product sales from Seller Hub',
    origin: 'Posted in Slack #flipkart-reports, read by Claude scheduled task #16',
    arrives: 'Manual',
    schedule: 'Daily at 09:40 IST. Runs about a day behind by design',
    today: 'Orders through 29 Oct. Rupee values are estimates (units × current price) and ran about 8% high on 28 Oct.',
    freshnessKey: 'flipkart',
    usedOn: 'Executive, Marketplaces (Flipkart)'
  },
  {
    group: 'Sales',
    name: 'Nykaa sales and ads',
    provides: 'Monthly sales, orders, AOV, ad spend and ROAS',
    origin: "Shan's report sheet, tab Nykaa Ads",
    arrives: 'Manual',
    schedule: 'One row a month, entered after the month closes',
    today: d => `Latest month: ${lastReport(d, 'Nykaa')}.`,
    freshnessKey: 'nykaa',
    usedOn: 'Executive, Marketplaces (Nykaa), Advertising'
  },
  {
    group: 'Sales',
    name: 'Myntra sales and ads',
    provides: 'Monthly sales, orders, AOV, ad spend and ROAS',
    origin: "Shan's report sheet, tab Myntra Ads",
    arrives: 'Manual',
    schedule: 'One row a month, entered after the month closes',
    today: d => `Latest month: ${lastReport(d, 'Myntra')}.`,
    freshnessKey: 'myntra',
    usedOn: 'Executive, Marketplaces (Myntra), Advertising'
  },
  // ───────────── Advertising
  {
    group: 'Advertising',
    name: 'Meta Ads',
    provides: 'Spend, purchases and purchase value for 5 accounts (Admin excluded)',
    origin: 'Windsor API, connector facebook, pulled at each build',
    arrives: 'Automated',
    schedule: 'Daily, at the 06:30 IST build. Ad-days over ₹50,000 per purchase are dropped as glitches',
    today: 'Bundled snapshot to 25 Oct until the WINDSOR_API_KEY secret is set.',
    freshnessKey: 'meta',
    usedOn: 'Executive, P&L, Advertising'
  },
  {
    group: 'Advertising',
    name: 'Meta ad-set detail (CTR, frequency, fatigue)',
    provides: 'Impressions, clicks, frequency by ad set',
    origin: 'Not connected. Needs a Windsor facebook ad-set export',
    arrives: 'Not connected',
    schedule: 'None yet',
    today: 'Illustrative sample. Spend, purchases and ROAS tie to the real account figures; the ad-set split does not.',
    usedOn: 'Advertising (Creative and funnel diagnostics)'
  },
  {
    group: 'Advertising',
    name: 'Google Ads',
    provides: 'Spend, conversions, conversion value',
    origin: 'Daily Google Ads sheet, tab _GoogleAds_Daily (read as one range; no other tab is opened)',
    arrives: 'Automated',
    schedule: 'Daily; the site picks it up at the next build',
    today: 'Bundled snapshot to 25 Oct until the sheet is connected.',
    freshnessKey: 'google',
    usedOn: 'Executive, P&L, Advertising'
  },
  {
    group: 'Advertising',
    name: 'Amazon Ads (daily spend)',
    provides: 'Daily Amazon ad spend (Sponsored Products, Brands, Brands video and Display, added together), used as the ad cost in the P&L and on the ad pages',
    origin: 'Windsor API, connector amazon_ads, one pull per ad type at each build',
    arrives: 'Automated',
    schedule: 'Daily. Amazon reports about a day behind; two days is normal',
    today: d =>
      d.freshness.amazonAds
        ? `Loaded to ${d.freshness.amazonAds.slice(0, 10)}. Replaces the settlement and flat-rate estimate for those days.`
        : 'Not loaded yet: ad spend is the settlement billing (13–25 Oct) and a flat-rate estimate before that.',
    freshnessKey: 'amazonAds',
    usedOn: 'P&L, Executive, Advertising'
  },
  {
    group: 'Advertising',
    name: 'Amazon Ads monthly report',
    provides: 'Monthly ad spend, ad revenue, orders, TACOS',
    origin: "Shan's report sheet, tab Amazon Ads",
    arrives: 'Manual',
    schedule: 'One column a month',
    today: d =>
      `Latest month: ${lastReport(d, 'Amazon.in')}. ${
        d.freshness.amazonAds
          ? 'Kept as a cross-check against the daily Amazon Ads spend.'
          : 'Combined ad spend and MER still use the settlement estimate, which runs higher.'
      }`,
    freshnessKey: 'amazonAdsReport',
    usedOn: 'Advertising (Marketplace ads, findings)'
  },
  {
    group: 'Advertising',
    name: 'Flipkart Ads report',
    provides: 'Monthly ad spend, ad revenue, orders',
    origin: "Shan's report sheet, tab FKT. The weekly campaign report also lands in Slack #flipkart-reports",
    arrives: 'Manual',
    schedule: 'Monthly in the sheet, weekly in Slack',
    today: d => `Latest month in the sheet: ${lastReport(d, 'Flipkart')}.`,
    freshnessKey: 'flipkartAds',
    usedOn: 'Advertising, Marketplaces (Flipkart)'
  },
  {
    group: 'Advertising',
    name: 'Purplle ads',
    provides: 'Monthly ad spend and ad revenue',
    origin: "Shan's report sheet, tab Purplle Ads",
    arrives: 'Manual',
    schedule: 'One row a month; no recent entries',
    today: d => `Latest month: ${lastReport(d, 'Purplle')}.`,
    freshnessKey: 'purplleAds',
    usedOn: 'Advertising (Marketplace ads)'
  },
  {
    group: 'Advertising',
    name: 'Snapdeal ads',
    provides: 'Monthly ad spend and ad revenue',
    origin: "Shan's report sheet, tab Snapdeal Ads",
    arrives: 'Manual',
    schedule: 'One row a month; no recent entries',
    today: d => `Latest month: ${lastReport(d, 'Snapdeal')}.`,
    freshnessKey: 'snapdealAds',
    usedOn: 'Advertising (Marketplace ads)'
  },
  // ───────────── Inventory
  {
    group: 'Inventory',
    name: 'Warehouse stock (CBE and Mumbai)',
    provides: 'Closing stock per product: CBE D2C available and bulk reserve, Mumbai stock in hand',
    origin: 'Nightly closing screenshots posted in Slack #inventory-wh-movement, read by Claude scheduled task #7',
    arrives: 'Manual',
    schedule: 'Monday to Saturday at 23:00 IST',
    today: "9 hero products, real counts from the stock desk, copied into the repo each morning (data/warehouse_stock.csv). Dated by the older of the two sheets. Daily run rates are still typed-in estimates, so days of cover are rough.",
    freshnessKey: 'warehouse',
    usedOn: 'Warehouse & Stock Operations'
  },
  {
    group: 'Inventory',
    name: 'Amazon FBA inventory plan',
    provides: 'FBA stock, inbound, average monthly sale, days of cover, units to send',
    origin: "Shan's report sheet, tab Amz-Inventory Plan",
    arrives: 'Manual',
    schedule: 'Updated by hand. The sheet carries no date',
    today: '5 ASINs from the sheet.',
    freshnessKey: 'inventoryPlan',
    usedOn: 'Warehouse & Stock Operations (Marketplace inventory)'
  },
  {
    group: 'Inventory',
    name: 'Flipkart FBF stock',
    provides: 'Units held at Flipkart fulfilment centres',
    origin: 'Weekly FBF inventory report, posted in Slack #flipkart-reports',
    arrives: 'Manual',
    schedule: 'Weekly',
    today: 'The report was received on 28 Oct, but its unit counts are not loaded into the dashboard.',
    usedOn: 'Marketplaces (Flipkart) status tile only'
  },
  {
    group: 'Inventory',
    name: 'Nykaa, Myntra, Purplle and Snapdeal stock',
    provides: 'Units held at each marketplace',
    origin: 'No source exists yet',
    arrives: 'Not connected',
    schedule: 'None',
    today: 'Not available. Add a stock tab to the report sheet to bring these in.',
    usedOn: '—'
  },
  // ───────────── Costs & reference
  {
    group: 'Costs & reference',
    name: 'Landed unit costs',
    provides: 'Landed COGS and unit economics per listing',
    origin: "Shan's report sheet, tab Sheet31",
    arrives: 'Manual',
    schedule: 'Updated by hand. No date',
    today: 'Read, but not used for cost. Every product and combo is costed at a flat ₹125 per unit (the sheet shows about ₹100) until finance supplies real landed costs.',
    usedOn: 'Products & Recipes, P&L (assumption)'
  },
  {
    group: 'Costs & reference',
    name: 'Monthly performance, Apr–Oct',
    provides: 'Monthly sales, ad spend, ROAS, profit',
    origin: 'Handbook monthly roll-up (feed workbook tab monthly)',
    arrives: 'Manual',
    schedule: 'Monthly, from the finance roll-up',
    today: 'Bundled figures to Oct.',
    usedOn: 'Executive, Advertising (trend)'
  },
  {
    group: 'Costs & reference',
    name: 'Products and recipes',
    provides: '43 base products, combo recipes',
    origin: 'Stock desk kit and the handbook',
    arrives: 'Static',
    schedule: 'Updated on edit',
    today: '18 of the 190 recipes are loaded.',
    usedOn: 'Products & Recipes'
  },
  {
    group: 'Costs & reference',
    name: 'State COD and RTO risk',
    provides: 'Orders, COD share and RTO rate for 11 states',
    origin: 'Shopify orders by state, kept as figures in the bundle',
    arrives: 'Static',
    schedule: 'Not refreshed',
    today: 'Fixed figures. Also used to estimate the CBE share of demand on the Warehouse page.',
    usedOn: 'Shopify, Warehouse'
  },
  {
    group: 'Costs & reference',
    name: 'In-app report upload',
    provides: 'Amazon business reports, Windsor CSVs, Shan-Report-Sheet.xlsx',
    origin: 'Files dropped on the Data Health page, parsed in the browser',
    arrives: 'Manual',
    schedule: 'Instant, for the session only',
    today: 'Nothing is sent anywhere; a reload clears an upload.',
    lastNote: 'On demand',
    usedOn: 'Data Health'
  }
];
