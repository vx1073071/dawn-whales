# R137 Q02 — 跟单类型系统审计

> **Author**: QClaw · **Round**: R137 · **Date**: 2026-06-13 09:15 HKT
> **Task**: 跟单类型系统审计 (types→Store→IPC) — 2h

---

## 一、类型系统全貌

发现 **3套独立类型系统**，互不引用，各自定义相同类型名但不同形状：

```
┌─────────────────────────────────────────────────────────┐
│  类型系统 A: broker-ui-types.ts (QClaw R120 #22+#23)    │
│  src/lib/chart/broker-ui-types.ts                       │
│  用途: SignalProvider + Portfolio 服务层类型             │
│  引用者: 0 个 copy-trade UI 组件                         │
├─────────────────────────────────────────────────────────┤
│  类型系统 B: CopyTradeStore.types.ts (PM R137-P02)      │
│  src/store/CopyTradeStore.types.ts                      │
│  用途: IPC 接口设计 + 跟单业务类型                       │
│  引用者: 未知                                           │
├─────────────────────────────────────────────────────────┤
│  类型系统 C: copyTradeStore.ts (ML R137-M02)            │
│  src/stores/copyTradeStore.ts                           │
│  用途: Zustand store 内部类型定义                        │
│  引用者: CopyTradeHub.tsx                                │
│  注意: 完全独立于 A 和 B                                  │
└─────────────────────────────────────────────────────────┘
```

---

## 二、类型冲突详细分析

### 2.1 `SignalProvider` — 3种不同形状

| 字段 | broker-ui-types.ts (A) | copyTradeStore.ts (C) | CopyTradeStore.types.ts (B) |
|------|----------------------|----------------------|---------------------------|
| ID | `providerId` | `id` | `id` |
| 收益 | `stats.totalReturn` | `totalReturn` (顶层) | `stats.totalReturn` |
| 风险等级 | `SignalRiskLevel` (conservative/moderate/aggressive/extreme) | `RiskLevel` (low/medium/high) | `'low'/'medium'/'high'` |
| 关注者 | `followerCount` | `followers` | `stats.followerCount` |
| 验证 | `verification` (unverified/pending/verified/featured) | `verified` (boolean) | `verified` (boolean) |
| 月费 | `monthlyFee` | `fee` | `stats.profitSplit` / `stats.dailyFee` |
| 交易风格 | `style` (day-trade/swing/...) | ❌ | ❌ |
| 分类 | ❌ | `icon` / `avatar` | `category` (trend/momentum/...) |

**冲突严重性**: 🔴 **P0** — 三套系统不能互操作，任何跨层函数需要手动转换。

### 2.2 `CopyTradeConfig` — 3种不同形状

| 字段 | CopyTradeSettings.tsx | copyTradeStore.ts (C) | CopyTradeStore.types.ts (B) |
|------|----------------------|----------------------|---------------------------|
| 模式 | `mode: 'fixed'\|'ratio'` | `mode: 'fixed'\|'ratio'` | `mode: 'live'\|'paper'` |
| 标签 | ❌ | ❌ | `accountLabel` |
| 日亏损上限 | ❌ | ❌ | `maxDailyLoss` |
| 连续亏损上限 | ❌ | ❌ | `maxConsecutiveLoss` |
| 创建时间 | ❌ | ❌ | `createdAt` / `updatedAt` |

**冲突严重性**: 🔴 **P0** — A的 `mode` 语义 (fixed/ratio) 与 B的 `mode` (live/paper) 完全不同。

### 2.3 `CopyTradeNotification` — 3种不同形状

| 字段 | CopyTradeNotifications.tsx | copyTradeStore.ts (C) | CopyTradeStore.types.ts (B) |
|------|--------------------------|----------------------|---------------------------|
| 类型 | `NotificationType` (7种: order_filled/failed/retrying/signal_received/stop_loss/take_profit/error) | 相同 | `'executed'\|'failed'\|'paused'\|'stopped'\|'limit_reached'\|'dead_letter'` |
| 严重度 | ❌ | ❌ | `severity: 'success'\|'warning'\|'error'\|'info'` |
| 时间戳 | `timestamp` (number) | `timestamp` (number) | `timestamp` (string) |
| 数据 | `data?: {symbol, side, amount...}` | `data?: {symbol, side, amount...}` | `signalId?` / `brokerId?` / `providerId?` |

### 2.4 `BrokerType` — 2种不同定义

| | broker-ui-types.ts | copyTradeStore.ts |
|---|---|---|
| 范围 | 17家券商 union (futu/moomoo/ib/.../mt5) | 4种抽象类型 (cloud/opend/oauth2/api) |
| 粒度 | 每家有具体名称 | 按协议分类 |

**冲突**: 从服务层拿到 `BrokerType = 'binance'` → Store 期望 `'cloud'`，需转换层。

---

## 三、IPC 类型缺口

### broker-ipc-v2.ts 的跟单通道

| IPC Channel | 参数类型 | 返回类型 | 状态 |
|-------------|---------|---------|------|
| `broker:copyTrade` | `(sourceBrokerId, targetBrokerId, tradeId, ratio)` | `{orderId: null}` | ⛔ **Stub** |

与 CopyTradeStore.types.ts 的 `CopyTradeIpc` 接口对比：

| Store 定义的 Channel | broker-ipc-v2 中 | 状态 |
|---------------------|-----------------|------|
| `copytrade:config:getAll` | ❌ 不存在 | 缺失 |
| `copytrade:providers:list` | ❌ 不存在 | 缺失 |
| `copytrade:signals:pending` | ❌ 不存在 | 缺失 |
| `copytrade:signals:execute` | ❌ 不存在 | 缺失 |
| `copytrade:summary` | ❌ 不存在 | 缺失 |
| `copytrade:killswitch:toggle` | ❌ 存在 killSwitchAll (不同) | 不匹配 |

**结论**: `CopyTradeIpc` 定义了一套完整的 IPC 接口，但 `broker-ipc-v2.ts` **一个都没实现**。

---

## 四、localStorage ↔ Zustand 迁移状态

### 旧系统 (独立 localStorage)

| 组件 | localStorage Key | 内容 |
|------|-----------------|------|
| CopyTradeSettings | `dw-copytrade-config` | `CopyTradeConfig` |
| CopyTradeNotifications | `dw-notifications` | `CopyTradeNotification[]` |
| CopyTradeNotifications | `dw-sound` | `"on"\|"off"` |
| SignalFeedAndCopyPanel | (useState only) | — |

### 新系统 (Zustand)

| Zustand Key | persist 范围 |
|------------|-------------|
| `dw-ct-store` v1 | config + following + selectedBrokers + soundEnabled + offlineConfig + version |

### 迁移脚本

`src/lib/localStorageMigration.ts` (ML M03):
- 读取旧 key → 写入 Zustand store → 标记迁移完成 → (可选)清除旧 key
- 前缀: `dw:ct:` (not yet verified against existing keys)

---

## 五、数据流类型断层

### 完整用户操作 → 类型转换链

```
页面操作                 类型层              IPC/HTTP           服务层
───────                 ──────              ───────            ──────
选信号源  →  CopyTradeProvider  →  ???  →  ???  →  SignalProvider (broker-ui-types)
                                              ↓
                                         无 IPC 通道!
                                              ↓
配置金额  →  CopyTradeConfig    →  ???  →  ???  →  QueuedSignal.payload
                                              ↓
                                     broker:copyTrade (无配置字段!)
```

**断层点**: 前端的 `CopyTradeConfig` (maxAmount, stopLossPct, mode) 无法传递到 `broker:copyTrade`（只接受 sourceBrokerId/targetBrokerId/tradeId/ratio）。

---

## 六、修复建议 (优先级排序)

### 🔴 P0: 合并类型系统 (4h)

```
目标: 1套类型 → 被 Store/UI/IPC/Server 共享引用

Merge Plan:
  broker-ui-types.ts ← 吸收 CopyTradeStore.types.ts (IPC 部分)
                      ← 吸收 copyTradeStore.ts (Store 内部类型)
                      → rename to avoid conflicts
                      → export unified types
```

具体步骤:
1. `broker-ui-types.ts` 新增 `CopyTradeConfigV2` (合并 B 和 C 的字段)
2. 废弃/重命名 C 中的重复类型
3. `copyTradeStore.ts` 导入 `broker-ui-types.ts` 的类型
4. 删除 `CopyTradeStore.types.ts` 或改为仅 IPC interface

### 🔴 P0: 补充 IPC 通道 (3h)

在 `broker-ipc-v2.ts` 中注册 `CopyTradeIpc` 定义的通道:
- `copytrade:config:*` — 配置 CRUD
- `copytrade:providers:*` — 信号源查询
- `copytrade:signals:pending` — 桌面端拉取
- `copytrade:executions:*` — 执行记录
- `copytrade:summary` — 汇总统计
- `copytrade:deadletter:*` — 死信管理

### 🟡 P1: 统一 BrokerType (1h)

二选一:
- **方案A**: Store 使用服务层的 17 家 brokerType → 但 Store 不需要这个粒度
- **方案B**: 保留两种 BrokerType，定义转换函数 `toBrokerCategory(type: BrokerType): 'cloud'|'opend'|'oauth2'|'api'`

推荐方案 B（不破坏现有语义，提供桥接）。

### 🟡 P1: 子组件接入 Store (等待 ML M03+M04)

当前 0/7 组件使用 Zustand store。CopyTradeHub 已接入但子组件仍需迁移。

---

## 七、总评

| 维度 | 评分 | 说明 |
|------|------|------|
| 类型完整性 | 60% | 单个文件完整但互不兼容 |
| 类型一致性 | 10% | 3套系统中相同类型名有不同形状 |
| IPC 对齐 | 15% | Store IPC 定义和实际注册完全不同 |
| 迁移路径 | 70% | localStorageMigration.ts 已规划 |
| 扩展性 | 40% | 新增跟单功能需修改 3 套类型系统 |

**结论**: 类型系统是当前跟单架构的最大债务。3套独立系统必须合并为1套共享类型层，否则每轮开发都会出现类型不匹配 bug。建议 R138/R139 集中处理。

---

> **Signed**: QClaw — R137 Q02 跟单类型系统审计
