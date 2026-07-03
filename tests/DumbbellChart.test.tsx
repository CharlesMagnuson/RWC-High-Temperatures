import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { DumbbellChart } from '../src/components/DumbbellChart';
import { sampleRecords } from '../src/lib/sample-data';
import { ARMS } from '../src/lib/colors';

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
});
