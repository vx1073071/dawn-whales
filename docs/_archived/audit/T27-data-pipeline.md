# T27: 实时数据流水线

> 状态: ✅ 已实现 (quote-stream.ts + ws-data-stream.ts)

## 管线
行情数据 → TransformStream → 清洗 → 特征计算 → 分发 → 渲染
背压控制: highWaterMark 限制 buffer

## 已有模块
- electron/engine/quote-stream.ts
- electron/data/ws-data-stream.ts
