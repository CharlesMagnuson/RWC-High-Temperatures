import { useEffect, useState } from 'react';

export type Mode = 'light' | 'dark';
const KEY = 'theme';

function systemMode(): Mode {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function useThemeMode(): [Mode, () => void] {
  const [mode, setMode] = useState<Mode>(
    () => (localStorage.getItem(KEY) as Mode | null) ?? systemMode(),
  );

  useEffect(() => {
    document.documentElement.classList.toggle('dark', mode === 'dark');
  }, [mode]);

  // Follow OS changes unless the user has overridden.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (!localStorage.getItem(KEY)) setMode(systemMode());
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const toggle = () => {
    const next: Mode = mode === 'dark' ? 'light' : 'dark';
    localStorage.setItem(KEY, next);
    setMode(next);
  };
  return [mode, toggle];
}
