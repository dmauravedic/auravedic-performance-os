import type { AmazonInventoryPlanItem, StateCodRiskItem, WarehouseItem } from '../data/initialData';

export type Hub = 'all' | 'cbe' | 'mumbai';

export const HUB_LABEL: Record<Hub, string> = { all: 'All warehouses', cbe: 'Coimbatore (CBE)', mumbai: 'Mumbai' };

/** States served from Coimbatore, per the dispatch rule. */
const SOUTH_STATES = ['tamil nadu', 'karnataka', 'kerala', 'andhra pradesh', 'telangana', 'puducherry', 'pondicherry'];

/**
 * Share of orders that ship from CBE, from the Shopify order mix by state. Only the top states are
 * listed, so this is a floor; the page lets the user overwrite it.
 */
export function cbeShareFromStates(states: StateCodRiskItem[]): number {
  const total = states.reduce((s, r) => s + r.orders, 0);
  if (total === 0) return 0.5;
  const south = states.filter(r => SOUTH_STATES.includes(r.state.toLowerCase())).reduce((s, r) => s + r.orders, 0);
  return south / total;
}

export interface PlanInputs {
  /** YYYY-MM-DD */
  start: string;
  end: string;
  /** Safety stock on top of demand, as a fraction (0.1 = 10%). */
  buffer: number;
  /** Share of demand served from CBE (0–1). Mumbai serves the rest. */
  cbeShare: number;
  /** Date of the stock report (YYYY-MM-DD, IST). Sales after it have already drawn the stock down. */
  stockDate: string;
}

const DAY = 86_400_000;
const toUtcDay = (iso: string): number => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : NaN;
};

/** Days in the period, counting both ends. 0 when the dates are missing or reversed. */
export function periodDays(start: string, end: string): number {
  const d = (toUtcDay(end) - toUtcDay(start)) / DAY + 1;
  return Number.isFinite(d) && d > 0 ? Math.round(d) : 0;
}

/** Days of sales between the stock report (closing stock of `stockDate`) and the period start. */
export function daysSinceStockReport(stockDate: string, start: string): number {
  const d = (toUtcDay(start) - toUtcDay(stockDate)) / DAY - 1;
  return Number.isFinite(d) && d > 0 ? Math.round(d) : 0;
}

export const hubShare = (hub: 'cbe' | 'mumbai', cbeShare: number): number => (hub === 'cbe' ? cbeShare : 1 - cbeShare);
export const hubStock = (item: WarehouseItem, hub: 'cbe' | 'mumbai'): number => (hub === 'cbe' ? item.cbeSIH : item.mumbaiSIH);

export interface HubRequirement {
  share: number;
  stock: number;
  /** Units sold from this hub since the stock report. */
  soldSince: number;
  /** Stock expected on the first day of the period. */
  startStock: number;
  demand: number;
  safety: number;
  /** Units the factory has to supply for this hub. */
  required: number;
}

export function hubRequirement(item: WarehouseItem, hub: 'cbe' | 'mumbai', inp: PlanInputs): HubRequirement {
  const days = periodDays(inp.start, inp.end);
  const share = hubShare(hub, inp.cbeShare);
  const stock = hubStock(item, hub);
  const perDay = item.dailyRunRate * share;
  const soldSince = perDay * daysSinceStockReport(inp.stockDate, inp.start);
  const startStock = Math.max(0, stock - soldSince);
  const demand = perDay * days;
  const safety = demand * inp.buffer;
  const required = Math.max(0, Math.ceil(demand + safety - startStock - 1e-9));
  return { share, stock, soldSince, startStock, demand, safety, required };
}

export interface WarehouseRequirementRow {
  item: WarehouseItem;
  cbe: HubRequirement;
  mumbai: HubRequirement;
  total: number;
}

export const warehouseRequirement = (items: WarehouseItem[], inp: PlanInputs): WarehouseRequirementRow[] =>
  items.map(item => {
    const cbe = hubRequirement(item, 'cbe', inp);
    const mumbai = hubRequirement(item, 'mumbai', inp);
    return { item, cbe, mumbai, total: cbe.required + mumbai.required };
  });

/** Days of cover for a hub (or all warehouses) at the sales rate that hub serves. */
export function daysOfCover(item: WarehouseItem, hub: Hub, cbeShare: number): number {
  const stock = hub === 'all' ? item.cbeSIH + item.mumbaiSIH : hubStock(item, hub);
  const rate = hub === 'all' ? item.dailyRunRate : item.dailyRunRate * hubShare(hub, cbeShare);
  return rate > 0 ? stock / rate : Infinity;
}

export type Health = 'critical' | 'low' | 'optimal';
export const healthOf = (doc: number): Health => (doc < 7 ? 'critical' : doc <= 14 ? 'low' : 'optimal');

// ───────────── Marketplace (Amazon FBA) projection

export interface FbaProjection {
  plan: AmazonInventoryPlanItem;
  perDay: number;
  demand: number;
  withBuffer: number;
  available: number;
  endStock: number;
  /** Days the FBA stock alone lasts, as the plan sheet counts it. */
  cover: number;
  /** Days the stock plus inbound lasts. */
  coverWithInbound: number;
  /** Units to send to FBA so the period is covered with the safety buffer. */
  send: number;
}

export function fbaProjection(plan: AmazonInventoryPlanItem, inp: Pick<PlanInputs, 'start' | 'end' | 'buffer'>): FbaProjection {
  const days = periodDays(inp.start, inp.end);
  const perDay = plan.avgMonthlySale / 30;
  const demand = perDay * days;
  const withBuffer = demand * (1 + inp.buffer);
  const available = plan.currentInventory + plan.inbound;
  return {
    plan,
    perDay,
    demand,
    withBuffer,
    available,
    endStock: available - demand,
    cover: perDay > 0 ? plan.currentInventory / perDay : Infinity,
    coverWithInbound: perDay > 0 ? available / perDay : Infinity,
    send: Math.max(0, Math.ceil(withBuffer - available - 1e-9))
  };
}

/** YYYY-MM-DD of an instant, in IST. */
export function istDate(d: Date): string {
  const ist = new Date(d.getTime() + 330 * 60_000);
  return ist.toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number): string {
  return new Date(toUtcDay(iso) + n * DAY).toISOString().slice(0, 10);
}
