// ══ R263 LOBEHUB P2: 热力图板块分类准确率 ══
// Heatmap Sector Classification Accuracy — 10板块×50股票分类是否正确？
//
// 验证: 每只股票是否被分到正确的板块
// 粒度: GICS一级(11) → QUANT MOO一级(10)
//
// 10板块: 科技/金融/医疗/消费(可选)/消费(必需)/工业/能源/材料/公用/房地产/通信

export type SectorId = 'TECH' | 'FINANCIAL' | 'HEALTHCARE' | 'CONSUMER_DISCRETIONARY' | 'CONSUMER_STAPLES' | 'INDUSTRIAL' | 'ENERGY' | 'MATERIALS' | 'UTILITIES' | 'REAL_ESTATE' | 'COMMUNICATION';

export interface StockClassification {
  symbol: string;
  expectedSector: SectorId;
  expectedSectorName: string;
  classifiedSector: SectorId;
  classifiedSectorName: string;
  correct: boolean;
  confidence: number;       // 0-1, 分类置信度
}

export interface SectorAccuracyReport {
  timestamp: number;
  totalStocks: number;
  totalCorrect: number;
  overallAccuracy: number;    // %
  bySector: Array<{
    sectorId: SectorId;
    sectorName: string;
    total: number;
    correct: number;
    accuracy: number;
    avgConfidence: number;
  }>;
  misclassified: StockClassification[];
  recommendations: string[];
}

// ═══════════════════ 板块ID映射 ═══════════════════

export const SECTOR_ID_MAP: Record<SectorId, { name: string; emoji: string; gicsCode: string }> = {
  TECH: { name: '科技', emoji: '💻', gicsCode: '45' },
  FINANCIAL: { name: '金融', emoji: '🏦', gicsCode: '40' },
  HEALTHCARE: { name: '医疗', emoji: '🏥', gicsCode: '35' },
  CONSUMER_DISCRETIONARY: { name: '消费(可选)', emoji: '🛍️', gicsCode: '25' },
  CONSUMER_STAPLES: { name: '消费(必需)', emoji: '🛒', gicsCode: '30' },
  INDUSTRIAL: { name: '工业', emoji: '🏭', gicsCode: '20' },
  ENERGY: { name: '能源', emoji: '⛽', gicsCode: '10' },
  MATERIALS: { name: '材料', emoji: '🧱', gicsCode: '15' },
  UTILITIES: { name: '公用', emoji: '⚡', gicsCode: '55' },
  REAL_ESTATE: { name: '房地产', emoji: '🏘️', gicsCode: '60' },
  COMMUNICATION: { name: '通信', emoji: '📡', gicsCode: '50' },
};

// ═══════════════════ 分类准确率评估 ═══════════════════

export function evaluateSectorAccuracy(
  classifications: StockClassification[],
): SectorAccuracyReport {
  const totalCorrect = classifications.filter(c => c.correct).length;
  const overallAccuracy = classifications.length > 0 ? totalCorrect / classifications.length * 100 : 0;

  // By sector
  const sectorMap = new Map<SectorId, StockClassification[]>();
  for (const c of classifications) {
    const list = sectorMap.get(c.expectedSector) || [];
    list.push(c);
    sectorMap.set(c.expectedSector, list);
  }

  const bySector = Array.from(sectorMap.entries()).map(([sid, stocks]) => ({
    sectorId: sid,
    sectorName: SECTOR_ID_MAP[sid]?.name || sid,
    total: stocks.length,
    correct: stocks.filter(s => s.correct).length,
    accuracy: stocks.length > 0 ? stocks.filter(s => s.correct).length / stocks.length * 100 : 0,
    avgConfidence: stocks.reduce((a, b) => a + b.confidence, 0) / Math.max(1, stocks.length),
  })).sort((a, b) => a.accuracy - b.accuracy);

  const misclassified = classifications.filter(c => !c.correct);

  const recs: string[] = [];
  for (const s of bySector) {
    if (s.accuracy < 100) recs.push(`⚠️ ${s.sectorName}—${s.total - s.correct}/${s.total}分类错误`);
  }
  if (overallAccuracy >= 95) recs.unshift('✅ 整体分类准确率优秀');
  else if (overallAccuracy >= 85) recs.unshift('⚠️ 整体分类准确率可接受但需改进');

  return {
    timestamp: Date.now(),
    totalStocks: classifications.length,
    totalCorrect,
    overallAccuracy: Math.round(overallAccuracy * 100) / 100,
    bySector,
    misclassified,
    recommendations: recs,
  };
}

// ═══════════════════ 热门行业覆盖率 ═══════════════════

export function evaluateHeatmapCoverage(
  classifications: StockClassification[],
  requiredSectors: SectorId[] = ['TECH', 'FINANCIAL', 'HEALTHCARE', 'CONSUMER_DISCRETIONARY', 'CONSUMER_STAPLES', 'INDUSTRIAL', 'ENERGY', 'MATERIALS', 'UTILITIES', 'COMMUNICATION'],
): { covered: SectorId[]; missing: SectorId[]; coveragePct: number } {
  const present = new Set(classifications.map(c => c.expectedSector));
  const covered = requiredSectors.filter(s => present.has(s));
  const missing = requiredSectors.filter(s => !present.has(s));
  return { covered, missing, coveragePct: covered.length / requiredSectors.length * 100 };
}

// ═══════════════════ 颜色映射验证 ═══════════════════

export function validateColorMapping(
  sectorId: SectorId,
  heatmapValue: number,  // -10 to +10 (relative strength)
): { color: string; intensity: number; label: string; valid: boolean } {
  const abs = Math.abs(heatmapValue);
  const intensity = Math.min(1, abs / 10);

  let color: string;
  if (heatmapValue >= 5) color = '#00FF00';     // 深绿—强烈流入
  else if (heatmapValue >= 2) color = '#80FF00'; // 浅绿—温和流入
  else if (heatmapValue >= 0) color = '#CCCCCC'; // 灰—中性
  else if (heatmapValue >= -2) color = '#FF8080'; // 浅红—温和流出
  else color = '#FF0000';                         // 深红—强烈流出

  const valid = SECTOR_ID_MAP[sectorId] !== undefined && abs <= 10;

  return { color, intensity, label: `${SECTOR_ID_MAP[sectorId]?.emoji || ''} ${SECTOR_ID_MAP[sectorId]?.name || sectorId}`, valid };
}

export default SectorAccuracyReport;
