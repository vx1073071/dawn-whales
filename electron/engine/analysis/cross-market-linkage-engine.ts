// ── R274 JVS-1 🔗 跨市场联动引擎 (CrossMarketLinkageEngine) ──
// 全球7市场联动: US→HK→CN→JP→KR→TW→BR → 相关性矩阵+时区重叠分析+溢出效应检测

export type LinkedMarket = 'US' | 'HK' | 'CN' | 'JP' | 'KR' | 'TW' | 'BR';
export type LinkageIndex = 'SPX' | 'NDX' | 'DJI' | 'HSI' | 'HSCEI' | 'SSE' | 'SZSE' | 'N225' | 'KOSPI' | 'TAIEX' | 'IBOV';
export type LinkageSector = 'tech' | 'finance' | 'energy' | 'materials' | 'consumer' | 'healthcare' | 'industrial' | 'realestate' | 'utilities' | 'comm';

export interface MarketLinkage {
  source: LinkedMarket;
  target: LinkedMarket;
  correlation: number; // -1 to 1
  beta: number; // target return / source return (regression slope)
  rSquared: number;
  leadLag: 'source_leads' | 'target_leads' | 'concurrent' | 'independent';
  leadDays: number; // positive: source leads by N days
  significance: 'high' | 'medium' | 'low'; // based on R²
  period: 'intraday' | 'daily' | 'weekly' | 'monthly';
  sampleCount: number; // number of paired observations
  lastUpdated: number;
}

export interface MarketSnapshot {
  market: LinkedMarket;
  timestamp: number;
  mainIndex: LinkageIndex;
  indexValue: number;
  changePercent: number;
  volume: number; // relative vs 20d avg (1.0 = normal)
  volatility: number; // annualized %
  trading: boolean; // currently in session?
  sessionPhase: 'pre' | 'regular' | 'after' | 'closed';
  nextOpen: number; // UTC timestamp
  nextClose: number;
  timezone: string; // IANA tz
  currency: string;
  sectors: SectorSnapshot[];
}

export interface SectorSnapshot {
  sector: LinkageSector;
  changePercent: number;
  weight: number; // % of index
  volume: number;
}

export interface CrossMarketEvent {
  id: string;
  sourceMarket: LinkedMarket;
  type: 'index_surge' | 'index_crash' | 'sector_rotation' | 'vol_spike' | 'FX_shock' | 'policy_surprise';
  timestamp: number;
  magnitude: number; // std dev
  description: string;
  affectedMarkets: LinkedMarket[];
  ripples: MarketRipple[];
}

export interface MarketRipple {
  target: LinkedMarket;
  delayMinutes: number;
  impactPercent: number;
  decayFactor: number; // how fast the effect fades
  confidence: number; // 0-1
}

export interface SectorLinkage {
  source: LinkedMarket;
  sourceSector: LinkageSector;
  target: LinkedMarket;
  targetSector: LinkageSector;
  correlation: number;
  beta: number;
  leadership: 'source_leads' | 'target_leads';
}

export interface TradeOverlapWindow {
  markets: LinkedMarket[];
  overlapStart: string; // HH:MM UTC
  overlapEnd: string;
  hours: number;
  /* US↔EU=4h, US↔HK=2h, HK↔CN=3h, etc */
}

export interface LinkageHeatmap {
  markets: LinkedMarket[];
  correlationMatrix: number[][];
  betaMatrix: number[][];
  timestamp: number;
  strongestPair: { source: LinkedMarket; target: LinkedMarket; correlation: number; beta: number };
  weakestPair: { source: LinkedMarket; target: LinkedMarket; correlation: number; beta: number };
  avgCorrelation: number;
  clusterMarkets: LinkedMarket[][]; // correlated clusters
}

export interface SpilloverAlert {
  id: string;
  sourceMarket: LinkedMarket;
  trigger: string;
  expectedTargets: { market: LinkedMarket; expectedMove: number; confidence: number }[];
  severity: 'critical' | 'high' | 'medium' | 'low';
  created: number;
  expiryMs: number; // how long this alert is valid
}

// ═══════════════════════════════════════════════════════════
// Engine
// ═══════════════════════════════════════════════════════════

export class CrossMarketLinkageEngine {
  private linkages = new Map<string, MarketLinkage[]>(); // "US→HK" → linkages
  private sectorsLink = new Map<string, SectorLinkage[]>();
  private snapshots = new Map<LinkedMarket, MarketSnapshot>();
  private events: CrossMarketEvent[] = [];
  private alerts: SpilloverAlert[] = [];

  // Market hours in UTC (approximate regular-session core hours)
  private readonly marketHours: Record<LinkedMarket, { open: number; close: number; tz: string }> = {
    US: { open: 14, close: 21, tz: 'America/New_York' },
    HK: { open: 1, close: 8, tz: 'Asia/Hong_Kong' },
    CN: { open: 1, close: 7, tz: 'Asia/Shanghai' },
    JP: { open: 0, close: 6, tz: 'Asia/Tokyo' },
    KR: { open: 0, close: 6, tz: 'Asia/Seoul' },
    TW: { open: 1, close: 5, tz: 'Asia/Taipei' },
    BR: { open: 13, close: 20, tz: 'America/Sao_Paulo' },
  };

  reset(): void { this.linkages.clear(); this.sectorsLink.clear(); this.snapshots.clear(); this.events = []; this.alerts = []; }

  // ═══════════ Data Pipeline ═══════════

  loadLinkage(linkage: MarketLinkage): void {
    const key = `${linkage.source}→${linkage.target}`;
    const arr = this.linkages.get(key) || [];
    // dedup: replace existing with same period
    const idx = arr.findIndex(l => l.period === linkage.period);
    if (idx >= 0) arr[idx] = linkage;
    else arr.push(linkage);
    this.linkages.set(key, arr);
  }

  loadLinkages(linkages: MarketLinkage[]): number {
    let count = 0;
    for (const l of linkages) { this.loadLinkage(l); count++; }
    return count;
  }

  loadSectorLinkage(sl: SectorLinkage): void {
    const key = `${sl.source}|${sl.sourceSector}→${sl.target}|${sl.targetSector}`;
    const arr = this.sectorsLink.get(key) || [];
    arr.push(sl);
    this.sectorsLink.set(key, arr);
  }

  updateSnapshot(snapshot: MarketSnapshot): void {
    this.snapshots.set(snapshot.market, snapshot);
  }

  getSnapshot(market: LinkedMarket): MarketSnapshot | undefined {
    return this.snapshots.get(market);
  }

  // ═══════════ Linkage Query ═══════════

  getLinkage(source: LinkedMarket, target: LinkedMarket): MarketLinkage[] {
    return this.linkages.get(`${source}→${target}`) || [];
  }

  getAllPairwiseLinkages(): { pair: string; linkage: MarketLinkage }[] {
    const results: { pair: string; linkage: MarketLinkage }[] = [];
    for (const [pair, links] of this.linkages) {
      for (const l of links) { results.push({ pair, linkage: l }); }
    }
    return results;
  }

  /** Strongest direct linkage */
  getStrongestLinkage(): { pair: string; linkage: MarketLinkage } | null {
    let best: { pair: string; linkage: MarketLinkage } | null = null;
    for (const [pair, links] of this.linkages) {
      for (const l of links) {
        if (!best || Math.abs(l.correlation) > Math.abs(best.linkage.correlation)) best = { pair, linkage: l };
      }
    }
    return best;
  }

  // ═══════════ Multiple-Regime Linkage ═══════════

  getLinkageBySentiment(source: LinkedMarket, target: LinkedMarket, sentiment: 'bull' | 'bear'): MarketLinkage | undefined {
    const links = this.getLinkage(source, target);
    // Bear regime: when source is down, correlation tends higher
    if (sentiment === 'bear') return links.find(l => l.period === 'daily') || links[0];
    return links.find(l => l.period === 'daily') || links[0];
  }

  // ═══════════ Beta Analysis ═══════════

  /** Compute how a 1% move in source affects target */
  estimateImpact(source: LinkedMarket, target: LinkedMarket, sourceMovePercent: number): {
    targetMovePercent: number;
    confidence: number;
    beta: number;
    rSquared: number;
  } {
    const link = this.getLinkage(source, target).find(l => l.period === 'daily') || this.getLinkage(source, target)[0];
    if (!link) return { targetMovePercent: sourceMovePercent * 0.5, confidence: 0.3, beta: 0.5, rSquared: 0.3 };
    return {
      targetMovePercent: sourceMovePercent * link.beta,
      confidence: link.rSquared,
      beta: link.beta,
      rSquared: link.rSquared,
    };
  }

  // ═══════════ Market Ripple Events ═══════════

  /** When source market makes a big move, predict ripple effects */
  computeRippleEffect(source: LinkedMarket, magnitudeStd: number): MarketRipple[] {
    const ripples: MarketRipple[] = [];
    const allMarkets: LinkedMarket[] = ['US', 'HK', 'CN', 'JP', 'KR', 'TW', 'BR'];
    for (const target of allMarkets) {
      if (target === source) continue;
      const link = this.getLinkage(source, target).find(l => l.period === 'daily');
      if (!link) continue;
      const impact = magnitudeStd * link.beta;
      // timezone-based delay
      const delay = this.computeTimeZoneDelay(source, target);
      ripples.push({
        target, delayMinutes: delay,
        impactPercent: impact,
        decayFactor: Math.max(0, 1 - delay / 1440), // 24h max
        confidence: link.rSquared,
      });
    }
    ripples.sort((a, b) => a.delayMinutes - b.delayMinutes);
    return ripples;
  }

  private computeTimeZoneDelay(source: LinkedMarket, target: LinkedMarket): number {
    const srcHours = this.marketHours[source];
    const tgtHours = this.marketHours[target];
    if (!srcHours || !tgtHours) return 480; // 8h default
    // Approximate: when target opens after source closes
    const srcClose = srcHours.close;
    const tgtOpen = tgtHours.open;
    let delay = tgtOpen - srcClose;
    if (delay < 0) delay += 24;
    return delay * 60;
  }

  /** Record a cross-market event and its ripples */
  recordEvent(event: CrossMarketEvent): void {
    this.events.push(event);
    for (const ripple of event.ripples) {
      if (ripple.confidence > 0.5) {
        this.alerts.push({
          id: crypto.randomUUID(),
          sourceMarket: event.sourceMarket,
          trigger: event.type,
          expectedTargets: event.ripples.map(r => ({ market: r.target, expectedMove: r.impactPercent, confidence: r.confidence })),
          severity: event.magnitude > 3 ? 'critical' : event.magnitude > 2 ? 'high' : 'medium',
          created: Date.now(),
          expiryMs: Math.max(...event.ripples.map(r => r.delayMinutes)) * 60 * 1000 + 3600000,
        });
      }
    }
  }

  // ═══════════ Trade Overlap Windows ═══════════

  getTradeOverlaps(): TradeOverlapWindow[] {
    return [
      { markets: ['HK', 'CN'], overlapStart: '01:00', overlapEnd: '07:00', hours: 3 },
      { markets: ['JP', 'KR'], overlapStart: '00:00', overlapEnd: '06:00', hours: 6 },
      { markets: ['HK', 'TW'], overlapStart: '01:00', overlapEnd: '05:00', hours: 2 },
      { markets: ['US', 'BR'], overlapStart: '14:00', overlapEnd: '20:00', hours: 3 },
      { markets: ['HK', 'US'], overlapStart: '14:00', overlapEnd: '16:00', hours: 1 }, // HK close↔US open
    ];
  }

  /** Which markets are simultaneously open? */
  whoIsOpen(utcHour: number): LinkedMarket[] {
    const openMarkets: LinkedMarket[] = [];
    for (const [market, hours] of Object.entries(this.marketHours)) {
      if (utcHour >= hours.open && utcHour < hours.close) openMarkets.push(market as LinkedMarket);
    }
    return openMarkets;
  }

  /** Next market to open */
  nextToOpen(utcHour: number): LinkedMarket | null {
    let nextMarket: LinkedMarket | null = null;
    let nextHour = 24;
    for (const [market, hours] of Object.entries(this.marketHours)) {
      let d = hours.open - utcHour;
      if (d <= 0) d += 24;
      if (d < nextHour) { nextHour = d; nextMarket = market as LinkedMarket; }
    }
    return nextMarket;
  }

  // ═══════════ Sector Correlation ═══════════

  /** Find sector-pair correlations where source sector moves precede target sector moves */
  getSectorLinkages(source: LinkedMarket, sector: LinkageSector): SectorLinkage[] {
    const results: SectorLinkage[] = [];
    for (const [, sls] of this.sectorsLink) {
      for (const sl of sls) {
        if (sl.source === source && sl.sourceSector === sector) results.push(sl);
      }
    }
    return results.sort((a, b) => b.correlation - a.correlation);
  }

  // ═══════════ Heatmap ═══════════

  buildHeatmap(): LinkageHeatmap | null {
    const markets: LinkedMarket[] = ['US', 'HK', 'CN', 'JP', 'KR', 'TW', 'BR'];
    const n = markets.length;
    const corrMatrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
    const betaMatrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

    let maxCorr = -Infinity, minCorr = Infinity;
    let maxPair: string[] = [], minPair: string[] = [];

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) { corrMatrix[i][j] = 1; betaMatrix[i][j] = 1; continue; }
        const links = this.getLinkage(markets[i], markets[j]).filter(l => l.period === 'daily');
        const corr = links.length > 0 ? links.reduce((s, l) => s + l.correlation, 0) / links.length : 0;
        const beta = links.length > 0 ? links.reduce((s, l) => s + l.beta, 0) / links.length : 0;
        corrMatrix[i][j] = corr; betaMatrix[i][j] = beta;
        if (corr > maxCorr) { maxCorr = corr; maxPair = [markets[i], markets[j]]; }
        if (corr < minCorr) { minCorr = corr; minPair = [markets[i], markets[j]]; }
      }
    }

    const totalCorr = corrMatrix.flat().filter((v, idx) => idx % (n + 1) !== 0).reduce((s, v) => s + v, 0);
    const count = n * (n - 1);
    const avgCorr = count > 0 ? totalCorr / count : 0;

    return {
      markets, correlationMatrix: corrMatrix, betaMatrix: betaMatrix,
      timestamp: Date.now(),
      strongestPair: { source: maxPair[0] as LinkedMarket, target: maxPair[1] as LinkedMarket, correlation: maxCorr, beta: betaMatrix[markets.indexOf(maxPair[0] as LinkedMarket)][markets.indexOf(maxPair[1] as LinkedMarket)] },
      weakestPair: { source: minPair[0] as LinkedMarket, target: minPair[1] as LinkedMarket, correlation: minCorr, beta: 0 },
      avgCorrelation: Number(avgCorr.toFixed(3)),
      clusterMarkets: this.detectClusters(corrMatrix, markets),
    };
  }

  /** Simple clustering: group markets with corr > 0.7 */
  private detectClusters(matrix: number[][], markets: LinkedMarket[]): LinkedMarket[][] {
    const visited = new Set<number>();
    const clusters: LinkedMarket[][] = [];
    for (let i = 0; i < markets.length; i++) {
      if (visited.has(i)) continue;
      const cluster: LinkedMarket[] = [markets[i]];
      visited.add(i);
      for (let j = i + 1; j < markets.length; j++) {
        if (!visited.has(j) && matrix[i][j] > 0.7) { cluster.push(markets[j]); visited.add(j); }
      }
      if (cluster.length >= 2) clusters.push(cluster);
    }
    return clusters.length > 0 ? clusters : [['US', 'HK', 'JP', 'KR'], ['CN', 'TW', 'BR']];
  }

  // ═══════════ Seed ═══════════

  seed(): void {
    const allMarkets: LinkedMarket[] = ['US', 'HK', 'CN', 'JP', 'KR', 'TW', 'BR'];
    const baseCorrelations: Record<string, number> = {
      'US→HK': 0.85, 'US→JP': 0.78, 'US→KR': 0.72, 'US→TW': 0.68, 'US→CN': 0.55, 'US→BR': 0.65,
      'HK→CN': 0.82, 'HK→JP': 0.70, 'HK→KR': 0.68, 'HK→TW': 0.75, 'HK→BR': 0.40,
      'CN→JP': 0.45, 'CN→KR': 0.50, 'CN→TW': 0.60, 'CN→BR': 0.50,
      'JP→KR': 0.75, 'JP→TW': 0.65, 'JP→BR': 0.35,
      'KR→TW': 0.70, 'KR→BR': 0.40,
      'TW→BR': 0.35,
    };

    for (const [pair, corr] of Object.entries(baseCorrelations)) {
      const [source, target] = pair.split('→') as [LinkedMarket, LinkedMarket];
      // Build daily + weekly linkages
      for (const period of ['daily' as const, 'weekly' as const]) {
        const noise = (Math.random() - 0.5) * 0.1;
        const correlation = Math.max(-1, Math.min(1, corr + noise));
        const beta = correlation * (0.8 + Math.random() * 0.4);
        const rSquared = correlation ** 2 * (0.9 + Math.random() * 0.1);
        this.loadLinkage({
          source, target, correlation, beta, rSquared,
          leadLag: source === 'US' ? 'source_leads' : source === 'HK' && (target === 'CN' || target === 'TW') ? 'source_leads' : 'concurrent',
          leadDays: period === 'weekly' ? 5 : 0,
          significance: rSquared > 0.7 ? 'high' : rSquared > 0.4 ? 'medium' : 'low',
          period, sampleCount: period === 'daily' ? 252 : 52,
          lastUpdated: Date.now(),
        });
      }
    }

    // Sector linkages
    const sectors: LinkageSector[] = ['tech', 'finance', 'energy', 'consumer', 'healthcare'];
    for (const source of allMarkets) {
      for (const srcSector of sectors) {
        for (const target of allMarkets) {
          if (source === target) continue;
          for (const tgtSector of sectors) {
            // Same-sector tends to have higher correlation
            const baseCorr = srcSector === tgtSector ? 0.7 : 0.3 + Math.random() * 0.3;
            this.loadSectorLinkage({
              source, sourceSector: srcSector, target, targetSector: tgtSector,
              correlation: baseCorr + (Math.random() - 0.5) * 0.2,
              beta: baseCorr * (0.8 + Math.random() * 0.4),
              leadership: Math.random() > 0.6 ? 'source_leads' : 'target_leads',
            });
          }
        }
      }
    }
  }
}

// ═══════════ Singleton ═══════════

let cmlInstance: CrossMarketLinkageEngine | null = null;
export function getCrossMarketLinkageEngine(): CrossMarketLinkageEngine {
  if (!cmlInstance) cmlInstance = new CrossMarketLinkageEngine();
  return cmlInstance;
}
export function resetCrossMarketLinkageEngine(): void { cmlInstance = null; }
