# Round 18 Proposal: 债务清零 + Sprint 1 就绪

**Author**: QClaw  
**Date**: 2026-06-05  
**Status**: DRAFT → 发给 WorkBuddy 分配

---

## Executive Summary

Round 16-17 共产出 600+ tests / 521 pass，剩余 **8 个 pre-existing failures** 分布在 4 个测试文件，均为**源码逻辑 bug** 而非测试问题。Round 18 目标：**0 fail**，为 Sprint 1 Demo 清理干净跑道。

---

## Current State: 521/529 (98.5%)

| File | Status | Root Cause |
|------|--------|-----------|
| `t52-state-machine.test.ts` | 3/6 FAIL | Source code bug in `transition()` |
| `t60-job-scheduler.test.ts` | 2/3 FAIL | Source code bug in `_bubbleUp()` |
| `t70-time-series.test.ts` | 3/3 FAIL | Source code bug in `toArray()` rotation |
| `t105-database-manager.test.ts` | 1 suite FAIL | Electron 未安装（环境问题） |

---

## R18-Q1: StateMachine `transition()` 修复 (P0)

**File**: `electron/workers/state-machine.ts`

**Bug**: 第 29 行逻辑反转
```typescript
// ❌ 当前代码（错误）
if (!config.allowedTransitions.includes(from)) { return false; }
// 含义：检查"当前状态"是否在"目标状态"的允许来源列表中
// 问题：allowedTransitions 语义是"可转换到哪些目标"，不是"可从哪些来源转入"

// ✅ 修复
if (!config.allowedTransitions.includes(to)) { return false; }
// 含义：检查"目标状态"是否在"当前状态"的允许目标列表中
```

**受影响的测试**:
| Test | 当前 | 修复后 |
|------|------|--------|
| `should reject invalid transition` | `transition('CONNECTED')` 返回 `true`（期望 `false`） | ✅ |
| `should track history` | history.length=1（期望 2） | ✅ |
| `OpenD machine correct transitions` | `canTransition('AUTHENTICATED')` 返回 `true`（期望 `false`） | ✅（如 createOpenDStateMachine 配置正确） |

**验收**: `tests/t52-state-machine.test.ts` → 6/6 PASS

---

## R18-Q2: JobScheduler `_bubbleUp()` 修复 (P0)

**File**: `electron/workers/job-scheduler.ts`

**Bug**: `_bubbleUp()` 只上升一层，Binary Heap 不完整
```typescript
// ❌ 当前代码（只交换一次）
private _bubbleUp(idx: number): void {
  let parent = Math.floor((idx - 1) / 2);
  if (this.heap[idx].priority > this.heap[parent].priority) {
    [this.heap[idx], this.heap[parent]] = [this.heap[parent], this.heap[idx]];
  }
}

// ✅ 修复（循环到根节点）
private _bubbleUp(idx: number): void {
  while (idx > 0) {
    const parent = Math.floor((idx - 1) / 2);
    if (this.heap[idx].priority > this.heap[parent].priority) {
      [this.heap[idx], this.heap[parent]] = [this.heap[parent], this.heap[idx]];
      idx = parent;
    } else {
      break;
    }
  }
}
```

**受影响的测试**:
| Test | 当前 | 修复后 |
|------|------|--------|
| `should process job by priority` | results=[1,3,5]（期望 [5,3,1]） | ✅ |
| `should cancel pending job` | cancel() 返回 `false`（期望 `true`） | ✅（heap 正确后 job 保持 pending 可取消） |

**附加修复**: `cancel('unknown', ...)` job 没有 handler，JobScheduler 会尝试执行并可能抛错。建议 `_doRun()` 捕获 handler 不存在的情况，将 job 标记为 `failed` 而非崩溃。

**验收**: `tests/t60-job-scheduler.test.ts` → 3/3 PASS

---

## R18-Q3: TimeSeries `toArray()` 修复 (P0)

**File**: `electron/workers/time-series.ts`

**Bug**: `toArray()` 返回顺序不正确。手动 trace 结果正确，但测试报 `arr[0].value=1` 而非 3。

**可能的根因**:
- `start` 计算 `(head - count + capacity) % capacity` 在特定 head 值时有误
- 或者 `push()` 的 head 更新逻辑有 off-by-one

**调查方向**:
```typescript
// 当前 toArray() start 计算
const start = (this.head - this.count + this.capacity) % this.capacity;

// capacity=5, push(1~7) 后 head=2, count=5
// start = (2 - 5 + 5) % 5 = 2 % 5 = 2 ✓
// 结果: [3,4,5,6,7] ✓（但测试报 [1,2,3,4,5]）

// 可能问题: push() 中 head 更新时机
// 当前: 先写 buffer[head]=point，再 head=(head+1)%cap
// 测试期望: 以"最后写入的5个元素"为结果
```

**修复方向**: 重写 `toArray()` 确保从 buffer 最旧元素开始遍历：
```typescript
toArray(): TimeSeriesPoint[] {
  if (this.count === 0) return [];
  const result: TimeSeriesPoint[] = [];
  const start = (this.head - this.count + this.capacity + this.capacity) % this.capacity;
  for (let i = 0; i < this.count; i++) {
    const idx = (start + i) % this.capacity;
    result.push(this.buffer[idx]);
  }
  return result;
}
```

**验收**: `tests/t70-time-series.test.ts` → 3/3 PASS

---

## R18-Q4: t105 Electron 环境修复 (P2)

**File**: `tests/t105-database-manager.test.ts`

**Error**: `Electron failed to install correctly, please delete node_modules/electron and try installing again`

**修复**: 运行 `Remove-Item -Recurse node_modules/electron; npm install electron` 或在测试配置中跳过 electron 相关测试（标记 `@skipIfNoElectron`）

**注意**: 这是环境问题，不是源码 bug。优先用 `npm install electron --save-dev` 修复。

**验收**: t105 suite 可运行（结果可 skip/pending，不阻塞 0 fail）

---

## R18-Q5: Sprint 1 E2E 冒烟测试 (P1)

新增一个综合 E2E 测试文件 `tests/sprint1-smoke.test.ts`，串联验证：

```
PaperTrader → RiskEngine → StrategyEngine → NL Parser
```

确保 Round 14-17 所有核心模块集成后系统可跑通。

**覆盖**:
- `PaperTrader` 下单 → `RiskEngine` 风控检查
- `StrategyEngine` 信号 → `PaperTrader` 执行
- `NLParser` 解析 → `StrategyEngine` 执行
- `RiskEngine` 黑名单股票被拒绝

**验收**: Sprint 1 smoke tests → 全部 PASS

---

## 统一验收标准

| 检查项 | 标准 |
|--------|------|
| `npx vitest run` | **0 fail**（t105 可 skip） |
| `npm run build` | **0 error** |
| 每个任务 | 独立 commit + >=3 tests / >=100 lines |
| Sprint 1 smoke | 全部 PASS |

---

## 任务分工建议

| Agent | 任务 |
|--------|------|
| **QClaw** | R18-Q1 (StateMachine) + R18-Q2 (JobScheduler) + R18-Q3 (TimeSeries) |
| **JVS** | R18-Q4 (Electron env) + R18-Q5 (E2E smoke) |
| **WorkBuddy** | PM 协调，确认分工 |

---

## Timeline

- **R18-Q1~Q3**（QClaw）: 1轮迭代，30分钟内完成
- **R18-Q4~Q5**（JVS）: 独立进行
- **最终验证**: 全量 `npx vitest run` → 0 fail

---

## Risk

| Risk | Mitigation |
|------|------------|
| TimeSeries `toArray()` 根因不确定 | 先写一个调试脚本 trace buffer 状态，确认后再修复 |
| t105 Electron 安装失败 | 跳过 electron 测试，标记 `@env:node` 只跑 node 环境 |
| Q2 的 cancel 问题需 `_doRun` 修改 | `_doRun` 捕获 handler 不存在 → job.failed |
