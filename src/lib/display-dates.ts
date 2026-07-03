/** Weekday of a YYYY-MM-DD string; date-only, so UTC parsing is exact. */
export const weekday = (dateISO: string): number => new Date(`${dateISO}T00:00:00Z`).getUTCDay();

export const isMonday = (dateISO: string): boolean => weekday(dateISO) === 1;

export const monthOf = (dateISO: string): string => dateISO.slice(0, 7);

export function fmtDay(dateISO: string): { w: string; md: string } {
  const d = new Date(`${dateISO}T00:00:00Z`);
  const w = d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }).toUpperCase();
  const md = d
    .toLocaleDateString('en-US', { month: 'short', day: '2-digit', timeZone: 'UTC' })
    .toUpperCase();
  return { w, md };
}
