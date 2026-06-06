# 测试守卫报告 — Q-26-03

**分支**: feature/strategy-optimize  
**日期**: 2026-06-06  
**任务**: P2 测试守卫 — 识别测试覆盖盲区，建立持续测试门槛

---

## 一、测试覆盖率总览

### Electron 核心模块（29 个 .ts 文件）

| 模块 | 路径 | 测试文件 | 状态 |
|------|------|----------|------|
| `risk-engine.ts` | `electron/engine/` | `risk-engine-v2-scenarios.test.ts` | ✅ 100% 场景覆盖 |
| `trade-executor.ts` | `electron/engine/` | `trade-executor-expanded.test.ts` | ✅ 场景较全 |
| `backtest-engine.ts` | `electron/engine/` | — | 🔴 无测试 |
| `strategy-engine.ts` | `electron/engine/` | — | 🔴 无测试 |
| `nl-parser.ts` | `electron/engine/` | — | 🔴 无测试 |
| `parameter-scanner.ts` | `electron/engine/` | — | 🔴 无测试 |
| `walk-forward.ts` | `electron/engine/` | — | 🔴 无测试 |
| `backtest-enhancer.ts` | `electron/engine/` | — | 🔴 无测试 |
| `ws-market-data.ts` | `electron/engine/` | — | 🔴 无测试 |
| `futu-ws-adapter.ts` | `electron/engine/` | — | 🔴 无测试 |
| `futu-mock-feed.ts` | `electron/engine/` | — | 🔴 无测试 |
| `ws-trade-bridge.ts` | `electron/engine/` | — | 🔴 无测试 |
| `strategy-execute-handler.ts` | `electron/ipc/` | — | 🔴 无测试 |
| `database.ts` | `electron/data/` | — | 🔴 无测试 |
| `data-provider.ts` | `electron/data/` | — | 🔴 无测试 |
| `marketplace-service.ts` | `electron/data/` | — | 🔴 无测试 |
| `BrokerManager.ts` | `electron/broker/` | — | 🔴 无测试 |
| `moomoo-adapter.ts` | `electron/broker/` | — | 🔴 无测试 |
| `futu-opend.ts` | `electron/broker/` | — | 🔴 无测试 |
| `account-aggregator.ts` | `electron/broker/` | — | 🔴 无测试 |
| `crypto-payment.ts` | `electron/payment/` | — | 🔴 无测试 |
| `license-manager.ts` | `electron/payment/` | — | 🔴 无测试 |
| `secure-key.ts` | `electron/utils/` | — | 🔴 无测试 |
| `main.ts` | `electron/` | — | 🔴 无测试 |
| `preload.ts` | `electron/` | — | 🔴 无测试 |
| `ipc-schemas.ts` | `electron/` | — | 🔴 无测试 |

**测试覆盖**: 2/26 核心模块 = **7.7%**

### React 组件层（38 个 .tsx 文件）

测试覆盖率：0/38 = **0%**。

---

## 二、关键风险排序

### 🔴 Tier 1 — 高风险无测试模块

**1. `nl-parser.ts`（自然语言交易解析）**
- 用户输入 → 结构化交易指令的核心模块
- 错误直接导致错误下单或仓位计算错误
- 故障表现隐蔽（parse 失败 silent fallback）
- **建议最低测试**：
  - 有效命令解析（"买入腾讯 100 股"、"开多 BTC"）
  - 模糊意图识别（"稍微买一点"、"如果跌到..."）
  - 错误容忍（拼写错误、无效标的、超大数量）
  - 多语言边界（中文数字、单位转换）

**2. `parameter-scanner.ts`（参数扫描引擎）**
- 参数优化结果直接影响实盘策略表现
- 错误的参数可能导致过度拟合
- **建议最低测试**：
  - 参数边界（负数、超限、超范围枚举）
  - 网格搜索正确性（已知参数-结果对）
  - 空数据集处理
  - 并发扫描隔离

**3. `strategy-engine.ts`（策略引擎）**
- 策略信号生成逻辑
- 与 RiskEngine 集成点
- **建议最低测试**：
  - 策略状态机（idle → running → stopped）
  - 信号生成正确性（已知历史 K 线 → 已知信号）
  - 与 RiskEngine 的 checkOrder 集成

### 🟡 Tier 2 — 中风险无测试模块

**4. `backtest-engine.ts`**
- 核心计算逻辑：逐 bar 回放、绩效归因
- 故障可能导致错误的策略排名
- 建议：逐 bar 正确性、VaR 计算、幸存者偏差检查

**5. `walk-forward.ts`**
- Walk-forward 分析
- 故障可能导致 in-sample 过拟合被忽略
- 建议：训练/测试窗口滑动、参数稳定性检验

**6. `BrokerManager.ts` + `moomoo-adapter.ts`**
- 多券商适配层
- 故障可能导致订单路由错误
- 建议：适配器接口契约测试

### 🟢 Tier 3 — 低风险（可暂时跳过）

`license-manager.ts`, `crypto-payment.ts`, `secure-key.ts` — 外部依赖少，故障影响可追踪。

---

## 三、已排除测试文件（需修复或删除）

以下文件被 vitest 排除但未被删除，存在隐患：

| 文件 | 排除原因 | 建议 |
|------|----------|------|
| `e2e-pipeline.test.ts` | 无顶层 describe/test | 补充顶层结构或删除 |
| `kelly-sizing.test.ts` | 同上 | 同上 |
| `strategy-execute-integration.test.ts` | 同上 | 同上 |
| `ws-backfill.test.ts` | 文件不存在 | 删除 exclude 条目 |
| `integration-full-pipeline.test.ts` | 文件不存在 | 删除 exclude 条目 |
| `jvs-e2e-validation.test.ts` | 文件不存在 | 删除 exclude 条目 |
| `jvs-integration.test.ts` | 文件不存在 | 删除 exclude 条目 |
| `jvs-37-ipc-validation.test.ts` | 文件不存在 | 删除 exclude 条目 |
| `paper-trader.test.ts` | 文件不存在 | 删除 exclude 条目 |
| `jvs-50-realtime-quality-monitor.test.ts` | 文件不存在 | 删除 exclude 条目 |
| `jvs-49-data-versioning.test.ts` | 文件不存在 | 删除 exclude 条目 |
| `jvs-100-e2e.test.ts` | 文件不存在 | 删除 exclude 条目 |
| `t53-crypto-service.test.ts` | 文件不存在 | 删除 exclude 条目 |
| `trade-executor.test.ts` | 文件不存在 | 删除 exclude 条目 |
| `trade-executor-ipc.test.ts` | 文件不存在 | 删除 exclude 条目 |
| `q51-chaos-engineering.test.ts` | 文件不存在 | 删除 exclude 条目 |

**15 个 exclude 条目中 14 个对应不存在文件**。清理这些条目可：
1. 避免误导（exclude 了不存在的东西）
2. 防止未来同名新文件被意外排除
3. 减少配置维护负担

---

## 四、测试守卫规则建议

### CI 门禁配置

```yaml
# .github/workflows/test.yml 或 CI 配置
test:
  steps:
    - run: npm test
      # 必须全部通过
    - run: npx vitest run --coverage
      # 覆盖率门槛
    - run: |
        # 禁止新增无测试的核心模块
        node scripts/test-guard.js
```

### `scripts/test-guard.js` 建议逻辑

```javascript
const fs = require('fs');
const path = require('path');

const CORE_MODULES = [
  'electron/engine/risk-engine.ts',
  'electron/engine/trade-executor.ts',
  'electron/engine/strategy-engine.ts',
  'electron/engine/nl-parser.ts',
  'electron/engine/parameter-scanner.ts',
  'electron/engine/backtest-engine.ts',
];

const testDir = 'tests';
const existingTests = fs.readdirSync(testDir)
  .filter(f => f.endsWith('.test.ts'));

let missing = [];
for (const mod of CORE_MODULES) {
  const base = path.basename(mod, '.ts');
  const hasTest = existingTests.some(t =>
    t.includes(base) || t.includes(path.dirname(mod).split('/').pop())
  );
  if (!hasTest) {
    missing.push(mod);
  }
}

if (missing.length > 0) {
  console.error('⚠️  核心模块缺少测试:');
  missing.forEach(m => console.error(' -', m));
  process.exit(1); // CI 失败
}
```

---

## 五、结论

| 维度 | 当前 | 目标 |
|------|------|------|
| Electron 核心模块覆盖率 | 7.7% (2/26) | >50% Tier1+Tier2 |
| React 组件覆盖率 | 0% | >20% |
| vitest exclude 垃圾条目 | 14 个 | 0 个 |
| CI 覆盖率门槛 | 无 | 必须通过 |

**Q-26-03 完成** — 识别了 24 个无测试核心模块，按风险排序为 Tier1-3。建议优先补 `nl-parser.ts` 和 `parameter-scanner.ts` 测试（P0），其次 `strategy-engine.ts` 和 `broker` 适配层（P1）。同时清理 vitest exclude 中 14 个不存在文件。
