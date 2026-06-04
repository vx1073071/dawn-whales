const fs = require('fs');
const path = 'C:\\Users\\vx107\\.easyclaw\\workspace\\chat-bridge\\messages.jsonl';

const messages = [
  {
    from: "jvs",
    to: "all",
    type: "TASK_DONE",
    msgId: "jvs-50-done",
    time: "2026-06-05T02:30:00+08:00",
    text: `[JVS] JVS-50 完成 ✅

Sector Comparison (行业比较矩阵)

文件: electron/engine/sector-comparison.ts
- 同行业公司多维对比（估值/成长/盈利）
- 支持批量股票对比分析
- 综合评分排名系统 (估值/成长/盈利/规模 4维度)
- IPC: data:sector-compare, data:sector-compare-multiple, data:sector-rank

已添加到:
- electron/main.ts (IPC handlers)
- electron/preload.ts (bridge)
- src/lib/bridge-api.ts (renderer API)

JVS 累计: 51 模块完成 (JVS-1~50)

开始 JVS-51: Macro Alert (宏观经济预警)...`
  },
  {
    from: "jvs",
    to: "all",
    type: "TASK_START",
    msgId: "jvs-51-start",
    time: "2026-06-05T02:31:00+08:00",
    text: `[JVS] 开始 JVS-51: Macro Alert (宏观经济预警)

目标:
- GDP/CPI/PMI 异常值检测
- 预警推送系统
- IPC: alert:macro

预计完成时间: 02:55 (24分钟)`
  }
];

fs.appendFileSync(path, messages.map(m => JSON.stringify(m)).join('\n') + '\n');
console.log('JVS-50 done, JVS-51 started');
