import React from 'react';
import { BookOpen, Database, Hand, Zap } from 'lucide-react';
import {
  FEED_NOTE,
  LATENCY_SOURCES,
  ROUTE_WORD,
  SOURCE_ORIGIN,
  type LatencySourceKey,
  type SourceRoute
} from '../../data/channelLatency';

const ICON: Record<SourceRoute, React.ReactNode> = {
  automated: <Zap className="w-3 h-3 shrink-0 text-emerald-600" aria-hidden />,
  mixed: <Zap className="w-3 h-3 shrink-0 text-sky-600" aria-hidden />,
  manual: <Hand className="w-3 h-3 shrink-0 text-amber-600" aria-hidden />,
  static: <BookOpen className="w-3 h-3 shrink-0 text-slate-400" aria-hidden />
};

const ORDER: SourceRoute[] = ['automated', 'manual', 'static'];

/**
 * "Where this number comes from" for a card: the sources, grouped by whether they arrive by
 * themselves or are posted by a person. The word carries the meaning, the icon only backs it up.
 */
export const CardSource: React.FC<{ sources: LatencySourceKey[]; className?: string }> = ({ sources, className = '' }) => {
  if (sources.length === 0) return null;
  const groups = ORDER.map(route => ({
    route,
    names: sources.filter(k => SOURCE_ORIGIN[k].route === route).map(k => SOURCE_ORIGIN[k].from)
  })).filter(g => g.names.length > 0);
  const detail = sources
    .map(k => `${SOURCE_ORIGIN[k].from} (${ROUTE_WORD[SOURCE_ORIGIN[k].route].toLowerCase()}): ${LATENCY_SOURCES[k].latency}`)
    .join('\n');

  return (
    <div className={`text-[10px] leading-snug text-slate-500 ${className}`} title={`${detail}\n\n${FEED_NOTE}`}>
      <div className="flex items-center gap-1 font-semibold text-slate-600">
        <Database className="w-3 h-3 text-amber-600 shrink-0" aria-hidden />
        Data from
      </div>
      {groups.map(g => (
        <div key={g.route} className="flex items-start gap-1 mt-0.5">
          <span className="mt-px">{ICON[g.route]}</span>
          <span>
            <span className="font-semibold text-slate-600">{ROUTE_WORD[g.route]}:</span> {g.names.join(', ')}
          </span>
        </div>
      ))}
    </div>
  );
};
