import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { useDashboard } from '../../context/DashboardContext';
import { defaultCardSources, type LatencySourceKey } from '../../data/channelLatency';
import { FreshnessLine } from './FreshnessChip';

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
  className = ''
}) => {
  const { currentView, channel } = useDashboard();
  const freshnessSources = sources === false ? [] : sources ?? defaultCardSources(currentView, channel);

  return (
    <div className={`bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden ${className}`}>
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
        <div className="text-2xl font-bold tracking-tight text-slate-900 font-sans">
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

      {freshnessSources.length > 0 && <FreshnessLine sources={freshnessSources} className="mt-2.5" />}
    </div>
  );
};
