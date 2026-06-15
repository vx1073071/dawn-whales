# R193: 🔴Batch3 + 最终集成 + v3.0.0发布 | Round计划 + 项目终验

> PM(Claw) 制定 | 2026-06-15 | Phase 3 终轮 | v3.0.0
> 前置: R184-R192 全部✅ | 本轮: 29🔴剩余 + 性能优化 + E2E + 安全审计 + 帮助文档 + 发布
> 🏆 **10轮收官之轮 (R184-R193)**

---

## 🎯 Round目标

1. **29🔴剩余因子**: 加密14 + 跨市场5 + 补充10
2. **全188因子性能优化**: 批量<15s + 缓存>95% + 并行化
3. **实盘vs回测偏差引擎**: 曲线叠加+归因
4. **Onboarding 3步向导**: 欢迎→选市场→选场景包→完成
5. **全188因子UI最终打磨**: 三级分类+3市场+15组件串联
6. **策略健康评分雷达图**: 5维可视化
7. **i18n终审**: 188×8=1504条 0缺译
8. **E2E Playwright**: 完整用户旅程
9. **全因子回归**: 188×3=564场景
10. **安全审计**: 0漏洞
11. **Release Notes + 帮助文档 + UX一致性**
12. **v3.0.0正式发布**

---

## 📋 29🔴剩余因子

### 🪙 加密🔴 (14)

| # | 因子ID | 中文名 | 数据源 |
|---|--------|--------|--------|
| 1 | CRYPTO_NFT_VOLUME | NFT交易量 | OpenSea |
| 2 | CRYPTO_BRIDGE_FLOW | 跨链桥流量 | 各Bridge API |
| 3 | CRYPTO_STABLECOIN_MINT | 稳定币铸造量 | Etherscan |
| 4 | CRYPTO_MINER_FLOW | 矿工流向 | Glassnode |
| 5 | CRYPTO_ONCHAIN_GDP | 链上活跃度综合分⭐ | 多源加权 |
| 6 | CRYPTO_MINER_SELL_PRESS | 矿工卖出压力 | Glassnode |
| 7 | CRYPTO_CROSSCHAIN_FLOW | 跨链资金流 | 各L1/L2 |
| 8 | CRYPTO_RESERVE_PROOF | 交易所储备金 | 各交易所 |
| 9 | CRYPTO_WHALE_TX_COUNT | 巨鲸交易笔数 | Glassnode |
| 10 | CRYPTO_25DELTA_RR | 25Delta风险逆转 | Deribit |
| 11 | CRYPTO_OPTION_TERM | 期权期限结构 | Deribit |
| 12 | CRYPTO_DEV_CENTRAL | 开发者集中度 | GitHub |
| 13 | CRYPTO_TOKEN_UNLOCK | 代币解锁时间表 | TokenUnlocks |
| 14 | CRYPTO_PROTOCOL_REV | 协议收入 | TokenTerminal |
| 15 | CRYPTO_PF_RATIO | P/F Ratio | 计算 |
| 16 | CRYPTO_GOVERNANCE | 治理活跃度 | Snapshot |

### 🌏 跨市场🔴 (5)

| # | 因子ID | 中文名 | 说明 |
|---|--------|--------|------|
| 17 | XM_CO_SKEWNESS | 协偏度 | 多资产同步下跌风险 |
| 18 | XM_IDIO_VOL | 跨市场特质波 | 剔全局影响后的波动 |
| 19 | XM_MOMENTUM_CRASH | 动量崩溃 | 动量因子在反转期的风险 |
| 20 | XM_CURRENCY_HEDGE | 汇率对冲 | 多币种对冲效果 |
| 21 | XM_FACTOR_TIMING | 因子择时 | 因子轮动信号 |

### 补充🔴 (8)

| # | 因子ID | 中文名 | 难度 | 6虾 |
|---|--------|--------|------|------|
| 22 | EARNINGS_MOVE | 财报隐含波动 | ⭐⭐⭐ | |
| 23 | CONVERTIBLE_ARB | 可转债套利 | ⭐⭐⭐⭐ | |
| 24 | STAT_ARB_RESIDUAL | 统计套利残差 | ⭐⭐⭐⭐ | |
| 25 | ROE_TREND | ROE变动趋势 | ⭐⭐ | |
| 26 | SHORT_TERM_REVERSAL | 短期反转 | ⭐⭐ | |
| 27 | GAP_FILL | 缺口回补 | ⭐⭐ | |
| 28 | RETAIL_SENTIMENT | 散户情绪 | ⭐⭐⭐ | |
| 29 | NEWS_NLP | 新闻情绪NLP⭐ | ⭐⭐⭐⭐ | ⭐共识 |
| 30 | ESG_SCORE | ESG评分 | ⭐⭐ | |

---

## 🏗️ 6虾分工

### 🦐 JVS (引擎)

| # | 任务 | 交付物 | 代码量 | 验收 |
|---|------|--------|--------|------|
| J1 | 29🔴剩余因子 | `electron/engine/factors/calculators/final-*.ts` | ≥600行 | 29因子可计算 |
| J2 | 全188因子性能优化 | `electron/engine/factors/batch-calculator-v3.ts` | ≥250行 | 批量<15s+并行+缓存>95% |
| J3 | 实盘vs回测偏差引擎 | `electron/engine/factors/analysis/live-vs-backtest.ts` | ≥250行 | 曲线叠加+归因+偏差量 |
| J4 | 29因子Registry注册 | `factor-id-registry.ts` | ≥50行 | L3标记完整 |

**性能优化目标**:
| 指标 | 当前 | v3.0.0目标 |
|------|------|-----------|
| 188因子批量 | ~30s | <15s |
| 单因子回测 | ~5s | <3s |
| 多因子回测 | ~30s | <15s |
| 缓存命中率 | ~85% | >95% |

### 🦐 ML (前端)

| # | 任务 | 交付物 | 代码量 | 验收 |
|---|------|--------|--------|------|
| M1 | Onboarding 3步向导 | `src/components/strategy/OnboardingWizard.tsx` | ≥250行 | 3步流畅+退出可恢复 |
| M2 | 全188因子UI打磨 | 15组件全链路串联+一致性 | ≥300行 | 0 TSC+无UI bug |
| M3 | 策略健康评分雷达图 | `src/components/strategy/HealthScoreRadar.tsx` | ≥150行 | 5维雷达图+悬浮数值 |

**3步向导流程**:
```
Step1 欢迎 → "TradingEasy 188因子帮你选股"
Step2 选市场 → 🇭🇰港股 / 🇺🇸美股 / 🪙加密 (可多选)
Step3 选场景 → 8场景包 / 自选因子 / AI推荐
完成 → 跳转因子市场首页
```

### 🦐 autoclaw (全栈)

| # | 任务 | 交付物 | 代码量 | 验收 |
|---|------|--------|--------|------|
| A1 | 29🔴因子i18n + 终审 | `factor-i18n-map.ts` + locales | ≥350行 | 1504条0缺译 |
| A2 | Build打包+CI/CD | 编译+打包+依赖审计+包大小 | ≥100行 | Build 0 error |
| A3 | 全188因子i18n覆盖率 | 名/故事/信号/等级 四项检查 | ≥50行 | 100%覆盖 |

### 🦐 QClaw (设计)

| # | 任务 | 交付物 | 代码量 | 验收 |
|---|------|--------|--------|------|
| Q1 | Release Notes v3.0.0 | `docs/release/v3.0.0-release-notes.md` | ≥300行 | 亮点+功能+限制+升级 |
| Q2 | 因子完整帮助文档 | `docs/reference/factor-reference-188.md` | ≥500行 | 188因子全覆盖 |
| Q3 | 最终UX一致性审查 | `docs/design/ux-final-audit-v3.md` | ≥200行 | 15组件+文案+颜色+动画 |

### 🦐 youdao (测试)

| # | 任务 | 交付物 | 代码量 | 验收 |
|---|------|--------|--------|------|
| Y1 | E2E Playwright | `tests/e2e/full-user-journey.spec.ts` | ≥300行 | 完整旅程9步pass |
| Y2 | 全因子回归564场景 | `tests/regression/all-188-factors.test.ts` | ≥400行 | 188×3=564场景 |
| Y3 | 安全审计 | `docs/security/audit-v3.0.0.md` | ≥200行 | 计费+数据+越权+注入 |
| Y4 | 性能基准 | `tests/perf/v3-benchmark.test.ts` | ≥100行 | 4项性能达标 |

**E2E 9步旅程**:
```
1. 首次打开 → Onboarding 3步向导
2. 选港股市场 → 因子列表过滤
3. 搜索"便宜好公司" → 匹配EARNINGS_YIELD/BOOK_TO_PRICE/ROA
4. 选场景包"牛市进攻" → 5因子加载+权重展示
5. 单因子回测(免费) → IC趋势+分组收益
6. 多因子回测(1U) → 确认扣费→执行→5维结果
7. 一键诊断(1U) → 全因子Top5
8. 查看龙虎榜 → 本周最强因子
9. 给因子评分⭐4 + 评价"港股大盘好用"
```

### 🦐 Claw (PM)

| # | 任务 | 交付物 | 代码量 | 验收 |
|---|------|--------|--------|------|
| C1 | ✅ chat-bridge广播R193 | 广播消息 | — | 6虾确认 |
| C2 | R193 Round计划(本文档) | 最终计划 | ≥600行 | 完整 |
| C3 | Phase 3全面审计 | 89🔴+高级架构+4收费 | ≥400行 | 审计通过 |
| C4 | v3.0.0最终验收+发布 | 全部7类检查 | ≥300行 | 全✅ |
| C5 | 项目完成广播 | 10轮总结 | — | v3.0.0发布 |

---

## 🏆 v3.0.0 终极检查清单

### Q 代码质量

| # | 检查项 | 标准 | 状态 |
|---|--------|------|------|
| Q01 | TSC | 0新增类型错误 | ☐ |
| Q02 | Build (Electron+React) | 0 error | ☐ |
| Q03 | npm audit | 0 critical / 0 high | ☐ |

### F 因子完整性 (188 = 🟢31 + 🟡68 + 🔴89)

| # | 检查项 | 数量 | 状态 |
|---|--------|------|------|
| F01 | 🟢入门因子 | 31 | ☐ |
| F02 | 🟡进阶通用 | 34 | ☐ |
| F03 | 🟡进阶市场 | 34 | ☐ |
| F04 | 🔴专业通用 | 30 | ☐ |
| F05 | 🔴专业市场 | 30 | ☐ |
| F06 | 🔴专业剩余 | 29 | ☐ |
| **合计** | **188** | ☐ |

### U 交互组件 (15)

| # | 组件 | 来源R | 状态 |
|---|------|-------|------|
| U01 | FactorCard(🟢🟡🔴) | R184/185/187 | ☐ |
| U02 | FactorSignalLight | R185 | ☐ |
| U03 | ScenarioPackSelector(8) | R185 | ☐ |
| U04 | FactorLevelSelector | R184 | ☐ |
| U05 | FactorWeightSlider | R187 | ☐ |
| U06 | FactorPK | R187 | ☐ |
| U07 | FactorHealthAlert | R188 | ☐ |
| U08 | FactorSandbox | R188 | ☐ |
| U09 | FactorCalendarHeatmap | R189 | ☐ |
| U10 | FactorWeeklyLeaderboard | R189 | ☐ |
| U11 | FactorRollingIC | R190 | ☐ |
| U12 | FactorCrowdingAlert | R190 | ☐ |
| U13 | DeepDiagnosisPanel | R191 | ☐ |
| U14 | FactorParameterHeatmap | R192 | ☐ |
| U15 | HealthScoreRadar | R193 | ☐ |

### D 深度服务+计费 (4)

| # | 功能 | 单价 | 来源R | 状态 |
|---|------|------|-------|------|
| D01 | 多因子回测 | 1U | R189 | ☐ |
| D02 | 因子诊断 | 1U | R189 | ☐ |
| D03 | AI参数优化 | 1.5U | R191 | ☐ |
| D04 | 替代数据解锁 | 2U | R191 | ☐ |

### T 测试

| # | 类型 | 数量 | 状态 |
|---|------|------|------|
| T01 | 🟢因子单元 | ≥175 | ☐ |
| T02 | 🟡通用单元 | ≥170 | ☐ |
| T03 | 🟡市场单元 | ≥170 | ☐ |
| T04 | 🔴通用单元 | ≥150 | ☐ |
| T05 | 🔴市场单元 | ≥150 | ☐ |
| T06 | 🔴剩余单元 | ≥145 | ☐ |
| T07 | 深度服务 | ≥50 | ☐ |
| T08 | 全因子回归 | ≥564 | ☐ |
| T09 | E2E Playwright | ≥9步 | ☐ |
| **合计** | | **≥1574** | ☐ |

### P 性能

| # | 指标 | 目标 | 状态 |
|---|------|------|------|
| P01 | 188因子批量 | <15s | ☐ |
| P02 | 单因子回测 | <3s | ☐ |
| P03 | 多因子回测 | <15s | ☐ |
| P04 | 单因子诊断 | <5s | ☐ |
| P05 | 缓存命中率 | >95% | ☐ |

### I i18n

| # | 检查项 | 数量 | 状态 |
|---|--------|------|------|
| I01 | 因子名称(8语) | 188×8=1504 | ☐ |
| I02 | 因子故事(中英日) | 188×3=564 | ☐ |
| I03 | 信号描述(8语) | 188×8=1504 | ☐ |
| I04 | UI文案(8语) | 15组件+场景包+向导 | ☐ |

### S 安全

| # | 检查项 | 状态 |
|---|--------|------|
| S01 | 计费管道无漏洞 | ☐ |
| S02 | 用户数据隔离 | ☐ |
| S03 | 输入注入防护 | ☐ |
| S04 | API越权防护 | ☐ |
| S05 | i18n无敏感信息 | ☐ |

---

## 📊 10轮项目全景 (R184-R193)

| Phase | Round | 主题 | 因子数 | 关键里程碑 |
|-------|-------|------|--------|-----------|
| P1 | R184 | 基础设施 | 0 | 三级分类+模板+i18n框架 |
| P1 | R185 | 🟢入门因子 | 31 | 信号灯+场景包 |
| P1 | R186 | 集成+场景包 | 0 | v2.5.0-alpha |
| P2 | R187 | 🟡通用因子 | 34 | PK+权重+相关性 |
| P2 | R188 | 🟡市场因子 | 34 | 链上+期权+健康+沙盒 |
| P2 | R189 | 💰深度服务 | 0 | 回测1U+诊断1U+热力图+龙虎榜 |
| P2 | R190 | 🟡收尾 | 0 | IC监控+拥挤+社交+推荐 → v2.6.0 |
| P3 | R191 | 🔴通用因子 | 30 | 期权+套利+替代数据+AI优化 |
| P3 | R192 | 🔴市场因子 | 30 | 行业中性化+参数敏感性+策略22 |
| P3 | **R193** | **🔴剩余+发布** | **29** | **v3.0.0 🏆** |
| **合计** | **10轮** | | **188** | **335h / ~31,440行** |

---

## 🎯 v3.0.0 里程碑

```
v3.0.0 = v2.6.0(🟢31+🟡68=99) + 🔴89 + 高级架构 + 全量测试 + 帮助文档

因子: 🟢31 + 🟡68 + 🔴89 = 188
组件: 15个交互组件
收费: 4项 (回测1U+诊断1U+AI优化1.5U+替代数据2U)
数据: 3市场+链上+期权+替代+新闻 = 5源统一适配
语言: 8语言 i18n >3000条
测试: >1574测试 + E2E + 安全审计
性能: 批量<15s + 回测<15s + 缓存>95%
策略: 22模板 + 8场景包
```

---

## 📎 参考文件

- Master Plan: `docs/proposals/factor-expansion-R184-R193-master-plan.md`
- R186 Phase1审计: `docs/proposals/factor-expansion-R186-phase1-audit-report.md`
- R190 v2.6.0发布: `docs/proposals/factor-expansion-R190-round-plan.md`
- R191 Round计划: `docs/proposals/factor-expansion-R191-round-plan.md`
- R192 Round计划: `docs/proposals/factor-expansion-R192-round-plan.md`
- 收费目录v17.7: `Desktop/TradingEasy-收费目录-v17.7.txt`
