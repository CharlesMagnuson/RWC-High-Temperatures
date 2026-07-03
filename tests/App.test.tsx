import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import App from '../src/App';

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('renders the dashboard with sample data (empty data file)', () => {
    const { getByText, getAllByText } = render(<App />);
    expect(getByText('HIGH TEMPERATURE')).toBeTruthy();
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

  it('toggles theme', () => {
    const { getByLabelText } = render(<App />);
    fireEvent.click(getByLabelText('Toggle theme'));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
