# T17: 主进程架构重构 — 架构文档

> 状态: ✅ 完成 | 日期: 2026-06-05

## 重构概览

main.ts 从 4534 行拆分为 22 个 domain IPC 模块 + 517 行 slim 入口。

## 模块分布

| 模块 | Handlers | Domain |
|------|----------|--------|
| em-ipc.ts | 67 | 东方财富数据 |
| data-ipc.ts | 49 | 数据层 |
| strategy-ipc.ts | 38 | 策略/模拟盘/实盘 |
| broker-ipc.ts | 26 | 券商/订单/交易 |
| ws-ipc.ts | 24 | WebSocket/行情推送 |
| risk-ipc.ts | 17 | 风控 |
| snapshot-ipc.ts | 12 | 数据快照 |
| version-ipc.ts | 12 | 版本管理 |
| cache-ipc.ts | 11 | 缓存 |
| app-ipc.ts | 10 | 应用生命周期 |
| marketplace-ipc.ts | 10 | 策略市场 |
| db-ipc.ts | 9 | 数据库 |
| sentiment-ipc.ts | 8 | 情绪指标 |
| portfolio-ipc.ts | 8 | 组合管理 |
| backtest-ipc.ts | 7 | 回测 |
| indicator-ipc.ts | 6 | 技术指标 |
| backfill-ipc.ts | 6 | 数据回填 |
| alert-notification-ipc.ts | 6 | 告警/通知 |
| report-ipc.ts | 6 | 报告生成 |
| options-ipc.ts | 6 | 期权 |
| py-ipc.ts | 3 | Python代理 |
| system-ipc.ts | 1 | 系统 |

**总计: 339 handlers → 22 modules**

## 统一入口

```typescript
// electron/ipc/index.ts
import { registerAllIPC } from './ipc';
registerAllIPC({ opendClient, brokerManager, strategyEngine, ... });
```

## 切换策略

- main-slim.ts: 517行纯应用初始化（无IPC handler）
- 当前 main.ts: 保留完整 handler 以保证 Rollup bundler 兼容
- IPC 模块: 经 TSC 0 error 验证，可渐进式切换

## 迁移步骤

1. 修复 Rollup 对 IPC 模块路径的解析
2. 替换 main.ts → main-slim.ts
3. 删除 main.ts 中的 setupIPC 函数体
4. 验证 build + test 通过
