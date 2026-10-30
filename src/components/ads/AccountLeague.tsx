import React from 'react';
import { ShieldCheck } from 'lucide-react';
import type { AccountRow } from '../../utils/adsAnalytics';
import { formatINR, formatNumber, formatPercent } from '../../utils/formatters';
import { Delta, VerdictChip } from './AdsBits';

interface AccountLeagueProps {
  rows: AccountRow[];
  periodLabel: string;
}

/**
 * Meta accounts ranked against each other and against the store's break-even. Account spend,
 * purchases and ROAS are split from the selected period's real Meta series by each account's
 * October share and relative performance, so they add back to the Meta totals exactly.
 */
export const AccountLeague: React.FC<AccountLeagueProps> = ({ rows, periodLabel }) => (
  <div className="space-y-3">
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-y border-slate-200">
          <tr>
            <th className="py-2.5 px-3">Account</th>
            <th className="py-2.5 px-3">Role</th>
            <th className="py-2.5 px-3 text-right">Spend ({periodLabel})</th>
            <th className="py-2.5 px-3 text-right">Share</th>
            <th className="py-2.5 px-3 text-right">Purchases</th>
            <th className="py-2.5 px-3 text-right">CPP</th>
            <th className="py-2.5 px-3 text-right">Purchase ROAS</th>
            <th className="py-2.5 px-3 text-right">vs Meta avg</th>
            <th className="py-2.5 px-3 text-right">vs break-even</th>
            <th className="py-2.5 px-3">Call</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
          {rows.map(r => (
            <tr key={r.name} className="hover:bg-slate-50 transition-colors align-top">
              <td className="py-2.5 px-3">
                <div className="font-semibold text-slate-900">{r.name}</div>
                <div className="font-mono text-[10px] text-slate-400">{r.accountId}</div>
              </td>
              <td className="py-2.5 px-3 text-slate-600 max-w-[180px]">{r.strategy}</td>
              <td className="py-2.5 px-3 text-right font-bold text-slate-900 font-mono">{formatINR(r.spend)}</td>
              <td className="py-2.5 px-3 text-right">{formatPercent(r.share)}</td>
              <td className="py-2.5 px-3 text-right font-mono">{formatNumber(r.purchases)}</td>
              <td className="py-2.5 px-3 text-right font-mono">{formatINR(r.cpp)}</td>
              <td className="py-2.5 px-3 text-right font-bold font-mono text-slate-900">{r.roas.toFixed(2)}x</td>
              <td className="py-2.5 px-3 text-right text-[11px]"><Delta value={r.vsBlendedPct} suffix="%" digits={1} /></td>
              <td className="py-2.5 px-3 text-right text-[11px]"><Delta value={r.vsBreakEven} suffix="x" digits={2} /></td>
              <td className="py-2.5 px-3 min-w-[200px]">
                <VerdictChip verdict={r.verdict} />
                <div className="text-[11px] text-slate-500 font-normal mt-1 leading-snug">{r.note}</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    <div className="text-[11px] text-slate-500 flex items-start gap-1.5">
      <ShieldCheck className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
      <span>
        "vs break-even" compares platform-attributed ROAS with the store's break-even, and platform ROAS runs high (see the first insight), so read it as a ranking aid, not a profit verdict.
      </span>
    </div>
  </div>
);
