import React from 'react';
import { CalendarRange } from 'lucide-react';

export interface PlanState {
  start: string;
  end: string;
  bufferPct: number;
  cbeSharePct: number;
}

interface Props {
  plan: PlanState;
  days: number;
  derivedCbeSharePct: number;
  onChange: (patch: Partial<PlanState>) => void;
}

const field = 'w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400';

/** The planning period shared by the factory requirement and the marketplace plan. */
export const PlanningControls: React.FC<Props> = ({ plan, days, derivedCbeSharePct, onChange }) => {
  const num = (raw: string, min: number, max: number): number => Math.min(max, Math.max(min, Number(raw) || 0));
  const invalid = days === 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
      <div className="flex items-start gap-2.5">
        <div className="p-2 bg-amber-50 rounded-lg text-amber-700 shrink-0">
          <CalendarRange className="w-5 h-5" aria-hidden />
        </div>
        <div>
          <h3 className="font-semibold text-slate-900 text-sm">Planning period</h3>
          <p className="text-xs text-slate-500">
            Choose the dates the factory order has to cover. The requirement below, and the marketplace plan, recalculate as you change them, and both can be downloaded as spreadsheets.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
        <label className="space-y-1">
          <span className="font-semibold text-slate-600">From</span>
          <input type="date" className={field} value={plan.start} onChange={e => onChange({ start: e.target.value })} />
        </label>
        <label className="space-y-1">
          <span className="font-semibold text-slate-600">To</span>
          <input type="date" className={field} value={plan.end} min={plan.start} onChange={e => onChange({ end: e.target.value })} />
        </label>
        <label className="space-y-1">
          <span className="font-semibold text-slate-600">Safety stock on demand (%)</span>
          <input
            type="number"
            min={0}
            max={100}
            className={field}
            value={plan.bufferPct}
            onChange={e => onChange({ bufferPct: num(e.target.value, 0, 100) })}
          />
        </label>
        <label className="space-y-1">
          <span className="font-semibold text-slate-600">CBE share of demand (%)</span>
          <input
            type="number"
            min={0}
            max={100}
            className={field}
            value={plan.cbeSharePct}
            onChange={e => onChange({ cbeSharePct: num(e.target.value, 0, 100) })}
          />
        </label>
        <div className="space-y-1">
          <span className="font-semibold text-slate-600 block">Days covered</span>
          <div className={`px-2.5 py-1.5 rounded-lg font-mono font-bold border ${invalid ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-slate-50 text-slate-900 border-slate-200'}`}>
            {invalid ? 'Check the dates' : `${days} days`}
          </div>
        </div>
      </div>

      <p className="text-[11px] text-slate-500 leading-relaxed">
        CBE share is the part of sales shipped from Coimbatore under the dispatch rule; Mumbai serves the rest. It starts at{' '}
        <strong>{derivedCbeSharePct}%</strong>, taken from the Shopify order mix by state. Only the top states are listed, so treat it as a floor and overwrite it with the real split if you have it.
      </p>
    </div>
  );
};
