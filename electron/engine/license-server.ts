/**
 * J-63-03: 许可证系统 /api (R63 v19 — v1.5.0-rc 服务器化)
 *
 * 激活码生成(邮箱绑定)+验证+吊销。
 * 桌面端启动→检许可证→过期/无效→禁用AI+交易。
 * 试用期: 7天免费, 到期需激活。
 *
 * Features:
 * - Activation code generation (4 segments, email-bound)
 * - License validation on startup + periodic check
 * - 7-day free trial, auto-expiry
 * - License revocation (admin)
 * - JWT token issuance for authenticated sessions
 * - Grace period: 24h after expiry before hard-lock
 *
 * >=300L, 8 tests
 */

import * as crypto from 'crypto';

// ── Types ──────────────────────────────────────────────────────────────────

export type LicenseStatus = 'active' | 'expired' | 'revoked' | 'grace' | 'trial';

export interface LicenseRecord {
  id: string;
  activationCode: string;
  email: string;
  status: LicenseStatus;
  plan: 'pro' | 'elite';
  issuedAt: string;
  expiresAt: string | null; // null = lifetime (elite)
  trialEndsAt: string;      // 7 days after first activation
  revokedAt?: string;
  revokedReason?: string;
  lastCheckIn?: string;
  deviceIds: string[];      // bound devices (max 2)
}

export interface LicenseValidationResult {
  valid: boolean;
  status: LicenseStatus;
  plan?: 'pro' | 'elite';
  reason?: string;
  trialDaysLeft?: number;
  jwt?: string;
}

export interface ActivationResult {
  valid: boolean;
  license?: LicenseRecord;
  error?: string;
}

export const LICENSE_CONFIG = {
  trialPeriodDays: 7,
  gracePeriodHours: 24,
  maxDevices: 2,
  activationCodeSegments: 4,
  activationCodeSegmentLength: 4,
  jwtSecret: 'dawn-whales-license-secret-v1',
  jwtExpiryHours: 24,
};

// ── License Server ────────────────────────────────────────────────────────

export class LicenseServer {
  private licenses: Map<string, LicenseRecord> = new Map(); // id → license
  private codeIndex: Map<string, string> = new Map();       // code → id
  private emailIndex: Map<string, string> = new Map();      // email → id
  private blacklist: Set<string> = new Set();

  // ── Code Generation ────────────────────────────────────────────────────

  /**
   * Generate a batch of activation codes for admin issuance.
   */
  generateCodes(count: number, plan: 'pro' | 'elite'): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      const segments: string[] = [];
      for (let s = 0; s < LICENSE_CONFIG.activationCodeSegments; s++) {
        segments.push(crypto.randomBytes(2).toString('hex').toUpperCase());
      }
      const code = segments.join('-');
      codes.push(code);
    }
    return codes;
  }

  /**
   * Admin issues a license code to an email.
   */
  issueLicense(email: string, plan: 'pro' | 'elite', code?: string): LicenseRecord {
    if (this.emailIndex.has(email)) throw new Error('Email already has a license');

    const activationCode = code ?? this.generateCodes(1, plan)[0];
    const id = `LIC-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

    const license: LicenseRecord = {
      id,
      activationCode,
      email,
      status: 'active',
      plan,
      issuedAt: new Date().toISOString(),
      expiresAt: plan === 'elite' ? null : new Date(Date.now() + 365 * 86400 * 1000).toISOString(),
      trialEndsAt: new Date(Date.now() + LICENSE_CONFIG.trialPeriodDays * 86400 * 1000).toISOString(),
      deviceIds: [],
    };

    this.licenses.set(id, license);
    this.codeIndex.set(activationCode, id);
    this.emailIndex.set(email, id);

    return license;
  }

  /**
   * Desktop端启动时验证许可证。
   * 1. 通过激活码查询
   * 2. 验证状态
   * 3. 返回JWT
   */
  validateLicense(activationCode: string, deviceId: string): LicenseValidationResult {
    const id = this.codeIndex.get(activationCode);
    if (!id) return { valid: false, status: 'expired', reason: 'Invalid activation code' };

    const license = this.licenses.get(id)!;

    // Check blacklist
    if (this.blacklist.has(id)) {
      return { valid: false, status: 'revoked', reason: 'License revoked' };
    }

    // Check revocation
    if (license.status === 'revoked') {
      return { valid: false, status: 'revoked', reason: `License revoked: ${license.revokedReason ?? 'unknown'}` };
    }

    // Check expiry
    if (license.expiresAt && new Date(license.expiresAt) <= new Date()) {
      // Pro expired → check grace period
      const expiryDate = new Date(license.expiresAt);
      const graceEndsAt = new Date(expiryDate.getTime() + LICENSE_CONFIG.gracePeriodHours * 3600 * 1000);
      if (new Date() <= graceEndsAt) {
        license.status = 'grace';
        this.licenses.set(id, license);
        return { valid: true, status: 'grace', plan: license.plan, trialDaysLeft: 0, reason: 'Grace period active' };
      }
      license.status = 'expired';
      this.licenses.set(id, license);
      return { valid: false, status: 'expired', reason: 'License expired' };
    }

    // Device binding
    if (license.deviceIds.length >= LICENSE_CONFIG.maxDevices && !license.deviceIds.includes(deviceId)) {
      return { valid: false, status: 'active', reason: 'Max devices reached' };
    }

    if (!license.deviceIds.includes(deviceId)) {
      license.deviceIds.push(deviceId);
    }

    // Trial days remaining
    const trialEnd = new Date(license.trialEndsAt);
    const trialDaysLeft = Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / (86400 * 1000)));

    // Is in trial period?
    const registrationDate = new Date(license.issuedAt);
    const trialEndDate = new Date(registrationDate.getTime() + LICENSE_CONFIG.trialPeriodDays * 86400 * 1000);
    const inTrial = new Date() <= trialEndDate;

    if (inTrial && license.status === 'active') {
      license.status = 'trial';
    }

    // Update check-in
    license.lastCheckIn = new Date().toISOString();
    this.licenses.set(id, license);

    // Generate JWT
    const jwtPayload = {
      sub: license.id,
      email: license.email,
      plan: license.plan,
      status: license.status,
      trialDaysLeft,
      deviceId,
    };
    const jwt = LicenseServer.generateJWT(jwtPayload);

    return {
      valid: true,
      status: license.status,
      plan: license.plan,
      trialDaysLeft,
      jwt,
    };
  }

  /**
   * Periodic re-validate (desktop端 calls every hour).
   */
  revalidate(licenseId: string): LicenseValidationResult {
    const license = this.licenses.get(licenseId);
    if (!license) return { valid: false, status: 'expired', reason: 'License not found' };

    return {
      valid: true,
      status: license.status,
      plan: license.plan,
      trialDaysLeft: Math.max(0, Math.ceil((new Date(license.trialEndsAt).getTime() - Date.now()) / 86400000)),
    };
  }

  /**
   * Admin revokes a license.
   */
  revokeLicense(licenseId: string, reason: string): LicenseRecord {
    const license = this.licenses.get(licenseId);
    if (!license) throw new Error('License not found');

    license.status = 'revoked';
    license.revokedAt = new Date().toISOString();
    license.revokedReason = reason;
    this.blacklist.add(licenseId);
    this.licenses.set(licenseId, license);

    return license;
  }

  /**
   * Admin blacklists an activation code (blocks future use).
   */
  blacklistCode(activationCode: string): void {
    const id = this.codeIndex.get(activationCode);
    if (id) this.blacklist.add(id);
  }

  // ── Queries ─────────────────────────────────────────────────────────────

  getLicenseById(id: string): LicenseRecord | undefined {
    return this.licenses.get(id);
  }

  getLicenseByCode(code: string): LicenseRecord | undefined {
    const id = this.codeIndex.get(code);
    return id ? this.licenses.get(id) : undefined;
  }

  getLicenseByEmail(email: string): LicenseRecord | undefined {
    const id = this.emailIndex.get(email);
    return id ? this.licenses.get(id) : undefined;
  }

  listActiveLicenses(): LicenseRecord[] {
    return [...this.licenses.values()].filter(l => l.status === 'active' || l.status === 'trial');
  }

  // ── JWT ─────────────────────────────────────────────────────────────────

  static generateJWT(payload: Record<string, unknown>): string {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify({
      ...payload,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + LICENSE_CONFIG.jwtExpiryHours * 3600,
    })).toString('base64url');
    const signature = crypto.createHmac('sha256', LICENSE_CONFIG.jwtSecret)
      .update(`${header}.${body}`).digest('base64url');
    return `${header}.${body}.${signature}`;
  }

  static verifyJWT(token: string): Record<string, unknown> | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const sig = crypto.createHmac('sha256', LICENSE_CONFIG.jwtSecret)
        .update(`${parts[0]}.${parts[1]}`).digest('base64url');
      if (parts[2] !== sig) return null;
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
      if (payload.exp && payload.exp * 1000 < Date.now()) return null;
      return payload;
    } catch {
      return null;
    }
  }

  // ── Reset ──────────────────────────────────────────────────────────────

  reset(): void {
    this.licenses.clear();
    this.codeIndex.clear();
    this.emailIndex.clear();
    this.blacklist.clear();
  }
}

// ── Singleton ────────────────────────────────────────────────────────────

let _licenseServer: LicenseServer | null = null;

export function getLicenseServer(): LicenseServer {
  if (!_licenseServer) _licenseServer = new LicenseServer();
  return _licenseServer;
}

export function resetLicenseServer(): void {
  _licenseServer?.reset();
  _licenseServer = null;
}

export default { LicenseServer, getLicenseServer, resetLicenseServer, LICENSE_CONFIG };
