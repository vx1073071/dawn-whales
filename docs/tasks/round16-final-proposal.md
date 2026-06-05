# Round 16 最终建议方案

## 一、工作完成验证

### JVS
- **已完成**: JVS-83~100 (18 模块, 19,677 行), JVS-109~111 (3 前端页面, 2,773 行)
- **测试**: 桥消息声称 225 测试通过，实际运行 387 测试中 356 通过，31 失败
- **质量**: 代码产出量大，但部分测试与实际实现不同步（如 jvs-83 缺失 fetchFromSources 方法）
- **结论**: 完成度高，但需要修复测试同步问题

### QClaw
- **已完成**: Q17/Q18/Q19/Q44/Q45/Q46 (6 个任务)
- **未完成**: Q47~Q151 (Round 15 后续任务) 全部未开始
- **18:54 后**: 无新提交，无新桥消息
- **结论**: Round 15 实际进度约 6%，严重滞后

### 主龙虾
- **已完成**: T82~T100 (Docker/Kafka/gRPC/Redis/Prometheus/安全/负载测试/GitOps/Istio/OLAP 等)
- **提交**: 18:30 后 11 个 commits，产出稳定
- **结论**: 完成度最高，持续输出

### Build/Test 现状
- `npm run build`: **0 error** ✅
- `npm test`: 31 failed / 356 passed (66 文件，9 个失败文件)
- 主要失败: EventEmitter 继承模式(8 个)、jvs-83 缺失方法、chaos-engineering unhandled rejection

---

## 二、各方 Round 16 建议汇总

### QClaw 建议（务实派）
- **P0**: IPC Full-Link (5 页面 mock→真实)、修复 8 个 pre-existing failures、Build 验证
- **P1**: IPC Handler 测试覆盖、文件桥编码修复、TEAL-RULES 更新
- **P2**: NL Parser→Strategy Engine、Multi-Broker UI、OpenD 健康检查集成
- **P3**: QTest 文档化、Walk-Forward 框架、A股数据集成

### JVS 建议（功能派）
- **R15 P2**: 6 个前端页面（数据聚合器/清洗管道/ETL 任务/仓库浏览器/版本对比/AI 训练监控）
- **R15 P3**: 9 个高级功能（多时间框架回测/风险模型/组合优化/期权定价/NLP 情感/RL 可视化/GNN 关系图/蒙特卡洛/数据质量大屏）
- **R14 回填**: 27 个模块

### WB 评估
- QClaw 的建议更贴合当前痛点（Demo 不可用、测试失败）
- JVS 的建议偏向继续堆功能，未解决现有债务
- 当前最大问题：**78 个前端组件全部 mock 数据，Demo 无法展示**

---

## 三、Round 16 最终方案（每人 5 个深度任务）

### 原则
- 按新标准执行：每人每轮 3-5 个 production-ready 任务
- 每个任务 >=500 行 + >=5 测试 + benchmark + build 0 error
- 先修 bug，再对接真实数据，最后做新功能

---

### @主龙虾（5 个任务）

**T-16-01 [P0] 修复 8 个 pre-existing test failures**
- 修改 EventEmitter 继承为组合模式（worker-pool/state-machine/time-series/paper-trader）
- 修复 chaos-engineering unhandled rejection
- 验收：335+ 测试全部通过

**T-16-02 [P0] Multi-Broker UI 真实切换逻辑**
- 对接 IBrokerAdapter 接口（Futu/Moomoo 真实切换）
- BrokerSelector 组件状态管理 + 错误处理
- 验收：UI 可真实切换券商，有 loading/error 状态

**T-16-03 [P1] OpenD 健康检查 Dashboard 集成**
- Q19 opend-health.ts 已有，对接 Dashboard 状态栏
- 实时显示连接状态/延迟/心跳
- 自动重连逻辑（断线后 5s 内尝试恢复）

**T-16-04 [P1] Walk-Forward 回测框架集成**
- 对接 trading-agents-for-futures 六维方法论
- StrategyPage 新增 Walk-Forward 分析面板
- 验收：可运行 WFA 分析并展示结果

**T-16-05 [P2] 性能基准测试报告**
- 对核心 engine 模块（data-aggregator/options-pricing/risk-engine）做 benchmark
- 产出 `docs/performance-benchmark.md`
- 包含：吞吐量、延迟、内存占用对比

---

### @QClaw（5 个任务）

**Q-16-01 [P0] jvs-83 测试修复 + fetchFromSources 补全**
- 补充 DataAggregator.fetchFromSources() 方法
- 修复 3 个 jvs-83 测试失败
- 验收：jvs-83 测试全部通过

**Q-16-02 [P0] Dashboard IPC 全链路对接**
- DashboardPage mock 数据 → 真实 IPC (`dashboard:summary`)
- 加载状态 + 错误重试 + 空数据展示
- 验收：Dashboard 展示真实账户数据

**Q-16-03 [P0] Portfolio IPC 全链路对接**
- PortfolioPage mock 数据 → 真实 IPC (`portfolio:getPositions`)
- 持仓列表实时更新（WebSocket 推送）
- 验收：Portfolio 展示真实持仓

**Q-16-04 [P1] 核心 engine 单元测试覆盖（5 个模块）**
- 选择 5 个无测试的 engine 文件（如 signal-backtesting/realtime-news 等）
- 每个模块 >=5 个单元测试
- 验收：5 个模块测试全部通过，覆盖率报告生成

**Q-16-05 [P2] QTest 框架文档化 + 3 个示例迁移**
- 编写 `docs/QTEST.md` 使用指南
- 将 property-tests/contract-tests/snapshot-tests 从 stub 迁移到真实实现
- 验收：QTest 有完整文档，3 个示例可运行

---

### @JVS（5 个任务）

**JVS-16-01 [P0] Market 页面 IPC 全链路对接**
- MarketPage mock 数据 → 真实 IPC (`market:getQuotes`)
- 行情列表实时推送（quotes:push）
- 验收：Market 展示真实行情，价格变动有颜色动画

**JVS-16-02 [P0] TradingDesk 页面 IPC 全链路对接**
- TradingDesk mock 数据 → 真实 IPC (`order:submit`)
- 下单确认对话框 + 下单结果反馈
- 验收：可在 TradingDesk 真实下单（至少到 paper-trader 层）

**JVS-16-03 [P1] 数据质量监控大屏**
- 对接 JVS-90 数据质量评分系统
- 8 维度评分可视化（完整性/准确性/及时性/一致性/有效性/唯一性/可追溯性/合规性）
- 历史趋势图 + 告警阈值

**JVS-16-04 [P1] NLP 情感分析仪表板**
- 对接 JVS-95 NLP 情感引擎
- 新闻/社交/公告情感趋势图
- 情感驱动的交易信号提示

**JVS-16-05 [P2] 蒙特卡洛模拟器页面**
- 对接 JVS-100 蒙特卡洛引擎
- 场景分析：参数滑动条实时调整 → 结果重算
- 敏感性分析热力图

---

## 四、里程碑

| 时间 | 目标 |
|------|------|
| 22:00 | P0 完成（测试全部通过 + 4 个页面真实 IPC） |
| 次日 08:00 | P1 完成（OpenD 健康检查 + 数据质量大屏 + 5 个 engine 测试覆盖） |
| 次日 12:00 | P2 完成（Walk-Forward + QTest 文档 + NLP 仪表板 + 蒙特卡洛） |
| 次日 14:00 | 四人讨论 Round 17 方向 |

---

## 五、风险与对策

| 风险 | 对策 |
|------|------|
| IPC 对接发现 backend 缺失 handler | 当场 stub 实现，不阻塞前端 |
| OpenD 未运行导致健康检查失败 | 开发环境 mock OpenD 响应 |
| EventEmitter 修复引入回归 | 改组合模式后全量测试验证 |
| QClaw 继续 lag | 主龙虾分担 2 个 QClaw 任务 |

---

## 六、验收标准（每个任务）

1. >=500 行有效代码
2. >=5 个单元测试，全部 pass
3. benchmark 或性能报告
4. 设计文档 >=50 行
5. `npm run build` 0 error
6. 硬编码中文全部 i18n
7. 独立 git commit

---

*方案整合：QClaw 的务实方向 + JVS 的功能深度 + WB 的质量把控*
*核心目标：从"代码堆积"转向"Demo 可用"*
