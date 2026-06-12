// ── R115 QTE-34 PM: OpenD资金流API接入 ─────────────────────────────────
// Proto 3312 Qot_GetCapitalFlow (直接获取主力/大/中/小单净流入)
// Proto 3204 Qot_GetMarketSnapshot (全市场快照 → 热力图数据源)
//
// @author PM (WorkBuddy)
// @round R115 QTE-34
// @since 2026-06-12

import type {
  HeatmapData,
  HeatmapGroup,
  MarketSnapshot,
} from './types';

// ═══════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════

/** 资金流分类 */
export type CapitalFlowCategory = 'super_large' | 'large' | 'medium' | 'small';

/** 单档资金流 */
export interface CapitalFlowLevel {
  category: CapitalFlowCategory;
  label: string;
  /** 净流入 (正=流入, 负=流出) */
  netFlow: number;
  /** 流入额 */
  inflow: number;
  /** 流出额 */
  outflow: number;
}

/** 个股资金流快照 */
export interface CapitalFlowSnapshot {
  symbol: string;
  brokerId: string;
  timestamp: number;
  levels: CapitalFlowLevel[];
  totalNetFlow: number;
  mainForceRatio: number; // (超大单+大单)/总成交额
}

// ═══════════════════════════════════════════════════════════════════════
// OPEND PROTO 3312 MAPPING
// ═══════════════════════════════════════════════════════════════════════

/**
 * Qot_GetCapitalFlow (Proto 3312) 原始响应映射
 *
 * OpenD Proto定义:
 *   message CapitalFlow {
 *     required Security security = 1;
 *     repeated CapitalFlowItem flowItemList = 2;
 *   }
 *   message CapitalFlowItem {
 *     required double inFlow = 1;        // 流入
 *     required string time = 2;          // 时间
 *     optional int32 timestamp = 3;
 *     optional double mainInFlow = 4;    // 主力净流入 (超大单)
 *     optional double superInFlow = 5;   // 超大单净流入
 *     optional double bigInFlow = 6;     // 大单净流入
 *     optional double midInFlow = 7;     // 中单净流入
 *     optional double smlInFlow = 8;     // 小单净流入
 *   }
 */
export function parseOpenDCapitalFlow(rawData: any): CapitalFlowSnapshot {
  const cf = rawData.s2c || rawData;
  const flowItem = cf.flowItemList?.[0] || cf;

  const superLarge = flowItem.superInFlow || 0;
  const large = flowItem.bigInFlow || 0;
  const medium = flowItem.midInFlow || 0;
  const small = flowItem.smlInFlow || 0;
  const total = flowItem.inFlow || (superLarge + large + medium + small);

  const levels: CapitalFlowLevel[] = [
    {
      category: 'super_large',
      label: '超大单',
      netFlow: superLarge,
      inflow: Math.max(0, superLarge),
      outflow: Math.abs(Math.min(0, superLarge)),
    },
    {
      category: 'large',
      label: '大单',
      netFlow: large,
      inflow: Math.max(0, large),
      outflow: Math.abs(Math.min(0, large)),
    },
    {
      category: 'medium',
      label: '中单',
      netFlow: medium,
      inflow: Math.max(0, medium),
      outflow: Math.abs(Math.min(0, medium)),
    },
    {
      category: 'small',
      label: '小单',
      netFlow: small,
      inflow: Math.max(0, small),
      outflow: Math.abs(Math.min(0, small)),
    },
  ];

  return {
    symbol: cf.security?.code || '',
    brokerId: 'futu',
    timestamp: Date.now(),
    levels,
    totalNetFlow: total,
    mainForceRatio: total > 0 ? (superLarge + large) / total : 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// OPEND PROTO 3204 MAPPING
// ═══════════════════════════════════════════════════════════════════════

/**
 * Qot_GetMarketSnapshot (Proto 3204) → HeatmapData 映射
 *
 * 将OpenD全市场快照转换为热力图所需的数据结构
 */
export interface MarketSnapshotItem {
  symbol: string;
  name: string;
  sector: string;          // 板块名称
  marketCap: number;       // 市值
  price: number;
  changePct: number;       // 涨跌幅 (%)
  changePct5d?: number;    // 5日涨跌幅
  changePct20d?: number;   // 20日涨跌幅
  changePctYtd?: number;   // 年初至今涨跌幅
  volume: number;          // 成交量
  turnover: number;        // 成交额
  turnoverRate?: number;    // 换手率
  pe?: number;              // PE
  pb?: number;              // PB
}

export function parseOpenDMarketSnapshot(rawData: any): MarketSnapshotItem[] {
  const ms = rawData.s2c || rawData;
  const snapshots = ms.snapshotList || ms.marketSnapshotList || [];

  return snapshots.map((s: any) => ({
    symbol: s.security?.code || s.stockCode || '',
    name: s.name || s.stockName || '',
    sector: s.plate || s.sector || '未分类',
    marketCap: s.marketVal || s.marketCap || 0,
    price: s.lastPrice || s.curPrice || s.price || 0,
    changePct: s.changeRate || s.changePct || 0,
    changePct5d: s.fiveDayChangeRate,
    changePct20d: s.twentyDayChangeRate,
    changePctYtd: s.ytdChangeRate,
    volume: s.volume || 0,
    turnover: s.turnover || (s.price || 0) * (s.volume || 0),
    turnoverRate: s.turnoverRate,
    pe: s.pe || s.peRatio,
    pb: s.pb || s.pbRatio,
  }));
}

// ═══════════════════════════════════════════════════════════════════════
// HEATMAP DATA BUILDER
// ═══════════════════════════════════════════════════════════════════════

/**
 * 将MarketSnapshotItem转换为HeatmapGroup
 * 按板块/行业聚合
 */
export function buildHeatmapGroups(
  items: MarketSnapshotItem[],
  timeFrame: 'today' | '5d' | '20d' | 'ytd' = 'today',
): HeatmapData {
  const sectorMap = new Map<string, {
    name: string;
    changePct: number;
    totalMarketCap: number;
    stockCount: number;
    stocks: MarketSnapshot[];
  }>();

  for (const item of items) {
    let group = sectorMap.get(item.sector);
    if (!group) {
      group = {
        name: item.sector,
        changePct: 0,
        totalMarketCap: 0,
        stockCount: 0,
        stocks: [],
      };
      sectorMap.set(item.sector, group);
    }

    const changeField = timeFrame === 'today' ? item.changePct
      : timeFrame === '5d' ? (item.changePct5d || 0)
      : timeFrame === '20d' ? (item.changePct20d || 0)
      : (item.changePctYtd || 0);

    group.stocks.push({
      symbol: item.symbol,
      name: item.name,
      price: item.price,
      changePct: changeField,
      changeAmount: item.price * changeField / 100,
      volume: item.volume,
      turnover: item.turnover,
      marketCap: item.marketCap,
      pe: item.pe || 0,
      pb: item.pb || 0,
      sector: item.sector,
      high: item.price,
      low: item.price,
      open: item.price,
      preClose: item.price,
      updateTime: Date.now(),
    });

    group.totalMarketCap += item.marketCap;
    group.stockCount++;
  }

  // 计算板块平均涨跌幅(市值加权)
  const groups: HeatmapGroup[] = [];
  for (const [, g] of sectorMap) {
    let weightedChange = 0;
    for (const s of g.stocks) {
      weightedChange += s.changePct * (s.marketCap / (g.totalMarketCap || 1));
    }
    groups.push({
      name: g.name,
      changePct: weightedChange,
      totalMarketCap: g.totalMarketCap,
      stocks: g.stocks,
    });
  }

  return {
    groups: groups.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct)),
    updateTime: Date.now(),
  };
}
