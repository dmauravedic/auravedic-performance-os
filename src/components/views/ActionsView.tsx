import React, { useState } from 'react';
import { useDashboard } from '../../context/DashboardContext';
import { useActionPlan } from '../../utils/useActionPlan';
import {
  IMPACT_LABEL,
  LANES,
  LANE_LABEL,
  URGENCY_LABEL,
  type ActionCard,
  type Lane,
  type Urgency
} from '../../utils/actions';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Eye,
  HelpCircle,
  Info,
  ListChecks,
  ThumbsUp
} from 'lucide-react';

const URGENCY_STYLE: Record<Urgency, { icon: React.ReactNode; pill: string; edge: string }> = {
  urgent: {
    icon: <AlertOctagon className="w-3.5 h-3.5" aria-hidden="true" />,
    pill: 'bg-rose-100 text-rose-800 border-rose-200',
    edge: 'border-l-rose-500'
  },
  week: {
    icon: <CalendarClock className="w-3.5 h-3.5" aria-hidden="true" />,
    pill: 'bg-amber-100 text-amber-900 border-amber-200',
    edge: 'border-l-amber-500'
  },
  watch: {
    icon: <Eye className="w-3.5 h-3.5" aria-hidden="true" />,
    pill: 'bg-slate-100 text-slate-700 border-slate-200',
    edge: 'border-l-slate-300'
  }
};

const SECTION_TITLE: Record<Urgency, string> = {
  urgent: 'Do these today',
  week: 'Do these this week',
  watch: 'Keep an eye on these'
};

const GLOSSARY: { term: string; meaning: string }[] = [
  { term: 'Sent back (RTO)', meaning: 'A parcel that comes back undelivered, usually because the customer refused cash on delivery or was not reachable.' },
  { term: 'COD', meaning: 'Cash on delivery: the customer pays the courier when the parcel arrives.' },
  { term: 'Days left', meaning: 'How long the stock lasts if it keeps selling at the current pace.' },
  { term: '"Needed" return on ads', meaning: 'What every ₹1 of ads must bring back in sales just to pay for the product and shipping, before any profit.' },
  { term: 'Amazon FBA', meaning: "Stock we keep in Amazon's own warehouses so Amazon can ship it." },
  { term: 'Placeholder cost', meaning: 'A stand-in for the real cost of making a product, used until finance supplies the actual figure.' }
];

const ActionCardView: React.FC<{ card: ActionCard; onOpen: () => void }> = ({ card, onOpen }) => {
  const style = URGENCY_STYLE[card.urgency];
  return (
    <article className={`bg-white rounded-xl border border-slate-200 border-l-4 ${style.edge} p-4 shadow-2xs`}>
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border font-semibold ${style.pill}`}>
          {style.icon}
          {URGENCY_LABEL[card.urgency]}
        </span>
        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium">{LANE_LABEL[card.lane]}</span>
        <span className="text-slate-500">{IMPACT_LABEL[card.impact]} impact</span>
      </div>

      <h3 className="mt-2 text-base font-semibold text-slate-900 leading-snug">{card.headline}</h3>
      <p className="mt-1.5 text-sm text-slate-900">
        <span className="font-semibold">What to do: </span>
        {card.doThis}
      </p>
      <p className="mt-1 text-sm text-slate-600">{card.why}</p>

      {card.figure && (
        <p className="mt-2 inline-block rounded-md bg-slate-50 border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-800">
          {card.figure}
        </p>
      )}

      {card.cautions.length > 0 && (
        <div className="mt-2.5 space-y-1.5">
          {card.cautions.map(c => (
            <p
              key={c.text}
              role="note"
              className={`flex items-start gap-1.5 rounded-md border px-2 py-1.5 text-xs leading-snug ${
                c.kind === 'old' ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}
            >
              {c.kind === 'old' ? (
                <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" aria-hidden="true" />
              ) : (
                <Info className="w-3.5 h-3.5 mt-px shrink-0" aria-hidden="true" />
              )}
              <span>
                <span className="font-semibold">{c.kind === 'old' ? 'Old data: ' : 'Rough figure: '}</span>
                {c.text}
              </span>
            </p>
          ))}
        </div>
      )}

      <div className="mt-3">
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 hover:text-amber-950 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2.5 py-1.5 rounded-lg transition-colors"
        >
          {card.viewLabel}
          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>
    </article>
  );
};

export const ActionsView: React.FC = () => {
  const { setCurrentView } = useDashboard();
  const plan = useActionPlan();
  const [lane, setLane] = useState<Lane | 'all'>('all');

  const inLane = <T extends { lane: Lane }>(items: T[]) => (lane === 'all' ? items : items.filter(i => i.lane === lane));
  const actions = inLane(plan.actions);
  const working = inLane(plan.working);
  const laneCount = (l: Lane) => plan.actions.filter(a => a.lane === l).length;
  const showDoubts = lane === 'all' || lane === 'data';

  const dataTone =
    plan.dataNote.tone === 'old'
      ? 'bg-rose-50 border-rose-200 text-rose-800'
      : plan.dataNote.tone === 'ok'
        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
        : 'bg-slate-50 border-slate-200 text-slate-700';

  return (
    <div className="space-y-6">
      <section aria-labelledby="actions-title" className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1.5">
            <ListChecks className="w-3.5 h-3.5" aria-hidden="true" />
            Today's Actions
          </p>
          <h2 id="actions-title" className="mt-1 text-xl font-bold text-slate-900">
            {plan.headline}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            What to do, in order of how soon it matters. Open the page behind any card to see the detail.
          </p>
        </div>

        <p role="note" className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${dataTone}`}>
          {plan.dataNote.tone === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
          ) : (
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
          )}
          <span>{plan.dataNote.text}</span>
        </p>

        <div className="flex items-center overflow-x-auto max-w-full scrollbar-none" role="group" aria-label="Show actions for">
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200/80">
            {(['all', ...LANES] as const).map(l => {
              const active = lane === l;
              const count = l === 'all' ? plan.actions.length : laneCount(l);
              return (
                <button
                  key={l}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setLane(l)}
                  className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-all ${
                    active ? 'bg-amber-600 text-white font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200 font-medium'
                  }`}
                >
                  {l === 'all' ? 'All' : LANE_LABEL[l]}
                  <span className={`ml-1.5 ${active ? 'text-amber-100' : 'text-slate-400'}`}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {actions.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-6 text-sm text-slate-600 flex items-center gap-2 shadow-2xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
          Nothing needs doing here right now.
        </div>
      ) : (
        (['urgent', 'week', 'watch'] as const).map(u => {
          const cards = actions.filter(a => a.urgency === u);
          if (cards.length === 0) return null;
          return (
            <section key={u} aria-labelledby={`section-${u}`} className="space-y-3">
              <h3 id={`section-${u}`} className="text-sm font-bold text-slate-900 flex items-center gap-2">
                {SECTION_TITLE[u]}
                <span className="text-xs font-semibold text-slate-500">{cards.length}</span>
              </h3>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                {cards.map(card => (
                  <ActionCardView key={card.id} card={card} onOpen={() => setCurrentView(card.view)} />
                ))}
              </div>
            </section>
          );
        })
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {working.length > 0 && (
          <section aria-labelledby="working-title" className="bg-white rounded-xl border border-emerald-200 p-4 shadow-2xs">
            <h3 id="working-title" className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ThumbsUp className="w-4 h-4 text-emerald-600" aria-hidden="true" />
              What's working: keep doing it
            </h3>
            <ul className="mt-2.5 space-y-2 text-sm text-slate-700">
              {working.map(w => (
                <li key={w.id} className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-600 shrink-0" aria-hidden="true" />
                  <span>{w.text}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {showDoubts && plan.doubts.length > 0 && (
          <section aria-labelledby="doubts-title" className="bg-white rounded-xl border border-amber-200 p-4 shadow-2xs">
            <h3 id="doubts-title" className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-amber-600" aria-hidden="true" />
              Don't trust these yet
            </h3>
            <ul className="mt-2.5 space-y-2 text-sm text-slate-700">
              {plan.doubts.map(d => (
                <li key={d.id} className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-600 shrink-0" aria-hidden="true" />
                  <span>{d.text}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setCurrentView('data-health')}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 hover:text-amber-950"
            >
              See where each number comes from
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </section>
        )}
      </div>

      <details className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
        <summary className="cursor-pointer text-sm font-semibold text-slate-900 flex items-center gap-2 select-none">
          <BookOpen className="w-4 h-4 text-slate-500" aria-hidden="true" />
          Words used on this page
        </summary>
        <dl className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2.5 text-sm">
          {GLOSSARY.map(g => (
            <div key={g.term}>
              <dt className="font-semibold text-slate-900">{g.term}</dt>
              <dd className="text-slate-600">{g.meaning}</dd>
            </div>
          ))}
        </dl>
      </details>

      <p className="text-[11px] text-slate-500">
        Built from the last 7 days of sales and ads, the latest stock reports and the report sheets, using the same numbers as the
        other pages. Nothing here is typed in by hand.
      </p>
    </div>
  );
};
