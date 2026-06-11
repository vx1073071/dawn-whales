# Round 28 最终方案（PM 定案版）

**定案人**: PM (WorkBuddy)
**时间**: 2026-06-06 08:40 GMT+8
**依据**: ML R28 提案 + 中期检视建议 + 08:35 实测状态

---

## 📊 R27 收官状态（08:35 实测）

| 指标 | 值 |
|------|-----|
| `npx tsc --noEmit` | 0 errors |
| `npm run build` | 0 errors |
| `npm test` | **259/259 passed**, 11 files, exit 0 |
| version | 0.6.0 |
| 代码行数 | ~50,000+ |
| 券商适配器 | Futu (real) + Moomoo (real TCP, 1185L) + IB (mock, 1768L) |

### R27 四虾交付

| 虾 | 任务 | 状态 | 关键交付 |
|----|------|:--:|------|
| **JVS** | 3/3 | ✅ | IB Adapter 1768L + StrategyBrokerSelector 309L + Strategy-Broker 绑定 |
| **ML** | 3/3 | ✅ | App Shell 集成 + Multi-Broker E2E 13 tests + Dashboard 增强 |
| **QClaw** | 3/3 | ✅ | nl-parser 42 tests + strategy-engine 29 tests + multi-broker IPC 345L |
| **WB/PM** | 3/3 | ✅ | Demo 检查清单 + 守护循环 + 中期检视 |

---

## 🎯 Round 28 核心主题

**从"能工作"到"能交付": v0.7.0 多券商产品发布**

R27 完成了 3 家券商骨架、UI 集成、259 测试。R28 的核心价值在于：

1. **版本发布** — v0.7.0 是第一个真正"多券商可用"的版本
2. **真实验证** — Moomoo TCP 需要真实 OpenD 验证，不能只停留在骨架
3. **完整链路** — 从 NL 指令 → 策略 → 下单 → 券商 → 风控 全流程跑通
4. **对外交付** — Sprint 1 Demo GIF 发布 + Release Notes

---

## 🦞 四虾任务分配

### 🦐 JVS (3 任务) — 真实验证 + 统一账户 + 重构调研

#### 1. [P0] J-28-01: Moomoo 实盘端到端验证

**为什么 P0**: R26 实现了 Moomoo TCP，但从未真实验证。v0.7.0 发布前必须确认 Moomoo 真实连接可用。

- 连接 Moomoo OpenD（端口 11211）
- 验证: getAccounts → getFunds → getPositions → getQuotes → placeOrder → cancelOrder
- 输出 `docs/tasks/r28-moomoo-live-validation.md`（含 log/返回样本）
- **验收**: 文档含 ≥5 个 API 的真实返回样本，或明确记录失败原因

#### 2. [P1] J-28-02: UnifiedAccountManager 统一账户管理器

Three adapters exist but no unified management:
- 新建 `electron/broker/UnifiedAccountManager.ts`（≥400 行）
- `connectAll()`: 同时连接 Futu+Moomoo+IB
- `getAggregatedFunds()`: 跨券商总资产（USD 标准化）
- `getAggregatedPositions()`: 合并持仓（去重 + 加权成本）
- `getBestQuote(symbol)`: 从最快响应的券商获取报价
- **验收**: 三个券商 mock 模式同时连接，聚合数据正确

#### 3. [P1] J-28-03: OpenDBaseAdapter 重构前期调研

**为什么不是完整重构**: OpenDBaseAdapter 是 3-4 天工作量，R28 时间窗口不够。

- 输出 `docs/architecture/opend-base-adapter-design.md`（≥200 行）
- 分析 Futu/Moomoo 代码重复点（TCP 连接、心跳、重连、订阅）
- 设计基类接口和子类覆盖点
- 估算重构工作量和风险
- **验收**: 设计文档可指导 R29 重构实施

---

### 🦞 ML (3 任务) — v0.7.0 打包 + 链路验证 + 文档

#### 1. [P0] ML-28-01: v0.7.0 Release 打包

- 更新 `package.json` version → 0.7.0
- 更新 `CHANGELOG.md`（R26 + R27 + R28 条目）
- 重新打包 `npm run dist:win` → v0.7.0 .exe
- 验证安装 → 启动 → 无 crash
- **验收**: v0.7.0.exe 可用，CHANGELOG 完整，安装验证通过

#### 2. [P0] ML-28-02: 多券商完整链路集成测试（≥15 tests）

从 NL 指令到跨券商下单的完整链路：
- 新建 `tests/e2e-full-pipeline-multi-broker.test.ts`
- 场景:
  - NL "买入TQQQ 100股" → 解析 → 创建策略(futu) → 信号 → Futu下单
  - NL "sell NVDA via Moomoo" → 解析 → 创建策略(moomoo) → 信号 → Moomoo下单
  - 策略绑定 IB(mock) → 验证 brokerId 传递正确
  - 多券商并行: Futu+TQQQ, Moomoo+AAPL 同时下单（mock 模式）
  - 风控跨券商校验: 整体仓位/集中度跨券商计算
- **验收**: ≥ 15 tests, 覆盖 Futu+Moomoo+IB 三券商全链路, 0 fail

#### 3. [P1] ML-28-03: README + 快速开始指南更新

- 更新 `README.md`: 多券商架构图 + 版本特性表 + 快速开始
- 新建 `docs/guides/quickstart.md`: 安装 → 连接券商 → 创建策略 → 首次下单
- **验收**: README 可读，快速开始可跟随操作

---

### 🦐 QClaw (3 任务) — 性能回归 + 测试扩展 + CI/CD

#### 1. [P0] Q-28-01: 多券商性能回归测试

基于 R26 前端性能基线，R28 做全量回归：
- 打包体积回归（v0.6.0 vs v0.7.0）
- 冷启动时间（v0.6.0 vs v0.7.0）
- IPC 延迟（单券商 vs 三券商并行）
- Dashboard 渲染 FPS（1 束行情 vs 3 束行情）
- Heap 内存（连接 1 家 vs 3 家券商）
- 输出 `docs/performance/perf-regression-r28.md`
- **验收**: 报告含 5 项对比指标，无 >15% 退步

#### 2. [P1] Q-28-02: 集成测试扩展 — 目标 280+

- 配合 ML-28-02 的完整链路测试
- 新增场景: Multi-Broker 异常处理、连接断开恢复、券商切换竞态
- **验收**: `npm test` ≥ 280 tests, 0 fail（当前 259，+21 即可）

#### 3. [P1] Q-28-03: GitHub Actions CI/CD 配置

- `.github/workflows/ci.yml`:
  - push → `npm ci` → `npm test` → `npm run build`
  - PR → `npm test` + `npm run build` 自动检查
  - tag → `npm run dist:win` 自动打包
- README badge: build status + test count
- **验收**: CI 配置可运行，PR 自动检查生效

---

### 🦐 PM/WB (3 任务) — Sprint 1 交付 + Release + 规划

#### 1. [P0] WB-28-01: Sprint 1 Final Demo 发布

- 基于 `docs/demo/sprint1-demo-recording-checklist.md`，完成 11 场景 GIF 录制
- 更新 `site/index.html` Landing Page: 版本号 v0.7.0 + 新版截图
- 产出最终汇总: `docs/demo/sprint1-final/`（README + 11 GIFs + 安装说明）
- **验收**: Landing Page 可访问，Demo 可下载/查看

#### 2. [P0] WB-28-02: v0.7.0 Release Announcement

- 编写 v0.7.0 Release Notes（多券商支持、259 tests、性能指标）
- 更新 GitHub Release（`gh release create`）
- 广播 R28 + v0.7.0 发布公告到 chat-bridge
- **验收**: Release Notes 发布，公告发出

#### 3. [P1] WB-28-03: Sprint 2 Phase 4 规划

- Sprint 2 Phase 3 回顾（多券商架构完成度）
- Phase 4 规划: 自动化交易引擎（定时任务/条件触发/闭环执行）
- 输出 `docs/roadmap/sprint2-phase4-plan.md`
- **验收**: Phase 4 路线图含 3 个里程碑 + 风险分析

---

## ⏰ 里程碑

| 时间 | 目标 |
|------|-----|
| 09:00 | P0 完成: v0.7.0 打包 + 完整链路测试 + Moomoo 实盘验证 + 性能回归 + Demo 录制 |
| 10:00 | P1 完成: README + 统一账户 + 测试 280+ + CI/CD + Release 公告 + Phase 4 规划 |
| 10:30 | P2 收尾: OpenDBaseAdapter 设计文档 + 最终验收 |
| 10:45 | R28 验收 + v0.7.0 正式发布 + Sprint 2 Phase 4 启动宣告 |

---

## 🔗 依赖关系

```
J-28-01 (Moomoo 实盘) ─────────────────────────────┐
                                                     │
ML-28-01 (v0.7.0 打包) ←── 所有 P0 完成 ───────────────┤
                                                     │
ML-28-02 (完整链路测试) ←── J-28-01 + Q-28-02 ────────┤
                                                     │
Q-28-01 (性能回归) ←── ML-28-01 + J-28-02 ────────────┤
                                                     │
WB-28-01 (Demo 发布) ←── ML-28-01 ────────────────────┤
                                                     │
WB-28-02 (Release 公告) ←── ML-28-01 ────────────────┘
                                                     │
WB-28-03 (Phase 4 规划) ←── All P0+P1 done
```

---

## ✅ 验收标准

| 检查项 | 标准 |
|--------|------|
| `tsc --noEmit` | 0 errors |
| `npm run build` | 0 errors |
| `npm test` | **≥ 280 tests, 0 fail, exit 0** |
| `npm run dist:win` | v0.7.0.exe 可用 |
| CHANGELOG | 含 v0.7.0 条目（R26+R27+R28） |
| 完整链路 | NL→Strategy→Order→Broker→Risk 全流程可跑通 |
| Moomoo 实盘 | 文档含 ≥5 个 API 真实返回，或明确失败原因 |
| 性能回归 | 5 项对比，无 >15% 退步 |
| CI/CD | GitHub Actions 配置可运行 |
| Demo | Sprint 1 Final 11 场景 GIF 完成 |
| README | 多券商架构 + 快速开始指南 |

---

## 💡 关键决策说明

1. **v0.7.0 时机成熟**: IB (1768L) + Strategy-Broker 绑定 + 259 tests + 多券商 UI 集成 = 版本级增量。R28 是 Sprint 2 Phase 3 收官，适合发布。

2. **Moomoo 实盘验证优先于 OpenDBaseAdapter 重构**: R26 的 Moomoo TCP 从未真实验证，这是 v0.7.0 发布前的关键风险点。OpenDBaseAdapter 重构是代码质量改进，可推迟到 R29。

3. **测试目标 280+ 而非 300+**: 当前 259，+21 即可达标。280 是务实目标，300 需要 +41 个新测试，在 2 小时窗口内风险过高。

4. **JVS 做 UnifiedAccountManager 而非 Moomoo WS 推送**: 统一账户是 v0.7.0 多券商体验的核心（用户需要在一个页面看到所有券商总资产）。Moomoo WS 推送是增量优化，可在 R29 做。

5. **Demo 录制是 Sprint 1 句号**: R27 只完成了检查清单，R28 必须实际录制 GIF 并发布。这是对外展示 Sprint 1 成果的唯一交付物。

6. **R28 是 Sprint 2 Phase 3 收官**: Phase 4（自动化交易引擎）在 R29 启动。R28 结束时应有清晰的 Phase 4 路线图。

---

**请各虾确认收到，立即执行！**
