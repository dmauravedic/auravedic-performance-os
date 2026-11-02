// Auto-generated seed data bundle for Auravedic Cross-Channel Performance Dashboard
import rawData from './dashboardData.json';

export interface BaseProduct {
  key: string;
  name: string;
  category: string;
  mrp: number;
  defaultCost: number;
  hero: boolean;
}

export interface Recipe {
  code: string;
  title: string;
  type: 'S' | 'P' | 'C';
  channel: string;
  parts: Record<string, number>;
  sellingPrice: number;
}

export interface UnitEconomicItem {
  name: string;
  cogs: number;
  shipping: number;
  metaCAC: number;
  sellingPrice: number;
  rtoCost: number;
  netProfitWithRTO: number;
  netProfitWithoutRTO: number;
  marginPercent: number;
}

export interface MonthlyMetric {
  month: string;
  shopifyPreReturns: number;
  shopifyNet: number;
  amazonSales: number;
  totalSales: number;
  flipkartSalesEst: number;
  metaSpend: number;
  googleSpend: number;
  totalAdsIncluded: number;
  amazonAdsSpendEst: number;
  flipkartAdsSpend: number;
  salesPerRupeeAd: number;
  amazonShare: number;
  shopifyOrders: number;
  amazonOrders: number;
  metaROAS: number;
  googleROAS: number;
  realisticNetProfit: number;
  contributionMargin: number;
}

export interface AmazonASINItem {
  parentAsin: string;
  childAsin: string;
  title: string;
  unitsOrdered: number;
  totalOrderItems: number;
  estRevenue: number;
}

export interface AmazonInventoryPlanItem {
  asin: string;
  product: string;
  currentInventory: number;
  inbound: number;
  avgMonthlySale: number;
  neededToSend: number;
  daysOfCover: number;
}

export interface MetaAccount {
  name: string;
  accountId: string;
  status: string;
  share: number;
  spendOct: number;
  purchasesOct: number;
  roasOct: number;
  strategy: string;
}

export interface WarehouseItem {
  key: string;
  name: string;
  cbeD2CAvl: number;
  cbeBulkReserve: number;
  cbeSIH: number;
  mumbaiSIH: number;
  totalStock: number;
  dailyRunRate: number;
  daysOfCover: number;
  reorderNeeded: boolean;
}

export interface StateCodRiskItem {
  state: string;
  region: string;
  orders: number;
  codShare: number;
  rtoRate: number;
  riskLevel: string;
  revenue: number;
}

export interface MarketplaceItem {
  channel: string;
  type: string;
  monthlyRevenue: number;
  sharePercent: number;
  orders: number;
  aov: number;
  returnRate: number;
  status: string;
  /** Platform ad spend for the month and its return per rupee (marketplaces without an API feed). */
  adSpend?: number;
  adRoas?: number;
  skusMapped?: number;
  /** Month the figures cover, when it differs from the dashboard period (e.g. "Aug 2026"). */
  periodLabel?: string;
}

export interface FreshnessInfo {
  metaAds: string;
  googleAds: string;
  shopifySales: string;
  amazonSales: string;
  amazonSettlement: string;
  flipkartOrders: string;
  warehouseStock: string;
  assumptions: {
    defaultCOGS: number;
    flatShipping: number;
    freeShippingThreshold: number;
    freeTonerThreshold: number;
  };
}

export interface DashboardDataBundle {
  baseProducts: BaseProduct[];
  recipes: Recipe[];
  unitEconomics: Record<string, UnitEconomicItem>;
  monthlyPerformance: MonthlyMetric[];
  amazonBusinessData: AmazonASINItem[];
  amazonInventoryPlan: AmazonInventoryPlanItem[];
  metaAccounts: MetaAccount[];
  warehouseStock: WarehouseItem[];
  stateCodRisk: StateCodRiskItem[];
  marketplaceSummary: MarketplaceItem[];
  freshness: FreshnessInfo;
}

export const initialDashboardData: DashboardDataBundle = rawData as DashboardDataBundle;
