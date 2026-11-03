import type { DashboardDataBundle } from '../data/initialData';
import type { DailyRecord } from '../data/dailyData';
import type { DashboardView } from '../context/DashboardContext';
import type { LatencySourceKey } from '../data/channelLatency';
import { MARKETPLACE_COGS_PCT } from '../data/assumptions';
import { breakEven, buildAccountRows, buildInsights, monthlySeries } from './adsAnalytics';
import { bundleEconomics } from './unitEconomics';
import { healthOf } from './inventoryPlan';
import { evaluateFreshness, formatAgeLong, formatAsOf, groupFreshness, type SourceFreshness } from './freshness';

/**
 * Turns the figures the dashboard already holds into a short list of things for an operator to do,
 * in plain words. Pure functions: nothing here touches React, so every rule can be checked outside
 * the page. Thresholds sit at the top so they can be tuned without reading the rules.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Lane = 'ads' | 'stock' | 'orders' | 'marketplaces' | 'data';
export type Urgency = 'urgent' | 'week' | 'watch';
export type Impact = 'big' | 'medium' | 'small';

export const LANES: Lane[] = ['ads', 'stock', 'orders', 'marketplaces', 'data'];
export const LANE_LABEL: Record<Lane, string> = {
  ads: 'Ads',
  stock: 'Stock',
  orders: 'Orders & COD',
  marketplaces: 'Marketplaces',
  data: 'Data'
};
export const URGENCY_LABEL: Record<Urgency, string> = {
  urgent: 'Urgent',
  week: 'This week',
  watch: 'Keep an eye'
};
export const IMPACT_LABEL: Record<Impact, string> = { big: 'Big', medium: 'Medium', small: 'Small' };

/** Why a card may be less certain than it looks. */
export interface Caution {
  kind: 'old' | 'estimate';
  text: string;
}

export interface ActionCard {
  id: string;
  lane: Lane;
  urgency: Urgency;
  /** How much is at stake, in words. */
  impact: Impact;
  headline: string;
  /** The instruction, as a short sentence. */
  doThis: string;
  why: string;
  /** At most one plain figure. */
  figure?: string;
  view: DashboardView;
  viewLabel: string;
  cautions: Caution[];
}

export interface WorkingItem {
  id: string;
  lane: Lane;
  text: string;
}

export interface DoubtItem {
  id: string;
  text: string;
}

export interface ActionPlan {
  /** "2 urgent, 3 to do this week, 1 to keep an eye on." */
  headline: string;
  counts: Record<Urgency, number>;
  /** How current the numbers behind the page are. */
  dataNote: { tone: 'ok' | 'old' | 'unknown'; text: string };
  actions: ActionCard[];
  working: WorkingItem[];
  doubts: DoubtItem[];
}

export interface ActionInputs {
  data: DashboardDataBundle;
  /** Daily rows for the window the ad and sales rules look at (the last 7 days). */
  slice: DailyRecord[];
  now: Date;
  cogsPerUnit: number;
  shippingPerOrder: number;
  marketplaceCogsPct: number;
}

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------

/** Below this many times break-even, store ads are urgent rather than a this-week job. */
const ADS_URGENT_RATIO = 0.7;
/** Amazon FBA: days of cover under which a top-up is urgent / a this-week job. */
const FBA_URGENT_DAYS = 14;
const FBA_WEEK_DAYS = 21;
/** Share of Shopify orders from high-RTO states above which the impact is big. */
const RISKY_STATE_BIG_SHARE = 0.2;
/** Marketplace return rate (%) that needs action / is worth watching. */
const RETURN_ACTION = 10;
const RETURN_WATCH = 8;
/** Marketplace ads returning at least this much per rupee are worth keeping. */
const MARKETPLACE_ROAS_GOOD = 4;
/** Blended return per rupee of ads must fall by this much against the first month to be raised. */
const MER_DROP = 0.1;

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const days = (n: number) => {
  const d = Math.max(1, Math.round(n));
  return `${d} day${d === 1 ? '' : 's'}`;
};
const listOf = (xs: string[]) =>
  xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many);

const URGENCY_RANK: Record<Urgency, number> = { urgent: 0, week: 1, watch: 2 };
const IMPACT_RANK: Record<Impact, number> = { big: 0, medium: 1, small: 2 };

const SOURCES_TO_CHECK: LatencySourceKey[] = [
  'shopify',
  'meta',
  'google',
  'amazonSales',
  'amazonSettlement',
  'amazonAds',
  'flipkart',
  'warehouse'
];
/** If any of these is stale, the sales and ad numbers are not current. */
const CORE_DAILY: LatencySourceKey[] = ['shopify', 'meta', 'google'];

// ---------------------------------------------------------------------------
// The plan
// ---------------------------------------------------------------------------

export function buildActionPlan(input: ActionInputs): ActionPlan {
  const { data, slice, now, cogsPerUnit, shippingPerOrder, marketplaceCogsPct } = input;

  const fresh = {} as Record<LatencySourceKey, SourceFreshness>;
  for (const key of SOURCES_TO_CHECK) fresh[key] = evaluateFreshness(key, data, now);

  /** A note when a card leans on a source that is out of date. */
  const staleCaution = (keys: LatencySourceKey[]): Caution[] => {
    const stale = keys.map(k => fresh[k]).filter(f => f && f.status === 'stale' && f.asOf && f.ageHours !== null);
    if (stale.length === 0) return [];
    const worst = stale.reduce((a, b) => ((b.ageHours ?? 0) > (a.ageHours ?? 0) ? b : a));
    return [
      {
        kind: 'old',
        text: `Built on ${worst.label} numbers from ${formatAsOf(worst.asOf as Date)}, ${formatAgeLong(worst.ageHours as number)} old. Check the real situation before acting.`
      }
    ];
  };
  const costCaution: Caution = {
    kind: 'estimate',
    text: `Product cost is a placeholder (₹${cogsPerUnit} a unit) until finance confirms real costs, so treat the sizes as rough.`
  };

  const actions: ActionCard[] = [];
  const working: WorkingItem[] = [];
  const doubts: DoubtItem[] = [];

  // ----- Stock (warehouse report) -------------------------------------------------------------
  const stock = [...data.warehouseStock].sort((a, b) => a.daysOfCover - b.daysOfCover);
  const critical = stock.filter(w => healthOf(w.daysOfCover) === 'critical');
  const low = stock.filter(w => healthOf(w.daysOfCover) === 'low');
  const healthy = stock.filter(w => healthOf(w.daysOfCover) === 'optimal');

  for (const w of critical) {
    actions.push({
      id: `stock-critical-${w.key}`,
      lane: 'stock',
      urgency: 'urgent',
      impact: w.dailyRunRate >= 40 ? 'big' : 'medium',
      headline: `${w.name} could run out in about ${days(w.daysOfCover)}`,
      doThis: 'Reorder now.',
      why: 'At the current selling pace the shelf is empty within the week, and every day without stock is lost sales.',
      figure: `${days(w.daysOfCover)} left`,
      view: 'inventory',
      viewLabel: 'Open Warehouse & Stock',
      cautions: staleCaution(['warehouse'])
    });
  }
  if (low.length > 0) {
    actions.push({
      id: 'stock-low',
      lane: 'stock',
      urgency: 'week',
      impact: 'medium',
      headline: `${low.length} ${plural(low.length, 'product is', 'products are')} getting low`,
      doThis: 'Plan a reorder this week.',
      why: `${listOf(low.map(w => `${w.name} (about ${days(w.daysOfCover)})`))}.`,
      figure: `${days(low[0].daysOfCover)} left on the lowest`,
      view: 'inventory',
      viewLabel: 'Open Warehouse & Stock',
      cautions: staleCaution(['warehouse'])
    });
  }

  // ----- Stock on Amazon (FBA plan) -----------------------------------------------------------
  const needSend = data.amazonInventoryPlan.filter(p => p.neededToSend > 0).sort((a, b) => a.daysOfCover - b.daysOfCover);
  if (needSend.length > 0) {
    const first = needSend[0];
    const rest = needSend.slice(1).map(p => p.product);
    actions.push({
      id: 'fba-send',
      lane: 'stock',
      urgency: first.daysOfCover < FBA_URGENT_DAYS ? 'urgent' : first.daysOfCover < FBA_WEEK_DAYS ? 'week' : 'watch',
      impact: 'medium',
      headline: `Amazon needs more stock for ${needSend.length} ${plural(needSend.length, 'product')}`,
      doThis: 'Send the top-ups listed on the Warehouse & Stock page.',
      why:
        `${first.product} has the least left on Amazon, about ${days(first.daysOfCover)}.` +
        (rest.length > 0 ? ` ${listOf(rest)} also ${plural(rest.length, 'needs', 'need')} a top-up.` : ''),
      figure: `${sum(needSend.map(p => p.neededToSend)).toLocaleString('en-IN')} units to send`,
      view: 'inventory',
      viewLabel: 'Open Warehouse & Stock',
      cautions: []
    });
  }

  if (healthy.length > 0 && stock.length > 0) {
    const hero = data.baseProducts.find(b => b.hero);
    const heroStock = hero ? stock.find(w => w.key === hero.key) : undefined;
    working.push({
      id: 'stock-healthy',
      lane: 'stock',
      text:
        `${healthy.length} of ${stock.length} products have more than two weeks of stock` +
        (heroStock && healthOf(heroStock.daysOfCover) === 'optimal'
          ? `, including the hero, ${heroStock.name} (about ${days(heroStock.daysOfCover)}).`
          : '.')
    });
  }

  // ----- Ads ------------------------------------------------------------------------------------
  if (slice.length > 0) {
    const be = breakEven(slice, cogsPerUnit, shippingPerOrder);
    const shopifySales = sum(slice.map(r => r.shopifyPreReturns));
    const storeAds = sum(slice.map(r => r.metaSpend + r.googleSpend));
    const storeReturn = storeAds > 0 ? shopifySales / storeAds : 0;
    const adCautions = [...staleCaution(['meta', 'google', 'shopify']), costCaution];

    if (storeAds > 0 && storeReturn < be.roas) {
      actions.push({
        id: 'ads-below-breakeven',
        lane: 'ads',
        urgency: storeReturn < be.roas * ADS_URGENT_RATIO ? 'urgent' : 'week',
        impact: 'big',
        headline: 'Store ads are earning less than they cost',
        doThis: "Don't add budget to Meta or Google for the store yet. Trim the weakest account first.",
        why: `For every ₹1 of ads the store takes in about ₹${storeReturn.toFixed(1)}, but it needs about ₹${be.roas.toFixed(1)} just to cover product and shipping.`,
        figure: `₹${storeReturn.toFixed(1)} back, ₹${be.roas.toFixed(1)} needed`,
        view: 'advertising',
        viewLabel: 'Open Advertising',
        cautions: adCautions
      });
    } else if (storeAds > 0) {
      working.push({
        id: 'ads-pay-back',
        lane: 'ads',
        text: `Store ads are paying for themselves: about ₹${storeReturn.toFixed(1)} back for every ₹1, against ₹${be.roas.toFixed(1)} needed.`
      });
    }

    // Meta accounts
    const accounts = buildAccountRows(data.metaAccounts, slice, be.roas);
    const toFix = accounts.filter(a => a.verdict === 'Fix');
    const toScale = accounts.filter(a => a.verdict === 'Scale');
    if (toFix.length > 0) {
      actions.push({
        id: 'ads-fix-accounts',
        lane: 'ads',
        urgency: 'week',
        impact: 'medium',
        headline: `${listOf(toFix.map(a => a.name))} ${plural(toFix.length, 'earns', 'earn')} less than the other Meta accounts`,
        doThis: toScale.length > 0 ? `Trim or rework ${plural(toFix.length, 'it', 'them')} and move that budget to ${listOf(toScale.map(a => a.name))}.` : 'Trim or rework the budget.',
        why: 'Money here earns less per rupee than the Meta average, so it does less work than the same money in the other accounts.',
        view: 'advertising',
        viewLabel: 'Open Advertising',
        cautions: staleCaution(['meta'])
      });
    }
    for (const a of toScale) {
      working.push({
        id: `ads-scale-${a.name}`,
        lane: 'ads',
        text: `${a.name} earns the most per rupee of the Meta accounts: first choice for any extra budget.`
      });
    }

    // Amazon's two ad figures, and the long-run trend, come from the same checks the Advertising page uses
    const months = monthlySeries(data.monthlyPerformance);
    const insights = buildInsights({
      slice,
      be,
      cogsRate: cogsPerUnit,
      shippingRate: shippingPerOrder,
      accounts,
      months,
      adSets: [],
      marketplaceAds: data.marketplaceAds
    });
    const gap = insights.find(i => i.id === 'amazon-ads-gap');
    if (gap) {
      actions.push({
        id: 'ads-amazon-gap',
        lane: 'ads',
        urgency: 'week',
        impact: 'medium',
        headline: "Amazon's two ad figures don't agree",
        doThis: "Check Seller Central for what Amazon actually billed for ads, and tell the person who loads the data.",
        why: "Amazon's own ad report and the dashboard's estimate give different ad spend, so combined ad spend and profit for Amazon can't be fully trusted yet.",
        figure: `${gap.stat} apart`,
        view: 'advertising',
        viewLabel: 'Open Advertising',
        cautions: []
      });
      doubts.push({
        id: 'doubt-amazon-ads',
        text: "Amazon ad spend: the ad report and the estimate behind the P&L differ. Until someone checks the real bill, treat Amazon ad spend as a guess."
      });
    }
    if (months.length >= 2) {
      const first = months[0];
      const last = months[months.length - 1];
      if (first.blendedMer > 0 && last.blendedMer < first.blendedMer * (1 - MER_DROP)) {
        actions.push({
          id: 'ads-trend',
          lane: 'ads',
          urgency: 'watch',
          impact: 'medium',
          headline: `Ads bring in less than they did in ${first.month}`,
          doThis: 'Keep an eye on it and avoid raising budgets across the board.',
          why: `Every ₹1 spent across Meta, Google and Amazon ads brought in ₹${first.blendedMer.toFixed(1)} of sales in ${first.month} and ₹${last.blendedMer.toFixed(1)} in ${last.month}.`,
          view: 'advertising',
          viewLabel: 'Open Advertising',
          cautions: []
        });
      }
    }
  }

  // ----- Orders sent back, cash on delivery --------------------------------------------------
  const states = data.stateCodRisk;
  const risky = states.filter(s => /^(High|Critical)/i.test(s.riskLevel)).sort((a, b) => b.rtoRate - a.rtoRate);
  if (risky.length > 0) {
    const totalOrders = sum(states.map(s => s.orders));
    const riskyShare = totalOrders > 0 ? sum(risky.map(s => s.orders)) / totalOrders : 0;
    const worst = risky[0];
    actions.push({
      id: 'orders-risky-states',
      lane: 'orders',
      urgency: 'week',
      impact: riskyShare >= RISKY_STATE_BIG_SHARE ? 'big' : 'medium',
      headline: `Orders from ${risky.length} ${plural(risky.length, 'state')} often come back undelivered`,
      doThis: 'Call to confirm these orders before shipping, and offer a prepaid discount.',
      why: `${listOf(risky.slice(0, 3).map(s => s.state))} ${risky.length > 3 ? 'are among the worst' : plural(Math.min(risky.length, 3), 'is the worst', 'are the worst')}. Most orders there are cash on delivery, and a returned parcel costs shipping both ways.`,
      figure: `${worst.state}: about 1 in ${Math.max(2, Math.round(100 / worst.rtoRate))} sent back`,
      view: 'shopify',
      viewLabel: 'Open Shopify D2C Store',
      cautions: staleCaution(['shopify'])
    });
  }

  // ----- Marketplaces: returns and ad return ----------------------------------------------------
  const channelKey: Record<string, LatencySourceKey | undefined> = { Flipkart: 'flipkart', 'Amazon.in': 'amazonSales' };
  for (const m of data.marketplaceSummary) {
    if (m.returnRate < RETURN_WATCH) continue;
    const others = data.marketplaceSummary.filter(o => o.channel !== m.channel).map(o => o.returnRate);
    const key = channelKey[m.channel];
    const action = m.returnRate >= RETURN_ACTION;
    actions.push({
      id: `mkt-returns-${m.channel}`,
      lane: 'marketplaces',
      urgency: action ? 'week' : 'watch',
      impact: m.monthlyRevenue >= 1_000_000 ? 'big' : 'medium',
      headline: `${m.channel} orders are coming back more than elsewhere`,
      doThis: action ? 'Look at the products with the most returns: check the listing photos, size or description, and the packing.' : 'Keep an eye on it.',
      why: `About ${Math.round(m.returnRate)} in every 100 orders are returned here. The other channels sit between ${Math.min(...others).toFixed(0)} and ${Math.max(...others).toFixed(0)}.`,
      figure: `${m.returnRate}% returned`,
      view: 'marketplaces',
      viewLabel: 'Open Marketplaces',
      cautions: key ? staleCaution([key]) : []
    });
  }
  const goodAds = data.marketplaceSummary.filter(m => (m.adRoas ?? 0) >= MARKETPLACE_ROAS_GOOD);
  if (goodAds.length > 0) {
    working.push({
      id: 'mkt-ads-good',
      lane: 'marketplaces',
      text: `${listOf(goodAds.map(m => m.channel))} ${plural(goodAds.length, 'ad', 'ads')} bring back about ₹${Math.min(...goodAds.map(m => m.adRoas ?? 0)).toFixed(0)} or more for every ₹1 spent, by their own reports. Worth keeping.`
    });
  }

  // ----- Bundles that lose money ----------------------------------------------------------------
  const losing = bundleEconomics(data.unitEconomics, data.recipes, cogsPerUnit)
    .filter(e => e.key !== 'DEFAULT' && e.flat && e.item.netProfitWithRTO < 0)
    .sort((a, b) => a.item.netProfitWithRTO - b.item.netProfitWithRTO);
  if (losing.length > 0) {
    const worst = losing[0];
    actions.push({
      id: 'products-losing',
      lane: 'ads',
      urgency: 'week',
      impact: losing.length >= 3 ? 'big' : 'medium',
      headline: `${losing.length} ${plural(losing.length, 'bundle loses', 'bundles lose')} money on every order after returns`,
      doThis: 'Stop paying for ads on these until the price goes up or the cost comes down.',
      why: `${listOf(losing.map(e => e.item.name))}. The price does not cover product, shipping, the ad cost to win the customer and the orders that come back.`,
      figure: `${worst.item.name}: about ₹${Math.round(-worst.item.netProfitWithRTO)} lost an order`,
      view: 'products',
      viewLabel: 'Open Products & Recipes',
      cautions: [costCaution]
    });
  }

  // ----- Data you should double-check -----------------------------------------------------------
  const staleItems = SOURCES_TO_CHECK.map(k => fresh[k]).filter(f => f.status === 'stale');
  if (staleItems.length > 0) {
    const groups = groupFreshness(staleItems);
    const describe = (g: (typeof groups)[number]) =>
      `${listOf(g.labels)}: last updated ${formatAsOf(g.item.asOf as Date)}, ${formatAgeLong(g.item.ageHours as number)} ago`;
    const coreStale = CORE_DAILY.some(k => fresh[k].status === 'stale');
    actions.push({
      id: 'data-stale',
      lane: 'data',
      urgency: coreStale ? 'urgent' : 'week',
      impact: 'big',
      headline: 'Some of the numbers are out of date',
      doThis: 'Ask whoever loads the data to refresh it, and check the real figures before big decisions.',
      why: `${groups.map(describe).join('. ')}.`,
      view: 'data-health',
      viewLabel: 'Open Data Health',
      cautions: []
    });
    for (const g of groups) doubts.push({ id: `doubt-stale-${g.labels[0]}`, text: `${describe(g)}. What you see here may not match today.` });
  }
  if (data.amazonInventoryPlan.length > 0) {
    doubts.push({
      id: 'doubt-fba-undated',
      text: "The Amazon stock plan is typed in by hand and carries no date, so there's no way to tell how old it is."
    });
  }
  doubts.push({
    id: 'doubt-costs',
    text: `Product costs are placeholders: ₹${cogsPerUnit} a unit for the store and ${marketplaceCogsPct}% of sales for marketplaces (the expected range is ${MARKETPLACE_COGS_PCT.low} to ${MARKETPLACE_COGS_PCT.high}%). Profit figures are rough until finance confirms real costs.`
  });

  // ----- Order and summary ----------------------------------------------------------------------
  actions.sort(
    (a, b) =>
      URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency] ||
      IMPACT_RANK[a.impact] - IMPACT_RANK[b.impact] ||
      LANES.indexOf(a.lane) - LANES.indexOf(b.lane) ||
      a.id.localeCompare(b.id)
  );

  const counts: Record<Urgency, number> = { urgent: 0, week: 0, watch: 0 };
  for (const a of actions) counts[a.urgency] += 1;
  const headline =
    actions.length === 0
      ? 'Nothing needs doing right now.'
      : `${counts.urgent} urgent, ${counts.week} to do this week, ${counts.watch} to keep an eye on.`;

  const core = CORE_DAILY.map(k => fresh[k]).filter(f => f.asOf !== null);
  const oldest = core.length ? core.reduce((a, b) => ((b.ageHours ?? 0) > (a.ageHours ?? 0) ? b : a)) : null;
  const dataNote: ActionPlan['dataNote'] = !oldest
    ? { tone: 'unknown', text: 'The date of the sales and ad numbers is not recorded, so they cannot be checked for age.' }
    : oldest.status === 'stale'
      ? {
          tone: 'old',
          text: `The sales and ad numbers behind this page were last updated ${formatAsOf(oldest.asOf as Date)}, ${formatAgeLong(oldest.ageHours as number)} ago. Check before acting.`
        }
      : { tone: 'ok', text: `Sales and ad numbers are up to date (last updated ${formatAsOf(oldest.asOf as Date)}).` };

  return { headline, counts, dataNote, actions, working, doubts };
}
