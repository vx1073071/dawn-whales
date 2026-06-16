/**
 * R240 JVS#1: PositionRiskScanner — 持仓风险扫描引擎
 *
 * Scans breaking news against user holdings, assesses impact per position,
 * and generates actionable recommendations (reduce/hedge/hold/add).
 *
 * Architecture:
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │                 PositionRiskScanner                          │
 *   │  ┌────────────────────────────────────────────────────────┐  │
 *   │  │ Step 1: Breaking News Intake                            │  │
 *   │  │   └─ Source: R238 BreakingNewsDetector / R239 RSS feeds │  │
 *   │  └──────────┬─────────────────────────────────────────────┘  │
 *   │             │                                                 │
 *   │  ┌──────────┴─────────────────────────────────────────────┐  │
 *   │  │ Step 2: Entity Extraction (symbol/ticker/keywords)      │  │
 *   │  │   └─ Regex ticker matching + keyword → symbol mapping   │  │
 *   │  └──────────┬─────────────────────────────────────────────┘  │
 *   │             │                                                 │
 *   │  ┌──────────┴─────────────────────────────────────────────┐  │
 *   │  │ Step 3: Position Matching                               │  │
 *   │  │   └─ Cross-reference extracted entities with holdings   │  │
 *   │  └──────────┬─────────────────────────────────────────────┘  │
 *   │             │                                                 │
 *   │  ┌──────────┴─────────────────────────────────────────────┐  │
 *   │  │ Step 4: Impact Assessment                               │  │
 *   │  │   ├─ Severity: CRITICAL/HIGH/MEDIUM/LOW (news tone)     │  │
 *   │  │   ├─ Exposure: position size relative to portfolio      │  │
 *   │  │   ├─ Correlation: how directly affected (direct/indirect)│  │
 *   │  │   └─ Time horizon: immediate vs delayed impact          │  │
 *   │  └──────────┬─────────────────────────────────────────────┘  │
 *   │             │                                                 │
 *   │  ┌──────────┴─────────────────────────────────────────────┐  │
 *   │  │ Step 5: Recommendation                                  │  │
 *   │  │   ├─ REDUCE: severe negative impact, high exposure      │  │
 *   │  │   ├─ HEDGE: moderate negative, options/hedge available  │  │
 *   │  │   ├─ HOLD: minimal impact, wait for more info           │  │
 *   │  │   └─ ADD: positive catalyst, dip-buy opportunity        │  │
 *   │  └────────────────────────────────────────────────────────┘  │
 *   └──────────────────────────────────────────────────────────────┘
 *
 * Pricing: 1 USDT/scan (billed via server ai-billing)
 *
 * v2.7.0-NEWS | production-ready | P1 收费功能
 */

import log from 'electron-log';
import type { BreakingNews } from '../news/BreakingNewsDetector';

// ═════════════════════════════════════════════════════════════════════════════
// Types
// ═════════════════════════════════════════════════════════════════════════════

export type RiskSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type RiskAction = 'REDUCE' | 'HEDGE' | 'HOLD' | 'ADD' | 'WATCH';
export type ImpactDirection = 'NEGATIVE' | 'POSITIVE' | 'NEUTRAL' | 'MIXED';

export interface HoldingInfo {
  symbol: string;
  name: string;
  market: string;
  sector: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  portfolioWeight: number; // 0-1
  pnlPct: number;
  hedged: boolean;
}

export interface PortfolioSummary {
  totalValue: number;
  holdingCount: number;
  cashRatio: number;
  topSectorWeights: Record<string, number>;
}

export interface RiskAssessment {
  affectedSymbol: string;
  holdingName: string;
  newsTitle: string;
  newsGuid: string;
  severity: RiskSeverity;
  direction: ImpactDirection;
  impactScore: number; // 0-100
  exposurePct: number; // % of portfolio affected
  action: RiskAction;
  actionDetail: string;
  reason: string;
  urgencyMinutes: number; // recommended action window
  confidence: number; // 0-1
  suggestedStopLoss?: number;
  suggestedHedgeRatio?: number;
}

export interface ScanResult {
  scanId: string;
  scannedAt: number;
  newsCount: number;
  matchedCount: number;
  affectedHoldings: string[];
  assessments: RiskAssessment[];
  portfolioSummary: PortfolioSummary;
  criticalAlerts: RiskAssessment[];
  highAlerts: RiskAssessment[];
  overallRiskLevel: RiskSeverity;
  billingCost: number;
}

export interface ScanConfig {
  /** Minimum severity to trigger an alert */
  minAlertSeverity: RiskSeverity;
  /** Maximum portfolio exposure before CRITICAL flag */
  maxPortfolioExposurePct: number;
  /** Minimum confidence threshold for recommendations */
  minConfidenceForAction: number;
  /** Whether to auto-suggest stop-loss levels */
  suggestStopLoss: boolean;
  /** Markets to scan (empty = all) */
  markets: string[];
}

// ═════════════════════════════════════════════════════════════════════════════
// Default Config
// ═════════════════════════════════════════════════════════════════════════════

const DEFAULT_CONFIG: ScanConfig = {
  minAlertSeverity: 'LOW',
  maxPortfolioExposurePct: 30,
  minConfidenceForAction: 0.5,
  suggestStopLoss: true,
  markets: [],
};

// ═════════════════════════════════════════════════════════════════════════════
// Keyword → Symbol mapping (core entity extraction)
// ═════════════════════════════════════════════════════════════════════════════

const KEYWORD_SYMBOL_MAP: Record<string, string[]> = {
  // Tech
  apple: ['AAPL'], aapl: ['AAPL'], 'tim cook': ['AAPL'], iphone: ['AAPL'],
  microsoft: ['MSFT'], msft: ['MSFT'], azure: ['MSFT'], openai: ['MSFT'],
  google: ['GOOGL'], alphabet: ['GOOGL'], googl: ['GOOGL'], android: ['GOOGL'],
  amazon: ['AMZN'], amzn: ['AMZN'], aws: ['AMZN'],
  meta: ['META'], facebook: ['META'], instagram: ['META'], threads: ['META'],
  nvidia: ['NVDA'], nvda: ['NVDA'], 'jensen huang': ['NVDA'], gpu: ['NVDA'],
  tesla: ['TSLA'], tsla: ['TSLA'], 'elon musk': ['TSLA'], ev: ['TSLA'],
  netflix: ['NFLX'], nflx: ['NFLX'],
  // Finance
  jpmorgan: ['JPM'], jpm: ['JPM'], 'jamie dimon': ['JPM'],
  goldman: ['GS'], 'goldman sachs': ['GS'], gs: ['GS'],
  blackrock: ['BLK'], blk: ['BLK'],
  visa: ['V'], mastercard: ['MA'],
  // Healthcare
  pfizer: ['PFE'], moderna: ['MRNA'], jnj: ['JNJ'], 'johnson & johnson': ['JNJ'],
  // Energy
  exxon: ['XOM'], chevron: ['CVX'], shell: ['SHEL'], bp: ['BP'],
  // China
  alibaba: ['BABA'], baba: ['BABA'], 'jack ma': ['BABA'],
  tencent: ['0700.HK'], '0700': ['0700.HK'], wechat: ['0700.HK'],
  baidu: ['BIDU'], bidu: ['BIDU'],
  nio: ['NIO'], xpeng: ['XPEV'], li: ['LI'],
  // Crypto
  bitcoin: ['BTC-USD'], btc: ['BTC-USD'], ethereum: ['ETH-USD'], eth: ['ETH-USD'],
  solana: ['SOL-USD'], sol: ['SOL-USD'],
  binance: ['BNB-USD'], coinbase: ['COIN'],
  // Industrial/macro
  'federal reserve': ['SPY'], fed: ['SPY'], powell: ['SPY'],
  sec: ['SPY'], pboc: ['SPY'], ecb: ['SPY'],
  recession: ['SPY'], inflation: ['SPY'], 'interest rate': ['SPY'],
  oil: ['XOM', 'CVX'], 'crude oil': ['XOM', 'CVX'], opec: ['XOM', 'CVX'],
  semiconductor: ['NVDA', 'AMD', 'INTC', 'SMH'], chip: ['NVDA', 'AMD', 'INTC'],
  ai: ['NVDA', 'MSFT', 'GOOGL'], 'artificial intelligence': ['NVDA', 'MSFT'],
  cybersecurity: ['CRWD', 'PANW'], 'cyber attack': ['CRWD', 'PANW'],
};

const TICKER_REGEX = /\b([A-Z]{1,5}(?:\.[A-Z]{2})?)\b/g;

// ═════════════════════════════════════════════════════════════════════════════
// Severity keyword library
// ═════════════════════════════════════════════════════════════════════════════

const CRITICAL_KEYWORDS: RegExp[] = [
  /bankruptcy/i, /default/i, /fraud\s+(investigation|charges)/i,
  /sec\s+(lawsuit|investigation|charges?)/i, /delist/i,
  /accounting\s+(scandal|fraud|irregularity)/i, /cease\s+(operations|trading)/i,
  /national\s+security/i, /executive\s+order/i,
  /block\s+trading/i, /margin\s+call/i,
];

const HIGH_KEYWORDS: RegExp[] = [
  /profit\s+warning/i, /earnings?\s+miss/i, /downgrade/i,
  /lay[-\s]?off/i, /restructur/i, /divest/i,
  /antitrust/i, /monopoly/i, /price[-\s]?fixing/i,
  /data\s+breach/i, /hack/i, /ransomware/i,
  /activist\s+short/i, /short\s+seller\s+report/i,
  /sanction/i, /tariff/i, /trade\s+war/i,
];

const MEDIUM_KEYWORDS: RegExp[] = [
  /guidance\s+(cut|lowered|reduced)/i, /slowdown/i,
  /supply\s+chain\s+(disrupt|issue|shortage)/i,
  /regulatory\s+(fine|penalty|review)/i, /recall/i,
  /competition\s+(concern|pressure)/i, /market\s+share\s+(decline|losing|loss)/i,
  /cfo\s+(resign|depart|leave)/i, /ceo\s+(depart|leave)/i,
];

const POSITIVE_KEYWORDS: RegExp[] = [
  /earnings?\s+(beat|exceed|surpass)/i, /upgrade/i,
  /buyback/i, /dividend\s+(increase|raise)/i,
  /partnership/i, /breakthrough/i, /fda\s+approv/i,
  /record\s+(revenue|profit|sales)/i,
  /short\s+squeeze/i, /takeover/i, /acquisition/i, /merger/i,
];

// ═════════════════════════════════════════════════════════════════════════════
// PositionRiskScanner
// ═════════════════════════════════════════════════════════════════════════════

export class PositionRiskScanner {
  private config: ScanConfig;
  private scanHistory: ScanResult[] = [];
  private billingEnabled = true;

  constructor(config: Partial<ScanConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ── Main Entry ────────────────────────────────────────────────────────────

  /**
   * Scan breaking news against user holdings.
   * Returns risk assessments sorted by severity.
   *
   * @param newsItems - Breaking news items from R238/R239 pipeline
   * @param holdings - User's current positions
   * @param portfolioSummary - Aggregated portfolio metrics
   */
  scan(
    newsItems: BreakingNews[],
    holdings: HoldingInfo[],
    portfolioSummary: PortfolioSummary,
  ): ScanResult {
    const scanId = `scan-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const scannedAt = Date.now();

    if (newsItems.length === 0 || holdings.length === 0) {
      return {
        scanId, scannedAt, newsCount: 0, matchedCount: 0,
        affectedHoldings: [], assessments: [],
        portfolioSummary, criticalAlerts: [], highAlerts: [],
        overallRiskLevel: 'LOW', billingCost: 0,
      };
    }

    const assessments: RiskAssessment[] = [];

    // Step 1-2: Extract entities from each news item
    for (const news of newsItems) {
      const entities = this.extractEntities(news);

      // Step 3: Match entities against holdings
      for (const holding of holdings) {
        if (!this.matchesHolding(entities, holding)) continue;

        // Step 4: Impact assessment
        const assessment = this.assessImpact(news, holding);
        assessments.push(assessment);
      }
    }

    // Deduplicate: keep highest severity per symbol+news pair
    const deduped = this.deduplicate(assessments);

    // Step 5: Generate recommendations
    const withActions = deduped.map(a => this.generateAction(a, holdings));

    // Sort by severity descending
    withActions.sort((a, b) => this.severityScore(b) - this.severityScore(a));

    // Classify alerts
    const criticalAlerts = withActions.filter(a => a.severity === 'CRITICAL');
    const highAlerts = withActions.filter(a => a.severity === 'HIGH');

    // Overall risk level
    const overallRiskLevel = this.calculateOverallRisk(withActions, criticalAlerts, portfolioSummary);

    const affectedSymbols = [...new Set(withActions.map(a => a.affectedSymbol))];

    const result: ScanResult = {
      scanId, scannedAt,
      newsCount: newsItems.length,
      matchedCount: withActions.length,
      affectedHoldings: affectedSymbols,
      assessments: withActions,
      portfolioSummary,
      criticalAlerts,
      highAlerts,
      overallRiskLevel,
      billingCost: this.billingEnabled && withActions.length > 0 ? 1 : 0,
    };

    this.scanHistory.push(result);
    if (this.scanHistory.length > 50) this.scanHistory.shift();

    log.info(`[RISK-SCAN] ${scanId}: ${newsItems.length} news → ${withActions.length} matches (${criticalAlerts.length} CRIT, ${highAlerts.length} HIGH) → ${overallRiskLevel}`);

    return result;
  }

  // ── Entity Extraction ────────────────────────────────────────────────────

  private extractEntities(news: BreakingNews): { symbols: string[]; keywords: string[] } {
    const text = `${news.title} ${news.description || ''}`.toLowerCase();
    const symbols = new Set<string>();
    const keywords = new Set<string>();

    // 1. Direct ticker extraction
    const tickerMatches = (news.title + ' ' + (news.description || '')).match(TICKER_REGEX);
    if (tickerMatches) {
      for (const t of tickerMatches) {
        // Filter out noise: short all-caps words that are just common words
        if (t.length >= 2 && !this.isNoiseTicker(t)) {
          symbols.add(t);
        }
      }
    }

    // 2. Keyword → symbol mapping
    for (const [keyword, mappedSymbols] of Object.entries(KEYWORD_SYMBOL_MAP)) {
      if (text.includes(keyword.toLowerCase())) {
        keywords.add(keyword);
        for (const sym of mappedSymbols) symbols.add(sym);
      }
    }

    // 3. Market/sector extraction from news tags
    const marketPrefixes: Record<string, string> = {
      HK: '.HK', us: '', US: '', uk: '.L', UK: '.L', jp: '.T', JP: '.T',
      kr: '.KS', KR: '.KS', eu: '.EU', EU: '.EU',
    };

    if (news.tags) {
      for (const tag of news.tags) {
        const lowerTag = tag.toLowerCase();
        const prefix = marketPrefixes[lowerTag] ?? '';
        if (prefix) {
          // If we have a symbol without a suffix from this market, add suffix
          const marketSymbols = [...symbols].filter(s => !s.includes('.'));
          for (const s of marketSymbols) {
            symbols.delete(s);
            symbols.add(s + prefix);
          }
        }
      }
    }

    return { symbols: [...symbols], keywords: [...keywords] };
  }

  private isNoiseTicker(t: string): boolean {
    const noise = new Set([
      'A', 'I', 'ME', 'BE', 'NO', 'GO', 'IT', 'AT', 'ON', 'IN', 'BY',
      'CEO', 'CFO', 'IPO', 'ETF', 'API', 'GDP', 'CPI', 'PMI', 'FED',
      'SEC', 'PBOC', 'ECB', 'FOMC', 'ESG', 'R&D', 'B2B', 'SAAS', 'M&A',
      'THE', 'AND', 'FOR', 'BUT', 'ALL', 'NEW', 'NOW', 'TOP', 'LOW',
    ]);
    return noise.has(t);
  }

  // ── Position Matching ─────────────────────────────────────────────────────

  private matchesHolding(entities: { symbols: string[]; keywords: string[] }, holding: HoldingInfo): boolean {
    // Direct symbol match
    for (const sym of entities.symbols) {
      const normalized = holding.symbol.toUpperCase().replace(/\s/g, '');
      const match = sym.toUpperCase().replace(/\s/g, '');
      if (normalized === match || normalized.startsWith(match) || match.startsWith(normalized)) {
        return true;
      }
    }

    // Sector match for broad news (FED, recession, oil, etc.)
    for (const kw of entities.keywords) {
      const broadKeywords = ['federal reserve', 'fed', 'recession', 'inflation', 'interest rate', 'oil', 'crude oil', 'opec', 'sec', 'pboc', 'ecb'];
      if (broadKeywords.includes(kw.toLowerCase())) {
        // Broad macro news affects major holdings (>5% portfolio weight)
        if (holding.portfolioWeight > 0.05) return true;
        // Or specific sector exposure for sector-level news
        if (kw === 'oil' || kw === 'crude oil' || kw === 'opec') {
          if (['Energy', '能源'].some(s => holding.sector.includes(s))) return true;
        }
      }
    }

    // Keyword in holding name
    const holdingLower = holding.name.toLowerCase();
    for (const kw of entities.keywords) {
      if (holdingLower.includes(kw.toLowerCase())) return true;
    }

    return false;
  }

  // ── Impact Assessment ─────────────────────────────────────────────────────

  private assessImpact(news: BreakingNews, holding: HoldingInfo): RiskAssessment {
    const severity = this.determineSeverity(news);
    const direction = this.determineDirection(news);
    const exposurePct = (holding.portfolioWeight * 100);

    // Impact score: severity weight × exposure weight × correlation
    let impactScore = 0;
    const severityWeights: Record<RiskSeverity, number> = { CRITICAL: 100, HIGH: 70, MEDIUM: 40, LOW: 20 };
    impactScore = severityWeights[severity] * 0.5; // severity 50%

    // Exposure weight 30%
    impactScore += Math.min(50, exposurePct) * 0.6;

    // Direction 20%
    if (direction === 'NEGATIVE') impactScore += 20;
    else if (direction === 'POSITIVE') impactScore -= 5;

    impactScore = Math.min(100, Math.max(0, impactScore));

    // Confidence based on entity matching certainty
    const directEntities = this.countDirectMatches(news, holding);
    const confidence = directEntities > 1 ? 0.9 : directEntities > 0 ? 0.7 : 0.4;

    // Urgency
    const urgencyMinutes = severity === 'CRITICAL' ? 5 : severity === 'HIGH' ? 30 : severity === 'MEDIUM' ? 120 : 480;

    return {
      affectedSymbol: holding.symbol,
      holdingName: holding.name,
      newsTitle: news.title,
      newsGuid: news.guid || `news-${Date.now()}`,
      severity,
      direction,
      impactScore: Math.round(impactScore),
      exposurePct: Math.round(exposurePct * 100) / 100,
      action: 'WATCH', // Will be refined in generateAction
      actionDetail: '',
      reason: '',
      urgencyMinutes,
      confidence,
    };
  }

  private determineSeverity(news: BreakingNews): RiskSeverity {
    // Check breaking news severity from detector first
    if (news.severity === 'P0') return 'CRITICAL';
    if (news.severity === 'P1') return 'HIGH';

    const text = `${news.title} ${news.description || ''}`;

    // Keyword-based severity classification
    for (const regex of CRITICAL_KEYWORDS) {
      if (regex.test(text)) return 'CRITICAL';
    }
    for (const regex of HIGH_KEYWORDS) {
      if (regex.test(text)) return 'HIGH';
    }
    for (const regex of MEDIUM_KEYWORDS) {
      if (regex.test(text)) return 'MEDIUM';
    }
    return 'LOW';
  }

  private determineDirection(news: BreakingNews): ImpactDirection {
    const text = `${news.title} ${news.description || ''}`;

    let positiveHits = 0;
    let negativeHits = 0;

    for (const kw of POSITIVE_KEYWORDS) {
      if (kw.test(text)) positiveHits++;
    }
    for (const kw of [...CRITICAL_KEYWORDS, ...HIGH_KEYWORDS, ...MEDIUM_KEYWORDS]) {
      if (kw.test(text)) negativeHits++;
    }

    if (positiveHits > negativeHits && negativeHits === 0) return 'POSITIVE';
    if (negativeHits > positiveHits && positiveHits === 0) return 'NEGATIVE';
    if (positiveHits > 0 && negativeHits > 0) return 'MIXED';
    return 'NEUTRAL';
  }

  private countDirectMatches(news: BreakingNews, holding: HoldingInfo): number {
    const text = `${news.title} ${news.description || ''}`.toLowerCase();
    let count = 0;
    if (text.includes(holding.symbol.toLowerCase())) count++;
    if (text.includes(holding.name.toLowerCase())) count++;
    return count;
  }

  // ── Action Generation ────────────────────────────────────────────────────

  private generateAction(assessment: RiskAssessment, allHoldings: HoldingInfo[]): RiskAssessment {
    const holding = allHoldings.find(h => h.symbol === assessment.affectedSymbol);
    if (!holding) return { ...assessment, action: 'WATCH', actionDetail: 'Monitor for updates', reason: 'Holding not found in portfolio' };

    let action: RiskAction = 'WATCH';
    let detail = '';
    let reason = '';
    let stopLoss: number | undefined;
    let hedgeRatio: number | undefined;

    const { severity, direction, impactScore, exposurePct, confidence } = assessment;

    if (confidence < this.config.minConfidenceForAction) {
      return {
        ...assessment,
        action: 'WATCH',
        actionDetail: '低置信度，继续观察',
        reason: `置信度 ${(confidence * 100).toFixed(0)}% 低于阈值 ${(this.config.minConfidenceForAction * 100).toFixed(0)}%`,
      };
    }

    if (direction === 'POSITIVE') {
      if (severity === 'CRITICAL' || severity === 'HIGH') {
        action = 'ADD';
        detail = '重大利好，建议增持';
        reason = `${severity}正面事件，影响力${impactScore}，方向利好`;
      } else {
        action = 'HOLD';
        detail = '利好但不急于操作，观察持续确认';
        reason = '正面事件，confirm后续走势后再决定';
      }
    } else if (direction === 'NEGATIVE') {
      if (severity === 'CRITICAL') {
        action = 'REDUCE';
        const reducePct = Math.min(80, impactScore);
        detail = `建议减仓 ${reducePct}% 或立即止损`;
        reason = `致命负面事件，影响力${impactScore}，暴露${exposurePct}%`;
        stopLoss = holding.currentPrice * (1 - reducePct / 100);
      } else if (severity === 'HIGH') {
        if (exposurePct > 10) {
          action = 'REDUCE';
          const reducePct = Math.max(30, Math.min(50, impactScore));
          detail = `建议减仓 ${reducePct}%`;
          reason = `高影响负面，暴露${exposurePct}%超过安全线`;
          stopLoss = holding.currentPrice * (1 - reducePct / 100);
        } else if (holding.hedged) {
          action = 'HOLD';
          detail = '已有对冲持仓保护';
          reason = '高风险但有对冲，继续观察';
        } else {
          action = 'HEDGE';
          hedgeRatio = Math.max(0.3, Math.min(0.8, impactScore / 100));
          detail = `建议对冲 ${(hedgeRatio * 100).toFixed(0)}% 仓位`;
          reason = `高风险但暴露仅${exposurePct}%，对冲优先`;
        }
      } else if (severity === 'MEDIUM') {
        if (holding.pnlPct > 20) {
          action = 'REDUCE';
          detail = '已有浮盈，减仓锁定利润';
          reason = `中等风险 + ${holding.pnlPct.toFixed(1)}% 浮盈，建议部分止盈`;
        } else {
          action = 'HEDGE';
          detail = '设置止损或买入PUT对冲';
          reason = `中等负面事件，建议保护性风险管理`;
          stopLoss = holding.currentPrice * 0.93;
        }
      } else {
        action = 'WATCH';
        detail = '低影响，添加监控标签';
        reason = '低风险事件，日常监控即可';
      }
    } else if (direction === 'MIXED') {
      action = 'WATCH';
      detail = '信号混杂，不建议操作';
      reason = '正面和负面因素同时存在，等待趋势明朗';
    } else {
      action = 'WATCH';
      detail = '无明确方向，持续观察';
      reason = '中性事件，不影响当前持仓策略';
    }

    if (this.config.suggestStopLoss && !stopLoss && (action === 'REDUCE' || action === 'HEDGE')) {
      stopLoss = holding.currentPrice * 0.95;
    }

    return {
      ...assessment,
      action,
      actionDetail: detail,
      reason,
      suggestedStopLoss: stopLoss ? Math.round(stopLoss * 100) / 100 : undefined,
      suggestedHedgeRatio: hedgeRatio ? Math.round(hedgeRatio * 100) / 100 : undefined,
    };
  }

  // ── Utilities ────────────────────────────────────────────────────────────

  private severityScore(a: RiskAssessment): number {
    const scores: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    return (scores[a.severity] || 0) * 100 + a.impactScore;
  }

  private deduplicate(assessments: RiskAssessment[]): RiskAssessment[] {
    const seen = new Map<string, RiskAssessment>();
    for (const a of assessments) {
      const key = `${a.newsGuid}:${a.affectedSymbol}`;
      const existing = seen.get(key);
      if (!existing || this.severityScore(a) > this.severityScore(existing)) {
        seen.set(key, a);
      }
    }
    return [...seen.values()];
  }

  private calculateOverallRisk(
    assessments: RiskAssessment[],
    criticalAlerts: RiskAssessment[],
    portfolio: PortfolioSummary,
  ): RiskSeverity {
    if (criticalAlerts.length > 0) return 'CRITICAL';

    const highCount = assessments.filter(a => a.severity === 'HIGH').length;
    const totalExposure = assessments.reduce((s, a) => s + a.exposurePct, 0);

    if (highCount >= 2 || totalExposure > this.config.maxPortfolioExposurePct) return 'HIGH';
    if (highCount >= 1 || assessments.filter(a => a.severity === 'MEDIUM').length >= 3) return 'MEDIUM';

    return 'LOW';
  }

  // ── Queries ──────────────────────────────────────────────────────────────

  getScanHistory(limit = 10): ScanResult[] {
    return this.scanHistory.slice(-limit);
  }

  getLatestScan(): ScanResult | null {
    return this.scanHistory.length > 0 ? this.scanHistory[this.scanHistory.length - 1] : null;
  }

  getConfig(): ScanConfig {
    return { ...this.config };
  }

  updateConfig(partial: Partial<ScanConfig>): void {
    this.config = { ...this.config, ...partial };
  }

  setBillingEnabled(enabled: boolean): void {
    this.billingEnabled = enabled;
  }

  reset(): void {
    this.scanHistory = [];
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Singleton
// ═════════════════════════════════════════════════════════════════════════════

let defaultScanner: PositionRiskScanner | null = null;

export function getPositionRiskScanner(): PositionRiskScanner {
  if (!defaultScanner) defaultScanner = new PositionRiskScanner();
  return defaultScanner;
}

export function resetPositionRiskScanner(): void {
  defaultScanner = null;
}
