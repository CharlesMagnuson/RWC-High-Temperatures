import { useState } from 'react';
import { colorOf, ARMS, type Mode } from '../lib/colors';
import { weekOf, monthOf, fmtDay } from '../lib/display-dates';
import { deltaOf, type DayRecord } from '../lib/records';

interface Props {
  records: DayRecord[];
  mode: Mode;
}

const W = 1010;
const H = 340;
const PAD = { l: 46, r: 16, t: 26, b: 40 };

/** Mark sizing scales with density so year view stays readable. */
function markSize(n: number) {
  if (n <= 31) return { r: 4.5, stem: 2.5, ring: 2 };
  if (n <= 100) return { r: 3, stem: 2, ring: 1.5 };
  return { r: 1.6, stem: 1, ring: 0.8 };
}

export function DumbbellChart({ records, mode }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const n = records.length;
  const { r: R, stem, ring } = markSize(n);

  const temps = records.flatMap((rec) =>
    [rec.forecast_high_f, rec.actual_high_f].filter((t): t is number => t !== null),
  );
  const lo = temps.length ? Math.floor((Math.min(...temps) - 3) / 5) * 5 : 60;
  const hi = temps.length ? Math.ceil((Math.max(...temps) + 3) / 5) * 5 : 90;
  const y = (t: number) => PAD.t + ((hi - t) / (hi - lo)) * (H - PAD.t - PAD.b);
  const slot = (W - PAD.l - PAD.r) / Math.max(n, 1);
  const cx = (i: number) => PAD.l + slot * (i + 0.5);

  const gridTemps: number[] = [];
  for (let t = lo + 5; t < hi; t += 5) gridTemps.push(t);

  // Thin x labels by density: every day, else week starts, else month starts.
  const labelEvery = (i: number) =>
    n <= 31 ||
    (n <= 100
      ? i === 0 || weekOf(records[i - 1].date) !== weekOf(records[i].date)
      : i === 0 || monthOf(records[i - 1].date) !== monthOf(records[i].date));

  const readout = (() => {
    if (hover === null) return null;
    const rec = records[hover];
    const { w, md } = fmtDay(rec.date);
    const d = deltaOf(rec);
    const fmt = (v: number | null) => (v === null ? '—' : `${v}°`);
    const dStr = d === null ? '—' : `${d > 0 ? '+' : ''}${d}°`;
    return `${w} ${md} · FCST ${fmt(rec.forecast_high_f)} · ACTUAL ${fmt(rec.actual_high_f)} · Δ ${dStr}`;
  })();

  const arms = ARMS[mode];

  return (
    <div className="relative px-6 pt-2 pb-1" data-chart-zone onMouseLeave={() => setHover(null)}>
      <div
        data-testid="readout"
        className="absolute right-6 top-3 min-h-4 text-right text-[11px] font-medium tracking-[0.08em]"
      >
        {readout ?? <span className="text-faint">HOVER A DAY</span>}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" aria-label="Forecast vs actual daily highs">
        {gridTemps.map((t) => (
          <g key={t}>
            <line x1={PAD.l} y1={y(t)} x2={W - PAD.r} y2={y(t)} stroke="var(--grid)" strokeWidth="1" />
            <text x={PAD.l - 10} y={y(t) + 3.5} textAnchor="end" fontSize="10" fill="var(--faint)">
              {t}°
            </text>
          </g>
        ))}
        {records.map((rec, i) => {
          if (i === 0) return null;
          const bx = PAD.l + slot * i;
          if (monthOf(records[i - 1].date) !== monthOf(rec.date)) {
            return (
              <line key={rec.date} data-sep="month" x1={bx} y1={PAD.t - 6} x2={bx} y2={H - PAD.b}
                stroke="var(--month-line)" strokeWidth="1" />
            );
          }
          // weekOf comparison (not isMonday) so a missing Monday still draws the rule
          if (weekOf(records[i - 1].date) !== weekOf(rec.date)) {
            return (
              <line key={rec.date} data-sep="week" x1={bx} y1={PAD.t} x2={bx} y2={H - PAD.b}
                stroke="var(--week-line)" strokeWidth="1" />
            );
          }
          return null;
        })}
        <line x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} stroke="var(--axis)" strokeWidth="1" />
        {records.map((rec, i) => {
          const d = deltaOf(rec);
          const x = cx(i);
          // Lone value (one capture missing): gray dot, filled iff it is the actual.
          if (d === null) {
            const t = rec.actual_high_f ?? rec.forecast_high_f;
            if (t === null) return null;
            const filled = rec.actual_high_f !== null;
            return (
              <circle key={rec.date} cx={x} cy={y(t)} r={R}
                fill={filled ? 'var(--neutral-mark)' : 'var(--card)'}
                stroke={filled ? 'var(--card)' : 'var(--neutral-mark)'} strokeWidth={ring} />
            );
          }
          const color = colorOf(d, mode);
          if (color === null) {
            return (
              <circle key={rec.date} cx={x} cy={y(rec.actual_high_f!)} r={R}
                fill="var(--neutral-mark)" stroke="var(--card)" strokeWidth={ring} />
            );
          }
          return (
            <g key={rec.date}>
              <line x1={x} y1={y(rec.forecast_high_f!)} x2={x} y2={y(rec.actual_high_f!)}
                stroke={color} strokeWidth={stem} />
              <circle cx={x} cy={y(rec.forecast_high_f!)} r={R} fill="var(--card)" stroke={color} strokeWidth={ring} />
              <circle cx={x} cy={y(rec.actual_high_f!)} r={R} fill={color} stroke="var(--card)" strokeWidth={ring} />
            </g>
          );
        })}
        {records.map((rec, i) =>
          labelEvery(i) ? (
            <g key={rec.date}>
              <text x={cx(i)} y={H - 22} textAnchor="middle" fontSize="9" fill="var(--muted-foreground)" letterSpacing="1">
                {fmtDay(rec.date).w}
              </text>
              <text x={cx(i)} y={H - 9} textAnchor="middle" fontSize="9" fill="var(--faint)">
                {fmtDay(rec.date).md.slice(4)}
              </text>
            </g>
          ) : null,
        )}
        {records.map((rec, i) => (
          <rect key={rec.date} data-hit x={cx(i) - slot / 2} y={PAD.t} width={slot} height={H - PAD.t - PAD.b}
            fill="transparent" onMouseEnter={() => setHover(i)} />
        ))}
      </svg>
      <div className="flex flex-wrap items-center justify-between gap-5 px-0 pt-3.5 pb-1 text-[10px] tracking-[0.1em] text-muted-foreground">
        <div className="flex items-center gap-2.5">
          <span>COLD · FORECAST RAN HIGH</span>
          <div className="flex items-center">
            {[...arms.cold].reverse().map((c) => (
              <span key={c} className="inline-block h-2.5 w-[22px]" style={{ background: c }} />
            ))}
            <span className="w-[30px] text-center text-[9px] text-faint">±1</span>
            {arms.hot.map((c) => (
              <span key={c} className="inline-block h-2.5 w-[22px]" style={{ background: c }} />
            ))}
          </div>
          <span>HOT · ACTUAL RAN HIGH</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <svg width="12" height="12"><circle cx="6" cy="6" r="4" fill="var(--muted-foreground)" /></svg>
            ACTUAL
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="12" height="12"><circle cx="6" cy="6" r="4" fill="none" stroke="var(--muted-foreground)" strokeWidth="2" /></svg>
            FORECAST
          </span>
        </div>
      </div>
    </div>
  );
}
