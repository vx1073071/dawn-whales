/**
 * R238-auto#1b: 跨源去重引擎 (Dedup Engine)
 *
 * 多源新闻去重，目标 >80% 去重率。
 *
 * 策略 (三级):
 *   1. URL 精确匹配 — 同URL = 同新闻
 *   2. 标题相似度 — Jaccard/Levenshtein > 阈值
 *   3. 内容指纹 — SHA-256 前64位碰撞
 *
 * 设计原则:
 *   - 时间窗口: 24小时内去重（过期指纹自动清理）
 *   - 来源权重: 权威源优先保留 (编辑策展 > API > 社交)
 *   - 增量处理: 流式推送，不阻塞
 */

import { createHash } from 'crypto';
import type { NewsItem, DedupResult } from './news-types';

// ── Configuration ─────────────────────────────────────────────────────

interface DedupConfig {
  /** 时间窗口 (毫秒) — 超出窗口的指纹不参与比较 */
  windowMs: number;
  /** 标题 Jaccard 相似度阈值 (0-1) */
  titleSimilarityThreshold: number;
  /** 内容指纹匹配长度 (hex chars) */
  fingerprintLength: number;
  /** 最大指纹缓存大小 */
  maxCacheSize: number;
}

const DEFAULT_CONFIG: DedupConfig = {
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  titleSimilarityThreshold: 0.75,
  fingerprintLength: 12, // 48 bits
  maxCacheSize: 50000,
};

/** 来源权重 — 数值越大越优先保留 */
const SOURCE_PRIORITY: Record<string, number> = {
  reuters: 100,
  cnbc: 90,
  cls_telegraph: 85,
  eastmoney: 80,
  sina: 75,
  alphavantage_ns: 70,
  polygon: 68,
  newsapi: 65,
  yahoo_finance: 60,
  marketwatch: 58,
  xueqiu: 30,
  reddit: 25,
  twitter: 20,
  stocktwits: 20,
  wechat_public: 15,
};

function getSourcePriority(source: string): number {
  return SOURCE_PRIORITY[source] ?? 50;
}

// ── Fingerprint ───────────────────────────────────────────────────────

function computeContentFingerprint(text: string, length: number): string {
  const normalized = text.replace(/\s+/g, '').substring(0, 1000);
  return createHash('sha256').update(normalized).digest('hex').substring(0, length);
}

function computeTitleFingerprint(title: string): string {
  const tokens = title
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff\s]/g, '')
    .split(/\s+/)
    .filter(t => t.length > 0)
    .sort();

  return tokens.join(' ');
}

// ── Similarity Functions ──────────────────────────────────────────────

/**
 * Jaccard 相似度: |A ∩ B| / |A ∪ B|
 */
function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(a.split(' '));
  const setB = new Set(b.split(' '));
  if (setA.size === 0 && setB.size === 0) return 1;

  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
}

/**
 * Levenshtein 距离 / max(len) → 相似度
 */
function levenshteinSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;

  const matrix: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,       // deletion
        matrix[i][j - 1] + 1,       // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  const distance = matrix[a.length][b.length];
  return 1 - distance / Math.max(a.length, b.length);
}

/**
 * 综合标题相似度 (Jaccard + Levenshtein 加权)
 */
function titleSimilarity(a: string, b: string): number {
  const fpA = computeTitleFingerprint(a);
  const fpB = computeTitleFingerprint(b);

  const jaccard = jaccardSimilarity(fpA, fpB);
  const levenshtein = levenshteinSimilarity(a, b);

  // Weight: 60% Jaccard (semantic) + 40% Levenshtein (exact)
  return jaccard * 0.6 + levenshtein * 0.4;
}

// ── Engine ────────────────────────────────────────────────────────────

interface FingerprintEntry {
  sourceId: string;        // unique news id
  source: string;          // source name
  fingerprint: string;     // content fingerprint
  titleFingerprint: string;
  title: string;
  publishedAt: number;
  insertedAt: number;
}

export class DedupEngine {
  private config: DedupConfig;
  private fingerprints = new Map<string, FingerprintEntry>();
  private urlIndex = new Map<string, string>(); // url → sourceId
  private insertionOrder: string[] = []; // FIFO for size management
  private stats = {
    total: 0,
    duplicates: 0,
    unique: 0,
  };

  constructor(config: Partial<DedupConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 处理单条新闻 — 返回去重结果
   */
  process(item: NewsItem): DedupResult {
    this.stats.total++;

    // 1. URL 精确匹配
    if (item.url) {
      const existingId = this.urlIndex.get(item.url);
      if (existingId) {
        this.stats.duplicates++;
        return {
          item,
          isDuplicate: true,
          duplicateOf: existingId,
          similarity: 1.0,
          matchType: 'url',
        };
      }
    }

    // 2. 标题相似度匹配
    const titleFp = computeTitleFingerprint(item.title);
    const contentFp = computeContentFingerprint(item.body, this.config.fingerprintLength);

    for (const [id, entry] of this.fingerprints) {
      // Skip entries outside time window
      if (item.publishedAt - entry.publishedAt > this.config.windowMs) continue;

      // Content fingerprint exact match
      if (entry.fingerprint === contentFp) {
        return this.handleDuplicateMatch(item, entry, 1.0, 'fingerprint');
      }

      // Title similarity check
      const sim = titleSimilarity(item.title, entry.title);
      if (sim >= this.config.titleSimilarityThreshold) {
        return this.handleDuplicateMatch(item, entry, sim, 'title');
      }
    }

    // 3. 新条目 — 记录并返回
    this.addToIndex(item, titleFp, contentFp);
    this.stats.unique++;

    return {
      item,
      isDuplicate: false,
    };
  }

  /**
   * 批量处理 — 返回去重后的条目
   */
  processBatch(items: NewsItem[]): NewsItem[] {
    const results: NewsItem[] = [];
    for (const item of items) {
      const result = this.process(item);
      if (!result.isDuplicate) {
        results.push(result.item);
      } else {
        // If current source has higher priority, replace
        if (result.duplicateOf && result.matchType !== 'fingerprint') {
          const existing = this.fingerprints.get(result.duplicateOf);
          if (existing && getSourcePriority(item.source) > getSourcePriority(existing.source)) {
            // Higher priority source wins — replace the old entry
            this.replaceInIndex(item, result.duplicateOf);
            results.push(item);
            continue;
          }
        }
      }
    }
    return results;
  }

  private handleDuplicateMatch(
    item: NewsItem,
    existing: FingerprintEntry,
    similarity: number,
    matchType: 'title' | 'fingerprint',
  ): DedupResult {
    this.stats.duplicates++;

    // Source priority check: if current source is higher quality, keep it
    if (getSourcePriority(item.source) > getSourcePriority(existing.source)) {
      this.replaceInIndex(item, existing.sourceId);
      // Return as unique (we replaced the lower-quality entry)
      return { item, isDuplicate: false };
    }

    return {
      item,
      isDuplicate: true,
      duplicateOf: existing.sourceId,
      similarity,
      matchType,
    };
  }

  // ── Index Management ──────────────────────────────────────────────

  private addToIndex(item: NewsItem, titleFp: string, contentFp: string): void {
    const entry: FingerprintEntry = {
      sourceId: item.id,
      source: item.source,
      fingerprint: contentFp,
      titleFingerprint: titleFp,
      title: item.title,
      publishedAt: item.publishedAt,
      insertedAt: Date.now(),
    };

    this.fingerprints.set(item.id, entry);
    if (item.url) this.urlIndex.set(item.url, item.id);
    this.insertionOrder.push(item.id);

    // Evict if over capacity
    this.evictExpired();
    if (this.fingerprints.size > this.config.maxCacheSize) {
      this.evictOldest(this.fingerprints.size - this.config.maxCacheSize);
    }
  }

  private replaceInIndex(item: NewsItem, oldId: string): void {
    const old = this.fingerprints.get(oldId);
    this.fingerprints.delete(oldId);

    // Remove old URL index
    if (old) {
      for (const [url, id] of this.urlIndex) {
        if (id === oldId) {
          this.urlIndex.delete(url);
          break;
        }
      }
    }

    // Add new entry
    const titleFp = computeTitleFingerprint(item.title);
    const contentFp = computeContentFingerprint(item.body, this.config.fingerprintLength);
    this.addToIndex(item, titleFp, contentFp);
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [id, entry] of this.fingerprints) {
      if (now - entry.insertedAt > this.config.windowMs * 2) {
        this.fingerprints.delete(id);
        // Also clean URL index
        for (const [url, urlId] of this.urlIndex) {
          if (urlId === id) this.urlIndex.delete(url);
        }
      }
    }
  }

  private evictOldest(count: number): void {
    const toRemove = this.insertionOrder.splice(0, count);
    for (const id of toRemove) {
      this.fingerprints.delete(id);
      for (const [url, urlId] of this.urlIndex) {
        if (urlId === id) this.urlIndex.delete(url);
      }
    }
  }

  // ── Stats ─────────────────────────────────────────────────────────

  getStats() {
    const dedupRate = this.stats.total > 0
      ? this.stats.duplicates / this.stats.total
      : 0;

    return {
      ...this.stats,
      dedupRate,
      cacheSize: this.fingerprints.size,
      urlIndexSize: this.urlIndex.size,
      windowMs: this.config.windowMs,
    };
  }

  /** 去重率是否达标 (>80%) */
  isDedupRateAcceptable(): boolean {
    return this.getStats().dedupRate >= 0.80;
  }

  // ── Maintenance ───────────────────────────────────────────────────

  clear(): void {
    this.fingerprints.clear();
    this.urlIndex.clear();
    this.insertionOrder.length = 0;
    this.stats = { total: 0, duplicates: 0, unique: 0 };
  }
}

// ── Singleton ─────────────────────────────────────────────────────────

let instance: DedupEngine | null = null;
export function getDedupEngine(config?: Partial<DedupConfig>): DedupEngine {
  if (!instance) instance = new DedupEngine(config);
  return instance;
}

export function resetDedupEngine(): void {
  instance?.clear();
  instance = null;
}
