import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { extractApiKey, forecastHighFromApi, dailyForecastUrl } from '../scripts/wu-api';

// The client-side app shell WU began serving for the station URL (with HTTP
// 404) in Sept 2026. It carries no forecast; the browser fetches one from
// api.weather.com using the API_KEY in its config script.
const shell = readFileSync('tests/fixtures/wu-spa-shell-404.html', 'utf8');
// The older server-rendered page: forecast responses cached in app-root-state,
// each keyed by the request URL, which carries the key as a query param.
const ssr = readFileSync('tests/fixtures/wu-app-root-state.html', 'utf8');
// A real /v3/wx/forecast/daily/5day response, fetched 2026-10-06 20:00 PDT.
const api = JSON.parse(readFileSync('tests/fixtures/wu-api-daily-5day.json', 'utf8'));

describe('extractApiKey', () => {
  it('reads API_KEY from the app shell config', () => {
    expect(extractApiKey(shell)).toBe('f6d2efe5720d47ea92efe5720df7eaa8');
  });

  it('reads the key from a cached daily-forecast request URL in the server-rendered page', () => {
    // The page also embeds a second key (5c241d89...) on one unrelated URL,
    // which api.weather.com rejects with 401. The forecast URLs carry the live one.
    expect(extractApiKey(ssr)).toBe('e1f10a1e78da46f5b10a1e78da96f525');
  });

  it('returns null when no key is present', () => {
    expect(extractApiKey('<html></html>')).toBeNull();
    expect(extractApiKey('')).toBeNull();
  });
});

describe('forecastHighFromApi', () => {
  it('returns temperatureMax for the target date, looked up by validTimeLocal', () => {
    expect(forecastHighFromApi(api, '2026-10-07')).toBe(85);
    expect(forecastHighFromApi(api, '2026-10-08')).toBe(81);
  });

  it('throws when the target daytime has passed (temperatureMax null), not calendarDayTemperatureMax', () => {
    // Fetched in the evening: day 0 (10-06) has temperatureMax null while
    // calendarDayTemperatureMax is still 92. Recording 92 would be wrong.
    expect(() => forecastHighFromApi(api, '2026-10-06')).toThrow(/is not a number.*null/);
  });

  it('throws when the target date is outside the forecast window', () => {
    expect(() => forecastHighFromApi(api, '1999-01-01')).toThrow(/not found in forecast/);
  });

  it('throws on a body that is not a daily forecast', () => {
    expect(() => forecastHighFromApi({ error: 'nope' }, '2026-10-07')).toThrow(/not a daily forecast/);
    expect(() => forecastHighFromApi(null, '2026-10-07')).toThrow(/not a daily forecast/);
  });
});

describe('dailyForecastUrl', () => {
  it('targets the v3 daily endpoint with the key, geocode, Fahrenheit units and JSON', () => {
    const u = new URL(dailyForecastUrl('abc123', '37.471,-122.233'));
    expect(u.origin + u.pathname).toBe('https://api.weather.com/v3/wx/forecast/daily/5day');
    expect(u.searchParams.get('apiKey')).toBe('abc123');
    expect(u.searchParams.get('geocode')).toBe('37.471,-122.233');
    expect(u.searchParams.get('units')).toBe('e');
    expect(u.searchParams.get('format')).toBe('json');
  });
});
