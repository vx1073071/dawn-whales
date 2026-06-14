# R173 圆桌计划 — 工作流革命

> PM(Claw) | 2026-06-14 23:46 启动 | 4天

## R173 目标

打造专业级因子工作流体验：FactorLab统一工作台+迷你回测+权重可视化+快照+管线

## R173 基线

| 指标 | 值 |
|------|-----|
| TSC | 0 errors |
| Build | 0 errors |
| suggestFactors IPC | bridge-api.ts getFactorSuggestions() 已就绪 (R164) |
| factor-portfolio-eval | PortfolioIC/IR 已就绪 (R165) |
| 预设文案 | QClaw 4种预设待交付 (R173) |

## R173 验收标准

- [ ] FactorLab统一工作台可操作
- [ ] 拖动滑块3秒内mini回测出结果
- [ ] 4种预设方案一键切换
- [ ] 回测快照可保存/命名/恢复/对比
- [ ] 因子→回测管线打通 runFactorBacktest()
- [ ] 骨架屏替代空白Loading
- [ ] 参数变更可撤销(<=10步)
- [ ] TSC=0, Build=0

## 审计记录

| 虾 | 任务 | 编号 | 工时 | 状态 | PM审计 |
|---|------|------|------|------|---------|
| ML | FactorLab统一工作台 | C1 | 6h | ⏳ | |
| ML | Live Mini-Backtest | C2 | 4h | ⏳ | |
| ML | 权重视觉化配置器 | C3 | 6h | ⏳ | |
| ML | 策略模板+因子联动 | C4 | 6h | ⏳ | |
| ML | 骨架屏加载 | C7 | 3h | ⏳ | |
| ML | 参数变更历史 | C8 | 2h | ⏳ | |
| autoclaw | 回测快照系统 | C5 | 3h | ⏳ | |
| autoclaw | 因子→回测管线 | D3 | 6h | ⏳ | |
| JVS | 优化器+权重扫描 | F5 | 6h | ⏳ | |
| QClaw | FactorLab UX规范 | C1辅助 | 3h | ⏳ | |
| QClaw | 预设方案文案 | C3辅助 | 2h | ⏳ | |
| youdao | 测试C1-C8工作流 | — | 8h | ⏳ | |
| youdao | E2E FactorLab | — | 4h | ⏳ | |
| Claw | 验收 | — | 3h | ⏳ | |

## 关键备注

- ML 连续第4轮前端主力（R170-R173），本轮27h/6项
- C4 策略模板联动依赖 R164 已创建的 getFactorSuggestions()
- D3 因子→回测管线是首次将因子系统接入回测引擎
- FactorLab 是因子系统的核心用户入口，本轮的完成度直接影响商业转化
