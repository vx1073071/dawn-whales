/**
 * P1-14 SEC8KFilingEngine — SEC 8-K Filing Analysis Engine
 * R249 — P1 Closure Round
 * JVS / 引擎虾
 *
 * Parses, classifies, and scores SEC 8-K filings for material impact.
 * Supports 8-K item sections (1.01-9.01), sentiment scoring, materiality
 * flags, event type extraction, and historical filing comparison.
 * Singleton pattern, fully testable with reset().
 */

import log from 'electron-log';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

/** 8-K Item sections as defined by SEC */
export type SEC8KItem =
  | '1.01' | '1.02' | '1.03' // Entry into Material Agreement / Termination / Bankruptcy
  | '2.01' | '2.02' | '2.03' | '2.04' | '2.05' | '2.06' // Asset / Results / Financials / Triggering Events / Exit costs / Impairments
  | '3.01' | '3.02' | '3.03' // Notice of Delisting / Unregistered Sales / Material Modification
  | '4.01' | '4.02' // Changes in Accountant / Non-Reliance
  | '5.01' | '5.02' | '5.03' | '5.04' | '5.05' | '5.06' | '5.07' | '5.08' // Governance / Officer Departure / Bylaws / Trading Plans / Ethics / Shell / Say-on-Pay / Officer Appointment + Shareholder Director Nominations
  | '6.01' | '6.02' | '6.03' | '6.04' | '6.05' // ABS informational + ABS informational
  | '7.01' // Reg FD disclosure
  | '8.01' // Other events
  | '9.01'; // Financial statements & exhibits

export type FilingSentiment = 'positive' | 'negative' | 'neutral' | 'mixed';

export type MaterialityLevel = 'low' | 'medium' | 'high' | 'critical';

export interface SEC8KSection {
  item: SEC8KItem;
  title: string;
  summary: string; // extracted text summary
  sentiment: FilingSentiment;
  materiality: MaterialityLevel;
  keyPhrases: string[];
}

export interface SEC8KFiling {
  id: string;
  cik: string;
  ticker: string;
  companyName: string;
  filingDate: string; // YYYY-MM-DD
  filingUrl: string;
  /** Extracted sections */
  sections: SEC8KSection[];
  /** Overall assessment */
  overallSentiment: FilingSentiment;
  overallMateriality: MaterialityLevel;
  /** Composite impact score 0-100 */
  impactScore: number;
  /** Whether this filing is likely to move the stock */
  marketMoving: boolean;
  /** Key events extracted */
  events: string[];
  /** Historical comparison metrics */
  comparison: FilingComparison | null;
  indexedAt: number;
}

export interface FilingComparison {
  comparedWithFilingId: string;
  sectorAvgSentiment: FilingSentiment;
  deviationFromSector: 'above' | 'in_line' | 'below';
  frequencyFlag: boolean; // true if this issuer files 8-Ks unusually often
  isRepeatEvent: boolean;
}

export interface SECSearchParams {
  ticker?: string;
  cik?: string;
  items?: SEC8KItem[];
  minImpactScore?: number;
  sentiment?: FilingSentiment;
  materiality?: MaterialityLevel;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

export interface SECFilingStats {
  totalFilings: number;
  bySentiment: Record<FilingSentiment, number>;
  byMateriality: Record<MaterialityLevel, number>;
  marketMovingCount: number;
  avgImpactScore: number;
  mostFrequentItem: string;
}

// ═══════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════

const ITEM_TITLES: Record<SEC8KItem, string> = {
  '1.01': 'Entry into Material Definitive Agreement',
  '1.02': 'Termination of Material Definitive Agreement',
  '1.03': 'Bankruptcy or Receivership',
  '2.01': 'Completion of Acquisition or Disposition of Assets',
  '2.02': 'Results of Operations and Financial Condition',
  '2.03': 'Creation of Direct Financial Obligation',
  '2.04': 'Triggering Events That Accelerate Direct Financial Obligation',
  '2.05': 'Costs Associated with Exit or Disposal Activities',
  '2.06': 'Material Impairments',
  '3.01': 'Notice of Delisting or Failure to Satisfy Listing Rule',
  '3.02': 'Unregistered Sales of Equity Securities',
  '3.03': 'Material Modification to Rights of Security Holders',
  '4.01': 'Changes in Registrant\'s Certifying Accountant',
  '4.02': 'Non-Reliance on Previously Issued Financial Statements',
  '5.01': 'Changes in Control of Registrant',
  '5.02': 'Departure of Directors or Certain Officers; Election of Directors; Appointment of Certain Officers; Compensatory Arrangements of Certain Officers',
  '5.03': 'Amendments to Articles of Incorporation or Bylaws; Change in Fiscal Year',
  '5.04': 'Temporary Suspension of Trading Under Registrant\'s Employee Benefit Plans',
  '5.05': 'Amendment to Registrant\'s Code of Ethics',
  '5.06': 'Change in Shell Company Status',
  '5.07': 'Submission of Matters to a Vote of Security Holders',
  '5.08': 'Shareholder Director Nominations',
  '6.01': 'ABS Informational and Computational Material',
  '6.02': 'Change in Servicer or Trustee',
  '6.03': 'Change in Credit Enhancement or Other External Support',
  '6.04': 'Failure to Make a Required Distribution',
  '6.05': 'Securities Act Updating Disclosure',
  '7.01': 'Regulation FD Disclosure',
  '8.01': 'Other Events',
  '9.01': 'Financial Statements and Exhibits',
};

/** Impact score baseline per item (0-100) */
const ITEM_IMPACT_BASELINE: Record<SEC8KItem, number> = {
  '1.01': 40, '1.02': 35, '1.03': 95,
  '2.01': 60, '2.02': 50, '2.03': 45, '2.04': 55, '2.05': 35, '2.06': 60,
  '3.01': 85, '3.02': 35, '3.03': 40,
  '4.01': 65, '4.02': 80,
  '5.01': 70, '5.02': 50, '5.03': 30, '5.04': 25, '5.05': 15, '5.06': 40, '5.07': 35, '5.08': 20,
  '6.01': 10, '6.02': 25, '6.03': 30, '6.04': 50, '6.05': 15,
  '7.01': 30, '8.01': 20, '9.01': 10,
};

/** Positive keywords weighted by materiality */
const POSITIVE_PHRASES: Array<{ pattern: RegExp; weight: number }> = [
  { pattern: /\b(profit|revenue growth|beat estimates|upgraded|increased dividend|share buyback)\b/i, weight: 0.6 },
  { pattern: /\b(positive outlook|exceeded guidance|record revenue|new contract\b.{1,20}\b(major|significant))\b/i, weight: 0.5 },
  { pattern: /\b(strategic acquisition|approved\b.{1,20}\bfda|new product launch)\b/i, weight: 0.5 },
  { pattern: /\b(improved margin|cost reduction|efficiency gain)\b/i, weight: 0.3 },
];

/** Negative keywords weighted by materiality */
const NEGATIVE_PHRASES: Array<{ pattern: RegExp; weight: number }> = [
  { pattern: /\b(bankruptcy|receivership|chapter 11|insolven)\b/i, weight: 0.9 },
  { pattern: /\b(delisting|non-compliance|deficiency notice|below\b.{1,20}\bminimum)\b/i, weight: 0.8 },
  { pattern: /\b(material impairment|goodwill impairment|asset write.?down|loss\b.{1,20}\b(million|billion))\b/i, weight: 0.7 },
  { pattern: /\b(restatement|non-reliance|accounting error|material weakness)\b/i, weight: 0.8 },
  { pattern: /\b(ceo\b.{1,10}\bresign|cfo\b.{1,10}\bresign|departure\b.{1,10}\b(chief|director|officer))\b/i, weight: 0.5 },
  { pattern: /\b(layoff|workforce reduction|restructuring charge|plant closing)\b/i, weight: 0.4 },
  { pattern: /\b(lawsuit|litigation|sec investigation|subpoena|consent order)\b/i, weight: 0.6 },
  { pattern: /\b(loss\b.{1,20}\bquarter|missed estimates|downgraded|guidance cut|lowered outlook)\b/i, weight: 0.5 },
  { pattern: /\b(dividend cut|suspend.*dividend|eliminate.*dividend)\b/i, weight: 0.5 },
];

// ═══════════════════════════════════════════════════════════════
// Engine
// ═══════════════════════════════════════════════════════════════

export class SEC8KFilingEngine {
  private static instance: SEC8KFilingEngine;

  private filings: Map<string, SEC8KFiling> = new Map();
  private filingHistory: Map<string, SEC8KFiling[]> = new Map(); // ticker → filings
  private idCounter = 0;

  private constructor() {}

  static getInstance(): SEC8KFilingEngine {
    if (!SEC8KFilingEngine.instance) {
      SEC8KFilingEngine.instance = new SEC8KFilingEngine();
    }
    return SEC8KFilingEngine.instance;
  }

  reset(): void {
    this.filings.clear();
    this.filingHistory.clear();
    this.idCounter = 0;
  }

  private nextId(): string {
    return `8k-${++this.idCounter}`;
  }

  // ═══════════════════════════════════════════════════════════════
  // Filing Ingestion
  // ═══════════════════════════════════════════════════════════════

  ingestFiling(params: {
    cik: string;
    ticker: string;
    companyName: string;
    filingDate: string;
    filingUrl: string;
    sections: Array<{
      item: SEC8KItem;
      text: string;
    }>;
  }): SEC8KFiling {
    const now = Date.now();

    // Parse each section
    const parsedSections: SEC8KSection[] = params.sections.map(sec => {
      const sentiment = this.analyzeSentiment(sec.text);
      const materiality = this.assessMateriality(sec.item, sec.text);
      const keyPhrases = this.extractKeyPhrases(sec.text);
      return {
        item: sec.item,
        title: ITEM_TITLES[sec.item] || sec.item,
        summary: sec.text.slice(0, 200),
        sentiment,
        materiality,
        keyPhrases,
      };
    });

    // Overall assessment
    const overallSentiment = this.combineSentiments(parsedSections);
    const overallMateriality = this.combineMateriality(parsedSections);
    const impactScore = this.calculateImpactScore(parsedSections);

    const filing: SEC8KFiling = {
      id: this.nextId(),
      cik: params.cik,
      ticker: params.ticker.toUpperCase(),
      companyName: params.companyName,
      filingDate: params.filingDate,
      filingUrl: params.filingUrl,
      sections: parsedSections,
      overallSentiment,
      overallMateriality,
      impactScore,
      marketMoving: impactScore >= 60,
      events: this.extractEvents(parsedSections),
      comparison: null,
      indexedAt: now,
    };

    this.filings.set(filing.id, filing);

    // Add to history
    const key = filing.ticker;
    if (!this.filingHistory.has(key)) {
      this.filingHistory.set(key, []);
    }
    this.filingHistory.get(key)!.push(filing);

    // Compare with historical
    if (this.filingHistory.get(key)!.length > 1) {
      const prev = this.filingHistory.get(key)![this.filingHistory.get(key)!.length - 2];
      filing.comparison = this.compareFilings(filing, prev);
    }

    log.info(`[SEC8K] Ingested filing ${filing.id} for ${filing.ticker}: score=${impactScore}, sentiment=${overallSentiment}`);
    return filing;
  }

  // ═══════════════════════════════════════════════════════════════
  // Analysis
  // ═══════════════════════════════════════════════════════════════

  analyzeSentiment(text: string): FilingSentiment {
    let posScore = 0;
    let negScore = 0;

    for (const { pattern, weight } of POSITIVE_PHRASES) {
      if (pattern.test(text)) posScore += weight;
    }
    for (const { pattern, weight } of NEGATIVE_PHRASES) {
      if (pattern.test(text)) negScore += weight;
    }

    if (posScore > 0 && negScore > 0) return 'mixed';
    if (posScore > 0.5) return 'positive';
    if (negScore > 0.5) return 'negative';
    if (posScore > 0) return 'positive';
    if (negScore > 0) return 'negative';
    return 'neutral';
  }

  assessMateriality(item: SEC8KItem, text: string): MaterialityLevel {
    const baseImpact = ITEM_IMPACT_BASELINE[item] || 20;

    // Boost based on dollar amounts mentioned
    const millionMatch = text.match(/(\d+(?:\.\d+)?)\s*(million|billion)/i);
    if (millionMatch) {
      const value = parseFloat(millionMatch[1]);
      const unit = millionMatch[2].toLowerCase();
      const scaled = unit === 'billion' ? value * 1000 : value;
      if (scaled > 500) return 'critical';
      if (scaled > 100) return 'high';
    }

    if (baseImpact >= 80) return 'critical';
    if (baseImpact >= 60) return 'high';
    if (baseImpact >= 35) return 'medium';
    return 'low';
  }

  extractKeyPhrases(text: string): string[] {
    const phrases: string[] = [];
    const patterns = [
      /\b(bankruptcy|receivership|delisting|restatement|impairment)\b/gi,
      /\b(acquisition\b.{1,20}\b(completed|announced)|merger\b.{1,20}\bagreement)\b/gi,
      /\b(ceo\b.{1,20}\b(appointed|resigned|departure)|cfo\b.{1,20}\bchange)\b/gi,
      /\b(share buyback|dividend\b.{1,10}\b(increase|initiate|declare)|special dividend)\b/gi,
    ];
    for (const p of patterns) {
      let m: RegExpExecArray | null;
      while ((m = p.exec(text)) !== null) {
        phrases.push(m[0].toLowerCase());
      }
    }
    return [...new Set(phrases)].slice(0, 10);
  }

  combineSentiments(sections: SEC8KSection[]): FilingSentiment {
    const counts: Record<FilingSentiment, number> = { positive: 0, negative: 0, neutral: 0, mixed: 0 };
    for (const s of sections) {
      counts[s.sentiment]++;
    }
    if (counts.negative > counts.positive) return 'negative';
    if (counts.positive > counts.negative) return 'positive';
    if (counts.mixed > 0) return 'mixed';
    return 'neutral';
  }

  combineMateriality(sections: SEC8KSection[]): MaterialityLevel {
    const order: MaterialityLevel[] = ['critical', 'high', 'medium', 'low'];
    for (const level of order) {
      if (sections.some(s => s.materiality === level)) return level;
    }
    return 'low';
  }

  calculateImpactScore(sections: SEC8KSection[]): number {
    let score = 0;
    for (const s of sections) {
      const base = ITEM_IMPACT_BASELINE[s.item] || 20;
      let multiplier = 1.0;
      if (s.sentiment === 'negative') multiplier = 1.3;
      else if (s.sentiment === 'positive') multiplier = 1.1;
      score += base * multiplier;
    }
    // Average across sections, cap at 100
    const avg = sections.length > 0 ? score / Math.max(sections.length, 1) : 0;
    return Math.min(100, Math.round(avg));
  }

  extractEvents(sections: SEC8KSection[]): string[] {
    const events = new Set<string>();
    for (const s of sections) {
      if (s.materiality === 'critical' || s.materiality === 'high') {
        events.add(`${s.item}: ${s.title}`);
      }
    }
    return Array.from(events);
  }

  // ═══════════════════════════════════════════════════════════════
  // Comparison
  // ═══════════════════════════════════════════════════════════════

  compareFilings(current: SEC8KFiling, previous: SEC8KFiling): FilingComparison {
    const sectorAvg: FilingSentiment = 'neutral'; // In production, computed from sector aggregate

    let deviation: FilingComparison['deviationFromSector'] = 'in_line';
    if (current.impactScore - previous.impactScore > 30) {
      deviation = 'above';
    } else if (previous.impactScore - current.impactScore > 30) {
      deviation = 'below';
    }

    const previousEvents = new Set(previous.events);
    const isRepeatEvent = current.events.some(e => previousEvents.has(e));

    const history = this.filingHistory.get(current.ticker) || [];
    // More than 2 filings in 30 days is unusual frequency
    const recentCount = history.filter(f => {
      const diffDays = (current.indexedAt - f.indexedAt) / (1000 * 60 * 60 * 24);
      return diffDays >= 0 && diffDays <= 30;
    }).length;

    return {
      comparedWithFilingId: previous.id,
      sectorAvgSentiment: sectorAvg,
      deviationFromSector: deviation,
      frequencyFlag: recentCount > 2,
      isRepeatEvent,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // Query
  // ═══════════════════════════════════════════════════════════════

  getFiling(id: string): SEC8KFiling | undefined {
    return this.filings.get(id);
  }

  getFilingsByTicker(ticker: string): SEC8KFiling[] {
    return this.filingHistory.get(ticker.toUpperCase()) || [];
  }

  searchFilings(params: SECSearchParams): { filings: SEC8KFiling[]; total: number } {
    let results = Array.from(this.filings.values());

    if (params.ticker) {
      results = results.filter(f => f.ticker === params.ticker.toUpperCase());
    }
    if (params.cik) {
      results = results.filter(f => f.cik === params.cik);
    }
    if (params.items && params.items.length > 0) {
      results = results.filter(f => f.sections.some(s => params.items!.includes(s.item)));
    }
    if (params.minImpactScore !== undefined) {
      results = results.filter(f => f.impactScore >= params.minImpactScore!);
    }
    if (params.sentiment) {
      results = results.filter(f => f.overallSentiment === params.sentiment);
    }
    if (params.materiality) {
      results = results.filter(f => f.overallMateriality === params.materiality);
    }
    if (params.dateFrom) {
      results = results.filter(f => f.filingDate >= params.dateFrom!);
    }
    if (params.dateTo) {
      results = results.filter(f => f.filingDate <= params.dateTo!);
    }

    results.sort((a, b) => b.indexedAt - a.indexedAt);

    const total = results.length;
    const offset = params.offset || 0;
    const limit = params.limit || 50;
    results = results.slice(offset, offset + limit);

    return { filings: results, total };
  }

  getMarketMovingFilings(limit?: number): SEC8KFiling[] {
    return Array.from(this.filings.values())
      .filter(f => f.marketMoving)
      .sort((a, b) => b.impactScore - a.impactScore)
      .slice(0, limit || 50);
  }

  getRecentFilings(days?: number): SEC8KFiling[] {
    const cutoff = Date.now() - (days || 7) * 24 * 60 * 60 * 1000;
    return Array.from(this.filings.values())
      .filter(f => f.indexedAt >= cutoff)
      .sort((a, b) => b.indexedAt - a.indexedAt);
  }

  // ═══════════════════════════════════════════════════════════════
  // Stats
  // ═══════════════════════════════════════════════════════════════

  getStats(ticker?: string): SECFilingStats {
    let filings = Array.from(this.filings.values());
    if (ticker) {
      filings = filings.filter(f => f.ticker === ticker.toUpperCase());
    }

    const bySentiment: Record<FilingSentiment, number> = { positive: 0, negative: 0, neutral: 0, mixed: 0 };
    const byMateriality: Record<MaterialityLevel, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    let totalScore = 0;
    let marketMovingCount = 0;

    for (const f of filings) {
      bySentiment[f.overallSentiment]++;
      byMateriality[f.overallMateriality]++;
      totalScore += f.impactScore;
      if (f.marketMoving) marketMovingCount++;
    }

    // Most frequent item
    const itemCounts = new Map<string, number>();
    for (const f of filings) {
      for (const s of f.sections) {
        itemCounts.set(s.item, (itemCounts.get(s.item) || 0) + 1);
      }
    }
    let mostFrequentItem = 'N/A';
    let maxCount = 0;
    for (const [item, count] of itemCounts) {
      if (count > maxCount) { maxCount = count; mostFrequentItem = item; }
    }

    return {
      totalFilings: filings.length,
      bySentiment,
      byMateriality,
      marketMovingCount,
      avgImpactScore: filings.length > 0 ? Math.round(totalScore / filings.length) : 0,
      mostFrequentItem,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // Alerts
  // ═══════════════════════════════════════════════════════════════

  getHighImpactEvents(): SEC8KFiling[] {
    return Array.from(this.filings.values())
      .filter(f => f.overallMateriality === 'critical')
      .sort((a, b) => b.impactScore - a.impactScore);
  }

  getTickerAlertSummary(ticker: string): {
    ticker: string;
    latestFiling?: SEC8KFiling;
    recentCriticalCount: number;
    watchRecommendation: boolean;
  } {
    const history = this.filingHistory.get(ticker.toUpperCase()) || [];
    const recentCritical = history.filter(
      f => f.overallMateriality === 'critical' || f.impactScore >= 70,
    ).length;

    return {
      ticker: ticker.toUpperCase(),
      latestFiling: history.length > 0 ? history[history.length - 1] : undefined,
      recentCriticalCount: recentCritical,
      watchRecommendation: recentCritical >= 2 || (history.length > 0 && history[history.length - 1].impactScore >= 80),
    };
  }
}
