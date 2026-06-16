# R134-Q01-4: 华盛证券 (VBKR/Huasheng) 接入文档

> **Author**: QClaw · **Task**: R134-Q01 (4/5) · **Hours**: 0.8h
> **Based on**: BridgeAdapterBase pattern + VBKR API research

---

## 一、华盛接入概览

| 项目 | 值 |
|------|-----|
| 券商 | 华盛证券 (Valuable Capital, 代码: 00800.HK) |
| API 类型 | REST (内部接口, 需授权) |
| 市场 | 港股 (HKEX) + 美股 (NYSE/NASDAQ) |
| 账户 | 现金+保证金, 华泰金控背景 |
| 特色 | 社交社区 "华盛通", AI 选股, 低佣金 |

### quant-moo 适配器

```
HuashengBridgeAdapter extends BridgeAdapterBase
  → REST 接口适配
  → 港股+美股双市场
  → 与现有 BridgeAdapter 共享接入层
```

---

## 二、核心 REST 端点

### 2.1 行情

```
GET /api/v1/quote?symbol=AAPL&market=US
Auth: API-Key + Signature
返回: {
  symbol, latestPrice, bidPrice, askPrice,
  change, changePercent, volume, turnover,
  high, low, open, preClose, marketStatus
}

GET /api/v1/kline?symbol=AAPL&market=US&period=DAY&count=100
返回: [{ date, open, high, low, close, volume, amount }]
```

### 2.2 账户

```
GET /api/v1/account/info
返回: { totalAssets, buyingPower, cashBalance, marketValue, todayPnl, totalPnl, marginRatio }

GET /api/v1/account/positions
返回: [{ symbol, name, quantity, avgPrice, currentPrice, marketValue, pnl, pnlPercent }]
```

### 2.3 下单

```
POST /api/v1/order/place
{
  symbol: "00700",
  market: "HK",
  side: "BUY",
  orderType: "LIMIT",
  quantity: 100,
  price: 380.00,
  tradeSession: "NORMAL"
}
```

### 2.4 订单查询与撤单

```
GET /api/v1/order/list?status=ACTIVE
POST /api/v1/order/cancel { orderId: "xxx" }
```

---

## 三、港股特殊规则

| 规则 | 说明 |
|------|------|
| 最小交易单位 | 港股按 "手" 交易 (如 00700 一手=100股) |
| 交易时间 | 09:30-12:00, 13:00-16:00 HKT |
| 碎股 | 不足一手需碎股市场买卖 (价格劣化) |
| 报价单位 | 按股价区间不同 (0.001/0.005/0.01/0.05/0.1) |
| 印花税 | 0.13% 双边征收 |

---

## 四、接入检查清单

- [ ] 华盛证券账户已开户 (港股+美股)
- [ ] API 权限已申请
- [ ] API Key 已获取
- [ ] 连接测试: 行情 REST → 200
- [ ] 下单测试: 模拟盘 → 成交

---

> **Signed**: QClaw — R134-Q01-4, 华盛证券接入文档
