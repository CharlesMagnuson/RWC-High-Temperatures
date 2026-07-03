import { MoonStars, Sun } from '@phosphor-icons/react';
import type { Mode } from '../lib/colors';

interface Props {
  mode: Mode;
  onToggle: () => void;
  lastCapture: string | null; // e.g. "JUL 02" of the newest record
}

export function TopBar({ mode, onToggle, lastCapture }: Props) {
  return (
    <div className="flex items-center justify-between border-b border-border px-7 py-4">
      <div className="flex items-center gap-3">
        <div className="h-3.5 w-3.5 bg-primary" />
        <div>
          <h1 className="text-sm font-bold tracking-[0.18em]">HIGH TEMPERATURE</h1>
          <div className="mt-0.5 text-[11px] tracking-[0.08em] text-muted-foreground">REDWOOD CITY, CA</div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-[10px] tracking-[0.12em] text-muted-foreground">
          <span className="h-[7px] w-[7px] rounded-full" style={{ background: 'var(--status-ok)' }} />
          {lastCapture ? `LATEST · ${lastCapture}` : 'AWAITING FIRST CAPTURE'}
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
