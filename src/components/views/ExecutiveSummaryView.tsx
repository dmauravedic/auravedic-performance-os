import React from 'react';
import { useDashboard } from '../../context/DashboardContext';
import { MetricCard } from '../common/MetricCard';

import { ViewFilterBar } from '../common/ViewFilterBar';
import { SectionSourceBadge } from '../common/SectionSourceBadge';
import { formatINR, formatPercent, formatROAS, formatNumber } from '../../utils/formatters';
import { getFilteredMetrics } from '../../utils/calculations';
import { GapNotice } from '../common/GapNotice';
import { defaultCardSources, resolveLatency } from '../../data/channelLatency';
import { StatTile } from '../common/StatTile';
import { FeedBadge } from '../common/FeedBadge';
import type { ChannelFilter } from '../../context/DashboardContext';
import {
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  ArrowRight,
  ShieldAlert,
  Calendar,
  Layers,
  Sparkles,
  ShoppingBag,
  Store,
  DollarSign,
  Filter,
  X
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid
} from 'recharts';

// Compact rupee tick for the chart's left axis: ₹50k, ₹1.5L
const formatAxisINR = (v: number) =>
  v >= 100000 ? `₹${(v / 100000).toFixed(1).replace(/\.0$/, '')}L` : v >= 1000 ? `₹${Math.round(v / 1000)}k` : `₹${v}`;

// Scorecard row name -> channel filter key
const SCORECARD_CHANNEL: Record<string, ChannelFilter> = {
  'Shopify D2C': 'shopify',
  'Amazon.in': 'amazon',
  Flipkart: 'flipkart',
  Nykaa: 'nykaa',
  Myntra: 'myntra'
};

export const ExecutiveSummaryView: React.FC = () => {
  const {
    data,
    period,
    setPeriod,
    channel,
    setChannel,
    setCurrentView,
    defaultCOGS,
    marketplaceCOGSPct,
    flatShipping,
  } = useDashboard();

  const { monthlyPerformance, marketplaceSummary } = data;

  const metrics = getFilteredMetrics(period, channel, defaultCOGS, flatShipping, monthlyPerformance, marketplaceCOGSPct);

  const {
    periodLabel,
    priorLabel,
    channelLabel,
    sales,
    priorSales,
    adSpend,
    priorAdSpend,
    mer,
    priorMer,
    orders,
    priorOrders,
    aov,
    priorAov,
    netProfit,
    priorNetProfit,
    marginPercent,
    shopifyOrders,
    shopifyAdSpend,
    shopifyMer,
    amazonSales,
    amazonAdSpend,
    amazonMer,
    chartData,
    gap,
    deltaSales,
    deltaAdSpend,
    deltaMer,
    deltaNetProfit,
    deltaOrders
  } = metrics;

  return (
    <div className="space-y-6">
      {/* Golden Rules Coverage Banner */}

      {/* Command Centre Responsive Filter Bar */}
      <ViewFilterBar
        showChannels={true}
        activeChannel={channel}
        onChannelChange={setChannel}
        showPeriods={true}
        activePeriod={period}
        onPeriodChange={setPeriod}
        title="Executive Performance Command Center"
        subtitle={`Viewing ${channelLabel} metrics for ${periodLabel}`}
        extraRight={
          (channel !== 'all' || period !== 'mtd') ? (
            <button
              onClick={() => { setChannel('all'); setPeriod('mtd'); }}
              className="text-[11px] font-semibold text-amber-800 hover:text-amber-950 underline underline-offset-2 flex items-center gap-1 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200"
            >
              <X className="w-3 h-3" /> Reset to All / MTD
            </button>
          ) : undefined
        }
      />

      <GapNotice gap={gap} />

      {/* Top Headline KPI Grid (Section) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Core Financial & Marketing KPIs
          </span>
          <SectionSourceBadge 
            source="Shopify store + Amazon Seller Central + Windsor (Meta and Google ads)"
            channel={channel}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title={channel === 'all' ? 'Total Gross Sales' : `${channelLabel} Sales`}
            value={formatINR(sales)}
            priorValue={formatINR(priorSales)}
            deltaText={`${deltaSales >= 0 ? '+' : ''}${deltaSales.toFixed(1)}% vs ${priorLabel}`}
            deltaPositive={deltaSales >= 0}
            subtitle={`Pre-returns for ${periodLabel}`}
            badgeText={period.toUpperCase()}
            badgeVariant="saffron"
            gap={gap}
          />

          <MetricCard
            title="Attributed Ad Spend"
            value={formatINR(adSpend)}
            priorValue={formatINR(priorAdSpend)}
            deltaText={`${deltaAdSpend >= 0 ? '+' : ''}${deltaAdSpend.toFixed(1)}% vs ${priorLabel}`}
            deltaPositive={deltaAdSpend <= 0}
            subtitle={
              channel === 'shopify' ? 'Meta (5 accounts) + Google' :
              channel === 'amazon' ? 'Amazon Ads spend' :
              channel === 'flipkart' ? 'Flipkart Ads' :
              channel === 'nykaa' ? 'Nykaa Ads + Meta Spend' :
              channel === 'myntra' ? 'Myntra Ads' :
              `Shopify ${formatINR(shopifyAdSpend, true)} + Amazon ${formatINR(amazonAdSpend, true)}`
            }
            footnote={channel === 'all' ? 'Shopify = Meta + Google · Amazon = Amazon Ads spend (settlement or estimate where the daily export is not loaded)' : undefined}
            badgeText="Active Ads"
            badgeVariant="neutral"
            gap={gap}
          />

          <MetricCard
            title={channel === 'all' ? 'Blended MER (Sales / ₹1 Ad)' : 'Channel ROAS / MER'}
            value={formatROAS(mer)}
            priorValue={formatROAS(priorMer)}
            deltaText={`${deltaMer >= 0 ? '+' : ''}${deltaMer.toFixed(1)}% efficiency`}
            deltaPositive={deltaMer >= 0}
            subtitle={
              channel === 'all'
                ? `Shopify ${formatROAS(shopifyMer)} · Amazon ${formatROAS(amazonMer)}`
                : `Sales ÷ Ad Spend (${periodLabel})`
            }
            footnote={channel === 'all' ? `Total sales ÷ total ad spend (${periodLabel})` : undefined}
            badgeText="Efficiency"
            badgeVariant="success"
            gap={gap}
          />

          <MetricCard
            title="Realistic Net Contribution"
            value={formatINR(netProfit)}
            priorValue={formatINR(priorNetProfit)}
            deltaText={`${deltaNetProfit >= 0 ? '+' : ''}${deltaNetProfit.toFixed(1)}% vs prior`}
            deltaPositive={deltaNetProfit >= 0}
            subtitle={`Net margin: ${formatPercent(marginPercent)} of revenue`}
            badgeText="P&L Realistic"
            badgeVariant={netProfit >= 0 ? 'success' : 'danger'}
            gap={gap}
          />
        </div>
      </div>

      {/* Secondary KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatTile
          title={`Total Orders (${periodLabel})`}
          value={gap?.whole ? 'Not reported yet' : formatNumber(orders)}
          note={
            gap ? (
              <span className="text-amber-700">Reported days only</span>
            ) : (
              <span className="text-slate-500">
                vs prior: {formatNumber(priorOrders)} ({deltaOrders >= 0 ? '+' : ''}{deltaOrders.toFixed(1)}%)
              </span>
            )
          }
          sources={defaultCardSources('executive', channel)}
        />

        <StatTile
          title="Average Order Value (AOV)"
          value={gap?.whole ? 'Not reported yet' : formatINR(aov)}
          note={gap ? <span className="text-amber-700">Reported days only</span> : <span className="text-slate-500">vs prior: {formatINR(priorAov)}</span>}
          sources={defaultCardSources('executive', channel)}
        />

        {(channel === 'shopify' || channel === 'all') && (
          <StatTile
            title="Customer CAC (Shopify)"
            value={`₹${shopifyOrders > 0 ? Math.round(shopifyAdSpend / shopifyOrders).toLocaleString('en-IN') : '0'}`}
            note={<span className="text-emerald-600">Payback period: ~38 days</span>}
            sources={['shopify', 'meta', 'google']}
          />
        )}

        {(channel === 'amazon' || channel === 'all') && (
          <StatTile
            title="Amazon TACOS (Est)"
            value={`${amazonSales > 0 ? (amazonAdSpend / amazonSales * 100).toFixed(1) : '0.0'}%`}
            valueClassName="text-amber-700"
            note={<span className="text-slate-500">Amazon Ads spend ÷ Amazon sales</span>}
            sources={['amazonSales', 'amazonAds']}
          />
        )}
      </div>

      {/* Main Dynamic Chart (Section) */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-slate-900 text-sm">
              Daily Trend: {channelLabel} — {periodLabel}
            </h3>
            <p className="text-xs text-slate-500">
              {period === 'yesterday' 
                ? 'Yesterday 24h performance against prior 7-day average.'
                : `Daily revenue and marketing ad spend across ${chartData.length} tracked days.`}
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-600"></span> Sales
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 font-medium border border-blue-200">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span> Ad Spend
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 font-medium border border-emerald-200">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> MER (Efficiency)
            </span>
          </div>
        </div>

        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748B' }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={formatAxisINR} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#64748B' }} domain={[0, 'auto']} tickFormatter={(v) => `${v}x`} />
              <Tooltip
                formatter={(val: any, name: string) => {
                  if (val === null || val === undefined) return ['Not reported yet', name];
                  if (name.startsWith('MER')) return [`${Number(val).toFixed(2)}x`, 'Sales per ₹1 Ad'];
                  return [`₹${Number(val).toLocaleString('en-IN')}`, name];
                }}
                contentStyle={{ backgroundColor: '#0F172A', borderRadius: '8px', border: 'none', color: '#F8FAFC', fontSize: '12px' }}
              />
              <Legend />
              {channel === 'all' ? (
                <>
                  <Bar yAxisId="left" dataKey="ShopifySales" stackId="sales" fill="#D97706" name="Shopify Sales" />
                  <Bar yAxisId="left" dataKey="AmazonSales" stackId="sales" fill="#FBBF24" name="Amazon Sales" />
                  <Bar yAxisId="left" dataKey="ShopifyAdSpend" stackId="ads" fill="#2563EB" name="Shopify Ad Spend (Meta + Google)" />
                  <Bar yAxisId="left" dataKey="AmazonAdSpend" stackId="ads" fill="#93C5FD" name="Amazon Ad Spend" />
                </>
              ) : (
                <>
                  <Bar yAxisId="left" dataKey="Sales" fill="#D97706" name={`${channelLabel} Sales`} radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="left" dataKey="AdSpend" fill="#3B82F6" name="Ad Spend" radius={[4, 4, 0, 0]} />
                </>
              )}
              <Line yAxisId="right" type="monotone" dataKey="MER" stroke="#10B981" strokeWidth={2.5} dot={{ r: 3 }} name="MER (Sales/₹1 Ad)" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
          <SectionSourceBadge 
            source="Daily Time-Series (Shopify Gross-Discounts, Amazon Ordered Sales, Windsor Meta 5-Accounts & Google Ads)" 
            pipeline="Daily series, calibrated to the handbook totals"
            channel={channel}
          />
        </div>
      </div>

      {/* Multi-Channel Scorecard Summary (Section) */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-slate-900 text-sm">Channel Scorecard & Contribution Matrix</h3>
            <p className="text-xs text-slate-500">Cross-channel comparison across stores and active marketplaces.</p>
          </div>
          <SectionSourceBadge 
            source="Shopify Analytics + Amazon SP-API + Slack #flipkart-reports + Master Catalog Mappings"
            showLatency={false}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-y border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Channel</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3 text-right">Revenue ({periodLabel})</th>
                <th className="py-2.5 px-3 text-right">Channel Share</th>
                <th className="py-2.5 px-3 text-right">Orders</th>
                <th className="py-2.5 px-3 text-right">AOV</th>
                <th className="py-2.5 px-3 text-right">Return Rate</th>
                <th className="py-2.5 px-3">Data Latency</th>
                <th className="py-2.5 px-3">Quick Filter</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {marketplaceSummary.map((m, idx) => {
                const isSelected = (m.channel === 'Shopify D2C' && channel === 'shopify') ||
                                   (m.channel === 'Amazon.in' && channel === 'amazon') ||
                                   (m.channel === 'Flipkart' && channel === 'flipkart') ||
                                   (m.channel === 'Nykaa' && channel === 'nykaa') ||
                                   (m.channel === 'Myntra' && channel === 'myntra');

                return (
                  <tr key={idx} className={`hover:bg-slate-50 transition-colors ${isSelected ? 'bg-amber-50/80' : ''}`}>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-900 flex items-center gap-2">
                        {m.type === 'Store' ? <ShoppingBag className="w-4 h-4 text-amber-600" /> : <Store className="w-4 h-4 text-blue-600" />}
                        {m.channel}
                      </div>
                      {SCORECARD_CHANNEL[m.channel] && (
                        <div className="mt-1">
                          <FeedBadge channel={SCORECARD_CHANNEL[m.channel]} />
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                        {m.type}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                      {formatINR(m.monthlyRevenue, true)}
                      {m.periodLabel && <div className="text-[10px] font-normal text-slate-400">{m.periodLabel}</div>}
                    </td>
                    <td className="py-2.5 px-3 text-right">{formatPercent(m.sharePercent)}</td>
                    <td className="py-2.5 px-3 text-right">{formatNumber(m.orders)}</td>
                    <td className="py-2.5 px-3 text-right font-mono">{formatINR(m.aov)}</td>
                    <td className="py-2.5 px-3 text-right">
                      <span className={`px-1.5 py-0.5 rounded font-semibold text-[11px] ${
                        m.returnRate > 10 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
                      }`}>
                        {formatPercent(m.returnRate)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-[11px] text-slate-600 font-normal">
                      {(() => {
                        const key = SCORECARD_CHANNEL[m.channel];
                        const groups = key ? resolveLatency({ channel: key }) : [];
                        if (groups.length === 0) return <span className="text-slate-400">—</span>;
                        return groups.map((g, i) => (
                          <div key={i} className="whitespace-nowrap">
                            {groups.length > 1 && <span className="text-slate-400">{g.labels.join(' / ')}: </span>}
                            {g.latency}
                          </div>
                        ));
                      })()}
                    </td>
                    <td className="py-2.5 px-3">
                      <button
                        onClick={() => {
                          if (m.channel === 'Shopify D2C') setChannel('shopify');
                          else if (m.channel === 'Amazon.in') setChannel('amazon');
                          else if (m.channel === 'Flipkart') setChannel('flipkart');
                          else if (m.channel === 'Nykaa') setChannel('nykaa');
                          else if (m.channel === 'Myntra') setChannel('myntra');
                        }}
                        className={`text-[10px] px-2 py-0.5 rounded font-semibold transition-colors border ${
                          isSelected
                            ? 'bg-amber-600 text-white border-amber-600'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                        }`}
                      >
                        {isSelected ? 'Filtered ✓' : 'Filter View'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
