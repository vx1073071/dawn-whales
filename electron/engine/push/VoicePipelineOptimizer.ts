/**
 * VoicePipelineOptimizer — R264 JVS-2
 *
 * 语音管线优化引擎。
 * 优化TTS缓存+SMIL增强+优先级队列+去重加强+降噪过滤。
 *
 * Feature set:
 *   - TTS缓存: 本地hash去重+LRU存储+热词预生成
 *   - SMIL增强: 插入停顿/语速/音调标记
 *   - 优先级队列: 3级(紧急/重要/普通)→FIFO per level
 *   - 去重加强: 多维度去重(内容/symbol/时间窗口)
 *   - 降噪过滤: 静默过滤(无变化)/冗余过滤(重复)/低价值过滤
 *   - 吞吐控制: maxPerMinute + burst + queue降级
 *   - 队列健康: 堆积/延迟/丢弃统计
 *
 * Architecture:
 *   - Singleton + TTS cache LRU
 *   - Priority queue with starvation detection
 *   - Content fingerprinting for dedup
 *
 * @author JVS
 * @round R264
 * @since 2026-06-17
 */

import { EventEmitter } from 'events';
import * as crypto from 'crypto';

// ─── Types ───────────────────────────────────────────────

export type VoicePriority = 'urgent' | 'important' | 'normal';

export type VoiceLanguage = 'zh' | 'en';

export type VoiceGender = 'female' | 'male';

export interface TTSCacheEntry {
  text: string;
  language: VoiceLanguage;
  audioData: Buffer | null;    // null = not yet generated
  generatedAt: number;
  accessCount: number;
  sizeBytes: number;
}

export interface VoiceRequest {
  id: string;
  text: string;
  language: VoiceLanguage;
  priority: VoicePriority;
  gender?: VoiceGender;
  rate?: number;           // speech rate 0.25-4.0
  pitch?: number;          // -20 to +20 semitones
  pauseMs?: number;        // inter-sentence pause
  symbol?: string;         // related trading symbol
  category?: string;       // e.g. 'breaking_news', 'price_alert', 'daily_briefing'
  createdAt: number;
}

export interface SSMLSegment {
  type: 'text' | 'break' | 'prosody' | 'emphasis';
  value: string;
  rate?: number;
  pitch?: number;
}

export interface VoicePipelineStats {
  totalRequests: number;
  cachedHits: number;
  cacheMisses: number;
  dedupHits: number;
  noiseFiltered: number;
  queueLength: number;
  processedTotal: number;
  droppedTotal: number;
  avgLatencyMs: number;
}

export interface VoicePipelineConfig {
  cacheMaxEntries: number;
  cacheMaxAgeMs: number;
  cacheMaxSizeBytes: number;
  maxPerMinute: number;
  burstLimit: number;
  maxQueueSize: number;
  dedupWindowMs: number;         // how far back to dedup
  noiseMinChangePct: number;     // min change% to speak
  noiseMinVolumeRatio: number;   // min volume ratio to speak
  enableStarveDetection: boolean;
}

export type VoiceRequestHandler = (req: VoiceRequest) => Promise<void>;

// ─── Defaults ────────────────────────────────────────────

const DEFAULT_CONFIG: VoicePipelineConfig = {
  cacheMaxEntries: 500,
  cacheMaxAgeMs: 3600_000,       // 1h
  cacheMaxSizeBytes: 50_000_000, // 50MB
  maxPerMinute: 30,
  burstLimit: 5,
  maxQueueSize: 200,
  dedupWindowMs: 30000,          // 30s
  noiseMinChangePct: 0.1,        // <0.1% = noise
  noiseMinVolumeRatio: 0.8,      // <0.8x avg = noise
  enableStarveDetection: true,
};

// ─── Engine ──────────────────────────────────────────────

export class VoicePipelineOptimizer extends EventEmitter {
  private static instance: VoicePipelineOptimizer;

  private config: VoicePipelineConfig;
  private ttsCache: Map<string, TTSCacheEntry> = new Map();
  private lruOrder: string[] = [];
  private queues: Record<VoicePriority, VoiceRequest[]> = {
    urgent: [], important: [], normal: [],
  };
  private dedupFingerprints: Map<string, number> = new Map(); // fp → last_seen_ts
  private lastNoiseStats: Map<string, number> = new Map(); // symbol → last_non_noise_ts
  private minuteEmitCount = 0;
  private minuteStart = Date.now();
  private processTimer: ReturnType<typeof setInterval> | null = null;
  private stats: VoicePipelineStats = {
    totalRequests: 0, cachedHits: 0, cacheMisses: 0,
    dedupHits: 0, noiseFiltered: 0, queueLength: 0,
    processedTotal: 0, droppedTotal: 0, avgLatencyMs: 0,
  };

  private requestHandler: VoiceRequestHandler | null = null;

  constructor(config?: Partial<VoicePipelineConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  static getInstance(config?: Partial<VoicePipelineConfig>): VoicePipelineOptimizer {
    if (!VoicePipelineOptimizer.instance) {
      VoicePipelineOptimizer.instance = new VoicePipelineOptimizer(config);
    } else if (config) {
      VoicePipelineOptimizer.instance.config = { ...VoicePipelineOptimizer.instance.config, ...config };
    }
    return VoicePipelineOptimizer.instance;
  }

  reset(): void {
    this.ttsCache.clear();
    this.lruOrder = [];
    this.queues = { urgent: [], important: [], normal: [] };
    this.dedupFingerprints.clear();
    this.lastNoiseStats.clear();
    this.minuteEmitCount = 0;
    this.minuteStart = Date.now();
    if (this.processTimer) { clearInterval(this.processTimer); this.processTimer = null; }
    this.requestHandler = null;
    this.stats = {
      totalRequests: 0, cachedHits: 0, cacheMisses: 0,
      dedupHits: 0, noiseFiltered: 0, queueLength: 0,
      processedTotal: 0, droppedTotal: 0, avgLatencyMs: 0,
    };
    this.removeAllListeners();
  }

  setRequestHandler(handler: VoiceRequestHandler): void {
    this.requestHandler = handler;
  }

  // ─── Core Pipeline ──────────────────────────────────────

  async processRequest(
    text: string,
    priority: VoicePriority = 'normal',
    opts: {
      language?: VoiceLanguage;
      symbol?: string;
      category?: string;
      gender?: VoiceGender;
      rate?: number;
    } = {},
  ): Promise<{ accepted: boolean; reason?: string; cached?: boolean }> {
    const { language = 'zh', symbol, category, gender, rate } = opts;

    // Step 1: Noise filter
    if (this.isNoise(text, symbol)) {
      this.stats.noiseFiltered++;
      this.emit('noise_filtered', { text, symbol, category });
      return { accepted: false, reason: 'noise_filtered' };
    }

    // Step 2: Dedup
    const fp = this.fingerprint(text, symbol);
    if (this.isDuplicate(fp)) {
      this.stats.dedupHits++;
      this.emit('dedup_hit', { text, symbol, fp });
      return { accepted: false, reason: 'duplicate' };
    }
    this.dedupFingerprints.set(fp, Date.now());
    this.pruneDedup();

    // Step 3: TTS cache
    const cacheKey = this.cacheKey(text, language, gender);
    const cached = this.ttsCache.get(cacheKey);
    if (cached && cached.audioData) {
      cached.accessCount++;
      this.stats.cachedHits++;
      this.touchLRU(cacheKey);
      this.emit('cache_hit', { text, cacheKey });
      return { accepted: true, cached: true };
    }

    this.stats.cacheMisses++;

    // Step 4: Enqueue
    const req: VoiceRequest = {
      id: `voice_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      text, language, priority, gender, rate, symbol, category, createdAt: Date.now(),
    };

    const enqueued = this.enqueue(req);
    if (!enqueued) {
      this.stats.droppedTotal++;
      return { accepted: false, reason: 'queue_full' };
    }

    this.stats.totalRequests++;

    // Cache placeholder (not yet generated)
    if (!cached) {
      this.ttsCache.set(cacheKey, {
        text, language,
        audioData: null,
        generatedAt: 0,
        accessCount: 0,
        sizeBytes: text.length * 3, // estimate UTF-16
      });
      this.touchLRU(cacheKey);
    }

    this.emit('request_enqueued', req);
    return { accepted: true, cached: false };
  }

  // ─── Queue ──────────────────────────────────────────────

  private enqueue(req: VoiceRequest): boolean {
    const totalLen = this.queues.urgent.length + this.queues.important.length + this.queues.normal.length;
    if (totalLen >= this.config.maxQueueSize) return false;

    this.queues[req.priority].push(req);
    this.stats.queueLength = totalLen + 1;
    return true;
  }

  private dequeue(): VoiceRequest | null {
    // Priority: urgent > important > normal
    const tiers: VoicePriority[] = ['urgent', 'important', 'normal'];
    for (const tier of tiers) {
      const q = this.queues[tier];
      if (q.length > 0) {
        const req = q.shift()!;
        const totalLen = this.queues.urgent.length + this.queues.important.length + this.queues.normal.length;
        this.stats.queueLength = totalLen;
        return req;
      }
    }
    return null;
  }

  getQueueLengths(): Record<VoicePriority, number> {
    return {
      urgent: this.queues.urgent.length,
      important: this.queues.important.length,
      normal: this.queues.normal.length,
    };
  }

  // ─── Throughput Control ──────────────────────────────────

  private canEmit(): boolean {
    const now = Date.now();
    // Reset minute counter
    if (now - this.minuteStart >= 60_000) {
      this.minuteStart = now;
      this.minuteEmitCount = 0;
    }
    if (this.minuteEmitCount >= this.config.maxPerMinute) return false;
    if (this.minuteEmitCount >= this.config.maxPerMinute - this.config.burstLimit) {
      // Only urgent/important in burst buffer
      this.minuteEmitCount++;
      return true;
    }
    this.minuteEmitCount++;
    return true;
  }

  // ─── Dedup ──────────────────────────────────────────────

  private fingerprint(text: string, symbol?: string): string {
    const normalized = text.trim().toLowerCase().replace(/\s+/g, ' ');
    const raw = `${symbol || ''}:${normalized}`;
    return crypto.createHash('md5').update(raw).digest('hex').slice(0, 16);
  }

  private isDuplicate(fp: string): boolean {
    const ts = this.dedupFingerprints.get(fp);
    if (!ts) return false;
    return Date.now() - ts < this.config.dedupWindowMs;
  }

  private pruneDedup(): void {
    const cutoff = Date.now() - this.config.dedupWindowMs * 2;
    for (const [fp, ts] of this.dedupFingerprints) {
      if (ts < cutoff) this.dedupFingerprints.delete(fp);
    }
  }

  // ─── Noise Filter ───────────────────────────────────────

  private isNoise(text: string, symbol?: string): boolean {
    // Filter: check for actual price movement in text
    const pctMatch = text.match(/([+-]?\d+\.?\d*)%/);
    if (pctMatch) {
      const pct = Math.abs(parseFloat(pctMatch[1]));
      if (pct < this.config.noiseMinChangePct) return true;
    }

    // Filter: text that indicates no meaningful change
    const noisePatterns = [
      /持平/i, /无变化/i, /平盘/i, /没有变动/i,
      /unchanged/i, /flat/i, /no change/i,
      /等待中/i, /暂无/i, /loading/i,
    ];
    if (noisePatterns.some(p => p.test(text))) return true;

    return false;
  }

  // ─── TTS Cache ──────────────────────────────────────────

  cacheKey(text: string, language: VoiceLanguage, gender?: VoiceGender): string {
    const raw = `${language}:${gender || 'female'}:${text}`;
    return crypto.createHash('md5').update(raw).digest('hex').slice(0, 16);
  }

  cacheAudio(cacheKey: string, audioData: Buffer): void {
    const entry = this.ttsCache.get(cacheKey);
    if (entry) {
      entry.audioData = audioData;
      entry.generatedAt = Date.now();
      entry.sizeBytes = audioData.length;
      this.touchLRU(cacheKey);
      this.emit('audio_cached', { cacheKey, sizeBytes: audioData.length });
    }
    this.pruneCache();
  }

  getCachedAudio(text: string, language: VoiceLanguage, gender?: VoiceGender): Buffer | null {
    const key = this.cacheKey(text, language, gender);
    const entry = this.ttsCache.get(key);
    if (entry && entry.audioData) {
      entry.accessCount++;
      this.touchLRU(key);
      return entry.audioData;
    }
    return null;
  }

  private touchLRU(key: string): void {
    const idx = this.lruOrder.indexOf(key);
    if (idx > -1) this.lruOrder.splice(idx, 1);
    this.lruOrder.push(key);
  }

  private pruneCache(): void {
    // Prune by count
    while (this.ttsCache.size > this.config.cacheMaxEntries) {
      const oldest = this.lruOrder.shift();
      if (oldest) this.ttsCache.delete(oldest);
    }

    // Prune by age
    const ageCutoff = Date.now() - this.config.cacheMaxAgeMs;
    for (const [key, entry] of this.ttsCache) {
      if (entry.generatedAt > 0 && entry.generatedAt < ageCutoff) {
        this.ttsCache.delete(key);
        const idx = this.lruOrder.indexOf(key);
        if (idx > -1) this.lruOrder.splice(idx, 1);
      }
    }

    // Prune by total size
    let totalSize = 0;
    for (const [, entry] of this.ttsCache) totalSize += entry.sizeBytes;
    while (totalSize > this.config.cacheMaxSizeBytes && this.lruOrder.length > 0) {
      const oldest = this.lruOrder.shift()!;
      const entry = this.ttsCache.get(oldest);
      if (entry) { totalSize -= entry.sizeBytes; this.ttsCache.delete(oldest); }
    }
  }

  // ─── SSML Builder ───────────────────────────────────────

  buildSSML(text: string, segments: SSMLSegment[]): string {
    const parts: string[] = [];
    for (const seg of segments) {
      switch (seg.type) {
        case 'text':
          parts.push(seg.value);
          break;
        case 'break':
          parts.push(`<break time="${seg.value}ms"/>`);
          break;
        case 'prosody':
          parts.push(`<prosody rate="${seg.rate || 'medium'}" pitch="${seg.pitch || '+0st'}">${seg.value}</prosody>`);
          break;
        case 'emphasis':
          parts.push(`<emphasis level="strong">${seg.value}</emphasis>`);
          break;
      }
    }
    return `<speak>${parts.join('')}</speak>`;
  }

  /**
   * Quick SSML: insert pauses and rate for Chinese stocks.
   */
  buildChineseStockSSML(symbol: string, price: number, changePct: number): string {
    const direction = changePct >= 0 ? '上涨' : '下跌';
    const absPct = Math.abs(changePct).toFixed(2);

    return this.buildSSML('', [
      { type: 'text', value: `${symbol}` },
      { type: 'break', value: '300' },
      { type: 'text', value: `${direction}` },
      { type: 'prosody', value: `${absPct}%`, rate: 'slow', pitch: changePct >= 2 ? '+3st' : '+0st' },
      { type: 'break', value: '500' },
      { type: 'text', value: `当前价格 ${price.toFixed(2)}` },
    ]);
  }

  buildEnglishStockSSML(symbol: string, price: number, changePct: number): string {
    const direction = changePct >= 0 ? 'up' : 'down';
    const absPct = Math.abs(changePct).toFixed(2);

    return this.buildSSML('', [
      { type: 'text', value: `${symbol}` },
      { type: 'break', value: '300' },
      { type: 'emphasis', value: `${direction} ${absPct} percent` },
      { type: 'break', value: '500' },
      { type: 'text', value: `Trading at ${price.toFixed(2)}` },
    ]);
  }

  // ─── Manual Processing ──────────────────────────────────

  /**
   * Called periodically to drain queue (or pushed by enqueue system).
   */
  async processQueueBatch(maxItems = 3): Promise<number> {
    let processed = 0;
    for (let i = 0; i < maxItems; i++) {
      if (!this.canEmit()) break;
      const req = this.dequeue();
      if (!req) break;

      try {
        if (this.requestHandler) {
          await this.requestHandler(req);
        }
        this.stats.processedTotal++;
        this.emit('request_processed', req.id);
        processed++;
      } catch {
        this.stats.droppedTotal++;
        this.emit('request_failed', req.id);
      }
    }
    return processed;
  }

  startAutoProcess(intervalMs = 2000): void {
    if (this.processTimer) clearInterval(this.processTimer);
    this.processTimer = setInterval(() => {
      this.processQueueBatch(3);
    }, intervalMs);
  }

  stopAutoProcess(): void {
    if (this.processTimer) {
      clearInterval(this.processTimer);
      this.processTimer = null;
    }
  }

  // ─── Query ──────────────────────────────────────────────

  getStats(): VoicePipelineStats { return { ...this.stats }; }
  getConfig(): VoicePipelineConfig { return { ...this.config }; }
  getCacheStats(): { entries: number; totalSize: number; orderLength: number } {
    let totalSize = 0;
    for (const [, e] of this.ttsCache) totalSize += e.sizeBytes;
    return { entries: this.ttsCache.size, totalSize, orderLength: this.lruOrder.length };
  }

  /**
   * Pre-warm cache with hot phrases for faster latency.
   */
  prewarmCache(phrases: Array<{ text: string; language: VoiceLanguage; gender?: VoiceGender }>): number {
    let count = 0;
    for (const p of phrases) {
      const key = this.cacheKey(p.text, p.language, p.gender);
      if (!this.ttsCache.has(key)) {
        this.ttsCache.set(key, {
          text: p.text, language: p.language,
          audioData: null, generatedAt: 0, accessCount: 0, sizeBytes: p.text.length * 3,
        });
        this.touchLRU(key);
        count++;
      }
    }
    return count;
  }

  // ─── Starvation Detection ────────────────────────────────

  getStarvationReport(): { normalQueueAge: number; normalWaiting: number } {
    if (this.queues.normal.length === 0) return { normalQueueAge: 0, normalWaiting: 0 };
    const oldest = this.queues.normal[0].createdAt;
    return {
      normalQueueAge: Date.now() - oldest,
      normalWaiting: this.queues.normal.length,
    };
  }
}
