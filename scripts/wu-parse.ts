interface DailyForecast {
  calendarDayTemperatureMax: (number | null)[];
  validTimeLocal: string[];
}

function findDaily(obj: unknown): DailyForecast | null {
  if (obj && typeof obj === 'object') {
    const o = obj as Record<string, unknown>;
    if (Array.isArray(o.calendarDayTemperatureMax) && Array.isArray(o.validTimeLocal)) {
      return o as unknown as DailyForecast;
    }
    for (const v of Object.values(o)) {
      const r = findDaily(v);
      if (r) return r;
    }
  }
  return null;
}

/**
 * Extract today's forecasted calendar-day high (°F) from the WU forecast page.
 * WU server-renders its API responses into <script id="app-root-state"> with
 * HTML-entity encoding (&q; for quotes). Keys are per-request hashes, so the
 * daily-forecast object is found structurally. `&a;` must be decoded last.
 * Today's entry is looked up by date, NOT assumed to be index 0 — shortly
 * after midnight WU's state can still list yesterday as day zero.
 */
export function extractForecastHigh(html: string, todayISO: string): number {
  const m = html.match(/<script id="app-root-state"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('app-root-state script tag not found — page structure changed?');
  const json = m[1]
    .replaceAll('&q;', '"')
    .replaceAll('&s;', "'")
    .replaceAll('&l;', '<')
    .replaceAll('&g;', '>')
    .replaceAll('&a;', '&');
  const state = JSON.parse(json);
  const daily = findDaily(state);
  if (!daily) throw new Error('daily forecast object not found in app-root-state');
  const idx = daily.validTimeLocal.findIndex((t) => t?.slice(0, 10) === todayISO);
  if (idx === -1) {
    throw new Error(`today ${todayISO} not found in forecast window starting ${daily.validTimeLocal[0]}`);
  }
  const max = daily.calendarDayTemperatureMax[idx];
  if (typeof max !== 'number') throw new Error(`calendarDayTemperatureMax[${idx}] is not a number`);
  return max;
}
