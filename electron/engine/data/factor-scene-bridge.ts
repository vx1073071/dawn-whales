/**
 * R247 P1-07: 因子一键场景包桥接 (FactorSceneBridge)
 * 
 * 5大投资场景 → 因子匹配 → 一键触发回测
 * 
 * Scenes:
 *   1. 🛡️ 防御保本 — 低波动+高质量+高股息
 *   2. 🚀 积极成长 — 高动量+高成长+AI驱动
 *   3. 💰 稳定收息 — 高股息+高FCF+低波动
 *   4. 🎲 投机博弈 — 高波动+短动量+高换手
 *   5. ⚖️ 均衡配置 — 多因子分散+低相关
 * 
 * Pipeline:
 *   User picks scene → auto-match factors → configure weights
 *     → trigger one-click backtest via OneClickDeployPipeline
 */

import { createHash } from 'crypto';

// ── Types ──────────────────────────────────────────────────────────────────

export interface FactorScene {
  sceneId: string;
  name: string;
  nameCn: string;
  emoji: string;
  description: string;
  descriptionCn: string;
  /** Who this scene is for */
  targetUser: string;
  targetUserCn: string;
  riskLevel: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
  expectedReturnRange: string;
  maxDrawdownRange: string;
  /** Factor bundles */
  factors: SceneFactorWithWeight[];
  /** Pre-configured backtest params */
  defaultParams: {
    timeframe: string;
    rebalanceFreq: string;
    maxPositions: number;
    stopLossPercent: number;
  };
}

export interface SceneFactorWithWeight {
  factorId: string;
  weight: number;          // 0-1, all weights sum to 1
  direction: 'long' | 'short';
  rationale: string;       // Why this factor for this scene
  rationaleCn: string;
}

export interface SceneMatchResult {
  scene: FactorScene;
  matchScore: number;      // 0-100, how well the user's preferences match this scene
  matchReasons: string[];
  matchReasonsCn: string[];
  /** Trigger-phrase for one-click deploy */
  deployTemplateId: string;
  estimatedBacktestTime: string;
}

export interface UserPreferences {
  riskTolerance: 'low' | 'medium' | 'high';
  investmentHorizon: 'short' | 'medium' | 'long'; // short < 3mo, medium 3-12mo, long > 1yr
  goal: 'growth' | 'income' | 'preservation' | 'speculation' | 'balanced';
  preferredMarkets: ('US' | 'HK' | 'A' | 'CRYPTO')[];
  maxDrawdownTolerance: number; // e.g. -10 means can tolerate -10%
}

export interface SceneBundle {
  sceneId: string;
  sceneName: string;
  sceneNameCn: string;
  emoji: string;
  factors: SceneFactorWithWeight[];
  /** Generated strategy name */
  strategyName: string;
  /** Ready-to-use backtest config */
  backtestConfig: {
    symbol: string;
    timeframe: string;
    capital: number;
    mode: 'dry-run';
  };
  /** Human explanation of what this bundle does */
  explanation: string;
  explanationCn: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// FactorSceneBridge
// ═══════════════════════════════════════════════════════════════════════════

export class FactorSceneBridge {
  private scenes: Map<string, FactorScene> = new Map();
  private bundles_: SceneBundle[] = [];

  constructor() {
    this._seedScenes();
  }

  // ── Public API: Scenes ──────────────────────────────────────────────────

  /** List all 5 investment scenes */
  listScenes(): FactorScene[] {
    return Array.from(this.scenes.values());
  }

  /** Get a specific scene */
  getScene(sceneId: string): FactorScene | null {
    return this.scenes.get(sceneId) ?? null;
  }

  // ── Public API: Scene Matching ──────────────────────────────────────────

  /**
   * Match user preferences to the best scene.
   * Returns ranked list — highest matchScore first.
   */
  matchScenes(prefs: UserPreferences): SceneMatchResult[] {
    const results: SceneMatchResult[] = [];

    for (const scene of this.scenes.values()) {
      let matchScore = 0;
      const reasons: string[] = [];
      const reasonsCn: string[] = [];

      // Risk tolerance match (max weight: 30)
      const riskMap: Record<string, string> = {
        'very_low': 'low', 'low': 'low', 'medium': 'medium',
        'high': 'high', 'very_high': 'high',
      };
      if (riskMap[scene.riskLevel] === prefs.riskTolerance) {
        matchScore += 30;
        reasons.push('Risk level matches your tolerance');
        reasonsCn.push('风险等级匹配你的承受力');
      } else if (
        (prefs.riskTolerance === 'high' && scene.riskLevel === 'medium') ||
        (prefs.riskTolerance === 'medium' && scene.riskLevel === 'low')
      ) {
        matchScore += 15;
        reasons.push('Risk level is within your comfort zone');
        reasonsCn.push('风险等级在你承受范围内');
      }

      // Goal match (max weight: 30)
      const goalMap: Record<string, string[]> = {
        growth: ['growth', 'balanced'],
        income: ['income', 'balanced'],
        preservation: ['preservation', 'income'],
        speculation: ['speculation'],
        balanced: ['balanced'],
      };

      const sceneGoal = scene.sceneId.split('-')[0]; // first word of sceneId

      if (
        (prefs.goal === 'growth' && scene.sceneId === 'growth-aggressive') ||
        (prefs.goal === 'income' && scene.sceneId === 'income-stable') ||
        (prefs.goal === 'preservation' && scene.sceneId === 'defensive-safe') ||
        (prefs.goal === 'speculation' && scene.sceneId === 'speculation-highrisk') ||
        (prefs.goal === 'balanced' && scene.sceneId === 'balanced-moderate')
      ) {
        matchScore += 30;
        reasons.push('Scene goal aligns with your investment goal');
        reasonsCn.push('场景目标与你的投资目标一致');
      }

      // Horizon match (max weight: 20)
      if (
        (prefs.investmentHorizon === 'long' && scene.sceneId === 'defensive-safe') ||
        (prefs.investmentHorizon === 'long' && scene.sceneId === 'income-stable') ||
        (prefs.investmentHorizon === 'short' && scene.sceneId === 'speculation-highrisk') ||
        (prefs.investmentHorizon === 'medium' && scene.sceneId === 'growth-aggressive')
      ) {
        matchScore += 20;
        reasons.push('Investment horizon matches scene design');
        reasonsCn.push('投资期限匹配场景设计');
      } else {
        matchScore += 5;
      }

      // Drawdown tolerance match (max weight: 20)
      const drawdownStr = scene.maxDrawdownRange;
      const ddMatch = drawdownStr.match(/-(\d+)%/);
      if (ddMatch) {
        const sceneMaxDD = parseInt(ddMatch[1]);
        if (Math.abs(prefs.maxDrawdownTolerance) >= sceneMaxDD) {
          matchScore += 20;
          reasons.push(`Drawdown limit (${sceneMaxDD}%) within your tolerance`);
          reasonsCn.push(`回撤限制(${sceneMaxDD}%)在你承受范围内`);
        } else {
          matchScore += 5;
        }
      }

      const normalizedScore = Math.min(100, matchScore);

      results.push({
        scene,
        matchScore: normalizedScore,
        matchReasons: reasons,
        matchReasonsCn: reasonsCn,
        deployTemplateId: `scene-${scene.sceneId}`,
        estimatedBacktestTime: normalizedScore > 60 ? '< 10 seconds' : '< 30 seconds',
      });
    }

    return results.sort((a, b) => b.matchScore - a.matchScore);
  }

  /**
   * Get the best scene for user preferences (single result).
   */
  getBestScene(prefs: UserPreferences): SceneMatchResult {
    const matches = this.matchScenes(prefs);
    return matches[0];
  }

  // ── Public API: Bundle Generation ───────────────────────────────────────

  /**
   * Generate a ready-to-deploy bundle from a scene.
   * Bundle = scene factors + default symbol + backtest config.
   */
  generateBundle(
    sceneId: string,
    options?: { symbol?: string; capital?: number },
  ): SceneBundle | null {
    const scene = this.scenes.get(sceneId);
    if (!scene) return null;

    const symbol = options?.symbol ?? this._getDefaultSymbol(scene.sceneId);
    const capital = options?.capital ?? 10000;

    const bundle: SceneBundle = {
      sceneId: scene.sceneId,
      sceneName: scene.name,
      sceneNameCn: scene.nameCn,
      emoji: scene.emoji,
      factors: scene.factors,
      strategyName: `[${scene.emoji}] ${scene.nameCn} (${symbol})`,
      backtestConfig: {
        symbol,
        timeframe: scene.defaultParams.timeframe,
        capital,
        mode: 'dry-run',
      },
      explanation: this._generateBundleExplanation(scene, symbol, capital),
      explanationCn: this._generateBundleExplanationCn(scene, symbol, capital),
    };

    this.bundles_.push(bundle);
    return bundle;
  }

  /** Get previously generated bundles */
  getBundleHistory(): SceneBundle[] {
    return this.bundles_;
  }

  // ── Public API: Quick Actions ───────────────────────────────────────────

  /**
   * Quick-start: pick a scene by name, get a deploy-ready bundle.
   * e.g. quickStart('defensive-safe', { symbol: 'SPY' })
   */
  quickStart(
    sceneId: string,
    options?: { symbol?: string; capital?: number },
  ): SceneBundle | null {
    return this.generateBundle(sceneId, options);
  }

  /** Get all factor IDs used across all scenes */
  getAllFactors(): string[] {
    const ids = new Set<string>();
    for (const scene of this.scenes.values()) {
      for (const f of scene.factors) {
        ids.add(f.factorId);
      }
    }
    return Array.from(ids);
  }

  /** Reset */
  reset(): void {
    this.scenes.clear();
    this.bundles_.length = 0;
    this._seedScenes();
  }

  // ── Private: Scene Definitions ──────────────────────────────────────────

  private _seedScenes(): void {
    const fixture: FactorScene[] = [
      {
        sceneId: 'defensive-safe',
        name: 'Capital Preservation',
        nameCn: '防御保本',
        emoji: '🛡️',
        description: 'Focus on low volatility, high quality, and steady dividends. Designed for capital preservation with minimal drawdowns.',
        descriptionCn: '聚焦低波动、高质量和高股息。为保本设计，追求最小回撤。',
        targetUser: 'Conservative investors, retirees, near-retirement portfolios',
        targetUserCn: '保守投资者、退休人士、临近退休组合',
        riskLevel: 'very_low',
        expectedReturnRange: '5-12% annual',
        maxDrawdownRange: '-5% to -10%',
        factors: [
          { factorId: 'VOL_HISTORICAL', weight: 0.30, direction: 'long', rationale: 'Low volatility reduces portfolio risk', rationaleCn: '低波动降低组合风险' },
          { factorId: 'VALUE_DIVIDEND_YIELD', weight: 0.25, direction: 'long', rationale: 'Steady dividend income', rationaleCn: '稳定股息收入' },
          { factorId: 'QUALITY_ROE', weight: 0.20, direction: 'long', rationale: 'High quality companies are resilient', rationaleCn: '高质量公司更抗跌' },
          { factorId: 'QUALITY_FCF_STABILITY', weight: 0.15, direction: 'long', rationale: 'Stable cash flow = reliable earnings', rationaleCn: '稳定现金流=可靠盈利' },
          { factorId: 'MACRO_INTEREST_RATE', weight: 0.10, direction: 'long', rationale: 'Rate sensitivity for defensive positioning', rationaleCn: '利率敏感度辅助防御配置' },
        ],
        defaultParams: {
          timeframe: '1d',
          rebalanceFreq: 'quarterly',
          maxPositions: 20,
          stopLossPercent: 3,
        },
      },
      {
        sceneId: 'growth-aggressive',
        name: 'Aggressive Growth',
        nameCn: '积极成长',
        emoji: '🚀',
        description: 'High momentum, high growth, AI-enhanced signals. For investors seeking above-market returns willing to accept higher volatility.',
        descriptionCn: '高动量、高成长、AI增强信号。适合追求超额回报且接受高波动的投资者。',
        targetUser: 'Growth-oriented investors, young professionals, high risk tolerance',
        targetUserCn: '成长型投资者、年轻职场人士、高风险承受力',
        riskLevel: 'high',
        expectedReturnRange: '15-35% annual',
        maxDrawdownRange: '-15% to -30%',
        factors: [
          { factorId: 'MOMENTUM_12M', weight: 0.25, direction: 'long', rationale: 'Long-term trend following', rationaleCn: '长期趋势跟踪' },
          { factorId: 'MOMENTUM_3M', weight: 0.25, direction: 'long', rationale: 'Medium-term momentum', rationaleCn: '中期动量' },
          { factorId: 'GROWTH_EPS_3Y', weight: 0.20, direction: 'long', rationale: 'Earnings growth trajectory', rationaleCn: '盈利增长轨迹' },
          { factorId: 'SENT_EARNINGS_SURPRISE', weight: 0.15, direction: 'long', rationale: 'Post-earnings drift capture', rationaleCn: '捕捉财报后漂移' },
          { factorId: 'MOMENTUM_1M', weight: 0.15, direction: 'long', rationale: 'Short-term trends for entry timing', rationaleCn: '短期趋势辅助入场' },
        ],
        defaultParams: {
          timeframe: '1d',
          rebalanceFreq: 'monthly',
          maxPositions: 12,
          stopLossPercent: 8,
        },
      },
      {
        sceneId: 'income-stable',
        name: 'Stable Income',
        nameCn: '稳定收息',
        emoji: '💰',
        description: 'High dividend + high FCF + low volatility. Designed for consistent cash flow with moderate growth.',
        descriptionCn: '高股息+高自由现金流+低波动。为稳定的现金流和适度增长设计。',
        targetUser: 'Income investors, dividend growth fans, semi-retired',
        targetUserCn: '收息投资者、股息增长爱好者、半退休人群',
        riskLevel: 'low',
        expectedReturnRange: '8-15% annual (including dividends)',
        maxDrawdownRange: '-8% to -15%',
        factors: [
          { factorId: 'VALUE_DIVIDEND_YIELD', weight: 0.30, direction: 'long', rationale: 'Primary income source', rationaleCn: '主要收入来源' },
          { factorId: 'VALUE_FCF_YIELD', weight: 0.25, direction: 'long', rationale: 'Free cash flow sustains dividends', rationaleCn: '自由现金流支撑股息' },
          { factorId: 'VOL_HISTORICAL', weight: 0.20, direction: 'long', rationale: 'Low vol for stable NAV', rationaleCn: '低波动稳定净值' },
          { factorId: 'QUALITY_ROE', weight: 0.15, direction: 'long', rationale: 'Quality ensures dividend safety', rationaleCn: '高质量保证股息安全' },
          { factorId: 'VALUE_EARNINGS_YIELD', weight: 0.10, direction: 'long', rationale: 'Value tilt for margin of safety', rationaleCn: '价值偏向提供安全边际' },
        ],
        defaultParams: {
          timeframe: '1d',
          rebalanceFreq: 'quarterly',
          maxPositions: 15,
          stopLossPercent: 5,
        },
      },
      {
        sceneId: 'speculation-highrisk',
        name: 'Speculation / High Risk',
        nameCn: '投机博弈',
        emoji: '🎲',
        description: 'High volatility, rapid momentum, crypto exposure. High risk, high potential reward. Not for the faint-hearted.',
        descriptionCn: '高波动+短动量+加密敞口。高风险高回报。心脏不好勿入。',
        targetUser: 'Speculators, high-risk traders, crypto enthusiasts',
        targetUserCn: '投机者、高风险交易者、加密爱好者',
        riskLevel: 'very_high',
        expectedReturnRange: '-30% to +60% annual',
        maxDrawdownRange: '-25% to -50%',
        factors: [
          { factorId: 'MOMENTUM_1M', weight: 0.30, direction: 'long', rationale: 'Fast trend catching', rationaleCn: '快速趋势捕捉' },
          { factorId: 'SENT_EARNINGS_SURPRISE', weight: 0.20, direction: 'long', rationale: 'Event-driven alpha', rationaleCn: '事件驱动Alpha' },
          { factorId: 'CRYPTO_VOLUME', weight: 0.20, direction: 'long', rationale: 'Crypto on-chain signals', rationaleCn: '加密链上信号' },
          { factorId: 'TECH_RSI', weight: 0.15, direction: 'long', rationale: 'Mean-reversion entries', rationaleCn: '均值回归入场' },
          { factorId: 'VOL_HISTORICAL', weight: 0.15, direction: 'long', rationale: 'Volatility regime awareness', rationaleCn: '波动率环境意识' },
        ],
        defaultParams: {
          timeframe: '1h',
          rebalanceFreq: 'weekly',
          maxPositions: 8,
          stopLossPercent: 12,
        },
      },
      {
        sceneId: 'balanced-moderate',
        name: 'Balanced Portfolio',
        nameCn: '均衡配置',
        emoji: '⚖️',
        description: 'Multi-factor diversified portfolio with low factor correlation. Momentum + Value + Quality + Growth — all balanced.',
        descriptionCn: '多因子分散组合，低因子相关性。动量+价值+质量+成长—全面均衡。',
        targetUser: 'Most investors, balanced approach, moderate risk',
        targetUserCn: '大多数投资者、均衡策略、中等风险',
        riskLevel: 'medium',
        expectedReturnRange: '10-20% annual',
        maxDrawdownRange: '-10% to -20%',
        factors: [
          { factorId: 'MOMENTUM_12M', weight: 0.20, direction: 'long', rationale: 'Long-term trend exposure', rationaleCn: '长期趋势敞口' },
          { factorId: 'VALUE_EARNINGS_YIELD', weight: 0.20, direction: 'long', rationale: 'Value tilt for downside protection', rationaleCn: '价值偏向提供下行保护' },
          { factorId: 'QUALITY_ROE', weight: 0.20, direction: 'long', rationale: 'Quality core', rationaleCn: '质量核心' },
          { factorId: 'GROWTH_EPS_3Y', weight: 0.15, direction: 'long', rationale: 'Growth exposure', rationaleCn: '成长敞口' },
          { factorId: 'VOL_HISTORICAL', weight: 0.15, direction: 'long', rationale: 'Low volatility overlay', rationaleCn: '低波动覆盖层' },
          { factorId: 'MACRO_INTEREST_RATE', weight: 0.10, direction: 'long', rationale: 'Macro awareness', rationaleCn: '宏观意识' },
        ],
        defaultParams: {
          timeframe: '1d',
          rebalanceFreq: 'monthly',
          maxPositions: 15,
          stopLossPercent: 6,
        },
      },
    ];

    for (const s of fixture) {
      this.scenes.set(s.sceneId, s);
    }
  }

  private _getDefaultSymbol(sceneId: string): string {
    switch (sceneId) {
      case 'defensive-safe': return 'SPY';
      case 'growth-aggressive': return 'QQQ';
      case 'income-stable': return 'SCHD';
      case 'speculation-highrisk': return 'BTC';
      case 'balanced-moderate': return 'VTI';
      default: return 'SPY';
    }
  }

  private _generateBundleExplanation(scene: FactorScene, symbol: string, capital: number): string {
    const factorNames = scene.factors.map(f => f.factorId.replace(/_/g, ' ').toLowerCase()).join(', ');
    return `${scene.emoji} ${scene.name} bundle for ${symbol} with $${capital}. Uses ${scene.factors.length} factors: ${factorNames}. ${scene.description}. Expected returns: ${scene.expectedReturnRange}, max drawdown: ${scene.maxDrawdownRange}.`;
  }

  private _generateBundleExplanationCn(scene: FactorScene, symbol: string, capital: number): string {
    const factorNames = scene.factors.map(f => f.rationaleCn).join('、');
    return `${scene.emoji} ${scene.nameCn}配置包：${symbol} ${capital}美元。${scene.factors.length}个因子：${factorNames}。${scene.descriptionCn}。预期回报${scene.expectedReturnRange}，最大回撤${scene.maxDrawdownRange}。`;
  }
}

// ── Singleton ───────────────────────────────────────────────────────────────

let instance: FactorSceneBridge | null = null;

export function factorSceneBridge(): FactorSceneBridge {
  if (!instance) instance = new FactorSceneBridge();
  return instance;
}

export function resetFactorSceneBridge(): void { instance = null; }
