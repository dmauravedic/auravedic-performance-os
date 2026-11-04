import React, { useState } from 'react';
import { useDashboard, ChannelFilter } from '../../context/DashboardContext';
import { MetricCard } from '../common/MetricCard';
import { ViewFilterBar } from '../common/ViewFilterBar';
import { SectionSourceBadge } from '../common/SectionSourceBadge';
import { formatINR, formatPercent, formatNumber } from '../../utils/formatters';
import { computeRealisticPnL, PnLChannel } from '../../utils/calculations';
import { MARKETPLACE_COGS_PCT } from '../../data/assumptions';
import { resolvePeriod } from '../../utils/periods';
import { CHANNEL_SOURCES, gapFor, reportedDays } from '../../utils/coverage';
import { GapNotice } from '../common/GapNotice';
import {
  TrendingDown,
  TrendingUp,
  Sliders,
  AlertCircle,
  HelpCircle,
  ShieldCheck,
  CheckCircle2,
  DollarSign
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  CartesianGrid
} from 'recharts';

export const ProfitLossView: React.FC = () => {
  const {
    data,
    period,
    setPeriod,
    channel,
    setChannel,
    defaultCOGS,
    setDefaultCOGS,
    marketplaceCOGSPct,
    setMarketplaceCOGSPct,
    flatShipping,
    setFlatShipping,
  } = useDashboard();

  const [overheads, setOverheads] = useState<number>(350000);

  const { current: periodDays, periodLabel } = resolvePeriod(period);

  // The P&L only models Shopify and Amazon; any other channel picked elsewhere shows Combined.
  const pnlChannel: PnLChannel = channel === 'shopify' || channel === 'amazon' ? channel : 'all';
  // Only days where every source this P&L needs is reported; the rest are named on the cards
  const gap = gapFor(periodDays, CHANNEL_SOURCES[pnlChannel]);
  const slice = reportedDays(periodDays, CHANNEL_SOURCES[pnlChannel]);

  let shopifyGross = 0;
  let shopifyDiscounts = 0;
  let shopifyReturns = 0;
  let shopifyOrders = 0;
  let amazonPrincipal = 0;
  let amazonRefunds = 0;
  let amazonPromos = 0;
  let amazonFees = 0;
  let amazonBilledAds = 0;
  let metaGoogleSpend = 0;

  slice.forEach(r => {
    shopifyGross += r.shopifyGross;
    shopifyDiscounts += r.shopifyDiscounts;
    shopifyReturns += r.shopifyReturns;
    shopifyOrders += r.shopifyOrders;
    metaGoogleSpend += (r.metaSpend + r.googleSpend);

    amazonPrincipal += r.amazonSales;
    amazonRefunds += r.amazonRefunds;
    amazonPromos += round2(r.amazonSales * 0.02);
    amazonFees += r.amazonFees;
    amazonBilledAds += r.amazonBilledAds;
  });

  function round2(v: number) { return Math.round(v * 100) / 100; }

  const shopifyUnits = Math.round(shopifyOrders * 1.3);
  const shopifyOrdersOver499 = Math.round(shopifyOrders * 0.84);

  const proratedOverheads = Math.round((overheads / 30) * slice.length);

  const showStore = pnlChannel !== 'amazon';
  const showAmazon = pnlChannel !== 'shopify';

  const pnl = computeRealisticPnL({
    channel: pnlChannel,
    shopifyGross,
    shopifyDiscounts,
    shopifyReturns,
    amazonPrincipal,
    amazonRefunds,
    amazonPromos,
    amazonFees,
    amazonBilledAds,
    shopifyUnits,
    shopifyOrdersOver499,
    metaGoogleSpend,
    customCOGSPerUnit: defaultCOGS,
    marketplaceCOGSPct,
    flatShippingRate: flatShipping,
    overheads: proratedOverheads
  });

  const storeNetRevenue = shopifyGross - shopifyDiscounts - shopifyReturns;
  const storeCOGS = shopifyUnits * defaultCOGS;
  const storeShipping = shopifyOrdersOver499 * flatShipping;
  const storeNetProfit = storeNetRevenue - storeCOGS - storeShipping - metaGoogleSpend;
  const storeMargin = storeNetRevenue > 0 ? (storeNetProfit / storeNetRevenue) * 100 : 0;

  const amazonNetRevenue = amazonPrincipal - amazonRefunds - amazonPromos;
  // Marketplace COGS is a share of the channel's sales; the owner's range (25-30%) is shown as a spread
  const amazonCOGSAt = (pct: number) => amazonPrincipal * (pct / 100);
  const amazonNetProfitAt = (pct: number) => amazonNetRevenue - amazonFees - amazonBilledAds - amazonCOGSAt(pct);
  const amazonCOGS = amazonCOGSAt(marketplaceCOGSPct);
  const amazonNetProfit = amazonNetProfitAt(marketplaceCOGSPct);
  const amazonMargin = amazonNetRevenue > 0 ? (amazonNetProfit / amazonNetRevenue) * 100 : 0;

  const cogsLabel = {
    all: `COGS: Shopify ₹${defaultCOGS}/unit, Amazon ${marketplaceCOGSPct}% of sales`,
    shopify: `COGS @ ₹${defaultCOGS} per unit`,
    amazon: `COGS @ ${marketplaceCOGSPct}% of Amazon sales`,
  }[pnlChannel];

  // Steps that don't apply to a channel are left out (Amazon has no outbound shipping line,
  // Shopify has no marketplace fees).
  const waterfallData = [
    { name: 'Gross Sales', amount: Math.round(pnl.grossSales), type: 'positive' },
    { name: 'Discounts', amount: -Math.round(pnl.discounts), type: 'negative' },
    { name: 'Returns', amount: -Math.round(pnl.returns), type: 'negative' },
    { name: 'COGS', amount: -Math.round(pnl.cogs), type: 'negative' },
    ...(showStore ? [{ name: 'Shipping', amount: -Math.round(pnl.shipping), type: 'negative' }] : []),
    ...(showAmazon ? [{ name: 'Mkt Fees', amount: -Math.round(pnl.marketplaceFees), type: 'negative' }] : []),
    { name: 'Ad Spend', amount: -Math.round(pnl.adSpend), type: 'negative' },
    { name: 'Overheads', amount: -Math.round(pnl.overheads), type: 'negative' },
    { name: 'Net Profit', amount: Math.round(pnl.netContribution), type: 'result' }
  ];

  const pnlChannelOptions: { id: ChannelFilter; label: string }[] = [
    { id: 'all', label: 'Combined (Store + Amazon)' },
    { id: 'shopify', label: 'Shopify Store P&L' },
    { id: 'amazon', label: 'Amazon FBA P&L' }
  ];

  const channelName = { all: 'Combined (Shopify + Amazon)', shopify: 'Shopify D2C', amazon: 'Amazon.in' }[pnlChannel];
  const channelSuffix = pnlChannel === 'all' ? '' : ` · ${channelName}`;

  const pnlSource = {
    all: 'Shopify Net + Amazon Settlement v2 + COGS assumptions (₹/unit Shopify, % of sales Amazon)',
    shopify: 'Shopify Net + Windsor Meta & Google Spend + Flat COGS Assumption',
    amazon: 'Amazon Settlement v2 + SP-API Sales + COGS as % of sales'
  }[pnlChannel];

  const methodASource = {
    all: 'Shopify Gross Sales (pre-returns) + Amazon Principal minus Windsor Ad Spend',
    shopify: 'Shopify Gross Sales (pre-returns) minus Windsor Meta & Google Ad Spend',
    amazon: 'Amazon Ordered Sales (SP-API, pre-returns); Meta & Google spend is store-attributed'
  }[pnlChannel];

  const methodBSource = {
    all: 'Shopify Net + Amazon Settlement v2 Flat File minus COGS, Shipping & Ad deductions',
    shopify: 'Shopify Net minus COGS, Shipping & Windsor Meta & Google Ad Spend',
    amazon: 'Amazon Settlement v2 Flat File minus Fees, Ad Spend & COGS'
  }[pnlChannel];

  const overheadLabel =
    pnlChannel === 'all'
      ? 'Overheads (prorated to period)'
      : `Overheads (${formatPercent(pnl.overheadShare * 100)} share by net revenue)`;

  return (
    <div className="space-y-6">
      {/* Responsive P&L Filter Bar */}
      <ViewFilterBar
        showChannels={true}
        activeChannel={pnlChannel}
        onChannelChange={setChannel}
        channelOptions={pnlChannelOptions}
        showPeriods={true}
        activePeriod={period}
        onPeriodChange={setPeriod}
        title="Multi-Channel Profit & Loss (P&L)"
        subtitle={`Analyzing unit economics and net margin contribution for ${channelName} · ${periodLabel}`}
        extraRight={
          <SectionSourceBadge
            source={pnlSource}
            pipeline="Dual P&L Engine"
            channel={pnlChannel}
          />
        }
      />

      <GapNotice gap={gap} />

      {!gap?.whole && (<>
      {/* Headline Comparison: Dashboard P&L vs Realistic P&L */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Dashboard Basis P&L */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Method A</span>
                <h3 className="font-bold text-slate-900 text-base">Dashboard-Basis Contribution{channelSuffix}</h3>
              </div>
              <span className="text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full font-medium">
                Sales Pre-Returns − Ads
              </span>
            </div>

            <div className="text-3xl font-extrabold text-slate-900 mb-3">
              {formatINR(pnl.dashboardProfit)}
            </div>

            <div className="space-y-2 text-xs divide-y divide-slate-100">
              <div className="flex justify-between pt-1.5 text-slate-600">
                <span>Total Sales (Pre-Returns):</span>
                <span className="font-semibold text-slate-900">{formatINR(pnl.dashboardSales)}</span>
              </div>
              <div className="flex justify-between pt-1.5 text-slate-600">
                <span>{showStore ? 'Meta + Google Ad Spend:' : 'Meta + Google Ad Spend (store-attributed):'}</span>
                <span className="font-semibold text-rose-600">−{formatINR(showStore ? metaGoogleSpend : 0)}</span>
              </div>
              {showAmazon && (
                <div className="flex justify-between pt-1.5 text-slate-500 italic">
                  <span>Memo: Amazon Ads spend:</span>
                  <span className="text-slate-600">{formatINR(amazonBilledAds)} (not deducted here)</span>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100">
            <SectionSourceBadge
              source={methodASource}
              channel={pnlChannel}
            />
          </div>
        </div>

        {/* Realistic P&L */}
        <div className="bg-gradient-to-br from-white to-emerald-50/40 rounded-xl border border-emerald-200 p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-emerald-100 mb-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Method B (Standard)</span>
                <h3 className="font-bold text-slate-900 text-base">Realistic Net Profit{channelSuffix}</h3>
              </div>
              <span className="text-xs bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full font-semibold">
                Full Unit Economics
              </span>
            </div>

            <div className="text-3xl font-extrabold text-emerald-700 mb-1">
              {formatINR(pnl.netContribution)}
            </div>
            <div className="text-xs font-semibold text-emerald-800 mb-3">
              Contribution Margin: {formatPercent(pnl.contributionMarginPercent)} of Net Revenue
            </div>

            <div className="space-y-2 text-xs divide-y divide-emerald-100/60">
              <div className="flex justify-between pt-1.5 text-slate-600">
                <span>Net Revenue (Post Returns & Promos):</span>
                <span className="font-semibold text-slate-900">{formatINR(pnl.netRevenue)}</span>
              </div>
              <div className="flex justify-between pt-1.5 text-slate-600">
                <span>Cost of Goods Sold ({cogsLabel}):</span>
                <span className="font-semibold text-rose-600">−{formatINR(pnl.cogs)}</span>
              </div>
              {showStore && (
                <div className="flex justify-between pt-1.5 text-slate-600">
                  <span>Outbound Shipping (Orders &gt; ₹499 @ ₹{flatShipping}):</span>
                  <span className="font-semibold text-rose-600">−{formatINR(pnl.shipping)}</span>
                </div>
              )}
              {showAmazon && (
                <div className="flex justify-between pt-1.5 text-slate-600">
                  <span>Amazon Marketplace & FBA Fees (~27%):</span>
                  <span className="font-semibold text-rose-600">−{formatINR(pnl.marketplaceFees)}</span>
                </div>
              )}
              <div className="flex justify-between pt-1.5 text-slate-600">
                <span>
                  {pnlChannel === 'all'
                    ? 'All Ad Spend (Meta + Google + Amz):'
                    : showStore
                      ? 'Meta + Google Ad Spend:'
                      : 'Amazon Ads spend:'}
                </span>
                <span className="font-semibold text-rose-600">−{formatINR(pnl.adSpend)}</span>
              </div>
              <div className="flex justify-between pt-1.5 text-slate-600">
                <span>{overheadLabel}:</span>
                <span className="font-semibold text-rose-600">−{formatINR(pnl.overheads)}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-emerald-100">
            <SectionSourceBadge
              source={methodBSource}
              channel={pnlChannel}
            />
          </div>
        </div>
      </div>

      {/* Waterfall Visualization for selected period */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-slate-900 text-sm">Revenue to Net Contribution Waterfall{channelSuffix} — {periodLabel}</h3>
            <p className="text-xs text-slate-500">Step-by-step margin erosion from gross billings down to net profit.</p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Positive / Net
            </span>
            <span className="inline-flex items-center gap-1 text-rose-700 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Deduction / Cost
            </span>
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={waterfallData} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip 
                formatter={(val: any) => [formatINR(Math.abs(Number(val))), 'Amount']}
                contentStyle={{ backgroundColor: '#0F172A', borderRadius: '8px', border: 'none', color: '#F8FAFC', fontSize: '12px' }}
              />
              <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                {waterfallData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.type === 'positive' ? '#10B981' : entry.type === 'negative' ? '#EF4444' : '#059669'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
          <SectionSourceBadge
            source="Consolidated Ledger (Discounts, Returns, Shipping, Marketplace Fees, and Amazon Ads spend)"
            channel={pnlChannel}
          />
        </div>
      </div>

      {/* Standalone Channel P&L Card: shown only on its own channel tab, not under Combined */}
      {pnlChannel !== 'all' && (
      <div className="grid grid-cols-1 gap-6">
        {/* Shopify D2C P&L */}
        {pnlChannel === 'shopify' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <h4 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-600"></span>
                Shopify D2C Store P&L ({periodLabel})
              </h4>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${storeMargin >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                Margin: {formatPercent(storeMargin)}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 text-slate-600">
                <span>Shopify Gross Sales:</span>
                <span className="font-semibold text-slate-900">{formatINR(shopifyGross)}</span>
              </div>
              <div className="flex justify-between py-1 text-slate-600">
                <span>Discounts Applied:</span>
                <span className="text-rose-600">−{formatINR(shopifyDiscounts)}</span>
              </div>
              <div className="flex justify-between py-1 text-slate-600">
                <span>Returns & Reversals Processed:</span>
                <span className="text-rose-600">−{formatINR(shopifyReturns)}</span>
              </div>
              <div className="flex justify-between py-1.5 font-bold text-slate-900 border-t border-slate-100">
                <span>Shopify Net Sales:</span>
                <span>{formatINR(storeNetRevenue)}</span>
              </div>
              <div className="flex justify-between py-1 text-slate-600">
                <span>Product COGS ({shopifyUnits} units @ ₹{defaultCOGS}):</span>
                <span className="text-rose-600">−{formatINR(storeCOGS)}</span>
              </div>
              <div className="flex justify-between py-1 text-slate-600">
                <span>Shipping ({shopifyOrdersOver499} orders &gt; ₹499 @ ₹{flatShipping}):</span>
                <span className="text-rose-600">−{formatINR(storeShipping)}</span>
              </div>
              <div className="flex justify-between py-1 text-slate-600">
                <span>Meta + Google Ad Spend:</span>
                <span className="text-rose-600">−{formatINR(metaGoogleSpend)}</span>
              </div>
              <div className="flex justify-between py-2 text-sm font-bold border-t border-slate-200">
                <span className="text-slate-900">Shopify Store Net Contribution:</span>
                <span className={storeNetProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                  {formatINR(storeNetProfit)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100">
            <SectionSourceBadge 
              source="Shopify store analytics + Windsor (Meta and Google spend)"
            />
          </div>
        </div>
        )}

        {/* Amazon.in Seller Central P&L */}
        {pnlChannel === 'amazon' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <h4 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                Amazon.in (FBA / SP-API) P&L ({periodLabel})
              </h4>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${amazonMargin >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                Margin: {formatPercent(amazonMargin)}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 text-slate-600">
                <span>Settlement Principal (Item Price):</span>
                <span className="font-semibold text-slate-900">{formatINR(amazonPrincipal)}</span>
              </div>
              <div className="flex justify-between py-1 text-slate-600">
                <span>Refunds & Customer Adjustments:</span>
                <span className="text-rose-600">−{formatINR(amazonRefunds)}</span>
              </div>
              <div className="flex justify-between py-1 text-slate-600">
                <span>Promotions (Net of Shipping Credit):</span>
                <span className="text-rose-600">−{formatINR(amazonPromos)}</span>
              </div>
              <div className="flex justify-between py-1.5 font-bold text-slate-900 border-t border-slate-100">
                <span>Amazon Net Sales:</span>
                <span>{formatINR(amazonNetRevenue)}</span>
              </div>
              <div className="flex justify-between py-1 text-slate-600">
                <span>Amazon Commission, Closing & FBA Fees (~27%):</span>
                <span className="text-rose-600">−{formatINR(amazonFees)}</span>
              </div>
              <div className="flex justify-between py-1 text-slate-600">
                <span>Amazon Ads spend:</span>
                <span className="text-rose-600">−{formatINR(amazonBilledAds)}</span>
              </div>
              <div className="flex justify-between py-1 text-slate-600">
                <span>Product COGS ({marketplaceCOGSPct}% of sales):</span>
                <span className="text-rose-600">−{formatINR(amazonCOGS)}</span>
              </div>
              <div className="flex justify-between py-2 text-sm font-bold border-t border-slate-200">
                <span className="text-slate-900">Amazon Net Profit:</span>
                <span className={amazonNetProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                  {formatINR(amazonNetProfit)}
                </span>
              </div>
              <div className="flex justify-between pb-1 text-[11px] text-slate-500">
                <span>Net profit if COGS is {MARKETPLACE_COGS_PCT.high}% to {MARKETPLACE_COGS_PCT.low}%:</span>
                <span>
                  {formatINR(amazonNetProfitAt(MARKETPLACE_COGS_PCT.high))} to {formatINR(amazonNetProfitAt(MARKETPLACE_COGS_PCT.low))}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100">
            <SectionSourceBadge 
              source="Amazon Seller Central settlement report + sales (via Windsor)"
            />
          </div>
        </div>
        )}
      </div>
      )}

      {/* Dynamic Sensitivity Simulator */}
      <div className="bg-slate-900 text-slate-200 rounded-xl p-5 border border-slate-800 shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-amber-500" />
            <div>
              <h4 className="font-semibold text-white text-sm">P&L Sensitivity Simulator & Assumptions</h4>
              <p className="text-xs text-slate-400">Modify baseline operational assumptions to test margin resilience in real-time.</p>
            </div>
          </div>
          <span className="text-[11px] text-amber-400 bg-amber-950/80 px-2.5 py-1 rounded border border-amber-800/80">
            Interactive Model
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-xs">
          <div>
            <label className="text-slate-400 font-medium block mb-1">
              Shopify Unit COGS: <strong className="text-white font-mono">₹{defaultCOGS} / unit</strong>
            </label>
            <input 
              type="range" 
              min="80" 
              max="220" 
              value={defaultCOGS} 
              onChange={(e) => setDefaultCOGS(Number(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>₹80 (Optimistic)</span>
              <span>₹125 (Default)</span>
              <span>₹220 (Conservative)</span>
            </div>
          </div>

          <div>
            <label className="text-slate-400 font-medium block mb-1">
              Marketplace COGS: <strong className="text-white font-mono">{marketplaceCOGSPct}% of sales</strong>
            </label>
            <input
              type="range"
              min="20"
              max="35"
              step="0.5"
              value={marketplaceCOGSPct}
              onChange={(e) => setMarketplaceCOGSPct(Number(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>20%</span>
              <span>{MARKETPLACE_COGS_PCT.low}–{MARKETPLACE_COGS_PCT.high}% (range) · {MARKETPLACE_COGS_PCT.default}% default</span>
              <span>35%</span>
            </div>
          </div>

          <div>
            <label className="text-slate-400 font-medium block mb-1">
              Shipping Cost (Orders &gt; ₹499): <strong className="text-white font-mono">₹{flatShipping} / order</strong>
            </label>
            <input 
              type="range" 
              min="45" 
              max="110" 
              value={flatShipping} 
              onChange={(e) => setFlatShipping(Number(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>₹45</span>
              <span>₹65 (Default)</span>
              <span>₹110</span>
            </div>
          </div>

          <div>
            <label className="text-slate-400 font-medium block mb-1">
              Monthly Overheads (Team/Lease): <strong className="text-white font-mono">₹{(overheads / 100000).toFixed(1)}L</strong>
            </label>
            <input 
              type="range" 
              min="100000" 
              max="800000" 
              step="50000"
              value={overheads} 
              onChange={(e) => setOverheads(Number(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>₹1.0L</span>
              <span>₹3.5L (Default)</span>
              <span>₹8.0L</span>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
          <span>Source: Parametric Financial Simulation Engine</span>
          <span className="font-mono text-amber-400">Baseline COGS: ₹125/unit Shopify, {MARKETPLACE_COGS_PCT.default}% of sales marketplaces (assumed)</span>
        </div>
      </div>
      </>)}
    </div>
  );
};
