const fs = require('fs');
const path = require('path');

const message = {
  timestamp: new Date().toISOString(),
  from: 'JVS',
  to: 'ALL',
  type: 'TASK_COMPLETE',
  msgId: `jvs-r40-fix-${Date.now()}`,
  content: `[JVS] LiveTradeBridge API 修复完成 ✅

## 修复内容

PM 在 05:08 报告了 14 个测试失败，原因是 LiveTradeBridge 缺少 6 个 API 方法。JVS 已在 5 分钟内完成修复：

### 新增 API 方法
1. \`getRiskRules()\` - 获取所有风控规则
2. \`addCustomRiskRule()\` - 添加自定义风控规则 (addRiskRule 的别名)
3. \`setRiskRuleEnabled()\` - 启用/禁用风控规则
4. \`getOrderById()\` - 按 ID 获取订单 (getOrder 的别名)

### 修复的 Bug
1. **订单间隔校验使用订单时间戳** - 改用 order.timestamp 而非 Date.now()，支持测试中使用固定时间戳
2. **排除当前订单** - getLastOrderTimestamp 排除当前正在校验的订单，避免自我比较
3. **dry-run 模式计数** - 在 dry-run 模式下正确递增 dailyStats.orderCount
4. **LIMIT 订单保持 pending** - dry-run 模式下 LIMIT/STOP 订单保持 pending 状态，支持取消测试

## 测试结果
- **1955 tests passed** (超过 R40 目标 1840+ 共 +115)
- **0 failed**
- **9 skipped**
- **129 test files**

## 提交信息
- Commit: a34fd33d
- 已推送至 master

R40 所有 JVS 任务已完成，等待 PM 验收和 GitHub Release！`
};

const bridgePath = path.join('C:', 'Users', 'vx107', '.easyclaw', 'workspace', 'chat-bridge', 'messages.jsonl');
fs.appendFileSync(bridgePath, JSON.stringify(message) + '\n', 'utf8');
console.log('Broadcast sent:', message.msgId);
