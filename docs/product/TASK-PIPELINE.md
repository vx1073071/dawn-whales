<!-- META
version: 1.12.0
last_updated: 2026-06-12
round: R108
owner: JVS
purpose: (auto-generated, needs review)
-->

# quant-moo · 任务流水线

> v1.0 | 2026-06-04 | 主龙虾(项目经理)

---

## 当前任务 (v0.6.0 Sprint 1)

| 🦞 | 当前任务 | 状态 |
|------|---------|:--:|
| 主龙虾 | Dashboard + 回测压力测试 + 总协调 | ✅ |
| QClaw | strategy:optimize (LLM参数优化后端) | ⏳ |
| JVS | 回测引擎性能优化 (5K+ bars) | ⏳ |
| WorkBuddy | RiskDashboardPage (风控实时面板) | ⏳ |

---

## 预排任务 (完成后立刻分配)

### QClaw — LLM/AI 路线
| # | 任务 | 说明 |
|---|------|------|
| Q1 | strategy:optimize | ✅当前 |
| Q2 | 策略相关性矩阵 | 计算多策略收益相关系数，输出分散化建议 |
| Q3 | 智能通知引擎 | 策略异常→LLM生成自然语言告警→推送到前端 |
| Q4 | 回测报告AI解读 | 输入回测结果→DeepSeek生成专业分析报告 |

### JVS — 架构/性能路线
| # | 任务 | 说明 |
|---|------|------|
| J1 | 回测引擎性能优化 | ✅当前 |
| J2 | Web Worker 并行回测 | 参数扫描100组合并行→10x加速 |
| J3 | 缓存层优化 | K线缓存 TTL + LRU 淘汰 + 内存限制 |
| J4 | TypeScript 严格模式迁移 | 消除所有 any 类型，提升类型安全 |

### WorkBuddy — UI/可视化路线
| # | 任务 | 说明 |
|---|------|------|
| W1 | RiskDashboardPage | ✅当前 |
| W2 | 净值曲线组件 (EquityChart) | Canvas/SVG 高性能渲染，支持缩放+标注 |
| W3 | 市场热力地图 | 板块/行业涨跌全景图 |
| W4 | Onboarding 优化 | 新用户3步引导→真实账户连接→创建第一个策略 |

### 主龙虾 — 产品/发布路线
| # | 任务 | 说明 |
|---|------|------|
| M1 | Dashboard + 压力测试 | ✅完成 |
| M2 | electron-builder 正式打包流水线 | Win/Mac/Linux 三平台 + 自动上传 GitHub Release |
| M3 | Landing Page v2 | 真实截图 + 功能动画 + 下载按钮 |
| M4 | 代码审查 + 全线测试 | 148→200+，覆盖率报告 |

---

## 规则

1. **完成当前任务→立刻通知→立刻分配下一个**
2. **每人手头永远有 1 个在做的 + 3 个排队的**
3. **若队列清空→让每人提 4 个新任务建议**
4. **优先级：实盘相关 > 性能 > 可视化 > 文档**

---

## 当前等待

- QClaw: Q1 完成后自动分配 Q2
- JVS: J1 完成后自动分配 J2
- WorkBuddy: W1 完成后自动分配 W2
