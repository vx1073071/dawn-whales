# quant-moo 券商+行情系统独立审查报告 v1.0

> 审查人: youdao | 日期: 2026-06-12 | 提交: PM(Claw/64001)

---

## 审查范围

- `electron/broker/` (17 files, ~250KB) — 券商适配器+管理
- `electron/engine/broker/adapters/` (5 files) — 加密适配器
- `src/lib/chart/` (30 files, ~350KB) — 行情引擎+图表
- `tests/` (12 files, 185 tests) — 测试覆盖
- `docs/` (5 files) — 文档

---

## 一、🔴 严重问题 (必须修复)

### 1.1 BrokerManagerV2 存在 13 个 TODO — 核心功能未完成

**位置**: `electron/broker/BrokerManagerV2.ts`

问题: 聚合查询、重连逻辑、健康检查存在大量 TODO 标记，影响生产可用性。

建议:
- 逐项分配 TODOs 给 JVS，不完成的标记为 `UNIMPLEMENTED` 并抛出明确错误
- 健康检查当前仅 ping V2 adapters，V1 adapters 无任何检查

### 1.2 opend-base-adapter 存在 26 个 TODO

**位置**: `electron/broker/opend-base-adapter.ts` (52KB, 全项目最大文件)

问题: 连接管理、mock降级、protobuf解析都存在未完成标记。这是整个Futu/moomoo生态的地基。

建议:
- 拆分此文件为 3 个文件: `opend-connection.ts` / `opend-protobuf.ts` / `opend-mock.ts`
- 每个 TODO 明确负责人和死线

### 1.3 代码格式映射不完整

**位置**: `electron/broker/CodeNormalizer.ts`

| 格式 | Futu/moomoo | Longbridge | Binance | 标准 |
|------|------------|------------|---------|------|
| Apple | US.AAPL | AAPL.US | — | AAPL.US |
| Tencent | HK.00700 | 700.HK | — | 700.HK |
| Bitcoin | — | — | BTCUSDT | ? |
| 盈透格式 | AAPL(STK/SMART/USD) | — | — | ? |

问题: IB 使用 `AAPL STK SMART USD` 格式，合约映射未见于 CodeNormalizer。这会掉所有 IB 相关的跨券商对比。

建议: 添加 IB contract 格式的 normalize/denormalize

### 1.4 BinanceAdapter 等 4 家 crypto 适配器缺少 getDepth/getOrderBook 方法

**位置**: `electron/engine/broker/adapters/binance-adapter.ts` (及 okx/bybit/bitget)

问题: IBrokerAdapterV2 定义了 getOrderBook/getDepth，但 4 家 crypto adapter 无实现。
JVS 的深度引擎需要这些方法。

建议: 添加 getOrderBook 到所有 4 家 crypto adapter

---

## 二、🟡 中等问题 (建议修复)

### 2.1 MoomooAdapter 有语法残留

**位置**: `electron/broker/moomoo-adapter.ts` L26

已在本日修复，但 agent-account 目录的旧版可能仍有问题。

### 2.2 BrokerConfig.apiKey/secretKey 明文存储

**位置**: `electron/broker/IBrokerAdapterV2.ts`

SEC-03 审计已发现此问题。BrokerConfig 包含明文字段，通过 JSON 序列化时密钥暴露。

建议: 改为 `keyId` 引用 → `OAuthTokenStore.getToken(keyId)` 模式

### 2.3 长桥代码格式与 CodeNormalizer 不一致

**位置**: `electron/broker/longbridge-adapter.ts` vs `CodeNormalizer.ts`

长桥 adapter 使用 `AAPL.US` 格式，但 openD 生态的代码使用 `US.AAPL`。
CodeNormalizer 已定义映射但 adapter 未使用。

建议: LongbridgeAdapter 所有 getQuotes/getKlines 返回前调用 CodeNormalizer

### 2.4 测试文件中 mock 数据重复定义

**位置**: `tests/chart/r114-*` 和 `tests/chart/r115-*`

6 个测试文件各自定义了 helper 函数 (makeBars/generateDepth)，
多处重复代码。

建议: 提取到 `tests/chart/test-helpers.ts` 共享模块

### 2.5 缺少 IB adapter V2 升级

**位置**: `electron/broker/ib-adapter.ts` (74KB!)

最大文件中有 15 个 TODO 标记。IB adapter 未升级到 `IBrokerAdapterV2`，
不支持 Tagged 类型、getOrderBook、getTickData 等。

建议: 升级 IB adapter 到 V2，拆分 74KB 文件

---

## 三、🟢 完善建议 (人类UX优化)

### 3.1 🔥 人类视角: 券商选择逻辑不符合实际使用

**当前行为**: BrokerManagerV2 尝试连接所有已配置券商

**问题**: 普通用户可能只用了 2-3 家券商，但系统尝试连接全部。
大量未使用的券商连接浪费资源。

**建议**:
- 默认仅连接 `enabled: true` 的券商
- 首次使用时引导用户添加券商 (连接向导)
- 已实现: UX-03 连接向导 — 确认为 P1

### 3.2 🔥 人类视角: 行情数据过多，无过滤机制

**当前行为**: QuoteAggregator 聚合所有券商的所有行情

**问题**: 用户只看自己关注的股票，但系统推送全市场数据。
500+ 标的行情对普通人类没意义。

**建议**:
- 新增 `FocusedWatchlist` 概念 (持仓+自选)
- 仅推送 FocusedWatchlist 中的标的实时行情
- 非聚焦标的使用延迟/按需获取
- 已部分实现: QuoteCache + Smart Throttling

### 3.3 🔥 人类视角: 券商断线无可用提示

**当前行为**: BrokerManagerV2 断开时仅 log，无用户通知

**问题**: 人类用户看不到底层 log。券商断线后行情/持仓/下单全部静默失败。

**建议**:
- 前端状态指示灯 (綠/黃/紅/灰) — 已定义但未接入 UI
- 断线 Toast 通知: [老虎证券] 已断开，自动重连中...
- 延迟超过 5s 显示警告，超过 60s 显示错误

### 3.4 人类视角: 聚合持仓 PnL 按本币展示

**已定义**: UX-01 按市场分组 (UX-01 已由 ML 完成)

**验收**: 确认港股显示 HKD，不强制转换为 USD

### 3.5 人类视角: 下单必须显示券商名

**已定义**: UX-02 显式下单确认

**验收**: 按钮文字为 `确认下单到 [老虎证券]` 而非 `确认`

### 3.6 人类视角: 券商健康度可视

**已定义**: UX-03 连接向导中有健康度灯

**建议**: 健康度不只是 connected/disconnected，应包含:
- 延迟 (P50/P99)
- 错误率
- 最后成功时间
- 这些数据已在 `BrokerConnectionStatus` 中

---

## 四、🔵 架构打磨

### 4.1 文件过分庞大

| 文件 | 大小 | 建议 |
|------|------|------|
| ib-adapter.ts | 74KB | 拆分为 ib-connection.ts / ib-market.ts / ib-trading.ts / ib-account.ts |
| opend-base-adapter.ts | 52KB | 拆分为 connection/protobuf/mock 三元组 |
| pattern-recognition.ts | 49KB | 按形态类别拆分 (bullish.ts / bearish.ts / candlestick.ts) |
| unified-account-manager.ts | 42KB | 按功能域拆分 |
| types.ts (chart) | 38KB | 按子域拆分 (kline-types / depth-types / indicator-types) |
| drawing-types.ts | 27KB | 已过大，建议静态数据用 JSON 配置文件 |

### 4.2 两套 adapter 体系并存

**问题**: `electron/broker/` (IBrokerAdapter V1+V2) 和 `electron/engine/broker/` (独立接口) 两套并存，容易混淆

**建议**: 统一到 `electron/broker/` 下，`electron/engine/broker/adapters/` 合并过来

### 4.3 日志级别不一致

**问题**: 部分文件用 `electron-log`，部分用 `log` (裸导入)，部分用 `console.log`

**建议**: 统一为 `electron-log` 的 `log.info/warn/error` 格式

---

## 五、测试覆盖盲区

### 5.1 未覆盖的关键适配器

| 适配器 | 测试文件 | 状态 |
|--------|---------|------|
| futu-opend.ts | ❌ 无 | 核心依赖无测试 |
| ib-adapter.ts | ❌ 无 | 74KB 零测试 |
| QuoteAggregator.ts | ❌ 无 | 聚合引擎无测试 |
| CodeNormalizer.ts | ❌ 无 | 标准化映射无测试 |
| BrokerEventBus.ts | ❌ 无 | 事件总线无测试 |
| BinanceAdapter (ML) | ❌ 无 | 4家加密适配器均无单元测试 |
| OAuthTokenStore.ts | ❌ 无 | 安全存储无测试 |
| alert-service.ts | ❌ 无 | 提醒服务无测试 |
| pattern-recognition.ts | ❌ 无 | 形态识别算法无测试 |

### 5.2 建议补充

1. **CodeNormalizer**: 17 家券商 × 3 种格式映射测试 (~30 tests)
2. **QuoteAggregator**: 多券商行情聚合 + CBBO 测试 (~20 tests)
3. **BrokerEventBus**: 事件发布/订阅/解绑测试 (~15 tests)
4. **PatternRecognition**: 20 种形态手工标注数据集验证 (~20 tests)

---

## 六、文档对齐检查

| 文档 | 与实际代码一致性 | 问题 |
|------|-----------------|------|
| developer-guide.md | ✅ 大体一致 | 缺少IB格式、Bridge adapter 代码示例 |
| api-reference.md | ✅ 一致 | 无 Robinhood Crypto 条目 |
| security-audit.md | ✅ 已更新 | P0 修复尚未实施 |
| broker-integration-research.md | ⚠️ 部分过时 | 未更新至 v3.1 架构 + L3 行情 |

---

## 七、综合改进优先级

| 优先级 | 项目 | 预估工时 | 负责人建议 |
|--------|------|---------|-----------|
| 🔴 P0 | BrokerConfig 密钥重构 | 4h | JVS |
| 🔴 P0 | 4家 crypto adapter 加 getOrderBook | 4h | ML |
| 🔴 P0 | CodeNormalizer 加 IB 合约格式 | 2h | JVS |
| 🟡 P1 | IB adapter V2 升级 + 拆分 | 12h | PM/JVS |
| 🟡 P1 | 测试盲区覆盖 (9 个未测模块) | 24h | youdao |
| 🟡 P1 | BrokerManagerV2 TODOs 清理 | 8h | JVS |
| 🟢 P2 | 大文件拆分 | 16h | 各文件 owner |
| 🟢 P2 | 统一日志格式 | 2h | 全员 |
| 🟢 P2 | 文档更新至 v3.1 | 4h | QClaw |
| **总计** | | **76h** | |

---

## 八、给 PM 的行动建议

1. **安全优先**: P0 密钥重构立即实施
2. **功能补全**: crypto adapter 深度方法补齐 → R114 引擎可用
3. **测试覆盖**: 9 个盲区由 youdao 在 R116-R118 中补测
4. **文件拆分**: 在 R117 重构窗口做
5. **文档同步**: QClaw 在 R118 文档轮次更新

---

*审查完成: 2026-06-12 | 审查人: youdao*
