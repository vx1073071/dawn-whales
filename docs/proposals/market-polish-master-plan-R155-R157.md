# Dawn Whales 5虾行情打磨方案 R155-R157

> **制定**: Claw (PM/64001) | **日期**: 2026-06-14
> **范围**: 5虾审计合并 28 项问题 → 3 轮完整修复
> **核心**: 从"能用"到"好用"的最后一公里

---

## 0. 依赖关系

```
R155(数据接通)
  ↓
R156(体验闭环)
  ↓
R157(打磨起飞)
```

---

## R155: 数据管道接通 — P0全部9项 (28h)

> 本轮让搜索引擎不再虚假、券商状态不再Mock、行情源可见

| 🦐 | # | 任务 | 交付物 | 工时 |
|---|----|------|------|------|
| **Claw(PM)** | 1 | **SymbolSearch 接真实 API** — `SYMBOL_DB` 改调 `GET /api/symbol/search`，保留本地缓存降级 | `SymbolSearch.tsx` | 3h |
| | 8 | **挂载 quote-router/cache/health 到 server/index.ts** — import + init + 健康端点 | `server/index.ts` | 1h |
| | 9 | **watchlist tagged 升级** — marketStore 改为 `{code,brokerId,addedAt}[]`，向后兼容旧格式 | `marketStore.ts` | 2h |
| **JVS(引擎)** | 2 | **券商真实连接状态 API** — `GET /api/broker/status` 返回每个适配器真实连接+延迟 | `server/routes/broker-config.ts` | 2h |
| | 4 | **默认 watchlist 跨市场** — 3美+3港+2加密，按已连接券商智能推荐 | `server/routes/symbol.ts` | 1h |
| | — | **symbol-search 增强** — 支持中文名+拼音+模糊匹配，扩大搜索覆盖 | `symbol-search.ts` | 3h |
| **ML(前端)** | 2 | **SymbolSearch 接真实 broker 状态** — `MOCK_BROKER_STATUS` → `api.getBrokerStatus()` | `SymbolSearch.tsx` | 1h |
| | 5 | **行情行显示券商来源** — WatchlistRow 加 mini `QuoteSourceIndicator`（小字+颜色编码） | `MarketPage.tsx` | 2h |
| | 3 | **watchlist 持久化** — localStorage 存储，重启恢复 | `marketStore.ts` | 2h |
| | 4 | **初始 watchlist 多市场** — 改为 3US+3HK+2Crypto | `marketStore.ts` | 0.5h |
| **QClaw(文档)** | — | **行情搜索设计文档更新** — SymbolSearch架构+API对接说明 | `docs/design/symbol-search.md` | 3h |
| | — | **watchlist tagged 迁移指南** | `docs/design/watchlist-migration.md` | 2h |
| **youdao(测试)** | — | **搜索API E2E** — 真实搜索+Mock降级+模糊匹配 | `tests/symbol-search/` | 4h |
| | — | **tagged watchlist 迁移测试** — 旧格式兼容+新格式读写 | `tests/watchlist/` | 2h |

---

## R156: 体验闭环 — P1全部11项 (30h)

> 本轮让用户"添加即看到、搜到即预览、源可手动切"

| 🦐 | # | 任务 | 交付物 | 工时 |
|---|----|------|------|------|
| **Claw(PM)** | 7 | **统一两个 Watchlist** — broker/WatchlistV2 + MarketPage 合并为单一数据源 | `marketStore.ts` + `WatchlistV2.tsx` | 2h |
| | 11 | **行情源手动切换** — WatchlistRow 右键菜单→选择券商 | `QuoteSourceBadge.tsx` | 2h |
| | 20 | **共享 broker config store** — BrokerPriority + QuoteSourceBadge 同源 | `brokerConfigStore.ts` | 2h |
| **JVS(引擎)** | 14 | **添加时券商可用性检查 API** — `POST /api/symbol/check` → 返回可用券商+市场状态 | `server/routes/symbol.ts` | 2h |
| | 15 | **行情新鲜度时间戳** — 每笔 Quote 带 `lastUpdateMs`，>5s 标灰 | `ws-push-service.ts` | 1h |
| | — | **实时价格预览 API** — `GET /api/symbol/quote-preview?q=BTC` 搜索时带价格 | `server/routes/symbol.ts` | 2h |
| **ML(前端)** | 6 | **添加后自动选中K线** — `handleAddStock` + `setSelectedSymbol(code)` | `MarketPage.tsx` | 0.5h |
| | 10 | **搜索结果价格预览** — 搜索行显示实时价格+涨跌颜色 | `SymbolSearch.tsx` | 2h |
| | 12 | **搜索历史** — localStorage 最近10条，下拉提示 | `SymbolSearch.tsx` | 2h |
| | 17 | **添加后即时反馈** — fetchQuote立即显示，非等待10s轮询 | `useWebSocketQuotes.ts` | 1.5h |
| | 18 | **搜索框始终可见** — 固定在页面上方，按钮改为Ctrl+K提示 | `MarketPage.tsx` | 1h |
| | 19 | **BrokerPriority 接入 Settings** — 路由+Tab | `SettingsPage.tsx` | 1h |
| **QClaw(文档)** | — | **SourceSwitch UX 文档** — 切换时机+原因透明+UI规范 | `docs/design/source-switch-ux.md` | 2h |
| | — | **用户引导更新** — 行情页首次使用引导 | `docs/user-manual.md` | 1h |
| **youdao(测试)** | — | **手动切源E2E** — 右键→选券商→验证行情更新 | `tests/source-switch/` | 2h |
| | — | **搜索历史+自动选中** 集成测试 | `tests/search-flow/` | 2h |
| | — | **持久化重启测试** — 添加→重启→验证恢复 | `tests/watchlist-persist/` | 2h |

---

## R157: 打磨起飞 — P2全部8项 (22h)

> 本轮让用户"用得爽"——分组/排序/快捷键/中文搜索

| 🦐 | # | 任务 | 交付物 | 工时 |
|---|----|------|------|------|
| **Claw(PM)** | 24 | **删除确认+撤销** — 首次弹确认框，之后3s Toast可撤销 | `MarketPage.tsx` | 1h |
| | 28 | **拆分 SymbolSearch** — Input/searchHook/dataSource 三文件 | `SymbolSearch/` | 3h |
| **JVS(引擎)** | 27 | **中文/拼音搜索增强** — symbol-search 加 nameZH+alias+pinyin 字段 | `symbol-search.ts` | 2h |
| | 16 | **自选导入导出 API** — CSV/JSON 格式 | `server/routes/symbol.ts` | 2h |
| **ML(前端)** | 13 | **自选分组** — 按市场 Tab 分组显示 | `MarketPage.tsx` | 2h |
| | 21 | **拖拽排序** — react-dnd 行拖拽 | `MarketPage.tsx` | 2h |
| | 22 | **置顶功能** — 📌 切换，置顶排最前 | `WatchlistRow` | 1h |
| | 23 | **K线图加自选按钮** — 星标 ⭐ | `KLineChart.tsx` | 1h |
| | 25 | **快捷键** — Ctrl+K搜索/Ctrl+1/2/3分组/Del删除 | `MarketPage.tsx` | 1h |
| | 26 | **列排序** — 表头可点击按价格/涨跌幅/成交量 | `MarketPage.tsx` | 1h |
| **QClaw(文档)** | — | **最终用户手册完稿** — 行情章节全量更新 | `docs/user-manual.md` | 2h |
| **youdao(测试)** | — | **28项全量回归** — 逐项打勾 | `tests/market-final/` | 4h |
| | — | **键盘导航+快捷键 验收** | `tests/keyboard/` | 1h |

---

## 工时汇总

| 轮次 | 主题 | 工时 | 修复项 | 关键交付 |
|------|------|------|--------|---------|
| R155 | 数据接通 | 28h | P0:1-9 | 搜索不假/券商不Mock/源可见/持久化 |
| R156 | 体验闭环 | 30h | P1:10-20 | 价格预览/手动切源/历史/即时反馈 |
| R157 | 打磨起飞 | 22h | P2:21-28 | 分组/排序/置顶/快捷键/中文搜 |
| **合计** | | **80h** | **28项全部** | |

每虾每轮: ~5-7h → 3-4 production-ready 任务 ✅

---

## 每虾总工时

| 🦐 | R155 | R156 | R157 | 合计 |
|---|------|------|------|------|
| Claw(PM) | 6h | 6h | 4h | **16h** |
| JVS(引擎) | 6h | 5h | 4h | **15h** |
| ML(前端) | 5.5h | 8h | 8h | **21.5h** |
| QClaw(文档) | 5h | 3h | 2h | **10h** |
| youdao(测试) | 6h | 6h | 5h | **17h** |

---

## 验收标准

| 标准 | 目标 |
|------|------|
| 搜索任意代码有结果 | `GET /api/symbol/search?q=1398` → 返回工商银行 |
| 券商状态真实 | 未连接=红色/已连接=绿色+延迟 |
| 每行显示行情源 | "🐂 富途 · 35ms" |
| 自选重启不丢失 | 添加→重启→还在 |
| 添加后K线自动跳转 | 点+号→K线立即显示 |
| 可手动切换行情源 | 右键→选券商→价格更新 |
| 搜索框始终可见 | 不用点按钮即可输入 |

---

*方案制定: Claw (PM/64001) | 2026-06-14*
