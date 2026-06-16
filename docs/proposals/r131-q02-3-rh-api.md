# R131-Q02-3: Robinhood Crypto API 接入文档

> **Author**: QClaw · **Task**: R131-Q02 (part 3/3) · **Hours**: 1h
> **Version**: v2.0.0 | **API**: Robinhood Crypto (非公开)

---

## 一、Robinhood Crypto 接入概览

| 项目 | 值 |
|------|-----|
| REST Base | https://trading.robinhood.com |
| 签名算法 | ED25519 (非对称) |
| 实时推送 | ❌ 无 WebSocket (需轮询, 5s间隔) |
| K线 | ❌ 不支持 |
| 交易 | ✅ Crypto spot buy/sell |

---

## 二、ED25519 认证

### 签名机制

```
message = API_KEY + timestamp + method + path + body
signature = ED25519.sign(message, privateKey).base64()
```

### 请求头

| Header | 值 |
|--------|-----|
| x-api-key | API Key (base64 public key) |
| x-signature | ED25519 签名 (base64) |
| x-timestamp | Unix秒 (必须 ±30s) |
| Content-Type | application/json |

### quant-moo 实现参考

```typescript
private sign(method: string, path: string, body: string, timestamp: string): string {
  const message = `${this.creds.apiKey}${timestamp}${method}${path}${body}`;
  const signature = crypto.sign(null, Buffer.from(message), {
    key: crypto.createPrivateKey({
      key: Buffer.from(this.creds.privateKey, 'base64'),
      format: 'der',
      type: 'pkcs8',
    }),
    dsaEncoding: 'ieee-p1363',
  });
  return signature.toString('base64');
}
```

### API Key 生成

```
1. Robinhood → Settings → API → Create API Key
2. 下载: api.key (base64 public) + private.key (base64)
3. quant-moo 输入: apiKey + privateKey (2字段)
```

---

## 三、REST API 端点

### 3.1 账号验证

```
GET /api/v1/accounts/
返回: { results: [{ account_number, buying_power, cash, portfolio_value }] }
```

### 3.2 行情 (轮询)

```
GET /marketdata/forex/quotes/BTC-USD/
返回: {
  symbol: "BTC-USD",
  bid_price: "60000.00",
  ask_price: "60001.00",
  mark_price: "60000.50",
  updated_at: "2026-06-13T..."
}
```

**注意**: 无 WebSocket，quant-moo 使用 5秒轮询 `setInterval()`。

### 3.3 下单

```
POST /api/v1/crypto/trading/orders/ (SIGNED)
Body: {
  account_number: "...",
  side: "buy" | "sell",
  symbol: "BTC-USD",
  type: "market" | "limit",
  quantity: "0.001",
  price: "60000",              // limit only
  time_in_force: "gtc" | "ioc" | "fok"
}
```

**注意**: Robinhood Crypto 仅支持 Crypto spot trading (无合约/杠杆)。

### 3.4 查询订单

```
GET /api/v1/crypto/trading/orders/?symbol=BTC-USD (SIGNED)
返回: { results: [{ id, side, symbol, quantity, price, state, created_at }] }
```

### 3.5 撤单

```
POST /api/v1/crypto/trading/orders/{order_id}/cancel/ (SIGNED)
```

---

## 四、限制与注意事项

| 限制 | 说明 |
|------|------|
| ⚠️ 无 K 线 | `getKlines()` 返回空数组 |
| ⚠️ 无 WS 推送 | 行情通过 5s 轮询实现，不是实时 |
| ⚠️ 无杠杆 | 仅现货，不支持保证金/合约 |
| ⚠️ ED25519 | 非标准 HMAC，需 Node crypto 特殊处理 |
| ⚠️ PKCS8 | private key 必须是 PKCS8 DER 格式 |

### 符号映射

| DW | Robinhood |
|----|-----------|
| BTC/USDT | BTC-USD (Coinbase pricing) |
| ETH/USDT | ETH-USD |

---

## 五、限速

| 级别 | 限制 |
|------|------|
| 公共 | 100次/分钟/IP |
| 签名 | 100次/分钟/Key |
| 下单 | 40次/分钟 |

---

## 六、接入检查清单

- [ ] Robinhood 账号已完成 KYC
- [ ] API Key 已生成 (api.key + private.key)
- [ ] private.key 为 PKCS8 DER 格式
- [ ] 连接测试: GET /api/v1/accounts/ → 200
- [ ] 行情轮询测试 (5s interval)
- [ ] 订单测试 → market buy 最小数量

---

> **Signed**: QClaw — R131-Q02-3, Robinhood Crypto API 接入文档
