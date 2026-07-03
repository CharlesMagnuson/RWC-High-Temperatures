import { MoonStars, Sun } from '@phosphor-icons/react';
import type { Mode } from '../lib/colors';
import { fmtDay } from '../lib/display-dates';

interface Props {
  mode: Mode;
  onToggle: () => void;
  lastDate: string | null; // YYYY-MM-DD of the newest record
}

const FRESH_MS = 3 * 86_400_000;

export function TopBar({ mode, onToggle, lastDate }: Props) {
  const fresh =
    lastDate !== null && Date.now() - Date.parse(`${lastDate}T00:00:00Z`) < FRESH_MS;
  const status =
    lastDate === null
      ? 'AWAITING FIRST CAPTURE'
      : `${fresh ? 'LATEST' : 'STALE'} · ${fmtDay(lastDate).md}`;
  return (
    <div className="flex items-center justify-between border-b border-border px-7 py-4">
      <div className="flex items-center gap-3">
        <div className="h-3.5 w-3.5 bg-primary" />
        <div>
          <h1 className="text-sm font-bold tracking-[0.18em]">HIGH TEMPERATURES</h1>
          <div className="mt-0.5 text-[11px] tracking-[0.08em] text-muted-foreground">REDWOOD CITY, CA</div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-[10px] tracking-[0.12em] text-muted-foreground">
          <span
            className="h-[7px] w-[7px] rounded-full"
            style={{ background: fresh ? 'var(--status-ok)' : 'var(--neutral-mark)' }}
          />
          {status}
        </div>
        <button
          onClick={onToggle}
          aria-label="Toggle theme"
          className="flex h-6 w-8 items-center justify-center border border-border text-muted-foreground"
        >
          {mode === 'dark' ? <Sun size={13} /> : <MoonStars size={13} />}
        </button>
      </div>
    </div>
  );
}
