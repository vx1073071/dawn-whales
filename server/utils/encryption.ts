// ── QUANT MOO AES-256-GCM Encryption ────────────────────────────────
// R129-P04: API Key encryption/decryption with audit logging

import crypto from 'crypto';
import { config } from '../config/env';
import { getKeysDb } from '../db/database';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

function deriveKey(): Buffer {
  return crypto.scryptSync(config.encryptionMasterKey, 'quant-moo-salt', KEY_LENGTH);
}

export function encrypt(plaintext: string): string {
  const key = deriveKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

export function decrypt(encryptedData: string): string {
  const key = deriveKey();
  const parts = encryptedData.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted data format');
  const [ivHex, tagHex, encrypted] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export function storeApiKey(
  userId: string,
  brokerId: string,
  apiKey: string,
  secret: string,
  passphrase?: string,
): void {
  const db = getKeysDb();
  const id = crypto.randomUUID();
  const apiKeyEnc = encrypt(apiKey);
  const secretEnc = encrypt(secret);
  const passphraseEnc = passphrase ? encrypt(passphrase) : null;

  db.prepare(`
    INSERT OR REPLACE INTO api_keys (id, user_id, broker_id, api_key_encrypted, secret_encrypted, passphrase_encrypted)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, userId, brokerId, apiKeyEnc, secretEnc, passphraseEnc);

  auditKeyAccess(userId, brokerId, 'encrypt');
}

export function getApiKey(userId: string, brokerId: string): {
  apiKey: string;
  secret: string;
  passphrase?: string;
} | null {
  const db = getKeysDb();
  const row = db.prepare(
    'SELECT api_key_encrypted, secret_encrypted, passphrase_encrypted FROM api_keys WHERE user_id = ? AND broker_id = ?',
  ).get(userId, brokerId) as Record<string, string> | undefined;

  if (!row) return null;

  auditKeyAccess(userId, brokerId, 'decrypt');
  return {
    apiKey: decrypt(row.api_key_encrypted),
    secret: decrypt(row.secret_encrypted),
    passphrase: row.passphrase_encrypted ? decrypt(row.passphrase_encrypted) : undefined,
  };
}

export function deleteApiKey(userId: string, brokerId: string): boolean {
  const db = getKeysDb();
  const result = db.prepare(
    'DELETE FROM api_keys WHERE user_id = ? AND broker_id = ?',
  ).run(userId, brokerId);
  if (result.changes > 0) {
    auditKeyAccess(userId, brokerId, 'delete');
    return true;
  }
  return false;
}

function auditKeyAccess(userId: string, brokerId: string, action: string): void {
  const db = getKeysDb();
  db.prepare(
    'INSERT INTO key_audit_log (user_id, broker_id, action) VALUES (?, ?, ?)',
  ).run(userId, brokerId, action);
}
