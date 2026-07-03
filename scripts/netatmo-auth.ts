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
