import type { DailyRecord } from '../data/dailyData';
import type { ChannelFilter } from '../context/DashboardContext';
import { formatDay, formatDayRange } from './periods';

/**
 * Which days have figures for which sources.
 *
 * Days the sync adds after the bundled series carry a `missing` list: the sources with no figures for
 * that day yet (Flipkart, Nykaa and Myntra have no daily feed; Shopify and Google until theirs is
 * connected; Amazon runs a day or two behind). Their fields are 0 in the data, and 0 there means "not
 * reported yet", never "sold nothing".
 *
 * The rule every page follows: a figure only counts the days where every source it needs is reported.
 * Spend is never divided by sales that are missing, and a total never treats a missing day as zero.
 * When a period loses days that way, the page says which, and hides the % change (a part-period
 * against a full prior period would mislead).
 */

export type ReportedSource = 'shopify' | 'amazon' | 'flipkart' | 'nykaa' | 'myntra' | 'meta' | 'google';

export const SOURCE_NAMES: Record<ReportedSource, string> = {
  shopify: 'Shopify',
  amazon: 'Amazon',
  flipkart: 'Flipkart',
  nykaa: 'Nykaa',
  myntra: 'Myntra',
  meta: 'Meta Ads',
  google: 'Google Ads'
};

/** Sources a channel view's figures need. "All" is Shopify + Amazon with their ads, as in the P&L. */
export const CHANNEL_SOURCES: Record<ChannelFilter, ReportedSource[]> = {
  all: ['shopify', 'amazon', 'meta', 'google'],
  shopify: ['shopify', 'meta', 'google'],
  amazon: ['amazon'],
  flipkart: ['flipkart'],
  nykaa: ['nykaa'],
  myntra: ['myntra']
};

export const isReported = (r: DailyRecord, source: ReportedSource): boolean => !r.missing?.includes(source);

/** The days of `slice` where every one of `sources` is reported. */
export function reportedDays(slice: DailyRecord[], sources: ReportedSource[]): DailyRecord[] {
  return slice.filter(r => sources.every(s => isReported(r, s)));
}

/** The newest `n` days where every one of `sources` is reported (oldest first). */
export function lastReportedDays(records: DailyRecord[], sources: ReportedSource[], n: number): DailyRecord[] {
  return reportedDays(records, sources).slice(-n);
}

/** A value for a chart: the field when the source has the day, otherwise null (drawn as a gap). */
export function chartValue(r: DailyRecord, sources: ReportedSource[], value: number): number | null {
  return sources.every(s => isReported(r, s)) ? value : null;
}

export interface Gap {
  /** Sources with at least one unreported day in the period, in a fixed order. */
  sources: ReportedSource[];
  /** Days of the period left out of the figures. */
  days: string[];
  /** Days in the period, and how many of them the figures count. */
  totalDays: number;
  countedDays: number;
  /** True when no day of the period has everything: the figures would be empty. */
  whole: boolean;
  /** Plain-English line, e.g. "Shopify and Google Ads not reported yet for 26 Oct–3 Nov. Figures cover 7 of 16 days." */
  text: string;
}

const listOf = (xs: string[]) =>
  xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;

/** Day list as ranges: "26 Oct–3 Nov", or "26–28 Oct, 1 Nov". */
export function formatDays(dates: string[]): string {
  if (!dates.length) return '';
  const sorted = [...dates].sort();
  const runs: [string, string][] = [];
  const next = (iso: string) => new Date(Date.parse(`${iso}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  for (const d of sorted) {
    const run = runs[runs.length - 1];
    if (run && next(run[1]) === d) run[1] = d;
    else runs.push([d, d]);
  }
  return runs.map(([a, b]) => (a === b ? formatDay(a) : formatDayRange(a, b))).join(', ');
}

/** What the figures for `sources` leave out of `slice`, or null when every day is complete. */
export function gapFor(slice: DailyRecord[], sources: ReportedSource[]): Gap | null {
  const left = slice.filter(r => sources.some(s => !isReported(r, s)));
  if (!left.length) return null;
  const order = (Object.keys(SOURCE_NAMES) as ReportedSource[]).filter(s => sources.includes(s));
  const gapSources = order.filter(s => left.some(r => !isReported(r, s)));
  // Sources missing the same days are named together: "Shopify and Google Ads not reported yet for
  // 1–3 Nov; Amazon for 3 Nov."
  const groups: { names: string[]; days: string }[] = [];
  for (const s of gapSources) {
    const days = formatDays(left.filter(r => !isReported(r, s)).map(r => r.date));
    const g = groups.find(x => x.days === days);
    if (g) g.names.push(SOURCE_NAMES[s]);
    else groups.push({ names: [SOURCE_NAMES[s]], days });
  }
  const what = groups.map((g, i) => `${listOf(g.names)} ${i === 0 ? 'not reported yet for ' : 'for '}${g.days}`).join('; ');
  const counted = slice.length - left.length;
  const whole = counted === 0;
  const text = whole ? `${what}.` : `${what}. Figures cover the other ${counted} of ${slice.length} days.`;
  return { sources: gapSources, days: left.map(r => r.date), totalDays: slice.length, countedDays: counted, whole, text };
}

/** Every source not reported on some day of `slice`, whichever figure needs it (for the page banner). */
export function anyGap(slice: DailyRecord[]): { source: ReportedSource; days: string[] }[] {
  const out: { source: ReportedSource; days: string[] }[] = [];
  for (const s of Object.keys(SOURCE_NAMES) as ReportedSource[]) {
    const days = slice.filter(r => !isReported(r, s)).map(r => r.date);
    if (days.length) out.push({ source: s, days });
  }
  return out;
}
