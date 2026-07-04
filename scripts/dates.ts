export function pacificTodayISO(now: Date = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
}

/**
 * Date a forecast capture should record. The capture is scheduled for 21:xx
 * Pacific the evening before, so from 21:00 the target is tomorrow. GitHub
 * delivers scheduled runs hours late; a run that slips past midnight lands on
 * the very day the forecast is for, so the target becomes the current day.
 */
export function pacificForecastTargetISO(now: Date = new Date()): string {
  const hour = Number(
    now.toLocaleTimeString('en-GB', { timeZone: 'America/Los_Angeles', hour12: false, hour: '2-digit' }),
  );
  // +24h stays within tomorrow even across a DST transition (21:00 shifts to 20:00/22:00).
  return hour >= 21 ? pacificTodayISO(new Date(now.getTime() + 86_400_000)) : pacificTodayISO(now);
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
