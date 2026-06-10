/**
 * J-62-03: 黑名单+2FA安全系统 (R62 v19 — v1.5.0-alpha)
 *
 * v15基建: Manual blacklist with P2P/withdrawal freeze + TOTP 2FA.
 *
 * Features:
 * - Blacklist: 0-auto, admin manual add/remove only
 * - Blacklist effect: freeze P2P + withdrawal for listed accounts
 * - 2FA: TOTP (Google Authenticator compatible), login + withdrawal triggers
 * - 2FA recovery: 8 backup codes, one-time use
 * - NO reputation score / NO intranet restriction (v15 lock)
 *
 * >=250L, 7 tests
 */

import * as crypto from 'crypto';
import { EngineError, ErrorCode } from '../errors';


// ── Types ──────────────────────────────────────────────────────────────────

export interface BlacklistEntry {
  userId: string;
  addedBy: string;
  reason: string;
  addedAt: string;
  active: boolean;
  // What's frozen
  freezeP2P: boolean;
  freezeWithdrawal: boolean;
}

export interface TwoFactorProfile {
  userId: string;
  secret: string;               // TOTP secret (base32)
  enabled: boolean;
  createdAt: string;
  lastVerifiedAt?: string;
  backupCodes: string[];        // 8 codes, hashed
  backupCodeUsed: number;       // how many used
}

export interface TOTPVerificationResult {
  valid: boolean;
  usedBackup?: boolean;
  remainingCodes?: number;
}

// ── Blacklist Engine ──────────────────────────────────────────────────────

export class BlacklistEngine {
  private entries: Map<string, BlacklistEntry> = new Map();
  private auditLog: string[] = [];

  /**
   * Admin adds user to blacklist (0-auto trigger, always manual).
   */
  add(userId: string, addedBy: string, reason: string, options: {
    freezeP2P?: boolean;
    freezeWithdrawal?: boolean;
  } = {}): BlacklistEntry {
    if (this.entries.has(userId) && this.entries.get(userId)!.active) {
      throw new EngineError(ErrorCode.SECURITY_VIOLATION, `User ${userId} is already blacklisted`);
    }

    const entry: BlacklistEntry = {
      userId,
      addedBy,
      reason,
      addedAt: new Date().toISOString(),
      active: true,
      freezeP2P: options.freezeP2P ?? true,
      freezeWithdrawal: options.freezeWithdrawal ?? true,
    };

    this.entries.set(userId, entry);
    this.auditLog.push(`[BLACKLIST_ADD] ${userId} by ${addedBy}: ${reason}`);
    return entry;
  }

  /**
   * Admin removes user from blacklist.
   */
  remove(userId: string, removedBy: string, reason: string): BlacklistEntry {
    const entry = this.entries.get(userId);
    if (!entry || !entry.active) {
      throw new EngineError(ErrorCode.SECURITY_VIOLATION, `User ${userId} is not blacklisted`);
    }

    entry.active = false;
    this.entries.set(userId, entry);
    this.auditLog.push(`[BLACKLIST_REMOVE] ${userId} by ${removedBy}: ${reason}`);
    return entry;
  }

  /**
   * Check if user is blacklisted (and what's frozen).
   */
  check(userId: string): { blacklisted: boolean; freezeP2P: boolean; freezeWithdrawal: boolean } {
    const entry = this.entries.get(userId);
    if (entry && entry.active) {
      return {
        blacklisted: true,
        freezeP2P: entry.freezeP2P,
        freezeWithdrawal: entry.freezeWithdrawal,
      };
    }
    return { blacklisted: false, freezeP2P: false, freezeWithdrawal: false };
  }

  getEntry(userId: string): BlacklistEntry | undefined {
    return this.entries.get(userId);
  }

  listActive(): BlacklistEntry[] {
    return [...this.entries.values()].filter(e => e.active);
  }

  getAuditLog(): string[] {
    return [...this.auditLog];
  }

  reset(): void {
    this.entries.clear();
    this.auditLog = [];
  }
}

// ── 2FA Engine (TOTP) ─────────────────────────────────────────────────────

export class TwoFactorEngine {
  private profiles: Map<string, TwoFactorProfile> = new Map();

  /**
   * Generate TOTP secret and backup codes for a user.
   * Secret = random 20 bytes base32-encoded (Google Authenticator compatible).
   */
  enable2FA(userId: string): { secret: string; backupCodes: string[]; qrUri: string } {
    if (this.profiles.has(userId) && this.profiles.get(userId)!.enabled) {
      throw new EngineError(ErrorCode.SECURITY_VIOLATION, `2FA already enabled for ${userId}`);
    }

    // Generate 20 random bytes → base32
    const randomBytes = crypto.randomBytes(20);
    const secret = this.toBase32(randomBytes);

    // Generate 8 backup codes (8 chars each, alphanumeric)
    const backupCodes: string[] = [];
    for (let i = 0; i < 8; i++) {
      backupCodes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
    }

    // Hash backup codes for storage (we store hashed, reveal plain only once)
    const hashedCodes = backupCodes.map(c => this.hashCode(c));

    const profile: TwoFactorProfile = {
      userId,
      secret,
      enabled: true,
      createdAt: new Date().toISOString(),
      backupCodes: hashedCodes,
      backupCodeUsed: 0,
    };
    this.profiles.set(userId, profile);

    const qrUri = `otpauth://totp/DawnWhales:${userId}?secret=${secret}&issuer=DawnWhales`;

    return { secret, backupCodes, qrUri };
  }

  /**
   * Verify TOTP code. Accepts either TOTP or a backup code.
   */
  verify(userId: string, code: string): TOTPVerificationResult {
    const profile = this.profiles.get(userId);
    if (!profile || !profile.enabled) {
      return { valid: false };
    }

    // Try TOTP first
    const expectedCode = this.generateTOTP(profile.secret);
    if (code === expectedCode) {
      profile.lastVerifiedAt = new Date().toISOString();
      return { valid: true };
    }

    // Try backup codes
    const codeHash = this.hashCode(code);
    const idx = profile.backupCodes.findIndex(c => c === codeHash);
    if (idx >= 0) {
      profile.backupCodes.splice(idx, 1);
      profile.backupCodeUsed++;
      profile.lastVerifiedAt = new Date().toISOString();
      this.profiles.set(userId, profile);
      return {
        valid: true,
        usedBackup: true,
        remainingCodes: profile.backupCodes.length,
      };
    }

    return { valid: false };
  }

  /**
   * Disable 2FA for user.
   */
  disable2FA(userId: string): void {
    const profile = this.profiles.get(userId);
    if (!profile) throw new EngineError(ErrorCode.SECURITY_VIOLATION, `2FA not enabled for ${userId}`);
    profile.enabled = false;
    this.profiles.set(userId, profile);
  }

  getProfile(userId: string): TwoFactorProfile | undefined {
    return this.profiles.get(userId);
  }

  isEnabled(userId: string): boolean {
    return this.profiles.get(userId)?.enabled ?? false;
  }

  // ── TOTP Implementation ─────────────────────────────────────────────────

  /**
   * Generate current TOTP code (6 digits, 30s window).
   * RFC 6238 compliant.
   */
  private generateTOTP(secret: string, timeStep: number = 30, digits: number = 6): string {
    const counter = Math.floor(Date.now() / 1000 / timeStep);
    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeBigUInt64BE(BigInt(counter));

    const key = this.fromBase32(secret);
    const hmac = crypto.createHmac('sha1', key).update(counterBuffer).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const binary =
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff);

    const otp = binary % Math.pow(10, digits);
    return otp.toString().padStart(digits, '0');
  }

  // Share the TOTP generator for testing
  generateCode(secret: string): string {
    return this.generateTOTP(secret);
  }

  // ── Base32 ─────────────────────────────────────────────────────────────

  private toBase32(buffer: Buffer): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let result = '';
    let bits = 0;
    let value = 0;

    for (const byte of buffer) {
      value = (value << 8) | byte;
      bits += 8;
      while (bits >= 5) {
        result += alphabet[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }
    if (bits > 0) {
      result += alphabet[(value << (5 - bits)) & 31];
    }
    return result;
  }

  private fromBase32(base32: string): Buffer {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = 0;
    let value = 0;
    const bytes: number[] = [];

    for (const char of base32.toUpperCase()) {
      const idx = alphabet.indexOf(char);
      if (idx === -1) continue;
      value = (value << 5) | idx;
      bits += 5;
      if (bits >= 8) {
        bytes.push((value >>> (bits - 8)) & 0xff);
        bits -= 8;
      }
    }
    return Buffer.from(bytes);
  }

  private hashCode(code: string): string {
    return crypto.createHash('sha256').update(code).digest('hex');
  }

  reset(): void {
    this.profiles.clear();
  }
}

// ── Combined Security Service ─────────────────────────────────────────────

export class SecurityService {
  constructor(
    public blacklist: BlacklistEngine = new BlacklistEngine(),
    public twoFactor: TwoFactorEngine = new TwoFactorEngine()
  ) {}

  /**
   * Pre-action check: blacklist status + 2FA requirement.
   */
  checkAction(userId: string, action: 'p2p_send' | 'p2p_receive' | 'withdraw'): {
    allowed: boolean;
    reason?: string;
    require2FA?: boolean;
  } {
    const bl = this.blacklist.check(userId);

    if (action === 'p2p_send' || action === 'p2p_receive') {
      if (bl.freezeP2P) {
        return { allowed: false, reason: 'Blacklisted: P2P frozen' };
      }
    }

    if (action === 'withdraw') {
      if (bl.freezeWithdrawal) {
        return { allowed: false, reason: 'Blacklisted: withdrawal frozen' };
      }
      // Withdrawal always requires 2FA
      return { allowed: true, require2FA: true };
    }

    return { allowed: true };
  }

  reset(): void {
    this.blacklist.reset();
    this.twoFactor.reset();
  }
}

// ── Singletons ────────────────────────────────────────────────────────────

let _blacklistEngine: BlacklistEngine | null = null;
let _twoFactorEngine: TwoFactorEngine | null = null;
let _securityService: SecurityService | null = null;

export function getBlacklistEngine(): BlacklistEngine {
  if (!_blacklistEngine) _blacklistEngine = new BlacklistEngine();
  return _blacklistEngine;
}

export function getTwoFactorEngine(): TwoFactorEngine {
  if (!_twoFactorEngine) _twoFactorEngine = new TwoFactorEngine();
  return _twoFactorEngine;
}

export function getSecurityService(): SecurityService {
  if (!_securityService) _securityService = new SecurityService();
  return _securityService;
}

export default { BlacklistEngine, TwoFactorEngine, SecurityService };
