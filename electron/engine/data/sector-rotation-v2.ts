// @ts-nocheck
// ── Sector Rotation Detector (JVS-48) ──────────────────────────────────────
// Monitor sector capital flows and detect rotation signals
// IPC: em:sector-rotation

import log from 'electron-log';
import i18n from '../../../src/i18n';

// ── Types ──────────────────────────────────────────────────────────────────

export interface SectorFlowData {
  sector: string;
  netInflow: number;       // Net capital inflow (10K CNY)
  changePct: number;       // Sector price change (%)
  volume: number;          // Trading volume
  date: string;
}

export interface SectorRotationParams {
  currentPeriod: SectorFlowData[];
  previousPeriod: SectorFlowData[];
  lookbackPeriods?: number;  // Number of periods for momentum (default 5)
  history?: SectorFlowData[][];  // Historical periods for momentum calc
}

export interface RotationSignal {
  type: 'inflow_rotation' | 'outflow_rotation' | 'momentum_shift' | 'relative_strength';
  fromSectors: string[];
  toSectors: string[];
  strength: number;        // 0-100 signal strength
  description: string;
}

export interface SectorMomentum {
  sector: string;
  currentInflow: number;
  previousInflow: number;
  inflowChange: number;    // Change in inflow
  inflowChangePct: number; // % change
  momentum: number;        // Multi-period momentum score
  relativeStrength: number; // RS vs all sectors
  rank: number;
  trend: 'accelerating' | 'decelerating' | 'stable';
}

export interface SectorRotationResult {
  signals: RotationSignal[];
  momentum: SectorMomentum[];
  rankings: {
    topInflow: string[];
    topOutflow: string[];
    improving: string[];     // Sectors with improving flow
    deteriorating: string[]; // Sectors with worsening flow
  };
  summary: string;
  timestamp: number;
}

// ── Main Function ──────────────────────────────────────────────────────────

export function detectSectorRotation(params: SectorRotationParams): SectorRotationResult {
  const { currentPeriod, previousPeriod, lookbackPeriods = 5, history = [] } = params;

  // Build sector maps
  const currentMap = new Map<string, SectorFlowData>();
  const previousMap = new Map<string, SectorFlowData>();

  for (const s of currentPeriod) currentMap.set(s.sector, s);
  for (const s of previousPeriod) previousMap.set(s.sector, s);

  const allSectors = new Set<string>();
  for (const s of currentPeriod) allSectors.add(s.sector);
  for (const s of previousPeriod) allSectors.add(s.sector);

  // Calculate momentum for each sector
  const momentumData: SectorMomentum[] = [];

  for (const sector of allSectors) {
    const current = currentMap.get(sector);
    const previous = previousMap.get(sector);

    const currentInflow = current?.netInflow ?? 0;
    const previousInflow = previous?.netInflow ?? 0;
    const inflowChange = currentInflow - previousInflow;
    const inflowChangePct = previousInflow !== 0
      ? (inflowChange / Math.abs(previousInflow)) * 100
      : (currentInflow > 0 ? 100 : currentInflow < 0 ? -100 : 0);

    // Multi-period momentum
    let momentum = inflowChange;
    if (history.length > 0) {
      let momentumSum = 0;
      let count = 0;
      const periods = Math.min(lookbackPeriods, history.length);
      for (let i = 0; i < periods; i++) {
        const period = history[history.length - 1 - i];
        const sectorData = period.find(s => s.sector === sector);
        if (sectorData) {
          momentumSum += sectorData.netInflow;
          count++;
        }
      }
      if (count > 0) {
        momentum = momentumSum / count;
      }
    }

    // Trend detection
    let trend: SectorMomentum['trend'] = 'stable';
    if (history.length >= 2) {
      const recent = history.slice(-3).map(p => p.find(s => s.sector === sector)?.netInflow ?? 0);
      if (recent.length >= 2) {
        const diffs = [];
        for (let i = 1; i < recent.length; i++) {
          diffs.push(recent[i] - recent[i - 1]);
        }
        const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
        if (avgDiff > 0) trend = 'accelerating';
        else if (avgDiff < 0) trend = 'decelerating';
      }
    }

    momentumData.push({
      sector,
      currentInflow,
      previousInflow,
      inflowChange,
      inflowChangePct: round(inflowChangePct, 2),
      momentum: round(momentum, 2),
      relativeStrength: 0, // Calculated below
      rank: 0,
      trend,
    });
  }

  // Calculate relative strength (rank by inflow change %)
  momentumData.sort((a, b) => b.inflowChangePct - a.inflowChangePct);
  for (let i = 0; i < momentumData.length; i++) {
    momentumData[i].rank = i + 1;
    momentumData[i].relativeStrength = round(
      momentumData.length > 1
        ? (1 - i / (momentumData.length - 1)) * 100
        : 50,
      2
    );
  }

  // Detect rotation signals
  const signals: RotationSignal[] = [];

  // 1. Inflow rotation: sectors gaining flow while others lose
  const gainingSectors = momentumData.filter(m => m.inflowChange > 0 && m.currentInflow > 0);
  const losingSectors = momentumData.filter(m => m.inflowChange < 0 && m.currentInflow < 0);

  if (gainingSectors.length > 0 && losingSectors.length > 0) {
    signals.push({
      type: 'inflow_rotation',
      fromSectors: losingSectors.slice(0, 5).map(s => s.sector),
      toSectors: gainingSectors.slice(0, 5).map(s => s.sector),
      strength: Math.min(100, gainingSectors.length * 15 + losingSectors.length * 10),
      description: `${i18n.t('SectorRotationV2.k0')}${losingSectors.slice(0, 3).map(s => s.sector).join(', i18n.t('SectorRotationV2.k0'), ')}]`,
    });
  }

  // 2. Momentum shift: sectors with accelerating/decelerating trends
  const accelerating = momentumData.filter(m => m.trend === 'accelerating' && m.inflowChange > 0);
  const decelerating = momentumData.filter(m => m.trend === 'decelerating' && m.inflowChange < 0);

  if (accelerating.length >= 2 && decelerating.length >= 2) {
    signals.push({
      type: 'momentum_shift',
      fromSectors: decelerating.slice(0, 5).map(s => s.sector),
      toSectors: accelerating.slice(0, 5).map(s => s.sector),
      strength: Math.min(100, (accelerating.length + decelerating.length) * 12),
      description: `${i18n.t('SectorRotationV2.k1')} ${accelerating.slice(0, 3).map(s => s.sector).join(', i18n.t('SectorRotationV2.k1'), ')} ${i18n.t('SectorRotationV2.k2')}`,
    });
  }

  // 3. Relative strength leaders/laggards
  const topRS = momentumData.slice(0, 3);
  const bottomRS = momentumData.slice(-3);

  if (topRS.length > 0 && bottomRS.length > 0) {
    signals.push({
      type: 'relative_strength',
      fromSectors: bottomRS.map(s => s.sector),
      toSectors: topRS.map(s => s.sector),
      strength: Math.min(100, (topRS[0].relativeStrength - bottomRS[bottomRS.length - 1].relativeStrength)),
      description: `${i18n.t('SectorRotationV2.k3')} ${topRS.map(s => s.sector).join(', i18n.t('SectorRotationV2.k2'), ')} ${i18n.t('SectorRotationV2.k4')}`,
    });
  }

  // Rankings
  const sortedByInflow = [...momentumData].sort((a, b) => b.currentInflow - a.currentInflow);
  const sortedByChange = [...momentumData].sort((a, b) => b.inflowChange - a.inflowChange);

  const rankings = {
    topInflow: sortedByInflow.slice(0, 5).map(s => s.sector),
    topOutflow: sortedByInflow.slice(-5).reverse().map(s => s.sector),
    improving: sortedByChange.filter(s => s.inflowChange > 0).slice(0, 5).map(s => s.sector),
    deteriorating: sortedByChange.filter(s => s.inflowChange < 0).slice(-5).reverse().map(s => s.sector),
  };

  // Summary
  const summaryParts: string[] = [];
  if (signals.length > 0) {
    summaryParts.push(`${i18n.t('SectorRotationV2.k5')} ${signals.length} ${i18n.t('SectorRotationV2.k6')}`);
    summaryParts.push(signals[0].description);
  } else {
    summaryParts.push(i18n.t('sectorRotationV2.k1'));
  }
  if (rankings.topInflow.length > 0) {
    summaryParts.push(`${i18n.t('SectorRotationV2.k7')} ${rankings.topInflow.slice(0, 3).join(', ')}`);
  }

  log.info(`[SectorRotation] ${allSectors.size} sectors, ${signals.length} signals`);

  return {
    signals,
    momentum: momentumData,
    rankings,
    summary: summaryParts.join(' | '),
    timestamp: Date.now(),
  };
}

function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
