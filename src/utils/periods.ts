import { dailyRecords, DailyRecord } from '../data/dailyData';
import type { TimePeriod } from '../context/DashboardContext';

/**
 * Period windows for the daily series. Every window hangs off the newest date in the data, so when
 * the sync adds days the dashboard rolls forward by itself: "Yesterday" is the newest day, "MTD" is
 * the month that day falls in, and the prior window is the same span just before it.
 */

export interface ResolvedPeriod {
  current: DailyRecord[];
  prior: DailyRecord[];
  periodLabel: string;
  priorLabel: string;
  isSingleDay: boolean;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_MS = 86_400_000;

const parts = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m, d };
};
const toUtc = (iso: string) => {
  const { y, m, d } = parts(iso);
  return Date.UTC(y, m - 1, d);
};
const toIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const shift = (iso: string, days: number) => toIso(toUtc(iso) + days * DAY_MS);

/** "25 Oct" */
export function formatDay(iso: string): string {
  const { m, d } = parts(iso);
  return `${d} ${MONTHS[m - 1]}`;
}

/** "19–25 Oct", "28 Sep–11 Oct", or "25 Oct" for a single day. */
export function formatDayRange(from: string, to: string): string {
  if (from === to) return formatDay(to);
  const a = parts(from);
  const b = parts(to);
  return a.y === b.y && a.m === b.m ? `${a.d}–${b.d} ${MONTHS[b.m - 1]}` : `${formatDay(from)}–${formatDay(to)}`;
}

const between = (records: DailyRecord[], from: string, to: string) =>
  records.filter(r => r.date >= from && r.date <= to);

/** Newest date in the daily series (YYYY-MM-DD), or '' when there is none. */
export function latestDataDate(records: DailyRecord[] = dailyRecords): string {
  return records.length ? records[records.length - 1].date : '';
}

/** Text for the month-to-date button, e.g. "MTD (Oct '26)". */
export function mtdButtonLabel(records: DailyRecord[] = dailyRecords): string {
  const last = latestDataDate(records);
  if (!last) return 'MTD';
  const { y, m } = parts(last);
  return `MTD (${MONTHS[m - 1]} '${String(y).slice(2)})`;
}

/** Records are expected oldest to newest, as the sync writes them. */
export function resolvePeriod(period: TimePeriod, records: DailyRecord[] = dailyRecords): ResolvedPeriod {
  const last = latestDataDate(records);
  if (!last) {
    return { current: [], prior: [], periodLabel: 'No data', priorLabel: 'No data', isSingleDay: false };
  }

  const rolling = (days: number): ResolvedPeriod => {
    const from = shift(last, -(days - 1));
    const priorFrom = shift(from, -days);
    const priorTo = shift(from, -1);
    return {
      current: between(records, from, last),
      prior: between(records, priorFrom, priorTo),
      periodLabel: `Last ${days} Days (${formatDayRange(from, last)})`,
      priorLabel: `Prior ${days} Days (${formatDayRange(priorFrom, priorTo)})`,
      isSingleDay: false,
    };
  };

  switch (period) {
    case 'yesterday': {
      const before = shift(last, -1);
      return {
        current: between(records, last, last),
        prior: between(records, before, before),
        periodLabel: `Yesterday (${formatDay(last)} ${parts(last).y})`,
        priorLabel: `Prior Day (${formatDay(before)})`,
        isSingleDay: true,
      };
    }

    case '7d':
      return rolling(7);
    case '14d':
      return rolling(14);
    case '30d':
      return rolling(30);

    case 'all': {
      // The whole series against its older half.
      const half = Math.floor(records.length / 2);
      const prior = records.slice(0, half);
      return {
        current: records,
        prior,
        periodLabel: `${records.length}-Day History (${formatDayRange(records[0].date, last)})`,
        priorLabel: half > 0 ? `First ${half} Days (${formatDayRange(prior[0].date, prior[half - 1].date)})` : 'Prior Period',
        isSingleDay: false,
      };
    }

    case 'mtd':
    default: {
      // The month the newest day is in, against the same days of the month before.
      const { y, m, d } = parts(last);
      const from = toIso(Date.UTC(y, m - 1, 1));
      const daysInPrevMonth = new Date(Date.UTC(y, m - 1, 0)).getUTCDate();
      const priorDay = Math.min(d, daysInPrevMonth);
      const priorFrom = toIso(Date.UTC(y, m - 2, 1));
      const priorTo = toIso(Date.UTC(y, m - 2, priorDay));
      const prior = parts(priorFrom);
      const span = (day: number) => (day === 1 ? '1' : `1–${day}`);
      return {
        current: between(records, from, last),
        prior: between(records, priorFrom, priorTo),
        periodLabel: `MTD ${MONTHS[m - 1]} ${span(d)}, ${y}`,
        priorLabel: `${MONTHS[prior.m - 1]} ${span(priorDay)}, ${prior.y}`,
        isSingleDay: false,
      };
    }
  }
}
