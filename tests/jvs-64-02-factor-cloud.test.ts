/**
 * J-64-02 Tests: 核心因子云端化+回测签名 (R64 v19)
 *
 * Tests:
 * 01-02: Factor calculation + signature
 * 03: Signature verification
 * 04-05: Backtest signing + verification
 * 06: Tampered response rejected
 * 07: Multiple factor types
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  FactorCloudServer,
  getFactorServer,
  resetFactorServer,
} from '../electron/engine/factor-cloud-api';

describe('J-64-02: Factor Cloud API + Backtest Signature', () => {
  const SECRET = 'a'.repeat(64);
  let server: FactorCloudServer;

  beforeEach(() => {
    resetFactorServer();
    server = getFactorServer();
  });

  it('01: calculateFactors returns signed response', () => {
    const response = server.calculateFactors({
      symbol: '00700',
      market: 'HK',
      factorTypes: ['momentum', 'volatility'],
    });
    expect(response.results.length).toBe(2);
    expect(response.signature).toBeTruthy();
    expect(response.factorVersion).toBe('v1.0.0');
    expect(response.results[0].factorType).toBe('momentum');
    expect(response.results[1].factorType).toBe('volatility');
  });

  it('02: factors have valid value ranges', () => {
    const response = server.calculateFactors({
      symbol: 'AAPL', market: 'US', factorTypes: ['momentum', 'volatility', 'volumeProfile', 'sentiment', 'macro'],
    });
    for (const r of response.results) {
      expect(r.rank).toBeGreaterThanOrEqual(0);
      expect(r.rank).toBeLessThanOrEqual(100);
      expect(r.confidence).toBeGreaterThan(0);
      expect(r.confidence).toBeLessThanOrEqual(1);
    }
  });

  it('03: verifyFactorResponse rejects tampered response', () => {
    const response = server.calculateFactors({ symbol: '00700', market: 'HK', factorTypes: ['momentum'] });
    expect(server.verifyFactorResponse(response)).toBe(true);

    // Tamper
    response.results[0].value = 999;
    expect(server.verifyFactorResponse(response)).toBe(false);
  });

  it('04: signBacktestResult produces valid signature', () => {
    const sig = server.signBacktestResult(
      'strat-1',
      'function run() { return buy("MA10"); }',
      { period: '1m', initialCapital: 10000 },
      { totalReturn: 0.15, sharpe: 1.8, maxDrawdown: 0.12, trades: 42 },
    );
    expect(sig.valid).toBe(true);
    expect(sig.inputHash).toBeTruthy();
    expect(sig.resultHash).toBeTruthy();
    expect(sig.serverSignature).toBeTruthy();
  });

  it('05: verifyBacktestSignature validates correctly', () => {
    const sig = server.signBacktestResult('strat-2', 'code', { a: 1 }, { profit: 100 });
    expect(server.verifyBacktestSignature(sig)).toBe(true);
  });

  it('06: tampered backtest signature rejected', () => {
    const sig = server.signBacktestResult('strat-3', 'orig', { x: 1 }, { y: 2 });
    sig.resultHash = 'tampered-hash';
    expect(server.verifyBacktestSignature(sig)).toBe(false);
  });

  it('07: desktop proxy calls work end-to-end', async () => {
    const response = await server.desktopFactorProxy(
      { symbol: 'BTC', market: 'US', factorTypes: ['sentiment', 'macro'] },
      'mock-jwt-token',
    );
    expect(response.results.length).toBe(2);
    expect(server.verifyFactorResponse(response)).toBe(true);

    const sig = await server.desktopBacktestProxy('strat-4', 'return profit;', {}, { totalReturn: 0.2 }, 'jwt');
    expect(server.verifyBacktestSignature(sig)).toBe(true);
  });
});
