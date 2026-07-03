/** Weekday of a YYYY-MM-DD string; date-only, so UTC parsing is exact. */
export const weekday = (dateISO: string): number => new Date(`${dateISO}T00:00:00Z`).getUTCDay();

export const isMonday = (dateISO: string): boolean => weekday(dateISO) === 1;

export const monthOf = (dateISO: string): string => dateISO.slice(0, 7);

/**
 * YYYY-MM-DD of the week-start Monday for the given date (weeks begin Monday).
 * Compare weekOf of adjacent records to draw week separators — robust to
 * missing days, unlike checking isMonday on the current record.
 */
export function weekOf(dateISO: string): string {
  const d = new Date(`${dateISO}T00:00:00Z`);
  const shift = (d.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  return new Date(d.getTime() - shift * 86_400_000).toISOString().slice(0, 10);
}

export function fmtDay(dateISO: string): { w: string; md: string } {
  const d = new Date(`${dateISO}T00:00:00Z`);
  const w = d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }).toUpperCase();
  const md = d
    .toLocaleDateString('en-US', { month: 'short', day: '2-digit', timeZone: 'UTC' })
    .toUpperCase();
  return { w, md };
}
