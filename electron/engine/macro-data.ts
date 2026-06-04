// Bridge module — re-exports macro data utilities for data-consistency-checker
// and data-export-service which import from './macro-data'

import { analyzeMultipleIndicators, type MacroAlertResult } from './macro-alert';

export interface MacroDataReport {
  timestamp: number;
  indicators: Record<string, number | null>;
  alerts: MacroAlertResult[];
}

export async function getMacroDataReport(): Promise<MacroDataReport> {
  const alerts = await analyzeMultipleIndicators();
  return {
    timestamp: Date.now(),
    indicators: {},
    alerts,
  };
}
