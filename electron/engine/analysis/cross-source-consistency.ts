/**
 * R254 DQ-03: CrossSourceConsistency — 跨源一致性规则引擎
 * LOBEHUB | v3.0.0 QUANT MOO
 *
 * 多数据源间交叉验证。同一标的在Yahoo/Binance/东方财富/IB之间价格偏离>1%→告警。
 * 帮助发现延迟源/错误数据/API限流等问题。
 *
 * 规则: 价格一致性/成交量一致性/时间戳一致性/数据完整性
 * >=350L
 */

export type CrossSourceRule = 'price_consistency' | 'volume_consistency' | 'timestamp_lag' | 'data_completeness';

export interface SourceReading {
  sourceId: string; symbol: string; price: number; volume: number;
  timestamp: number; bid?: number; ask?: number;
}

export interface ConsistencyCheck {
  rule: CrossSourceRule; pass: boolean; severity: 'critical'|'warning'|'info';
  sources: string[]; details: string;
  maxDeviation: number; // 最大偏差%
}

export interface CrossSourceReport {
  symbol: string; sourcesCount: number; checks: ConsistencyCheck[];
  overallScore: number; // 0-100
  bestSource: string; worstSource: string;
  recommendation: string;
}

export class CrossSourceConsistency {
  readonly id = 'cross_source_consistency'; readonly version = '3.0.0';

  readonly allowedDeviations: Record<CrossSourceRule, number> = {
    price_consistency: 0.01,    // 1%
    volume_consistency: 0.15,   // 15%
    timestamp_lag: 5000,        // 5s
    data_completeness: 0.90,    // 90%
  };

  check(readings: SourceReading[]): CrossSourceReport {
    if (readings.length < 2) {
      return { symbol: readings[0]?.symbol || 'unknown', sourcesCount: readings.length,
        checks: [], overallScore: 100, bestSource: readings[0]?.sourceId || '', worstSource: '',
        recommendation: '需要至少2个源进行比较' };
    }

    const checks: ConsistencyCheck[] = [];
    let totalScore = 0;

    // 1. 价格一致性
    const priceCheck = this.checkPriceConsistency(readings);
    checks.push(priceCheck);
    totalScore += priceCheck.pass ? 40 : 0;

    // 2. 成交量一致性
    const volCheck = this.checkVolumeConsistency(readings);
    checks.push(volCheck);
    totalScore += volCheck.pass ? 25 : 0;

    // 3. 时间戳延迟
    const lagCheck = this.checkTimestampLag(readings);
    checks.push(lagCheck);
    totalScore += lagCheck.pass ? 20 : 0;

    // 4. 数据完整性
    const compCheck = this.checkCompleteness(readings);
    checks.push(compCheck);
    totalScore += compCheck.pass ? 15 : 0;

    // 找最优/最差源
    const prices = readings.map(r => ({ id: r.sourceId, price: r.price }));
    const avgPrice = prices.reduce((s, p) => s + p.price, 0) / prices.length;
    const deviations = prices.map(p => ({ id: p.id, dev: Math.abs(p.price - avgPrice) / avgPrice }));
    deviations.sort((a, b) => a.dev - b.dev);
    const bestSource = deviations[0]?.id || '';
    const worstSource = deviations[deviations.length - 1]?.id || '';

    const recommendation = totalScore >= 80 ? '所有源一致性良好，可信任'
      : totalScore >= 60 ? '部分源存在偏差，建议使用Yahoo为主源'
      : totalScore >= 40 ? '多源一致性差，请检查数据源配置'
      : '数据源严重不一致，建议立即排查';

    return { symbol: readings[0]?.symbol || 'unknown', sourcesCount: readings.length,
      checks, overallScore: totalScore, bestSource, worstSource, recommendation };
  }

  private checkPriceConsistency(readings: SourceReading[]): ConsistencyCheck {
    const prices = readings.map(r => r.price).filter(p => p > 0);
    if (prices.length < 2) return { rule:'price_consistency', pass:true, severity:'info', sources:[], details:'价格数据不足2个源', maxDeviation:0 };

    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    const maxDev = Math.max(...prices.map(p => Math.abs(p - avg) / avg));

    const maxAllowed = this.allowedDeviations.price_consistency;
    const pass = maxDev <= maxAllowed;

    return {
      rule: 'price_consistency', pass, severity: pass ? 'info' : 'warning',
      sources: readings.map(r => `${r.sourceId}: ${r.price}`),
      details: pass ? `价格一致 (最大偏差 ${(maxDev*100).toFixed(2)}% < ${(maxAllowed*100).toFixed(0)}%)`
        : `价格不一致! 最大偏差 ${(maxDev*100).toFixed(2)}% > ${(maxAllowed*100).toFixed(0)}%`,
      maxDeviation: Math.round(maxDev * 10000) / 100,
    };
  }

  private checkVolumeConsistency(readings: SourceReading[]): ConsistencyCheck {
    const vols = readings.map(r => r.volume).filter(v => v > 0);
    if (vols.length < 2) return { rule:'volume_consistency', pass:true, severity:'info', sources:[], details:'量数据不足', maxDeviation:0 };

    const avg = vols.reduce((a, b) => a + b, 0) / vols.length;
    const maxDev = Math.max(...vols.map(v => Math.abs(v - avg) / (avg || 1)));

    return {
      rule: 'volume_consistency', pass: maxDev <= this.allowedDeviations.volume_consistency,
      severity: maxDev > 0.3 ? 'warning' : 'info',
      sources: readings.map(r => `${r.sourceId}: ${r.volume}`),
      details: maxDev <= 0.15 ? '成交量基本一致' : `成交量偏差较大 (${(maxDev*100).toFixed(0)}%)`,
      maxDeviation: Math.round(maxDev * 10000) / 100,
    };
  }

  private checkTimestampLag(readings: SourceReading[]): ConsistencyCheck {
    const now = Date.now();
    const lags = readings.map(r => now - r.timestamp);
    const maxLag = Math.max(...lags);

    return {
      rule: 'timestamp_lag', pass: maxLag <= this.allowedDeviations.timestamp_lag,
      severity: maxLag > 10000 ? 'warning' : 'info',
      sources: readings.map(r => `${r.sourceId}: ${Math.round((now - r.timestamp) / 1000)}s ago`),
      details: maxLag <= 5000 ? '所有源实时' : `最慢源延迟 ${Math.round(maxLag / 1000)}s`,
      maxDeviation: Math.round(maxLag / 1000 * 100) / 100,
    };
  }

  private checkCompleteness(readings: SourceReading[]): ConsistencyCheck {
    const complete = readings.filter(r => r.price > 0 && r.volume > 0).length;
    const ratio = complete / readings.length;

    return {
      rule: 'data_completeness', pass: ratio >= this.allowedDeviations.data_completeness,
      severity: ratio < 0.5 ? 'critical' : ratio < 0.9 ? 'warning' : 'info',
      sources: readings.filter(r => r.price <= 0 || r.volume <= 0).map(r => `${r.sourceId}: 缺数据`),
      details: ratio >= 0.9 ? `数据完整 (${complete}/${readings.length})` : `数据不完整! ${readings.length - complete}个源缺数据`,
      maxDeviation: Math.round((1 - ratio) * 100),
    };
  }
}

export default CrossSourceConsistency;
