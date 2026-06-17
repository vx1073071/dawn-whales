/**
 * R279 auto#3: 因子社区IPC桥接 (FactorCommunityIPCBridge) v1.0
 * 
 * QUANT MOO — 因子社区共享+IPC通信桥接，打通用户间因子协作
 * 
 * 核心能力:
 *   1. 因子组合发布/发现: 用户创建因子组合→发布→社区发现→评级→回测验证
 *   2. 社区IPC事件: combo_published / combo_rated / combo_forked / leaderboard_update
 *   3. 排行榜: 收益率排行 / 夏普排行 / 流行度排行 / 稳定性排行
 *   4. 评论&反馈: 组合评论 / 收益反馈 / 改进建议
 *   5. 因子工具包(Factor Kits): 预打包因子集 / 场景因子包 / 一键导入
 *   6. 用户声望: 贡献者积分 / 验证者徽章 / 影响力排名
 */

// ── Types ──────────────────────────────────────────────────────────────────

export type FactorComboStatus = 'draft' | 'published' | 'verified' | 'deprecated';
export type ComboSortBy = 'returns' | 'sharpe' | 'popularity' | 'stability' | 'newest' | 'rating';
export type IPCEventType =
  | 'combo_published' | 'combo_rated' | 'combo_forked' | 'combo_verified'
  | 'leaderboard_update' | 'comment_added' | 'kit_released'
  | 'user_rank_change' | 'weekly_spotlight' | 'backtest_complete';

export interface FactorCombo {
  comboId: string;
  name: string;
  nameCn: string;
  author: string;
  authorAvatar?: string;
  status: FactorComboStatus;
  factors: Array<{
    factorId: string;
    factorName: string;
    factorNameCn: string;
    weight: number;
    direction: 'long' | 'short';
    category: string;
  }>;
  description: string;
  descriptionCn: string;
  tags: string[];
  performance: {
    totalReturn: number;
    annualReturn: number;
    volatility: number;
    sharpeRatio: number;
    maxDrawdown: number;
    calmarRatio: number;
    winRate: number;
    backtestPeriod: string;
    lastBacktest: number;
  };
  meta: {
    stars: number;             // 1-5 avg
    ratingCount: number;
    downloads: number;
    forks: number;
    verifiedBy: string[];
    createdAt: number;
    updatedAt: number;
  };
  usage: {
    compatibleMarkets: string[];
    rebalanceFreq: 'daily' | 'weekly' | 'monthly' | 'quarterly';
    minCapital: number;
    complexity: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  };
}

export interface FactorComboComment {
  commentId: string;
  comboId: string;
  author: string;
  content: string;
  rating?: number;              // 1-5
  verifiedReturn?: number;      // user-reported return
  createdAt: number;
  updatedAt?: number;
  replyTo?: string;
  likes: number;
}

export interface FactorKit {
  kitId: string;
  name: string;
  nameCn: string;
  author: string;
  description: string;
  descriptionCn: string;
  scene: string;                // e.g. 'bear_market', 'bull_market', 'inflation', 'recession'
  sceneCn: string;
  combos: string[];             // comboIds included
  downloads: number;
  rating: number;
  createdAt: number;
}

export interface CommunityEvent {
  eventId: string;
  type: IPCEventType;
  payload: Record<string, unknown>;
  timestamp: number;
  severity: 'info' | 'important' | 'urgent';
}

export interface UserReputation {
  userId: string;
  displayName: string;
  points: number;
  level: 'novice' | 'contributor' | 'expert' | 'master' | 'legend';
  badges: string[];
  combosPublished: number;
  combosVerified: number;
  totalDownloads: number;
  avgRating: number;
  rank: number;
}

export interface LeaderboardEntry {
  comboId: string;
  name: string;
  nameCn: string;
  author: string;
  combinedScore: number;
  metrics: {
    sharpe: number;
    totalReturn: number;
    maxDrawdown: number;
    winRate: number;
    stability: number;
  };
  stars: number;
  downloads: number;
  verified: boolean;
}

// ── FactorCommunityIPCBridge ───────────────────────────────────────────────

export class FactorCommunityIPCBridge {
  private combos: Map<string, FactorCombo> = new Map();
  private comments: FactorComboComment[] = [];
  private kits: Map<string, FactorKit> = new Map();
  private events: CommunityEvent[] = [];
  private reputations: Map<string, UserReputation> = new Map();

  // IPC handlers
  private eventHandlers: Array<(event: CommunityEvent) => void> = [];

  constructor() {
    // Track stats
    this._eventCount = 0;
  }

  private _eventCount: number;

  // ═══════════════════════════════════════════════════════════════════════
  // Factor Combo CRUD
  // ═══════════════════════════════════════════════════════════════════════

  publishCombo(combo: FactorCombo): FactorCombo {
    combo.meta.createdAt = Date.now();
    combo.meta.updatedAt = Date.now();
    combo.status = 'published';

    this.combos.set(combo.comboId, combo);

    // Update reputation
    this._awardPoints(combo.author, 10, 'combo_published');

    // Emit IPC event
    this._emit({
      eventId: `combo_pub_${Date.now()}`,
      type: 'combo_published',
      payload: { comboId: combo.comboId, name: combo.name, author: combo.author, factorCount: combo.factors.length },
      timestamp: Date.now(),
      severity: 'info',
    });

    return combo;
  }

  updateCombo(comboId: string, updates: Partial<Pick<FactorCombo, 'name' | 'nameCn' | 'description' | 'descriptionCn' | 'tags' | 'factors' | 'usage'>>): FactorCombo | null {
    const combo = this.combos.get(comboId);
    if (!combo) return null;

    Object.assign(combo, updates);
    combo.meta.updatedAt = Date.now();
    return combo;
  }

  getCombo(comboId: string): FactorCombo | null {
    return this.combos.get(comboId) ?? null;
  }

  getAllCombos(status?: FactorComboStatus): FactorCombo[] {
    let list = Array.from(this.combos.values());
    if (status) list = list.filter(c => c.status === status);
    return list;
  }

  getCombosByAuthor(author: string): FactorCombo[] {
    return Array.from(this.combos.values()).filter(c => c.author === author);
  }

  searchCombos(query: string): FactorCombo[] {
    const q = query.toLowerCase();
    return Array.from(this.combos.values()).filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.nameCn.includes(q) ||
      c.description.toLowerCase().includes(q) ||
      c.tags.some(t => t.toLowerCase().includes(q)) ||
      c.factors.some(f => f.factorName.toLowerCase().includes(q) || f.factorNameCn.includes(q))
    );
  }

  deleteCombo(comboId: string): boolean {
    const combo = this.combos.get(comboId);
    if (!combo) return false;

    // Remove associated comments
    this.comments = this.comments.filter(c => c.comboId !== comboId);
    // Remove from kits
    for (const kit of this.kits.values()) {
      kit.combos = kit.combos.filter(id => id !== comboId);
    }
    this.combos.delete(comboId);
    // Penalty
    this._awardPoints(combo.author, -5, 'combo_deleted');
    return true;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Rating & Forks
  // ═══════════════════════════════════════════════════════════════════════

  rateCombo(comboId: string, rating: number, userId: string): FactorCombo | null {
    const combo = this.combos.get(comboId);
    if (!combo || rating < 1 || rating > 5) return null;

    const newTotal = combo.meta.stars * combo.meta.ratingCount + rating;
    combo.meta.ratingCount++;
    combo.meta.stars = Math.round(newTotal / combo.meta.ratingCount * 100) / 100;

    // Award points to author
    this._awardPoints(combo.author, 2, 'combo_rated');

    // IPC event
    this._emit({
      eventId: `combo_rate_${Date.now()}`,
      type: 'combo_rated',
      payload: { comboId, rating, userId, newAvg: combo.meta.stars },
      timestamp: Date.now(),
      severity: rating <= 2 ? 'important' : 'info',
    });

    return combo;
  }

  downloadCombo(comboId: string): FactorCombo | null {
    const combo = this.combos.get(comboId);
    if (!combo) return null;
    combo.meta.downloads++;
    this._awardPoints(combo.author, 1, 'combo_downloaded');
    return combo;
  }

  forkCombo(comboId: string, newAuthor: string, newName: string, newNameCn: string): FactorCombo | null {
    const original = this.combos.get(comboId);
    if (!original) return null;

    const fork: FactorCombo = {
      comboId: `combo_fork_${Date.now()}`,
      name: newName, nameCn: newNameCn,
      author: newAuthor, status: 'draft',
      factors: original.factors.map(f => ({ ...f })),
      description: `Forked from "${original.name}" by ${original.author}`,
      descriptionCn: `基于"${original.nameCn}"(${original.author})的分支`,
      tags: [...original.tags, 'forked'],
      performance: {
        totalReturn: 0, annualReturn: 0, volatility: 0, sharpeRatio: 0,
        maxDrawdown: 0, calmarRatio: 0, winRate: 0,
        backtestPeriod: 'N/A', lastBacktest: 0,
      },
      meta: {
        stars: 0, ratingCount: 0, downloads: 0, forks: 0,
        verifiedBy: [], createdAt: Date.now(), updatedAt: Date.now(),
      },
      usage: { ...original.usage },
    };

    original.meta.forks++;
    this.combos.set(fork.comboId, fork);
    this._awardPoints(newAuthor, 3, 'combo_forked');
    this._awardPoints(original.author, 5, 'combo_forked_from');
    this._emit({
      eventId: `combo_fork_${Date.now()}`,
      type: 'combo_forked',
      payload: { originalId: comboId, forkId: fork.comboId, originalAuthor: original.author, newAuthor },
      timestamp: Date.now(),
      severity: 'info',
    });

    return fork;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Verification
  // ═══════════════════════════════════════════════════════════════════════

  verifyCombo(comboId: string, verifier: string): FactorCombo | null {
    const combo = this.combos.get(comboId);
    if (!combo) return null;

    if (!combo.meta.verifiedBy.includes(verifier)) {
      combo.meta.verifiedBy.push(verifier);
    }
    if (combo.meta.verifiedBy.length >= 3) {
      combo.status = 'verified';
    }

    this._awardPoints(combo.author, 20, 'combo_verified');
    this._awardPoints(verifier, 8, 'combo_verified_by');

    this._emit({
      eventId: `combo_verify_${Date.now()}`,
      type: 'combo_verified',
      payload: { comboId, verifier, totalVerifiers: combo.meta.verifiedBy.length, verified: combo.status === 'verified' },
      timestamp: Date.now(),
      severity: combo.status === 'verified' ? 'urgent' : 'info',
    });

    return combo;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Comments
  // ═══════════════════════════════════════════════════════════════════════

  addComment(comboId: string, author: string, content: string, rating?: number): FactorComboComment | null {
    if (!this.combos.has(comboId)) return null;

    const comment: FactorComboComment = {
      commentId: `cmt_${Date.now()}`,
      comboId, author, content, rating, createdAt: Date.now(), likes: 0,
    };

    this.comments.unshift(comment);

    if (rating) this.rateCombo(comboId, rating, author);

    this._emit({
      eventId: `comment_${Date.now()}`,
      type: 'comment_added',
      payload: { comboId, commentId: comment.commentId, author, hasRating: !!rating },
      timestamp: Date.now(),
      severity: 'info',
    });

    return comment;
  }

  getComments(comboId: string, limit = 50): FactorComboComment[] {
    return this.comments.filter(c => c.comboId === comboId).slice(0, limit);
  }

  likeComment(commentId: string): boolean {
    const comment = this.comments.find(c => c.commentId === commentId);
    if (!comment) return false;
    comment.likes++;
    return true;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Factor Kits
  // ═══════════════════════════════════════════════════════════════════════

  createKit(kit: FactorKit): FactorKit {
    kit.createdAt = Date.now();
    this.kits.set(kit.kitId, kit);

    this._emit({
      eventId: `kit_release_${Date.now()}`,
      type: 'kit_released',
      payload: { kitId: kit.kitId, name: kit.name, author: kit.author, comboCnt: kit.combos.length },
      timestamp: Date.now(),
      severity: 'important',
    });

    return kit;
  }

  getKit(kitId: string): FactorKit | null { return this.kits.get(kitId) ?? null; }
  getAllKits(): FactorKit[] { return Array.from(this.kits.values()); }

  getKitsByScene(scene: string): FactorKit[] {
    return Array.from(this.kits.values()).filter(k => k.scene === scene);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Leaderboards
  // ═══════════════════════════════════════════════════════════════════════

  getLeaderboard(sortBy: ComboSortBy = 'sharpe', limit = 20): LeaderboardEntry[] {
    const combos = Array.from(this.combos.values())
      .filter(c => c.status === 'published' || c.status === 'verified');

    const entries: LeaderboardEntry[] = combos.map(c => ({
      comboId: c.comboId,
      name: c.name,
      nameCn: c.nameCn,
      author: c.author,
      combinedScore: this._computeCombinedScore(c, sortBy),
      metrics: {
        sharpe: c.performance.sharpeRatio,
        totalReturn: c.performance.totalReturn,
        maxDrawdown: c.performance.maxDrawdown,
        winRate: c.performance.winRate,
        stability: c.performance.calmarRatio,
      },
      stars: c.meta.stars,
      downloads: c.meta.downloads,
      verified: c.status === 'verified',
    }));

    return entries.sort((a, b) => b.combinedScore - a.combinedScore).slice(0, limit);
  }

  getTopContributors(limit = 10): UserReputation[] {
    return Array.from(this.reputations.values())
      .sort((a, b) => b.points - a.points)
      .slice(0, limit);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // User Reputation
  // ═══════════════════════════════════════════════════════════════════════

  getUserReputation(userId: string): UserReputation | null {
    return this.reputations.get(userId) ?? null;
  }

  getAllReputations(): UserReputation[] {
    return Array.from(this.reputations.values());
  }

  // ═══════════════════════════════════════════════════════════════════════
  // IPC Events
  // ═══════════════════════════════════════════════════════════════════════

  getEvents(limit = 50): CommunityEvent[] {
    return this.events.slice(0, limit);
  }

  getEventsByType(type: IPCEventType, limit = 50): CommunityEvent[] {
    return this.events.filter(e => e.type === type).slice(0, limit);
  }

  getRecentEvents(sinceMs = 86400000): CommunityEvent[] {
    const cutoff = Date.now() - sinceMs;
    return this.events.filter(e => e.timestamp >= cutoff);
  }

  onEvent(handler: (event: CommunityEvent) => void): () => void {
    this.eventHandlers.push(handler);
    return () => { const idx = this.eventHandlers.indexOf(handler); if (idx >= 0) this.eventHandlers.splice(idx, 1); };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Bulk Operations
  // ═══════════════════════════════════════════════════════════════════════

  /** Export all user's combos as a factor kit */
  exportAsKit(userId: string, kitName: string, kitNameCn: string): FactorKit | null {
    const userCombos = this.getCombosByAuthor(userId);
    if (userCombos.length === 0) return null;

    const kit: FactorKit = {
      kitId: `kit_export_${Date.now()}`,
      name: kitName, nameCn: kitNameCn,
      author: userId,
      description: `Collection of ${userCombos.length} factor combos by ${userId}`,
      descriptionCn: `${userId}的${userCombos.length}个因子组合集`,
      scene: 'custom', sceneCn: '自定义',
      combos: userCombos.map(c => c.comboId),
      downloads: 0,
      rating: 0,
      createdAt: Date.now(),
    };

    this.kits.set(kit.kitId, kit);
    return kit;
  }

  /** Import a factor kit → register all combos */
  importKit(kitId: string, importerId: string): FactorCombo[] {
    const kit = this.kits.get(kitId);
    if (!kit) return [];

    const imported: FactorCombo[] = [];
    for (const comboId of kit.combos) {
      const original = this.combos.get(comboId);
      if (!original) continue;
      const fork = this.forkCombo(comboId, importerId, `${original.name} (imported)`, `${original.nameCn}(导入)`);
      if (fork) imported.push(fork);
    }

    kit.downloads++;
    return imported;
  }

  /** Weekly spotlight: select top combos */
  weeklySpotlight(limit = 5): LeaderboardEntry[] {
    const top = this.getLeaderboard('sharpe', limit);

    this._emit({
      eventId: `spotlight_${Date.now()}`,
      type: 'weekly_spotlight',
      payload: { combos: top.map(t => ({ comboId: t.comboId, name: t.name })) },
      timestamp: Date.now(),
      severity: 'important',
    });

    return top;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Stats / Reset
  // ═══════════════════════════════════════════════════════════════════════

  getStats(): {
    comboCount: number;
    publishedCount: number;
    verifiedCount: number;
    totalComments: number;
    kitCount: number;
    eventCount: number;
    userCount: number;
    totalDownloads: number;
    totalForks: number;
  } {
    let publishedCount = 0, verifiedCount = 0, totalDl = 0, totalForks = 0;
    for (const c of this.combos.values()) {
      if (c.status === 'published') publishedCount++;
      if (c.status === 'verified') verifiedCount++;
      totalDl += c.meta.downloads;
      totalForks += c.meta.forks;
    }

    return {
      comboCount: this.combos.size,
      publishedCount,
      verifiedCount,
      totalComments: this.comments.length,
      kitCount: this.kits.size,
      eventCount: this._eventCount,
      userCount: this.reputations.size,
      totalDownloads: totalDl,
      totalForks,
    };
  }

  reset(): void {
    this.combos.clear();
    this.comments = [];
    this.kits.clear();
    this.events = [];
    this.reputations.clear();
    this._eventCount = 0;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Private
  // ═══════════════════════════════════════════════════════════════════════

  private _computeCombinedScore(combo: FactorCombo, sortBy: ComboSortBy): number {
    switch (sortBy) {
      case 'returns': return combo.performance.totalReturn;
      case 'sharpe': return combo.performance.sharpeRatio * 0.6 + combo.meta.stars * 0.2 + Math.min(combo.meta.downloads / 100, 1) * 0.2;
      case 'popularity': return combo.meta.downloads * 0.5 + combo.meta.stars * 0.3 + combo.meta.ratingCount * 0.2;
      case 'stability': return combo.performance.calmarRatio * 0.5 + (1 - combo.performance.maxDrawdown) * 0.3 + combo.performance.winRate * 0.2;
      case 'rating': return combo.meta.stars * 0.5 + combo.meta.ratingCount * 0.3 + (combo.status === 'verified' ? 0.2 : 0);
      case 'newest': return combo.meta.createdAt;
      default: return combo.performance.sharpeRatio;
    }
  }

  private _awardPoints(userId: string, points: number, reason: string): void {
    let rep = this.reputations.get(userId);
    if (!rep) {
      rep = {
        userId, displayName: userId, points: 0,
        level: 'novice', badges: [],
        combosPublished: 0, combosVerified: 0,
        totalDownloads: 0, avgRating: 0, rank: 0,
      };
      this.reputations.set(userId, rep);
    }

    rep.points += points;

    // Level up
    if (rep.points >= 5000) rep.level = 'legend';
    else if (rep.points >= 2000) rep.level = 'master';
    else if (rep.points >= 500) rep.level = 'expert';
    else if (rep.points >= 100) rep.level = 'contributor';

    // Badges
    if (reason === 'combo_verified' && !rep.badges.includes('verified')) rep.badges.push('verified');
    if (rep.points >= 500 && !rep.badges.includes('golden')) rep.badges.push('golden');
    if (rep.combosPublished >= 10 && !rep.badges.includes('prolific')) rep.badges.push('prolific');
  }

  private _emit(event: CommunityEvent): void {
    this.events.unshift(event);
    if (this.events.length > 500) this.events = this.events.slice(0, 500);
    this._eventCount++;
    for (const h of this.eventHandlers) { try { h(event); } catch { /* non-fatal */ } }
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _communityIPC: FactorCommunityIPCBridge | null = null;

export function getCommunityIPC(): FactorCommunityIPCBridge {
  if (!_communityIPC) _communityIPC = new FactorCommunityIPCBridge();
  return _communityIPC;
}

export function resetCommunityIPC(): void {
  if (_communityIPC) _communityIPC.reset();
  _communityIPC = null;
}
