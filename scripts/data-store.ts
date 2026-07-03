import { readFileSync, writeFileSync } from 'node:fs';

export interface DayRecord {
  date: string; // YYYY-MM-DD, Pacific
  forecast_high_f: number | null;
  actual_high_f: number | null;
  forecast_captured_at: string | null; // ISO 8601 UTC
  actual_captured_at: string | null;
}

export const DATA_PATH = 'data/temperatures.json';

export function load(path = DATA_PATH): DayRecord[] {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function save(records: DayRecord[], path = DATA_PATH): void {
  writeFileSync(path, JSON.stringify(records, null, 2) + '\n');
}

export function upsert(records: DayRecord[], date: string, patch: Partial<DayRecord>): DayRecord[] {
  const blank: DayRecord = {
    date,
    forecast_high_f: null,
    actual_high_f: null,
    forecast_captured_at: null,
    actual_captured_at: null,
  };
  const existing = records.find((r) => r.date === date);
  const merged = { ...(existing ?? blank), ...patch, date };
  return [...records.filter((r) => r.date !== date), merged].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
}
