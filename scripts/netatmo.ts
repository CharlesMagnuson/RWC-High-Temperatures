const API = 'https://api.netatmo.com';

/** Encrypted token file, shared by the auth helper (writer) and capture-actual (reader/rotator). */
export const TOKEN_PATH = 'secrets/netatmo-tokens.enc';

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
    signal: AbortSignal.timeout(10_000),
  });
  await expectOk(res, 'token refresh');
  const json = (await res.json()) as Partial<Tokens>;
  if (typeof json.access_token !== 'string' || typeof json.refresh_token !== 'string') {
    // Deliberately not echoing the body: a partial response could contain a live token.
    const bad = (['access_token', 'refresh_token'] as const)
      .filter((k) => typeof json[k] !== 'string')
      .join('/');
    throw new Error(`Netatmo token refresh: malformed response (missing or non-string: ${bad})`);
  }
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
    signal: AbortSignal.timeout(10_000),
  });
  await expectOk(res, 'getmeasure');
  const json = (await res.json()) as { body?: Record<string, (number | null)[]> };
  if (!json.body) throw new Error(`Netatmo getmeasure: no body in response: ${JSON.stringify(json)}`);
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
    signal: AbortSignal.timeout(10_000),
  });
  await expectOk(res, 'getstationsdata');
  return res.json();
}
