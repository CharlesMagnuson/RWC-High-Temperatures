import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { encrypt } from './crypto';
import { TOKEN_PATH, refreshTokens, getStations } from './netatmo';

interface StationsResponse {
  body?: {
    devices?: {
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

  // Persist immediately: the refresh consumed the pasted token, so any failure
  // below must not lose the rotated one. Atomic write, as in capture-actual.
  mkdirSync('secrets', { recursive: true });
  writeFileSync(TOKEN_PATH + '.tmp', encrypt(JSON.stringify(tokens), passphrase));
  renameSync(TOKEN_PATH + '.tmp', TOKEN_PATH);
  console.log(`\nToken refresh OK — encrypted token saved to ${TOKEN_PATH}.`);

  const stations = (await getStations(tokens.access_token)) as StationsResponse;
  const devices = stations?.body?.devices;
  if (!devices) throw new Error('getstationsdata returned no device list');
  if (devices.length === 0) {
    console.error(
      'No stations found — check that your token has read_station scope and your account owns a station',
    );
    console.error(`(The encrypted token file was already saved to ${TOKEN_PATH}.)`);
    process.exit(1);
  }
  for (const dev of devices) {
    console.log(`\nStation "${dev.station_name}"  NETATMO_DEVICE_ID=${dev._id}`);
    for (const mod of dev.modules) {
      const hint = mod.type === 'NAModule1' ? '  <-- outdoor module' : '';
      console.log(`  module "${mod.module_name}" (${mod.type})  NETATMO_MODULE_ID=${mod._id}${hint}`);
    }
  }

  console.log(`\nCommit ${TOKEN_PATH}.`);
  console.log(
    'Add these GitHub Actions secrets: NETATMO_CLIENT_ID and NETATMO_CLIENT_SECRET (as entered), ' +
      'NETATMO_ENC_PASSPHRASE (your passphrase), and the NETATMO_DEVICE_ID / NETATMO_MODULE_ID printed above.',
  );
}

main().catch((err) => {
  console.error(err);
  const msg = err instanceof Error ? err.message : String(err);
  if (/invalid_client/.test(msg)) {
    console.error('→ check your Client ID / Client secret');
  }
  if (/invalid_grant/.test(msg)) {
    console.error(
      '→ your refresh token is invalid or already consumed — generate a fresh one in the dev portal (each token works exactly once here)',
    );
  }
  process.exit(1);
});
