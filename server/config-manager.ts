// @ts-nocheck
/**
 * DAWN WHALES R129 J03 — Server Configuration Management
 * 
 * Centralized config with .env support, environment variable validation,
 * and deployment profiles. Uses dotenv for local dev, override via env vars.
 * 
 * Priority: env var > .env > default
 */

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// ═══════════════ Load .env ═══════════════════════════════

const envFile = process.env.DW_ENV_FILE || path.join(process.cwd(), '.env');
if (fs.existsSync(envFile)) {
  dotenv.config({ path: envFile });
}

// ═══════════════ Config Schema ══════════════════════════

interface ConfigSchema {
  // ── Server ──
  NODE_ENV: 'development' | 'staging' | 'production';
  PORT: number;
  HOST: string;

  // ── Database ──
  DB_PATH: string;

  // ── JWT ──
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  JWT_REFRESH_EXPIRES_IN: string;

  // ── API Key Encryption ──
  ENCRYPTION_KEY: string;  // 32-byte hex for AES-256-GCM

  // ── WebSocket ──
  WS_ENABLED: boolean;
  WS_MAX_CONNECTIONS: number;
  WS_HEARTBEAT_MS: number;
  WS_CONNECTION_TIMEOUT_MS: number;

  // ── Rate Limiting ──
  RATE_LIMIT_WINDOW_MS: number;
  RATE_LIMIT_MAX_REQUESTS: number;

  // ── CORS ──
  CORS_ORIGINS: string[];

  // ── Logging ──
  LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';
  LOG_FILE: string;

  // ── Broker Defaults ──
  BROKER_CONNECT_TIMEOUT_MS: number;
  BROKER_RECONNECT_MAX_RETRIES: number;
  BROKER_RECONNECT_BACKOFF_MS: number;

  // ── VPS (A2) ──
  VPS_OPEND_HOST: string;
  VPS_OPEND_PORT: number;
}

// ═══════════════ Validation ═══════════════════════════════

class ValidationError extends Error {
  constructor(public readonly missing: string[]) {
    super(`Missing required config: ${missing.join(', ')}`);
  }
}

// ═══════════════ Config Loader ═══════════════════════════

/**
 * Load and validate full server configuration.
 * Must be called before any server module is loaded.
 */
export function loadConfig(): ConfigSchema {
  const c = parseAndDefaults();
  const errors = validate(c);
  if (errors.length > 0) {
    throw new ValidationError(errors);
  }
  return c;
}

function parseAndDefaults(): ConfigSchema {
  return {
    NODE_ENV: (process.env.NODE_ENV as ConfigSchema['NODE_ENV']) || 'development',
    PORT: Number(process.env.PORT) || 3200,
    HOST: process.env.HOST || '0.0.0.0',

    DB_PATH: process.env.DB_PATH || path.join(process.cwd(), 'data', 'dawn-whales.db'),

    JWT_SECRET: process.env.JWT_SECRET || '',
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '1h',
    JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',

    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || '',

    WS_ENABLED: process.env.WS_ENABLED !== 'false',
    WS_MAX_CONNECTIONS: Number(process.env.WS_MAX_CONNECTIONS) || 1000,
    WS_HEARTBEAT_MS: Number(process.env.WS_HEARTBEAT_MS) || 30000,
    WS_CONNECTION_TIMEOUT_MS: Number(process.env.WS_CONNECTION_TIMEOUT_MS) || 120000,

    RATE_LIMIT_WINDOW_MS: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
    RATE_LIMIT_MAX_REQUESTS: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,

    CORS_ORIGINS: (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',').map((s) => s.trim()),

    LOG_LEVEL: (process.env.LOG_LEVEL as ConfigSchema['LOG_LEVEL']) || 'info',
    LOG_FILE: process.env.LOG_FILE || path.join(process.cwd(), 'logs', 'server.log'),

    BROKER_CONNECT_TIMEOUT_MS: Number(process.env.BROKER_CONNECT_TIMEOUT_MS) || 10000,
    BROKER_RECONNECT_MAX_RETRIES: Number(process.env.BROKER_RECONNECT_MAX_RETRIES) || 5,
    BROKER_RECONNECT_BACKOFF_MS: Number(process.env.BROKER_RECONNECT_BACKOFF_MS) || 1000,

    VPS_OPEND_HOST: process.env.VPS_OPEND_HOST || '127.0.0.1',
    VPS_OPEND_PORT: Number(process.env.VPS_OPEND_PORT) || 11111,
  };
}

function validate(c: ConfigSchema): string[] {
  const errors: string[] = [];

  // Development mode skips strict validation
  if (c.NODE_ENV === 'development') {
    return errors;
  }

  // Production/staging must have these
  if (!c.JWT_SECRET || c.JWT_SECRET.length < 32) {
    errors.push('JWT_SECRET (>= 32 chars)');
  }
  if (!c.ENCRYPTION_KEY || c.ENCRYPTION_KEY.length !== 64) {
    errors.push('ENCRYPTION_KEY (64 hex chars for AES-256-GCM)');
  }
  if (c.WS_ENABLED && !c.JWT_SECRET) {
    errors.push('JWT_SECRET required for WS authentication');
  }

  return errors;
}

// ═══════════════ Singleton ═══════════════════════════════

let _config: ConfigSchema | null = null;

export function getConfig(): ConfigSchema {
  if (!_config) {
    _config = loadConfig();
  }
  return _config;
}

/**
 * Reload config at runtime (rare, after env var change).
 */
export function reloadConfig(): ConfigSchema {
  _config = null;
  return getConfig();
}

// ═══════════════ .env Template Generator ═══════════════

/**
 * Generate a sample .env file for onboarding.
 */
export function generateEnvTemplate(): string {
  return [
    '# DAWN WHALES v2.0.0 — Server Configuration',
    '# Generated by R129 J03 config-manager',
    '',
    '# ── Environment ──',
    'NODE_ENV=development',
    'PORT=3200',
    'HOST=0.0.0.0',
    '',
    '# ── Database ──',
    'DB_PATH=./data/dawn-whales.db',
    '',
    '# ── JWT Authentication ──',
    '# Generate: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    'JWT_SECRET=',
    'JWT_EXPIRES_IN=1h',
    'JWT_REFRESH_EXPIRES_IN=7d',
    '',
    '# ── API Key Encryption ──',
    '# Generate: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    'ENCRYPTION_KEY=',
    '',
    '# ── WebSocket Push ──',
    'WS_ENABLED=true',
    'WS_MAX_CONNECTIONS=1000',
    '',
    '# ── Rate Limiting ──',
    'RATE_LIMIT_MAX_REQUESTS=100',
    '',
    '# ── CORS ──',
    'CORS_ORIGINS=http://localhost:5173',
    '',
    '# ── Logging ──',
    'LOG_LEVEL=info',
    '',
    '# ── Brokers ──',
    'BROKER_CONNECT_TIMEOUT_MS=10000',
    'BROKER_RECONNECT_MAX_RETRIES=5',
    '',
    '# ── VPS OpenD (A2) ──',
    'VPS_OPEND_HOST=127.0.0.1',
    'VPS_OPEND_PORT=11111',
    '',
  ].join('\n');
}

/**
 * Write .env template to disk if .env doesn't exist.
 */
export function initEnvFile(baseDir?: string): void {
  const dir = baseDir || process.cwd();
  const envPath = path.join(dir, '.env');
  if (!fs.existsSync(envPath)) {
    fs.writeFileSync(envPath, generateEnvTemplate(), 'utf-8');
  }
}
