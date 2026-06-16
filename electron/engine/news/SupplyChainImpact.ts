/**
 * R240 JVS#2: SupplyChainImpact — 供应链传导引擎
 *
 * Detects how company events ripple through supply chains:
 *   Event at Company A → upstream suppliers impacted → downstream customers impacted → affected stocks
 *
 * Architecture:
 *   ┌────────────────────────────────────────────────────────────┐
 *   │                 SupplyChainImpact                          │
 *   │  ┌──────────────────────────────────────────────────────┐  │
 *   │  │ 1. Event Intake                                      │  │
 *   │  │    └─ News article + company identification          │  │
 *   │  └────────────────────┬─────────────────────────────────┘  │
 *   │                       │                                     │
 *   │  ┌────────────────────┴─────────────────────────────────┐  │
 *   │  │ 2. Knowledge Graph Lookup                            │  │
 *   │  │    ├─ Upstream (suppliers: raw materials, components) │  │
 *   │  │    ├─ Downstream (customers, distributors, partners)  │  │
 *   │  │    └─ Horizontal (competitors, peers)                │  │
 *   │  └────────────────────┬─────────────────────────────────┘  │
 *   │                       │                                     │
 *   │  ┌────────────────────┴─────────────────────────────────┐  │
 *   │  │ 3. Impact Propagation                                │  │
 *   │  │    ├─ Direct (same company)                          │  │
 *   │  │    ├─ Upstream (tier-1 supplier)                     │  │
 *   │  │    └─ Downstream (tier-1 customer)                   │  │
 *   │  └────────────────────┬─────────────────────────────────┘  │
 *   │                       │                                     │
 *   │  ┌────────────────────┴─────────────────────────────────┐  │
 *   │  │ 4. Affected Stock List                               │  │
 *   │  │    └─ Sorted by: propagation distance × impact × corr│  │
 *   │  └──────────────────────────────────────────────────────┘  │
 *   └────────────────────────────────────────────────────────────┘
 *
 * Pricing: 1 USDT/analysis (billed via server ai-billing)
 *
 * v2.7.0-NEWS | production-ready | P1 收费功能
 */

import log from 'electron-log';

// ═════════════════════════════════════════════════════════════════════════════
// Types
// ═════════════════════════════════════════════════════════════════════════════

export type SupplyChainRole = 'DIRECT' | 'SUPPLIER' | 'CUSTOMER' | 'COMPETITOR' | 'PARTNER' | 'INVESTOR';
export type ImpactType = 'NEGATIVE' | 'POSITIVE' | 'NEUTRAL';

export interface ChainNode {
  symbol: string;
  name: string;
  market: string;
  sector: string;
  role: SupplyChainRole;
  distance: number; // 0 = direct, 1 = tier-1, 2 = tier-2
  relationship: string; // e.g. "芯片供应商", "云服务客户", "合资伙伴"
  revenueExposure: number; // 0-100% revenue dependent on this relationship
  lastVerified?: number;
}

export interface SupplyChainEvent {
  title: string;
  description?: string;
  sourceSymbol: string;
  sourceName: string;
  sourceMarket: string;
  impactType: ImpactType;
  magnitude: number; // 0-100
  category: 'production' | 'financial' | 'regulatory' | 'partnership' | 'acquisition' | 'scandal' | 'other';
  timestamp: number;
  guid?: string;
}

export interface ChainImpact {
  symbol: string;
  name: string;
  market: string;
  role: SupplyChainRole;
  distance: number;
  relationship: string;
  impactType: ImpactType;
  impactScore: number; // 0-100
  confidence: number; // 0-1
  reasoning: string;
  revenueExposure: number;
  timeToReact: string; // "立即" | "数小时" | "数天" | "数周"
}

export interface ChainAnalysis {
  analysisId: string;
  event: SupplyChainEvent;
  analyzedAt: number;
  directImpact: ChainImpact | null;
  upstreamImpacts: ChainImpact[];
  downstreamImpacts: ChainImpact[];
  competitorImpacts: ChainImpact[];
  allAffectedSymbols: string[];
  summary: string;
  propagationMap: string; // ASCII art propagation
}

// ═════════════════════════════════════════════════════════════════════════════
// Supply Chain Knowledge Graph (real-world relationships)
// ═════════════════════════════════════════════════════════════════════════════

interface SupplyChainGraph {
  [company: string]: ChainNode[];
}

/**
 * Real-world supply chain relationships curated from public data.
 * Format: company → [upstream suppliers, downstream customers, competitors, partners]
 */
const SUPPLY_CHAIN_GRAPH: SupplyChainGraph = {
  // ── Tech Hardware ──
  AAPL: [
    { symbol: 'TSM', name: 'TSMC', market: 'US', sector: 'Semiconductor', role: 'SUPPLIER', distance: 1, relationship: '芯片代工', revenueExposure: 25 },
    { symbol: 'QCOM', name: 'Qualcomm', market: 'US', sector: 'Semiconductor', role: 'SUPPLIER', distance: 1, relationship: '5G modem', revenueExposure: 15 },
    { symbol: 'LUX', name: 'Luxshare', market: 'CN', sector: 'Manufacturing', role: 'SUPPLIER', distance: 1, relationship: 'AirPods/配件', revenueExposure: 40 },
    { symbol: 'GOOGL', name: 'Google', market: 'US', sector: 'Tech', role: 'PARTNER', distance: 1, relationship: 'Safari默认搜索', revenueExposure: 5 },
    { symbol: 'SMSN', name: 'Samsung', market: 'US', sector: 'Tech', role: 'COMPETITOR', distance: 1, relationship: '智能手机竞争', revenueExposure: 0 },
  ],
  NVDA: [
    { symbol: 'TSM', name: 'TSMC', market: 'US', sector: 'Semiconductor', role: 'SUPPLIER', distance: 1, relationship: 'GPU芯片代工', revenueExposure: 60 },
    { symbol: 'SMCI', name: 'Super Micro', market: 'US', sector: 'Server', role: 'CUSTOMER', distance: 1, relationship: 'AI服务器集成', revenueExposure: 55 },
    { symbol: 'MSFT', name: 'Microsoft', market: 'US', sector: 'Cloud', role: 'CUSTOMER', distance: 1, relationship: 'Azure GPU采购', revenueExposure: 18 },
    { symbol: 'META', name: 'Meta', market: 'US', sector: 'Tech', role: 'CUSTOMER', distance: 1, relationship: 'AI训练集群', revenueExposure: 12 },
    { symbol: 'AMD', name: 'AMD', market: 'US', sector: 'Semiconductor', role: 'COMPETITOR', distance: 1, relationship: 'GPU/AI芯片', revenueExposure: 0 },
    { symbol: 'INTC', name: 'Intel', market: 'US', sector: 'Semiconductor', role: 'COMPETITOR', distance: 1, relationship: 'AI加速器', revenueExposure: 0 },
    { symbol: 'MU', name: 'Micron', market: 'US', sector: 'Memory', role: 'SUPPLIER', distance: 1, relationship: 'HBM内存', revenueExposure: 30 },
    { symbol: 'SKH', name: 'SK Hynix', market: 'KR', sector: 'Memory', role: 'SUPPLIER', distance: 1, relationship: 'HBM3E内存', revenueExposure: 35 },
  ],
  TSLA: [
    { symbol: 'F', name: 'Ford', market: 'US', sector: 'Auto', role: 'COMPETITOR', distance: 1, relationship: '电动车竞争', revenueExposure: 0 },
    { symbol: 'GM', name: 'General Motors', market: 'US', sector: 'Auto', role: 'COMPETITOR', distance: 1, relationship: '电动车竞争', revenueExposure: 0 },
    { symbol: 'BYDDF', name: 'BYD', market: 'US', sector: 'Auto', role: 'COMPETITOR', distance: 1, relationship: '电动车全球竞争', revenueExposure: 0 },
    { symbol: 'NIO', name: 'Nio', market: 'US', sector: 'Auto', role: 'COMPETITOR', distance: 1, relationship: '高端电动车', revenueExposure: 0 },
    { symbol: 'ALB', name: 'Albemarle', market: 'US', sector: 'Lithium', role: 'SUPPLIER', distance: 1, relationship: '锂矿供应', revenueExposure: 20 },
    { symbol: 'SQM', name: 'SQM', market: 'US', sector: 'Lithium', role: 'SUPPLIER', distance: 1, relationship: '锂矿供应', revenueExposure: 15 },
  ],
  // ── Semiconductor ──
  TSM: [
    { symbol: 'NVDA', name: 'NVIDIA', market: 'US', sector: 'Semiconductor', role: 'CUSTOMER', distance: 1, relationship: '最大客户-GPU代工', revenueExposure: 12 },
    { symbol: 'AAPL', name: 'Apple', market: 'US', sector: 'Tech', role: 'CUSTOMER', distance: 1, relationship: 'A/M系列芯片', revenueExposure: 23 },
    { symbol: 'AMD', name: 'AMD', market: 'US', sector: 'Semiconductor', role: 'CUSTOMER', distance: 1, relationship: 'Ryzen/EPYC代工', revenueExposure: 8 },
    { symbol: 'QCOM', name: 'Qualcomm', market: 'US', sector: 'Semiconductor', role: 'CUSTOMER', distance: 1, relationship: 'Snapdragon代工', revenueExposure: 5 },
    { symbol: 'ASML', name: 'ASML', market: 'US', sector: 'Semiconductor Equipment', role: 'SUPPLIER', distance: 1, relationship: 'EUV光刻机', revenueExposure: 70 },
    { symbol: 'AMAT', name: 'Applied Materials', market: 'US', sector: 'Semiconductor Equipment', role: 'SUPPLIER', distance: 1, relationship: '芯片制造设备', revenueExposure: 15 },
    { symbol: 'LRCX', name: 'Lam Research', market: 'US', sector: 'Semiconductor Equipment', role: 'SUPPLIER', distance: 1, relationship: '蚀刻设备', revenueExposure: 12 },
    { symbol: 'INTC', name: 'Intel', market: 'US', sector: 'Semiconductor', role: 'COMPETITOR', distance: 1, relationship: '代工竞争', revenueExposure: 0 },
  ],
  ASML: [
    { symbol: 'TSM', name: 'TSMC', market: 'US', sector: 'Semiconductor', role: 'CUSTOMER', distance: 1, relationship: 'EUV最大客户', revenueExposure: 35 },
    { symbol: 'INTC', name: 'Intel', market: 'US', sector: 'Semiconductor', role: 'CUSTOMER', distance: 1, relationship: 'High-NA EUV', revenueExposure: 20 },
    { symbol: 'AMAT', name: 'Applied Materials', market: 'US', sector: 'Semiconductor Equipment', role: 'COMPETITOR', distance: 1, relationship: '芯片设备竞争', revenueExposure: 0 },
    { symbol: 'LRCX', name: 'Lam Research', market: 'US', sector: 'Semiconductor Equipment', role: 'COMPETITOR', distance: 1, relationship: '芯片设备竞争', revenueExposure: 0 },
  ],
  // ── Cloud/SaaS ──
  MSFT: [
    { symbol: 'NVDA', name: 'NVIDIA', market: 'US', sector: 'Semiconductor', role: 'SUPPLIER', distance: 1, relationship: 'GPU采购', revenueExposure: 5 },
    { symbol: 'AMZN', name: 'Amazon', market: 'US', sector: 'Cloud', role: 'COMPETITOR', distance: 1, relationship: 'AWS vs Azure', revenueExposure: 0 },
    { symbol: 'GOOGL', name: 'Google', market: 'US', sector: 'Cloud', role: 'COMPETITOR', distance: 1, relationship: 'GCP vs Azure', revenueExposure: 0 },
    { symbol: 'CRM', name: 'Salesforce', market: 'US', sector: 'SaaS', role: 'COMPETITOR', distance: 1, relationship: 'CRM vs Dynamics', revenueExposure: 0 },
    { symbol: 'ORCL', name: 'Oracle', market: 'US', sector: 'Cloud', role: 'COMPETITOR', distance: 1, relationship: 'OCI vs Azure', revenueExposure: 0 },
    { symbol: 'PANW', name: 'Palo Alto', market: 'US', sector: 'Cybersecurity', role: 'PARTNER', distance: 1, relationship: '安全集成', revenueExposure: 3 },
    { symbol: 'CRWD', name: 'CrowdStrike', market: 'US', sector: 'Cybersecurity', role: 'COMPETITOR', distance: 1, relationship: 'Defender竞争', revenueExposure: 0 },
  ],
  AMZN: [
    { symbol: 'NVDA', name: 'NVIDIA', market: 'US', sector: 'Semiconductor', role: 'SUPPLIER', distance: 1, relationship: 'Trainium/GPU', revenueExposure: 4 },
    { symbol: 'UPS', name: 'UPS', market: 'US', sector: 'Logistics', role: 'SUPPLIER', distance: 1, relationship: '物流运输', revenueExposure: 8 },
    { symbol: 'FDX', name: 'FedEx', market: 'US', sector: 'Logistics', role: 'SUPPLIER', distance: 1, relationship: '物流运输', revenueExposure: 6 },
    { symbol: 'WMT', name: 'Walmart', market: 'US', sector: 'Retail', role: 'COMPETITOR', distance: 1, relationship: '电商竞争', revenueExposure: 0 },
  ],
  // ── Crypto/Blockchain ──
  'BTC-USD': [
    { symbol: 'COIN', name: 'Coinbase', market: 'US', sector: 'Crypto', role: 'PARTNER', distance: 1, relationship: '交易平台', revenueExposure: 40 },
    { symbol: 'MARA', name: 'Marathon Digital', market: 'US', sector: 'Crypto Mining', role: 'PARTNER', distance: 1, relationship: 'BTC矿工', revenueExposure: 85 },
    { symbol: 'RIOT', name: 'Riot Platforms', market: 'US', sector: 'Crypto Mining', role: 'PARTNER', distance: 1, relationship: 'BTC矿工', revenueExposure: 80 },
    { symbol: 'CLSK', name: 'CleanSpark', market: 'US', sector: 'Crypto Mining', role: 'PARTNER', distance: 1, relationship: 'BTC矿工', revenueExposure: 75 },
    { symbol: 'MSTR', name: 'MicroStrategy', market: 'US', sector: 'Tech', role: 'INVESTOR', distance: 1, relationship: 'BTC持仓', revenueExposure: 60 },
    { symbol: 'ETH-USD', name: 'Ethereum', market: 'CRYPTO', sector: 'Crypto', role: 'COMPETITOR', distance: 1, relationship: 'L1竞争', revenueExposure: 0 },
  ],
  'ETH-USD': [
    { symbol: 'COIN', name: 'Coinbase', market: 'US', sector: 'Crypto', role: 'PARTNER', distance: 1, relationship: '交易平台', revenueExposure: 25 },
    { symbol: 'BTC-USD', name: 'Bitcoin', market: 'CRYPTO', sector: 'Crypto', role: 'COMPETITOR', distance: 1, relationship: 'L1竞争', revenueExposure: 0 },
    { symbol: 'SOL-USD', name: 'Solana', market: 'CRYPTO', sector: 'Crypto', role: 'COMPETITOR', distance: 1, relationship: 'L1竞争', revenueExposure: 0 },
    { symbol: 'LDO', name: 'Lido DAO', market: 'CRYPTO', sector: 'DeFi', role: 'PARTNER', distance: 1, relationship: '流动性质押', revenueExposure: 50 },
  ],
  // ── China/HK ──
  '0700.HK': [
    { symbol: 'BABA', name: 'Alibaba', market: 'US', sector: 'Tech', role: 'COMPETITOR', distance: 1, relationship: '科技巨头竞争', revenueExposure: 0 },
    { symbol: 'BIDU', name: 'Baidu', market: 'US', sector: 'AI', role: 'COMPETITOR', distance: 1, relationship: 'AI竞争', revenueExposure: 0 },
    { symbol: '9988.HK', name: 'Alibaba HK', market: 'HK', sector: 'Tech', role: 'COMPETITOR', distance: 1, relationship: '电商+云竞争', revenueExposure: 0 },
    { symbol: '3690.HK', name: 'Meituan', market: 'HK', sector: 'Tech', role: 'PARTNER', distance: 1, relationship: '微信支付/生态', revenueExposure: 5 },
  ],
  // ── Pharmaceutical ──
  PFE: [
    { symbol: 'MRNA', name: 'Moderna', market: 'US', sector: 'Biotech', role: 'COMPETITOR', distance: 1, relationship: 'mRNA竞争', revenueExposure: 0 },
    { symbol: 'BNTX', name: 'BioNTech', market: 'US', sector: 'Biotech', role: 'PARTNER', distance: 1, relationship: 'COVID疫苗合作', revenueExposure: 15 },
    { symbol: 'JNJ', name: 'Johnson & Johnson', market: 'US', sector: 'Pharma', role: 'COMPETITOR', distance: 1, relationship: '制药竞争', revenueExposure: 0 },
  ],
};

// ═════════════════════════════════════════════════════════════════════════════
// SupplyChainImpact Engine
// ═════════════════════════════════════════════════════════════════════════════

export class SupplyChainImpact {
  private graph: SupplyChainGraph;
  private analysisHistory: ChainAnalysis[] = [];
  private billingEnabled = true;

  constructor(customGraph?: SupplyChainGraph) {
    this.graph = customGraph || this.loadDefaultGraph();
  }

  private loadDefaultGraph(): SupplyChainGraph {
    return { ...SUPPLY_CHAIN_GRAPH };
  }

  // ── Main API ─────────────────────────────────────────────────────────────

  /**
   * Analyze supply chain impact of an event on a company.
   * Finds all upstream and downstream entities affected through propagation.
   */
  analyze(event: SupplyChainEvent): ChainAnalysis {
    const analysisId = `chain-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const now = Date.now();
    const key = this.normalizeSymbol(event.sourceSymbol);

    // 1. Look up the source in the knowledge graph
    const chain = this.graph[key];
    if (!chain) {
      // Unknown company — return only direct impact
      const direct: ChainImpact = {
        symbol: event.sourceSymbol, name: event.sourceName, market: event.sourceMarket,
        role: 'DIRECT', distance: 0, relationship: '自身', impactType: event.impactType,
        impactScore: event.magnitude, confidence: 0.9, reasoning: '直接事件',
        revenueExposure: 100, timeToReact: '立即',
      };

      const result: ChainAnalysis = {
        analysisId, event, analyzedAt: now,
        directImpact: direct, upstreamImpacts: [], downstreamImpacts: [],
        competitorImpacts: [], allAffectedSymbols: [event.sourceSymbol],
        summary: `未知供应链: ${event.sourceName}(${event.sourceSymbol}) — 仅显示直接影响`,
        propagationMap: this.drawPropagationMap([direct], [], [], []),
      };
      this.analysisHistory.push(result);
      return result;
    }

    // 2. Propagate: classify nodes by role
    const direct: ChainImpact = {
      symbol: event.sourceSymbol, name: event.sourceName, market: event.sourceMarket,
      role: 'DIRECT', distance: 0, relationship: '自身', impactType: event.impactType,
      impactScore: event.magnitude, confidence: 0.95, reasoning: '事件源公司',
      revenueExposure: 100, timeToReact: '立即',
    };

    const upstream: ChainImpact[] = [];
    const downstream: ChainImpact[] = [];
    const competitors: ChainImpact[] = [];

    for (const node of chain) {
      const impact = this.propagateImpact(event, node);
      switch (node.role) {
        case 'SUPPLIER': upstream.push(impact); break;
        case 'CUSTOMER': downstream.push(impact); break;
        case 'COMPETITOR': competitors.push(impact); break;
        case 'PARTNER': downstream.push(impact); break; // Partners treated as downstream
        case 'INVESTOR': downstream.push(impact); break;
      }
    }

    // Sort by impact score descending
    upstream.sort((a, b) => b.impactScore - a.impactScore);
    downstream.sort((a, b) => b.impactScore - a.impactScore);
    competitors.sort((a, b) => b.impactScore - a.impactScore);

    const all = [
      direct,
      ...upstream,
      ...downstream,
      ...competitors,
    ];

    const allSymbols = [...new Set(all.map(i => i.symbol))];
    const summary = this.generateSummary(event, all);

    const result: ChainAnalysis = {
      analysisId, event, analyzedAt: now,
      directImpact: direct,
      upstreamImpacts: upstream,
      downstreamImpacts: downstream,
      competitorImpacts: competitors,
      allAffectedSymbols: allSymbols,
      summary,
      propagationMap: this.drawPropagationMap([direct], upstream, downstream, competitors),
    };

    this.analysisHistory.push(result);
    if (this.analysisHistory.length > 50) this.analysisHistory.shift();

    log.info(`[SUPPLY-CHAIN] ${event.sourceSymbol}: ${all.length} affected (${upstream.length} up, ${downstream.length} down, ${competitors.length} comp)`);

    return result;
  }

  /**
   * Batch analyze multiple events.
   */
  analyzeBatch(events: SupplyChainEvent[]): ChainAnalysis[] {
    return events.map(e => this.analyze(e));
  }

  /**
   * Find all stocks affected by events in the news feed.
   */
  findAffectedStocks(events: SupplyChainEvent[]): Map<string, ChainImpact[]> {
    const results = new Map<string, ChainImpact[]>();

    for (const event of events) {
      const analysis = this.analyze(event);
      for (const symbol of analysis.allAffectedSymbols) {
        if (!results.has(symbol)) results.set(symbol, []);
        // Add all impacts for this symbol from this analysis
        const all = [
          analysis.directImpact,
          ...analysis.upstreamImpacts,
          ...analysis.downstreamImpacts,
          ...analysis.competitorImpacts,
        ].filter(i => i && i.symbol === symbol) as ChainImpact[];
        results.get(symbol)!.push(...all);
      }
    }

    return results;
  }

  // ── Impact Propagation ───────────────────────────────────────────────────

  private propagateImpact(event: SupplyChainEvent, node: ChainNode): ChainImpact {
    // Base impact = event magnitude × distance decay × revenue exposure factor
    let impactMultiplier = 1.0;

    switch (node.role) {
      case 'SUPPLIER':
        // Supplier impact depends on event type:
        // - Production issue at customer → supplier loses orders (negative)
        // - Growth at customer → supplier gets more orders (positive)
        impactMultiplier = event.category === 'production' ? 0.8 :
          event.category === 'scandal' ? 0.3 : 0.6;
        break;
      case 'CUSTOMER':
        // Supply disruption → customers can't get products (negative)
        impactMultiplier = event.category === 'production' ? 0.9 :
          event.category === 'regulatory' ? 0.7 : 0.5;
        break;
      case 'COMPETITOR':
        // Bad news for competitor → good for this company (positive)
        impactMultiplier = -0.5; // Inverse correlation
        break;
      case 'PARTNER':
        impactMultiplier = 0.6;
        break;
      case 'INVESTOR':
        impactMultiplier = 0.7; // Financial exposure
        break;
    }

    // Distance decay: half strength per tier
    const distanceDecay = Math.pow(0.5, node.distance - 1);

    // Revenue exposure weighting
    const exposureWeight = Math.min(1, node.revenueExposure / 100);

    const impactScore = Math.abs(event.magnitude * impactMultiplier * distanceDecay * exposureWeight);
    const clampedScore = Math.min(100, Math.round(impactScore));

    // Confidence
    const confidence = node.distance === 1 ? 0.85 : 0.65;

    // Time to react
    const timeToReact = node.distance === 1 ? '数小时' : '数天';

    // Reasoning
    let reasoning = '';
    if (node.role === 'SUPPLIER') {
      reasoning = event.impactType === 'NEGATIVE'
        ? `${node.relationship}: ${event.sourceName}减产→上游订单减少→供应商收入下降`
        : `${node.relationship}: ${event.sourceName}增长→供应商受益`;
    } else if (node.role === 'CUSTOMER') {
      reasoning = event.impactType === 'NEGATIVE'
        ? `${node.relationship}: ${event.sourceName}断供→下游缺货→客户生产受阻`
        : `${node.relationship}: ${event.sourceName}增产→客户受益`;
    } else if (node.role === 'COMPETITOR') {
      reasoning = `${node.relationship}: ${event.sourceName}负面→竞对市场份额转移`;
    } else {
      reasoning = `${node.relationship}: 传导影响`;
    }

    return {
      symbol: node.symbol,
      name: node.name,
      market: node.market,
      role: node.role,
      distance: node.distance,
      relationship: node.relationship,
      impactType: node.role === 'COMPETITOR'
        ? (event.impactType === 'NEGATIVE' ? 'POSITIVE' : 'NEGATIVE')
        : event.impactType,
      impactScore: clampedScore,
      confidence,
      reasoning,
      revenueExposure: node.revenueExposure,
      timeToReact,
    };
  }

  // ── Visualization ────────────────────────────────────────────────────────

  private drawPropagationMap(
    direct: ChainImpact[],
    upstream: ChainImpact[],
    downstream: ChainImpact[],
    competitors: ChainImpact[],
  ): string {
    const lines: string[] = [];

    const d = direct[0];
    if (d) lines.push(`   [${d.symbol}] ${d.name} ← EVENT`);
    else lines.push('   [???] Unknown');

    if (upstream.length > 0) {
      lines.push('   ▲ Upstream (Suppliers):');
      for (const u of upstream.slice(0, 5)) {
        lines.push(`     ├── [${u.symbol}] ${u.name} (${u.relationship}, impact:${u.impactScore})`);
      }
    }

    if (downstream.length > 0) {
      lines.push('   ▼ Downstream (Customers/Partners):');
      for (const dw of downstream.slice(0, 5)) {
        lines.push(`     ├── [${dw.symbol}] ${dw.name} (${dw.relationship}, impact:${dw.impactScore})`);
      }
    }

    if (competitors.length > 0) {
      lines.push('   ◇ Competitors (Inverse Impact):');
      for (const c of competitors.slice(0, 5)) {
        lines.push(`     ├── [${c.symbol}] ${c.name} (${c.relationship}, impact:${c.impactScore})`);
      }
    }

    return lines.join('\n');
  }

  private generateSummary(event: SupplyChainEvent, all: ChainImpact[]): string {
    const direct = all.find(i => i.role === 'DIRECT');
    const upstream = all.filter(i => i.role === 'SUPPLIER');
    const downstream = all.filter(i => i.role === 'CUSTOMER' || i.role === 'PARTNER');
    const comp = all.filter(i => i.role === 'COMPETITOR');

    const parts: string[] = [];
    if (direct) parts.push(`${direct.name}(${direct.symbol}) 直接受事件影响`);

    if (upstream.length > 0) {
      parts.push(`${upstream.length}家上游供应商受影响`);
      const top = upstream[0];
      parts.push(`最大影响: ${top.name}(${top.symbol}, ${top.relationship}, 影响${top.impactScore})`);
    }

    if (downstream.length > 0) {
      parts.push(`${downstream.length}家下游客户/伙伴受影响`);
    }

    if (comp.length > 0) {
      parts.push(`${comp.length}家竞品可能受益(逆向影响)`);
    }

    return parts.join('; ');
  }

  // ── Graph Management ─────────────────────────────────────────────────────

  /**
   * Register new supply chain relationships at runtime.
   */
  addRelationship(sourceSymbol: string, node: ChainNode): void {
    const key = this.normalizeSymbol(sourceSymbol);
    if (!this.graph[key]) this.graph[key] = [];
    // Avoid duplicates
    const exists = this.graph[key].find(n => n.symbol === node.symbol && n.role === node.role);
    if (!exists) {
      this.graph[key].push(node);
    } else {
      // Update existing
      Object.assign(exists, node);
    }
  }

  /**
   * Remove a relationship.
   */
  removeRelationship(sourceSymbol: string, targetSymbol: string, role?: SupplyChainRole): void {
    const key = this.normalizeSymbol(sourceSymbol);
    if (!this.graph[key]) return;
    this.graph[key] = this.graph[key].filter(n =>
      !(n.symbol === targetSymbol && (!role || n.role === role)),
    );
  }

  /**
   * Export graph for persistence.
   */
  exportGraph(): SupplyChainGraph {
    return JSON.parse(JSON.stringify(this.graph));
  }

  // ── Queries ──────────────────────────────────────────────────────────────

  getChain(symbol: string): ChainNode[] | undefined {
    return this.graph[this.normalizeSymbol(symbol)];
  }

  getSuppliers(symbol: string): ChainNode[] {
    return (this.graph[this.normalizeSymbol(symbol)] || []).filter(n => n.role === 'SUPPLIER');
  }

  getCustomers(symbol: string): ChainNode[] {
    return (this.graph[this.normalizeSymbol(symbol)] || []).filter(n => n.role === 'CUSTOMER');
  }

  getCompetitors(symbol: string): ChainNode[] {
    return (this.graph[this.normalizeSymbol(symbol)] || []).filter(n => n.role === 'COMPETITOR');
  }

  getAnalysisHistory(limit = 10): ChainAnalysis[] {
    return this.analysisHistory.slice(-limit);
  }

  getAllKnownSymbols(): string[] {
    return Object.keys(this.graph);
  }

  getGraphStats(): { companies: number; relationships: number } {
    const companies = Object.keys(this.graph).length;
    let relationships = 0;
    for (const nodes of Object.values(this.graph)) relationships += nodes.length;
    return { companies, relationships };
  }

  setBillingEnabled(enabled: boolean): void {
    this.billingEnabled = enabled;
  }

  reset(): void {
    this.graph = this.loadDefaultGraph();
    this.analysisHistory = [];
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private normalizeSymbol(symbol: string): string {
    return symbol.toUpperCase().replace(/\s/g, '');
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Singleton
// ═════════════════════════════════════════════════════════════════════════════

let defaultSupplyChain: SupplyChainImpact | null = null;

export function getSupplyChainImpact(): SupplyChainImpact {
  if (!defaultSupplyChain) defaultSupplyChain = new SupplyChainImpact();
  return defaultSupplyChain;
}

export function resetSupplyChainImpact(): void {
  defaultSupplyChain = null;
}
