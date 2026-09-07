import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';

vi.mock('../data/temperatures.json', () => ({ default: [] }));
vi.mock('cuelume', () => ({ play: vi.fn() }));

import { play } from 'cuelume';
import App from '../src/App';

function dialog() {
  return document.querySelector('dialog') as HTMLDialogElement;
}

describe('about dialog', () => {
  beforeEach(() => {
    vi.mocked(play).mockClear();
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('is closed until the info icon is clicked', () => {
    const { getByLabelText } = render(<App />);
    expect(dialog().open).toBe(false);
    fireEvent.click(getByLabelText('About this site'));
    expect(dialog().open).toBe(true);
    expect(play).toHaveBeenCalledWith('pulse');
  });

  it('shows the about text', () => {
    const { getByLabelText, getByText } = render(<App />);
    fireEvent.click(getByLabelText('About this site'));
    expect(getByText(/The result is RedwoodCityIs\.Hot\./)).toBeTruthy();
    expect(getByText(/Forecast numbers come from Weather Underground/)).toBeTruthy();
    expect(getByText(/Fascism is for losers\./)).toBeTruthy();
  });

  it('closes via the close button', () => {
    const { getByLabelText } = render(<App />);
    fireEvent.click(getByLabelText('About this site'));
    fireEvent.click(getByLabelText('Close'));
    expect(dialog().open).toBe(false);
  });

  it('closes when the backdrop is clicked, but not the panel', () => {
    const { getByLabelText, getByText } = render(<App />);
    fireEvent.click(getByLabelText('About this site'));
    fireEvent.click(getByText(/Fascism is for losers\./));
    expect(dialog().open).toBe(true);
    fireEvent.click(dialog());
    expect(dialog().open).toBe(false);
  });

  it('can be reopened after closing', () => {
    const { getByLabelText } = render(<App />);
    fireEvent.click(getByLabelText('About this site'));
    fireEvent.click(getByLabelText('Close'));
    fireEvent.click(getByLabelText('About this site'));
    expect(dialog().open).toBe(true);
  });
});
