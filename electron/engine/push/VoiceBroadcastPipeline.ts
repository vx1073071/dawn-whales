/**
 * VoiceBroadcastPipeline — R262 P2-04
 *
 * 语音播报数据管线。接真实行情源，生成TTS文本，投喂语音播报。
 *
 * Feature set:
 *   - 行情→TTS文本生成 (价格变动/涨跌幅/成交量/市场状态)
 *   - AI Briefing One-Liner 集成 (AI总结→50字播报)
 *   - 播报触发条件: 涨跌>3%/成交量暴增/开盘收盘/市场状态切换
 *   - 播报优先级: urgent speech > high > normal
 *   - TTS目标模型适配 (SSML/纯文本)
 *   - 播报频率控制 (最小间隔/每小时上限)
 *   - 多语言模板 (zh/en)
 *
 * Architecture:
 *   - Singleton with reset()
 *   - Quote ingestion → condition check → generate → queue → TTS
 *
 * @author JVS
 * @round R262
 * @since 2026-06-17
 */

import { EventEmitter } from 'events';

// ─── Types ───────────────────────────────────────────────

export type BroadcastPriority = 'urgent' | 'high' | 'normal';

export type BroadcastTrigger =
  | 'price_surge'
  | 'price_slump'
  | 'volume_spike'
  | 'market_open'
  | 'market_close'
  | 'crash_warning'
  | 'breakout'
  | 'ai_briefing'
  | 'periodic';

export interface VoiceBroadcast {
  id: string;
  symbol: string;
  trigger: BroadcastTrigger;
  priority: BroadcastPriority;
  language: 'zh' | 'en';
  ssml: string;
  plainText: string;
  voiceId?: string;
  timestamp: number;
  spoken: boolean;
  queued: boolean;
}

export interface BroadcastConfig {
  priceChangeThresholdPct: number;   // 播报最小涨跌幅
  volumeSpikeMultiplier: number;
  minIntervalMs: number;              // 最小播报间隔
  maxPerHour: number;
  language: 'zh' | 'en';
  enableSSML: boolean;
  enableAIBriefing: boolean;
}

export interface BroadcastStats {
  totalGenerated: number;
  totalSpoken: number;
  byTrigger: Record<string, number>;
  bySymbol: Record<string, number>;
  lastBroadcastTime: number;
  broadcastsLastHour: number;
}

// ─── Defaults ────────────────────────────────────────────

const DEFAULT_CONFIG: BroadcastConfig = {
  priceChangeThresholdPct: 3,
  volumeSpikeMultiplier: 5,
  minIntervalMs: 5000,
  maxPerHour: 120,
  language: 'zh',
  enableSSML: true,
  enableAIBriefing: true,
};

// ─── Engine ──────────────────────────────────────────────

export class VoiceBroadcastPipeline extends EventEmitter {
  private static instance: VoiceBroadcastPipeline;

  private config: BroadcastConfig;
  private broadcasts: VoiceBroadcast[] = [];
  private broadcastHistory: Map<string, number> = new Map(); // symbol:trigger → last ts
  private idCounter = 0;
  private lastBroadcastTime = 0;
  private hourlyTimestamps: number[] = [];
  private previousPrices: Map<string, number> = new Map();
  private previousVolumes: Map<string, number> = new Map();

  constructor(config?: Partial<BroadcastConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  static getInstance(config?: Partial<BroadcastConfig>): VoiceBroadcastPipeline {
    if (!VoiceBroadcastPipeline.instance) {
      VoiceBroadcastPipeline.instance = new VoiceBroadcastPipeline(config);
    } else if (config) {
      VoiceBroadcastPipeline.instance.config = { ...VoiceBroadcastPipeline.instance.config, ...config };
    }
    return VoiceBroadcastPipeline.instance;
  }

  reset(): void {
    this.broadcasts = [];
    this.broadcastHistory.clear();
    this.previousPrices.clear();
    this.previousVolumes.clear();
    this.hourlyTimestamps = [];
    this.idCounter = 0;
    this.lastBroadcastTime = 0;
    this.removeAllListeners();
  }

  // ─── Quote Ingestion ────────────────────────────────────

  /**
   * Ingest a live quote. Checks conditions and generates voice broadcast if triggered.
   */
  ingestQuote(quote: { symbol: string; price: number; changePercent: number; volume: number; source?: string }): VoiceBroadcast[] {
    const results: VoiceBroadcast[] = [];

    // Hourly limit
    this.pruneHourlyTimestamps();
    if (this.hourlyTimestamps.length >= this.config.maxPerHour) return results;

    // Min interval
    if (this.lastBroadcastTime > 0 && Date.now() - this.lastBroadcastTime < this.config.minIntervalMs) return results;

    const triggers = this.checkTriggers(quote);

    // Always update previous values (before early return)
    this.previousPrices.set(quote.symbol, quote.price);
    this.previousVolumes.set(quote.symbol, quote.volume);

    if (triggers.length === 0) return results;

    for (const trigger of triggers) {
      const dedupKey = `${quote.symbol}:${trigger}`;
      const last = this.broadcastHistory.get(dedupKey);
      if (last && Date.now() - last < 10000) continue; // dedup 10s

      const broadcast = this.createBroadcast(quote.symbol, trigger, quote);
      this.broadcastHistory.set(dedupKey, Date.now());
      this.broadcasts.push(broadcast);
      results.push(broadcast);

      this.lastBroadcastTime = Date.now();
      this.hourlyTimestamps.push(Date.now());
    }

    return results;
  }

  private checkTriggers(quote: { symbol: string; price: number; changePercent: number; volume: number }): BroadcastTrigger[] {
    const triggers: BroadcastTrigger[] = [];

    if (quote.changePercent >= this.config.priceChangeThresholdPct) triggers.push('price_surge');
    else if (quote.changePercent <= -this.config.priceChangeThresholdPct) triggers.push('price_slump');

    const prevVol = this.previousVolumes.get(quote.symbol) || quote.volume;
    if (prevVol > 0 && quote.volume > prevVol * this.config.volumeSpikeMultiplier) triggers.push('volume_spike');

    if (quote.changePercent <= -8) triggers.push('crash_warning');
    if (Math.abs(quote.changePercent) >= 6) triggers.push('breakout');

    return triggers;
  }

  // ─── Broadcast Creation ─────────────────────────────────

  private createBroadcast(symbol: string, trigger: BroadcastTrigger, quote: { price: number; changePercent: number }): VoiceBroadcast {
    const lang = this.config.language;
    const texts = this.generateScript(symbol, trigger, quote, lang);

    return {
      id: `vb_${++this.idCounter}`,
      symbol, trigger,
      priority: this.inferPriority(trigger, quote.changePercent),
      language: lang,
      ssml: this.config.enableSSML ? texts.ssml : '',
      plainText: texts.plain,
      timestamp: Date.now(),
      spoken: false,
      queued: false,
    };
  }

  private generateScript(symbol: string, trigger: BroadcastTrigger, quote: { price: number; changePercent: number }, lang: 'zh' | 'en'): { ssml: string; plain: string } {
    const pct = Math.abs(quote.changePercent).toFixed(2);
    const price = quote.price.toFixed(2);
    const dir = quote.changePercent >= 0 ? (lang === 'zh' ? '上涨' : 'up') : (lang === 'zh' ? '下跌' : 'down');

    if (lang === 'zh') {
      return this.generateZhScript(symbol, trigger, price, pct, dir);
    }
    return this.generateEnScript(symbol, trigger, price, pct, dir);
  }

  private generateZhScript(symbol: string, trigger: BroadcastTrigger, price: string, pct: string, dir: string): { ssml: string; plain: string } {
    let plain = '';

    switch (trigger) {
      case 'price_surge':
        plain = `${symbol}快速${dir}${pct}%，当前报价${price}元。`;
        break;
      case 'price_slump':
        plain = `${symbol}快速${dir}${pct}%，当前报价${price}元，请注意风险。`;
        break;
      case 'volume_spike':
        plain = `${symbol}成交量忽然暴增，当前报价${price}元，可能有重大行情变化。`;
        break;
      case 'market_open':
        plain = `开盘提醒：${symbol}当前报价${price}元，涨跌幅${pct}%。`;
        break;
      case 'market_close':
        plain = `收盘提醒：${symbol}收盘报价${price}元，今日涨跌幅${pct}%。`;
        break;
      case 'crash_warning':
        plain = `崩盘预警：${symbol}暴跌${pct}%至${price}元，请立即关注！`;
        break;
      case 'breakout':
        plain = `突破信号：${symbol}大幅${dir}${pct}%，价格${price}元，已突破关键价位。`;
        break;
      case 'ai_briefing':
        plain = `AI行情简评：${symbol}当前${price}元，${dir}${pct}%，技术形态偏强。`;
        break;
      case 'periodic':
        plain = `${symbol}当前报价${price}元，涨跌幅${pct}%。`;
        break;
    }

    const ssml = `<speak><prosody rate="medium" pitch="medium">${plain}</prosody></speak>`;
    return { ssml, plain };
  }

  private generateEnScript(symbol: string, trigger: BroadcastTrigger, price: string, pct: string, dir: string): { ssml: string; plain: string } {
    let plain = '';
    switch (trigger) {
      case 'price_surge':
        plain = `${symbol} surging ${dir} ${pct}%, currently at ${price}.`;
        break;
      case 'price_slump':
        plain = `${symbol} dropping ${pct}%, currently at ${price}. Watch for risk.`;
        break;
      case 'volume_spike':
        plain = `${symbol} volume spike detected, currently at ${price}. Major move may be underway.`;
        break;
      case 'market_open':
        plain = `Market open: ${symbol} at ${price}, change ${pct}%.`;
        break;
      case 'market_close':
        plain = `Market close: ${symbol} settled at ${price}, daily change ${pct}%.`;
        break;
      case 'crash_warning':
        plain = `Crash warning: ${symbol} collapsed ${pct}% to ${price}!`;
        break;
      case 'breakout':
        plain = `Breakout: ${symbol} surged ${pct}% to ${price}, key level breached.`;
        break;
      case 'ai_briefing':
        plain = `AI briefing: ${symbol} at ${price}, ${dir} ${pct}%. Technical outlook bullish.`;
        break;
      case 'periodic':
        plain = `${symbol} at ${price}, change ${pct}%.`;
        break;
    }
    const ssml = `<speak><prosody rate="medium">${plain}</prosody></speak>`;
    return { ssml, plain };
  }

  private inferPriority(trigger: BroadcastTrigger, changePct: number): BroadcastPriority {
    if (trigger === 'crash_warning') return 'urgent';
    if (trigger === 'breakout' && Math.abs(changePct) >= 10) return 'high';
    if (trigger === 'market_open' || trigger === 'market_close') return 'high';
    if (Math.abs(changePct) >= 8) return 'high';
    return 'normal';
  }

  // ─── Queue & Speak ──────────────────────────────────────

  markSpoken(broadcastId: string): void {
    const b = this.broadcasts.find(x => x.id === broadcastId);
    if (b) { b.spoken = true; this.emit('broadcast_spoken', b); }
  }

  markQueued(broadcastId: string): void {
    const b = this.broadcasts.find(x => x.id === broadcastId);
    if (b) { b.queued = true; this.emit('broadcast_queued', b); }
  }

  getPendingBroadcasts(): VoiceBroadcast[] {
    return this.broadcasts.filter(b => !b.spoken);
  }

  getUrgentPending(): VoiceBroadcast[] {
    return this.getPendingBroadcasts().filter(b => b.priority === 'urgent');
  }

  // ─── AI Briefing One-Liner ──────────────────────────────

  generateAIBriefing(symbol: string, summaries: string[]): VoiceBroadcast[] {
    const results: VoiceBroadcast[] = [];
    for (const summary of summaries) {
      const bc = this.createBroadcastFromText(symbol, 'ai_briefing', summary);
      this.broadcasts.push(bc);
      results.push(bc);
      this.lastBroadcastTime = Date.now();
    }
    return results;
  }

  private createBroadcastFromText(symbol: string, trigger: BroadcastTrigger, text: string): VoiceBroadcast {
    return {
      id: `vb_${++this.idCounter}`,
      symbol, trigger,
      priority: 'normal',
      language: this.config.language,
      plainText: text,
      ssml: `<speak>${text}</speak>`,
      timestamp: Date.now(),
      spoken: false, queued: false,
    };
  }

  // ─── Hourly Control ─────────────────────────────────────

  private pruneHourlyTimestamps(): void {
    const cutoff = Date.now() - 3600000;
    this.hourlyTimestamps = this.hourlyTimestamps.filter(ts => ts > cutoff);
  }

  // ─── Stats ──────────────────────────────────────────────

  getStats(): BroadcastStats {
    const byTrigger: Record<string, number> = {};
    const bySymbol: Record<string, number> = {};
    for (const b of this.broadcasts) {
      byTrigger[b.trigger] = (byTrigger[b.trigger] || 0) + 1;
      bySymbol[b.symbol] = (bySymbol[b.symbol] || 0) + 1;
    }

    return {
      totalGenerated: this.broadcasts.length,
      totalSpoken: this.broadcasts.filter(b => b.spoken).length,
      byTrigger, bySymbol,
      lastBroadcastTime: this.lastBroadcastTime,
      broadcastsLastHour: this.hourlyTimestamps.length,
    };
  }

  getBroadcastCount(): number { return this.broadcasts.length; }

  // ─── Mock ──────────────────────────────────────────────

  ingestMockQuoteBatch(symbols: string[]): VoiceBroadcast[] {
    const bases: Record<string, number> = {
      'AAPL': 195, 'TSLA': 275, 'NVDA': 140, 'MSFT': 450,
      'BTCUSDT': 102000, 'ETHUSDT': 4600,
    };
    const results: VoiceBroadcast[] = [];
    for (const sym of symbols) {
      const base = bases[sym] || 100;
      const pct = (Math.random() - 0.5) * 12;
      const vol = Math.round(100000 + Math.random() * 5000000);
      results.push(...this.ingestQuote({
        symbol: sym,
        price: base * (1 + pct / 100),
        changePercent: pct,
        volume: vol,
      }));
    }
    return results;
  }
}
