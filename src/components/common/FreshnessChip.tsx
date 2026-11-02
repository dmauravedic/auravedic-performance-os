import React from 'react';
import { AlertTriangle, CheckCircle2, HelpCircle, Info } from 'lucide-react';
import type { LatencySourceKey } from '../../data/channelLatency';
import {
  formatAsOf,
  groupFreshness,
  useSourceFreshness,
  worstOf,
  type FreshnessStatus,
  type SourceFreshness
} from '../../utils/freshness';

// Every status carries an icon and a word, so colour is never the only signal.
const STYLE: Record<Exclude<FreshnessStatus, 'static'>, { box: string; icon: React.ReactNode; word: string }> = {
  fresh: {
    box: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    icon: <CheckCircle2 className="w-3 h-3 shrink-0" aria-hidden />,
    word: 'Fresh'
  },
  'expected-lag': {
    box: 'bg-sky-50 text-sky-800 border-sky-200',
    icon: <Info className="w-3 h-3 shrink-0" aria-hidden />,
    word: 'Note'
  },
  stale: {
    box: 'bg-rose-50 text-rose-800 border-rose-300',
    icon: <AlertTriangle className="w-3 h-3 shrink-0" aria-hidden />,
    word: 'Stale'
  },
  unknown: {
    box: 'bg-amber-50 text-amber-800 border-amber-200',
    icon: <HelpCircle className="w-3 h-3 shrink-0" aria-hidden />,
    word: 'No date'
  }
};

const updatedText = (item: SourceFreshness) =>
  item.asOf ? `Updated ${formatAsOf(item.asOf, item.rule?.grain)}` : 'Update date not recorded';

/** One small status chip for a single source or a group of sources that share a time. */
export const FreshnessPill: React.FC<{ item: SourceFreshness; labels?: string[]; showLabels?: boolean }> = ({
  item,
  labels,
  showLabels = true
}) => {
  if (item.status === 'static') return null;
  const s = STYLE[item.status];
  const names = labels ?? [item.label];
  return (
    <span
      className={`inline-flex flex-wrap items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border ${s.box}`}
      title={`${names.join(' / ')}: ${updatedText(item)}. ${item.message}`}
    >
      {s.icon}
      {showLabels && <span className="font-semibold">{names.join(' / ')}:</span>}
      <span className="font-mono">{updatedText(item)}</span>
      {item.status !== 'unknown' && (
        <>
          <span aria-hidden>·</span>
          <span className="font-semibold">{item.status === 'fresh' ? s.word : item.short}</span>
        </>
      )}
    </span>
  );
};

/** Section badge: one pill per distinct update time. */
export const FreshnessBadges: React.FC<{ sources: LatencySourceKey[] }> = ({ sources }) => {
  const items = useSourceFreshness(sources);
  const groups = groupFreshness(items);
  if (groups.length === 0) return null;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {groups.map((g, i) => (
        <FreshnessPill key={i} item={g.item} labels={g.labels} />
      ))}
    </span>
  );
};

/**
 * Line at the foot of a card. A card is only as current as its oldest input, so it shows the
 * worst source and lists every source in the tooltip.
 */
export const FreshnessLine: React.FC<{ sources: LatencySourceKey[]; className?: string }> = ({ sources, className = '' }) => {
  const items = useSourceFreshness(sources);
  const worst = worstOf(items);
  if (!worst) return null;
  const s = STYLE[worst.status as Exclude<FreshnessStatus, 'static'>];
  const detail = items
    .filter(i => i.status !== 'static')
    .map(i => `${i.label}: ${updatedText(i)}. ${i.message}`)
    .join('\n');
  const statusText = worst.status === 'fresh' ? s.word : worst.status === 'unknown' ? 'No update date' : worst.short;
  return (
    <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] ${className}`} title={detail}>
      <span className={`inline-flex items-start gap-1 px-1.5 py-0.5 rounded border font-semibold leading-snug ${s.box}`}>
        <span className="mt-px">{s.icon}</span>
        {statusText}
      </span>
      {worst.asOf && <span className="font-mono text-slate-500 whitespace-nowrap">{updatedText(worst)}</span>}
    </div>
  );
};
