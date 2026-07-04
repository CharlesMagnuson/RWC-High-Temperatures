import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { extractForecastHigh } from './wu-parse';
import { load, save, upsert, type DayRecord } from './data-store';
import { pacificForecastTargetISO } from './dates';

const URL = 'https://www.wunderground.com/forecast/KCAREDWO201';
const GEOCODE = '37.471,-122.233'; // KCAREDWO201's location; pins parsing to this station's forecast
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const ATTEMPTS = 3;
const RETRY_DELAY_MS = 10 * 60 * 1000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * True when the target date's forecast is already captured, so a second run
 * (both crons pass the guard under PDT, and a delayed firing may land after
 * an on-time one already captured) is a no-op. First capture wins.
 */
export function shouldSkip(records: DayRecord[], target: string): boolean {
  return typeof records.find((r) => r.date === target)?.forecast_high_f === 'number';
}

async function attempt(target: string): Promise<number> {
  const res = await fetch(URL, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`WU fetch failed: HTTP ${res.status}`);
  const html = await res.text();
  mkdirSync('artifacts', { recursive: true });
  writeFileSync('artifacts/wu-forecast.html', html); // uploaded on failure for diagnosis
  return extractForecastHigh(html, target, GEOCODE);
}

async function main() {
  const target = pacificForecastTargetISO();
  const records = load();
  if (shouldSkip(records, target)) {
    const existing = records.find((r) => r.date === target)!.forecast_high_f;
    console.log(`forecast ${target}: already captured (${existing}°F), skipping`);
    return;
  }
  let lastError: unknown;
  for (let i = 1; i <= ATTEMPTS; i++) {
    try {
      const high = await attempt(target);
      save(upsert(load(), target, {
        forecast_high_f: high,
        forecast_captured_at: new Date().toISOString(),
      }));
      console.log(`forecast ${target}: ${high}°F`);
      return;
    } catch (err) {
      lastError = err;
      console.error(`attempt ${i}/${ATTEMPTS} failed:`, err);
      if (i < ATTEMPTS) await sleep(RETRY_DELAY_MS);
    }
  }
  throw lastError;
}

// Run only when executed directly (tsx scripts/capture-forecast.ts), not when
// imported by tests for the exported helpers.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
