import type { ChannelFilter, DashboardView } from '../context/DashboardContext';

/**
 * How stale each data source normally is, taken from the pipeline cadences in the
 * Context Handbook (§2.4 scheduled tasks, §5 source notes). Badges resolve their
 * latency from this table, so it follows the channel on screen instead of being
 * one fixed string.
 */
export type LatencySourceKey =
  | 'shopify'
  | 'meta'
  | 'google'
  | 'amazonSales'
  | 'amazonSettlement'
  | 'amazonAds'
  | 'amazonAdsReport'
  | 'flipkart'
  | 'flipkartAds'
  | 'nykaa'
  | 'myntra'
  | 'purplleAds'
  | 'snapdealAds'
  | 'warehouse'
  | 'inventoryPlan'
  | 'callChase'
  | 'browser'
  | 'reference';

// Never matches text: these sources are only ever named explicitly, so existing badges are unchanged.
const NEVER_BY_TEXT = /(?!)/;

export interface LatencySource {
  label: string;
  latency: string;
  /** Matched against the lower-cased source/pipeline text of a badge. */
  match: RegExp;
}

// Task #9 pulls "yesterday" from Windsor (Meta, Amazon) and Shopify at 04:51 IST, and the Google Ads
// sheet is refreshed in the same window. This is the source's schedule: the dashboard itself shows a
// fixed snapshot until the sheet sync is on.
const DAILY_PULL = 'T-1 (source loads ~04:51 IST)';

// Declaration order is the display order.
export const LATENCY_SOURCES: Record<LatencySourceKey, LatencySource> = {
  shopify: { label: 'Shopify', latency: DAILY_PULL, match: /shopify/ },
  meta: { label: 'Meta', latency: DAILY_PULL, match: /\bmeta\b|facebook|instagram/ },
  google: { label: 'Google Ads', latency: DAILY_PULL, match: /google/ },
  amazonSales: {
    label: 'Amazon sales',
    latency: '1–2d behind (Amazon report lag)',
    match: /sp-api|seller central|amazon fba|business report|sales & traffic|amazon ordered/
  },
  amazonSettlement: {
    label: 'Amazon settlement',
    latency: '1–2d behind · pre-13 Oct estimated',
    match: /settlement/
  },
  amazonAds: {
    label: 'Amazon Ads',
    latency: '1–2d behind (Amazon report lag)',
    match: /billed ads|amazon ads|amazon ad spend/
  },
  amazonAdsReport: { label: 'Amazon Ads monthly report', latency: 'Monthly totals of the daily Amazon Ads feed · 1–2d behind', match: NEVER_BY_TEXT },
  flipkart: {
    label: 'Flipkart',
    latency: 'Orders daily (09:40 IST) · ads & stock weekly',
    match: /flipkart/
  },
  flipkartAds: { label: 'Flipkart Ads report', latency: 'Monthly · entered by hand', match: NEVER_BY_TEXT },
  nykaa: { label: 'Nykaa', latency: 'Manual report upload · no API feed', match: /nykaa/ },
  myntra: { label: 'Myntra', latency: 'Manual report upload · no API feed', match: /myntra/ },
  purplleAds: { label: 'Purplle Ads report', latency: 'Monthly · entered by hand', match: NEVER_BY_TEXT },
  snapdealAds: { label: 'Snapdeal Ads report', latency: 'Monthly · entered by hand', match: NEVER_BY_TEXT },
  warehouse: { label: 'Warehouse', latency: 'Nightly 23:00 IST (Mon–Sat)', match: /warehouse|inventory-wh/ },
  inventoryPlan: { label: 'Amazon inventory plan', latency: 'Entered by hand · no date in the sheet', match: NEVER_BY_TEXT },
  callChase: {
    label: 'Call & Chase',
    latency: '07:00 & 17:29 IST daily',
    match: /call & chase|courier remittance/
  },
  browser: { label: 'Upload', latency: 'Instant · parsed in-browser', match: /client-side parser|papaparse/ },
  reference: {
    label: 'Reference data',
    latency: 'Static · updated on edit',
    match: /recipe|registry|combo formulas|constants|handbook|master sheet/
  }
};

/**
 * Where each source comes from, in plain words, and whether it arrives by itself or because a person
 * posts or types it. Shown on every card. The fuller version is the table on the Data Health page.
 */
export type SourceRoute = 'automated' | 'mixed' | 'manual' | 'static';

export const SOURCE_ORIGIN: Record<LatencySourceKey, { from: string; route: SourceRoute }> = {
  shopify: { from: 'Shopify store', route: 'automated' },
  meta: { from: 'Meta Ads (Windsor)', route: 'automated' },
  google: { from: 'Google Ads (daily sheet)', route: 'automated' },
  amazonSales: { from: 'Amazon sales (Windsor)', route: 'automated' },
  amazonSettlement: { from: 'Amazon settlement (Windsor)', route: 'automated' },
  amazonAds: { from: 'Amazon Ads (Windsor)', route: 'automated' },
  amazonAdsReport: { from: 'Amazon Ads (Windsor), added up by month', route: 'automated' },
  flipkart: { from: 'Flipkart reports (Slack)', route: 'manual' },
  flipkartAds: { from: "Flipkart ads (Shan's sheet)", route: 'manual' },
  nykaa: { from: "Nykaa report (Shan's sheet)", route: 'manual' },
  myntra: { from: "Myntra report (Shan's sheet)", route: 'manual' },
  purplleAds: { from: "Purplle ads (Shan's sheet)", route: 'manual' },
  snapdealAds: { from: "Snapdeal ads (Shan's sheet)", route: 'manual' },
  warehouse: { from: 'Warehouse stock report (Slack)', route: 'manual' },
  inventoryPlan: { from: "Amazon FBA plan (Shan's sheet)", route: 'manual' },
  callChase: { from: 'Call & Chase task', route: 'automated' },
  browser: { from: 'File you upload', route: 'manual' },
  reference: { from: 'Built-in reference data', route: 'static' }
};

export const ROUTE_WORD: Record<SourceRoute, string> = {
  automated: 'Automatic',
  mixed: 'Automatic + manual',
  manual: 'Manual',
  static: 'Built in'
};

/**
 * Sources that feed each channel's numbers. 'all' is Shopify + Amazon, which is what
 * the combined totals contain (Flipkart is shown separately, never summed in).
 */
export const CHANNEL_LATENCY_SOURCES: Record<ChannelFilter, LatencySourceKey[]> = {
  all: ['shopify', 'meta', 'google', 'amazonSales', 'amazonSettlement', 'amazonAds'],
  shopify: ['shopify', 'meta', 'google'],
  amazon: ['amazonSales', 'amazonSettlement', 'amazonAds'],
  flipkart: ['flipkart'],
  nykaa: ['nykaa'],
  myntra: ['myntra']
};

/**
 * How each channel's data gets produced upstream: by an automated connector or by people posting
 * reports. Taken from the handbook (§2.4, §5) and the scope document (§3).
 */
export type FeedMode = 'automated' | 'mixed' | 'manual';

export interface ChannelFeed {
  mode: FeedMode;
  label: string;
  detail: string;
}

export const CHANNEL_FEED: Partial<Record<ChannelFilter, ChannelFeed>> = {
  shopify: {
    mode: 'automated',
    label: 'Automated',
    detail:
      "A scheduled daily pull from the Shopify connector (task #9, about 04:51 IST). Meta spend arrives through Windsor; Google spend is read from the daily Google Ads sheet."
  },
  amazon: {
    mode: 'mixed',
    label: 'API + manual',
    detail:
      'Sales, settlement and daily ad spend come from the Windsor API. Until the Amazon Ads export has loaded, ads are taken from settlement billing. The ASIN business report and the inventory plan are uploaded by hand.'
  },
  flipkart: {
    mode: 'manual',
    label: 'Manual upload',
    detail: 'Seller Hub reports are posted in Slack #flipkart-reports and parsed by a daily task. Flipkart has no API for this account.'
  },
  nykaa: {
    mode: 'manual',
    label: 'Manual upload',
    detail: "Entered by hand in Shan's report sheet, one row per month. Windsor has no Nykaa connector."
  },
  myntra: {
    mode: 'manual',
    label: 'Manual upload',
    detail: "Entered by hand in Shan's report sheet, one row per month. Windsor has no Myntra connector."
  }
};

export const FEED_NOTE =
  'This describes where the data comes from. The dashboard itself shows a fixed snapshot until the Google Sheet sync is switched on.';

export interface LatencyGroup {
  labels: string[];
  latency: string;
}

/**
 * What counts as stale for each source. The dashboard compares a source's last-updated time with
 * "now": inside `expectedLagHours` it is fresh, between that and `staleAfterHours` it is behind by
 * design (shown as a note, never a flag), and past `staleAfterHours` it is stale and flagged.
 * A source with no rule here is static reference data.
 */
export interface FreshnessRule {
  expectedLagHours?: number;
  /** Shown when the source is behind but still within its normal delay. */
  lagNote?: string;
  lagShort?: string;
  staleAfterHours: number;
  /** Monthly reports are dated by month, not by time of day. */
  grain?: 'month';
}

const MONTHLY_REPORT: FreshnessRule = {
  expectedLagHours: 24 * 31,
  lagNote: 'Monthly report: the latest month is entered after it closes, so the newest month is always a few weeks old.',
  lagShort: 'Monthly report (expected)',
  staleAfterHours: 24 * 50,
  grain: 'month'
};

export const FRESHNESS_RULES: Partial<Record<LatencySourceKey, FreshnessRule>> = {
  // Pulled for "yesterday" at 04:51 IST, so a day-old figure is normal; a missed run is not.
  shopify: { staleAfterHours: 36 },
  meta: { staleAfterHours: 36 },
  google: { staleAfterHours: 36 },
  amazonSales: {
    expectedLagHours: 30,
    lagNote: 'Amazon reports about a day behind, and two days behind is normal.',
    lagShort: 'Amazon runs 1–2 days behind (expected)',
    staleAfterHours: 72
  },
  amazonSettlement: {
    expectedLagHours: 30,
    lagNote: 'Amazon settlement posts one to two days after the order day.',
    lagShort: 'Settlement posts 1–2 days late (expected)',
    staleAfterHours: 96
  },
  flipkart: {
    expectedLagHours: 30,
    lagNote: 'Flipkart reports are posted the next morning, so Flipkart runs about a day behind the other channels. That is expected.',
    lagShort: 'Flipkart runs ~1 day behind (expected)',
    staleAfterHours: 72
  },
  warehouse: {
    expectedLagHours: 30,
    lagNote: "The stock desk runs Monday to Saturday at 23:00, so Sunday and Monday morning show Saturday's count.",
    lagShort: 'No Sunday run (expected)',
    staleAfterHours: 60
  },
  amazonAds: {
    expectedLagHours: 30,
    lagNote: 'Amazon Ads reports about a day behind, and two days behind is normal.',
    lagShort: 'Amazon Ads runs 1–2 days behind (expected)',
    staleAfterHours: 72
  },
  amazonAdsReport: {
    expectedLagHours: 30,
    lagNote: 'The monthly Amazon ad figures are added up from the daily Amazon Ads feed, which runs a day or two behind.',
    lagShort: 'Amazon Ads runs 1–2 days behind (expected)',
    staleAfterHours: 72
  },
  flipkartAds: MONTHLY_REPORT,
  nykaa: MONTHLY_REPORT,
  myntra: MONTHLY_REPORT,
  purplleAds: MONTHLY_REPORT,
  snapdealAds: MONTHLY_REPORT
  // inventoryPlan has a rule-less, undated source on purpose: the plan sheet carries no date, so
  // the dashboard says so instead of guessing.
};

/**
 * Sources a card draws on when it does not name them itself: the channel on screen for the
 * money pages, a fixed source for pages that have only one.
 */
export function defaultCardSources(view: DashboardView, channel: ChannelFilter): LatencySourceKey[] {
  switch (view) {
    case 'executive':
    case 'pnl':
    case 'advertising':
      return CHANNEL_LATENCY_SOURCES[channel];
    case 'shopify':
      return ['shopify'];
    case 'inventory':
      return ['warehouse'];
    default:
      return [];
  }
}

/** Source keys for a channel (when the view is channel-scoped) or for whatever a badge's text names. */
export function resolveSourceKeys(opts: { channel?: ChannelFilter; text?: string }): LatencySourceKey[] {
  return opts.channel
    ? CHANNEL_LATENCY_SOURCES[opts.channel]
    : (Object.keys(LATENCY_SOURCES) as LatencySourceKey[]).filter(k =>
        LATENCY_SOURCES[k].match.test((opts.text ?? '').toLowerCase())
      );
}

/**
 * Latency for a channel (when the view is channel-scoped) or for whatever sources a
 * badge's text names. Sources with identical latency are merged into one group.
 */
export function resolveLatency(opts: { channel?: ChannelFilter; text?: string }): LatencyGroup[] {
  const keys = resolveSourceKeys(opts);

  const groups: LatencyGroup[] = [];
  for (const key of keys) {
    const { label, latency } = LATENCY_SOURCES[key];
    const existing = groups.find(g => g.latency === latency);
    if (existing) existing.labels.push(label);
    else groups.push({ labels: [label], latency });
  }
  return groups;
}
