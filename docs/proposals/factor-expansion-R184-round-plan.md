# R184 Round Plan — 因子扩充基础设施搭建

> PM(Claw) | 2026-06-15 | R184 | Phase 1 首轮

---

## 📋 Round 概览

| 项目 | 内容 |
|------|------|
| **Round** | R184 |
| **Phase** | 1 (v2.5.0-alpha) |
| **主题** | 因子扩充基础设施搭建 |
| **目标** | 为187新因子+三级分类+场景包+信号灯搭建完整基础设施 |
| **估时** | 30h |
| **前置依赖** | R183完成，factor-id-registry.ts现有44因子 |

---

## 🎯 6虾分工详情

### 🦐 JVS(引擎) — 2项核心任务

#### 任务1: factor-id-registry.ts v2
**文件**: `electron/engine/factors/factor-id-registry.ts`

现有44因子需扩展为44+187=231因子(含2个deprecated)，新增字段：

```typescript
// 新增类型
export type FactorLevel = 'L1' | 'L2' | 'L3';

// 扩展STANDARD_FACTOR_IDS，新增187个因子ID
// 按分类组织:
//   A1价值7 + A2质量8 + A3低波5 + A4情绪8(含KDJ已存在) + A5宏观7 + A6主题4
//   + A7期权10 + A8事件7 + A9套利6 + A10深度6 + A11行为5 + A12替代6
//   + HK24 + US29 + CC45 + XM10

// 新增FACTOR_LEVEL_MAP
export const FACTOR_LEVEL_MAP: Record<FactorId, FactorLevel> = {
  // 现有44因子需补level（全部为L1，因为已存在且用户已习惯）
  MOM_12M: 'L1',
  KDJ: 'L1', // KDJ已有，等级L1
  // ... 其余现有因子

  // 新增187因子level参照: factor-expansion-12shrimp-consolidated-checklist-v2.md
  EARNINGS_YIELD: 'L1',   // 🟢入门
  SALES_TO_PRICE: 'L2',   // 🟡进阶
  EBITDA_EV: 'L3',        // 🔴专业
  // ... 187个
};
```

**验收**: `npx tsc --noEmit` 0 error + 187新ID全部注册 + FACTOR_LEVEL_MAP 231条

#### 任务2: 因子计算模板框架
**文件**: `electron/engine/factors/templates/`

```
templates/
  FactorCalculator.ts          # 基类(抽象)
  RatioFactorCalculator.ts     # 比率型模板(PE/PB/ROE等)
  RankingFactorCalculator.ts   # 排名型模板(百分位/分位数)
  SignalFactorCalculator.ts    # 信号型模板(超买超卖/金叉死叉)
  index.ts                     # 统一导出
```

**验收**: 4文件可编译 + 基类接口定义完整(输入/输出/缓存/错误处理) + 3模板可实例化

---

### 🦐 ML(前端) — 3项核心任务

#### 任务1: FactorLevelSelector组件
**文件**: `src/components/strategy/FactorLevelSelector.tsx`

```typescript
interface FactorLevelSelectorProps {
  currentLevel: 'L1' | 'L2' | 'L3';
  onLevelChange: (level: 'L1' | 'L2' | 'L3') => void;
  factorCounts: { L1: number; L2: number; L3: number };
}
```

- 三级按钮: 🟢入门(35) / 🟡进阶(62) / 🔴专业(89)
- 无门槛切换(不弹确认框，不检查使用天数)
- 显示各级因子数量
- i18n支持

**验收**: 组件渲染 + 点击切换 + i18n 3语言

#### 任务2: FactorCard组件升级
**文件**: `src/components/strategy/FactorCard.tsx`

升级点:
- 新增level徽章(🟢🟡🔴小图标)
- 新增信号灯位(预留🟢🟡🔴⚪图标位，R185填充)
- level字段从FactorLevelSelector传入

**验收**: 升级后现有FactorCard不受影响 + level徽章渲染 + 信号灯位可见

#### 任务3: 因子市场自动切换框架
**文件**: `src/components/strategy/FactorMarketContext.tsx`

```typescript
interface FactorMarketContextType {
  market: 'global' | 'hk' | 'us' | 'crypto';
  setMarket: (market: 'global' | 'hk' | 'us' | 'crypto') => void;
  visibleFactorIds: FactorId[]; // 根据market+level过滤
}
```

- React Context，提供当前市场+可见因子列表
- 切换市场→自动过滤因子(港股只看hk+global，美股只看us+global等)

**验收**: Context可消费 + 切换市场→因子列表更新

---

### 🦐 autoclaw(全栈) — 2项核心任务

#### 任务1: factor-i18n-map.ts升级
**文件**: `electron/engine/factors/factor-i18n-map.ts`

扩展FactorI18nEntry接口：
```typescript
export interface FactorI18nEntry {
  // ... 现有字段保持不变
  /** 因子等级 L1入门/L2进阶/L3专业 */
  level: FactorLevel;
  /** 一句话故事(人话+比喻) */
  story: string;
  /** 信号灯描述(如"IC>0.05=🟢强正向") */
  signalDesc: string;
}
```

- 现有42条entry补level(全部L1) + story + signalDesc
- 新增187条entry(先写中文版，其他7语言后续)

**验收**: 接口扩展0 TSC + 42现有entry补3字段 + 新增187条entry(中文)

#### 任务2: i18n批量生成脚本
**文件**: `scripts/generate-factor-i18n.ts`

```typescript
// 输入: factor-i18n-map.ts中的中文entry
// 输出: 8语言的i18n JSON文件
// 语言: zh-CN(源), zh-TW, en, ja, ko, fr, it, de
// 方式: 读取中文→调用翻译API/模板→输出JSON
```

**验收**: 脚本可运行 + 输出8个JSON文件 + 每个JSON含187因子×3字段

---

### 🦐 QClaw(设计) — 3项核心任务

#### 任务1: 三级分类UX规范文档
**文件**: `docs/design/factor-level-ux-spec.md`

内容:
- 颜色规范: 🟢#22C55E / 🟡#EAB308 / 🔴#EF4444 / ⚪#9CA3AF
- 图标规范: Level徽章大小(16px) + 信号灯大小(12px)
- 排版规范: 因子卡片布局(徽章位置/信号灯位置/故事文案位置)
- 切换交互: 无门槛，Tab式切换，非弹窗式

**验收**: 文档完整 + 颜色/图标/排版/交互4部分齐全

#### 任务2: 场景化因子包设计稿(8包)
**文件**: `docs/design/scenario-factor-packs.md`

8个场景包定义:
| # | 包名 | 目标市场 | 因子组合 | 权重 |
|---|------|----------|----------|------|
| 1 | 牛市进攻 | 全市场 | MOM_12M+GROWTH+ANALYST_REVISION+BUYBACK_YIELD | 40/30/20/10 |
| 2 | 熊市防御 | 全市场 | VOL_60D+QUAL+DIVIDEND_YIELD+BETA | 30/30/25/15 |
| 3 | 震荡轮动 | 全市场 | SECTOR_ROTATION+MEAN_REVERSION+RSI_14 | 35/35/30 |
| 4 | 加密趋势 | 加密 | MOM_12M+FUNDING_EXTREME+OI_QUADRANT+STABLECOIN_RATIO | 30/25/25/20 |
| 5 | 价值掘金 | 全市场 | EARNINGS_YIELD+BOOK_TO_PRICE+PIOTROSKI_F+FREE_CASHFLOW_YIELD | 30/25/25/20 |
| 6 | 成长猎手 | 全市场 | GROWTH+PEG_RATIO+SALES_TO_PRICE+ANALYST_REVISION | 35/25/25/15 |
| 7 | 港股窝轮 | 港股 | HK_CBBC_RATIO+HK_WARRANT_TURNOVER+HK_SHORT_SELL_RATIO+HK_IPO_PERFORMANCE | 30/25/25/20 |
| 8 | 美股财报 | 美股 | EARNINGS_SURPRISE+ANALYST_REVISION+INSIDER_BUYING+US_13F_FLOW | 30/25/25/20 |

**验收**: 8包定义完整 + 每包≥4因子 + 权重合计100%

#### 任务3: 信号灯颜色规范
**文件**: `docs/design/factor-signal-light-spec.md`

| 信号 | 颜色 | 含义 | IC范围 |
|------|------|------|--------|
| 🟢 强正向 | #22C55E | 因子信号强，建议使用 | IC>0.05 |
| 🟡 中性 | #EAB308 | 因子信号一般，谨慎使用 | 0.02<IC≤0.05 |
| 🔴 强负向 | #EF4444 | 因子信号反转，注意风险 | IC≤0.02 |
| ⚪ 数据不足 | #9CA3AF | 数据缺失，无法判断 | 数据覆盖<60% |

**验收**: 4色规范完整 + 含CSS变量名

---

### 🦐 youdao(测试) — 3项核心任务

#### 任务1: 因子测试模板
**文件**: `tests/factors/templates/`

```
templates/
  ratio-factor.test.ts       # 比率型测试模板
  ranking-factor.test.ts     # 排名型测试模板
  signal-factor.test.ts      # 信号型测试模板
```

每模板含:
- 正常值测试(典型市场数据)
- 边界值测试(0/负数/极大值)
- 空值测试(null/undefined/缺失字段)
- 极端场景测试(熔断/涨跌停/闪崩)
- 跨市场测试(港股/美股/加密数据格式差异)

**验收**: 3模板可运行 + 每模板≥5测试用例

#### 任务2: 因子i18n完整性测试
**文件**: `tests/factors/factor-i18n-completeness.test.ts`

检测: 8语言×(42+187)因子×(name+story+signalDesc) = 229×8×3 = 5,496项
- 缺译检测: 有中文但缺其他7语言
- 空值检测: 有key但值为空字符串
- 格式检测: story非空且>5字符

**验收**: 测试可运行 + 输出缺译报告

#### 任务3: 测试数据mock框架
**文件**: `tests/factors/mocks/`

```
mocks/
  hk-market-data.ts     # 港股mock: 恒指成分股+窝轮+牛熊证
  us-market-data.ts     # 美股mock: 标普500+期权+内部人
  crypto-market-data.ts # 加密mock: BTC/ETH+链上+合约
  index.ts              # 统一导出
```

**验收**: 3市场mock数据各1套 + TypeScript类型完整

---

### 🦐 Claw(PM) — 3项核心任务

#### 任务1: R184-R193完整方案文档 ✅ 已完成
**文件**: `factor-expansion-R184-R193-master-plan.md`

#### 任务2: chat-bridge广播R184任务 ✅ 已完成
**消息ID**: pm-r184-start-20260615T0754

#### 任务3: R184验收标准+Round计划(本文档) ✅ 正在完成

---

## 🎯 R184 验收标准

### 必须通过 (P0)

| # | 指标 | 标准 | 负责虾 |
|---|------|------|--------|
| V01 | TSC | `npx tsc --noEmit` 0 error | 全部 |
| V02 | factor-id-registry.ts | 187新ID注册 + FACTOR_LEVEL_MAP 231条 | JVS |
| V03 | 因子计算模板 | 4文件可编译 + 基类接口完整 | JVS |
| V04 | FactorLevelSelector | 三级切换渲染 + 无门槛 + i18n | ML |
| V05 | FactorCard升级 | level徽章+信号灯位可见 + 现有功能不受影响 | ML |
| V06 | FactorMarketContext | 市场切换→因子列表更新 | ML |
| V07 | factor-i18n-map.ts | 接口扩展 + 42现有补level/story/signalDesc | autoclaw |
| V08 | i18n批量脚本 | 脚本可运行 + 输出8语言JSON | autoclaw |
| V09 | UX规范文档 | 三级分类+场景包+信号灯3文档完整 | QClaw |
| V10 | 测试模板 | 3模板可运行 + 每模板≥5用例 | youdao |
| V11 | i18n完整性测试 | 测试可运行 + 输出缺译报告 | youdao |
| V12 | Mock数据框架 | 3市场mock + 类型完整 | youdao |

### 建议通过 (P1)

| # | 指标 | 标准 | 负责虾 |
|---|------|------|--------|
| V13 | 8场景包定义 | 每包≥4因子+权重100% | QClaw |
| V14 | 信号灯4色规范 | 含CSS变量名 | QClaw |
| V15 | 新增187条i18n中文entry | story+signalDesc字段有内容 | autoclaw |
| V16 | Build | `npm run build` 0 error | JVS |

### 验收流程

1. 各虾完成后→chat-bridge广播完成状态
2. PM检查: 逐项对照V01-V12
3. 5虾全部完成→PM发布R184验收报告
4. 验收通过→通知Owner启动R185

---

## ⚠️ 风险提示

| 风险 | 应对 |
|------|------|
| 187新ID一次性注册量大 | JVS可分批(🟢35+🟡62+🔴89) |
| i18n批量脚本翻译质量 | autoclaw先出中文+英文，其余6语言用模板 |
| FactorCard升级影响现有 | ML先写测试再升级，确保回归 |
| 场景包因子组合合理性 | QClaw参照6虾共识Top因子 |

---

> 📋 本Round计划待5虾确认认领后正式执行。
> 🦐 收到请回复确认！
