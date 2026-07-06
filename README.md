# High Temperature

Tracks Weather Underground's forecasted daily high vs. the actual high measured
by a Netatmo station in Redwood City, CA. Two GitHub Actions workflows capture
data daily; a dashboard on GitHub Pages shows the table and chart.

Design spec: `docs/superpowers/specs/2026-07-03-high-temperature-tracker-design.md`.

## How it works

Times are approximate. GitHub does not run actions reliably. They usually run 1-2 hours late.
- **22:05 Pacific** — `capture-forecast` scrapes wunderground.com's embedded
  forecast JSON and records tomorrow's forecasted high.
- **16:05 Pacific** — `capture-actual` asks the Netatmo API for the day's max
  outdoor temperature (max since local midnight).
- Both commit to `data/temperatures.json`; each commit rebuilds the dashboard.
- `Δ = actual − forecast`. Positive = hotter than forecast.

## One-time setup

0. Prerequisites: Node ≥ 22, then `npm install`.
1. Create a GitHub repository and push this code to `main`.
2. **Netatmo:** create an app at https://dev.netatmo.com (or reuse one), then run
   `npm run netatmo:auth` locally. It prints your device/module ids and writes
   the encrypted token file `secrets/netatmo-tokens.enc`. Commit that file.
3. **Secrets:** in the repo → Settings → Secrets and variables → Actions, add:
   `NETATMO_CLIENT_ID`, `NETATMO_CLIENT_SECRET`, `NETATMO_ENC_PASSPHRASE`,
   `NETATMO_DEVICE_ID`, `NETATMO_MODULE_ID`.

   > **`NETATMO_ENC_PASSPHRASE` must be randomly generated and high-entropy**
   > (e.g. `openssl rand -base64 24`). The encrypted token file is committed to
   > a public repo, so passphrase strength is its entire security: a
   > human-chosen passphrase is brute-forceable offline; a random one is not.

4. **Pages:** Settings → Pages → Source: **GitHub Actions**.
5. Trigger both capture workflows once by hand (Actions tab → Run workflow) to
   verify end to end.

If a scheduled `capture-actual` run fires between pushing the code (step 1) and
finishing steps 2–3, it fails and emails you — that is expected; it resolves
itself once the token file and secrets are in place.

Workflow failures email you via GitHub's default notifications. A missed
forecast is gone forever; a missed actual is repairable via the
**Backfill actual** workflow (Actions tab → enter the date).

## Known failure modes

- **Netatmo token chain:** Netatmo rotates the refresh token on every use. The
  workflows persist the rotated token immediately (even when the temperature
  read fails), but one hazard is unavoidable by design: if Netatmo rotates the
  token server-side and the HTTP response is lost in transit, the chain breaks.
  Symptom: `capture-actual` fails with an auth error. Fix: re-run
  `npm run netatmo:auth` locally and commit the new token file.
- **WU page drift:** if Weather Underground restructures their page, the
  forecast capture fails loudly and uploads the raw HTML as a workflow artifact
  for diagnosis. The parser lives in `scripts/wu-parse.ts`.

## Development

- `npm run dev` — dashboard with sample data when `data/temperatures.json` is empty
- `npm run test` — unit + component tests
- `npm run capture:forecast` — run the forecast capture locally (then
  `git checkout data/temperatures.json` to discard, since real data accumulates in CI)
- `npm run capture:actual [-- YYYY-MM-DD]` — run the actual capture locally; needs
  the five `NETATMO_*` env vars set and `secrets/netatmo-tokens.enc` present
  (note: each run rotates the Netatmo token — commit the updated token file
  afterward or the CI chain breaks)
