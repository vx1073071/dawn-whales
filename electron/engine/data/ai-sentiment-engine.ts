/**
 * R239-auto#2: DeepSeek 情绪分析引擎 (AI Sentiment Engine)
 *
 * 基于 DeepSeek V4 Pro 的财经新闻情绪分析管线。
 *
 * 特性:
 *   - Prompt 模板系统: 结构化输出 (sentiment/confidence/tickers/keywords/category/impact/reasoning)
 *   - 分级处理: P2→Flash(0.0005U), P1/P0→V4 Pro(0.001U), 降级→关键词
 *   - 批量缓存: LRU + TTL, 相似查询命中
 *   - 计费透明: 每次调用记录费用, 月度汇总
 *   - 重试+熔断: 3次重试+指数退避+5次连续失败熔断
 *   - 降级链: DeepSeek → 本地关键词 → 中性默认
 */

import { createHash } from 'crypto';
import type { SentimentResult, NewsItem, NewsCategory } from './news-types';

// ═══════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const DEFAULT_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const REQUEST_TIMEOUT = 15000; // 15 seconds
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY = 1000;
const CIRCUIT_BREAKER_THRESHOLD = 5; // consecutive failures before open
const CIRCUIT_RESET_MS = 60000; // 1 minute

// Cache
const CACHE_MAX_SIZE = 500;
const CACHE_TTL_MS = 300000; // 5 minutes

// Cost per 1K tokens (approximate)
const COST_V4_PRO = 0.001;  // per call
const COST_FLASH = 0.0005;  // per call

interface AISentimentConfig {
  apiKey: string;
  model: string;        // 'deepseek-v4-pro' | 'deepseek-flash'
  temperature: number;
  maxTokens: number;
  cacheSize: number;
  cacheTtlMs: number;
  maxRetries: number;
}

const DEFAULT_CONFIG: AISentimentConfig = {
  apiKey: DEFAULT_API_KEY,
  model: 'deepseek-v4-pro',
  temperature: 0.1,       // Low temp for consistent sentiment
  maxTokens: 300,
  cacheSize: CACHE_MAX_SIZE,
  cacheTtlMs: CACHE_TTL_MS,
  maxRetries: MAX_RETRIES,
};

// ═══════════════════════════════════════════════════════════════════════
// Prompt Templates
// ═══════════════════════════════════════════════════════════════════════

const SYSTEM_PROMPT = `You are a QUANT MOO financial sentiment analysis expert. Analyze financial news and return a structured JSON response.

For each news article, provide:
1. sentiment: A float from -1.0 (extremely negative) to +1.0 (extremely positive)
   - -1.0 to -0.5: Strong negative (crash, scandal, bankruptcy)
   - -0.5 to -0.1: Mild negative (downgrade, warning, missed estimate)
   - -0.1 to +0.1: Neutral (routine updates, minor changes)
   - +0.1 to +0.5: Mild positive (beat estimate, upgrade, growth)
   - +0.5 to +1.0: Strong positive (record profit, breakthrough, major contract)
2. confidence: A float from 0.0 to 1.0 indicating your confidence
3. tickers: Array of relevant stock ticker symbols (e.g., ["AAPL", "MSFT"])
4. keywords: Array of up to 5 key topic words (English)
5. category: One of: "earnings", "policy", "industry", "company", "macro", "technical", "social", "breaking"
6. impact: Integer 1-10 estimating market impact severity
7. reasoning: One sentence explaining your analysis (keep under 100 chars)

IMPORTANT: Return ONLY the JSON object, no markdown, no code fences, no explanation.

Example output:
{"sentiment":0.72,"confidence":0.93,"tickers":["AAPL"],"keywords":["iPhone","record","revenue","beats","upgrade"],"category":"earnings","impact":8,"reasoning":"Record iPhone revenue and strong Services growth exceeding analyst expectations"}`;

function buildUserPrompt(title: string, body: string, source?: string): string {
  const truncated = body.substring(0, 800); // Don't send entire articles
  return `Analyze this financial news:\n\nTitle: ${title}\nSource: ${source || 'unknown'}\nContent: ${truncated}\n\nReturn JSON analysis.`;
}

// ═══════════════════════════════════════════════════════════════════════
// Cache
// ═══════════════════════════════════════════════════════════════════════

interface CacheEntry {
  result: SentimentResult;
  insertedAt: number;
  lastAccess: number;
  hitCount: number;
}

class SentimentCache {
  private cache = new Map<string, CacheEntry>();
  private maxSize: number;
  private ttlMs: number;

  constructor(maxSize: number, ttlMs: number) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  /**
   * 缓存Key: SHA-256 of (title + normalized body prefix)
   */
  getKey(title: string, body: string): string {
    const normalized = (title + body.replace(/\s+/g, '').substring(0, 200)).toLowerCase();
    return createHash('sha256').update(normalized).digest('hex').substring(0, 16);
  }

  get(key: string): SentimentResult | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // TTL expiry
    if (Date.now() - entry.insertedAt > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    entry.lastAccess = Date.now();
    entry.hitCount++;
    return entry.result;
  }

  set(key: string, result: SentimentResult): void {
    // Evict LRU if over capacity
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    this.cache.set(key, {
      result,
      insertedAt: Date.now(),
      lastAccess: Date.now(),
      hitCount: 0,
    });
  }

  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestAccess = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.lastAccess < oldestAccess) {
        oldestAccess = entry.lastAccess;
        oldestKey = key;
      }
    }

    if (oldestKey) this.cache.delete(oldestKey);
  }

  stats() {
    let hits = 0;
    for (const entry of this.cache.values()) hits += entry.hitCount;
    return { size: this.cache.size, maxSize: this.maxSize, hits };
  }

  clear(): void {
    this.cache.clear();
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Cost Tracker
// ═══════════════════════════════════════════════════════════════════════

interface CostRecord {
  timestamp: number;
  model: string;
  cost: number;
  itemId: string;
}

class CostTracker {
  private records: CostRecord[] = [];
  private totalCost = 0;

  record(model: string, itemId: string): void {
    const cost = model === 'deepseek-flash' ? COST_FLASH : COST_V4_PRO;
    this.records.push({ timestamp: Date.now(), model, cost, itemId });
    this.totalCost += cost;

    // Keep only last 30 days
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    this.records = this.records.filter(r => r.timestamp >= cutoff);
  }

  getStats() {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const monthMs = 30 * dayMs;

    const todayCount = this.records.filter(r => now - r.timestamp < dayMs).length;
    const monthCount = this.records.filter(r => now - r.timestamp < monthMs).length;
    const monthCost = this.records
      .filter(r => now - r.timestamp < monthMs)
      .reduce((sum, r) => sum + r.cost, 0);

    const proCount = this.records.filter(r => r.model === 'deepseek-v4-pro').length;
    const flashCount = this.records.filter(r => r.model === 'deepseek-flash').length;

    return {
      totalCost: Math.round(this.totalCost * 1000) / 1000,
      monthCost: Math.round(monthCost * 1000) / 1000,
      todayCount,
      monthCount,
      proCalls: proCount,
      flashCalls: flashCount,
      estimatedMonthlyCost: Math.round(monthCost * 1000) / 1000,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Local Keyword Fallback
// ═══════════════════════════════════════════════════════════════════════

const POSITIVE_KEYWORDS = [
  'beat', 'growth', 'record', 'profit', 'upgrade', 'positive', 'surge', 'rally',
  'bullish', 'breakthrough', 'launch', 'partnership', 'expansion', 'dividend',
  'buyback', 'acquisition', 'approval', 'grant', 'contract', '上升', '增长', '利好',
];

const NEGATIVE_KEYWORDS = [
  'crash', 'plunge', 'bankruptcy', 'scandal', 'fraud', 'investigation', 'lawsuit',
  'downgrade', 'miss', 'warning', 'layoff', 'cut', 'loss', 'decline', 'debt',
  'sanction', 'fine', 'penalty', 'bearish', 'selloff', 'default', '下跌', '暴跌',
  '亏损', '违规', '处罚', '退市',
];

function keywordSentiment(text: string): SentimentResult {
  const lower = text.toLowerCase();
  let posCount = 0, negCount = 0;
  const matchedKeywords: string[] = [];

  for (const kw of POSITIVE_KEYWORDS) {
    if (lower.includes(kw)) { posCount++; matchedKeywords.push(kw); }
  }
  for (const kw of NEGATIVE_KEYWORDS) {
    if (lower.includes(kw)) { negCount++; matchedKeywords.push(kw); }
  }

  const total = posCount + negCount;
  const score = total > 0 ? (posCount - negCount) / total : 0;
  const confidence = Math.min(0.5, total / 10); // Max 50% confidence for keyword method

  return {
    score: Math.round(score * 100) / 100,
    confidence: Math.round(confidence * 100) / 100,
    tickers: [],
    keywords: matchedKeywords.slice(0, 5),
    category: 'company',
    impact: Math.min(10, Math.max(1, Math.abs(Math.round(score * 5)) + 1)),
    reasoning: `Keyword-based: ${posCount} positive, ${negCount} negative indicators found`,
    provider: 'keyword',
  };
}

function neutralSentiment(): SentimentResult {
  return {
    score: 0,
    confidence: 0.1,
    tickers: [],
    keywords: [],
    category: 'company',
    impact: 1,
    reasoning: 'Fallback neutral — AI analysis unavailable',
    provider: 'none',
  };
}

// ═══════════════════════════════════════════════════════════════════════
// AI Sentiment Engine
// ═══════════════════════════════════════════════════════════════════════

export class AISentimentEngine {
  private config: AISentimentConfig;
  private cache = new SentimentCache(DEFAULT_CONFIG.cacheSize, DEFAULT_CONFIG.cacheTtlMs);
  private costTracker = new CostTracker();
  private consecutiveFailures = 0;
  private circuitOpen = false;
  private circuitResetTimer: ReturnType<typeof setTimeout> | null = null;
  private healthStatus: 'ok' | 'degraded' | 'down' = 'ok';

  constructor(config?: Partial<AISentimentConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 分析新闻条目 — 主入口
   */
  async analyze(item: NewsItem): Promise<SentimentResult> {
    // 1. Check cache
    const cacheKey = this.cache.getKey(item.title, item.body);
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    // 2. If no API key or circuit open, skip directly to fallback
    if (!this.config.apiKey || this.circuitOpen) {
      const fallback = keywordSentiment(item.title + ' ' + item.body);
      this.cache.set(cacheKey, fallback);
      return fallback;
    }

    // 3. Determine processing tier
    const tier = this.determineTier(item);

    // 4. Try DeepSeek
    try {
      const result = await this.callDeepSeek(item.title, item.body, item.source, tier);
      this.cache.set(cacheKey, result);
      return result;
    } catch {
      // 5. Fallback: keyword analysis
      console.warn(`[AISentiment] DeepSeek failed for "${item.title.substring(0, 50)}", falling back to keyword`);
      const fallback = keywordSentiment(item.title + ' ' + item.body);
      this.cache.set(cacheKey, fallback);
      return fallback;
    }
  }

  /**
   * 批量分析
   */
  async analyzeBatch(items: NewsItem[]): Promise<SentimentResult[]> {
    const results: SentimentResult[] = [];

    for (let i = 0; i < items.length; i++) {
      const result = await this.analyze(items[i]);

      // Attach result to item
      items[i].sentiment = result;
      results.push(result);

      // Rate limiting: max 10 calls/second to DeepSeek
      if (i < items.length - 1 && !this.circuitOpen) {
        await new Promise(r => setTimeout(r, 100));
      }
    }

    return results;
  }

  /**
   * 分析并更新 NewsItem
   */
  async analyzeAndUpdate(item: NewsItem): Promise<NewsItem> {
    item.sentiment = await this.analyze(item);
    return item;
  }

  /**
   * 分析并更新批量
   */
  async analyzeAndUpdateBatch(items: NewsItem[]): Promise<NewsItem[]> {
    await this.analyzeBatch(items);
    return items;
  }

  // ── Private: DeepSeek API Call ─────────────────────────────────

  private determineTier(item: NewsItem): 'P2' | 'P1' | 'P0' {
    if (item.impact === 'P0') return 'P0';
    if (item.impact === 'P1') return 'P1';
    return 'P2';
  }

  private async callDeepSeek(
    title: string,
    body: string,
    source?: string,
    tier: 'P2' | 'P1' | 'P0' = 'P2',
  ): Promise<SentimentResult> {
    // Circuit breaker check
    if (this.circuitOpen) {
      throw new Error('[AISentiment] Circuit breaker open — API temporarily unavailable');
    }

    const model = tier === 'P2' ? 'deepseek-flash' : 'deepseek-v4-pro';

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        const resp = await fetch(DEEPSEEK_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: buildUserPrompt(title, body, source) },
            ],
            temperature: this.config.temperature,
            max_tokens: this.config.maxTokens,
            response_format: { type: 'json_object' },
          }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT),
        });

        if (!resp.ok) {
          if (resp.status === 429) {
            const delay = RETRY_BASE_DELAY * Math.pow(2, attempt);
            await new Promise(r => setTimeout(r, delay));
            continue;
          }
          if (resp.status === 401 || resp.status === 403) {
            throw new Error(`[AISentiment] Auth error: ${resp.status}`);
          }
          throw new Error(`[AISentiment] HTTP ${resp.status}`);
        }

        const data = await resp.json() as {
          choices: Array<{ message: { content: string } }>;
        };

        const content = data.choices?.[0]?.message?.content;
        if (!content) throw new Error('[AISentiment] Empty response');

        // Parse JSON response (may have markdown fences)
        let clean = content.trim();
        if (clean.startsWith('```')) {
          clean = clean.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
        }

        const parsed = JSON.parse(clean) as Record<string, unknown>;

        // Validate and normalize
        const result: SentimentResult = {
          score: this.clamp(Number(parsed.sentiment) || 0, -1, 1),
          confidence: this.clamp(Number(parsed.confidence) || 0.5, 0, 1),
          tickers: Array.isArray(parsed.tickers) ? parsed.tickers.filter(t => typeof t === 'string') : [],
          keywords: Array.isArray(parsed.keywords)
            ? parsed.keywords.filter(k => typeof k === 'string').slice(0, 5)
            : [],
          category: this.validateCategory(String(parsed.category || 'company')) as NewsCategory,
          impact: this.clamp(Number(parsed.impact) || 5, 1, 10),
          reasoning: String(parsed.reasoning || '').substring(0, 150),
          provider: 'deepseek',
        };

        // Track cost
        this.costTracker.record(model, title.substring(0, 30));

        // Reset circuit breaker
        this.consecutiveFailures = 0;
        this.healthStatus = 'ok';

        return result;
      } catch (err: any) {
        if (attempt < this.config.maxRetries - 1 && err.name !== 'AbortError') {
          const delay = RETRY_BASE_DELAY * Math.pow(2, attempt);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }

        this.consecutiveFailures++;
        this.updateHealth();

        // Open circuit breaker
        if (this.consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
          this.openCircuitBreaker();
        }

        throw err;
      }
    }

    throw new Error('[AISentiment] Max retries exceeded');
  }

  // ── Circuit Breaker ────────────────────────────────────────────

  private openCircuitBreaker(): void {
    this.circuitOpen = true;
    console.warn('[AISentiment] Circuit breaker OPEN — API calls blocked for 60s');

    if (this.circuitResetTimer) clearTimeout(this.circuitResetTimer);
    this.circuitResetTimer = setTimeout(() => {
      this.circuitOpen = false;
      this.consecutiveFailures = 0;
      console.log('[AISentiment] Circuit breaker CLOSED — API calls resumed');
    }, CIRCUIT_RESET_MS);
  }

  // ── Helpers ───────────────────────────────────────────────────

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  private validateCategory(cat: string): string {
    const valid = ['earnings', 'policy', 'industry', 'company', 'macro', 'technical', 'social', 'breaking'];
    return valid.includes(cat) ? cat : 'company';
  }

  private updateHealth(): void {
    if (this.consecutiveFailures >= 5) this.healthStatus = 'down';
    else if (this.consecutiveFailures >= 2) this.healthStatus = 'degraded';
  }

  // ── Public Stats ──────────────────────────────────────────────

  getStats() {
    return {
      cache: this.cache.stats(),
      cost: this.costTracker.getStats(),
      health: {
        status: this.healthStatus,
        circuitOpen: this.circuitOpen,
        consecutiveFailures: this.consecutiveFailures,
      },
      config: {
        model: this.config.model,
        temperature: this.config.temperature,
      },
    };
  }

  async isAvailable(): Promise<boolean> {
    return !this.circuitOpen && !!this.config.apiKey;
  }

  getCostTracker(): CostTracker {
    return this.costTracker;
  }
}

// ── Singleton ─────────────────────────────────────────────────────────

let instance: AISentimentEngine | null = null;
export function getAISentimentEngine(config?: Partial<AISentimentConfig>): AISentimentEngine {
  if (!instance) instance = new AISentimentEngine(config);
  return instance;
}

export function resetAISentimentEngine(): void {
  instance?.getCostTracker();
  instance = null;
}
