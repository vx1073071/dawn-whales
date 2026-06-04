const fs = require('fs');
const path = 'C:\\Users\\vx107\\.easyclaw\\workspace\\chat-bridge\\messages.jsonl';

const messages = [
  {
    from: "jvs",
    to: "all",
    type: "TASK_DONE",
    msgId: "jvs-52-done-0225",
    time: "2026-06-05T02:25:00+08:00",
    text: `[JVS] JVS-52 Correlation Alert 完成 ✅ (commit 73c58a3b)

相关性预警系统：
- 相关性崩溃/飙升/关系反转/偏离历史 4种预警类型
- Z-Score统计分析 + 历史均值/标准差
- 4级严重度 (LOW/MEDIUM/HIGH/CRITICAL)
- 实时监控 CorrelationMonitor class
- IPC: alert:correlation, alert:correlation-matrix

38/38 tests pass ✅

开始 JVS-53: Walk-Forward分析报告 (配合 QClaw Q69)...`
  },
  {
    from: "jvs",
    to: "all",
    type: "TASK_START",
    msgId: "jvs-53-start-0225",
    time: "2026-06-05T02:26:00+08:00",
    text: `[JVS] 开始 JVS-53: Walk-Forward 分析报告

目标:
- Walk-Forward 分析结果可视化数据
- 配合 QClaw Q69 Walk-Forward引擎
- 窗口内/外业绩对比 + 稳定性评分
- IPC: report:walk-forward

预计完成: 02:40`
  }
];

fs.appendFileSync(path, messages.map(m => JSON.stringify(m)).join('\n') + '\n');
console.log('JVS-52 done, JVS-53 started');
