/**
 * CrashAlertEngine — R258 QUANT MOO P1-05
 *
 * 崩盘预警推送引擎。多维度检测系统性风险，在崩盘前/中/后
 * 生成分级预警并推送给全用户。
 *
 * Feature set:
 *   - 5 级崩盘预警: GREEN(安全) → YELLOW(关注) → ORANGE(警告) → RED(危险) → BLACK(崩盘中)
 *   - 多维度检测: 大盘跌幅/波动率/广度/流动性/VIX/相关性
 *   - 全用户广播推送
 *   - 崩盘后恢复检测
 *   - 安抚文案生成
 *   - 历史警报回溯
 *
 * Architecture:
 *   - Singleton with reset()
 *   - Multi-indicator composite scoring
 *   - Cumulative alert state machine
 *
 * @author JVS
 * @round R258
 * @since 2026-06-17
 */

import { EventEmitter } from 'events';

// ─── Types ───────────────────────────────────────────────

export type CrashAlertLevel = 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED' | 'BLACK';

export interface CrashIndicator {
  name: string;
  value: number;
  threshold: number;
  weight: number;
  triggered: boolean;
  detail: string;
}

export interface CrashAssessment {
  id: string;
  level: CrashAlertLevel;
  score: number;             // 0-100, higher = more crash-like
  indicators: CrashIndicator[];
  marketSnapshot: MarketCrashSnapshot;
  message: string;           // 用户推送消息
  soothingMessage: string;   // 安抚文案
  timestamp: number;
  isRecovery: boolean;
}

export interface MarketCrashSnapshot {
  indexChangePct: number;
  indexChange5d: number;
  breadthPct: number;        // % stocks above MA50
  vixLevel: number;
  volumeRatio: number;       // vs 20d avg
  declinersRatio: number;    // 下跌/上涨
  newLowsCount: number;
  sectorDeclineCount: number;
  crossAssetCorrelation: number; // 跨资产相关性 (crash时趋同)
}

export interface CrashAlertRequest {
  indexName: string;
  indexChangePct: number;
  indexChange5d: number;
  breadthPct: number;
  vixLevel: number;
  volume: number;
  avgVolume20d: number;
  declinersCount: number;
  advancersCount: number;
  newLowsCount: number;
  sectorChanges: Array<{ sector: string; changePct: number }>;
}

export interface CrashAlertConfig {
  weights: Partial<Record<string, number>>;
  broadcastToAll: boolean;
  cooldownMinutes: number;
}

// ─── Level Thresholds ────────────────────────────────────

const LEVELS: Array<{ level: CrashAlertLevel; minScore: number; label: string; color: string }> = [
  { level: 'BLACK', minScore: 80, label: '崩盘中', color: '#000000' },
  { level: 'RED', minScore: 60, label: '危险', color: '#FF0000' },
  { level: 'ORANGE', minScore: 40, label: '警告', color: '#FFA500' },
  { level: 'YELLOW', minScore: 20, label: '关注', color: '#FFD700' },
  { level: 'GREEN', minScore: 0, label: '安全', color: '#00CC00' },
];

const LEVEL_MESSAGES: Record<CrashAlertLevel, string> = {
  BLACK: '⚠️ 市场崩盘预警：多指标触发极端风险，建议立即评估持仓风险',
  RED: '🔴 市场极度危险：大幅下跌+波动率飙升，注意风险控制',
  ORANGE: '🟠 市场风险上升：跌幅扩大+广度恶化，建议减仓或对冲',
  YELLOW: '🟡 市场异动监测：关注回调风险，设置止损',
  GREEN: '🟢 市场运行正常，无明显系统性风险',
};

const SOOTHING_MESSAGES: Record<CrashAlertLevel, string> = {
  BLACK: '历史数据显示，极端恐慌后通常有反弹。保持冷静，不要恐慌性抛售，等待企稳信号。',
  RED: '当前市场处于高波动阶段。回顾你的投资目标，避免情绪化交易，优质资产可等待回调后加仓。',
  ORANGE: '市场短期承压，但基本面尚未恶化。审视你的仓位，留有现金储备等待机会。',
  YELLOW: '市场出现调整迹象，正常回调是健康的。确认你的止损位，做好应对预案。',
  GREEN: '市场平稳运行，珍惜这段时光。持续关注你的长期投资计划。',
};

// ─── Indicator Weights ───────────────────────────────────

const DEFAULT_INDICATORS = [
  { name: 'index_decline', threshold: 3, weight: 0.20 },
  { name: '5d_decline', threshold: 5, weight: 0.15 },
  { name: 'breadth', threshold: 40, weight: 0.15 },
  { name: 'vix', threshold: 30, weight: 0.15 },
  { name: 'volume_surge', threshold: 2, weight: 0.10 },
  { name: 'decliners_ratio', threshold: 3, weight: 0.10 },
  { name: 'new_lows', threshold: 50, weight: 0.08 },
  { name: 'sector_decline', threshold: 3, weight: 0.07 },
];

// ─── Engine ──────────────────────────────────────────────

export class CrashAlertEngine extends EventEmitter {
  private static instance: CrashAlertEngine;

  private config: CrashAlertConfig;
  private currentLevel: CrashAlertLevel = 'GREEN';
  private assessments: CrashAssessment[] = [];
  private lastAlertTime = 0;
  private idCounter = 0;

  constructor(config?: Partial<CrashAlertConfig>) {
    super();
    this.config = {
      weights: { ...Object.fromEntries(DEFAULT_INDICATORS.map(d => [d.name, d.weight])), ...(config?.weights ?? {}) },
      broadcastToAll: true,
      cooldownMinutes: config?.cooldownMinutes ?? 15,
    };
  }

  static getInstance(config?: Partial<CrashAlertConfig>): CrashAlertEngine {
    if (!CrashAlertEngine.instance) {
      CrashAlertEngine.instance = new CrashAlertEngine(config);
    }
    return CrashAlertEngine.instance;
  }

  reset(): void {
    this.currentLevel = 'GREEN';
    this.assessments = [];
    this.lastAlertTime = 0;
    this.idCounter = 0;
    this.removeAllListeners();
  }

  // ─── Main Assessment ───────────────────────────────────

  assess(req: CrashAlertRequest): CrashAssessment {
    const indicators = this.buildIndicators(req);
    const score = this.computeCrashScore(indicators);
    const level = this.classifyLevel(score);
    const isRecovery = this.detectRecovery(req, level);

    const assessment: CrashAssessment = {
      id: `crash_${++this.idCounter}`,
      level,
      score,
      indicators,
      marketSnapshot: this.buildSnapshot(req),
      message: LEVEL_MESSAGES[level],
      soothingMessage: SOOTHING_MESSAGES[level],
      timestamp: Date.now(),
      isRecovery,
    };

    this.assessments.push(assessment);

    if (level !== this.currentLevel && this.shouldBroadcast()) {
      const prev = this.currentLevel;
      this.currentLevel = level;
      this.lastAlertTime = Date.now();
      this.emit('level_changed', { prev, current: level, assessment });
      this.emit('crash_alert', assessment);
    }

    return assessment;
  }

  // ─── Indicator Calculation ─────────────────────────────

  private buildIndicators(req: CrashAlertRequest): CrashIndicator[] {
    const volRatio = req.avgVolume20d > 0 ? req.volume / req.avgVolume20d : 1;
    const declinersRatio = req.advancersCount > 0 ? req.declinersCount / req.advancersCount : 10;
    const sectorDeclineCount = req.sectorChanges.filter(s => s.changePct < -2).length;

    return [
      {
        name: 'index_decline', value: Math.abs(req.indexChangePct),
        threshold: 3, weight: this.config.weights['index_decline'] ?? 0.2,
        triggered: Math.abs(req.indexChangePct) >= 3,
        detail: `指数跌幅 ${req.indexChangePct.toFixed(1)}%`,
      },
      {
        name: '5d_decline', value: Math.abs(req.indexChange5d),
        threshold: 5, weight: this.config.weights['5d_decline'] ?? 0.15,
        triggered: Math.abs(req.indexChange5d) >= 5,
        detail: `5日跌幅 ${req.indexChange5d.toFixed(1)}%`,
      },
      {
        name: 'breadth', value: req.breadthPct,
        threshold: 40, weight: this.config.weights['breadth'] ?? 0.15,
        triggered: req.breadthPct <= 40,
        detail: `广度 ${req.breadthPct.toFixed(0)}% (MA50上方)`,
      },
      {
        name: 'vix', value: req.vixLevel,
        threshold: 30, weight: this.config.weights['vix'] ?? 0.15,
        triggered: req.vixLevel >= 30,
        detail: `VIX ${req.vixLevel.toFixed(1)}`,
      },
      {
        name: 'volume_surge', value: volRatio,
        threshold: 2, weight: this.config.weights['volume_surge'] ?? 0.1,
        triggered: volRatio >= 2,
        detail: `量比 ${volRatio.toFixed(1)}x`,
      },
      {
        name: 'decliners_ratio', value: declinersRatio,
        threshold: 3, weight: this.config.weights['decliners_ratio'] ?? 0.1,
        triggered: declinersRatio >= 3,
        detail: `涨跌比 1:${declinersRatio.toFixed(1)}`,
      },
      {
        name: 'new_lows', value: req.newLowsCount,
        threshold: 50, weight: this.config.weights['new_lows'] ?? 0.08,
        triggered: req.newLowsCount >= 50,
        detail: `新低数 ${req.newLowsCount}`,
      },
      {
        name: 'sector_decline', value: sectorDeclineCount,
        threshold: 3, weight: this.config.weights['sector_decline'] ?? 0.07,
        triggered: sectorDeclineCount >= 3,
        detail: `下跌板块 ${sectorDeclineCount}`,
      },
    ];
  }

  // ─── Scoring ───────────────────────────────────────────

  computeCrashScore(indicators: CrashIndicator[]): number {
    let score = 0;
    let totalWeight = 0;
    for (const ind of indicators) {
      if (ind.triggered) {
        const normalized = Math.min(1, ind.value / (ind.threshold * 2));
        score += normalized * ind.weight * 100;
      }
      totalWeight += ind.weight;
    }
    return Math.min(100, Math.round(totalWeight > 0 ? score / totalWeight : 0));
  }

  classifyLevel(score: number): CrashAlertLevel {
    for (const l of LEVELS) {
      if (score >= l.minScore) return l.level;
    }
    return 'GREEN';
  }

  // ─── Recovery Detection ────────────────────────────────

  private detectRecovery(req: CrashAlertRequest, newLevel: CrashAlertLevel): boolean {
    if (this.currentLevel === 'GREEN') return false;
    if (newLevel === 'GREEN' && this.currentLevel !== 'GREEN') return true;
    if (newLevel === 'YELLOW' && (this.currentLevel === 'RED' || this.currentLevel === 'BLACK')) return true;
    return false;
  }

  // ─── Broadcast Logic ───────────────────────────────────

  private shouldBroadcast(): boolean {
    const cooldown = (this.config.cooldownMinutes ?? 15) * 60 * 1000;
    return Date.now() - this.lastAlertTime >= cooldown;
  }

  // ─── Snapshot ──────────────────────────────────────────

  private buildSnapshot(req: CrashAlertRequest): MarketCrashSnapshot {
    const volRatio = req.avgVolume20d > 0 ? req.volume / req.avgVolume20d : 1;
    const declinersRatio = req.advancersCount > 0 ? req.declinersCount / req.advancersCount : 0;
    const sectorDecline = req.sectorChanges.filter(s => s.changePct < -2).length;

    return {
      indexChangePct: req.indexChangePct,
      indexChange5d: req.indexChange5d,
      breadthPct: req.breadthPct,
      vixLevel: req.vixLevel,
      volumeRatio: volRatio,
      declinersRatio,
      newLowsCount: req.newLowsCount,
      sectorDeclineCount: sectorDecline,
      crossAssetCorrelation: 0.7, // mock - would use real correlation data
    };
  }

  // ─── Queries ───────────────────────────────────────────

  getCurrentLevel(): CrashAlertLevel { return this.currentLevel; }

  getHistory(limit = 20): CrashAssessment[] {
    return this.assessments.slice(-limit);
  }

  getLatestAssessment(): CrashAssessment | undefined {
    return this.assessments.length > 0 ? this.assessments[this.assessments.length - 1] : undefined;
  }

  getRecoveryEvents(): CrashAssessment[] {
    return this.assessments.filter(a => a.isRecovery);
  }

  // ─── Mock ──────────────────────────────────────────────

  createMockNormalRequest(): CrashAlertRequest {
    return {
      indexName: 'S&P 500',
      indexChangePct: -0.5,
      indexChange5d: -1.2,
      breadthPct: 55,
      vixLevel: 18,
      volume: 2500000000,
      avgVolume20d: 2400000000,
      declinersCount: 250,
      advancersCount: 230,
      newLowsCount: 15,
      sectorChanges: [
        { sector: 'Tech', changePct: -0.3 },
        { sector: 'Finance', changePct: -0.1 },
        { sector: 'Energy', changePct: 0.5 },
        { sector: 'Healthcare', changePct: -0.2 },
        { sector: 'Consumer', changePct: 0.1 },
      ],
    };
  }

  createMockCrashRequest(): CrashAlertRequest {
    return {
      indexName: 'NASDAQ',
      indexChangePct: -8.5,
      indexChange5d: -14.2,
      breadthPct: 12,
      vixLevel: 55,
      volume: 8500000000,
      avgVolume20d: 3200000000,
      declinersCount: 480,
      advancersCount: 20,
      newLowsCount: 320,
      sectorChanges: [
        { sector: 'Tech', changePct: -10.5 },
        { sector: 'Finance', changePct: -6.2 },
        { sector: 'Energy', changePct: -5.8 },
        { sector: 'Healthcare', changePct: -3.1 },
        { sector: 'Consumer', changePct: -4.5 },
      ],
    };
  }

  createMockWarningRequest(): CrashAlertRequest {
    return {
      indexName: 'S&P 500',
      indexChangePct: -3.2,
      indexChange5d: -5.8,
      breadthPct: 35,
      vixLevel: 28,
      volume: 4500000000,
      avgVolume20d: 2400000000,
      declinersCount: 380,
      advancersCount: 120,
      newLowsCount: 60,
      sectorChanges: [
        { sector: 'Tech', changePct: -4.2 },
        { sector: 'Finance', changePct: -2.1 },
        { sector: 'Energy', changePct: -3.5 },
        { sector: 'Healthcare', changePct: -1.2 },
        { sector: 'Consumer', changePct: -1.8 },
      ],
    };
  }
}
