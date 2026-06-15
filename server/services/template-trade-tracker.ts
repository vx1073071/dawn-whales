/**
 * template-trade-tracker.ts — R215 JVS#2: 模板→交易下游路径追踪
 *
 * Tracks which strategy template produced which trades, enabling:
 *   1. Revenue attribution (which template generated the most fees)
 *   2. Template performance (real PnL from trades, not just backtest)
 *   3. Copy-trade fee share for creators (template → trade volume → creator payout)
 *   4. Downgrade paths: template match → trade → fee type
 *
 * Uses: AIDegradationChain charges (MATCH_ENGINE) + billing-service fees
 *       for actual trade execution through each template
 *
 * >=250L production-ready, v2.1.2
 */

import log from 'electron-log';

// ── Types ────────────────────────────────────────────────────────────

export interface TemplateTradeRecord {
  tradeId: string;
  templateId: string;
  templateNameCN: string;
  templateCategory: string;
  userId: string;
  walletId: string;
  symbol: string;
  market: string;
  assetClass: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice?: number;
  quantity: number;
  notionalValue: number;
  pnl?: number;
  pnlPct?: number;
  status: 'OPEN' | 'CLOSED' | 'CANCELLED';
  feeUSDT: number;         // fee charged by broker
  copyTradeFeeUSDT: number;  // DAWN WHALES copy-trade platform fee (0.3%)
  creatorId?: string;      // for copy-trade attribution
  creatorShareUSDT?: number; // creator's revenue share
  matchedAt: number;
  closedAt?: number;
}

export interface TemplateRevenueReport {
  templateId: string;
  templateNameCN: string;
  templateCategory: string;
  totalTrades: number;
  openTrades: number;
  closedTrades: number;
  totalNotionalValue: number;
  totalPnL: number;
  totalFeesUSDT: number;          // broker fees
  totalCopyTradeFeesUSDT: number; // platform fees
  totalCreatorSharesUSDT: number;
  winRate: number;
  avgHoldingDays: number;
  sharpeRatio: number;
}

export interface CreatorRevenueReport {
  creatorId: string;
  templates: string[];          // templateIds this creator owns
  totalTrades: number;
  totalVolumeUSDT: number;
  totalCreatorShareUSDT: number;
  byTemplate: Record<string, number>; // templateId → shareUSDT
  periodStart: number;
  periodEnd: number;
}

export interface RevenueTrendPoint {
  date: string;               // YYYY-MM-DD
  totalFeesUSDT: number;
  totalCopyTradeFeesUSDT: number;
  totalTrades: number;
}

// ── Engine ───────────────────────────────────────────────────────────

export class TemplateTradeTracker {
  private trades: TemplateTradeRecord[] = [];

  /** Record a new trade linked to a template */
  recordTrade(params: Omit<TemplateTradeRecord, 'feeUSDT' | 'copyTradeFeeUSDT' | 'creatorShareUSDT' | 'status'>): TemplateTradeRecord {
    const tradeId = `trd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const notionalValue = params.entryPrice * params.quantity;

    // Fee calculations per盈利模型 v17.6
    const feeUSDT = Math.max(2, Math.round(notionalValue * 0.001 * 100) / 100);     // 0.1% min 2U
    const copyTradeFeeUSDT = params.creatorId
      ? Math.max(2, Math.round(notionalValue * 0.003 * 100) / 100)  // copy-trade: 0.3%
      : 0;
    const creatorShareUSDT = params.creatorId
      ? Math.round(copyTradeFeeUSDT * 0.7 * 100) / 100  // creator gets 70% of 0.3% fee
      : 0;

    const record: TemplateTradeRecord = {
      ...params, tradeId, feeUSDT, copyTradeFeeUSDT, creatorShareUSDT,
      status: 'OPEN', notionalValue,
    };
    this.trades.push(record);

    log.info(`[TemplateTradeTracker] New trade ${tradeId}: ${params.templateNameCN} → ${params.symbol} ${params.side}, ${notionalValue.toFixed(0)} USDT`);
    return record;
  }

  /** Close a trade (called when position exits) */
  closeTrade(tradeId: string, exitPrice: number): TemplateTradeRecord | undefined {
    const trade = this.trades.find(t => t.tradeId === tradeId);
    if (!trade) return undefined;

    trade.exitPrice = exitPrice;
    trade.closedAt = Date.now();
    trade.status = 'CLOSED';

    const pnl = trade.side === 'LONG'
      ? (exitPrice - trade.entryPrice) * trade.quantity - trade.feeUSDT
      : (trade.entryPrice - exitPrice) * trade.quantity - trade.feeUSDT;
    trade.pnl = Math.round(pnl * 100) / 100;
    trade.pnlPct = Math.round((pnl / trade.notionalValue) * 10000) / 100;

    log.info(`[TemplateTradeTracker] Closed ${tradeId}: PnL ${trade.pnl} USDT (${trade.pnlPct}%)`);
    return trade;
  }

  /** Get all trades for a template */
  getTradesByTemplate(templateId: string, status?: 'OPEN' | 'CLOSED'): TemplateTradeRecord[] {
    let result = this.trades.filter(t => t.templateId === templateId);
    if (status) result = result.filter(t => t.status === status);
    return result.sort((a, b) => b.matchedAt - a.matchedAt);
  }

  /** Get all trades for a user */
  getTradesByUser(userId: string, limit: number = 100): TemplateTradeRecord[] {
    return this.trades.filter(t => t.userId === userId)
      .sort((a, b) => b.matchedAt - a.matchedAt).slice(0, limit);
  }

  // ── Revenue Attribution ────────────────────────────────────────────

  /** Generate per-template revenue report */
  getTemplateRevenue(startDate: number = 0, endDate: number = Date.now()): TemplateRevenueReport[] {
    const inRange = this.trades.filter(t => t.matchedAt >= startDate && t.matchedAt <= endDate);
    const grouped = new Map<string, TemplateTradeRecord[]>();
    for (const t of inRange) {
      const list = grouped.get(t.templateId) || [];
      list.push(t);
      grouped.set(t.templateId, list);
    }

    const reports: TemplateRevenueReport[] = [];
    for (const [tplId, trades] of grouped) {
      const closed = trades.filter(t => t.status === 'CLOSED');
      const wins = closed.filter(t => (t.pnl || 0) > 0);
      const totalPnL = closed.reduce((s, t) => s + (t.pnl || 0), 0);
      const holdingDays = closed
        .filter(t => t.matchedAt && t.closedAt)
        .map(t => (t.closedAt! - t.matchedAt) / 86400000);
      const avgHolding = holdingDays.length > 0
        ? holdingDays.reduce((s, d) => s + d, 0) / holdingDays.length : 0;

      reports.push({
        templateId: tplId,
        templateNameCN: trades[0].templateNameCN,
        templateCategory: trades[0].templateCategory,
        totalTrades: trades.length,
        openTrades: trades.filter(t => t.status === 'OPEN').length,
        closedTrades: closed.length,
        totalNotionalValue: Math.round(trades.reduce((s, t) => s + t.notionalValue, 0) * 100) / 100,
        totalPnL: Math.round(totalPnL * 100) / 100,
        totalFeesUSDT: Math.round(trades.reduce((s, t) => s + t.feeUSDT, 0) * 100) / 100,
        totalCopyTradeFeesUSDT: Math.round(trades.reduce((s, t) => s + t.copyTradeFeeUSDT, 0) * 100) / 100,
        totalCreatorSharesUSDT: Math.round(trades.reduce((s, t) => s + (t.creatorShareUSDT || 0), 0) * 100) / 100,
        winRate: closed.length > 0 ? Math.round((wins.length / closed.length) * 100) : 0,
        avgHoldingDays: Math.round(avgHolding * 10) / 10,
        sharpeRatio: this.calcSharpe(trades),
      });
    }

    return reports.sort((a, b) => b.totalCopyTradeFeesUSDT - a.totalCopyTradeFeesUSDT);
  }

  /** Generate creator revenue report */
  getCreatorRevenue(creatorId: string, startDate: number = 0, endDate: number = Date.now()): CreatorRevenueReport {
    const myTrades = this.trades.filter(t =>
      t.creatorId === creatorId && t.matchedAt >= startDate && t.matchedAt <= endDate);

    const templates = new Set(myTrades.map(t => t.templateId));
    const byTemplate: Record<string, number> = {};
    for (const t of myTrades) {
      byTemplate[t.templateId] = (byTemplate[t.templateId] || 0) + (t.creatorShareUSDT || 0);
    }

    return {
      creatorId,
      templates: [...templates],
      totalTrades: myTrades.length,
      totalVolumeUSDT: Math.round(myTrades.reduce((s, t) => s + t.notionalValue, 0) * 100) / 100,
      totalCreatorShareUSDT: Math.round(myTrades.reduce((s, t) => s + (t.creatorShareUSDT || 0), 0) * 100) / 100,
      byTemplate,
      periodStart: startDate,
      periodEnd: endDate,
    };
  }

  /** Get daily revenue trend */
  getRevenueTrend(days: number = 30): RevenueTrendPoint[] {
    const points: RevenueTrendPoint[] = [];
    const now = Date.now();
    for (let d = days - 1; d >= 0; d--) {
      const dayStart = now - (d + 1) * 86400000;
      const dayEnd = now - d * 86400000;
      const dayTrades = this.trades.filter(t => t.matchedAt >= dayStart && t.matchedAt < dayEnd);
      points.push({
        date: new Date(dayEnd).toISOString().slice(0, 10),
        totalFeesUSDT: Math.round(dayTrades.reduce((s, t) => s + t.feeUSDT, 0) * 100) / 100,
        totalCopyTradeFeesUSDT: Math.round(dayTrades.reduce((s, t) => s + t.copyTradeFeeUSDT, 0) * 100) / 100,
        totalTrades: dayTrades.length,
      });
    }
    return points;
  }

  // ── Helpers ────────────────────────────────────────────────────────

  private calcSharpe(trades: TemplateTradeRecord[]): number {
    const pnls = trades.filter(t => t.status === 'CLOSED').map(t => t.pnlPct || 0);
    if (pnls.length < 3) return 0;
    const avg = pnls.reduce((s, v) => s + v, 0) / pnls.length;
    const variance = pnls.reduce((s, v) => s + (v - avg) ** 2, 0) / pnls.length;
    const std = Math.sqrt(variance);
    return std > 0 ? Math.round((avg / std) * Math.sqrt(252) * 100) / 100 : 0; // annualized
  }

  getTopTemplates(by: 'fees' | 'pnl' | 'volume', limit: number = 5): TemplateRevenueReport[] {
    const reports = this.getTemplateRevenue();
    switch (by) {
      case 'pnl': return reports.sort((a, b) => b.totalPnL - a.totalPnL).slice(0, limit);
      case 'volume': return reports.sort((a, b) => b.totalNotionalValue - a.totalNotionalValue).slice(0, limit);
      default: return reports.sort((a, b) => b.totalFeesUSDT - a.totalFeesUSDT).slice(0, limit);
    }
  }

  seedMockData(userId: string, creatorId?: string): void {
    const now = Date.now();
    const symbols = ['AAPL', 'TSLA', 'NVDA', 'MSFT', '2330.TW', '0700.HK', 'BTC-USDT'];
    const tplIds = ['TPL_EARNINGS_HUNTER', 'TPL_MAG7_MOMENTUM', 'TPL_BTC_TREND', 'TPL_VALUE_DIGGER'];
    const tplNames = ['财报猎人', 'MAG7动量', 'BTC趋势跟踪', '价值掘金'];

    for (let i = 0; i < 8; i++) {
      const idx = i % tplIds.length;
      const trade = this.recordTrade({
        templateId: tplIds[idx],
        templateNameCN: tplNames[idx],
        templateCategory: ['事件驱动', '动量追逐', '加密趋势', '价值投资'][idx],
        userId, walletId: `wallet_${userId}`,
        symbol: symbols[i % symbols.length],
        market: symbols[i % symbols.length].includes('TW') ? 'TW' : symbols[i % symbols.length].includes('HK') ? 'HK' : symbols[i % symbols.length].includes('BTC') ? 'CRYPTO' : 'US',
        assetClass: symbols[i % symbols.length].includes('BTC') ? 'CRYPTO' : 'STOCK',
        side: 'LONG' as const,
        entryPrice: [150, 250, 800, 400, 600, 350, 60000][Math.floor(Math.random() * 7)],
        quantity: Math.floor(Math.random() * 100) + 10,
        notionalValue: 0, // computed
        creatorId: i < 4 ? creatorId : undefined,
        matchedAt: now - i * 2 * 86400000,
      });

      // Close half
      if (i < 4) {
        this.closeTrade(trade.tradeId, trade.entryPrice * (1 + (Math.random() * 0.2 - 0.05)));
      }
    }
  }

  reset(): void { this.trades = []; }
}

export const templateTradeTracker = new TemplateTradeTracker();
