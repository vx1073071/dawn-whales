# R135-Q03: R135 代码审计报告

> **Author**: QClaw · **Task**: R135-Q03 · **Hours**: 2h
> **Date**: 2026-06-13 08:05 HKT

---

## 1. TSC 验收

```
TypeScript 5.9.3
tsc --noEmit → EXIT:0, 0 errors ✅
git pull → Already up to date
```

---

## 2. R135 OpenD 桌面端核心文件

### 桌面端 OpenD 层

| 文件 | 大小 | 功能 |
|------|------|------|
| electron/broker/futu-opend.ts | 6.6KB | FutuOpenDClient (TCP protobuf) |
| electron/broker/opend-base-adapter.ts | 53.6KB | OpenDBaseAdapter (TCP连接/协议帧/行情解析/订单管理) |
| electron/engine/data/opend-live-broker.ts | 12.3KB | OpenD 实时券商桥 |
| electron/engine/data/opend-health-check.ts | 11KB | OpenD 健康检查 |
| electron/engine/data/opend-connection-validator.ts | 6.8KB | 连接验证器 |

### 前端 OpenD UI

| 文件 | 大小 | 功能 |
|------|------|------|
| src/hooks/useOpenDStream.ts | 6KB | OpenD 流式数据 Hook |
| src/opend/opend-client.ts | 2.3KB | OpenD 客户端封装 |
| src/lib/chart/opend-l3.ts | 9.2KB | OpenD L3 深度行情 |
| src/lib/chart/opend-fund-flow.ts | 8.7KB | OpenD 资金流向 |

### 服务器信号层

| 文件 | 大小 | 功能 |
|------|------|------|
| server/routes/signal.ts | 4.3KB | 信号 CRUD API |
| server/signal-queue.ts | 11.3KB | 优先级信号队列 |
| server/copy-trade-executor.ts | 14KB | 执行引擎 (cloud + opend 双模) |

---

## 3. OpenD 跟单数据流审计

```
桌面端拉取: GET /api/signal/pending?type=opend
              ↓
信号队列返回: [{ signalId, symbol, direction, price, quantity, priority }]
              ↓
本地审核: 用户面板预览 → 单笔/批量 确认
              ↓
本地下单: FutuOpenDClient.placeOrder()
              ↓ (TCP protobuf to OpenD port 11111)
结果回传: POST /api/signal/:id/execute { success, orderId, price, quantity, fee }
              ↓
服务器更新: signals.status = 'executed' / 'failed'
```

### 安全审计

| 检查项 | 状态 |
|--------|------|
| JWT 认证 | ✅ 所有信号端点 |
| SQL 注入 | ✅ parameterized |
| brokerType 校验 | ✅ cloud/opend 枚举 |
| 交易密码 | ✅ SDK 禁止解锁, 仅 OpenD GUI |
| 离线排队 | ✅ 信号不丢失 |

---

## 4. QClaw R135 完成清单

- [x] Q01: OpenD 跟单用户指南 (260+ lines: 流程/配置/API/下单规则/离线/监控/FAQ/安全)
- [x] Q03: 代码审计 (TSC 0, OpenD 数据流 + 安全审计)

---

> **Signed**: QClaw — R135-Q03, 代码审计 TSC 0
