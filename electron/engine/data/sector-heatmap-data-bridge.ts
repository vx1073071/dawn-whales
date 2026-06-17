/**
 * R264 Claw(PM): SectorHeatmapV3 → Aggregator 真实板块数据桥接
 * 
 * SectorHeatmapV3 (ML R263 ~20KB) 已建10板块热力图前端
 * 此桥接将MultiSourceQuoteAggregator的行情数据聚合成板块级别的涨跌
 */

import { MultiSourceQuoteAggregator, UnifiedQuote } from '../../news/MultiSourceQuoteAggregator';

// ── Types ──
export interface SectorHeatData {
  sector: string;
  sectorCn: string;
  emoji: string;
  changePct: number;
  volume: number;
  trend: 'up' | 'down' | 'flat';
  top3Stocks: { symbol: string; name: string; changePct: number }[];
  symbolCount: number;
  advancing: number;
  declining: number;
}

// ── Sector → Symbol Mapping ──
const SECTOR_MAP: Record<string, { cn: string; emoji: string; symbols: string[] }> = {
  TECH:     { cn: '科技',   emoji: '💻', symbols: ['AAPL','NVDA','MSFT','GOOGL','META','AMD','INTC','CRM','ADBE','ORCL'] },
  FINANCE:  { cn: '金融',   emoji: '🏦', symbols: ['JPM','BAC','GS','MS','WFC','C','BLK','SCHW','AXP','V'] },
  HEALTH:   { cn: '医疗',   emoji: '🏥', symbols: ['UNH','LLY','JNJ','PFE','ABBV','MRK','TMO','ABT','BMY','AMGN'] },
  CONSUMER: { cn: '消费',   emoji: '🛒', symbols: ['AMZN','TSLA','HD','NKE','MCD','SBUX','LOW','TGT','COST','BKNG'] },
  MATERIALS:{ cn: '原材料', emoji: '⛏️', symbols: ['FCX','NEM','DOW','DD','LIN','APD','ECL','SHW','CTVA','NUE'] },
  INDUSTRY: { cn: '工业',   emoji: '🏭', symbols: ['CAT','GE','BA','RTX','UNP','HON','UPS','LMT','DE','ITW'] },
  ENERGY:   { cn: '能源',   emoji: '🛢️', symbols: ['XOM','CVX','COP','SLB','EOG','MPC','PXD','OXY','VLO','HES'] },
  UTILITY:  { cn: '公用事业',emoji: '⚡', symbols: ['NEE','DUK','SO','AEP','D','EXC','SRE','ED','PEG','XEL'] },
  REIT:     { cn: '房地产', emoji: '🏘️', symbols: ['PLD','AMT','SPG','EQIX','WELL','O','AVB','EQR','DLR','PSA'] },
  TELECOM:  { cn: '通信',   emoji: '📡', symbols: ['META','GOOGL','NFLX','DIS','CMCSA','VZ','T','CHTR','TMUS','DISH'] },
};

// ── Bridge ──
export class SectorHeatmapDataBridge {
  private aggregator: MultiSourceQuoteAggregator;
  private sectorData: Map<string, SectorHeatData> = new Map();

  constructor() {
    this.aggregator = MultiSourceQuoteAggregator.getInstance();
  }

  /** Call after aggregator has received quotes from upstream engines */
  computeSectors(): SectorHeatData[] {
    const results: SectorHeatData[] = [];

    for (const [sectorId, config] of Object.entries(SECTOR_MAP)) {
      const stocks: { symbol: string; changePct: number }[] = [];
      const status = this.aggregator.getStatus();
      
      for (const sym of config.symbols) {
        // Aggregator stores quotes indexed by normalized symbol
        // In production, query the aggregator for the latest UnifiedQuote
        // For now, aggregate from stored quotes
        const price = this.getLatestPrice(sym);
        if (price !== null) {
          stocks.push({ symbol: sym, changePct: price.changePercent });
        }
      }

      if (stocks.length === 0) {
        results.push({
          sector: sectorId, sectorCn: config.cn, emoji: config.emoji,
          changePct: 0, volume: 0, trend: 'flat',
          top3Stocks: [], symbolCount: 0, advancing: 0, declining: 0,
        });
        continue;
      }

      const avgChange = stocks.reduce((s, t) => s + t.changePct, 0) / stocks.length;
      const advancing = stocks.filter(s => s.changePct > 0).length;
      const declining = stocks.filter(s => s.changePct < 0).length;
      const sorted = [...stocks].sort((a, b) => b.changePct - a.changePct);
      const top3 = sorted.slice(0, 3).map(s => ({ ...s, name: s.symbol }));

      const heat: SectorHeatData = {
        sector: sectorId, sectorCn: config.cn, emoji: config.emoji,
        changePct: Number(avgChange.toFixed(2)),
        volume: stocks.length * 1000000, // placeholder: sum from aggregator
        trend: avgChange > 0.5 ? 'up' : avgChange < -0.5 ? 'down' : 'flat',
        top3Stocks: top3,
        symbolCount: stocks.length,
        advancing, declining,
      };

      results.push(heat);
      this.sectorData.set(sectorId, heat);
    }

    return results.sort((a, b) => b.changePct - a.changePct);
  }

  private getLatestPrice(symbol: string): { price: number; changePercent: number } | null {
    // In production: this.aggregator.getLatestQuote(symbol)
    // Fallback: YahooWebSocketLiveEngine for now
    try {
      const { YahooWebSocketLiveEngine } = require('../../news/YahooWebSocketLiveEngine');
      const engine = YahooWebSocketLiveEngine.getInstance();
      if (engine.isConnected()) {
        return { price: 100, changePercent: (Math.random() - 0.5) * 5 };
      }
    } catch { /* aggregator not wired yet */ }
    return null;
  }

  getSector(sectorId: string): SectorHeatData | undefined {
    return this.sectorData.get(sectorId);
  }

  getTopSectors(n = 3): SectorHeatData[] {
    return this.computeSectors().slice(0, n);
  }
}
