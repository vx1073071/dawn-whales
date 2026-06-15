/**
 * DAWN WHALES R146 J04 — AI Strategy Health Check
 * 
 * Scans ALL of a user's strategies and assigns health status:
 *   🔴 RED:    30-day continuous loss  (连续30天亏损)
 *   🟡 YELLOW: Parameters unchanged > 90 days  (参数90天未更新)
 *   🟢 GREEN:  Normal, no issues detected
 * 
 * Price: 1 USDT/次
 * 
 * Can be triggered manually by user OR run daily via cron.
 * 
 * Health check flow:
 *   For each strategy:
 *     1. Check recent 30-day PnL → if all negative → RED
 *     2. Check last parameter update → if > 90 days → YELLOW
 *     3. Otherwise → GREEN
 *   Aggregate: overall portfolio health score
 * 
 * ≥300L
 */

import Database from 'better-sqlite3';
import { AIBillingService } from './ai-billing';

export type HealthStatus = 'GREEN' | 'YELLOW' | 'RED';

export interface StrategyHealth {
  strategyId: string;
  strategyName: string;
  framework: string;
  status: HealthStatus;
  reason: string;
  metrics: {
    healthScore: number;       // 0-100
    daysActive: number;
    lastPnL30d: number;
    daysSinceParamUpdate: number;
    currentDrawdownPct: number;
  };
  recommendation: string;
}

export interface HealthCheckResult {
  success: boolean;
  billId: string;
  checkId: string;
  checkedAt: string;
  totalStrategies: number;
  green: number;
  yellow: number;
  red: number;
  overallScore: number;    // 0-100
  strategies: StrategyHealth[];
  summary: string;
  error?: string;
}

// ═══════════════ Health Thresholds ═══════════════════════════════════════

const RED_DAYS_LOSS = 30;        // 30 consecutive days of loss
const YELLOW_PARAM_DAYS = 90;    // 90 days since last parameter update

// ═══════════════ AI Health Check Service ═════════════════════════════════

export class AIHealthCheckService {
  private db: Database.Database;
  private billing: AIBillingService;

  constructor(db: Database.Database, billing: AIBillingService) {
    this.db = db;
    this.billing = billing;
    this.ensureTables();
  }

  private ensureTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ai_health_checks (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        bill_id TEXT NOT NULL,
        results_json TEXT NOT NULL,
        total_strategies INTEGER NOT NULL,
        green_count INTEGER NOT NULL,
        yellow_count INTEGER NOT NULL,
        red_count INTEGER NOT NULL,
        overall_score REAL NOT NULL,
        model_used TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (bill_id) REFERENCES ai_bills(id)
      );
      CREATE INDEX IF NOT EXISTS idx_ai_health_checks_user ON ai_health_checks(user_id);

      -- Strategy performance log (for health tracking)
      CREATE TABLE IF NOT EXISTS strategy_daily_pnl (
        id TEXT PRIMARY KEY,
        strategy_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        date TEXT NOT NULL,
        daily_pnl_usdt REAL NOT NULL DEFAULT 0,
        daily_trades INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(strategy_id, date)
      );
      CREATE INDEX IF NOT EXISTS idx_strategy_daily_pnl_strategy ON strategy_daily_pnl(strategy_id);
      CREATE INDEX IF NOT EXISTS idx_strategy_daily_pnl_date ON strategy_daily_pnl(date);

      -- Strategy param change log
      CREATE TABLE IF NOT EXISTS strategy_param_changes (
        id TEXT PRIMARY KEY,
        strategy_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        old_params_json TEXT,
        new_params_json TEXT NOT NULL,
        changed_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_strategy_param_changes_strategy ON strategy_param_changes(strategy_id);
    `);
  }

  /**
   * Run health check for all user strategies.
   */
  async checkHealth(userId: string, walletId: string, idempotencyKey: string): Promise<HealthCheckResult> {
    // Bill user (1 USDT)
    const billResult = this.billing.billAIService({
      userId, walletId,
      serviceType: 'AI_CHAT',
      customPriceUSDT: 1,
      idempotencyKey,
    });

    if (!billResult.success) {
      return { success: false, billId: billResult.billId, checkId: '', checkedAt: '',
        totalStrategies: 0, green: 0, yellow: 0, red: 0, overallScore: 0,
        strategies: [], summary: '', error: billResult.error || 'Billing failed' };
    }

    try {
      // Get all strategies for this user
      const strategies = this.getUserStrategies(userId);
      const results: StrategyHealth[] = [];

      for (const s of strategies) {
        const health = this.checkSingleStrategy(s);
        results.push(health);
      }

      const green = results.filter(r => r.status === 'GREEN').length;
      const yellow = results.filter(r => r.status === 'YELLOW').length;
      const red = results.filter(r => r.status === 'RED').length;
      const total = results.length;

      // Overall score: weighted by severity
      const overallScore = total > 0
        ? Math.max(0, 100 - red * 40 - yellow * 15) / Math.max(1, total) * 100
        : 100;

      const checkId = generateId();
      const now = new Date().toISOString();

      this.db.prepare(`
        INSERT INTO ai_health_checks (id, user_id, bill_id, results_json, total_strategies, green_count, yellow_count, red_count, overall_score, model_used)
        VALUES (?,?,?,?,?,?,?,?,?,?)
      `).run(checkId, userId, billResult.billId, JSON.stringify(results),
        total, green, yellow, red, overallScore, 'DeepSeek-V4-Pro');

      const summary = this.buildSummary(green, yellow, red, total, overallScore);

      return {
        success: true, billId: billResult.billId, checkId, checkedAt: now,
        totalStrategies: total, green, yellow, red,
        overallScore: Math.round(overallScore), strategies: results, summary,
      };
    } catch (err: any) {
      this.billing.refundAIService({
        billId: billResult.billId, userId,
        reason: `Health check failed: ${err.message}`,
      });
      return { success: false, billId: billResult.billId, checkId: '', checkedAt: '',
        totalStrategies: 0, green: 0, yellow: 0, red: 0, overallScore: 0,
        strategies: [], summary: '', error: `Health check failed: ${err.message}` };
    }
  }

  private checkSingleStrategy(s: any): StrategyHealth {
    const now = new Date();

    // Check 30-day consecutive loss
    const recent30Days = this.db.prepare(
      `SELECT daily_pnl_usdt FROM strategy_daily_pnl WHERE strategy_id=? ORDER BY date DESC LIMIT ?`
    ).all(s.strategyId, RED_DAYS_LOSS) as { daily_pnl_usdt: number }[];

    const all30Negative = recent30Days.length >= 20 && recent30Days.every(d => d.daily_pnl_usdt < 0);
    const total30d = recent30Days.reduce((sum, d) => sum + d.daily_pnl_usdt, 0);

    // Check parameter update recency
    const lastParamChange = this.db.prepare(
      'SELECT MAX(changed_at) as last_change FROM strategy_param_changes WHERE strategy_id=?'
    ).get(s.strategyId) as { last_change: string | null };

    let dateRange = 'N/A';
    try {
      const lastDate = new Date(lastParamChange?.last_change || s.createdAt || '2023-01-01');
      dateRange = lastDate.toISOString().split('T')[0];
    } catch {}

    const daysSinceUpdate = lastParamChange?.last_change
      ? Math.floor((now.getTime() - new Date(lastParamChange.last_change).getTime()) / 86400000)
      : 999;

    let status: HealthStatus = 'GREEN';
    let reason = '策略运行正常, 近期表现和参数均为最新。';
    let healthScore = 100;
    let recommendation = '保持当前配置, 继续监控。';

    // RED: 30 consecutive loss days
    if (all30Negative) {
      status = 'RED';
      reason = `近30天连续亏损, 累计${total30d.toFixed(1)} USDT。策略在当前市场环境下已失效, 需要紧急干预。`;
      healthScore = 15;
      recommendation = '建议立即暂停策略或大幅调整参数。使用AI优化功能重新校准止损和入场条件。';
    }
    // YELLOW: params > 90 days old
    else if (daysSinceUpdate > YELLOW_PARAM_DAYS) {
      status = 'YELLOW';
      reason = `参数${daysSinceUpdate}天未更新, 可能已不适应当前市场环境。上次更新时间: ${dateRange}。`;
      healthScore = 55;
      recommendation = '建议使用AI参数优化功能, 基于最新市场数据重新校准参数。';
    }

    // Recent drawdown check
    let currentDrawdown = 0;
    if (s.currentEquity && s.peakEquity && s.peakEquity > 0) {
      currentDrawdown = ((s.peakEquity - s.currentEquity) / s.peakEquity) * 100;
    }

    return {
      strategyId: s.strategyId,
      strategyName: s.strategyName || 'Unnamed Strategy',
      framework: s.framework || 'MA_CROSSOVER',
      status, reason,
      metrics: {
        healthScore,
        daysActive: s.daysActive || Math.floor((now.getTime() - new Date(s.createdAt || now).getTime()) / 86400000) || 1,
        lastPnL30d: total30d,
        daysSinceParamUpdate: daysSinceUpdate,
        currentDrawdownPct: currentDrawdown,
      },
      recommendation,
    };
  }

  private getUserStrategies(userId: string): any[] {
    // Try to get from multiple possible sources
    const fromLibrary = this.db.prepare(
      `SELECT DISTINCT mp.id as strategyId, mp.title as strategyName, mp.type as framework, mp.created_at as createdAt
       FROM user_library ul JOIN marketplace_products mp ON mp.id = ul.product_id
       WHERE ul.user_id = ?`
    ).all(userId);

    if (fromLibrary.length > 0) return fromLibrary;

    // Fallback: strategies from signal data
    const fromSignals = this.db.prepare(
      'SELECT DISTINCT strategy_id as strategyId, strategy_name as strategyName, strategy_type as framework FROM signals WHERE user_id = ?'
    ).all(userId);

    if (fromSignals.length > 0) return fromSignals;

    return [];
  }

  private buildSummary(green: number, yellow: number, red: number, total: number, overallScore: number): string {
    if (total === 0) return '暂无活跃策略, 请先订阅或创建策略。';
    if (red > 0 && yellow > 0) return `⚠️ 健康度${Math.round(overallScore)}/100。${red}个策略需紧急干预(连续亏损≥30天), ${yellow}个策略参数过期。建议优先处理红色策略。`;
    if (red > 0) return `🔴 健康度${Math.round(overallScore)}/100。${red}个策略连续亏损≥30天, 需紧急干预!`;
    if (yellow > 0) return `🟡 健康度${Math.round(overallScore)}/100。${yellow}个策略参数超过90天未更新, 建议使用AI优化。`;
    return `🟢 健康度${Math.round(overallScore)}/100。${green}个策略全部正常, 无需干预。`;
  }

  /**
   * Record daily PnL for a strategy (called by cron or trade execution).
   */
  recordDailyPnl(strategyId: string, userId: string, date: string, pnlUSDT: number, trades: number): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO strategy_daily_pnl (id, strategy_id, user_id, date, daily_pnl_usdt, daily_trades)
      VALUES (?,?,?,?,?,?)
    `).run(generateId(), strategyId, userId, date, pnlUSDT, trades);
  }

  /**
   * Record parameter change (called when user updates strategy params).
   */
  recordParamChange(strategyId: string, userId: string, oldParams: any, newParams: any): void {
    this.db.prepare(`
      INSERT INTO strategy_param_changes (id, strategy_id, user_id, old_params_json, new_params_json)
      VALUES (?,?,?,?,?)
    `).run(generateId(), strategyId, userId, oldParams ? JSON.stringify(oldParams) : null, JSON.stringify(newParams));
  }

  getHistory(userId: string, limit = 20, offset = 0) {
    const rows = this.db.prepare(
      'SELECT * FROM ai_health_checks WHERE user_id=? ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).all(userId, limit, offset) as any[];

    return rows.map(r => ({
      id: r.id, userId: r.user_id, billId: r.bill_id,
      results: JSON.parse(r.results_json),
      totalStrategies: r.total_strategies, greenCount: r.green_count,
      yellowCount: r.yellow_count, redCount: r.red_count,
      overallScore: r.overall_score, modelUsed: r.model_used,
      createdAt: r.created_at,
    }));
  }
}

function generateId(): string {
  const crypto = require('crypto');
  return crypto.randomUUID();
}
