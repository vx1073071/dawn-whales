/**
 * AIParamSuggestionEngine.test.ts — R228 JVS-2.4c: AI参数建议引擎测试
 *
 * ≥10 tests.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AIParamSuggestionEngine } from '../../../../electron/engine/ai/AIParamSuggestionEngine';
import type { AIParamSuggestionInput } from '../../../../electron/engine/ai/AIParamSuggestionEngine';

describe('AIParamSuggestionEngine', () => {
  let engine: AIParamSuggestionEngine;

  beforeEach(() => {
    engine = new AIParamSuggestionEngine();
  });

  describe('suggest()', () => {
    const baseInput: AIParamSuggestionInput = {
      factorId: 'MOM_12M',
      market: 'US',
      style: 'aggressive',
    };

    it('should suggest parameters for known factor MOM_12M', () => {
      const result = engine.suggest(baseInput);
      expect(result.factorId).toBe('MOM_12M');
      expect(result.suggestions.length).toBeGreaterThanOrEqual(2);
      expect(result.costUSDT).toBe(1);
      expect(result.billingId).toContain('ai-param-');
    });

    it('should suggest parameters for RSI_14', () => {
      const result = engine.suggest({
        factorId: 'RSI_14',
        market: 'US',
        style: 'moderate',
      });
      expect(result.suggestions.length).toBeGreaterThanOrEqual(3);
      expect(result.market).toBe('US');
      expect(result.style).toBe('moderate');
    });

    it('should suggest parameters for MACD', () => {
      const result = engine.suggest({
        factorId: 'MACD',
        market: 'US',
        style: 'conservative',
      });
      expect(result.suggestions.length).toBeGreaterThanOrEqual(2);
    });

    it('should return default suggestion for unknown factor', () => {
      const result = engine.suggest({
        factorId: 'UNKNOWN_FACTOR',
        market: 'HK',
        style: 'aggressive',
      });

      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0].paramName).toBe('weight');
    });

    it('should have confidence scores on each suggestion', () => {
      const result = engine.suggest(baseInput);
      for (const s of result.suggestions) {
        expect(s.confidence).toBeGreaterThanOrEqual(0);
        expect(s.confidence).toBeLessThanOrEqual(1);
        expect(s.paramLabel).toBeTruthy();
        expect(s.unit).toBeTruthy();
      }
    });

    it('should generate a descriptive summary', () => {
      const result = engine.suggest(baseInput);
      expect(result.summary).toContain('参数建议');
      expect(result.summary).toContain('置信度');
    });

    it('should include billing information', () => {
      const result = engine.suggest(baseInput);
      expect(result.costUSDT).toBe(1);
      expect(result.generatedAt).toBeGreaterThan(0);
      expect(typeof result.billingId).toBe('string');
    });

    it('should apply style adjustments: aggressive vs conservative', () => {
      const aggressive = engine.suggest({
        factorId: 'MOM_12M',
        market: 'US',
        style: 'aggressive',
      });

      const conservative = engine.suggest({
        factorId: 'MOM_12M',
        market: 'US',
        style: 'conservative',
      });

      const aggLookback = aggressive.suggestions.find((s) => s.paramName === 'lookbackPeriod');
      const conLookback = conservative.suggestions.find((s) => s.paramName === 'lookbackPeriod');

      expect(aggLookback).toBeDefined();
      expect(conLookback).toBeDefined();
      // Aggressive should have shorter lookback
      expect(aggLookback!.suggestedValue).toBeLessThan(conLookback!.suggestedValue);
    });

    it('should apply market adjustments: US vs CRYPTO', () => {
      const usResult = engine.suggest({
        factorId: 'MOM_12M',
        market: 'US',
        style: 'moderate',
      });

      const cryptoResult = engine.suggest({
        factorId: 'MOM_12M',
        market: 'CRYPTO',
        style: 'moderate',
      });

      const usLookback = usResult.suggestions.find((s) => s.paramName === 'lookbackPeriod');
      const cryptoLookback = cryptoResult.suggestions.find((s) => s.paramName === 'lookbackPeriod');

      expect(usLookback).toBeDefined();
      expect(cryptoLookback).toBeDefined();
      // Crypto should have shorter lookback (offset -6)
      expect(cryptoLookback!.suggestedValue).toBeLessThan(usLookback!.suggestedValue);
    });

    it('should clamp values within min/max range', () => {
      const result = engine.suggest({
        factorId: 'MOM_12M',
        market: 'US',
        style: 'aggressive',
        currentValues: { lookbackPeriod: 2, smoothing: 100 },
      });

      for (const s of result.suggestions) {
        expect(s.suggestedValue).toBeGreaterThanOrEqual(s.min);
        expect(s.suggestedValue).toBeLessThanOrEqual(s.max);
      }
    });

    it('should have reasons for each suggestion', () => {
      const result = engine.suggest({
        factorId: 'RSI_14',
        market: 'US',
        style: 'aggressive',
      });

      for (const s of result.suggestions) {
        expect(s.reason.length).toBeGreaterThan(0);
      }
    });
  });

  describe('suggestBatch()', () => {
    it('should batch-process multiple factors', () => {
      const results = engine.suggestBatch([
        { factorId: 'MOM_12M', market: 'US', style: 'aggressive' },
        { factorId: 'RSI_14', market: 'HK', style: 'conservative' },
        { factorId: 'MACD', market: 'CRYPTO', style: 'moderate' },
      ]);

      expect(results).toHaveLength(3);
      expect(results[0].factorId).toBe('MOM_12M');
      expect(results[1].factorId).toBe('RSI_14');
      expect(results[2].factorId).toBe('MACD');
      expect(results.every((r) => r.costUSDT === 1)).toBe(true);
    });
  });

  describe('getPricing()', () => {
    it('should return pricing info', () => {
      const pricing = engine.getPricing();
      expect(pricing.costPerCall).toBe(1);
      expect(pricing.billingService).toBe('ai-param-fill');
    });
  });
});
