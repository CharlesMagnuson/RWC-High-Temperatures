export type Mode = 'light' | 'dark';

/**
 * Diverging arms, validated with the dataviz ordinal validator (spec §Dashboard).
 * Index 0 = |Δ| 1-3°F … index 4 = |Δ| ≥ 9°F.
 * Both modes: pale near ±1, saturated at the extremes (per user decision —
 * dark mode intentionally does NOT flip the ramp anchor).
 */
export const ARMS: Record<Mode, { hot: string[]; cold: string[] }> = {
  light: {
    hot: ['#e59b92', '#dd7e74', '#d55f56', '#ca3c36', '#bb0916'],
    cold: ['#7ebadd', '#5aa5d2', '#2a90ca', '#007abe', '#0064ab'],
  },
  dark: {
    hot: ['#ebb0a9', '#e68e83', '#df695e', '#d1433c', '#bc191d'],
    cold: ['#95c9e8', '#68b3e0', '#329cd9', '#0084cb', '#006cb6'],
  },
};

export const binOf = (delta: number): number => {
  const a = Math.abs(delta);
  return a >= 9 ? 4 : a >= 7 ? 3 : a >= 5 ? 2 : a >= 3 ? 1 : 0;
};

/** null = inside the |Δ| < 1 neutral band (rendered as a single gray dot); exactly ±1 is bin 0, not neutral. */
export function colorOf(delta: number, mode: Mode): string | null {
  if (Math.abs(delta) < 1) return null;
  const arm = delta > 0 ? ARMS[mode].hot : ARMS[mode].cold;
  return arm[binOf(delta)];
}

/**
 * Chip text color by fill luminance (WCAG relative luminance, 0.35 threshold).
 * Expects a 6-hex `#rrggbb` string only (no shorthand, no alpha channel).
 */
export function inkFor(hex: string): string {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.35 ? '#0c090c' : '#ffffff';
}
