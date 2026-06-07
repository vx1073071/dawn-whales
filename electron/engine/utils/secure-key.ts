// ── DAWN WHALES — Secure Key Management ──────────────────────────────────
// Stores API keys in OS keychain or encrypted file
// Fallback: environment variable DEEPSEEK_API_KEY

import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'crypto';

const ENV_KEY = 'DEEPSEEK_API_KEY';
const CONFIG_KEY = 'deepseek_api_key';

const logger = console;

function getConfigPath(): string {
  const userData = app?.getPath?.('userData') || path.join(require('os').homedir(), '.dawn-whales');
  return path.join(userData, 'secure-config.json');
}

function encrypt(text: string): string {
  const key = createHash('sha256').update(app?.getPath?.('userData') || 'dawn-whales').digest();
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return JSON.stringify({ iv: iv.toString('hex'), data: encrypted.toString('hex') });
}

function decrypt(encrypted: string): string {
  try {
    const { iv, data } = JSON.parse(encrypted);
    const key = createHash('sha256').update(app?.getPath?.('userData') || 'dawn-whales').digest();
    const decipher = createDecipheriv('aes-256-cbc', key, Buffer.from(iv, 'hex'));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(data, 'hex')), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    return '';
  }
}

export function getDeepSeekKey(): string {
  const envKey = process.env[ENV_KEY];
  if (envKey) return envKey;

  try {
    const configPath = getConfigPath();
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (config[CONFIG_KEY]) return decrypt(config[CONFIG_KEY]);
    }
  } catch (e) { logger.error('[backend:secure-key]', e); }

  return '';
}

export function setDeepSeekKey(key: string): void {
  const configPath = getConfigPath();
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  let config: any = {};
  try {
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
  } catch (e) { logger.error('[backend:secure-key]', e); }

  config[CONFIG_KEY] = encrypt(key);
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

export function clearDeepSeekKey(): void {
  const configPath = getConfigPath();
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      delete config[CONFIG_KEY];
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    } catch (e) { logger.error('[backend:secure-key]', e); }
  }
}
