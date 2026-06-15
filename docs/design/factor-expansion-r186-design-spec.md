# TradingEasy R186 设计交付 — 因材施教推荐引擎 + 食材超市UX + 三语因子故事

> **Round**: R186 (集成+场景包落地) | **角色**: QClaw(设计虾)
> **交付物**: ① 因材施教推荐引擎 ② 食材超市+菜包模式UX ③ 35因子中英日三语故事
> **对齐**: PM R186广播 + R185已交付文案 | **日期**: 2026-06-15

---

# Part A: 因材施教推荐引擎设计

## A.1 设计哲学

```
问题: 187个因子，用户不知道从哪开始。
方案: 不问用户"你要什么因子"，问用户"你是谁"。
核心: 3个简单问题的答案 → 自动匹配场景包。
```

## A.2 用户画像 (3 Personas)

### Persona 1: 🌱 新手散户

| 属性 | 值 |
|------|-----|
| 特征 | 看新闻买股票、追涨杀跌、没有系统、亏了不知道为什么 |
| 需求 | "有人告诉我买什么"、一键操作、不要太多选择 |
| 认知 | K线认识但不理解MACD、不知道什么是PE、因子这词都没听过 |
| 资金 | 1万-50万 |
| 时间 | 每天看手机 <30分钟 |
| 风险承受 | 低-中 (亏10%就睡不着) |
| 引导策略 | **菜包模式：只给场景包，不给裸因子** |

**推荐场景包（按优先级）**:
1. 🛡️ 熊市防御 — 保本第一
2. 💼 美股财报季 — "业绩超预期就买"最简单
3. ⛏️ 价值掘金 — "便宜的好公司"
4. 🏦 港股解码 — 港股用户首选

**默认选择**: 🛡️熊市防御（最保守，亏最少）

### Persona 2: 🔧 进阶玩家

| 属性 | 值 |
|------|-----|
| 特征 | 会看K线、用RSI/MACD、有止损意识、偶尔赚钱但不太稳定 |
| 需求 | "我想理解为什么涨跌"、能调参数、看IC值 |
| 认知 | 懂PE/PB、会用基本技术指标、知道因子分析但不熟 |
| 资金 | 10万-200万 |
| 时间 | 每天看盘 1-2小时 |
| 风险承受 | 中 (能接受20%回撤) |
| 引导策略 | **半自助：默认推场景包，但可展开编辑** |

**推荐场景包（按优先级）**:
1. 🔄 震荡轮动 — 技术派最熟悉
2. 🐂 牛市进攻 — 趋势跟踪
3. 🦅 成长猎手 — 找爆发股
4. 📈 加密趋势 — 加密玩家

**默认选择**: 🔄震荡轮动（技术派直觉入口）

### Persona 3: 💎 专业/量化

| 属性 | 值 |
|------|-----|
| 特征 | 系统化交易、有模型、关注Sharpe/IC/MaxDD、自己写策略 |
| 需求 | "给我全部因子，我自己组合"、原始数据导出、API |
| 认知 | 懂Fama-French、因子回测、多因子模型、Barra风险 |
| 资金 | 50万-1000万+ |
| 时间 | 全天候 |
| 风险承受 | 高 (接受50%以上回撤但有对冲) |
| 引导策略 | **超市模式：直接进入因子库全视图** |

**推荐场景包（按优先级）**:
1. 全部8场景包展开，可选→编辑→保存为自定义
2. 🐂 牛市进攻 — 做多Alpha
3. ⛏️ 价值掘金 — 多空因子
4. 💼 美股财报季 — 事件驱动

**默认选择**: L1+L2全因子视图 + "创建自定义场景"

---

## A.3 推荐引擎算法

```typescript
interface PersonaEngine {
  // Step 1: 用户分类
  classify(answers: UserProfile): Persona;
  
  // Step 2: 场景包推荐
  recommend(persona: Persona): ScenarioRecommendation[];
  
  // Step 3: 个性化微调(基于用户行为)
  personalize(userId: string, baseRecs: ScenarioRecommendation[]): ScenarioRecommendation[];
}

interface UserProfile {
  experience: 'beginner' | 'intermediate' | 'professional';  // 多久了
  style: 'news' | 'technical' | 'fundamental' | 'value' | 'crypto';  // 怎么选
  market: 'HK' | 'US' | 'ALL' | 'CRYPTO';  // 玩哪个市场
  capital: number;  // 资金量(万)
  dailyTime: number;  // 每天看盘分钟
  lossTolerance: number;  // 能接受亏多少%
  goal: 'income' | 'growth' | 'preservation';  // 目标
}
```

### 推荐权重矩阵

| 场景包 | 🌱新手 | 🔧进阶 | 💎专业 | 原因 |
|--------|:------:|:------:|:------:|------|
| 🛡️熊市防御 | **1.0** | 0.5 | 0.3 | 新手保本最优先 |
| 🐂牛市进攻 | 0.4 | **0.9** | **1.0** | 进阶+专业追求Alpha |
| 🔄震荡轮动 | 0.3 | **1.0** | 0.5 | 技术派主场 |
| 📈加密趋势 | 0.1 | 0.7 | 0.8 | 加密认知门槛 |
| ⛏️价值掘金 | **0.7** | 0.6 | 0.7 | 新手也能理解"便宜" |
| 🦅成长猎手 | 0.5 | **0.8** | 0.6 | 进阶追爆发 |
| 🏦港股解码 | 0.6 | 0.7 | 0.5 | 港股用户强推 |
| 💼美股财报季 | **0.8** | 0.6 | **0.8** | 最简单+最学术 |

> 用户选了特定市场→该市场场景包权重×1.5

### 冷启动推荐流程

```
新用户 → 🚫 无历史行为
           ↓
   Onboarding 3步向导 (Step 1: 选风格)
           ↓
   根据风格首选项 → Persona分类
           ↓
   Persona × 权重矩阵 → Top 3 场景包排序
           ↓
   展示推荐结果 (Step 2)
           ↓
   用户选择/跳过 → 记录选择
           ↓
   后续: 根据使用行为微调推荐
```

### 行为反馈微调

| 用户行为 | 信号 | 权重调整 |
|----------|------|----------|
| 收藏场景包 | 强正向 | 该包权重+0.2 |
| 切换场景包 | 中正向 | 新包权重+0.1 |
| 在场景包中加入新因子 | 中正向 | 该因子所属类别+0.1 |
| 30天未使用因子 | 负向 | 已推荐包权重-0.1 |
| 导出因子数据 | 强正向 | 该场景包+0.3 (升级到进阶) |
| 调整因子权重 | 中正向 | 可能升级Persona |
| 搜索因子 | 弱正向 | 匹配到搜索方向 |

---

## A.4 推荐结果UI表现

### 新手上路（首次）

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│   🌱 欢迎来到 TradingEasy 因子世界！                   │
│                                                      │
│   根据你的习惯，你是 <新手散户>                        │
│                                                      │
│   ┌────────────────────────────────────┐            │
│   │ 我们帮你选了 3 个"菜包"，开袋即用：   │            │
│   └────────────────────────────────────┘            │
│                                                      │
│   🥇 强烈推荐                                       │
│   ┌──────────────────────────────────────┐          │
│   │ 🛡️ 熊市防御 — 保本不亏                 │          │
│   │ 为什么推荐你？                          │          │
│   │ "你说怕亏钱。这个包选的都是最抗跌的股票  │          │
│   │  高分红+低杠杆+低Beta，2022年跑赢大盘12%"│          │
│   │                              [一键启用→]│          │
│   └──────────────────────────────────────┘          │
│                                                      │
│   🥈 也很适合                                       │
│   ┌────────────────────────────┐                    │
│   │ 💼 美股财报季 [查看] [启用]  │                    │
│   └────────────────────────────┘                    │
│                                                      │
│   🥉 可以了解                                       │
│   ┌────────────────────────────┐                    │
│   │ ⛏️ 价值掘金 [查看] [启用]    │                    │
│   └────────────────────────────┘                    │
│                                                      │
│   [我不用菜包，自己去超市挑因子 →]                    │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 进阶玩家（返回）

```
┌──────────────────────────────────────────────────────┐
│   🔧 欢迎回来！                                      │
│                                                      │
│   你上次用了🔄震荡轮动，效果不错吗？                    │
│                                                      │
│   ┌────────────────────────────────────┐            │
│   │ 📊 基于你的使用习惯，本周推荐:       │            │
│   └────────────────────────────────────┘            │
│                                                      │
│   🥇 🦅 成长猎手 (新推荐 — 你还没试过)              │
│       "你跟了震荡策略2周了，试试爆发力更强的成长猎手"  │
│                                                      │
│   🥈 🔄 震荡轮动 (你上次选的)                        │
│       "上次用这个赚了3.2%，要不要继续？"               │
│                                                      │
│   🥉 🐂 牛市进攻 (本周最强)                          │
│       "本周市场资金流入+15%，牛市进攻信号更匹配"       │
│                                                      │
│   [查看我的收藏 →]  [去因子超市 →]                   │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

# Part B: 食材超市 + 菜包模式 UX 设计

## B.1 核心概念

```
┌─────────────────────────────────────────────────┐
│                                                 │
│   菜包🥟 = 一键解决方案                          │
│   超市🛒 = 自由选择原材料                         │
│                                                 │
│   新手：菜包 → 吃饱就好                          │
│   进阶：菜包 → 打开看看用了什么食材 → 微调       │
│   专业：超市 → 自己挑食材 → 自己组合 → 命名保存   │
│                                                 │
└─────────────────────────────────────────────────┘
```

## B.2 菜包模式 (Scenario Pack Mode)

### 2.1 菜包选择器 (全屏卡片网格)

```
┌──────────────────────────────────────────────────┐
│  🥟 菜包模式                    [🔍 说人话搜索...]  │
│  ──────────────────────────────────────────────── │
│                                                  │
│  ┌──────────────────┐ ┌──────────────────┐      │
│  │ 🐂 牛市进攻       │ │ 🛡️ 熊市防御       │      │
│  │ ────────────────  │ │ ────────────────  │      │
│  │ 7个因子 · 3分钟   │ │ 5个因子 · 2分钟   │      │
│  │ 🟢 适合当前市场    │ │ 🟢 推荐给你        │      │
│  │                   │ │                   │      │
│  │ ⚡动量+SECTOR+FUND│ │ 🛡️低Beta+高分红    │      │
│  │ 📊 Sharpe: 1.15   │ │ 📊 Sharpe: 0.82   │      │
│  │ ⚠️ MaxDD: -28%    │ │ ⚠️ MaxDD: -12%    │      │
│  │                   │ │                   │      │
│  │    [启用 ▸]       │ │    [启用 ▸]       │      │
│  └──────────────────┘ └──────────────────┘      │
│                                                  │
│  ... 其余6个包 ...                               │
│                                                  │
│  没找到想要的？ →  [🛒 去因子超市自己选]           │
│                                                  │
└──────────────────────────────────────────────────┘
```

### 2.2 菜包详情（"开袋"查看）

```
┌──────────────────────────────────────────────────────┐
│  ← 菜包大厅                🐂 牛市进攻                │
│                                                      │
│  ┌────────────────────────────────────┐              │
│  │ 📖 策略故事                         │              │
│  │ 牛市里，强者恒强...                   │              │
│  └────────────────────────────────────┘              │
│                                                      │
│  🛒 包含的因子 (7个)                                 │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐             │
│  │ MOM_12M │  │ GROWTH  │  │ SECTOR  │  ...        │
│  │ █████   │  │ ████    │  │ ████    │             │
│  │ 25%    │  │ 15%     │  │ 15%     │             │
│  └─────────┘  └─────────┘  └─────────┘             │
│                                                      │
│  ┌────────────────────────────────────┐              │
│  │ 📊 历史表现                                                       │
│  │ IC均值: +0.058 | IC_IR: 0.72 | Sharpe: 1.15                     │
│  │ MaxDD: -28% | Win Rate: 62% | 2023年: +48%                      │
│  └────────────────────────────────────┘              │
│                                                      │
│  ┌────────────────────────────────────┐              │
│  │ 📈 当前市场信号                     │              │
│  │ 🟢 大市值+基金流入 => 偏牛市        │              │
│  │ 综合信号: 🟢 强正向                  │              │
│  └────────────────────────────────────┘              │
│                                                      │
│  ┌────────────────────────────────────┐              │
│  │ ⚠️ 风险提示                         │              │
│  │ 牛市末期信号钝化，回调时最受伤        │              │
│  └────────────────────────────────────┘              │
│                                                      │
│  [🔧 自定义这个菜包]  [✅ 就用这个]  [🔖 收藏]        │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 2.3 菜包自定义（中级模式）

```
┌──────────────────────────────────────────────────────┐
│  ← 返回      🔧 自定义: 牛市进攻                       │
│                                                      │
│  🛒 调整因子:                                        │
│                                                      │
│  ┌───────┬──────┬─────┬─────┬──────┐                │
│  │ 因子  │ 权重 │ 信号 │ 作用 │ 操作  │                │
│  ├───────┼──────┼─────┼─────┼──────┤                │
│  │MOM_12M│ ━━━━ │ 🟢  │动量 │[+][-]│                │
│  │GROWTH │ ━━━━ │ 🟡  │成长 │[+][-]│                │
│  │SECTOR │ ━━━━ │ 🟢  │行业 │[+][-]│                │
│  │...    │      │     │     │      │                │
│  └───────┴──────┴─────┴─────┴──────┘                │
│                                                      │
│  [+ 添加更多因子从超市 →]                             │
│                                                      │
│  权重总计: 100% ✅ (自动归一化)                        │
│                                                      │
│  [💾 保存为我的菜包]  [🔄 恢复默认]                   │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## B.3 超市模式 (Factor Market Mode)

### 3.1 超市入口

```
从菜包大厅底部:
  "不用菜包？→ 🛒 去因子超市自己挑"
  
从主导航:
  [🥟菜包] [🛒超市] [📚我的]

专业用户默认进入超市模式
```

### 3.2 超市货架布局

```
┌──────────────────────────────────────────────────────┐
│  🛒 因子超市                                          │
│  ──────────────────────────────────────────────────── │
│  [🔍 说人话搜索: '便宜好公司' '超跌反弹' '大资金']      │
│  ──────────────────────────────────────────────────── │
│                                                      │
│  分类标签:                                            │
│  [🟢入门34] [🟡进阶64] [🔴专业89] [⭐收藏] [🆕新上架]  │
│                                                      │
│  ┌──────────────┐  ┌──────────────┐                 │
│  │ 📊 价值货架 (7)│  │ 🏢 质量货架 (8)│                 │
│  │              │  │              │                 │
│  │ 🛒 EARN_YIELD│  │ 🛒 ROA      │                 │
│  │ ████████  5选│  │ ██████████10选│                 │
│  │ 便宜程度      │  │ 资产效率      │                 │
│  │              │  │              │                 │
│  │ 🛒 BOOK_PRICE│  │ 🛒 GROSS_MGN│                 │
│  │ ██████    3选│  │ ██████████ 8选│                 │
│  │ 股价vs净产    │  │ 定价权        │                 │
│  │              │  │              │                 │
│  │ [展开货架→]  │  │ [展开货架→]  │                 │
│  └──────────────┘  └──────────────┘                 │
│                                                      │
│  ... 其余10个货架 (情绪/低波/事件/宏观/行业/期权...)    │
│                                                      │
│  ──────────────────────────────────────────────────── │
│  🛒 购物车: 0个因子 | [清空] [一键生成菜包→]          │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 3.3 货架展开（以价值货架为例）

```
┌──────────────────────────────────────────────────────┐
│  📊 价值货架 — 找"便宜的好公司"                         │
│                                                      │
│  ┌──────────────┬──────────────┬──────────────┐      │
│  │ EARNINGS_YIELD│ BOOK_TO_PRICE│ DIVIDEND_YIELD│     │
│  │ 🟢 入门       │ 🟢 入门       │ 🟢 入门       │      │
│  │              │              │              │      │
│  │ 当前信号:🟢强 │ 当前信号:🟡中 │ 当前信号:🟢强 │      │
│  │ 权重:25%     │ 权重:20%     │ 权重:20%     │      │
│  │              │              │              │      │
│  │ "超市买东西   │ "公司的硬资产 │ "母鸡下蛋     │      │
│  │  同样商品你愿 │  值多少钱。  │  每年分多少"  │      │
│  │  花多少钱"   │  残值>股价=买│              │      │
│  │              │              │              │      │
│  │ [📖详情][➕购物车] [📖详情][➕购物车] [📖详情][➕购物车]│
│  └──────────────┴──────────────┴──────────────┘      │
│                                                      │
│  ...更多价值因子...                                    │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 3.4 购物车 + 一键成菜

```
┌──────────────────────────────────────────────────────┐
│  🛒 我的购物车 (6个因子)                               │
│  ──────────────────────────────────────────────────── │
│  ✅ 回收站按钮清除                                    │
│                                                      │
│  ┌──────────┬──────────┬──────────┐                 │
│  │ EARN_YLD │ BOOK_PRC │ DIV_YLD  │                 │
│  │ 20%      │ 20%      │ 20%      │                 │
│  └──────────┴──────────┴──────────┘                 │
│  ┌──────────┬──────────┬──────────┐                 │
│  │ ROA      │ GROSS_MGN│ DEBT_EQ  │                 │
│  │ 15%      │ 15%      │ 10%      │                 │
│  └──────────┴──────────┴──────────┘                 │
│                                                      │
│  权重总计: 100% ✅ (自动归一化)                        │
│                                                      │
│  [🔧 调权重]  [🧹 清空购物车]                        │
│                                                      │
│  ┌────────────────────────────────────┐              │
│  │          [🍳 一键生成我的菜包 →]     │              │
│  └────────────────────────────────────┘              │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 3.5 说人话搜索（超市核心功能）

```
┌──────────────────────────────────────────────────────┐
│  🔍 "便宜好公司"                                     │
│  ──────────────────────────────────────────────────── │
│                                                      │
│  找到 5 个相关因子:                                    │
│                                                      │
│  🥇 EARNINGS_YIELD (盈利收益率) — 匹配"便宜"           │
│      🟢 入门 · 人人看得懂                              │
│      📊 当前信号: 🟢 强 (IC: +0.048)                  │
│      [➕ 加到购物车]                                   │
│                                                      │
│  🥈 BOOK_TO_PRICE (市净率倒数) — 匹配"便宜"            │
│      🟢 入门 · 价值投资者必看                           │
│      📊 当前信号: 🟡 中                               │
│      [➕ 加到购物车]                                   │
│                                                      │
│  🥉 FREE_CASH_FLOW_YIELD (自由现金流收益率) — 匹配"好公司"│
│      🟡 进阶 · "真金白银vs股价"                        │
│      📊 当前信号: 🟢 强                               │
│      [➕ 加到购物车]                                   │
│                                                      │
│  4. ROA (总资产收益率) — 匹配"好公司"                   │
│  5. GROSS_MARGIN (毛利率) — 匹配"好公司"               │
│                                                      │
│  [把这5个一键生成菜包 ←]                               │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 说人话搜索词→因子映射表

| 用户搜索 | 匹配因子 | 匹配逻辑 |
|----------|---------|----------|
| "便宜" | EARNINGS_YIELD, BOOK_TO_PRICE, DIVIDEND_YIELD, FREE_CASH_FLOW_YIELD | 估值类 |
| "好公司" | ROA, GROSS_MARGIN, ROIC, PIOTROSKI_F | 质量类 |
| "便宜好公司" | 上面全部 | 估值+质量 |
| "安全" / "不亏" | BETA, MAX_DRAWDOWN_1Y, DEBT_TO_EQUITY, DIVIDEND_YIELD | 防御类 |
| "涨得快" / "追涨" | MOM_12M, GROWTH, EARNINGS_SURPRISE, FUND_FLOW | 动量/成长 |
| "超跌" / "跌太多" | RSI_14, DISPOSITION_EFFECT, MAX_DRAWDOWN_1Y | 反转/超卖 |
| "大资金" / "主力" | FUND_FLOW, ETF_FLOW, INSIDER_BUYING, INST_RETAIL_RATIO | 资金流 |
| "分红" / "收息" | DIVIDEND_YIELD, DIVIDEND_CHANGE, DIVIDEND_ARISTOCRATS, HK_REIT_YIELD | 分红类 |
| "业绩" / "财报" | EARNINGS_SURPRISE, US_EARNINGS_CALENDAR, EARNINGS_REVISION | 财报 |
| "港股" | HK_AH_PREMIUM, SOUTHBOUND_FLOW, HSI_CONSTITUENT | 港股专属 |
| "比特币" / "加密" | CRYPTO_MVRV, CRYPTO_NVT, CRYPTO_S2F, CRYPTO_EXCHANGE_FLOW | 加密 |
| "期权" / "衍生品" | IV_RANK, IV_SKEW, OPTION_VOLUME_PCR, GAMMA_EXPOSURE | 期权 |
| "庄家" / "操纵" | INSIDER_BUYING, SHORT_INTEREST, DISPOSITION_EFFECT | 反操纵 |
| "巴菲特" | ROA, ROE_TREND, DIVIDEND_YIELD, EARNINGS_YIELD | 价值投资 |
| "能不能买" | 全因子一键诊断 → 1.5U/次 | 综合信号 |

---

## B.4 菜包vs超市：模式对比

| 维度 | 🥟 菜包模式 | 🛒 超市模式 |
|------|------------|------------|
| 目标用户 | 新手/散户 | 进阶/专业 |
| 操作复杂度 | 1步(选包→启用) | 3+N步(浏览→选因子→调权重→命名→保存) |
| 认知负担 | 零 | 中-高 |
| 可定制性 | 低(可自定义=进阶入口) | 高(随意组合) |
| 引导方式 | 推荐引擎 | 搜索+分类浏览 |
| 营收联动 | 菜包免费→深度分析付费 | 超市浏览免费→多因子回测1U/次 |
| 默认入口 | 新手 | 专业 |

### 模式切换

```
┌──────────────────────────────────────────┐
│ [🥟菜包] [🛒超市] [📚我的]    [🔍搜索]    │
└──────────────────────────────────────────┘

• 菜包模式: 展示8个场景包卡片网格
• 超市模式: 展示12个分类货架
• 我的: 已保存的自定义菜包 + 收藏因子
• 搜索: 全局搜索(跨菜包+超市)
```

---

# Part C: 35因子中英日三语故事文案

## C.1 通用🟢入门因子 (21个)

### A1 价值类 (3)

**1. EARNINGS_YIELD — 盈利收益率**
- 🇨🇳: 超市买东西，同样商品你愿花多少钱？盈利收益率=花1块钱能买到多少利润。1块买0.10元=真便宜，1块买0.02元=太贵。
- 🇺🇸: "At the supermarket, how much profit do you get for each dollar? 10 cents in profit per dollar = great deal. 2 cents = overpriced."
- 🇯🇵: スーパーで買い物をする時、1円でいくらの利益を買えるか？1円で0.10円の利益=本当にお得。1円で0.02円=高すぎ。

**2. BOOK_TO_PRICE — 市净率倒数**
- 🇨🇳: 一家公司卖掉桌子椅子电脑能拿回100亿，但股价只值50亿。残值比买价还高，买它怎么亏？
- 🇺🇸: "A company's desks, chairs, and computers are worth $10B, but its stock price is only $5B. You're buying below scrap value — how can you lose?"
- 🇯🇵: 会社の机や椅子、パソコンを全部売れば1000億円。でも株価は500億円。スクラップ価値より安い。どうやって損をする？

**3. DIVIDEND_YIELD — 股息率**
- 🇨🇳: 花100块买只母鸡，每年下4块钱的蛋=4%股息率。但小心母鸡突然不下蛋了。
- 🇺🇸: "You buy a hen for $100, it lays $4 worth of eggs every year = 4% yield. Just make sure the hen doesn't stop laying."
- 🇯🇵: 100円で買った鶏が毎年4円分の卵を産む=4%の配当利回り。でも鶏が突然卵を産まなくなったら要注意。

### A2 质量类 (3)

**4. ROA — 总资产收益率**
- 🇨🇳: 都是100万的店，张老板一年赚20万(ROA=20%)，李老板只赚5万(5%)。ROA帮你找出"张老板型"的公司。
- 🇺🇸: "Two stores worth $1M each — Mr. Zhang earns $200K/year (ROA=20%), Mr. Li earns $50K (5%). ROA finds the 'Zhang' companies."
- 🇯🇵: 同じ1000万円の店で、張さんは年200万円の利益(ROA=20%)、李さんは50万円(5%)。ROAは「張さんタイプ」の会社を見つけてくれる。

**5. GROSS_MARGIN — 毛利率**
- 🇨🇳: 一碗面卖50块，面粉肉菜成本10块=毛利率80%。隔壁开了10家面馆，你被迫降到25块=毛利率降到60%。毛利率下降=竞争来了=定价权流失。
- 🇺🇸: "A bowl of noodles sells for $50, ingredients cost $10 = 80% margin. When 10 new noodle shops open, you drop to $25 = margin drops to 60%. Falling margins = competition = losing pricing power."
- 🇯🇵: 一杯のラーメンが50ドル、材料費10ドル=粗利率80%。隣に10軒のラーメン屋ができたら25ドルに値下げ=粗利率60%に低下。粗利率の低下=競争激化=価格決定力を失っている。

**6. DEBT_TO_EQUITY — 负债权益比**
- 🇨🇳: 买房：首付200万借800万=负债权益比400%。房价跌20%你就被套。保守的公司即使行情不好也能扛过去。
- 🇺🇸: "Buying a house: $200K down, $800K borrowed = 400% debt. Prices drop 20% and you're underwater. Conservative companies survive downturns."
- 🇯🇵: 家を買う：頭金200万円、借入800万円=負債比率400%。価格が20%下がれば即アンダーウォーター。保守的な会社は不況でも生き残る。

### A3 低波/防御类 (2)

**7. BETA — 市场贝塔**
- 🇨🇳: 大海里，大盘是海浪。β=0.5=大轮船，浪来只晃晃。β=2.0=小舢板，浪来直接飞出去也可能翻。熊市里你坐大轮船还是小舢板？
- 🇺🇸: "In rough seas, the market is the waves. Beta 0.5 = a cruise ship, barely rocks. Beta 2.0 = a dinghy, flies up and could capsize. Which boat are you riding in a bear market?"
- 🇯🇵: 荒れた海で、マーケットは波。β=0.5=大型客船で少し揺れるだけ。β=2.0=小型ボートで吹き飛ばされるか転覆。弱気相場でどっちの船に乗る？

**8. MAX_DRAWDOWN_1Y — 1年最大回撤**
- 🇨🇳: 坐过山车最怕什么？不是终点多高，是中间掉下去多深。最大回撤告诉你：这趟过山车最陡的下坡有多长。能忍-30%就上，忍不了换-15%的。
- 🇺🇸: "On a roller coaster, you don't fear the peak — you fear the drop. Max Drawdown tells you: how steep is the worst plunge? Can stomach -30%? Go for it. Can't? Pick one with -15%."
- 🇯🇵: ジェットコースターで一番怖いのは頂上じゃなく、途中の落下の深さ。最大ドローダウンは「このコースターの最も急な落下はどれくらいか」を教えてくれる。-30%に耐えられるなら乗れ。無理なら-15%のを選べ。

### A4 情绪/资金流类 (4)

**9. KDJ — 随机指标**
- 🇨🇳: KDJ像心电图仪。太快(J>100)=心跳过速，可能要调整。太慢(J<0)=心跳太缓，可能反弹。心脏不能一直100跳，股票也不能永远涨不停。
- 🇺🇸: "KDJ is like a heart monitor. Too fast (J>100) = racing heartbeat, might need rest. Too slow (J<0) = too sluggish, might bounce. No heart beats at 100 forever — no stock rises forever either."
- 🇯🇵: KDJは心電図モニターのようなもの。速すぎ(J>100)=心拍数が高すぎ、調整が必要かも。遅すぎ(J<0)=脈が弱すぎ、反発するかも。心臓も株も永遠に上がり続けることはない。

**10. INSIDER_BUYING — 内部人增持**
- 🇨🇳: 小明开了火锅店，自己天天在店里吃=对食材有信心。自己从来不去=你觉得锅底用了什么？内部人增持=老板敢吃自己做的菜。
- 🇺🇸: "The owner eats at his own restaurant every day — he trusts his ingredients. If he never eats there, what's in the broth? Insider buying = the boss eats his own cooking."
- 🇯🇵: 社長が自分のレストランで毎日食べる=食材に自信がある。一度も食べない=スープに何が入ってる？インサイダー購入=社長が自分の料理を食べている証拠。

**11. FUND_FLOW — 资金流量**
- 🇨🇳: 演唱会，入场的人比出场多=情绪高涨。但提前排队的内行已经开始溜了...资金流告诉你人群往哪走，但你自己判断该不该跟。
- 🇺🇸: "At a concert, more people entering than leaving = hype is building. But the early fans are already slipping out... Fund flow shows where the crowd goes — you decide whether to follow."
- 🇯🇵: コンサート会場、入場者が退場者より多い=盛り上がっている。でも最初から並んでいた玄人がこっそり抜け出している...資金フローは群衆の行き先を示すが、ついていくかは自分で判断。

**12. ETF_FLOW — ETF资金净流入**
- 🇨🇳: 商场里每家店前排队的人数。科技店(XLK)前排长队，能源店(XLE)前没人。ETF资金流=哪家店最火。
- 🇺🇸: "Lines outside stores in a mall. Tech store (XLK) has a long line, energy store (XLE) is empty. ETF flow = which store is hot right now."
- 🇯🇵: ショッピングモールの各店舗の行列。テック店(XLK)は長蛇の列、エネルギー店(XLE)はガラガラ。ETFフロー=今どの店が一番人気か。

### A5 事件类 (2)

**13. EARNINGS_SURPRISE — 业绩超预期**
- 🇨🇳: 考试前大家猜小明80分，结果95分。惊喜！发现"哇小明深藏不露"。下个学期大家预期会提高。业绩超预期=市场的"意外惊喜"需要时间完全消化。
- 🇺🇸: "Everyone predicted Xiao Ming would score 80, he scored 95. Surprise! Next semester, expectations rise. Earnings surprise = the market's 'pleasant shock' that takes time to fully digest."
- 🇯🇵: 試験前、みんな小明は80点と予想。結果は95点。驚き！次の学期、みんなの期待は上がる。利益サプライズ=市場の「嬉しい驚き」は完全消化に時間がかかる。

**14. DIVIDEND_CHANGE — 股息变化**
- 🇨🇳: 合伙人今年分你的钱比去年多30%=生意做大且愿意分享。突然不分了=可能有麻烦或不想跟你玩了。股息变化=合伙人的"诚信信号"。
- 🇺🇸: "Your partner gives you 30% more this year = business is growing and he's willing to share. Suddenly cuts you off = trouble, or he doesn't want to play. Dividend change = the partner's 'integrity signal'."
- 🇯🇵: パートナーが今年、昨年より30%多く分配=ビジネス拡大、しかも共有意思あり。突然分配停止=トラブルか、もう一緒にやりたくない。配当変化=パートナーの「誠実さのシグナル」。

### A6 行业类 (1)

**15. SECTOR_STRENGTH — 行业强度**
- 🇨🇳: 运动会，不是选跑最快的人，是选最快队伍里的前几名。整个队伍在最后面，你跑第一也没用。行业强度=这个队伍在领先还是落后。
- 🇺🇸: "At a track meet, don't just pick the fastest runner — pick the leaders from the fastest team. Being first on the slowest team is meaningless. Sector strength = is your team in the lead or falling behind?"
- 🇯🇵: 運動会で、一番速い人を選ぶのではなく、一番速いチームの上位を選ぶ。チーム全体が最下位なら、個人が一位でも意味がない。セクター強度=あなたのチームはリードしているか、遅れているか。

### A7 期权类 (1)

**16. IV_RANK — 隐含波动率排名**
- 🇨🇳: 天气预报说"暴风雨概率80%"，保险就会变贵。IV_Rank告诉你：现在大家都在买"保险"吗？如果是，可能真的要有暴风雨了。
- 🇺🇸: "Weather forecast says '80% chance of storm' — insurance gets expensive. IV Rank shows: is everyone buying 'insurance' right now? If yes, a storm might really be coming."
- 🇯🇵: 天気予報が「暴風雨の確率80%」なら保険料が上がる。IVランクは「みんな今保険を買っているか」を示す。買っているなら、本当に暴風雨が来るかもしれない。

### A8 宏观类 (1)

**17. CURRENCY_EFFECT — 汇率影响**
- 🇨🇳: 你在香港做外贸，卖给美国赚美元。港元升值10%，你收的美元换成港元就少10%。汇率影响=你的公司赚的钱在换了"我们的钱"后还剩多少。
- 🇺🇸: "You're a HK exporter earning USD. HKD strengthens 10%, your USD revenue converts to 10% less HKD. Currency effect = how much of your company's earnings survive after exchanging to 'our money'."
- 🇯🇵: 香港の輸出業者でドルを稼いでいる。香港ドルが10%上昇すると、ドルの収入を香港ドルに換えたら10%減る。通貨効果=会社の利益が「私たちのお金」に換えた後にいくら残るか。

### A9 基本面深度 (2)

**18. FREE_CASH_FLOW_YIELD — 自由现金流收益率**
- 🇨🇳: 两人月薪都是2万。一个人扣完房贷车贷生活费剩5000(FCF高)，一个人扣完什么都没了(FCF为负)。你借钱给谁？FCF收益率="这个人每月还剩多少钱还你"。
- 🇺🇸: "Both earn $20K/month. One has $5K left after all bills (high FCF), the other has nothing (negative FCF). Who would you lend to? FCF yield = 'how much does this person have left to pay you back each month'."
- 🇯🇵: 二人とも月収2万ドル。一人はすべての支払い後5000ドル残る(FCF高)、もう一人はゼロ(FCFマイナス)。どちらにお金を貸す？FCF利回り=「この人は毎月いくら返済に回せるか」。

**19. EQUITY_MULTIPLIER — 权益乘数**
- 🇨🇳: 权益乘数=杠杆倍率。200万本金借800万买1000万房子=权益乘数5倍。房价涨10%本金赚50%。跌20%本金亏光。数字越大=成败倍率越大。
- 🇺🇸: "Equity multiplier = leverage ratio. $2M down, $8M borrowed = 5x multiplier. Prices +10% = you +50%. Prices -20% = you're wiped. Bigger number = bigger boom, bigger bust."
- 🇯🇵: 株式乗数=レバレッジ倍率。200万円の自己資金に800万円借入=5倍。価格+10%で元手+50%。-20%で元手消滅。数字が大きいほど、成功も失敗も倍増。

### A10 行为类 (2)

**20. DISPOSITION_EFFECT — 处置效应**
- 🇨🇳: 每个人都有一群"套牢的朋友"："再等等，它肯定涨回来！"处置效应衡量还有多少人在说这句话。当所有人都这么说时，底还没到——等大家割肉了底才来。
- 🇺🇸: "Everyone has 'bag-holder friends': 'Just wait, it'll bounce back!' Disposition effect measures how many are saying this. When everyone's saying it, the bottom isn't here yet — it comes after they capitulate."
- 🇯🇵: 誰にでも「含み損の友達」がいる：「待ってれば、きっと戻る！」ディスポジション効果はこれを言っている人が何人いるかを測る。みんながこう言っている時はまだ底ではない——損切りが終わった後に底が来る。

**21. ANCHORING — 锚定效应**
- 🇨🇳: 菜市场老板："今天白菜特价，原价10块现价5块！"你心想"便宜一半！"就买了。但隔壁一直卖3块。锚定效应=第一个价格成了你的"基准线"，哪怕它毫无道理。
- 🇺🇸: "Grocer: 'Cabbage on sale! Was $10, now $5!' You think 'half off!' and buy. But next stall always sells at $3. Anchoring = the first price becomes your reference point, even if it makes no sense."
- 🇯🇵: 八百屋：「白菜特売！元値10ドルが今5ドル！」あなたは「半額！」と思って買う。でも隣の店はずっと3ドル。アンカリング=最初に見た価格が「基準」になってしまう、たとえ根拠がなくても。

---

## C.2 港股🟢专属因子 (5个)

**22. HK_AH_PREMIUM — AH溢价**
- 🇨🇳: 中石油A股100块H股70块。同样的股票不同价。AH溢价=130=香港便宜30%。不是折扣，是同一商品两个商场不同价，选便宜的。
- 🇺🇸: "PetroChina: $100 on Shanghai, $70 in Hong Kong. Same stock, different price. AH premium = 130 = HK is 30% cheaper. Pick the cheaper store."
- 🇯🇵: ペトロチャイナが上海で100ドル、香港で70ドル。同じ株なのに価格が違う。AHプレミアム=130=香港が30%安い。安い方の店を選べ。

**23. AH_PREMIUM_CHANGE — AH溢价变化**
- 🇨🇳: 两个商场价差从30元缩小到15元=有人发现价差在搬货。溢价变化告诉你这笔"搬货"生意的进展速度。
- 🇺🇸: "Price gap narrows from $30 to $15 = someone noticed and is arbitraging. Premium change shows how fast this 'arbitrage trade' is progressing."
- 🇯🇵: 2つの店の価格差が30ドルから15ドルに縮小=誰かが気づいて裁定取引中。プレミアム変化はこの「裁定取引」の進行速度を示す。

**24. SOUTHBOUND_FLOW — 南向资金**
- 🇨🇳: 港股有两个水池：全球资金大池+内地资金小池。南向资金=小池往大池放水的速度。放得越快，大池水位越高。2025年净流入8000亿港元。
- 🇺🇸: "HK stocks have two pools: global capital (big) + mainland capital (small). Southbound flow = how fast the small pool fills the big one. Faster filling = higher water level. 2025: HK$800B net inflow."
- 🇯🇵: 香港株には2つのプールがある：グローバル資金(大)+本土資金(小)。サウスバウンドフロー=小プールが大プールに注ぐ速度。速いほど水位が上がる。2025年は8000億香港ドルの純流入。

**25. HSI_CONSTITUENT — 恒指成分股**
- 🇨🇳: 足球国家队vs省队。国家队自动获更多关注、赞助、出场。恒指成分=港股的"国家队"——进国家队才有最大曝光和资金。
- 🇺🇸: "National football team vs provincial. National team gets more attention, sponsors, playing time. HSI constituent = HK's 'national team' — maximum exposure and capital flow."
- 🇯🇵: サッカー代表vs県代表。代表は自動的により多くの注目、スポンサー、出場機会を得る。HSI構成銘柄=香港の「代表チーム」——最大の露出と資金流入。

**26. HK_REIT_YIELD — REIT分派率**
- 🇨🇳: 包租公买了栋商场1000万，每年收租分50万(5%)。比银行定存高多了，但商场生意不好时会降。
- 🇺🇸: "Landlord buys a mall for $10M, collects $500K rent/year (5%). Beats bank deposits easily — but drops when the mall struggles."
- 🇯🇵: 大家がショッピングモールを1000万ドルで購入、年間50万ドルの賃料収入(5%)。銀行預金よりずっといいが、モールの経営が悪化すると下がる。

---

## C.3 美股🟢专属因子 (5个)

**27. US_EARNINGS_CALENDAR — 财报日历**
- 🇨🇳: 每季度有场考试。考完出成绩。财报日历=考试时间表——告诉你这周哪些学生要公布成绩。成绩公布前还是后下注？
- 🇺🇸: "Every quarter there's an exam. Then report cards come out. Earnings calendar = exam schedule — tells you which students report this week. Bet before or after grades?"
- 🇯🇵: 四半期ごとに試験がある。その後成績表が出る。決算カレンダー=試験スケジュール——今週どの生徒が成績を発表するか。成績発表の前か後か、どちらに賭ける？

**28. US_SECTOR_ROTATION — 板块轮动**
- 🇨🇳: 体育赛场，教练轮换主力。科技(XLK)打累了，金融(XLF)接班。金融累了，能源(XLE)补位。板块轮动=球现在在哪个队员手里。
- 🇺🇸: "Coach rotates players on the field. Tech (XLK) tires, Financials (XLF) sub in. Energy (XLE) next. Sector rotation = whose hands is the ball in right now?"
- 🇯🇵: コーチが選手を交代させる。テック(XLK)が疲れたら金融(XLF)が交代。金融が疲れたらエネルギー(XLE)が補填。セクターローテーション=今ボールは誰の手にあるか。

**29. US_SMALL_CAP_MOMENTUM — 小盘动量**
- 🇨🇳: 大卡车(大盘)要加速需时间，摩托车(小盘)一踩油门飞出去。牛市里摩托车冲最快。熊市里翻车也最狠。
- 🇺🇸: "A big truck (large cap) needs time to speed up. A motorcycle (small cap) flies with one throttle twist. In a bull market, motorcycles win. In a bear, they crash hardest."
- 🇯🇵: 大型トラック(大型株)が加速するには時間がかかる。バイク(小型株)はアクセル一つで飛び出す。強気相場ではバイクが勝つ。弱気相場では最も激しくクラッシュする。

**30. US_DIVIDEND_ARISTOCRATS — 股息贵族**
- 🇨🇳: 连续25年每年生日送你礼物的朋友。这份友谊不靠运气靠真本事。股息贵族=穿越至少3次大熊市的"老朋友"公司。
- 🇺🇸: "A friend who's given you a birthday gift for 25 straight years. That's not luck — it's genuine capability. Dividend Aristocrats = 'old friend' companies that survived at least 3 bear markets."
- 🇯🇵: 25年連続で毎年誕生日にプレゼントをくれる友達。運ではなく本物の実力。配当貴族=少なくとも3回の弱気相場を生き抜いた「古い友達」のような企業。

**31. US_SP500_EQUAL_WEIGHT — 标普等权**
- 🇨🇳: 班级平均分。如果只有第一名100分其他人不及格，加权平均可以造假。等权=每人同权重——等权也高=全班都考得好，不是只有学霸撑场面。
- 🇺🇸: "Class average. If only #1 scores 100 and everyone fails, weighted average can be misleading. Equal weight = same weight for all — if it's high, the whole class is doing well, not just the top student."
- 🇯🇵: クラスの平均点。1位だけ100点で他は不合格なら、加重平均は誤魔化せる。均等加重=全員同じ重み——均等加重も高ければ、クラス全体が良い成績で、トップの生徒だけではない。

---

## C.4 加密🟢入门因子 (6个)

**32. CRYPTO_MVRV — MVRV比率**
- 🇨🇳: 比特币像小区，每个住户买入价记录在链上。现在房价(市值)300万，平均买入价(实现市值)100万=MVRV 3倍。历史经验：>3.7就该有人卖房跑路。
- 🇺🇸: "Bitcoin is like a neighborhood. Everyone's purchase price is on-chain. Current market value $3M, average cost $1M = MVRV 3x. History says: above 3.7, someone should sell and run."
- 🇯🇵: ビットコインは住宅地のようなもの。全員の購入価格がチェーン上にある。現在の時価総額300万ドル、平均購入価格100万ドル=MVRV 3倍。歴史的に3.7を超えると誰かが売って逃げるべき。

**33. CRYPTO_NVT — 网络价值/交易量**
- 🇨🇳: 城市总房价1000亿，但全年交易额只10亿=NVT 100倍。人太少撑不起房价。NVT告诉你：这网络真的有人在用还是大家都在囤。
- 🇺🇸: "City property worth $100B, annual transaction volume only $1B = NVT 100x. Too few people to support prices. NVT tells you: is this network actually used, or is everyone just hoarding?"
- 🇯🇵: 都市の不動産総額1000億ドルなのに年間取引額が10億ドルだけ=NVT 100倍。人が少なすぎて価格を支えられない。NVTは「このネットワークは本当に使われているのか、みんなただ保有しているだけか」を示す。

**34. CRYPTO_S2F — 存量/流量**
- 🇨🇳: 全世界黄金19万吨，年新挖3000吨=S2F 62倍。要把全地球黄金收走，需62年重新挖。比特币减半后S2F≈120倍，比黄金更稀缺。
- 🇺🇸: "Global gold: 190K tonnes, 3K mined yearly = S2F 62x. It'd take 62 years to re-mine all gold. After halving, Bitcoin S2F ≈ 120x — scarcer than gold."
- 🇯🇵: 世界の金は19万トン、年間採掘量3000トン=S2F 62倍。全ての金を採掘し直すには62年かかる。半減期後、ビットコインのS2F≈120倍——金よりも希少。

**35. CRYPTO_EXCHANGE_FLOW — 交易所净流入**
- 🇨🇳: 仓库→货架=准备卖。货架→仓库=囤货等涨价。交易所是货架。货架上货突然少了但买的人没少=要涨价。
- 🇺🇸: "Warehouse → shelf = ready to sell. Shelf → warehouse = hoarding for price increase. Exchanges are the shelf. If shelf stock drops but buyers stay = prices going up."
- 🇯🇵: 倉庫→棚=売る準備。棚→倉庫=値上がり待ちで買いだめ。取引所は棚。棚の商品が突然減ったのに買い手は変わらない=価格上昇。

**36. CRYPTO_ACTIVE_ADDRESSES — 活跃地址数**
- 🇨🇳: 商场每天10万人进出=生意兴隆。2000人=要倒闭。活跃地址数=区块链商场每天的客流量。流量升=更值钱。
- 🇺🇸: "Mall: 100K daily visitors = thriving. 2,000 = dying. Active addresses = blockchain mall's daily foot traffic. Rising traffic = rising value."
- 🇯🇵: モールの1日の来客数10万人=繁盛。2000人=倒産寸前。アクティブアドレス=ブロックチェーンモールの1日の客足。増えれば価値も上がる。

**37. CRYPTO_HASH_RATE — 算力**
- 🇨🇳: 金矿里有更多挖掘机=矿主看好金价愿意花电费。算力=比特币的"挖掘机"总马力。马力越大=越多矿工相信挖出币值钱。
- 🇺🇸: "More mining machines in the gold mine = miners are bullish on gold prices. Hash rate = bitcoin's total 'mining horsepower'. More power = more miners believe their coins are valuable."
- 🇯🇵: 金鉱にもっと多くの採掘機=鉱山主は金価格に強気で電気代を払う。ハッシュレート=ビットコインの「採掘馬力」合計。馬力が大きいほど、より多くのマイナーが採掘したコインに価値があると信じている。

---

## C.5 跨市场🟢因子 (3个)

**38. XM_MKTCAP_EXPOSURE — 市值因子暴露**
- 🇨🇳: 雨天大家都躲大商场(大盘)，晴天逛路边摊(小盘)。市值暴露告诉你：今天天气如何？
- 🇺🇸: "Rainy day = everyone hides in big malls (large caps). Sunny day = everyone browses street stalls (small caps). Market cap exposure = what's the weather today?"
- 🇯🇵: 雨の日はみんな大きなショッピングモール(大型株)に避難。晴れの日は露店(小型株)をぶらつく。時価総額エクスポージャー=今日の天気は？

**39. XM_LIQUIDITY — 跨市场流动性**
- 🇨🇳: 高速公路vs小巷。开大卡车宁绕远走高速(流动性好)也不走直线小巷(流动性差)。掉头太难。流动性=路够不够宽，让你随时进出。
- 🇺🇸: "Highway vs alley. A big truck would rather take the longer highway (good liquidity) than the direct alley (bad liquidity). Can't U-turn in an alley. Liquidity = is the road wide enough to enter/exit anytime?"
- 🇯🇵: 高速道路vs路地。大型トラックは遠回りでも高速道路(流動性良好)を選び、近道の路地(流動性不良)は避ける。路地ではUターンできない。流動性=いつでも出入りできるだけ道が広いか。

**40. XM_DIVIDEND_ARAMA — 跨国股息比较**
- 🇨🇳: 全球包租公比价：港股REITs 5%，美股REITs 4%，日本J-REIT 4%，新加坡REITs 5.5%。跨国股息比较=包租公的全球比价表。
- 🇺🇸: "Global landlord comparison: HK REITs 5%, US REITs 4%, Japan J-REIT 4%, Singapore REITs 5.5%. Cross-border dividend = the global landlord's price comparison chart."
- 🇯🇵: 世界の大家比較：香港REIT 5%、米国REIT 4%、日本J-REIT 4%、シンガポールREIT 5.5%。国境を越えた配当比較=世界の大家の価格比較表。

---

## 交付清单

| # | 交付物 | 状态 | 对齐 |
|---|--------|:--:|------|
| ① | 因材施教推荐引擎设计 | ✅ | PM R186 任务① |
| ② | 食材超市+菜包模式UX | ✅ | PM R186 任务② |
| ③ | 35因子中英日三语故事 | ✅ | PM R186 任务③ |

**验收对照**:
- ✅ 推荐逻辑清晰: 3 Personas × 权重矩阵 × 行为反馈
- ✅ 文案自然: 40因子 × 3语言(中/英/日) = 120条完整故事+比喻
- ✅ UX规范完整: 超市货架+菜包选择器+购物车+说人话搜索+模式切换

---

*QClaw(设计虾) | R186 三项交付 | 2026-06-15*
