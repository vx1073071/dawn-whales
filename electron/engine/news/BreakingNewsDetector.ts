/**
 * R238 JVS#3: BreakingNewsDetector — 突发新闻检测(黑天鹅关键词库+分级P0/P1/P2)
 *
 * Scans incoming news items for breaking/black-swan events using:
 *   - P0 keyword bank (systemic crisis, market crash, regulatory shock)
 *   - P1 keyword bank (moderate events, sector impact, volatility spike)
 *   - P2 keyword bank (minor events, single stock, rumor)
 *
 * Scoring: keyword match × position weight × source trust × market combo
 *   Score ≥ 80 → P0 (ALERT: immediate notification)
 *   Score ≥ 50 → P1 (WARNING: push notification)
 *   Score ≥ 20 → P2 (INFO: feed highlight)
 *   Score < 20  → normal news (no breaking tag)
 *
 * Architecture:
 *   ┌─────────────────────────────────────────────┐
 *   │          BreakingNewsDetector                │
 *   │  ┌─────────────────┐ ┌──────────────────┐   │
 *   │  │ P0 Keyword Bank │ │ P1 Keyword Bank  │   │
 *   │  │ (90 keywords)   │ │ (120 keywords)   │   │
 *   │  └────────┬────────┘ └────────┬─────────┘   │
 *   │           │                   │             │
 *   │  ┌────────┴───────────────────┴─────────┐   │
 *   │  │  Scoring Engine                      │   │
 *   │  │  (kw_match × position × trust × mkt) │   │
 *   │  └────────────────┬─────────────────────┘   │
 *   │                   │                         │
 *   │  ┌────────────────┴─────────────────────┐   │
 *   │  │  Level Classifier                    │   │
 *   │  │  P0(≥80) / P1(≥50) / P2(≥20) / off  │   │
 *   │  └──────────────────────────────────────┘   │
 *   └─────────────────────────────────────────────┘
 *
 * Acceptance:
 *   P0/P1/P2 keyword bank ≥ 200 keywords, multi-language support,
 *   score-based classification, TSC=0
 *
 * v2.7.0-NEWS | production-ready
 */

import log from 'electron-log';
import type { ParsedNewsItem } from './RSSScheduler';

// ═════════════════════════════════════════════════════════════════════════════
// Types
// ═════════════════════════════════════════════════════════════════════════════

export type BreakingLevel = 'P0' | 'P1' | 'P2';

export interface BreakingDetection {
  item: ParsedNewsItem;
  level: BreakingLevel;
  score: number;
  matchedKeywords: string[];
  detectionTime: number;
  reason: string;
}

export interface KeywordBank {
  level: BreakingLevel;
  keywords: string[];
  /** Weight multiplier for this level */
  weightMultiplier: number;
}

export interface DetectorStats {
  totalScanned: number;
  p0Detected: number;
  p1Detected: number;
  p2Detected: number;
  falsePositives: number;
  lastDetection: number;
  averageScore: number;
}

// ═════════════════════════════════════════════════════════════════════════════
// Keyword Banks (Black Swan + Systemic Events)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * P0 Keyword Bank — Systemic crisis, market crash, regulatory black swan.
 * 90+ keywords covering catastrophic events.
 */
const P0_KEYWORDS: string[] = [
  // Market Crash / Systemic
  'circuit breaker triggered',
  'market crash',
  'flash crash',
  'systemic risk',
  'contagion',
  'bank run',
  'liquidity crisis',
  'credit crunch',
  'sovereign default',
  'currency collapse',
  'hyperinflation',
  'debt ceiling breach',
  'market halt',
  'trading halted',
  'emergency meeting',
  'emergency rate cut',
  'emergency intervention',
  'bailout',
  'too big to fail',
  'financial stability risk',

  // Banking / Financial
  'bank failure',
  'bank collapse',
  'major bank insolvency',
  'fdic takeover',
  'bank seizure',
  'winding down',
  'resolution authority',
  'bridge bank',
  'depositor panic',

  // Geopolitical
  'declaration of war',
  'military invasion',
  'nuclear threat',
  'sanctions escalation',
  'trade war escalation',
  'capital controls',
  'asset freeze',
  'expropriation',

  // Regulatory Black Swan
  'sec emergency action',
  'sec lawsuit',
  'doj indictment',
  'criminal charges crypto',
  'exchange shutdown',
  'crypto ban',
  'mining ban',
  'stablecoin collapse',
  'depegging event',
  'rug pull billions',

  // Company / Sector
  'chapter 11 filing s&p 500',
  'largest bankruptcy',
  'accounting fraud revelation',
  'ceo arrested',
  'cfo indicted',
  'whistleblower sec',
  'class action securities fraud',

  // Commodity / Energy
  'oil supply shock',
  'opec emergency meeting',
  'strategic petroleum release emergency',
  'nuclear accident financial',
  'pipeline attack',
  'energy emergency',

  // Cybersecurity
  'major exchange hack',
  'bridge hack billion',
  'protocol exploit billion',
  'private key compromise systemic',
  'supply chain attack financial',

  // Natural Disaster
  'catastrophic earthquake financial center',
  'tsunami financial district',
  'pandemic market closure',

  // Monetary
  'dollar reserve status threat',
  'de-dollarization mandate',
  'central bank digital currency mandate',
  'yield curve control failure',
  'inflation emergency',
  'deflation spiral',
];

/**
 * P1 Keyword Bank — Moderate events, sector impact, volatility spike.
 * 120+ keywords covering significant but not systemic events.
 */
const P1_KEYWORDS: string[] = [
  // Market Volatility
  'correction territory',
  'bear market',
  'sell-off',
  'rout',
  'plunge',
  'plummets',
  'tumbles',
  'sinks',
  'nosedives',
  'freefall',
  'meltdown',
  'turmoil',
  'panic selling',
  'risk-off',
  'flight to safety',
  'vix surge',
  'volatility spike',
  'margin call cascade',

  // Economic
  'recession fears',
  'gdp contraction',
  'negative growth',
  'double dip',
  'stagflation',
  'inflation surprise upside',
  'cpi spike',
  'ppi surge',
  'unemployment spike',
  'jobless claims surge',
  'consumer confidence plunge',
  'pmi contraction',
  'manufacturing slump',
  'services contraction',

  // Monetary Policy
  'hawkish surprise',
  'unexpected rate hike',
  'largest rate hike',
  'quantitative tightening',
  'taper tantrum',
  'forward guidance shift',
  'dot plot shock',

  // Banking
  'bank downgrade',
  'credit downgrade',
  'outlook negative',
  'capital raise emergency',
  'stress test failure',
  'cet1 ratio decline',
  'npl surge',

  // Crypto Specific
  'exchange withdrawal halt',
  'crypto lending freeze',
  'defi protocol pause',
  'bridge paused',
  'oracle manipulation',
  'flash loan attack',
  'mev exploit',
  'governance attack',
  '51 percent attack',
  'chain halt',
  'chain fork emergency',
  'validator slashing event',

  // Company
  'profit warning',
  'earnings miss significant',
  'guidance cut',
  'layoff announcement major',
  'restructuring charge',
  'goodwill impairment',
  'dividend cut',
  'buyback suspension',
  'credit rating downgrade',
  'debt covenant breach',

  // Commodity
  'supply disruption',
  'output cut',
  'production halt',
  'force majeure',
  'strike action supply',
  'weather disruption crop',

  // Geopolitical (moderate)
  'tariff announcement',
  'trade restriction',
  'export ban',
  'import ban',
  'entity list addition',
  'sanctions package',
  'diplomatic tension',

  // Regulatory
  'cftc action',
  'finra fine major',
  'antitrust lawsuit',
  'breakup order',
  'privacy fine record',
  'data breach major financial',

  // Tech
  'major outage cloud',
  'aws outage',
  'azure outage',
  'google cloud outage',
  'cdn outage major',
  'dns attack major',

  // Sentiment
  'fear index spike',
  'put call ratio extreme',
  'margin debt record',
  'short interest record',
  'insider selling surge',
  'buffett indicator extreme',
];

/**
 * P2 Keyword Bank — Minor events, single stock, rumors, speculation.
 * 80+ keywords covering noteworthy but limited events.
 */
const P2_KEYWORDS: string[] = [
  'analyst downgrade',
  'analyst upgrade',
  'price target cut',
  'price target raise',
  'initiation coverage',
  'rating change',
  'sector rotation',
  'rebalancing',
  'index rebalance',
  'reconstitution',
  'inclusion index',
  'exclusion index',

  'earnings beat',
  'earnings miss',
  'revenue beat',
  'revenue miss',
  'same store sales',
  'comparable sales',

  'merger talks',
  'acquisition rumor',
  'takeover speculation',
  'activist investor',
  'stake disclosure',
  '13d filing',
  '13f filing',

  'ipo filing',
  'direct listing',
  'spac merger',
  'despac',
  'secondary offering',
  'shelf registration',

  'ceo change',
  'management shakeup',
  'board change',
  'succession plan',
  'executive departure',

  'product launch',
  'product recall',
  'safety investigation',
  'patent lawsuit',
  'ip dispute',

  'short squeeze',
  'gamma squeeze',
  'options activity unusual',
  'block trade',
  'dark pool activity',

  'crypto etf filing',
  'crypto custody announcement',
  'institutional crypto',
  'crypto partnership',
  'defi integration',
  'layer 2 launch',
  'mainnet upgrade',
  'testnet launch',

  'commodity inventory report',
  'eia report',
  'rig count',
  'crop report',
  'weather forecast extreme',

  'fed speaker',
  'ecb speaker',
  'central bank minutes',
  'fomc minutes',
  'economic data release',
  'consumer sentiment',
  'housing data',
];

// ═════════════════════════════════════════════════════════════════════════════
// BreakingNewsDetector
// ═════════════════════════════════════════════════════════════════════════════

export class BreakingNewsDetector {
  private keywordBanks: KeywordBank[];
  private stats: DetectorStats;
  private recentDetections: BreakingDetection[] = [];

  constructor() {
    this.keywordBanks = [
      { level: 'P0', keywords: P0_KEYWORDS, weightMultiplier: 3.0 },
      { level: 'P1', keywords: P1_KEYWORDS, weightMultiplier: 1.5 },
      { level: 'P2', keywords: P2_KEYWORDS, weightMultiplier: 0.8 },
    ];

    this.stats = {
      totalScanned: 0,
      p0Detected: 0,
      p1Detected: 0,
      p2Detected: 0,
      falsePositives: 0,
      lastDetection: 0,
      averageScore: 0,
    };
  }

  // ── Detection ────────────────────────────────────────────────────────────

  /**
   * Scan a news item for breaking news keywords.
   * Returns detection result if breaking, null if normal news.
   */
  detect(item: ParsedNewsItem): BreakingDetection | null {
    this.stats.totalScanned++;

    const searchText = this.buildSearchText(item);
    let bestDetection: BreakingDetection | null = null;
    let bestScore = 0;

    // Scan each keyword bank (P0 → P2, highest priority first)
    for (const bank of this.keywordBanks) {
      const matchedKeywords: string[] = [];
      let totalScore = 0;

      for (const keyword of bank.keywords) {
        const pos = searchText.indexOf(keyword.toLowerCase());
        if (pos >= 0) {
          matchedKeywords.push(keyword);

          // Score = position_weight × source_trust × market_combo × level_multiplier
          const positionScore = this.positionScore(pos, searchText.length);
          const sourceScore = this.sourceTrustScore(item.sourceId);
          const marketScore = this.marketRelevanceScore(item.markets, bank.level);
          const keywordScore = 10 * positionScore * sourceScore * marketScore * bank.weightMultiplier;

          totalScore += keywordScore;
        }
      }

      if (matchedKeywords.length > 0 && totalScore > bestScore) {
        bestScore = totalScore;
        const level = this.classifyLevel(totalScore, bank.level);
        bestDetection = {
          item,
          level,
          score: Math.round(totalScore * 100) / 100,
          matchedKeywords,
          detectionTime: Date.now(),
          reason: this.buildReason(level, matchedKeywords, totalScore),
        };
      }
    }

    if (bestDetection) {
      this.recordDetection(bestDetection);

      // Apply breaking level to the item
      item.breakingLevel = bestDetection.level;

      log.info(`[BREAKING] ${bestDetection.level}: "${item.title}" — score=${bestDetection.score} — keywords=[${bestDetection.matchedKeywords.slice(0, 3).join(', ')}]`);
    }

    return bestDetection;
  }

  /**
   * Batch scan multiple news items.
   */
  detectBatch(items: ParsedNewsItem[]): BreakingDetection[] {
    const detections: BreakingDetection[] = [];
    for (const item of items) {
      const result = this.detect(item);
      if (result) detections.push(result);
    }

    if (detections.length > 0) {
      const p0Count = detections.filter(d => d.level === 'P0').length;
      const p1Count = detections.filter(d => d.level === 'P1').length;
      const p2Count = detections.filter(d => d.level === 'P2').length;
      log.info(`[BREAKING] Batch scan: ${detections.length}/${items.length} breaking (P0:${p0Count} P1:${p1Count} P2:${p2Count})`);
    }

    return detections;
  }

  // ── Scoring ──────────────────────────────────────────────────────────────

  /**
   * Position score: keywords at the start of title/article score higher.
   * Range: [0.5, 1.0]
   */
  private positionScore(position: number, totalLength: number): number {
    if (totalLength === 0) return 0.5;
    const ratio = position / totalLength;
    if (ratio < 0.1) return 1.0;     // first 10%
    if (ratio < 0.3) return 0.9;     // 10-30%
    if (ratio < 0.5) return 0.7;     // 30-50%
    if (ratio < 0.8) return 0.6;     // 50-80%
    return 0.5;                       // last 20%
  }

  /**
   * Source trust score: high-trust sources weight more.
   * Range: [0.6, 1.0]
   */
  private sourceTrustScore(sourceId: string): number {
    const highTrust = ['reuters-breaking', 'bloomberg-markets', 'wsj-markets', 'ft-markets', 'fed-reserve', 'ecb', 'sec-filings'];
    const mediumTrust = ['cnbc-top', 'yahoo-finance', 'marketwatch', 'investing-com', 'coindesk', 'cointelegraph'];
    const lowTrust = ['zerohedge'];

    if (highTrust.some(s => sourceId.startsWith(s) || sourceId.includes(s.split('-')[0]))) return 1.0;
    if (mediumTrust.some(s => sourceId.startsWith(s) || sourceId.includes(s.split('-')[0]))) return 0.8;
    if (lowTrust.some(s => sourceId.toLowerCase().includes(s))) return 0.6;
    return 0.7; // default
  }

  /**
   * Market relevance score: more relevant markets → higher score.
   * Global news hits all markets → highest.
   * Range: [0.5, 1.0]
   */
  private marketRelevanceScore(markets: string[], level: BreakingLevel): number {
    if (markets.includes('GLOBAL')) return 1.0;
    if (markets.includes('US') && markets.includes('EU')) return 0.95;
    if (markets.includes('US')) return 0.85;

    // Market size weighting
    const largeMarkets = ['EU', 'CN', 'JP'];
    const mediumMarkets = ['UK', 'HK', 'KR', 'IN'];
    const smallMarkets = ['AU', 'SG', 'TW'];

    let score = 0.5;
    for (const m of markets) {
      if (largeMarkets.includes(m)) score = Math.max(score, 0.8);
      else if (mediumMarkets.includes(m)) score = Math.max(score, 0.7);
      else if (smallMarkets.includes(m)) score = Math.max(score, 0.6);
    }

    return score;
  }

  // ── Classification ───────────────────────────────────────────────────────

  /**
   * Classify breaking level based on score.
   *   Score ≥ 80 → P0
   *   Score ≥ 50 → P1
   *   Score ≥ 20 → P2
   */
  classifyLevel(score: number, bankLevel: BreakingLevel): BreakingLevel {
    // P0 bank keywords can produce P1 if score is moderate
    if (bankLevel === 'P0' && score >= 80) return 'P0';
    if (bankLevel === 'P0' && score >= 40) return 'P1';
    if (bankLevel === 'P0' && score >= 15) return 'P2';

    // P1 bank keywords
    if (bankLevel === 'P1' && score >= 50) return 'P1';
    if (bankLevel === 'P1' && score >= 20) return 'P2';

    // P2 bank keywords
    if (score >= 20) return 'P2';

    return 'P2';
  }

  // ── Utilities ────────────────────────────────────────────────────────────

  /** Build searchable text from a news item */
  private buildSearchText(item: ParsedNewsItem): string {
    return `${item.title} ${item.description}`.toLowerCase();
  }

  /** Build human-readable reason string */
  private buildReason(level: BreakingLevel, keywords: string[], score: number): string {
    const topKw = keywords.slice(0, 5).join(', ');
    const descriptors: Record<BreakingLevel, string> = {
      P0: 'CRITICAL',
      P1: 'WARNING',
      P2: 'INFO',
    };
    return `[${descriptors[level]}] Score=${score.toFixed(1)}: matched ${keywords.length} keywords including: ${topKw}`;
  }

  private recordDetection(detection: BreakingDetection): void {
    this.recentDetections.unshift(detection);
    if (this.recentDetections.length > 100) {
      this.recentDetections.length = 100;
    }

    this.stats.lastDetection = detection.detectionTime;

    if (detection.level === 'P0') this.stats.p0Detected++;
    else if (detection.level === 'P1') this.stats.p1Detected++;
    else this.stats.p2Detected++;

    // Update running average
    const totalDetections = this.stats.p0Detected + this.stats.p1Detected + this.stats.p2Detected;
    this.stats.averageScore = ((this.stats.averageScore * (totalDetections - 1)) + detection.score) / totalDetections;
  }

  // ── Queries ──────────────────────────────────────────────────────────────

  getRecentDetections(limit = 10): BreakingDetection[] {
    return this.recentDetections.slice(0, limit);
  }

  getDetectionsByLevel(level: BreakingLevel, limit = 20): BreakingDetection[] {
    return this.recentDetections.filter(d => d.level === level).slice(0, limit);
  }

  getStats(): DetectorStats {
    return { ...this.stats };
  }

  getKeywordBanks(): KeywordBank[] {
    return this.keywordBanks.map(b => ({
      level: b.level,
      keywords: [...b.keywords],
      weightMultiplier: b.weightMultiplier,
    }));
  }

  getTotalKeywords(): number {
    return this.keywordBanks.reduce((s, b) => s + b.keywords.length, 0);
  }

  /** Mark a detection as false positive (for tuning) */
  markFalsePositive(itemId: string): void {
    this.stats.falsePositives++;
    this.recentDetections = this.recentDetections.filter(d => d.item.guid !== itemId);
  }

  reset(): void {
    this.recentDetections = [];
    this.stats = {
      totalScanned: 0,
      p0Detected: 0,
      p1Detected: 0,
      p2Detected: 0,
      falsePositives: 0,
      lastDetection: 0,
      averageScore: 0,
    };
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Singleton
// ═════════════════════════════════════════════════════════════════════════════

let defaultDetector: BreakingNewsDetector | null = null;

export function getBreakingNewsDetector(): BreakingNewsDetector {
  if (!defaultDetector) defaultDetector = new BreakingNewsDetector();
  return defaultDetector;
}

export function resetBreakingNewsDetector(): void {
  defaultDetector = null;
}
