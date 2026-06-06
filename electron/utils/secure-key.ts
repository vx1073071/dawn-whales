/**
 * Secure Key Manager — DAWN WHALES
 * Uses DPAPI (Windows only) to encrypt API keys at rest.
 * Falls back to env-var loading for cross-platform / non-Windows builds.
 *
 * Security model:
 * - On Windows: DPAPI encrypts the raw key bytes → stored as base64 in local storage
 * - At runtime: DPAPI decrypts on-demand per call, key never hits process memory long-term
 * - On non-Windows: dotenv loading for development
 *
 * Usage:
 *   const { getDeepSeekKey, storeDeepSeekKey } = require('./utils/secure-key')
 *   const key = getDeepSeekKey()     // returns string or null
 *   storeDeepSeekKey('sk-xxxx')      // encrypt + persist (Windows)
 */

'use strict';

const crypto = require('crypto');
const path   = require('path');
const os     = require('os');
const fs     = require('fs');

// ─── Constants ───────────────────────────────────────────────────────────────

/** Path relative to userData where encrypted keys are stored */
const KEYSTORE_FILE = 'keystore.json';

/** Salt used for PBKDF2 (in addition to DPAPI) — not sensitive, can be public */
const KDF_SALT = 'dawn-whales-v1-salt';

/** PBKDF2 rounds — balance between derive-time and security */
const KDF_ROUNDS = 100_000;

/** Key file stores: { [keyName: string]: { iv: string, ct: string, tag: string } } */
const SCHEME_V1 = 1; // { iv, ct, tag } where each is base64

// ─── DPAPI Helpers (Windows) ─────────────────────────────────────────────────

/**
 * Try to use Node.js crypto with DPAPI CAPI via a child process calling PowerShell.
 * Falls back gracefully when DPAPI is unavailable.
 */
function _dpapiProtect(data) {
  // data is a Buffer; encode as base64 to avoid quoting issues
  const b64 = data.toString('base64');
  const ps  = `
    Add-Type -AssemblyName System.Security
    $bytes  = [Convert]::FromBase64String('${b64}')
    $enc    = [System.Security.Cryptography.ProtectedData]::Protect($bytes, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
    [Convert]::ToBase64String($enc)
  `;
  const { execSync } = require('child_process');
  try {
    return execSync(
      `powershell -NoProfile -NonInteractive -Command "${ps.replace(/\n/g, ' ')}"`,
      { encoding: 'utf8', timeout: 5_000 }
    ).trim();
  } catch {
    return null;
  }
}

function _dpapiUnprotect(b64data) {
  const ps = `
    Add-Type -AssemblyName System.Security
    $bytes  = [Convert]::FromBase64String('${b64data}')
    $dec    = [System.Security.Cryptography.ProtectedData]::Unprotect($bytes, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
    [Convert]::ToBase64String($dec)
  `;
  const { execSync } = require('child_process');
  try {
    return execSync(
      `powershell -NoProfile -NonInteractive -Command "${ps.replace(/\n/g, ' ')}"`,
      { encoding: 'utf8', timeout: 5_000 }
    ).trim();
  } catch {
    return null;
  }
}

// ─── Cross-platform Key Derivation ──────────────────────────────────────────

/**
 * Derive a 32-byte AES key from a user secret using PBKDF2-SHA512.
 * Uses machine-id as salt so encrypted blobs are not portable across machines.
 */
function _deriveKey(secret, salt) {
  const machineId = os.hostname() + os.homedir();
  const fullSalt = crypto.createHash('sha256').update(machineId + salt).digest();
  return crypto.pbkdf2Sync(secret, fullSalt, KDF_ROUNDS, 32, 'sha512');
}

// ─── Keystore I/O ────────────────────────────────────────────────────────────

function _keystorePath(app) {
  return path.join(app.getPath('userData'), KEYSTORE_FILE);
}

function _loadKeystore(app) {
  const p = _keystorePath(app);
  if (!fs.existsSync(p)) return {};
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return {};
  }
}

function _saveKeystore(app, ks) {
  const p = _keystorePath(app);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(ks), 'utf8');
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Store a key under `name` in the encrypted keystore.
 * Returns true on success, false if encryption failed.
 *
 * @param {object} app   - Electron app instance (required)
 * @param {string} name  - Key identifier e.g. 'DEEPSEEK_API_KEY'
 * @param {string} key   - Plaintext key value
 * @returns {boolean}
 */
export function storeKey(app, name, key) {
  if (!app || !name || !key) return false;

  // ── Fast path: DPAPI (Windows, user-bound, no secret needed) ──
  const dpapi = _dpapiProtect(Buffer.from(key, 'utf8'));
  if (dpapi) {
    const ks  = _loadKeystore(app);
    ks[name]  = { scheme: SCHEME_V1, dpapi: dpapi };
    _saveKeystore(app, ks);
    return true;
  }

  // ── Fallback: AES-256-GCM with no password (derive from machine) ──
  try {
    const iv    = crypto.randomBytes(12);
    const tag   = Buffer.alloc(16);
    const key32 = _deriveKey(KDF_SALT + name, 'aes256gcm');
    const cipher = crypto.createCipheriv('aes-256-gcm', key32, iv);
    const enc = Buffer.concat([cipher.update(key, 'utf8'), cipher.final()]);
    cipher.getAuthTag(tag);

    const ks = _loadKeystore(app);
    ks[name] = { scheme: SCHEME_V1, iv: iv.toString('base64'), ct: enc.toString('base64'), tag: tag.toString('base64') };
    _saveKeystore(app, ks);
    return true;
  } catch {
    return false;
  }
}

/**
 * Retrieve a key from the encrypted keystore.
 * Returns the plaintext string, or null if missing / unavailable.
 *
 * @param {object} app  - Electron app instance
 * @param {string} name - Key identifier
 * @returns {string|null}
 */
export function getKey(app, name) {
  if (!app || !name) return null;

  const ks = _loadKeystore(app);
  if (!ks[name]) {
    // Fall back to env var
    return process.env[name] || null;
  }

  const entry = ks[name];

  // DPAPI (scheme v1, Windows)
  if (entry.dpapi) {
    const raw = _dpapiUnprotect(entry.dpapi);
    if (raw) return Buffer.from(raw, 'base64').toString('utf8');
    // DPAPI failed → fall back to env
    return process.env[name] || null;
  }

  // AES-256-GCM fallback
  if (entry.iv && entry.ct && entry.tag) {
    try {
      const iv    = Buffer.from(entry.iv,   'base64');
      const ct    = Buffer.from(entry.ct,   'base64');
      const tag   = Buffer.from(entry.tag,  'base64');
      const key32 = _deriveKey(KDF_SALT + name, 'aes256gcm');
      const decipher = crypto.createDecipheriv('aes-256-gcm', key32, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
    } catch {
      return process.env[name] || null;
    }
  }

  return process.env[name] || null;
}

/**
 * Delete a key from the keystore (does NOT touch env vars).
 *
 * @param {object} app  - Electron app instance
 * @param {string} name - Key identifier
 */
export function deleteKey(app, name) {
  if (!app || !name) return;
  const ks = _loadKeystore(app);
  delete ks[name];
  _saveKeystore(app, ks);
}

/** Convenience: get DeepSeek key specifically */
export function getDeepSeekKey(app) {
  return getKey(app, 'DEEPSEEK_API_KEY');
}

/** Convenience: store DeepSeek key specifically */
export function storeDeepSeekKey(app, key) {
  return storeKey(app, 'DEEPSEEK_API_KEY', key);
}

module.exports = { storeKey, getKey, deleteKey, getDeepSeekKey, storeDeepSeekKey };

// R20: ES module exports for vite bundling compatibility
export { storeKey, getKey, deleteKey, getDeepSeekKey, storeDeepSeekKey };