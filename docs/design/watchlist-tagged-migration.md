# Watchlist Tagged 迁移指南 — 从纯字符串到富对象

> **版本**: v1.0 | **日期**: 2026-06-14 | **作者**: QClaw (文档虾)
> **目标**: `watchlist: string[]` → `watchlist: WatchlistItem[]` (PM #9)

---

## 一、为什么迁移？

### 当前 (v2.3.0)

```typescript
// src/stores/marketStore.ts
watchlist: ['US.TQQQ', 'US.SOXL', 'US.QQQ', 'US.SPY',
            'US.AAPL', 'US.NVDA', 'US.SQQQ', 'US.SOXS']
```

问题:
- 只有代码，不知道市场、不知道优选券商、不知道何时添加的
- 无法持久化 (zustand 内存 → 刷新丢失)
- 无法实现按市场分组、按添加时间排序

### 目标 (v2.4.0)

```typescript
watchlist: [
  { code: 'US.TQQQ',     brokerId: 'futu',    addedAt: 1718276400000, pinned: false, group: 'US' },
  { code: 'HK.00700',    brokerId: null,       addedAt: 1718276500000, pinned: true,  group: 'HK' },
  { code: 'CRYPTO.BTC-USDT', brokerId: 'binance', addedAt: 1718276600000, pinned: false, group: 'CRYPTO' },
]
```

---

## 二、新数据结构

```typescript
// src/stores/marketStore.ts

interface WatchlistItem {
  code: string;              // 标准化代码: "US.AAPL" / "HK.00700"
  market: Market;            // "HK" | "US" | "CRYPTO" | "CN" | "SG" | "JP" | "UK" | "EU"
  brokerId: string | null;   // 优选券商 (null = 自动选择)
  addedAt: number;           // Unix ms (添加时间)
  pinned: boolean;           // 是否置顶
  group: string;             // 分组标签 (默认按 market)
  notes?: string;            // 用户备注 (可选)
  alerts?: AlertConfig[];    // 价格提醒 (可选, 未来扩展)
}

// 自选表状态
interface WatchlistState {
  watchlist: WatchlistItem[];
  groups: WatchlistGroup[];  // 用户自定义分组

  addWatch(item: Omit<WatchlistItem, 'addedAt'>): void;
  removeWatch(code: string): void;
  updateWatch(code: string, patch: Partial<WatchlistItem>): void;
  reorderWatch(fromIndex: number, toIndex: number): void;
  pinWatch(code: string): void;
  unpinWatch(code: string): void;
  moveToGroup(code: string, group: string): void;

  // 分组
  createGroup(label: string): void;
  deleteGroup(groupId: string): void;
}

interface WatchlistGroup {
  id: string;
  label: string;
  color?: string;
  sort?: 'custom' | 'alphabetical' | 'byMarket';
}
```

---

## 三、迁移步骤

### Step 1: 新增 WatchlistItem 类型

```typescript
// src/lib/types.ts (追加)
export interface WatchlistItem {
  code: string;
  market: Market;
  brokerId: string | null;
  addedAt: number;
  pinned: boolean;
  group: string;
  notes?: string;
}
```

### Step 2: 更新 marketStore

```typescript
// src/stores/marketStore.ts (修改后)

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface MarketStore {
  // ── 从 string[] 改为 WatchlistItem[] ──
  watchlist: WatchlistItem[];

  // ── 新增持久化 ──
  // 使用 zustand/persist middleware

  addWatch: (item: Omit<WatchlistItem, 'addedAt'>) => void;
  removeWatch: (code: string) => void;
  // ... 其余 action
}

export const useMarketStore = create<MarketStore>()(
  persist(
    (set) => ({
      watchlist: DEFAULT_WATCHLIST,  // 含 3US+3HK+2Crypto

      addWatch: (item) => set((s) => ({
        watchlist: [
          ...s.watchlist,
          { ...item, addedAt: Date.now() }
        ]
      })),

      removeWatch: (code) => set((s) => ({
        watchlist: s.watchlist.filter(w => w.code !== code)
      })),
    }),
    {
      name: 'dawn-whales-watchlist',   // localStorage key
      // 仅持久化 watchlist (不持久化 quotes/当前选中等)
      partialize: (state) => ({ watchlist: state.watchlist }),
    }
  )
);
```

### Step 3: 更新 MarketPage

```typescript
// 原:
const watchlist = useMarketStore(s => s.watchlist);  // string[]

// 新:
const watchlist = useMarketStore(s => s.watchlist);  // WatchlistItem[]

// 用法变化:
//  原: watchlist.map(code => ...)
//  新: watchlist.map(item => ...)  // item.code, item.market, item.brokerId

//  原: onAdd(code)
//  新: onAdd({ code, market, brokerId: null, pinned: false, group: market })

//  按市场分组渲染
const grouped = useMemo(() => {
  const map = new Map<string, WatchlistItem[]>();
  for (const item of watchlist) {
    const key = item.group || item.market;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return map;
}, [watchlist]);
```

### Step 4: 更新 SymbolSearch

```typescript
// 原:
interface SymbolSearchProps {
  watchlist: string[];
  onAdd: (code: string) => void;
}

// 新:
interface SymbolSearchProps {
  watchlist: WatchlistItem[];
  onAdd: (item: Omit<WatchlistItem, 'addedAt'>) => void;
}

// handleAdd 变化:
const handleAdd = useCallback((s: SearchResult) => {
  // 从搜索结果中提取 market (核心改进: 不再靠 code 前缀推断)
  const market = s.market;     // ← 搜索结果自带 market
  const code = s.standardCode.replace(':', '.');  // "HK:00700" → "HK.00700"

  onAdd({
    code,
    market,
    brokerId: null,            // 自动选择
    pinned: false,
    group: market,
    notes: '',
  });
}, [onAdd]);
```

---

## 四、持久化方案

### 4.1 选择 localStorage (而非 IndexedDB)

理由:
- 自选列表通常 < 200 条, JSON stringify 足够
- 读写同步, 无需 async/await
- zustand/persist 开箱即用
- 跨 session 可靠性高

### 4.2 zustand/persist 配置

```typescript
persist(
  (set, get) => ({ ... }),  // store definition
  {
    name: 'dawn-whales-watchlist-v2',  // 版本化 key (防 schema 冲突)
    version: 2,                         // 迁移版本号
    migrate: (persisted, version) => {
      // 从 v1 (string[]) 迁移到 v2 (WatchlistItem[])
      if (version === 0 || version === 1) {
        const old = persisted as { watchlist: string[] };
        return {
          watchlist: (old.watchlist || []).map(code => ({
            code,
            market: detectMarketFromCode(code),
            brokerId: null,
            addedAt: Date.now(),
            pinned: false,
            group: detectMarketFromCode(code),
          })),
        };
      }
      return persisted as { watchlist: WatchlistItem[] };
    },
  }
)
```

### 4.3 迁移兼容

```
用户状态 1 (旧版, string[]):
  watchlist: ['US.AAPL', 'HK.00700', 'US.NVDA']

  → 自动迁移 (migrate v1→v2):
  watchlist: [
    { code:'US.AAPL',  market:'US', brokerId:null, addedAt:..., pinned:false, group:'US' },
    { code:'HK.00700', market:'HK', brokerId:null, addedAt:..., pinned:false, group:'HK' },
    { code:'US.NVDA',  market:'US', brokerId:null, addedAt:..., pinned:false, group:'US' },
  ]

用户状态 2 (新版, 无旧数据):
  → 直接使用 WatchlistItem[] schema
```

### 4.4 代码→市场推导函数

```typescript
function detectMarketFromCode(code: string): Market {
  if (code.startsWith('HK.'))  return 'HK';
  if (code.startsWith('US.'))  return 'US';
  if (code.startsWith('SH.') || code.startsWith('SZ.')) return 'CN';
  if (code.startsWith('CC.'))  return 'CRYPTO';
  if (code.startsWith('SG.'))  return 'SG';
  if (code.startsWith('JP.'))  return 'JP';
  if (code.startsWith('UK.'))  return 'UK';
  if (code.startsWith('EU.'))  return 'EU';
  return 'US'; // 默认
}
```

---

## 五、受影响文件清单

| 文件 | 改动 | 说明 |
|------|------|------|
| `src/lib/types.ts` | +WatchlistItem 类型 | 新增 |
| `src/stores/marketStore.ts` | 重写 + persist | string[] → WatchlistItem[] |
| `src/components/market/SymbolSearch.tsx` | Props 签名变更 | watchlist: string[] → WatchlistItem[] |
| `src/components/market/MarketPage.tsx` | 渲染逻辑变更 | item.code/item.market 替代 code |
| `src/hooks/useWebSocketQuotes.ts` | symbols 参数不变 | 仍用 code 订阅 WS |
| `docs/user-manual.md` | 数据结构更新 | 自选表说明更新 |

**不需要改动的文件**:
- QuoteSourceBadge.tsx — 不依赖 watchlist 结构
- BrokerPriority.tsx — 不依赖 watchlist
- useWebSocketQuotes.ts — symbols 仍为 string[]

---

## 六、回滚方案

如果迁移出现问题 (如 localStorage 损坏):

```
1. 用户侧: 清除 localStorage['dawn-whales-watchlist-v2']
2. 代码侧: zustand persist version 回退 → 加载 DEFAULT_WATCHLIST
3. DEFAULT_WATCHLIST 保持为 WatchlistItem[] (新格式)
4. 用户重新添加自选 (数据量通常 < 20, 影响有限)
```

---

## 七、默认自选 (跨市场)

```typescript
const DEFAULT_WATCHLIST: WatchlistItem[] = [
  // 美股 (3)
  { code: 'US.QQQ',  market: 'US', brokerId: null, addedAt: 0, pinned: false, group: 'US' },
  { code: 'US.SPY',  market: 'US', brokerId: null, addedAt: 0, pinned: false, group: 'US' },
  { code: 'US.AAPL', market: 'US', brokerId: null, addedAt: 0, pinned: false, group: 'US' },

  // 港股 (3)
  { code: 'HK.00700', market: 'HK', brokerId: null, addedAt: 0, pinned: false, group: 'HK' },
  { code: 'HK.09988', market: 'HK', brokerId: null, addedAt: 0, pinned: false, group: 'HK' },
  { code: 'HK.00388', market: 'HK', brokerId: null, addedAt: 0, pinned: false, group: 'HK' },

  // 加密货币 (2)
  { code: 'CRYPTO.BTC-USDT', market: 'CRYPTO', brokerId: null, addedAt: 0, pinned: false, group: 'CRYPTO' },
  { code: 'CRYPTO.ETH-USDT', market: 'CRYPTO', brokerId: null, addedAt: 0, pinned: false, group: 'CRYPTO' },
];
```

> **关键**: `addedAt: 0` 表示预设标的 (非用户添加), 迁移时不赋予当前时间戳。

---

> **变更总结**: `watchlist` 从 8 个字符串扩展为富对象数组, 支持 broker 绑定 + 置顶 + 分组 + 持久化。改动量约 200 行, 涉及 4 个核心文件。
