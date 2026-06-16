/**
 * R240 JVS#3: RegulatoryTracker — 监管政策追踪器
 *
 * Monitors regulatory bodies (SEC, PBOC, ESMA, CFTC, FCA, etc.)
 * for new rules, enforcement actions, and policy changes that
 * affect specific sectors or industries.
 *
 * Architecture:
 *   ┌──────────────────────────────────────────────────────────┐
 *   │                  RegulatoryTracker                       │
 *   │  ┌────────────────────────────────────────────────────┐  │
 *   │  │ Regulatory Body Detection                          │  │
 *   │  │ (SEC/PBOC/ESMA/CFTC/FCA/MAS/JFSA...keyword match)  │  │
 *   │  └──────────────────┬─────────────────────────────────┘  │
 *   │                     │                                     │
 *   │  ┌──────────────────┴─────────────────────────────────┐  │
 *   │  │ Policy Classification                             │  │
 *   │  │ (new_regulation/enforcement/guidance/speech/report)│  │
 *   │  └──────────────────┬─────────────────────────────────┘  │
 *   │                     │                                     │
 *   │  ┌──────────────────┴─────────────────────────────────┐  │
 *   │  │ Sector/Industry Matching                           │  │
 *   │  │ (maps policy keywords → affected sectors → stocks) │  │
 *   │  └──────────────────┬─────────────────────────────────┘  │
 *   │                     │                                     │
 *   │  ┌──────────────────┴─────────────────────────────────┐  │
 *   │  │ Impact Assessment + Alerts                         │  │
 *   │  │ (severity × sector exposure × compliance timeline) │  │
 *   │  └────────────────────────────────────────────────────┘  │
 *   └──────────────────────────────────────────────────────────┘
 *
 * Pricing: FREE (public service feature)
 *
 * v2.7.0-NEWS | production-ready
 */

import log from 'electron-log';

// ═════════════════════════════════════════════════════════════════════════════
// Types
// ═════════════════════════════════════════════════════════════════════════════

export type RegulatoryBody = 'SEC' | 'CFTC' | 'FED' | 'PBOC' | 'CSRC' | 'ESMA' | 'FCA' | 'MAS' | 'JFSA' | 'ECB' | 'OCC' | 'FINRA' | 'BaFin' | 'ASIC' | 'HKMA' | 'SFC' | 'OTHER';

export type PolicyType = 'new_regulation' | 'amendment' | 'enforcement' | 'guidance' | 'speech' | 'report' | 'rulemaking' | 'investigation' | 'settlement' | 'other';

export type PolicySeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface RegulatoryEvent {
  body: RegulatoryBody;
  bodyName: string;
  title: string;
  description?: string;
  policyType: PolicyType;
  severity: PolicySeverity;
  keywords: string[];
  affectedSectors: string[];
  effectiveDate?: string;
  complianceTimeline?: string;
  sourceUrl?: string;
  timestamp: number;
  guid?: string;
}

export interface SectorImpact {
  sector: string;
  sectorCN: string;
  impactScore: number; // 0-100
  direction: 'restrictive' | 'supportive' | 'neutral';
  affectedStocks: string[]; // Symbols of stocks in this sector
  keyProvisions: string[];
  complianceBurden: 'high' | 'medium' | 'low';
  opportunityFlag: boolean; // Does this create a market opportunity?
  reasoning: string;
}

export interface RegulatoryAlert {
  alertId: string;
  event: RegulatoryEvent;
  sectorImpacts: SectorImpact[];
  totalAffectedSectors: number;
  totalAffectedStocks: number;
  createdAt: number;
  expiresAt: number;
  read: boolean;
}

export interface RegulatorySummary {
  trackerId: string;
  period: { from: number; to: number };
  totalEvents: number;
  byBody: Record<string, number>;
  bySeverity: Record<string, number>;
  criticalAlerts: RegulatoryAlert[];
  topAffectedSectors: Array<{ sector: string; count: number }>;
  trend: 'increasing' | 'stable' | 'decreasing';
}

// ═════════════════════════════════════════════════════════════════════════════
// Regulatory Bodies Configuration
// ═════════════════════════════════════════════════════════════════════════════

const REGULATORY_BODIES: Record<RegulatoryBody, { name: string; region: string; pattern: RegExp }> = {
  SEC: { name: 'SEC (美国证监会)', region: 'US', pattern: /sec|securities\s+and\s+exchange\s+commission|gary\s+gensler/i },
  CFTC: { name: 'CFTC (商品期货委员会)', region: 'US', pattern: /cftc|commodity\s+futures\s+trading\s+commission/i },
  FED: { name: 'Federal Reserve (美联储)', region: 'US', pattern: /federal\s+reserve|fed\s+(chair|rate|fund)|jerome\s+powell|fomc/i },
  PBOC: { name: 'PBOC (中国人民银行)', region: 'CN', pattern: /pboc|people's\s+bank\s+of\s+china|人民银行|央行|潘功胜|易纲/i },
  CSRC: { name: 'CSRC (中国证监会)', region: 'CN', pattern: /csrc|china\s+securities\s+regulatory|证监会|吴清|肖钢|易会满/i },
  ESMA: { name: 'ESMA (欧洲证券市场监管局)', region: 'EU', pattern: /esma|european\s+securities\s+and\s+markets\s+authority/i },
  FCA: { name: 'FCA (英国金融行为监管局)', region: 'UK', pattern: /fca|financial\s+conduct\s+authority/i },
  MAS: { name: 'MAS (新加坡金管局)', region: 'SG', pattern: /mas|monetary\s+authority\s+of\s+singapore/i },
  JFSA: { name: 'JFSA (日本金融厅)', region: 'JP', pattern: /jfsa|financial\s+services\s+agency|金融庁/i },
  ECB: { name: 'ECB (欧洲央行)', region: 'EU', pattern: /ecb|european\s+central\s+bank|christine\s+lagarde/i },
  OCC: { name: 'OCC (货币监理署)', region: 'US', pattern: /occ|office\s+of\s+the\s+comptroller/i },
  FINRA: { name: 'FINRA (金融业监管局)', region: 'US', pattern: /finra|financial\s+industry\s+regulatory\s+authority/i },
  BaFin: { name: 'BaFin (德国联邦金融监管局)', region: 'EU', pattern: /bafin|Bundesanstalt für Finanzdienstleistungsaufsicht/i },
  ASIC: { name: 'ASIC (澳大利亚证投委)', region: 'AU', pattern: /asic|australian\s+securities\s+and\s+investments/i },
  HKMA: { name: 'HKMA (香港金管局)', region: 'HK', pattern: /hkma|hong\s+kong\s+monetary\s+authority|金管局/i },
  SFC: { name: 'SFC (香港证监会)', region: 'HK', pattern: /sfc\s+|securities\s+and\s+futures\s+commission|香港证监会/i },
  OTHER: { name: '其他监管机构', region: 'GLOBAL', pattern: /regulator|watchdog|authority/i },
};

// ═════════════════════════════════════════════════════════════════════════════
// Sector → Keywords + Stocks mapping
// ═════════════════════════════════════════════════════════════════════════════

interface SectorMap {
  sector: string;
  sectorCN: string;
  keywords: RegExp[];
  stocks: string[];
}

const SECTOR_MAP: SectorMap[] = [
  {
    sector: 'Banking', sectorCN: '银行业',
    keywords: [/bank/i, /lender/i, /deposit/i, /basel\s+iii/i, /capital\s+adequacy/i, /loan\s+loss/i, /reserve\s+requirement/i],
    stocks: ['JPM', 'BAC', 'WFC', 'C', 'GS', 'MS', 'HSBC', '0005.HK'],
  },
  {
    sector: 'Cryptocurrency', sectorCN: '加密货币',
    keywords: [/crypto/i, /bitcoin/i, /ethereum/i, /stablecoin/i, /defi/i, /nft/i, /mining/i, /exchange\s+(license|registration)/i, /custody/i],
    stocks: ['COIN', 'MARA', 'RIOT', 'CLSK', 'MSTR', 'BTC-USD', 'ETH-USD'],
  },
  {
    sector: 'Technology', sectorCN: '科技',
    keywords: [/antitrust/i, /monopoly/i, /data\s+privacy/i, /gdpr/i, /app\s+store/i, /platform\s+regulation/i, /ai\s+regulation/i, /content\s+moderation/i],
    stocks: ['AAPL', 'MSFT', 'GOOGL', 'META', 'AMZN', 'NVDA', 'ADBE', 'CRM'],
  },
  {
    sector: 'Pharmaceutical', sectorCN: '制药',
    keywords: [/drug\s+pric/i, /fda\s+approv/i, /pharma/i, /patent/i, /clinical\s+trial/i, /biologics/i, /generic\s+drug/i],
    stocks: ['PFE', 'JNJ', 'MRK', 'LLY', 'NVO', 'ABBV', 'BMY', 'GILD'],
  },
  {
    sector: 'Energy', sectorCN: '能源',
    keywords: [/oil/i, /gas/i, /clean\s+energy/i, /carbon/i, /emission/i, /renewable/i, /fracking/i, /pipeline/i, /offshore\s+drilling/i],
    stocks: ['XOM', 'CVX', 'COP', 'BP', 'SHEL', 'ENB', 'OXY'],
  },
  {
    sector: 'RealEstate', sectorCN: '房地产',
    keywords: [/real\s+estate/i, /housing/i, /mortgage/i, /property/i, /房地产/i, /开发商/i, /房贷/i, /lpr/i],
    stocks: ['PLD', 'AMT', 'CCI', 'SPG', '0001.HK', '0688.HK', '2007.HK'],
  },
  {
    sector: 'Semiconductor', sectorCN: '半导体',
    keywords: [/chip/i, /semiconductor/i, /export\s+control/i, /chips?\s+ban/i, /wafer/i, /euv/i, /lithography/i, /fab/i],
    stocks: ['NVDA', 'INTC', 'AMD', 'TSM', 'QCOM', 'MU', 'AMAT', 'ASML', 'LRCX'],
  },
  {
    sector: 'Automotive', sectorCN: '汽车',
    keywords: [/auto/i, /ev\s+/i, /electric\s+vehicle/i, /autonomous/i, /emission\s+standard/i, /safety\s+regulation/i, /自动驾驶/i, /新能源/i],
    stocks: ['TSLA', 'F', 'GM', 'TM', 'HMC', 'NIO', 'XPEV', 'LI'],
  },
  {
    sector: 'Internet_Platform', sectorCN: '互联网平台',
    keywords: [/互联网/i, /平台经济/i, /反垄断/i, /算法/i, /个人信息保护/i, /数据安全/i, /未成年人保护/i, /算法推荐/i],
    stocks: ['BABA', 'TCEHY', 'BIDU', '0700.HK', '9988.HK', '3690.HK', 'JD'],
  },
  {
    sector: 'Insurance', sectorCN: '保险',
    keywords: [/insurance/i, /insurer/i, /underwrit/i, /solvency/i, /actuarial/i, /annuity/i],
    stocks: ['BRK.B', 'AIG', 'MET', 'PRU', 'AFL', 'AIZ'],
  },
  {
    sector: 'Fintech', sectorCN: '金融科技',
    keywords: [/fintech/i, /payment/i, /digital\s+wallet/i, /bnpl/i, /p2p\s+lending/i, /open\s+banking/i, /移动支付/i, /网络贷款/i],
    stocks: ['V', 'MA', 'PYPL', 'SQ', 'SOFI', 'AFRM', '0700.HK', '9988.HK'],
  },
  {
    sector: 'Defense', sectorCN: '国防/航空航天',
    keywords: [/defense/i, /military/i, /aerospace/i, /weapon/i, /sanction/i, /export\s+control/i, /itar/i],
    stocks: ['LMT', 'RTX', 'BA', 'NOC', 'GD', 'LHX'],
  },
];

// ═════════════════════════════════════════════════════════════════════════════
// Policy type keywords
// ═════════════════════════════════════════════════════════════════════════════

const POLICY_TYPE_PATTERNS: Record<PolicyType, RegExp> = {
  new_regulation: /new\s+(rule|regulation|law|framework|directive|law)|proposed\s+(rule|regulation)|introduce/i,
  amendment: /amend|revise|update|modify|change/i,
  enforcement: /fine|penalty|enforce|action|cease\s+and\s+desist|violation|breach/i,
  guidance: /guidance|guideline|advisory|recommendation|notice/i,
  speech: /speech|remark|testimony|hearing|hearing/i,
  report: /report|study|review|assessment|white\s+paper/i,
  rulemaking: /rule\s*making|comment\s+period|propose/i,
  investigation: /investigation|probe|inquiry|subpoena|investigate/i,
  settlement: /settlement|settle|consent\s+order|plea/i,
  other: /./, // Catch-all
};

// ═════════════════════════════════════════════════════════════════════════════
// Severity keywords
// ═════════════════════════════════════════════════════════════════════════════

const SEVERITY_PATTERNS: Record<PolicySeverity, RegExp[]> = {
  CRITICAL: [/ban\s+/i, /prohibit/i, /illegal/i, /criminal/i, /fraud/i, /immediate\s+effective/i, /emergency/i, /delist/i],
  HIGH: [/substantial\s+fine/i, /significant\s+impact/i, /mandatory/i, /compliance\s+required/i, /license\s+revoke/i, /investigation/i],
  MEDIUM: [/proposed\s+rule/i, /recommend/i, /guidance/i, /warning/i, /review/i, /consideration/i],
  LOW: [/study/i, /report/i, /comment/i, /speech/i, /discussion/i, /seminar/i],
};

// ═════════════════════════════════════════════════════════════════════════════
// RegulatoryTracker
// ═════════════════════════════════════════════════════════════════════════════

export class RegulatoryTracker {
  private alerts: RegulatoryAlert[] = [];
  private eventHistory: RegulatoryEvent[] = [];
  private maxAlerts = 100;
  private maxHistory = 200;

  // ── Main API ─────────────────────────────────────────────────────────────

  /**
   * Process a news item to extract regulatory events.
   */
  process(news: { title: string; description?: string; publishedAt: number; guid?: string; sourceId?: string }): RegulatoryEvent | null {
    const text = `${news.title} ${news.description || ''}`;
    const now = Date.now();

    // 1. Detect regulatory body
    const bodyEntry = this.detectBody(text);
    if (!bodyEntry) return null;

    // 2. Classify policy type
    const policyType = this.classifyPolicyType(text);

    // 3. Determine severity
    const severity = this.determineSeverity(text, policyType);

    // 4. Extract keywords
    const keywords = this.extractKeywords(text);

    // 5. Match affected sectors
    const affectedSectors = this.matchSectors(text);

    const event: RegulatoryEvent = {
      body: bodyEntry.body,
      bodyName: bodyEntry.name,
      title: news.title,
      description: news.description,
      policyType,
      severity,
      keywords,
      affectedSectors,
      timestamp: news.publishedAt,
      guid: news.guid,
    };

    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistory) this.eventHistory.shift();

    // Create alert if severity is HIGH or CRITICAL
    if (severity === 'CRITICAL' || severity === 'HIGH') {
      this.createAlert(event);
    }

    log.info(`[REG-TRACK] ${bodyEntry.body}: ${severity} ${policyType} → ${affectedSectors.length} sectors`);
    return event;
  }

  /**
   * Process multiple news items.
   */
  processBatch(newsItems: Array<{ title: string; description?: string; publishedAt: number; guid?: string; sourceId?: string }>): RegulatoryEvent[] {
    const events: RegulatoryEvent[] = [];
    for (const news of newsItems) {
      const event = this.process(news);
      if (event) events.push(event);
    }
    return events;
  }

  // ── Detection ────────────────────────────────────────────────────────────

  private detectBody(text: string): { body: RegulatoryBody; name: string } | null {
    for (const [body, config] of Object.entries(REGULATORY_BODIES)) {
      if (body === 'OTHER') continue; // Skip catch-all in first pass
      if (config.pattern.test(text)) {
        return { body: body as RegulatoryBody, name: config.name };
      }
    }
    // Fallback to OTHER
    if (REGULATORY_BODIES.OTHER.pattern.test(text)) {
      return { body: 'OTHER', name: REGULATORY_BODIES.OTHER.name };
    }
    return null;
  }

  private classifyPolicyType(text: string): PolicyType {
    for (const [type, pattern] of Object.entries(POLICY_TYPE_PATTERNS)) {
      if (pattern.test(text)) return type as PolicyType;
    }
    return 'other';
  }

  private determineSeverity(text: string, policyType: PolicyType): PolicySeverity {
    // Enforcement+investigation = higher severity
    if (policyType === 'enforcement' || policyType === 'investigation') {
      if (SEVERITY_PATTERNS.CRITICAL.some(p => p.test(text))) return 'CRITICAL';
      return 'HIGH'; // Enforcement is at least HIGH
    }

    // Check keyword-based severity
    for (const p of SEVERITY_PATTERNS.CRITICAL) {
      if (p.test(text)) return 'CRITICAL';
    }
    for (const p of SEVERITY_PATTERNS.HIGH) {
      if (p.test(text)) return 'HIGH';
    }
    for (const p of SEVERITY_PATTERNS.MEDIUM) {
      if (p.test(text)) return 'MEDIUM';
    }
    return 'LOW';
  }

  private extractKeywords(text: string): string[] {
    const keywords = new Set<string>();
    const lowerText = text.toLowerCase();

    // Legislation-related
    const legislationKws = ['regulation', 'act', 'bill', 'law', 'statute', 'directive', 'rule', 'framework'];
    for (const kw of legislationKws) { if (lowerText.includes(kw)) keywords.add(kw); }

    // Action-related
    const actionKws = ['prohibit', 'ban', 'restrict', 'allow', 'require', 'mandate', 'permit', 'license'];
    for (const kw of actionKws) { if (lowerText.includes(kw)) keywords.add(kw); }

    // Financial-specific
    const finKws = ['capital', 'margin', 'leverage', 'liquidity', 'disclosure', 'reporting', 'audit', 'transparency'];
    for (const kw of finKws) { if (lowerText.includes(kw)) keywords.add(kw); }

    return [...keywords];
  }

  // ── Sector Matching ──────────────────────────────────────────────────────

  private matchSectors(text: string): string[] {
    const sectors = new Set<string>();
    const lowerText = text.toLowerCase();

    for (const sector of SECTOR_MAP) {
      for (const pattern of sector.keywords) {
        if (pattern.test(lowerText)) {
          sectors.add(sector.sector);
          break;
        }
      }
    }

    return [...sectors];
  }

  /**
   * Get detailed sector impact analysis for an event.
   */
  getSectorImpacts(event: RegulatoryEvent): SectorImpact[] {
    const text = `${event.title} ${event.description || ''}`;
    const impacts: SectorImpact[] = [];

    for (const sector of SECTOR_MAP) {
      if (!event.affectedSectors.includes(sector.sector)) continue;

      // Calculate impact score
      let impactScore = 0;
      if (event.severity === 'CRITICAL') impactScore = 85;
      else if (event.severity === 'HIGH') impactScore = 65;
      else if (event.severity === 'MEDIUM') impactScore = 40;
      else impactScore = 20;

      // Adjust for enforcement
      if (event.policyType === 'enforcement' || event.policyType === 'investigation') impactScore += 10;
      if (event.policyType === 'guidance' || event.policyType === 'speech') impactScore -= 10;

      impactScore = Math.min(100, Math.max(0, impactScore));

      // Determine direction
      let direction: SectorImpact['direction'] = 'neutral';
      const lowerText = text.toLowerCase();
      if (/ban|prohibit|restrict|fine|penalty|limit/i.test(lowerText)) direction = 'restrictive';
      else if (/support|promote|encourage|subsid|legalize|approve/i.test(lowerText)) direction = 'supportive';

      // Compliance burden
      let complianceBurden: SectorImpact['complianceBurden'] = 'low';
      if (event.policyType === 'new_regulation' && event.severity === 'HIGH') complianceBurden = 'high';
      else if (event.policyType === 'new_regulation' || event.policyType === 'amendment') complianceBurden = 'medium';

      // Extract key provisions
      const keyProvisions = this.extractProvisions(text, sector.sector);

      // Opportunity flag
      const opportunityFlag = direction === 'supportive' || 
        (event.policyType === 'new_regulation' && sector.sector === 'Defense');

      impacts.push({
        sector: sector.sector,
        sectorCN: sector.sectorCN,
        impactScore,
        direction,
        affectedStocks: sector.stocks,
        keyProvisions,
        complianceBurden,
        opportunityFlag,
        reasoning: this.generateSectorReasoning(event, sector, impactScore, direction),
      });
    }

    // Sort by impact score descending
    impacts.sort((a, b) => b.impactScore - a.impactScore);

    return impacts;
  }

  private extractProvisions(text: string, sector: string): string[] {
    const provisions: string[] = [];
    const sentences = text.split(/[.。;；!！?？]+/);

    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (trimmed.length < 10) continue;

      // Look for provision indicators
      if (/require|must|shall|prohibit|ban|limit|restrict|mandate|disclose|register/i.test(trimmed)) {
        if (trimmed.length < 200) {
          provisions.push(trimmed.slice(0, 150));
        }
      }

      if (provisions.length >= 5) break;
    }

    return provisions.length > 0 ? provisions : ['详见原文'];
  }

  private generateSectorReasoning(event: RegulatoryEvent, sector: SectorMap, score: number, direction: string): string {
    let reasoning = `${event.bodyName} ${event.policyType === 'new_regulation' ? '新规' : event.policyType === 'enforcement' ? '执法' : '政策动向'}`;

    if (direction === 'restrictive') reasoning += ' → 限制性政策';
    else if (direction === 'supportive') reasoning += ' → 支持性政策';

    reasoning += ` → ${sector.sectorCN}受直接影响(影响分: ${score})`;

    if (sector.stocks.length > 0) {
      reasoning += ` → ${sector.stocks.length}只相关股票需关注`;
    }

    return reasoning;
  }

  // ── Alert Management ─────────────────────────────────────────────────────

  private createAlert(event: RegulatoryEvent): void {
    const sectorImpacts = this.getSectorImpacts(event);
    const totalStocks = sectorImpacts.reduce((s, si) => s + si.affectedStocks.length, 0);

    const alert: RegulatoryAlert = {
      alertId: `RAL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      event,
      sectorImpacts,
      totalAffectedSectors: sectorImpacts.length,
      totalAffectedStocks: totalStocks,
      createdAt: Date.now(),
      expiresAt: Date.now() + 7 * 24 * 3600 * 1000, // 7 days
      read: false,
    };

    this.alerts.push(alert);
    if (this.alerts.length > this.maxAlerts) this.alerts.shift();
  }

  // ── Queries ──────────────────────────────────────────────────────────────

  getAlerts(options?: { severity?: PolicySeverity; body?: RegulatoryBody; unreadOnly?: boolean; limit?: number }): RegulatoryAlert[] {
    let results = [...this.alerts];

    if (options?.severity) results = results.filter(a => a.event.severity === options.severity);
    if (options?.body) results = results.filter(a => a.event.body === options.body);
    if (options?.unreadOnly) results = results.filter(a => !a.read);

    results.sort((a, b) => b.createdAt - a.createdAt);
    if (options?.limit) results = results.slice(0, options.limit);

    return results;
  }

  getCriticalAlerts(): RegulatoryAlert[] {
    return this.getAlerts({ severity: 'CRITICAL' });
  }

  getUnreadAlerts(): RegulatoryAlert[] {
    return this.getAlerts({ unreadOnly: true });
  }

  markAsRead(alertId: string): boolean {
    const alert = this.alerts.find(a => a.alertId === alertId);
    if (alert) { alert.read = true; return true; }
    return false;
  }

  getEventHistory(options?: { body?: RegulatoryBody; limit?: number }): RegulatoryEvent[] {
    let results = [...this.eventHistory];
    if (options?.body) results = results.filter(e => e.body === options.body);
    results.sort((a, b) => b.timestamp - a.timestamp);
    if (options?.limit) results = results.slice(0, options.limit);
    return results;
  }

  /**
   * Generate a summary for a time period.
   */
  summarize(fromMs: number, toMs: number): RegulatorySummary {
    const events = this.eventHistory.filter(e => e.timestamp >= fromMs && e.timestamp <= toMs);

    const byBody: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const sectorCount: Record<string, number> = {};

    for (const e of events) {
      byBody[e.body] = (byBody[e.body] || 0) + 1;
      bySeverity[e.severity] = (bySeverity[e.severity] || 0) + 1;
      for (const s of e.affectedSectors) {
        sectorCount[s] = (sectorCount[s] || 0) + 1;
      }
    }

    const topSectors = Object.entries(sectorCount).map(([sector, count]) => ({ sector, count })).sort((a, b) => b.count - a.count).slice(0, 10);

    // Trend detection: compare first half vs second half counts
    const mid = (fromMs + toMs) / 2;
    const firstHalf = events.filter(e => e.timestamp < mid).length;
    const secondHalf = events.filter(e => e.timestamp >= mid).length;
    let trend: RegulatorySummary['trend'] = 'stable';
    if (secondHalf > firstHalf * 1.3) trend = 'increasing';
    else if (secondHalf < firstHalf * 0.7) trend = 'decreasing';

    return {
      trackerId: `SUM-${Date.now()}`,
      period: { from: fromMs, to: toMs },
      totalEvents: events.length,
      byBody,
      bySeverity,
      criticalAlerts: this.alerts.filter(a => a.event.timestamp >= fromMs && a.event.timestamp <= toMs && a.event.severity === 'CRITICAL'),
      topAffectedSectors: topSectors,
      trend,
    };
  }

  getSectorMap(): SectorMap[] {
    return SECTOR_MAP;
  }

  getRegulatoryBodies(): typeof REGULATORY_BODIES {
    return REGULATORY_BODIES;
  }

  getStats(): { totalEvents: number; activeAlerts: number; unreadAlerts: number } {
    return {
      totalEvents: this.eventHistory.length,
      activeAlerts: this.alerts.length,
      unreadAlerts: this.alerts.filter(a => !a.read).length,
    };
  }

  reset(): void {
    this.alerts = [];
    this.eventHistory = [];
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Singleton
// ═════════════════════════════════════════════════════════════════════════════

let defaultTracker: RegulatoryTracker | null = null;

export function getRegulatoryTracker(): RegulatoryTracker {
  if (!defaultTracker) defaultTracker = new RegulatoryTracker();
  return defaultTracker;
}

export function resetRegulatoryTracker(): void {
  defaultTracker = null;
}
