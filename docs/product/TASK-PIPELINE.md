# DAWN WHALES · 任务流水线

> v2.1 | 2026-06-04 21:15 | 主龙虾(PM)

---

## 当前状态

| 🦞 | 已完成 | 进行中 |
|------|------|:--:|
| **主龙虾** | M1-M4 | M5 |
| **JVS** | J1-J3 + JVS-1~4 ✅ | JVS-5/6/7 |
| **QClaw** | Q1-Q10 ✅ | Q11-Q13 |
| **WorkBuddy** | W1-W25 ✅ | W26-W28 |

---

## 当前排程

### JVS (EM数据 + 市场情报)
| # | 任务 | 文件 |
|---|------|------|
| JVS-5 | 新闻舆情聚合器 | electron/engine/news-sentiment.ts |
| JVS-6 | 板块轮动监控 | electron/engine/sector-rotation.ts |
| JVS-7 | 个股异动检测 | electron/engine/anomaly-scanner.ts |

### QClaw (AI引擎)
| # | 任务 | 文件 |
|---|------|------|
| Q11 | 相关性矩阵可视化数据 | electron/engine/correlation-visualizer.ts |
| Q12 | 风控场景压力测试 | electron/engine/stress-tester.ts |
| Q13 | 回测对比仪表盘 | electron/engine/backtest-comparator.ts |

### WorkBuddy (前端UI)
| # | 任务 | 文件 |
|---|------|------|
| W26 | 市场热力图页面 | src/components/market/MarketHeatmapPage.tsx |
| W27 | 宏观仪表盘页面 | src/components/market/MacroDashboardPage.tsx |
| W28 | 情绪指数仪表 | src/components/risk/SentimentGauge.tsx |

### 主龙虾 (PM + 架构)
| # | 任务 |
|---|------|
| M5 | v0.6.0压力测试 (50K bars, 1000策略) |
| M6 | PR合入(JVS/QClaw/WB产出→main) |
| M7 | v0.7.0 Release |

---

## 规则
- commit per task
- 38/38 tests green
- push directly to master
- 桥消息确认(after each task done)
- JVS/JVS-5~7分配的下一步: 端到端验证
