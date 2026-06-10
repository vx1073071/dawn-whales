// ── Cache Explorer API (JVS-35) ─────────────────────────────────────────────
// Browse all cached data with metadata for WB W52 CachedDataExplorer

import { getSmartCacheManager } from './smart-cache';

// ── Types ──────────────────────────────────────────────────────────────────

export interface CacheExploreResult {
  namespaces: CacheNamespaceInfo[];
  totalEntries: number;
  totalSize: number;          // bytes
  overallHitRate: number;     // 0-100%
  timestamp: number;
}

export interface CacheNamespaceInfo {
  name: string;
  entries: number;
  size: number;               // bytes
  hitRate: number;            // 0-100%
  hitCount: number;
  missCount: number;
  evictionCount: number;
  oldestEntry: number;        // timestamp
  newestEntry: number;        // timestamp
  averageTTL: number;         // ms
  sampleKeys: string[];       // first 10 keys
}

export interface CacheEntryDetail {
  namespace: string;
  key: string;
  size: number;               // bytes
  timestamp: number;          // when cached
  ttl: number;                // ms
  expiresAt: number;          // timestamp
  accessCount: number;
  lastAccess: number;         // timestamp
  value: unknown;                 // the cached value (or summary if too large)
}

// ── Explorer Functions ─────────────────────────────────────────────────────

export function exploreCache(): CacheExploreResult {
  const manager = getSmartCacheManager();
  const allStats = manager.getAllStats();

  let totalEntries = 0;
  let totalSize = 0;
  let totalHits = 0;
  let totalRequests = 0;

  const namespaces: CacheNamespaceInfo[] = [];

  for (const [name, stats] of Object.entries(allStats)) {
    const cache = manager.getCache(name);
    const keys = cache.keys();
    const sampleKeys = keys.slice(0, 10);

    namespaces.push({
      name,
      entries: stats.totalEntries,
      size: stats.totalSize,
      hitRate: Math.round(stats.hitRate * 10000) / 100,
      hitCount: stats.hitCount,
      missCount: stats.missCount,
      evictionCount: stats.evictionCount,
      oldestEntry: stats.oldestEntry,
      newestEntry: stats.newestEntry,
      averageTTL: Math.round(stats.averageTTL),
      sampleKeys,
    });

    totalEntries += stats.totalEntries;
    totalSize += stats.totalSize;
    totalHits += stats.hitCount;
    totalRequests += stats.hitCount + stats.missCount;
  }

  // Sort by size descending
  namespaces.sort((a, b) => b.size - a.size);

  return {
    namespaces,
    totalEntries,
    totalSize,
    overallHitRate: totalRequests > 0 ? Math.round((totalHits / totalRequests) * 10000) / 100 : 0,
    timestamp: Date.now(),
  };
}

export function getCacheEntryDetail(namespace: string, key: string): CacheEntryDetail | null {
  const manager = getSmartCacheManager();
  const cache = manager.getCache(namespace);

  if (!cache.has(key)) {
    return null;
  }

  const value = cache.get(key);
  const valueStr = JSON.stringify(value);
  const size = valueStr ? valueStr.length * 2 : 0;

  // If value is too large, return summary
  let valueSummary = value;
  if (size > 10000) {
    if (Array.isArray(value)) {
      valueSummary = { _type: 'array', _length: value.length, _preview: value.slice(0, 3) };
    } else if (typeof value === 'object' && value !== null) {
      const keys = Object.keys(value);
      valueSummary = { _type: 'object', _keys: keys.slice(0, 10), _keyCount: keys.length };
    }
  }

  return {
    namespace,
    key,
    size,
    timestamp: Date.now(),
    ttl: 3600000, // default
    expiresAt: Date.now() + 3600000,
    accessCount: 1,
    lastAccess: Date.now(),
    value: valueSummary,
  };
}

export function getCacheKeys(namespace: string, limit = 100, offset = 0): { keys: string[]; total: number } {
  const manager = getSmartCacheManager();
  const cache = manager.getCache(namespace);
  const allKeys = cache.keys();

  return {
    keys: allKeys.slice(offset, offset + limit),
    total: allKeys.length,
  };
}
