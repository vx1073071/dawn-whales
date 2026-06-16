# quant-moo 双模跟单架构设计

> **方案**: A1(服务器Cloud) + A3(桌面端Local) 混合
> **作者**: PM(Claw) | **日期**: 2026-06-13 02:47 HKT
> **版本**: v2.1-dev | **状态**: ✅ 设计方案完成，待开发

---

## 一、为什么需要双模

### 桌面端单一架构的死穴

```
用户离线 → 桌面端关闭 → 信号丢失 → 跟单停止
```

跟单信号要求 **7×24 在线**，桌面端做不到。但富途/moomoo 的 OpenD 又是本地网关，远程服务器无法直接调。

### 解决方案：按券商类型分两路。A2(VPS托管OpenD)已放弃。

```
Cloud API 券商 (15家)          Local OpenD 券商 (2家)
──────────────────────         ──────────────────────
Binance      IB                富途 OpenD ← 仅桌面端在线
OKX          老虎              moomoo OpenD ← 仅桌面端在线
Bybit        Schwab
Bitget       E*TRADE
Robinhood    eToro
MT5          华盛/盈立/微牛/长桥

    ↓ 服务器 24h 跑               ↓ 桌面端在线时跑
```

---

## 二、总体架构

```
                        ┌──────────────────────────┐
                        │      quant-moo 服务器     │
                        │                          │
   信号源 ─────────────→│  信号接收 & 存储 (SQLite)  │
   (创作者桌面端)       │                          │
                        │  跟单引擎 (24h)           │
                        │  ├─ 12家Cloud适配器       │
                        │  ├─ 用户API Key加密存储    │
                        │  ├─ 信号队列 + 重试       │
                        │  └─ 费率计算 + 积分扣费   │
                        │                          │
                        │  REST API (/api/*)        │
                        └──────┬───────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
        ▼                      ▼                      ▼
   ┌─────────┐          ┌──────────┐           ┌──────────┐
   │ Binance  │          │  OKX API  │           │  IB TWS   │
   │ REST+WS  │          │  REST+WS  │           │  Gateway  │
   └─────────┘          └──────────┘           └──────────┘
       12家 Cloud API (服务器直连)


   ┌─────────────────────────────────────────────────┐
   │              quant-moo 桌面端                  │
   │                                                 │
   │   ┌──────────────┐      ┌───────────────────┐  │
   │   │ 富途 OpenD    │      │ moomoo OpenD       │  │
   │   │ (本机:11111)  │      │ (本机:11112)        │  │
   │   └──────┬───────┘      └────────┬──────────┘  │
   │          │                       │              │
   │   ┌──────┴───────────────────────┴──────────┐  │
   │   │   桌面端跟单引擎 (仅在线时运行)          │  │
   │   │   ├─ 信号接收 (从服务器拉)              │  │
   │   │   ├─ OpenD 本地下单                     │  │
   │   │   └─ 状态回传服务器                     │  │
   │   └─────────────────────────────────────────┘  │
   │                                                 │
   │   ┌──────────────────────────────────────────┐ │
   │   │   12家 Cloud 券商: 查看+管理 (只读)      │ │
   │   │   服务器端执行, 桌面端仅看结果            │ │
   │   └──────────────────────────────────────────┘ │
   └─────────────────────────────────────────────────┘
```

---

## 三、数据流

### 3.1 Cloud 券商跟单 (服务器 24h)

```
信号源(桌面端) → 发布信号 → POST /api/signal
                              ↓
服务器:
  ├─ 信号队列 (FIFO, 按provider+symbol分组)
  ├─ 查找所有跟单该信号的用户
  ├─ 解密用户券商API Key (AES-256-GCM)
  ├─ 调券商API下单 (Binance/OKX/IB...)
  ├─ 记录交易历史
  └─ 通知用户 (WebSocket push → 桌面端)
                              ↓
用户(离线):
  ├─ 信号已执行 ✅
  └─ 下次打开桌面端 → 看到历史交易记录
```

### 3.2 OpenD 券商跟单 (桌面端在线时)

```
服务器 → 信号队列 → 标记 "OpenD only" 信号
                        ↓
用户桌面端在线:
  ├─ 拉取未执行的 OpenD 信号 GET /api/signals/pending?broker=futu
  ├─ 本地 OpenD 下单
  ├─ 回传执行结果 POST /api/signal/{id}/execute
  └─ 状态同步

用户桌面端离线:
  ├─ 信号在队列中等待
  └─ 下次上线 → 拉取历史信号 → 用户决定是否追单
```

---

## 四、核心模块

### 4.1 服务器端新增

```
server/
├── src/
│   ├── signal/
│   │   ├── signal-receiver.ts      # 接收信号 (REST endpoint)
│   │   ├── signal-queue.ts         # 信号队列 (按券商分组)
│   │   ├── copy-trade-engine.ts    # 跟单执行引擎
│   │   └── signal-persistence.ts   # 信号持久化 (SQLite)
│   ├── broker/
│   │   ├── cloud-adapters/         # 12家Cloud API适配器
│   │   │   ├── binance.ts
│   │   │   ├── okx.ts
│   │   │   ├── ib.ts
│   │   │   └── ...
│   │   └── adapter-factory.ts      # 适配器工厂
│   ├── auth/
│   │   ├── user-api-keys.ts        # API Key加密存储
│   │   ├── encryption.ts           # AES-256-GCM
│   │   └── oauth-server.ts         # OAuth2 授权流程
│   └── api/
│       ├── routes/signal.ts        # /api/signal/*
│       ├── routes/copy-trade.ts    # /api/copytrade/*
│       └── routes/opend.ts         # /api/opend/signals (桌面端拉取)
└── db/
    ├── signals.sqlite              # 信号存储
    └── api-keys.sqlite             # 加密API Key (独立加密DB)
```

### 4.2 桌面端新增

```
src/
├── lib/
│   ├── server-signal-client.ts     # 连接服务器拉取OpenD信号
│   └── opend-copy-trader.ts        # 本地OpenD跟单执行器
├── components/
│   ├── signal/
│   │   ├── CopyTradeStatusBar.tsx  # 跟单状态栏
│   │   ├── OpenDSignalPanel.tsx    # OpenD待处理信号面板
│   │   └── CloudCopyTradePanel.tsx # Cloud跟单查看面板
```

### 4.3 信号队列设计

```
信号优先级:
  P0: 止损/割肉信号 → 立即执行
  P1: 常规交易信号 → FIFO队列
  P2: 分析/提醒信号 → 仅推送不执行

队列结构:
  cloud_queue:     [signal_1, signal_2, ...]  ← 服务器立即执行
  opend_queue:     [signal_3, signal_4, ...]  ← 等桌面端拉取
  
重试机制:
  Cloud:  失败 → 30s/1min/5min 指数退避 → 最多3次
  OpenD:  桌面端离线 → 队列保留 → 上线后推送 → 用户决定
```

---

## 五、API Key 安全存储

```
用户提交 API Key:
  ├─ 桌面端 → POST /api/user/broker-config
  │   加密: AES-256-GCM(brokerConfig, masterKey)
  │   存储: api-keys.sqlite (独立文件, 600权限)
  │
  ├─ 跟单引擎读取:
  │   解密 → 调券商API → 用完立即清除内存
  │
  └─ 安全措施:
       ├─ 数据库密码独立 (非代码硬编码)
       ├─ 审计日志: 每次解密/使用记录时间戳
       └─ 用户可随时撤销授权 (DELETE + 密钥轮换)
```

---

## 六、用户体验

### 6.1 用户连接券商时

```
┌────────────────────────────────────┐
│  连接券商                           │
│                                    │
│  币安 ──────── Cloud API ──── ✅   │
│  跟单模式: 服务器24h自动执行         │
│  [配置API Key]                     │
│                                    │
│  富途 ──────── OpenD ─────── ⚠️   │
│  跟单模式: 仅桌面端在线时可用        │
│  💡 建议自建VPS运行OpenD获得24h跟单  │
│  [配置OpenD]                       │
└────────────────────────────────────┘
```

### 6.2 状态栏

```
┌──────────────────────────────────────────────┐
│ 🟢 Cloud跟单 (12家在线)   │  🟡 富途 (在线)  │
│   运行中 (24h)           │   待处理: 2信号   │
│                          │  ⚠️ 离线将暂停    │
└──────────────────────────────────────────────┘
```

---

## 七、券商支持矩阵

| 券商 | 类型 | 跟单模式 | 离线跟单 | 说明 |
|------|------|---------|---------|------|
| Binance | Cloud | 服务器 | ✅ | 24h |
| OKX | Cloud | 服务器 | ✅ | 24h |
| Bybit | Cloud | 服务器 | ✅ | 24h |
| Bitget | Cloud | 服务器 | ✅ | 24h |
| Robinhood | Cloud | 服务器 | ✅ | 24h |
| IB | Cloud | 服务器 | ✅ | TWS Gateway可远程 |
| 老虎 | Cloud | 服务器 | ✅ | TigerSDK云API |
| Schwab | Cloud | 服务器 | ✅ | 24h |
| E*TRADE | Cloud | 服务器 | ✅ | 24h |
| eToro | Cloud | 服务器 | ✅ | 24h |
| MT5 | Cloud | 服务器 | ✅ | MetaApi |
| 华盛 | Cloud | 服务器 | ✅ | VBKR API |
| 盈立 | Cloud | 服务器 | ✅ | uSMART API |
| 微牛 | Cloud | 服务器 | ✅ | WebullSDK |
| 长桥 | Cloud | 服务器 | ✅ | LongbridgeSDK |
| **富途** | **OpenD** | **桌面端** | **❌** | 需自建VPS |
| **moomoo** | **OpenD** | **桌面端** | **❌** | 需自建VPS |

> 15/17 家支持服务器 24h 跟单。仅富途/moomoo需要本地OpenD。

---

## 八、分阶段实施

| 阶段 | 轮次 | 工时 | 内容 |
|------|------|------|------|
| Phase 1 | R129-R130 | 4d | 服务器基础: Express+SQLite+JWT + API Key加密存储 |
| Phase 2 | R131-R132 | 5d | 5家加密交易所Cloud适配器 (Binance/OKX/Bybit/Bitget/RH) |
| Phase 3 | R133-R134 | 5d | 跟单引擎核心: 信号队列+执行+重试+通知 |
| Phase 4 | R135-R136 | 5d | 美股券商Cloud适配器 (IB/Tiger/Schwab/E*TRADE/eToro) |
| Phase 5 | R137-R138 | 4d | 桌面端OpenD信号拉取+回传 + 服务器部署上线 |
| **合计** | **8轮** | **~23d** | **~190h** |

---

*设计完成: 2026-06-13 02:47 HKT | PM(Claw)*
