# High Temperature Tracker — Design

**Date:** 2026-07-03
**Status:** Approved by Charles (design + dashboard mockup v4)
**Mockup reference:** `.superpowers/brainstorm/14149-1783057263/content/shadcn-dashboard-v4.html`

## Purpose

Weather Underground's forecasted high for Redwood City, CA regularly misses the
temperature Charles's Netatmo station records. This tool captures both numbers
daily, stores them forever, and shows the difference in a table and chart.

**Difference is defined as `Δ = actual − forecast`.** Positive Δ means the day
ran hotter than forecast.

## Architecture

One public GitHub repository contains everything:

- **Two scheduled GitHub Actions workflows** capture data daily.
- **`data/temperatures.json`** accumulates one record per day.
- **A static dashboard** (React + shadcn/ui) deploys to GitHub Pages on every
  data commit.

No servers. Every capture is a git commit, so history is complete and
tamper-evident. All temperatures are °F; all dates are Pacific (America/Los_Angeles).

## Data capture

### Forecast (nightly, ~00:05 Pacific)

1. Fetch `https://www.wunderground.com/forecast/KCAREDWO201` with a browser
   User-Agent.
2. Parse the embedded `<script id="app-root-state">` JSON blob (HTML-entity
   encoded: `&q;` → `"`). WU server-renders its API responses into this blob;
   it survives visual redesigns.
3. Find the daily-forecast object **structurally** — the object containing both
   `calendarDayTemperatureMax` and `validTimeLocal` — because the blob's keys
   are per-request hashes.
4. Verify `validTimeLocal[0]` matches today's Pacific date, then record
   `calendarDayTemperatureMax[0]` as today's forecasted high.
   (`temperatureMax[0]` nulls out after the daytime period passes;
   calendar-day does not. Validated against the live page 2026-07-02:
   forecast high 75°F.)
5. On fetch or parse failure: retry 3× over ~30 minutes, then fail the workflow.
   Upload the raw HTML as a 7-day workflow artifact for diagnosis.

### Actual (daily, ~18:05 Pacific)

1. Call the Netatmo API for the outdoor module's temperature series from local
   midnight to now.
2. Record the maximum as the day's actual high.

A late-firing run captures a larger window, never a smaller one. Actuals are
recoverable from Netatmo history, so a manually-triggered **backfill workflow**
repairs missed days. Forecasts are not recoverable; a missed forecast stays
blank forever.

### Scheduling and DST

GitHub cron runs in UTC and cannot follow daylight-saving shifts. Each workflow
schedules **both** candidate UTC hours; a guard step exits unless the current
America/Los_Angeles hour matches the target. Cron delay of minutes is harmless
for both captures. Both workflows also accept `workflow_dispatch` for manual runs.

### Netatmo authentication

Netatmo rotates refresh tokens: each refresh invalidates the previous token,
which breaks naive unattended setups. Design:

- One-time setup: Charles creates (or reuses) a Netatmo developer app and
  completes an initial OAuth authorization.
- Tokens live in a small file in the repo, encrypted with a passphrase stored
  in GitHub Actions secrets.
- After each refresh, the workflow re-encrypts and commits the updated tokens.

Self-contained; no personal access tokens.

## Data storage

`data/temperatures.json` — an array of records:

```json
{
  "date": "2026-07-02",
  "forecast_high_f": 75,
  "actual_high_f": 81,
  "forecast_captured_at": "2026-07-02T07:05:12Z",
  "actual_captured_at": "2026-07-03T01:05:44Z"
}
```

Missing captures are `null`. Δ is computed at display time, never stored.
One record per day stays small for decades.

## Dashboard

### Stack

- React + Vite + Tailwind + **shadcn/ui**, built to static files by GitHub
  Actions, served by GitHub Pages.
- **Theme: shadcn preset `b5K0K3ezx`** (shadcnpreset.com) — style *lyra*, mauve
  base, red theme, sky charts, JetBrains Mono for body and headings, radius 0,
  Phosphor icons. Registry theme name: `mauve-red`.
- Theme follows the system (light/dark) with a manual toggle in the top bar.
- The chart is a custom SVG React component inside a shadcn Card. No charting
  library — the mark is bespoke.

### Layout (chart-first, per approved mockup v4)

1. **Top bar:** red square mark, "HIGH TEMPERATURE / REDWOOD CITY, CA", capture
   status, theme toggle.
2. **Chart card:** label, title, date range + `Δ MEAN` summary; WEEK / MONTH /
   YEAR segmented toggle (active segment inverted); the chart; legend strip.
3. **Table card:** newest-first rows — DATE, FORECAST, ACTUAL, Δ chip.
4. **Footer:** data sources and record length.

### Chart encoding

- **One dumbbell per day:** a 2.5px vertical stem from forecast to actual;
  **filled dot = actual, open dot = forecast** (r ≈ 4.5, 2px surface ring).
  Shape carries direction, so the encoding survives colorblindness and
  grayscale.
- **Days with |Δ| < 1°F** collapse to a single filled gray dot.
- **Color = diverging intensity by Δ**, five bins per arm:
  |Δ| 1–3, 3–5, 5–7, 7–9, 9+ °F. Hot arm (Δ > 0) uses the preset's red; cold
  arm (Δ < 0) uses the preset's sky blue. **Both modes run pale near ±1 and
  saturated at the extremes** (Charles's explicit preference; dark mode does
  not flip). All four arms passed the dataviz ordinal validator (monotone
  lightness, ΔL ≥ 0.06 between steps, contrast floor vs. surface):

  | Arm | Bin 1 (±1–3°) → Bin 5 (9°+) |
  |---|---|
  | Hot, light | `#e59b92` `#dd7e74` `#d55f56` `#ca3c36` `#bb0916` |
  | Cold, light | `#7ebadd` `#5aa5d2` `#2a90ca` `#007abe` `#0064ab` |
  | Hot, dark | `#ebb0a9` `#e68e83` `#df695e` `#d1433c` `#bc191d` |
  | Cold, dark | `#95c9e8` `#68b3e0` `#329cd9` `#0084cb` `#006cb6` |

  Surfaces: light `#ffffff`, dark `#0c090c` (preset background tokens).
- **Hover readout, not tooltips:** hovering a day's column writes
  `TUE JUN 23 · FCST 72° · ACTUAL 83° · Δ +11°` into a fixed region at the
  top-right of the chart; leaving clears it to a faint "HOVER A DAY". No
  floating tooltip, no per-day value labels on the chart.
- **Time divisions:** a soft vertical line at each month boundary; an even
  softer line at each week boundary (weeks begin Monday). Horizontal
  gridlines are solid hairlines at 5°F steps.
- **Legend:** the full cold ↔ ±1 ↔ hot bin strip, plus filled/open dot key.
- **Views:** WEEK (14 days), MONTH, YEAR. Denser views thin the x-axis labels;
  the encoding is unchanged.

### Table

- JetBrains Mono, `tabular-nums`, right-aligned numbers.
- Δ rendered as a chip filled with the day's bin color; chip text color chosen
  by fill luminance (dark ink on pale fills, white on saturated).
- Missing values render as "—".
- A stronger divider under each Monday row separates weeks (newest-first
  order puts the divider between a week and the previous week's Sunday).

## Error handling

- Workflow failure triggers GitHub's failure email to Charles.
- The scraper fails fast with a clear message if the WU page structure changes;
  the saved HTML artifact supports diagnosis.
- Missed forecast: permanent blank. Missed actual: run the backfill workflow.

## Testing

- Scraper parser: unit tests against the saved fixture of the real WU page.
- Netatmo client and data-file update logic: unit tests with mocked responses.
- Dashboard: rendered against a generated sample dataset covering missing
  values, DST boundaries, week/month/year rollovers, and both ramp modes.

## Out of scope (YAGNI)

Multiple locations, other forecast providers, humidity/precipitation, user
accounts, historical forecast backfill, private dashboards.
