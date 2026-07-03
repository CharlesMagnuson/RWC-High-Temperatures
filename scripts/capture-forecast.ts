import { mkdirSync, writeFileSync } from 'node:fs';
import { extractForecastHigh } from './wu-parse';
import { load, save, upsert } from './data-store';
import { pacificTodayISO } from './dates';

const URL = 'https://www.wunderground.com/forecast/KCAREDWO201';
const GEOCODE = '37.471,-122.233'; // KCAREDWO201's location; pins parsing to this station's forecast
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const ATTEMPTS = 3;
const RETRY_DELAY_MS = 10 * 60 * 1000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function attempt(today: string): Promise<number> {
  const res = await fetch(URL, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`WU fetch failed: HTTP ${res.status}`);
  const html = await res.text();
  mkdirSync('artifacts', { recursive: true });
  writeFileSync('artifacts/wu-forecast.html', html); // uploaded on failure for diagnosis
  return extractForecastHigh(html, today, GEOCODE);
}

async function main() {
  const today = pacificTodayISO();
  let lastError: unknown;
  for (let i = 1; i <= ATTEMPTS; i++) {
    try {
      const high = await attempt(today);
      save(upsert(load(), today, {
        forecast_high_f: high,
        forecast_captured_at: new Date().toISOString(),
      }));
      console.log(`forecast ${today}: ${high}°F`);
      return;
    } catch (err) {
      lastError = err;
      console.error(`attempt ${i}/${ATTEMPTS} failed:`, err);
      if (i < ATTEMPTS) await sleep(RETRY_DELAY_MS);
    }
  }
  throw lastError;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
