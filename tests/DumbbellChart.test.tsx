import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { DumbbellChart } from '../src/components/DumbbellChart';
import { sampleRecords } from '../src/lib/sample-data';
import { ARMS } from '../src/lib/colors';
import type { DayRecord } from '../src/lib/records';

// Sample spans 2026-06-04..2026-07-02 (2026-06-22 absent); slice(-14) covers
// 2026-06-18..2026-07-02, crossing the June->July month boundary (06-30 ->
// 07-01) and two week boundaries (06-21 -> 06-23, since 06-22 is the missing
// Monday, and 06-28 -> 06-29).
const records = sampleRecords().slice(-14);

describe('DumbbellChart', () => {
  it('renders a stem and two dots for a complete day, colored by Δ bin', () => {
    const { container } = render(<DumbbellChart records={records} mode="light" />);
    // last record (2026-07-02): forecast 75, actual 81, Δ +6 -> hot bin 2
    const color = ARMS.light.hot[2];
    const stems = container.querySelectorAll(`line[stroke="${color}"]`);
    expect(stems.length).toBeGreaterThan(0);
  });

  it('renders month and week separator lines', () => {
    const { container } = render(<DumbbellChart records={records} mode="light" />);
    expect(container.querySelector('line[data-sep="month"]')).not.toBeNull();
    expect(container.querySelector('line[data-sep="week"]')).not.toBeNull();
  });

  it('shows the hover readout for a day and clears it on leave', () => {
    const { container, getByTestId } = render(<DumbbellChart records={records} mode="light" />);
    const hits = container.querySelectorAll('rect[data-hit]');
    // mouseOver/mouseOut (not mouseEnter/mouseLeave): React implements its
    // synthetic enter/leave events on top of over/out, and jsdom only
    // triggers them reliably this way.
    fireEvent.mouseOver(hits[hits.length - 1]);
    expect(getByTestId('readout').textContent).toContain('Δ +6°');
    fireEvent.mouseOut(container.querySelector('[data-chart-zone]')!);
    expect(getByTestId('readout').textContent).toContain('HOVER A DAY');
  });

  it('labels year-view month starts with month abbreviations', () => {
    // 120 consecutive days from 2026-01-01 -> n > 100 puts labels at month starts.
    const start = new Date('2026-01-01T00:00:00Z');
    const year: DayRecord[] = Array.from({ length: 120 }, (_, i) => {
      const date = new Date(start.getTime() + i * 86400_000).toISOString().slice(0, 10);
      return {
        date,
        forecast_high_f: 70,
        actual_high_f: 75,
        forecast_captured_at: `${date}T07:05:00Z`,
        actual_captured_at: `${date}T01:05:00Z`,
      };
    });
    const { container } = render(<DumbbellChart records={year} mode="light" />);
    const labels = container.querySelector('svg')!.textContent;
    expect(labels).toContain('FEB');
    expect(labels).toContain('MAR');
  });

  it('survives the hovered day disappearing when records shrink', () => {
    const { container, getByTestId, rerender } = render(
      <DumbbellChart records={records} mode="light" />,
    );
    const hits = container.querySelectorAll('rect[data-hit]');
    fireEvent.mouseOver(hits[hits.length - 1]);
    expect(getByTestId('readout').textContent).toContain('Δ +6°');
    // Parent toggles year -> week: hover index 13 now points past the end.
    rerender(<DumbbellChart records={records.slice(0, 2)} mode="light" />);
    expect(getByTestId('readout').textContent).toMatch(/HOVER A DAY|Δ/);
  });

  it('renders the neutral-band gray dot for a Δ=0 day', () => {
    // slice(-14) includes 2026-06-25 (forecast 69, actual 69, Δ 0).
    const { container } = render(<DumbbellChart records={records} mode="light" />);
    expect(container.querySelector('circle[fill="var(--neutral-mark)"]')).not.toBeNull();
  });

  it('renders a forecast-only day as an open gray dot', () => {
    // Full sample includes 2026-06-13 (forecast 78, actual missing).
    const { container } = render(<DumbbellChart records={sampleRecords()} mode="light" />);
    const open = container.querySelector(
      'circle[fill="var(--card)"][stroke="var(--neutral-mark)"]',
    );
    expect(open).not.toBeNull();
  });
});
