
/**
 * DAWN WHALES R144 J04 — Creator Level Engine
 * 
 * Automatic creator tier management based on cumulative sales count.
 * 
 * v17.6 Level Rules (PERMANENT):
 *  - L1 (Newcomer):     default, 0-99 sales, platform takes 30%
 *  - L2 (Intermediate): >= 100 cumulative sales, platform takes 20%
 *  - L3 (Top):          >= 1000 cumulative sales, platform takes 10%
 *  - Pure sales-based upgrade, no review ratings, no KYC!
 * 
 * Commission structure:
 *  L1: platform 30% / creator 70%
 *  L2: platform 20% / creator 80%
 *  L3: platform 10% / creator 90%
 * 
 * Integration: creator-level.ts is the single source of truth for levels.
 * Both marketplace.ts and tip.ts reference this module.
 * 
 * ≥200L
 */

import Database from 'better-sqlite3';

export type CreatorLevel = 'L1' | 'L2' | 'L3';

export interface LevelConfig {
  level: CreatorLevel;
  platformRate: number;
  creatorRate: number;
  minSales: number;
  label: string;
}

export interface CreatorLevelInfo {
  userId: string;
  level: CreatorLevel;
  totalSales: number;
  totalRevenueUSDT: number;
  lastUpgradeAt?: string;
  levelConfig: LevelConfig;
}

// ═══════════════ Level Configs (v17.6 PERMANENT) ══════════════════════════

export const LEVEL_CONFIGS: Record<CreatorLevel, LevelConfig> = {
  L1: {
    level: 'L1',
    platformRate: 0.30,
    creatorRate: 0.70,
    minSales: 0,
    label: 'Newcomer',
  },
  L2: {
    level: 'L2',
    platformRate: 0.20,
    creatorRate: 0.80,
    minSales: 100,
    label: 'Intermediate',
  },
  L3: {
    level: 'L3',
    platformRate: 0.10,
    creatorRate: 0.90,
    minSales: 1000,
    label: 'Top Creator',
  },
};

// ═══════════════ Creator Level Engine ════════════════════════════════════

export class CreatorLevelEngine {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
    this.ensureTables();
  }

  private ensureTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS creator_levels_v2 (
        user_id TEXT PRIMARY KEY,
        level TEXT NOT NULL DEFAULT 'L1' CHECK(level IN ('L1','L2','L3')),
        total_sales INTEGER NOT NULL DEFAULT 0,
        total_revenue_usdt REAL NOT NULL DEFAULT 0,
        first_sale_at TEXT,
        last_sale_at TEXT,
        upgraded_at TEXT,
        previous_level TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
      CREATE INDEX IF NOT EXISTS idx_creator_levels_v2_level ON creator_levels_v2(level);
      CREATE INDEX IF NOT EXISTS idx_creator_levels_v2_sales ON creator_levels_v2(total_sales);
    `);
  }

  /**
   * Get creator level info (auto-creates L1 entry if not found).
   */
  getCreatorLevel(userId: string): CreatorLevelInfo {
    let row = this.db.prepare(
      'SELECT * FROM creator_levels_v2 WHERE user_id = ?'
    ).get(userId) as any;

    if (!row) {
      this.db.prepare(`
        INSERT INTO creator_levels_v2 (user_id, level, total_sales, total_revenue_usdt)
        VALUES (?, 'L1', 0, 0)
      `).run(userId);
      row = { user_id: userId, level: 'L1', total_sales: 0, total_revenue_usdt: 0,
        first_sale_at: null, last_sale_at: null, upgraded_at: null, previous_level: null };
    }

    return this.buildInfo(row);
  }

  /**
   * Get level config for a creator.
   */
  getLevelConfig(userId: string): LevelConfig {
    const info = this.getCreatorLevel(userId);
    return LEVEL_CONFIGS[info.level];
  }

  /**
   * Calculate commission split for a sale.
   */
  calculateCommission(userId: string, saleAmount: number): {
    level: CreatorLevel;
    platformRate: number;
    creatorRate: number;
    platformShare: number;
    creatorShare: number;
  } {
    const config = this.getLevelConfig(userId);
    return {
      level: config.level,
      platformRate: config.platformRate,
      creatorRate: config.creatorRate,
      platformShare: roundUSD(saleAmount * config.platformRate),
      creatorShare: roundUSD(saleAmount * config.creatorRate),
    };
  }

  /**
   * Record a sale (template purchase, combo purchase, subscription).
   * Automatically checks and upgrades level.
   */
  recordSale(userId: string, saleAmount: number): CreatorLevelInfo {
    // Ensure creator exists
    const current = this.getCreatorLevel(userId);

    const newSales = current.totalSales + 1;
    const newRevenue = roundUSD(current.totalRevenueUSDT + saleAmount);
    const now = new Date().toISOString();

    // Update stats
    this.db.prepare(`
      UPDATE creator_levels_v2 SET
        total_sales = ?,
        total_revenue_usdt = ?,
        last_sale_at = ?,
        updated_at = datetime('now')
      WHERE user_id = ?
    `).run(newSales, newRevenue, now, userId);

    if (!current.lastUpgradeAt) {
      // First sale
      this.db.prepare(
        "UPDATE creator_levels_v2 SET first_sale_at = ? WHERE user_id = ?"
      ).run(now, userId);
    }

    // Check upgrade
    const newLevel = this.computeLevel(newSales);
    if (newLevel !== current.level) {
      this.db.prepare(`
        UPDATE creator_levels_v2 SET
          level = ?,
          previous_level = ?,
          upgraded_at = ?,
          updated_at = datetime('now')
        WHERE user_id = ?
      `).run(newLevel, current.level, now, userId);

      return this.getCreatorLevel(userId);
    }

    return this.getCreatorLevel(userId);
  }

  /**
   * Record subscription revenue (recurring, counts as 1 sale on first month only).
   */
  recordSubscriptionSale(userId: string, amount: number, isFirstMonth: boolean): CreatorLevelInfo {
    if (isFirstMonth) {
      return this.recordSale(userId, amount);
    }
    // Recurring: only update revenue, not sales count
    const current = this.getCreatorLevel(userId);
    const newRevenue = roundUSD(current.totalRevenueUSDT + amount);
    this.db.prepare(`
      UPDATE creator_levels_v2 SET
        total_revenue_usdt = ?,
        last_sale_at = ?,
        updated_at = datetime('now')
      WHERE user_id = ?
    `).run(newRevenue, new Date().toISOString(), userId);

    return this.getCreatorLevel(userId);
  }

  /**
   * Compute what level a creator should be at based on sales count.
   */
  computeLevel(totalSales: number): CreatorLevel {
    // ⚠️ KEY: >= 100 to be L2, >= 1000 to be L3
    // 99 sales = still L1, 999 sales = still L2
    if (totalSales >= 1000) return 'L3';
    if (totalSales >= 100) return 'L2';
    return 'L1';
  }

  /**
   * Check if a creator is close to the next level (for UI badges).
   */
  getNextLevelProgress(userId: string): {
    currentLevel: CreatorLevel;
    nextLevel: CreatorLevel | null;
    salesNeeded: number;
    currentSales: number;
    progressPct: number;
  } {
    const info = this.getCreatorLevel(userId);
    let nextLevel: CreatorLevel | null = null;
    let salesNeeded = 0;

    if (info.level === 'L1') {
      nextLevel = 'L2';
      salesNeeded = 100;
    } else if (info.level === 'L2') {
      nextLevel = 'L3';
      salesNeeded = 1000;
    }

    return {
      currentLevel: info.level,
      nextLevel,
      salesNeeded: salesNeeded,
      currentSales: info.totalSales,
      progressPct: salesNeeded > 0
        ? Math.min(100, Math.round((info.totalSales / salesNeeded) * 100))
        : 100,
    };
  }

  /**
   * Get all creators at a specific level.
   */
  getCreatorsByLevel(level: CreatorLevel, limit = 50, offset = 0) {
    const rows = this.db.prepare(
      'SELECT * FROM creator_levels_v2 WHERE level = ? ORDER BY total_revenue_usdt DESC LIMIT ? OFFSET ?'
    ).all(level, limit, offset);
    const count = (this.db.prepare(
      'SELECT COUNT(*) as total FROM creator_levels_v2 WHERE level = ?'
    ).get(level) as any).total;

    return {
      creators: (rows as any[]).map((r: any) => this.buildInfo(r)),
      pagination: { total: count, limit, offset },
    };
  }

  /**
   * Get top creators by sales.
   */
  getTopCreators(limit = 20) {
    const rows = this.db.prepare(
      'SELECT * FROM creator_levels_v2 ORDER BY total_revenue_usdt DESC LIMIT ?'
    ).all(limit);
    return (rows as any[]).map((r: any) => this.buildInfo(r));
  }

  // ═══════════ Helpers ══════════════════════════════════════════════

  private buildInfo(row: any): CreatorLevelInfo {
    const config = LEVEL_CONFIGS[row.level as CreatorLevel];
    return {
      userId: row.user_id,
      level: row.level,
      totalSales: row.total_sales,
      totalRevenueUSDT: row.total_revenue_usdt,
      lastUpgradeAt: row.upgraded_at || undefined,
      levelConfig: config,
    };
  }
}

// ═══════════════ Helper ═══════════════════════════════════════════════════

function roundUSD(v: number): number {
  return Math.round(v * 10000) / 10000;
}
