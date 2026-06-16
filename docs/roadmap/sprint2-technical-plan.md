<!-- META
version: 1.12.0
last_updated: 2026-06-12
round: R108
owner: PM
purpose: (auto-generated, needs review)
-->

# Sprint 2 Technical Roadmap — quant-moo v0.8.0

> 日期: 2026-06-06 | 作者: JVS | 状态: 草案

---

## Sprint 1 回顾 (v0.7.0)

### 已完成
- ✅ 18 个后端引擎模块 (JVS-83~100): 数据基础设施 + AI/算法引擎
- ✅ 13 个 IPC handler 模块 (113+ handlers)
- ✅ 36 个前端页面 (含 7 个 IPC 全链路对接)
- ✅ T82-T84 基础设施 (Redis/Prometheus/Docker)
- ✅ TypeScript 0 errors, Build 0 errors
- ✅ Tests: 576 pass / 0 fail
- ✅ E2E 冒烟测试: 21/21 pass
- ✅ 性能基准测试: 31/31 pass
- ✅ 总代码量: ~100K lines

### 遗留问题
- Electron 启动验证未完成
- 部分页面仍使用 mock 数据 (SentimentStreamDashboard, MarketplacePage 等)
- CSS arbitrary value warnings (R20 修复中)

---

## Sprint 2 目标

**核心主题: 实盘交易 + 实时数据 + 多券商**

从"可展示 Demo"到"可实盘使用的量化交易平台"

### 关键指标
| 指标 | Sprint 1 | Sprint 2 目标 |
|------|----------|--------------|
| 实盘交易 | ❌ 仅模拟 | ✅ Futu OpenD 实盘 |
| 实时行情 | ⚠️ Push 模式但未验证 | ✅ WebSocket 全链路 |
| 券商支持 | 1 (Futu) | 2+ (Futu + moomoo/IB) |
| 策略执行 | ❌ 仅回测 | ✅ 实盘自动执行 |
| 数据延迟 | ~500ms | <50ms (WebSocket) |

---

## 技术路线图

### Phase 1: 实时行情 WebSocket (Week 1-2)

#### 1.1 WebSocket 行情引擎
- **新建**: `electron/engine/ws-market-data.ts`
- 替代当前 Push 模式，使用原生 WebSocket
- 支持: 实时报价 / K线推送 / 深度数据 / 逐笔成交
- 断线重连 + 心跳检测 + 消息队列

#### 1.2 Futu OpenD WebSocket 适配
- **增强**: `electron/broker/futu-opend.ts`
- 添加 WebSocket 协议支持 (当前仅 TCP)
- 订阅管理: 按策略自动订阅/退订
- 数据缓冲: 防止高频推送压垮前端

#### 1.3 前端 WebSocket 集成
- **修改**: MarketPage / TradingDeskPage / RiskDashboardPage
- 使用 `window.api.ws.subscribe()` 替代轮询
- 实时价格闪烁动画
- 连接状态指示器

**验收**: 行情延迟 <50ms, 前端无卡顿

---

### Phase 2: 实盘交易执行 (Week 2-3)

#### 2.1 交易执行引擎
- **新建**: `electron/engine/trade-executor.ts`
- 策略信号 → 订单生成 → 风控检查 → 下单执行
- 支持: 市价单 / 限价单 / 止损单 / 止盈单
- 订单状态追踪 + 部分成交处理

#### 2.2 Paper Trader → Real Trader 切换
- **增强**: `electron/engine/paper-trader.ts`
- 添加 `mode: 'paper' | 'real'` 切换
- Real 模式: 调用 broker.placeOrder() 真实下单
- 安全机制: 二次确认 / 金额限制 / 紧急平仓

#### 2.3 实盘交易 UI
- **新建**: `src/components/trading/RealTradePanel.tsx`
- 实盘/模拟切换开关
- 实时订单状态 + 成交回报
- 交易日志 + 盈亏追踪

**验收**: 能真实下单并收到成交回报

---

### Phase 3: 多券商适配 (Week 3-4)

#### 3.1 IB (盈透证券) 适配器
- **新建**: `electron/broker/ib-adapter.ts`
- TWS API / IB Gateway 连接
- 支持: 美股 / 港股 / 期货 / 期权
- 账户管理 / 持仓查询 / 下单执行

#### 3.2 moomoo 适配器增强
- **增强**: `electron/broker/moomoo-adapter.ts`
- 当前已有基础，需补充:
  - WebSocket 行情订阅
  - 实盘交易执行
  - 多账户管理

#### 3.3 券商切换 UI
- **增强**: `src/components/layout/BrokerSelector.tsx`
- 多券商同时连接
- 按策略绑定不同券商账户
- 资金/持仓跨券商汇总

**验收**: 至少 2 个券商可实盘交易

---

### Phase 4: 策略自动执行 (Week 4-5)

#### 4.1 策略调度器
- **新建**: `electron/engine/strategy-scheduler.ts`
- 策略定时启动/停止
- 多策略并行执行
- 资源隔离 (每个策略独立线程)

#### 4.2 信号执行管道
- **增强**: `electron/engine/strategy-engine.ts`
- 信号生成 → 风控过滤 → 订单生成 → 执行 → 记录
- 支持: 立即执行 / 延迟执行 / 条件执行
- 执行日志 + 异常告警

#### 4.3 策略监控面板
- **新建**: `src/components/strategy/LiveStrategyMonitor.tsx`
- 实时策略状态 (运行中/已停止/异常)
- 今日信号 / 今日成交 / 今日盈亏
- 一键启停所有策略

**验收**: 策略能自动运行并执行交易

---

## 技术债清理 (持续进行)

### R21-R22 计划
1. **mock 页面清理**: 将剩余 mock 页面对接真实 IPC
2. **CSS 警告清零**: 所有 arbitrary values → named classes
3. **测试覆盖率**: 从 576 → 700+ tests
4. **性能优化**: 首屏加载 <3s, 页面切换 <200ms
5. **Electron 打包**: Windows/macOS 安装包 + 自动更新

---

## 风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| Futu OpenD WebSocket 不稳定 | 中 | 高 | TCP fallback + 消息重发 |
| 实盘下单金额错误 | 低 | 极高 | 二次确认 + 金额上限 + 模拟先行 |
| IB API 文档不全 | 中 | 中 | 社区库 + 逆向工程 |
| 多策略资源竞争 | 中 | 中 | Worker Pool 隔离 + 优先级调度 |
| 前端 WebSocket 内存泄漏 | 中 | 低 | 定期 GC + 订阅管理 |

---

## 里程碑

| 里程碑 | 日期 | 交付物 |
|--------|------|--------|
| M1: WebSocket 行情 | Sprint 2 Week 2 | 实时行情 <50ms |
| M2: 实盘交易 | Sprint 2 Week 3 | Futu 实盘下单成功 |
| M3: 多券商 | Sprint 2 Week 4 | IB 适配器可用 |
| M4: 策略自动化 | Sprint 2 Week 5 | 策略自动执行交易 |

---

## 依赖关系

```
Phase 1 (WebSocket)
    ↓
Phase 2 (实盘交易) ← Phase 3 (多券商)
    ↓
Phase 4 (策略自动化)
```

Phase 1 和 Phase 3 可并行开发，Phase 2 依赖 Phase 1，Phase 4 依赖 Phase 2。

---

## 资源需求

| 角色 | Sprint 2 任务 |
|------|--------------|
| JVS | WebSocket 引擎 + 交易执行 + 策略调度 |
| 主龙虾 | IB 适配器 + moomoo 增强 + 多券商 UI |
| QClaw | 测试覆盖 + 性能基准 + Electron 打包 |
| WB | 需求验收 + Demo 脚本 + 用户文档 |

---

## 下一步

1. PM 确认 Sprint 2 优先级和时间线
2. 各角色认领 Phase 并细化任务
3. 开始 Phase 1: WebSocket 行情引擎开发

---

*本文档将随开发进展持续更新*
