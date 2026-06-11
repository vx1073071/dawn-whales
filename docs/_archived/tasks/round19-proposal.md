# Round 19 提案 — Build & Quality Zero Debt Sprint
**By: QClaw | Date: 2026-06-06 | Status: PROPOSAL**

---

## 一、现状分析

### 1.1 测试状态
- **Round 18 结果**: 563/563 PASS | 77/77 test files | ✅ 0 failures
- 测试债已清零，测试覆盖已达到 Sprint 1 目标

### 1.2 TypeScript 编译错误（4+ 处）
运行 `npx tsc --noEmit` 发现以下错误：

| 文件 | 错误数 | 严重度 | 说明 |
|------|--------|--------|------|
| `RiskDashboardPage.tsx` | 4 | 🔴 P0 | JSX 语法错误，tsc 报第510行（转译后行号），源文件349行。`tsc --noEmit` 退出码1 |
| `MarketPage.tsx` | 2 | 🟡 P1 | unused import `useCallback` + `Quote[]` 类型不匹配 |
| `RealTimeMarketDashboard.tsx` | 2 | 🟡 P1 | `string[]` 不能赋值给 `string` 参数 |
| `TradingDeskPage.tsx` | 3 | 🟡 P1 | unused `useCallback`, `selectedAccount`, `historyOrders` |
| `SentimentDashboardPage.tsx` | 1 | 🟡 P1 | unused `angle` 变量 |
| `PreferencesPage.tsx` | 2 | 🟡 P1 | `window.api.prefs` possibly undefined |

**总计**: ~14 个 TS 错误，阻塞 `npm run build`

### 1.3 RiskDashboardPage.tsx JSX 错误（核心阻塞）
```
src/components/risk/RiskDashboardPage.tsx(248,7): error TS1005: ')' expected.
src/components/risk/RiskDashboardPage.tsx(249,7): error TS2657: JSX expressions must have one parent element.
src/components/risk/RiskDashboardPage.tsx(509,5): error TS1128: Declaration or statement expected.
src/components/risk/RiskDashboardPage.tsx(510,3): error TS1109: Expression expected.
```
- 源文件 349 行，但 tsc 报第 510 行 → 错误位置是 **JSX transpiler 转译后的行号**
- 根因推断：`{[...] .map(...)` 的 inline array 中存在 JSX 语法问题，TypeScript JSX parser 在 transpiled 位置报第 510 行
- 需要直接检查 `RiskDashboardPage.tsx` 源文件定位真实错误行

---

## 二、Round 19 目标

### 目标 1：TypeScript Build 零错误
- `npx tsc --noEmit` 退出码 0，0 错误

### 目标 2：生产 Build 成功
- `npm run build` 或 `npm run dist` 成功生成打包文件

### 目标 3：应用可正常启动
- Electron 主进程 + Renderer 进程均可正常启动
- IPC 通道完整可用

---

## 三、任务分工建议

### QClaw（P0 — Build 阻塞修复）
| 任务 | 文件 | 动作 |
|------|------|------|
| Q-19-01 | `RiskDashboardPage.tsx` | 定位并修复 JSX 语法错误（真实行号） |
| Q-19-02 | `MarketPage.tsx` | 移除 unused `useCallback`，修复 `Quote[]` 类型 |
| Q-19-03 | `RealTimeMarketDashboard.tsx` | 修复 `string[]` → `string` 参数类型 |
| Q-19-04 | `TradingDeskPage.tsx` | 移除 unused 变量 |
| Q-19-05 | `SentimentDashboardPage.tsx` | 移除 unused `angle` |
| Q-19-06 | `PreferencesPage.tsx` | 添加 `window.api.prefs` undefined guard |

**预计结果**: `npx tsc --noEmit` → 0 错误

### JVS（P1 — Build 验证 + 潜在 UI 修复）
| 任务 | 说明 |
|------|------|
| JVS-19-01 | Build 验证：`npm run build` 成功 |
| JVS-19-02 | Electron 启动验证（`npm run start`） |
| JVS-19-03 | 辅助修复其他 UI 组件 TS 警告 |

### WorkBuddy（PM 协调）
| 任务 | 说明 |
|------|------|
| PM-19-01 | 确认分工并广播 Round 19 提案 |
| PM-19-02 | 协调验证 Build + 启动测试 |
| PM-19-03 | Round 20 规划（Sprint 1 Demo 准备） |

---

## 四、执行计划

### Phase 1：Build 阻塞修复（QClaw 独立执行）
1. 定位 `RiskDashboardPage.tsx` 真实 JSX 错误行（通过 SWC/esbuild 查看转译错误上下文）
2. 修复所有 TS 错误
3. `npx tsc --noEmit` → 0 错误
4. commit: `fix(R19): TypeScript build zero errors`

### Phase 2：Build + 启动验证（JVS + QClaw 并行）
1. JVS 执行 `npm run build` 验证
2. JVS 执行 `npm run start` 验证 Electron 启动
3. 如有 UI 问题，QClaw 响应修复

### Phase 3：发布 + Sprint 1 Demo 准备
1. 合并所有 R19 改动
2. 准备 Sprint 1 Demo 演示材料
3. Round 20 规划会议

---

## 五、验收标准

```
✅ npx tsc --noEmit → 0 errors, exit code 0
✅ npm run build → success, no fatal errors
✅ npm run start → Electron starts, window opens
✅ 77 test files, 563 tests still pass (no regression)
```

---

## 六、风险评估

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| `RiskDashboardPage.tsx` JSX 错误比预期复杂 | 中 | 高 | SWC 直接编译验证定位 |
| `better-sqlite3` native binding 在打包后失效 | 低 | 高 | 检查 electron-builder 配置 |
| 其他未发现的环境问题 | 低 | 中 | 提前跑 `npm run start` 验证 |

---

## 七、预计时间
- QClaw Q-19-01 ~ Q-19-06：**30-60 分钟**（TypeScript 错误通常局部明确）
- JVS 验证：**15-30 分钟**
- **总 Round 19：1-2 小时**

---

**等待 PM 确认后开始执行。**
