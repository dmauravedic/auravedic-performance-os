import React from 'react';
import { useDashboard } from '../../context/DashboardContext';
import { MetricCard } from '../common/MetricCard';
import { ViewFilterBar } from '../common/ViewFilterBar';
import { SectionSourceBadge } from '../common/SectionSourceBadge';
import { formatINR, formatROAS, formatNumber } from '../../utils/formatters';
import { dailyRecords } from '../../data/dailyData';
import { adSetDays, AD_SETS } from '../../data/adLevelData';
import {
  breakEven,
  platformRows,
  buildAccountRows,
  buildAdSetRows,
  accountFunnel,
  monthlySeries,
  buildInsights
} from '../../utils/adsAnalytics';
import { InsightsPanel } from '../ads/InsightsPanel';
import { PlatformScorecard } from '../ads/PlatformScorecard';
import { DailySpendChart, DailyRoasChart, MonthlyRoasChart, MonthlySpendChart } from '../ads/AdsCharts';
import { AccountLeague } from '../ads/AccountLeague';
import { BudgetSimulator } from '../ads/BudgetSimulator';
import { CreativeDiagnostics } from '../ads/CreativeDiagnostics';
import { MarketplaceAds } from '../ads/MarketplaceAds';

const SectionHeader: React.FC<{ title: string; subtitle: string; badge?: React.ReactNode }> = ({ title, subtitle, badge }) => (
  <div className="flex flex-wrap items-end justify-between gap-3">
    <div>
      <h3 className="font-semibold text-slate-900 text-sm">{title}</h3>
      <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
    </div>
    {badge}
  </div>
);

export const AdvertisingView: React.FC = () => {
  const { data, period, setPeriod, defaultCOGS, flatShipping } = useDashboard();
  const { metaAccounts, monthlyPerformance } = data;

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

  const sum = (pick: (r: (typeof slice)[number]) => number) => slice.reduce((a, r) => a + pick(r), 0);
  const metaSpend = sum(r => r.metaSpend);
  const googleSpend = sum(r => r.googleSpend);
  const amazonAds = sum(r => r.amazonBilledAds);
  const flipkartAds = sum(r => r.flipkartAds);
  const metaPurchases = sum(r => r.metaPurchases);
  const metaPurchaseVal = sum(r => r.metaPurchaseValue);
  const googleConversions = sum(r => r.googleConversions);
  const googleConversionVal = sum(r => r.googleConversionValue);

  const metaRoas = metaSpend > 0 ? metaPurchaseVal / metaSpend : 0;
  const googleRoas = googleSpend > 0 ? googleConversionVal / googleSpend : 0;
  const totalPaid = metaSpend + googleSpend + amazonAds + flipkartAds;
  // Same basis as the Executive Summary's combined MER: Shopify + Amazon sales over Meta + Google + Amazon ads
  const blendedMer = (() => {
    const spend = metaSpend + googleSpend + amazonAds;
    return spend > 0 ? sum(r => r.shopifyPreReturns + r.amazonSales) / spend : 0;
  })();
  const shopifySales = sum(r => r.shopifyPreReturns);
  const overclaim = shopifySales > 0 ? (metaPurchaseVal + googleConversionVal) / shopifySales : 0;

  const be = breakEven(slice, defaultCOGS, flatShipping);
  const platforms = platformRows(slice);
  const accounts = buildAccountRows(metaAccounts, slice, be.roas);
  const months = monthlySeries(monthlyPerformance);
  const adSets = buildAdSetRows(adSetDays, AD_SETS, new Set(slice.map(r => r.date)));
  const funnel = accountFunnel(adSets);
  const marketplaceAds = data.marketplaceAds ?? [];
  const insights = buildInsights({ slice, be, cogsRate: defaultCOGS, shippingRate: flatShipping, accounts, months, adSets, marketplaceAds });

  return (
    <div className="space-y-6">
      {/* Responsive Advertising Filter Bar */}
      <ViewFilterBar
        showChannels={false}
        showPeriods={true}
        activePeriod={period}
        onPeriodChange={setPeriod}
        title="Cross-Channel Advertising & Paid Acquisition"
        subtitle={`Tracking Meta (5 accounts), Google Ads, Amazon Billed Ads & Flipkart Ads for ${periodLabel}`}
        extraRight={
          <SectionSourceBadge
            source="Windsor.ai (facebook & google_ads) + Settlement Billed Ads"
            syncCadence="Daily 04:51 IST"
          />
        }
      />

      {/* Headline spend by platform */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Meta Spend (5 Accounts)"
          sources={['meta']}
          value={formatINR(metaSpend)}
          subtitle={`${formatNumber(metaPurchases)} purchases | ${periodLabel}`}
          badgeText="Meta Ads"
          badgeVariant="primary"
          footnote={`Purchase ROAS: ${formatROAS(metaRoas)}`}
        />

        <MetricCard
          title="Google Ads Spend"
          sources={['google']}
          value={formatINR(googleSpend)}
          subtitle={`${googleConversions.toFixed(1)} conversions | ${periodLabel}`}
          badgeText="Google Ads"
          badgeVariant="neutral"
          footnote={`Conversion ROAS: ${formatROAS(googleRoas)}`}
        />

        <MetricCard
          title="Amazon Billed Ads"
          sources={['amazonSettlement']}
          value={formatINR(amazonAds)}
          subtitle={`Settlement deduction | ${periodLabel}`}
          badgeText="Amazon SP"
          badgeVariant="warning"
          footnote={`~${formatINR(amazonAds / slice.length, true)} / day in settlements (pre-13 Oct estimated)`}
        />

        <MetricCard
          title="Flipkart Ads Spend"
          sources={['flipkart']}
          value={formatINR(flipkartAds)}
          subtitle={`Campaign spend | ${periodLabel}`}
          badgeText="Flipkart Ads"
          badgeVariant="saffron"
          footnote="Ad sales: ~3.52x ROI (weekly report)"
        />
      </div>

      {/* Efficiency read-out */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="All Paid Media"
          sources={['meta', 'google', 'amazonSettlement', 'flipkart']}
          value={formatINR(totalPaid)}
          subtitle="Meta + Google + Amazon + Flipkart ads"
          badgeText="Spend"
          badgeVariant="neutral"
        />

        <MetricCard
          title="Blended MER (Sales / ₹1 Ad)"
          value={formatROAS(blendedMer)}
          subtitle="Shopify + Amazon sales ÷ Meta, Google, Amazon ads"
          badgeText="Efficiency"
          badgeVariant="success"
          footnote="Flipkart is excluded, as in the Executive Summary"
        />

        <MetricCard
          title="Break-even ROAS"
          sources={['shopify']}
          value={formatROAS(be.roas)}
          subtitle={`AOV ${formatINR(be.aov)} − COGS ${formatINR(be.cogsPerOrder)} − shipping ${formatINR(be.shippingPerOrder)}`}
          badgeText="Shopify"
          badgeVariant="warning"
          footnote="Before returns and COD fees; moves with the P&L assumptions"
        />

        <MetricCard
          title="Platform Over-claim"
          sources={['shopify', 'meta', 'google']}
          value={`${overclaim.toFixed(2)}x`}
          subtitle="Meta + Google reported value ÷ actual Shopify sales"
          badgeText="Attribution"
          badgeVariant={overclaim > 1.1 ? 'danger' : 'neutral'}
          footnote="Above 1.0x means overlapping attribution"
        />
      </div>

      {/* Insights */}
      <div className="space-y-3">
        <SectionHeader
          title="What the data says"
          subtitle="Findings computed from the figures on this page. They update with the period, COGS and shipping assumptions."
          badge={
            <SectionSourceBadge
              source="Daily ad series + Meta account figures + handbook monthly figures"
              showLatency={false}
            />
          }
        />
        <InsightsPanel insights={insights} />
      </div>

      {/* Platform scorecard */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
        <SectionHeader
          title="Platform scorecard"
          subtitle="Where the money goes and what each rupee returns. The basis column says how comparable the numbers are."
          badge={
            <SectionSourceBadge
              source="Windsor.ai (facebook & google_ads) + Settlement Billed Ads + Flipkart Ads report"
            />
          }
        />
        <PlatformScorecard rows={platforms} periodLabel={periodLabel} />
      </div>

      {/* Marketplace ads: each marketplace's own monthly ad report */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
        <SectionHeader
          title="Marketplace ads, month by month"
          subtitle="Spend, ad revenue, ROAS and TACOS from each marketplace's own ad report, independent of the period selector."
          badge={
            <SectionSourceBadge
              source="Shan's Report Sheet (Amazon Ads, FKT, Nykaa Ads, Myntra Ads, Purplle Ads, Snapdeal Ads tabs)"
              latency="Entered by hand, monthly"
              sources={['amazonAds', 'flipkartAds', 'nykaa', 'myntra']}
            />
          }
        />
        <MarketplaceAds ads={marketplaceAds} />
      </div>

      {/* Daily charts: one axis each */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <DailySpendChart slice={slice} periodLabel={periodLabel} />
        <DailyRoasChart slice={slice} periodLabel={periodLabel} be={be.roas} />
      </div>

      {/* Trend since April */}
      <div className="space-y-3">
        <SectionHeader
          title="Efficiency trend since April"
          subtitle="Handbook monthly figures, independent of the period selector."
          badge={
            <SectionSourceBadge
              source="Handbook monthly figures (Windsor Meta & Google, settlement-estimated Amazon & Flipkart ads)"
              latency="Monthly snapshot · to 25 Oct"
            />
          }
        />
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <MonthlyRoasChart months={months} be={be.roas} />
          <MonthlySpendChart months={months} />
        </div>
      </div>

      {/* Meta accounts */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
        <SectionHeader
          title={`Meta accounts: who earns their budget — ${periodLabel}`}
          subtitle="Ranked against the Meta average and the store's break-even. Fresh Pixel is judged on its own objective."
          badge={
            <SectionSourceBadge
              source="Windsor.ai facebook Connector (5 Accounts)"
            />
          }
        />
        <AccountLeague rows={accounts} periodLabel={periodLabel} />
      </div>

      {/* Budget simulator */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
        <SectionHeader
          title="Budget reallocation simulator"
          subtitle="Test a move between Meta accounts before making it, with diminishing returns built in."
          badge={<SectionSourceBadge source="Derived from the account league above" showLatency={false} />}
        />
        <BudgetSimulator rows={accounts} be={be.roas} />
      </div>

      {/* Creative and funnel diagnostics */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
        <SectionHeader
          title="Creative and funnel diagnostics"
          subtitle="Reach, click and conversion quality by account and ad set, with fatigue flags and a diagnosis for each."
          badge={
            <SectionSourceBadge
              source="Illustrative ad-set sample (awaiting Windsor ad-set export)"
              showLatency={false}
            />
          }
        />
        <CreativeDiagnostics adSets={adSets} funnel={funnel} periodLabel={periodLabel} />
      </div>
    </div>
  );
};
