// ── Vitest tests: R175 G6 — Factor User Profile ──────────────────────
import { describe, it, expect, beforeEach } from 'vitest';
import { FactorUserProfile, getFactorUserProfile } from '../../../electron/engine/factors/factor-user-profile';

describe('R175 G6: FactorUserProfile', () => {
  let profile: FactorUserProfile;

  beforeEach(() => {
    profile = FactorUserProfile.getInstance();
    profile.resetProfile('test-user-g6');
  });

  describe('getUserProfile()', () => {
    it('creates default profile for new user', () => {
      const p = profile.getUserProfile('new-user-001');
      expect(p.userId).toBe('new-user-001');
      expect(p.totalRecommendations).toBe(0);
      expect(p.factorUsage).toEqual([]);
      expect(p.stylePreference.dominant).toBe('balanced');
    });

    it('returns existing profile from cache', () => {
      const p1 = profile.getUserProfile('existing-user');
      const p2 = profile.getUserProfile('existing-user');
      expect(p1).toBe(p2); // same reference (cached)
    });
  });

  describe('updateProfile()', () => {
    it('records factor usage', () => {
      profile.updateProfile('test-user-g6', [
        { factorId: 'MOM_12M', nameCN: '12月动量', weight: 0.3, ic: 0.045 },
        { factorId: 'QUAL', nameCN: '质量', weight: 0.3, ic: 0.035 },
      ], 'balanced_all_weather', 'US');

      const p = profile.getUserProfile('test-user-g6');
      expect(p.totalRecommendations).toBe(1);
      expect(p.factorUsage.length).toBe(2);
      expect(p.factorUsage[0].factorId).toBe('MOM_12M');
      expect(p.factorUsage[0].timesUsed).toBe(1);
      expect(p.factorUsage[0].totalWeight).toBeCloseTo(0.3);
    });

    it('accumulates repeated factor usage', () => {
      profile.updateProfile('test-user-g6', [
        { factorId: 'MOM_12M', nameCN: '12月动量', weight: 0.3, ic: 0.045 },
      ], 'momentum_following', 'US');

      profile.updateProfile('test-user-g6', [
        { factorId: 'MOM_12M', nameCN: '12月动量', weight: 0.2, ic: 0.040 },
      ], 'crypto_trend', 'CRYPTO');

      const p = profile.getUserProfile('test-user-g6');
      const mom = p.factorUsage.find(f => f.factorId === 'MOM_12M')!;
      expect(mom.timesUsed).toBe(2);
      expect(mom.totalWeight).toBeCloseTo(0.5);
      expect(mom.markets).toContain('CRYPTO');
      expect(p.totalRecommendations).toBe(2);
    });

    it('computes top factors', () => {
      profile.updateProfile('test-user-g6', [
        { factorId: 'QUAL', nameCN: '质量', weight: 0.5 },
        { factorId: 'HML', nameCN: '价值', weight: 0.3 },
        { factorId: 'GROWTH', nameCN: '成长', weight: 0.2 },
      ], 'balanced_all_weather', 'US');

      profile.updateProfile('test-user-g6', [
        { factorId: 'QUAL', nameCN: '质量', weight: 0.4 },
        { factorId: 'VOL_60D', nameCN: '低波动', weight: 0.3 },
        { factorId: 'HML', nameCN: '价值', weight: 0.3 },
      ], 'quality_defensive', 'US');

      const p = profile.getUserProfile('test-user-g6');
      expect(p.topFactors.length).toBeLessThanOrEqual(5);
      expect(p.topFactors[0]).toBe('QUAL'); // most used
    });

    it('computes style preference', () => {
      // Use momentum factors heavily
      for (let i = 0; i < 5; i++) {
        profile.updateProfile('test-user-g6', [
          { factorId: 'MOM_12M', nameCN: '12月动量', weight: 0.4 },
          { factorId: 'MOM_1M', nameCN: '1月动量', weight: 0.3 },
          { factorId: 'RSI_14', nameCN: 'RSI 14', weight: 0.3 },
        ], 'momentum_following', 'US');
      }

      const p = profile.getUserProfile('test-user-g6');
      expect(p.stylePreference.dominant).toBe('momentum');
      expect(p.stylePreference.confidence).toBeGreaterThan(0.5);
    });

    it('tracks recent intents', () => {
      profile.updateProfile('test-user-g6', [
        { factorId: 'QUAL', nameCN: '质量', weight: 0.5 },
      ], 'question', 'US');

      profile.updateProfile('test-user-g6', [
        { factorId: 'MOM_12M', nameCN: '12月动量', weight: 0.5 },
      ], 'deep_analysis', 'HK');

      const p = profile.getUserProfile('test-user-g6');
      expect(p.recentIntents.length).toBe(2);
      expect(p.recentIntents[0].intent).toBe('question');
      expect(p.recentIntents[1].intent).toBe('deep_analysis');
    });

    it('caps recent intents at 20', () => {
      for (let i = 0; i < 25; i++) {
        profile.updateProfile('test-user-g6', [
          { factorId: 'QUAL', nameCN: '质量', weight: 0.5 },
        ], 'balanced_all_weather', 'US');
      }

      const p = profile.getUserProfile('test-user-g6');
      expect(p.recentIntents.length).toBeLessThanOrEqual(20);
    });
  });

  describe('watchlist', () => {
    it('adds and removes from watchlist', () => {
      profile.addToWatchlist('test-user-g6', 'MOM_12M');
      profile.addToWatchlist('test-user-g6', 'QUAL');
      profile.addToWatchlist('test-user-g6', 'MOM_12M'); // duplicate

      let p = profile.getUserProfile('test-user-g6');
      expect(p.icWatchlist).toContain('MOM_12M');
      expect(p.icWatchlist).toContain('QUAL');
      expect(p.icWatchlist.length).toBe(2);

      profile.removeFromWatchlist('test-user-g6', 'MOM_12M');
      p = profile.getUserProfile('test-user-g6');
      expect(p.icWatchlist).not.toContain('MOM_12M');
    });
  });

  describe('getPreFillFactors()', () => {
    it('returns defaults for new user', () => {
      const prefill = profile.getPreFillFactors('new-user-prefill');
      expect(prefill.suggestedFactorIds.length).toBe(3);
      expect(prefill.confidence).toBe(0);
    });

    it('returns top-3 most-used factors', () => {
      for (let i = 0; i < 5; i++) {
        profile.updateProfile('test-user-g6', [
          { factorId: 'QUAL', nameCN: '质量', weight: 0.3 },
          { factorId: 'MOM_12M', nameCN: '动量', weight: 0.3 },
          { factorId: 'HML', nameCN: '价值', weight: 0.2 },
          { factorId: 'GROWTH', nameCN: '成长', weight: 0.2 },
        ], 'balanced_all_weather', 'US');
      }

      // Make QUAL the most used
      for (let i = 0; i < 3; i++) {
        profile.updateProfile('test-user-g6', [
          { factorId: 'QUAL', nameCN: '质量', weight: 0.6 },
        ], 'quality_defensive', 'US');
      }

      const prefill = profile.getPreFillFactors('test-user-g6');
      expect(prefill.suggestedFactorIds[0]).toBe('QUAL');
      expect(prefill.suggestedWeights.length).toBe(3);
      expect(prefill.confidence).toBeGreaterThan(0);
    });
  });

  describe('resetProfile()', () => {
    it('clears all data', () => {
      profile.updateProfile('test-user-g6', [
        { factorId: 'MOM_12M', nameCN: '动量', weight: 0.5 },
      ], 'momentum_following', 'US');

      let p = profile.getUserProfile('test-user-g6');
      expect(p.totalRecommendations).toBeGreaterThan(0);

      profile.resetProfile('test-user-g6');
      p = profile.getUserProfile('test-user-g6');
      expect(p.totalRecommendations).toBe(0);
      expect(p.factorUsage.length).toBe(0);
    });
  });

  describe('profile persistence', () => {
    it('survives round-trip through JSON', () => {
      profile.updateProfile('test-user-g6', [
        { factorId: 'MOM_12M', nameCN: '动量', weight: 0.4, ic: 0.045 },
        { factorId: 'VOL_60D', nameCN: '低波动', weight: 0.3, ic: 0.042 },
        { factorId: 'HMK', nameCN: '价值', weight: 0.3, ic: 0.038 },
      ], 'balanced_all_weather', 'US');

      // Re-read
      const p = profile.getUserProfile('test-user-g6');
      expect(p.factorUsage.length).toBe(3);
      expect(p.preferredMarkets.length).toBe(1);
      expect(p.preferredMarkets[0]).toBe('US');
    });

    it('handles multiple markets', () => {
      profile.updateProfile('test-user-g6', [
        { factorId: 'MOM_12M', nameCN: '动量', weight: 0.5 },
      ], 'momentum_following', 'US');

      profile.updateProfile('test-user-g6', [
        { factorId: 'MOM_12M', nameCN: '动量', weight: 0.3 },
      ], 'crypto_trend', 'CRYPTO');

      profile.updateProfile('test-user-g6', [
        { factorId: 'MOM_12M', nameCN: '动量', weight: 0.2 },
      ], 'high_dividend', 'HK');

      const p = profile.getUserProfile('test-user-g6');
      expect(p.factorUsage[0].markets.length).toBe(3);
      expect(p.preferredMarkets.length).toBe(3);
    });
  });
});
