import { describe, it, expect } from 'vitest';
import { sliceView, type DayRecord } from '../src/lib/records';

const rec = (date: string): DayRecord => ({
  date,
  forecast_high_f: 70,
  actual_high_f: 72,
  forecast_captured_at: `${date}T07:05:00Z`,
  actual_captured_at: `${date}T01:05:00Z`,
});

const dates = (records: DayRecord[]) => records.map((r) => r.date);

describe('sliceView trailing windows', () => {
  it('week returns the last 14 records', () => {
    const all = Array.from({ length: 30 }, (_, i) =>
      rec(`2026-06-${String(i + 1).padStart(2, '0')}`),
    );
    expect(sliceView(all, 'week')).toHaveLength(14);
    expect(sliceView(all, 'week')[0].date).toBe('2026-06-17');
  });
});

describe('sliceView seasons', () => {
  // Anchored on the newest record: each season view shows the most recent
  // occurrence of that season that has started as of the newest record.
  const all = [
    rec('2025-09-15'), // fall 2025
    rec('2025-11-30'), // fall 2025 (last day)
    rec('2025-12-01'), // winter 2025-26 (first day)
    rec('2026-01-20'), // winter 2025-26
    rec('2026-02-28'), // winter 2025-26 (last day)
    rec('2026-03-01'), // spring 2026 (first day)
    rec('2026-05-10'), // spring 2026
    rec('2026-06-04'), // summer 2026
    rec('2026-07-02'), // summer 2026 (newest, in-progress season)
  ];

  it('summer shows the in-progress summer window', () => {
    expect(dates(sliceView(all, 'summer'))).toEqual(['2026-06-04', '2026-07-02']);
  });

  it('spring shows the most recent completed spring', () => {
    expect(dates(sliceView(all, 'spring'))).toEqual(['2026-03-01', '2026-05-10']);
  });

  it('winter spans the December year boundary', () => {
    expect(dates(sliceView(all, 'winter'))).toEqual([
      '2025-12-01',
      '2026-01-20',
      '2026-02-28',
    ]);
  });

  it('fall falls back to the previous year when this year’s fall has not started', () => {
    expect(dates(sliceView(all, 'fall'))).toEqual(['2025-09-15', '2025-11-30']);
  });

  it('mid-winter anchor picks the winter that started the previous December', () => {
    const midWinter = [rec('2025-12-20'), rec('2026-01-15')];
    expect(dates(sliceView(midWinter, 'winter'))).toEqual(['2025-12-20', '2026-01-15']);
  });

  it('returns empty for an empty dataset', () => {
    expect(sliceView([], 'winter')).toEqual([]);
  });

  it('returns empty when no records fall inside the season window', () => {
    const summerOnly = [rec('2026-06-04'), rec('2026-07-02')];
    expect(sliceView(summerOnly, 'spring')).toEqual([]);
  });
});
