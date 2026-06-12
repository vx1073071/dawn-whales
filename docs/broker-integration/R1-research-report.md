# R1 预研报告 — Binance/OKX API + 并发架构
> 时间: 2026-06-12 09:12
> 轮次: R1 (基础设施+并发架构, 4天)
> ML任务: 8h 预研

## 一、Binance API 深度分析

### 1.1 现状
- ✅ **BinanceAdapter 已存在** (257行, `electron/engine/broker/adapters/binance-adapter.ts`)
- 实现 IBrokerAdapter 完整接口
- HMAC-SHA256 签名 (`signedRequest` 方法)
- REST + WebSocket 双通道
- 现货(SPOT)和合约(FUTURES)双模式

### 1.2 对齐 IBrokerAdapter 状态
| 方法 | 状态 | 备注 |
|------|------|------|
| connect() | ✅ | ping + user data stream |
| getQuote() | ✅ | /api/v3/ticker/24hr |
| getKlines() | ✅ | /api/v3/klines |
| subscribeMarketData() | ✅ | WebSocket stream + keepalive |
| placeOrder() | ✅ | /api/v3/order, HMAC signed |
| cancelOrder() | ⚠️ | 需要symbol参数 |
| getAccount() | ✅ | /api/v3/account |
| getPositions() | ✅ | 余额转持仓 |
| getOrders() | ✅ | /api/v3/openOrders |
| getTrades() | ✅ | /api/v3/myTrades |

### 1.3 需补充 (对齐 R1 Tagged类型)
- [ ] getQuote返回需加 `brokerId: 'binance'`
- [ ] getAccount返回需加 `brokerId`
- [ ] submitOrder需要返回 TaggedOrderResult

### 1.4 安全评估
- ✅ API Key + Secret 不暴露给前端
- ✅ 签名在 Electron 主进程完成
- ⚠️ 需JVS的 SEC-02 keytar加密存储

---

## 二、OKX API 对比分析

### 2.1 API 特点
- 统一 v5 REST API: `https://www.okx.com/api/v5/`
- WebSocket 公共频道: `wss://ws.okx.com:8443/ws/v5/public`
- WebSocket 私有频道: `wss://ws.okx.com:8443/ws/v5/private`
- 认证: `OK-ACCESS-KEY` + `OK-ACCESS-SIGN` + `OK-ACCESS-TIMESTAMP` + `OK-ACCESS-PASSPHRASE`
- 签名: HMAC-SHA256(`timestamp + method + path + body`)

### 2.2 与 Binance 的关键差异
| 维度 | Binance | OKX |
|------|---------|-----|
| 签名算法 | `query_string` HMAC-SHA256 | `timestamp+method+path+body` HMAC-SHA256 |
| 签名header | `X-MBX-APIKEY` | `OK-ACCESS-KEY/SIGN/TIMESTAMP/PASSPHRASE` |
| 行情端点 | `/api/v3/ticker/24hr` | `/api/v5/market/ticker?instId=BTC-USDT` |
| K线端点 | `/api/v3/klines` | `/api/v5/market/candles` |
| 下单端点 | `/api/v3/order` | `/api/v5/trade/order` |
| 代码格式 | `BTCUSDT` | `BTC-USDT` |
| WebSocket | `stream?streams=btcusdt@ticker` | `{"op":"subscribe","args":[{"channel":"tickers","instId":"BTC-USDT"}]}` |
| 默认limit | 500 | 100 |
| interval格式 | `1m`/`1h`/`1d` | `1m`/`1H`/`1Dutc` |

### 2.3 OKXAdapter 设计要点
- 继承 CryptoAdapterBase (待JVS完成)
- 签名逻辑: `signedRequest` 用 OKX 4-header 模式
- WS 订阅: 发送 JSON `subscribe` 帧替代 REST params
- 代码标准化: CodeNormalizer 处理 `BTCUSDT↔BTC-USDT`

---

## 三、CryptoAdapterBase 基类需求 (给JVS参考)

```typescript
abstract class CryptoAdapterBase implements IBrokerAdapter {
  abstract signRequest(method: string, path: string, params: any, body?: any): string;
  abstract wsUrl: string;
  abstract wsSubscribeFrame(channel: string, symbols: string[]): any;
  abstract getBaseUrl(): string;

  // 公共实现
  protected async request(method, path, params?) { ... }
  protected async signedRequest(method, path, params?) { ... }
  protected wsConnect(channel) { ... }
  protected wsReconnect() { ... } // 指数退避
  protected keepAlive() { ... }
}
```

---

## 四、并发UI原型设计

### 4.1 WatchlistV2 (CONC-06)
多券商同时展示同一标的的实时行情:
```
┌────────────┬──────────┬──────────┬──────────┬──────────┐
│ Symbol     │ Binance  │ OKX      │ Bybit    │ Bitget   │
├────────────┼──────────┼──────────┼──────────┼──────────┤
│ BTC-USDT   │ 98,234.5 │ 98,231.2 │ 98,230.8 │ 98,235.1 │
│ ETH-USDT   │ 5,432.1  │ 5,431.5  │ 5,430.2  │ 5,433.0  │
│ SOL-USDT   │ 187.45   │ 187.32   │ 187.28   │ 187.50   │
└────────────┴──────────┴──────────┴──────────┴──────────┘
```
- 每家broker有自己的颜色列
- 最优价格高亮
- 套利机会自动标记 (>0.1%差)

### 4.2 聚合持仓面板 (CONC-07)
```
┌──────────────────────────────┐
│ 📊 总资产: 1,234,567 USDT    │
│ 💵 可用:   456,789 USDT      │
│ 🔒 冻结:   123,456 USDT      │
├──────────┬─────────┬─────────┤
│ Binance  │ OKX     │ Bybit   │
│ 45%      │ 30%     │ 25%     │
│ BTC 0.5  │ BTC 0.3 │ ETH 2.0 │
│ ETH 5.0  │ SOL 100 │ SOL 50  │
└──────────┴─────────┴─────────┘
```

---

## 五、R1 交付物

1. ✅ Binance API 深度分析 (本文)
2. ✅ OKX API 差异对比 (本文)
3. ✅ CryptoAdapterBase 设计规范
4. ⬜ WatchlistV2 原型组件 (src/components/broker/WatchlistV2.tsx)
5. ⬜ 聚合面板原型 (src/components/broker/AggregatedPortfolio.tsx)

## 六、为 R2 准备的结论

- **Binance**: 可直接生产, 仅需加 brokerId Tagged + keytar 加密
- **OKX**: 需实现 CryptoAdapterBase 后, OKXAdapter 主要写签名逻辑 (4h)
- **Bybit/Bitget**: 与 Binance 高度相似, 低差异 (各4h)
- **Robinhood Crypto**: ED25519 签名, 仅REST(无WS)
