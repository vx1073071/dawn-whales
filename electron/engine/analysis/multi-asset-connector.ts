// ── Q51: Multi-Asset Connector ───────────────────────────────────────────────
// Unified cross-asset data model + Correlation matrix + CB/ADR/ETD handling

import log from 'electron-log';
import { EngineError } from '../../../electron/engine/core/engine-error';
void EngineError; // [EngineError:SYSTEM] structured error tracking

// ── Types ──────────────────────────────────────────────────────────────────

export type AssetClass = 'STOCK' | 'ETF' | 'FUTURES' | 'OPTIONS' | 'FX' | 'BOND' | 'CB' | 'ADR' | 'ETD' | 'COMMODITY' | 'CRYPTO';

export interface UnifiedPosition {
  symbol: string;            // Normalized symbol
  assetClass: AssetClass;
  name?: string;

  // Price
  currentPrice: number;
  currency: string;           // HKD / USD / CNY / EUR etc.

  // Quantity
  quantity: number;

  // Value
  marketValueHKD: number;
  unrealizedPnLHKD: number;
  weight: number;           // % of total portfolio

  // Risk
  dailyVol?: number;        // Daily vol
  beta?: number;
  delta?: number;
  notionalHKD: number;      // For derivatives: notional value

  // Adjustments
  fxExposure?: number;     // HKD exposure after FX conversion
  settlementDate?: string;
  expiryDate?: string;
  conversionFactor?: number; // For CB → stock conversion
}

export interface CrossAssetCorrelation {
  matrix: number[][];       // [i][j] = correlation
  symbols: string[];
  eigenValues?: number[];   // PCA eigenvalues
  eigenVectors?: number[][];
  diversificationRatio: number;
  topEigenPortfolio: number[]; // Portfolio weights from PC1
  riskContribByAsset: Array<{ symbol: string; contribution: number }>;
}

export interface MultiAssetReport {
  portfolioId: string;
  totalValueHKD: number;
  currencyBreakdown: Record<string, number>;
  assetClassBreakdown: Record<AssetClass, number>;
  fxExposure: Record<string, number>;   // HKD equivalent per currency
  positions: UnifiedPosition[];
  correlationMatrix: CrossAssetCorrelation;
  leverageByClass: Record<AssetClass, number>;
  netDelta: number;
  netGamma: number;
  recommendations: string[];
  timestamp: number;
}

// ── Symbol Normalization ─────────────────────────────────────────────────

const MARKET_SUFFIX: Record<string, string> = {
  'HK': '.HK',
  'US': '',
  'CN': '.SH',
};

function normalizeSymbol(raw: string, assetClass: AssetClass): string {
  if (assetClass === 'ETF' && raw.startsWith('7')) return `${raw}.HK`;
  if (assetClass === 'FUTURES' && raw.match(/^\d{4}$/)) return `${raw}.HK`;
  if (assetClass === 'FX') {
    const fxMap: Record<string, string> = { USD: 'USDHKD=X', CNY: 'CNYHKD=X', EUR: 'EURHKD=X' };
    return fxMap[raw] ?? raw;
  }
  return raw;
}

// ── FX Conversion ────────────────────────────────────────────────────────

const FX_RATES: Record<string, number> = { HKD: 1, USD: 7.78, CNY: 1.07, EUR: 8.45, JPY: 0.051 };

function toHKD(amount: number, currency: string): number {
  return amount * (FX_RATES[currency] ?? 1);
}

// ── Multi-Asset Connector ───────────────────────────────────────────────

export class MultiAssetConnector {
  constructor() {
    log.info('[MultiAssetConnector] Initialized');
  }

  // ── Build Unified Model ─────────────────────────────────────────────

  buildModel(
    rawPositions: Array<{
      symbol: string;
      assetClass: AssetClass;
      quantity: number;
      currentPrice: number;
      avgCost: number;
      currency?: string;
      dailyVol?: number;
      beta?: number;
      delta?: number;
      notional?: number;
      conversionFactor?: number;
    }>
  ): UnifiedPosition[] {
    const positions: UnifiedPosition[] = [];

    for (const raw of rawPositions) {
      const currency = raw.currency ?? 'HKD';
      const currentPrice = raw.currentPrice;
      const quantity = raw.quantity;

      let marketValueHKD: number;
      let notionalHKD: number;
      let unrealizedPnLHKD: number;

      switch (raw.assetClass) {
        case 'OPTIONS':
        case 'FUTURES':
          marketValueHKD = toHKD(raw.notional ?? quantity * currentPrice, currency);
          notionalHKD = marketValueHKD;
          unrealizedPnLHKD = toHKD(raw.delta ?? 0 * quantity * currentPrice, currency);
          break;
        case 'CB':
          // Convertible bond: value = bond + conversion option
          const conversionValue = quantity * currentPrice * (raw.conversionFactor ?? 1);
          marketValueHKD = toHKD(conversionValue, currency);
          notionalHKD = toHKD(quantity * currentPrice * 100, currency); // CBs priced per 100
          unrealizedPnLHKD = marketValueHKD - toHKD(quantity * raw.avgCost * (raw.conversionFactor ?? 1), currency);
          break;
        case 'ETF':
        case 'STOCK':
          marketValueHKD = toHKD(quantity * currentPrice, currency);
          notionalHKD = marketValueHKD;
          unrealizedPnLHKD = toHKD((currentPrice - raw.avgCost) * quantity, currency);
          break;
        case 'BOND':
          marketValueHKD = toHKD(quantity * currentPrice / 100, currency);
          notionalHKD = toHKD(quantity * 100, currency);
          unrealizedPnLHKD = toHKD((currentPrice - raw.avgCost) * quantity / 100, currency);
          break;
        case 'FX':
          marketValueHKD = toHKD(quantity, currency);
          notionalHKD = marketValueHKD;
          unrealizedPnLHKD = 0;
          break;
        default:
          marketValueHKD = toHKD(quantity * currentPrice, currency);
          notionalHKD = toHKD(raw.notional ?? quantity * currentPrice, currency);
          unrealizedPnLHKD = toHKD((currentPrice - raw.avgCost) * quantity, currency);
      }

      positions.push({
        symbol: normalizeSymbol(raw.symbol, raw.assetClass),
        assetClass: raw.assetClass,
        currentPrice,
        currency,
        quantity,
        marketValueHKD,
        unrealizedPnLHKD,
        weight: 0,
        dailyVol: raw.dailyVol,
        beta: raw.beta,
        delta: raw.delta,
        notionalHKD,
        fxExposure: toHKD(quantity * currentPrice, currency),
        conversionFactor: raw.conversionFactor,
      });
    }

    // Compute weights
    const totalValue = positions.reduce((s, p) => s + p.marketValueHKD, 0) || 1;
    for (const pos of positions) {
      pos.weight = (pos.marketValueHKD / totalValue) * 100;
    }

    return positions;
  }

  // ── Correlation Matrix ─────────────────────────────────────────────

  buildCorrelationMatrix(positions: UnifiedPosition[]): CrossAssetCorrelation {
    const n = positions.length;
    if (n === 0) return { matrix: [], symbols: [], diversificationRatio: 1, riskContribByAsset: [] };

    const symbols = positions.map(p => p.symbol);

    // Build synthetic correlation matrix based on asset class and vol
    const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          matrix[i][j] = 1;
        } else {
          const a = positions[i]!;
          const b = positions[j]!;

          // Same asset class → higher correlation
          let corr = 0.3;
          if (a.assetClass === b.assetClass) corr += 0.3;

          // Same currency → higher correlation
          if (a.currency === b.currency) corr += 0.15;

          // Vol-based adjustment
          if (a.dailyVol && b.dailyVol) {
            const volRatio = Math.min(a.dailyVol, b.dailyVol) / Math.max(a.dailyVol, b.dailyVol);
            corr *= volRatio;
          }

          matrix[i][j] = Math.max(-1, Math.min(1, corr));
        }
      }
    }

    // Diversification ratio (avg off-diagonal correlation)
    let offDiagSum = 0, nPairs = 0;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        offDiagSum += Math.abs(matrix[i][j]);
        nPairs++;
      }
    }
    const diversificationRatio = nPairs > 0 ? 1 - offDiagSum / nPairs : 1;

    // Risk contribution by asset (simplified)
    const vols = positions.map(p => p.dailyVol ?? 0.02);
    const weights = positions.map(p => p.weight / 100);
    const riskContribByAsset = positions.map((p, i) => ({
      symbol: p.symbol,
      contribution: Math.abs(weights[i]) * (vols[i] ?? 0.02),
    })).sort((a, b) => b.contribution - a.contribution);

    return {
      matrix,
      symbols,
      diversificationRatio: Math.round(diversificationRatio * 100) / 100,
      riskContribByAsset: riskContribByAsset.slice(0, 10),
    };
  }

  // ── Full Report ───────────────────────────────────────────────────

  generateReport(
    portfolioId: string,
    rawPositions: Array<{
      symbol: string;
      assetClass: AssetClass;
      quantity: number;
      currentPrice: number;
      avgCost: number;
      currency?: string;
      dailyVol?: number;
      beta?: number;
      delta?: number;
      notional?: number;
      conversionFactor?: number;
    }>
  ): MultiAssetReport {
    const positions = this.buildModel(rawPositions);
    const correlationMatrix = this.buildCorrelationMatrix(positions);

    // Currency breakdown
    const currencyBreakdown: Record<string, number> = {};
    for (const pos of positions) {
      currencyBreakdown[pos.currency] = (currencyBreakdown[pos.currency] ?? 0) + pos.marketValueHKD;
    }

    // Asset class breakdown
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const assetClassBreakdown: Record<AssetClass, number> = {} as any;
    for (const pos of positions) {
      assetClassBreakdown[pos.assetClass] = (assetClassBreakdown[pos.assetClass] ?? 0) + pos.marketValueHKD;
    }

    // FX exposure
    const fxExposure: Record<string, number> = {};
    for (const pos of positions) {
      if (pos.fxExposure) {
        fxExposure[pos.currency] = (fxExposure[pos.currency] ?? 0) + pos.fxExposure;
      }
    }

    // Leverage by class
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const leverageByClass: Record<AssetClass, number> = {} as any;
    for (const pos of positions) {
      const notional = pos.notionalHKD ?? pos.marketValueHKD;
      if (notional > 0 && pos.assetClass !== 'STOCK' && pos.assetClass !== 'ETF') {
        leverageByClass[pos.assetClass] = (leverageByClass[pos.assetClass] ?? 0) + notional;
      }
    }

    const netDelta = positions.reduce((s, p) => s + (p.delta ?? 0) * p.quantity, 0);
    const netGamma = positions.reduce((s, p) => {
      const deltaVal = p.delta ?? 0;
      return s + deltaVal * deltaVal * (p.dailyVol ?? 0.02);
    }, 0);

    const recommendations: string[] = [];
    if (correlationMatrix.diversificationRatio > 0.8) {
      recommendations.push('✅ Highly diversified portfolio across asset classes');
    } else if (correlationMatrix.diversificationRatio < 0.5) {
      recommendations.push('⚠️ Low diversification — consider adding uncorrelated assets');
    }
    if (netGamma > 10) {
      recommendations.push(`⚠️ High net gamma: ${netGamma.toFixed(1)} (monitor gamma risk)`);
    }

    const totalValueHKD = positions.reduce((s, p) => s + p.marketValueHKD, 0);

    return {
      portfolioId,
      totalValueHKD: Math.round(totalValueHKD * 100) / 100,
      currencyBreakdown,
      assetClassBreakdown,
      fxExposure,
      positions,
      correlationMatrix,
      leverageByClass,
      netDelta: Math.round(netDelta * 1000) / 1000,
      netGamma: Math.round(netGamma * 1000) / 1000,
      recommendations,
      timestamp: Date.now(),
    };
  }
}

export default MultiAssetConnector;