/**
 * R264 Claw(PM): VoiceBroadcastUX → YahooLive 真实TTS数据桥接
 * 
 * VoiceBroadcastUX (ML R264 ~14KB) 已建TTS播放界面
 * 此桥接将YahooLive行情接入→生成TTS文本→触发语音播报
 */

import { YahooWebSocketLiveEngine, YahooLiveQuote } from '../../news/YahooWebSocketLiveEngine';

// ── Types ──
export interface TTSScript {
  text: string;           // 朗读文本
  lang: 'zh' | 'en';      // 语言
  emotion: string;        // 情绪标签
  confidence: number;     // 置信度 0-1
}

export type MarketMood = 'bull_strong' | 'bull_moderate' | 'neutral' | 'bear_moderate' | 'bear_strong';

export interface MarketOverview {
  mood: MarketMood;
  topMover: { symbol: string; changePct: number };
  topLoser: { symbol: string; changePct: number };
  advancing: number;
  declining: number;
  unchanged: number;
  totalSymbols: number;
}

// ── TTS Script Templates ──
const ZH_TEMPLATES: Record<MarketMood, (o: MarketOverview) => string> = {
  bull_strong: (o) =>
    `今天市场情绪强烈看多。${o.advancing}只上涨，${o.declining}只下跌。` +
    `${o.topMover.symbol}大涨${o.topMover.changePct.toFixed(1)}%领涨。整体偏乐观。`,
  bull_moderate: (o) =>
    `市场温和偏多。上涨家数${o.advancing}，多于下跌的${o.declining}家。` +
    `${o.topMover.symbol}表现最强，涨了${o.topMover.changePct.toFixed(1)}%。`,
  neutral: (o) =>
    `今天市场横盘整理。涨跌家数接近，${o.advancing}涨${o.declining}跌。` +
    `市场在等方向，建议观望。`,
  bear_moderate: (o) =>
    `市场温和偏空。${o.declining}只下跌，多于上涨的${o.advancing}只。` +
    `${o.topLoser.symbol}跌幅${Math.abs(o.topLoser.changePct).toFixed(1)}%领跌。`,
  bear_strong: (o) =>
    `注意，今天市场情绪偏空。${o.declining}只股票下跌，${o.topLoser.symbol}跌了` +
    `${Math.abs(o.topLoser.changePct).toFixed(1)}%。注意风险控制。`,
};

// ── Bridge ──
export class VoiceBroadcastDataBridge {
  private yahooEngine: YahooWebSocketLiveEngine;
  private quotes: Map<string, YahooLiveQuote> = new Map();
  private lastSummary: MarketOverview | null = null;
  private lastSummaryAt = 0;
  private summaryInterval = 60000; // 每60秒重新计算

  constructor() {
    this.yahooEngine = YahooWebSocketLiveEngine.getInstance();
  }

  async start(symbols: string[]): Promise<void> {
    await this.yahooEngine.connect();
    this.yahooEngine.subscribe(symbols);
    this.yahooEngine.on('live_quote', (quote) => {
      this.quotes.set(quote.symbol, quote);
    });
  }

  getMarketOverview(): MarketOverview {
    const all = Array.from(this.quotes.values());
    if (all.length === 0) {
      return { mood: 'neutral', topMover: { symbol: '-', changePct: 0 }, topLoser: { symbol: '-', changePct: 0 }, advancing: 0, declining: 0, unchanged: 0, totalSymbols: 0 };
    }

    const sorted = [...all].sort((a, b) => b.changePercent - a.changePercent);
    const advancing = all.filter(q => q.changePercent > 0.5).length;
    const declining = all.filter(q => q.changePercent < -0.5).length;
    const unchanged = all.length - advancing - declining;

    let mood: MarketMood = 'neutral';
    if (advancing > declining * 2) mood = 'bull_strong';
    else if (advancing > declining) mood = 'bull_moderate';
    else if (declining > advancing * 2) mood = 'bear_strong';
    else if (declining > advancing) mood = 'bear_moderate';

    this.lastSummary = {
      mood,
      topMover: { symbol: sorted[0].symbol, changePct: sorted[0].changePercent },
      topLoser: { symbol: sorted[sorted.length - 1].symbol, changePct: sorted[sorted.length - 1].changePercent },
      advancing, declining, unchanged, totalSymbols: all.length,
    };
    this.lastSummaryAt = Date.now();
    return this.lastSummary;
  }

  generateScript(overview?: MarketOverview): TTSScript {
    const o = overview ?? this.getMarketOverview();
    const text = ZH_TEMPLATES[o.mood]?.(o) ?? ZH_TEMPLATES.neutral(o);
    const confidenceMap: Record<MarketMood, number> = {
      bull_strong: 0.88, bull_moderate: 0.75, neutral: 0.60, bear_moderate: 0.75, bear_strong: 0.88,
    };
    return { text, lang: 'zh', emotion: o.mood, confidence: confidenceMap[o.mood] };
  }

  getQuotes(): YahooLiveQuote[] {
    return Array.from(this.quotes.values());
  }

  stop(): void {
    this.quotes.clear();
  }
}
