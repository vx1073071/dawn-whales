# HEARTBEAT.md — DAWN WHALES 项目进度追踪

## 核心规则：自动轮询，不要等待用户消息

每次心跳检查文件桥 `C:\Users\vx107\.easyclaw\workspace\chat-bridge\messages.jsonl`，有新消息则处理。

**主动轮询模式：**
- 每 5-10 分钟主动检查一次文件桥
- 文件桥路径：`C:\Users\vx107\.easyclaw\workspace\chat-bridge\messages.jsonl`
- 有新消息（msgId 未处理过）→ 立即处理
- 无新消息 → 正常继续

---

## 项目总览 (2026-06-06 06:51 更新)

### 构建状态
- ✅ TSC: 0 errors
- ✅ Build: 0 errors, 0 warnings
- ✅ Tests: 116/116 passed / 5 files / exit 0
- ✅ .exe installer: v0.5.0 (113 MB)
- ✅ Branch: feature/strategy-optimize
- ✅ Latest commit: 8e7d4059

### 代码统计
- Engine: 12 files (ws-market-data, trade-executor, futu-mock-feed, futu-ws-adapter, ws-trade-bridge, moomoo-adapter 等)
- Broker: 4 files (IBrokerAdapter, FutuOpenDClient, BrokerManager, MoomooAdapter)
- Components: 25 tsx files
- Tests: 9 test files, 116 tests

---

## 各虾任务状态

### JVS (我)
| Round | 任务 | 状态 | Commit |
|-------|------|------|--------|
| R16-R22 | 后端引擎 JVS-83~108 (26 modules) | ✅ | 多个 commits |
| R23 | preload trade/ws 桥接 + Risk/Alert 页面 + WS-Trade bridge | ✅ | 多个 commits |
| R24/R25 | WS-Trade E2E (21 tests) + Risk/Alert 实时 + Moomoo Adapter + Multi-Broker Design + Phase 3 规划 | ✅ | 8e7d4059 |
| R25-J-04 | HEARTBEAT.md 更新 | ✅ | 本轮 |
| R25-J-05 | MarketPage WS 实时行情增强 | ✅ | 本轮 |

### 主龙虾 (ML)
| Round | 任务 | 状态 |
|-------|------|------|
| R24 | .exe 打包 v0.5.0 + WS 集成 + 测试标准化 | ✅ |
| R25-ML-01 | E2E 扩展 21→30 tests | ⏳ |
| R25-ML-02 | v0.6.0 版本打包 + CHANGELOG | ⏳ |
| R25-ML-03 | TradeDashboard 真实 IPC (移除 MOCK) | ⏳ |

### QClaw
| Round | 任务 | 状态 |
|-------|------|------|
| R24 | TradeExecutor 扩测 48/48 + RiskEngine v2 | ✅ |
| R25-Q-01 | npm test exit code 稳定化 | ⏳ |
| R25-Q-02 | 性能基线报告 | ⏳ |

### PM/WB
| Round | 任务 | 状态 |
|-------|------|------|
| R25-WB-01 | Sprint 1 Demo 录制 (≥10 场景) | ⏳ |
| R25-WB-02 | Build + Test 守门 | ⏳ |
| R25-WB-03 | Phase 3 规划审阅 + 执行板 | ⏳ |

---

## 关键技术债务

| 项目 | 优先级 | 负责 |
|------|--------|------|
| TradeExecutor expanded 16 fail (QClaw) | P0 | QClaw |
| Demo 录制 | P0 | WB |
| v0.6.0 installer | P0 | ML |
| TradeDashboard 移除 mock | P1 | ML |
| 性能基线报告 | P1 | QClaw |
| Moomoo 真实 API 实现 | P1 | JVS (Sprint 2) |
| IB 适配器 | P2 | JVS (Sprint 2) |

---

## 已处理 msgId（不再重复处理）

```
qclaw-r23-proposal-20260606
qclaw-r24-proposal-20260606
wb-r24-plan-final-20260606-0620
jvs-r25-complete-20260606-0645
jvs-r26-proposal-20260606-0650
wb-r25-plan-final-20260606-0645
```
