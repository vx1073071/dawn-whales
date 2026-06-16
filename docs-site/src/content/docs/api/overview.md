---
title: API 参考
description: QUANT MOO REST API + IPC 接口文档
---

# API 参考

QUANT MOO 提供两套接口:
- **REST API** — HTTP 接口, 用于外部集成
- **IPC 通道** — Electron 主进程↔渲染进程通信

## REST API

### 基础URL

```
http://localhost:22443/api/v2
```

### 认证

所有 API 请求需要 API Key:

```http
Authorization: Bearer dw_sk-xxxx
```

API Key 在 **设置 → API 管理** 中生成和管理。

### 接口列表

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/market/quote/:symbol` | 实时报价 |
| GET | `/market/kline/:symbol` | K线数据 |
| GET | `/market/factors/:symbol` | 因子数据 |
| POST | `/trading/order` | 下单 |
| GET | `/trading/orders` | 查询订单 |
| DELETE | `/trading/order/:id` | 撤单 |
| GET | `/trading/positions` | 持仓查询 |
| GET | `/strategy/list` | 策略列表 |
| POST | `/strategy/run` | 运行策略 |
| POST | `/backtest/run` | 运行回测 |
| GET | `/backtest/result/:id` | 回测结果 |
| GET | `/account/balance` | 账户余额 |
| GET | `/account/health` | 健康检查 |

### 示例: 查询行情

```bash
curl -H "Authorization: Bearer dw_sk-xxxx" \
  http://localhost:22443/api/v2/market/quote/AAPL
```

### 示例: 下单

```bash
curl -X POST http://localhost:22443/api/v2/trading/order \
  -H "Authorization: Bearer dw_sk-xxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "AAPL",
    "side": "buy",
    "type": "market",
    "quantity": 100
  }'
```

## IPC 通道

### 通道命名规范

```
<domain>:<action>
```

### 通道列表

#### 行情数据

| 通道 | 方向 | 说明 |
|------|------|------|
| `market:quote` | Main→Renderer | 实时报价推送 |
| `market:kline` | Main→Renderer | K线更新 |
| `market:depth` | Main→Renderer | 深度行情 |
| `market:news` | Main→Renderer | 新闻推送 |
| `market:factor` | Main→Renderer | 因子数据 |

#### 交易

| 通道 | 方向 | 说明 |
|------|------|------|
| `trade:order` | 双向 | 下单请求/确认 |
| `trade:exec` | Main→Renderer | 成交报告 |
| `trade:cancel` | Renderer→Main | 撤单请求 |
| `trade:position` | Main→Renderer | 持仓更新 |

#### 策略

| 通道 | 方向 | 说明 |
|------|------|------|
| `strategy:signal` | Main→Renderer | 交易信号 |
| `strategy:run` | Renderer→Main | 启停策略 |
| `strategy:status` | Main→Renderer | 策略状态 |

#### 因子

| 通道 | 方向 | 说明 |
|------|------|------|
| `factor:signal` | Main→Renderer | 单因子信号 |
| `factor:signal-batch` | Main→Renderer | 批量因子信号 |
| `factor:signal-request` | Renderer→Main | 按需请求因子数据 |
| `factor:pipeline-status` | Main→Renderer | 管线状态 |

#### 可靠通信

所有 IPC 通道由 `ReliableIPC` (`electron/ipc/reliable-ipc.ts`) 保证:
- 序号顺序投递
- 断线重连
- ACK 重传

### 渲染端使用

```typescript
// React 组件中使用 IPC
import { useEffect } from 'react';

function MyComponent() {
  useEffect(() => {
    // 监听因子信号
    const unsubscribe = window.electronAPI.on('factor:signal', (data) => {
      console.log('Received factor signal:', data);
    });
    return unsubscribe;
  }, []);
}
```
