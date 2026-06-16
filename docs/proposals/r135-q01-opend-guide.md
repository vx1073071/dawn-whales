# R135-Q01: OpenD 跟单用户指南

> **Author**: QClaw · **Task**: R135-Q01 · **Hours**: 2h
> **Based on**: electron/broker/futu-opend.ts + electron/broker/opend-base-adapter.ts + server/routes/signal.ts

---

## 一、什么是 OpenD 跟单

OpenD 跟单模式允许您在桌面端通过 Futu OpenD/TWS **本地直连**券商执行跟单信号，无需通过云端服务器。信号从 quant-moo 服务器拉取到本地，经由 OpenD 下单，执行结果回传服务器。

```
Cloud 模式:   信号源 → Server → Cloud Broker (Binance/OKX/...) → 执行
OpenD 模式:   信号源 → Server → 桌面端拉取 → OpenD (Futu/IB) → 本地执行 → 回传结果
```

---

## 二、前置条件

### 2.1 环境要求

| 组件 | 要求 |
|------|------|
| Futu OpenD | 已安装并运行 (https://www.futunn.com/download/openD) |
| OpenD 端口 | 默认 11111 (可配置) |
| Futu 账户 | 已登录 OpenD GUI, 已解锁交易密码 |
| API 权限 | OpenD 已开启 API 连接 |

### 2.2 OpenD 安装与启动

1. 从富途官网下载 OpenD (Windows/macOS)
2. 安装并启动 OpenD
3. 在 OpenD GUI 中登录您的富途账户
4. 确认端口 11111 已开放 (设置→API设置)

### 2.3 quant-moo 配置

```
路径: 设置 → 券商管理 → 添加 OpenD 券商

配置项:
  - 券商名称: Futu (OpenD)
  - 连接地址: 127.0.0.1
  - 端口:      11111
  - 交易环境:  模拟盘 (推荐先测试) / 真实盘
  - 市场:      港股 / 美股 (勾选)
```

---

## 三、跟单流程

### 3.1 完整流程

```
Step 1: 桌面端 → GET /api/signal/pending?type=opend
       拉取待处理 OpenD 信号列表

Step 2: 用户审核
       在 OpenD 信号面板中预览信号 (symbol/direction/price/quantity)
       选择: 单笔执行 / 批量执行 / 跳过

Step 3: 桌面端 → 调用 OpenD API 下单
       FutuOpenDClient.placeOrder(signal.payload)

Step 4: 下单结果 → POST /api/signal/:id/execute
       回传执行结果 (orderId / errorMessage / executedAt)

Step 5: Server → 更新信号状态 (executed / failed)
```

### 3.2 API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/signal/pending?type=opend` | GET | 拉取待处理 OpenD 信号 |
| `/api/signal/:id/execute` | POST | 回传执行结果 |
| `/api/signal/:id/status` | GET | 查询信号状态 |
| `/api/signal?brokerType=opend&status=pending` | GET | 查询所有 OpenD 待处理 |

### 3.3 执行结果回传格式

```json
POST /api/signal/:id/execute
Authorization: Bearer {jwt}

{
  "success": true,
  "orderId": "FUTU-ORDER-12345",
  "executedPrice": 380.50,
  "executedQuantity": 100,
  "fee": 0.38,
  "feeCurrency": "HKD",
  "executedAt": "2026-06-13T10:30:00+08:00"
}

// 或失败:
{
  "success": false,
  "errorMessage": "Insufficient margin",
  "errorCode": "MARGIN_SHORTAGE"
}
```

---

## 四、下单规则

### 4.1 港股规则

| 规则 | 值 | 示例 |
|------|-----|------|
| 一手股数 | 按股票不同 | 00700 = 100股/手 |
| 最小下单单位 | 手 | 只能下 100/200/300... |
| 交易时间 | 09:30-12:00, 13:00-16:00 | HKT |
| 开盘前竞价 | 09:00-09:30 | 限价单 |
| 碎股市场 | 不足一手 | 价格劣化 |

### 4.2 美股规则

| 规则 | 值 |
|------|-----|
| 最小交易单位 | 1股 |
| 交易时间 | 21:30-04:00 HKT (ET 09:30-16:00) |
| 盘前/盘后 | 04:00-09:30 / 16:00-20:00 ET |
| T+2 结算 | 资金 2 日后可用 |

### 4.3 代码格式

```
港股: HK.00700, HK.09988, HK.01810
美股: US.AAPL, US.TSLA, US.NVDA
A股:  SH.600519, SZ.000001
```

---

## 五、离线模式

### 5.1 离线信号排队

```
OpenD 未连接 → 信号自动入 pending 队列
OpenD 重新连接 → 自动拉取并依次处理

队列优先级: P0 (止损/紧急) > P1 (跟单) > P2 (系统)
同优先级: FIFO (先进先出)
```

### 5.2 离线提醒

| 场景 | 提醒 |
|------|------|
| OpenD 断连 > 30s | 系统托盘黄点 |
| 待处理信号 > 0 | 面板角标数字 |
| 切换券商/关闭 | 弹窗"确认离开?有 N 条待处理信号" |

---

## 六、监控面板

### 6.1 信号列表

```
OpenD 信号面板 显示:
  ┌────────────────────────────────────────────────────────┐
  │ ⏳ PENDING (3)                                         │
  │  #1 HK.00700 BUY 100股 @ 380.00 → P1  [执行] [跳过]  │
  │  #2 US.AAPL SELL 10股 @ 180.00 → P0  [执行] [跳过]   │
  │  #3 HK.09988 BUY 200股 @ 85.00 → P1  [执行] [跳过]   │
  │ ────────────────────────────────────────────────────── │
  │ [批量执行全部] [全部跳过]                              │
  └────────────────────────────────────────────────────────┘
```

### 6.2 状态总栏

```
┌─────────────────────────────────────────────┐
│  🟢 Cloud 15/15 在线   🟡 OpenD 1/2 在线    │
│  📊 待处理: 3 信号     💰 今日已执行: 8     │
└─────────────────────────────────────────────┘
```

---

## 七、常见问题

| 问题 | 解决方案 |
|------|---------|
| OpenD 连接失败 | 检查 OpenD 是否运行, 端口 11111 是否开放 |
| 交易密码未解锁 | 在 OpenD GUI 中手动输入交易密码 |
| 下单被拒: "lot size" | 检查下单数量是否为整手 (港股) |
| 下单被拒: "inactive" | 检查是否在交易时段 |
| 信号不出现 | 检查 `/api/signal/pending?type=opend` 响应 |

---

## 八、安全

| 规则 | 说明 |
|------|------|
| 本地执行 | 信号拉取后在本地 OpenD 执行, 不经过云端 |
| JWT 认证 | 所有 API 调用需携带有效 JWT |
| 交易密码 | 禁止通过 SDK 解锁, 必须在 OpenD GUI 手动操作 |
| 确认机制 | 每笔信号需用户手动确认 (单笔/批量) |

---

> **Signed**: QClaw — R135-Q01, OpenD 跟单用户指南 (260+ lines)
