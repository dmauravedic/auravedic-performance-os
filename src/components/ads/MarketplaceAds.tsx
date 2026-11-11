import React, { useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import type { MarketplaceAdsItem } from '../../data/initialData';
import type { ChannelFilter } from '../../context/DashboardContext';
import { formatINR } from '../../utils/formatters';
import { FeedBadge } from '../common/FeedBadge';
import { ChartCard, ChartTooltip } from './ChartCard';
import { CHROME, PLATFORM_COLOR, compactINR } from './adTheme';

const ORDER = ['Amazon.in', 'Flipkart', 'Nykaa', 'Myntra', 'Purplle', 'Snapdeal'];
const FEED_KEY: Record<string, ChannelFilter> = { 'Amazon.in': 'amazon', Flipkart: 'flipkart', Nykaa: 'nykaa', Myntra: 'myntra' };
// Each chart shows one marketplace, so a colour only has to identify it, not separate it from others
const CHANNEL_COLOR: Record<string, string> = { 'Amazon.in': PLATFORM_COLOR.amazon, Flipkart: PLATFORM_COLOR.flipkart };
const NEUTRAL = '#475569';
const axisTick = { fontSize: 11, fill: CHROME.muted };

const monthIndex = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return y * 12 + m;
};
const shortMonth = (month: string) => `${month.slice(0, 3)} ${month.slice(-2)}`;
const dash = <span className="text-slate-300">—</span>;

/**
 * Each marketplace's own monthly ad report: spend, what the ads sold, ROAS, and TACOS against the
 * channel's total revenue. Entered by hand in Shan's report sheet, so a marketplace that stops
 * reporting is flagged rather than shown as if it were current.
 */
export const MarketplaceAds: React.FC<{ ads: MarketplaceAdsItem[] }> = ({ ads }) => {
  const channels = ORDER.filter(c => ads.some(a => a.channel === c));
  const [selected, setSelected] = useState<string>(channels[0] ?? '');

  if (ads.length === 0) {
    return <p className="text-xs text-slate-500">No marketplace ad reports are loaded. They come from Shan's report sheet.</p>;
  }

  const rowsOf = (channel: string) => ads.filter(a => a.channel === channel).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  const latest = channels.map(c => {
    const rows = rowsOf(c);
    return rows[rows.length - 1];
  });
  const newest = Math.max(...latest.map(r => monthIndex(r.monthKey)));

  const series = rowsOf(selected);
  const color = CHANNEL_COLOR[selected] ?? NEUTRAL;
  const data = series.map(r => ({
    month: shortMonth(r.month),
    Spend: r.adSpend,
    ROAS: r.adRoas ?? null
  }));

  return (
    <div className="space-y-5">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-y border-slate-200">
            <tr>
              <th className="py-2.5 px-3">Marketplace</th>
              <th className="py-2.5 px-3">Latest month</th>
              <th className="py-2.5 px-3 text-right">Ad spend</th>
              <th className="py-2.5 px-3 text-right">Ad revenue</th>
              <th className="py-2.5 px-3 text-right">ROAS</th>
              <th className="py-2.5 px-3 text-right">Ad orders</th>
              <th className="py-2.5 px-3 text-right">Channel revenue</th>
              <th className="py-2.5 px-3 text-right">TACOS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
            {latest.map(r => {
              const behind = newest - monthIndex(r.monthKey);
              return (
                <tr key={r.channel} className="hover:bg-slate-50 transition-colors align-top">
                  <td className="py-2.5 px-3">
                    <div className="font-semibold text-slate-900">{r.channel}</div>
                    {FEED_KEY[r.channel] && (
                      <div className="mt-1">
                        <FeedBadge channel={FEED_KEY[r.channel]} />
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    {r.month}
                    {r.through && (
                      <div className="mt-1 text-[10px] font-semibold text-slate-500">
                        Month to date, to {Number(r.through.slice(8))} {r.month.slice(0, 3)}
                      </div>
                    )}
                    {behind >= 3 && (
                      <div className="mt-1 inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full border bg-slate-100 text-slate-600 border-slate-300">
                        No report for {behind} months
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-slate-900 font-mono">{formatINR(r.adSpend, true)}</td>
                  <td className="py-2.5 px-3 text-right font-mono">{r.adRevenue != null ? formatINR(r.adRevenue, true) : dash}</td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{r.adRoas != null ? `${r.adRoas.toFixed(2)}x` : dash}</td>
                  <td className="py-2.5 px-3 text-right font-mono">{r.adOrders != null ? r.adOrders.toLocaleString('en-IN') : dash}</td>
                  <td className="py-2.5 px-3 text-right font-mono">{r.totalRevenue != null ? formatINR(r.totalRevenue, true) : dash}</td>
                  <td className="py-2.5 px-3 text-right font-mono">{r.tacos != null ? `${r.tacos.toFixed(1)}%` : dash}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="text-[11px] text-slate-400 mt-1.5">
          Amazon.in's recent months are added up from the daily Amazon Ads feed (Windsor); older months and the other marketplaces come from Shan's sheet.
          TACOS is ad spend divided by the channel's total revenue for the month. Nykaa's own sheet adds Meta spend to its TACOS; this uses the platform's ads only.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Trend for</span>
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80 overflow-x-auto max-w-full">
          {channels.map(c => (
            <button
              key={c}
              type="button"
              aria-pressed={c === selected}
              onClick={() => setSelected(c)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                c === selected ? 'bg-amber-600 text-white shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <ChartCard
          title={`${selected}: ad spend by month`}
          subtitle={`Last ${series.length} reported months, from the marketplace's own ad report.`}
          table={{
            columns: ['Month', 'Ad spend', 'Ad revenue', 'ROAS', 'Ad orders', 'Channel revenue', 'TACOS'],
            rows: series.map(r => [
              r.through ? `${r.month} (to ${Number(r.through.slice(8))} ${r.month.slice(0, 3)})` : r.month,
              formatINR(r.adSpend),
              r.adRevenue != null ? formatINR(r.adRevenue) : '—',
              r.adRoas != null ? `${r.adRoas.toFixed(2)}x` : '—',
              r.adOrders != null ? r.adOrders.toLocaleString('en-IN') : '—',
              r.totalRevenue != null ? formatINR(r.totalRevenue) : '—',
              r.tacos != null ? `${r.tacos.toFixed(1)}%` : '—'
            ])
          }}
        >
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                <CartesianGrid stroke={CHROME.grid} vertical={false} />
                <XAxis dataKey="month" tick={axisTick} tickLine={false} axisLine={{ stroke: CHROME.axis }} interval="preserveStartEnd" />
                <YAxis tick={axisTick} tickLine={false} axisLine={false} tickFormatter={compactINR} />
                <Tooltip cursor={{ fill: 'rgba(11,11,11,0.04)' }} content={<ChartTooltip format={v => formatINR(v)} />} />
                <Bar dataKey="Spend" name="Ad spend" fill={color} maxBarSize={24} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          title={`${selected}: ad ROAS by month`}
          subtitle="Ad revenue divided by ad spend. Months without ad revenue in the sheet are left blank."
          table={{
            columns: ['Month', 'ROAS'],
            rows: series.map(r => [r.month, r.adRoas != null ? `${r.adRoas.toFixed(2)}x` : '—'])
          }}
        >
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
                <CartesianGrid stroke={CHROME.grid} vertical={false} />
                <XAxis dataKey="month" tick={axisTick} tickLine={false} axisLine={{ stroke: CHROME.axis }} interval="preserveStartEnd" />
                <YAxis tick={axisTick} tickLine={false} axisLine={false} domain={[0, 'auto']} tickFormatter={v => `${v}x`} />
                <Tooltip cursor={{ stroke: CHROME.axis }} content={<ChartTooltip format={v => `${Number(v).toFixed(2)}x`} />} />
                <Line
                  type="monotone"
                  dataKey="ROAS"
                  name="Ad ROAS"
                  stroke={color}
                  strokeWidth={2}
                  strokeLinecap="round"
                  dot={series.length <= 12 ? { r: 4, stroke: CHROME.surface, strokeWidth: 2 } : false}
                  activeDot={{ r: 5, stroke: CHROME.surface, strokeWidth: 2 }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>
    </div>
  );
};
