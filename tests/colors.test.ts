import { describe, it, expect } from 'vitest';
import { ARMS, binOf, colorOf, inkFor } from '../src/lib/colors';

describe('binOf', () => {
  it('maps |Δ| to bins 0-4 at thresholds 3/5/7/9', () => {
    expect([1, 2.9, 3, 5, 7, 9, 15].map(binOf)).toEqual([0, 0, 1, 2, 3, 4, 4]);
  });
});

describe('colorOf', () => {
  it('returns null inside the ±1 neutral band', () => {
    expect(colorOf(0.5, 'light')).toBeNull();
    expect(colorOf(-0.9, 'dark')).toBeNull();
  });
  it('uses the hot arm for positive Δ and cold for negative', () => {
    expect(colorOf(11, 'light')).toBe(ARMS.light.hot[4]);
    expect(colorOf(-4, 'dark')).toBe(ARMS.dark.cold[1]);
  });
});

describe('inkFor', () => {
  it('picks dark ink on pale fills and white on saturated fills', () => {
    expect(inkFor(ARMS.dark.hot[0])).toBe('#0c090c'); // pale wash
    expect(inkFor(ARMS.light.hot[4])).toBe('#ffffff'); // saturated
  });
});
