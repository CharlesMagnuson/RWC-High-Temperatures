import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { extractForecastHigh } from '../scripts/wu-parse';

// Fixture captured 2026-07-03 00:27 PT; WU had not rolled its day-0 bucket,
// so day 0 is 07-02 (75°F) and day 1 is 07-03 (77°F). That lag is exactly why
// the parser looks the date up instead of assuming index 0.
const html = readFileSync('tests/fixtures/wu-app-root-state.html', 'utf8');

describe('extractForecastHigh', () => {
  it('extracts the high at index 0 when today is day 0', () => {
    expect(extractForecastHigh(html, '2026-07-02')).toBe(75);
  });

  it('finds today at a later index when WU has not rolled over', () => {
    expect(extractForecastHigh(html, '2026-07-03')).toBe(77);
  });

  it('throws when today is not in the forecast window', () => {
    expect(() => extractForecastHigh(html, '1999-01-01')).toThrow(/not found in forecast/);
  });

  it('throws when the state tag is missing', () => {
    expect(() => extractForecastHigh('<html></html>', '2026-07-02')).toThrow(/app-root-state/);
  });
});
