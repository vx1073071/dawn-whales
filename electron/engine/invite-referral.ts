/**
 * J-80-03: 邀请裂变系统 G1
 * v1.9.0 GA — Invite referral engine: invite code → tracking → rewards
 *
 * Rules:
 * - Each user gets a unique invite code
 * - Referral chain: invite link → guest registration → inviter reward
 * - Reward: both get 1 free AI analysis (standard tier, ~1.0 USDT equivalent)
 * - Anti-abuse: same device/IP max 3 valid invites per 24h
 * - Acceptance: tests/invite-referral.test.ts >= 8 tests PASS
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface InviteCode {
  userId: string;
  code: string;
  createdAt: number;
  totalInvites: number;
  validInvites: number;
  rewardBalance: number; // number of free AI analysis credits
}

export interface ReferralRecord {
  id: string;
  inviterUserId: string;
  inviteCode: string;
  inviteeUserId: string | null; // null before invitee registers
  deviceId: string | null;
  ipAddress: string | null;
  status: 'pending' | 'registered' | 'rewarded' | 'rejected';
  createdAt: number;
  completedAt: number | null;
  rejectionReason: string | null;
}

export interface InviteStats {
  totalCodesGenerated: number;
  totalInvitesSent: number;
  totalRegistrations: number;
  totalRewarded: number;
  totalRejected: number;
  validRate: number;
  topInviters: { userId: string; validInvites: number }[];
}

// ── Constants ──────────────────────────────────────────────────────────────

const MAX_INVITES_PER_24H_PER_DEVICE = 3;
const MAX_INVITES_PER_24H_PER_IP = 3;
const REWARD_CREDITS = 1; // 1 free AI analysis
const INVITE_CODE_LENGTH = 8;
const INVITE_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I

// ── Engine ─────────────────────────────────────────────────────────────────

export class InviteReferralEngine {
  private codes = new Map<string, InviteCode>(); // userId → code
  private codeIndex = new Map<string, InviteCode>(); // code → InviteCode
  private referrals = new Map<string, ReferralRecord[]>();
  private counter = 0;

  /** Generate a unique invite code for a user */
  generateCode(userId: string): InviteCode {
    const existing = this.codes.get(userId);
    if (existing) return existing;

    let code: string;
    do {
      code = this.randomCode();
    } while (this.codeIndex.has(code));

    const invite: InviteCode = {
      userId,
      code,
      createdAt: Date.now(),
      totalInvites: 0,
      validInvites: 0,
      rewardBalance: 0,
    };

    this.codes.set(userId, invite);
    this.codeIndex.set(code, invite);
    return invite;
  }

  /** Get user's invite code, or generate one */
  getOrCreateCode(userId: string): InviteCode {
    return this.codes.get(userId) ?? this.generateCode(userId);
  }

  /** Look up invite code */
  lookupCode(code: string): InviteCode | null {
    return this.codeIndex.get(code) ?? null;
  }

  /** Track an invite click/visit */
  trackInvite(inviteCode: string, deviceId: string | null, ipAddress: string | null): ReferralRecord | null {
    const code = this.lookupCode(inviteCode);
    if (!code) return null;

    // Anti-abuse: check device/IP limits for the inviter
    const canInvite = this.checkRateLimit(code.userId, deviceId, ipAddress);
    if (!canInvite) return null;

    const record: ReferralRecord = {
      id: `REF-${Date.now()}-${++this.counter}`,
      inviterUserId: code.userId,
      inviteCode,
      inviteeUserId: null,
      deviceId,
      ipAddress,
      status: 'pending',
      createdAt: Date.now(),
      completedAt: null,
      rejectionReason: null,
    };

    let list = this.referrals.get(code.userId);
    if (!list) {
      list = [];
      this.referrals.set(code.userId, list);
    }
    list.push(record);

    code.totalInvites++;
    return record;
  }

  /** Complete registration for invitee → grant reward to both */
  completeRegistration(
    inviteCode: string,
    inviteeUserId: string,
  ): { inviterReward: number; inviteeReward: number } | null {
    const code = this.lookupCode(inviteCode);
    if (!code) return null;

    const lists = this.referrals.get(code.userId);
    if (!lists) return null;

    // Find the latest pending referral for this code
    const record = [...lists].reverse().find((r) => r.inviteCode === inviteCode && r.status === 'pending');
    if (!record) return null;

    record.inviteeUserId = inviteeUserId;
    record.status = 'rewarded';
    record.completedAt = Date.now();

    code.validInvites++;
    code.rewardBalance += REWARD_CREDITS;

    // Also grant reward to invitee
    const inviteeCode = this.getOrCreateCode(inviteeUserId);
    inviteeCode.rewardBalance += REWARD_CREDITS;

    return {
      inviterReward: REWARD_CREDITS,
      inviteeReward: REWARD_CREDITS,
    };
  }

  /** Reject a referral (anti-abuse) */
  rejectReferral(referralId: string, reason: string): boolean {
    for (const [userId, list] of this.referrals.entries()) {
      const record = list.find((r) => r.id === referralId);
      if (record && record.status === 'pending') {
        record.status = 'rejected';
        record.rejectionReason = reason;
        record.completedAt = Date.now();
        return true;
      }
    }
    return false;
  }

  /** Consume a reward credit */
  consumeReward(userId: string): boolean {
    const code = this.codes.get(userId);
    if (!code || code.rewardBalance <= 0) return false;
    code.rewardBalance--;
    return true;
  }

  /** Get user's reward balance */
  getRewardBalance(userId: string): number {
    return this.codes.get(userId)?.rewardBalance ?? 0;
  }

  /** Get invitation statistics */
  getStats(): InviteStats {
    const allCodes = [...this.codes.values()];
    const allReferrals = [...this.referrals.values()].flat();

    const topInviters = [...allCodes]
      .map((c) => ({ userId: c.userId, validInvites: c.validInvites }))
      .sort((a, b) => b.validInvites - a.validInvites)
      .slice(0, 10);

    const totalRewarded = allReferrals.filter((r) => r.status === 'rewarded').length;
    const totalCompleted = totalRewarded + allReferrals.filter((r) => r.status === 'rejected').length;

    return {
      totalCodesGenerated: allCodes.length,
      totalInvitesSent: allReferrals.length,
      totalRegistrations: totalCompleted,
      totalRewarded,
      totalRejected: allReferrals.filter((r) => r.status === 'rejected').length,
      validRate: totalCompleted > 0 ? totalRewarded / totalCompleted : 0,
      topInviters,
    };
  }

  /** Get referrals for a specific user */
  getUserReferrals(userId: string): ReferralRecord[] {
    return this.referrals.get(userId) ?? [];
  }

  // ── Private ────────────────────────────────────────────────────────────

  private randomCode(): string {
    let code = '';
    for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
      code += INVITE_CODE_CHARS.charAt(Math.floor(Math.random() * INVITE_CODE_CHARS.length));
    }
    return code;
  }

  private checkRateLimit(userId: string, deviceId: string | null, ipAddress: string | null): boolean {
    const now = Date.now();
    const cutoff = now - 86400000;

    const userReferrals = this.referrals.get(userId) ?? [];

    if (deviceId) {
      const deviceCount = userReferrals.filter((r) => r.deviceId === deviceId && r.createdAt >= cutoff).length;
      if (deviceCount >= MAX_INVITES_PER_24H_PER_DEVICE) return false;
    }

    if (ipAddress) {
      const ipCount = userReferrals.filter((r) => r.ipAddress === ipAddress && r.createdAt >= cutoff).length;
      if (ipCount >= MAX_INVITES_PER_24H_PER_IP) return false;
    }

    return true;
  }

  /** Reset all data */
  reset(): void {
    this.codes.clear();
    this.codeIndex.clear();
    this.referrals.clear();
    this.counter = 0;
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let instance: InviteReferralEngine | null = null;

export function getInviteEngine(): InviteReferralEngine {
  if (!instance) instance = new InviteReferralEngine();
  return instance;
}

export function resetInviteEngine(): void {
  instance?.reset();
  instance = null;
}

export default { InviteReferralEngine, getInviteEngine, resetInviteEngine };
