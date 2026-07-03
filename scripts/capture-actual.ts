import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { decrypt, encrypt } from './crypto';
import { TOKEN_PATH, refreshTokens, getMaxTempF, type Tokens } from './netatmo';
import { load, save, upsert } from './data-store';
import { pacificTodayISO, pacificMidnightEpoch } from './dates';

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
  // Atomic write: never leave a truncated token file if the process dies mid-write.
  writeFileSync(TOKEN_PATH + '.tmp', encrypt(JSON.stringify(tokens), passphrase));
  renameSync(TOKEN_PATH + '.tmp', TOKEN_PATH);

  const begin = pacificMidnightEpoch(date);
  // Backfill window ends at the next Pacific midnight (exact across DST transitions).
  const nextDay = new Date(Date.parse(date + 'T12:00:00Z') + 86_400_000).toISOString().slice(0, 10);
  const end = dateArg ? pacificMidnightEpoch(nextDay) : Math.floor(Date.now() / 1000);
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

// Run only when executed directly (tsx scripts/capture-actual.ts), not when
// imported by tests for the exported helpers.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
