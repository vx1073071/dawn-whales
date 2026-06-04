import { describe, it, expect, beforeAll } from 'vitest';
import { CryptoService } from '../electron/workers/crypto-service';

describe('CryptoService', () => {
  const svc = new CryptoService();

  beforeAll(async () => {
    await svc.init('test-password-12345');
  });

  it('should encrypt and decrypt plaintext', () => {
    const plain = 'Hello, DAWN WHALES! Secret data here.';
    const enc = svc.encrypt(plain);
    expect(enc.iv.length).toBe(32); // hex
    expect(enc.authTag.length).toBe(32);
    const dec = svc.decrypt(enc.iv, enc.ciphertext, enc.authTag);
    expect(dec).toBe(plain);
  });

  it('should fail on wrong auth tag', () => {
    const enc = svc.encrypt('test');
    expect(() => svc.decrypt(enc.iv, enc.ciphertext, '00'.repeat(16))).toThrow();
  });

  it('should encrypt and decrypt objects', () => {
    const obj = { apiKey: 'sk-abc123', secret: 'very-secret', nested: { a: 1 } };
    const enc = svc.encryptObject(obj);
    const dec = svc.decryptObject<typeof obj>(enc);
    expect(dec).toEqual(obj);
  });

  it('should generate random key', () => {
    const key = svc.generateKey();
    expect(key.length).toBe(64); // hex
    expect(key).not.toBe(svc.generateKey());
  });

  it('should hash data', () => {
    const h = svc.hash('test data');
    expect(h.length).toBe(64);
    expect(h).toBe(svc.hash('test data')); // deterministic
  });
});
