import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { extractForecastHigh } from '../scripts/wu-parse';

const GEOCODE = '37.471,-122.233';

// Fixture captured 2026-07-03 00:27 PT; WU had not rolled its day-0 bucket,
// so day 0 is 07-02 (75°F) and day 1 is 07-03 (77°F). That lag is exactly why
// the parser looks the date up instead of assuming index 0.
const html = readFileSync('tests/fixtures/wu-app-root-state.html', 'utf8');

// Hand-built minimal state blobs for drift-branch tests. The script tag puts
// `type` before `id` deliberately, so the regex must not assume attribute order.
function stateHtml(state: unknown): string {
  return `<html><body><script type="application/json" id="app-root-state">${JSON.stringify(state)}</script></body></html>`;
}

function candidate(url: string, maxes: (number | null)[], dates: string[]) {
  return {
    u: url,
    b: {
      temperatureMax: maxes,
      // Decoy: always higher than temperatureMax, so any test passing while
      // the parser reads this field instead would fail loudly.
      calendarDayTemperatureMax: maxes.map((v) => (v === null ? null : v + 3)),
      validTimeLocal: dates.map((d) => `${d}T07:00:00-0700`),
    },
  };
}

function dailyUrl(geocode: string, range: string): string {
  return `https://api.weather.com/v3/wx/forecast/daily/${range}?apiKey=x&geocode=${geocode.replaceAll(',', '%2C')}&units=e&format=json`;
}

describe('extractForecastHigh', () => {
  it('reads the displayed daytime high (temperatureMax), not calendarDayTemperatureMax', () => {
    // Fixture day 1 (07-03): temperatureMax 77. Captured live 2026-07-04:
    // the WU page showed 75 (temperatureMax) while calendarDayTemperatureMax
    // said 78-80 — the tracker must record the number the page displays.
    expect(extractForecastHigh(html, '2026-07-03', GEOCODE)).toBe(77);
    expect(extractForecastHigh(html, '2026-07-04', GEOCODE)).toBe(75);
  });

  it("throws for day 0 after its daytime has passed (temperatureMax null)", () => {
    // Fixture captured 00:27 PT: day 0 is yesterday (07-02), whose daytime
    // high is already null. The old calendarDayTemperatureMax field still had
    // a number here, which is how off-window captures recorded wrong values.
    expect(() => extractForecastHigh(html, '2026-07-02', GEOCODE)).toThrow(/is not a number/);
  });

  it('throws when today is not in the forecast window', () => {
    expect(() => extractForecastHigh(html, '1999-01-01', GEOCODE)).toThrow(/not found in forecast/);
  });

  it('throws when the state tag is missing', () => {
    expect(() => extractForecastHigh('<html></html>', '2026-07-02', GEOCODE)).toThrow(/app-root-state/);
  });

  it('throws when no daily forecast matches the requested geocode', () => {
    const doc = stateHtml({
      k1: candidate(dailyUrl(GEOCODE, '10day'), [75], ['2026-07-02']),
    });
    expect(() => extractForecastHigh(doc, '2026-07-02', '99.999,-99.999')).toThrow(/no daily forecast/);
  });

  it('throws a conflict error when same-geocode candidates disagree on today', () => {
    const doc = stateHtml({
      k1: candidate(dailyUrl(GEOCODE, '10day'), [75, 77], ['2026-07-02', '2026-07-03']),
      k2: candidate(dailyUrl(GEOCODE, '5day'), [63, 77], ['2026-07-02', '2026-07-03']),
    });
    expect(() => extractForecastHigh(doc, '2026-07-02', GEOCODE)).toThrow(/conflict/);
  });

  it("throws with the offending value when today's high is null", () => {
    const doc = stateHtml({
      k1: candidate(dailyUrl(GEOCODE, '10day'), [null, 77], ['2026-07-02', '2026-07-03']),
    });
    expect(() => extractForecastHigh(doc, '2026-07-02', GEOCODE)).toThrow(/is not a number.*null/);
  });

  it('throws a parse error when the state tag does not contain valid JSON', () => {
    const doc =
      '<html><body><script type="application/json" id="app-root-state">{not: valid json}</script></body></html>';
    expect(() => extractForecastHigh(doc, '2026-07-02', GEOCODE)).toThrow(/JSON parse failed/);
  });
});
