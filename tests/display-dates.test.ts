import { describe, it, expect } from 'vitest';
import { isMonday, monthOf, fmtDay } from '../src/lib/display-dates';

describe('display date helpers', () => {
  it('detects Mondays', () => {
    expect(isMonday('2026-06-29')).toBe(true);
    expect(isMonday('2026-06-28')).toBe(false);
  });
  it('extracts the month key', () => {
    expect(monthOf('2026-07-02')).toBe('2026-07');
  });
  it('formats weekday and month-day labels', () => {
    expect(fmtDay('2026-06-23')).toEqual({ w: 'TUE', md: 'JUN 23' });
  });
});
