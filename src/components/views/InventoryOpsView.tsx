import React, { useState } from 'react';
import { useDashboard } from '../../context/DashboardContext';
import { MetricCard } from '../common/MetricCard';
import { SectionSourceBadge } from '../common/SectionSourceBadge';
import { PlanningControls, type PlanState } from '../inventory/PlanningControls';
import { FactoryRequirement } from '../inventory/FactoryRequirement';
import { MarketplaceInventory } from '../inventory/MarketplaceInventory';
import { formatNumber } from '../../utils/formatters';
import { formatAsOf, parseAsOf, useNow } from '../../utils/freshness';
import {
  HUB_LABEL,
  addDays,
  cbeShareFromStates,
  daysOfCover,
  healthOf,
  hubShare,
  hubStock,
  istDate,
  periodDays,
  type Hub,
  type PlanInputs
} from '../../utils/inventoryPlan';
import { exportFactoryRequirement, exportMarketplacePlan } from '../../utils/exportWorkbooks';
import { Warehouse } from 'lucide-react';

const HUBS: Hub[] = ['all', 'cbe', 'mumbai'];
type StatusFilter = 'all' | 'critical' | 'warning' | 'healthy';

const docClass = (doc: number) => (doc < 7 ? 'text-rose-700 font-extrabold' : doc <= 14 ? 'text-amber-700' : 'text-emerald-700');

export const InventoryOpsView: React.FC = () => {
  const { data } = useDashboard();
  const { warehouseStock, amazonInventoryPlan, stateCodRisk, freshness } = data;
  const now = useNow();

  const [hub, setHub] = useState<Hub>('all');
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('all');

  const derivedCbeSharePct = Math.round(cbeShareFromStates(stateCodRisk) * 100);
  const [plan, setPlan] = useState<PlanState>(() => {
    const start = addDays(istDate(now), 1);
    return { start, end: addDays(start, 44), bufferPct: 10, cbeSharePct: derivedCbeSharePct };
  });

  const stockAsOfDate = parseAsOf(freshness.warehouseStock);
  const stockDate = istDate(stockAsOfDate ?? now);
  const stockAsOfLabel = stockAsOfDate ? `${formatAsOf(stockAsOfDate)} IST` : 'date not recorded';
  const inputs: PlanInputs = {
    start: plan.start,
    end: plan.end,
    buffer: plan.bufferPct / 100,
    cbeShare: plan.cbeSharePct / 100,
    stockDate
  };
  const days = periodDays(plan.start, plan.end);

  // One row per product at the selected warehouse level.
  const rows = warehouseStock.map(item => {
    const stock = hub === 'all' ? item.cbeSIH + item.mumbaiSIH : hubStock(item, hub);
    const rate = hub === 'all' ? item.dailyRunRate : item.dailyRunRate * hubShare(hub, inputs.cbeShare);
    const doc = daysOfCover(item, hub, inputs.cbeShare);
    return { item, stock, rate, doc, health: healthOf(doc) };
  });
  const critical = rows.filter(r => r.health === 'critical');
  const low = rows.filter(r => r.health === 'low');
  const shown = rows.filter(r => {
    if (filterStatus === 'critical') return r.health === 'critical';
    if (filterStatus === 'warning') return r.health === 'low';
    if (filterStatus === 'healthy') return r.health === 'optimal';
    return true;
  });
  const names = (list: typeof rows) =>
    list.length ? list.slice(0, 3).map(r => `${r.item.key} ${r.doc.toFixed(1)}d`).join(', ') : 'None right now';

  const hero = rows.find(r => r.item.key === 'K100');
  const fbaUnits = amazonInventoryPlan.reduce((s, p) => s + p.currentInventory, 0);
  const fbaMonthly = amazonInventoryPlan.reduce((s, p) => s + p.avgMonthlySale, 0);

  const generatedOn = istDate(now);
  const shareIsEstimate = plan.cbeSharePct === derivedCbeSharePct;

  const exportFactory = () =>
    exportFactoryRequirement({
      hub,
      items: warehouseStock,
      inputs,
      stockAsOf: stockAsOfLabel,
      cbeShareNote: shareIsEstimate
        ? `${plan.cbeSharePct}%, estimated from the Shopify order mix by state. Only the top states are listed, so it is a floor.`
        : `${plan.cbeSharePct}%, set by the user in the dashboard (the order-mix estimate was ${derivedCbeSharePct}%).`,
      generatedOn
    });

  const exportMarketplace = () =>
    exportMarketplacePlan({
      plans: amazonInventoryPlan,
      inputs: { start: plan.start, end: plan.end, buffer: inputs.buffer },
      generatedOn
    });

  const heroSubtitle = !hero
    ? ''
    : hub === 'all'
      ? `CBE: ${formatNumber(hero.item.cbeSIH)} | Mumbai: ${formatNumber(hero.item.mumbaiSIH)}`
      : hub === 'cbe'
        ? `D2C: ${formatNumber(hero.item.cbeD2CAvl)} | Bulk reserve: ${formatNumber(hero.item.cbeBulkReserve)}`
        : 'Mumbai warehouse';

  return (
    <div className="space-y-6">
      {/* Warehouse level */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Warehouse</span>
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80" role="group" aria-label="Warehouse level">
            {HUBS.map(h => (
              <button
                key={h}
                type="button"
                aria-pressed={h === hub}
                onClick={() => setHub(h)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  h === hub ? 'bg-amber-600 text-white shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                {HUB_LABEL[h]}
              </button>
            ))}
          </div>
        </div>
        <SectionSourceBadge
          source="Nightly Warehouse Reports (Slack #inventory-wh-movement)"
          syncCadence="Mon-Sat 23:00 IST"
        />
      </div>

      {/* Headline Inventory KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Critical Stockout Alerts"
          value={`${critical.length} Products`}
          subtitle="Cover < 7 days (immediate factory batch needed)"
          badgeText="Urgent"
          badgeVariant="danger"
          footnote={names(critical)}
        />

        <MetricCard
          title="Reorder Warning Queue"
          value={`${low.length} Products`}
          subtitle="Cover between 7 and 14 days"
          badgeText="7–14 Days"
          badgeVariant="warning"
          footnote={names(low)}
        />

        <MetricCard
          title="Hero Product Stock (K100)"
          value={hero ? `${formatNumber(hero.stock)} Units` : '—'}
          subtitle={heroSubtitle}
          badgeText="Hero Oil"
          badgeVariant={hero && hero.health === 'critical' ? 'danger' : hero && hero.health === 'low' ? 'warning' : 'success'}
          footnote={hero ? `Days of cover: ${hero.doc.toFixed(1)} days at ${HUB_LABEL[hub]}` : undefined}
        />

        <MetricCard
          title="Amazon FBA Units"
          value={`${formatNumber(fbaUnits)} Units`}
          subtitle={`Held at FBA across ${amazonInventoryPlan.length} ASINs`}
          badgeText="Amazon FBA"
          badgeVariant="primary"
          footnote={`Average monthly Amazon sales: ${formatNumber(fbaMonthly)} units`}
          sources={['inventoryPlan']}
        />
      </div>

      {/* Operational Dispatch Rule Banner */}
      <div className="p-4 bg-slate-900 text-white rounded-xl border border-slate-800 text-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Warehouse className="w-5 h-5 text-amber-500 shrink-0" />
          <div>
            <strong className="text-white block font-semibold">Warehouse Dispatch & Routing Logic:</strong>
            <p className="text-slate-300 text-[11px] mt-0.5">
              South India orders (TN, KA, KL, AP, TS, PY) ship from <strong>Coimbatore (CBE)</strong>. All other zones ship from <strong>Mumbai</strong>. Palakkad factory replenishes both hubs weekly.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px]">
          <span className="bg-slate-800 px-2 py-1 rounded text-slate-300 font-mono">CBE SIH = D2C Avl + BLK-RSRV</span>
        </div>
      </div>

      {/* Days of Cover & Reorder Table */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-slate-900 text-sm">Base Product Stock & Days of Cover: {HUB_LABEL[hub]}</h3>
            <p className="text-xs text-slate-500">
              {hub === 'all'
                ? 'Nightly closing stock from #inventory-wh-movement, both warehouses together.'
                : `Cover counts only the ${hub === 'cbe' ? Math.round(inputs.cbeShare * 100) : Math.round((1 - inputs.cbeShare) * 100)}% of sales that ship from ${HUB_LABEL[hub]}.`}
            </p>
          </div>

          <div className="flex items-center gap-1.5 text-xs bg-slate-100 p-1 rounded-lg">
            {(
              [
                ['all', `All (${rows.length})`, 'bg-white text-slate-900 shadow-2xs'],
                ['critical', `Critical (${critical.length})`, 'bg-rose-500 text-white font-semibold'],
                ['warning', `Warning (${low.length})`, 'bg-amber-500 text-white font-semibold'],
                ['healthy', 'Healthy', 'bg-white text-slate-900 shadow-2xs']
              ] as [StatusFilter, string, string][]
            ).map(([key, label, on]) => (
              <button
                key={key}
                type="button"
                aria-pressed={filterStatus === key}
                onClick={() => setFilterStatus(key)}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${filterStatus === key ? on : 'text-slate-600'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-y border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Base Key</th>
                <th className="py-2.5 px-3">Product Name</th>
                {hub === 'all' && (
                  <>
                    <th className="py-2.5 px-3 text-right">CBE D2C Avl</th>
                    <th className="py-2.5 px-3 text-right">CBE Bulk Reserve</th>
                    <th className="py-2.5 px-3 text-right">Mumbai Stock</th>
                    <th className="py-2.5 px-3 text-right">Total Units</th>
                  </>
                )}
                {hub === 'cbe' && (
                  <>
                    <th className="py-2.5 px-3 text-right">D2C Avl</th>
                    <th className="py-2.5 px-3 text-right">Bulk Reserve</th>
                    <th className="py-2.5 px-3 text-right">Stock in hand</th>
                  </>
                )}
                {hub === 'mumbai' && <th className="py-2.5 px-3 text-right">Stock in hand</th>}
                <th className="py-2.5 px-3 text-right">Daily Velocity</th>
                <th className="py-2.5 px-3 text-right">Days of Cover</th>
                <th className="py-2.5 px-3 text-right">Reorder Batch</th>
                <th className="py-2.5 px-3">Stock Health</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {shown.map(({ item, stock, rate, doc, health }) => {
                const suggestedBatch = Math.max(0, Math.round(rate * 45 - stock));
                return (
                  <tr key={item.key} className={`hover:bg-slate-50 transition-colors ${health === 'critical' ? 'bg-rose-50/40' : health === 'low' ? 'bg-amber-50/20' : ''}`}>
                    <td className="py-2.5 px-3 font-mono font-bold text-amber-900">{item.key}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">{item.name}</td>
                    {hub === 'all' && (
                      <>
                        <td className="py-2.5 px-3 text-right font-mono">{formatNumber(item.cbeD2CAvl)}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-500">{formatNumber(item.cbeBulkReserve)}</td>
                        <td className="py-2.5 px-3 text-right font-mono">{formatNumber(item.mumbaiSIH)}</td>
                      </>
                    )}
                    {hub === 'cbe' && (
                      <>
                        <td className="py-2.5 px-3 text-right font-mono">{formatNumber(item.cbeD2CAvl)}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-500">{formatNumber(item.cbeBulkReserve)}</td>
                      </>
                    )}
                    <td className={`py-2.5 px-3 text-right font-mono ${hub === 'all' ? 'font-bold text-slate-900' : ''}`}>{formatNumber(stock)}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-600">{Number.isInteger(rate) ? rate : rate.toFixed(1)} u/day</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold">
                      <span className={docClass(doc)}>{doc.toFixed(1)}d</span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold">
                      {doc < 14 ? (
                        <span className="text-amber-800 bg-amber-100 px-2 py-0.5 rounded text-[11px]">+{formatNumber(suggestedBatch)} units</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          health === 'critical'
                            ? 'bg-rose-100 text-rose-800 border-rose-300 font-bold'
                            : health === 'low'
                              ? 'bg-amber-100 text-amber-800 border-amber-300'
                              : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        }`}
                      >
                        {health === 'critical' ? 'Critical (<7d)' : health === 'low' ? 'Low (7-14d)' : 'Optimal'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-slate-500">Reorder batch tops stock up to 45 days of sales at {HUB_LABEL[hub]}.</p>
      </div>

      {/* Factory planning */}
      <PlanningControls
        plan={plan}
        days={days}
        derivedCbeSharePct={derivedCbeSharePct}
        onChange={patch => setPlan(p => ({ ...p, ...patch }))}
      />

      <FactoryRequirement hub={hub} items={warehouseStock} inputs={inputs} days={days} stockAsOf={stockAsOfLabel} onExport={exportFactory} />

      <MarketplaceInventory
        plans={amazonInventoryPlan}
        inputs={{ start: plan.start, end: plan.end, buffer: inputs.buffer }}
        days={days}
        onExport={exportMarketplace}
      />
    </div>
  );
};
