# WB 移交任务 → 主龙虾

## 背景
PM (WB) 不应承担开发工作。以下任务从 WB 移交给主龙虾。

## 任务清单

### T-ML-WB-01: 连接 RegimeMonitorPage IPC
- **文件**: `src/components/strategy/RegimeMonitorPage.tsx:70`
- **问题**: 当前使用 setTimeout + MOCK_REGIME，TODO 标记为 "wire to QClaw regime-adaptor IPC"
- **要求**:
  1. 确认 QClaw 是否已提供 `regime-adaptor` IPC handler
  2. 如已提供，替换 mock 为真实 IPC 调用
  3. 如未提供，先实现一个基础 stub（返回模拟数据但走 IPC 流程）
  4. 添加 loading / error 状态处理
  5. i18n: 确保所有新增文本使用 `t()`
- **验收**: 页面加载时显示 loading，1-2秒后显示真实/模拟数据，无 console.error

### T-ML-WB-02: 清理/规范化组件中的 console 语句
- **范围**: `src/components/**/*.tsx` 中的 45 处 `console.log/error/warn`
- **要求**:
  1. 新建 `src/lib/logger.ts` — 轻量日志封装
     - `logger.debug/info/warn/error`
     - 开发环境输出到 console，生产环境可配置静默
     - 支持前缀标签（如 `[StrategyPage]`）
  2. 将所有 `console.error('[Error:XXX]', e)` 替换为 `logger.error('XXX', e)`
  3. 移除调试用的 `console.log`
  4. 保留有意义的错误日志（但走 logger）
- **验收**: `grep -rn "console\." src/components/` 结果为 0（除 logger.ts 本身外）

### T-ML-WB-03: 完善 v0.7.0 演示脚本
- **文件**: `docs/demo/v0.7.0-demo-script.md`
- **问题**: 目前只有前3步，缺少完整流程
- **要求**:
  1. 补充剩余步骤（回测 → 下单 → 风控 → 持仓监控 → 策略管理）
  2. 每个步骤包含：操作说明、检查点（checkbox）、截图提示
  3. 添加 "Fallback 计划"：某步骤失败时的备用演示路径
  4. 添加 "风险提示"：演示中可能触发报警的场景
- **验收**: 脚本覆盖从启动到策略管理的完整闭环，>=8个步骤

### T-ML-WB-04: 支付模块 TODO 评估
- **文件**: `src/lib/payment.ts`
- **问题**: 4 个 TODO，涉及 Stripe/微信支付/授权服务器
- **要求**:
  1. 评估当前 payment.ts 的实现完整度
  2. 确定哪些是 v0.7.0 必须，哪些可以推迟到 v0.8.0
  3. 对于 v0.7.0 必须的：创建具体实现任务（分配给 JVS 或自己）
  4. 对于可推迟的：在代码中添加 `@deferred v0.8.0` 注释
  5. 输出评估报告到 `docs/tasks/payment-assessment.md`
- **验收**: 评估报告明确每个 TODO 的优先级和负责人

## 优先级
P0: T-ML-WB-01（影响功能完整性）
P1: T-ML-WB-02（代码质量）
P1: T-ML-WB-03（发布准备）
P2: T-ML-WB-04（规划类）

## 时间要求
- P0 任务: 30 分钟内完成并提交
- P1 任务: 1 小时内完成
- P2 任务: 评估报告即可，无需实现

## 提交要求
- 每个任务完成后 `git commit`，message 包含任务编号
- 完成后在桥消息中回复 `TASK_DONE`
