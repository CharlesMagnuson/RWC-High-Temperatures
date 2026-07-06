import { useEffect, useState } from 'react';

export type Mode = 'light' | 'dark';

function systemMode(): Mode {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// Theme always follows the system. The toggle is a transient override for the
// current visit only — nothing is persisted, and an OS theme change while the
// page is open snaps back to the system theme.
export function useThemeMode(): [Mode, () => void] {
  const [mode, setMode] = useState<Mode>(systemMode);

  // Drop the permanent override an earlier version persisted, so returning
  // visitors follow the system theme again.
  useEffect(() => {
    localStorage.removeItem('theme');
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', mode === 'dark');
  }, [mode]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setMode(systemMode());
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const toggle = () => setMode((m) => (m === 'dark' ? 'light' : 'dark'));
  return [mode, toggle];
}
