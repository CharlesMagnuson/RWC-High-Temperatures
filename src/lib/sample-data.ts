import type { DayRecord } from './records';

/**
 * Deterministic 28-record sample spanning 2026-06-04 → 2026-07-02 (29 calendar
 * days), exercising: hot and cold days, every intensity bin, the neutral band,
 * a missing actual, a missing forecast, a June→July month boundary, and a true
 * array gap — Monday 2026-06-22 is entirely absent, as happens in production
 * when both captures fail for a day.
 */
export function sampleRecords(): DayRecord[] {
  const deltas: (number | 'no-actual' | 'no-forecast')[] = [
    3, 5, -2, 0, 7, 9, 4, 11, 2, 'no-actual', 6, -4, 1, 8,
    3, 6, 8, 5, 11, 2, 0, 'no-forecast', 7, -4, 6, 9, 3, 6,
  ];
  const forecasts = [71, 73, 74, 76, 72, 70, 69, 68, 70, 78, 72, 71, 74, 75,
    71, 73, 74, 76, 72, 70, 69, 68, 70, 78, 72, 71, 74, 75];
  const start = new Date('2026-06-04T00:00:00Z');
  const dates = Array.from({ length: 29 }, (_, i) =>
    new Date(start.getTime() + i * 86400_000).toISOString().slice(0, 10),
  ).filter((date) => date !== '2026-06-22');
  return deltas.map((d, i) => {
    const date = dates[i];
    const f = forecasts[i];
    return {
      date,
      forecast_high_f: d === 'no-forecast' ? null : f,
      actual_high_f: d === 'no-actual' || d === 'no-forecast' ? (d === 'no-forecast' ? f + 4 : null) : f + (d as number),
      forecast_captured_at: d === 'no-forecast' ? null : `${date}T07:05:00Z`,
      actual_captured_at: d === 'no-actual' ? null : `${date}T01:05:00Z`,
    };
  });
}
