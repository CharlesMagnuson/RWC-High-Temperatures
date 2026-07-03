export function pacificTodayISO(now: Date = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
}

/** Epoch seconds of local midnight in America/Los_Angeles, DST-safe. */
export function pacificMidnightEpoch(dateISO: string): number {
  for (const off of ['-07:00', '-08:00']) {
    const ms = Date.parse(`${dateISO}T00:00:00${off}`);
    const d = new Date(ms);
    const sameDay = d.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }) === dateISO;
    const hour = d.toLocaleTimeString('en-GB', { timeZone: 'America/Los_Angeles', hour: '2-digit' });
    if (sameDay && hour === '00') return ms / 1000;
  }
  throw new Error(`cannot resolve Pacific midnight for ${dateISO}`);
}
