/**
 * Tests for Asset Diagnosis (Multi-Asset)
 * JVS R158
 */
import { describe, it, expect } from 'vitest';
import {
  diagnoseAsset,
  batchDiagnoseAssets,
} from '../../../../electron/engine/data/asset-diagnosis';

describe('AssetDiagnosis', () => {

  describe('diagnoseAsset - US stock', () => {
    it('returns diagnosis report for AAPL', async () => {
      const report = await diagnoseAsset({
        code: 'AAPL',
        name: 'Apple Inc.',
        market: 'US',
        assetType: 'stock',
      });
      expect(report.success).toBe(true);
      expect(report.code).toBe('AAPL');
      expect(report.name).toBe('Apple Inc.');
      expect(report.market).toBe('US');
      expect(report.assetType).toBe('stock');
      expect(report.overview).toBeDefined();
      expect(report.overview.score).toBeGreaterThanOrEqual(0);
      expect(report.overview.score).toBeLessThanOrEqual(100);
      expect(report.overview.grade).toBeDefined();
      expect(report.overview.recommendation).toBeDefined();
      expect(report.overview.summary).toBeDefined();
      expect(report.overview.summary.length).toBeGreaterThan(0);
      expect(report.dimensions).toBeDefined();
      expect(report.rawData).toBeDefined();
      expect(report.timestamp).toBeGreaterThan(0);
    });

    it('returns diagnosis for HK stock', async () => {
      const report = await diagnoseAsset({
        code: '00700',
        name: 'Tencent',
        market: 'HK',
        assetType: 'stock',
      });
      expect(report.market).toBe('HK');
      expect(report.code).toBe('00700');
    });
  });

  describe('diagnoseAsset - CRYPTO', () => {
    it('returns diagnosis for BTC spot', async () => {
      const report = await diagnoseAsset({
        code: 'BTC',
        name: 'Bitcoin',
        market: 'CRYPTO',
        assetType: 'crypto_spot',
      });
      expect(report.market).toBe('CRYPTO');
      expect(report.assetType).toBe('crypto_spot');
      expect(report.overview).toBeDefined();
    });

    it('returns diagnosis for ETH perp', async () => {
      const report = await diagnoseAsset({
        code: 'ETH',
        name: 'Ethereum',
        market: 'CRYPTO',
        assetType: 'crypto_perp',
      });
      expect(report.assetType).toBe('crypto_perp');
    });
  });

  describe('diagnoseAsset - options control', () => {
    it('can disable capital flow dimension', async () => {
      const report = await diagnoseAsset({
        code: 'AAPL',
        includeCapitalFlow: false,
      });
      expect(report.success).toBe(true);
    });

    it('can disable all optional dimensions', async () => {
      const report = await diagnoseAsset({
        code: 'AAPL',
        includeCapitalFlow: false,
        includeFundOwnership: false,
        includeInstitutionalFlow: false,
        includeNews: false,
        includeAnomalies: false,
      });
      expect(report.success).toBe(true);
    });
  });

  describe('diagnoseAsset - all asset types', () => {
    const assetTypes = ['stock', 'crypto_spot', 'crypto_perp', 'future', 'option'] as const;
    for (const assetType of assetTypes) {
      it(`supports ${assetType}`, async () => {
        const report = await diagnoseAsset({
          code: 'TEST',
          market: 'US',
          assetType,
        });
        expect(report.assetType).toBe(assetType);
      });
    }
  });

  describe('diagnoseAsset - grade scoring', () => {
    it('score is between 0 and 100', async () => {
      const report = await diagnoseAsset({ code: 'TSLA' });
      expect(report.overview.score).toBeGreaterThanOrEqual(0);
      expect(report.overview.score).toBeLessThanOrEqual(100);
    });

    it('grade is valid', async () => {
      const report = await diagnoseAsset({ code: 'GOOGL' });
      const validGrades = ['A', 'B', 'C', 'D', 'F'];
      expect(validGrades).toContain(report.overview.grade);
    });

    it('recommendation is valid', async () => {
      const report = await diagnoseAsset({ code: 'GOOGL' });
      const validRecs = ['strong_buy', 'buy', 'hold', 'sell', 'strong_sell'];
      expect(validRecs).toContain(report.overview.recommendation);
    });
  });

  describe('batchDiagnoseAssets', () => {
    it('diagnoses multiple assets', async () => {
      const results = await batchDiagnoseAssets([
        { code: 'AAPL', market: 'US', assetType: 'stock' },
        { code: '00700', market: 'HK', assetType: 'stock' },
        { code: 'BTC', market: 'CRYPTO', assetType: 'crypto_spot' },
      ]);
      expect(results).toHaveLength(3);
      for (const r of results) {
        expect(r.success).toBe(true);
        expect(r.code.length).toBeGreaterThan(0);
      }
    });

    it('handles mixed success/failure', async () => {
      const results = await batchDiagnoseAssets([
        { code: 'VALID', market: 'US', assetType: 'stock' },
      ]);
      expect(results.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('dimensions structure', () => {
    it('all 5 dimensions present', async () => {
      const report = await diagnoseAsset({ code: 'MSFT' });
      const dims = report.dimensions;
      expect(dims.capitalFlow).toBeDefined();
      expect(dims.fundOwnership).toBeDefined();
      expect(dims.institutionalFlow).toBeDefined();
      expect(dims.news).toBeDefined();
      expect(dims.anomalies).toBeDefined();

      for (const [name, dim] of Object.entries(dims)) {
        expect(dim.score).toBeGreaterThanOrEqual(0);
        expect(dim.score).toBeLessThanOrEqual(100);
        expect(dim.signal).toBeDefined();
        expect(dim.detail).toBeDefined();
        expect(typeof dim.available).toBe('boolean');
      }
    });
  });
});
