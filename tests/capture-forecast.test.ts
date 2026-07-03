import { describe, it, expect } from 'vitest';
import { shouldSkip } from '../scripts/capture-forecast';
import type { DayRecord } from '../scripts/data-store';

function record(patch: Partial<DayRecord> & { date: string }): DayRecord {
  return {
    forecast_high_f: null,
    actual_high_f: null,
    forecast_captured_at: null,
    actual_captured_at: null,
    ...patch,
  };
}

describe('shouldSkip', () => {
  it('skips when today already has a captured forecast high', () => {
    const records = [record({ date: '2026-07-03', forecast_high_f: 76 })];
    expect(shouldSkip(records, '2026-07-03')).toBe(true);
  });

  it('does not skip when there is no record for today', () => {
    const records = [record({ date: '2026-07-02', forecast_high_f: 75 })];
    expect(shouldSkip(records, '2026-07-03')).toBe(false);
  });

  it('does not skip when today exists but forecast_high_f is null', () => {
    // e.g. the actual-capture job created the record first
    const records = [record({ date: '2026-07-03', actual_high_f: 80 })];
    expect(shouldSkip(records, '2026-07-03')).toBe(false);
  });

  it('does not skip on an empty data file', () => {
    expect(shouldSkip([], '2026-07-03')).toBe(false);
  });
});
