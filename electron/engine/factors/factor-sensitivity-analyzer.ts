// R192: Parameter Sensitivity Analyzer - IC heatmap + overfitting detection

export interface SensitivityWindow { label: string; days: number; }
export interface SensitivityThreshold { label: string; value: number; }

export interface ICGridCell {
  window: number; threshold: number; ic: number; ir: number;
  posRetention: number; rankIC: number;
}

export interface ICHeatmapData {
  factorId: string;
  windows: SensitivityWindow[]; thresholds: SensitivityThreshold[];
  grid: ICGridCell[][];
  bestCell: { window: number; threshold: number; ic: number; };
  worstCell: { window: number; threshold: number; ic: number; };
  icStdDev: number; timestamp: number;
}

export interface OverfittingWarning {
  factorId: string;
  icGap: number; trainIC: number; testIC: number;
  icDecaySlope: number; icVolatility: number;
  severity: "none" | "watch" | "warning" | "critical";
  recommendations: string[]; timestamp: number;
}

export interface ICRecord {
  factorId: string; windowDays: number; threshold: number;
  ic: number; rankIC: number; ir: number;
  periodStart: number; periodEnd: number;
}

export interface SensitivityAnalysisResult {
  heatmap: ICHeatmapData; overfitting: OverfittingWarning; paramStabilityScore: number;
}

export class ParameterSensitivityAnalyzer {
  private defaultWindows: SensitivityWindow[] = [
    { label: "3M", days: 63 },
    { label: "6M", days: 126 },
    { label: "12M", days: 252 },
  ];
  private defaultThresholds: SensitivityThreshold[] = [
    { label: "-2std", value: -2 },
    { label: "-1std", value: -1 },
    { label: "+1std", value: 1 },
    { label: "+2std", value: 2 },
  ];

  constructor(
    private records: ICRecord[] = [],
    private options: { overfitWarningIcGap?: number; icVolatilityThreshold?: number; } = {}
  ) {}

  analyze(factorId: string): SensitivityAnalysisResult | null {
    const frec = this.records.filter(r => r.factorId === factorId);
    if (frec.length < 3) return null;
    const heatmap = this.buildHeatmap(factorId, frec);
    const overfitting = this.detectOverfitting(factorId, frec);
    return { heatmap, overfitting, paramStabilityScore: this.computeStability(heatmap) };
  }

  private buildHeatmap(factorId: string, records: ICRecord[]): ICHeatmapData {
    const windows = this.defaultWindows;
    const thresholds = this.defaultThresholds;
    const grid: ICGridCell[][] = [];
    let bestIc = -Infinity, worstIc = Infinity;
    let best = { window: 0, threshold: 0, ic: 0 }, worst = { ...best };
    const allIcs: number[] = [];
    for (const w of windows) {
      const row: ICGridCell[] = [];
      for (const t of thresholds) {
        const m = records.find(r => r.windowDays === w.days && r.threshold === t.value);
        const cell: ICGridCell = {
          window: w.days, threshold: t.value,
          ic: m?.ic ?? 0, ir: m?.ir ?? 0,
          posRetention: m ? (m.ic > 0 ? 1 : 0) : 0, rankIC: m?.rankIC ?? 0,
        };
        row.push(cell); allIcs.push(cell.ic);
        if (cell.ic > bestIc) { bestIc = cell.ic; best = { window: w.days, threshold: t.value, ic: cell.ic }; }
        if (cell.ic < worstIc) { worstIc = cell.ic; worst = { window: w.days, threshold: t.value, ic: cell.ic }; }
      }
      grid.push(row);
    }
    const mean = allIcs.length > 0 ? allIcs.reduce((a,b)=>a+b) / allIcs.length : 0;
    const std = Math.sqrt(allIcs.reduce((s,v)=>s+(v-mean)**2,0) / Math.max(1,allIcs.length));
    return { factorId, windows, thresholds, grid, bestCell: best, worstCell: worst, icStdDev: std, timestamp: Date.now() };
  }

  private detectOverfitting(factorId: string, records: ICRecord[]): OverfittingWarning {
    const byTime = records.sort((a,b) => a.periodStart - b.periodStart);
    const split = Math.max(1, Math.floor(byTime.length * 2 / 3));
    const train = byTime.slice(0, split);
    const test = byTime.slice(split);
    const trainIc = avg(train, r => r.ic);
    const testIc = avg(test, r => r.ic);
    const icGap = trainIc - testIc;

    let slope = 0;
    if (byTime.length > 2) {
      const t0 = byTime[0].periodStart;
      const sx = byTime.reduce((s,r) => s + (r.periodStart-t0), 0);
      const sy = byTime.reduce((s,r) => s + r.ic, 0);
      const sxy = byTime.reduce((s,r) => s + (r.periodStart-t0)*r.ic, 0);
      const sx2 = byTime.reduce((s,r) => s + (r.periodStart-t0)**2, 0);
      const den = byTime.length * sx2 - sx * sx;
      if (den !== 0) slope = (byTime.length * sxy - sx * sy) / den;
    }

    const mu = avg(records, r => r.ic);
    const vol = records.length > 1 ? Math.sqrt(records.reduce((s,r) => s + (r.ic-mu)**2, 0)/records.length) : 0;
    const gapThresh = this.options.overfitWarningIcGap ?? 0.1;
    const volThresh = this.options.icVolatilityThreshold ?? 0.05;

    let sev: OverfittingWarning["severity"] = "none";
    const recs: string[] = [];
    if (icGap > gapThresh) { sev = icGap > 0.2 ? "critical" : "warning"; recs.push("IC gap "+(icGap*100).toFixed(1)+"% (train-test). Overfitting."); }
    if (slope < -1e-9) { if (sev === "none") sev = "watch"; recs.push("IC decay slope negative. Signal weakening."); }
    if (vol > volThresh) { if (sev === "none") sev = "watch"; recs.push("High IC volatility across windows."); }
    if (testIc < 0.01) { if (sev === "none") sev = "warning"; recs.push("Test IC near zero. May not generalize."); }
    return { factorId, icGap, trainIC: trainIc, testIC: testIc, icDecaySlope: slope, icVolatility: vol, severity: sev, recommendations: recs, timestamp: Date.now() };
  }

  private computeStability(h: ICHeatmapData): number {
    if (h.icStdDev < 0.02) return 1;
    if (h.icStdDev > 0.1) return 0;
    return 1 - (h.icStdDev - 0.02) / 0.08;
  }

  addRecord(rec: ICRecord): void { this.records.push(rec); }
  addRecords(recs: ICRecord[]): void { this.records.push(...recs); }
  clear(): void { this.records = []; }
  getRecordCount(): number { return this.records.length; }
  getICRecords(factorId: string): ICRecord[] { return this.records.filter(r => r.factorId === factorId); }
  getHeatmapJSON(factorId: string): string { return JSON.stringify(this.analyze(factorId)?.heatmap ?? null); }
  getOverfittingReport(factorId: string): string { return JSON.stringify(this.analyze(factorId)?.overfitting ?? null); }
}

function avg<T>(arr: T[], fn: (t: T) => number): number {
  return arr.length > 0 ? arr.reduce((s, t) => s + fn(t), 0) / arr.length : 0;
}