import React from 'react';
import { Download, Info, Store } from 'lucide-react';
import type { AmazonInventoryPlanItem } from '../../data/initialData';
import { SectionSourceBadge } from '../common/SectionSourceBadge';
import { formatNumber } from '../../utils/formatters';
import { fbaProjection, type PlanInputs } from '../../utils/inventoryPlan';

interface Props {
  plans: AmazonInventoryPlanItem[];
  inputs: Pick<PlanInputs, 'start' | 'end' | 'buffer'>;
  days: number;
  onExport: () => void;
}

const num = 'py-2.5 px-3 text-right font-mono';

export const MarketplaceInventory: React.FC<Props> = ({ plans, inputs, days, onExport }) => {
  const rows = plans.map(p => fbaProjection(p, inputs));
  const totalSend = rows.reduce((s, r) => s + r.send, 0);
  const invalid = days === 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="p-2 bg-amber-50 rounded-lg text-amber-700 shrink-0">
            <Store className="w-5 h-5" aria-hidden />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 text-sm">Marketplace inventory: assessment and projection</h3>
            <p className="text-xs text-slate-500 max-w-2xl">
              Amazon FBA stock projected over the planning period: what runs out, when, and how many units to send so the period is covered with the safety stock.
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
          Download marketplace plan (.xlsx)
        </button>
      </div>

      <SectionSourceBadge
        source="Shan's report sheet, tab Amz-Inventory Plan"
        latency="Entered by hand"
        sources={['inventoryPlan']}
      />

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-y border-slate-200">
            <tr>
              <th className="py-2.5 px-3">ASIN</th>
              <th className="py-2.5 px-3">Product</th>
              <th className="py-2.5 px-3 text-right">FBA stock</th>
              <th className="py-2.5 px-3 text-right">Inbound</th>
              <th className="py-2.5 px-3 text-right">Monthly sales</th>
              <th className="py-2.5 px-3 text-right">Days of cover</th>
              <th className="py-2.5 px-3 text-right">Demand in period</th>
              <th className="py-2.5 px-3 text-right">Stock at end</th>
              <th className="py-2.5 px-3 text-right">To send to FBA</th>
              <th className="py-2.5 px-3 text-right">Plan sheet says</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
            {rows.map(r => (
              <tr key={r.plan.asin} className="hover:bg-slate-50 transition-colors">
                <td className="py-2.5 px-3 font-mono font-bold text-amber-900">{r.plan.asin}</td>
                <td className="py-2.5 px-3 font-semibold text-slate-900">{r.plan.product}</td>
                <td className={num}>{formatNumber(r.plan.currentInventory)}</td>
                <td className={`${num} text-emerald-700`}>+{formatNumber(r.plan.inbound)}</td>
                <td className={`${num} text-slate-600`}>{formatNumber(r.plan.avgMonthlySale)}</td>
                <td className={`${num} font-bold`}>{Number.isFinite(r.cover) ? `${r.cover.toFixed(1)}d` : '—'}</td>
                <td className={num}>{formatNumber(Math.round(r.demand))}</td>
                <td className={`${num} ${r.endStock < 0 ? 'text-rose-700 font-bold' : ''}`}>{formatNumber(Math.round(r.endStock))}</td>
                <td className={`${num} font-bold`}>
                  {r.send > 0 ? (
                    <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded">Send {formatNumber(r.send)}</span>
                  ) : (
                    <span className="text-emerald-700">Covered</span>
                  )}
                </td>
                <td className={`${num} text-slate-500`}>{r.plan.neededToSend > 0 ? formatNumber(r.plan.neededToSend) : '—'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 border-t border-slate-200 font-bold text-slate-900">
              <td className="py-2.5 px-3" colSpan={8}>
                Total to send to FBA
              </td>
              <td className={num}>{formatNumber(totalSend)} units</td>
              <td className={num} />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex items-start gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200 text-[11px] text-slate-600 leading-relaxed">
        <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" aria-hidden />
        <div>
          <strong className="text-slate-800">Flipkart, Nykaa, Myntra, Purplle and Snapdeal have no stock report yet,</strong> so they cannot be projected here. Flipkart's weekly FBF
          report arrives in Slack but its counts are not loaded. The download has a fill-in sheet for these marketplaces, wired to the same dates, until a stock tab is added to the
          report sheet. The plan sheet carries no date, so stock is taken as it stands on the start date and inbound as already arrived.
        </div>
      </div>
    </div>
  );
};
