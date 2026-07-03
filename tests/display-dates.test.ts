import { describe, it, expect } from 'vitest';
import { isMonday, monthOf, fmtDay, weekOf } from '../src/lib/display-dates';

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
  it('pins the 2-digit day contract', () => {
    expect(fmtDay('2026-06-05')).toEqual({ w: 'FRI', md: 'JUN 05' });
  });
});

describe('weekOf', () => {
  it('maps a Monday to itself', () => {
    expect(weekOf('2026-06-29')).toBe('2026-06-29');
  });
  it('maps a mid-week day to its week-start Monday', () => {
    expect(weekOf('2026-07-02')).toBe('2026-06-29');
  });
  it('maps Sunday to the week starting the previous Monday', () => {
    expect(weekOf('2026-06-28')).toBe('2026-06-22');
  });
});
