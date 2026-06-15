# R188: 🟡港美股加密专属因子 + 链上/期权数据 | Round计划

> PM(Claw) 制定 | 2026-06-15 | Phase 2 Mid | v2.6.0-alpha
> 前置: R187(🟡通用34因子)✅ | 本轮: 34个市场专属🟡因子 + 链上数据 + 期权数据 + 健康/沙盒

---

## 🎯 Round目标

1. **34个市场专属🟡因子**全部可计算: 港股9 + 美股12 + 加密13
2. **链上数据适配器**: Glassnode/DefiLlama API → 加密因子数据源
3. **期权数据适配器**: 各交易所公开API → IV/PCR/未平仓量
4. **FactorHealthAlert**: 四维健康预警(IC/拥挤度/相关性/稳定性)
5. **FactorSandbox**: 选中因子→秒级历史回测预览
6. **8语言i18n**: 34×8=272条 + 市场专属UX文案

---

## 📋 34🟡市场专属因子清单

### 🇭🇰 港股🟡 (9)

| # | 因子ID | 中文名 | 计算类型 | 数据源 | 6虾共识 |
|---|--------|--------|----------|--------|---------|
| 1 | HK_CBBC_RATIO | 牛熊比例 | 比率型 | 港交所 | |
| 2 | HK_WARRANT_TURNOVER | 窝轮成交额 | 排名型 | 港交所 | |
| 3 | HK_CBBC_DISTANCE | 牛熊证回收距离 | 比率型 | 港交所 | |
| 4 | HK_SHORT_SELL_RATIO | 沽空比率 | 比率型 | 港交所 | ⭐ |
| 5 | HK_REIT_YIELD | REIT收益率 | 比率型 | 富途 | |
| 6 | HK_HSCEI_PREMIUM | H股溢价 | 比率型 | Wind | |
| 7 | HK_ETF_FLOW | ETF资金流 | 排名型 | 盈富基金 | |
| 8 | HK_DIV_TAX_ADV | 红利税优化 | 比率型 | 计算 | |
| 9 | HK_BOARD_ROTATION | 板块轮动强度 | 排名型 | 恒指分类 | |

### 🇺🇸 美股🟡 (12)

| # | 因子ID | 中文名 | 计算类型 | 数据源 | 6虾共识 |
|---|--------|--------|----------|--------|---------|
| 10 | US_EARNINGS_REVISION | 盈利预测上调 | 排名型 | Refinitiv | |
| 11 | US_REVENUE_SURPRISE | 营收超预期 | 排名型 | Refinitiv | |
| 12 | US_OI_PUT_CALL | 未平仓PCR | 比率型 | CBOE | |
| 13 | US_VOLUME_PCR | 成交量PCR | 比率型 | CBOE | |
| 14 | US_IV_RANK | IV百分位 | 排名型 | 计算 | |
| 15 | US_13F_FLOW | 机构持仓变动 | 排名型 | SEC 13F | ⭐ |
| 16 | US_BUYBACK_YIELD | 回购收益率 | 比率型 | S&P | |
| 17 | US_SHORT_FLOAT | 沽空流通比 | 比率型 | Finra | |
| 18 | US_RETAIL_FLOW | 散户资金流 | 排名型 | Robinhood | |
| 19 | US_MEME_STOCK | Meme Stock热度 | 排名型 | Reddit | |
| 20 | US_SECTOR_ETF_FLOW | 板块ETF资金流 | 排名型 | ETF.com | |
| 21 | US_SEASONALITY | 季节性效应 | 打分型 | 历史数据 | |

### 🪙 加密🟡 (13)

| # | 因子ID | 中文名 | 计算类型 | 数据源 | 6虾共识 |
|---|--------|--------|----------|--------|---------|
| 22 | CRYPTO_SOPR | 花费产出利润率 | 比率型 | Glassnode | ⭐ |
| 23 | CRYPTO_HASHRATE | 哈希率变化 | 比率型 | Glassnode | |
| 24 | CRYPTO_L2_TVL | L2锁仓量 | 排名型 | DefiLlama | |
| 25 | CRYPTO_USDT_PREMIUM | USDT溢价 | 比率型 | 交易所 | |
| 26 | CRYPTO_SOCIAL_VOLUME | 社交讨论量 | 排名型 | Santiment | |
| 27 | CRYPTO_WHALE_MOVEMENT | 巨鲸动向 | 排名型 | Glassnode | |
| 28 | CRYPTO_PERP_PREMIUM | 合约溢价 | 比率型 | 交易所 | |
| 29 | CRYPTO_OI_QUADRANT | OI四象限 | 打分型 | 交易所 | ⭐ |
| 30 | CRYPTO_GAS_TREND | Gas费趋势 | 排名型 | Etherscan | |
| 31 | CRYPTO_BTC_DOM_CHANGE | 山寨季信号 | 排名型 | CoinGecko | |
| 32 | CRYPTO_PERP_BASIS | 永续基差 | 比率型 | 交易所 | |
| 33 | CRYPTO_TAKER_RATIO | Taker买卖比 | 比率型 | 交易所 | |
| 34 | CRYPTO_DEV_ACTIVITY | 开发者活跃度 | 排名型 | GitHub | |

---

## 🏗️ 6虾分工

### 🦐 JVS (引擎)

| # | 任务 | 交付物 | 代码量 | 验收 |
|---|------|--------|--------|------|
| J1 | 实现34个市场专属🟡因子 | `electron/engine/factors/calculators/market-*.ts` | ≥600行 | 34因子可计算 |
| J2 | 链上数据适配器 | `electron/engine/factors/adapters/onchain-adapter.ts` | ≥200行 | Glassnode+DefiLlama双重可达 |
| J3 | 期权数据适配器 | `electron/engine/factors/adapters/options-adapter.ts` | ≥200行 | IV/PCR/未平仓量数据可达 |
| J4 | 34因子Registry注册 | `factor-id-registry.ts` | ≥50行 | HK/US/CC前缀+L2标记 |

### 🦐 ML (前端)

| # | 任务 | 交付物 | 代码量 | 验收 |
|---|------|--------|--------|------|
| M1 | FactorHealthAlert | `src/components/strategy/FactorHealthAlert.tsx` | ≥250行 | IC/拥挤/相关/稳定四维预警 |
| M2 | FactorSandbox | `src/components/strategy/FactorSandbox.tsx` | ≥250行 | 选因子→秒级历史回测预览 |
| M3 | 市场专属FactorCard | `src/components/strategy/FactorCardMarket.tsx` | ≥150行 | 区域旗帜+时区+假期提示 |

### 🦐 autoclaw (全栈)

| # | 任务 | 交付物 | 代码量 | 验收 |
|---|------|--------|--------|------|
| A1 | 34🟡因子i18n(8语言) | `factor-i18n-map.ts` + locales | ≥400行 | 272条0缺译 |
| A2 | 链上数据→因子管线 | `electron/engine/factors/pipelines/onchain-pipeline.ts` | ≥200行 | Glassnode→因子计算→信号灯 |
| A3 | 市场专属UX文案i18n | 区域旗帜/时区/假期 8语言 | ≥100行 | 8语言市场文案 |

### 🦐 QClaw (设计)

| # | 任务 | 交付物 | 代码量 | 验收 |
|---|------|--------|--------|------|
| Q1 | 因子衰退倒计时UX | `docs/design/factor-decay-countdown-ux.md` | ≥150行 | IC衰减→倒计时→建议 |
| Q2 | 🟡因子故事文案34个 | `docs/design/factor-stories-market-zh.md` | ≥200行 | 中英日3语 |
| Q3 | 市场专属UX规范 | `docs/design/market-specific-ux.md` | ≥150行 | 3市场标识+时区+假期 |

### 🦐 youdao (测试)

| # | 任务 | 交付物 | 代码量 | 验收 |
|---|------|--------|--------|------|
| Y1 | 34🟡因子单元测试 | `tests/unit/factors-market-*.test.ts` | ≥350行 | ≥170测试pass |
| Y2 | 链上数据管线集成测试 | `tests/integration/onchain-pipeline.test.ts` | ≥100行 | API→计算→信号→UI |
| Y3 | 期权数据管线集成测试 | `tests/integration/options-pipeline.test.ts` | ≥100行 | API→IV/PCR→信号→UI |

### 🦐 Claw (PM)

| # | 任务 | 交付物 | 代码量 | 验收 |
|---|------|--------|--------|------|
| C1 | ✅ chat-bridge广播R188 | 广播消息 | — | 6虾确认 |
| C2 | R188 Round计划(本文档) | 验收标准+分工+因子清单 | ≥400行 | 完整 |
| C3 | 🟡市场专属因子质量审计 | 34因子计算验证+数据源可达 | — | 34因子验收通过 |

---

## ✅ 验收标准

### P0 必过 (12项)

| ID | 验收项 | 标准 | 负责虾 |
|----|--------|------|--------|
| V01 | TSC | 0新增类型错误 | JVS/ML/autoclaw |
| V02 | 34🟡市场专属因子 | 全部可计算+信号灯输出 | JVS |
| V03 | 链上数据适配器 | Glassnode+DefiLlama可达 | JVS |
| V04 | 期权数据适配器 | IV/PCR/未平仓量可达 | JVS |
| V05 | FactorHealthAlert | 四维预警(IC/拥挤/相关/稳定) | ML |
| V06 | FactorSandbox | 选因子→历史回测预览 | ML |
| V07 | 市场专属FactorCard | 区域旗帜+时区+假期标识 | ML |
| V08 | 34🟡因子i18n | 8语言272条0缺译 | autoclaw |
| V09 | 链上数据管线 | Glassnode→计算→信号灯跑通 | autoclaw |
| V10 | ≥170单元测试 | 34因子×5=170 | youdao |
| V11 | 链上管线集成测试 | API→计算→信号→UI | youdao |
| V12 | 期权管线集成测试 | API→IV/PCR→信号→UI | youdao |

### P1 建议 (4项)

| ID | 验收项 | 标准 | 负责虾 |
|----|--------|------|--------|
| V13 | 因子衰退倒计时UX | IC衰减可视化+建议弹窗 | QClaw |
| V14 | Build 0 error | 整体编译通过 | JVS/ML/autoclaw |
| V15 | 沙盒回测<5s | 单因子秒级回测 | ML+JVS |
| V16 | 链上数据缓存 | 减少API调用(每分钟>60次限流) | JVS |

---

## 🔗 新增架构组件

```
┌─────────────────────────────────────────────────────────────┐
│                    R188 新增架构                              │
│                                                             │
│  [数据源新层]                                               │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ OnchainAdapter  │  │ OptionsAdapter  │                  │
│  │ Glassnode       │  │ CBOE PCR/IV     │                  │
│  │ DefiLlama TVL   │  │ 各交易所期权     │                  │
│  │ Santiment社交   │  │ 未平仓量        │                  │
│  └────────┬────────┘  └────────┬────────┘                  │
│           │                    │                             │
│           └────────┬───────────┘                             │
│                    ▼                                        │
│  [FactorDataProvider] (R186) → [预处理管线] → [计算层]     │
│                                                             │
│  [新UI组件]                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │HealthAlert   │  │  Sandbox     │  │ MarketCard      │  │
│  │IC/拥挤/相关  │  │  秒级回测    │  │ 🇭🇰🇺🇸🪙标识     │  │
│  │/稳定四维     │  │  单因子免费  │  │ 时区/假期       │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Phase 2 进度追踪

| Round | 状态 | 🟡因子数 | 累计🟡 | 累计因子总数 |
|-------|------|---------|--------|-------------|
| R187 | ✅ 已启动 | 34 (通用) | 34 | 73 (42旧+31🟢) |
| **R188** | 🟢 启动 | **34 (市场专属)** | **68** | **107** |
| R189 | ⏳ 待通知 | 0 (深度服务) | 68 | 107 |
| R190 | ⏳ 待通知 | 0 (收尾) | 68 | 107 |

---

## 🔑 关键规则 (R188)

1. **三级分类无门槛** — 🟡需切换到"进阶模式"
2. **因子免费+深度服务按次** — 34🟡因子本身免费(v17.7)
3. **不做A股**
4. **FactorHealthAlert四维**:
   - IC趋势: 12月滚动IC走向
   - 拥挤度: 持仓集中+估值溢价+换手率
   - 相关性: 与同类因子Pearson r(r≥0.7🟡警告)
   - 稳定性: IC波动率/IR比率
5. **FactorSandbox**: 单因子秒级回测免费，多因子组合回测1U/次
6. **链上数据限流**: Glassnode免费API 60次/min，必须加缓存
7. **市场专属UX**:
   - 🇭🇰 港股: 港交所时区(HKT UTC+8)+港交所假期
   - 🇺🇸 美股: 美东时区(EST)+NYSE假期
   - 🪙 加密: UTC+24/7标记

---

## 📎 参考文件

- Master Plan: `docs/proposals/factor-expansion-R184-R193-master-plan.md`
- 因子清单v2: `docs/proposals/factor-expansion-12shrimp-consolidated-checklist-v2.md`
- R186 Phase1审计: `docs/proposals/factor-expansion-R186-phase1-audit-report.md`
- R187 Round计划: `docs/proposals/factor-expansion-R187-round-plan.md`
- 收费目录v17.7: `Desktop/TradingEasy-收费目录-v17.7.txt`
