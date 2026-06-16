/**
 * R245 P1-28: AICreditPackageEngine — AI信用包引擎
 * LOBEHUB | v2.8.0
 *
 * 预付费信用包模式。用户购买信用包 → 每次AI调用扣减信用。
 * 比单次扣费的优势:
 *   - 用户心理: "已经付过了"→使用频率↑
 *   - 批量折扣: 刺激大额充值
 *   - 现金流: 预付费改善平台现金流
 *
 * 信用包定义:
 *   | 名称 | 价格 | 信用次数 | 折扣 | 有效期 |
 *   | Small  | 10U | 12次 | 20% | 30天 |
 *   | Medium | 50U | 65次 | 30% | 90天 |
 *   | Large  | 100U | 140次 | 40% | 180天 |
 *
 * 有效期到期后未使用信用作废（不退费）。
 *
 * 约束: 纯TypeScript, 零外部依赖, 与BillingWalletServer集成, ≥450L
 */

import log from 'electron-log';
import * as crypto from 'crypto';

// ── Types ────────────────────────────────────────────────────────────────

export type CreditPackageTier = 'small' | 'medium' | 'large';

export interface CreditPackage {
  tier: CreditPackageTier;
  name: string;
  price: number;          // USDT
  credits: number;        // 可用次数
  bonus: number;          // 额外赠送
  totalCredits: number;   // credits + bonus
  discount: number;       // 折扣率 0-1
  validityDays: number;   // 有效期天数
  perCreditCost: number;  // 每次实际成本
  active: boolean;
}

export const CREDIT_PACKAGES: CreditPackage[] = [
  {
    tier: 'small',
    name: '入门包',
    price: 10,
    credits: 10,
    bonus: 2,
    totalCredits: 12,
    discount: 0.20,
    validityDays: 30,
    perCreditCost: 10 / 12,
    active: true,
  },
  {
    tier: 'medium',
    name: '进阶包',
    price: 50,
    credits: 50,
    bonus: 15,
    totalCredits: 65,
    discount: 0.30,
    validityDays: 90,
    perCreditCost: 50 / 65,
    active: true,
  },
  {
    tier: 'large',
    name: '专业包',
    price: 100,
    credits: 100,
    bonus: 40,
    totalCredits: 140,
    discount: 0.40,
    validityDays: 180,
    perCreditCost: 100 / 140,
    active: true,
  },
];

export interface CreditBalance {
  userId: string;
  packages: CreditPackageHolding[];
  totalCreditsRemaining: number;
  totalCreditsPurchased: number;
  totalCreditsUsed: number;
  totalSpent: number;         // USDT
  lastUsedAt: number | null;
  expiresSoon: boolean;       // 7天内有包到期
}

export interface CreditPackageHolding {
  id: string;                 // UUID
  tier: CreditPackageTier;
  price: number;
  purchasedAt: number;
  expiresAt: number;
  totalCredits: number;       // 购买时的总数
  creditsRemaining: number;   // 剩余
  used: number;               // 已用
  status: 'active' | 'exhausted' | 'expired';
}

export interface CreditDeductionResult {
  success: boolean;
  deductedPackageId: string | null;
  creditsBefore: number;
  creditsAfter: number;
  cost: number;               // 本次消耗的USDT等价
  remainingActiveCredits: number;
  error?: string;
}

export interface CreditPackageStats {
  totalUsers: number;
  totalCreditsInCirculation: number;
  totalRevenue: number;       // USDT
  packageSales: Record<CreditPackageTier, number>;
  averageCreditsPerUser: number;
  topUsers: { userId: string; credits: number }[];
}

export interface CreditEngineConfig {
  minBalanceForDeduction: number;     // 至少1个credit
  expirationCheckIntervalMs: number;  // 检查间隔 1小时
  maxActivePackagesPerUser: number;   // 最多同时持有10个包
}

const DEFAULT_CONFIG: CreditEngineConfig = {
  minBalanceForDeduction: 1,
  expirationCheckIntervalMs: 3600000,
  maxActivePackagesPerUser: 10,
};

// ── AICreditPackageEngine ─────────────────────────────────────────────────

export class AICreditPackageEngine {
  readonly id = 'ai_credit_package_engine';
  readonly version = '2.8.0';

  private config: CreditEngineConfig;
  private balances: Map<string, CreditBalance> = new Map();
  private purchaseHistory: Map<string, CreditPackageHolding[]> = new Map();
  private expiryChecker: ReturnType<typeof setInterval> | null = null;

  // 外部余额扣费回调 (集成BillingWalletServer)
  private onChargeUSDT: ((userId: string, amount: number, description: string) => Promise<boolean>) | null = null;

  constructor(config?: Partial<CreditEngineConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ── 外部集成 ───────────────────────────────────────────────────────────

  /** 设置USDT扣费回调 (由BillingWalletServer提供) */
  setChargeCallback(fn: (userId: string, amount: number, description: string) => Promise<boolean>): void {
    this.onChargeUSDT = fn;
  }

  // ── 购买 ──────────────────────────────────────────────────────────────

  /** 获取可购买的信用包列表 */
  getAvailablePackages(): CreditPackage[] {
    return CREDIT_PACKAGES.filter(p => p.active);
  }

  /** 购买信用包 */
  async purchasePackage(userId: string, tier: CreditPackageTier): Promise<CreditPackageHolding | null> {
    const pkg = CREDIT_PACKAGES.find(p => p.tier === tier && p.active);
    if (!pkg) {
      log.error(`[CreditEngine] Invalid tier: ${tier}`);
      return null;
    }

    // 检查持有数量限制
    const existing = this.balances.get(userId);
    if (existing && existing.packages.filter(p => p.status === 'active').length >= this.config.maxActivePackagesPerUser) {
      log.warn(`[CreditEngine] ${userId}: max active packages (${this.config.maxActivePackagesPerUser}) reached`);
      return null;
    }

    // 扣费
    if (this.onChargeUSDT) {
      const charged = await this.onChargeUSDT(userId, pkg.price, `购买信用包: ${pkg.name} (${pkg.totalCredits}次)`);
      if (!charged) {
        log.error(`[CreditEngine] ${userId}: charge failed for ${tier} package`);
        return null;
      }
    } else {
      log.warn(`[CreditEngine] No charge callback set. Purchase simulated.`);
    }

    // 创建持有记录
    const now = Date.now();
    const holding: CreditPackageHolding = {
      id: crypto.randomUUID(),
      tier,
      price: pkg.price,
      purchasedAt: now,
      expiresAt: now + pkg.validityDays * 86400000,
      totalCredits: pkg.totalCredits,
      creditsRemaining: pkg.totalCredits,
      used: 0,
      status: 'active',
    };

    // 更新余额
    let balance = this.balances.get(userId);
    if (!balance) {
      balance = this.createBalance(userId);
      this.balances.set(userId, balance);
    }
    balance.packages.push(holding);
    balance.totalCreditsPurchased += pkg.totalCredits;
    balance.totalCreditsRemaining = this.sumRemaining(balance);
    balance.totalSpent += pkg.price;

    // 记录历史
    if (!this.purchaseHistory.has(userId)) {
      this.purchaseHistory.set(userId, []);
    }
    this.purchaseHistory.get(userId)!.push(holding);

    log.info(`[CreditEngine] ${userId} purchased ${tier} package: ${pkg.totalCredits} credits for ${pkg.price} USDT (saved ${(pkg.discount * 100).toFixed(0)}%)`);
    return holding;
  }

  // ── 扣费 ──────────────────────────────────────────────────────────────

  /**
   * 消耗1次信用。
   * 策略: FIFO (最先买的先用, 先过期的先用)
   */
  deductCredit(
    userId: string,
    aiService: string = 'unknown',
  ): CreditDeductionResult {
    const balance = this.balances.get(userId);
    if (!balance) {
      return { success: false, deductedPackageId: null, creditsBefore: 0, creditsAfter: 0, cost: 0, remainingActiveCredits: 0, error: 'No credit balance' };
    }

    // 清理过期包
    this.cleanExpired(balance);

    const creditsBefore = balance.totalCreditsRemaining;

    // 按过期时间排序: 最早过期的先用 (FIFO-expiry)
    const active = balance.packages
      .filter(p => p.status === 'active' && p.creditsRemaining > 0)
      .sort((a, b) => a.expiresAt - b.expiresAt);

    if (active.length === 0) {
      return {
        success: false,
        deductedPackageId: null,
        creditsBefore,
        creditsAfter: balance.totalCreditsRemaining,
        cost: 0,
        remainingActiveCredits: 0,
        error: 'No active credits. Purchase a credit package.',
      };
    }

    // 从第一个(最先过期)的包扣除
    const target = active[0];
    const perCreditCost = target.price / target.totalCredits;

    target.creditsRemaining--;
    target.used++;
    if (target.creditsRemaining <= 0) {
      target.status = 'exhausted';
    }

    balance.totalCreditsUsed++;
    balance.totalCreditsRemaining = this.sumRemaining(balance);
    balance.lastUsedAt = Date.now();

    const cost = Math.round(perCreditCost * 100) / 100;

    log.info(`[CreditEngine] ${userId}: -1 credit for "${aiService}" from ${target.tier} package. Remaining: ${balance.totalCreditsRemaining}`);

    return {
      success: true,
      deductedPackageId: target.id,
      creditsBefore,
      creditsAfter: balance.totalCreditsRemaining,
      cost,
      remainingActiveCredits: this.sumRemaining(balance),
    };
  }

  /** 批量扣除多个credit (用于高费用服务) */
  deductCredits(
    userId: string,
    count: number,
    aiService: string = 'unknown',
  ): CreditDeductionResult[] {
    const results: CreditDeductionResult[] = [];
    for (let i = 0; i < count; i++) {
      const result = this.deductCredit(userId, aiService);
      results.push(result);
      if (!result.success) break; // 不够了
    }
    return results;
  }

  // ── 查询 ──────────────────────────────────────────────────────────────

  /** 获取用户信用余额 */
  getBalance(userId: string): CreditBalance | null {
    const balance = this.balances.get(userId);
    if (!balance) return null;
    this.cleanExpired(balance);
    balance.totalCreditsRemaining = this.sumRemaining(balance);
    balance.expiresSoon = this.checkExpiresSoon(balance);
    return balance;
  }

  /** 检查用户是否有足够信用 */
  hasCredits(userId: string, count: number = 1): boolean {
    const balance = this.balances.get(userId);
    if (!balance) return false;
    this.cleanExpired(balance);
    return this.sumRemaining(balance) >= count;
  }

  /** 获取用户购买历史 */
  getPurchaseHistory(userId: string): CreditPackageHolding[] {
    return this.purchaseHistory.get(userId) || [];
  }

  /** 获取全局统计 */
  getStats(): CreditPackageStats {
    const sales: Record<CreditPackageTier, number> = { small: 0, medium: 0, large: 0 };
    let totalRevenue = 0;
    let totalCredits = 0;
    const userCredits: { userId: string; credits: number }[] = [];

    for (const history of this.purchaseHistory.values()) {
      for (const pkg of history) {
        sales[pkg.tier] = (sales[pkg.tier] || 0) + 1;
        totalRevenue += pkg.price;
        totalCredits += pkg.totalCredits;
      }
    }

    for (const [userId, balance] of this.balances.entries()) {
      userCredits.push({ userId, credits: this.sumRemaining(balance) });
    }

    return {
      totalUsers: this.balances.size,
      totalCreditsInCirculation: totalCredits,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      packageSales: sales,
      averageCreditsPerUser: this.balances.size > 0
        ? Math.round(totalCredits / this.balances.size)
        : 0,
      topUsers: userCredits.sort((a, b) => b.credits - a.credits).slice(0, 10),
    };
  }

  // ── 生命周期 ──────────────────────────────────────────────────────────

  /** 启动过期检查定时器 */
  startExpiryChecker(): void {
    if (this.expiryChecker) return;
    this.expiryChecker = setInterval(() => this.checkAllForExpiry(), this.config.expirationCheckIntervalMs);
    log.info(`[CreditEngine] Expiry checker started (interval: ${this.config.expirationCheckIntervalMs}ms)`);
  }

  /** 停止过期检查 */
  stopExpiryChecker(): void {
    if (this.expiryChecker) {
      clearInterval(this.expiryChecker);
      this.expiryChecker = null;
    }
  }

  // ── Private ─────────────────────────────────────────────────────────────

  private createBalance(userId: string): CreditBalance {
    return {
      userId,
      packages: [],
      totalCreditsRemaining: 0,
      totalCreditsPurchased: 0,
      totalCreditsUsed: 0,
      totalSpent: 0,
      lastUsedAt: null,
      expiresSoon: false,
    };
  }

  private sumRemaining(balance: CreditBalance): number {
    return balance.packages
      .filter(p => p.status === 'active')
      .reduce((sum, p) => sum + p.creditsRemaining, 0);
  }

  private cleanExpired(balance: CreditBalance): void {
    const now = Date.now();
    for (const pkg of balance.packages) {
      if (pkg.status === 'active' && now > pkg.expiresAt) {
        pkg.status = 'expired';
        log.info(`[CreditEngine] ${balance.userId}: ${pkg.tier} package expired (${pkg.creditsRemaining} credits lost)`);
      }
    }
  }

  private checkExpiresSoon(balance: CreditBalance): boolean {
    const sevenDays = 7 * 86400000;
    const now = Date.now();
    return balance.packages.some(
      p => p.status === 'active' && p.creditsRemaining > 0 && (p.expiresAt - now) < sevenDays,
    );
  }

  private checkAllForExpiry(): void {
    let expiredCount = 0;
    for (const [, balance] of this.balances) {
      const before = this.sumRemaining(balance);
      this.cleanExpired(balance);
      const after = this.sumRemaining(balance);
      if (before !== after) expiredCount++;
    }
    if (expiredCount > 0) {
      log.info(`[CreditEngine] Expiry check: ${expiredCount} users had expired packages`);
    }
  }
}

export default AICreditPackageEngine;
