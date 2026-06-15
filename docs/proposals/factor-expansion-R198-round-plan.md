# R198: 🛢️商品适配器+L1期限+L2库存+L6季节性 | Round计划

> PM(Claw) 制定 | 2026-06-15 | Phase 5 Round 1 | v3.3.0-alpha
> 前置: R184-R197 (232因子全体系)✅ | 本轮: 商品期货基础设施+14因子

---

## 🎯 Round目标

1. **期货数据结构**: 合约链/展期/主力合约判断
2. **3数据适配器**: CFTC COT + EIA + LME
3. **14因子**: L1(7)+L2(5)+L6(2)
4. **3新组件**: CommodityOnboarding + SeasonalityCalendar + CommodityFactorCard
5. **8语言i18n**: 112条

---

## 📋 14因子

| # | 因子ID | 中文名 | 人话 | 等级 | 组 |
|---|--------|--------|------|------|----|
| 1 | CMD_ROLL_YIELD | 展期收益率 | 换月成本 | 🟢 | L1 |
| 2 | CMD_TERM_STRUCTURE | 期限结构斜率 | 远月比近月贵多少 | 🟡 | L1 |
| 3 | CMD_BASIS | 基差率 | 现货贵还是期货贵 | 🟡 | L1 |
| 4 | CMD_MOMENTUM_12M | 12月动量 | 过去1年涨最多的 | 🟢 | L1 |
| 5 | CMD_MOMENTUM_1M | 1月反转 | 上月猛涨该回调 | 🟡 | L1 |
| 6 | CMD_VOLATILITY | 波动率 | 波动越大趋势越强 | 🟡 | L1 |
| 7 | CMD_SKEWNESS | 收益偏度 | 跳空暴涨频率 | 🔴 | L1 |
| 8 | CMD_EIA_CRUDE | EIA原油库存 | 库存少了油价涨 | 🟢 | L2 |
| 9 | CMD_NATGAS_STORAGE | 天然气库存 | 地下储气够不够 | 🟡 | L2 |
| 10 | CMD_LME_INVENTORY | LME铜库存 | 仓单减少=涨价 | 🟡 | L2 |
| 11 | CMD_GOLD_ETF | 黄金ETF持仓 | GLD增持=看涨 | 🟢 | L2 |
| 12 | CMD_BALANCE_SHEET | 供需平衡表 | 产出<消费=紧缺 | 🔴 | L2 |
| 13 | CMD_SEASONALITY | 商品季节性 | 现在旺季还是淡季 | 🟢 | L6 |
| 14 | CMD_GOLD_SUMMER | 黄金夏季效应 | 6-8月涨68% | 🟢 | L6 |

---

## 🏗️ 6虾分工

### 🦐 JVS (7任务)

| # | 任务 | 验收 |
|---|------|------|
| J1 | 期货数据结构(合约链/展期/主力) | 合约链正确 |
| J2 | CommodityDataProvider基类 | 继承FactorDataProvider |
| J3 | CFTC COT适配器 | 商业/投机/散户解析 |
| J4 | EIA能源适配器 | 库存+预期vs实际 |
| J5 | LME金属适配器 | 仓单+库存趋势 |
| J6 | 14因子计算+Registry+4类别 | 全可计算+注册 |
| J7 | 代码量: ≥1700行 | |

### 🦐 ML (4任务)

| # | 任务 | 验收 |
|---|------|------|
| M1 | CommodityOnboarding 3步 | 选品种→看因子→学信号 |
| M2 | SeasonalityCalendar环形日历 | 12月+旺季/淡季 |
| M3 | CommodityFactorCard | 库存图+信号+人话 |
| M4 | 资产大类选择器扩展 | "🛢️大宗商品"Tab |

### 🦐 autoclaw (3任务)

| # | 任务 | 验收 |
|---|------|------|
| A1 | 14因子×8=112条i18n | 0缺译 |
| A2 | 4商品类别i18n(32条) | 分类准确 |
| A3 | 数据源API文档 | CFTC/EIA/LME |

### 🦐 QClaw (3任务)

| # | 任务 | 验收 |
|---|------|------|
| Q1 | 商品UX(金/橙/银/绿) | 4配色+信号卡 |
| Q2 | 14因子故事(42条) | 人话+比喻 |
| Q3 | 季节性视觉 | 环形日历+配色 |

### 🦐 youdao (3任务)

| # | 任务 | 验收 |
|---|------|------|
| Y1 | 70单元测试 | 70pass |
| Y2 | 3适配器集成 | CFTC+EIA+LME |
| Y3 | 日历UI测试 | 12月标注正确 |

### 🦐 Claw (4任务)

| # | 任务 | 状态 |
|---|------|------|
| C1 | ✅ Master Plan | ✅ |
| C2 | ✅ 广播 | ✅ |
| C3 | ✅ 计划(本文档) | ✅ |
| C4 | 商品一期审计 | ✅ |

---

## ✅ P0 10项

| ID | 标准 | 虾 |
|----|------|-----|
| V01 | TSC=0 | JVS/ML/autoclaw |
| V02 | 期货结构正确 | JVS |
| V03 | CFTC+EIA+LME可达 | JVS |
| V04 | 14因子可计算 | JVS |
| V05 | Onboarding 3步+日历 | ML |
| V06 | CommodityFactorCard | ML |
| V07 | 112条i18n | autoclaw |
| V08 | 70测试 | youdao |
| V09 | 3适配器集成 | youdao |
| V10 | 日历UI正确 | youdao |

---

## 📊 Phase 5

```
R198 [🟢] → 14商品因子 → 246总
R199 [⏳] → 12商品因子 → 258总 + v3.3.0
```
