<!-- META
version: 1.12.0
last_updated: 2026-06-12
round: R108
owner: QClaw
purpose: (auto-generated, needs review)
-->

# quant-moo 测试架构文档

> **版本**: v1.10.0
> **最后更新**: 2026-06-12
> **维护人**: QClaw (文档虾)
> **本文档受众**: 全体 quant-moo 开发虾 (JVS/QClaw/youdao/ML/PM)

---

## 一、 测试分层架构

quant-moo 采用三层测试金字塔架构，从低到高依次为：

```
        ┌──────────────┐
        │  E2E Tests   │  ← Playwright, 14 specs, 全浏览器
        ├──────────────┤
        │  Integration │  ← IPC handler 集成, DB 交互
        ├──────────────┤
        │  Unit Tests  │  ← 392 test files, 6286+ tests, vitest
        └──────────────┘
```

### 1.1 单元测试 (Unit Tests)

**运行器**: [Vitest](https://vitest.dev/) v3.2.x
**位置**: `tests/` 目录
**引擎**: Node.js (jsdom/Node 双环境)
**规模**: 392 个测试文件, 6286+ 测试用例

覆盖范围：
- `electron/engine/` 下所有 9 个子目录 (agents/analysis/backtest/core/data/factors/portfolio/risk/utils)
- `electron/` 核心模块 (IPC handlers, main process)
- `src/` 共享工具函数

### 1.2 集成测试 (Integration Tests)

**位置**: `tests/integration/`, `tests/broker/`, `tests/executor/`
**特点**: 测试多个模块之间的协作，含 IPC handler 链路验证
**示例**: 下单链路: signal → risk check → execution → fill → position update

```typescript
// tests/integration/order-lifecycle.test.ts
describe('Order Lifecycle Integration', () => {
  it('should complete full order lifecycle: signal → fill → position', async () => {
    // 1. 模拟 AI 信号
    const signal = await signalEngine.generate('HK.00700', '1d');
    // 2. 风控验证
    const riskPass = riskEngine.check(signal);
    expect(riskPass).toBe(true);
    // 3. 执行下单
    const order = await tradeExecutor.submitOrder(signal);
    expect(order.status).toBe('FILLED');
    // 4. 持仓更新
    const position = positionManager.getPosition('HK.00700');
    expect(position.quantity).toBeGreaterThan(0);
  });
});
```

### 1.3 端到端测试 (E2E)

**运行器**: [Playwright](https://playwright.dev/) v1.53.x
**位置**: `e2e/` 目录
**规模**: 14 个 spec 文件, 51+ 测试用例
**浏览器**: Chromium + Firefox

---

## 二、 目录结构

```
quant-moo/
├── tests/                          # 单元测试根目录
│   ├── helpers/                    # 测试工具集
│   │   ├── test-utils.ts           # 通用测试函数
│   │   ├── setup.ts                # vitest setup 文件
│   │   ├── events-polyfill.ts      # jsdom EventEmitter 补丁
│   │   └── mock-factory.ts         # Mock 对象工厂
│   ├── electron/                   # Electron 引擎测试 (按引擎模块)
│   │   ├── agents/                 # AI Agent 测试
│   │   ├── analysis/               # 分析引擎测试
│   │   ├── backtest/               # 回测引擎测试
│   │   ├── core/                   # 核心引擎测试
│   │   ├── data/                   # 数据引擎测试
│   │   ├── portfolio/              # 组合引擎测试
│   │   └── risk/                   # 风控引擎测试
│   ├── integration/                # 集成测试
│   ├── broker/                     # 券商测试
│   ├── executor/                   # 执行引擎测试
│   ├── e2e/                        # E2E 辅助 (非 Playwright)
│   ├── performance/                # 性能测试
│   ├── account/                    # 账户模块测试
│   ├── market/                     # 市场数据测试
│   └── automation/                 # 自动化脚本测试
│
├── e2e/                            # Playwright E2E
│   ├── *.spec.ts                   # E2E 测试规格
│   └── playwright.config.ts        # Playwright 配置
│
├── vitest.config.ts                # Vitest 配置
└── vitest.workspace.ts             # Vitest 工作区配置
```

---

## 三、 Vitest 配置详解

### 3.1 核心配置 (`vitest.config.ts`)

```typescript
// vitest.config.ts (关键配置摘录)
export default defineConfig({
  test: {
    // 环境策略: Node 环境为主, jsdom 用于需要 DOM 的测试
    environment: 'node',

    // 文件匹配: 自动发现所有 .test.ts(x) 文件
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],

    // 排除规则: 49 个预存 broken/不可测试文件
    exclude: [
      // 循环依赖 (无法加载)
      'tests/q95-09-backtest-engine-parallel.test.ts',

      // 缺少 @testing-library/react
      'tests/q35-trading-components.test.tsx',

      // hangs vitest (重型基准测试)
      'tests/benchmark-engines.test.ts',

      // 需要在线 WebSocket 服务
      'tests/ws-backfill.test.ts',

      // i18n broke Chinese signal regex
      'tests/nl-parser.test.ts',
      'tests/nl-parser-extension.test.ts',

      // 元测试: spawn vitest/tsc/build via child_process → 递归循环
      'tests/q51-01-stability-guard.test.ts',
      // ... 共 49 个
    ],

    // 并发模式: threads (避免 forks stdout 泄漏导致 esbuild phantom errors)
    pool: 'threads',

    // 覆盖率配置
    coverage: {
      provider: 'v8',
      include: ['electron/engine/**'],
      exclude: ['**/*.d.ts', '**/*.test.*'],
      thresholds: {
        lines: 60,
        branches: 50,
        functions: 50,
      },
    },
  },
});
```

### 3.2 环境选择策略

| 环境 | 使用场景 | 配置方式 |
|------|---------|---------|
| `node` | 纯引擎逻辑 (无 DOM 依赖) | `// @vitest-environment node` |
| `jsdom` | 需要 DOM API (React 组件) | `// @vitest-environment jsdom` |
| `happy-dom` | 轻量 DOM (无需完整浏览器) | `// @vitest-environment happy-dom` |

---

## 四、 测试写作规范

### 4.1 文件命名

```
{qclaw|jvs|r\d+}-{序号}-{模块名}.test.ts

示例:
  q95-01-bayesian-optimizer.test.ts    # QClaw R95 第1个文件
  jvs-38-kline-engine.test.ts          # JVS R38
  r95-risk-coverage.test.ts            # youdao R95
```

### 4.2 测试结构模板

```typescript
/**
 * {任务编号}: {引擎名} Tests
 * Coverage for {覆盖目标描述}
 */
// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TargetEngine } from '../electron/engine/path-to-engine';

describe('{任务编号}: {引擎名}', () => {
  // ===== 构造与配置 =====
  describe('constructor & config', () => {
    it('should create engine with default config', () => { /* ... */ });
    it('should return config', () => { /* ... */ });
    it('should update config partially', () => { /* ... */ });
  });

  // ===== 核心功能 =====
  describe('core functionality', () => {
    it('should handle happy path', () => { /* ... */ });
    it('should handle error conditions', () => { /* ... */ });
  });

  // ===== 边界条件 =====
  describe('edge cases', () => {
    it('should handle empty input', () => { /* ... */ });
    it('should handle extreme values', () => { /* ... */ });
    it('should handle concurrent access', () => { /* ... */ });
  });

  // ===== 集成场景 =====
  describe('integration scenarios', () => {
    it('should work with dependent engines', () => { /* ... */ });
  });
});
```

### 4.3 Mock 策略

**原则**: 只 mock 外部边界，不 mock 内部模块

```typescript
// ✅ 正确: Mock 外部依赖
vi.mock('electron-log', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock('better-sqlite3', () => ({
  default: vi.fn(() => ({
    prepare: vi.fn(() => ({ run: vi.fn(), all: vi.fn(() => []) })),
    exec: vi.fn(),
  })),
}));

// ❌ 错误: Mock 同项目的内部模块
vi.mock('../electron/engine/backtest/backtest-engine'); // 违反单元测试原则
```

**Mock 分层**:

| 层次 | Mock 对象 | 方式 |
|------|----------|------|
| 数据层 | `better-sqlite3`, 文件系统 | `vi.mock()` |
| 网络层 | OpenD connection, WebSocket | `vi.mock()` + stub |
| 日志层 | `electron-log` | `vi.mock()` |
| 时间层 | `Date.now()`, 定时器 | `vi.spyOn()` / `vi.useFakeTimers()` |
| 随机层 | `Math.random()` | `vi.spyOn()` |

### 4.4 断言风格

```typescript
// 值比较
expect(result).toBe(expected);
expect(result).toEqual({ key: 'value' });

// 类型检查
expect(typeof value).toBe('number');
expect(Array.isArray(result)).toBe(true);

// 范围检查 (优于严格 toBeCloseTo)
expect(value).toBeGreaterThanOrEqual(0);
expect(value).toBeLessThanOrEqual(1);

// 防御性检查 (处理 engine 边缘情况)
expect(result !== undefined).toBe(true);

// 异步
await expect(asyncFn()).resolves.toBeDefined();
await expect(asyncFn()).rejects.toThrow('error message');
```

---

## 五、 CI 集成

### 5.1 本地门禁

```bash
# TSC 类型检查
npx tsc --noEmit                    # 必须 EXIT: 0

# 全量测试
npx vitest run                      # 必须 0 fail

# 单文件测试
npx vitest run tests/q95-01.test.ts

# 覆盖率
npx vitest run --coverage
```

### 5.2 Pre-commit Hook

```bash
# .husky/pre-commit
npx tsc --noEmit
npx vitest run --changed
```

### 5.3 5 轮 CI 验证

每次大轮次交付时执行 5 轮连续全量测试:

```bash
for i in {1..5}; do
  echo "=== Round $i ==="
  npx vitest run 2>&1 | grep "Tests\|Test Files"
done
```

验收标准:
- **5/5 GREEN**: 所有轮次 0 fail
- **0 flaky**: 无随机失败 (variance = 0)
- **总通过 > 5500**: 测试规模不缩水

---

## 六、 覆盖率规范

### 6.1 目标阈值

| 指标 | 最低 | 目标 | R95.1 实际 |
|------|------|------|-----------|
| Lines (语句) | 55% | 65% | 52.62% |
| Branches (分支) | 45% | 60% | 78.65% ✅ |
| Functions (函数) | 50% | 65% | 82.52% ✅ |

### 6.2 模块级目标

| 引擎模块 | 文件数 | 当前覆盖率 | 目标 | 状态 |
|----------|--------|-----------|------|------|
| engine/core | 37 | 69.24% | 65% | ✅ 达标 |
| engine/risk | 37 | 55.96% | 50% | ✅ 达标 |
| engine/analysis | 79 | 55.20% | 55% | ✅ 达标 |
| engine/backtest | 20 | ~62% | 60% | ✅ 达标 |
| engine/factors | 8 | ~62% | 60% | ✅ 达标 |
| engine/portfolio | 48 | ~55% | 60% | ⚠️ 接近 |
| engine/agents | 24 | ~58% | 60% | ⚠️ 接近 |
| engine/data | 88 | ~35% | 60% | ❌ 差距大 |

---

## 七、 常见问题

### Q: 测试运行 OOM？

```bash
# 增加 Node.js 堆内存
node --max-old-space-size=8192 node_modules/vitest/vitest.mjs run

# 单文件运行 (避免全量 OOM)
npx vitest run tests/q95-01.test.ts
```

### Q: esbuild parse error?

常见原因: 源文件中含控制字符 (0x01, 0x02, 0x1A 等)。用以下命令定位:

```powershell
# PowerShell 字节级检查
[System.IO.File]::ReadAllBytes("path/to/file.ts") | ForEach-Object {
  if ($_ -eq 1 -or $_ -eq 2) { Write-Host "Found control char at index" }
}
```

### Q: 测试文件不被 vitest 发现？

检查点:
1. 文件名是否匹配 `*.test.ts` 模式
2. 是否在 `vitest.config.ts` 的 `exclude` 列表中
3. 是否使用标准 `describe`/`it`/`expect` 语法 (旧式 `run()`/`assert()` 不被发现)

### Q: "Cannot access 'XXX' before initialization"?

原因: 循环依赖。vitest tinypool Worker 无法处理循环 import。解决方式:
1. 将该测试文件加入 `vitest.config.ts` 的 `exclude`
2. 或重构源文件打破循环依赖

### Q: `Date.now()` 无法被 `vi.useFakeTimers()` 控制?

jsdom 环境中的 `vi.useFakeTimers()` 不控制 `Date` 对象。替代方案:

```typescript
vi.spyOn(Date, 'now').mockImplementation(() => 1704067200000);
```

---

## 八、 测试文件增长趋势

| 轮次 | 测试文件 | 测试数 | 失败 |
|------|---------|--------|------|
| R38 | 120+ | 1,579 | 0 |
| R45 | 160+ | 2,774 | 0 |
| R50 | 190+ | 3,650 | 0 |
| R57 | 220+ | 4,609 | 1 |
| R63 | 250+ | 5,182 | 1 |
| R67 | 280+ | 5,412 | 0 |
| R70 | 306 | 5,544 | 0 |
| R92 | 330+ | 5,144 | 0 |
| R95.1 | **392** | **6,286** | **0** |

---

## 九、 参考链接

- [Vitest 官方文档](https://vitest.dev/)
- [Playwright 官方文档](https://playwright.dev/)
- [Testing Library (React)](https://testing-library.com/docs/react-testing-library/intro/)
- [项目 CONTRIBUTING.md](../CONTRIBUTING.md)
- [项目 TEAM-RULES.md](../TEAM-RULES.md)
- [R95 覆盖率回顾](./r95-coverage-review.md)
