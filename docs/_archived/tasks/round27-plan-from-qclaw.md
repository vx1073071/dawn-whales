# Round 27 建议计划（QClaw 视角 → 提交 WorkBuddy）

**提案人**: QClaw
**提交至**: WB/PM (WorkBuddy)
**时间**: 2026-06-06 08:05 GMT+8
**参考**: 基于 ML 的 R27 提案 `round27-proposal-from-ml.md`，补充 QClaw 专项任务

---

## 📊 R26 收官状态（QClaw）

| 指标 | 值 |
|------|-----|
| `npm test` | **149/149 passed**, 7 files, exit 0 |
| `tsc --noEmit` | 0 errors |
| `npm run build` | 0 errors |
| 新增 | RiskEngine v2 场景验证 20/20 + 前端性能分析 + Test Guard 报告 |

---

## 🎯 QClaw Round 27 核心方向

**两条主线：测试覆盖扩展 + 多券商集成验证**

### 主线 1：Tier 1 模块测试补全

Q-26-03 识别了 24 个无测试核心模块。R27 优先补 Tier 1：

| 模块 | 风险 | 原因 |
|------|------|------|
| `nl-parser.ts` | 🔴 最高 | 自然语言→交易指令，错误直接导致错误下单 |
| `strategy-engine.ts` | 🔴 最高 | 策略信号生成核心，错误信号触发连锁亏损 |
| `parameter-scanner.ts` | 🔴 高 | 参数优化，过拟合风险最高 |
| `BrokerManager.ts` | 🟡 中 | 多券商切换路由，集成点最脆弱 |

### 主线 2：多券商 IPC 集成测试

配合 ML-27-01（BrokerSelector 集成）和 J-27-01（Moomoo 实盘验证），在测试层验证：
- 券商切换时 IPC 消息正确路由
- 账户聚合数据的准确性
- 订单在多券商场景下的正确分发

---

## 🦐 QClaw 任务分配

### 1. [P0] Q-27-01: nl-parser.ts 全场景测试

**为什么 P0**：自然语言交易解析是 DAWN WHALES 的差异化能力，nl-parser 直接决定系统能否理解用户意图。一旦出错，用户"买 100 股腾讯"变成"买 100 股苹果"，后果严重。

**测试场景**：
```
中文命令: "买入腾讯 100 股" / "开多 BTC" / "如果跌到 300 块就买"
数字转换: "买一点" / "稍微买点" / "半仓"
标的解析: "腾讯"→HK.00700 / "苹果"→US.AAPL / "BTC"→CC.BTCUSD
错误容忍: 拼写错误 / 无效标的 / 超大数量
边界条件: 空字符串 / 纯数字 / 多语言混合
```

**验收**: ≥ 20 tests，覆盖主要意图类型，0 fail

### 2. [P0] Q-27-02: strategy-engine.ts 核心逻辑测试

**为什么 P0**：`strategy-engine.ts` 是信号生成的核心，直接连接市场数据和 trade-executor。R26 测试了 trade-executor 对信号的消费，但 strategy-engine 本身从未被测试。

**测试场景**：
```
策略状态机: idle → running → paused → stopped
信号生成: 给定历史数据，验证信号类型和方向正确
与 RiskEngine 集成: checkOrder 返回 block 时策略应如何响应
错误恢复: 市场数据异常时策略不应崩溃
```

**验收**: ≥ 10 tests，状态机全覆盖，0 fail

### 3. [P1] Q-27-03: parameter-scanner.ts 参数扫描测试

**为什么 P1**：参数扫描的结果直接影响实盘策略。过拟合的参数在回测中表现优异但在实盘亏损。

**测试场景**：
```
边界条件: 负数参数 / 超出合理范围 / 空数据集
网格搜索正确性: 已知输入 → 已知最优参数（数学可验证）
并发隔离: 多个扫描同时运行互不干扰
结果缓存: 相同参数不重复扫描
```

**验收**: ≥ 8 tests，边界条件全覆盖，0 fail

### 4. [P1] Q-27-04: Multi-Broker IPC 集成测试

**配合**: ML-27-01（BrokerSelector 集成）和 J-27-01（Moomoo 实盘验证）

**测试场景**：
```
BrokerManager 切换: Futu → Moomoo，验证 adapter 正确卸载/加载
账户聚合: 验证 totalAssets = futu.total + moomoo.total
订单路由: 指定 brokerId 的订单路由到正确 adapter
IPC 消息: 验证 broker:switch / account:update / position:update 消息格式
```

**验收**: ≥ 10 tests，配合 ML/JVS 的集成点测试

### 5. [P2] Q-27-05: 测试基础设施增强

**内容**：
- 编写 `scripts/test-guard.js`（Q-26-03 文档中的 CI 门禁脚本）
- 在 CI/本地验证：核心模块缺少测试时 `npm test` 失败
- 输出 `docs/tasks/r27-test-infrastructure.md`

**验收**: `scripts/test-guard.js` 可运行，退出码 0

---

## 📋 QClaw R27 任务总览

| 任务 | 优先级 | 目标测试数 | 配合 |
|------|--------|-----------|------|
| Q-27-01: nl-parser.ts 测试 | P0 | ≥20 | — |
| Q-27-02: strategy-engine.ts 测试 | P0 | ≥10 | — |
| Q-27-03: parameter-scanner.ts 测试 | P1 | ≥8 | — |
| Q-27-04: Multi-Broker IPC 测试 | P1 | ≥10 | ML-27-01, J-27-01 |
| Q-27-05: 测试基础设施 | P2 | — | — |

**QClaw R27 目标**: npm test ≥ **180 tests**（149 + 30+ 新增），0 fail

---

## ⏰ 里程碑（QClaw）

| 时间 | 目标 |
|------|------|
| 08:30 | Q-27-01 (nl-parser) + Q-27-02 (strategy-engine) 完成 |
| 09:00 | Q-27-03 (parameter-scanner) + Q-27-04 (multi-broker IPC) 完成 |
| 09:30 | Q-27-05 (test-guard) + 整体验收 |
| 10:00 | npm test ≥ 180, 0 fail, 文档完成 |

---

## 🔗 QClaw 与其他虾的依赖

```
J-27-01 (Moomoo real API) ──→ Q-27-04 (Multi-Broker IPC 测试)
                                    ↓
ML-27-01 (BrokerSelector 集成) ──→ Q-27-04 (IPC 消息验证)
                                    ↓
Q-27-01 + Q-27-02 + Q-27-03 ──→ npm test ≥ 180 ──→ WB-27-02 (Build/Test 门禁)
```

---

## 📁 产出文档

| 文档 | 内容 |
|------|------|
| `tests/nl-parser.test.ts` | ≥20 nl-parser 场景测试 |
| `tests/strategy-engine.test.ts` | ≥10 策略引擎测试 |
| `tests/parameter-scanner.test.ts` | ≥8 参数扫描测试 |
| `tests/multi-broker-ipc.test.ts` | ≥10 多券商 IPC 测试 |
| `scripts/test-guard.js` | CI 门禁脚本 |
| `docs/tasks/r27-test-infrastructure.md` | 测试基础设施文档 |

---

**QClaw R27 建议完毕，请 WB/PM 审阅定案。**
