# High Temperature Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture Weather Underground's forecasted high and the Netatmo station's actual high for Redwood City every day, and publish a shadcn-styled dashboard (table + dumbbell chart) on GitHub Pages.

**Architecture:** One repo. Two scheduled GitHub Actions workflows run TypeScript capture scripts that commit to `data/temperatures.json`; a deploy workflow rebuilds a Vite/React dashboard from that JSON on every data commit. Spec: `docs/superpowers/specs/2026-07-03-high-temperature-tracker-design.md` — read it before starting; it defines the visual system exactly.

**Tech Stack:** TypeScript everywhere. Node 22 + `tsx` for scripts, vitest for tests, React 18 + Vite + Tailwind v4 + shadcn-style components for the dashboard, `node:crypto` (AES-256-GCM) for Netatmo token storage. No chart library — the chart is bespoke SVG.

**Conventions used throughout:**
- Dates are `YYYY-MM-DD` strings in America/Los_Angeles. Temperatures are °F integers (`Math.round`). `Δ = actual − forecast`.
- Run all commands from the repo root. Node ≥ 22 required (built-in `fetch`).

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css` (placeholder), `data/temperatures.json`
- Modify: `.gitignore`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "high-temperature",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "capture:forecast": "tsx scripts/capture-forecast.ts",
    "capture:actual": "tsx scripts/capture-actual.ts",
    "netatmo:auth": "tsx scripts/netatmo-auth.ts"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run:
```bash
npm install react react-dom clsx tailwind-merge @fontsource/jetbrains-mono @phosphor-icons/react
npm install -D typescript vite @vitejs/plugin-react tailwindcss @tailwindcss/vite vitest jsdom @testing-library/react tsx @types/node @types/react @types/react-dom
```
Expected: `package.json` gains dependencies; `package-lock.json` created.

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["node", "vite/client"]
  },
  "include": ["src", "scripts", "tests"]
}
```

- [ ] **Step 4: Create `vite.config.ts`**

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    passWithNoTests: true,
  },
});
```
(`base: './'` makes the build path-independent so it works at any GitHub Pages project URL.)

- [ ] **Step 5: Create the app entry points**

`index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>High Temperature — Redwood City, CA</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/main.tsx`:
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

`src/App.tsx` (placeholder, replaced in Task 13):
```tsx
export default function App() {
  return <main>High Temperature</main>;
}
```

`src/index.css` (placeholder, replaced in Task 10):
```css
@import 'tailwindcss';
```

`data/temperatures.json`:
```json
[]
```

- [ ] **Step 6: Append to `.gitignore`**

```
artifacts/
```
(`node_modules/` and `dist/` are already present.)

- [ ] **Step 7: Verify build and tests run**

Run: `npm run build && npm run test`
Expected: build succeeds producing `dist/`; vitest reports "No test files found" and exits 0.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts index.html src data .gitignore
git commit -m "chore: scaffold Vite + React + TS project"
```

---

### Task 2: Weather Underground fixture

The parser is tested against the real page. Committing all 1.8 MB is wasteful; only the `app-root-state` script tag matters.

**Files:**
- Create: `tests/fixtures/wu-app-root-state.html`

- [ ] **Step 1: Fetch the live page and trim it to the state blob**

Run:
```bash
mkdir -p tests/fixtures
curl -sL -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36" \
  "https://www.wunderground.com/forecast/KCAREDWO201" -o /tmp/wu-full.html
node -e "
const s = require('fs').readFileSync('/tmp/wu-full.html','utf8');
const m = s.match(/<script id=\"app-root-state\"[^>]*>[\s\S]*?<\/script>/);
if (!m) throw new Error('state tag not found');
require('fs').writeFileSync('tests/fixtures/wu-app-root-state.html', '<html><body>' + m[0] + '</body></html>');
"
ls -la tests/fixtures/wu-app-root-state.html
```
Expected: fixture file of roughly 100–600 KB. (Observed in practice: ~1.6 MB —
WU's blob carries unrelated widget data for other cities plus ad config; the
structural search legitimately walks past it. Not a trimming bug.)

- [ ] **Step 2: Record today's expected value for the test**

Run:
```bash
node -e "
const s = require('fs').readFileSync('tests/fixtures/wu-app-root-state.html','utf8');
const raw = s.match(/<script id=\"app-root-state\"[^>]*>([\s\S]*?)<\/script>/)[1]
  .replaceAll('&q;','\"').replaceAll('&s;',\"'\").replaceAll('&l;','<').replaceAll('&g;','>').replaceAll('&a;','&');
const state = JSON.parse(raw);
function find(o){ if(o&&typeof o==='object'){ if(Array.isArray(o.calendarDayTemperatureMax)&&Array.isArray(o.validTimeLocal)) return o; for(const v of Object.values(o)){const r=find(v); if(r) return r;} } return null; }
const d = find(state);
console.log('date0:', d.validTimeLocal[0], 'max0:', d.calendarDayTemperatureMax[0]);
"
```
Expected: prints today's date and an integer high. **Write both values down — Task 3's test uses them.**

- [ ] **Step 3: Commit**

```bash
git add tests/fixtures/wu-app-root-state.html
git commit -m "test: add trimmed WU forecast page fixture"
```

---

### Task 3: WU forecast parser

> **Amendment (post-review):** the shipped parser takes a third required
> `geocode` argument and selects the daily-forecast response by request URL
> (`forecast/daily` + geocode, with `%2C` decoded), throwing on conflicting
> same-geocode values — the blob contains forecasts for other locations, so
> pure structural first-match can silently pick the wrong station. The code
> below predates that fix; `scripts/wu-parse.ts` is the source of truth.

**Files:**
- Create: `scripts/wu-parse.ts`
- Test: `tests/wu-parse.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/wu-parse.test.ts` — replace `FIXTURE_DATE` / `FIXTURE_MAX` with the values recorded in Task 2 Step 2:

```ts
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { extractForecastHigh } from '../scripts/wu-parse';

// Fixture captured 2026-07-03 00:27 PT; WU had not rolled its day-0 bucket,
// so day 0 is 07-02 (75°F) and day 1 is 07-03 (77°F). That lag is exactly why
// the parser looks the date up instead of assuming index 0.
const html = readFileSync('tests/fixtures/wu-app-root-state.html', 'utf8');

describe('extractForecastHigh', () => {
  it('extracts the high at index 0 when today is day 0', () => {
    expect(extractForecastHigh(html, '2026-07-02')).toBe(75);
  });

  it('finds today at a later index when WU has not rolled over', () => {
    expect(extractForecastHigh(html, '2026-07-03')).toBe(77);
  });

  it('throws when today is not in the forecast window', () => {
    expect(() => extractForecastHigh(html, '1999-01-01')).toThrow(/not found in forecast/);
  });

  it('throws when the state tag is missing', () => {
    expect(() => extractForecastHigh('<html></html>', '2026-07-02')).toThrow(/app-root-state/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/wu-parse.test.ts`
Expected: FAIL — cannot resolve `../scripts/wu-parse`.

- [ ] **Step 3: Write the implementation**

`scripts/wu-parse.ts`:
```ts
interface DailyForecast {
  calendarDayTemperatureMax: (number | null)[];
  validTimeLocal: string[];
}

function findDaily(obj: unknown): DailyForecast | null {
  if (obj && typeof obj === 'object') {
    const o = obj as Record<string, unknown>;
    if (Array.isArray(o.calendarDayTemperatureMax) && Array.isArray(o.validTimeLocal)) {
      return o as unknown as DailyForecast;
    }
    for (const v of Object.values(o)) {
      const r = findDaily(v);
      if (r) return r;
    }
  }
  return null;
}

/**
 * Extract today's forecasted calendar-day high (°F) from the WU forecast page.
 * WU server-renders its API responses into <script id="app-root-state"> with
 * HTML-entity encoding (&q; for quotes). Keys are per-request hashes, so the
 * daily-forecast object is found structurally. `&a;` must be decoded last.
 * Today's entry is looked up by date, NOT assumed to be index 0 — shortly
 * after midnight WU's state can still list yesterday as day zero.
 */
export function extractForecastHigh(html: string, todayISO: string): number {
  const m = html.match(/<script id="app-root-state"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('app-root-state script tag not found — page structure changed?');
  const json = m[1]
    .replaceAll('&q;', '"')
    .replaceAll('&s;', "'")
    .replaceAll('&l;', '<')
    .replaceAll('&g;', '>')
    .replaceAll('&a;', '&');
  const state = JSON.parse(json);
  const daily = findDaily(state);
  if (!daily) throw new Error('daily forecast object not found in app-root-state');
  const idx = daily.validTimeLocal.findIndex((t) => t?.slice(0, 10) === todayISO);
  if (idx === -1) {
    throw new Error(`today ${todayISO} not found in forecast window starting ${daily.validTimeLocal[0]}`);
  }
  const max = daily.calendarDayTemperatureMax[idx];
  if (typeof max !== 'number') throw new Error(`calendarDayTemperatureMax[${idx}] is not a number`);
  return max;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/wu-parse.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add scripts/wu-parse.ts tests/wu-parse.test.ts
git commit -m "feat: parse WU forecast high from embedded app-root-state"
```

---

### Task 4: Data store

**Files:**
- Create: `scripts/data-store.ts`
- Test: `tests/data-store.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/data-store.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { upsert, type DayRecord } from '../scripts/data-store';

const rec = (date: string, patch: Partial<DayRecord> = {}): DayRecord => ({
  date,
  forecast_high_f: null,
  actual_high_f: null,
  forecast_captured_at: null,
  actual_captured_at: null,
  ...patch,
});

describe('upsert', () => {
  it('adds a new record sorted by date', () => {
    const out = upsert([rec('2026-07-02')], '2026-07-01', { forecast_high_f: 75 });
    expect(out.map((r) => r.date)).toEqual(['2026-07-01', '2026-07-02']);
    expect(out[0].forecast_high_f).toBe(75);
  });

  it('patches an existing record without touching other fields', () => {
    const existing = rec('2026-07-02', { forecast_high_f: 75, forecast_captured_at: 'x' });
    const out = upsert([existing], '2026-07-02', { actual_high_f: 81, actual_captured_at: 'y' });
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual(rec('2026-07-02', {
      forecast_high_f: 75, forecast_captured_at: 'x',
      actual_high_f: 81, actual_captured_at: 'y',
    }));
  });

  it('does not mutate the input array', () => {
    const input = [rec('2026-07-02')];
    upsert(input, '2026-07-02', { actual_high_f: 81 });
    expect(input[0].actual_high_f).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/data-store.test.ts`
Expected: FAIL — cannot resolve `../scripts/data-store`.

- [ ] **Step 3: Write the implementation**

`scripts/data-store.ts`:
```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/data-store.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add scripts/data-store.ts tests/data-store.test.ts
git commit -m "feat: add day-record data store with upsert"
```

---

### Task 5: Token-file crypto

**Files:**
- Create: `scripts/crypto.ts`
- Test: `tests/crypto.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/crypto.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from '../scripts/crypto';

describe('crypto round trip', () => {
  it('decrypts what it encrypted', () => {
    const payload = encrypt('{"refresh_token":"abc"}', 'hunter2');
    expect(decrypt(payload, 'hunter2')).toBe('{"refresh_token":"abc"}');
  });

  it('produces different ciphertext each call (random salt/iv)', () => {
    expect(encrypt('x', 'p')).not.toBe(encrypt('x', 'p'));
  });

  it('fails with the wrong passphrase', () => {
    const payload = encrypt('secret', 'right');
    expect(() => decrypt(payload, 'wrong')).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/crypto.test.ts`
Expected: FAIL — cannot resolve `../scripts/crypto`.

- [ ] **Step 3: Write the implementation**

`scripts/crypto.ts`:
```ts
import { scryptSync, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';

// Layout of the base64 payload: salt(16) | iv(12) | authTag(16) | ciphertext

export function encrypt(plaintext: string, passphrase: string): string {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = scryptSync(passphrase, salt, 32);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return Buffer.concat([salt, iv, cipher.getAuthTag(), enc]).toString('base64');
}

export function decrypt(payload: string, passphrase: string): string {
  const buf = Buffer.from(payload, 'base64');
  const salt = buf.subarray(0, 16);
  const iv = buf.subarray(16, 28);
  const tag = buf.subarray(28, 44);
  const data = buf.subarray(44);
  const key = scryptSync(passphrase, salt, 32);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/crypto.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add scripts/crypto.ts tests/crypto.test.ts
git commit -m "feat: AES-256-GCM encryption for Netatmo token file"
```

---

### Task 6: Netatmo client

**Files:**
- Create: `scripts/netatmo.ts`
- Test: `tests/netatmo.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/netatmo.test.ts`:
```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { refreshTokens, getMaxTempF } from '../scripts/netatmo';

afterEach(() => vi.unstubAllGlobals());

function stubFetch(json: unknown, ok = true) {
  const fn = vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 403,
    json: () => Promise.resolve(json),
    text: () => Promise.resolve(JSON.stringify(json)),
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

describe('refreshTokens', () => {
  it('posts the refresh grant and returns new tokens', async () => {
    const fn = stubFetch({ access_token: 'A2', refresh_token: 'R2' });
    const out = await refreshTokens('cid', 'csec', 'R1');
    expect(out).toEqual({ access_token: 'A2', refresh_token: 'R2' });
    const body = String(fn.mock.calls[0][1].body);
    expect(body).toContain('grant_type=refresh_token');
    expect(body).toContain('refresh_token=R1');
  });

  it('throws on a non-OK response', async () => {
    stubFetch({ error: 'invalid_grant' }, false);
    await expect(refreshTokens('c', 's', 'bad')).rejects.toThrow(/403/);
  });
});

describe('getMaxTempF', () => {
  it('returns the max reading converted from °C to rounded °F', async () => {
    // getmeasure body values are °C: max is 27.2°C -> 80.96°F -> 81
    stubFetch({ body: { '1751000000': [24.1], '1751001800': [27.2], '1751003600': [26.0] } });
    const max = await getMaxTempF('token', 'dev:id', 'mod:id', 1751000000, 1751050000);
    expect(max).toBe(81);
  });

  it('returns null when there are no readings', async () => {
    stubFetch({ body: {} });
    expect(await getMaxTempF('t', 'd', 'm', 1, 2)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/netatmo.test.ts`
Expected: FAIL — cannot resolve `../scripts/netatmo`.

- [ ] **Step 3: Write the implementation**

`scripts/netatmo.ts`:
```ts
const API = 'https://api.netatmo.com';

export interface Tokens {
  access_token: string;
  refresh_token: string;
}

async function expectOk(res: Response, what: string): Promise<void> {
  if (!res.ok) {
    throw new Error(`Netatmo ${what} failed: HTTP ${res.status} ${await res.text()}`);
  }
}

/** Netatmo rotates refresh tokens: every refresh invalidates the old one. */
export async function refreshTokens(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<Tokens> {
  const res = await fetch(`${API}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  await expectOk(res, 'token refresh');
  const json = (await res.json()) as Tokens;
  return { access_token: json.access_token, refresh_token: json.refresh_token };
}

/** Max outdoor temperature between two epochs, °C readings converted to rounded °F. */
export async function getMaxTempF(
  accessToken: string,
  deviceId: string,
  moduleId: string,
  beginEpoch: number,
  endEpoch: number,
): Promise<number | null> {
  const params = new URLSearchParams({
    device_id: deviceId,
    module_id: moduleId,
    scale: '30min',
    type: 'max_temp',
    date_begin: String(beginEpoch),
    date_end: String(endEpoch),
    optimize: 'false',
  });
  const res = await fetch(`${API}/api/getmeasure?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  await expectOk(res, 'getmeasure');
  const json = (await res.json()) as { body: Record<string, (number | null)[]> };
  const values = Object.values(json.body)
    .map((v) => v[0])
    .filter((v): v is number => typeof v === 'number');
  if (values.length === 0) return null;
  const maxC = Math.max(...values);
  return Math.round((maxC * 9) / 5 + 32);
}

/** Fetch station metadata to discover device/module ids (used by the auth helper). */
export async function getStations(accessToken: string): Promise<unknown> {
  const res = await fetch(`${API}/api/getstationsdata`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  await expectOk(res, 'getstationsdata');
  return res.json();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/netatmo.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add scripts/netatmo.ts tests/netatmo.test.ts
git commit -m "feat: Netatmo client with token rotation and °C→°F daily max"
```

---

### Task 7: Forecast capture script + workflow

**Files:**
- Create: `scripts/dates.ts`, `scripts/capture-forecast.ts`, `.github/workflows/capture-forecast.yml`
- Test: `tests/dates.test.ts`

- [ ] **Step 1: Write the failing test for date helpers**

`tests/dates.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { pacificTodayISO, pacificMidnightEpoch } from '../scripts/dates';

describe('pacificTodayISO', () => {
  it('formats a known instant in Pacific time', () => {
    // 2026-07-03T03:00Z is 2026-07-02 20:00 PDT
    expect(pacificTodayISO(new Date('2026-07-03T03:00:00Z'))).toBe('2026-07-02');
  });
});

describe('pacificMidnightEpoch', () => {
  it('resolves PDT midnight (UTC-7)', () => {
    expect(pacificMidnightEpoch('2026-07-02')).toBe(Date.parse('2026-07-02T00:00:00-07:00') / 1000);
  });
  it('resolves PST midnight (UTC-8)', () => {
    expect(pacificMidnightEpoch('2026-01-15')).toBe(Date.parse('2026-01-15T00:00:00-08:00') / 1000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/dates.test.ts`
Expected: FAIL — cannot resolve `../scripts/dates`.

- [ ] **Step 3: Implement `scripts/dates.ts`**

```ts
export function pacificTodayISO(now: Date = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
}

/** Epoch seconds of local midnight in America/Los_Angeles, DST-safe. */
export function pacificMidnightEpoch(dateISO: string): number {
  for (const off of ['-07:00', '-08:00']) {
    const ms = Date.parse(`${dateISO}T00:00:00${off}`);
    const d = new Date(ms);
    const sameDay = d.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }) === dateISO;
    const hour = d.toLocaleTimeString('en-GB', { timeZone: 'America/Los_Angeles', hour: '2-digit' });
    if (sameDay && hour === '00') return ms / 1000;
  }
  throw new Error(`cannot resolve Pacific midnight for ${dateISO}`);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/dates.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Implement `scripts/capture-forecast.ts`**

```ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { extractForecastHigh } from './wu-parse';
import { load, save, upsert } from './data-store';
import { pacificTodayISO } from './dates';

const URL = 'https://www.wunderground.com/forecast/KCAREDWO201';
const GEOCODE = '37.471,-122.233'; // KCAREDWO201's location; pins parsing to this station's forecast
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const ATTEMPTS = 3;
const RETRY_DELAY_MS = 10 * 60 * 1000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function attempt(today: string): Promise<number> {
  const res = await fetch(URL, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`WU fetch failed: HTTP ${res.status}`);
  const html = await res.text();
  mkdirSync('artifacts', { recursive: true });
  writeFileSync('artifacts/wu-forecast.html', html); // uploaded on failure for diagnosis
  return extractForecastHigh(html, today, GEOCODE);
}

async function main() {
  const today = pacificTodayISO();
  let lastError: unknown;
  for (let i = 1; i <= ATTEMPTS; i++) {
    try {
      const high = await attempt(today);
      save(upsert(load(), today, {
        forecast_high_f: high,
        forecast_captured_at: new Date().toISOString(),
      }));
      console.log(`forecast ${today}: ${high}°F`);
      return;
    } catch (err) {
      lastError = err;
      console.error(`attempt ${i}/${ATTEMPTS} failed:`, err);
      if (i < ATTEMPTS) await sleep(RETRY_DELAY_MS);
    }
  }
  throw lastError;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 6: Smoke-test locally**

Run: `npm run capture:forecast && cat data/temperatures.json && git checkout data/temperatures.json`
Expected: prints today's forecast, the JSON gains today's record, then the checkout restores the empty file (real data starts accumulating in CI, not from your laptop).

- [ ] **Step 7: Create `.github/workflows/capture-forecast.yml`**

00:05 Pacific is 07:05 UTC during PDT and 08:05 UTC during PST. Both crons fire; the guard keeps whichever matches local midnight hour.

```yaml
name: Capture forecast
on:
  schedule:
    - cron: '5 7 * * *'
    - cron: '5 8 * * *'
  workflow_dispatch:

concurrency:
  group: data-commits
  cancel-in-progress: false

jobs:
  capture:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - name: DST guard (run only at 00:xx Pacific)
        id: guard
        run: |
          H=$(TZ=America/Los_Angeles date +%H)
          if [ "${{ github.event_name }}" = "schedule" ] && [ "$H" != "00" ] && [ "$H" != "01" ]; then
            echo "skip=true" >> "$GITHUB_OUTPUT"
            echo "Skipping: Pacific hour is $H"
          fi
      - uses: actions/checkout@v4
        if: steps.guard.outputs.skip != 'true'
      - uses: actions/setup-node@v4
        if: steps.guard.outputs.skip != 'true'
        with:
          node-version: 22
          cache: npm
      - run: npm ci
        if: steps.guard.outputs.skip != 'true'
      - run: npm run capture:forecast
        if: steps.guard.outputs.skip != 'true'
      - name: Upload raw page on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: wu-forecast-html
          path: artifacts/wu-forecast.html
          retention-days: 7
      - name: Commit data
        if: success() && steps.guard.outputs.skip != 'true'
        run: |
          git config user.name "temperature-bot"
          git config user.email "github-actions@users.noreply.github.com"
          git add data/temperatures.json
          git diff --cached --quiet && exit 0
          git commit -m "data: forecast $(TZ=America/Los_Angeles date +%F)"
          git pull --rebase
          git push
```

- [ ] **Step 8: Run full test suite and commit**

Run: `npm run test`
Expected: all tests pass.

```bash
git add scripts/dates.ts scripts/capture-forecast.ts tests/dates.test.ts .github/workflows/capture-forecast.yml
git commit -m "feat: nightly WU forecast capture with retries and DST guard"
```

---

### Task 8: Actual capture script + workflows

**Files:**
- Create: `scripts/capture-actual.ts`, `.github/workflows/capture-actual.yml`, `.github/workflows/backfill-actual.yml`

- [ ] **Step 1: Implement `scripts/capture-actual.ts`**

Accepts an optional `YYYY-MM-DD` argument for backfill; defaults to today. Reads env: `NETATMO_CLIENT_ID`, `NETATMO_CLIENT_SECRET`, `NETATMO_ENC_PASSPHRASE`, `NETATMO_DEVICE_ID`, `NETATMO_MODULE_ID`.

```ts
import { readFileSync, writeFileSync } from 'node:fs';
import { decrypt, encrypt } from './crypto';
import { refreshTokens, getMaxTempF, type Tokens } from './netatmo';
import { load, save, upsert } from './data-store';
import { pacificTodayISO, pacificMidnightEpoch } from './dates';

export const TOKEN_PATH = 'secrets/netatmo-tokens.enc';

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env var ${name}`);
  return v;
}

async function main() {
  const dateArg = process.argv[2];
  if (dateArg && !/^\d{4}-\d{2}-\d{2}$/.test(dateArg)) {
    throw new Error(`invalid date argument: ${dateArg} (expected YYYY-MM-DD)`);
  }
  const date = dateArg ?? pacificTodayISO();
  const passphrase = env('NETATMO_ENC_PASSPHRASE');

  // Refresh first: Netatmo rotates refresh tokens, so persist the new one immediately.
  const stored: Tokens = JSON.parse(decrypt(readFileSync(TOKEN_PATH, 'utf8'), passphrase));
  const tokens = await refreshTokens(
    env('NETATMO_CLIENT_ID'),
    env('NETATMO_CLIENT_SECRET'),
    stored.refresh_token,
  );
  writeFileSync(TOKEN_PATH, encrypt(JSON.stringify(tokens), passphrase));

  const begin = pacificMidnightEpoch(date);
  const end = dateArg ? begin + 86400 : Math.floor(Date.now() / 1000);
  const high = await getMaxTempF(
    tokens.access_token,
    env('NETATMO_DEVICE_ID'),
    env('NETATMO_MODULE_ID'),
    begin,
    end,
  );
  if (high === null) throw new Error(`no Netatmo readings for ${date}`);

  save(upsert(load(), date, {
    actual_high_f: high,
    actual_captured_at: new Date().toISOString(),
  }));
  console.log(`actual ${date}: ${high}°F`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Verify existing tests still pass (no new unit test — this file is glue over tested modules)**

Run: `npm run test`
Expected: all tests pass.

- [ ] **Step 3: Create `.github/workflows/capture-actual.yml`**

18:05 Pacific is 01:05 UTC (next day) during PDT and 02:05 UTC during PST.

```yaml
name: Capture actual
on:
  schedule:
    - cron: '5 1 * * *'
    - cron: '5 2 * * *'
  workflow_dispatch:

concurrency:
  group: data-commits
  cancel-in-progress: false

jobs:
  capture:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - name: DST guard (run only at 18:xx Pacific)
        id: guard
        run: |
          H=$(TZ=America/Los_Angeles date +%H)
          if [ "${{ github.event_name }}" = "schedule" ] && [ "$H" != "18" ] && [ "$H" != "19" ]; then
            echo "skip=true" >> "$GITHUB_OUTPUT"
            echo "Skipping: Pacific hour is $H"
          fi
      - uses: actions/checkout@v4
        if: steps.guard.outputs.skip != 'true'
      - uses: actions/setup-node@v4
        if: steps.guard.outputs.skip != 'true'
        with:
          node-version: 22
          cache: npm
      - run: npm ci
        if: steps.guard.outputs.skip != 'true'
      - run: npm run capture:actual
        if: steps.guard.outputs.skip != 'true'
        env:
          NETATMO_CLIENT_ID: ${{ secrets.NETATMO_CLIENT_ID }}
          NETATMO_CLIENT_SECRET: ${{ secrets.NETATMO_CLIENT_SECRET }}
          NETATMO_ENC_PASSPHRASE: ${{ secrets.NETATMO_ENC_PASSPHRASE }}
          NETATMO_DEVICE_ID: ${{ secrets.NETATMO_DEVICE_ID }}
          NETATMO_MODULE_ID: ${{ secrets.NETATMO_MODULE_ID }}
      - name: Commit data and rotated token
        if: success() && steps.guard.outputs.skip != 'true'
        run: |
          git config user.name "temperature-bot"
          git config user.email "github-actions@users.noreply.github.com"
          git add data/temperatures.json secrets/netatmo-tokens.enc
          git diff --cached --quiet && exit 0
          git commit -m "data: actual $(TZ=America/Los_Angeles date +%F)"
          git pull --rebase
          git push
```

- [ ] **Step 4: Create `.github/workflows/backfill-actual.yml`**

```yaml
name: Backfill actual
on:
  workflow_dispatch:
    inputs:
      date:
        description: 'Date to backfill (YYYY-MM-DD, Pacific)'
        required: true

concurrency:
  group: data-commits
  cancel-in-progress: false

jobs:
  backfill:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npx tsx scripts/capture-actual.ts "${{ inputs.date }}"
        env:
          NETATMO_CLIENT_ID: ${{ secrets.NETATMO_CLIENT_ID }}
          NETATMO_CLIENT_SECRET: ${{ secrets.NETATMO_CLIENT_SECRET }}
          NETATMO_ENC_PASSPHRASE: ${{ secrets.NETATMO_ENC_PASSPHRASE }}
          NETATMO_DEVICE_ID: ${{ secrets.NETATMO_DEVICE_ID }}
          NETATMO_MODULE_ID: ${{ secrets.NETATMO_MODULE_ID }}
      - name: Commit data and rotated token
        run: |
          git config user.name "temperature-bot"
          git config user.email "github-actions@users.noreply.github.com"
          git add data/temperatures.json secrets/netatmo-tokens.enc
          git diff --cached --quiet && exit 0
          git commit -m "data: backfill actual ${{ inputs.date }}"
          git pull --rebase
          git push
```

- [ ] **Step 5: Commit**

```bash
git add scripts/capture-actual.ts .github/workflows/capture-actual.yml .github/workflows/backfill-actual.yml
git commit -m "feat: daily Netatmo actual capture with token rotation and backfill"
```

---

### Task 9: Netatmo auth helper + setup README

**Files:**
- Create: `scripts/netatmo-auth.ts`, `README.md`, `secrets/.gitkeep`

- [ ] **Step 1: Implement `scripts/netatmo-auth.ts`**

One-time interactive setup. The user generates a refresh token in the Netatmo dev portal's built-in token generator (no OAuth redirect dance needed), and this script validates it, discovers device ids, and writes the encrypted token file.

```ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { encrypt } from './crypto';
import { refreshTokens, getStations } from './netatmo';

const TOKEN_PATH = 'secrets/netatmo-tokens.enc';

interface StationsResponse {
  body: {
    devices: {
      _id: string;
      station_name: string;
      modules: { _id: string; module_name: string; type: string }[];
    }[];
  };
}

async function main() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  console.log('Netatmo one-time setup.');
  console.log('At https://dev.netatmo.com → your app → Token generator,');
  console.log('generate a token with scope "read_station", then paste values here.\n');
  const clientId = (await rl.question('Client ID: ')).trim();
  const clientSecret = (await rl.question('Client secret: ')).trim();
  const refreshToken = (await rl.question('Refresh token: ')).trim();
  const passphrase = (await rl.question('Encryption passphrase (save as NETATMO_ENC_PASSPHRASE secret): ')).trim();
  rl.close();

  // Validate by refreshing (this also rotates the token — we store the new one).
  const tokens = await refreshTokens(clientId, clientSecret, refreshToken);
  console.log('\nToken refresh OK.');

  const stations = (await getStations(tokens.access_token)) as StationsResponse;
  for (const dev of stations.body.devices) {
    console.log(`\nStation "${dev.station_name}"  NETATMO_DEVICE_ID=${dev._id}`);
    for (const mod of dev.modules) {
      const hint = mod.type === 'NAModule1' ? '  <-- outdoor module' : '';
      console.log(`  module "${mod.module_name}" (${mod.type})  NETATMO_MODULE_ID=${mod._id}${hint}`);
    }
  }

  mkdirSync('secrets', { recursive: true });
  writeFileSync(TOKEN_PATH, encrypt(JSON.stringify(tokens), passphrase));
  console.log(`\nWrote ${TOKEN_PATH} — commit this file.`);
  console.log('Add the five NETATMO_* values above as GitHub Actions secrets.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Create `secrets/.gitkeep`** (empty file, keeps the directory in git)

- [ ] **Step 3: Write `README.md`**

```markdown
# High Temperature

Tracks Weather Underground's forecasted daily high vs. the actual high measured
by a Netatmo station in Redwood City, CA. Two GitHub Actions workflows capture
data daily; a dashboard on GitHub Pages shows the table and chart.

Design spec: `docs/superpowers/specs/2026-07-03-high-temperature-tracker-design.md`.

## How it works

- **00:05 Pacific** — `capture-forecast` scrapes wunderground.com's embedded
  forecast JSON and records today's forecasted high.
- **18:05 Pacific** — `capture-actual` asks the Netatmo API for the day's max
  outdoor temperature (max since local midnight).
- Both commit to `data/temperatures.json`; each commit rebuilds the dashboard.
- `Δ = actual − forecast`. Positive = hotter than forecast.

## One-time setup

1. Create a GitHub repository and push this code to `main`.
2. **Netatmo:** create an app at https://dev.netatmo.com (or reuse one), then run
   `npm run netatmo:auth` locally. It prints your device/module ids and writes
   the encrypted token file `secrets/netatmo-tokens.enc`. Commit that file.
3. **Secrets:** in the repo → Settings → Secrets and variables → Actions, add:
   `NETATMO_CLIENT_ID`, `NETATMO_CLIENT_SECRET`, `NETATMO_ENC_PASSPHRASE`,
   `NETATMO_DEVICE_ID`, `NETATMO_MODULE_ID`.
   `NETATMO_ENC_PASSPHRASE` MUST be randomly generated and high-entropy
   (e.g. `openssl rand -base64 24`) — the encrypted token file is committed
   to a public repo, so passphrase strength is the entire security of it.
   A human-chosen passphrase is brute-forceable offline; a random one is not.
4. **Pages:** Settings → Pages → Source: **GitHub Actions**.
5. Trigger both capture workflows once by hand (Actions tab → Run workflow) to
   verify end to end.

Workflow failures email you via GitHub's default notifications. A missed
forecast is gone forever; a missed actual is repairable via the
**Backfill actual** workflow (Actions tab → enter the date).

## Development

- `npm run dev` — dashboard with sample data when `data/temperatures.json` is empty
- `npm run test` — unit + component tests
- `npm run capture:forecast` / `npm run capture:actual` — run captures locally
```

- [ ] **Step 4: Commit**

```bash
git add scripts/netatmo-auth.ts README.md secrets/.gitkeep
git commit -m "feat: Netatmo one-time auth helper and setup README"
```

---

### Task 10: Dashboard theme foundation

Implements the shadcn preset `b5K0K3ezx` tokens (extracted from shadcnpreset.com during design; hardcoded so the build never depends on that site), JetBrains Mono, radius 0, and the theme system.

**Files:**
- Create: `src/lib/utils.ts`, `src/components/ui/card.tsx`, `src/lib/theme.ts`
- Modify: `src/index.css`, `src/main.tsx`

- [ ] **Step 1: Replace `src/index.css` with the preset theme**

```css
@import 'tailwindcss';
@import '@fontsource/jetbrains-mono/400.css';
@import '@fontsource/jetbrains-mono/500.css';
@import '@fontsource/jetbrains-mono/600.css';
@import '@fontsource/jetbrains-mono/700.css';

@custom-variant dark (&:where(.dark, .dark *));

/* shadcn preset b5K0K3ezx — style lyra, mauve base, red theme, radius 0 */
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0.008 326);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0.008 326);
  --primary: oklch(0.505 0.213 27.518);
  --primary-foreground: oklch(0.971 0.013 17.38);
  --muted: oklch(0.96 0.003 325.6);
  --muted-foreground: oklch(0.542 0.034 322.5);
  --border: oklch(0.922 0.005 325.62);
  --radius: 0;
  /* chart chrome (design spec) */
  --grid: #f0edf0;
  --axis: #dbd6db;
  --faint: #a89ea9;
  --inv-bg: #0c090c;
  --inv-fg: #fafafa;
  --neutral-mark: #b5aeb6;
  --month-line: rgba(12, 9, 12, 0.18);
  --week-line: rgba(12, 9, 12, 0.07);
  --status-ok: #00a63e;
}
.dark {
  --background: oklch(0.145 0.008 326);
  --foreground: oklch(0.985 0 0);
  --card: #171118;
  --card-foreground: oklch(0.985 0 0);
  --primary: oklch(0.704 0.191 22.216);
  --primary-foreground: oklch(0.971 0.013 17.38);
  --muted: oklch(0.263 0.024 320.12);
  --muted-foreground: oklch(0.711 0.019 323.02);
  --border: oklch(1 0 0 / 10%);
  --grid: rgba(255, 255, 255, 0.06);
  --axis: rgba(255, 255, 255, 0.16);
  --faint: #6b5f6d;
  --inv-bg: #fafafa;
  --inv-fg: #0c090c;
  --neutral-mark: #5c525e;
  --month-line: rgba(255, 255, 255, 0.15);
  --week-line: rgba(255, 255, 255, 0.06);
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-border: var(--border);
  --color-faint: var(--faint);
  --color-inv-bg: var(--inv-bg);
  --color-inv-fg: var(--inv-fg);
  --font-sans: 'JetBrains Mono', ui-monospace, monospace;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;
  --radius: 0;
}

body {
  @apply bg-background text-foreground font-mono antialiased;
}
```

- [ ] **Step 2: Create `src/lib/utils.ts`**

```ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 3: Create `src/components/ui/card.tsx`** (shadcn card, radius 0)

```tsx
import { cn } from '../../lib/utils';

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('border border-border bg-card text-card-foreground', className)} {...props} />;
}
```

- [ ] **Step 4: Create `src/lib/theme.ts`** (follow system + manual override)

```ts
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
```

- [ ] **Step 5: Verify the build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/index.css src/lib/utils.ts src/lib/theme.ts src/components/ui/card.tsx
git commit -m "feat: preset b5K0K3ezx theme tokens, fonts, and theme system"
```

---

### Task 11: Chart color system, date display helpers, sample data

**Files:**
- Create: `src/lib/colors.ts`, `src/lib/display-dates.ts`, `src/lib/sample-data.ts`, `src/lib/records.ts`
- Test: `tests/colors.test.ts`, `tests/display-dates.test.ts`

- [ ] **Step 1: Write the failing tests**

`tests/colors.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { ARMS, binOf, colorOf, inkFor } from '../src/lib/colors';

describe('binOf', () => {
  it('maps |Δ| to bins 0-4 at thresholds 3/5/7/9', () => {
    expect([1, 2.9, 3, 5, 7, 9, 15].map(binOf)).toEqual([0, 0, 1, 2, 3, 4, 4]);
  });
});

describe('colorOf', () => {
  it('returns null inside the ±1 neutral band', () => {
    expect(colorOf(0.5, 'light')).toBeNull();
    expect(colorOf(-0.9, 'dark')).toBeNull();
  });
  it('uses the hot arm for positive Δ and cold for negative', () => {
    expect(colorOf(11, 'light')).toBe(ARMS.light.hot[4]);
    expect(colorOf(-4, 'dark')).toBe(ARMS.dark.cold[1]);
  });
});

describe('inkFor', () => {
  it('picks dark ink on pale fills and white on saturated fills', () => {
    expect(inkFor(ARMS.dark.hot[0])).toBe('#0c090c'); // pale wash
    expect(inkFor(ARMS.light.hot[4])).toBe('#ffffff'); // saturated
  });
});
```

`tests/display-dates.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { isMonday, monthOf, fmtDay } from '../src/lib/display-dates';

describe('display date helpers', () => {
  it('detects Mondays', () => {
    expect(isMonday('2026-06-29')).toBe(true);
    expect(isMonday('2026-06-28')).toBe(false);
  });
  it('extracts the month key', () => {
    expect(monthOf('2026-07-02')).toBe('2026-07');
  });
  it('formats weekday and month-day labels', () => {
    expect(fmtDay('2026-06-23')).toEqual({ w: 'TUE', md: 'JUN 23' });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/colors.test.ts tests/display-dates.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `src/lib/colors.ts`**

The hex values are the validator-passed ramps from the spec — copy them exactly; do not adjust by eye.

```ts
export type Mode = 'light' | 'dark';

/**
 * Diverging arms, validated with the dataviz ordinal validator (spec §Dashboard).
 * Index 0 = |Δ| 1-3°F … index 4 = |Δ| ≥ 9°F.
 * Both modes: pale near ±1, saturated at the extremes (per user decision —
 * dark mode intentionally does NOT flip the ramp anchor).
 */
export const ARMS: Record<Mode, { hot: string[]; cold: string[] }> = {
  light: {
    hot: ['#e59b92', '#dd7e74', '#d55f56', '#ca3c36', '#bb0916'],
    cold: ['#7ebadd', '#5aa5d2', '#2a90ca', '#007abe', '#0064ab'],
  },
  dark: {
    hot: ['#ebb0a9', '#e68e83', '#df695e', '#d1433c', '#bc191d'],
    cold: ['#95c9e8', '#68b3e0', '#329cd9', '#0084cb', '#006cb6'],
  },
};

export const binOf = (delta: number): number => {
  const a = Math.abs(delta);
  return a >= 9 ? 4 : a >= 7 ? 3 : a >= 5 ? 2 : a >= 3 ? 1 : 0;
};

/** null = inside the ±1 neutral band (rendered as a single gray dot). */
export function colorOf(delta: number, mode: Mode): string | null {
  if (Math.abs(delta) < 1) return null;
  const arm = delta > 0 ? ARMS[mode].hot : ARMS[mode].cold;
  return arm[binOf(delta)];
}

/** Chip text color by fill luminance (WCAG relative luminance, 0.35 threshold). */
export function inkFor(hex: string): string {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.35 ? '#0c090c' : '#ffffff';
}
```

- [ ] **Step 4: Implement `src/lib/display-dates.ts`**

```ts
/** Weekday of a YYYY-MM-DD string; date-only, so UTC parsing is exact. */
export const weekday = (dateISO: string): number => new Date(`${dateISO}T00:00:00Z`).getUTCDay();

export const isMonday = (dateISO: string): boolean => weekday(dateISO) === 1;

export const monthOf = (dateISO: string): string => dateISO.slice(0, 7);

export function fmtDay(dateISO: string): { w: string; md: string } {
  const d = new Date(`${dateISO}T00:00:00Z`);
  const w = d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }).toUpperCase();
  const md = d
    .toLocaleDateString('en-US', { month: 'short', day: '2-digit', timeZone: 'UTC' })
    .toUpperCase();
  return { w, md };
}
```

- [ ] **Step 5: Implement `src/lib/records.ts`** (shared types + view slicing + stats)

```ts
// Single source of truth for the record shape lives in scripts/data-store.ts.
// A type-only re-export is erased at compile time, so no Node code reaches the bundle.
export type { DayRecord } from '../../scripts/data-store';
import type { DayRecord } from '../../scripts/data-store';

export type View = 'week' | 'month' | 'year';
export const VIEW_DAYS: Record<View, number> = { week: 14, month: 31, year: 365 };

/** Last N days of records (records are stored sorted ascending by date). */
export function sliceView(records: DayRecord[], view: View): DayRecord[] {
  return records.slice(-VIEW_DAYS[view]);
}

export const deltaOf = (r: DayRecord): number | null =>
  r.forecast_high_f !== null && r.actual_high_f !== null
    ? r.actual_high_f - r.forecast_high_f
    : null;

export function meanDelta(records: DayRecord[]): number | null {
  const ds = records.map(deltaOf).filter((d): d is number => d !== null);
  if (ds.length === 0) return null;
  return ds.reduce((a, b) => a + b, 0) / ds.length;
}
```

- [ ] **Step 6: Implement `src/lib/sample-data.ts`** (dev fallback + component-test input)

```ts
import type { DayRecord } from './records';

/**
 * Deterministic 28-day sample ending 2026-07-02, exercising: hot and cold days,
 * every intensity bin, the ±1 neutral band, a missing actual, a missing
 * forecast, and a June→July month boundary.
 */
export function sampleRecords(): DayRecord[] {
  const deltas: (number | 'no-actual' | 'no-forecast')[] = [
    3, 5, -2, 0, 7, 9, 4, 11, 2, 'no-actual', 6, -4, 1, 8,
    3, 6, 8, 5, 11, 2, 0, 'no-forecast', 7, -4, 6, 9, 3, 6,
  ];
  const forecasts = [71, 73, 74, 76, 72, 70, 69, 68, 70, 78, 72, 71, 74, 75,
    71, 73, 74, 76, 72, 70, 69, 68, 70, 78, 72, 71, 74, 75];
  const start = new Date('2026-06-05T00:00:00Z');
  return deltas.map((d, i) => {
    const date = new Date(start.getTime() + i * 86400_000).toISOString().slice(0, 10);
    const f = forecasts[i];
    return {
      date,
      forecast_high_f: d === 'no-forecast' ? null : f,
      actual_high_f: d === 'no-actual' || d === 'no-forecast' ? (d === 'no-forecast' ? f + 4 : null) : f + (d as number),
      forecast_captured_at: d === 'no-forecast' ? null : `${date}T07:05:00Z`,
      actual_captured_at: d === 'no-actual' ? null : `${date}T01:05:00Z`,
    };
  });
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run tests/colors.test.ts tests/display-dates.test.ts`
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add src/lib/colors.ts src/lib/display-dates.ts src/lib/records.ts src/lib/sample-data.ts tests/colors.test.ts tests/display-dates.test.ts
git commit -m "feat: validated diverging color system, view slicing, sample data"
```

---

### Task 12: Dumbbell chart component

**Files:**
- Create: `src/components/DumbbellChart.tsx`
- Test: `tests/DumbbellChart.test.tsx`

- [ ] **Step 1: Write the failing test**

`tests/DumbbellChart.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { DumbbellChart } from '../src/components/DumbbellChart';
import { sampleRecords } from '../src/lib/sample-data';
import { ARMS } from '../src/lib/colors';

const records = sampleRecords().slice(-14);

describe('DumbbellChart', () => {
  it('renders a stem and two dots for a complete day, colored by Δ bin', () => {
    const { container } = render(<DumbbellChart records={records} mode="light" />);
    // last record: forecast 75, actual 81, Δ +6 -> hot bin 2
    const color = ARMS.light.hot[2];
    const stems = container.querySelectorAll(`line[stroke="${color}"]`);
    expect(stems.length).toBeGreaterThan(0);
  });

  it('renders month and week separator lines', () => {
    const { container } = render(<DumbbellChart records={records} mode="light" />);
    expect(container.querySelector('line[data-sep="month"]')).not.toBeNull();
    expect(container.querySelector('line[data-sep="week"]')).not.toBeNull();
  });

  it('shows the hover readout for a day and clears it on leave', () => {
    const { container, getByTestId } = render(<DumbbellChart records={records} mode="light" />);
    const hits = container.querySelectorAll('rect[data-hit]');
    // mouseOver/mouseOut (not mouseEnter/mouseLeave): React implements its
    // synthetic enter/leave events on top of over/out, and jsdom only
    // triggers them reliably this way.
    fireEvent.mouseOver(hits[hits.length - 1]);
    expect(getByTestId('readout').textContent).toContain('Δ +6°');
    fireEvent.mouseOut(container.querySelector('[data-chart-zone]')!);
    expect(getByTestId('readout').textContent).toContain('HOVER A DAY');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/DumbbellChart.test.tsx`
Expected: FAIL — component not found.

- [ ] **Step 3: Implement `src/components/DumbbellChart.tsx`**

```tsx
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

  // Thin x labels: every day ≤ 31 records, else Mondays only, else month starts.
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
          {/* weekOf comparison (not isMonday) so a missing Monday still draws the rule */}
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/DumbbellChart.test.tsx`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/components/DumbbellChart.tsx tests/DumbbellChart.test.tsx
git commit -m "feat: dumbbell chart with diverging bins, readout, and time dividers"
```

---

### Task 13: Table, top bar, and app assembly

**Files:**
- Create: `src/components/DataTable.tsx`, `src/components/TopBar.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Implement `src/components/DataTable.tsx`**

```tsx
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
```

- [ ] **Step 2: Implement `src/components/TopBar.tsx`**

```tsx
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
```

- [ ] **Step 3: Replace `src/App.tsx`**

```tsx
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
```

- [ ] **Step 4: Verify visually with sample data**

Run: `npm run dev`
Open the printed URL. Expected: the dashboard matches mockup v4 (`.superpowers/brainstorm/14149-1783057263/content/shadcn-dashboard-v4.html`): dumbbells with filled/open dots, pale-middle ramps, hover readout top-right, month/week rules, WEEK/MONTH/YEAR toggle, table with chips and week dividers, theme toggle switching modes. Check both themes.

- [ ] **Step 5: Run the full suite and commit**

Run: `npm run test && npm run build`
Expected: all tests pass; build succeeds.

```bash
git add src/App.tsx src/components/DataTable.tsx src/components/TopBar.tsx
git commit -m "feat: assemble dashboard with table, top bar, and view toggle"
```

---

### Task 14: Deploy workflow + end-to-end verification

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Create `.github/workflows/deploy.yml`**

```yaml
name: Deploy dashboard
on:
  push:
    branches: [main]
  # Data commits are pushed by the capture workflows using GITHUB_TOKEN, and
  # GITHUB_TOKEN pushes do NOT emit push events (GitHub's recursion guard).
  # workflow_run is what makes the dashboard rebuild after each capture.
  workflow_run:
    workflows: ['Capture forecast', 'Capture actual', 'Backfill actual']
    types: [completed]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    if: github.event_name != 'workflow_run' || github.event.workflow_run.conclusion == 'success'
    steps:
      - uses: actions/checkout@v4
        with:
          ref: main # workflow_run checks out the default branch tip, which includes the data commit
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run test
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Full local verification**

Run: `npm run test && npm run build && npx vite preview`
Expected: all tests pass; the preview URL serves the dashboard identically to dev.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: build and deploy dashboard to GitHub Pages"
```

- [ ] **Step 4: Hand off to Charles for the manual setup**

The remaining steps need his accounts (from README "One-time setup"): create the GitHub repo and push; run `npm run netatmo:auth`; add the five secrets; enable Pages (source: GitHub Actions); hand-run both capture workflows and confirm a data commit + dashboard deploy.

---

## Verification checklist (after all tasks)

- [ ] `npm run test` — all unit and component tests pass
- [ ] `npm run build` — clean build
- [ ] Dashboard on sample data matches mockup v4 in both themes
- [ ] `npm run capture:forecast` locally writes today's record (then `git checkout data/temperatures.json`)
- [ ] Both capture workflows green on manual dispatch in GitHub; `data/temperatures.json` gains real records
- [ ] Pages URL serves the dashboard with real data after the next data commit
