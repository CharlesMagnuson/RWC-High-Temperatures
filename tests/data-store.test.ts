import { describe, it, expect } from 'vitest';
import { upsert, type DayRecord } from '../scripts/data-store';

const rec = (date: string, patch: Partial<DayRecord> = {}): DayRecord => ({
  date,
  forecast_high_f: null,
  actual_high_f: null,
  forecast_captured_at: null,
  actual_captured_at: null,
  ...patch,
});

describe('upsert', () => {
  it('adds a new record sorted by date', () => {
    const out = upsert([rec('2026-07-02')], '2026-07-01', { forecast_high_f: 75 });
    expect(out.map((r) => r.date)).toEqual(['2026-07-01', '2026-07-02']);
    expect(out[0].forecast_high_f).toBe(75);
  });

  it('patches an existing record without touching other fields', () => {
    const existing = rec('2026-07-02', { forecast_high_f: 75, forecast_captured_at: 'x' });
    const out = upsert([existing], '2026-07-02', { actual_high_f: 81, actual_captured_at: 'y' });
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual(rec('2026-07-02', {
      forecast_high_f: 75, forecast_captured_at: 'x',
      actual_high_f: 81, actual_captured_at: 'y',
    }));
  });

  it('does not mutate the input array', () => {
    const input = [rec('2026-07-02')];
    upsert(input, '2026-07-02', { actual_high_f: 81 });
    expect(input[0].actual_high_f).toBeNull();
  });
});
