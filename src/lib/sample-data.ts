import type { DayRecord } from './records';

/**
 * Deterministic 28-day sample ending 2026-07-02, exercising: hot and cold days,
 * every intensity bin, the ±1 neutral band, a missing actual, a missing
 * forecast, and a June→July month boundary.
 */
export function sampleRecords(): DayRecord[] {
  const deltas: (number | 'no-actual' | 'no-forecast')[] = [
    3, 5, -2, 0, 7, 9, 4, 11, 2, 'no-actual', 6, -4, 1, 8,
    3, 6, 8, 5, 11, 2, 0, 'no-forecast', 7, -4, 6, 9, 3, 6,
  ];
  const forecasts = [71, 73, 74, 76, 72, 70, 69, 68, 70, 78, 72, 71, 74, 75,
    71, 73, 74, 76, 72, 70, 69, 68, 70, 78, 72, 71, 74, 75];
  const start = new Date('2026-06-05T00:00:00Z');
  return deltas.map((d, i) => {
    const date = new Date(start.getTime() + i * 86400_000).toISOString().slice(0, 10);
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
