# R171 圆桌计划 — 引擎硬核

> PM(Claw) | 2026-06-14 23:26 启动 | 4天

## R171 目标

双曲衰减 + 真实ETF价格 + 两套评分合并 + AI意图扩展

## R171 基线 (Pre-Round)

| 指标 | 值 |
|------|-----|
| TSC | 0 errors |
| Build | 0 errors |
| 测试文件 | 137 (111 pass, 26 fail) |
| 测试用例 | 3338 (3243 pass, 82 fail, 13 skip) |
| 因子命名 | R170 A1命名统一已由autoclaw完成 |
| data-provider | R170 A4基础接线已由autoclaw完成 |
| SeededPRNG | 仍用于factor-exposure.ts的estimateFactorReturns() |

## R171 验收标准

- [ ] A7 双曲衰减模型运行，区分机械/判断因子
- [ ] A5 真实ETF价格替换SeededPRNG（至少MKT/SMB/HML/MOM 4个）
- [ ] A4 factor-data-provider 10源注册+降级链正常
- [ ] A8 两套评分体系合并为统一引擎
- [ ] E1 AI推荐新增5种场景intent
- [ ] F7 GRS统计量+滚动IC可用
- [ ] F8 换手率成本模型可用
- [ ] F2 DecayCurveChart接入双曲衰减
- [ ] F3 LongShortChart接入真实数据
- [ ] QClaw 双曲衰减用户解释文案交付
- [ ] youdao 引擎层测试全部pass
- [ ] TSC=0, Build=0, 新增测试 >= 30 pass

## 审计记录

| 虾 | 任务 | 编号 | 工时 | 状态 | PM审计 |
|---|------|------|------|------|---------|
| autoclaw | 双曲衰减 | A7 | 6h | ⏳ | 待验收 |
| autoclaw | 真实ETF价格 | A5 | 10h | ⏳ | 待验收 |
| autoclaw | data-provider完整接线 | A4余 | 8h | ⏳ | 待验收 |
| autoclaw | 两套评分合并 | A8 | 12h | ⏳ | 待验收 |
| JVS | AI推荐5种intent | E1 | 4h | ⏳ | 待验收 |
| JVS | GRS统计量+滚动IC | F7 | 4h | ⏳ | 待验收 |
| JVS | 换手率成本模型 | F8 | 3h | ⏳ | 待验收 |
| ML | 衰减曲线图 | F2 | 4h | ⏳ | 待验收 |
| ML | 多空收益图 | F3 | 4h | ⏳ | 待验收 |
| QClaw | 双曲衰减解释文案 | A7辅助 | 2h | ⏳ | 待验收 |
| youdao | 测试A5/A7/A8 | — | 8h | ⏳ | 待验收 |
| youdao | 测试E1/F7/F8 | — | 4h | ⏳ | 待验收 |
| Claw | 验收+审计 | — | 3h | ⏳ | 进行中 |

## 关键风险

- **autoclaw任务重**：本轮36h工作量集中在autoclaw(4项36h)，是其他虾总和的两倍
- **JVS R170积压**：A2/A6/A9尚未完成，可能影响R171交付
- **真实ETF数据源**：A5需要接入外部数据（雅虎/yfinance/Futu），涉及联网调用
- **SeededPRNG替换范围**：factor-exposure.ts的estimateFactorReturns()是核心计算路径
