import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { useThemeMode } from '../src/lib/theme';

function Probe() {
  const [mode, toggle] = useThemeMode();
  return (
    <button aria-label="Toggle theme" onClick={toggle}>
      {mode}
    </button>
  );
}

// A matchMedia mock whose `matches` we can flip and whose 'change' event we
// can fire, standing in for the OS switching between light and dark.
function installMatchMedia(initialDark: boolean) {
  let dark = initialDark;
  const listeners = new Set<() => void>();
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    get matches() {
      return dark;
    },
    media: query,
    onchange: null,
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
  return {
    setSystemDark(next: boolean) {
      dark = next;
      listeners.forEach((fn) => fn());
    },
  };
}

describe('useThemeMode', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('follows the system theme on load', () => {
    installMatchMedia(true);
    render(<Probe />);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('ignores a stale persisted override and follows the system theme', () => {
    // A pre-fix visit left a permanent override behind; loading the site
    // must still reflect the current OS theme.
    localStorage.setItem('theme', 'dark');
    installMatchMedia(false);
    render(<Probe />);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('theme')).toBeNull();
  });

  it('reacts live when the OS theme changes', () => {
    const media = installMatchMedia(false);
    render(<Probe />);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    act(() => media.setSystemDark(true));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    act(() => media.setSystemDark(false));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('toggle overrides for the current visit without persisting', () => {
    installMatchMedia(false);
    const { getByLabelText } = render(<Probe />);
    fireEvent.click(getByLabelText('Toggle theme'));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('theme')).toBeNull();
  });
});
