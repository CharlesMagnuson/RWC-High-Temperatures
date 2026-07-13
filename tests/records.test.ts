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
  // Rolling date windows (7/30/365 days) anchored on the newest record's
  // date, inclusive — not a count of records, so gaps in capture don't
  // stretch the window.
  const june = Array.from({ length: 30 }, (_, i) =>
    rec(`2026-06-${String(i + 1).padStart(2, '0')}`),
  );

  it('week returns the last 7 days of records', () => {
    expect(dates(sliceView(june, 'week'))).toEqual([
      '2026-06-24',
      '2026-06-25',
      '2026-06-26',
      '2026-06-27',
      '2026-06-28',
      '2026-06-29',
      '2026-06-30',
    ]);
  });

  it('week window is 7 calendar days even when records are missing', () => {
    // Newest is Jun 30; window is Jun 24–30. Jun 23 is 8 days back — excluded
    // even though only 3 records fall inside the window.
    const sparse = [rec('2026-06-10'), rec('2026-06-23'), rec('2026-06-24'), rec('2026-06-27'), rec('2026-06-30')];
    expect(dates(sliceView(sparse, 'week'))).toEqual(['2026-06-24', '2026-06-27', '2026-06-30']);
  });

  it('month returns the last 30 days of records', () => {
    // Anchor Jun 30; 30-day window starts Jun 1, so May 31 is excluded.
    const all = [rec('2026-05-31'), ...june];
    expect(dates(sliceView(all, 'month'))[0]).toBe('2026-06-01');
    expect(sliceView(all, 'month')).toHaveLength(30);
  });

  it('year returns the last 365 days of records', () => {
    const all = [rec('2025-06-29'), rec('2025-07-01'), rec('2026-06-30')];
    // Anchor 2026-06-30; 365-day window starts 2025-07-01.
    expect(dates(sliceView(all, 'year'))).toEqual(['2025-07-01', '2026-06-30']);
  });

  it('returns everything when the dataset is smaller than the window', () => {
    const small = [rec('2026-07-03'), rec('2026-07-04'), rec('2026-07-05')];
    expect(dates(sliceView(small, 'week'))).toEqual(['2026-07-03', '2026-07-04', '2026-07-05']);
  });

  it('returns empty for an empty dataset', () => {
    expect(sliceView([], 'week')).toEqual([]);
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
