// ── DAWN WHALES Server Config ─────────────────────────────────────────
// R129-P01: Environment configuration with validation

import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  encryptionMasterKey: process.env.ENCRYPTION_MASTER_KEY || 'dev-key-32-chars-minimum!!',
  dbPath: process.env.DB_PATH || './data/dawn-whales.db',
  keysDbPath: process.env.KEYS_DB_PATH || './data/api-keys.db',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
};

export function validateConfig(): string[] {
  const errors: string[] = [];
  if (!config.jwtSecret || config.jwtSecret === 'dev-secret-change-in-production') {
    errors.push('JWT_SECRET not configured for production');
  }
  if (!config.encryptionMasterKey || config.encryptionMasterKey.length < 32) {
    errors.push('ENCRYPTION_MASTER_KEY must be >= 32 chars');
  }
  return errors;
}
