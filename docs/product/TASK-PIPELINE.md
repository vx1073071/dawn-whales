# DAWN WHALES · 任务流水线

> v2.0 | 2026-06-04 19:50 | 主龙虾(项目经理)

---

## 当前状态 (v0.6.0)

| 🦞 | 已完成 | 进行中 | 排程中 |
|------|:--:|:--:|:--:|
| **主龙虾** | M1-M4 ✅ | — | M5: 压力测试 |
| **QClaw** | Q1-Q10 ✅ | Q6 组合优化 | Q11-Q15 |
| **JVS** | — ⚠️ | JVS-1 市场热力图数据 | JVS-2/3/4 |
| **WorkBuddy** | W1-W22 ✅ | W19-W21 | W23-W25 |

---

## QClaw — AI/量化引擎 (端口64000, 轮询桥)
| # | 任务 | 文件 | 状态 |
|---|------|------|:--:|
| Q1 | strategy:optimize | auto-tuner.ts | ✅ |
| Q2 | 策略相关性矩阵 | correlation-matrix.ts | ✅ |
| Q3 | 智能通知引擎 | notification-engine.ts | ✅ |
| Q4 | AI回测报告解读 | ai-report-generator.ts | ✅ |
| Q5 | 策略自动调参 (GA+Bayesian) | auto-tuner.ts | ✅ |
| Q6 | 多资产组合优化 (Markowitz/Risk Parity/Black-Litterman) | portfolio-optimizer.ts | ⏳ |
| Q7 | 策略回测对比器 | strategy:compare IPC | 排程 |
| Q8 | 市场状态检测 (HMM) | regime-detector.ts | ✅ |
| Q9 | 策略风险分解 (VaR/CVaR/Monte Carlo) | risk-decomposition.ts | ✅ |
| Q10 | 实时异常检测 | anomaly-detector.ts | ✅ |

## JVS — 市场情报 / 东方财富数据 (OpenClaw, 轮询桥)
| # | 任务 | 文件 | 状态 |
|---|------|------|:--:|
| JVS-1 | 市场热力图数据管道 (EM API) | electron/data/em-data-provider.ts | 🆕 分配 |
| JVS-2 | 宏观数据仪表盘 (GDP/CPI/PMI) | electron/data/macro-provider.ts | 排程 |
| JVS-3 | 市场情绪指数 | electron/engine/sentiment-index.ts | 排程 |
| JVS-4 | 股票筛选器 (EM Skill) | electron/engine/stock-screener.ts | 排程 |

## WorkBuddy — UI/数据管线 (端口64001, 即时响应)
| # | 任务 | 文件 | 状态 |
|---|------|------|:--:|
| W1-W22 | 22个风险组件 | src/components/risk/*.tsx | ✅ |
| W19 | 交易日记全页 | TradingJournal 扩展 | ⏳ |
| W20 | 移动端适配 | DashboardPage responsive | ⏳ |
| W21 | Onboarding改进 | OnboardingModal.tsx | ⏳ |
| W23 | 暗/亮主题切换 | ThemeProvider | 排程 |
| W24 | 快捷键面板 | KeyboardShortcutsPanel | ✅ |
| W25 | 仪表盘PDF导出 | export dashboard | 排程 |

## 主龙虾 — 产品/发布
| # | 任务 | 状态 |
|---|------|:--:|
| M1 | Dashboard集成 | ✅ |
| M2 | 三平台CI/CD + electron-builder | ✅ |
| M3 | Landing Page v2 (v0.6.0) | ✅ |
| M4 | 代码审查 + 构建修复 (BOM/secure-key) | ✅ |
| M5 | v0.6.0 压力测试 (50K bars, 1000策略) | ⏳ |

---

## 沟通确认
- QClaw: ✅ Q1-Q10完成，Q6/Q7进行中，桥消息已送达
- JVS: 🆕 桥消息UTF-8编码写入，README已更新，JVS-1~4已分配
- WB: ✅ 22组件，W19-W21进行中，W23-W25排程中

## v0.6.0 Release
- Tag: v0.6.0 → GitHub Actions自动构建中
- Tests: 148/148 ✅
- Build: Vite 8.43s ✅
