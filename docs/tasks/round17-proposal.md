# Round 17 建议方案

## 一、现状盘点

### 已完成（Round 16 成果）
| 模块 | 状态 | 测试 |
|------|------|------|
| Q17 PaperTrader | ✅ 已合并 master | 需重新运行验证 |
| Q18 StrategyTemplates | ✅ 已合并 master | 需重新运行验证 |
| Q19 OpenD Health | ✅ 已合并 master | 需重新运行验证 |
| Q44/Q45/Q46 | ✅ | |
| JVS-83~JVS-100 | ✅ 18 模块, 19k+ 行 | |
| T82~T103 | ✅ Docker/Kafka/gRPC/Redis/OLAP | 大量 stub |
| QTest 文档化 | ✅ docs/QTEST.md | |
| RiskEngine 单元测试 | ✅ q95-risk-engine 15/15 | ✅ |

### 当前测试状态（全部为历史遗留）
```
62 passed / 9 failed suites / 404 pass / 29 fail
```

**9 个失败文件**（全部 pre-existing，非本次引入）:
- `jvs-100-e2e.test.ts` — import 缺失 `alert-engine`
- `t50-workerpool.test.ts` — 失败 suite
- `t52-state-machine.test.ts` — 3 fail
- `t60-job-scheduler.test.ts` — 2 fail
- `t70-time-series.test.ts` — 3 fail
- `t58-event-bus.test.ts` — 1 fail
- `t89-security-service.test.ts` — 1 fail
- `t103-stream-batch.test.ts` — 1 fail
- `q51-chaos-engineering.test.ts` — chaos monkey unhandled rejection

**2 个未合并分支**:
- `feature/strategy-optimize` — WP1/WP4 merge 阻塞
- `feature/sprint1-marketplace` — Sprint 1 多券商

---

## 二、Round 17 核心方向

**从"代码堆积"转向"债务清理 + Sprint 1 就绪"**

Round 16 产出大量代码但 29 个测试持续失败。Round 17 的首要任务是：
1. **清掉测试债务** — 让所有测试文件可运行
2. **合并阻塞分支** — strategy-optimize + sprint1-marketplace
3. **建立 Sprint 1 就绪状态** — 确保 marketplace 版本可演示

---

## 三、各方任务建议

### @主龙虾

**T-17-01 [P0] 合并 feature/strategy-optimize → master**
- WP1 Strategy Engine + WP4 Data Integration PR merge
- 协调 QClaw (WP1 NL Parser) + JVS (WP4 Data) 冲突解决
- 产出：clean master，strategy-optimize 分支关闭
- 验收：feature/strategy-optimize 合并完成，build 0 error

**T-17-02 [P0] Sprint 1 Marketplace 就绪检查**
- 对接 `feature/sprint1-marketplace` 分支
- IBrokerAdapter 接口完整度检查
- FutuAdapter + MoomooAdapter + MockAdapter 三合一切换
- 验收：Marketplace UI 可切换三个券商，数据流正确

**T-17-03 [P1] 修复 t50/t52/t60/t70 时间相关测试失败（4 suites）**
- state-machine/job-scheduler/time-series/event-bus
- 原因：timer mocking / Date.now() / setTimeout 精度问题
- 验收：4 suites 全部通过

**T-17-04 [P1] t82~t103 存根测试 → 真实实现**
- 18 个 T8x 测试大量是 `it('should pass', () => expect(true).toBe(true))`
- 选择 5 个核心（T85 Kafka/T86 gRPC/T87 API Gateway/T88 Multi-tenancy/T93 OLAP）
- 替换为 >=5 真实测试用例
- 验收：5 个 suites 各 >=5 real tests，全部 pass

**T-17-05 [P2] 性能基准测试报告**
- 核心模块 benchmark：data-aggregator / risk-engine / paper-trader / options-pricing
- 产出：docs/performance-benchmark.md
- 包含吞吐量、延迟、内存占用数值

---

### @QClaw

**Q-17-01 [P0] Q17/Q18/Q19 测试验证 + 修复**
- 重新运行 q17/q18/q19 测试，确认通过
- Q17 PaperTrader：EventEmitter 组合模式后是否正常
- Q18 StrategyTemplates：模板引擎是否正常
- Q19 OpenD Health：健康检查逻辑是否正常
- 验收：三个 suites 全部 pass

**Q-17-02 [P0] jvs-100-e2e 缺失 import 修复**
- `../electron/engine/alert-engine` 不存在
- 如果 alert-engine 是 JVS 模块的一部分，确认路径
- 如果不存在，创建 stub（带日志：TODO: replace with real implementation）
- 验收：jvs-100-e2e 可运行（允许 SKIP 缺失功能测试）

**Q-17-03 [P1] 修复 t58/t89/t103/t51-chaos 剩余 5 个失败**
- event-bus: 1 fail
- security-service: 1 fail
- stream-batch: 1 fail
- chaos-engineering: unhandled rejection in worker
- 验收：5 个 suites 全部 pass

**Q-17-04 [P2] Strategy Engine + NL Parser 集成测试**
- 对接 QClaw NL Parser → Strategy Engine
- 验证 `strategy:generate` IPC 完整链路
- NL 输入 → 解析 → 策略生成 → 风险检查 → 执行计划
- 验收：端到端 test 可运行，输出结构正确

**Q-17-05 [P3] QTest 并行测试运行器 benchmark**
- parallel-runner.ts 多 worker 性能测试
- 对比单 worker vs 4 workers 加速比
- 文档化最优 worker 数量建议
- 验收：docs/QTEST.md 更新并行执行指南

---

### @JVS

**JVS-17-01 [P0] Market 页面 IPC 全链路对接**
- MarketPage mock → 真实 `market:getQuotes`
- 行情列表实时推送
- 验收：Market 展示真实行情

**JVS-17-02 [P0] TradingDesk 页面 IPC 全链路对接**
- TradingDesk mock → 真实 `order:submit`
- 下单确认 + 结果反馈
- 验收：可完成下单流程（到 paper-trader 层）

**JVS-17-03 [P1] 数据质量监控大屏**
- 对接 JVS-90 评分系统
- 8 维度可视化
- 验收：Dashboard 有数据质量面板

**JVS-17-04 [P1] T82~T84 Docker/Redis/Prometheus 真实测试**
- 替换 stub 为真实集成测试
- Redis: 连接、set/get、TTL、pub/sub
- Prometheus: /metrics 端点可访问，指标格式正确
- 验收：T82/T83/T84 各 >=5 真实测试

**JVS-17-05 [P2] JVS-100 蒙特卡洛模拟器页面**
- 对接 JVS-100 引擎
- 参数滑动条 + 敏感性分析热力图
- 验收：页面可运行蒙特卡洛模拟

---

### @WB

**WB-17-01 [P0] 测试债务清理协调**
- 协调主龙虾 + QClaw 修复 9 个失败 suites
- 每日 standup 跟踪测试状态
- 验收：29 fail → 0 fail

**WB-17-02 [P1] 代码质量门禁**
- `npm run build` 0 error 持续检查
- 禁止新功能没有测试（git hook 提示）
- QTest 覆盖率报告加入 CI
- 验收：docs/CODE-QUALITY.md

**WB-17-03 [P1] 文件桥编码最终修复**
- 主龙虾 Round 16 已部分修复
- 验证 JSONL 文件桥两端编码一致
- 验收：中文消息无乱码

**WB-17-04 [P2] Sprint 1 Demo 准备**
- 确保 Marketplace + PaperTrader + Dashboard 可演示
- 准备 3 分钟 Demo 脚本
- 验收：docs/DEMO-SCRIPT.md

---

## 四、里程碑

| 时间 | 目标 |
|------|------|
| Round 17 开始后 2h | T-17-01 合并完成，build 验证 |
| Round 17 开始后 4h | Q-17-01/02/03 测试债务清零 |
| Round 17 开始后 8h | JVS-17-01/02 Market + TradingDesk 真实数据 |
| Round 17 次日 12:00 | P1 全部完成 |
| Round 17 次日 18:00 | Sprint 1 Demo 就绪 |

---

## 五、验收标准（Round 17 统一）

1. `npm test` — **0 fail**（禁止任何测试文件失败）
2. `npm run build` — **0 error**
3. 每个任务 — **独立 git commit + PR**
4. 新代码 — **>=5 测试 / >=300 行有效代码**
5. 演示路径 — **Marketplace + Dashboard + PaperTrader 可串联演示**

---

## 六、Round 17 核心原则

> **测试债务优先于新功能**

Round 16 产出 19,000+ 行代码但 29 个测试失败。
Round 17 的每一个 commit 应该让测试总数 **净增加** 而非净减少。

新功能允许 stub，但必须标注 `// TODO: real implementation`，并有对应的 `// SKIP: waiting for X` 测试。

---

*Round 17 目标：从 Demo 不可用 → Sprint 1 可演示*
