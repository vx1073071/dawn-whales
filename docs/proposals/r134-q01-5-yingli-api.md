# R134-Q01-5: 盈立证券 (uSMART/Yingli) 接入文档

> **Author**: QClaw · **Task**: R134-Q01 (5/5) · **Hours**: 0.8h
> **Based on**: BridgeAdapterBase pattern + uSMART API

---

## 一、盈立接入概览

| 项目 | 值 |
|------|-----|
| 券商 | 盈立证券 (uSMART Securities) |
| API 类型 | REST (uSMART Open API) |
| 市场 | 港股 (HKEX) + 美股 (NYSE/NASDAQ) + A股 (沪深港通) |
| 特色 | 零佣金美股, 智能条件单, 定投 |

### quant-moo 适配器

```
YingliBridgeAdapter extends BridgeAdapterBase
  → REST API 适配
  → 港股+美股+A股 三市场
  → 智能条件单支持
```

---

## 二、核心 REST 端点

### 2.1 行情

```
GET /openapi/quote/v1/real?symbol=AAPL&region=US
Auth: Token
返回: {
  symbol, name, price, bid, ask,
  change, changeRatio, volume, amount,
  high, low, open, preClose, status
}

GET /openapi/quote/v1/kline?symbol=AAPL&region=US&type=DAY&count=100
返回: [{ time, open, high, low, close, volume }]
```

### 2.2 账户

```
GET /openapi/trade/v1/account/summary
返回: { totalAssets, availableCash, marketValue, frozenCash, todayPnl, totalPnl }

GET /openapi/trade/v1/account/positions
返回: [{ symbol, name, quantity, availableQty, costPrice, marketPrice, marketValue, pnl }]
```

### 2.3 下单

```
POST /openapi/trade/v1/order/create
{
  symbol: "00700",
  region: "HK",
  side: "BUY",
  type: "LIMIT",
  quantity: 100,
  price: 380.00,
  timeInForce: "DAY"
}
```

### 2.4 智能条件单 (uSMART 特色)

```
POST /openapi/trade/v1/condition-order/create
{
  symbol: "AAPL",
  region: "US",
  triggerType: "PRICE",         // PRICE / PERCENT / TIME
  triggerValue: 175.00,         // 触发价格
  triggerDirection: "BELOW",    // ABOVE / BELOW
  orderSide: "BUY",
  orderType: "LIMIT",
  quantity: 10,
  price: 175.00,
  expireDate: "2026-07-13"
}
```

---

## 三、A股规则 (沪深港通)

| 项目 | 说明 |
|------|------|
| 交易时间 | 09:30-11:30, 13:00-15:00 HKT |
| T+1 结算 | 买入当天不可卖出 |
| 涨跌停 | ±10% (主板), ±20% (科创板/创业板) |
| 交易单位 | 100股/手 |
| 印花税 | 0.1% (仅卖方) |
| 经手费 | 0.00487% (双边) |

---

## 四、限速

| 接口 | 限制 |
|------|------|
| 行情 | 100次/分钟 |
| 下单 | 30次/分钟 |
| 条件单 | 20次/分钟 |

---

## 五、接入检查清单

- [ ] 盈立证券账户已开户 (港股+美股+A股)
- [ ] uSMART Open API 权限已申请
- [ ] Token 已获取
- [ ] 连接测试: 行情 REST → 200
- [ ] 下单测试: 模拟盘 → 成交
- [ ] 条件单测试: 触发 → 下单

---

> **Signed**: QClaw — R134-Q01-5, 盈立证券接入文档
