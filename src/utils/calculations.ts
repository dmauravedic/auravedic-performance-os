import { BaseProduct, Recipe, UnitEconomicItem, MonthlyMetric } from '../data/initialData';
import { DailyRecord } from '../data/dailyData';
import { TimePeriod, ChannelFilter } from '../context/DashboardContext';
import { resolvePeriod } from './periods';
import { MARKETPLACE_COGS_PCT } from '../data/assumptions';
import { CHANNEL_SOURCES, chartValue, gapFor, reportedDays, type Gap } from './coverage';

/**
 * Calculations module for Auravedic Commerce Dashboard
 * Implements the official business formulas from the Context Handbook & Scope document
 */

export type PnLChannel = 'all' | 'shopify' | 'amazon';

export interface PnLBreakdown {
  grossSales: number;
  discounts: number;
  returns: number;
  netRevenue: number;
  cogs: number;
  shipping: number;
  marketplaceFees: number;
  adSpend: number;
  overheads: number; // Company overheads charged to this channel (see overheadShare)
  overheadShare: number; // 0–1, this channel's share of company overheads (by net revenue)
  netContribution: number;
  contributionMarginPercent: number;
  dashboardSales: number; // Pre-returns sales: Shopify gross - discounts + Amazon principal
  dashboardProfit: number; // Pre-returns sales - ad spend
}

export function computeRealisticPnL(params: {
  shopifyGross: number;
  shopifyDiscounts: number;
  shopifyReturns: number;
  amazonPrincipal: number;
  amazonRefunds: number;
  amazonPromos: number;
  amazonFees: number;
  amazonBilledAds: number;
  shopifyUnits: number;
  shopifyOrdersOver499: number;
  metaGoogleSpend: number;
  /** Shopify COGS per unit. */
  customCOGSPerUnit?: number;
  /** Marketplace (Amazon) COGS as a % of the channel's sales. */
  marketplaceCOGSPct?: number;
  flatShippingRate?: number;
  overheads?: number;
  /** Which channel's P&L to build. Defaults to the combined Shopify + Amazon P&L. */
  channel?: PnLChannel;
}): PnLBreakdown {
  const channel = params.channel ?? 'all';
  const includeShopify = channel !== 'amazon';
  const includeAmazon = channel !== 'shopify';

  const cogsRate = params.customCOGSPerUnit ?? 125;
  const marketplaceCOGSPct = params.marketplaceCOGSPct ?? MARKETPLACE_COGS_PCT.default;
  const shippingRate = params.flatShippingRate ?? 65;
  const companyOverheads = params.overheads ?? 0;

  // Store numbers
  const shopifyNet = params.shopifyGross - params.shopifyDiscounts - params.shopifyReturns;
  const storeCOGS = params.shopifyUnits * cogsRate;
  const storeShipping = params.shopifyOrdersOver499 * shippingRate;
  const storeAds = params.metaGoogleSpend;

  // Amazon numbers
  const amazonNet = params.amazonPrincipal - params.amazonRefunds - params.amazonPromos;
  const amazonCOGS = params.amazonPrincipal * (marketplaceCOGSPct / 100);
  const amazonFees = params.amazonFees;
  const amazonAds = params.amazonBilledAds;

  // Totals for the selected channel(s). Meta + Google spend belongs to the store;
  // Amazon carries its own billed ads and marketplace fees.
  const grossSales = (includeShopify ? params.shopifyGross : 0) + (includeAmazon ? params.amazonPrincipal : 0);
  const discounts = (includeShopify ? params.shopifyDiscounts : 0) + (includeAmazon ? params.amazonPromos : 0);
  const returns = (includeShopify ? params.shopifyReturns : 0) + (includeAmazon ? params.amazonRefunds : 0);
  const netRevenue = (includeShopify ? shopifyNet : 0) + (includeAmazon ? amazonNet : 0);
  const totalCOGS = (includeShopify ? storeCOGS : 0) + (includeAmazon ? amazonCOGS : 0);
  const totalShipping = includeShopify ? storeShipping : 0;
  const totalMarketplaceFees = includeAmazon ? amazonFees : 0;
  const totalAdSpend = (includeShopify ? storeAds : 0) + (includeAmazon ? amazonAds : 0);

  // Overheads are company-level: a single channel carries its share by net revenue, so the
  // Shopify and Amazon P&Ls add up to the combined one.
  const companyNet = shopifyNet + amazonNet;
  const overheadShare = channel === 'all' ? 1 : companyNet > 0 ? netRevenue / companyNet : 0;
  const overheads = companyOverheads * overheadShare;

  const netContribution = netRevenue - totalCOGS - totalShipping - totalMarketplaceFees - totalAdSpend - overheads;
  const contributionMarginPercent = netRevenue > 0 ? (netContribution / netRevenue) * 100 : 0;

  // Dashboard Basis Profit (Sales pre-returns minus Meta + Google ad spend)
  const dashboardSales =
    (includeShopify ? params.shopifyGross - params.shopifyDiscounts : 0) +
    (includeAmazon ? params.amazonPrincipal : 0);
  const dashboardProfit = dashboardSales - (includeShopify ? params.metaGoogleSpend : 0);

  return {
    grossSales,
    discounts,
    returns,
    netRevenue,
    cogs: totalCOGS,
    shipping: totalShipping,
    marketplaceFees: totalMarketplaceFees,
    adSpend: totalAdSpend,
    overheads,
    overheadShare,
    netContribution,
    contributionMarginPercent,
    dashboardSales,
    dashboardProfit
  };
}

export interface FilteredMetrics {
  periodLabel: string;
  priorLabel: string;
  channelLabel: string;
  sales: number;
  priorSales: number;
  adSpend: number;
  priorAdSpend: number;
  mer: number;
  priorMer: number;
  orders: number;
  priorOrders: number;
  aov: number;
  priorAov: number;
  netProfit: number;
  priorNetProfit: number;
  marginPercent: number;
  priorMarginPercent: number;
  // Shopify / Amazon split of the period, whichever channel is selected. Meta + Google spend
  // belongs to Shopify; Amazon carries its own billed ads.
  shopifyOrders: number;
  shopifyAdSpend: number;
  shopifyMer: number;
  amazonSales: number;
  amazonAdSpend: number;
  amazonMer: number;
  chartData: any[];
  isSingleDay: boolean;
  /** Days of the period the figures leave out because a source has not reported them (see coverage.ts). */
  gap: Gap | null;
  /** False when either period lost days that way: the % changes are then 0 and must not be shown. */
  comparable: boolean;
  deltaSales: number;
  deltaAdSpend: number;
  deltaMer: number;
  deltaNetProfit: number;
  deltaOrders: number;
}

/**
 * Reactive calculation engine that computes real-time metrics for any Period and Channel selection
 */
export function getFilteredMetrics(
  period: TimePeriod,
  channel: ChannelFilter,
  cogsRate: number = 125,
  shippingRate: number = 65,
  monthlyPerformance: MonthlyMetric[] = [],
  marketplaceCogsPct: number = MARKETPLACE_COGS_PCT.default
): FilteredMetrics {
  // Shopify is costed per unit (cogsRate); marketplaces as a share of their sales
  const marketplaceCogs = (sales: number) => sales * (marketplaceCogsPct / 100);

  // Windows follow the newest date in the daily series (see utils/periods.ts)
  const {
    current: currentSlice,
    prior: priorSlice,
    periodLabel,
    priorLabel,
    isSingleDay,
  } = resolvePeriod(period);

  // Channel extractor helper
  const extractChannelData = (slice: DailyRecord[]) => {
    let sales = 0;
    let adSpend = 0;
    let orders = 0;
    let cogs = 0;
    let shipping = 0;
    let fees = 0;
    let shopifySales = 0;
    let shopifyOrders = 0;
    let shopifyAdSpend = 0;
    let amazonSales = 0;
    let amazonAdSpend = 0;

    slice.forEach(r => {
      shopifySales += r.shopifyPreReturns;
      shopifyOrders += r.shopifyOrders;
      shopifyAdSpend += r.metaSpend + r.googleSpend;
      amazonSales += r.amazonSales;
      amazonAdSpend += r.amazonBilledAds;

      if (channel === 'shopify') {
        sales += r.shopifyPreReturns;
        adSpend += (r.metaSpend + r.googleSpend);
        orders += r.shopifyOrders;
        cogs += r.shopifyOrders * 1.3 * cogsRate;
        shipping += (r.shopifyOrders * 0.8) * shippingRate;
        fees += 0;
      } else if (channel === 'amazon') {
        sales += r.amazonSales;
        adSpend += r.amazonBilledAds;
        orders += r.amazonOrders;
        cogs += marketplaceCogs(r.amazonSales);
        shipping += 0;
        fees += r.amazonFees;
      } else if (channel === 'flipkart') {
        sales += r.flipkartSales;
        adSpend += r.flipkartAds;
        orders += r.flipkartOrders;
        cogs += marketplaceCogs(r.flipkartSales);
        shipping += 0;
        fees += r.flipkartSales * 0.22;
      } else if (channel === 'nykaa') {
        sales += r.nykaaSales;
        adSpend += r.nykaaAds;
        orders += r.nykaaOrders;
        cogs += marketplaceCogs(r.nykaaSales);
        shipping += 0;
        fees += r.nykaaSales * 0.25;
      } else if (channel === 'myntra') {
        sales += r.myntraSales;
        adSpend += r.myntraAds;
        orders += r.myntraOrders;
        cogs += marketplaceCogs(r.myntraSales);
        shipping += 0;
        fees += r.myntraSales * 0.28;
      } else {
        // 'all' channels: ad spend is Shopify's (Meta + Google) plus Amazon's billed ads, so the
        // blended MER divides the same sales that the spend produced
        sales += (r.shopifyPreReturns + r.amazonSales);
        adSpend += (r.metaSpend + r.googleSpend + r.amazonBilledAds);
        orders += (r.shopifyOrders + r.amazonOrders);
        cogs += r.shopifyOrders * 1.3 * cogsRate + marketplaceCogs(r.amazonSales);
        shipping += (r.shopifyOrders * 0.8) * shippingRate;
        fees += r.amazonFees;
      }
    });

    const mer = adSpend > 0 ? sales / adSpend : 0;
    const aov = orders > 0 ? sales / orders : 0;
    const netProfit = sales - cogs - shipping - fees - adSpend;
    const marginPercent = sales > 0 ? (netProfit / sales) * 100 : 0;

    return {
      sales,
      adSpend,
      orders,
      mer,
      aov,
      netProfit,
      marginPercent,
      shopifyOrders,
      shopifyAdSpend,
      shopifyMer: shopifyAdSpend > 0 ? shopifySales / shopifyAdSpend : 0,
      amazonSales,
      amazonAdSpend,
      amazonMer: amazonAdSpend > 0 ? amazonSales / amazonAdSpend : 0
    };
  };

  // Only days where every source the channel's figures need is reported (see coverage.ts)
  const needs = CHANNEL_SOURCES[channel];
  const gap = gapFor(currentSlice, needs);
  const comparable = !gap && !gapFor(priorSlice, needs);
  const curr = extractChannelData(reportedDays(currentSlice, needs));
  const prev = extractChannelData(reportedDays(priorSlice, needs));

  const channelLabelMap: Record<ChannelFilter, string> = {
    all: 'All Channels (Shopify + Amazon)',
    shopify: 'Shopify D2C Store',
    amazon: 'Amazon.in Seller Central',
    flipkart: 'Flipkart Seller Hub',
    nykaa: 'Nykaa Marketplace',
    myntra: 'Myntra Marketplace'
  };

  // Build daily chart series
  const chartData = currentSlice.map(r => {
    let daySales = 0;
    let daySpend = 0;
    if (channel === 'shopify') {
      daySales = r.shopifyPreReturns;
      daySpend = r.metaSpend + r.googleSpend;
    } else if (channel === 'amazon') {
      daySales = r.amazonSales;
      daySpend = r.amazonBilledAds;
    } else if (channel === 'flipkart') {
      daySales = r.flipkartSales;
      daySpend = r.flipkartAds;
    } else if (channel === 'nykaa') {
      daySales = r.nykaaSales;
      daySpend = r.nykaaAds;
    } else if (channel === 'myntra') {
      daySales = r.myntraSales;
      daySpend = r.myntraAds;
    } else {
      daySales = r.shopifyPreReturns + r.amazonSales;
      daySpend = r.metaSpend + r.googleSpend + r.amazonBilledAds;
    }

    // A source with no figures for the day is a gap in the chart, not a zero
    const v = chartValue;
    const complete = needs.every(src => !r.missing?.includes(src));
    return {
      date: r.date.slice(5), // '10-25'
      fullDate: r.date,
      Sales: complete ? Math.round(daySales) : null,
      AdSpend: complete ? Math.round(daySpend) : null,
      ShopifySales: v(r, ['shopify'], Math.round(r.shopifyPreReturns)),
      AmazonSales: v(r, ['amazon'], Math.round(r.amazonSales)),
      ShopifyAdSpend: v(r, ['meta', 'google'], Math.round(r.metaSpend + r.googleSpend)),
      AmazonAdSpend: v(r, ['amazon'], Math.round(r.amazonBilledAds)),
      MER: complete && daySpend > 0 ? Number((daySales / daySpend).toFixed(2)) : null
    };
  });

  const delta = (c: number, p: number) => (comparable && p > 0 ? ((c - p) / p) * 100 : 0);

  return {
    periodLabel,
    priorLabel,
    channelLabel: channelLabelMap[channel],
    sales: curr.sales,
    priorSales: prev.sales,
    adSpend: curr.adSpend,
    priorAdSpend: prev.adSpend,
    mer: curr.mer,
    priorMer: prev.mer,
    orders: curr.orders,
    priorOrders: prev.orders,
    aov: curr.aov,
    priorAov: prev.aov,
    netProfit: curr.netProfit,
    priorNetProfit: prev.netProfit,
    marginPercent: curr.marginPercent,
    priorMarginPercent: prev.marginPercent,
    shopifyOrders: curr.shopifyOrders,
    shopifyAdSpend: curr.shopifyAdSpend,
    shopifyMer: curr.shopifyMer,
    amazonSales: curr.amazonSales,
    amazonAdSpend: curr.amazonAdSpend,
    amazonMer: curr.amazonMer,
    chartData,
    isSingleDay,
    gap,
    comparable,
    deltaSales: delta(curr.sales, prev.sales),
    deltaAdSpend: delta(curr.adSpend, prev.adSpend),
    deltaMer: delta(curr.mer, prev.mer),
    deltaNetProfit: delta(curr.netProfit, prev.netProfit),
    deltaOrders: delta(curr.orders, prev.orders)
  };
}

/**
 * Explodes finished listing sales into base product physical consumption
 */
export function explodeListingDemandToBaseProducts(
  listingSales: { code: string; units: number }[],
  recipes: Recipe[],
  baseProducts: BaseProduct[]
): Record<string, { baseKey: string; name: string; category: string; unitsDemanded: number; mrp: number }> {
  const result: Record<string, { baseKey: string; name: string; category: string; unitsDemanded: number; mrp: number }> = {};

  baseProducts.forEach(bp => {
    result[bp.key] = {
      baseKey: bp.key,
      name: bp.name,
      category: bp.category,
      unitsDemanded: 0,
      mrp: bp.mrp
    };
  });

  const recipeMap = new Map<string, Recipe>();
  recipes.forEach(r => recipeMap.set(r.code, r));

  listingSales.forEach(item => {
    const recipe = recipeMap.get(item.code);
    if (recipe) {
      Object.entries(recipe.parts).forEach(([baseKey, qty]) => {
        if (result[baseKey]) {
          result[baseKey].unitsDemanded += item.units * qty;
        } else {
          result[baseKey] = {
            baseKey,
            name: baseKey,
            category: 'Unclassified',
            unitsDemanded: item.units * qty,
            mrp: 500
          };
        }
      });
    } else {
      if (result[item.code]) {
        result[item.code].unitsDemanded += item.units;
      }
    }
  });

  return result;
}

/**
 * Calculates stock days of cover and status
 */
export function calculateDaysOfCover(stockInHand: number, dailyVelocity: number): {
  days: number;
  status: 'critical' | 'warning' | 'healthy';
  reorderUnits: number;
} {
  if (dailyVelocity <= 0) {
    return { days: 999, status: 'healthy', reorderUnits: 0 };
  }
  const days = Math.round((stockInHand / dailyVelocity) * 10) / 10;
  
  if (days < 7) {
    const targetDays = 45;
    const reorderUnits = Math.round(dailyVelocity * targetDays - stockInHand);
    return { days, status: 'critical', reorderUnits: Math.max(0, reorderUnits) };
  }
  
  if (days < 14) {
    const targetDays = 35;
    const reorderUnits = Math.round(dailyVelocity * targetDays - stockInHand);
    return { days, status: 'warning', reorderUnits: Math.max(0, reorderUnits) };
  }

  return { days, status: 'healthy', reorderUnits: 0 };
}
