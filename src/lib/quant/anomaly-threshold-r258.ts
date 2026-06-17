// R258 LOBEHUB P1-04: 异动阈值优化引擎

export type MarketRegime = 'BULL' | 'BEAR' | 'SIDEWAYS' | 'HIGH_VOL' | 'LOW_VOL' | 'CRISIS';
export type TimeContext = 'PRE_MARKET' | 'REGULAR_HOURS' | 'AFTER_HOURS' | 'EARNINGS_SEASON' | 'WEEKEND';

export interface AnomalyThresholdConfig {
  // 基础阈值（来自历史N日波动率%）
  baseChangeThreshold: number;       // 基础涨跌幅阈值 (%)
  baseVolumeThreshold: number;       // 成交量异常倍数
  spreadWideningThreshold: number;   // 价差扩大倍数

  // 市场状态调整因子（乘数）
  regimeMultiplier: Record<MarketRegime, number>;
  timeMultiplier: Record<TimeContext, number>;

  // 个性化阈值（基于个股特性）
  symbolBetaAdjustment: boolean;     // 高Beta→更宽阈值
  symbolVolAdjustment: boolean;      // 高波动股→更宽阈值
  marketCapAdjustment: boolean;      // 小盘→更宽阈值

  // A/B验证
  abTestActive: boolean;
  abTestVariant: 'A' | 'B';         // A=传统阈值, B=动态阈值
}

export interface AnomalySignal {
  symbol: string;
  market: string;
  timestamp: number;
  type: 'PRICE_SURGE' | 'PRICE_PLUMMET' | 'VOLUME_SPIKE' | 'SPREAD_WIDENING' | 'GAP_UP' | 'GAP_DOWN';
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  value: number;
  currentThreshold: number;
  description: string;
  pushEligible: boolean;  // 该异动是否应该推送？
}

export interface AnomalyThresholdReport {
  timestamp: number;
  config: AnomalyThresholdConfig;
  signals: AnomalySignal[];
  totalSignals: number;
  criticalSignals: number;
  pushEligibleSignals: number;
  falsePositiveRate: number;   // 估算
  recommendations: string[];
}

// ═══════════════════ 默认配置 ═══════════════════

export const DEFAULT_ANOMALY_CONFIG: AnomalyThresholdConfig = {
  baseChangeThreshold: 3.0,       // 3%涨跌=异动
  baseVolumeThreshold: 3.0,       // 成交量=均值3倍
  spreadWideningThreshold: 2.0,   // 价差=正常2倍

  regimeMultiplier: {
    BULL: 0.8,        // 牛市：阈值放低→更容易触发(因为牛市里3%是小波动)
    BEAR: 1.2,        // 熊市：阈值提高→减少噪音(熊市里-5%是日常)
    SIDEWAYS: 1.0,    // 震荡：标准
    HIGH_VOL: 1.5,    // 高波动：大幅提高
    LOW_VOL: 0.7,     // 低波动：降低
    CRISIS: 2.0,      // 危机：最大阈值（-10%都不叫异动了）
  },

  timeMultiplier: {
    PRE_MARKET: 0.8,        // 盘前容易异动
    REGULAR_HOURS: 1.0,
    AFTER_HOURS: 1.3,       // 盘后流动性差→更容易假异动
    EARNINGS_SEASON: 1.5,   // 财报季预期波动大
    WEEKEND: 2.0,           // 周末基本不推送
  },

  symbolBetaAdjustment: true,
  symbolVolAdjustment: true,
  marketCapAdjustment: true,

  abTestActive: false,
  abTestVariant: 'B',
};

// ═══════════════════ 市场状态检测 ═══════════════════

export function detectMarketRegime(
  vix: number,
  marketChange20d: number,
): MarketRegime {
  if (vix > 40) return 'CRISIS';
  if (vix > 30) return 'HIGH_VOL';
  if (vix < 12) return 'LOW_VOL';
  if (marketChange20d > 10) return 'BULL';
  if (marketChange20d < -10) return 'BEAR';
  return 'SIDEWAYS';
}

export function detectTimeContext(now: Date): TimeContext {
  const hour = now.getHours();
  const month = now.getMonth();
  const day = now.getDay();

  // 财报季(1月/4月/7月/10月)
  if ([0, 3, 6, 9].includes(month)) return 'EARNINGS_SEASON';
  // 周末
  if (day === 0 || day === 6) return 'WEEKEND';
  // 盘前盘后
  if (hour < 9 || hour >= 16) return hour >= 16 ? 'AFTER_HOURS' : 'PRE_MARKET';
  return 'REGULAR_HOURS';
}

// ═══════════════════ 动态阈值计算 ═══════════════════

export interface SymbolProfile {
  symbol: string;
  beta: number;
  avgDailyVolatility: number;    // %
  marketCap: 'MEGA' | 'LARGE' | 'MID' | 'SMALL' | 'MICRO';
  avgVolume: number;
}

export function computeDynamicThreshold(
  profile: SymbolProfile,
  regime: MarketRegime,
  time: TimeContext,
  config: AnomalyThresholdConfig = DEFAULT_ANOMALY_CONFIG,
): number {
  let threshold = config.baseChangeThreshold;

  // 制度乘数
  threshold *= config.regimeMultiplier[regime];

  // 时段乘数
  threshold *= config.timeMultiplier[time];

  // 个股调整
  if (config.symbolBetaAdjustment) {
    // 高beta股阈値更宽
    if (profile.beta > 2) threshold *= 1.4;
    else if (profile.beta > 1.5) threshold *= 1.2;
    else if (profile.beta > 1) threshold *= 1.05;
    else if (profile.beta < 0.5) threshold *= 0.8;
  }

  if (config.symbolVolAdjustment) {
    // 内在波动率高的股阈値更宽
    if (profile.avgDailyVolatility > 5) threshold *= 1.5;
    else if (profile.avgDailyVolatility > 3) threshold *= 1.2;
    else if (profile.avgDailyVolatility < 1) threshold *= 0.8;
  }

  if (config.marketCapAdjustment) {
    // 小盘阈値更宽
    if (profile.marketCap === 'MICRO') threshold *= 1.6;
    else if (profile.marketCap === 'SMALL') threshold *= 1.3;
    else if (profile.marketCap === 'MID') threshold *= 1.1;
  }

  return Math.round(threshold * 100) / 100;
}

// ═══════════════════ 异动检测器 ═══════════════════

export function detectAnomaly(
  symbol: string,
  market: string,
  priceChangePct: number,
  volumeRatio: number,
  _spreadRatio: number,
  prevClose: number,
  currentOpen: number,
  profile: SymbolProfile,
  regime: MarketRegime,
  time: TimeContext,
  config: AnomalyThresholdConfig = DEFAULT_ANOMALY_CONFIG,
): AnomalySignal | null {
  const threshold = computeDynamicThreshold(profile, regime, time, config);
  const absChange = Math.abs(priceChangePct);

  // Price anomaly
  if (absChange >= threshold) {
    const type = priceChangePct > 0 ? 'PRICE_SURGE' : 'PRICE_PLUMMET';
    let severity: AnomalySignal['severity'] = 'INFO';
    if (absChange >= threshold * 2.5) severity = 'CRITICAL';
    else if (absChange >= threshold * 1.5) severity = 'WARNING';

    return {
      symbol, market, timestamp: Date.now(), type, severity,
      value: priceChangePct,
      currentThreshold: threshold,
      description: `${symbol} ${type === 'PRICE_SURGE' ? '暴涨' : '暴跌'}${absChange.toFixed(2)}% (阈值${threshold}%) — ${regime} × ${time}`,
      pushEligible: severity !== 'INFO' && time !== 'WEEKEND',
    };
  }

  // Volume spike
  const volThreshold = config.baseVolumeThreshold * config.regimeMultiplier[regime];
  if (volumeRatio >= volThreshold) {
    return {
      symbol, market, timestamp: Date.now(),
      type: 'VOLUME_SPIKE',
      severity: volumeRatio >= volThreshold * 2 ? 'WARNING' : 'INFO',
      value: volumeRatio,
      currentThreshold: volThreshold,
      description: `${symbol} 成交量异动 ${volumeRatio.toFixed(1)}×均值 (阈值${volThreshold}×)`,
      pushEligible: volumeRatio >= volThreshold * 2,
    };
  }

  // Gap up/down
  const gapPct = ((currentOpen - prevClose) / prevClose) * 100;
  if (Math.abs(gapPct) >= threshold * 0.6) {
    return {
      symbol, market, timestamp: Date.now(),
      type: gapPct > 0 ? 'GAP_UP' : 'GAP_DOWN',
      severity: Math.abs(gapPct) >= threshold ? 'WARNING' : 'INFO',
      value: gapPct,
      currentThreshold: threshold * 0.6,
      description: `${symbol} 跳空${gapPct > 0 ? '高开' : '低开'}${Math.abs(gapPct).toFixed(2)}%`,
      pushEligible: Math.abs(gapPct) >= threshold,
    };
  }

  return null;
}

// ═══════════════════ 批量检测报告 ═══════════════════

export function generateThresholdReport(
  symbols: Array<{ symbol: string; market: string; priceChangePct: number; volumeRatio: number; spreadRatio: number; prevClose: number; currentOpen: number }>,
  profiles: Map<string, SymbolProfile>,
  regime: MarketRegime,
  time: TimeContext,
  config: AnomalyThresholdConfig = DEFAULT_ANOMALY_CONFIG,
): AnomalyThresholdReport {
  const signals: AnomalySignal[] = [];
  for (const s of symbols) {
    const profile = profiles.get(s.symbol) || {
      symbol: s.symbol, beta: 1, avgDailyVolatility: 2, marketCap: 'LARGE' as const, avgVolume: 1000000,
    };
    const signal = detectAnomaly(s.symbol, s.market, s.priceChangePct, s.volumeRatio, s.spreadRatio, s.prevClose, s.currentOpen, profile, regime, time, config);
    if (signal) signals.push(signal);
  }

  signals.sort((a, b) => {
    const sev = { CRITICAL: 0, WARNING: 1, INFO: 2 };
    return sev[a.severity] - sev[b.severity];
  });

  const critical = signals.filter(s => s.severity === 'CRITICAL');
  const pushEligible = signals.filter(s => s.pushEligible);

  return {
    timestamp: Date.now(),
    config,
    signals,
    totalSignals: signals.length,
    criticalSignals: critical.length,
    pushEligibleSignals: pushEligible.length,
    falsePositiveRate: time === 'WEEKEND' ? 0.2 : 0.05,
    recommendations: [
      critical.length > signals.length * 0.3
        ? `⚠️ 危急信号占比${(critical.length/signals.length*100).toFixed(0)}% — 考虑提高阈值`
        : `✅ 危急信号占比适中`,
      pushEligible.length === 0 && signals.length > 0
        ? '💡 无推送建议——所有异动低于推送门槛'
        : pushEligible.length > 0
          ? `📱 ${pushEligible.length}条推送建议 — ${pushEligible.filter(s=>s.type.includes('PLUMMET')).length}条暴跌预警`
          : '',
    ].filter(r => r !== ''),
  };
}

export default AnomalySignal;
