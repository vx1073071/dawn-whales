// Q18: Strategy Templates — Unit Tests

import { describe, it, expect } from 'vitest';
import {
  getAllTemplates,
  getTemplate,
  getTemplatesByCategory,
  getTemplatesByTag,
  searchTemplates,
  instantiateTemplate,
} from '../electron/engine/analysis/strategy-templates';

describe('Q18: Strategy Templates', () => {

  // ── getAllTemplates ─────────────────────────────────────────────────

  it('should return exactly 8 templates', () => {
    const templates = getAllTemplates();
    expect(templates).toHaveLength(8);
  });

  it('should include all expected template IDs', () => {
    const ids = getAllTemplates().map(t => t.id).sort();
    const expected = [
      'atr-trend-following',
      'bollinger-mean-reversion',
      'breakout-20d',
      'covered-call',
      'macd-dual-ma',
      'pairs-trading',
      'quant-multi-factor',
      'rsi-oversold',
    ];
    expect(ids).toEqual(expected);
  });

  it('each template should have required fields', () => {
    for (const t of getAllTemplates()) {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.nameCn).toBeTruthy();
      expect(t.category).toBeTruthy();
      expect(Array.isArray(t.parameters)).toBe(true);
      expect(Array.isArray(t.indicators)).toBe(true);
      expect(t.rules).toBeTruthy();
      expect(t.rules.entry).toBeTruthy();
      expect(t.rules.exit).toBeTruthy();
      expect(t.risk).toBeTruthy();
      expect(typeof t.risk.defaultStopLoss).toBe('number');
      expect(typeof t.risk.defaultTakeProfit).toBe('number');
      expect(typeof t.risk.maxPosition).toBe('number');
    }
  });

  // ── getTemplate ────────────────────────────────────────────────────

  it('should return correct template by ID', () => {
    const t = getTemplate('macd-dual-ma')!;
    expect(t).toBeDefined();
    expect(t.name).toBe('MACD Dual Moving Average');
    expect(t.category).toBe('momentum');
    expect(t.parameters.some((p: any) => p.name === 'fastPeriod')).toBe(true);
  });

  it('should return undefined for unknown ID', () => {
    expect(getTemplate('non-existent')).toBeUndefined();
  });

  // ── getTemplatesByCategory ─────────────────────────────────────────

  it('should filter by category momentum', () => {
    const momentum = getTemplatesByCategory('momentum');
    expect(momentum.length).toBeGreaterThan(0);
    for (const t of momentum) {
      expect(t.category).toBe('momentum');
    }
  });

  it('should filter by category mean_reversion', () => {
    const mr = getTemplatesByCategory('mean_reversion');
    for (const t of mr) {
      expect(t.category).toBe('mean_reversion');
    }
  });

  it('should return empty for unknown category', () => {
    expect(getTemplatesByCategory('nonexistent')).toHaveLength(0);
  });

  it('should include breakout, pairs, options, multi_factor categories', () => {
    expect(getTemplatesByCategory('breakout').length).toBeGreaterThan(0);
    expect(getTemplatesByCategory('pairs').length).toBeGreaterThan(0);
    expect(getTemplatesByCategory('options').length).toBeGreaterThan(0);
    expect(getTemplatesByCategory('multi_factor').length).toBeGreaterThan(0);
  });

  // ── getTemplatesByTag ──────────────────────────────────────────────

  it('should find templates by tag (case-insensitive partial match)', () => {
    const results = getTemplatesByTag('趋势');
    expect(results.length).toBeGreaterThan(0);
    for (const t of results) {
      expect(t.tags.some((tag: string) => tag.includes('趋势'))).toBe(true);
    }
  });

  it('should return empty for unknown tag', () => {
    expect(getTemplatesByTag('xyznonexistent123')).toHaveLength(0);
  });

  // ── searchTemplates ─────────────────────────────────────────────────

  it('should search by English name', () => {
    const results = searchTemplates('MACD');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((t: any) => t.id === 'macd-dual-ma')).toBe(true);
  });

  it('should search by Chinese name', () => {
    const results = searchTemplates('布林');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((t: any) => t.id === 'bollinger-mean-reversion')).toBe(true);
  });

  it('should search by category keyword', () => {
    const results = searchTemplates('momentum');
    expect(results.length).toBeGreaterThan(0);
    for (const t of results) {
      expect(t.category).toBe('momentum');
    }
  });

  it('should search by description content', () => {
    const results = searchTemplates('配对');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((t: any) => t.id === 'pairs-trading')).toBe(true);
  });

  it('should search by tag', () => {
    const results = searchTemplates('RSI');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((t: any) => t.id === 'rsi-oversold')).toBe(true);
  });

  it('should return all templates for empty query', () => {
    expect(searchTemplates('')).toHaveLength(8);
  });

  it('should be case-insensitive for English', () => {
    const upper = searchTemplates('BREAKOUT');
    const lower = searchTemplates('breakout');
    expect(upper.length).toBe(lower.length);
  });

  // ── instantiateTemplate ────────────────────────────────────────────

  it('should instantiate macd-dual-ma with defaults', () => {
    const result = instantiateTemplate('macd-dual-ma');
    expect(result.error).toBeUndefined();
    expect(result.strategy).toBeDefined();
    expect(result.strategy.templateId).toBe('macd-dual-ma');
    expect(result.strategy.name).toBe('MACD Dual Moving Average');
    expect(result.strategy.parameters.fastPeriod).toBe(12); // default
    expect(result.strategy.parameters.slowPeriod).toBe(26); // default
    expect(result.strategy.risk.defaultStopLoss).toBe(0.02);
  });

  it('should apply parameter overrides', () => {
    const result = instantiateTemplate('macd-dual-ma', { fastPeriod: 8, stopLoss: 0.05 });
    expect(result.strategy.parameters.fastPeriod).toBe(8);
    expect(result.strategy.parameters.slowPeriod).toBe(26); // unchanged default
  });

  it('should return error for unknown template ID', () => {
    const result = instantiateTemplate('non-existent-id');
    expect(result.strategy).toEqual({});
    expect(result.error).toContain('not found');
  });

  it('instantiated strategy should include indicators, rules, risk, tags', () => {
    const { strategy } = instantiateTemplate('bollinger-mean-reversion');
    expect(Array.isArray(strategy.indicators)).toBe(true);
    expect(strategy.rules.entry).toBeTruthy();
    expect(strategy.rules.exit).toBeTruthy();
    expect(strategy.risk.maxPosition).toBeGreaterThan(0);
    expect(Array.isArray(strategy.tags)).toBe(true);
    expect(strategy.templateId).toBe('bollinger-mean-reversion');
    expect(strategy.createdAt).toBeGreaterThan(0);
  });

  it('all 8 templates should instantiate without error', () => {
    const ids = getAllTemplates().map(t => t.id);
    for (const id of ids) {
      const result = instantiateTemplate(id);
      expect(result.error).toBeUndefined();
      expect(result.strategy.templateId).toBe(id);
    }
  });

  it('covered-call template should have options category', () => {
    const { strategy } = instantiateTemplate('covered-call');
    expect(strategy.category).toBe('options');
  });

  it('pairs-trading should support lookback parameter override', () => {
    const { strategy } = instantiateTemplate('pairs-trading', { lookback: 120 });
    expect(strategy.parameters.lookback).toBe(120);
  });
});
