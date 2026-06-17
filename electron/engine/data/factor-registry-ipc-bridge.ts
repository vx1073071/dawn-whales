// ── R281 autoclaw#1: Factor Registry IPC Bridge ──────────────────────────
// Connects factor-id-registry.ts (620+ factors) → Renderer (UI)
// Enables ML's FactorRegistry frontend component to query/search/filter factors
//
// Architecture:
//   factor-id-registry.ts (SSOT, Electron main) 
//     → FactorRegistryIPCBridge (ipcMain handlers)
//       → Renderer (ipcRenderer.invoke)
//         → ML's FactorRegistry UI component
//
// Channels: registry:search, registry:by-level1, registry:by-level2, 
//           registry:metadata, registry:stats, registry:active, registry:all

import { ipcMain } from 'electron';
import {
  resolveFactorId,
  isStandardFactorId,
  getCanonicalFactorIds,
  getFactorIdsByCategory,
  getFactorCategory,
  type FactorLevel1,
  type FactorLevel2,
  type FactorId,
} from '../factors/factor-id-registry';

// ═══════════════════════════════════════════════════════════════════
// IPC CHANNELS
// ═══════════════════════════════════════════════════════════════════

export const FACTOR_REGISTRY_IPC_CHANNELS = {
  /** Search factors by ID or name keyword */
  SEARCH: 'factor-registry:search',
  /** List all factors (paginated) */
  LIST_ALL: 'factor-registry:list-all',
  /** Filter by L1 major category */
  BY_LEVEL1: 'factor-registry:by-level1',
  /** Filter by L2 sub-category */
  BY_LEVEL2: 'factor-registry:by-level2',
  /** Get single factor metadata */
  METADATA: 'factor-registry:metadata',
  /** Get all factors in batch */
  BATCH_METADATA: 'factor-registry:batch-metadata',
  /** Get registry statistics */
  STATS: 'factor-registry:stats',
  /** List all L1 categories with counts */
  CATEGORIES: 'factor-registry:categories',
  /** Check if a factor ID is active (canonical) */
  CHECK_ACTIVE: 'factor-registry:check-active',
  /** Get legacy → canonical ID mapping */
  LEGACY_MAP: 'factor-registry:legacy-map',
  /** Verify multiple IDs at once */
  VERIFY_IDS: 'factor-registry:verify-ids',
} as const;

// ═══════════════════════════════════════════════════════════════════
// TYPES (frontend-facing)
// ═══════════════════════════════════════════════════════════════════

export interface RegistryFactorMeta {
  id: FactorId;
  nameEn: string;
  nameCn: string;
  level1: FactorLevel1;
  level2: FactorLevel2;
  /** Human-readable L1 name */
  level1Label: string;
  /** Human-readable L2 name */
  level2Label: string;
  /** Whether this is a standard (non-legacy) factor */
  isStandard: boolean;
  /** Legacy category for backward compat */
  legacyCategory: string;
}

export interface RegistrySearchResult {
  query: string;
  matches: RegistryFactorMeta[];
  total: number;
  /** Did we find an exact ID match? */
  exactMatch: boolean;
}

export interface RegistryListResult {
  items: RegistryFactorMeta[];
  total: number;
  offset: number;
  limit: number;
  /** Are there more results? */
  hasMore: boolean;
}

export interface RegistryStats {
  totalFactors: number;
  activeFactors: number;
  deprecatedFactors: number;
  byLevel1: Record<string, number>;
  byLevel2: Record<string, number>;
  coverage: {
    registered: number;
    calculable: number;
    percentage: number;
  };
}

export interface RegistryIdVerification {
  id: string;
  resolved: string;
  isStandard: boolean;
  isLegacy: boolean;
  metadata: RegistryFactorMeta | null;
}

// ═══════════════════════════════════════════════════════════════════
// INTERNAL — Registry data access
// ═══════════════════════════════════════════════════════════════════

// Direct access to FACTOR_SPEC and FACTOR_LEVEL3_MAP from factor-id-registry
// We import via the public API but need the full data for search
// The registry exposes getCanonicalFactorIds() which gives us IDs

// Load the full factor spec for search capabilities
// Using a local cache built from public API
let _metaCache: RegistryFactorMeta[] | null = null;
let _metaById: Record<string, RegistryFactorMeta> | null = null;

const L1_LABELS: Record<string, string> = {
  L1_CLASSIC: '经典因子',
  L1_FUNDAMENTAL: '基本面因子',
  L1_ANALYST: '分析师因子',
  L1_SENTIMENT: '情绪因子',
  L1_TECHNICAL: '技术指标',
  L1_RISK: '风险因子',
  L1_MACRO: '宏观因子',
  L1_REVERSAL: '反转因子',
  L1_US: '美股特化',
  L1_HK: '港股特化',
  L1_CRYPTO: '加密货币',
  L1_CROSS_ASSET: '跨资产',
  L1_EVENT: '事件驱动',
  L1_ESG: 'ESG因子',
  L1_LEGACY: '已弃用',
  L1_COMMODITY: '商品因子',
  // Post-R278 additions
  L1_ACADEMIC: '学术因子',
  L1_GLOBAL: '全球市场',
  L1_OPTIONS: '期权因子',
  L1_FIXED_INCOME: '固收因子',
  L1_ALT_DATA: '另类数据',
  L1_CN_ASHARE: 'A股因子',
};

const L2_LABELS: Record<string, string> = {
  L2_MARKET_RISK: '市场风险',
  L2_SIZE: '规模',
  L2_VALUE: '估值',
  L2_MOMENTUM: '动量',
  L2_QUALITY: '质量',
  L2_GROWTH: '成长',
  L2_YIELD: '收益',
  L2_PROFIT_QUALITY: '盈利质量',
  L2_YIELD_QUALITY: '收益质量',
  L2_RISK_STRUCTURE: '风险结构',
  L2_EFFICIENCY: '效率',
  L2_VALUE_DEEP: '深度估值',
  L2_HEALTH: '健康度',
  L2_RATING: '评级',
  L2_FORECAST: '预测',
  L2_MARKET_MOOD: '市场情绪',
  L2_OPTIONS: '期权',
  L2_SOCIAL: '社交',
  L2_FLOW: '资金流',
  L2_TREND: '趋势',
  L2_OSCILLATOR: '震荡',
  L2_VOLATILITY: '波动率',
  L2_VOLUME: '成交量',
  L2_LIQUIDITY: '流动性',
  L2_DOWNSIDE: '下行风险',
  L2_RISK_ADJUSTED: '风险调整',
  L2_STRUCTURAL: '结构风险',
  L2_CYCLE: '周期',
  L2_CURRENCY: '货币',
  L2_SENSITIVITY: '敏感度',
  L2_SHORT_TERM: '短期',
  L2_LONG_TERM: '长期',
  L2_SEASONAL: '季节性',
  L2_STATISTICAL: '统计',
  L2_CORPORATE: '公司层面',
  L2_EVENT: '事件',
  L2_STATS: '统计(US)',
  L2_PRICING: '定价',
  L2_DERIVATIVES: '衍生品',
  L2_RISK: '风险',
  L2_SENTIMENT: '情绪',
  L2_MICROSTRUCTURE: '市场微观结构',
  L2_VALUATION: '估值',
  L2_ONCHAIN: '链上',
  L2_CORRELATION: '相关性',
  L2_PERFORMANCE: '表现',
  L2_FUNDAMENTAL: '基本面',
  L2_CARRY: '利差',
  L2_EARNINGS: '财报',
  L2_REBALANCE: '再平衡',
  L2_OVERALL: '综合',
  L2_ENVIRONMENT: '环境',
  L2_GOVERNANCE: '治理',
  L2_DEPRECATED: '已弃用',
  L2_TERM_STRUCTURE: '期限结构',
  L2_INVENTORY: '库存',
  L2_COT: 'COT持仓',
  L2_RATIO: '比率',
  L2_MACRO: '宏观',
};

// Deep-import FACTOR_SPEC for full data access in the bridge
// We need the actual 4-column tuples for metadata construction
import { FACTOR_LEVEL3_MAP } from '../factors/factor-id-registry';

/** Build the in-memory metadata cache from the registry's public data */
function buildCache(): void {
  if (_metaCache && _metaById) return;
  
  _metaCache = [];
  _metaById = {};
  
  // Get all canonical IDs and their metadata via the legacy map approach
  // FACTOR_LEVEL3_MAP is a Record<id, FactorLevel3Meta>
  // It gets exported from factor-id-registry.ts
  
  // Use the imported map to build cache
  for (const id of Object.keys(FACTOR_LEVEL3_MAP)) {
    const meta = FACTOR_LEVEL3_MAP[id];
    if (!meta) continue;
    
    const item: RegistryFactorMeta = {
      id: meta.id,
      nameEn: meta.nameEn,
      nameCn: meta.nameCn,
      level1: meta.level1,
      level2: meta.level2,
      level1Label: L1_LABELS[meta.level1] || meta.level1,
      level2Label: L2_LABELS[meta.level2] || meta.level2,
      isStandard: meta.level1 !== 'L1_LEGACY',
      legacyCategory: getFactorCategory(meta.id) || 'market_meta',
    };
    
    _metaCache.push(item);
    _metaById[meta.id] = item;
  }
}

function getCache(): { cache: RegistryFactorMeta[]; byId: Record<string, RegistryFactorMeta> } {
  buildCache();
  return { cache: _metaCache!, byId: _metaById! };
}

// ═══════════════════════════════════════════════════════════════════
// QUERY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

function searchFactors(query: string): RegistrySearchResult {
  const { cache } = getCache();
  const q = query.toLowerCase().trim();
  
  // Check for exact ID match first
  const exactId = cache.find(f => f.id.toLowerCase() === q);
  
  // Fuzzy search: match ID start, nameEn substring, nameCn substring
  const matches = cache.filter(f => {
    if (f.id.toLowerCase() === q) return true;
    if (f.id.toLowerCase().startsWith(q)) return true;
    if (f.nameEn.toLowerCase().includes(q)) return true;
    if (f.nameCn.includes(q)) return true;
    // Match L1/L2 labels
    if (f.level1Label.includes(q) || f.level2Label.includes(q)) return true;
    return false;
  });
  
  return {
    query,
    matches: matches.slice(0, 50), // cap at 50 results
    total: matches.length,
    exactMatch: !!exactId,
  };
}

function listFactors(offset: number, limit: number): RegistryListResult {
  const { cache } = getCache();
  const active = cache.filter(f => f.level1 !== 'L1_LEGACY');
  const items = active.slice(offset, offset + limit);
  
  return {
    items,
    total: active.length,
    offset,
    limit,
    hasMore: offset + limit < active.length,
  };
}

function getByLevel1(level1: FactorLevel1): RegistryFactorMeta[] {
  const { cache } = getCache();
  return cache.filter(f => f.level1 === level1);
}

function getByLevel2(level2: FactorLevel2): RegistryFactorMeta[] {
  const { cache } = getCache();
  return cache.filter(f => f.level2 === level2);
}

function getMetadata(factorId: string): RegistryFactorMeta | null {
  const resolved = resolveFactorId(factorId);
  const { byId } = getCache();
  return byId[resolved] || null;
}

function getBatchMetadata(factorIds: string[]): RegistryFactorMeta[] {
  return factorIds
    .map(id => getMetadata(id))
    .filter((m): m is RegistryFactorMeta => m !== null);
}

function getStats(calculableCount: number): RegistryStats {
  const { cache } = getCache();
  const active = cache.filter(f => f.level1 !== 'L1_LEGACY');
  const deprecated = cache.filter(f => f.level1 === 'L1_LEGACY');
  
  const byLevel1: Record<string, number> = {};
  const byLevel2: Record<string, number> = {};
  
  active.forEach(f => {
    byLevel1[f.level1] = (byLevel1[f.level1] || 0) + 1;
    byLevel2[f.level2] = (byLevel2[f.level2] || 0) + 1;
  });
  
  return {
    totalFactors: cache.length,
    activeFactors: active.length,
    deprecatedFactors: deprecated.length,
    byLevel1,
    byLevel2,
    coverage: {
      registered: active.length,
      calculable: calculableCount,
      percentage: active.length > 0 ? Math.round((calculableCount / active.length) * 100) : 0,
    },
  };
}

function getCategories(): Array<{ level1: FactorLevel1; label: string; count: number; level2s: Array<{ id: FactorLevel2; label: string; count: number }> }> {
  const { cache } = getCache();
  const active = cache.filter(f => f.level1 !== 'L1_LEGACY');
  
  const l1Map = new Map<FactorLevel1, { factors: RegistryFactorMeta[] }>();
  active.forEach(f => {
    if (!l1Map.has(f.level1)) l1Map.set(f.level1, { factors: [] });
    l1Map.get(f.level1)!.factors.push(f);
  });
  
  const result: Array<{ level1: FactorLevel1; label: string; count: number; level2s: Array<{ id: FactorLevel2; label: string; count: number }> }> = [];
  
  l1Map.forEach(({ factors }, level1) => {
    const l2Map = new Map<FactorLevel2, number>();
    factors.forEach(f => {
      l2Map.set(f.level2, (l2Map.get(f.level2) || 0) + 1);
    });
    
    const level2s = Array.from(l2Map.entries())
      .map(([id, count]) => ({ id, label: L2_LABELS[id] || id, count }))
      .sort((a, b) => b.count - a.count);
    
    result.push({
      level1,
      label: L1_LABELS[level1] || level1,
      count: factors.length,
      level2s,
    });
  });
  
  return result.sort((a, b) => b.count - a.count);
}

function verifyFactorIds(ids: string[]): RegistryIdVerification[] {
  return ids.map(id => {
    const resolved = resolveFactorId(id);
    const isStd = isStandardFactorId(resolved);
    const meta = getMetadata(resolved);
    return {
      id,
      resolved,
      isStandard: isStd,
      isLegacy: id !== resolved,
      metadata: meta,
    };
  });
}

// ═══════════════════════════════════════════════════════════════════
// BRIDGE CLASS
// ═══════════════════════════════════════════════════════════════════

let _bridgeInitialized = false;

class FactorRegistryIPCBridge {
  private _calculableCount = 527; // From R280 youdao: 527/620 calculable

  /** Initialize IPC handlers — call once during app startup */
  initialize(): void {
    if (_bridgeInitialized) return;

    // In test/non-Electron environments, ipcMain may not be available
    if (!ipcMain || typeof ipcMain.handle !== 'function') {
      console.warn('[R281] FactorRegistryIPCBridge: ipcMain not available (non-Electron env), skipping IPC registration');
      _bridgeInitialized = true;
      return;
    }

    // ── Search ──
    ipcMain.handle(FACTOR_REGISTRY_IPC_CHANNELS.SEARCH, async (_event, query: string) => {
      return searchFactors(query);
    });

    // ── List all (paginated) ──
    ipcMain.handle(FACTOR_REGISTRY_IPC_CHANNELS.LIST_ALL, async (_event, offset?: number, limit?: number) => {
      return listFactors(offset || 0, limit || 100);
    });

    // ── By L1 category ──
    ipcMain.handle(FACTOR_REGISTRY_IPC_CHANNELS.BY_LEVEL1, async (_event, level1: FactorLevel1) => {
      return getByLevel1(level1);
    });

    // ── By L2 sub-category ──
    ipcMain.handle(FACTOR_REGISTRY_IPC_CHANNELS.BY_LEVEL2, async (_event, level2: FactorLevel2) => {
      return getByLevel2(level2);
    });

    // ── Single metadata ──
    ipcMain.handle(FACTOR_REGISTRY_IPC_CHANNELS.METADATA, async (_event, factorId: string) => {
      return getMetadata(factorId);
    });

    // ── Batch metadata ──
    ipcMain.handle(FACTOR_REGISTRY_IPC_CHANNELS.BATCH_METADATA, async (_event, factorIds: string[]) => {
      return getBatchMetadata(factorIds);
    });

    // ── Stats ──
    ipcMain.handle(FACTOR_REGISTRY_IPC_CHANNELS.STATS, async () => {
      return getStats(this._calculableCount);
    });

    // ── Categories tree ──
    ipcMain.handle(FACTOR_REGISTRY_IPC_CHANNELS.CATEGORIES, async () => {
      return getCategories();
    });

    // ── Check if factor ID is active ──
    ipcMain.handle(FACTOR_REGISTRY_IPC_CHANNELS.CHECK_ACTIVE, async (_event, factorId: string) => {
      const resolved = resolveFactorId(factorId);
      return isStandardFactorId(resolved);
    });

    // ── Legacy mapping ──
    ipcMain.handle(FACTOR_REGISTRY_IPC_CHANNELS.LEGACY_MAP, async (_event, factorId: string) => {
      const resolved = resolveFactorId(factorId);
      const isLegacy = factorId !== resolved;
      return {
        original: factorId,
        canonical: resolved,
        isLegacy,
        metadata: getMetadata(resolved),
      };
    });

    // ── Verify multiple IDs ──
    ipcMain.handle(FACTOR_REGISTRY_IPC_CHANNELS.VERIFY_IDS, async (_event, ids: string[]) => {
      return verifyFactorIds(ids);
    });

    _bridgeInitialized = true;
    console.log('[R281] FactorRegistryIPCBridge: initialized — 620+ factor registry → UI data link ONLINE');
  }

  /** Update calculable count (called after dedup re-count) */
  setCalculableCount(count: number): void {
    this._calculableCount = count;
  }

  /** Check if bridge is ready */
  get isReady(): boolean {
    return _bridgeInitialized;
  }

  /** Invalidate cache — call after registry updates */
  invalidateCache(): void {
    _metaCache = null;
    _metaById = null;
    buildCache();
    console.log('[R281] FactorRegistryIPCBridge: cache invalidated —', _metaCache?.length || 0, 'factors reloaded');
  }
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════

const _instance = new FactorRegistryIPCBridge();

/** Get the shared FactorRegistryIPC bridge instance */
export function getRegistryIPCBridge(): FactorRegistryIPCBridge {
  return _instance;
}

/** Reset the bridge (for testing) */
export function resetRegistryIPCBridge(): void {
  _bridgeInitialized = false;
  _metaCache = null;
  _metaById = null;
  _instance.setCalculableCount(527);
}

export { FactorRegistryIPCBridge };

// For convenience exports
export default _instance;
