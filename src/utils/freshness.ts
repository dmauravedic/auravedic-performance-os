import { useEffect, useMemo, useState } from 'react';
import { useDashboard } from '../context/DashboardContext';
import type { DashboardDataBundle } from '../data/initialData';
import { FRESHNESS_RULES, LATENCY_SOURCES, type FreshnessRule, type LatencySourceKey } from '../data/channelLatency';

/**
 * fresh         inside the source's normal schedule
 * expected-lag  behind, but by the source's own design (a note, never a flag)
 * stale         older than the source should ever be: the figures are not current
 * unknown       the source carries no date
 * static        reference data, nothing to check
 */
export type FreshnessStatus = 'fresh' | 'expected-lag' | 'stale' | 'unknown' | 'static';

export interface SourceFreshness {
  key: LatencySourceKey;
  label: string;
  asOf: Date | null;
  ageHours: number | null;
  status: FreshnessStatus;
  /** Plain-language reading of the status. */
  message: string;
  /** Short form for a card. */
  short: string;
  rule?: FreshnessRule;
}

const IST_OFFSET_MS = 330 * 60 * 1000;

/** "2026-10-25 23:59 IST (…)" or "2026-10-25" (a bare date means the end of that day, IST). */
export function parseAsOf(text: string | undefined): Date | null {
  const m = /(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?/.exec(text ?? '');
  if (!m) return null;
  const hasTime = m[4] !== undefined;
  const hour = hasTime ? Number(m[4]) : 23;
  const minute = hasTime ? Number(m[5]) : 59;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), hour, minute) - IST_OFFSET_MS);
}

/** Last moment of a "YYYY-MM" month, IST. */
export function monthEnd(monthKey: string): Date | null {
  const m = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]), 0, 23, 59) - IST_OFFSET_MS);
}

const latestMonthKey = (data: DashboardDataBundle, channel: string): string | null => {
  const keys = (data.marketplaceAds ?? []).filter(a => a.channel === channel).map(a => a.monthKey);
  return keys.length ? keys.sort()[keys.length - 1] : null;
};

/** When the data behind a source was last updated, as far as the bundle can tell. */
export function asOfFor(key: LatencySourceKey, data: DashboardDataBundle): Date | null {
  const f = data.freshness;
  switch (key) {
    case 'shopify':
      return parseAsOf(f.shopifySales);
    case 'meta':
      return parseAsOf(f.metaAds);
    case 'google':
      return parseAsOf(f.googleAds);
    case 'amazonSales':
      return parseAsOf(f.amazonSales);
    case 'amazonSettlement':
      return parseAsOf(f.amazonSettlement);
    case 'flipkart':
      return parseAsOf(f.flipkartOrders);
    case 'warehouse':
      return parseAsOf(f.warehouseStock);
    case 'amazonAds': {
      const k = latestMonthKey(data, 'Amazon.in');
      return k ? monthEnd(k) : null;
    }
    case 'flipkartAds': {
      const k = latestMonthKey(data, 'Flipkart');
      return k ? monthEnd(k) : null;
    }
    case 'nykaa':
    case 'myntra':
    case 'purplleAds':
    case 'snapdealAds': {
      const channel = { nykaa: 'Nykaa', myntra: 'Myntra', purplleAds: 'Purplle', snapdealAds: 'Snapdeal' }[key];
      const k = latestMonthKey(data, channel);
      return k ? monthEnd(k) : null;
    }
    default:
      return null;
  }
}

export function formatAge(hours: number): string {
  if (hours < 1) return 'under 1h';
  if (hours < 48) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}

const formatLimit = (hours: number): string => (hours < 72 ? `${hours} hours` : `${Math.round(hours / 24)} days`);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "25 Oct, 23:59" in IST, or "Aug 2026" for a monthly report. */
export function formatAsOf(date: Date, grain?: 'month'): string {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  if (grain === 'month') return `${MONTHS[ist.getUTCMonth()]} ${ist.getUTCFullYear()}`;
  const hh = String(ist.getUTCHours()).padStart(2, '0');
  const mm = String(ist.getUTCMinutes()).padStart(2, '0');
  return `${ist.getUTCDate()} ${MONTHS[ist.getUTCMonth()]}, ${hh}:${mm}`;
}

/** The latest Monday-to-Saturday 23:00 IST stock run that should already be in (one hour of processing). */
function lastWarehouseRun(now: Date): Date {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  for (let back = 0; back < 9; back += 1) {
    const day = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() - back));
    if (day.getUTCDay() === 0) continue; // no Sunday run
    const run = new Date(day.getTime() + 23 * 3_600_000 - IST_OFFSET_MS);
    if (run.getTime() + 3_600_000 <= now.getTime()) return run;
  }
  return now;
}

export function evaluateFreshness(key: LatencySourceKey, data: DashboardDataBundle, now: Date): SourceFreshness {
  const label = LATENCY_SOURCES[key].label;
  const rule = FRESHNESS_RULES[key];
  const asOf = asOfFor(key, data);

  if (!rule && key !== 'inventoryPlan') {
    return { key, label, asOf: null, ageHours: null, status: 'static', message: 'Static reference data', short: 'Reference data' };
  }
  if (!asOf || !rule) {
    return {
      key,
      label,
      asOf: null,
      ageHours: null,
      status: 'unknown',
      message: 'No update date is recorded for this source, so it cannot be checked for staleness.',
      short: 'Update date not recorded',
      rule
    };
  }

  const ageHours = Math.max(0, (now.getTime() - asOf.getTime()) / 3_600_000);
  const age = formatAge(ageHours);

  // The stock desk skips Sundays, so a long gap is only expected when no scheduled run was missed.
  if (key === 'warehouse') {
    const due = lastWarehouseRun(now);
    if (asOf.getTime() < due.getTime() - 30 * 60_000) {
      return {
        key,
        label,
        asOf,
        ageHours,
        status: 'stale',
        message: `Stale: a nightly stock report is missing. The latest is from ${formatAsOf(asOf)} (${age} old), and the ${formatAsOf(due)} report should be in.`,
        short: `Stale, ${age} old`,
        rule
      };
    }
  }

  if (ageHours > rule.staleAfterHours) {
    const context = rule.lagNote ? ` Normally it runs behind by design, but not this far.` : '';
    return {
      key,
      label,
      asOf,
      ageHours,
      status: 'stale',
      message: `Stale: the latest data is ${age} old, and this source should be no older than ${formatLimit(rule.staleAfterHours)}.${context}`,
      short: `Stale, ${age} old`,
      rule
    };
  }
  if (rule.expectedLagHours !== undefined && ageHours > rule.expectedLagHours) {
    return {
      key,
      label,
      asOf,
      ageHours,
      status: 'expected-lag',
      message: rule.lagNote ?? 'Behind by design.',
      short: rule.lagShort ?? 'Behind by design',
      rule
    };
  }
  return { key, label, asOf, ageHours, status: 'fresh', message: `Up to date (${age} old).`, short: 'Up to date', rule };
}

/** Clock for the freshness checks. `?now=2026-10-30T10:00` previews the page as of another moment. */
export function useNow(): Date {
  const override = useMemo(() => {
    try {
      const raw = new URLSearchParams(window.location.search).get('now');
      if (!raw) return null;
      const withZone = /(Z|[+-]\d{2}:?\d{2})$/.test(raw) ? raw : `${raw}+05:30`;
      const d = new Date(withZone);
      return Number.isNaN(d.getTime()) ? null : d;
    } catch {
      return null;
    }
  }, []);
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    if (override) return;
    const id = window.setInterval(() => setTick(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, [override]);
  return override ?? new Date(tick);
}

export function usePreviewingNow(): boolean {
  try {
    return new URLSearchParams(window.location.search).has('now');
  } catch {
    return false;
  }
}

export function useSourceFreshness(keys: LatencySourceKey[]): SourceFreshness[] {
  const { data } = useDashboard();
  const now = useNow();
  const id = keys.join('|');
  return useMemo(() => keys.map(k => evaluateFreshness(k, data, now)), [id, data, now]); // eslint-disable-line react-hooks/exhaustive-deps
}

const SEVERITY: Record<FreshnessStatus, number> = { stale: 4, unknown: 3, 'expected-lag': 2, fresh: 1, static: 0 };

/** The source that matters most on a card: stale first, then undated, then behind-by-design. */
export function worstOf(items: SourceFreshness[]): SourceFreshness | null {
  const checked = items.filter(i => i.status !== 'static');
  if (checked.length === 0) return null;
  return checked.reduce((a, b) => {
    if (SEVERITY[b.status] !== SEVERITY[a.status]) return SEVERITY[b.status] > SEVERITY[a.status] ? b : a;
    return (b.ageHours ?? 0) > (a.ageHours ?? 0) ? b : a;
  });
}

/** Sources that share the same update time and status are shown once. */
export function groupFreshness(items: SourceFreshness[]): { labels: string[]; item: SourceFreshness }[] {
  const groups: { labels: string[]; item: SourceFreshness }[] = [];
  for (const item of items) {
    if (item.status === 'static') continue;
    const sig = `${item.asOf?.getTime() ?? 'none'}|${item.status}`;
    const existing = groups.find(g => `${g.item.asOf?.getTime() ?? 'none'}|${g.item.status}` === sig);
    if (existing) existing.labels.push(item.label);
    else groups.push({ labels: [item.label], item });
  }
  return groups;
}
