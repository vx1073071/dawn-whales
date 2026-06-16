# R133-Q01-1: Interactive Brokers (IB) TWS 接入文档

> **Author**: QClaw · **Task**: R133-Q01 (1/3) · **Hours**: 1h
> **Based on**: electron/broker/ib-adapter.ts (2037 lines)

---

## 一、IB 接入概览

| 项目 | 值 |
|------|-----|
| API 类型 | TCP 原生协议 (非 REST) |
| 连接端口 | IB Gateway Paper: 4002 / Live: 4001 · TWS Paper: 7497 / Live: 7496 |
| 市场 | US stocks, ETFs, options, futures, forex, bonds |
| 货币 | USD, HKD, GBP, EUR, JPY 等 |
| 行情模式 | 真实TCP + Mock自动降级 |

### quant-moo 实现

```
IBAdapter (electron/broker/ib-adapter.ts)
  → implements IBrokerAdapter
  → TCP Socket 直连 IB Gateway/TWS
  → 原生 IB Protocol (V100+ handshake)
  → Mock 降级: TCP失败 → 自动切换 Mock
```

---

## 二、连接配置

### 前置条件

| 步骤 | 操作 |
|------|------|
| 1 | 安装 IB Gateway 或 TWS |
| 2 | 启用 API 连接 (Configuration → API → Settings) |
| 3 | 勾选 "Enable ActiveX and Socket Clients" |
| 4 | 设置端口 (4001 Live / 4002 Paper) |
| 5 | 添加 quant-moo 服务器 IP 到 Trusted IPs |

### quant-moo 配置

```typescript
{
  type: 'ib',
  name: 'Interactive Brokers',
  accountId: 'U1234567',
  host: '127.0.0.1',
  port: 4002,          // Paper: 4002, Live: 4001
  clientId: 1,
  connectTimeout: 8000,
  requestTimeout: 15000,
  useMockFallback: true
}
```

---

## 三、核心特性

| 特性 | 说明 |
|------|------|
| Smart Routing | SMART/NYSE/NASDAQ/ARCA 等交易所路由 |
| Contract ID | conId 识别标的 (替代 symbol) |
| 多币种 | USD/HKD/GBP/EUR/JPY 账户支持 |
| Mock 降级 | TCP 连接失败自动降级 (paper trading) |
| 断线重连 | 指数退避 1s/5s/15s/30s + restore subscriptions |

---

## 四、REST/mock 端点 (id-adapter)

### 行情

| 方法 | 说明 |
|------|------|
| `getQuotes(codes)` | 批量获取报价 (bid/ask/last/open/high/low/volume) |
| `getKlines(code, interval, limit)` | K线 (1m/5m/15m/30m/1h/daily) |

### 交易

| 方法 | 说明 |
|------|------|
| `placeOrder(order)` | 下单 (MKT/LMT/STP + SMART routing) |
| `cancelOrder(orderId)` | 撤单 |
| `getOrders()` | 查询活跃订单 |
| `getPositions()` | 查询持仓 |

### 账户

| 方法 | 说明 |
|------|------|
| `getAccount()` | 账户摘要 (NetLiq/AvailableFunds/Margin) |
| `getBalance()` | 多币种余额 |

---

## 五、行情推送 (TCP Streaming)

IB 使用 TCP 持续连接推送实时行情:

```
Client → Request Market Data (reqId, conId, fields)
Server → streaming tickPrice / tickSize / tickString 持续推送
```

```
Tick Types:
  1=Bid, 2=Ask, 4=Last, 6=High, 7=Low, 9=Close
  14=Open, 8=Volume, 37=Mark Price
```

---

## 六、限速

| 限制 | 值 |
|------|----|
| 每秒最大请求 | 50 msg/s (IB Gateway) |
| TWS 并发连接 | 最多 8 个 clientId |
| 行情订阅 | 最多 100 ticker/连接 |

---

## 七、接入检查清单

- [ ] IB Gateway/TWS 已安装并运行
- [ ] API 连接已启用 (Socket port 4001/4002)
- [ ] Trusted IP 已添加
- [ ] 连接测试: TCP handshake → serverVersion
- [ ] 行情测试: getQuotes(['AAPL']) → bid/ask
- [ ] 订单测试: placeOrder (Paper account)

---

> **Signed**: QClaw — R133-Q01-1, IB TWS 接入文档
