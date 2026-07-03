interface DailyForecast {
  calendarDayTemperatureMax: (number | null)[];
  validTimeLocal: (string | null)[];
}

interface Candidate {
  daily: DailyForecast;
  url: string;
}

/**
 * Walk the state object collecting every cached API response that looks like a
 * daily forecast: an object with a string `u` (request URL) and an object `b`
 * (response body) containing both forecast arrays. Keeps walking after a match
 * so wu-next-state-key duplicate copies are collected too.
 */
function collectCandidates(obj: unknown, out: Candidate[]): void {
  if (obj && typeof obj === 'object') {
    const o = obj as Record<string, unknown>;
    if (typeof o.u === 'string' && o.b && typeof o.b === 'object') {
      const b = o.b as Record<string, unknown>;
      if (Array.isArray(b.calendarDayTemperatureMax) && Array.isArray(b.validTimeLocal)) {
        out.push({ daily: b as unknown as DailyForecast, url: o.u });
      }
    }
    for (const v of Object.values(o)) {
      collectCandidates(v, out);
    }
  }
}

/**
 * Extract today's forecasted calendar-day high (°F) from the WU forecast page.
 * WU server-renders its API responses into <script id="app-root-state"> with
 * HTML-entity encoding (&q; for quotes). Keys are per-request hashes, so the
 * daily-forecast responses are found structurally. `&a;` must be decoded last.
 *
 * The state blob caches responses for multiple locations (e.g. a nearby
 * airport's forecast alongside the station's), so candidates are filtered to
 * daily-forecast URLs for the given geocode (WU URL-encodes the comma as %2C).
 * If the surviving candidates disagree about today's high, that's a drift
 * signal and we throw rather than silently record the wrong location.
 *
 * Today's entry is looked up by date, NOT assumed to be index 0 — shortly
 * after midnight WU's state can still list yesterday as day zero.
 */
export function extractForecastHigh(html: string, todayISO: string, geocode: string): number {
  const m = html.match(/<script[^>]*id="app-root-state"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('app-root-state script tag not found — page structure changed?');
  const json = m[1]
    .replaceAll('&q;', '"')
    .replaceAll('&s;', "'")
    .replaceAll('&l;', '<')
    .replaceAll('&g;', '>')
    .replaceAll('&a;', '&');
  let state: unknown;
  try {
    state = JSON.parse(json);
  } catch (e) {
    throw new Error(`app-root-state JSON parse failed (encoding drift?): ${(e as Error).message}`);
  }

  const all: Candidate[] = [];
  collectCandidates(state, all);
  const candidates = all.filter(
    (c) => c.url.includes('forecast/daily') && c.url.replaceAll('%2C', ',').includes(geocode),
  );
  if (candidates.length === 0) {
    throw new Error(`no daily forecast response for geocode ${geocode} in app-root-state`);
  }

  const found: { value: number; url: string }[] = [];
  for (const { daily, url } of candidates) {
    const idx = daily.validTimeLocal.findIndex((t) => t?.slice(0, 10) === todayISO);
    if (idx === -1) continue;
    const max = daily.calendarDayTemperatureMax[idx];
    if (typeof max !== 'number') {
      throw new Error(`calendarDayTemperatureMax[${idx}] is not a number (got ${JSON.stringify(max)}) from ${url}`);
    }
    found.push({ value: max, url });
  }
  if (found.length === 0) {
    throw new Error(
      `today ${todayISO} not found in forecast window starting ${candidates[0].daily.validTimeLocal[0]}`,
    );
  }
  const distinct = [...new Set(found.map((f) => f.value))];
  if (distinct.length > 1) {
    const detail = found.map((f) => `${f.value} (${f.url})`).join(' vs ');
    throw new Error(`conflicting forecast highs for ${todayISO}: ${detail}`);
  }
  return distinct[0];
}
