import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ReferenceLine
} from 'recharts';
import type { DailyRecord } from '../../data/dailyData';
import type { MonthPoint } from '../../utils/adsAnalytics';
import { formatINR } from '../../utils/formatters';
import { ChartCard, ChartTooltip } from './ChartCard';
import { CHROME, PLATFORM_COLOR, PLATFORM_NAME, compactINR } from './adTheme';

const axisTick = { fontSize: 11, fill: CHROME.muted };
const legendText = (v: string) => <span style={{ color: CHROME.inkSecondary, fontSize: 12 }}>{v}</span>;
const round2 = (v: number) => Math.round(v * 100) / 100;

/** Label drawn at the last point of a line (identity beyond colour). */
const endLabel = (text: string, lastIndex: number) => (props: any) =>
  props.index === lastIndex ? (
    <text key={`end-${text}`} x={props.x + 8} y={props.y} dy={4} fontSize={11} fontWeight={600} fill={CHROME.inkSecondary}>
      {text}
    </text>
  ) : (
    <g key={`end-${props.index}`} />
  );

// ---------------------------------------------------------------------------
// Daily spend by platform (stacked, one axis)
// ---------------------------------------------------------------------------

export const DailySpendChart: React.FC<{ slice: DailyRecord[]; periodLabel: string }> = ({ slice, periodLabel }) => {
  const data = slice.map(r => ({
    date: r.date.slice(5),
    Meta: Math.round(r.metaSpend),
    Amazon: Math.round(r.amazonBilledAds),
    Google: Math.round(r.googleSpend),
    Flipkart: Math.round(r.flipkartAds)
  }));

  return (
    <ChartCard
      title={`Daily spend by platform — ${periodLabel}`}
      subtitle="Rupees per day. Amazon is the Amazon Ads export where loaded, otherwise settlement billing (pre-13 Oct estimated); Flipkart is a period average."
      table={{
        columns: ['Date', 'Meta', 'Amazon Ads', 'Google Ads', 'Flipkart Ads', 'Total'],
        rows: data.map(d => [
          d.date,
          formatINR(d.Meta),
          formatINR(d.Amazon),
          formatINR(d.Google),
          formatINR(d.Flipkart),
          formatINR(d.Meta + d.Amazon + d.Google + d.Flipkart)
        ])
      }}
    >
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
            <CartesianGrid stroke={CHROME.grid} vertical={false} />
            <XAxis dataKey="date" tick={axisTick} tickLine={false} axisLine={{ stroke: CHROME.axis }} />
            <YAxis tick={axisTick} tickLine={false} axisLine={false} tickFormatter={compactINR} />
            <Tooltip
              cursor={{ fill: 'rgba(11,11,11,0.04)' }}
              content={<ChartTooltip showTotal format={v => formatINR(v)} />}
            />
            <Legend iconType="circle" iconSize={8} formatter={legendText} wrapperStyle={{ paddingTop: 8 }} />
            <Bar dataKey="Meta" name={PLATFORM_NAME.meta} stackId="spend" fill={PLATFORM_COLOR.meta} stroke={CHROME.surface} strokeWidth={2} maxBarSize={24} />
            <Bar dataKey="Amazon" name={PLATFORM_NAME.amazon} stackId="spend" fill={PLATFORM_COLOR.amazon} stroke={CHROME.surface} strokeWidth={2} maxBarSize={24} />
            <Bar dataKey="Google" name={PLATFORM_NAME.google} stackId="spend" fill={PLATFORM_COLOR.google} stroke={CHROME.surface} strokeWidth={2} maxBarSize={24} />
            <Bar dataKey="Flipkart" name={PLATFORM_NAME.flipkart} stackId="spend" fill={PLATFORM_COLOR.flipkart} stroke={CHROME.surface} strokeWidth={2} maxBarSize={24} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
};

// ---------------------------------------------------------------------------
// Daily ROAS (lines, one axis, break-even reference)
// ---------------------------------------------------------------------------

export const DailyRoasChart: React.FC<{ slice: DailyRecord[]; periodLabel: string; be: number }> = ({ slice, periodLabel, be }) => {
  const data = slice.map(r => ({
    date: r.date.slice(5),
    Meta: r.metaSpend > 0 ? round2(r.metaPurchaseValue / r.metaSpend) : 0,
    Google: r.googleSpend > 0 ? round2(r.googleConversionValue / r.googleSpend) : 0
  }));
  const few = data.length <= 2;
  const last = data.length - 1;

  return (
    <ChartCard
      title={`Daily platform ROAS — ${periodLabel}`}
      subtitle="Platform-attributed purchase value ÷ spend, against the store's break-even."
      table={{
        columns: ['Date', 'Meta ROAS', 'Google ROAS', 'Break-even'],
        rows: data.map(d => [d.date, `${d.Meta.toFixed(2)}x`, `${d.Google.toFixed(2)}x`, `${be.toFixed(2)}x`])
      }}
    >
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 64, bottom: 4, left: 4 }}>
            <CartesianGrid stroke={CHROME.grid} vertical={false} />
            <XAxis dataKey="date" tick={axisTick} tickLine={false} axisLine={{ stroke: CHROME.axis }} />
            <YAxis tick={axisTick} tickLine={false} axisLine={false} domain={[0, 'auto']} tickFormatter={v => `${v}x`} />
            <Tooltip cursor={{ stroke: CHROME.axis }} content={<ChartTooltip format={v => `${v.toFixed(2)}x`} />} />
            <Legend iconType="plainline" iconSize={14} formatter={legendText} wrapperStyle={{ paddingTop: 8 }} />
            <ReferenceLine
              y={be}
              stroke={CHROME.inkSecondary}
              strokeDasharray="4 3"
              label={{ value: `Break-even ${be.toFixed(2)}x`, position: 'insideTopLeft', fontSize: 11, fill: CHROME.inkSecondary }}
            />
            <Line
              type="monotone"
              dataKey="Meta"
              name="Meta ROAS"
              stroke={PLATFORM_COLOR.meta}
              strokeWidth={2}
              strokeLinecap="round"
              dot={few ? { r: 4, stroke: CHROME.surface, strokeWidth: 2 } : false}
              activeDot={{ r: 5, stroke: CHROME.surface, strokeWidth: 2 }}
              label={endLabel('Meta', last)}
            />
            <Line
              type="monotone"
              dataKey="Google"
              name="Google ROAS"
              stroke={PLATFORM_COLOR.google}
              strokeWidth={2}
              strokeLinecap="round"
              dot={few ? { r: 4, stroke: CHROME.surface, strokeWidth: 2 } : false}
              activeDot={{ r: 5, stroke: CHROME.surface, strokeWidth: 2 }}
              label={endLabel('Google', last)}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
};

// ---------------------------------------------------------------------------
// Monthly (handbook figures): ROAS and spend as two charts, never one dual-axis
// ---------------------------------------------------------------------------

export const MonthlyRoasChart: React.FC<{ months: MonthPoint[]; be: number }> = ({ months, be }) => {
  const last = months.length - 1;
  return (
    <ChartCard
      title="Platform ROAS by month"
      subtitle="Handbook monthly figures, April to October to date."
      table={{
        columns: ['Month', 'Meta ROAS', 'Google ROAS', 'Blended MER (all paid)'],
        rows: months.map(m => [m.month, `${m.metaROAS.toFixed(2)}x`, `${m.googleROAS.toFixed(2)}x`, `${m.blendedMer.toFixed(2)}x`])
      }}
    >
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={months} margin={{ top: 8, right: 64, bottom: 4, left: 4 }}>
            <CartesianGrid stroke={CHROME.grid} vertical={false} />
            <XAxis dataKey="month" tick={axisTick} tickLine={false} axisLine={{ stroke: CHROME.axis }} />
            <YAxis tick={axisTick} tickLine={false} axisLine={false} domain={[0, 'auto']} tickFormatter={v => `${v}x`} />
            <Tooltip cursor={{ stroke: CHROME.axis }} content={<ChartTooltip format={v => `${v.toFixed(2)}x`} />} />
            <Legend iconType="plainline" iconSize={14} formatter={legendText} wrapperStyle={{ paddingTop: 8 }} />
            <ReferenceLine
              y={be}
              stroke={CHROME.inkSecondary}
              strokeDasharray="4 3"
              label={{ value: `Break-even ${be.toFixed(2)}x`, position: 'insideBottomLeft', fontSize: 11, fill: CHROME.inkSecondary }}
            />
            <Line type="monotone" dataKey="metaROAS" name="Meta ROAS" stroke={PLATFORM_COLOR.meta} strokeWidth={2} strokeLinecap="round" dot={{ r: 4, stroke: CHROME.surface, strokeWidth: 2 }} activeDot={{ r: 5, stroke: CHROME.surface, strokeWidth: 2 }} label={endLabel('Meta', last)} />
            <Line type="monotone" dataKey="googleROAS" name="Google ROAS" stroke={PLATFORM_COLOR.google} strokeWidth={2} strokeLinecap="round" dot={{ r: 4, stroke: CHROME.surface, strokeWidth: 2 }} activeDot={{ r: 5, stroke: CHROME.surface, strokeWidth: 2 }} label={endLabel('Google', last)} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
};

export const MonthlySpendChart: React.FC<{ months: MonthPoint[] }> = ({ months }) => (
  <ChartCard
    title="Paid media spend by month"
    subtitle="Amazon and Flipkart ads are estimates; Meta and Google are Windsor figures."
    table={{
      columns: ['Month', 'Meta', 'Amazon Ads (est.)', 'Google Ads', 'Flipkart Ads (est.)', 'Total'],
      rows: months.map(m => [
        m.month,
        formatINR(m.metaSpend),
        formatINR(m.amazonAds),
        formatINR(m.googleSpend),
        formatINR(m.flipkartAds),
        formatINR(m.metaSpend + m.amazonAds + m.googleSpend + m.flipkartAds)
      ])
    }}
  >
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={months} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
          <CartesianGrid stroke={CHROME.grid} vertical={false} />
          <XAxis dataKey="month" tick={axisTick} tickLine={false} axisLine={{ stroke: CHROME.axis }} />
          <YAxis tick={axisTick} tickLine={false} axisLine={false} tickFormatter={compactINR} />
          <Tooltip cursor={{ fill: 'rgba(11,11,11,0.04)' }} content={<ChartTooltip showTotal format={v => formatINR(v, true)} />} />
          <Legend iconType="circle" iconSize={8} formatter={legendText} wrapperStyle={{ paddingTop: 8 }} />
          <Bar dataKey="metaSpend" name={PLATFORM_NAME.meta} stackId="spend" fill={PLATFORM_COLOR.meta} stroke={CHROME.surface} strokeWidth={2} maxBarSize={24} />
          <Bar dataKey="amazonAds" name={PLATFORM_NAME.amazon} stackId="spend" fill={PLATFORM_COLOR.amazon} stroke={CHROME.surface} strokeWidth={2} maxBarSize={24} />
          <Bar dataKey="googleSpend" name={PLATFORM_NAME.google} stackId="spend" fill={PLATFORM_COLOR.google} stroke={CHROME.surface} strokeWidth={2} maxBarSize={24} />
          <Bar dataKey="flipkartAds" name={PLATFORM_NAME.flipkart} stackId="spend" fill={PLATFORM_COLOR.flipkart} stroke={CHROME.surface} strokeWidth={2} maxBarSize={24} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  </ChartCard>
);
