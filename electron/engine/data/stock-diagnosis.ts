// ── [R158 JVS] Thin wrapper — backward compat redirect to asset-diagnosis ──
// All functionality moved to asset-diagnosis.ts for multi-market support
// This file preserved for backward compatibility with existing imports

import log from 'electron-log';
import {
  diagnoseAsset,
  batchDiagnoseAssets,
  type AssetDiagnosisRequest,
  type AssetDiagnosisReport,
  type AssetMarket,
  type AssetType,
  type DimensionResult,
} from './asset-diagnosis';

// Re-export new types
export type {
  AssetDiagnosisRequest as StockDiagnosisRequest,
  AssetDiagnosisReport as StockDiagnosisReport,
  AssetMarket,
  AssetType,
  DimensionResult,
};

/**
 * @deprecated Use diagnoseAsset() from asset-diagnosis.ts instead
 * Redirects stock diagnosis to multi-asset diagnosis engine
 */
export async function diagnoseStock(
  request: AssetDiagnosisRequest
): Promise<AssetDiagnosisReport> {
  log.info('[StockDiagnosis] Redirecting to AssetDiagnosis (multi-market)');
  return diagnoseAsset({ ...request, assetType: 'stock' });
}

/**
 * @deprecated Use batchDiagnoseAssets() from asset-diagnosis.ts instead
 */
export async function batchDiagnose(
  codes: string[],
  options?: Partial<AssetDiagnosisRequest>
): Promise<AssetDiagnosisReport[]> {
  const requests: AssetDiagnosisRequest[] = codes.map(code => ({
    code,
    ...options,
    assetType: 'stock',
  }));
  return batchDiagnoseAssets(requests);
}
