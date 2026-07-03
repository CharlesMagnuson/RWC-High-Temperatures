import { describe, it, expect } from 'vitest';
import { pacificTodayISO, pacificMidnightEpoch } from '../scripts/dates';

describe('pacificTodayISO', () => {
  it('formats a known instant in Pacific time', () => {
    // 2026-07-03T03:00Z is 2026-07-02 20:00 PDT
    expect(pacificTodayISO(new Date('2026-07-03T03:00:00Z'))).toBe('2026-07-02');
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
