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

  it('detects tampering with the ciphertext', () => {
    const payload = encrypt('secret', 'p');
    const buf = Buffer.from(payload, 'base64');
    buf[44] ^= 0xff; // flip one byte in the ciphertext region
    expect(() => decrypt(buf.toString('base64'), 'p')).toThrow();
  });

  it('rejects malformed payloads that are too short', () => {
    expect(() => decrypt('AAAA', 'p')).toThrow(/too short/);
  });
});
