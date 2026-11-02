import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useDashboard } from '../../context/DashboardContext';
import type { LatencySourceKey } from '../../data/channelLatency';
import { formatAge, formatAsOf, groupFreshness, useSourceFreshness } from '../../utils/freshness';

const CORE: LatencySourceKey[] = ['shopify', 'meta', 'google', 'amazonSales', 'amazonSettlement', 'flipkart', 'warehouse'];

/**
 * Appears only when a source is past its accepted delay. A source that is behind by design
 * (Flipkart's day, Amazon's lag) never raises it.
 */
export const StaleBanner: React.FC = () => {
  const { setCurrentView } = useDashboard();
  const items = useSourceFreshness(CORE).filter(i => i.status === 'stale');
  if (items.length === 0) return null;
  const groups = groupFreshness(items);

  return (
    <div role="alert" className="bg-rose-50 border-b border-rose-200 text-rose-900 text-xs px-4 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="inline-flex items-center gap-1.5 font-bold uppercase tracking-wider text-[10px]">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden />
        Stale data
      </span>
      <span className="flex-1 min-w-0">
        {groups.map((g, i) => (
          <span key={i}>
            {i > 0 && ' · '}
            <strong>{g.labels.join(', ')}</strong> last updated {g.item.asOf ? formatAsOf(g.item.asOf) : 'at an unknown time'}
            {g.item.ageHours !== null && ` (${formatAge(g.item.ageHours)} ago)`}
          </span>
        ))}
        . The figures describe that day, not today.
      </span>
      <button
        onClick={() => setCurrentView('data-health')}
        className="font-semibold underline underline-offset-2 hover:text-rose-950 shrink-0"
      >
        See all sources
      </button>
    </div>
  );
};
