# T25: 状态机驱动连接管理

> 状态: ✅ 已实现 (main.ts auto-reconnect)

## 状态转换
DISCONNECTED → CONNECTING → CONNECTED → AUTHENTICATED → STREAMING

每个状态有 timeout 自动恢复（指数退避 1s→128s, 50次重试）。
实现于 main.ts broker connect 流程。
