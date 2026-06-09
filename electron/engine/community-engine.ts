// ── J-72-01: Community Interaction Engine ───────────────────────────────
// Comment (multi-level replies) + Like + Follow/Unfollow + Signal Sharing
// + Report/Block/Mute (QClaw supplement) + Content Moderation (sensitive word filter)

// ── Types ────────────────────────────────────────────────────────────────

export interface Comment {
  id: string;
  authorId: string;
  targetType: "strategy" | "signal" | "benchmark";
  targetId: string;
  parentId: string | null; // null = top-level, non-null = reply
  content: string;
  depth: number; // 0 = top, 1 = reply, 2 = sub-reply (max 2)
  likes: number;
  reports: Report[];
  createdAt: number;
  updatedAt: number;
  deleted: boolean;
  censored: boolean; // flagged by content moderation
}

export interface Report {
  id: string;
  reporterId: string;
  reason: "spam" | "offensive" | "false_info" | "other";
  details: string;
  createdAt: number;
}

export interface LikeAction {
  userId: string;
  targetType: "comment" | "strategy" | "signal";
  targetId: string;
  liked: boolean;
  timestamp: number;
}

export interface FollowAction {
  followerId: string;
  followingId: string;
  active: boolean;
  createdAt: number;
  muted: boolean;
  blocked: boolean;
}

export interface ShareAction {
  userId: string;
  targetType: "strategy" | "signal" | "benchmark";
  targetId: string;
  platform: "internal" | "twitter" | "wechat" | "link";
  createdAt: number;
}

export interface PrivacySettings {
  userId: string;
  followListPublic: boolean;
  strategyPublic: boolean;
  dataExportable: boolean;
  accountDeletable: boolean;
}

// ── Sensitive Word Filter ───────────────────────────────────────────────

export class SensitiveWordFilter {
  private bannedWords: Set<string> = new Set();
  private warningWords: Set<string> = new Set();

  constructor() {
    // Default CN/EN banned words
    const banned = ["spam", "scam", "诈骗", "赌博", "色情", "违法", "porn", "fraud"];
    const warned = ["guarantee", "保证", "100%", "必赚", "稳赚"];
    for (const w of banned) this.bannedWords.add(w.toLowerCase());
    for (const w of warned) this.warningWords.add(w.toLowerCase());
  }

  check(content: string): { pass: boolean; censored: boolean; flags: string[] } {
    const lower = content.toLowerCase();
    const flags: string[] = [];

    for (const w of this.bannedWords) {
      if (lower.includes(w)) flags.push(`BANNED:${w}`);
    }
    for (const w of this.warningWords) {
      if (lower.includes(w)) flags.push(`WARNING:${w}`);
    }

    const censored = flags.some((f) => f.startsWith("BANNED"));
    return { pass: !censored || flags.length < 3, censored, flags };
  }

  addBanned(word: string): void {
    this.bannedWords.add(word.toLowerCase());
  }

  addWarning(word: string): void {
    this.warningWords.add(word.toLowerCase());
  }
}

// ── Community Engine ─────────────────────────────────────────────────────

export class CommunityEngine {
  private comments: Map<string, Comment> = new Map();
  private likes: Map<string, LikeAction> = new Map();
  private follows: Map<string, FollowAction> = new Map();
  private shares: ShareAction[] = [];
  private filter: SensitiveWordFilter = new SensitiveWordFilter();

  // ── Comments ──────────────────────────────────────────────────────────

  addComment(
    authorId: string,
    targetType: Comment["targetType"],
    targetId: string,
    content: string,
    parentId: string | null = null,
  ): { ok: boolean; comment?: Comment; error?: string } {
    const mod = this.filter.check(content);
    if (mod.censored) {
      return { ok: false, error: `Content blocked: ${mod.flags.join(", ")}` };
    }

    // Validate parent depth
    let depth = 0;
    if (parentId) {
      const parent = this.comments.get(parentId);
      if (!parent || parent.deleted) {
        return { ok: false, error: "Parent comment not found" };
      }
      depth = parent.depth + 1;
      if (depth > 2) {
        return { ok: false, error: "Max reply depth is 2" };
      }
    }

    const id = `cmt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const comment: Comment = {
      id,
      authorId,
      targetType,
      targetId,
      parentId,
      content,
      depth,
      likes: 0,
      reports: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      deleted: false,
      censored: mod.censored,
    };

    this.comments.set(id, comment);
    return { ok: true, comment };
  }

  getComments(
    targetType: Comment["targetType"],
    targetId: string,
    options?: { offset?: number; limit?: number },
  ): Comment[] {
    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? 20;
    return Array.from(this.comments.values())
      .filter((c) => c.targetType === targetType && c.targetId === targetId && !c.deleted)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(offset, offset + limit);
  }

  getReplies(parentId: string): Comment[] {
    return Array.from(this.comments.values())
      .filter((c) => c.parentId === parentId && !c.deleted)
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  deleteComment(commentId: string, userId: string): { ok: boolean; error?: string } {
    const comment = this.comments.get(commentId);
    if (!comment) return { ok: false, error: "Not found" };
    if (comment.authorId !== userId) return { ok: false, error: "Not authorized" };
    comment.deleted = true;
    comment.updatedAt = Date.now();
    return { ok: true };
  }

  reportComment(
    commentId: string,
    reporterId: string,
    reason: Report["reason"],
    details: string = "",
  ): { ok: boolean; error?: string } {
    const comment = this.comments.get(commentId);
    if (!comment) return { ok: false, error: "Not found" };
    const report: Report = {
      id: `rpt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      reporterId,
      reason,
      details,
      createdAt: Date.now(),
    };
    comment.reports.push(report);
    return { ok: true };
  }

  // ── Likes ─────────────────────────────────────────────────────────────

  toggleLike(
    userId: string,
    targetType: LikeAction["targetType"],
    targetId: string,
  ): { liked: boolean; count: number } {
    const key = `${userId}_${targetType}_${targetId}`;
    const existing = this.likes.get(key);

    if (existing && existing.liked) {
      existing.liked = false;
      existing.timestamp = Date.now();
      if (targetType === "comment") {
        const c = this.comments.get(targetId);
        if (c) c.likes = Math.max(0, c.likes - 1);
      }
      return { liked: false, count: targetType === "comment" ? this.comments.get(targetId)?.likes ?? 0 : 0 };
    }

    const action: LikeAction = { userId, targetType, targetId, liked: true, timestamp: Date.now() };
    this.likes.set(key, action);
    if (targetType === "comment") {
      const c = this.comments.get(targetId);
      if (c) c.likes++;
      return { liked: true, count: c?.likes ?? 1 };
    }
    return { liked: true, count: 1 };
  }

  getLikeCount(targetType: string, targetId: string): number {
    if (targetType === "comment") return this.comments.get(targetId)?.likes ?? 0;
    return Array.from(this.likes.values()).filter(
      (l) => l.targetType === targetType && l.targetId === targetId && l.liked,
    ).length;
  }

  // ── Follow ─────────────────────────────────────────────────────────────

  follow(
    followerId: string,
    followingId: string,
  ): { ok: boolean; action: "followed" | "already_following" } {
    if (followerId === followingId) return { ok: false, action: "already_following" };

    const key = `${followerId}_${followingId}`;
    const existing = this.follows.get(key);

    if (existing && existing.active) {
      return { ok: true, action: "already_following" };
    }

    this.follows.set(key, {
      followerId,
      followingId,
      active: true,
      createdAt: Date.now(),
      muted: false,
      blocked: false,
    });
    return { ok: true, action: "followed" };
  }

  unfollow(followerId: string, followingId: string): { ok: boolean } {
    const key = `${followerId}_${followingId}`;
    const f = this.follows.get(key);
    if (f) f.active = false;
    return { ok: true };
  }

  getFollowers(userId: string): string[] {
    return Array.from(this.follows.values())
      .filter((f) => f.followingId === userId && f.active && !f.blocked)
      .map((f) => f.followerId);
  }

  getFollowing(userId: string): string[] {
    return Array.from(this.follows.values())
      .filter((f) => f.followerId === userId && f.active)
      .map((f) => f.followingId);
  }

  // ── Block / Mute (QClaw supplement) ──────────────────────────────────

  blockUser(userId: string, targetId: string): { ok: boolean } {
    const key = `${userId}_${targetId}`;
    const f = this.follows.get(key);
    if (f) {
      f.blocked = true;
      f.active = false;
    } else {
      this.follows.set(key, {
        followerId: userId,
        followingId: targetId,
        active: false,
        createdAt: Date.now(),
        muted: false,
        blocked: true,
      });
    }
    return { ok: true };
  }

  muteUser(userId: string, targetId: string): { ok: boolean } {
    const key = `${userId}_${targetId}`;
    const f = this.follows.get(key);
    if (f) {
      f.muted = true;
    }
    return { ok: true };
  }

  isBlocked(userId: string, targetId: string): boolean {
    return this.follows.get(`${userId}_${targetId}`)?.blocked ?? false;
  }

  // ── Signal Sharing ────────────────────────────────────────────────────

  share(
    userId: string,
    targetType: ShareAction["targetType"],
    targetId: string,
    platform: ShareAction["platform"] = "internal",
  ): ShareAction {
    const action: ShareAction = { userId, targetType, targetId, platform, createdAt: Date.now() };
    this.shares.push(action);
    return action;
  }

  getShareCount(targetType: string, targetId: string): number {
    return this.shares.filter((s) => s.targetType === targetType && s.targetId === targetId).length;
  }

  // ── Privacy (QClaw supplement) ────────────────────────────────────────

  private privacySettings: Map<string, PrivacySettings> = new Map();

  setPrivacy(userId: string, settings: Partial<PrivacySettings>): PrivacySettings {
    const existing = this.privacySettings.get(userId) ?? {
      userId,
      followListPublic: true,
      strategyPublic: true,
      dataExportable: true,
      accountDeletable: true,
    };
    const updated = { ...existing, ...settings };
    this.privacySettings.set(userId, updated);
    return updated;
  }

  getPrivacy(userId: string): PrivacySettings {
    return (
      this.privacySettings.get(userId) ?? {
        userId,
        followListPublic: true,
        strategyPublic: true,
        dataExportable: true,
        accountDeletable: true,
      }
    );
  }

  deleteAccount(userId: string): { ok: boolean; affected: number } {
    let affected = 0;
    // Delete all comments
    for (const [id, c] of this.comments) {
      if (c.authorId === userId) {
        c.deleted = true;
        affected++;
      }
    }
    // Remove likes
    for (const [key, l] of this.likes) {
      if (l.userId === userId) {
        l.liked = false;
        affected++;
      }
    }
    // Remove follows
    for (const [key, f] of this.follows) {
      if (f.followerId === userId || f.followingId === userId) {
        f.active = false;
        affected++;
      }
    }
    this.privacySettings.delete(userId);
    return { ok: true, affected };
  }

  // ── Reset ─────────────────────────────────────────────────────────────

  reset(): void {
    this.comments.clear();
    this.likes.clear();
    this.follows.clear();
    this.shares = [];
    this.privacySettings.clear();
  }
}

// ── Factory ──────────────────────────────────────────────────────────────

export function createCommunityEngine(): CommunityEngine {
  return new CommunityEngine();
}
