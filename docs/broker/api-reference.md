# 多券商 API 参考手册 — 15家对比

> R3 DOC-02 | 版本 1.0 | 2026-06-12 | 作者: youdao

---

## 概览速查

| 券商 | BrokerType | 市场 | 继承基类 | 协议 | 认证 | 本地网关 | 实时推送 | 期权 |
|------|-----------|------|---------|------|------|---------|---------|------|
| 富途 Futu | futu | HK/US/CN | OpenDBaseAdapter | Protobuf/TCP | Futu ID+RSA | ✅ OpenD | ✅ proto 3005 | ✅ |
| moomoo | moomoo | SG/US/AU | OpenDBaseAdapter | Protobuf/TCP | Futu ID | ✅ OpenD | ✅ proto 3005 | ✅ |
| 盈透 IB | ib | 150+市场 | 直接实现 | Proprietary TCP | 用户名/密码 | ✅ IB Gateway | ✅ TWS stream | ✅ |
| 长桥 Longbridge | longbridge | HK/US/SG/CN | 直接实现 | REST+JSON | OAuth2+JWT | ❌ | ✅ WS JSON | — |
| 老虎 Tiger | tiger | HK/US/SG/CN | BridgeAdapter | Protobuf/HTTP | 私钥签名 | ✅ | ✅ PushClient WS | ✅ |
| 华盛 VBKR | vbkr | HK/US | BridgeAdapter | Protobuf/HTTP | Token/Session | ✅ | ✅ Protobuf推送 | ✅ |
| 盈立 uSMART | usmart | HK/US | BridgeAdapter | REST | API Key+Secret | ✅ | ✅ 推送 | ⚠️ |
| 币安 Binance | binance | Crypto | CryptoAdapterBase | REST+WS | HMAC-SHA256 | ❌ | ✅ WS stream | ✅ |
| OKX | okx | Crypto | CryptoAdapterBase | REST+WS | HMAC+OK-ACCESS | ❌ | ✅ WS public | ✅ |
| Bybit | bybit | Crypto | CryptoAdapterBase | REST+WS | HMAC-SHA256 | ❌ | ✅ WS public | ✅ |
| Bitget | bitget | Crypto | CryptoAdapterBase | REST+WS | HMAC-SHA256 | ❌ | ✅ WS public | — |
| Robinhood | robinhood | Crypto | CryptoAdapterBase | REST | ED25519 | ❌ | ❌ (polling) | — |
| Schwab | schwab | US | OAuthBrokerBase | REST+WS | OAuth2 PKCE | ❌ | ✅ WS streamer | ✅ |
| E*TRADE | etrade | US | OAuthBrokerBase | REST | OAuth1.0a | ❌ | ⚠️ 流式 | ✅ |
| eToro | etoro | Global | OAuthBrokerBase | REST+WS | OAuth2 | ❌ | ✅ WS | — |
| Webull | webull | US | OAuthBrokerBase | REST+WS | OAuth2 | ❌ | ✅ WS | ⚠️ |
| MT5 | mt5 | 全市场 | 直接实现 | REST+WS(socket.io) | auth-token | ❌ MetaApi | ✅ socket.io | — |

---

## 行情 API

| 券商 | Quote端点 | Kline端点 | Ticker推送 | 批量支持 | 深度 | 延迟 |
|------|----------|----------|-----------|---------|------|------|
| 富途 | protoID 3004 QotGetBasicQot | protoID 3006 QotGetKL | protoID 3005推送 | ✅ 批量 | 摆盘 | 实时(LV2付费) |
| moomoo | 同富途 | 同富途 | 同富途 | ✅ | 摆盘 | 实时 |
| 盈透 | reqMktData() | reqHistoricalData() | tickPrice/tickSize | ✅ | ✅ 深度 | 实时(订阅) |
| 长桥 | GET /v1/quote/quote | GET /v1/quote/kline | WS推送 | ✅ symbols= | — | 实时 |
| 老虎 | SDK quoteClient | SDK barClient | PushClient WS | ✅ | ✅ | 实时(付费) |
| 华盛 | Protobuf QuoteSub | Protobuf KLSub | Protobuf QuotePush | ✅ | — | 实时 |
| 盈立 | REST /market/quote | REST /market/kline | 推送 | ✅ | — | 15min(免费)/实时 |
| 币安 | GET /api/v3/ticker/price | GET /api/v3/klines | WS stream | ✅ symbols=[] | ✅ /depth | 实时 |
| OKX | GET /market/ticker | GET /market/candles | WS public | ✅ instId= | ✅ /books | 实时 |
| Bybit | GET /v5/market/tickers | GET /v5/market/kline | WS public | ✅ symbol= | ✅ orderbook | 实时 |
| Bitget | GET /api/v2/market/tickers | GET /api/v2/market/candles | WS public | ✅ symbol= | ✅ depth | 实时 |
| RHCrypto | GET /marketdata/best_bid_ask | ❌ 无K线 | ❌ 需polling | ⚠️ pairs= | — | 实时 |
| Schwab | GET /marketdata/v1/quotes | GET /marketdata/v1/pricehistory | WS streamer | ✅ symbols= | — | 实时(订阅) |
| E*TRADE | GET /v1/market/quote | GET /v1/market/optionexpiredate | ⚠️ 流式 | ✅ | ✅ 期权链 | 15min(免费)/实时 |
| eToro | REST /market | REST /market/candles | WS推送 | ✅ | — | 实时 |
| Webull | REST quote | REST kline | WS推送 | ✅ | ✅ L2 | 实时(Basic免费) |
| MT5 | MetaApi symbol/price | MetaApi candles | socket.io推送 | ✅ | — | 实时 |

---

## 交易 API

| 券商 | 下单端点 | 订单类型 | 撤单 | 改单 | OCO | 止损止盈 | 条件单 |
|------|---------|---------|------|------|-----|---------|--------|
| 富途 | protoID 2202 TrdPlaceOrder | MARKET/LIMIT/STOP/STOP_LIMIT | ✅ 2205 | ✅ modify | ✅ | ✅ | ✅ |
| 盈透 | placeOrder() | MKT/LMT/STP/STPLMT/TRAIL/REL | ✅ | ✅ | ✅ | ✅ | ✅ |
| 长桥 | POST /v1/trade/order | MARKET/LIMIT/STOP/STOP_LIMIT | ✅ DELETE | ❌ | — | ✅ | — |
| 老虎 | SDK place_order | MARKET/LIMIT/STOP/TRAIL | ✅ | ✅ | ✅ | ✅ | ✅ |
| 华盛 | POST order | MARKET/LIMIT/STOP | ✅ | — | — | ✅ | — |
| 盈立 | REST /trade/order | MARKET/LIMIT | ✅ | — | — | ⚠️ | ⚠️ |
| 币安 | POST /api/v3/order | MARKET/LIMIT/STOP_LOSS/TAKE_PROFIT/LIMIT_MAKER | ✅ DELETE | ❌(cancel+new) | ✅ OCO | ✅ | ✅ |
| OKX | POST /trade/order | MARKET/LIMIT | ✅ /cancel | ✅ amend | ✅ algo | ✅ | ✅ |
| Bybit | POST /v5/order/create | MARKET/LIMIT | ✅ /cancel | ✅ amend | — | ✅ | ✅ |
| Bitget | POST /api/v2/trade/order | MARKET/LIMIT | ✅ /cancel | — | — | ✅ | ✅ plan |
| RHCrypto | POST /orders/ | MARKET/LIMIT | ✅ DELETE | ❌ | — | — | — |
| Schwab | POST /trader/v1/accounts/{}/orders | MARKET/LIMIT/STOP/STOP_LIMIT/TRAIL | ✅ DELETE | ✅ replace | ✅ OCO | ✅ | ✅ |
| E*TRADE | POST /v1/accounts/{}/orders/place | MARKET/LIMIT/STOP/STOP_LIMIT | ✅ cancel | ✅ preview | ✅ | ✅ | ✅ |
| eToro | POST orders | MARKET/LIMIT/STOP/TAKE_PROFIT | ✅ DELETE | ✅ | — | ✅ | ✅ |
| Webull | POST order | MARKET/LIMIT/STOP/STOP_LIMIT | ✅ cancel | ✅ modify | ✅ | ✅ | ✅ |
| MT5 | MetaApi trade | MARKET/LIMIT/STOP/STOP_LIMIT | ✅ close | ✅ modify | — | ✅ SL/TP | ✅ pending |

---

## 账户 API

| 券商 | 账户列表 | 资金查询 | 持仓查询 | 订单查询 | 历史成交 | 保证金 |
|------|---------|---------|---------|---------|---------|--------|
| 富途 | proto 2001 GetAccList | proto 2101 GetFunds | proto 2102 GetPositions | proto 2201 GetOrders | 2203 DealList | ✅ |
| 盈透 | reqAccountUpdates() | reqAccountUpdates() | reqPositions() | reqOpenOrders() | reqExecutions() | ✅ |
| 长桥 | GET /v1/trade/account | GET /balance | GET /positions | GET /orders | GET /orders?history | — |
| 老虎 | SDK get_accounts | SDK get_assets | SDK get_positions | SDK get_orders | ✅ | ✅ |
| 华盛 | Protobuf AccSub | Protobuf FundsSub | Protobuf PosSub | Protobuf OrdSub | ✅ | — |
| 盈立 | REST /account | REST /account/balance | REST /account/positions | REST /account/orders | — | — |
| 币安 | GET /api/v3/account | 同account.balances | 同account(spot无持仓) | GET /openOrders | GET /myTrades | ✅ futures |
| OKX | GET /account/balance | 同 | GET /account/positions | GET /orders-history | GET /fills | ✅ |
| Bybit | GET /v5/account/wallet | 同 | GET /v5/position/list | GET /v5/order/realtime | GET /v5/execution/list | ✅ |
| Bitget | GET /api/v2/account/assets | 同 | GET /api/v2/account/positions | GET /api/v2/account/orders | GET fills | ✅ |
| RHCrypto | GET /accounts/ | 同 | GET /holdings/ | GET /orders/ | — | — |
| Schwab | GET /trader/v1/accounts | 同含balance | 同含positions | GET /orders | GET /transactions | ✅ |
| E*TRADE | GET /v1/accounts/list | GET /balance | GET /portfolio | GET /orders | — | ✅ |
| eToro | GET /accounts | GET /balance | GET /positions | GET /orders | GET /history | ⚠️ |
| Webull | GET account | GET account/balance | GET positions | GET orders | GET trades | ⚠️ |
| MT5 | MetaApi account | 同 | MetaApi positions | MetaApi orders | MetaApi history | ✅ |

---

## 认证与限流

| 券商 | 认证方式 | 签名算法 | Token管理 | 沙盒环境 | 速率限制 |
|------|---------|---------|----------|---------|---------|
| 富途 | Futu ID + RSA | RSA 签名 | OpenD登录 | ❌ | 连接数限制 |
| moomoo | Futu ID | RSA | OpenD登录 | ❌ | 同富途 |
| 盈透 | 用户名/密码 | — | TWS/Gateway登录 | ✅ Demo | pacing ~1req/s |
| 长桥 | OAuth2 | JWT签名 | access+refresh | ✅ | ~30req/s |
| 老虎 | 私钥签名 | tiger_id+private_key | 持久连接 | ✅ | ~10req/s |
| 华盛 | Token/Session | — | Session管理 | — | — |
| 盈立 | API Key+Secret | — | Key管理 | — | — |
| 币安 | API Key+Secret | HMAC-SHA256 | — | ✅ Testnet | 1200req/min |
| OKX | API Key+Secret+Pass | HMAC-SHA256/Ed25519 | — | ✅ Demo | 60req/2s |
| Bybit | API Key+Secret | HMAC-SHA256 | — | ✅ Testnet | 50req/s |
| Bitget | API Key+Secret+Pass | HMAC-SHA256 | — | ✅ | 20req/s |
| RHCrypto | API Key | ED25519签名 | — | ❌ | 100req/min |
| Schwab | OAuth2 PKCE | Bearer Token | access 30min/refresh 7d | ❌(需Sandbox App) | 120req/min |
| E*TRADE | OAuth1.0a | OAuth1签名 | consumer token+secret | ✅ Sandbox | 4req/s |
| eToro | OAuth2 | Bearer Token | 独立Token/Agent Portfolio | ✅ Simulated | — |
| Webull | OAuth2 | Bearer Token | access+refresh | ✅ Paper | — |
| MT5 | auth-token | — | MetaApi token | ✅ | 按MetaApi计划 |

---

## 特色功能

| 券商 | 独有特色 |
|------|---------|
| 富途 | 港股LV2(付费), 经纪商队列, 资金流向, 最多1000只订阅 |
| moomoo | 新加波主力, 多币种(SGD/USD/HKD) |
| 盈透 | 150+市场全球最全, 期权/期货/外汇/债券/CFD全品类 |
| 长桥 | OAuth2认证简单, 免费LV1行情, 竞品无此优势 |
| 老虎 | TS SDK(Beta), 财务数据(财报/估值), Python生态好 |
| 华盛 | 港股打新特色, 与长桥同母公司(可复用API) |
| 盈立 | REST简单, 门槛低, Demo参考代码 |
| 币安 | 最全加密货币, Spot+Futures+Options, FIX API |
| OKX | V5统一API, 现货+合约+期权一套接口, Web3钱包API |
| Bybit | UTA统一账户, 合约交易量大, 永续最强 |
| Bitget | 跟单交易特色, 策略交易 |
| RHCrypto | 合规Crypto交易(美国), 与Robinhood账户整合 |
| Schwab | 期权链, OCO单, 免佣金美股 |
| E*TRADE | OAuth1传统但不难, 强大期权和预警 |
| eToro | Agent Portfolio, 社交跟单, 模拟+真实双模式 |
| Webull | 美股Paper, 免费L2行情(限时), 社区活跃 |
| MT5 | MetaApi覆盖所有MT5经纪商(数千家), CopyFactory跟单 |

---

## 限制与注意事项

| 券商 | 主要限制 |
|------|---------|
| 富途 | OpenD必须本地运行, 资产门槛, 非线程安全 |
| moomoo | 同富途限制, 新加波用户为主 |
| 盈透 | 历史数据pacing(10s/req), 实时行情需订阅费用 |
| 长桥 | 暂未获取完整API权限确认, npm包兼容性待验证 |
| 老虎 | TS SDK Beta不稳定, HTTP fallback性能差 |
| 华盛 | 无TS SDK, Protobuf反向工程, 开发难 |
| 盈立 | API文档有限, 部分功能需确认可用性 |
| 币安 | 费率限制, 部分地区受限(US/CN) |
| OKX | OK-ACCESS-PASSPHRASE额外字段 |
| Bybit | 仅支持UTA统一账户, 标准账户不兼容V5 |
| Bitget | API变更频繁, 文档可能有延迟 |
| RHCrypto | 仅Crypto, 无K线/无推送, 需polling替代 |
| Schwab | 无Sandbox, OAuth App需审批 |
| E*TRADE | OAuth1.0a实现复杂, 文档较旧 |
| eToro | 功能有限(无期权/期货), 限部分市场 |
| Webull | 仅美股, API权限需申请 |
| MT5 | 需要第三方MetaApi服务(付费) |

---

## 代码格式映射

| 格式 | 富途/moomoo | 长桥 | 币安 | 标准代码 |
|------|------------|------|------|---------|
| Apple | US.AAPL | AAPL.US | — | AAPL.US |
| Tencent | HK.00700 | 700.HK | — | 700.HK |
| Bitcoin | — | — | BTCUSDT | BTC-USDT |
| Ethereum | — | — | ETHUSDT | ETH-USDT |

CodeNormalizer 自动处理所有格式互转。

---

*手册版本: 1.0 | 最后更新: 2026-06-12 | 作者: youdao (R3 DOC-02)*
