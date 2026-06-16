<!-- META
version: 1.12.0
last_updated: 2026-06-12
round: R4
owner: QClaw
purpose: 16家券商API完整对比参考手册 — 行情/交易/账户/认证/限制速查
-->

# quant-moo 16 家券商 API 参考手册

> **版本**: v1.12.0 | **轮次**: R4 Final | **维护**: QClaw (文档虾)
> **用途**: 快速查询任意券商的 API 能力、限制条件、市场覆盖、认证方式

---

## 目录

1. [认证方式对比](#一认证方式对比)
2. [行情接口对比](#二行情接口对比)
3. [交易接口对比](#三交易接口对比)
4. [账户与持仓对比](#四账户与持仓对比)
5. [市场覆盖矩阵](#五市场覆盖矩阵)
6. [推送与实时数据](#六推送与实时数据)
7. [特殊功能矩阵](#七特殊功能矩阵)
8. [费率与限制](#八费率与限制)
9. [Sandbox 可用性](#九sandbox-可用性)
10. [安全审计清单](#十安全审计清单)
11. [已知问题与注意事项](#十一已知问题与注意事项)

---

## 一、认证方式对比

| 券商 | 认证方式 | API Key 格式 | Token 有效期 | 刷新机制 | 复杂度 |
|------|---------|-------------|-------------|---------|--------|
| **富途 Futu** | OpenD 二进制协议 | localhost 无需 Key | 连接存活 | 自动重连 | ⭐ |
| **moomoo** | OpenD 二进制协议 | localhost 无需 Key | 连接存活 | 自动重连 | ⭐ |
| **盈透 IBKR** | TWS/Gateway | API Key + 用户名密码 | 连接存活 | 手动重连 | ⭐⭐ |
| **老虎 Tiger** | Protobuf + JWT | API Key + Secret | 2h | Refresh Token | ⭐⭐⭐ |
| **长桥 Longbridge** | OAuth2 + JWT | Client ID + Secret | 1h | Refresh Token | ⭐⭐ |
| **华盛 VBKR** | Protobuf 网关 | Token/Session | Session | 重登录 | ⭐⭐⭐ |
| **盈立 uSMART** | REST + API Key | API Key + Secret | Token 30min | Auto-refresh | ⭐⭐ |
| **Schwab** | OAuth2 PKCE | Client ID + Secret | 30min | Auto-refresh | ⭐⭐ |
| **E\*TRADE** | OAuth1.0a | Consumer Key + Secret | **永久有效** | **无需刷新** | ⭐⭐⭐⭐ |
| **eToro** | OAuth2 | Client ID + Secret + API Key | 1h | Refresh Token | ⭐⭐ |
| **Webull** | OAuth2 | Client ID + Secret | 1h | Refresh Token | ⭐⭐ |
| **Binance** | HMAC-SHA256 | API Key + Secret | 永久有效 | N/A | ⭐ |
| **OKX** | HMAC-SHA256 | API Key + Secret + Passphrase | 永久有效 | N/A | ⭐ |
| **Bybit** | HMAC-SHA256 | API Key + Secret | 永久有效 | N/A | ⭐ |
| **Bitget** | HMAC-SHA256 | API Key + Secret + Passphrase | 永久有效 | N/A | ⭐ |
| **MT5** | auth-token | MetaApi Token | Token 存活 | 无 | ⭐⭐ |

### 复杂度说明

| 级别 | 说明 | 代表券商 |
|------|------|---------|
| ⭐ | 简单 HMAC / 本地连接 | 加密四所, 富途/moomoo |
| ⭐⭐ | OAuth2 标准流程 | Schwab, eToro, Webull, 长桥 |
| ⭐⭐⭐ | 自有协议 + JWT | 老虎, 华盛, IBKR |
| ⭐⭐⭐⭐ | OAuth1.0a (每请求签名) | E\*TRADE |

---

## 二、行情接口对比

| 券商 | 实时行情 | K 线 | 买卖盘 | 期权链 | Greeks | 资金流向 | 数据格式 |
|------|---------|------|--------|--------|--------|---------|---------|
| **富途 Futu** | ✅ 推送 | ✅ | ✅ L2 | ✅ | ❌ | ✅ | Protobuf |
| **moomoo** | ✅ 推送 | ✅ | ✅ L2 | ✅ | ❌ | ✅ | Protobuf |
| **盈透 IBKR** | ✅ 流式 | ✅ | ✅ L2 | ✅ | ✅ | ❌ | JSON |
| **老虎 Tiger** | ✅ 推送 | ✅ | ❌ L1 | ✅ | ❌ | ❌ | Protobuf |
| **长桥 Longbridge** | ✅ 推送 | ✅ | ❌ L1 | ❌ | ❌ | ❌ | JSON |
| **华盛 VBKR** | ✅ HTTP | ✅ | ❌ | ✅ | ❌ | ❌ | Protobuf |
| **盈立 uSMART** | ✅ HTTP | ✅ | ❌ L1 | ❌ | ❌ | ❌ | JSON |
| **Schwab** | ✅ WS | ✅ | ✅ L1 | ✅ | ✅ (含Greeks) | ❌ | JSON |
| **E\*TRADE** | ✅ REST | ⚠️ 单点 | ✅ L1 | ✅ | ❌ | ❌ | **XML** |
| **eToro** | ✅ REST | ✅ | ❌ | ❌ | ❌ | ❌ | JSON |
| **Webull** | ✅ REST | ✅ | ❌ L1 | ❌ | ❌ | ❌ | JSON |
| **Binance** | ✅ WS | ✅ | ✅ L2 | ❌ | ❌ | ❌ | JSON |
| **OKX** | ✅ WS | ✅ | ✅ L2 | ❌ | ❌ | ❌ | JSON |
| **Bybit** | ✅ WS | ✅ | ✅ L2 | ❌ | ❌ | ❌ | JSON |
| **Bitget** | ✅ WS | ✅ | ✅ L2 | ❌ | ❌ | ❌ | JSON |
| **MT5** | ✅ WS | ✅ | ✅ L2 | ❌ | ❌ | ❌ | JSON |

### 行情覆盖率

| 维度 | 完整支持 (16/16) | 部分支持 | 不支持 |
|------|-----------------|---------|--------|
| 实时行情 | 16 / 16 | — | — |
| K线 | 15 / 16 | E\*TRADE (仅单点) | — |
| L2 深度 | 6 / 16 | — | 10 / 16 (仅 L1) |
| 期权链 | 8 / 16 | — | 8 / 16 |
| Greeks | 2 / 16 (IBKR, Schwab) | — | 14 / 16 |
| 资金流向 | 2 / 16 (富途, moomoo) | — | 14 / 16 |

---

## 三、交易接口对比

| 券商 | 市价单 | 限价单 | 止损单 | 止盈单 | OCO | 条件单 | 碎股 | 期权 | 做空 |
|------|--------|--------|--------|--------|-----|--------|------|------|------|
| **富途 Futu** | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ |
| **moomoo** | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ |
| **盈透 IBKR** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **老虎 Tiger** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **长桥 Longbridge** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| **华盛 VBKR** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **盈立 uSMART** | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Schwab** | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ |
| **E\*TRADE** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| **eToro** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Webull** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Binance** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | N/A | ❌ | ✅ |
| **OKX** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | N/A | ❌ | ✅ |
| **Bybit** | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | N/A | ❌ | ✅ |
| **Bitget** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | N/A | ❌ | ✅ |
| **MT5** | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | N/A | ❌ | ✅ |

### 交易覆盖率

| 功能 | 支持数 |
|------|--------|
| 市价/限价 | 16 / 16 (100%) |
| 止损 | 16 / 16 (100%) |
| 止盈 | 9 / 16 |
| OCO | 6 / 16 |
| 条件单 | 10 / 16 |
| 碎股 | 4 / 16 (IBKR, moomoo, 长桥, Webull) |
| 期权 | 8 / 16 |
| 做空 | 10 / 16 |

---

## 四、账户与持仓对比

| 券商 | 账户查询 | 资金查询 | 持仓查询 | 订单查询 | 交易历史 | 多账户 |
|------|---------|---------|---------|---------|---------|--------|
| **富途 Futu** | ✅ | ✅ | ✅ | ✅ | ✅ 当日 | ✅ |
| **moomoo** | ✅ | ✅ | ✅ | ✅ | ✅ 当日 | ✅ |
| **盈透 IBKR** | ✅ | ✅ | ✅ | ✅ | ✅ 全部 | ✅ |
| **老虎 Tiger** | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| **长桥 Longbridge** | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| **华盛 VBKR** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **盈立 uSMART** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Schwab** | ✅ | ✅ | ✅ | ✅ | ✅ 全部 | ✅ |
| **E\*TRADE** | ✅ | ✅ | ✅ | ✅ | ⚠️ 有限 | ✅ |
| **eToro** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Webull** | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| **Binance** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **OKX** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Bybit** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Bitget** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **MT5** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 五、市场覆盖矩阵

| 券商 | 🇺🇸美股 | 🇭🇰港股 | 🇸🇬新加坡 | 🇨🇳A股 | 🇯🇵日股 | 🇪🇺欧股 | ₿ 加密 | 💱 外汇 | 🛢️ 商品 | 📊 CFD |
|------|--------|--------|----------|-------|--------|--------|--------|--------|--------|--------|
| 富途 | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| moomoo | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| IBKR | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| 老虎 | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ⚠️计划 | ❌ | ❌ | ❌ |
| 长桥 | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ⚠️计划 | ❌ | ❌ | ❌ |
| 华盛 | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 盈立 | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Schwab | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| E\*TRADE | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| eToro | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Webull | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Binance | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| OKX | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Bybit | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Bitget | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| MT5 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |

### 市场统计

| 市场 | 支持券商 | 数量 |
|------|---------|------|
| 美股 | Futu❌, moomoo, IBKR, 老虎, 长桥, 华盛, 盈立, Schwab, E\*TRADE, eToro, Webull | 10 |
| 港股 | Futu, moomoo, IBKR, 老虎, 长桥, 华盛, 盈立 | 7 |
| 加密 | Binance, OKX, Bybit, Bitget, eToro | 5 |
| 外汇/CFD | IBKR, MT5, eToro | 3 |
| 新加坡 | IBKR, 长桥 | 2 |
| A股 | IBKR | 1 |
| 日股 | IBKR | 1 |
| 欧股 | IBKR, eToro | 2 |
| 商品 | IBKR, eToro, MT5 | 3 |

---

## 六、推送与实时数据

| 券商 | 推送方式 | 协议 | 自动重连 | 订阅粒度 | 注意事项 |
|------|---------|------|---------|---------|---------|
| **富途 Futu** | OpenD 3005 推送 | Protobuf | ✅ | 单股 | OpenD 本地必须运行 |
| **moomoo** | OpenD 3005 推送 | Protobuf | ✅ | 单股 | 同上 |
| **IBKR** | TWS Socket | 二进制 | ✅ | 单股 | Gateway 必须运行 |
| **老虎 Tiger** | Protobuf 推送 | Protobuf | ✅ | 单股 | 有推送限额 |
| **长桥 Longbridge** | WebSocket | JSON | ✅ | 批量 | 需 OAuth token |
| **华盛 VBKR** | HTTP Polling | Protobuf | N/A | 批量 | 无实时推送 |
| **盈立 uSMART** | WebSocket | JSON | ⚠️ | 单股 | 文档不详 |
| **Schwab** | Streamer WS | JSON | ⚠️ | 批量 | 需 streamerKey |
| **E\*TRADE** | ❌ 无推送 | N/A | N/A | N/A | 仅 REST polling |
| **eToro** | WebSocket | JSON | ⚠️ | 批量 | 需订阅频道 |
| **Webull** | ❌ 无推送 | N/A | N/A | N/A | 仅 REST polling |
| **Binance** | WebSocket | JSON | ✅ | 批量/单股 | 有速率限制 |
| **OKX** | WebSocket | JSON | ✅ | 批量/单股 | 需 ping/pong |
| **Bybit** | WebSocket | JSON | ✅ | 批量/单股 | V5 统一接口 |
| **Bitget** | WebSocket | JSON | ✅ | 公共频道 | 认证频道需签名 |
| **MT5** | WebSocket (socket.io) | JSON | ✅ | 批量 | metaapi-cloud 代理 |

---

## 七、特殊功能矩阵

| 功能 | 支持券商 |
|------|---------|
| **期权交易** | IBKR, 富途, moomoo, 老虎, 华盛, Schwab, E\*TRADE |
| **期权 Greeks** | IBKR, Schwab |
| **跟单交易** | eToro (CopyTrader), MT5 (CopyFactory) |
| **社交交易** | eToro (SocialSentiment) |
| **杠杆交易** | eToro, 加密四所, IBKR (保证金) |
| **期货** | IBKR, MT5, Schwab |
| **碎股** | IBKR, moomoo, 长桥, Webull |
| **IPO 申购** | 富途, moomoo, 老虎 |
| **条件单** | 富途, moomoo, IBKR, 盈立, Schwab, E\*TRADE, 加密四所, MT5 |
| **算法单** | IBKR (SmartRouting) |
| **盘前/盘后** | moomoo, IBKR, Schwab, E\*TRADE, Webull |
| **一键全停** | CrossBrokerRiskEngine.killSwitchAll (所有已连接适配器) |
| **多语言** | moomoo (英/繁/简), eToro (多语言) |

---

## 八、费率与限制

### 8.1 API 调用限制

| 券商 | 频率限制 | QPS | 日限额 | 文档 |
|------|---------|-----|--------|------|
| **富途 Futu** | OpenD 本地 | 无限制 | 无限制 | 本地 |
| **moomoo** | OpenD 本地 | 无限制 | 无限制 | 本地 |
| **IBKR** | 50 msg/s | ~5 QPS | — | [IBKR API Guide](https://interactivebrokers.github.io/) |
| **老虎 Tiger** | 按账户等级 | ~10 QPS | ~10000 | 联系商务 |
| **长桥 Longbridge** | Token Bucket | ~20 QPS | ~50000 | [Longbridge Docs](https://open.longbridge.com/) |
| **Schwab** | 滑动窗口 | 120/min | — | [Schwab Dev](https://developer.schwab.com/) |
| **E\*TRADE** | 2 req/s | ~2 QPS | — | [E\*TRADE Dev](https://developer.etrade.com/) |
| **Binance** | Weight System | 1200 weight/min | — | [Binance API](https://binance-docs.github.io/) |
| **OKX** | 10 req/2s | ~5 QPS | — | [OKX API](https://www.okx.com/docs-v5/) |
| **Bybit** | 50 req/2s | ~10 QPS | — | [Bybit API](https://bybit-exchange.github.io/) |
| **Bitget** | 20 req/2s | ~10 QPS | — | [Bitget API](https://bitgetlimited.github.io/) |
| **MT5** | metaapi-cloud | ~10 QPS | — | [MetaApi](https://metaapi.cloud/) |

### 8.2 交易费率 (参考, 以券商最新公告为准)

| 类型 | 富途 | IBKR | Schwab | E\*TRADE | eToro | 加密四所 |
|------|------|------|--------|----------|-------|---------|
| 美股佣金 | HKD 15/笔 | USD 0.005/股 | $0 | $0 | 含点差 | N/A |
| 港股佣金 | 0.03% (min HKD 3) | 0.08% | N/A | N/A | N/A | N/A |
| 期权佣金 | HKD 5/张 | USD 0.65/张 | $0.65/张 | $0.65/张 | N/A | N/A |
| 加密现货 | N/A | N/A | N/A | N/A | 含点差 | 0.1% maker |
| 外汇点差 | N/A | 0.2 pip | N/A | N/A | 含点差 | N/A |

---

## 九、Sandbox 可用性

| 券商 | Sandbox | 审批 | 功能限制 | 推荐用途 |
|------|---------|------|---------|---------|
| **富途 Futu** | OpenD Simulate | 免费 | 模拟交易 | 港股开发 |
| **moomoo** | OpenD Simulate | 免费 | 模拟交易 | 美股开发 |
| **IBKR** | TWS Paper | 免费 | 延迟15分钟 | 全功能测试 |
| **老虎 Tiger** | Demo | 申请 | 模拟账户 | 功能验证 |
| **长桥 Longbridge** | Sandbox | 申请 | 模拟交易 | 功能验证 |
| **Schwab** | ❌ **无 Sandbox** | N/A | N/A | ⚠️ 需要真实 App |
| **E\*TRADE** | ✅ **Sandbox** | 申请 | 模拟交易 | **推荐首选测试** |
| **eToro** | Demo Account | 免费注册 | 模拟交易 | 功能验证 |
| **Webull** | Paper Trading | 免费注册 | 模拟交易 | **推荐首选测试** |
| **Binance** | Testnet | 免费 | 模拟交易 | 全功能测试 |
| **OKX** | Demo | 免费 | 模拟交易 | 全功能测试 |
| **Bybit** | Testnet | 免费 | 模拟交易 | 全功能测试 |
| **Bitget** | Demo | 免费 | 模拟交易 | 全功能测试 |
| **MT5** | Demo Account | 免费 | 模拟交易 | 全功能测试 |

⚠️ **Schwab 无 Sandbox** — 开发和测试需要真实的 OAuth App 审批 (`developer.schwab.com`)，建议用 E\*TRADE Sandbox 替代测试 OAuth1.0a 流程。

---

## 十、安全审计清单

### 10.1 Token 存储审计

| 检查项 | 状态 | 实现 |
|--------|------|------|
| OAuth Token 加密存储 | ✅ 全部 | `OAuthTokenStore` (keytar + XOR fallback) |
| API Key 无硬编码 | ✅ 全部 | 从 BrokerConfig 注入, 不在源码中 |
| HTTPS 强制 | ✅ 全部 | 所有 API 端点使用 HTTPS |
| Token 自动刷新 | ✅ 全部(除 E\*TRADE 永久有效) | `OAuthBrokerBase._refreshToken()` |
| 敏感字段脱敏 | ✅ | `accountHash.slice(0,4)...` 等打码 |
| 内存安全 | ⚠️ Token 在内存中 | 运行时清理: `disconnect()` 中 `this.token = null` |

### 10.2 券商安全特性

| 券商 | IP 白名单 | 2FA | 下单确认 | 提现独立 |
|------|----------|-----|---------|---------|
| 富途 | OpenD 本地 | OpenD GUI | OpenD GUI | OpenD GUI |
| IBKR | ✅ TWS 配置 | ✅ | ✅ | ✅ |
| Binance | ✅ | ✅ | ❌ | ✅ |
| 其他 | 视券商而定 | 视券商而定 | 视券商而定 | 视券商而定 |

---

## 十一、已知问题与注意事项

### 11.1 平台级注意事项

| # | 问题 | 影响券商 | 解决方案 |
|---|------|---------|---------|
| 1 | **Schwab 无 Sandbox** | Schwab | 先申请 OAuth App → 用最小金额测试 |
| 2 | **E\*TRADE XML 格式** | E\*TRADE | 已自建 XML 解析器, 无外部依赖 |
| 3 | **E\*TRADE 无推送** | E\*TRADE | 使用 REST polling, 间隔建议 5s+ |
| 4 | **老虎/华盛/盈立 无 SDK** | 老虎, 华盛, 盈立 | 自行实现 Protobuf 协议 (BridgeAdapter) |
| 5 | **Webull Paper Only** | Webull | 生产需真实审批, 当前仅 Paper |
| 6 | **eToro 社交限制** | eToro | CopyTrader 需目标交易员可跟单 |
| 7 | **华盛无推送** | 华盛 | 使用 HTTP polling |
| 8 | **老虎 API 无 L2** | 老虎 | 仅 L1 买卖价 |
| 9 | **加密四所 WS 重连** | Binance/OKX/Bybit/Bitget | 需 ping/pong 心跳, 24h connection limit |
| 10 | **MT5 需 metaapi-cloud** | MT5 | 第三方代理, 有额外费用 |

### 11.2 开发建议

1. **测试优先级**: E\*TRADE Sandbox > Webull Paper > Binance Testnet > IBKR Paper
2. **OAuth 测试**: 用 Webull (OAuth2 最简单) → Schwab (OAuth2+PKCE) → E\*TRADE (OAuth1.0a 最复杂)
3. **生产上线**: 富途/moomoo 已有实盘经验 → IBKR (最成熟) → 逐步扩展到其他券商
4. **并发上限**: BrokerManagerV2 默认支持 20 个并发连接, 建议不超过 10 个同时进行交易

### 11.3 不可接入券商

以下券商**不接入** (无公开 API, Selenium/OCR 维护成本过高):

| 券商 | 原因 |
|------|------|
| 耀才 | 无 API |
| 富昌 | 无 API |
| Fidelity | 无公开 Trading API |
| Degiro | 无官方 API (仅有非官方 flatex) |
| Revolut Trading | 无 API |
| Trade Republic | 无 API |
| Monex | 仅日语文档, 区域限制 |
| SBI Securities | 仅日语文档, 区域限制 |
| Rakuten Securities | 仅日语文档, 区域限制 |

---

> **版本历史**: v1.0 R4 Initial | 涵盖 16 家券商全部 API 维度对比
> **相关文档**: `docs/api/broker-integration-developer-guide.md` (开发者指南)
> **参考**: `electron/broker/IBrokerAdapterV2.ts`, `electron/broker/BrokerManagerV2.ts`, `electron/broker/OAuthBrokerBase.ts`
