// ── DAWN WHALES — License Management (Sprint 3: P2) ───────────────────────
// 无实名，离线优先，仅定期在线验证

import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import log from 'electron-log';
import { EngineError } from './engine/core/engine-error';


export type LicenseTier = 'free' | 'starter' | 'pro' | 'lifetime';

export interface LicenseInfo {
  tier: LicenseTier;
  key: string;
  issuedAt: string;
  expiresAt: string | null;  // null = lifetime
  features: string[];
}

const LICENSE_FILE = 'license.dw';
const TRIAL_DAYS = 14;

const TIER_FEATURES: Record<LicenseTier, string[]> = {
  free: ['strategy_builder', 'backtest_basic', 'marketplace_browse'],
  starter: ['strategy_builder', 'backtest_basic', 'backtest_advanced', 'marketplace_browse', 'live_trading', 'real_time_quotes', 'risk_management'],
  pro: ['strategy_builder', 'backtest_basic', 'backtest_advanced', 'marketplace_browse', 'marketplace_publish', 'live_trading', 'real_time_quotes', 'risk_management', 'ai_explain', 'ai_optimize', 'multi_broker', 'advanced_risk'],
  lifetime: ['strategy_builder', 'backtest_basic', 'backtest_advanced', 'marketplace_browse', 'marketplace_publish', 'live_trading', 'real_time_quotes', 'risk_management', 'ai_explain', 'ai_optimize', 'multi_broker', 'advanced_risk'],
};

const TIER_PRICES_USDT: Record<LicenseTier, { monthly: number; yearly: number }> = {
  free: { monthly: 0, yearly: 0 },
  starter: { monthly: 14, yearly: 135 },
  pro: { monthly: 42, yearly: 403 },
  lifetime: { monthly: 430, yearly: 430 },
};

export class LicenseManager {
  private license: LicenseInfo | null = null;
  private trialStart: string | null = null;
  private licensePath: string;

  constructor() {
    const userData = app.getPath('userData');
    this.licensePath = path.join(userData, LICENSE_FILE);
  }

  initialize(): LicenseInfo {
    if (fs.existsSync(this.licensePath)) {
      try {
        const encrypted = fs.readFileSync(this.licensePath, 'utf-8');
        const decrypted = this.decrypt(encrypted);
        this.license = JSON.parse(decrypted);
        log.info(`[License] Loaded: ${this.license.tier} (expires: ${this.license.expiresAt || 'never'})`);
        return this.license;
      } catch (err) {
        log.warn('[License] Failed to load license, starting trial:', err.message);
      }
    }

    // No license — start trial
    this.trialStart = new Date().toISOString();
    this.license = {
      tier: 'pro', // Trial = Pro features for 14 days
      key: `TRIAL-${this.trialStart.slice(0, 10)}`,
      issuedAt: this.trialStart,
      expiresAt: new Date(Date.now() + TRIAL_DAYS * 86400 * 1000).toISOString(),
      features: TIER_FEATURES.pro,
    };
    log.info(`[License] Trial started, expires in ${TRIAL_DAYS} days`);
    return this.license;
  }

  getLicense(): LicenseInfo | null {
    return this.license;
  }

  getTier(): LicenseTier {
    return this.license?.tier || 'free';
  }

  isTrial(): boolean {
    return this.license?.key.startsWith('TRIAL-') ?? false;
  }

  getTrialDaysLeft(): number {
    if (!this.isTrial() || !this.license?.expiresAt) return 0;
    const remaining = new Date(this.license.expiresAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(remaining / 86400000));
  }

  isExpired(): boolean {
    if (!this.license) return true;
    if (!this.license.expiresAt) return false; // lifetime
    return new Date(this.license.expiresAt) < new Date();
  }

  hasFeature(feature: string): boolean {
    if (this.isExpired()) return TIER_FEATURES.free.includes(feature);
    return this.license?.features.includes(feature) ?? false;
  }

  activateLicense(key: string, tier: LicenseTier, durationMonths: number): LicenseInfo {
    const expiresAt = durationMonths > 0
      ? new Date(Date.now() + durationMonths * 30 * 86400 * 1000).toISOString()
      : null;

    this.license = {
      tier,
      key,
      issuedAt: new Date().toISOString(),
      expiresAt,
      features: TIER_FEATURES[tier],
    };

    this.save();
    log.info(`[License] Activated: ${tier} (key: ${key.slice(0, 10)}...)`);
    return this.license;
  }

  private save(): void {
    if (!this.license) return;
    const json = JSON.stringify(this.license);
    const encrypted = this.encrypt(json);
    fs.writeFileSync(this.licensePath, encrypted, 'utf-8');
  }

  // Simple AES-256-GCM encryption with device-bound key
  private encrypt(text: string): string {
    const key = crypto.createHash('sha256').update(app.getPath('userData')).digest();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf-8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString('base64');
  }

  private decrypt(encrypted: string): string {
    const key = crypto.createHash('sha256').update(app.getPath('userData')).digest();
    const data = Buffer.from(encrypted, 'base64');
    const iv = data.subarray(0, 16);
    const tag = data.subarray(16, 32);
    const ciphertext = data.subarray(32);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf-8');
  }
}

export { TIER_FEATURES, TIER_PRICES_USDT, TRIAL_DAYS };
