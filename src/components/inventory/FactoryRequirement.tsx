import React from 'react';
import { Download, Factory } from 'lucide-react';
import type { WarehouseItem } from '../../data/initialData';
import { SectionSourceBadge } from '../common/SectionSourceBadge';
import { formatNumber } from '../../utils/formatters';
import { HUB_LABEL, warehouseRequirement, type Hub, type PlanInputs } from '../../utils/inventoryPlan';

interface Props {
  hub: Hub;
  items: WarehouseItem[];
  inputs: PlanInputs;
  days: number;
  stockAsOf: string;
  onExport: () => void;
}

const num = 'py-2.5 px-3 text-right font-mono';

const ToProduce: React.FC<{ value: number }> = ({ value }) =>
  value > 0 ? (
    <span className="font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded">{formatNumber(value)}</span>
  ) : (
    <span className="text-slate-400">0</span>
  );

export const FactoryRequirement: React.FC<Props> = ({ hub, items, inputs, days, stockAsOf, onExport }) => {
  const rows = warehouseRequirement(items, inputs);
  const grand = rows.reduce((s, r) => s + (hub === 'cbe' ? r.cbe.required : hub === 'mumbai' ? r.mumbai.required : r.total), 0);
  const invalid = days === 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="p-2 bg-amber-50 rounded-lg text-amber-700 shrink-0">
            <Factory className="w-5 h-5" aria-hidden />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 text-sm">Factory requirement: {HUB_LABEL[hub]}</h3>
            <p className="text-xs text-slate-500 max-w-2xl">
              Units to produce so the {days || '—'}-day period is covered, after counting stock on hand and the sales made since the last stock report ({stockAsOf}).
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled={invalid}
          onClick={onExport}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
        >
          <Download className="w-3.5 h-3.5" aria-hidden />
          Download for factory (.xlsx)
        </button>
      </div>

      <SectionSourceBadge
        source="Warehouse closing stock (Slack #inventory-wh-movement) with the dashboard's daily sales rate"
        syncCadence="Task #7 (Mon–Sat 23:00 IST)"
        sources={['warehouse']}
        showLatency={false}
      />

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-y border-slate-200">
            <tr>
              <th className="py-2.5 px-3">Base Key</th>
              <th className="py-2.5 px-3">Product</th>
              <th className="py-2.5 px-3 text-right">Sales / day</th>
              {hub === 'all' ? (
                <>
                  <th className="py-2.5 px-3 text-right">CBE stock</th>
                  <th className="py-2.5 px-3 text-right">CBE to produce</th>
                  <th className="py-2.5 px-3 text-right">Mumbai stock</th>
                  <th className="py-2.5 px-3 text-right">Mumbai to produce</th>
                  <th className="py-2.5 px-3 text-right">Total to produce</th>
                </>
              ) : (
                <>
                  <th className="py-2.5 px-3 text-right">Stock in hand</th>
                  <th className="py-2.5 px-3 text-right">Stock at period start</th>
                  <th className="py-2.5 px-3 text-right">Demand + safety</th>
                  <th className="py-2.5 px-3 text-right">To produce</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
            {rows.map(({ item, cbe, mumbai, total }) => {
              const one = hub === 'cbe' ? cbe : mumbai;
              return (
                <tr key={item.key} className="hover:bg-slate-50 transition-colors">
                  <td className="py-2.5 px-3 font-mono font-bold text-amber-900">{item.key}</td>
                  <td className="py-2.5 px-3 font-semibold text-slate-900">{item.name}</td>
                  <td className={`${num} text-slate-600`}>{hub === 'all' ? item.dailyRunRate : (item.dailyRunRate * one.share).toFixed(1)}</td>
                  {hub === 'all' ? (
                    <>
                      <td className={num}>{formatNumber(cbe.stock)}</td>
                      <td className={num}><ToProduce value={cbe.required} /></td>
                      <td className={num}>{formatNumber(mumbai.stock)}</td>
                      <td className={num}><ToProduce value={mumbai.required} /></td>
                      <td className={`${num} font-bold`}><ToProduce value={total} /></td>
                    </>
                  ) : (
                    <>
                      <td className={num}>{formatNumber(one.stock)}</td>
                      <td className={num}>{formatNumber(Math.round(one.startStock))}</td>
                      <td className={num}>{formatNumber(Math.round(one.demand + one.safety))}</td>
                      <td className={`${num} font-bold`}><ToProduce value={one.required} /></td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 border-t border-slate-200 font-bold text-slate-900">
              <td className="py-2.5 px-3" colSpan={hub === 'all' ? 7 : 6}>
                Total to produce
              </td>
              <td className={num}>{formatNumber(grand)} units</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-[11px] text-slate-500 leading-relaxed">
        To produce = sales per day × share of demand × days, plus safety stock, minus the stock expected on the first day. CBE stock in hand is D2C available plus bulk reserve.
        The sales rate is the figure held in the dashboard for each product; confirm it before sending. These figures do not include Amazon FBA top-ups, which are planned separately below.
      </p>
    </div>
  );
};
