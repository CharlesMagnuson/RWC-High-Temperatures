import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { extractForecastHigh } from './wu-parse';
import { extractApiKey, dailyForecastUrl, forecastHighFromApi, FALLBACK_API_KEY } from './wu-api';
import { load, save, upsert, type DayRecord } from './data-store';
import { pacificForecastTargetISO } from './dates';

export { FALLBACK_API_KEY };
export const WU_PAGE_URL = 'https://www.wunderground.com/forecast/KCAREDWO201';
const GEOCODE = '37.471,-122.233'; // KCAREDWO201's location; pins the forecast to this station
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
// WU's shell-vs-page lottery is per request (2026-10-06: 5 of 6 requests got
// the shell), so many quick tries beat few slow ones. 12 x 3 min = 33 min,
// well inside the workflow timeout and the 00:00-06:59 start-of-day window.
// Was 3 x 10 min, which 10-04 and 10-05 exhausted.
const ATTEMPTS = 12;
const RETRY_DELAY_MS = 3 * 60 * 1000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * True when the target date's forecast is already captured, so a second run
 * (both crons pass the guard under PDT, and a delayed firing may land after
 * an on-time one already captured) is a no-op. First capture wins.
 */
export function shouldSkip(records: DayRecord[], target: string): boolean {
  return typeof records.find((r) => r.date === target)?.forecast_high_f === 'number';
}

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

function saveHtmlArtifact(html: string): void {
  mkdirSync('artifacts', { recursive: true });
  writeFileSync('artifacts/wu-forecast.html', html); // uploaded on failure for diagnosis
}

/**
 * The target date's forecasted high. Fetches the WU page for its current
 * api.weather.com key (the page is a client over that API; see wu-api.ts),
 * asks the API directly, and only if that fails parses the server-rendered
 * page -- which WU no longer reliably serves (HTTP 404 app shell instead),
 * the failure that lost 2026-10-05's forecast.
 */
export async function fetchForecastHigh(
  target: string,
  { fetchFn = fetch, saveHtml = saveHtmlArtifact, log = console.error }:
    { fetchFn?: FetchFn; saveHtml?: (html: string) => void; log?: (msg: string) => void } = {},
): Promise<number> {
  let page: { status: number; ok: boolean; html: string } | null = null;
  try {
    const res = await fetchFn(WU_PAGE_URL, { headers: { 'User-Agent': UA } });
    page = { status: res.status, ok: res.ok, html: await res.text() };
    saveHtml(page.html);
  } catch (err) {
    log(`WU page fetch failed (${(err as Error).message}); trying the API with the fallback key`);
  }
  const key = (page && extractApiKey(page.html)) ?? FALLBACK_API_KEY;

  let apiError: Error;
  try {
    const res = await fetchFn(dailyForecastUrl(key, GEOCODE), { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`weather.com API HTTP ${res.status}`);
    return forecastHighFromApi(await res.json(), target);
  } catch (err) {
    apiError = err as Error;
  }

  if (!page?.ok) {
    throw new Error(
      `API failed (${apiError.message}) and WU page was ${page ? `HTTP ${page.status}` : 'unreachable'}`,
    );
  }
  log(`API failed (${apiError.message}); falling back to the server-rendered page`);
  return extractForecastHigh(page.html, target, GEOCODE);
}

/** Run `fn` up to `attempts` times, `delayMs` apart; throws the last error. */
export async function withRetry<T>(
  fn: () => Promise<T>,
  { attempts = ATTEMPTS, delayMs = RETRY_DELAY_MS, sleep: wait = sleep, log = console.error }:
    { attempts?: number; delayMs?: number; sleep?: (ms: number) => Promise<unknown>; log?: (msg: string) => void } = {},
): Promise<T> {
  let lastError: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      log(`attempt ${i}/${attempts} failed: ${(err as Error).message}`);
      if (i < attempts) await wait(delayMs);
    }
  }
  throw lastError;
}

async function main() {
  const target = pacificForecastTargetISO();
  const records = load();
  if (shouldSkip(records, target)) {
    const existing = records.find((r) => r.date === target)!.forecast_high_f;
    console.log(`forecast ${target}: already captured (${existing}°F), skipping`);
    return;
  }
  const high = await withRetry(() => fetchForecastHigh(target));
  save(upsert(load(), target, {
    forecast_high_f: high,
    forecast_captured_at: new Date().toISOString(),
  }));
  console.log(`forecast ${target}: ${high}°F`);
}

// Run only when executed directly (tsx scripts/capture-forecast.ts), not when
// imported by tests for the exported helpers.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
