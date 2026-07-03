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
