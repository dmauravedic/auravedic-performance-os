import type { DailyRecord } from '../data/dailyData';
import type { MarketplaceAdsItem, MetaAccount, MonthlyMetric } from '../data/initialData';
import type { AdSetDay, AdSetSpec } from '../data/adLevelData';
import { formatINR } from './formatters';

/**
 * Advertising analysis: pure functions over the daily series, the Meta account seed and the
 * (illustrative) ad-set rows. Nothing here touches React, so every number on the page can be
 * checked outside the UI.
 */

// Same per-order assumptions the P&L uses
export const UNITS_PER_ORDER = 1.3;
export const SHIPPING_ELIGIBLE_SHARE = 0.84;

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const div = (a: number, b: number) => (b > 0 ? a / b : 0);
const median = (xs: number[]) => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// ---------------------------------------------------------------------------
// Break-even ROAS
// ---------------------------------------------------------------------------

export interface BreakEven {
  roas: number;
  aov: number;
  cogsPerOrder: number;
  shippingPerOrder: number;
  contributionPerOrder: number;
}

/**
 * ROAS at which a Shopify order pays for its own ads: AOV / (AOV - COGS - shipping per order).
 * Ignores returns and payment / COD fees, so the true break-even is somewhat higher.
 */
export function breakEven(slice: DailyRecord[], cogsRate: number, shippingRate: number): BreakEven {
  const aov = div(sum(slice.map(r => r.shopifyPreReturns)), sum(slice.map(r => r.shopifyOrders)));
  const cogsPerOrder = UNITS_PER_ORDER * cogsRate;
  const shippingPerOrder = SHIPPING_ELIGIBLE_SHARE * shippingRate;
  const contributionPerOrder = aov - cogsPerOrder - shippingPerOrder;
  return {
    roas: contributionPerOrder > 0 ? aov / contributionPerOrder : 99,
    aov,
    cogsPerOrder,
    shippingPerOrder,
    contributionPerOrder
  };
}

// ---------------------------------------------------------------------------
// Platform scorecard
// ---------------------------------------------------------------------------

export type PlatformKey = 'meta' | 'amazon' | 'google' | 'flipkart';

export interface PlatformRow {
  key: PlatformKey;
  label: string;
  spend: number;
  spendShare: number;
  /** Return per ₹1 of spend. */
  efficiency: number;
  efficiencyLabel: string;
  costPerResult: number;
  costLabel: string;
  basis: string;
  /** attributed = platform-reported; estimate = derived from total sales or estimated figures. */
  basisTone: 'attributed' | 'estimate';
}

/** `amazonAdsLoaded`: the daily Amazon Ads export has loaded, so Amazon spend is Amazon's own figure. */
export function platformRows(slice: DailyRecord[], amazonAdsLoaded = false): PlatformRow[] {
  const metaSpend = sum(slice.map(r => r.metaSpend));
  const googleSpend = sum(slice.map(r => r.googleSpend));
  const amazonAds = sum(slice.map(r => r.amazonBilledAds));
  const flipkartAds = sum(slice.map(r => r.flipkartAds));
  const total = metaSpend + googleSpend + amazonAds + flipkartAds;
  const share = (v: number) => div(v, total) * 100;

  return [
    {
      key: 'meta',
      label: 'Meta (5 accounts)',
      spend: metaSpend,
      spendShare: share(metaSpend),
      efficiency: div(sum(slice.map(r => r.metaPurchaseValue)), metaSpend),
      efficiencyLabel: 'Purchase ROAS',
      costPerResult: div(metaSpend, sum(slice.map(r => r.metaPurchases))),
      costLabel: 'per purchase',
      basis: 'Platform-attributed purchase value',
      basisTone: 'attributed'
    },
    {
      key: 'amazon',
      label: 'Amazon Ads',
      spend: amazonAds,
      spendShare: share(amazonAds),
      efficiency: div(sum(slice.map(r => r.amazonSales)), amazonAds),
      efficiencyLabel: 'Sales per ₹1 of ads',
      costPerResult: div(amazonAds, sum(slice.map(r => r.amazonOrders))),
      costLabel: 'per order (all orders)',
      basis: amazonAdsLoaded
        ? 'Total Amazon sales ÷ Amazon Ads spend'
        : 'Total Amazon sales ÷ billed ads (settlement; pre-13 Oct estimated)',
      basisTone: 'estimate'
    },
    {
      key: 'google',
      label: 'Google Ads',
      spend: googleSpend,
      spendShare: share(googleSpend),
      efficiency: div(sum(slice.map(r => r.googleConversionValue)), googleSpend),
      efficiencyLabel: 'Conversion ROAS',
      costPerResult: div(googleSpend, sum(slice.map(r => r.googleConversions))),
      costLabel: 'per conversion',
      basis: 'Platform-attributed conversion value',
      basisTone: 'attributed'
    },
    {
      key: 'flipkart',
      label: 'Flipkart Ads',
      spend: flipkartAds,
      spendShare: share(flipkartAds),
      efficiency: div(sum(slice.map(r => r.flipkartSales)), flipkartAds),
      efficiencyLabel: 'Sales per ₹1 of ads',
      costPerResult: div(flipkartAds, sum(slice.map(r => r.flipkartOrders))),
      costLabel: 'per order (all orders)',
      basis: 'Estimated Flipkart sales ÷ ads (weekly report, period average)',
      basisTone: 'estimate'
    }
  ];
}

// ---------------------------------------------------------------------------
// Meta accounts
// ---------------------------------------------------------------------------

export interface AccountIndex {
  name: string;
  share: number; // % of Meta spend
  roasIdx: number; // account ROAS relative to the spend-weighted Meta ROAS
  purchIdx: number; // purchases per rupee relative to the Meta average
}

/**
 * Relative performance of each active account, taken from the October account seed. The level
 * comes from the selected period's real daily series; the seed only supplies how accounts differ.
 * Spend-weighted, so the indexes average to exactly 1 and account totals add back to Meta's.
 */
export function accountIndexes(accounts: MetaAccount[]): AccountIndex[] {
  const active = accounts.filter(a => a.status !== 'Excluded' && a.spendOct > 0);
  const totalSpend = sum(active.map(a => a.spendOct));
  const weightedRoas = div(sum(active.map(a => a.spendOct * a.roasOct)), totalSpend);
  const avgRate = div(sum(active.map(a => a.purchasesOct)), totalSpend);
  return active.map(a => ({
    name: a.name,
    share: div(a.spendOct, totalSpend) * 100,
    roasIdx: div(a.roasOct, weightedRoas),
    purchIdx: div(div(a.purchasesOct, a.spendOct), avgRate)
  }));
}

export type Verdict = 'Scale' | 'Hold' | 'Fix' | 'Judge on IC cost';

export interface AccountRow {
  name: string;
  accountId: string;
  strategy: string;
  spend: number;
  share: number;
  purchases: number;
  cpp: number;
  roas: number;
  vsBlendedPct: number;
  vsBreakEven: number;
  verdict: Verdict;
  note: string;
}

export function buildAccountRows(accounts: MetaAccount[], slice: DailyRecord[], be: number): AccountRow[] {
  const spend = sum(slice.map(r => r.metaSpend));
  const purchases = sum(slice.map(r => r.metaPurchases));
  const value = sum(slice.map(r => r.metaPurchaseValue));
  const blended = div(value, spend);
  const byName = new Map(accounts.map(a => [a.name, a]));

  return accountIndexes(accounts).map(ix => {
    const acc = byName.get(ix.name)!;
    const accSpend = spend * (ix.share / 100);
    const accPurchases = purchases * (ix.share / 100) * ix.purchIdx;
    const roas = blended * ix.roasIdx;
    const vsBlendedPct = (ix.roasIdx - 1) * 100;

    // Fresh Pixel optimises for Initiate Checkout, so purchase ROAS is the wrong yardstick
    // (handbook §5.1): never call it the worst on that alone.
    let verdict: Verdict;
    let note: string;
    if (/initiate checkout/i.test(acc.strategy)) {
      verdict = 'Judge on IC cost';
      note = 'Optimises for Initiate Checkout: compare cost per IC, not purchase ROAS.';
    } else if (vsBlendedPct >= 3) {
      verdict = 'Scale';
      note = 'Best return in the portfolio: first call on extra budget.';
    } else if (vsBlendedPct <= -3) {
      verdict = 'Fix';
      note = 'Below the Meta average: trim, restructure, or use as the source of budget to move.';
    } else {
      verdict = 'Hold';
      note = 'Close to the Meta average: keep budget flat and watch creative.';
    }

    return {
      name: acc.name,
      accountId: acc.accountId,
      strategy: acc.strategy,
      spend: accSpend,
      share: ix.share,
      purchases: accPurchases,
      cpp: div(accSpend, accPurchases),
      roas,
      vsBlendedPct,
      vsBreakEven: roas - be,
      verdict,
      note
    };
  });
}

export interface ShiftResult {
  amount: number;
  lostValue: number;
  gainedValue: number;
  deltaValue: number;
  deltaContribution: number;
  roasBefore: number;
  roasAfter: number;
  /** Share of the receiving account's ROAS the extra spend must keep for the move to pay. */
  breakEvenEfficiency: number;
}

/**
 * What moving `amount` of spend from one account to another is worth, if the extra spend only
 * earns `efficiency` (0-1) of the receiving account's current ROAS (diminishing returns).
 * Contribution is value / break-even ROAS: the share of revenue left after COGS and shipping.
 */
export function simulateShift(
  rows: AccountRow[],
  from: string,
  to: string,
  amount: number,
  efficiency: number,
  be: number
): ShiftResult {
  const donor = rows.find(r => r.name === from);
  const recipient = rows.find(r => r.name === to);
  const totalSpend = sum(rows.map(r => r.spend));
  const totalValue = sum(rows.map(r => r.spend * r.roas));
  if (!donor || !recipient || from === to) {
    const roas = div(totalValue, totalSpend);
    return {
      amount: 0,
      lostValue: 0,
      gainedValue: 0,
      deltaValue: 0,
      deltaContribution: 0,
      roasBefore: roas,
      roasAfter: roas,
      breakEvenEfficiency: 0
    };
  }
  const moved = Math.min(amount, donor.spend);
  const lostValue = moved * donor.roas;
  const gainedValue = moved * recipient.roas * efficiency;
  const deltaValue = gainedValue - lostValue;
  return {
    amount: moved,
    lostValue,
    gainedValue,
    deltaValue,
    deltaContribution: div(deltaValue, be),
    roasBefore: div(totalValue, totalSpend),
    roasAfter: div(totalValue + deltaValue, totalSpend),
    breakEvenEfficiency: div(donor.roas, recipient.roas)
  };
}

// ---------------------------------------------------------------------------
// Ad sets (illustrative data)
// ---------------------------------------------------------------------------

export type FatigueStatus = 'High fatigue' | 'Moderate fatigue' | 'Winning' | 'No fatigue';
export type Diagnosis =
  | 'Creative fatigue'
  | 'Landing / offer leak'
  | 'Weak hook'
  | 'Expensive audience'
  | 'Scale candidate'
  | 'Stable';

export const DIAGNOSIS_ACTION: Record<Diagnosis, string> = {
  'Creative fatigue': 'Pause and rotate in a new hook or visual.',
  'Landing / offer leak': 'Clicks are not converting: check the product page, price and COD / shipping messaging.',
  'Weak hook': 'The audience converts but the creative under-delivers clicks: test new hooks, keep targeting.',
  'Expensive audience': 'CPM is high for this audience: broaden it or swap the interest stack.',
  'Scale candidate': 'Efficient and fresh: add about 20% budget in steps, with a new creative ready.',
  Stable: 'No action: keep monitoring.'
};

export interface AdSetRow {
  id: string;
  name: string;
  account: string;
  spend: number;
  impressions: number;
  clicks: number;
  purchases: number;
  value: number;
  ctr: number;
  cpc: number;
  cpm: number;
  cvr: number;
  cpp: number;
  roas: number;
  /** Impression-weighted frequency over the selected period. */
  frequency: number;
  /** Trailing 7 days vs the 7 before, as of the last day of data. */
  ctrTrendPct: number;
  cppTrendPct: number;
  freq7: number;
  signals: string[];
  status: FatigueStatus;
  diagnosis: Diagnosis;
}

interface Agg {
  spend: number;
  impressions: number;
  clicks: number;
  purchases: number;
  value: number;
  freqWeighted: number;
}

const aggregate = (rows: AdSetDay[]): Agg => ({
  spend: sum(rows.map(r => r.spend)),
  impressions: sum(rows.map(r => r.impressions)),
  clicks: sum(rows.map(r => r.clicks)),
  purchases: sum(rows.map(r => r.purchases)),
  value: sum(rows.map(r => r.purchaseValue)),
  freqWeighted: sum(rows.map(r => r.frequency * r.impressions))
});

export function buildAdSetRows(days: AdSetDay[], specs: AdSetSpec[], periodDates: Set<string>): AdSetRow[] {
  const allDates = [...new Set(days.map(d => d.date))].sort();
  const last7 = new Set(allDates.slice(-7));
  const prev7 = new Set(allDates.slice(-14, -7));

  const base = specs.map(spec => {
    const own = days.filter(d => d.adSetId === spec.id);
    return {
      spec,
      period: aggregate(own.filter(d => periodDates.has(d.date))),
      cur: aggregate(own.filter(d => last7.has(d.date))),
      prev: aggregate(own.filter(d => prev7.has(d.date)))
    };
  });

  const ctrOf = (a: Agg) => div(a.clicks, a.impressions);
  const cvrOf = (a: Agg) => div(a.purchases, a.clicks);
  const cpmOf = (a: Agg) => div(a.spend * 1000, a.impressions);
  const active = base.filter(b => b.period.spend > 0);
  const medCtr = median(active.map(b => ctrOf(b.period)));
  const medCvr = median(active.map(b => cvrOf(b.period)));
  const medCpm = median(active.map(b => cpmOf(b.period)));
  const portfolioRoas = div(sum(active.map(b => b.period.value)), sum(active.map(b => b.period.spend)));

  return base.map(({ spec, period, cur, prev }) => {
    const ctr = ctrOf(period);
    const cvr = cvrOf(period);
    const cpm = cpmOf(period);
    const roas = div(period.value, period.spend);

    const ctr7 = ctrOf(cur);
    const ctrTrendPct = (div(ctr7, ctrOf(prev)) - 1) * 100;
    const cppTrendPct = (div(div(cur.spend, cur.purchases), div(prev.spend, prev.purchases)) - 1) * 100;
    const freq7 = div(cur.freqWeighted, cur.impressions);

    // README rule: CTR under 1.2% while frequency tops 2.5 and cost per purchase climbs
    const signals: string[] = [];
    if (ctr7 < 0.012) signals.push('CTR under 1.2%');
    if (freq7 > 2.5) signals.push('Frequency over 2.5');
    if (cppTrendPct > 10) signals.push('CPP up over 10%');
    if (ctrTrendPct < -10) signals.push('CTR down over 10% week on week');

    let status: FatigueStatus;
    if (signals.length >= 3) status = 'High fatigue';
    else if (signals.length === 2) status = 'Moderate fatigue';
    else if (roas >= portfolioRoas * 1.08 && ctr >= medCtr && cppTrendPct <= 3) status = 'Winning';
    else status = 'No fatigue';

    let diagnosis: Diagnosis;
    if (status === 'High fatigue' || status === 'Moderate fatigue') diagnosis = 'Creative fatigue';
    else if (status === 'Winning') diagnosis = 'Scale candidate';
    else if (ctr >= medCtr * 1.1 && cvr <= medCvr * 0.8) diagnosis = 'Landing / offer leak';
    else if (ctr <= medCtr * 0.8 && cvr >= medCvr * 1.1) diagnosis = 'Weak hook';
    else if (cpm >= medCpm * 1.15) diagnosis = 'Expensive audience';
    else diagnosis = 'Stable';

    return {
      id: spec.id,
      name: spec.name,
      account: spec.account,
      spend: period.spend,
      impressions: period.impressions,
      clicks: period.clicks,
      purchases: period.purchases,
      value: period.value,
      ctr,
      cpc: div(period.spend, period.clicks),
      cpm,
      cvr,
      cpp: div(period.spend, period.purchases),
      roas,
      frequency: div(period.freqWeighted, period.impressions),
      ctrTrendPct,
      cppTrendPct,
      freq7,
      signals,
      status,
      diagnosis
    };
  });
}

export interface FunnelRow {
  account: string;
  spend: number;
  impressions: number;
  clicks: number;
  purchases: number;
  ctr: number;
  cpc: number;
  cpm: number;
  cvr: number;
  cpp: number;
  roas: number;
}

export function accountFunnel(rows: AdSetRow[]): FunnelRow[] {
  const accounts = [...new Set(rows.map(r => r.account))];
  return accounts.map(account => {
    const own = rows.filter(r => r.account === account);
    const spend = sum(own.map(r => r.spend));
    const impressions = sum(own.map(r => r.impressions));
    const clicks = sum(own.map(r => r.clicks));
    const purchases = sum(own.map(r => r.purchases));
    const value = sum(own.map(r => r.value));
    return {
      account,
      spend,
      impressions,
      clicks,
      purchases,
      ctr: div(clicks, impressions),
      cpc: div(spend, clicks),
      cpm: div(spend * 1000, impressions),
      cvr: div(purchases, clicks),
      cpp: div(spend, purchases),
      roas: div(value, spend)
    };
  });
}

// ---------------------------------------------------------------------------
// Monthly trend (handbook monthly data)
// ---------------------------------------------------------------------------

export interface MonthPoint {
  month: string;
  metaSpend: number;
  googleSpend: number;
  amazonAds: number;
  flipkartAds: number;
  metaROAS: number;
  googleROAS: number;
  /** (Shopify + Amazon sales) / (Meta + Google + Amazon ads). */
  blendedMer: number;
  /** Amazon ads as % of Amazon sales. */
  tacos: number;
  amazonSales: number;
}

export function monthlySeries(monthly: MonthlyMetric[]): MonthPoint[] {
  return monthly.map(m => ({
    month: m.month.replace(' 2026', '').replace(' (MTD)', ' MTD'),
    metaSpend: m.metaSpend,
    googleSpend: m.googleSpend,
    amazonAds: m.amazonAdsSpendEst,
    flipkartAds: m.flipkartAdsSpend,
    metaROAS: m.metaROAS,
    googleROAS: m.googleROAS,
    blendedMer: div(m.totalSales, m.totalAdsIncluded + m.amazonAdsSpendEst),
    tacos: div(m.amazonAdsSpendEst, m.amazonSales) * 100,
    amazonSales: m.amazonSales
  }));
}

// ---------------------------------------------------------------------------
// Insights
// ---------------------------------------------------------------------------

export interface Insight {
  id: string;
  tone: 'risk' | 'opportunity' | 'info';
  title: string;
  body: string;
  stat: string;
  statLabel: string;
  tag?: 'Illustrative' | 'Estimate' | 'Needs check';
}

const pct = (v: number, digits = 0) => `${v >= 0 ? '+' : ''}${v.toFixed(digits)}%`;

export function buildInsights(input: {
  slice: DailyRecord[];
  be: BreakEven;
  cogsRate: number;
  shippingRate: number;
  accounts: AccountRow[];
  months: MonthPoint[];
  adSets: AdSetRow[];
  /** Monthly ad reports from the marketplaces themselves (Shan's report sheet). */
  marketplaceAds?: MarketplaceAdsItem[];
}): Insight[] {
  const { slice, be, cogsRate, shippingRate, accounts, months, adSets } = input;
  const marketplaceAds = input.marketplaceAds ?? [];
  const out: Insight[] = [];

  // Amazon's own ad report, last 12 months with a channel revenue to measure against
  const amazonReport = marketplaceAds
    .filter(a => a.channel === 'Amazon.in' && a.tacos != null)
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
    .slice(-12);

  const shopifySales = sum(slice.map(r => r.shopifyPreReturns));
  const storeAds = sum(slice.map(r => r.metaSpend + r.googleSpend));
  const platformValue = sum(slice.map(r => r.metaPurchaseValue + r.googleConversionValue));

  // 1. Platform ROAS vs what the store actually sold
  const overclaim = div(platformValue, shopifySales);
  out.push({
    id: 'overclaim',
    tone: overclaim > 1.1 ? 'risk' : 'info',
    title: 'Platform ROAS over-claims',
    body: `Meta and Google together report ${formatINR(platformValue, true)} of purchase value against ${formatINR(shopifySales, true)} of actual Shopify sales. Overlapping attribution inflates platform ROAS, so judge efficiency on blended MER and use platform ROAS only to compare accounts with each other.`,
    stat: `${overclaim.toFixed(2)}x`,
    statLabel: 'reported ÷ actual sales'
  });

  // 2. Store ads vs break-even
  const storeMer = div(shopifySales, storeAds);
  const contributionAfterAds = shopifySales / be.roas - storeAds;
  out.push({
    id: 'breakeven',
    tone: storeMer < be.roas ? 'risk' : 'opportunity',
    title: storeMer < be.roas ? 'Store ads sit below break-even' : 'Store ads clear break-even',
    body:
      `Each ₹1 of Meta + Google spend returns ₹${storeMer.toFixed(2)} of Shopify sales; break-even is ₹${be.roas.toFixed(2)} at ₹${cogsRate} COGS per unit and ₹${shippingRate} shipping. ` +
      (contributionAfterAds < 0
        ? `That is about ${formatINR(-contributionAfterAds, true)} of contribution lost to ads in this period, before returns and overheads.`
        : `That leaves about ${formatINR(contributionAfterAds, true)} of contribution after ads, before returns and overheads.`),
    stat: `${storeMer.toFixed(2)}x vs ${be.roas.toFixed(2)}x`,
    statLabel: 'MER vs break-even'
  });

  // 3. Budget reallocation between Meta accounts
  const comparable = accounts.filter(a => a.verdict !== 'Judge on IC cost');
  if (comparable.length >= 2) {
    const best = [...comparable].sort((a, b) => b.roas - a.roas)[0];
    const worst = [...comparable].sort((a, b) => a.roas - b.roas)[0];
    const shift = simulateShift(accounts, worst.name, best.name, 100000, 0.7, be.roas);
    if (best.name !== worst.name) {
      const gapPct = (best.roas / worst.roas - 1) * 100;
      const needed = (shift.breakEvenEfficiency * 100).toFixed(0);
      out.push(
        shift.deltaValue > 0
          ? {
              id: 'reallocate',
              tone: 'opportunity',
              title: `Shift budget from ${worst.name} to ${best.name}`,
              body: `${best.name} returns ${best.roas.toFixed(2)}x against ${worst.roas.toFixed(2)}x for ${worst.name}. Moving ₹1L, if the extra spend earns 70% of ${best.name}'s ROAS, adds about ${formatINR(shift.deltaValue, true)} of purchase value at no extra spend.`,
              stat: `+${formatINR(shift.deltaValue, true)}`,
              statLabel: 'per ₹1L moved'
            }
          : {
              id: 'reallocate',
              tone: 'info',
              title: 'Moving budget between Meta accounts is a weak lever',
              body: `The best account (${best.name}, ${best.roas.toFixed(2)}x) beats the weakest (${worst.name}, ${worst.roas.toFixed(2)}x) by only ${gapPct.toFixed(0)}%. A move pays off only if the extra spend keeps at least ${needed}% of ${best.name}'s ROAS; at 70% it loses ${formatINR(-shift.deltaValue, true)} per ₹1L. The bigger levers are creative and the store's break-even gap.`,
              stat: `${gapPct.toFixed(0)}%`,
              statLabel: 'ROAS gap, best vs weakest'
            }
      );
    }
  }

  // 4 & 5 & 6. Trend (handbook monthly figures)
  if (months.length >= 2) {
    const first = months[0];
    const last = months[months.length - 1];

    if (amazonReport.length >= 2) {
      // The marketplace's own ad report beats the settlement-based estimate whenever it exists
      const f = amazonReport[0];
      const l = amazonReport[amazonReport.length - 1];
      const change = (l.tacos as number) - (f.tacos as number);
      out.push({
        id: 'tacos',
        tone: change > 3 ? 'risk' : 'info',
        title: change > 3 ? 'Amazon ad load is rising' : change < -3 ? 'Amazon ad load is falling' : 'Amazon ad load is steady',
        body: `Amazon's own ad report puts ad spend at ${(f.tacos as number).toFixed(1)}% of Amazon sales in ${f.month} and ${(l.tacos as number).toFixed(1)}% in ${l.month}. Over the 12 months it ranged from ${Math.min(...amazonReport.map(a => a.tacos as number)).toFixed(1)}% to ${Math.max(...amazonReport.map(a => a.tacos as number)).toFixed(1)}%.`,
        stat: `${(l.tacos as number).toFixed(1)}%`,
        statLabel: `TACOS, from ${(f.tacos as number).toFixed(1)}%`
      });
    } else {
      out.push({
        id: 'tacos',
        tone: last.tacos > first.tacos + 3 ? 'risk' : 'info',
        title: 'Amazon ad load is rising',
        body: `Amazon ads (monthly roll-up) went from ${first.tacos.toFixed(1)}% of Amazon sales in ${first.month} to ${last.tacos.toFixed(1)}% in ${last.month}, while Amazon sales moved ${pct((last.amazonSales / first.amazonSales - 1) * 100)} and ad spend ${pct((last.amazonAds / first.amazonAds - 1) * 100)}.`,
        stat: `${last.tacos.toFixed(1)}%`,
        statLabel: `TACOS, from ${first.tacos.toFixed(1)}%`,
        tag: 'Estimate'
      });
    }

    // The two Amazon ad figures: the ad report vs the settlement-based estimate behind combined
    // ad spend, MER and the P&L. The monthly handbook figures cover 2026, hence the year check.
    const compared = [...amazonReport]
      .reverse()
      .find(a => a.monthKey.startsWith('2026-') && months.some(m => m.month === a.month.slice(0, 3) && m.amazonAds > 0));
    if (compared) {
      const est = months.find(m => m.month === compared.month.slice(0, 3))!;
      const gap = est.amazonAds / compared.adSpend - 1;
      if (Math.abs(gap) > 0.1) {
        out.push({
          id: 'amazon-ads-gap',
          tone: 'risk',
          title: "Amazon's two ad figures disagree",
          body: `Amazon's ad report shows ${formatINR(compared.adSpend, true)} of ad spend for ${compared.month} (${(compared.tacos as number).toFixed(1)}% of Amazon sales). The settlement-based estimate in the monthly roll-up (used for combined ad spend and MER) is ${formatINR(est.amazonAds, true)}, ${Math.abs(gap * 100).toFixed(0)}% ${gap > 0 ? 'higher' : 'lower'}. Check which one Amazon actually billed.`,
          stat: pct(gap * 100),
          statLabel: 'estimate vs ad report',
          tag: 'Needs check'
        });
      }
    }

    out.push({
      id: 'mer-trend',
      tone: last.blendedMer < first.blendedMer ? 'risk' : 'opportunity',
      title: 'Paid media is returning less per rupee',
      body: `Sales per ₹1 of all paid media (Meta, Google and Amazon ads) moved from ₹${first.blendedMer.toFixed(2)} in ${first.month} to ₹${last.blendedMer.toFixed(2)} in ${last.month} (${pct((last.blendedMer / first.blendedMer - 1) * 100)}).`,
      stat: `${last.blendedMer.toFixed(2)}x`,
      statLabel: `blended MER, from ${first.blendedMer.toFixed(2)}x`,
      tag: 'Estimate'
    });

    out.push({
      id: 'meta-trend',
      tone: last.metaROAS >= first.metaROAS ? 'opportunity' : 'risk',
      title: 'Meta efficiency is improving',
      body: `Meta ROAS climbed from ${first.metaROAS.toFixed(2)}x in ${first.month} to ${last.metaROAS.toFixed(2)}x in ${last.month} (${pct((last.metaROAS / first.metaROAS - 1) * 100)}). Google is at ${last.googleROAS.toFixed(2)}x, back to its ${first.month} level after the ${Math.min(...months.map(m => m.googleROAS)).toFixed(2)}x low in June.`,
      stat: pct((last.metaROAS / first.metaROAS - 1) * 100),
      statLabel: 'Meta ROAS since April'
    });
  }

  // 7. Creative fatigue (illustrative)
  const fatigued = adSets.filter(a => a.status === 'High fatigue' || a.status === 'Moderate fatigue');
  if (adSets.length > 0) {
    const totalSpend = sum(adSets.map(a => a.spend));
    const fatiguedSpend = sum(fatigued.map(a => a.spend));
    const worst = [...fatigued].sort((a, b) => b.spend - a.spend)[0];
    out.push({
      id: 'fatigue',
      tone: fatigued.length > 0 ? 'risk' : 'opportunity',
      title: fatigued.length > 0 ? 'Creative fatigue is eating budget' : 'No creative fatigue detected',
      body:
        fatigued.length > 0 && worst
          ? `${fatigued.length} of ${adSets.length} ad sets show fatigue and hold ${((fatiguedSpend / totalSpend) * 100).toFixed(0)}% of Meta spend. Largest: ${worst.name} (CTR ${pct(worst.ctrTrendPct)} week on week, frequency ${worst.freq7.toFixed(1)}).`
          : `None of the ${adSets.length} ad sets trips the CTR, frequency and cost-per-purchase rule.`,
      stat: `${fatigued.length} / ${adSets.length}`,
      statLabel: 'ad sets fatigued',
      tag: 'Illustrative'
    });
  }

  return out;
}
