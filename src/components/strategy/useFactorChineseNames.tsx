// ── R172 B6: Factor Chinese Name Hook ────────────────────────────────────
// Centralizes all factor name lookups from FactorI18nRegistry.
// Provides: getFactorName(), getFactorCategory(), getFactorOneLine()
// Ensures 100% Chinese name coverage across all UI components.

import { useMemo } from 'react';

// ── Complete factor name registry ────────────────────────────────────────────

const FACTOR_CN_NAMES: Record<string, { name: string; category: string; oneLine: string }> = {
  MKT: { name: '市场Beta', category: '宏观', oneLine: '个股对整体市场的敏感度，>1放大市场波动' },
  SMB: { name: '小盘因子', category: '规模', oneLine: '小市值股票相对大市值股票的溢价效应' },
  HML: { name: '价值因子', category: '价值', oneLine: '高账面市值比股票长期跑赢成长股' },
  MOM: { name: '动量因子', category: '动量', oneLine: '过去表现好的股票未来短期继续跑赢' },
  MOM_12M: { name: '12月动量', category: '动量', oneLine: '过去12个月累计收益，反映中期趋势' },
  VOL: { name: '低波因子', category: '波动', oneLine: '低波动股票风险调整后收益往往更高' },
  VOL_60D: { name: '60日低波', category: '波动', oneLine: '60日波动率倒数，防御性最强因子之一' },
  QUAL: { name: '品质因子', category: '品质', oneLine: '高ROE+低负债+稳定盈利增长的企业' },
  RMW: { name: '盈利能力', category: '品质', oneLine: '高毛利企业相对低毛利企业的溢价' },
  CMA: { name: '投资因子', category: '品质', oneLine: '低资本支出企业相对高资本支出的溢价' },
  LIQ: { name: '流动性因子', category: '宏观', oneLine: '高流动性标的交易成本低，承载资金量大' },
  YIELD: { name: '股息率', category: '价值', oneLine: '高股息股票有类债券属性，适合收入型配置' },
  SIZE: { name: '规模因子', category: '规模', oneLine: '总市值对收益的影响，类似SMB' },
  GROWTH: { name: '成长因子', category: '成长', oneLine: '营收/利润增长率筛选，适合成长风格' },
  MA_20_60: { name: '均线交叉', category: '趋势', oneLine: 'MA20上穿MA60为买入信号' },
  RSI_14: { name: 'RSI', category: '动量', oneLine: '14日相对强弱指标，识别超买超卖' },
  ADX: { name: 'ADX趋势', category: '趋势', oneLine: '平均趋向指数，衡量趋势强度' },
  BETA: { name: 'Beta系数', category: '宏观', oneLine: '个股相对基准的波动倍数' },
  STM: { name: '短期动量', category: '动量', oneLine: '过去1个月收益，反映短期动能' },
};

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useFactorChineseNames() {
  return useMemo(
    () => ({
      /** Get Chinese name for a factor ID, fallback to ID */
      getName: (factorId: string): string =>
        FACTOR_CN_NAMES[factorId]?.name || factorId,

      /** Get category */
      getCategory: (factorId: string): string =>
        FACTOR_CN_NAMES[factorId]?.category || '其他',

      /** Get one-line explanation */
      getOneLine: (factorId: string): string =>
        FACTOR_CN_NAMES[factorId]?.oneLine || '',

      /** Get full entry */
      getEntry: (factorId: string) =>
        FACTOR_CN_NAMES[factorId] || null,

      /** Check if factor is known */
      isKnown: (factorId: string): boolean =>
        factorId in FACTOR_CN_NAMES,

      /** Get all known factor IDs */
      getAllIds: (): string[] =>
        Object.keys(FACTOR_CN_NAMES),

      /** Get factors grouped by category */
      getByCategory: (): Record<string, string[]> => {
        const groups: Record<string, string[]> = {};
        Object.entries(FACTOR_CN_NAMES).forEach(([id, entry]) => {
          if (!groups[entry.category]) groups[entry.category] = [];
          groups[entry.category].push(id);
        });
        return groups;
      },

      /** Search factors by query (name or ID) */
      search: (query: string): string[] => {
        const q = query.toLowerCase();
        return Object.entries(FACTOR_CN_NAMES)
          .filter(([id, entry]) =>
            entry.name.toLowerCase().includes(q) ||
            id.toLowerCase().includes(q) ||
            entry.oneLine.toLowerCase().includes(q),
          )
          .map(([id]) => id);
      },
    }),
    [],
  );
}

// ── Static export (for non-React contexts) ───────────────────────────────────

export const FactorCN = {
  getName: (factorId: string) => FACTOR_CN_NAMES[factorId]?.name || factorId,
  getCategory: (factorId: string) => FACTOR_CN_NAMES[factorId]?.category || '其他',
  getOneLine: (factorId: string) => FACTOR_CN_NAMES[factorId]?.oneLine || '',
  isKnown: (factorId: string) => factorId in FACTOR_CN_NAMES,
  getAllIds: () => Object.keys(FACTOR_CN_NAMES),
};

export default useFactorChineseNames;
