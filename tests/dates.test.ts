import { describe, it, expect } from 'vitest';
import { pacificTodayISO, pacificMidnightEpoch, pacificForecastTargetISO } from '../scripts/dates';

describe('pacificTodayISO', () => {
  it('formats a known instant in Pacific time', () => {
    // 2026-07-03T03:00Z is 2026-07-02 20:00 PDT
    expect(pacificTodayISO(new Date('2026-07-03T03:00:00Z'))).toBe('2026-07-02');
  });
});

describe('pacificForecastTargetISO', () => {
  it('targets tomorrow from an on-time evening run (21:05 PDT)', () => {
    // 2026-07-05T04:05Z is 2026-07-04 21:05 PDT
    expect(pacificForecastTargetISO(new Date('2026-07-05T04:05:00Z'))).toBe('2026-07-05');
  });

  it('targets tomorrow from an evening run under PST (21:05 PST)', () => {
    // 2026-01-16T05:05Z is 2026-01-15 21:05 PST
    expect(pacificForecastTargetISO(new Date('2026-01-16T05:05:00Z'))).toBe('2026-01-16');
  });

  it('targets the current day when a delayed run lands after midnight (03:45 PDT)', () => {
    // 2026-07-05T10:45:00Z is 2026-07-05 03:45 PDT — the forecast is for that same day
    expect(pacificForecastTargetISO(new Date('2026-07-05T10:45:00Z'))).toBe('2026-07-05');
  });

  it('targets the current day just before the evening window (20:59 PDT)', () => {
    // 2026-07-05T03:59Z is 2026-07-04 20:59 PDT
    expect(pacificForecastTargetISO(new Date('2026-07-05T03:59:00Z'))).toBe('2026-07-04');
  });
});

describe('pacificMidnightEpoch', () => {
  it('resolves PDT midnight (UTC-7)', () => {
    expect(pacificMidnightEpoch('2026-07-02')).toBe(Date.parse('2026-07-02T00:00:00-07:00') / 1000);
  });
  it('resolves PST midnight (UTC-8)', () => {
    expect(pacificMidnightEpoch('2026-01-15')).toBe(Date.parse('2026-01-15T00:00:00-08:00') / 1000);
  });
});
