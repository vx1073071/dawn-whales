# R134-Q03: 17 家券商能力矩阵 (Updated)

> **Author**: QClaw · **Task**: R134-Q03 · **Hours**: 2h
> **Previous**: docs/proposals/multi-broker-integration-plan.md (R108)
> **Update**: R134 — toàn 17 brokers with adapter status

---

## 一、总览

| Tier | 数量 | 券商 | 状态 |
|------|------|------|------|
| 🟢 **Tier 0** (已接入) | 2 | Futu OpenD, IB TWS | ✅ 生产可用 |
| 🟢 **Tier 1** (官方API, 优先) | 9 | Tiger, Schwab, E\*TRADE, eToro, Binance, OKX, Bybit, Bitget, MT5 | ✅ 适配器已完成 |
| 🟡 **Tier 2** (Bridge适配器) | 4 | 华盛, 盈立, Webull, Robinhood | ✅ 适配器已完成 |
| ⚪ **Tier 3** (仅文档) | 2 | Longbridge, moomoo | 📋 文档就绪 (同OpenD/API已存在) |

---

## 二、17 家券商能力矩阵

| # | 券商 | 类型 | 市场 | 行情 | 下单 | 账户 | WS | 适配器 | 状态 |
|---|------|------|------|------|------|------|----|--------|------|
| 1 | Futu | OpenD TCP | HK/US/CN | ✅ | ✅ | ✅ | ✅ | futu-adapter | Tier 0 |
| 2 | IB TWS | TCP Proto | US/HK/Global | ✅ | ✅ | ✅ | ✅ | ib-adapter (2037L) | Tier 0 |
| 3 | Tiger | REST+WS | HK/US/SG | ✅ | ✅ | ✅ | WS | tiger-adapter | Tier 1 |
| 4 | Schwab | OAuth2+Streamer | US | ✅ | ✅ | ✅ | WS | schwab-adapter (652L) | Tier 1 |
| 5 | E\*TRADE | OAuth1.0a+XML | US | ✅ | ✅ | ✅ | — | etrade-adapter (781L) | Tier 1 |
| 6 | eToro | OAuth2+REST | US/ETF/Crypto | ✅ | ✅ | ✅ | — | etoro-adapter (382L) | Tier 1 |
| 7 | MT5 | MetaApi Cloud | FX/Metal/Index/Crypto | ✅ | ✅ | ✅ | ✅ | mt5-adapter | Tier 1 |
| 8 | Binance | HMAC-SHA256 | Crypto | ✅ | ✅ | ✅ | ✅ | crypto-adapter | Tier 1 |
| 9 | OKX | HMAC-SHA256 | Crypto | ✅ | ✅ | ✅ | ✅ | crypto-adapter | Tier 1 |
| 10 | Bybit | HMAC-SHA256 | Crypto | ✅ | ✅ | ✅ | ✅ | crypto-adapter | Tier 1 |
| 11 | Bitget | HMAC-SHA256 | Crypto | ✅ | ✅ | ✅ | ✅ | crypto-adapter | Tier 1 |
| 12 | 华盛 | Bridge | HK/US | ✅ | ✅ | ✅ | — | huasheng-bridge | Tier 2 |
| 13 | 盈立 | Bridge | HK/US/A | ✅ | ✅ | ✅ | — | yingli-bridge | Tier 2 |
| 14 | Webull | Bridge | US/HK | ✅ | ✅ | ✅ | — | webull-adapter | Tier 2 |
| 15 | Robinhood | Bridge | Crypto | ✅ | ✅ | ✅ | — | rh-adapter | Tier 2 |
| 16 | Longbridge | REST+WS | HK/US/SG | 📋 | 📋 | 📋 | WS | — | Tier 3 |
| 17 | moomoo | OpenD TCP | HK/US/JP | 📋 | 📋 | 📋 | ✅ | 复用futu-adapter | Tier 3 |

---

## 三、按市场覆盖矩阵

| 市场 | 已接入券商 |
|------|-----------|
| **美股** | IB, Tiger, Schwab, E\*TRADE, eToro, 华盛, 盈立, Webull |
| **港股** | Futu, IB, Tiger, 华盛, 盈立, Longbridge, moomoo |
| **加密** | Binance, OKX, Bybit, Bitget, eToro, Robinhood, MT5 |
| **外汇** | MT5 |
| **A股** | Futu, 盈立, Tiger |
| **日股** | moomoo, IB |
| **新加股** | Tiger, Longbridge |

---

## 四、按认证方式矩阵

| 方式 | 券商 | 数量 |
|------|------|------|
| TCP Protocol | Futu (OpenD), IB (TWS) | 2 |
| OAuth2 PKCE | Schwab, eToro, Webull | 3 |
| OAuth 1.0a | E\*TRADE | 1 |
| HMAC-SHA256 | Binance, OKX, Bybit, Bitget | 4 |
| REST Token | Tiger, MT5, 华盛, 盈立, Robinhood | 5 |
| JWT + API Key | MetaApi (MT5) | 1 |

---

## 五、适配器代码量

| Adapter | 行数 | 复杂度 | 特殊依赖 |
|---------|------|--------|---------|
| IB TWS | 2037 | ⭐⭐⭐⭐⭐ | TCP proto, streaming |
| E\*TRADE | 781 | ⭐⭐⭐⭐ | OAuth1.0a, XML |
| Schwab | 652 | ⭐⭐⭐ | OAuth2, Streamer |
| eToro | 382 | ⭐⭐ | CopyTrader API |
| 华盛 | ~400 | ⭐⭐ | Bridge adapter |
| 盈立 | ~400 | ⭐⭐ | 条件单 |
| MT5 | ~600 | ⭐⭐⭐ | MetaApi cloud |
| Crypto (4合1) | ~2000 | ⭐⭐⭐ | HMAC-SHA256签名 |

---

## 六、接入顺序建议

```
Phase 1 (R1-R4, 已完成):     OAuth 预研 + Schwab/E*TRADE/eToro/Webull 架构
Phase 2 (R109-R130, 已完成):  加密4家(CryptoAdapter) + 全景面板
Phase 3 (R131, 已完成):       跟单引擎 + 信号队列
Phase 4 (R132, 已完成):       跟单执行 + WS推送 + 费率
Phase 5 (R133, 已完成):       美股Batch1: IB + Tiger + Schwab
Phase 6 (R134, 当前):         美股Batch2: E*TRADE + eToro + MT5 + 华盛 + 盈立 + 矩阵更新
Phase 7 (R135-R136, 待定):    跨市场跟单 + 全景面板收尾
```

---

> **Signed**: QClaw — R134-Q03, 17家券商能力矩阵 (更新至 R134)
