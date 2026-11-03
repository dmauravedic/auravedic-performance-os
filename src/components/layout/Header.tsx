import React from 'react';
import { useDashboard } from '../../context/DashboardContext';
import { formatINR, formatPercent } from '../../utils/formatters';
import { UploadCloud, Target } from 'lucide-react';
import { getFilteredMetrics } from '../../utils/calculations';

export const Header: React.FC = () => {
  const {
    data,
    period,
    channel,
    monthlyRevenueTarget,
    setCurrentView,
    defaultCOGS,
    marketplaceCOGSPct,
    flatShipping
  } = useDashboard();

  // Dynamic metrics based on active filter
  const metrics = getFilteredMetrics(period, channel, defaultCOGS, flatShipping, data.monthlyPerformance, marketplaceCOGSPct);
  const targetPercent = (metrics.sales / monthlyRevenueTarget) * 100;

  // Context-aware label when filters are applied
  const isFiltered = channel !== 'all' || period !== 'mtd';
  const channelName = channel === 'all' ? '' : channel.charAt(0).toUpperCase() + channel.slice(1);
  const revenueLabel = isFiltered
    ? (channelName ? `${channelName} Contribution to MTD Revenue` : 'Contribution to MTD Revenue')
    : 'MTD Revenue';

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs">
      <div className="px-4 md:px-6 py-2.5 flex items-center justify-between gap-4">
        {/* Left: Brand Logo & Title */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-600 via-amber-700 to-orange-800 flex items-center justify-center text-white shadow-xs font-serif font-bold text-lg tracking-wider">
            A
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-serif font-bold tracking-wider text-slate-900 text-base">AURAVEDIC</span>
              <span className="bg-amber-100 text-amber-900 font-semibold text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border border-amber-200">
                Performance OS
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-sans hidden sm:block">
              Cross-Channel Commerce & Multi-Platform P&L
            </p>
          </div>
        </div>

        {/* Right: Target Pacing & Quick Actions */}
        <div className="flex items-center gap-3">
          {/* Target Pacing Pill (Compact & Responsive) */}
          <div className="hidden md:flex items-center gap-2.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
            <Target className="w-4 h-4 text-amber-600 shrink-0" />
            <div>
              <div className="text-[11px] text-slate-600 flex items-center gap-1 font-medium">
                <span>{revenueLabel}:</span>
                <strong className="text-slate-900 font-mono">{formatINR(metrics.sales, true)}</strong>
                <span className="text-slate-400">/</span>
                <span className="text-slate-600 font-mono">{formatINR(monthlyRevenueTarget, true)}</span>
                <span className={`font-semibold text-[10px] px-1.5 py-0.2 rounded ${targetPercent >= 80 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                  {formatPercent(targetPercent)}
                </span>
              </div>
              <div className="w-32 bg-slate-200 h-1.5 rounded-full overflow-hidden mt-1">
                <div 
                  className={`h-full rounded-full transition-all duration-300 ${targetPercent >= 80 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                  style={{ width: `${Math.min(targetPercent, 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Quick Action: Ingest Report */}
          <button
            onClick={() => setCurrentView('data-health')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 rounded-xl text-xs font-semibold transition-colors shrink-0"
            title="Import daily reports or inspect data health"
          >
            <UploadCloud className="w-3.5 h-3.5 text-amber-700" />
            <span>Ingest Reports</span>
          </button>
        </div>
      </div>
    </header>
  );
};
