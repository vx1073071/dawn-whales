# R190: 🟡收尾 + Phase 2集成 | Round计划 + v2.6.0发布审计

> PM(Claw) 制定 | 2026-06-15 | Phase 2 终轮 | v2.6.0
> 前置: R187-R189 全部✅ | 本轮: IC监控+拥挤报警+社交+推荐+全量测试+v2.6.0发布

---

## 🎯 Round目标

1. **因子滚动IC监控**: 12月IC趋势+衰减检测+自动标记衰退因子
2. **因子拥挤度报警**: 估值溢价+持仓集中+换手率 三合一Crowding检测
3. **全68🟡因子性能优化**: 批量计算+并行化+缓存预热 (<10s)
4. **FactorRollingIC + FactorCrowdingAlert**: 2个监控组件落地
5. **全链路🟡交互串联**: PK+权重+健康+沙盒+热力图+龙虎榜+搜索 全串联
6. **社交证明UI + 因材施教推荐引擎v1**
7. **全量回归测试 + E2E + 性能基准**
8. **v2.6.0 正式发布**

---

## 🏗️ 6虾分工

### 🦐 JVS (引擎)

| # | 任务 | 交付物 | 代码量 | 验收 |
|---|------|--------|--------|------|
| J1 | 因子滚动IC监控 | `electron/engine/factors/monitor/rolling-ic-monitor.ts` | ≥250行 | 12月IC趋势+衰减标记 |
| J2 | 因子拥挤度报警 | `electron/engine/factors/monitor/crowding-detector.ts` | ≥250行 | 4维检测+阈值报警 |
| J3 | 68🟡因子性能优化 | `electron/engine/factors/batch-calculator.ts` | ≥200行 | 批量<10s+并行+缓存 |

**IC监控规格**:
- 窗口: 12月滚动
- 输出: IC月序列 / 衰减斜率 / 衰退标记(连续3月<0.02)
- 自动标记: IC连续5月>0.05→"强有效" / 连续3月<0.02→"衰退警告"

**拥挤度报警规格**:
| 维度 | 指标 | 阈值(🟡警告) | 阈值(🔴危险) |
|------|------|-------------|-------------|
| 估值溢价 | 使用该因子的Top10%股vs全市场PE中位比 | >1.3x | >1.5x |
| 持仓集中 | 因子Top组的平均机构持仓占比 | >65% | >80% |
| 换手率 | 因子Top组的季度换手率变化 | +30% | +50% |
| 综合指数 | 3维加权平均 | >60% | >80% |

### 🦐 ML (前端)

| # | 任务 | 交付物 | 代码量 | 验收 |
|---|------|--------|--------|------|
| M1 | FactorRollingIC | `src/components/strategy/FactorRollingIC.tsx` | ≥200行 | 12月IC热力图+衰减箭头 |
| M2 | FactorCrowdingAlert | `src/components/strategy/FactorCrowdingAlert.tsx` | ≥200行 | 拥挤度仪表盘+🟡🔴警告 |
| M3 | 🟡全链路交互串联 | 整合已有12组件到统一工作流 | ≥200行 | PK→权重→健康→沙盒→热力图→龙虎榜流畅 |

**12组件串联清单**:
```
FactorCard(🟡因子卡片) → FactorSignalLight(信号灯)
→ FactorWeightSlider(拖拽权重) → FactorPK(2因子对比)
→ FactorHealthAlert(四维健康) → FactorSandbox(秒级回测)
→ FactorCalendarHeatmap(月度热力图) → FactorWeeklyLeaderboard(龙虎榜)
→ FactorSearchBar v2(搜索3模式) → ScenarioPackSelector(场景包)
→ FactorRollingIC(IC监控) → FactorCrowdingAlert(拥挤报警)
```

### 🦐 autoclaw (全栈)

| # | 任务 | 交付物 | 代码量 | 验收 |
|---|------|--------|--------|------|
| A1 | 🟡因子全量i18n审查 | 68因子×8语言=544条补全 | ≥300行 | 0缺译+术语一致 |
| A2 | 因子→信号→UI全链路集成 | 68🟡因子端到端逐因子验证 | ≥200行 | 68因子全链路pass |
| A3 | Build打包+CI/CD验证 | 编译+打包+依赖审计 | ≥50行 | Build 0 error |

**全链路验证模板** (每因子):
```
1. Factor ID 注册 ✅
2. 计算逻辑 → 输出值 ✅
3. IC计算 → 信号灯 ✅
4. i18n(8语言) → 名称/故事/信号描述 ✅
5. FactorCard渲染 → 信号灯+IC+level ✅
6. 数据源接入 → 3市场数据可达 ✅
```

### 🦐 QClaw (设计)

| # | 任务 | 交付物 | 代码量 | 验收 |
|---|------|--------|--------|------|
| Q1 | 因子社交证明UI | `docs/design/factor-social-proof-ui.md` | ≥150行 | "N人使用"+⭐+评价 |
| Q2 | 因材施教推荐引擎v1 | `docs/design/adaptive-recommendation-engine.md` | ≥150行 | 3档画像→推荐映射 |
| Q3 | Phase 2 UX一致性审查 | `docs/design/phase2-ux-consistency-audit.md` | ≥150行 | 12组件+68因子一致性 |

**因材施教推荐引擎**:
| 用户画像 | 推荐内容 | 因子数量 |
|----------|----------|----------|
| 🟢 新手 | 牛市进攻/熊市防御/震荡轮动 场景包 | 5-8因子/包 |
| 🟡 进阶 | 自选因子组合+PK对比+权重拖拽 | 自选 |
| 🔴 专业 | 全99因子+AI参数优化+替代数据 | 全量 |

### 🦐 youdao (测试)

| # | 任务 | 交付物 | 代码量 | 验收 |
|---|------|--------|--------|------|
| Y1 | 🟡全量回归测试 | `tests/regression/factors-yellow-204.test.ts` | ≥300行 | 68因子×3市场=204场景 |
| Y2 | 深度服务E2E | `tests/e2e/deep-service-full-flow.test.ts` | ≥150行 | 回测→诊断→付费→退款 全链 |
| Y3 | Phase 2性能测试 | `tests/perf/phase2-benchmark.test.ts` | ≥100行 | 3项性能达标 |

**E2E全链路场景**:
```
1. 选因子(EARNINGS_YIELD + ROA + BETA) → 拖拽权重 30/40/30
2. 单因子回测(免费) → 查看IC趋势
3. 点击"多因子回测(1U)" → 确认扣费 → 执行 → 5维结果
4. 点击"一键诊断(1U)" → 确认扣费 → 全因子Top5
5. 查看热力图 → 本月赚钱Top3
6. 查看龙虎榜 → 本周最强因子
7. 余额不足 → 拒绝 → 引导充值
8. 添加评价 ⭐4 → "这个ROA因子在港股很好用"
```

**Phase 2 性能基准**:
| 指标 | 目标 | 测量方式 |
|------|------|----------|
| 68🟡因子批量计算 | <10s | batch-calculator.ts timer |
| 多因子回测(5因子) | <30s | multi-factor-backtest.ts |
| 单因子诊断 | <5s | single-factor-diagnosis.ts |

### 🦐 Claw (PM)

| # | 任务 | 交付物 | 代码量 | 验收 |
|---|------|--------|--------|------|
| C1 | ✅ chat-bridge广播R190 | 广播消息 | — | 6虾确认 |
| C2 | R190 Round计划(本文档) | 验收标准+分工 | ≥500行 | 完整 |
| C3 | Phase 2全面审计 | 68🟡因子+深度服务+12组件+计费 | ≥400行 | 审计通过 |
| C4 | v2.6.0发布确认 | BUILT+TSC+TEST+PERF+i18n | ≥200行 | 全部达标 |
| C5 | chat-bridge广播Phase 2完成 | 完成消息 | — | v2.6.0发布 |

---

## ✅ v2.6.0 发布检查清单

### 代码质量

| # | 检查项 | 标准 | 负责虾 | 状态 |
|---|--------|------|--------|------|
| Q01 | TSC | 0新增类型错误 | JVS/ML/autoclaw | ☐ |
| Q02 | Build | 0 error (Electron+React) | autoclaw | ☐ |
| Q03 | npm audit | 0 critical/high | autoclaw | ☐ |

### 因子完整性

| # | 检查项 | 标准 | 负责虾 | 状态 |
|---|--------|------|--------|------|
| F01 | 31🟢因子 | 全可计算+信号灯+8语言 | R185+R186 | ☐ |
| F02 | 34🟡通用因子 | 全可计算+PK+权重 | R187 | ☐ |
| F03 | 34🟡市场专属 | 全可计算+链上/期权数据 | R188 | ☐ |
| F04 | 99因子全链路 | 每因子计算→IC→信号→UI | autoclaw | ☐ |
| F05 | 8语言i18n | 792条0缺译 | autoclaw | ☐ |

### 交互组件 (12个)

| # | 组件 | 来源R | 状态 |
|---|------|-------|------|
| U01 | FactorCard(🟢🟡卡片) | R184+R185 | ☐ |
| U02 | FactorSignalLight(信号灯) | R185 | ☐ |
| U03 | ScenarioPackSelector(8场景包) | R185 | ☐ |
| U04 | FactorLevelSelector(三级分类) | R184 | ☐ |
| U05 | FactorWeightSlider(权重拖拽) | R187 | ☐ |
| U06 | FactorPK(2因子对比) | R187 | ☐ |
| U07 | FactorHealthAlert(四维健康) | R188 | ☐ |
| U08 | FactorSandbox(秒级回测) | R188 | ☐ |
| U09 | FactorCalendarHeatmap(热力图) | R189 | ☐ |
| U10 | FactorWeeklyLeaderboard(龙虎榜) | R189 | ☐ |
| U11 | FactorRollingIC(IC监控) | R190 | ☐ |
| U12 | FactorCrowdingAlert(拥挤报警) | R190 | ☐ |

### 深度服务 + 计费

| # | 检查项 | 标准 | 负责虾 | 状态 |
|---|--------|------|--------|------|
| D01 | 单因子回测(免费) | <5s + 5组多空 | JVS (R189) | ☐ |
| D02 | 多因子回测(1U) | <30s + 5维输出 | JVS (R189) | ☐ |
| D03 | 因子诊断(1U) | <5s + Top5信号 | JVS (R189) | ☐ |
| D04 | 计费管线 | hold→settle/refund 7场景 | autoclaw (R189) | ☐ |
| D05 | 24h缓存 | 同参不重复扣费 | JVS (R189) | ☐ |
| D06 | 计费安全审计 | 7项安全检查 | Claw (R189) | ☐ |

### 测试

| # | 测试类型 | 数量 | 负责虾 | 状态 |
|---|----------|------|--------|------|
| T01 | 🟢因子单元测试 | ≥175 (R185) | youdao | ☐ |
| T02 | 🟡通用单元测试 | ≥170 (R187) | youdao | ☐ |
| T03 | 🟡市场单元测试 | ≥170 (R188) | youdao | ☐ |
| T04 | 深度服务测试 | ≥50 (R189) | youdao | ☐ |
| T05 | 🟡全量回归 | 204场景 (R190) | youdao | ☐ |
| T06 | 深度服务E2E | 8场景全链路 (R190) | youdao | ☐ |
| **合计** | | **≥769** | | ☐ |

### 性能

| # | 指标 | 目标 | 负责虾 | 状态 |
|---|------|------|--------|------|
| P01 | 68🟡因子批量 | <10s | JVS | ☐ |
| P02 | 多因子回测 | <30s | JVS | ☐ |
| P03 | 单因子诊断 | <5s | JVS | ☐ |
| P04 | 缓存命中率 | >90% | JVS | ☐ |

### 社交 + 推荐

| # | 检查项 | 负责虾 | 状态 |
|---|--------|--------|------|
| S01 | 社交证明UI: "N人使用"+⭐ | QClaw | ☐ |
| S02 | 因材施教推荐引擎v1 | QClaw | ☐ |
| S03 | Phase 2 UX一致性 | QClaw | ☐ |

---

## 📊 v2.6.0 里程碑总览

```
v2.6.0 = v2.5.0(🟢31因子+8场景包) + 🟡68因子 + 12交互组件 + 深度服务(回测+诊断)

因子: 🟢31 + 🟡68 = 99因子
交互: 12组件 (PK/权重/健康/沙盒/热力图/龙虎榜/搜索/信号灯/场景包/卡片/IC/拥挤)
收费: 回测1U/次 + 诊断1U/次
数据: 3市场(港股/美股/加密) + 链上(Gassnode) + 期权(CBOE)
语言: 8语言 i18n 792条
测试: ≥769测试
性能: 批量<10s + 回测<30s + 诊断<5s
```

---

## 📊 Phase 2 完成 → Phase 3 预览

| 指标 | Phase 1 (v2.5.0) | Phase 2 (v2.6.0) | Phase 3 (v3.0.0) |
|------|-----------------|-----------------|-----------------|
| 因子数 | 31🟢 | +68🟡=99 | +89🔴=188 |
| 交互组件 | 4 | +8=12 | +? |
| 深度服务 | 无 | 回测+诊断(2项) | AI优化+替代数据(追加2项) |
| Round | R184-R186(3轮) | R187-R190(4轮) | R191-R193(3轮) |
| 可收费 | 0 | 💰 2项(回测1U+诊断1U) | 💰 4项(追加优化1.5U+替代2U) |

---

## 🔑 关键规则 (R190)

1. **v2.6.0 发布标准**: ALL 检查项(Q/F/U/D/T/P/S)必须全✅
2. **i18n 0缺译**: 792条必须逐条检查
3. **E2E 必须覆盖计费**: 付费场景7项必须全pass
4. **性能必须达标**: 3项性能指标全部测量验证
5. **社交证明**: 初始数据用"模拟"(上线后替换为真实)
6. **推荐引擎v1**: MVP版本，默认推荐场景包，后续迭代

---

## 📎 参考文件

- Master Plan: `docs/proposals/factor-expansion-R184-R193-master-plan.md`
- R186 Phase1审计: `docs/proposals/factor-expansion-R186-phase1-audit-report.md`
- R187 Round计划: `docs/proposals/factor-expansion-R187-round-plan.md`
- R188 Round计划: `docs/proposals/factor-expansion-R188-round-plan.md`
- R189 Round计划: `docs/proposals/factor-expansion-R189-round-plan.md`
- 收费目录v17.7: `Desktop/quant-moo-收费目录-v17.7.txt`
