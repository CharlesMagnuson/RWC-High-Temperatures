import { useState } from 'react';
import rawRecords from '../data/temperatures.json';
import { Card } from './components/ui/card';
import { DumbbellChart } from './components/DumbbellChart';
import { DataTable } from './components/DataTable';
import { TopBar } from './components/TopBar';
import { useThemeMode } from './lib/theme';
import { sampleRecords } from './lib/sample-data';
import { sliceView, meanDelta, type DayRecord, type View } from './lib/records';
import { fmtDay } from './lib/display-dates';
import { cn } from './lib/utils';

const VIEWS: View[] = ['week', 'month', 'year'];

export default function App() {
  const [mode, toggleMode] = useThemeMode();
  const [view, setView] = useState<View>('week');

  const all: DayRecord[] =
    (rawRecords as DayRecord[]).length > 0 ? (rawRecords as DayRecord[]) : sampleRecords();
  const records = sliceView(all, view);
  const mean = meanDelta(records);
  const first = records[0];
  const last = records[records.length - 1];
  const range =
    first && last
      ? `${fmtDay(first.date).md} — ${fmtDay(last.date).md} ${last.date.slice(0, 4)}`
      : '';

  return (
    <div className="mx-auto min-h-screen max-w-[1120px]">
      <TopBar mode={mode} onToggle={toggleMode} lastCapture={last ? fmtDay(last.date).md : null} />
      <main className="p-7">
        <Card>
          <div className="flex flex-wrap items-end justify-between gap-4 px-6 pt-5 pb-1.5">
            <div>
              <div className="text-[10px] font-semibold tracking-[0.16em] text-muted-foreground">DAILY HIGH · °F</div>
              <h2 className="mt-1.5 text-base font-semibold">Forecast vs Actual</h2>
              <div className="mt-1 text-[11px] tracking-[0.06em] text-faint">
                {range}
                {mean !== null && ` · Δ MEAN ${mean >= 0 ? '+' : ''}${mean.toFixed(1)}°F`}
              </div>
            </div>
            <div className="flex border border-border">
              {VIEWS.map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={cn(
                    'px-4.5 py-2 text-[11px] font-semibold tracking-[0.14em]',
                    v === view ? 'bg-inv-bg text-inv-fg' : 'text-muted-foreground',
                  )}
                >
                  {v.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <DumbbellChart records={records} mode={mode} />
        </Card>
        <Card className="mt-5">
          <DataTable records={records} mode={mode} />
        </Card>
        <div className="flex justify-between px-1 py-4 text-[9px] tracking-[0.12em] text-faint">
          <span>SRC · WUNDERGROUND/KCAREDWO201 · NETATMO STATION</span>
          <span>UPDATED 2× DAILY</span>
        </div>
      </main>
    </div>
  );
}
