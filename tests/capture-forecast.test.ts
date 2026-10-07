import { describe, it, expect } from 'vitest';
import { shouldSkip } from '../scripts/capture-forecast';
import type { DayRecord } from '../scripts/data-store';

function record(patch: Partial<DayRecord> & { date: string }): DayRecord {
  return {
    forecast_high_f: null,
    actual_high_f: null,
    forecast_captured_at: null,
    actual_captured_at: null,
    ...patch,
  };
}

describe('shouldSkip', () => {
  it('skips when today already has a captured forecast high', () => {
    const records = [record({ date: '2026-07-03', forecast_high_f: 76 })];
    expect(shouldSkip(records, '2026-07-03')).toBe(true);
  });

  it('does not skip when there is no record for today', () => {
    const records = [record({ date: '2026-07-02', forecast_high_f: 75 })];
    expect(shouldSkip(records, '2026-07-03')).toBe(false);
  });

  it('does not skip when today exists but forecast_high_f is null', () => {
    // e.g. the actual-capture job created the record first
    const records = [record({ date: '2026-07-03', actual_high_f: 80 })];
    expect(shouldSkip(records, '2026-07-03')).toBe(false);
  });

  it('does not skip on an empty data file', () => {
    expect(shouldSkip([], '2026-07-03')).toBe(false);
  });
});

// ---- fetchForecastHigh: API first, server-rendered page as fallback ----------
//
// 2026-10-04/05: WU served its new client-side shell (HTTP 404, no embedded
// forecast) for every attempt at 00:01 PDT and both runs failed; 10-05's
// forecast was lost. The shell still names the api.weather.com key the
// browser uses, so the capture now calls that API directly and only falls
// back to parsing the old server-rendered page.

import { readFileSync } from 'node:fs';
import { fetchForecastHigh, withRetry, FALLBACK_API_KEY, WU_PAGE_URL } from '../scripts/capture-forecast';

const shell = readFileSync('tests/fixtures/wu-spa-shell-404.html', 'utf8');
const ssr = readFileSync('tests/fixtures/wu-app-root-state.html', 'utf8');
const apiBody = readFileSync('tests/fixtures/wu-api-daily-5day.json', 'utf8');

type Reply = { status: number; body: string } | Error;

/** Fake fetch keyed by URL prefix; records every call. */
function fakeFetch(routes: Record<string, Reply>) {
  const calls: string[] = [];
  const fn = async (url: string): Promise<Response> => {
    calls.push(url);
    const hit = Object.entries(routes).find(([prefix]) => url.startsWith(prefix));
    if (!hit) throw new Error(`unrouted ${url}`);
    const reply = hit[1];
    if (reply instanceof Error) throw reply;
    return new Response(reply.body, { status: reply.status });
  };
  fn.calls = calls;
  return fn;
}

const API = 'https://api.weather.com/v3/wx/forecast/daily/';
const noSave = () => {};

describe('fetchForecastHigh', () => {
  it('reads the API key from the 404 app shell and takes the high from the API', async () => {
    const f = fakeFetch({ [WU_PAGE_URL]: { status: 404, body: shell }, [API]: { status: 200, body: apiBody } });
    await expect(fetchForecastHigh('2026-10-07', { fetchFn: f, saveHtml: noSave })).resolves.toBe(85);
    const apiCall = f.calls.find((u) => u.startsWith(API))!;
    expect(new URL(apiCall).searchParams.get('apiKey')).toBe('f6d2efe5720d47ea92efe5720df7eaa8');
  });

  it('uses the fallback key when the page fetch itself fails', async () => {
    const f = fakeFetch({ [WU_PAGE_URL]: new Error('ECONNRESET'), [API]: { status: 200, body: apiBody } });
    await expect(fetchForecastHigh('2026-10-07', { fetchFn: f, saveHtml: noSave })).resolves.toBe(85);
    const apiCall = f.calls.find((u) => u.startsWith(API))!;
    expect(new URL(apiCall).searchParams.get('apiKey')).toBe(FALLBACK_API_KEY);
  });

  it('falls back to the server-rendered page when the API fails', async () => {
    const f = fakeFetch({ [WU_PAGE_URL]: { status: 200, body: ssr }, [API]: { status: 401, body: 'bad key' } });
    // Fixture day 1 is 2026-07-03 at 77°F (see wu-parse.test.ts).
    await expect(fetchForecastHigh('2026-07-03', { fetchFn: f, saveHtml: noSave })).resolves.toBe(77);
  });

  it('throws naming both failures when the API fails and the page is the shell', async () => {
    const f = fakeFetch({ [WU_PAGE_URL]: { status: 404, body: shell }, [API]: { status: 401, body: 'bad key' } });
    await expect(fetchForecastHigh('2026-10-07', { fetchFn: f, saveHtml: noSave })).rejects.toThrow(/401.*404|404.*401/s);
  });

  it('saves the page body for the failure artifact even when it is the shell', async () => {
    let saved = '';
    const f = fakeFetch({ [WU_PAGE_URL]: { status: 404, body: shell }, [API]: { status: 200, body: apiBody } });
    await fetchForecastHigh('2026-10-07', { fetchFn: f, saveHtml: (html) => { saved = html; } });
    expect(saved).toBe(shell);
  });
});

describe('withRetry', () => {
  it('returns the first success and waits the delay between failures', async () => {
    const waits: number[] = [];
    let n = 0;
    const result = await withRetry(
      async () => { if (++n < 3) throw new Error(`fail ${n}`); return 'ok'; },
      { attempts: 5, delayMs: 7, sleep: async (ms) => { waits.push(ms); }, log: () => {} },
    );
    expect(result).toBe('ok');
    expect(n).toBe(3);
    expect(waits).toEqual([7, 7]);
  });

  it('throws the last error after exhausting attempts, without a trailing wait', async () => {
    const waits: number[] = [];
    let n = 0;
    await expect(
      withRetry(async () => { throw new Error(`fail ${++n}`); }, { attempts: 4, delayMs: 1, sleep: async (ms) => { waits.push(ms); }, log: () => {} }),
    ).rejects.toThrow('fail 4');
    expect(waits).toHaveLength(3);
  });
});
