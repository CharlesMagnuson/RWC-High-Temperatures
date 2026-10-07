# High Temperature

Tracks Weather Underground's forecasted daily high vs. the actual high measured
by a Netatmo station in Redwood City, CA. Two GitHub Actions workflows capture
data daily; a dashboard on GitHub Pages at https://redwoodcityis.hot shows the
table and chart.

Design spec: `docs/superpowers/specs/2026-07-03-high-temperature-tracker-design.md`.

## How it works

- **00:00 Pacific** — `capture-forecast` records the forecasted high for the
  day that just began, i.e. the forecast as it stood at the start of the day.
  It reads the forecast from the api.weather.com endpoint that wunderground.com
  itself uses (`scripts/wu-api.ts`), taking the current API key from whatever
  WU serves for the station page, and falls back to parsing the forecast JSON
  embedded in the old server-rendered page (`scripts/wu-parse.ts`). Up to 12
  attempts, 3 min apart. First capture wins: a later run for the same date is
  a no-op.
- **16:30 Pacific** — `capture-actual` asks the Netatmo API for the day's max
  outdoor temperature (max since local midnight). The daily high never happens
  after 16:00 here, so a late run still records the correct value.
- Both commit to `data/temperatures.json`; each commit rebuilds the dashboard
  (`deploy.yml`, triggered by `workflow_run` because `GITHUB_TOKEN` pushes do
  not emit push events).
- `Δ = actual − forecast`. Positive = hotter than forecast.

### Scheduling

GitHub's own `on: schedule` is best-effort and was observed running 7–11
hours late in Aug 2026. Since 2026-08-28 the primary trigger is the
**Scheduler** Cloudflare Worker (`~/Developer/Scheduler`), which fires
`workflow_dispatch` at exactly the times above, resolving DST itself.
Cloudflare occasionally skips a firing, so the Worker re-fires every 30 min
(forecast through 02:30 PDT / 01:30 PST, actual through 18:30 PDT / 17:30 PST)
and dispatches unless a `workflow_dispatch` run that day already succeeded or
is still running. A run that **failed** does not count, so a transient failure
at 00:00 is retried at 00:30, 01:00, … (until 2026-10-06 any run counted, and a
failed 00:01 run blocked every retry; that is how 2026-10-05's forecast was
lost).

Each workflow keeps a cron as a **fallback only**, timed so it can never fire
before the Worker in either DST regime. Fallback runs pass through a Pacific
time-of-day guard: the forecast runs only 00:00–06:59 (a mid-morning forecast
is a different forecast, and forecasts cannot be backfilled, so a gap beats a
wrong value); the actual runs only 16:00–23:59. Worker dispatches skip the
guard. Every workflow is idempotent and shares the `data-commits` concurrency
group, so a late duplicate is harmless.

### Monitoring

Each capture pings healthchecks.io on success (`high-temp-forecast`,
`high-temp-actual`) and hits `/fail` on failure. The checks expect a daily ping
with 1 h grace and email when it is missing. Guard-skipped fallback runs do not
ping, so a skip cannot mask a missed capture. GitHub also emails on workflow
failure. A missed forecast is gone forever; a missed actual is repairable via
the **Backfill actual** workflow (Actions tab → enter the date).

## One-time setup

0. Prerequisites: Node ≥ 22, then `npm install` (the `postinstall` step applies
   `patches/cuelume+0.2.2.patch` via patch-package).
1. Create a GitHub repository and push this code to `main`.
2. **Netatmo:** create an app at https://dev.netatmo.com (or reuse one), then run
   `npm run netatmo:auth` locally. It prints your device/module ids and writes
   the encrypted token file `secrets/netatmo-tokens.enc`. Commit that file.
3. **Secrets:** in the repo → Settings → Secrets and variables → Actions, add:
   `NETATMO_CLIENT_ID`, `NETATMO_CLIENT_SECRET`, `NETATMO_ENC_PASSPHRASE`,
   `NETATMO_DEVICE_ID`, `NETATMO_MODULE_ID`, and `HC_PING_KEY` (the
   healthchecks.io project ping key).

   > **`NETATMO_ENC_PASSPHRASE` must be randomly generated and high-entropy**
   > (e.g. `openssl rand -base64 24`). The encrypted token file is committed to
   > a public repo, so passphrase strength is its entire security: a
   > human-chosen passphrase is brute-forceable offline; a random one is not.

4. **healthchecks.io:** create two checks named `high-temp-forecast` and
   `high-temp-actual` with a daily period and 1 h grace, using slug-based pings.
5. **Pages:** Settings → Pages → Source: **GitHub Actions**; set the custom
   domain to `redwoodcityis.hot`.
6. **Scheduler Worker:** follow the one-time setup in `~/Developer/Scheduler`
   (fine-grained PAT with Actions read/write on this repo, stored as the Worker's
   `GITHUB_TOKEN` secret, then `npm run deploy`). Without it, only the fallback
   crons run, hours late.
7. Trigger both capture workflows once by hand (Actions tab → Run workflow) to
   verify end to end.

If a scheduled `capture-actual` run fires between pushing the code (step 1) and
finishing steps 2–3, it fails and emails you — that is expected; it resolves
itself once the token file and secrets are in place.

## Known failure modes

- **Netatmo token chain:** Netatmo rotates the refresh token on every use. The
  workflows persist the rotated token immediately (even when the temperature
  read fails), but one hazard is unavoidable by design: if Netatmo rotates the
  token server-side and the HTTP response is lost in transit, the chain breaks.
  Symptom: `capture-actual` fails with an auth error. Fix: re-run
  `npm run netatmo:auth` locally and commit the new token file.
- **WU page drift:** since Sept 2026 WU intermittently serves a client-side
  app shell (HTTP 404, no embedded forecast) instead of the server-rendered
  station page; on 2026-10-04/05 it did so for every attempt. The capture now
  reads the forecast from api.weather.com directly, using the key embedded in
  either page shape (with a known-good fallback key in `scripts/wu-api.ts`;
  keys rotate every few months but old ones keep working). If the API fails
  too, the run falls back to the old page parser and, failing that, fails
  loudly and uploads the raw page as a workflow artifact for diagnosis.
- **Worker did not dispatch:** if a healthchecks.io alert arrives and the
  Actions tab shows no `workflow_dispatch` run for the day, check the Worker's
  logs (`~/Developer/Scheduler`, `npx wrangler tail`). A skipped forecast
  cannot be recovered; a skipped actual can be backfilled.

## Development

- `npm run dev` — dashboard with sample data when `data/temperatures.json` is empty
- `npm run test` — unit + component tests
- `npm run build` — type-check and build the dashboard into `dist/` (what `deploy.yml` runs)
- `npm run capture:forecast` — run the forecast capture locally (then
  `git checkout data/temperatures.json` to discard, since real data accumulates in CI)
- `npm run capture:actual [-- YYYY-MM-DD]` — run the actual capture locally; needs
  the five `NETATMO_*` env vars set and `secrets/netatmo-tokens.enc` present
  (note: each run rotates the Netatmo token — commit the updated token file
  afterward or the CI chain breaks)
