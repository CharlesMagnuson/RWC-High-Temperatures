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
