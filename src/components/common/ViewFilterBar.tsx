import React from 'react';
import { ChannelFilter, TimePeriod } from '../../context/DashboardContext';
import { Filter, Calendar } from 'lucide-react';
import { mtdButtonLabel } from '../../utils/periods';

interface ViewFilterBarProps {
  showChannels?: boolean;
  activeChannel?: ChannelFilter;
  onChannelChange?: (channel: ChannelFilter) => void;
  channelOptions?: { id: ChannelFilter; label: string }[];

  showPeriods?: boolean;
  activePeriod?: TimePeriod;
  onPeriodChange?: (period: TimePeriod) => void;
  periodOptions?: { id: TimePeriod; label: string }[];

  title?: string;
  subtitle?: string;
  extraRight?: React.ReactNode;
  className?: string;
}

const DEFAULT_PERIODS: { id: TimePeriod; label: string }[] = [
  { id: 'yesterday', label: 'Yesterday' },
  { id: '7d', label: 'Last 7D' },
  { id: '14d', label: '14 Days' },
  { id: '30d', label: '30 Days' },
  { id: 'mtd', label: mtdButtonLabel() },
  { id: 'all', label: 'MoM History' },
];

const DEFAULT_CHANNELS: { id: ChannelFilter; label: string }[] = [
  { id: 'all', label: 'All Channels' },
  { id: 'shopify', label: 'Shopify D2C' },
  { id: 'amazon', label: 'Amazon.in' },
  { id: 'flipkart', label: 'Flipkart' },
  { id: 'nykaa', label: 'Nykaa' },
  { id: 'myntra', label: 'Myntra' },
];

export const ViewFilterBar: React.FC<ViewFilterBarProps> = ({
  showChannels = false,
  activeChannel = 'all',
  onChannelChange,
  channelOptions = DEFAULT_CHANNELS,

  showPeriods = true,
  activePeriod = 'mtd',
  onPeriodChange,
  periodOptions = DEFAULT_PERIODS,

  title,
  subtitle,
  extraRight,
  className = ''
}) => {
  return (
    <div className={`bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-2xs space-y-3 ${className}`}>
      {/* Top Title/Context Row (if provided) */}
      {(title || subtitle || extraRight) && (
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2.5 border-b border-slate-100">
          <div>
            {title && <h2 className="font-bold text-slate-900 text-sm flex items-center gap-2 font-sans">{title}</h2>}
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          {extraRight && <div className="flex items-center gap-2">{extraRight}</div>}
        </div>
      )}

      {/* Responsive Filter Controls Row */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        {/* Channel Selector Pills (when enabled) */}
        {showChannels && onChannelChange && (
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider shrink-0 hidden sm:inline-flex items-center gap-1">
              <Filter className="w-3 h-3 text-amber-600" />
              Channel:
            </span>
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80 overflow-x-auto max-w-full scrollbar-none">
              {channelOptions.map((c) => {
                const active = activeChannel === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => onChannelChange(c.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                      active
                        ? 'bg-amber-600 text-white shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Period Selector Pills (when enabled) */}
        {showPeriods && onPeriodChange && (
          <div className="flex items-center gap-1.5 min-w-0 lg:ml-auto">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider shrink-0 hidden sm:inline-flex items-center gap-1">
              <Calendar className="w-3 h-3 text-amber-600" />
              Period:
            </span>
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80 overflow-x-auto max-w-full scrollbar-none">
              {periodOptions.map((p) => {
                const active = activePeriod === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => onPeriodChange(p.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                      active
                        ? 'bg-amber-600 text-white font-bold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
