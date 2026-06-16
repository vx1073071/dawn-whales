<!-- META
version: 1.12.0
last_updated: 2026-06-12
round: R108
owner: team
purpose: (auto-generated, needs review)
-->

# Contributing to quant-moo

> 感谢你考虑为 quant-moo 做出贡献！

## 目录

1. [开发环境](#开发环境)
2. [代码规范](#代码规范)
3. [分支策略](#分支策略)
4. [提交规范](#提交规范)
5. [测试要求](#测试要求)
6. [PR 流程](#pr-流程)
7. [发布流程](#发布流程)
8. [常见问题](#常见问题)

---

## 开发环境

### 前置条件

| 工具 | 版本要求 | 说明 |
|------|----------|------|
| Node.js | ≥ 22.x | 推荐使用 managed 版本 |
| npm | ≥ 10.x | 随 Node.js 安装 |
| Git | ≥ 2.x | 版本控制 |
| Futu OpenD | 最新版 | 可选，行情数据源 |

### 快速开始

```bash
# 1. 克隆仓库
git clone https://github.com/vx1073071/quant-moo.git
cd quant-moo

# 2. 安装依赖
npm install --legacy-peer-deps

# 3. 启动开发环境
npm run dev

# 4. 跑测试确认环境正常
node --no-warnings node_modules/vitest/vitest.mjs run
```

### 目录结构概览

```
quant-moo/
├── electron/          # Electron 主进程 (Node.js)
│   ├── main/          # 入口、窗口管理
│   ├── engine/        # 交易引擎
│   ├── websocket/     # WebSocket 行情
│   ├── strategy/      # 策略执行
│   ├── payment/       # USDT 支付
│   └── types/         # TypeScript 类型定义
├── src/               # React 渲染进程
│   ├── components/    # React 组件
│   ├── stores/        # Zustand 状态管理
│   ├── i18n/          # 国际化配置
│   └── locales/       # 翻译文件 (8种语言)
├── tests/             # 测试文件 (vitest)
├── e2e/               # E2E 测试 (Playwright)
├── docs/              # 文档
└── scripts/           # 工具脚本
```

详细架构说明见 [architecture.md](./architecture.md)。

---

## 代码规范

### TypeScript

- **严格模式**: `strict: true` in tsconfig.json
- **零错误**: TSC 编译必须 0 error
- **类型导出**: 公共 API 必须导出类型定义
- **禁止 any**: 尽量避免，必要时用 `unknown` + 类型守卫

### 命名约定

| 类型 | 规范 | 示例 |
|------|------|------|
| 文件名 | kebab-case | `condition-engine.ts` |
| 组件 | PascalCase | `LanguageSwitcher.tsx` |
| 变量/函数 | camelCase | `getKLineProcessor` |
| 常量 | UPPER_SNAKE | `MAX_RETRY_COUNT` |
| 类型/接口 | PascalCase | `ConditionConfig` |
| 枚举值 | PascalCase | `RegimeType.Bull` |

### 导入顺序

```typescript
// 1. Node.js 内置
import { readFileSync } from 'fs';
import { join } from 'path';

// 2. 第三方库
import { BrowserWindow } from 'electron';

// 3. 项目内模块 (相对路径)
import { ConditionEngine } from '../core/condition-engine';
import type { ConditionConfig } from '../../types/condition';
```

### 注释规范

```typescript
/**
 * 评估交易条件
 * @param condition - 条件配置
 * @param marketData - 市场数据
 * @returns 交易信号 (buy/sell/hold)
 */
function evaluateCondition(condition: ConditionConfig, marketData: MarketData): Signal {
  // 实现逻辑
}
```

---

## 分支策略

### 主分支

| 分支 | 用途 | 保护规则 |
|------|------|----------|
| `master` | 生产就绪代码 | 必须通过 PR + CI |
| `develop` | 开发集成分支 | 可直接推送 |

### 功能分支命名

```
feat/R93-M01-storybook-expansion
fix/R93-Q02-memory-leak
docs/R93-D01-architecture-guide
test/R93-Q01-ci-5rounds
refactor/R93-engine-cleanup
```

### 分支生命周期

```
master ←── PR ←── feat/R93-M01-storybook-expansion
                    ↑
                 develop (日常开发)
```

---

## 提交规范

### Commit Message 格式

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Type 列表

| Type | 说明 | 示例 |
|------|------|------|
| `feat` | 新功能 | `feat(engine): add regime detection` |
| `fix` | Bug 修复 | `fix(websocket): reconnect after timeout` |
| `test` | 测试相关 | `test(q77-02): fix fs mock for jsdom` |
| `docs` | 文档 | `docs: add architecture guide` |
| `refactor` | 重构 | `refactor(condition): simplify evaluator` |
| `perf` | 性能优化 | `perf(aggregator): batch quote updates` |
| `i18n` | 国际化 | `i18n: extract 50 keys from dashboard` |
| `chore` | 构建/工具 | `chore: update vitest exclude list` |
| `style` | 代码风格 | `style: fix import order` |

### Scope 列表

| Scope | 说明 |
|-------|------|
| `engine` | 交易引擎 |
| `websocket` | WebSocket 层 |
| `strategy` | 策略系统 |
| `payment` | 支付/计费 |
| `ui` | 前端组件 |
| `i18n` | 国际化 |
| `test` | 测试基础设施 |
| `build` | 构建配置 |

---

## 测试要求

### 必须遵守

1. **每个 PR 必须包含测试**
   - 新功能: 至少 3 个测试用例
   - Bug 修复: 至少 1 个回归测试
   - 重构: 不降低覆盖率

2. **测试命名格式**
   ```typescript
   describe('ConditionEngine', () => {
     it('should evaluate price cross above correctly', () => {
       // Arrange → Act → Assert
     });
   });
   ```

3. **禁止**
   - ❌ `it.skip()` 不说明原因
   - ❌ 排除测试文件不写理由
   - ❌ `done()` callback (用 async/await)
   - ❌ 元测试 (在测试体内调 vitest/tsc/build)

### 运行测试

```bash
# 全量测试
node --no-warnings node_modules/vitest/vitest.mjs run

# 单文件
node --no-warnings node_modules/vitest/vitest.mjs run tests/condition-engine.test.ts

# 带覆盖率
node --no-warnings node_modules/vitest/vitest.mjs run --coverage

# E2E (Playwright)
npx playwright test
```

### 验收标准 (v1.10.0)

| 指标 | 要求 |
|------|------|
| 测试失败 | 0 |
| TSC 错误 | 0 |
| Build | 成功 |
| i18n 硬编码 | < 10,000 字符 |
| EngineError 标准化 | ≥ 50% |
| npm audit | 0 critical/high |
| 覆盖率 statements | ≥ 65% |
| 覆盖率 branches | ≥ 45% |
| 覆盖率 functions | ≥ 55% |

---

## PR 流程

### 1. 创建 PR

```bash
git checkout -b feat/R93-M01-storybook
# ... 开发 ...
git add .
git commit -m "feat(ui): add 5 Storybook stories for trading components"
git push origin feat/R93-M01-storybook
```

### 2. PR 检查清单

- [ ] TSC: 0 errors (`npx tsc --noEmit`)
- [ ] 测试: 全部通过 (`vitest run`)
- [ ] 新增测试: 至少 3 个用例
- [ ] i18n: 新文本已提取到 `src/locales/` 全部 8 个语言文件
- [ ] 类型: 公共 API 有类型导出
- [ ] 文档: 复杂逻辑有 JSDoc 注释

### 3. Review 流程

1. PM (Claw) 初审: 检查代码质量和架构一致性
2. CI 自动检查: TSC + 测试 + Build
3. Reviewer 提出修改意见
4. 修改 → 重新提交 → 合并

---

## 发布流程

### 版本号规则

```
v{major}.{minor}.{patch}[-rc.{n}]

示例: v1.10.0-rc.2
```

### 发布检查清单

- [ ] 全量测试 5 轮全绿
- [ ] 内存泄漏检测通过
- [ ] Playwright E2E 12+ 场景全绿
- [ ] Storybook build 成功
- [ ] CHANGELOG 更新
- [ ] Release Notes 编写
- [ ] 性能基线对比 (无退化)
- [ ] Lighthouse ≥ 85

### 发布步骤

```bash
# 1. 最终测试
node --no-warnings node_modules/vitest/vitest.mjs run

# 2. Build
npm run build

# 3. Tag
git tag v1.10.0
git push origin v1.10.0

# 4. Package
npm run package
```

---

## 常见问题

### Q: npm install 报 peer dependency 冲突?

```bash
npm install --legacy-peer-deps
```

### Q: vitest 跑不完/挂起?

确认 `vitest.config.ts` 中的 exclude 列表包含 21 个排除项（3 基础 + 18 元测试）。

### Q: Electron 启动报错 "failed to install correctly"?

```bash
rm -rf node_modules/electron
npm install electron --legacy-peer-deps
```

### Q: 如何添加新的 i18n 键?

1. 在组件中使用: `t('my.new.key')`
2. 在 8 个 locale 文件中添加对应翻译:
   ```json
   // src/locales/zh-CN.json
   { "my": { "new": { "key": "新内容" } } }
   ```

### Q: 如何添加新的 IPC 通道?

1. 在 `electron/ipc/channels.ts` 定义常量
2. 在 `electron/main/ipc-handlers.ts` 注册 handler
3. 在 `preload.ts` 的 contextBridge 中暴露
4. 在渲染进程中通过 `window.electronAPI.xxx()` 调用

---

## 铁律 (永久生效)

1. **禁止撒谎** — 虚报完成度、伪造数据、编造 commit 零容忍
2. **禁止偷懒** — stub 充数、文档凑数、skip test 掩盖不可接受
3. **任务没做完不准停** — 领了任务必须干完，干不完说清楚卡在哪
4. **production-ready** — 每个任务: ≥500 行代码 + ≥5 测试 + build 0 error + i18n

---

*最后更新: 2026-06-11 | R93 D-01*
