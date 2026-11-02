import React from 'react';
import type { LatencySourceKey } from '../../data/channelLatency';
import { useSourceFreshness, worstOf } from '../../utils/freshness';
import { CardSource } from './CardSource';
import { FreshnessLine } from './FreshnessChip';

interface StatTileProps {
  title: string;
  value: React.ReactNode;
  valueClassName?: string;
  note?: React.ReactNode;
  /** Sources behind the figure: shown as "Data from", and checked for staleness. */
  sources: LatencySourceKey[];
}

/** The small figure tiles. Same source line and stale note as MetricCard, in a lighter frame. */
export const StatTile: React.FC<StatTileProps> = ({ title, value, valueClassName = 'text-slate-900', note, sources }) => {
  const freshness = useSourceFreshness(sources);
  const isStale = worstOf(freshness)?.status === 'stale';
  return (
    <div className={`bg-white p-4 rounded-xl border ${isStale ? 'border-rose-300 ring-1 ring-rose-200' : 'border-slate-200'}`}>
      <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">{title}</div>
      <div className={`text-xl font-bold mt-1 ${valueClassName}`}>{value}</div>
      {note && <div className="text-[11px] mt-0.5">{note}</div>}
      {sources.length > 0 && <CardSource sources={sources} className="mt-2.5" />}
      {freshness.length > 0 && <FreshnessLine items={freshness} className="mt-2" />}
    </div>
  );
};
