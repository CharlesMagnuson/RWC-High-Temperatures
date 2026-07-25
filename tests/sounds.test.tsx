import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';

vi.mock('../data/temperatures.json', () => ({ default: [] }));
vi.mock('cuelume', () => ({ play: vi.fn() }));

import { play } from 'cuelume';
import App from '../src/App';

describe('interaction sounds', () => {
  beforeEach(() => {
    vi.mocked(play).mockClear();
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('plays "toggle" when the theme toggle is used', () => {
    const { getByLabelText } = render(<App />);
    fireEvent.click(getByLabelText('Toggle theme'));
    expect(play).toHaveBeenCalledWith('toggle');
  });

  it('plays "tick" when a view filter is clicked', () => {
    const { getByText } = render(<App />);
    fireEvent.click(getByText('MONTH'));
    expect(play).toHaveBeenCalledWith('tick');
    fireEvent.click(getByText('SUMMER'));
    expect(play).toHaveBeenCalledTimes(2);
  });

  it('plays "press" when hovering a day on the chart', () => {
    const { container } = render(<App />);
    const hits = container.querySelectorAll('[data-hit]');
    expect(hits.length).toBeGreaterThan(1);
    fireEvent.mouseEnter(hits[0]);
    expect(play).toHaveBeenCalledWith('press');
    fireEvent.mouseEnter(hits[1]);
    expect(play).toHaveBeenCalledTimes(2);
  });
});
