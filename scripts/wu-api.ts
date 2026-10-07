/**
 * Direct access to the forecast API behind wunderground.com.
 *
 * WU's pages are a thin client over api.weather.com. Until Sept 2026 the
 * station page server-rendered the API responses into <script
 * id="app-root-state"> (parsed by wu-parse.ts). WU is now rolling out a
 * client-side app shell for the same URL -- served with HTTP 404 and no
 * forecast in it -- which the browser fills by calling the API itself. On
 * 2026-10-04 and 10-05 every attempt at 00:01 PDT got the shell and the
 * forecast for 10-05 was lost. Calling the API directly sidesteps the
 * rollout: the response is one small JSON document, no HTML parsing and no
 * disagreement between differently-aged cached copies.
 *
 * The API key is the public one WU's own frontend uses. It rotates (July
 * 2026: e1f10a1e..., Oct 2026: 53b89abc... in the page, f6d2efe5... in the
 * shell) but old keys keep working for months, so the capture reads the
 * current key out of whatever WU serves and keeps a known-good one as a
 * fallback.
 */

export const API_HOST = 'https://api.weather.com';

/** Most recently observed key; verified live 2026-10-06. */
export const FALLBACK_API_KEY = '53b89abc03d14d7ab89abc03d1dd7ab6';

/**
 * The weather.com API key embedded in a WU page, or null. Handles both
 * shapes: the client-side shell's config (`"API_KEY":"..."`) and the
 * server-rendered page, where the key sits on every cached request URL.
 * The server-rendered page also embeds one unrelated key (401 at the
 * forecast endpoint), so prefer a key on a daily-forecast URL.
 */
export function extractApiKey(html: string): string | null {
  const shell = html.match(/"API_KEY"\s*:\s*"([0-9a-f]{32})"/);
  if (shell) return shell[1];
  const onForecastUrl = html.match(/forecast\/daily\/[^"'&\s]*[?&]apiKey=([0-9a-f]{32})/);
  if (onForecastUrl) return onForecastUrl[1];
  const any = html.match(/apiKey=([0-9a-f]{32})/);
  return any ? any[1] : null;
}

export function dailyForecastUrl(apiKey: string, geocode: string): string {
  const u = new URL('/v3/wx/forecast/daily/5day', API_HOST);
  u.searchParams.set('apiKey', apiKey);
  u.searchParams.set('geocode', geocode);
  u.searchParams.set('units', 'e');
  u.searchParams.set('language', 'en-US');
  u.searchParams.set('format', 'json');
  return u.toString();
}

interface DailyForecast {
  temperatureMax: (number | null)[];
  validTimeLocal: (string | null)[];
}

function isDailyForecast(body: unknown): body is DailyForecast {
  return (
    !!body &&
    typeof body === 'object' &&
    Array.isArray((body as DailyForecast).temperatureMax) &&
    Array.isArray((body as DailyForecast).validTimeLocal)
  );
}

/**
 * The target date's forecasted daytime high (°F) from a v3 daily-forecast
 * response. Same field discipline as wu-parse.ts: `temperatureMax` is what
 * the page displays and is null once the day's daytime has passed, so an
 * off-window capture fails loudly instead of recording the
 * midnight-to-midnight `calendarDayTemperatureMax` nobody was shown.
 */
export function forecastHighFromApi(body: unknown, targetISO: string): number {
  if (!isDailyForecast(body)) throw new Error('weather.com response is not a daily forecast');
  const idx = body.validTimeLocal.findIndex((t) => t?.slice(0, 10) === targetISO);
  if (idx === -1) {
    throw new Error(`target ${targetISO} not found in forecast window starting ${body.validTimeLocal[0]}`);
  }
  const max = body.temperatureMax[idx];
  if (typeof max !== 'number') {
    throw new Error(
      `temperatureMax[${idx}] for ${targetISO} is not a number (got ${JSON.stringify(max)}; daytime already past?)`,
    );
  }
  return max;
}
