/**
 * J-64-01 Tests: 策略模板AES-256加密 (R64 v19)
 *
 * Tests:
 * 01-02: Encrypt/decrypt roundtrip
 * 03: Free template (no encryption)
 * 04: Integrity check
 * 05-06: Ownership + access
 * 07: Key rotation
 * 08: Wrong key fails
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  TemplateEncryptionEngine,
  getEncryptionEngine,
  resetEncryptionEngine,
} from '../electron/engine/template-encryption';

describe('J-64-01: Template AES-256-GCM Encryption', () => {
  let engine: TemplateEncryptionEngine;

  beforeEach(() => {
    resetEncryptionEngine();
    engine = getEncryptionEngine();
  });

  it('01: encrypt and decrypt roundtrip', () => {
    const content = 'const strategy = { buy: "MA_10_cross", sell: "RSI_70" };';
    const encrypted = engine.encryptTemplate('tpl-1', 'MA Cross', content, 'creator-1', 'elite');
    expect(encrypted.ciphertext).toBeTruthy();
    expect(encrypted.algorithm).toBe('aes-256-gcm');

    const decrypted = engine.decryptTemplate(encrypted, encrypted.keyId);
    expect(decrypted).toBe(content);
  });

  it('02: encrypt with different content produces different ciphertext', () => {
    const e1 = engine.encryptTemplate('t1', 'A', 'content-A', 'creator-1', 'pro');
    const e2 = engine.encryptTemplate('t2', 'B', 'content-B', 'creator-1', 'pro');
    expect(e1.ciphertext).not.toBe(e2.ciphertext);
    expect(e1.iv).not.toBe(e2.iv);
  });

  it('03: free template has no encryption', () => {
    const free = engine.encryptTemplate('tpl-free', 'Free Template', 'free content', 'creator-1', 'free');
    expect(free.ciphertext).toBe('');
    expect(free.keyId).toBe('');
  });

  it('04: integrity verification detects tampering', () => {
    const encrypted = engine.encryptTemplate('tpl-int', 'X', 'original', 'creator-1', 'pro');
    const decrypted = engine.decryptTemplate(encrypted, encrypted.keyId);
    // Verify against embedded hash
    const valid = engine.verifyIntegrity(decrypted, encrypted.hash);
    expect(valid).toBe(true);

    // Tampered content fails
    expect(engine.verifyIntegrity('tampered', encrypted.hash)).toBe(false);
  });

  it('05: grant and check template access', () => {
    engine.grantAccess('tpl-1', 'lic-123');
    expect(engine.hasAccess('tpl-1', 'lic-123')).toBe(true);
    expect(engine.hasAccess('tpl-1', 'lic-999')).toBe(false);
  });

  it('06: requestTemplateDecrypt with access returns valid content', () => {
    const content = 'secret trading strategy v2';
    const encrypted = engine.encryptTemplate('tpl-secret', 'Secret', content, 'creator-1', 'elite');
    engine.grantAccess('tpl-secret', 'lic-1');

    const result = engine.requestTemplateDecrypt(encrypted, 'lic-1');
    expect(result.valid).toBe(true);
    expect(result.content).toBe(content);
    expect(result.hash).toBe(encrypted.hash);
  });

  it('07: key rotation generates new key', () => {
    const encrypted = engine.encryptTemplate('tpl-old', 'Old', 'old content', 'creator-1', 'pro', 'default');
    const oldKeyId = encrypted.keyId;

    const newKeyId = engine.rotateKey(oldKeyId);
    expect(newKeyId).not.toBe(oldKeyId);
    expect(engine.getKey(oldKeyId)).toBeTruthy(); // old key still exists for decryption

    // Can still decrypt with old key
    const decrypted = engine.decryptTemplate(encrypted, oldKeyId);
    expect(decrypted).toBe('old content');
  });

  it('08: decrypt with wrong keyId fails', () => {
    const encrypted = engine.encryptTemplate('t1', 'A', 'content', 'creator-1', 'elite', 'default');
    engine.generateKey('other-key');
    expect(() => engine.decryptTemplate(encrypted, 'other-key')).toThrow();
  });
});
