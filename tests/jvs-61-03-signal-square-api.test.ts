/**
 * J-61-03 Tests: Signal Square API (R61 v19 — v1.4.0-beta)
 *
 * Tests:
 * 01-02: Signal publishing and listing
 * 03-04: Subscription management
 * 05-06: Quality scoring
 * 07: Recommendations
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  SignalSquareAPI,
  getSignalSquare,
  resetSignalSquare,
} from '../electron/engine/signal-square-api';

describe('J-61-03: SignalSquareAPI', () => {
  let api: SignalSquareAPI;

  beforeEach(() => {
    resetSignalSquare();
    api = getSignalSquare();
  });

  describe('Signal Publishing', () => {
    it('01: publish creates active signal with id', () => {
      const result = api.publishSignal({
        creatorId: 'creator1', symbol: '000001', direction: 'buy',
        confidence: 0.85, timeframe: '1w', price: 12.50,
        rationale: '技术突破', market: 'A', tags: ['技术面'],
      });
      expect(result.id.startsWith('SIG-')).toBe(true);
      expect(result.status).toBe('active');
    });

    it('02: list signals with market filter', () => {
      api.publishSignal({
        creatorId: 'c1', symbol: '000001', direction: 'buy',
        confidence: 0.90, timeframe: '1d', price: 10, rationale: '测试',
        market: 'A', tags: [],
      });
      api.publishSignal({
        creatorId: 'c2', symbol: 'AAPL', direction: 'sell',
        confidence: 0.75, timeframe: '1w', price: 180, rationale: '过估',
        market: 'US', tags: [],
      });

      const aSignals = api.listSignals({ market: 'A' });
      expect(aSignals.length).toBe(1);
      expect(aSignals[0].symbol).toBe('000001');

      const usSignals = api.listSignals({ market: 'US' });
      expect(usSignals.length).toBe(1);
      expect(usSignals[0].symbol).toBe('AAPL');
    });

    it('03: list signals with min confidence filter', () => {
      api.publishSignal({
        creatorId: 'c1', symbol: 'A', direction: 'buy', confidence: 0.70,
        timeframe: '1d', price: 10, rationale: '', market: 'HK', tags: [],
      });
      api.publishSignal({
        creatorId: 'c2', symbol: 'B', direction: 'buy', confidence: 0.95,
        timeframe: '1d', price: 10, rationale: '', market: 'HK', tags: [],
      });

      const filtered = api.listSignals({ minConfidence: 0.80 });
      expect(filtered.length).toBe(1);
      expect(filtered[0].symbol).toBe('B');
    });

    it('04: getSignal retrieves by id', () => {
      const sig = api.publishSignal({
        creatorId: 'c1', symbol: '00700', direction: 'hold',
        confidence: 0.60, timeframe: '1m', price: 350,
        rationale: '观望', market: 'HK', tags: [],
      });
      const found = api.getSignal(sig.id);
      expect(found?.symbol).toBe('00700');
    });

    it('05: missing signal returns undefined', () => {
      expect(api.getSignal('nonexistent')).toBeUndefined();
    });
  });

  describe('Subscription', () => {
    it('06: subscribe creates subscription record', () => {
      const sub = api.subscribe('user1', 'creator1', 'free');
      expect(sub.subscriberId).toBe('user1');
      expect(sub.creatorId).toBe('creator1');
      expect(sub.tier).toBe('free');
    });

    it('07: subscribe updates creator subscriber count', () => {
      api.publishSignal({
        creatorId: 'creatorX', symbol: 'X', direction: 'buy',
        confidence: 0.5, timeframe: '1d', price: 10, rationale: '',
        market: 'HK', tags: [],
      });
      api.subscribe('user1', 'creatorX', 'pro', 1.0);
      const profile = api.getCreatorProfile('creatorX');
      expect(profile?.subscribers).toBe(1);
    });

    it('08: unsubscribe removes and decrements', () => {
      api.subscribe('user1', 'creator1');
      const removed = api.unsubscribe('user1', 'creator1');
      expect(removed).toBe(true);
      expect(api.unsubscribe('user1', 'no-creator')).toBe(false);
    });

    it('09: getSubscriptions by subscriber', () => {
      api.subscribe('alice', 'creator1');
      api.subscribe('alice', 'creator2');
      api.subscribe('bob', 'creator1');

      const aliceSubs = api.getSubscriptions('alice');
      expect(aliceSubs.length).toBe(2);

      const creator1Subs = api.getSubscriptions(undefined, 'creator1');
      expect(creator1Subs.length).toBe(2);
    });
  });

  describe('Quality Scoring', () => {
    it('10: compute score is 0-100', () => {
      const sig = api.publishSignal({
        creatorId: 'c1', symbol: 'A', direction: 'buy', confidence: 0.8,
        timeframe: '1d', price: 10, rationale: 'test', market: 'HK', tags: [],
      });
      const score = api.computeQualityScore(sig.id);
      expect(score.overall).toBeGreaterThanOrEqual(0);
      expect(score.overall).toBeLessThanOrEqual(100);
    });

    it('11: hit signal scores higher', () => {
      const sig = api.publishSignal({
        creatorId: 'c1', symbol: 'A', direction: 'buy', confidence: 0.8,
        timeframe: '1d', price: 10, rationale: 'test', market: 'HK', tags: [],
      });
      api.markSignalOutcome(sig.id, 'hit');
      const score = api.computeQualityScore(sig.id);
      expect(score.accuracy).toBe(100);
      expect(score.overall).toBeGreaterThan(50);
    });

    it('12: missed signal has low accuracy', () => {
      const sig = api.publishSignal({
        creatorId: 'c2', symbol: 'B', direction: 'buy', confidence: 0.9,
        timeframe: '1d', price: 10, rationale: 'test', market: 'US', tags: [],
      });
      api.markSignalOutcome(sig.id, 'missed');
      const score = api.computeQualityScore(sig.id);
      expect(score.accuracy).toBe(0);
    });
  });

  describe('Recommendations', () => {
    it('13: recommend returns top N signals by quality', () => {
      const s1 = api.publishSignal({
        creatorId: 'cA', symbol: 'A+', direction: 'buy', confidence: 0.95,
        timeframe: '1d', price: 100, rationale: 'best', market: 'HK', tags: [],
      });
      const s2 = api.publishSignal({
        creatorId: 'cB', symbol: 'B-', direction: 'sell', confidence: 0.30,
        timeframe: '1m', price: 5, rationale: 'meh', market: 'US', tags: [],
      });

      // Both are active — score by quality, s1 should rank higher
      const recs = api.recommend([s1.id, s2.id], 1);
      expect(recs.length).toBe(1);
      expect(recs[0].signal.symbol).toBe('A+');
    });

    it('14: expired signals excluded from recommendations', () => {
      const s1 = api.publishSignal({
        creatorId: 'cX', symbol: 'EXP', direction: 'buy', confidence: 0.90,
        timeframe: '1d', price: 10, rationale: 'expired', market: 'HK', tags: [],
      });
      api.expireSignal(s1.id);
      const recs = api.recommend([s1.id]);
      expect(recs.length).toBe(0);
    });
  });

  describe('Creator Profile', () => {
    it('15: creator profile updates with signals', () => {
      const s1 = api.publishSignal({
        creatorId: 'pro-trader', symbol: 'A', direction: 'buy',
        confidence: 0.8, timeframe: '1d', price: 10, rationale: '', market: 'HK', tags: [],
      });
      const s2 = api.publishSignal({
        creatorId: 'pro-trader', symbol: 'B', direction: 'buy',
        confidence: 0.9, timeframe: '1d', price: 20, rationale: '', market: 'HK', tags: [],
      });

      api.markSignalOutcome(s1.id, 'hit');
      api.markSignalOutcome(s2.id, 'missed');

      const profile = api.getCreatorProfile('pro-trader');
      expect(profile?.totalSignals).toBe(2);
      expect(profile?.accuracyRate).toBe(0.5);
    });
  });
});
