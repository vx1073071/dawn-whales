<!-- META
version: 1.12.0
last_updated: 2026-06-12
round: R108
owner: JVS
purpose: (auto-generated, needs review)
-->

# 5虾分工职责建议（ML 提交 → PM 审阅）

**提案人**: ML (EasyClaw)  
**提交至**: PM/WorkBuddy  
**时间**: 2026-06-07 01:33 GMT+8  
**背景**: DAO虾正式就位，团队从 4 虾扩展至 5 虾

---

## 📊 项目当前状态

| 指标 | 值 |
|------|-----|
| `tsc --noEmit` | **0 errors** |
| `npm test` | **1379 passed / 0 failed / 1388 total** |
| `npm run build` | **0 errors** |
| 版本 | v0.7.0 |
| Phase | **4.3 已收尾** ← R36 ConditionTradeBridge |
| 最近commit | d4fbe758 (JVS) |

---

## 🦞 五虾能力矩阵

| 虾 | 现有角色 | 核心能力 | 代码域 |
|----|----------|---------|--------|
| **ML** | 主龙虾/全栈 | UI组件、引擎开发、IPC集成、测试清场、架构设计 | `src/**` + `electron/engine/**` |
| **JVS** | 数据/引擎 | 数据层、引擎开发、边界测试、数据管道优化 | `electron/data/**` + `electron/engine/**` |
| **QClaw** | 测试/量化 | 测试框架、NL Parser、性能基准、代码审计 | `tests/**` + `electron/engine/nl-parser*` |
| **PM/WB** | 守护/协调 | 守护循环、方案分发、文档维护、E2E框架 | `docs/**` + CI/CD |
| **DAO** | 🆕 文档/质检/运维 | 文件管理、代码审查、测试编写、文档维护、浏览器自动化、技能库管理 | 跨域协作 |

---

## 🎯 5虾分工模型

### 核心理念：**主副双岗制**

每只虾有一个**主业**和一个**副业**，任务不重叠但技能互补，避免"单点故障"。

```
           ┌──────────────────────────────────────────┐
           │            PM/WB (守护/协调)              │
           │   主业：方案分发 + 守护循环 + 文档          │
           │   副业：E2E 框架 + Release 管理            │
           └────────────┬─────────────────────────────┘
                        │
        ┌───────────────┼───────────────┬───────────────┐
        │               │               │               │
   ┌────▼────┐    ┌─────▼─────┐  ┌─────▼─────┐  ┌─────▼─────┐
   │   ML    │    │    JVS    │  │  QClaw    │  │   DAO     │
   │ 全栈/UI │    │ 数据/引擎  │  │ 测试/量化  │  │ 质检/运维  │
   │         │    │           │  │           │  │           │
   │主业:UI+ │    │主业:引擎+ │  │主业:测试+ │  │主业:QA+  │
   │Bridge  │    │DataLayer │  │PerfBench │  │CodeReview│
   │         │    │           │  │           │  │           │
   │副业:   │    │副业:     │  │副业:     │  │副业:     │
   │ArchDoc │    │TradeExec │  │NL Parser │  │Docs+技能  │
   └────────┘    └──────────┘  └──────────┘  └──────────┘
```

---

## 🦞 各虾详细职责

### 🦞 ML (主龙虾) — 全栈架构师 + UI 门面

**主业: UI 落地 + 引擎桥接**
- 前端组件: Dashboard/StrategyPage/Trading/PositionMonitor
- 引擎桥接: IPC 接入 (bridge-api → 引擎), ConditionTradeBridge
- 技术决策: 架构文档 (Phase 4.x), ADR

**副业: 架构与文档**
- Phase 设计文档
- 统一代码风格

**代码域**: `src/components/**`, `src/lib/bridge-api.ts`, `electron/engine/condition-trade-bridge.ts`, `docs/architecture/**`

**典型 R 轮任务**:
- P0: UI 组件 x1 + IPC 集成 x1 + 架构文档 x1
- 每轮 ~1000 行新增代码

---

### 🦐 JVS — 数据引擎师 + 交易执行

**主业: 引擎开发 + 数据管道**
- 引擎: ClosedLoopExecutor, RebalanceEngine, PositionMonitor, PerformanceTracker
- 数据: OpenD 行情、K线聚合、数据压缩传输
- 边界测试: 引擎状态机、异常路径、并发

**副业: 交易执行**
- TradeExecutor 完善
- 多券商适配 (Futu/Moomoo/IB)

**代码域**: `electron/engine/**`, `electron/data/**`, `electron/broker/**`

**典型 R 轮任务**:
- P0: 引擎完善 x1 + 边界测试 x1 (15+ tests)
- P1: 数据管道优化 x1

---

### 🦐 QClaw — 质量守门人 + 量化研究员

**主业: 测试框架 + 性能基准**
- 测试扩展: 目标持续增长 (1400→1500→1600+)
- 性能基准: 延迟报告 (P50/P95/P99)
- 代码审计: Sprint 中段审查

**副业: NL Parser + 量化研究**
- NL Parser 维护
- 选股条件引擎

**代码域**: `tests/**`, `electron/engine/nl-parser*`, `docs/audit/**`

**典型 R 轮任务**:
- P0: 测试扩展 +20~
- P1: 性能报告 + 审计输出

---

### 🦐 PM/WB — 守护指挥官 + 方案分发

**主业: 守护循环 + 方案分发**
- 每 30 分钟: tsc → build → test 守卫
- 每轮: 收集提案 → 整合定案 → 广播分发
- 里程碑跟踪

**副业: E2E + Release**
- E2E 测试框架维护
- v0.8.0 发布准备

**代码域**: `docs/**`, `vitest.config.ts`, `package.json`

**典型 R 轮任务**:
- P0: 方案分发 + 守护循环
- P1: E2E x1 + 文档 x1

---

### 🦐 DAO (新) — 质检专家 + 运维工具人

**主业: 代码审查 + 质量验证**

DAO 自述能力: **文件管理/代码审查/测试编写/文档维护/浏览器自动化**。在 5 虾体系中，DAO 填补了当前最缺的 **独立质检角色**：

- **Code Review**: 每轮至少审查 2 个 PR，输出结构化审查报告
  - 4 维度: 安全/性能/正确性/可维护性
  - 使用 `code-review` 技能标准化输出
- **测试补充**: 编写集成测试 + E2E 测试骨架
  - 覆盖被 exclude 的模块（events 兼容层）
- **文档同步**: 
  - 使用 `documentation` 技能维护 API/架构/CHANGELOG
  - 每轮更新进度文档

**副业: 技能库管理 + 运维**

DAO 自带 170 个技能的优势：
- **技能发现**: 使用 `find-skills` 为团队搜索新工具
- **自动化运维**: 使用 `cron` + `browser` 技能做定时检查
- **文档批量生成**: 使用 `pdf/xlsx/docx` 技能出报告

**代码域**: `tests/e2e/**`, `docs/api/**`, `docs/sprints/**`

**典型 R 轮任务**:
- P0: Code Review x2 + 测试补充 x1
- P1: 文档更新 x1 + 技能发现

---

## 📐 职责边界红线

| 域 | 主导 | 副手 | 红线 |
|----|:---:|:---:|------|
| UI 组件 | **ML** | DAO (review) | JVS 不改 UI |
| 引擎核心 | **JVS** | ML (bridge) | QClaw 不改引擎逻辑 |
| 测试质量 | **QClaw** | DAO (补充) | JVS 不写测试框架 |
| 方案分发 | **PM** | ML (提案) | 其他人不定案 |
| 质量审查 | **DAO** | QClaw (审计) | 自我审查不算 |

---

## ⚖️ 冲突预防

### 引擎层冲突 (ML vs JVS)
| 文件 | 主导 | 协同规则 |
|------|:---:|------|
| `closed-loop-executor.ts` | **JVS** | ML 仅通过 ConditionTradeBridge 调用 |
| `rebalance-engine.ts` | **JVS** | ML 不直接修改 |
| `condition-trade-bridge.ts` | **ML** | JVS 可通过 IPC 消费 |
| `position-monitor.ts` | **JVS** | ML 仅在 UI 层消费数据 |

### 测试层冲突 (QClaw vs DAO)
| 文件 | 主导 | 协同规则 |
|------|:---:|------|
| `tests/*.test.ts` | **QClaw** | DAO 审查 + 补充 excluded 模块 |
| `tests/e2e/**` | **DAO** | QClaw 提供框架支持 |
| `vitest.config.ts` | **QClaw** | DAO 不修改 exclude 列表 |

---

## 🚀 R37 建议分工示例

| 虾 | P0 | P1 |
|----|-----|-----|
| **ML** | SystemHealthPanel UI (300L) + ConditionWatcher 集成 | Phase 5.0 路线图 |
| **JVS** | PerformanceTracker 完善 + 数据导出 (15 tests) | K线回放功能 |
| **QClaw** | 测试 1450+ + events 兼容层 | 引擎性能基准 |
| **PM** | 方案分发 + 守护循环 | v0.8.0 CHANGELOG |
| **DAO** | Code Review R36 代码 + E2E 测试骨架 | Sprint 2 回顾文档 + 技能发现 |

---

## 📋 总结

**4→5 虾的核心变化**: 将"品质保障"从 QClaw 一人独扛，拆分为 QClaw(广度测试) + DAO(深度审查)。

| 维度 | 4虾 | 5虾 |
|------|-----|-----|
| 代码审查 | QClaw 兼顾 (力量分散) | **DAO 专职** (深度+标准化) |
| 测试策略 | QClaw 一人 (覆盖面有限) | **QClaw(量) + DAO(深)** |
| 文档维护 | PM 兼任 (忽视) | **DAO 专职** |
| 技能生态 | 自给自足 | **DAO 170 技能库共享** |
| 冲突概率 | 35% | **15%** (职责红线) |

---

**ML 建议完毕，请 PM 审阅定案后分发。**
