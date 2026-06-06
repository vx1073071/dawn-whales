# Round 32 提案：清场 Sprint 1 遗留失败（QClaw）

**日期：** 2026-06-06
**发起人：** QClaw
**状态：** 待 PM WorkBuddy 确认

---

## 一、问题总览

全量测试结果：**102 passed / 77 failed / 8 skipped**（111 tests in 8 files）

| # | 文件 | 失败数 | 根因分类 |
|---|------|--------|---------|
| 1 | `jvs-37-ipc-validation.test.ts` | 64 | `ipcMain.handlers` 在 jsdom 为 undefined |
| 2 | `integration-full-pipeline.test.ts` | ~10 | Electron IPC mock 在 jsdom 中未正确 mock |
| 3 | `jvs-100-e2e.test.ts` | ~2 | JVS EMI handler 未注册（ipcMain.handle 缺失）|
| 4 | `jvs-integration.test.ts` | 1 | **自定义 `test()` 函数覆盖 vitest 全局，无 `describe()` 包裹** |
| 5 | `jvs-e2e-validation.test.ts` | 1 | 同上，自定义 `test()` 覆盖 |
| 6 | `ws-backfill.test.ts` | 1 | 同上，自定义 `test()` 覆盖 |
| 7 | `jvs-50-realtime-quality-monitor.test.ts` | ~1 | 同上，自定义 `test()` 覆盖 |
| 8 | `jvs-49-data-versioning.test.ts` | ~8 | **Native module `better-sqlite3` 未 mock，`ERR_DLOPEN_FAILED`** |

---

## 二、根因详解

### 类型 A：自定义 test() 函数覆盖 vitest 全局（4 files）

**问题：** 这 4 个文件顶部定义了局部的 `function test(name, fn)` 或 `async function test(name, fn)`，覆盖了 vitest 注入的全局 `test()`，导致 vitest 找不到任何测试套件（"No test suite found in file"）。

**修复方案：** 将所有 `test(...)` 调用包裹在顶层 `describe('...', () => { ... })` 块中，或将局部 `test` 函数重命名为 `runTest` 并显式调用。

**涉及文件：**
- `tests/jvs-integration.test.ts`
- `tests/jvs-e2e-validation.test.ts`
- `tests/ws-backfill.test.ts`
- `tests/jvs-50-realtime-quality-monitor.test.ts`

### 类型 B：Native module 未 mock（1 file）

**问题：** `jvs-49-data-versioning.test.ts` 直接 `import Database from 'better-sqlite3'`，在 jsdom 环境中 `ERR_DLOPEN_FAILED`。

**修复方案：** 在文件顶部添加 `vi.mock('better-sqlite3')`，返回空壳 mock。

### 类型 C：ipcMain.handlers 未注册（3 files）

**问题：** `jvs-37-ipc-validation.test.ts` 中 `ipcMain.handlers` 在 jsdom 环境为 undefined，导致所有 IPC handler 注册检查返回 62 个未注册错误。

**修复方案：** 方案 1（推荐）：将 ipcMain mock 替换为带 `.handlers` 属性（size + Map）的完整 mock；方案 2：跳过该集成测试，仅保留单元测试。

---

## 三、任务分配（4虾）

### Q-32（QClaw）：jvs-integration.test.ts + ws-backfill.test.ts
- 将自定义 `test()` 包裹进 `describe()` 块
- 验证 vitest 能正确发现并运行测试
- 目标：全部通过

### JVS-32（JVS）：jvs-e2e-validation.test.ts + jvs-50-realtime-quality-monitor.test.ts  
- 同上，将自定义 `test()` 包裹进 `describe()` 块
- 验证 JVS IPC handler 端点完整性

### K-32（KClaw / QClaw）：jvs-37-ipc-validation.test.ts
- 修复 `ipcMain.handlers` mock
- 或评估是否将此测试拆分：单元部分（保留）× 集成部分（跳过或重写）

### L-32（Lobster）：jvs-49-data-versioning.test.ts + integration-full-pipeline.test.ts + jvs-100-e2e.test.ts
- `better-sqlite3` vi.mock
- integration pipeline 的 Electron IPC mock 修复
- jvs-100-e2e EMI handler mock

---

## 四、验收标准

1. 全量测试 **179 passed / 0 failed**（仅保留合理跳过的测试）
2. TSC 0 errors（可接受 ML-R31 引入的 pre-existing bridge-api 缺失导出错误）
3. 所有 vitest test suite 正确发现，无 "No test suite found" 错误
4. push master 后 CI 状态干净

---

## 五、风险评估

- **低风险：** 类型 A（test() 包裹）是纯结构修复，无业务逻辑改动
- **中风险：** 类型 B（native module mock）可能需要验证 mock 行为正确性
- **高风险：** 类型 C（ipcMain.handlers）是深层 mock 问题，可能需要较大重构
