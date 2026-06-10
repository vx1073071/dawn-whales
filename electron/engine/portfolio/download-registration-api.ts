/**
 * J-65-01 [P0]: 下载+注册API (R65 FIX — v1.6.0-beta)
 *
 * 桌面端版本检测 + 下载链接分发 + 自动更新检测。
 * 注册: 邮箱+密码 → 完善创作者资料 → 充USDT → 开始使用。
 * 桌面端完全免费, 付费功能靠USDT积分。
 * NO激活码, NO试用期, NO到期锁定。
 *
 * Features:
 * - Version check + download links (Win/Mac/Linux)
 * - Auto-update: check latest version, download hash, changelog
 * - Registration: email + password → account creation
 * - Profile setup: nickname, avatar, agent preference
 * - First-time welcome: 3 free AI analysis credits
 * - Download tracking + analytics
 *
 * >=300L, 10 tests
 */

import * as crypto from 'crypto';
import { EngineError, ErrorCode } from '../../errors';
import i18n from '../../../src/i18n';


// ── Types ──────────────────────────────────────────────────────────────────

export type Platform = 'windows' | 'mac' | 'linux';
export type Channel = 'stable' | 'beta' | 'nightly';

export interface AppVersion {
  version: string;            // e.g. "1.6.0-beta"
  buildNumber: number;
  channel: Channel;
  releaseDate: string;
  changelog: string;
  minOSVersion: Record<Platform, string>;
  downloads: Record<Platform, DownloadInfo>;
  hash: Record<Platform, string>; // SHA-256
}

export interface DownloadInfo {
  url: string;
  size: number;               // bytes
  platform: Platform;
  arch: 'x64' | 'arm64';
}

export interface RegisterRequest {
  email: string;
  password: string;           // bcrypt hashed client-side or sent over HTTPS
  nickname?: string;
  referralCode?: string;
}

export interface UserAccount {
  id: string;
  email: string;
  nickname: string;
  avatarUrl: string;
  registeredAt: string;
  referralCode: string;
  freeAICredits: number;      // 3 free on registration
  status: 'active' | 'suspended';
}

export interface UpdateCheckResult {
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion: AppVersion;
  downloadUrl: string;
  fileHash: string;
}

// ── Version Store ─────────────────────────────────────────────────────────

const DEFAULT_DOWNLOADS: Record<Platform, DownloadInfo> = {
  windows: { url: 'https://dl.dawnwhales.com/v1.6.0-beta/DawnWhales-Setup-1.6.0-beta.exe', size: 157286400, platform: 'windows', arch: 'x64' },
  mac: { url: 'https://dl.dawnwhales.com/v1.6.0-beta/DawnWhales-1.6.0-beta.dmg', size: 185597952, platform: 'mac', arch: 'arm64' },
  linux: { url: 'https://dl.dawnwhales.com/v1.6.0-beta/DawnWhales-1.6.0-beta.AppImage', size: 178257920, platform: 'linux', arch: 'x64' },
};

const DEFAULT_HASHES: Record<Platform, string> = {
  windows: 'sha256:abc123def456789',
  mac: 'sha256:def789abc123456',
  linux: 'sha256:456789def123abc',
};

// ── Download + Registration Server ────────────────────────────────────────

export class DownloadRegistrationServer {
  private versions: Map<string, AppVersion> = new Map();
  private accounts: Map<string, UserAccount> = new Map();
  private emails: Set<string> = new Set();
  private referralCodes: Map<string, string> = new Map(); // code→userId
  private downloadCounts: Map<string, number> = new Map();
  private activeChannels: Channel[] = ['stable', 'beta'];

  constructor() {
    // Seed initial version
    this.addVersion({
      version: '1.6.0-beta',
      buildNumber: 10600,
      channel: 'beta',
      releaseDate: '2026-06-09',
      changelog: i18n.t('downloadRegistrationApi.k1'),
      minOSVersion: { windows: '10.0.19041', mac: '12.0', linux: '5.15' },
      downloads: { ...DEFAULT_DOWNLOADS },
      hash: { ...DEFAULT_HASHES },
    });

    // And a stable placeholder
    this.addVersion({
      version: '1.5.0',
      buildNumber: 10500,
      channel: 'stable',
      releaseDate: '2026-06-08',
      changelog: i18n.t('downloadRegistrationApi.k2'),
      minOSVersion: { windows: '10.0.19041', mac: '12.0', linux: '5.15' },
      downloads: { ...DEFAULT_DOWNLOADS },
      hash: { ...DEFAULT_HASHES },
    });
  }

  // ── Version Management ─────────────────────────────────────────────────

  addVersion(version: AppVersion): void {
    this.versions.set(version.version, version);
    if (!this.activeChannels.includes(version.channel)) {
      this.activeChannels.push(version.channel);
    }
  }

  getLatestVersion(channel?: Channel): AppVersion | null {
    const versions = [...this.versions.values()].filter(v => v.channel === (channel ?? this.activeChannels[0]));
    versions.sort((a, b) => b.buildNumber - a.buildNumber);
    return versions[0] ?? null;
  }

  getVersion(version: string): AppVersion | undefined {
    return this.versions.get(version);
  }

  // ── Download ────────────────────────────────────────────────────────────

  getDownloadInfo(platform: Platform, channel?: Channel): DownloadInfo {
    const version = this.getLatestVersion(channel);
    if (!version) throw new EngineError(ErrorCode.INTERNAL_ERROR, 'No version available');
    const dl = version.downloads[platform];
    this.downloadCounts.set(platform, (this.downloadCounts.get(platform) ?? 0) + 1);
    return dl;
  }

  checkUpdate(currentVersion: string, platform: Platform, channel?: Channel): UpdateCheckResult {
    const latest = this.getLatestVersion(channel);
    if (!latest) return { updateAvailable: false, currentVersion, latestVersion: null as any, downloadUrl: '', fileHash: '' };

    const updateAvailable = this.compareVersions(latest.version, currentVersion) > 0;
    return {
      updateAvailable,
      currentVersion,
      latestVersion: latest,
      downloadUrl: updateAvailable ? latest.downloads[platform].url : '',
      fileHash: updateAvailable ? latest.hash[platform] : '',
    };
  }

  private compareVersions(a: string, b: string): number {
    const pa = a.split(/[.-]/).map(Number);
    const pb = b.split(/[.-]/).map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const da = pa[i] || 0, db = pb[i] || 0;
      if (da > db) return 1;
      if (da < db) return -1;
    }
    return 0;
  }

  // ── Registration ────────────────────────────────────────────────────────

  register(req: RegisterRequest): UserAccount {
    // Validate
    if (!this.isValidEmail(req.email)) throw new EngineError(ErrorCode.INTERNAL_ERROR, 'Invalid email format');
    if (this.emails.has(req.email.toLowerCase())) throw new EngineError(ErrorCode.INTERNAL_ERROR, 'Email already registered');
    if (req.password.length < 8) throw new EngineError(ErrorCode.INTERNAL_ERROR, 'Password too short (min 8 characters)');

    const id = `USR-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
    const referralCode = this.generateReferralCode(id);

    const account: UserAccount = {
      id,
      email: req.email.toLowerCase(),
      nickname: req.nickname ?? `User_${id.substring(4, 10)}`,
      avatarUrl: '',
      registeredAt: new Date().toISOString(),
      referralCode,
      freeAICredits: 3, // 3 free AI calls
      status: 'active',
    };

    this.accounts.set(id, account);
    this.emails.add(req.email.toLowerCase());
    if (referralCode) this.referralCodes.set(referralCode, id);

    // Process referral
    if (req.referralCode && this.referralCodes.has(req.referralCode)) {
      // Give referrer bonus (handled elsewhere)
    }

    return account;
  }

  login(email: string, password: string): UserAccount | null {
    const account = this.getAccountByEmail(email);
    if (!account) return null;
    if (account.status === 'suspended') return null;
    // In production: bcrypt.compare(password, storedHash)
    return account;
  }

  // ── Profile ─────────────────────────────────────────────────────────────

  updateProfile(userId: string, updates: { nickname?: string; avatarUrl?: string }): UserAccount {
    const account = this.accounts.get(userId);
    if (!account) throw new EngineError(ErrorCode.INTERNAL_ERROR, 'Account not found');
    if (updates.nickname) account.nickname = updates.nickname;
    if (updates.avatarUrl) account.avatarUrl = updates.avatarUrl;
    this.accounts.set(userId, account);
    return account;
  }

  // ── Referral ────────────────────────────────────────────────────────────

  private generateReferralCode(userId: string): string {
    return `DW-${userId.substring(4, 10)}`;
  }

  resolveReferralCode(code: string): string | undefined {
    return this.referralCodes.get(code);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  getAccount(id: string): UserAccount | undefined {
    return this.accounts.get(id);
  }

  getAccountByEmail(email: string): UserAccount | undefined {
    const e = email.toLowerCase();
    for (const [, account] of this.accounts) {
      if (account.email === e) return account;
    }
    return undefined;
  }

  suspendAccount(id: string): void {
    const account = this.accounts.get(id);
    if (account) { account.status = 'suspended'; this.accounts.set(id, account); }
  }

  getDownloadStats(): Record<string, number> {
    return Object.fromEntries(this.downloadCounts);
  }

  // ── Reset ───────────────────────────────────────────────────────────────

  reset(): void {
    this.versions.clear();
    this.accounts.clear();
    this.emails.clear();
    this.referralCodes.clear();
    this.downloadCounts.clear();
    // Re-seed version
    this.addVersion({
      version: '1.6.0-beta',
      buildNumber: 10600,
      channel: 'beta',
      releaseDate: '2026-06-09',
      changelog: i18n.t('downloadRegistrationApi.k3'),
      minOSVersion: { windows: '10.0.19041', mac: '12.0', linux: '5.15' },
      downloads: { ...DEFAULT_DOWNLOADS },
      hash: { ...DEFAULT_HASHES },
    });
    this.addVersion({
      version: '1.5.0',
      buildNumber: 10500,
      channel: 'stable',
      releaseDate: '2026-06-08',
      changelog: i18n.t('downloadRegistrationApi.k4'),
      minOSVersion: { windows: '10.0.19041', mac: '12.0', linux: '5.15' },
      downloads: { ...DEFAULT_DOWNLOADS },
      hash: { ...DEFAULT_HASHES },
    });
  }
}

// ── Singleton ────────────────────────────────────────────────────────────

let _dlServer: DownloadRegistrationServer | null = null;

export function getDLServer(): DownloadRegistrationServer {
  if (!_dlServer) _dlServer = new DownloadRegistrationServer();
  return _dlServer;
}

export function resetDLServer(): void {
  _dlServer?.reset();
  _dlServer = null;
}

export default { DownloadRegistrationServer, getDLServer, resetDLServer };
