import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';

// Pin the data import to an empty file so these tests always exercise the
// deterministic sample-data fallback. Without this, the suite breaks in CI
// the moment the capture workflows commit real records (App imports the
// live data/temperatures.json at build time).
vi.mock('../data/temperatures.json', () => ({ default: [] }));

import App from '../src/App';

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('renders the dashboard with sample data (empty data file)', () => {
    const { getByText, getAllByText } = render(<App />);
    expect(getByText('HIGH TEMPERATURES')).toBeTruthy();
    expect(getByText('Forecast vs Actual')).toBeTruthy();
    expect(getByText('WEEK')).toBeTruthy();
    // sample data means the table has rows with °F values
    expect(getAllByText(/°F/).length).toBeGreaterThan(0);
  });

  it('switches views', () => {
    const { getByText } = render(<App />);
    fireEvent.click(getByText('YEAR'));
    // year view still renders the chart region
    expect(getByText(/HOVER A DAY/)).toBeTruthy();
  });

  it('switches to a season view', () => {
    const { getByText, getAllByText } = render(<App />);
    // sample data spans Jun 4 – Jul 2 2026, entirely inside summer
    fireEvent.click(getByText('SUMMER'));
    expect(getAllByText(/°F/).length).toBeGreaterThan(0);
    // a season with no records still renders the empty chart region
    fireEvent.click(getByText('SPRING'));
    expect(getByText(/HOVER A DAY/)).toBeTruthy();
  });

  it('toggles theme', () => {
    const { getByLabelText } = render(<App />);
    fireEvent.click(getByLabelText('Toggle theme'));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  describe('status freshness', () => {
    // Pin only Date (not timers) so React scheduling is untouched. The sample
    // data's newest record is 2026-07-02; the fresh window is < 3 days.
    afterEach(() => {
      vi.useRealTimers();
    });

    it('shows LATEST with a record inside the 3-day window', () => {
      vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-07-03T12:00:00Z') });
      const { getByText } = render(<App />);
      expect(getByText('LATEST · JUL 02')).toBeTruthy();
    });

    it('shows STALE once the newest record is 3+ days old', () => {
      vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-07-10T12:00:00Z') });
      const { getByText } = render(<App />);
      expect(getByText('STALE · JUL 02')).toBeTruthy();
    });
  });
});
