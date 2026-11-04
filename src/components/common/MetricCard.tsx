import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { useDashboard } from '../../context/DashboardContext';
import { defaultCardSources, type LatencySourceKey } from '../../data/channelLatency';
import { useSourceFreshness, worstOf } from '../../utils/freshness';
import { CardSource } from './CardSource';
import { FreshnessLine } from './FreshnessChip';
import type { Gap } from '../../utils/coverage';

interface MetricCardProps {
  title: string;
  value: string;
  priorValue?: string;
  deltaText?: string;
  deltaPositive?: boolean;
  deltaNeutral?: boolean;
  subtitle?: string;
  badgeText?: string;
  badgeVariant?: 'primary' | 'success' | 'warning' | 'danger' | 'neutral' | 'saffron';
  icon?: React.ReactNode;
  footnote?: string;
  /** Sources behind the figure, for the last-updated line. Defaults to the page's and channel's; false hides it. */
  sources?: LatencySourceKey[] | false;
  /** Days the figure leaves out because a source has not reported them. With no day left the value
   *  reads "Not reported yet"; with some, the value stands for the reported days and the % change and
   *  prior value are hidden (a part-period against a full one would mislead). */
  gap?: Gap | null;
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  priorValue,
  deltaText,
  deltaPositive = true,
  deltaNeutral = false,
  subtitle,
  badgeText,
  badgeVariant = 'neutral',
  icon,
  footnote,
  sources,
  gap,
  className = ''
}) => {
  if (gap) {
    if (gap.whole) {
      // Nothing to count: the lines that break the value down would only show zeros
      value = 'Not reported yet';
      subtitle = undefined;
      footnote = undefined;
    }
    deltaText = undefined;
    priorValue = undefined;
  }
  const { currentView, channel } = useDashboard();
  const freshnessSources = sources === false ? [] : sources ?? defaultCardSources(currentView, channel);
  const freshness = useSourceFreshness(freshnessSources);
  const isStale = worstOf(freshness)?.status === 'stale';

  return (
    <div
      className={`bg-white rounded-xl border p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden ${
        isStale ? 'border-rose-300 ring-1 ring-rose-200' : 'border-slate-200'
      } ${className}`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</span>
        <div className="flex items-center gap-1.5">
          {badgeText && (
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
              badgeVariant === 'warning' ? 'bg-amber-50 text-amber-700 border-amber-200' :
              badgeVariant === 'danger' ? 'bg-rose-50 text-rose-700 border-rose-200' :
              badgeVariant === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
              badgeVariant === 'saffron' ? 'bg-orange-50 text-orange-700 border-orange-200' :
              'bg-slate-100 text-slate-600 border-slate-200'
            }`}>
              {badgeText}
            </span>
          )}
          {icon && <div className="text-slate-400">{icon}</div>}
        </div>
      </div>

      <div className="flex items-baseline justify-between gap-3 mt-1">
        <div className={`font-bold tracking-tight font-sans ${gap?.whole ? 'text-lg text-slate-400' : 'text-2xl text-slate-900'}`}>
          {value}
        </div>

        {deltaText && (
          <div className={`flex items-center text-xs font-medium px-2 py-0.5 rounded-md ${
            deltaNeutral ? 'text-slate-500 bg-slate-50' :
            deltaPositive ? 'text-emerald-700 bg-emerald-50' :
            'text-rose-700 bg-rose-50'
          }`}>
            {deltaNeutral ? (
              <Minus className="w-3 h-3 mr-0.5" />
            ) : deltaPositive ? (
              <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
            ) : (
              <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
            )}
            <span>{deltaText}</span>
          </div>
        )}
      </div>

      {gap && (
        <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1 mt-1.5">
          {gap.whole
            ? 'No day in this period has every figure yet'
            : `Reported days only (${gap.countedDays} of ${gap.totalDays}). No change vs prior shown.`}
        </div>
      )}

      {priorValue && (
        <div className="text-xs text-slate-500 mt-1">
          vs prior period: <span className="font-medium text-slate-700">{priorValue}</span>
        </div>
      )}

      {subtitle && (
        <div className="text-xs text-slate-500 mt-1.5 line-clamp-1">
          {subtitle}
        </div>
      )}

      {footnote && (
        <div className="mt-2.5 pt-2 border-t border-slate-100 text-[11px] text-slate-400 italic">
          {footnote}
        </div>
      )}

      {freshnessSources.length > 0 && <CardSource sources={freshnessSources} className="mt-2.5" />}
      {freshness.length > 0 && <FreshnessLine items={freshness} className="mt-2" />}
    </div>
  );
};
