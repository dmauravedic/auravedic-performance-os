import React from 'react';
import { useDashboard } from '../../context/DashboardContext';
import { MetricCard } from '../common/MetricCard';
import { ViewFilterBar } from '../common/ViewFilterBar';
import { SectionSourceBadge } from '../common/SectionSourceBadge';
import { formatINR, formatPercent, formatNumber } from '../../utils/formatters';
import { dailyRecords } from '../../data/dailyData';
import {
  ShoppingBag,
  CreditCard,
  Truck,
  RotateCcw,
  AlertTriangle,
  Bot,
  MapPin,
  CheckCircle,
  HelpCircle,
  ArrowRight
} from 'lucide-react';

export const ShopifyStoreView: React.FC = () => {
  const { data, period, setPeriod } = useDashboard();
  const { stateCodRisk } = data;

  const n = dailyRecords.length;
  let slice = dailyRecords.slice(35, 60);
  let periodLabel = 'MTD Oct 1–25, 2026';

  if (period === 'yesterday') {
    slice = [dailyRecords[n - 1]];
    periodLabel = 'Yesterday (25 Oct)';
  } else if (period === '7d') {
    slice = dailyRecords.slice(n - 7);
    periodLabel = 'Last 7 Days (19–25 Oct)';
  } else if (period === '14d') {
    slice = dailyRecords.slice(n - 14);
    periodLabel = 'Last 14 Days (12–25 Oct)';
  } else if (period === '30d') {
    slice = dailyRecords.slice(n - 30);
    periodLabel = 'Last 30 Days';
  } else if (period === 'all') {
    slice = dailyRecords;
    periodLabel = '60-Day History';
  }

  let shopSales = 0;
  let shopOrders = 0;
  slice.forEach(r => {
    shopSales += r.shopifyPreReturns;
    shopOrders += r.shopifyOrders;
  });

  const estimatedSessions = Math.round(shopOrders * 32);

  // Funnel Data
  const funnelSteps = [
    { step: 'Store Sessions', count: estimatedSessions, conversion: 100, dropoff: 0, fill: '#D97706' },
    { step: 'Product Views', count: Math.round(estimatedSessions * 0.61), conversion: 60.7, dropoff: 39.3, fill: '#F59E0B' },
    { step: 'Add to Cart', count: Math.round(estimatedSessions * 0.134), conversion: 13.4, dropoff: 77.8, fill: '#FBBF24' },
    { step: 'Initiated Checkout', count: Math.round(estimatedSessions * 0.062), conversion: 6.2, dropoff: 54.0, fill: '#FDE68A' },
    { step: 'Completed Orders', count: shopOrders, conversion: 3.13, dropoff: 49.4, fill: '#10B981' }
  ];

  // Helio AI Chat Metrics
  const helioMetrics = {
    totalConversations: Math.round(shopOrders * 0.83),
    ordersAttributed: Math.round(shopOrders * 0.106),
    attributedRevenue: Math.round(shopSales * 0.129),
    chatConversionRate: 12.8,
    topObjections: [
      { question: 'Is Kumkumadi Oil safe for acne-prone / oily skin?', share: 34, resolved: 88 },
      { question: 'Can I use Retinol Night Cream together with Kumkumadi Tailam?', share: 26, resolved: 92 },
      { question: 'How many weeks until dark spots & pigmentation start fading?', share: 22, resolved: 85 },
      { question: 'What is the shipping time to South India (Coimbatore warehouse)?', share: 18, resolved: 96 }
    ]
  };

  const reversalNotes = [
    { date: 'Aug 2026 Audit', note: 'Shopify reversed ~43% of sales upon batch processing (Gross ₹22.7L vs Net ₹12.8L). Headline metric uses sales before returns.' },
    { date: '12 Oct 2026', note: 'Shopify refund sync batch: 142 historical COD RTO parcels processed in bulk (₹84k deduction).' }
  ];

  return (
    <div className="space-y-6">
      {/* Responsive Store Filter Bar */}
      <ViewFilterBar
        showChannels={false}
        showPeriods={true}
        activePeriod={period}
        onPeriodChange={setPeriod}
        title="Shopify D2C Store Operations & Funnel"
        subtitle={`Tracking auravedic.com sessions, conversion funnel, COD mix and RTO risk for ${periodLabel}`}
        extraRight={
          <SectionSourceBadge 
            source="Shopify store analytics (sales and sessions)"
            syncCadence="Daily 04:51 IST"
          />
        }
      />

      {/* Top Shopify KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Shopify Gross Sales"
          value={formatINR(shopSales)}
          subtitle={`Pre-returns | ${periodLabel}`}
          badgeText="Headline"
          badgeVariant="saffron"
        />

        <MetricCard
          title="Store Conversion Rate"
          value="3.13%"
          subtitle={`${formatNumber(shopOrders)} orders from ${formatNumber(estimatedSessions)} visits`}
          badgeText="Funnel CVR"
          badgeVariant="success"
        />

        <MetricCard
          title="COD Payment Share"
          value="58.5%"
          subtitle={`${formatNumber(Math.round(shopOrders * 0.585))} COD vs ${formatNumber(Math.round(shopOrders * 0.415))} Prepaid`}
          badgeText="Payment Mix"
          badgeVariant="warning"
          footnote="Prepaid incentive adoption growing"
        />

        <MetricCard
          title="AI Chat Attributed Sales"
          value={formatINR(helioMetrics.attributedRevenue)}
          subtitle={`${formatNumber(helioMetrics.ordersAttributed)} orders via Helio AI`}
          badgeText="Helio AI"
          badgeVariant="primary"
          footnote="Chat conversion rate: 12.8%"
        />
      </div>

      {/* Store Funnel Breakdown */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-slate-900 text-sm">Shopify E-Commerce Conversion Funnel — {periodLabel}</h3>
            <p className="text-xs text-slate-500">Track drop-off from visitor sessions down to completed orders.</p>
          </div>
          <SectionSourceBadge 
            source="Shopify store analytics (sessions by landing page)"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          {funnelSteps.map((step, idx) => (
            <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 relative overflow-hidden">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{step.step}</div>
              <div className="text-lg font-bold text-slate-900 mt-1 font-mono">{formatNumber(step.count)}</div>
              
              <div className="mt-2 pt-2 border-t border-slate-200/80 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Step %:</span>
                <span className="font-bold text-slate-800">{formatPercent(step.conversion)}</span>
              </div>

              {idx > 0 && (
                <div className="mt-1 flex items-center justify-between text-[11px] text-rose-600">
                  <span>Drop-off:</span>
                  <span className="font-semibold">−{formatPercent(step.dropoff)}</span>
                </div>
              )}

              <div 
                className="absolute bottom-0 left-0 right-0 h-1 bg-amber-500" 
                style={{ opacity: 1 - (idx * 0.18) }} 
              />
            </div>
          ))}
        </div>
      </div>

      {/* State-Wise COD & High-RTO Risk Heatmap */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-amber-600" />
              <h3 className="font-semibold text-slate-900 text-sm">State-Wise COD Share & RTO Risk Matrix</h3>
            </div>
            <p className="text-xs text-slate-500">Operational risk analysis: High RTO flags in Bihar, Rajasthan, West Bengal, Assam, and J&K.</p>
          </div>
          <SectionSourceBadge 
            source="Shopify orders + courier remittance (Call & Chase task)"
            syncCadence="Daily 07:00 IST"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-y border-slate-200">
              <tr>
                <th className="py-2.5 px-3">State / Destination</th>
                <th className="py-2.5 px-3">Region</th>
                <th className="py-2.5 px-3 text-right">Orders</th>
                <th className="py-2.5 px-3 text-right">Revenue</th>
                <th className="py-2.5 px-3 text-right">COD Share</th>
                <th className="py-2.5 px-3 text-right">RTO Rate</th>
                <th className="py-2.5 px-3">Risk Assessment</th>
                <th className="py-2.5 px-3">Ops Routing Rule</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {stateCodRisk.map((st, idx) => (
                <tr key={idx} className={`hover:bg-slate-50 transition-colors ${st.riskLevel.includes('Critical') ? 'bg-rose-50/30' : ''}`}>
                  <td className="py-2.5 px-3 font-semibold text-slate-900 flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {st.state}
                  </td>
                  <td className="py-2.5 px-3 text-slate-500">{st.region}</td>
                  <td className="py-2.5 px-3 text-right">{formatNumber(st.orders)}</td>
                  <td className="py-2.5 px-3 text-right font-bold text-slate-900">{formatINR(st.revenue, true)}</td>
                  <td className="py-2.5 px-3 text-right font-mono">{formatPercent(st.codShare)}</td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold">
                    <span className={st.rtoRate > 15 ? 'text-rose-700' : st.rtoRate > 6 ? 'text-amber-700' : 'text-emerald-700'}>
                      {formatPercent(st.rtoRate)}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                      st.riskLevel.includes('Critical') ? 'bg-rose-100 text-rose-800 border-rose-300' :
                      st.riskLevel === 'Medium' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                      'bg-emerald-100 text-emerald-800 border-emerald-300'
                    }`}>
                      {st.riskLevel}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-600 text-[11px]">
                    {st.region === 'South' ? 'Dispatch from CBE WH' : 
                     st.rtoRate > 15 ? 'Enforce WhatsApp OTP / Prepaid discount' : 'Dispatch from Mumbai WH'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Grid: Helio AI & Reversal Audit */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-amber-600" />
                <h3 className="font-semibold text-slate-900 text-sm">Helio AI Chat Assistant Intelligence</h3>
              </div>
              <span className="text-xs bg-amber-50 text-amber-800 px-2.5 py-0.5 rounded-full font-semibold border border-amber-200">
                WhatsApp + Web Chat
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-slate-500 block">Conversations:</span>
                <span className="text-base font-bold text-slate-900 font-mono">{formatNumber(helioMetrics.totalConversations)}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-slate-500 block">Attributed Revenue:</span>
                <span className="text-base font-bold text-emerald-700 font-mono">{formatINR(helioMetrics.attributedRevenue)}</span>
              </div>
            </div>

            <div className="text-xs font-semibold text-slate-700 mb-2">Top Pre-Purchase Inquiries & Objections:</div>
            <div className="space-y-2 text-xs">
              {helioMetrics.topObjections.map((obj, i) => (
                <div key={i} className="p-2.5 bg-slate-50 rounded-lg flex items-center justify-between gap-2 border border-slate-100">
                  <span className="text-slate-700 truncate">{obj.question}</span>
                  <span className="text-[11px] font-semibold text-emerald-700 shrink-0 font-mono">{obj.resolved}% resolved</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100">
            <SectionSourceBadge 
              source="Helio / YourLIo Connector (WhatsApp Bot & Site Chat Objections)" 
            />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 mb-3">
              <RotateCcw className="w-5 h-5 text-rose-600" />
              <h3 className="font-semibold text-slate-900 text-sm">Store Reversal & Refund History Audit</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Shopify returns, cancellations, and refunds are posted on their processing date rather than the transaction date. This creates distortion during batch clearing cycles.
            </p>

            <div className="space-y-3 text-xs">
              {reversalNotes.map((rev, i) => (
                <div key={i} className="p-3 bg-rose-50/60 border border-rose-200 rounded-lg">
                  <div className="font-bold text-rose-900 mb-1 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                    {rev.date}
                  </div>
                  <div className="text-slate-700 text-[11px] leading-relaxed">{rev.note}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100">
            <SectionSourceBadge 
              source="Shopify Sales Reversal Logs & Batch Refund Processing Ledger" 
            />
          </div>
        </div>
      </div>
    </div>
  );
};
