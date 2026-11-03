import React from 'react';
import { FlaskConical } from 'lucide-react';
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts';
import type { AdSetRow, FunnelRow } from '../../utils/adsAnalytics';
import { DIAGNOSIS_ACTION } from '../../utils/adsAnalytics';
import { formatINR, formatNumber } from '../../utils/formatters';
import { formatDay, latestDataDate } from '../../utils/periods';
import { ChartCard } from './ChartCard';
import { Delta, FatigueChip } from './AdsBits';
import { CHROME, STATUS, compactINR } from './adTheme';

const compactCount = (v: number) =>
  v >= 10000000 ? `${(v / 10000000).toFixed(2)} Cr` : v >= 100000 ? `${(v / 100000).toFixed(1)}L` : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v));

const median = (xs: number[]) => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const dotColor = (status: string) =>
  status === 'High fatigue' || status === 'Moderate fatigue' ? STATUS.critical : status === 'Winning' ? STATUS.good : CHROME.muted;

const axisTick = { fontSize: 11, fill: CHROME.muted };

interface CreativeDiagnosticsProps {
  adSets: AdSetRow[];
  funnel: FunnelRow[];
  periodLabel: string;
}

/**
 * Where the funnel leaks. Everything on spend, purchases and ROAS ties to the real account
 * figures; impressions, clicks, CTR, frequency and the ad-set split are an illustrative sample
 * until a Windsor ad-set export is loaded (see data/adLevelData.ts).
 */
export const CreativeDiagnostics: React.FC<CreativeDiagnosticsProps> = ({ adSets, funnel, periodLabel }) => {
  const live = adSets.filter(a => a.spend > 0);
  const points = live.map(a => ({
    name: a.name,
    account: a.account,
    ctr: Number((a.ctr * 100).toFixed(2)),
    cvr: Number((a.cvr * 100).toFixed(2)),
    cpp: a.cpp,
    roas: a.roas,
    status: a.status,
    diagnosis: a.diagnosis
  }));
  const medCtr = median(points.map(p => p.ctr));
  const medCvr = median(points.map(p => p.cvr));

  return (
    <div className="space-y-5">
      {/* Honest labelling of what is and is not real here */}
      <div className="flex items-start gap-3 p-3.5 rounded-xl border border-amber-200 bg-amber-50/70 text-xs text-amber-950">
        <FlaskConical className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="font-semibold">Illustrative ad-set sample.</strong> Spend, purchases and ROAS for each account tie to the
          real figures above. The ad-set split, impressions, clicks, CTR and frequency are generated: this app does not hold them yet.
          To make this section live, export the Windsor <code className="font-mono text-[11px]">facebook</code> connector at ad-set level
          with <span className="font-mono text-[11px]">date, account_name, adset_name, spend, impressions, clicks, actions_purchase, action_values_purchase, frequency</span>.
        </div>
      </div>

      {/* Account funnel */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-y border-slate-200">
            <tr>
              <th className="py-2.5 px-3">Account</th>
              <th className="py-2.5 px-3 text-right">Spend</th>
              <th className="py-2.5 px-3 text-right">Impressions</th>
              <th className="py-2.5 px-3 text-right">CPM</th>
              <th className="py-2.5 px-3 text-right">Clicks</th>
              <th className="py-2.5 px-3 text-right">CTR</th>
              <th className="py-2.5 px-3 text-right">CPC</th>
              <th className="py-2.5 px-3 text-right">Purchases</th>
              <th className="py-2.5 px-3 text-right">Click → purchase</th>
              <th className="py-2.5 px-3 text-right">CPP</th>
              <th className="py-2.5 px-3 text-right">ROAS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
            {funnel.map(f => (
              <tr key={f.account} className="hover:bg-slate-50 transition-colors">
                <td className="py-2.5 px-3 font-semibold text-slate-900">{f.account}</td>
                <td className="py-2.5 px-3 text-right font-mono">{formatINR(f.spend, true)}</td>
                <td className="py-2.5 px-3 text-right font-mono text-slate-500">{compactCount(f.impressions)}</td>
                <td className="py-2.5 px-3 text-right font-mono text-slate-500">{formatINR(f.cpm)}</td>
                <td className="py-2.5 px-3 text-right font-mono text-slate-500">{compactCount(f.clicks)}</td>
                <td className="py-2.5 px-3 text-right font-mono text-slate-500">{(f.ctr * 100).toFixed(2)}%</td>
                <td className="py-2.5 px-3 text-right font-mono text-slate-500">{formatINR(f.cpc)}</td>
                <td className="py-2.5 px-3 text-right font-mono">{formatNumber(f.purchases)}</td>
                <td className="py-2.5 px-3 text-right font-mono text-slate-500">{(f.cvr * 100).toFixed(2)}%</td>
                <td className="py-2.5 px-3 text-right font-mono">{formatINR(f.cpp)}</td>
                <td className="py-2.5 px-3 text-right font-bold font-mono text-slate-900">{f.roas.toFixed(2)}x</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-[11px] text-slate-400 mt-1.5">Grey columns are illustrative; spend, purchases, CPP and ROAS are real. Period: {periodLabel}.</p>
      </div>

      {/* CTR vs conversion: the diagnostic quadrant */}
      <ChartCard
        title="Where each ad set leaks: CTR vs click-to-purchase rate"
        subtitle="Lines mark the median ad set. Low CTR is a creative problem; good CTR with low conversion is a landing-page or offer problem."
        table={{
          columns: ['Ad set', 'Account', 'CTR %', 'Click → purchase %', 'CPP', 'ROAS', 'Status', 'Diagnosis'],
          rows: points.map(p => [p.name, p.account, p.ctr.toFixed(2), p.cvr.toFixed(2), formatINR(p.cpp), `${p.roas.toFixed(2)}x`, p.status, p.diagnosis])
        }}
        right={
          <div className="hidden sm:flex items-center gap-3 text-[11px] text-slate-600">
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS.critical }} />Fatigued</span>
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS.good }} />Winning</span>
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: CHROME.muted }} />Other</span>
          </div>
        }
      >
        <div className="relative h-80 w-full">
          <div className="pointer-events-none absolute inset-0 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <span className="absolute left-14 top-2">Weak hook · test creatives</span>
            <span className="absolute right-4 top-2 text-right">Strong · protect and scale</span>
            <span className="absolute left-14 bottom-12">Cut or rework</span>
            <span className="absolute right-4 bottom-12 text-right">Landing / offer leak</span>
          </div>
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 12, right: 16, bottom: 28, left: 8 }}>
              <CartesianGrid stroke={CHROME.grid} />
              <XAxis
                type="number"
                dataKey="ctr"
                name="CTR"
                domain={[0, 'auto']}
                tick={axisTick}
                tickLine={false}
                axisLine={{ stroke: CHROME.axis }}
                tickFormatter={v => `${v}%`}
                label={{ value: 'CTR', position: 'insideBottom', offset: -16, fontSize: 11, fill: CHROME.inkSecondary }}
              />
              <YAxis
                type="number"
                dataKey="cvr"
                name="Click → purchase"
                domain={[0, 'auto']}
                tick={axisTick}
                tickLine={false}
                axisLine={false}
                tickFormatter={v => `${v}%`}
                label={{ value: 'Click → purchase', angle: -90, position: 'insideLeft', offset: 4, fontSize: 11, fill: CHROME.inkSecondary }}
              />
              <ReferenceLine x={medCtr} stroke={CHROME.axis} />
              <ReferenceLine y={medCvr} stroke={CHROME.axis} />
              <Tooltip
                cursor={{ stroke: CHROME.axis }}
                content={({ active, payload }: any) => {
                  if (!active || !payload || payload.length === 0) return null;
                  const p = payload[0].payload;
                  return (
                    <div className="rounded-lg bg-slate-900 text-slate-100 text-xs px-3 py-2 shadow-lg max-w-[260px]">
                      <div className="font-semibold break-words">{p.name}</div>
                      <div className="text-slate-400 mb-1">{p.account} · {p.status}</div>
                      <div>CTR <span className="font-mono">{p.ctr.toFixed(2)}%</span> · Click → purchase <span className="font-mono">{p.cvr.toFixed(2)}%</span></div>
                      <div>CPP <span className="font-mono">{formatINR(p.cpp)}</span> · ROAS <span className="font-mono">{p.roas.toFixed(2)}x</span></div>
                      <div className="mt-1 text-amber-300">{p.diagnosis}</div>
                    </div>
                  );
                }}
              />
              <Scatter
                data={points}
                shape={(p: any) => (
                  <circle cx={p.cx} cy={p.cy} r={6} fill={dotColor(p.payload.status)} stroke={CHROME.surface} strokeWidth={2} />
                )}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      {/* Ad-set table with diagnosis */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-y border-slate-200">
            <tr>
              <th className="py-2.5 px-3">Ad set</th>
              <th className="py-2.5 px-3 text-right">Spend</th>
              <th className="py-2.5 px-3 text-right">CTR</th>
              <th className="py-2.5 px-3 text-right">CPM</th>
              <th className="py-2.5 px-3 text-right">CPP</th>
              <th className="py-2.5 px-3 text-right">ROAS</th>
              <th className="py-2.5 px-3 text-right">Freq (7d)</th>
              <th className="py-2.5 px-3 text-right">CTR week on week</th>
              <th className="py-2.5 px-3">Fatigue</th>
              <th className="py-2.5 px-3">Diagnosis and action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
            {[...live].sort((a, b) => b.spend - a.spend).map(a => (
              <tr key={a.id} className="hover:bg-slate-50 transition-colors align-top">
                <td className="py-2.5 px-3 max-w-[260px]">
                  <div className="font-semibold text-slate-900 font-mono text-[11px] break-words">{a.name}</div>
                  <div className="text-[10px] text-slate-400">{a.account}</div>
                </td>
                <td className="py-2.5 px-3 text-right font-bold text-slate-900 font-mono">{compactINR(a.spend)}</td>
                <td className="py-2.5 px-3 text-right font-mono">
                  <span className={a.ctr < 0.012 ? 'text-rose-700 font-bold' : ''}>{(a.ctr * 100).toFixed(2)}%</span>
                </td>
                <td className="py-2.5 px-3 text-right font-mono text-slate-500">{formatINR(a.cpm)}</td>
                <td className="py-2.5 px-3 text-right font-mono">{formatINR(a.cpp)}</td>
                <td className="py-2.5 px-3 text-right font-bold font-mono text-slate-900">{a.roas.toFixed(2)}x</td>
                <td className="py-2.5 px-3 text-right font-mono">
                  <span className={a.freq7 > 2.5 ? 'text-rose-700 font-bold' : ''}>{a.freq7.toFixed(1)}</span>
                </td>
                <td className="py-2.5 px-3 text-right text-[11px]"><Delta value={a.ctrTrendPct} suffix="%" digits={0} /></td>
                <td className="py-2.5 px-3">
                  <FatigueChip status={a.status} />
                  {a.signals.length > 0 && a.status.endsWith('fatigue') && <div className="text-[10px] text-slate-500 font-normal mt-1 max-w-[150px] leading-snug">{a.signals.join(' · ')}</div>}
                </td>
                <td className="py-2.5 px-3 min-w-[240px]">
                  <div className="font-semibold text-slate-900">{a.diagnosis}</div>
                  <div className="text-[11px] text-slate-500 font-normal leading-snug">{DIAGNOSIS_ACTION[a.diagnosis]}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-[11px] text-slate-400 mt-1.5">
          Fatigue rule: CTR under 1.2%, frequency over 2.5, cost per purchase up over 10%, CTR down over 10% week on week (trailing 7 days vs the 7 before, as of {formatDay(latestDataDate())}). Three or more is high, two is moderate.
        </p>
      </div>
    </div>
  );
};
