/**
 * J-64-02 [P0]: factorcloud+backtestsign (R64 v19 — v1.6.0-alpha)
 *
 * factordeployment /api/factor。
 * backtest resultcloudsign ()。
 * : factor + backtest engine。
 *
 * >=200L, 7 tests
 */

import * as crypto from 'crypto';

// ── Types ──────────────────────────────────────────────────────────────────

export type FactorType = 'momentum' | 'volatility' | 'volumeProfile' | 'sentiment' | 'macro';

export interface FactorRequest {
  symbol: string;
  market: 'HK' | 'US' | 'A';
  factorTypes: FactorType[];
  period?: '1d' | '1w' | '1m' | '3m';
}

export interface FactorResult {
  factorType: FactorType;
  symbol: string;
  value: number;
  rank: number;
  confidence: number;
  timestamp: string;
}

export interface SignedFactorResponse {
  results: FactorResult[];
  signature: string;
  serverTimestamp: string;
  factorVersion: string;
}

export interface BacktestSignature {
  strategyId: string;
  inputHash: string;
  resultHash: string;
  serverSignature: string;
  verifiedAt: string;
  valid: boolean;
}

// ── Deterministic factor compute (based on symbol name) ───────────────────

function computeFactor(symbol: string, type: FactorType): FactorResult {
  const seed = symbol.charCodeAt(0) * 31 + symbol.charCodeAt(symbol.length > 1 ? 1 : 0) * 17;
  const hash = (n: number) => Math.abs((Math.sin(n * 0.0174533) * 0.5 + 0.5));

  const now = new Date().toISOString();
  const multipliers: Record<FactorType, { value: number; rank: number; conf: number }> = {
    momentum:        { value: 100, rank: 100, conf: 0.85 },
    volatility:      { value: 30,  rank: 100, conf: 0.82 },
    volumeProfile:   { value: 100, rank: 100, conf: 0.78 },
    sentiment:       { value: 100, rank: 100, conf: 0.70 },
    macro:           { value: 10,  rank: 100, conf: 0.75 },
  };

  const m = multipliers[type];
  return {
    factorType: type,
    symbol,
    value: Number((hash(seed + type.length * 7) * m.value).toFixed(2)),
    rank: Math.floor(hash(seed + type.length * 13) * m.rank),
    confidence: Number((m.conf + Math.random() * 0.1).toFixed(4)),
    timestamp: now,
  };
}

// ── Factor Server ─────────────────────────────────────────────────────────

export class FactorCloudServer {
  private secretKey: Buffer;
  private factorVersion = 'v1.0.0';
  private signatureCache: Map<string, SignedFactorResponse> = new Map();

  constructor(secret?: string) {
    this.secretKey = Buffer.from(secret ?? crypto.randomBytes(32).toString('hex'), 'hex');
  }

  calculateFactors(request: FactorRequest): SignedFactorResponse {
    const results = request.factorTypes.map(t => computeFactor(request.symbol, t));
    const response: SignedFactorResponse = {
      results,
      signature: '',
      serverTimestamp: new Date().toISOString(),
      factorVersion: this.factorVersion,
    };
    response.signature = this.signResults(results);
    return response;
  }

  signResults(results: FactorResult[]): string {
    return crypto.createHmac('sha256', this.secretKey).update(JSON.stringify(results)).digest('base64url');
  }

  verifyFactorResponse(response: SignedFactorResponse): boolean {
    return this.signResults(response.results) === response.signature;
  }

  signBacktestResult(strategyId: string, strategyCode: string, params: Record<string, unknown>, backtestOutput: unknown): BacktestSignature {
    const inputHash = crypto.createHash('sha256').update(JSON.stringify({ strategyCode, params })).digest('hex');
    const resultHash = crypto.createHash('sha256').update(JSON.stringify(backtestOutput)).digest('hex');
    const payload = `${strategyId}:${inputHash}:${resultHash}`;
    const serverSignature = crypto.createHmac('sha256', this.secretKey).update(payload).digest('base64url');

    return {
      strategyId, inputHash, resultHash, serverSignature,
      verifiedAt: new Date().toISOString(), valid: true,
    };
  }

  verifyBacktestSignature(sig: BacktestSignature): boolean {
    const payload = `${sig.strategyId}:${sig.inputHash}:${sig.resultHash}`;
    return crypto.createHmac('sha256', this.secretKey).update(payload).digest('base64url') === sig.serverSignature;
  }

  async desktopFactorProxy(request: FactorRequest, jwt: string): Promise<SignedFactorResponse> {
    return this.calculateFactors(request);
  }

  async desktopBacktestProxy(strategyId: string, code: string, params: Record<string, unknown>, output: unknown, jwt: string): Promise<BacktestSignature> {
    return this.signBacktestResult(strategyId, code, params, output);
  }

  getCachedFactors(symbol: string, types: FactorType[]): SignedFactorResponse | null {
    return this.signatureCache.get(`${symbol}:${types.sort().join(',')}`) ?? null;
  }

  reset(): void { this.signatureCache.clear(); }
}

// ── Desktop Cleanup Tracker ───────────────────────────────────────────────

export type FactorCleanupItem = {
  name: string;
  action: 'delete' | 'replace_with_api';
  serverEndpoint: string;
};

export const FACTOR_CLEANUP_PLAN: FactorCleanupItem[] = [
  { name: 'advanced-factor-engine.ts', action: 'delete', serverEndpoint: '/api/factor' },
  { name: 'backtest-engine.ts', action: 'delete', serverEndpoint: '/api/backtest' },
  { name: 'strategy-optimizer.ts', action: 'replace_with_api', serverEndpoint: '/api/optimize' },
  { name: 'sentiment-model.ts', action: 'replace_with_api', serverEndpoint: '/api/sentiment' },
];

// ── Singleton ────────────────────────────────────────────────────────────

let _factorServer: FactorCloudServer | null = null;

export function getFactorServer(): FactorCloudServer {
  if (!_factorServer) _factorServer = new FactorCloudServer();
  return _factorServer;
}

export function resetFactorServer(): void {
  _factorServer?.reset();
  _factorServer = null;
}

export default { FactorCloudServer, getFactorServer, resetFactorServer, FACTOR_CLEANUP_PLAN };
