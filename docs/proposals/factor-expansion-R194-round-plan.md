# R194: 🇯🇵日本+🇹🇼台湾 + 7市场适配器框架 | Round计划

> PM(Claw) 制定 | 2026-06-15 | Phase 4 首轮 | v3.2.0-alpha
> 前置: R184-R193 (188因子全体系)✅ | 本轮: 7市场适配器基类 + JP12+TW7=19专属因子

---

## 🎯 Round目标

1. **7市场适配器基类**: MarketAdapterBase 继承 FactorDataProvider
2. **🇯🇵JPX数据适配器**: 日银ETF / 外国人买卖 / JPX400 / TOPIX行业
3. **🇹🇼TWSE数据适配器**: 融资融券 / 外资买卖超 / 台积电联动
4. **19专属因子**: JP12 + TW7 全部可计算
5. **MarketFlag组件**: 7国旗+时区+假期+货币
6. **市场选择器升级**: 3→5市场(🇭🇰🇺🇸🪙+🇯🇵🇹🇼)
7. **8语言i18n**: 19因子×8=152条 + 7市场元数据

---

## 📋 19因子清单

### 🇯🇵 日本 (12)

| # | 因子ID | 中文名 | 等级 | 计算类型 | 数据源 |
|---|--------|--------|------|----------|--------|
| 1 | JP_BOJ_ETF | 日银ETF购入 | 🟡 | 排序型 | 日银公告 |
| 2 | JP_CROSS_HOLDING | 交叉持股折扣 | 🔴 | 比率型 | 财报 |
| 3 | JP_MARCH_EFFECT | 3月财年末效应 | 🟢 | 事件型 | 历史 |
| 4 | JPY_CARRY_TRADE | 日元套息方向 | 🔴 | 比率型 | BOJ |
| 5 | JPX_400_SELECTION | JPX400选股 | 🟡 | 分类型 | JPX |
| 6 | JP_TOPIX_SECTOR | 行业轮动 | 🟡 | 排序型 | JPX |
| 7 | JP_FOREIGN_FLOW | 外国人买卖超 | 🟢 | 排序型 | 交易所 |
| 8 | JP_DIVIDEND_SEASON | 分红季效应 | 🟢 | 事件型 | 历史 |
| 9 | JP_SHAREHOLDER_BENEFIT | 股东优待 | 🔴 | 分类型 | 公告 |
| 10 | JP_BANK_LENDING | 银行股联动 | 🟡 | 比率型 | BOJ |
| 11 | JP_VALUE_TRAP | 价值陷阱 | 🔴 | 打分型 | 财报 |
| 12 | JPY_SENSITIVITY | 日元敏感度 | 🟡 | 回归型 | 计算 |

### 🇹🇼 台湾 (7)

| # | 因子ID | 中文名 | 等级 | 计算类型 | 数据源 |
|---|--------|--------|------|----------|--------|
| 13 | TW_MARGIN_BALANCE | 融资余额 | 🟢 | 排序型 | TWSE |
| 14 | TW_SHORT_RATIO | 融券余额 | 🟡 | 比率型 | TWSE |
| 15 | TW_FOREIGN_FLOW | 外资买卖超 | 🟢 | 排序型 | TWSE |
| 16 | TW_TSMC_LINKAGE | 台积电联动 | 🟡 | 回归型 | 计算 |
| 17 | TW_DIVIDEND_CHASE | 除权息抢权 | 🟡 | 事件型 | TWSE |
| 18 | TW_FINANCING_OVERHEAT | 融资过热 | 🔴 | 打分型 | TWSE |
| 19 | TW_NT_DOLLAR | 台币汇率联动 | 🟡 | 比率型 | 央行 |

---

## 🏗️ 6虾分工

### 🦐 JVS (引擎)

| # | 任务 | 交付物 | 代码量 | 验收 |
|---|------|--------|--------|------|
| J1 | MarketAdapterBase基类 | `electron/engine/factors/adapters/market-adapter-base.ts` | ≥200行 | 继承FactorDataProvider |
| J2 | JPX数据适配器 | `electron/engine/factors/adapters/jpx-adapter.ts` | ≥250行 | 日银ETF/外资/JPX400/TOPIX可达 |
| J3 | TWSE数据适配器 | `electron/engine/factors/adapters/twse-adapter.ts` | ≥250行 | 融资融券/外资/台积电联动可达 |
| J4 | 19因子计算+Registry | `calculators/jp-*.ts` + `calculators/tw-*.ts` | ≥500行 | 19因子可计算+L3/L2/L1正确 |

**MarketAdapterBase接口**:
```typescript
interface MarketAdapterBase extends FactorDataProvider {
  market: MarketCode;  // 'JP' | 'TW' | 'KR' | 'SG' | 'AU' | 'IN' | 'EU'
  timezone: string;     // 'Asia/Tokyo'
  currency: string;     // 'JPY'
  holidays: Date[];     // 2026年假期列表
  getOHLCV(symbol, start, end): Promise<OHLCV[]>;
  getFundamental(symbol): Promise<FundamentalData>;
  getMarketSpecific(symbol, factorId): Promise<any>; // 市场专属数据
}
```

### 🦐 ML (前端)

| # | 任务 | 交付物 | 代码量 | 验收 |
|---|------|--------|--------|------|
| M1 | MarketFlag组件 | `src/components/strategy/MarketFlag.tsx` | ≥200行 | 7国旗+时区+假期+货币 |
| M2 | 市场选择器升级 | `src/components/strategy/MarketSelector.tsx` | ≥200行 | 🇭🇰🇺🇸🪙🇯🇵🇹🇼 5选项+预留7个位 |
| M3 | JP+TW专属卡片 | `src/components/strategy/MarketFactorCard.tsx` | ≥200行 | 国旗+时区+本地信号 |

**MarketFlag渲染**:
- 国旗: 24px圆角国旗emoji
- 时区: "JST UTC+9" / "TST UTC+8"
- 假期: 鼠标悬浮显示当月假期
- 货币: "JPY ¥" / "TWD NT$"

### 🦐 autoclaw (全栈)

| # | 任务 | 交付物 | 代码量 | 验收 |
|---|------|--------|--------|------|
| A1 | 19因子i18n(8语言) | `factor-i18n-map.ts` + locales | ≥350行 | 152条0缺译 |
| A2 | 7市场元数据i18n | 市场名/时区/货币/假期×8语言 | ≥150行 | 市场信息准确 |
| A3 | 日文/繁体母语级翻译 | 日语原生表达+zh-TW术语 | — | 日本用户可理解 |

### 🦐 QClaw (设计)

| # | 任务 | 交付物 | 代码量 | 验收 |
|---|------|--------|--------|------|
| Q1 | 🇯🇵🇹🇼市场UX设计 | `docs/design/jp-tw-market-ux.md` | ≥200行 | 和风红白+清新蓝绿 |
| Q2 | 19因子故事(3语) | `docs/design/factor-stories-jp-tw.md` | ≥200行 | 含日语原生表达 |
| Q3 | 7市场Onboarding扩展 | `docs/design/multi-market-onboarding.md` | ≥150行 | 选市场→看本地因子 |

**日本UX设计要点**:
- 主色: 红(#BC002D)+白 = 日本国旗
- 次级: 绀蓝(#1B315E) = 传统和风
- 因子名: 同时显示日语(日銀ETF買入)和中文
- 故事: 用日语原生比喻(如"日銀の見えざる手")

### 🦐 youdao (测试)

| # | 任务 | 交付物 | 代码量 | 验收 |
|---|------|--------|--------|------|
| Y1 | 19因子单元测试 | `tests/unit/factors-jp-tw.test.ts` | ≥350行 | ≥95测试pass |
| Y2 | JPX+TWSE适配器集成 | `tests/integration/jpx-twse-adapter.test.ts` | ≥150行 | 数据源可达 |
| Y3 | 市场切换+国旗UI测试 | `tests/ui/market-flag.test.ts` | ≥100行 | 5国旗正确渲染 |

### 🦐 Claw (PM)

| # | 任务 | 交付物 | 代码量 | 验收 |
|---|------|--------|--------|------|
| C1 | ✅ R194-R197 Master Plan | 4轮完整方案 | — | 已完成 |
| C2 | ✅ chat-bridge广播 | 广播消息 | — | 6虾确认 |
| C3 | R194 Round计划(本文档) | 验收标准+分工 | ≥400行 | 完整 |
| C4 | 7市场扩展一期审计 | 19因子+2适配器+MarketFlag | ≥200行 | 验收通过 |

---

## ✅ 验收标准

### P0 必过 (12项)

| ID | 验收项 | 标准 | 负责虾 |
|----|--------|------|--------|
| V01 | TSC | 0新增类型错误 | JVS/ML/autoclaw |
| V02 | MarketAdapterBase | 基类可编译+子类可继承 | JVS |
| V03 | JPX适配器 | 日银ETF/外资/JPX400/TOPIX 数据可达 | JVS |
| V04 | TWSE适配器 | 融资融券/外资/台积电联动 数据可达 | JVS |
| V05 | 19因子计算 | JP12+TW7全部可计算 | JVS |
| V06 | MarketFlag 7市场 | 国旗+时区+假期+货币渲染正确 | ML |
| V07 | 市场选择器5选项 | 🇭🇰🇺🇸🪙🇯🇵🇹🇼 切换流畅 | ML |
| V08 | JP+TW专属卡片 | 国旗标识+本地信号解读 | ML |
| V09 | 19因子i18n | 8语言152条0缺译 | autoclaw |
| V10 | 市场元数据i18n | 市场/时区/货币/假期准确 | autoclaw |
| V11 | ≥95单元测试 | 19×5=95 | youdao |
| V12 | 适配器集成测试 | JPX+TWSE数据源可达 | youdao |

### P1 建议 (4项)

| ID | 验收项 | 标准 | 负责虾 |
|----|--------|------|--------|
| V13 | Build 0 error | 整体编译通过 | JVS/ML/autoclaw |
| V14 | 日语翻译质量 | 母语级(日本用户可理解) | autoclaw/QClaw |
| V15 | 本土化视觉 | 和风/台式配色自然 | QClaw |
| V16 | Onboarding扩展 | 新步骤流畅 | QClaw |

---

## 📊 Phase 4 进度追踪

| Round | 状态 | 市场 | 因子数 | 累计 |
|-------|------|------|--------|------|
| **R194** | 🟢 启动 | 🇯🇵🇹🇼 | 19 | 207 |
| R195 | ⏳ 待通知 | 🇰🇷🇸🇬🇦🇺 | 16 | 223 |
| R196 | ⏳ 待通知 | 🇮🇳🇪🇺 | 9 | 232 |
| R197 | ⏳ 待通知 | 集成+发布 | 0 | 232 |

---

## 📎 参考文件

- Phase 4 Master Plan: `docs/proposals/factor-expansion-7markets-R194-R197-master-plan.md`
- 因子清单v2: `docs/proposals/factor-expansion-12shrimp-consolidated-checklist-v2.md`
- R186 FactorDataProvider: `electron/engine/factors/data-provider.ts`
- 收费目录v17.7: `Desktop/TradingEasy-收费目录-v17.7.txt`
