// ══ R260 LOBEHUB P2: 行业轮动分析规则 ══
// Sector Rotation Rules — "钱在板块间流动，规则帮你看到"
//
// 分析维度:
//   1. 相对强度排名 (RS)——各板块相对大盘的强度
//   2. 动量轮动信号——哪个板块在加速/减速
//   3. 经济周期匹配——扩张/收缩→不同板块
//   4. 资金流向——哪个板块在吸金
//   5. 轮动路径预测——下一站去哪？

// R260: 行业轮动——独立分析模块

export type EconomicCycle = 'EXPANSION_EARLY' | 'EXPANSION_MID' | 'EXPANSION_LATE' | 'CONTRACTION' | 'RECOVERY';

export interface SectorRotationInput {
  sectorId: string;
  sectorName: string;
  sectorEmoji: string;
  returns: Record<string, number[]>;  // 1W/1M/3M/6M/YTD 收益率
  relativeStrength: number;          // vs benchmark
  momentumAcceleration: number;      // 动量变化率（加速/减速）
  capitalFlow: number;               // 资金净流入/流出
  valuation: 'CHEAP' | 'FAIR' | 'EXPENSIVE';
}

export interface SectorRotationSignal {
  sectorId: string;
  sectorName: string;
  sectorEmoji: string;
  rotationScore: number;      // 0-100 轮动强度
  direction: 'ROTATING_IN' | 'ROTATING_OUT' | 'HOLDING' | 'PARKING';
  cycleFit: EconomicCycle[];
  strengthRank: number;       // 1=N
  signal: string;             // 鲸灵风格的一句话
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface SectorRotationSnapshot {
  timestamp: number;
  currentCycle: EconomicCycle;
  sectors: SectorRotationSignal[];
  hotSectors: string[];       // 最高分的2-3个
  coldSectors: string[];      // 最低分的2-3个
  rotationPath: string[];     // 预测轮动路径(板块名序列)
  recommendations: string[];
}

// ═══════════════════ 经济周期→板块推荐 ═══════════════════

export const CYCLE_SECTOR_MAP: Record<EconomicCycle, string[]> = {
  EXPANSION_EARLY: ['TECHNOLOGY', 'CONSUMER_DISCRETIONARY', 'INDUSTRIAL'],
  EXPANSION_MID: ['TECHNOLOGY', 'INDUSTRIAL', 'ENERGY', 'MATERIALS'],
  EXPANSION_LATE: ['ENERGY', 'MATERIALS', 'HEALTHCARE', 'CONSUMER_STAPLES'],
  CONTRACTION: ['UTILITIES', 'CONSUMER_STAPLES', 'HEALTHCARE', 'TELECOM'],
  RECOVERY: ['FINANCIAL', 'REAL_ESTATE', 'CONSUMER_DISCRETIONARY', 'INDUSTRIAL'],
};

export function detectEconomicCycle(
  gdpGrowth: number,
  inflation: number,
  _unemployment: number,
  _yieldCurve: number,       // R260: reserved for future use
  manufacturingPMI: number,
): EconomicCycle {
  if (gdpGrowth > 3 && inflation < 3 && manufacturingPMI > 55) return 'EXPANSION_EARLY';
  if (gdpGrowth > 2 && inflation > 3 && manufacturingPMI > 50) return 'EXPANSION_MID';
  if (gdpGrowth < 2 && inflation > 4 && manufacturingPMI < 50) return 'EXPANSION_LATE';
  if (gdpGrowth < 0 && manufacturingPMI < 45) return 'CONTRACTION';
  return 'RECOVERY';
}

// ═══════════════════ 轮动评分引擎 ═══════════════════

export function scoreSectorRotation(
  sector: SectorRotationInput,
  currentCycle: EconomicCycle,
  allSectors: SectorRotationInput[],
): SectorRotationSignal {
  let score = 0;

  // 1. 相对强度 (0-30)
  if (sector.relativeStrength > 5) score += 30;
  else if (sector.relativeStrength > 2) score += 22;
  else if (sector.relativeStrength > 0) score += 15;
  else if (sector.relativeStrength > -2) score += 8;
  else score += 2;

  // 2. 动量加速 (0-25)
  if (sector.momentumAcceleration > 3) score += 25;
  else if (sector.momentumAcceleration > 1) score += 18;
  else if (sector.momentumAcceleration > 0) score += 12;
  else if (sector.momentumAcceleration > -1) score += 5;
  else score += 1;

  // 3. 资金流向 (0-20)
  if (sector.capitalFlow > 1000) score += 20;
  else if (sector.capitalFlow > 500) score += 15;
  else if (sector.capitalFlow > 0) score += 10;
  else if (sector.capitalFlow > -500) score += 4;
  else score += 1;

  // 4. 经济周期匹配 (0-15)
  const cycleFit = CYCLE_SECTOR_MAP[currentCycle];
  if (cycleFit.includes(sector.sectorId)) score += 15;
  else score += 3;

  // 5. 估值 (0-10)
  if (sector.valuation === 'CHEAP') score += 10;
  else if (sector.valuation === 'FAIR') score += 6;
  else score += 2;

  // Direction
  const ranked = [...allSectors].sort((a, b) => b.relativeStrength - a.relativeStrength);
  const rank = ranked.findIndex(s => s.sectorId === sector.sectorId) + 1;
  let direction: SectorRotationSignal['direction'] = 'HOLDING';
  const totalSectors = allSectors.length;

  if (rank <= Math.ceil(totalSectors * 0.2)) direction = 'ROTATING_IN';     // Top 20%
  else if (rank >= Math.ceil(totalSectors * 0.8)) direction = 'ROTATING_OUT'; // Bottom 20%
  else if (sector.momentumAcceleration > 0.5) direction = 'ROTATING_IN';
  else if (sector.momentumAcceleration < -0.5) direction = 'ROTATING_OUT';
  else if (sector.capitalFlow < -100) direction = 'PARKING';

  const priority: SectorRotationSignal['priority'] =
    direction === 'ROTATING_IN' ? 'HIGH' :
    direction === 'ROTATING_OUT' ? 'HIGH' :
    'MEDIUM';

  const signals: Record<string, string> = {
    ROTATING_IN: `💰 资金正在涌入${sector.sectorName}——相对强度${sector.relativeStrength > 0 ? '+' : ''}${sector.relativeStrength.toFixed(1)}%，动量加速中`,
    ROTATING_OUT: `📤 资金正在流出${sector.sectorName}——相对强度减弱，注意减仓`,
    HOLDING: `⏸️ ${sector.sectorName}保持稳定——无明显的资金方向`,
    PARKING: `🏖️ 资金暂时停泊在${sector.sectorName}(避险)——等待下一个方向`,
  };

  return {
    sectorId: sector.sectorId,
    sectorName: sector.sectorName,
    sectorEmoji: sector.sectorEmoji,
    rotationScore: score,
    direction,
    cycleFit: [currentCycle],
    strengthRank: rank,
    signal: signals[direction],
    priority,
  };
}

// ═══════════════════ 轮动快照 ═══════════════════

export function generateRotationSnapshot(
  sectors: SectorRotationInput[],
  currentCycle: EconomicCycle,
): SectorRotationSnapshot {
  const signals = sectors.map(s => scoreSectorRotation(s, currentCycle, sectors));
  signals.sort((a, b) => b.rotationScore - a.rotationScore);
  // Re-rank
  signals.forEach((s, i) => { s.strengthRank = i + 1; });

  const hotSectors = signals.filter(s => s.direction === 'ROTATING_IN').slice(0, 3).map(s => s.sectorEmoji + ' ' + s.sectorName);
  const coldSectors = signals.filter(s => s.direction === 'ROTATING_OUT').slice(-3).map(s => s.sectorEmoji + ' ' + s.sectorName);

  // Predict rotation path
  const rotationPath = signals
    .filter(s => s.direction === 'ROTATING_IN')
    .slice(0, 3)
    .map(s => s.sectorName);

  const recs: string[] = [];
  if (hotSectors.length > 0) recs.push(`🔥 当前热钱方向: ${hotSectors.join(' → ')}`);
  if (coldSectors.length > 0) recs.push(`❄️ 当前冷落板块: ${coldSectors.join(', ')}`);
  if (currentCycle === 'CONTRACTION' && hotSectors.length < 2) recs.push('🛡️ 收缩期——防御性板块(公用事业/消费必需品/医疗)通常跑赢');
  if (currentCycle === 'EXPANSION_EARLY') recs.push('🚀 扩张早期——周期性板块(科技/工业/可选消费)机会最大');

  return {
    timestamp: Date.now(),
    currentCycle,
    sectors: signals,
    hotSectors,
    coldSectors,
    rotationPath,
    recommendations: recs,
  };
}

export default SectorRotationSnapshot;
