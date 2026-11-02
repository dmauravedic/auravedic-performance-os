import * as XLSX from 'xlsx';
import type { AmazonInventoryPlanItem, WarehouseItem } from '../data/initialData';
import {
  HUB_LABEL,
  fbaProjection,
  hubRequirement,
  periodDays,
  type Hub,
  type PlanInputs
} from './inventoryPlan';

/**
 * Workbooks for the factory. Every figure that depends on the dates, the safety stock or the CBE
 * share is a live Excel formula over the yellow input cells, with the dashboard's own result stored
 * beside it, so the file opens with the right numbers and recalculates when someone edits a date.
 */

type CellSpec = { v?: string | number; f?: string; z?: string };
type Grid = Record<string, XLSX.CellObject>;

const col = (n: number): string => XLSX.utils.encode_col(n);
const serial = (iso: string): number => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86_400_000 + 25569 : 0;
};

class Sheet {
  grid: Grid = {};
  maxRow = 0;
  maxCol = 0;
  widths: number[] = [];

  put(addr: string, spec: CellSpec | string | number): void {
    const { c, r } = XLSX.utils.decode_cell(addr);
    this.maxRow = Math.max(this.maxRow, r);
    this.maxCol = Math.max(this.maxCol, c);
    const s: CellSpec = typeof spec === 'object' ? spec : { v: spec };
    const cell: XLSX.CellObject = typeof s.v === 'string' ? { t: 's', v: s.v } : { t: 'n', v: s.v ?? 0 };
    if (s.f) cell.f = s.f;
    if (s.z) cell.z = s.z;
    this.grid[addr] = cell;
  }

  finish(): XLSX.WorkSheet {
    const ws: XLSX.WorkSheet = { ...this.grid };
    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: this.maxRow, c: this.maxCol } });
    ws['!cols'] = this.widths.map(w => ({ wch: w }));
    return ws;
  }
}

const DATE_FMT = 'dd-mmm-yyyy';

const fileStamp = (start: string, end: string) => `${start}_to_${end}`;

function safeName(label: string): string {
  return label.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
}

function notesSheet(lines: string[]): XLSX.WorkSheet {
  const s = new Sheet();
  lines.forEach((line, i) => s.put(`A${i + 1}`, line));
  s.widths = [120];
  return s.finish();
}

// ───────────── Warehouse requirement

export interface FactoryExportArgs {
  hub: Hub;
  items: WarehouseItem[];
  inputs: PlanInputs;
  stockAsOf: string;
  cbeShareNote: string;
  generatedOn: string;
}

export function exportFactoryRequirement(a: FactoryExportArgs): string {
  const { hub, items, inputs } = a;
  const hubs: ('cbe' | 'mumbai')[] = hub === 'all' ? ['cbe', 'mumbai'] : [hub];
  const days = periodDays(inputs.start, inputs.end);
  const s = new Sheet();

  s.put('A1', 'Auravedic: factory requirement');
  s.put('A2', `${HUB_LABEL[hub]} | ${inputs.start} to ${inputs.end} | prepared ${a.generatedOn}`);
  s.put('A4', 'Start date');
  s.put('B4', { v: serial(inputs.start), z: DATE_FMT });
  s.put('A5', 'End date');
  s.put('B5', { v: serial(inputs.end), z: DATE_FMT });
  s.put('A6', 'Days in period');
  s.put('B6', { v: days, f: 'B5-B4+1' });
  s.put('A7', 'Safety stock on demand');
  s.put('B7', { v: inputs.buffer, z: '0%' });
  s.put('A8', 'Stock report date');
  s.put('B8', { v: serial(inputs.stockDate), z: DATE_FMT });
  s.put('A9', 'CBE share of demand');
  s.put('B9', { v: inputs.cbeShare, z: '0%' });
  s.put('C4', 'Change the dates, safety stock or CBE share and every figure below recalculates. Mumbai serves the rest of demand.');

  const header = 11; // zero-based row of the header
  const first = header + 2; // first data row number (1-based)
  const heads = ['Code', 'Product', 'Daily sales (units)'];
  for (const h of hubs) {
    const name = h === 'cbe' ? 'CBE' : 'Mumbai';
    heads.push(`${name} stock in hand`, `${name} demand + safety`, `${name} stock at period start`, `${name} to produce`);
  }
  if (hubs.length === 2) heads.push('Total to produce');
  heads.forEach((t, i) => s.put(`${col(i)}${header + 1}`, t));

  const lastRow = first + items.length - 1;
  const colTotals: Record<string, number> = {};
  const addTotal = (c: string, v: number) => {
    colTotals[c] = (colTotals[c] ?? 0) + v;
  };
  items.forEach((item, i) => {
    const r = first + i;
    s.put(`A${r}`, item.key);
    s.put(`B${r}`, item.name);
    s.put(`C${r}`, item.dailyRunRate);
    const toProduceCols: string[] = [];
    hubs.forEach((h, hi) => {
      const base = 3 + hi * 4;
      const [cStock, cDemand, cStart, cProd] = [col(base), col(base + 1), col(base + 2), col(base + 3)];
      const share = h === 'cbe' ? '$B$9' : '(1-$B$9)';
      const req = hubRequirement(item, h, inputs);
      s.put(`${cStock}${r}`, req.stock);
      s.put(`${cDemand}${r}`, { v: req.demand + req.safety, f: `C${r}*${share}*$B$6*(1+$B$7)`, z: '#,##0' });
      s.put(`${cStart}${r}`, { v: req.startStock, f: `MAX(0,${cStock}${r}-C${r}*${share}*MAX(0,$B$4-$B$8-1))`, z: '#,##0' });
      s.put(`${cProd}${r}`, { v: req.required, f: `MAX(0,ROUNDUP(${cDemand}${r}-${cStart}${r},0))`, z: '#,##0' });
      toProduceCols.push(cProd);
      addTotal(cProd, req.required);
    });
    if (hubs.length === 2) {
      const total = hubs.reduce((sum, h) => sum + hubRequirement(item, h, inputs).required, 0);
      const totalCol = col(3 + hubs.length * 4);
      s.put(`${totalCol}${r}`, { v: total, f: toProduceCols.map(c => `${c}${r}`).join('+'), z: '#,##0' });
      addTotal(totalCol, total);
    }
  });

  const totalRow = lastRow + 1;
  s.put(`B${totalRow}`, 'Total');
  for (const [c, v] of Object.entries(colTotals)) {
    s.put(`${c}${totalRow}`, { v, f: `SUM(${c}${first}:${c}${lastRow})`, z: '#,##0' });
  }
  s.widths = [10, 34, 18, ...hubs.flatMap(() => [16, 20, 22, 16]), ...(hubs.length === 2 ? [18] : [])];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, s.finish(), 'Requirement');
  XLSX.utils.book_append_sheet(
    wb,
    notesSheet([
      'How these figures are worked out',
      '',
      'To produce = demand over the period, plus safety stock, minus the stock expected on the first day. Never below zero.',
      'Demand = daily sales × the hub\'s share of demand × days in the period.',
      'Stock at period start = stock in hand, less what the hub sells between the stock report and the start date.',
      '',
      `Stock in hand is the last warehouse report: ${a.stockAsOf}. CBE stock in hand counts D2C available plus bulk reserve.`,
      "Daily sales is the sales rate held in the dashboard for each product. Confirm it with the sales team before ordering.",
      `CBE share of demand: ${a.cbeShareNote}`,
      'Marketplace (Amazon FBA) replenishment is not in this file. Use the marketplace plan for that, and check that the daily sales above do not already include it.',
      '',
      `Prepared from the Auravedic dashboard on ${a.generatedOn}.`
    ]),
    'Notes'
  );

  const name = `factory-requirement_${safeName(HUB_LABEL[hub])}_${fileStamp(inputs.start, inputs.end)}.xlsx`;
  XLSX.writeFile(wb, name);
  return name;
}

// ───────────── Marketplace inventory plan

export interface MarketplaceExportArgs {
  plans: AmazonInventoryPlanItem[];
  inputs: Pick<PlanInputs, 'start' | 'end' | 'buffer'>;
  generatedOn: string;
}

export function exportMarketplacePlan(a: MarketplaceExportArgs): string {
  const { plans, inputs } = a;
  const days = periodDays(inputs.start, inputs.end);
  const s = new Sheet();

  s.put('A1', 'Auravedic: marketplace inventory plan, Amazon FBA');
  s.put('A2', `${inputs.start} to ${inputs.end} | prepared ${a.generatedOn}`);
  s.put('A4', 'Start date');
  s.put('B4', { v: serial(inputs.start), z: DATE_FMT });
  s.put('A5', 'End date');
  s.put('B5', { v: serial(inputs.end), z: DATE_FMT });
  s.put('A6', 'Days in period');
  s.put('B6', { v: days, f: 'B5-B4+1' });
  s.put('A7', 'Safety stock on demand');
  s.put('B7', { v: inputs.buffer, z: '0%' });
  s.put('C4', 'Change the dates or safety stock and the figures below recalculate. Stock is taken as it stands on the start date.');

  const header = 9;
  const heads = [
    'ASIN',
    'Product',
    'FBA stock',
    'Inbound',
    'Monthly sales',
    'Daily sales',
    'Demand in period',
    'Demand + safety',
    'Stock + inbound',
    'Projected stock at end',
    'Days of cover (stock only)',
    'Runs out on',
    'To send to FBA',
    'Plan sheet suggests'
  ];
  heads.forEach((t, i) => s.put(`${col(i)}${header + 1}`, t));
  const first = header + 2;
  plans.forEach((p, i) => {
    const r = first + i;
    const proj = fbaProjection(p, inputs);
    s.put(`A${r}`, p.asin);
    s.put(`B${r}`, p.product);
    s.put(`C${r}`, p.currentInventory);
    s.put(`D${r}`, p.inbound);
    s.put(`E${r}`, p.avgMonthlySale);
    s.put(`F${r}`, { v: proj.perDay, f: `E${r}/30`, z: '#,##0.0' });
    s.put(`G${r}`, { v: proj.demand, f: `F${r}*$B$6`, z: '#,##0' });
    s.put(`H${r}`, { v: proj.withBuffer, f: `G${r}*(1+$B$7)`, z: '#,##0' });
    s.put(`I${r}`, { v: proj.available, f: `C${r}+D${r}`, z: '#,##0' });
    s.put(`J${r}`, { v: proj.endStock, f: `I${r}-G${r}`, z: '#,##0;[Red]-#,##0' });
    s.put(`K${r}`, { v: Number.isFinite(proj.cover) ? proj.cover : 0, f: `IF(F${r}>0,C${r}/F${r},0)`, z: '0.0' });
    s.put(`L${r}`, {
      v: Number.isFinite(proj.cover) ? serial(inputs.start) + proj.cover : 0,
      f: `IF(F${r}>0,$B$4+K${r},0)`,
      z: DATE_FMT
    });
    s.put(`M${r}`, { v: proj.send, f: `MAX(0,ROUNDUP(H${r}-I${r},0))`, z: '#,##0' });
    s.put(`N${r}`, p.neededToSend);
  });
  const last = first + plans.length - 1;
  s.put(`B${last + 1}`, 'Total');
  for (const c of ['C', 'D', 'E', 'M', 'N']) {
    const idx = XLSX.utils.decode_col(c);
    const v = plans.reduce((sum, p) => {
      if (c === 'C') return sum + p.currentInventory;
      if (c === 'D') return sum + p.inbound;
      if (c === 'E') return sum + p.avgMonthlySale;
      if (c === 'N') return sum + p.neededToSend;
      return sum + fbaProjection(p, inputs).send;
    }, 0);
    s.put(`${col(idx)}${last + 1}`, { v, f: `SUM(${c}${first}:${c}${last})`, z: '#,##0' });
  }
  s.widths = [14, 22, 11, 10, 14, 11, 16, 16, 16, 20, 24, 14, 16, 18];

  // Marketplaces with no stock report yet: a fill-in sheet wired to the same dates.
  const o = new Sheet();
  o.put('A1', 'Other marketplaces: fill in the yellow columns');
  o.put('A2', 'No stock report exists yet for Flipkart, Nykaa, Myntra, Purplle or Snapdeal. Enter stock and monthly sales by listing; the rest uses the dates and safety stock on the Amazon FBA sheet.');
  ['Marketplace', 'Listing or SKU', 'Stock now', 'Inbound', 'Monthly sales', 'Daily sales', 'Demand in period', 'To send'].forEach((t, i) =>
    o.put(`${col(i)}4`, t)
  );
  for (let r = 5; r <= 20; r += 1) {
    o.put(`F${r}`, { v: '', f: `IF(E${r}="","",E${r}/30)`, z: '#,##0.0' });
    o.put(`G${r}`, { v: '', f: `IF(E${r}="","",F${r}*'Amazon FBA'!$B$6)`, z: '#,##0' });
    o.put(`H${r}`, { v: '', f: `IF(E${r}="","",MAX(0,ROUNDUP(G${r}*(1+'Amazon FBA'!$B$7)-C${r}-D${r},0)))`, z: '#,##0' });
  }
  o.widths = [16, 28, 12, 10, 14, 12, 16, 12];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, s.finish(), 'Amazon FBA');
  XLSX.utils.book_append_sheet(wb, o.finish(), 'Other marketplaces');
  XLSX.utils.book_append_sheet(
    wb,
    notesSheet([
      'How these figures are worked out',
      '',
      'Daily sales = the plan sheet\'s average monthly sale ÷ 30.',
      'To send to FBA = demand over the period, plus safety stock, minus FBA stock and inbound. Never below zero.',
      'Days of cover counts FBA stock only, as the plan sheet does. Runs out on = start date + days of cover.',
      'The plan sheet carries no date, so stock is taken as it stands on the start date. Inbound is assumed to have arrived by then.',
      'The last column shows what the plan sheet itself suggests, for comparison.',
      '',
      `Prepared from the Auravedic dashboard on ${a.generatedOn}.`
    ]),
    'Notes'
  );

  const name = `marketplace-inventory-plan_${fileStamp(inputs.start, inputs.end)}.xlsx`;
  XLSX.writeFile(wb, name);
  return name;
}
