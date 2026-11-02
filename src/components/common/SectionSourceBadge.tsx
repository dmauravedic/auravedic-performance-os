import React from 'react';
import { Database, Clock, Hand, Zap } from 'lucide-react';
import type { ChannelFilter } from '../../context/DashboardContext';
import {
  resolveLatency,
  resolveSourceKeys,
  ROUTE_WORD,
  SOURCE_ORIGIN,
  type LatencySourceKey,
  type SourceRoute
} from '../../data/channelLatency';
import { FreshnessBadges } from './FreshnessChip';

interface SectionSourceBadgeProps {
  source: string;
  pipeline?: string;
  syncCadence?: string;
  /** Explicit latency text; overrides everything else. */
  latency?: string;
  /** Active channel of the section. When set, latency follows that channel instead of the source text. */
  channel?: ChannelFilter;
  /** Hide the latency chip (e.g. when the section shows latency per row instead). */
  showLatency?: boolean;
  /** Sources whose last-updated time is shown. Defaults to the channel's, or those the source text names. */
  sources?: LatencySourceKey[];
  className?: string;
}

export const SectionSourceBadge: React.FC<SectionSourceBadgeProps> = ({
  source,
  pipeline,
  syncCadence,
  latency,
  channel,
  showLatency = true,
  sources,
  className = ''
}) => {
  const latencyGroups = !showLatency
    ? []
    : latency
      ? [{ labels: [] as string[], latency }]
      : resolveLatency({ channel, text: `${source} ${pipeline || ''}` });
  const freshnessKeys = sources ?? (showLatency ? resolveSourceKeys({ channel, text: `${source} ${pipeline || ''}` }) : []);

  // How the sources behind this section arrive, in a word: by themselves, posted by people, or both.
  const routes = new Set(freshnessKeys.map(k => SOURCE_ORIGIN[k].route));
  const routeKind: SourceRoute | null =
    routes.size === 0
      ? null
      : routes.has('automated') && routes.has('manual')
        ? 'mixed'
        : routes.has('automated')
          ? 'automated'
          : routes.has('manual')
            ? 'manual'
            : 'static';

  return (
    <div className={`inline-flex flex-wrap items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200/90 text-[11px] text-slate-600 font-sans shadow-2xs ${className}`}>
      <span className="flex items-center gap-1 font-semibold text-slate-700">
        <Database className="w-3 h-3 text-amber-600 shrink-0" />
        Data from:
      </span>
      <span className="text-slate-800 font-medium">{source}</span>
      {pipeline && (
        <>
          <span className="text-slate-300">•</span>
          <span className="text-slate-500 font-mono text-[10px]">{pipeline}</span>
        </>
      )}
      {syncCadence && (
        <>
          <span className="text-slate-300">•</span>
          <span className="text-emerald-700 font-medium text-[10px] bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60">
            {syncCadence}
          </span>
        </>
      )}
      {routeKind && routeKind !== 'static' && (
        <>
          <span className="text-slate-300">•</span>
          <span
            title={freshnessKeys.map(k => `${SOURCE_ORIGIN[k].from}: ${ROUTE_WORD[SOURCE_ORIGIN[k].route].toLowerCase()}`).join('\n')}
            className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border whitespace-nowrap ${
              routeKind === 'automated'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : routeKind === 'manual'
                  ? 'bg-amber-50 text-amber-900 border-amber-200'
                  : 'bg-sky-50 text-sky-800 border-sky-200'
            }`}
          >
            {routeKind === 'manual' ? <Hand className="w-3 h-3" aria-hidden /> : <Zap className="w-3 h-3" aria-hidden />}
            {ROUTE_WORD[routeKind]}
          </span>
        </>
      )}
      {latencyGroups.length > 0 && (
        <>
          <span className="text-slate-300">•</span>
          <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-slate-600 font-medium text-[10px] bg-slate-100/90 px-1.5 py-0.5 rounded border border-slate-200">
            <Clock className="w-2.5 h-2.5 text-slate-500 shrink-0" />
            <span>Latency:</span>
            {latencyGroups.map((g, i) => (
              <span key={i} className="inline-flex items-center gap-1">
                {g.labels.length > 0 && <span className="text-slate-500">{g.labels.join(' / ')}</span>}
                <strong className="text-slate-700 font-mono">{g.latency}</strong>
                {i < latencyGroups.length - 1 && <span className="text-slate-300">·</span>}
              </span>
            ))}
          </span>
        </>
      )}
      {freshnessKeys.length > 0 && (
        <>
          <span className="text-slate-300">•</span>
          <FreshnessBadges sources={freshnessKeys} />
        </>
      )}
    </div>
  );
};
