# Sprint 2 Phase 3 执行计划（精简版）

**从**: PM (WorkBuddy)  
**时间**: 2026-06-06  
**基于**: JVS `docs/roadmap/sprint2-phase3-plan.md` (905 行完整版)  
**目标**: ≤200 行，聚焦前 3 个可执行任务

---

## 背景

R25 已完成:
- ✅ `IBrokerAdapter` 接口定义 (`electron/broker/IBrokerAdapter.ts`)
- ✅ `BrokerManager` 多券商管理器 (`electron/broker/BrokerManager.ts`)
- ✅ `FutuBrokerAdapter` 完整实现 (`electron/broker/futu-opend.ts`)
- ✅ `MoomooAdapter` 骨架实现 (`electron/broker/moomoo-adapter.ts`, 412 行)
- ✅ `preload.ts` broker/trade/ws 命名空间已暴露

---

## 任务 1: OpenDBaseAdapter 重构（Week 1, P0）

**目标**: 将 FutuOpenDClient 的通用逻辑抽取为基类，供 Futu 和 moomoo 复用。

**为什么**: moomoo 与 Futu 使用相同的 OpenD 协议，只有端口和少量配置不同。

**执行步骤**:
1. 新建 `electron/broker/opend-base.ts`
   - 抽取 TCP 连接管理、心跳、重连逻辑
   - 抽取订阅/取消订阅行情通用方法
   - 抽取订单请求/响应序列化逻辑
2. 修改 `electron/broker/futu-opend.ts`
   - FutuOpenDClient 继承 OpenDBaseAdapter
   - 仅保留 Futu 特有逻辑（如港股 IPO 申购）
3. 完善 `electron/broker/moomoo-adapter.ts`
   - 继承 OpenDBaseAdapter
   - 默认端口改为 11211
   - 实现 moomoo 特有市场（新加坡）的合约代码转换
4. **验收**: Futu 原有测试全部通过，MoomooAdapter 编译通过

**负责人**: JVS  
**预估**: 3–4 天  
**阻塞**: 无

---

## 任务 2: IB Adapter 骨架 + 连接验证（Week 1–2, P0）

**目标**: 实现 Interactive Brokers 适配器骨架，能连接 IB Gateway 并获取账户信息。

**为什么**: IB 覆盖全球市场（期货、期权、外汇），是专业交易者的刚需。

**执行步骤**:
1. 安装依赖: `npm install @stoqey/ib`
2. 新建 `electron/broker/ib-adapter.ts`
   - 实现 `IBrokerAdapter` 接口
   - `connect()`: 连接 IB Gateway (localhost:7496 paper / 7497 live)
   - `getAccountInfo()`: 读取账户摘要 (NetLiquidation, AvailableFunds)
   - `getPositions()`: 读取持仓列表
   - `placeOrder()`: 支持 MARKET / LIMIT / STOP 订单
3. **Mock 模式**: 无 IB Gateway 时返回 mock 数据，确保 UI 不崩溃
4. **验收**: `BrokerManager.registerAdapter(new IBAdapter(config))` 成功，能读取 mock/paper 账户

**负责人**: JVS  
**预估**: 5–7 天  
**阻塞**: 依赖任务 1 的 `IBrokerAdapter` 接口稳定性

---

## 任务 3: UnifiedAccountManager 统一账户（Week 2–3, P1）

**目标**: 聚合多券商资金、持仓、盈亏数据，统一展示。

**为什么**: 用户需要在一个页面看到所有券商的总资产，而不是逐个切换。

**执行步骤**:
1. 新建 `electron/engine/unified-account.ts`
   - `UnifiedAccountManager` 类
   - `aggregatePositions()`: 合并同名持仓，计算加权成本
   - `aggregateFunds()`: 汇总现金 + 市值，按汇率换算为基准货币
   - `getTotalPnL()`: 跨券商盈亏汇总
2. 汇率处理（P1.5）:
   - 默认基准货币: USD
   - HKD → USD: 固定汇率 0.128（可配置）
   - SGD → USD: 固定汇率 0.74（可配置）
3. IPC 暴露:
   - `account:summary` → 返回聚合后的总资产/现金/市值/盈亏
   - `account:positions` → 返回合并持仓列表
4. UI 接入:
   - `DashboardPage` 总资产区域调用 `window.api.account.summary()`
   - `PortfolioPage` 持仓表格显示「券商来源」列
5. **验收**: 注册 2 个券商后，Dashboard 显示的总资产 = 券商A + 券商B

**负责人**: ML + JVS  
**预估**: 5–7 天  
**阻塞**: 依赖任务 1 和 2 的适配器实现

---

## 后续任务（Week 3–4, P2）

| 任务 | 描述 | 负责人 |
|------|------|--------|
| 任务 4 | UI 券商选择器: Sidebar 添加券商切换下拉框 | ML |
| 任务 5 | OrderForm 券商路由: 下单时选择目标券商 | ML |
| 任务 6 | E2E 多券商测试: 2 个 mock 券商并发场景 | QClaw |
| 任务 7 | 性能优化: 3 券商并发时 portfolio 刷新 <500ms | QClaw |
| 任务 8 | 文档更新: USER-GUIDE.md 多券商配置说明 | PM |

---

## 里程碑

| 时间 | 目标 |
|------|------|
| Week 1 结束 | 任务 1 完成 (OpenDBaseAdapter + Futu 重构通过) |
| Week 2 结束 | 任务 2 完成 (IB Adapter 骨架 + 连接验证) |
| Week 3 结束 | 任务 3 完成 (UnifiedAccountManager + UI 接入) |
| Week 4 结束 | 任务 4–8 完成，Phase 3 验收 |

---

## 关键文件映射

| 文件 | 状态 | 行动 |
|------|:----:|------|
| `electron/broker/types.ts` | ✅ 稳定 | 可能需要扩展 IB 特有字段 |
| `electron/broker/futu-opend.ts` | ✅ 实现 | 重构继承 OpenDBaseAdapter |
| `electron/broker/moomoo-adapter.ts` | 🔄 骨架 | 完善继承 OpenDBaseAdapter |
| `electron/broker/broker-manager.ts` | ✅ 实现 | 无需修改 |
| `preload.ts` | ✅ 已暴露 | 可能需要添加 `account:` 命名空间 |
| `src/components/trading/TradeDashboardPage.tsx` | ❌ mock | 接入真实 IPC |

---

## 风险与应对

| 风险 | 概率 | 应对 |
|------|:----:|------|
| `@stoqey/ib` 包有 edge-case bug | 中 | 准备 fallback 到官方 `ibapi` Python bridge |
| moomoo OpenD 协议与 Futu 有未文档差异 | 中 | 预留 `opend-base.ts` 钩子方法供子类覆盖 |
| IB Gateway 连接不稳定 | 低 | Mock 模式确保无 Gateway 时 UI 可用 |
| 多券商并发导致事件冲突 | 低 | BrokerManager 用 brokerId 前缀隔离事件通道 |

---

*完整技术细节见 `docs/roadmap/sprint2-phase3-plan.md` (905 行)*  
*本文件为执行摘要，用于任务分配和进度跟踪。*
