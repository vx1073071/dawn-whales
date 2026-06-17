/**
 * R258 P1-05: 崩盘→全用户推送 (CrashPushBridge)
 * 
 * 崩盘检测 → 全用户广播推送引擎
 * 
 * 功能:
 *   1. 多级崩盘判定 (指数崩盘/板块崩盘/个股闪崩/加密崩盘)
 *   2. 崩盘级别 → 推送策略映射
 *   3. 全用户广播 + 分级推送 (全员/持仓/关注)
 *   4. 崩盘恢复检测 (V型反转/二次探底)
 *   5. 崩盘历史记录与回放分析
 * 
 * 上游: move-attribution-engine.ts, price-move-push-engine.ts
 * 下游: push-ipc-bridge.ts (broadcast)
 */

import { createHash } from 'crypto';

// ── Types ──────────────────────────────────────────────────────────────────

export type CrashType = 'index' | 'sector' | 'single' | 'crypto' | 'flash_crash';

export type CrashSeverity = 
  | 'watch'       // 值得关注 (-3% to -5%)
  | 'warning'     // 警告 (-5% to -10%)
  | 'severe'      // 严重 (-10% to -20%)
  | 'critical'    // 危机 (-20% to -35%)
  | 'extreme';    // 极端 (< -35%)

export interface CrashSignal {
  signalId: string;
  type: CrashType;
  symbol: string;              // index/sector/single symbol
  name: string;
  nameCn: string;
  severity: CrashSeverity;
  changePercent: number;
  changeAmount: number;
  price: number;
  fromPeakPercent?: number;    // from recent high
  volumeRatio: number;         // vs 20-day avg
  breadth?: {                  // market breadth (for index crashes)
    advancing: number;
    declining: number;
    unchanged: number;
  };
  triggerTimestamp: number;
  detectedAt: number;
}

export interface CrashPushEvent {
  eventId: string;
  crash: CrashSignal;
  pushLevel: 'all_users' | 'holders' | 'watchers' | 'silent';
  title: string;
  body: string;
  bodyCn: string;
  urgency: 'emergency' | 'important' | 'advisory';
  recommendedActions: string[];
  recommendedActionsCn: string[];
  generatedAt: number;
  expiresAt: number;           // push auto-expires after this time
}

export interface CrashRule {
  severity: CrashSeverity;
  minChangePct: number;
  pushLevel: CrashPushEvent['pushLevel'];
  urgency: CrashPushEvent['urgency'];
  cooldownMinutes: number;     // min between same-type crashes
  expiresMinutes: number;      // push expiry
  soundAlert: boolean;
  trayFlash: boolean;
}

// ── Crash Detection Thresholds ──────────────────────────────────────────────

const CRASH_RULES: CrashRule[] = [
  {
    severity: 'watch',
    minChangePct: -3,
    pushLevel: 'silent',
    urgency: 'advisory',
    cooldownMinutes: 30,
    expiresMinutes: 60,
    soundAlert: false,
    trayFlash: false,
  },
  {
    severity: 'warning',
    minChangePct: -5,
    pushLevel: 'watchers',
    urgency: 'advisory',
    cooldownMinutes: 20,
    expiresMinutes: 45,
    soundAlert: false,
    trayFlash: true,
  },
  {
    severity: 'severe',
    minChangePct: -10,
    pushLevel: 'holders',
    urgency: 'important',
    cooldownMinutes: 10,
    expiresMinutes: 30,
    soundAlert: true,
    trayFlash: true,
  },
  {
    severity: 'critical',
    minChangePct: -20,
    pushLevel: 'all_users',
    urgency: 'important',
    cooldownMinutes: 5,
    expiresMinutes: 20,
    soundAlert: true,
    trayFlash: true,
  },
  {
    severity: 'extreme',
    minChangePct: -35,
    pushLevel: 'all_users',
    urgency: 'emergency',
    cooldownMinutes: 3,
    expiresMinutes: 15,
    soundAlert: true,
    trayFlash: true,
  },
];

// ── Recovery thresholds ───────────────────────────────────────────────────

const RECOVERY_THRESHOLD = 0.5; // 50% retracement from crash low

// ═══════════════════════════════════════════════════════════════════════════
// CrashPushBridge
// ═══════════════════════════════════════════════════════════════════════════

export class CrashPushBridge {
  private crashHistory: CrashSignal[] = [];
  private pushEvents: CrashPushEvent[] = [];
  private lastCrashTime: Map<string, number> = new Map(); // type → last crash
  private activeCrashes: Map<string, CrashSignal> = new Map(); // symbol → active crash
  private stats_ = { totalDetected: 0, totalPushed: 0, avgSeverity: '' as string };

  constructor() {}

  // ── Public API: Crash Detection ─────────────────────────────────────────

  /**
   * Detect a crash event from market data.
   * Returns a CrashSignal if thresholds are met, null otherwise.
   */
  detect(params: {
    type: CrashType;
    symbol: string;
    name: string;
    nameCn: string;
    changePercent: number;
    changeAmount: number;
    price: number;
    volumeRatio: number;
    fromPeakPercent?: number;
    breadth?: CrashSignal['breadth'];
    timestamp?: number;
  }): CrashSignal | null {
    const changePct = Math.abs(params.changePercent);
    if (params.changePercent >= 0) return null; // only crashes (negative moves)

    // Find matching rule — iterate from most severe to least
    const rule = [...CRASH_RULES].reverse().find(r => changePct >= Math.abs(r.minChangePct));
    if (!rule) return null;

    // Cooldown check
    const cooldownKey = `${params.type}:${rule.severity}`;
    const last = this.lastCrashTime.get(cooldownKey) ?? 0;
    if (Date.now() - last < rule.cooldownMinutes * 60_000) return null;

    this.lastCrashTime.set(cooldownKey, Date.now());

    const signal: CrashSignal = {
      signalId: `crash:${params.type}:${params.symbol}:${Date.now()}:${this._hash(params.symbol + params.changePercent).toString(36).slice(0, 6)}`,
      type: params.type,
      symbol: params.symbol,
      name: params.name,
      nameCn: params.nameCn,
      severity: rule.severity,
      changePercent: Math.round(params.changePercent * 100) / 100,
      changeAmount: Math.round(params.changeAmount * 100) / 100,
      price: params.price,
      fromPeakPercent: params.fromPeakPercent,
      volumeRatio: params.volumeRatio,
      breadth: params.breadth,
      triggerTimestamp: params.timestamp ?? Date.now(),
      detectedAt: Date.now(),
    };

    this.crashHistory.push(signal);
    this.activeCrashes.set(params.symbol, signal);
    this.stats_.totalDetected++;
    this.stats_.avgSeverity = this._mostCommonSeverity();

    return signal;
  }

  /**
   * Build a push event from a crash signal.
   */
  buildPush(crash: CrashSignal): CrashPushEvent {
    const rule = CRASH_RULES.find(r => r.severity === crash.severity)!;
    const { title, body, bodyCn, actions, actionsCn } = this._generatePushContent(crash);

    const event: CrashPushEvent = {
      eventId: `crpush:${crash.signalId}`,
      crash,
      pushLevel: rule.pushLevel,
      title,
      body,
      bodyCn,
      urgency: rule.urgency,
      recommendedActions: actions,
      recommendedActionsCn: actionsCn,
      generatedAt: Date.now(),
      expiresAt: Date.now() + rule.expiresMinutes * 60_000,
    };

    this.pushEvents.push(event);
    if (this.pushEvents.length > 500) this.pushEvents.shift();
    this.stats_.totalPushed++;

    return event;
  }

  /**
   * Full pipeline: detect → build push.
   */
  detectAndPush(params: Parameters<CrashPushBridge['detect']>[0]): CrashPushEvent | null {
    const crash = this.detect(params);
    if (!crash) return null;
    return this.buildPush(crash);
  }

  /**
   * Batch detect from multiple symbols (e.g. index breadth scan).
   */
  batchDetect(entries: Array<Parameters<CrashPushBridge['detect']>[0]>): CrashPushEvent[] {
    return entries
      .map(e => this.detectAndPush(e))
      .filter((e): e is CrashPushEvent => e !== null)
      .sort((a, b) => this._severityRank(b.crash.severity) - this._severityRank(a.crash.severity));
  }

  // ── Public API: Recovery Detection ──────────────────────────────────────

  /**
   * Check if a symbol has recovered from its crash.
   */
  checkRecovery(symbol: string, currentPrice: number): { recovered: boolean; retracePct: number } | null {
    const crash = this.activeCrashes.get(symbol);
    if (!crash) return null;

    const crashPrice = crash.price;
    const recoveryPrice = crashPrice + Math.abs(crash.changeAmount) * RECOVERY_THRESHOLD;
    const retracePct = ((currentPrice - crashPrice) / Math.abs(crash.changeAmount)) * 100;

    if (retracePct >= RECOVERY_THRESHOLD * 100) {
      this.activeCrashes.delete(symbol);
      return { recovered: true, retracePct: Math.round(retracePct * 100) / 100 };
    }

    return { recovered: false, retracePct: Math.round(retracePct * 100) / 100 };
  }

  // ── Public API: Query ───────────────────────────────────────────────────

  /** Get active crash signals */
  getActiveCrashes(): CrashSignal[] {
    return Array.from(this.activeCrashes.values());
  }

  /** Check if a symbol is in active crash */
  isInCrash(symbol: string): boolean {
    return this.activeCrashes.has(symbol);
  }

  /** Get crash history */
  getHistory(limit = 50, type?: CrashType): CrashSignal[] {
    let results = this.crashHistory;
    if (type) results = results.filter(c => c.type === type);
    return results.slice(-limit).reverse();
  }

  /** Get push events history */
  getPushHistory(limit = 50): CrashPushEvent[] {
    return this.pushEvents.slice(-limit).reverse();
  }

  /** Get active crash rule for a severity */
  getRule(severity: CrashSeverity): CrashRule | undefined {
    return CRASH_RULES.find(r => r.severity === severity);
  }

  /** Get all crash rules */
  getAllRules(): CrashRule[] {
    return [...CRASH_RULES];
  }

  /** Get stats */
  getStats() {
    return { ...this.stats_ };
  }

  /** Reset */
  reset(): void {
    this.crashHistory = [];
    this.pushEvents = [];
    this.lastCrashTime.clear();
    this.activeCrashes.clear();
    this.stats_ = { totalDetected: 0, totalPushed: 0, avgSeverity: '' };
  }

  // ── Private: Push Content Generation ────────────────────────────────────

  private _generatePushContent(crash: CrashSignal): {
    title: string;
    body: string;
    bodyCn: string;
    actions: string[];
    actionsCn: string[];
  } {
    const typeNames: Record<CrashType, string> = {
      index: '市场指数', single: '', sector: '板块', crypto: '加密', flash_crash: '闪崩',
    };
    const typeNamesEn: Record<CrashType, string> = {
      index: 'Market Index', single: '', sector: 'Sector', crypto: 'Crypto', flash_crash: 'FLASH CRASH',
    };
    const sevIcons: Record<CrashSeverity, string> = {
      watch: '👀', warning: '⚠️', severe: '🚨', critical: '🔴', extreme: '💀',
    };
    const sevNames: Record<CrashSeverity, string> = {
      watch: '关注', warning: '警告', severe: '严重', critical: '危机', extreme: '极端',
    };

    const icon = sevIcons[crash.severity];
    const changeStr = crash.changePercent.toFixed(1);

    const title = `${icon} ${crash.symbol} ${changeStr}% [${crash.severity.toUpperCase()}]`;
    const body = `${crash.name} dropped ${changeStr}%, now ${crash.price}. Vol ${crash.volumeRatio.toFixed(1)}x normal.${crash.fromPeakPercent ? ` ${crash.fromPeakPercent.toFixed(1)}% from peak.` : ''}`;
    const bodyCn = `${crash.nameCn}暴跌${changeStr}%, 现价${crash.price}。成交量${crash.volumeRatio.toFixed(1)}倍放量。${crash.fromPeakPercent ? `距高点已跌${crash.fromPeakPercent.toFixed(1)}%。` : ''}`;

    const actions = crash.severity === 'extreme' || crash.severity === 'critical'
      ? ['Check portfolio exposure', 'Review stop-losses', 'Monitor for further downside']
      : crash.severity === 'severe'
        ? ['Check holdings', 'Review risk limits']
        : ['Monitor closely'];

    const actionsCn = crash.severity === 'extreme' || crash.severity === 'critical'
      ? ['检查仓位敞口', '核查止损设置', '关注后续下跌风险']
      : crash.severity === 'severe'
        ? ['检查持仓', '复核风险限额']
        : ['密切关注'];

    return { title, body, bodyCn, actions, actionsCn };
  }

  // ── Private: Helpers ────────────────────────────────────────────────────

  private _severityRank(s: CrashSeverity): number {
    const ranks: Record<CrashSeverity, number> = { watch: 0, warning: 1, severe: 2, critical: 3, extreme: 4 };
    return ranks[s] ?? 0;
  }

  private _mostCommonSeverity(): string {
    if (this.crashHistory.length === 0) return '';
    const counts: Record<string, number> = {};
    for (const c of this.crashHistory) {
      counts[c.severity] = (counts[c.severity] ?? 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
  }

  private _hash(input: string): number {
    const h = createHash('sha256').update(input).digest('hex');
    return parseInt(h.slice(0, 8), 16);
  }
}

export const crashPushBridge = new CrashPushBridge();
