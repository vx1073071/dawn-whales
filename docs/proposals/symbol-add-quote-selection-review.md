# TradingEasy 行情标的添加 + 多券商行情选择 — 独立审查

> 审查人: youdao | 2026-06-14 00:36 HKT | 面向 PM

## 审查范围

- `src/components/market/SymbolSearch.tsx` (22KB) — 全局搜索框
- `src/components/broker/WatchlistV2.tsx` (8KB) — 多券商实时行情列表
- `src/components/market/QuoteSourceBadge.tsx` (13KB) — 行情源指示器
- `src/components/chart/SymbolLink.tsx` (4KB) — 标的可点击链接
- `server/services/quote-router.ts` — 行情路由引擎

## 一、致命问题

**1.1 搜索只能搜硬编码的约30个标的** — SymbolSearch.tsx 的 SYMBOL_DB 是静态数组，用户输入 "TSLA" 找不到。应改为调用后端搜索API。

**1.2 两个 Watchlist 并存** — broker/WatchlistV2.tsx (@ts-nocheck) 和 risk/WatchlistManager.tsx 各自维护自选股，无共享状态，用户切面板看到不同的自选股列表。

**1.3 行情源自动选择不可干预** — QuoteSourceBadge 只显示不提供切换。用户信任富途但Router选了币安，无法手动切换。

## 二、功能缺失

**2.1 无最近查看历史** — 每次都要重新搜索。应有localStorage最近10个标的。

**2.2 搜索无热门Tab** — SYMBOL_DB有isHot但前端不展示。应分港股/美股/加密货币Tab。

**2.3 添加标的无券商可用性检查** — 加了加密标的但无加密券商连接，全是Mock数据。应在添加时检查并引导。

**2.4 无删除/拖拽/分组** — 自选股固定排序。应支持拖拽排序、右键删除、分组(短线/长线/观察)。

**2.5 行情源切换无原因说明** — 自动切了源但用户不知道为什么。应Tooltip显示切换原因。

## 三、人类UX打磨

**3.1 搜索框无键盘导航** — 不能Ctrl+K/方向键/回车跳转。应支持全键盘操作。

**3.2 添加后无反馈** — 加了标的静默无提示。应有Toast"已添加AAPL"+查看按钮。

**3.3 K线图无加自选按钮** — 看K线觉得不错，要切回搜索页才能添加。应在K线图右上角加星标。

**3.4 行情列表无券商标签** — 价格来自哪个券商不可见。应底部小字标注"数据源:富途·45ms"。

**3.5 跨市场切换无提示** — 港股切美股时无声切换。应顶部横幅"已切换到美股行情[Schwab]"。

## 四、架构问题

**4.1 SymbolSearch.tsx 22KB过大** — 搜索+数据库+添加+券检+UI全在一个文件。应拆分为Input/useSearch/dataSource。

**4.2 WatchlistV2 @ts-nocheck** — 8KB全部跳过类型检查。

**4.3 行情源选择逻辑分散** — quote-router/QuoteSourceBadge/ChartStore三处不一致。

## 五、优先级

| 优先级 | 项目 | 预估 | 影响 |
|--------|------|------|------|
| P0 | 搜索API (硬编码→后端) | 6h | 用户搜不到股票 |
| P0 | 统一Watchlist Store | 2h | 自选股不同步 |
| P1 | 行情源手动切换 | 4h | 用户信任度 |
| P1 | 最近查看历史 | 2h | 减少重复搜索 |
| P1 | 添加时券商检查 | 2h | 避免无数据标的 |
| P1 | 自选管理(删/拖/分组) | 3h | 基本管理功能 |
| P2 | 键盘导航 | 2h | 专业效率 |
| P2 | K线加自选按钮 | 1h | 减少切换 |
| P2 | 行情券商标签 | 2h | 数据信任 |
| P2 | 搜索热门Tab | 1h | 发现新标的 |

**总计: 25h** | 完整报告: docs/proposals/symbol-add-quote-selection-review.md
