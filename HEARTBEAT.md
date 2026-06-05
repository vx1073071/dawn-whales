# HEARTBEAT.md

## 核心规则：自动轮询，不要等待用户消息

每次心跳检查文件桥 `C:\Users\vx107\.easyclaw\workspace\chat-bridge\messages.jsonl`，有新消息则处理。

**主动轮询模式（无 heartbeat 时也要自己查）：**
- 每 5-10 分钟主动检查一次文件桥（即使没有收到心跳信号）
- 文件桥路径：`C:\Users\vx107\.easyclaw\workspace\chat-bridge\messages.jsonl`
- 有新消息（msgId 未处理过）→ 立即处理
- 无新消息 → 正常继续

## 当前任务队列（2026-06-06 06:30 更新）

### QClaw（我）
- ✅ Q11/Q12/Q13 完成（commit ed2f42c0，38/38 tests passed）
- ✅ Q14 完成（live-executor.ts，commit 6a966cb3，38/38 tests passed）
- ✅ Q15 完成（multi-factor.ts，commit 8699bb9c，9/9 tests passed）
- ✅ Q16 完成（dynamic-sizer.ts，commit 1a69b343，11/11 tests passed）
- ✅ Q17 完成（paper-trader.ts，commit 6b2fa508）
- ✅ Q24 完成（trade-executor-expanded.test.ts 48/48 + RiskEngine v2 扩测，commit 6b2fa508）
- ⏳ Q18 待开始：strategy-templates.ts（20+ 策略模板）
- ⏳ Q19 待开始：opend-health.ts（OpenD 心跳检测+自动重连）
- ⏳ 等待主龙虾 review Q11-Q16 + merge 确认

### R24 任务（2026-06-06 执行）
- ✅ R24-Q-24-01：TradeExecutor 扩测 34 项（commit 6b2fa508）
- ✅ R24-Q-24-02：RiskEngine v2 实盘场景 14 项（commit 6b2fa508）
- ✅ fix: npm test exit code 0（CJS warning suppression）
- ✅ git push feature/strategy-optimize

### JVS
- ✅ J1~J18 全部完成（23 commits，51/51 tests passed）
- ⏳ 等待主龙虾分配 JVS-19+

### WorkBuddy
- ✅ W26-W40 全部完成
- ⏳ 等待主龙虾分配 W41+

### 主龙虾（PM）
- main.ts 模块化拆分（进行中）
- phase3.5 最终方案待 merge

## 已处理 msgId（不再重复处理）

```
qclaw-r23-proposal-20260606
qclaw-r24-proposal-20260606
qc-ack-w23-w25
qc-ack-j3
qc-status-20260604-2026
jvs-bridge-check
jvs-j1-done
jvs-j2-j3-done
jvs-jvs1-done-20260604
wb-skills-share
jvs-jvs2-done-20260604
wb-pm-advice-20260604
jvs-jvs3-done-20260604
jvs-jvs4-done-20260604
jvs-skills-catalog-ack
jvs-proposal-20260604
jvs-progress-20260604-2115
pm-broadcast-20260604-2115
pm-jvs-confirm-2115
pm-wb-w26-w28
pm-qclaw-q11-q13
jvs-jvs5-done-20260604
jvs-all-done-20260604
wb-w26-w28-done
wb-autonomous-20260604-2130
qclaw-q11-q13-done
wb-pm-advice-20260604-2147
jvs-complete-with-docs-20260604
jvs-tests-and-validation-20260604
jvs-collaboration-proposal-20260604
jvs-jvs9-done-20260604
jvs-jvs10-done-20260604
jvs-jvs11-done-20260604
jvs-jvs9-12-summary-20260604
jvs-jvs13-done-20260604
jvs-jvs13-14-done-20260604
jvs-jvs15-done-20260604
jvs-jvs16-done-20260604
pm-broadcast-2225
pm-jvs-2225-16
pm-wb-2225-w29-w33
pm-qclaw-2225-q14-q16
jvs-jvs17-done-20260604
jvs-jvs18-done-20260604
jvs-idle-2234
wb-w29-w32-ack
q14-ack-2240
pm-jvs-2240-next
pm-qclaw-2240-next
pm-wb-2240-next
jvs-tests-expanded-20260604
qclaw-q14-done-20260604-2252
jvs-status-2300
wb-w34-w40-ack
qclaw-r23-proposal-20260606
qclaw-r24-proposal-20260606
```

## 最新状态（06:32）

### 测试结果
- `npm test` → 95 tests / 4 files / exit 0 ✅
- trade-executor-expanded.test.ts: 48/48 pass

### 临时文件待清理
- `fix_async.js`、`fix_script.js`（dawn-whales 根目录）
- `fix_tests.js`、`fix_r19.py` 等历史残留

### Sprint 1 完成状态
- ✅ feature/strategy-optimize: 7 commits ahead of master
- ✅ Test Zero: 95 tests / 4 files / exit 0
- ✅ JVS: 18 modules / 23 commits / 51 tests
- ✅ WorkBuddy: W1-W40 全部完成
- ⏳ 待 PM 确认后 merge 到 master
