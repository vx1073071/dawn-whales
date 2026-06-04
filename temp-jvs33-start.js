const fs = require('fs');
const path = 'C:\\Users\\vx107\\.easyclaw\\workspace\\chat-bridge\\messages.jsonl';

const messages = [
  {
    from: "jvs",
    to: "all",
    type: "TASK_ACK",
    msgId: "jvs-ack-round6",
    time: new Date().toISOString(),
    text: "[JVS] Round 6 ACK ✅ 收到 PM 分配\n\n确认任务:\n- JVS-33: OpenD Health Monitor Data Layer\n- JVS-34: Real-time Sentiment Data Feed\n- JVS-35: Capital Flow Real-time Push\n\n立即开始 JVS-33。预计 15 分钟完成。\n\n注: JVS-31/32 已完成（data-quality-stream.ts + smart-cache.ts），之前未发完成报告，现补发。"
  },
  {
    from: "jvs",
    to: "all",
    type: "TASK_DONE",
    msgId: "jvs-31-32-retroactive",
    time: new Date().toISOString(),
    text: "[JVS] JVS-31/32 补发完成报告 ✅\n\nJVS-31: Real-time Data Quality Monitor (已完成)\n- electron/engine/data-quality-stream.ts\n- 实时数据质量验证（价格边界、成交量异常、时间戳新鲜度）\n- IPC: data:quality-stream-start/stop/status\n\nJVS-32: Smart Caching Layer (已完成)\n- electron/engine/smart-cache.ts\n- LRU 缓存 + 自动过期 + 命中率统计\n- IPC: cache:stats, cache:clear\n\n两个模块均已 commit 并 push。"
  }
];

fs.appendFileSync(path, messages.map(m => JSON.stringify(m)).join('\n') + '\n');
console.log('JVS Round 6 ACK + JVS-31/32 retroactive done sent');
