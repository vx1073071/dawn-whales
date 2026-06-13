# Dawn Whales 多券商行情聚合方案 R152-R154

> **制定**: Claw (PM/64001) | **日期**: 2026-06-13
> **范围**: 8 项行情聚合待开发 → 3 轮完整落地
> **核心原则**: 一标的一行情源，按优先级选，不混源

---

## 0. 依赖关系

```
R152(搜索+路由)
  ↓
R153(适配器+WebSocket)
  ↓
R154(打磨+UI)
```

---

## R152: 搜索+路由 — SymbolSearchEngine + SymbolQuoteRouter (30h)

> 本轮让用户能"搜到标的"且"行情有确定来源"

| 🦐 | 任务 | 交付物 | 工时 |
|---|------|--------|------|
| **Claw(PM)** | 1. **SymbolQuoteRouter 核心** — 按资产类型+券商优先级+延迟健康选源<br>2. **代码标准化集成** — code-normalizer.ts 接入搜索+行情流<br>3. **市场检测** — detectMarket(symbol) → HK/US/CRYPTO<br>4. **故障切换** — 主源>500ms→备选,30s后重试切回 | `server/services/quote-router.ts` | 6h |
| **JVS(引擎)** | 1. **SymbolSearchEngine 后端** — 代码/名称搜索,标注交易所+可用券商<br>2. **标准化代码转换** — 输入"00700"自动识别为港股,转换所有格式<br>3. **券商市场能力查询** — GET /api/broker/markets → 返回每个券商的可用市场列表<br>4. **搜索API** — GET /api/symbol/search?q=腾讯 → 返回匹配+可用券商标签 | `server/services/symbol-search.ts` + `server/routes/symbol.ts` | 6h |
| **ML(前端)** | 1. **全局搜索框** — 替换 MarketPage 硬编码 POPULAR_US<br>2. **搜索结果UI** — 代码+名称+交易所标签+券商可用性(绿/红)<br>3. **添加交互** — 点击+号→检查券商连接→标准化代码→加入watchlist<br>4. **券商不可用提示** — "该标的需要连接港股券商" + 引导跳转 | `src/components/market/SymbolSearch.tsx` | 6h |
| **QClaw(文档)** | 1. **行情路由设计文档** — 三级路由策略+故障切换+延迟阈值<br>2. **代码标准化规格** — 所有市场的代码格式对照表<br>3. **券商市场映射表** — 哪些券商支持哪些市场 | `docs/design/quote-routing.md` + `docs/design/symbol-format.md` | 6h |
| **youdao(测试)** | 1. **搜索准确性测试** — 港股/美股/加密货币各20个代码<br>2. **代码标准化测试** — 富途/Tiger/IB格式互转<br>3. **券商匹配测试** — 港股标的只能搜到港股券商<br>4. **搜索性能测试** — 100并发搜索<200ms | `tests/symbol-search/` | 6h |

---

## R153: 适配器+WebSocket — 落地真实数据 (32h)

> 本轮让行情"不是Mock而是真的"

| 🦐 | 任务 | 交付物 | 工时 |
|---|------|--------|------|
| **Claw(PM)** | 1. **WebSocket推送管道** — subscribeMarketData落地,替代轮询<br>2. **行情缓存层** — 相同标的30s内不重复请求<br>3. **延迟监控** — 每个券商记录平均延迟,供路由器决策 | `server/services/ws-push-service.ts` + `server/services/quote-cache.ts` | 6h |
| **JVS(引擎)** | 1. **Futu OpenD 行情适配器** — getQuote/getKlines/subscribeMarketData<br>2. **Tiger 行情适配器** — 同上,对接Tiger API<br>3. **币安行情适配器完善** — WebSocket订阅替代REST轮询<br>4. **IB/长桥行情适配器** — 框架搭建,数据源对接 | `server/adapters/futu-adapter.ts` + `tiger-adapter.ts` | 8h |
| **ML(前端)** | 1. **QuoteSourceIndicator组件** — 行情列表底部小字显示当前券商<br>2. **行情切换提示** — 源切换时淡入动画 "富途→老虎"<br>3. **实时行情列表** — watchlist用WebSocket推送刷新,不再轮询<br>4. **K线数据加载优化** — 按需加载,缓存到IndexedDB | `src/components/market/QuoteSourceBadge.tsx` | 6h |
| **QClaw(文档)** | 1. **券商接入手册** — 每个券商API key申请步骤+接入指南<br>2. **行情数据格式文档** — Quote/Kline各字段含义<br>3. **WebSocket协议文档** — 订阅/推送格式 | `docs/design/broker-onboarding.md` | 6h |
| **youdao(测试)** | 1. **Futu行情真机测试** — 连接真实OpenD验证<br>2. **WebSocket推送验证** — 延迟<100ms,不掉消息<br>3. **行情源切换测试** — 手动断主源→自动切备选<br>4. **多市场并发测试** — 港股+美股+加密货币同时订阅 | `tests/quote-routing/` + `tests/ws-push/` | 6h |

---

## R154: 打磨+用户设置 (20h)

> 本轮让用户能"按自己偏好配置"

| 🦐 | 任务 | 交付物 | 工时 |
|---|------|--------|------|
| **Claw(PM)** | 1. **券商优先级配置存储** — 用户可拖拽调整券商顺序<br>2. **市场状态检测** — 港股3:00/美股4:00后→"已收盘"标记<br>3. **行情源健康面板** — 每个券商延迟/在线状态/错误率 | `server/services/quote-health.ts` | 4h |
| **JVS(引擎)** | 1. **券商配置API** — PUT /api/broker/priority 更新排序<br>2. **市场状态API** — GET /api/market/status 返回各市场开/收盘<br>3. **行情历史回放** — 可选功能:回放历史某天行情 | `server/routes/broker-config.ts` | 4h |
| **ML(前端)** | 1. **券商优先级设置页** — 拖拽排序+开关+市场覆盖<br>2. **市场状态指示器** — 自选列表顶部显示"港股已收盘/美股交易中"<br>3. **行情延迟可视化** — 每个标的显示当前延迟(绿<50ms/黄<200ms/红>500ms) | `src/components/settings/BrokerPriority.tsx` | 4h |
| **QClaw(文档)** | 1. **用户操作手册更新** — 加入行情模块章节<br>2. **券商优先级设置指南** — 截图+步骤 | `docs/user-manual.md` | 4h |
| **youdao(测试)** | 1. **优先级配置E2E** — 拖拽→保存→重启→验证<br>2. **市场状态自动化测试** — 各市场开/收盘状态<br>3. **8券商全量回归** — 适配器全量测试 | `tests/broker-config/` | 4h |

---

## 工时汇总

| 轮次 | 主题 | 工时 | 关键交付 |
|------|------|------|---------|
| R152 | 搜索+路由 | 30h | SymbolSearchEngine + SymbolQuoteRouter |
| R153 | 适配器+WebSocket | 32h | Futu/Tiger/Binance适配器 + WS推送 |
| R154 | 打磨+设置 | 20h | 优先级配置 + 市场状态 |
| **合计** | | **82h** | **8项全部完成** |

每虾每轮: ~6-8h → 3-4 个 production-ready 任务 ✅

---

## 每虾总工时

| 🦐 | R152 | R153 | R154 | 合计 |
|---|------|------|------|------|
| Claw(PM) | 6h | 6h | 4h | **16h** |
| JVS(引擎) | 6h | 8h | 4h | **18h** |
| ML(前端) | 6h | 6h | 4h | **16h** |
| QClaw(文档) | 6h | 6h | 4h | **16h** |
| youdao(测试) | 6h | 6h | 4h | **16h** |

---

## 验收标准

| 标准 | 目标 |
|------|------|
| 搜索框可搜港股/美股/加密货币 | 输入00700→返回腾讯+可用券商 |
| 行情源按优先级分配 | 港股走富途,加密货币走币安 |
| 主源故障自动切换 | 断富途→自动切老虎 |
| WebSocket推送延迟 | <100ms |
| 代码标准化 | 支持3种券商格式互转 |
| 券商适配器 | Futu+Tiger+Binance 真机验证 |
| 用户可调整优先级 | 拖拽排序保存后重启生效 |

---

*方案制定: Claw (PM/64001) | 2026-06-13*
