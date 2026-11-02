import React, { useState } from 'react';
import { useDashboard } from '../../context/DashboardContext';
import { MetricCard } from '../common/MetricCard';
import { ViewFilterBar } from '../common/ViewFilterBar';
import { SectionSourceBadge } from '../common/SectionSourceBadge';
import { formatINR, formatPercent, formatNumber } from '../../utils/formatters';
import {
  Store,
  ExternalLink,
  ShieldAlert,
  AlertCircle,
  Package,
  Layers,
  Search,
  ShoppingCart,
  TrendingUp,
  CheckCircle2
} from 'lucide-react';

export const MarketplacesView: React.FC = () => {
  const { data, period, setPeriod } = useDashboard();
  const { amazonBusinessData, amazonInventoryPlan, marketplaceSummary } = data;

  const [activeMktTab, setActiveMktTab] = useState<'amazon' | 'flipkart' | 'nykaa' | 'myntra'>('amazon');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredAsins = amazonBusinessData.filter(item => 
    item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.childAsin.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Responsive Period Filter Bar for Marketplaces */}
      <ViewFilterBar
        showChannels={false}
        showPeriods={true}
        activePeriod={period}
        onPeriodChange={setPeriod}
        title="Marketplaces Command Center"
        subtitle="Detailed operational and sales breakdown for Amazon.in, Flipkart, Nykaa & Myntra"
        extraRight={
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 overflow-x-auto">
            <button
              onClick={() => setActiveMktTab('amazon')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                activeMktTab === 'amazon'
                  ? 'bg-amber-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Store className="w-3.5 h-3.5" />
              Amazon.in
            </button>

            <button
              onClick={() => setActiveMktTab('flipkart')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                activeMktTab === 'flipkart'
                  ? 'bg-amber-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              Flipkart
            </button>

            <button
              onClick={() => setActiveMktTab('nykaa')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                activeMktTab === 'nykaa'
                  ? 'bg-amber-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Nykaa
            </button>

            <button
              onClick={() => setActiveMktTab('myntra')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                activeMktTab === 'myntra'
                  ? 'bg-amber-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              Myntra
            </button>
          </div>
        }
      />

      {/* Amazon View Content */}
      {activeMktTab === 'amazon' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Amazon Ordered Sales"
              value="₹29.8L"
              priorValue="₹23.4L"
              deltaText="+27.4% vs Sep 1-25"
              deltaPositive={true}
              subtitle="6,794 order items ordered"
              badgeText="A3OEY3JP0PGBDE-IN"
              badgeVariant="primary"
            />

            <MetricCard
              title="Settlement Net Payout"
              value="₹4.81L"
              subtitle="13–25 Oct settlement period"
              badgeText="13 Days"
              badgeVariant="neutral"
              footnote="Excludes ₹1.94L unexplained fee adjustment"
            />

            <MetricCard
              title="Amazon Fees & FBA Share"
              value="27.2%"
              subtitle="₹3.39L total fees on ₹12.45L principal"
              badgeText="Commission + FBA"
              badgeVariant="warning"
            />

            <MetricCard
              title="Amazon Ads Deduction"
              value="₹3.45L"
              subtitle="27.7% of principal (~₹27k/day)"
              badgeText="Billed Ads"
              badgeVariant="saffron"
            />
          </div>

          <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-950 flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3 max-w-3xl">
              <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold block mb-0.5">Amazon Settlement Audit Note (21 Oct 2026):</strong>
                A ₹1,94,000 fee adjustment appeared in the Seller Central settlement on 21 Oct. As instructed in the Context Handbook, this unclassified adjustment is isolated and excluded from normal contribution calculations until finance verifies transaction records.
              </div>
            </div>
            <SectionSourceBadge 
              source="Amazon Settlement v2 Flat File (amazon_sp)" 
            />
          </div>

          {/* ASIN Listing Performance Table from Business Report */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-slate-900 text-sm">Amazon ASIN Performance Funnel (Business Report)</h3>
                <p className="text-xs text-slate-500">Live listings parsed from Amazon Seller Central business report.</p>
              </div>

              <div className="flex items-center gap-3">
                <SectionSourceBadge 
                  source="Amazon Seller Central Business Report (SP-API Sales & Traffic by ASIN)" 
                />
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search ASIN or title..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg w-56 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-y border-slate-200 sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3">Child ASIN</th>
                    <th className="py-2.5 px-3">Listing Title</th>
                    <th className="py-2.5 px-3 text-right">Units Ordered</th>
                    <th className="py-2.5 px-3 text-right">Order Items</th>
                    <th className="py-2.5 px-3 text-right">Est Revenue</th>
                    <th className="py-2.5 px-3">Product Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                  {filteredAsins.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-amber-800 text-[11px] whitespace-nowrap">
                        {item.childAsin}
                      </td>
                      <td className="py-2.5 px-3 max-w-md truncate text-slate-900 font-sans" title={item.title}>
                        {item.title}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900 font-mono">
                        {formatNumber(item.unitsOrdered)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                        {formatNumber(item.totalOrderItems)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-700 font-mono">
                        {formatINR(item.estRevenue, true)}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          item.title.includes('100') ? 'bg-amber-50 text-amber-800 border-amber-200' :
                          item.title.includes('Rosemary') ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                          'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                          {item.title.includes('100') ? 'Hero Oil' : item.title.includes('Rosemary') ? 'Hair Care' : 'Skincare'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Flipkart View Content */}
      {activeMktTab === 'flipkart' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Flipkart Est. Order Value"
              value="₹14.5L"
              subtitle="1–29 Oct | 3,356 units ordered"
              badgeText="Estimate"
              badgeVariant="warning"
              footnote="Ran ~8% higher than real Seller Hub on 28 Oct"
            />

            <MetricCard
              title="Delivered Lines"
              value="1,726"
              subtitle="51.4% delivered | Many open lines"
              badgeText="Fulfillment"
              badgeVariant="success"
            />

            <MetricCard
              title="Returns & Cancellations"
              value="814 Lines"
              subtitle="453 returned (13.5%) + 361 cancelled"
              badgeText="Return Risk"
              badgeVariant="danger"
            />

            <MetricCard
              title="Flipkart Ads Spend & ROI"
              value="₹2.51L"
              subtitle="Ad sales ₹8.84L | 3.52x reported ROI"
              badgeText="Flipkart Ads"
              badgeVariant="primary"
            />
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-900 text-sm">Flipkart Seller Hub Report Ingestion Status</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Flipkart reports arrive as daily Slack posts in <code className="bg-slate-100 text-amber-800 px-1.5 py-0.5 rounded font-mono">#flipkart-reports</code> and are parsed into structured tables.
                </p>
              </div>
              <SectionSourceBadge 
                source="Slack #flipkart-reports (Daily Orders, FBF Stock, and Ads Reports)" 
                syncCadence="Daily 09:40 IST"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="font-bold text-slate-900 block mb-1">Orders Report</span>
                <span className="text-emerald-700 flex items-center gap-1 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Updated through 29 Oct
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="font-bold text-slate-900 block mb-1">FBF Inventory Report</span>
                <span className="text-emerald-700 flex items-center gap-1 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" /> In use (28 Oct snapshot)
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="font-bold text-slate-900 block mb-1">Settlement Reports</span>
                <span className="text-rose-700 flex items-center gap-1 font-semibold">
                  <AlertCircle className="w-3.5 h-3.5" /> Not yet uploaded in Slack
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Nykaa & Myntra View Content */}
      {(activeMktTab === 'nykaa' || activeMktTab === 'myntra') && (() => {
        const mk = marketplaceSummary.find(m => m.channel === (activeMktTab === 'nykaa' ? 'Nykaa' : 'Myntra'));
        return (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-semibold text-slate-900 text-sm">
                {activeMktTab === 'nykaa' ? 'Nykaa Marketplace' : 'Myntra Marketplace'} Performance
              </h3>
              <p className="text-xs text-slate-500">
                Latest month in Shan's report sheet: {mk?.periodLabel ?? 'not available'}. Sales and orders cover the whole channel; ad spend is the platform's own ads.
              </p>
            </div>
            <SectionSourceBadge 
              source={`Shan's Report Sheet (${activeMktTab === 'nykaa' ? 'Nykaa Ads' : 'Myntra Ads'} tab)`}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-slate-500 block mb-1">Monthly Sales{mk?.periodLabel ? ` (${mk.periodLabel})` : ''}:</span>
              <span className="text-2xl font-bold text-slate-900 font-mono">
                {mk ? formatINR(mk.monthlyRevenue, true) : '—'}
              </span>
              <span className="text-[11px] text-slate-500 mt-1 block">AOV: {mk ? formatINR(mk.aov) : '—'}</span>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-slate-500 block mb-1">Dedicated Platform Ads Spend:</span>
              <span className="text-2xl font-bold text-amber-800 font-mono">
                {mk?.adSpend != null ? formatINR(mk.adSpend, true) : '—'}
              </span>
              <span className="text-[11px] text-emerald-700 mt-1 block">
                Ad ROAS: {mk?.adRoas != null ? `${mk.adRoas.toFixed(2)}x` : '—'}
              </span>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-slate-500 block mb-1">Catalog & Inventory Mapping:</span>
              <span className="text-sm font-bold text-slate-800 block mt-1">
                {mk?.skusMapped != null ? `${mk.skusMapped} SKUs Mapped` : 'Not mapped yet'}
              </span>
              <span className="text-[11px] text-slate-500 block mt-1">Cross-referenced with base products</span>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
};
