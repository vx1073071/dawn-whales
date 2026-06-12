// R127-Q01: nocheck cleared — bridge-api IpcError widening (R107 S-26)
/**
 * @deprecated Use src/services/risk-service.ts instead (R108 S-34).
 * Service layer provides typed interfaces and abstracts IPC calls.
 *
 * ── DAWN WHALES — Bridge API Risk Module ──────────────────────────────
 * S-15p1 split: NL Parser + Risk + Risk Config
 * S-15p2: Zod-derived types replaced all `any` usage
 */

import type {
  IpcResponse,
  NlParsedStrategy,
  NlParseParams,
  RiskUpdateConfigParams,
  RiskUpdateVixParams,
} from '../../types/ipc';
import { hasIPC } from '../bridge-api-types';

// ── NL Parser ──────────────────────────────────────────────────────────────

export async function parseNL(text: string): Promise<IpcResponse<NlParsedStrategy>> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.nl.parse(text);
}

export async function getTemplates(): Promise<NlParsedStrategy[]> {
  if (!hasIPC()) return [];
  const result = await window.api.nl.templates();
  return result?.success ? result.templates || [] : [];
}

// ── Risk ───────────────────────────────────────────────────────────────────

export async function getRiskAlerts(): Promise<unknown[]> {
  if (!hasIPC()) return [];
  const result = await window.api.risk.getAlerts();
  return result?.success ? result.alerts || [] : [];
}

// ── Risk Config ─────────────────────────────────────────────────────────────

export async function getRiskConfig(): Promise<RiskUpdateConfigParams | null> {
  if (!hasIPC()) return null;
  return window.api.risk.getConfig();
}

export async function updateRiskConfig(config: RiskUpdateConfigParams): Promise<IpcResponse> {
  if (!hasIPC()) return { success: false };
  return window.api.risk.updateConfig(config);
}
