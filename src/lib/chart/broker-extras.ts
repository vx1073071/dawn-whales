// ── R121 PM: 券商锦上添花 — 跟单比例配置 + 多券商净值日报 ────────────
//
// @author PM (WorkBuddy)
// @round R121
// @since 2026-06-12

// ═══════════════════════════════════════════════════════════════════════
// COPY-TRADE CONFIGURATION ENGINE (跟单比例配置)
// ═══════════════════════════════════════════════════════════════════════

export interface CopyTradeRule {
  id: string;
  signalBrokerId: string;      // 信号来源券商
  signalProviderId?: string;   // 具体信号提供者ID
  targetBrokerId: string;      // 跟单目标券商
  multiplier: number;          // 跟单倍数 (默认1.0)
  maxPositionSize: number;     // 最大仓位(USDT)
  minPositionSize: number;     // 最小仓位(USDT)
  maxOpenOrders: number;       // 最大同时持仓
  stopLossPct: number;         // 硬止损(%)
  enabled: boolean;
  symbols: string[];           // 只跟这些标的 (* = 全部)
  excludeSymbols: string[];    // 排除标的
  createdAt: number;
}

export interface CopyTradeExecution {
  ruleId: string;
  signalSymbol: string;
  signalSide: 'buy' | 'sell';
  signalAmount: number;        // 信号源原始量
  targetSymbol: string;
  targetSide: 'buy' | 'sell';
  /** 计算后实际下单量 (信号量×倍数, 不超过最大仓位) */
  adjustedAmount: number;
  /** 是否被限 */
  limited: boolean;
  limitReason?: string;
  timestamp: number;
}

const COPY_TRADE_KEY = 'dw_copy_trade_rules';

export class CopyTradeManager {
  private rules: Map<string, CopyTradeRule> = new Map();

  constructor() { this.load(); }

  addRule(rule: Omit<CopyTradeRule, 'id' | 'createdAt'>): CopyTradeRule {
    const full: CopyTradeRule = {
      ...rule,
      id: `ct_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      createdAt: Date.now(),
    };
    this.rules.set(full.id, full);
    this.save();
    return full;
  }

  removeRule(id: string): boolean {
    const ok = this.rules.delete(id);
    if (ok) this.save();
    return ok;
  }

  toggleRule(id: string, enabled?: boolean): CopyTradeRule | undefined {
    const r = this.rules.get(id);
    if (!r) return undefined;
    r.enabled = enabled ?? !r.enabled;
    this.save();
    return r;
  }

  getRules(): CopyTradeRule[] {
    return Array.from(this.rules.values());
  }

  /** 计算跟单执行: 信号 → 实际下单量 */
  computeExecution(
    signal: { brokerId: string; symbol: string; side: 'buy' | 'sell'; amount: number; providerId?: string },
  ): CopyTradeExecution[] {
    const results: CopyTradeExecution[] = [];

    for (const [, rule] of this.rules) {
      if (!rule.enabled) continue;
      if (rule.signalBrokerId !== signal.brokerId) continue;
      if (rule.signalProviderId && rule.signalProviderId !== signal.providerId) continue;
      if (rule.symbols.length > 0 && !rule.symbols.includes('*') && !rule.symbols.includes(signal.symbol)) continue;
      if (rule.excludeSymbols.includes(signal.symbol)) continue;

      let adjusted = signal.amount * rule.multiplier;
      let limited = false;
      let reason = '';

      if (adjusted < rule.minPositionSize) { limited = true; reason = '低于最小仓位'; continue; }
      if (adjusted > rule.maxPositionSize) { adjusted = rule.maxPositionSize; limited = true; reason = '超过最大仓位'; }

      results.push({
        ruleId: rule.id,
        signalSymbol: signal.symbol,
        signalSide: signal.side,
        signalAmount: signal.amount,
        targetSymbol: signal.symbol,
        targetSide: signal.side,
        adjustedAmount: adjusted,
        limited,
        limitReason: reason || undefined,
        timestamp: Date.now(),
      });
    }

    return results;
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(COPY_TRADE_KEY);
      if (raw) for (const r of JSON.parse(raw) as CopyTradeRule[]) this.rules.set(r.id, r);
    } catch { /* ignore */ }
  }

  private save(): void {
    localStorage.setItem(COPY_TRADE_KEY, JSON.stringify(this.getRules()));
  }
}

// ═══════════════════════════════════════════════════════════════════════
// MULTI-BROKER DAILY PNL REPORT (多券商净值日报)
// ═══════════════════════════════════════════════════════════════════════

export interface BrokerPnLSummary {
  brokerId: string;
  netPnL: number;
  netPnLPct: number;
  totalValue: number;        // 当前总资产
  totalCost: number;         // 总成本
  realizedPnL: number;
  unrealizedPnL: number;
  commission: number;
  tradeCount: number;
  winCount: number;
  lossCount: number;
  winRate: number;
}

export interface DailyPnLReport {
  date: string;              // YYYY-MM-DD
  totalPnL: number;
  totalPnLPct: number;
  totalValue: number;
  brokers: BrokerPnLSummary[];
  topGainer: { brokerId: string; symbol: string; pnl: number };
  topLoser: { brokerId: string; symbol: string; pnl: number };
  generatedAt: number;
}

export function computeDailyPnL(
  positions: { brokerId: string; symbol: string; qty: number; avgCost: number; currentPrice: number; realizedPnL: number; commission: number }[],
  date: string = new Date().toISOString().slice(0, 10),
): DailyPnLReport {
  const brokerMap = new Map<string, BrokerPnLSummary>();

  for (const pos of positions) {
    let b = brokerMap.get(pos.brokerId);
    if (!b) {
      b = {
        brokerId: pos.brokerId, netPnL: 0, netPnLPct: 0, totalValue: 0, totalCost: 0,
        realizedPnL: 0, unrealizedPnL: 0, commission: 0, tradeCount: 0,
        winCount: 0, lossCount: 0, winRate: 0,
      };
      brokerMap.set(pos.brokerId, b);
    }

    const unrealized = (pos.currentPrice - pos.avgCost) * pos.qty;
    b.unrealizedPnL += unrealized;
    b.realizedPnL += pos.realizedPnL;
    b.commission += pos.commission;
    b.totalValue += pos.currentPrice * pos.qty;
    b.totalCost += pos.avgCost * pos.qty;
    b.tradeCount++;

    const totalPnL = pos.realizedPnL + unrealized;
    if (totalPnL >= 0) b.winCount++;
    else b.lossCount++;
  }

  let totalPnL = 0, totalValue = 0;
  const summaries: BrokerPnLSummary[] = [];

  for (const [, b] of brokerMap) {
    b.netPnL = b.realizedPnL + b.unrealizedPnL - b.commission;
    b.netPnLPct = b.totalCost > 0 ? (b.netPnL / b.totalCost) * 100 : 0;
    b.winRate = b.tradeCount > 0 ? (b.winCount / b.tradeCount) * 100 : 0;
    totalPnL += b.netPnL;
    totalValue += b.totalValue;
    summaries.push(b);
  }

  summaries.sort((a, b) => b.netPnL - a.netPnL);

  // Find top gainer/loser from positions
  const sorted = [...positions].sort((a, b) =>
    ((b.currentPrice - b.avgCost) * b.qty + b.realizedPnL) -
    ((a.currentPrice - a.avgCost) * a.qty + a.realizedPnL)
  );

  return {
    date,
    totalPnL,
    totalPnLPct: totalValue > 0 ? (totalPnL / totalValue) * 100 : 0,
    totalValue,
    brokers: summaries,
    topGainer: sorted[0] ? { brokerId: sorted[0].brokerId, symbol: sorted[0].symbol, pnl: (sorted[0].currentPrice - sorted[0].avgCost) * sorted[0].qty } : { brokerId: '', symbol: '', pnl: 0 },
    topLoser: sorted[sorted.length - 1] ? { brokerId: sorted[sorted.length - 1].brokerId, symbol: sorted[sorted.length - 1].symbol, pnl: (sorted[sorted.length - 1].currentPrice - sorted[sorted.length - 1].avgCost) * sorted[sorted.length - 1].qty } : { brokerId: '', symbol: '', pnl: 0 },
    generatedAt: Date.now(),
  };
}

/** Markdown格式日报 */
export function formatDailyReport(report: DailyPnLReport): string {
  const lines = [
    `# 多券商净值日报 — ${report.date}`,
    '',
    `| 指标 | 值 |`,
    `|------|-----|`,
    `| 总盈亏 | ${report.totalPnL.toFixed(2)} USDT (${report.totalPnLPct.toFixed(2)}%) |`,
    `| 总资产 | ${report.totalValue.toFixed(2)} USDT |`,
    `| 最佳标的 | ${report.topGainer.brokerId} ${report.topGainer.symbol} +${report.topGainer.pnl.toFixed(2)} |`,
    `| 最差标的 | ${report.topLoser.brokerId} ${report.topLoser.symbol} ${report.topLoser.pnl.toFixed(2)} |`,
    '',
    '## 各券商明细',
    '',
    '| 券商 | 净盈亏 | 收益率 | 总资产 | 佣金 | 交易数 | 胜率 |',
    '|------|--------|--------|--------|------|--------|------|',
  ];

  for (const b of report.brokers) {
    lines.push(`| ${b.brokerId} | ${b.netPnL.toFixed(2)} | ${b.netPnLPct.toFixed(2)}% | ${b.totalValue.toFixed(2)} | ${b.commission.toFixed(2)} | ${b.tradeCount} | ${b.winRate.toFixed(0)}% |`);
  }

  return lines.join('\n');
}
