// ── R175 G6: Factor User Profile Engine ────────────────────────────────
// Records user historical factor preferences, IC attention, and style bias.
// Provides smart pre-fill for AI factor recommendation forms.
//
// Architecture:
//   getUserProfile() → reads persisted JSON
//   updateProfile() → writes back after each recommendation
//   resetProfile() → clears all history
//   getPreFillFactors() → top-3 most-used factors + style preference
//
// Persistence: JSON file in app userData dir

import log from 'electron-log';
import * as fs from 'fs';
// path removed (SSR compat)

// ── Types ───────────────────────────────────────────────────────────────────

export interface FactorUsageRecord {
  factorId: string;
  nameCN: string;
  totalWeight: number;       // cumulative weight across all recommendations
  timesUsed: number;
  lastUsed: number;          // unix ms
  avgIC: number;             // average IC when this factor was used
  markets: string[];         // markets where used
}

export interface StylePreference {
  dominant: string;          // 'momentum' | 'value' | 'quality' | 'growth' | 'defensive' | 'balanced' | 'crypto'
  secondary: string;
  confidence: number;        // 0-1 based on usage frequency
  momentumScore: number;
  valueScore: number;
  qualityScore: number;
  growthScore: number;
  defensiveScore: number;
  cryptoScore: number;
}

export interface UserFactorProfile {
  userId: string;
  createdAt: number;
  updatedAt: number;
  totalRecommendations: number;
  totalSessions: number;
  factorUsage: FactorUsageRecord[];
  topFactors: string[];          // top-5 by timesUsed
  preferredMarkets: string[];    // sorted by frequency
  stylePreference: StylePreference;
  recentIntents: Array<{ intent: string; timestamp: number }>; // last 20
  icWatchlist: string[];         // factors user explicitly tracks
}

// ── Style Classification Maps ───────────────────────────────────────────────

const FACTOR_STYLE_MAP: Record<string, string> = {
  MOM_12M: 'momentum', MOM_1M: 'momentum', MA_20_60: 'momentum',
  EMA_12_26: 'momentum', RSI_14: 'momentum', ADX: 'momentum',
  HML: 'value', YIELD: 'value',
  QUAL: 'quality', RMW: 'quality', CMA: 'quality',
  GROWTH: 'growth',
  VOL_60D: 'defensive', ATR_14: 'defensive', BOLL: 'defensive',
  SIZE: 'growth', LIQ: 'balanced',
  CRYPTO_FUNDING: 'crypto', CRYPTO_LIQUIDATIONS: 'crypto',
  CRYPTO_EXCHANGE_FLOW: 'crypto', CRYPTO_OI_DELTA: 'crypto',
};

// ── Factor User Profile Engine ─────────────────────────────────────────────

export class FactorUserProfile {
  private static instance: FactorUserProfile;
  private cache: Map<string, UserFactorProfile> = new Map();
  private profileDir: string;

  private constructor() {
    this.profileDir = process.cwd().replace(/\\/g, '/') + '/.factor-profiles';
    try {
      const { app } = require('electron');
      this.profileDir = app.getPath('userData').replace(/\\/g, '/') + '/factor-profiles';
    } catch { /* non-electron env, use cwd fallback */ }
    try {
      if (!fs.existsSync(this.profileDir)) {
        fs.mkdirSync(this.profileDir, { recursive: true });
      }
    } catch { /* SSR/vitest: fs not available */ }
    log.info('[FactorUserProfile] Initialized, dir:', this.profileDir);
  }

  static getInstance(): FactorUserProfile {
    if (!FactorUserProfile.instance) {
      FactorUserProfile.instance = new FactorUserProfile();
    }
    return FactorUserProfile.instance;
  }

  // ── Core CRUD ────────────────────────────────────────────────────────

  /**
   * Get user profile. Creates default if not exists.
   */
  getUserProfile(userId: string): UserFactorProfile {
    if (this.cache.has(userId)) {
      return this.cache.get(userId)!;
    }

    const filePath = this.profilePath(userId);
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const profile = JSON.parse(raw) as UserFactorProfile;
        this.cache.set(userId, profile);
        return profile;
      }
    } catch (e: any) {
      // SSR/vitest: fs unavailable, use default
    }

    // Create default
    const profile = this.createDefaultProfile(userId);
    this.cache.set(userId, profile);
    this.persist(profile);
    return profile;
  }

  /**
   * Update profile with new recommendation data.
   */
  updateProfile(
    userId: string,
    factors: Array<{ factorId: string; nameCN: string; weight: number; ic?: number }>,
    intent: string,
    market: string,
  ): UserFactorProfile {
    const profile = this.getUserProfile(userId);
    const now = Date.now();

    profile.totalRecommendations++;
    profile.updatedAt = now;

    // ── Update factor usage ──
    const factorMap = new Map(profile.factorUsage.map(f => [f.factorId, f]));
    for (const f of factors) {
      let record = factorMap.get(f.factorId);
      if (!record) {
        record = {
          factorId: f.factorId,
          nameCN: f.nameCN,
          totalWeight: 0,
          timesUsed: 0,
          lastUsed: 0,
          avgIC: 0,
          markets: [],
        };
        profile.factorUsage.push(record);
      }
      record.totalWeight += f.weight;
      record.timesUsed++;
      record.lastUsed = now;
      if (f.ic !== undefined) {
        record.avgIC = (record.avgIC * (record.timesUsed - 1) + f.ic) / record.timesUsed;
      }
      if (!record.markets.includes(market)) {
        record.markets.push(market);
      }
    }

    // ── Recomputed top factors ──
    profile.topFactors = profile.factorUsage
      .sort((a, b) => b.timesUsed - a.timesUsed)
      .slice(0, 5)
      .map(f => f.factorId);

    // ── Preferred markets ──
    const marketCounts: Record<string, number> = {};
    for (const f of profile.factorUsage) {
      for (const m of f.markets) {
        marketCounts[m] = (marketCounts[m] || 0) + 1;
      }
    }
    profile.preferredMarkets = Object.entries(marketCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([m]) => m);

    // ── Style preference ──
    const styleScores: Record<string, number> = { momentum: 0, value: 0, quality: 0, growth: 0, defensive: 0, balanced: 0, crypto: 0 };
    for (const f of profile.factorUsage) {
      const style = FACTOR_STYLE_MAP[f.factorId] || 'balanced';
      styleScores[style] = (styleScores[style] || 0) + f.timesUsed;
    }
    const sortedStyles = Object.entries(styleScores)
      .sort((a, b) => b[1] - a[1]);
    profile.stylePreference = {
      dominant: sortedStyles[0]?.[0] || 'balanced',
      secondary: sortedStyles[1]?.[0] || 'balanced',
      confidence: sortedStyles[0]?.[1] > 0 ? sortedStyles[0][1] / (profile.totalRecommendations || 1) : 0,
      momentumScore: styleScores.momentum || 0,
      valueScore: styleScores.value || 0,
      qualityScore: styleScores.quality || 0,
      growthScore: styleScores.growth || 0,
      defensiveScore: styleScores.defensive || 0,
      cryptoScore: styleScores.crypto || 0,
    };

    // ── Track recent intents ──
    profile.recentIntents.push({ intent, timestamp: now });
    if (profile.recentIntents.length > 20) {
      profile.recentIntents = profile.recentIntents.slice(-20);
    }

    this.cache.set(userId, profile);
    this.persist(profile);
    return profile;
  }

  /**
   * Add a factor to the IC watchlist.
   */
  addToWatchlist(userId: string, factorId: string): void {
    const profile = this.getUserProfile(userId);
    if (!profile.icWatchlist.includes(factorId)) {
      profile.icWatchlist.push(factorId);
      this.persist(profile);
    }
  }

  /**
   * Remove a factor from the IC watchlist.
   */
  removeFromWatchlist(userId: string, factorId: string): void {
    const profile = this.getUserProfile(userId);
    profile.icWatchlist = profile.icWatchlist.filter(f => f !== factorId);
    this.persist(profile);
  }

  /**
   * Get smart pre-fill factors for AI recommendation.
   * Returns user's top-3 most-used factors + style preference for the form.
   */
  getPreFillFactors(userId: string): {
    suggestedFactorIds: string[];
    suggestedWeights: number[];
    dominantStyle: string;
    preferredMarket: string;
    confidence: number;
  } {
    const profile = this.getUserProfile(userId);

    if (profile.totalRecommendations === 0) {
      return {
        suggestedFactorIds: ['QUAL', 'MOM_12M', 'HML'],
        suggestedWeights: [0.35, 0.35, 0.30],
        dominantStyle: 'balanced',
        preferredMarket: 'US',
        confidence: 0,
      };
    }

    // Top-3 factors by usage frequency
    const top3 = profile.factorUsage
      .sort((a, b) => b.timesUsed - a.timesUsed)
      .slice(0, 3);

    const ids = top3.map(f => f.factorId);
    const totalW = top3.reduce((s, f) => s + f.timesUsed, 0);
    const weights = top3.map(f => Number((f.timesUsed / totalW).toFixed(2)));

    // Normalize to sum=1
    const wTotal = weights.reduce((a, b) => a + b, 0);
    const normalizedWeights = weights.map(w => Number((w / wTotal).toFixed(2)));

    return {
      suggestedFactorIds: ids,
      suggestedWeights: normalizedWeights,
      dominantStyle: profile.stylePreference.dominant,
      preferredMarket: profile.preferredMarkets[0] || 'US',
      confidence: profile.stylePreference.confidence,
    };
  }

  /**
   * Get all profiles (for admin/debug).
   */
  getAllProfiles(): UserFactorProfile[] {
    try {
      const files = fs.readdirSync(this.profileDir).filter(f => f.endsWith('.json'));
      return files.map(f => {
        const raw = fs.readFileSync(this.profileDir + '/' + f, 'utf-8');
        return JSON.parse(raw) as UserFactorProfile;
      });
    } catch {
      return [];
    }
  }

  /**
   * Reset profile to defaults.
   */
  resetProfile(userId: string): UserFactorProfile {
    const profile = this.createDefaultProfile(userId);
    this.cache.set(userId, profile);
    this.persist(profile);
    return profile;
  }

  /**
   * New session counter.
   */
  incrementSessions(userId: string): void {
    const profile = this.getUserProfile(userId);
    profile.totalSessions++;
    profile.updatedAt = Date.now();
    this.persist(profile);
  }

  // ── Private ──────────────────────────────────────────────────────────

  private profilePath(userId: string): string {
    return this.profileDir + '/' + userId + '.json';
  }

  private createDefaultProfile(userId: string): UserFactorProfile {
    const now = Date.now();
    return {
      userId,
      createdAt: now,
      updatedAt: now,
      totalRecommendations: 0,
      totalSessions: 0,
      factorUsage: [],
      topFactors: [],
      preferredMarkets: [],
      stylePreference: {
        dominant: 'balanced',
        secondary: 'momentum',
        confidence: 0,
        momentumScore: 0,
        valueScore: 0,
        qualityScore: 0,
        growthScore: 0,
        defensiveScore: 0,
        cryptoScore: 0,
      },
      recentIntents: [],
      icWatchlist: [],
    };
  }

  private persist(profile: UserFactorProfile): void {
    try {
      const filePath = this.profilePath(profile.userId);
      fs.writeFileSync(filePath, JSON.stringify(profile, null, 2), 'utf-8');
    } catch (e: any) {
      // SSR/vitest: fs unavailable, cache-only mode
    }
  }
}

// ── Singleton accessor ─────────────────────────────────────────────────────

export function getFactorUserProfile(): FactorUserProfile {
  return FactorUserProfile.getInstance();
}

export default FactorUserProfile;
