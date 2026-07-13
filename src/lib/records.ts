// Single source of truth for the record shape lives in scripts/data-store.ts.
// A type-only re-export is erased at compile time, so no Node code reaches the bundle.
export type { DayRecord } from '../../scripts/data-store';
import type { DayRecord } from '../../scripts/data-store';

export type Season = 'spring' | 'summer' | 'fall' | 'winter';
export type View = 'week' | 'month' | 'year' | Season;

const VIEW_DAYS = { week: 7, month: 30, year: 365 } as const;

// Meteorological seasons: month-aligned windows keep the math to ISO string
// comparisons (no timezone handling). Winter runs Dec 1 → end of February.
const SEASON_START_MONTH: Record<Season, number> = { spring: 3, summer: 6, fall: 9, winter: 12 };

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * Inclusive date window of the most recent occurrence of `season` that has
 * started as of `anchor` (an ISO date, normally the newest record's date).
 * E.g. anchor 2026-07-02: summer → 2026-06-01..2026-08-31 (in progress),
 * fall → 2025-09-01..2025-11-30, winter → 2025-12-01..2026-02-28.
 */
export function seasonRange(season: Season, anchor: string): { start: string; end: string } {
  const anchorYear = Number(anchor.slice(0, 4));
  const month = SEASON_START_MONTH[season];
  const startYear = `${anchorYear}-${pad2(month)}-01` <= anchor ? anchorYear : anchorYear - 1;
  const endMonth = month + 2; // third month of the season; 14 = February of the next year
  const endYear = startYear + (endMonth > 12 ? 1 : 0);
  const em = endMonth > 12 ? endMonth - 12 : endMonth;
  // Day 0 of the following month = last day of `em` (handles leap February).
  const lastDay = new Date(Date.UTC(endYear, em, 0)).getUTCDate();
  return { start: `${startYear}-${pad2(month)}-01`, end: `${endYear}-${pad2(em)}-${pad2(lastDay)}` };
}

/** ISO date `days` before `dateISO`; UTC ms arithmetic is exact for date-only values. */
const daysBefore = (dateISO: string, days: number): string =>
  new Date(new Date(`${dateISO}T00:00:00Z`).getTime() - days * 86_400_000)
    .toISOString()
    .slice(0, 10);

/**
 * Records visible in a view, all anchored on the newest record's date
 * (records are stored sorted ascending by date). Week/month/year are rolling
 * windows of the last 7/30/365 calendar days inclusive of the anchor — date
 * windows, not record counts, so capture gaps don't stretch them. Seasons
 * are calendar windows.
 */
export function sliceView(records: DayRecord[], view: View): DayRecord[] {
  const anchor = records[records.length - 1]?.date;
  if (!anchor) return [];
  if (view === 'week' || view === 'month' || view === 'year') {
    const start = daysBefore(anchor, VIEW_DAYS[view] - 1);
    return records.filter((r) => r.date >= start);
  }
  const { start, end } = seasonRange(view, anchor);
  return records.filter((r) => r.date >= start && r.date <= end);
}

export const deltaOf = (r: DayRecord): number | null =>
  r.forecast_high_f !== null && r.actual_high_f !== null
    ? r.actual_high_f - r.forecast_high_f
    : null;

export function meanDelta(records: DayRecord[]): number | null {
  const ds = records.map(deltaOf).filter((d): d is number => d !== null);
  if (ds.length === 0) return null;
  return ds.reduce((a, b) => a + b, 0) / ds.length;
}
