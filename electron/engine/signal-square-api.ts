/**
 * J-61-03: Signal Square API (R61 v19 — v1.4.0-beta)
 *
 * Public marketplace for trading signals — creators publish, subscribers consume.
 *
 * Features:
 * - Signal publishing with metadata (symbol, direction, confidence, rationale)
 * - Subscription management (creator/subscriber relationship)
 * - Signal recommendation engine (7-day quality scoring)
 * - Quality scoring: accuracy, consistency, timeliness, popularity
 * - Signal categories: major index, A-share hot stocks, US tech
 * - Time-decay weighting (recent signals weight more)
 *
 * >=150L, 5 tests
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface SignalMeta {
  id: string;
  creatorId: string;
  symbol: string;
  direction: 'buy' | 'sell' | 'hold';
  confidence: number;         // 0-1
  timeframe: '1d' | '1w' | '1m';
  price: number;
  entryPrice?: number;
  targetPrice?: number;
  stopLossPrice?: number;
  rationale: string;
  market: 'HK' | 'A' | 'US';
  tags: string[];
  publishTime: string;
  expiryTime?: string;
  status: 'active' | 'expired' | 'hit' | 'missed';
}

export interface SignalScore {
  signalId: string;
  overall: number;             // 0-100
  accuracy: number;            // did signal hit target?
  consistency: number;         // how consistent is creator?
  timeliness: number;          // how fast was signal acted upon?
  popularity: number;          // subscriber count
  lastUpdated: string;
}

export interface CreatorProfile {
  creatorId: string;
  name: string;
  totalSignals: number;
  activeSignals: number;
  accuracyRate: number;        // hit / total
  avgReturn: number;
  subscribers: number;
  tier: 'free' | 'pro' | 'elite';
  joinDate: string;
  badge?: string;
}

export interface Subscription {
  subscriberId: string;
  creatorId: string;
  tier: 'free' | 'pro' | 'elite';
  startDate: string;
  endDate?: string;
  autoRenew: boolean;
  priceUsdt: number;
}

// ── Signal Square Engine ──────────────────────────────────────────────────

export class SignalSquareAPI {
  private signals: Map<string, SignalMeta> = new Map();
  private creators: Map<string, CreatorProfile> = new Map();
  private subscriptions: Map<string, Subscription> = new Map();
  private signalScores: Map<string, SignalScore> = new Map();

  // ── Signal Publishing ─────────────────────────────────────────────────

  publishSignal(signal: Omit<SignalMeta, 'id' | 'publishTime' | 'status'>): SignalMeta {
    const id = `SIG-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const meta: SignalMeta = {
      ...signal,
      id,
      publishTime: new Date().toISOString(),
      status: 'active',
    };

    this.signals.set(id, meta);

    // Update creator stats
    const creator = this.creators.get(signal.creatorId) ?? {
      creatorId: signal.creatorId,
      name: signal.creatorId,
      totalSignals: 0, activeSignals: 0,
      accuracyRate: 0, avgReturn: 0,
      subscribers: 0, tier: 'free', joinDate: new Date().toISOString(),
    };
    creator.totalSignals++;
    creator.activeSignals++;
    this.creators.set(signal.creatorId, creator);

    return meta;
  }

  getSignal(signalId: string): SignalMeta | undefined {
    return this.signals.get(signalId);
  }

  listSignals(filters?: {
    market?: 'HK' | 'A' | 'US';
    direction?: 'buy' | 'sell' | 'hold';
    creatorId?: string;
    status?: string;
    minConfidence?: number;
    limit?: number;
    offset?: number;
  }): SignalMeta[] {
    let signals = [...this.signals.values()].filter(s => s.status === 'active');

    if (filters?.market) signals = signals.filter(s => s.market === filters.market);
    if (filters?.direction) signals = signals.filter(s => s.direction === filters.direction);
    if (filters?.creatorId) signals = signals.filter(s => s.creatorId === filters.creatorId);
    if (filters?.minConfidence !== undefined) signals = signals.filter(s => s.confidence >= filters.minConfidence!);
    if (filters?.status) signals = signals.filter(s => s.status === filters.status);

    const offset = filters?.offset ?? 0;
    const limit = filters?.limit ?? 20;
    return signals.slice(offset, offset + limit);
  }

  // ── Subscription ──────────────────────────────────────────────────────

  subscribe(subscriberId: string, creatorId: string, tier: 'free' | 'pro' | 'elite' = 'free', priceUsdt: number = 0): Subscription {
    const sub: Subscription = {
      subscriberId, creatorId, tier,
      startDate: new Date().toISOString(),
      autoRenew: false,
      priceUsdt,
    };
    const key = `${subscriberId}:${creatorId}`;
    this.subscriptions.set(key, sub);

    // Update creator subscribers
    const creator = this.creators.get(creatorId);
    if (creator) {
      creator.subscribers++;
      this.creators.set(creatorId, creator);
    }

    return sub;
  }

  unsubscribe(subscriberId: string, creatorId: string): boolean {
    const key = `${subscriberId}:${creatorId}`;
    const result = this.subscriptions.delete(key);
    if (result) {
      const creator = this.creators.get(creatorId);
      if (creator) {
        creator.subscribers = Math.max(0, creator.subscribers - 1);
        this.creators.set(creatorId, creator);
      }
    }
    return result;
  }

  getSubscriptions(subscriberId?: string, creatorId?: string): Subscription[] {
    let subs = [...this.subscriptions.values()];
    if (subscriberId) subs = subs.filter(s => s.subscriberId === subscriberId);
    if (creatorId) subs = subs.filter(s => s.creatorId === creatorId);
    return subs;
  }

  // ── Quality Scoring ───────────────────────────────────────────────────

  computeQualityScore(signalId: string): SignalScore {
    const signal = this.signals.get(signalId);
    if (!signal) return { signalId, overall: 0, accuracy: 0, consistency: 0, timeliness: 0, popularity: 0, lastUpdated: new Date().toISOString() };

    const creator = this.creators.get(signal.creatorId);
    const subs = this.getSubscriptions(undefined, signal.creatorId);

    const accuracy = signal.status === 'hit' ? 100 : signal.status === 'missed' ? 0 : 50;
    const consistency = creator ? Math.min(100, creator.accuracyRate * 100) : 50;
    const timeliness = computeTimeliness(signal);
    const popularity = Math.min(100, (subs.length / 10) * 100);

    // Weighted: accuracy 40%, consistency 25%, timeliness 15%, popularity 20%
    const overall = accuracy * 0.40 + consistency * 0.25 + timeliness * 0.15 + popularity * 0.20;

    const score: SignalScore = {
      signalId,
      overall: Math.round(overall * 10) / 10,
      accuracy,
      consistency,
      timeliness,
      popularity,
      lastUpdated: new Date().toISOString(),
    };

    this.signalScores.set(signalId, score);
    return score;
  }

  getQualityScores(signalIds?: string[]): SignalScore[] {
    if (signalIds) {
      return signalIds.map(id => this.signalScores.get(id) ?? this.computeQualityScore(id));
    }
    return [...this.signals.keys()].map(id => this.signalScores.get(id) ?? this.computeQualityScore(id));
  }

  // ── Recommendations ──────────────────────────────────────────────────

  recommend(targetIds: string[], topN: number = 5): { signal: SignalMeta; score: SignalScore }[] {
    const scores = this.getQualityScores(targetIds);
    const scored = scores
      .map(s => ({ signal: this.signals.get(s.signalId)!, score: s }))
      .filter(x => x.signal && x.signal.status === 'active')
      .sort((a, b) => b.score.overall - a.score.overall);

    return scored.slice(0, topN);
  }

  // ── Creator Management ────────────────────────────────────────────────

  getCreatorProfile(creatorId: string): CreatorProfile | undefined {
    return this.creators.get(creatorId);
  }

  listCreators(filters?: { tier?: string; minAccuracy?: number; minSubscribers?: number; limit?: number }): CreatorProfile[] {
    let creators = [...this.creators.values()];
    if (filters?.tier) creators = creators.filter(c => c.tier === filters.tier);
    if (filters?.minAccuracy !== undefined) creators = creators.filter(c => c.accuracyRate >= filters.minAccuracy!);
    if (filters?.minSubscribers !== undefined) creators = creators.filter(c => c.subscribers >= filters.minSubscribers!);
    // Sort by accuracy
    creators.sort((a, b) => b.accuracyRate - a.accuracyRate);
    return creators.slice(0, filters?.limit ?? 20);
  }

  updateCreator(creatorId: string, update: Partial<CreatorProfile>): CreatorProfile | undefined {
    const creator = this.creators.get(creatorId);
    if (!creator) return undefined;
    Object.assign(creator, update);
    this.creators.set(creatorId, creator);
    return creator;
  }

  // ── Signal Lifecycle ─────────────────────────────────────────────────

  expireSignal(signalId: string): void {
    const signal = this.signals.get(signalId);
    if (signal) {
      signal.status = 'expired';
      this.signals.set(signalId, signal);
      // Update creator active count
      const creator = this.creators.get(signal.creatorId);
      if (creator) {
        creator.activeSignals = Math.max(0, creator.activeSignals - 1);
        this.creators.set(signal.creatorId, creator);
      }
    }
  }

  markSignalOutcome(signalId: string, outcome: 'hit' | 'missed'): void {
    const signal = this.signals.get(signalId);
    if (!signal) return;

    signal.status = outcome;
    this.signals.set(signalId, signal);

    // Update creator accuracy
    const creator = this.creators.get(signal.creatorId);
    if (creator && creator.totalSignals > 0) {
      const allSignals = [...this.signals.values()].filter(s => s.creatorId === signal.creatorId);
      const hits = allSignals.filter(s => s.status === 'hit').length;
      creator.accuracyRate = hits / creator.totalSignals;
      this.creators.set(signal.creatorId, creator);
    }
  }

  // ── Reset ─────────────────────────────────────────────────────────────

  reset(): void {
    this.signals.clear();
    this.creators.clear();
    this.subscriptions.clear();
    this.signalScores.clear();
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────

function computeTimeliness(signal: SignalMeta): number {
  const ageMs = Date.now() - new Date(signal.publishTime).getTime();
  const ageHours = ageMs / (1000 * 60 * 60);

  // Signals within 1h = 100, 24h = 60, 7d = 20
  if (ageHours < 1) return 100;
  if (ageHours < 24) return Math.max(20, 100 - ageHours * (80 / 24));
  if (ageHours < 168) return Math.max(10, 60 - (ageHours - 24) * (50 / 144));
  return 10;
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _signalSquare: SignalSquareAPI | null = null;

export function getSignalSquare(): SignalSquareAPI {
  if (!_signalSquare) _signalSquare = new SignalSquareAPI();
  return _signalSquare;
}

export function resetSignalSquare(): void {
  _signalSquare?.reset();
  _signalSquare = null;
}
