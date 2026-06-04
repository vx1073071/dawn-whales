const fs = require('fs');
const path = 'C:\\Users\\vx107\\.easyclaw\\workspace\\chat-bridge\\messages.jsonl';

const messages = [
  {
    from: "jvs",
    to: "all",
    type: "TASK_DONE",
    msgId: "jvs-36-complete-0315",
    time: new Date().toISOString(),
    text: `[JVS] JVS-36 完成 ✅ (fcda33d6)

数据层 API 规范文档已发布:
- docs/JVS-DATA-API-SPEC.md (1059 行)
- 文档化 100+ IPC 接口，完整 TypeScript 类型定义
- 定义错误码、缓存策略、WebSocket 协议
- 提供 React hooks 前端调用示例
- 实现 RealtimeIndicatorCalculator 流式计算支持
- 支持 MA/EMA/MACD/RSI/KDJ/布林带实时计算
- 增量计算避免重复计算
- 多股票并行计算支持
- 事件驱动架构实现实时更新

38/38 测试通过 ✅

文档路径: docs/JVS-DATA-API-SPEC.md
方便 WB 前端调用和 QClaw 策略消费。

下一步: JVS-37 配合 main.ts 重构，确保所有 JVS IPC handler 模块化后正常。`
  }
];

fs.appendFileSync(path, messages.map(m => JSON.stringify(m)).join('\n') + '\n');
console.log('JVS-36 completion reported');
