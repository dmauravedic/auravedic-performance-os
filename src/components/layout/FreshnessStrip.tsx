import React from 'react';
import { useDashboard } from '../../context/DashboardContext';
import { Clock, CheckCircle2, AlertTriangle, Info, HelpCircle, MinusCircle } from 'lucide-react';
import type { LatencySourceKey } from '../../data/channelLatency';
import { formatAsOf, usePreviewingNow, useSourceFreshness, type FreshnessStatus } from '../../utils/freshness';

const ITEMS: { name: string; key: LatencySourceKey }[] = [
  { name: 'Meta Ads (5 Acc)', key: 'meta' },
  { name: 'Google Ads', key: 'google' },
  { name: 'Shopify Store', key: 'shopify' },
  { name: 'Amazon SP-API', key: 'amazonSales' },
  { name: 'Amazon Settle', key: 'amazonSettlement' },
  { name: 'Amazon Ads', key: 'amazonAds' },
  { name: 'Warehouse Desk', key: 'warehouse' }
];

/** Channels with no daily feed: the one standing gap, named once instead of flagged as stale. */
const NO_DAILY_FEED = 'Flipkart, Nykaa, Myntra';

const ICON: Partial<Record<FreshnessStatus, React.ReactNode>> = {
  fresh: <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" aria-hidden />,
  'expected-lag': <Info className="w-3 h-3 text-sky-300 shrink-0" aria-hidden />,
  stale: <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" aria-hidden />,
  unknown: <HelpCircle className="w-3 h-3 text-amber-400 shrink-0" aria-hidden />
};

export const FreshnessStrip: React.FC = () => {
  const { setCurrentView } = useDashboard();
  const freshness = useSourceFreshness(ITEMS.map(i => i.key));
  const previewing = usePreviewingNow();
  const staleCount = freshness.filter(f => f.status === 'stale').length;

  return (
    <div className="bg-slate-900 text-slate-300 text-[11px] px-4 py-2 border-b border-slate-800 flex items-center justify-between gap-3 overflow-x-auto select-none">
      <div className="flex items-center gap-1.5 text-slate-400 font-medium shrink-0">
        <Clock className="w-3.5 h-3.5 text-amber-500" />
        <span className="uppercase tracking-wider text-[10px] text-amber-400 font-bold">Data Freshness:</span>
      </div>

      <div className="flex items-center gap-4 shrink-0">
        {ITEMS.map((item, idx) => {
          const f = freshness[idx];
          return (
            <div key={item.key} className="flex items-center gap-1.5 whitespace-nowrap" title={f.message}>
              {ICON[f.status]}
              <span className="text-slate-200 font-medium">{item.name}:</span>
              <span className={f.status === 'stale' ? 'text-rose-300' : 'text-slate-400'}>
                {f.asOf ? formatAsOf(f.asOf) : 'no date'}
              </span>
              {f.status === 'stale' && <span className="text-rose-300 font-semibold">stale</span>}
              {f.status === 'expected-lag' && <span className="text-sky-300">{f.short}</span>}
            </div>
          );
        })}
        <div
          className="flex items-center gap-1.5 whitespace-nowrap"
          title="These marketplaces have no daily feed. Their days are marked 'not reported yet' and left out of the figures; their monthly rows come from the report sheet."
        >
          <MinusCircle className="w-3 h-3 text-amber-400 shrink-0" aria-hidden />
          <span className="text-slate-200 font-medium">{NO_DAILY_FEED}:</span>
          <span className="text-amber-300">data gap (no daily feed)</span>
        </div>
      </div>

      <div className="flex items-center gap-2 ml-auto shrink-0">
        {previewing && (
          <span className="text-[10px] font-semibold uppercase tracking-wider text-sky-300 bg-sky-950 px-2 py-0.5 rounded">
            Previewing another date
          </span>
        )}
        {staleCount > 0 && (
          <span className="text-[10px] font-semibold uppercase tracking-wider text-rose-200 bg-rose-950 px-2 py-0.5 rounded">
            {staleCount} stale
          </span>
        )}
        <button
          onClick={() => setCurrentView('data-health')}
          className="text-[10px] font-semibold uppercase tracking-wider text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1 bg-slate-800 hover:bg-slate-700 px-2 py-0.5 rounded"
        >
          Sources & Logs →
        </button>
      </div>
    </div>
  );
};
