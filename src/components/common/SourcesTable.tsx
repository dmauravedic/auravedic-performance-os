import React from 'react';
import { BookOpen, Ban, Hand, Shuffle, Zap } from 'lucide-react';
import { useDashboard } from '../../context/DashboardContext';
import { SOURCE_ROWS, type Arrival, type SourceGroup } from '../../data/dataSources';
import { evaluateFreshness, useNow } from '../../utils/freshness';
import { FreshnessPill } from './FreshnessChip';

const GROUPS: SourceGroup[] = ['Sales', 'Advertising', 'Inventory', 'Costs & reference'];

const ARRIVAL: Record<Arrival, { box: string; icon: React.ReactNode }> = {
  Automated: { box: 'bg-emerald-50 text-emerald-800 border-emerald-200', icon: <Zap className="w-3 h-3" aria-hidden /> },
  'API + manual': { box: 'bg-violet-50 text-violet-800 border-violet-200', icon: <Shuffle className="w-3 h-3" aria-hidden /> },
  Manual: { box: 'bg-amber-50 text-amber-800 border-amber-200', icon: <Hand className="w-3 h-3" aria-hidden /> },
  'Not connected': { box: 'bg-slate-100 text-slate-600 border-slate-300', icon: <Ban className="w-3 h-3" aria-hidden /> },
  Static: { box: 'bg-slate-100 text-slate-600 border-slate-200', icon: <BookOpen className="w-3 h-3" aria-hidden /> }
};

export const SourcesTable: React.FC = () => {
  const { data } = useDashboard();
  const now = useNow();

  const rows = SOURCE_ROWS.map(r => ({
    ...r,
    todayText: typeof r.today === 'function' ? r.today(data) : r.today,
    fresh: r.freshnessKey ? evaluateFreshness(r.freshnessKey, data, now) : null
  }));
  const staleCount = rows.filter(r => r.fresh?.status === 'stale').length;
  const countOf = (a: Arrival) => rows.filter(r => r.arrives === a).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
        <span className="font-semibold text-slate-700">{rows.length} sources:</span>
        {(['Automated', 'Manual', 'Not connected', 'Static'] as Arrival[]).map(a => (
          <span key={a} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border font-medium ${ARRIVAL[a].box}`}>
            {ARRIVAL[a].icon}
            {countOf(a)} {a.toLowerCase()}
          </span>
        ))}
        {staleCount > 0 && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border font-semibold bg-rose-50 text-rose-800 border-rose-300">
            {staleCount} stale right now
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs min-w-[1100px]">
          <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-y border-slate-200">
            <tr>
              <th className="py-2.5 px-3">Source</th>
              <th className="py-2.5 px-3">What we take</th>
              <th className="py-2.5 px-3">Where it comes from</th>
              <th className="py-2.5 px-3">How it arrives</th>
              <th className="py-2.5 px-3">Schedule</th>
              <th className="py-2.5 px-3">Showing today</th>
              <th className="py-2.5 px-3">Last updated</th>
              <th className="py-2.5 px-3">Used on</th>
            </tr>
          </thead>
          {GROUPS.map(group => (
            <tbody key={group} className="divide-y divide-slate-100 text-slate-700 align-top">
              <tr className="bg-slate-100/70">
                <th colSpan={8} className="py-1.5 px-3 text-[10px] uppercase tracking-wider font-bold text-slate-600">
                  {group}
                </th>
              </tr>
              {rows
                .filter(r => r.group === group)
                .map(r => (
                  <tr key={r.name} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-slate-900 whitespace-nowrap">{r.name}</td>
                    <td className="py-2.5 px-3 text-slate-600 min-w-[180px]">{r.provides}</td>
                    <td className="py-2.5 px-3 min-w-[220px]">{r.origin}</td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${ARRIVAL[r.arrives].box}`}>
                        {ARRIVAL[r.arrives].icon}
                        {r.arrives}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 min-w-[170px]">{r.schedule}</td>
                    <td className="py-2.5 px-3 text-slate-600 min-w-[220px]">{r.todayText}</td>
                    <td className="py-2.5 px-3 min-w-[170px]">
                      {r.fresh ? (
                        <div className="space-y-1">
                          <FreshnessPill item={r.fresh} showLabels={false} />
                          {r.fresh.status !== 'fresh' && <p className="text-[10px] text-slate-500 leading-snug">{r.fresh.message}</p>}
                        </div>
                      ) : r.arrives === 'Static' ? (
                        <span className="text-[11px] text-slate-400">Static</span>
                      ) : r.arrives === 'Not connected' ? (
                        <span className="text-[11px] text-slate-400">No data</span>
                      ) : (
                        <span className="text-[11px] text-slate-400">{r.lastNote ?? 'Not dated'}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 min-w-[150px]">{r.usedOn}</td>
                  </tr>
                ))}
            </tbody>
          ))}
        </table>
      </div>
    </div>
  );
};
