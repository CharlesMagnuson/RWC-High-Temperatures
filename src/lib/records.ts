// Single source of truth for the record shape lives in scripts/data-store.ts.
// A type-only re-export is erased at compile time, so no Node code reaches the bundle.
export type { DayRecord } from '../../scripts/data-store';
import type { DayRecord } from '../../scripts/data-store';

export type View = 'week' | 'month' | 'year';
export const VIEW_DAYS: Record<View, number> = { week: 14, month: 31, year: 365 };

/** Last N days of records (records are stored sorted ascending by date). */
export function sliceView(records: DayRecord[], view: View): DayRecord[] {
  return records.slice(-VIEW_DAYS[view]);
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
