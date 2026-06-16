---
title: 券商接入指南
description: DAWN WHALES 支持的券商接入完整指南
---

# 券商接入指南

DAWN WHALES v2.6 支持 **15 个券商适配器**，覆盖港股、美股、A股、日股、加密货币等市场。

## 支持的券商

| 券商 | 市场 | 适配器 | 状态 |
|------|------|--------|------|
| Interactive Brokers | 全球 | `ib-adapter.ts` | ✅ 稳定 |
| 富途 Futu | HK/US/CN | `futu-adapter.ts` | ✅ 稳定 |
| 长桥 Long Bridge | HK/US | `longbridge-adapter.ts` | ✅ 稳定 |
| Moomoo | HK/US | `moomoo-adapter.ts` | ✅ 稳定 |
| eToro | 全球 | `eToroAdapter.ts` | ✅ 稳定 |
| Schwab | US | `SchwabAdapter.ts` | ✅ 稳定 |
| Webull | US | `WebullAdapter.ts` | ✅ 稳定 |
| E*TRADE | US | `ETRADEAdapter.ts` | ✅ 稳定 |
| Binance | Crypto | `BinanceRealtimeAdapter.ts` | ✅ 稳定 |
| OANDA | Forex | `oanda-adapter.ts` | ✅ 稳定 |
| Saxo Bank | 全球 | `saxo-adapter.ts` | ✅ 稳定 |
| Tiger Brokers | HK/US/SG | `tiger-adapter.ts` | ✅ 稳定 |
| 华泰 | CN A股 | `huatai-adapter.ts` | ✅ 稳定 |
| 盈立 uSMART | HK/US | `usmart-adapter.ts` | ✅ 稳定 |
| OPEND | 多市场 | `opend-base-adapter.ts` | ✅ 稳定 |

## 架构概览

所有券商适配器继承统一的基类：

```
BaseAdapter (electron/broker/adapter-base.ts)
├── BridgeAdapter   — 桥接模式 (IB / FIX 协议)
├── CryptoAdapter   — 加密货币 (Binance)
├── DirectAdapter   — 直连行情 (富途/长桥 API)
└── OAuthAdapter    — OAuth2 授权 (eToro/Schwab)
```

## 核心接口

```typescript
interface IBrokerAdapter {
  /** 连接 + 认证 */
  connect(credentials: BrokerCredentials): Promise<void>;
  /** 断开连接 */
  disconnect(): Promise<void>;
  /** 健康检查 */
  healthCheck(): Promise<HealthStatus>;
  /** 订阅行情 */
  subscribe(symbols: string[], channels: ChannelType[]): void;
  /** 下单 */
  placeOrder(order: OrderRequest): Promise<OrderResult>;
  /** 查询持仓 */
  getPositions(): Promise<Position[]>;
  /** 查询余额 */
  getBalance(): Promise<Balance>;
  /** 执行报告流 */
  onExecutionReport(cb: (report: ExecutionReport) => void): void;
}
```

## 接入流程 (以 Interactive Brokers 为例)

### 1. 前置条件

- IB TWS 或 IB Gateway 已安装运行
- API 权限已在 IB Account Management 中启用
- 端口: 7496 (TWS 实盘) / 7497 (TWS 模拟) / 4002 (Gateway)

### 2. 连接配置

在 DAWN WHALES 设置 → 券商管理 → 添加券商:

```json
{
  "broker": "ib",
  "name": "我的IB账户",
  "host": "127.0.0.1",
  "port": 7497,
  "clientId": 100,
  "accountId": "U1234567"
}
```

### 3. 认证

- 首次连接: TWS/Gateway 将弹出确认框 → 点击 **Yes** 授权
- 后续连接: 自动重连, 无需重复确认
- 连接状态: 右上角券商连接状态指示灯 (绿/黄/红)

### 4. 数据订阅

```typescript
// DAWN WHALES 自动订阅您关注的品种
// 在策略配置中选择关注的股票, 系统自动管理数据流
const adapter = getBrokerManager().getAdapter('ib');
await adapter.subscribe(['AAPL', 'TSLA', '0700.HK'], ['quote', 'trade', 'depth']);
```

## 健康监控

每 30 秒自动健康检查:

| 指标 | 说明 | 告警阈值 |
|------|------|---------|
| 连接延迟 | WebSocket/API 响应时间 | >5000ms |
| 心跳丢失 | 连续心跳超时次数 | >3次 |
| 数据质量 | 行情数据完整性 | 15分钟内0 tick |
| 订单超时 | 订单确认超时 | >30秒 |

健康评分 `BrokerHealthScore` (0-100) 在 `src/components/broker/BrokerHealthScore.tsx` 中展示。

## 断线恢复

- **自动重连**: 断线后 1s → 5s → 15s 指数退避重连
- **ReliableIPC**: 所有 IPC 消息由 `electron/ipc/reliable-ipc.ts` 保证传输可靠性
- **数据补全**: 重连后自动拉取缺失的K线数据
- **订单状态**: 重连后自动同步所有未完成订单

## 安全

- API Key/Secret 加密存储 (AES-256-GCM)
- OAuth2 授权流 (eToro/Schwab)
- 敏感字段自动脱敏 (`electron/engine/agents/sensitive-field-masker.ts`)
- 操作审计日志 (`electron/engine/core/audit-logger.ts`)

## FAQ

**Q: 可以同时连接多个券商吗?**
A: 可以。DAWN WHALES 支持最多 15 个券商同时连接, 在 `MultiAccountManager` 中统一管理。

**Q: 模拟交易和实盘交易如何切换?**
A: 每个连接可独立设置 `paperTrading: true/false`。纸交易使用 `paper-copy-trade-engine.ts`。

**Q: 数据延迟多大?**
A: 直连券商: <50ms (WebSocket)。桥接券商: <200ms。盘中实时数据通过 BinanceRealtimeAdapter 获取。

**Q: 支持条件单和算法单吗?**
A: 支持的券商: IB、富途、长桥。在策略模板中配置触发条件即可。
