import { colorOf, inkFor, type Mode } from '../lib/colors';
import { weekOf, fmtDay } from '../lib/display-dates';
import { deltaOf, type DayRecord } from '../lib/records';
import { cn } from '../lib/utils';

export function DataTable({ records, mode }: { records: DayRecord[]; mode: Mode }) {
  const rows = [...records].reverse(); // newest first
  return (
    <table className="w-full border-collapse text-xs tabular-nums">
      <thead>
        <tr className="border-b border-border">
          {['DATE', 'FORECAST', 'ACTUAL', 'Δ ACT−FCST'].map((h, i) => (
            <th key={h} className={cn('px-6 pt-3.5 pb-2.5 text-[10px] font-semibold tracking-[0.16em] text-muted-foreground', i === 0 ? 'text-left' : 'text-right')}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, idx) => {
          const d = deltaOf(r);
          const color = d === null ? null : colorOf(d, mode);
          const { w, md } = fmtDay(r.date);
          const year = r.date.slice(0, 4);
          const fmt = (v: number | null) => (v === null ? '—' : `${v}°F`);
          // Newest-first: a divider under the last row of each week (weekOf changes
          // between this row and the older row below), robust to missing days.
          const older = rows[idx + 1];
          const weekEdge = older !== undefined && weekOf(r.date) !== weekOf(older.date);
          return (
            <tr key={r.date} className={weekEdge ? 'border-b border-[var(--month-line)]' : 'border-b border-[var(--grid)]'}>
              <td className="px-6 py-2.5 text-left tracking-[0.04em] text-muted-foreground">{`${w} · ${md} ${year}`}</td>
              <td className="px-6 py-2.5 text-right">{fmt(r.forecast_high_f)}</td>
              <td className="px-6 py-2.5 text-right">{fmt(r.actual_high_f)}</td>
              <td className="px-6 py-2.5 text-right">
                {d === null ? (
                  <span className="text-faint">—</span>
                ) : (
                  <span
                    className="inline-block min-w-[52px] px-2 py-0.5 text-center text-[11px] font-semibold"
                    style={
                      color === null
                        ? { background: 'var(--neutral-mark)', color: mode === 'dark' ? '#fff' : '#0c090c' }
                        : { background: color, color: inkFor(color) }
                    }
                  >
                    {d > 0 ? '+' : d < 0 ? '−' : '±'}{Math.abs(d)}°
                  </span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
