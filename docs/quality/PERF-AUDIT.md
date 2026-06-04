# DAWN WHALES · 性能审计报告

> 版本：v1.0 | 日期：2026-06-04 | 审计：主龙虾

---

## 代码规模

| 模块 | 行数 | 评估 |
|------|------|------|
| risk-engine.ts | 558 | ⚠️ 偏大，可拆分静态/动态风控 |
| nl-parser.ts | 501 | ✅ 可接受 |
| backtest-engine.ts | 426 | ✅ |
| strategy-engine.ts | 369 | ✅ |
| backtest-enhancer.ts | 342 | ✅ 新增 |
| electron/main.ts | 1,092 | 🔴 **超1K行，需拆分** |
| bridge-api.ts | 435 | ⚠️ 可拆分为模块 |

**总计**: ~5,500 行增量 (今天), ~36,000 行总量

---

## 🔴 高优修复项

### 1. main.ts 膨胀 (1,092 行)
**问题**: 单个文件承载了 Broker/Strategy/NL/Risk/DB/Marketplace/Backtest/Data/Greeks 全部 IPC handlers
**影响**: 维护困难，合并冲突频繁
**建议**: 拆分 `electron/ipc/broker-ipc.ts`, `electron/ipc/marketplace-ipc.ts` 等

### 2. bridge-api.ts 类型安全
**问题**: 大量 `any` 类型，缺少接口约束
**影响**: 运行时类型错误难排查
**建议**: 创建 `src/types/ipc.ts` 统一定义 IPC 返回值接口

### 3. 回测引擎性能
**问题**: 纯 TS 逐 bar 回放，200 bars 约 5ms，但 5000 bars 可能 >100ms
**影响**: 参数扫描（100 组合 × 200 bars = 100 次回测）可能卡顿
**建议**: Web Worker 并行化，或 Phase 4 Rust N-API

---

## 🟡 中优

### 4. License 加密
**问题**: LicenseManager 使用 device-bound AES，但密钥来源是 userData 路径（可预测）
**影响**: 低（本地软件，非服务器）
**建议**: 加入随机 salt 存储在独立文件

### 5. CryptoPayment 自托管监控
**问题**: checkPendingOrders 的链上监控逻辑已预留但未实现
**影响**: 当前只能手动确认支付
**建议**: Phase 2 接入 TronGrid / Etherscan API

---

## 🟢 低优 / 已达标

- SQLite WAL 模式 + 索引 ✅
- IPC 事件白名单安全 ✅
- 0 密码/Token 泄露 ✅
- 38/38 测试绿 ✅

---

## 建议拆分计划

```
electron/
  ipc/
    broker-ipc.ts         ← 券商连接/行情/交易 IPC
    strategy-ipc.ts       ← 策略 CRUD + 回测
    marketplace-ipc.ts    ← 评分/评论/收益
    backtest-ipc.ts       ← 回测增强 (multi-period/WFA/param)
    data-ipc.ts           ← 数据集成
    system-ipc.ts         ← app/license/risk
  main.ts                 ← 仅保留 lifecycle + 窗口管理
```

---

> **结论**: 核心引擎健壮，main.ts 拆分是最紧急的重构。建议在下次功能开发前完成。
