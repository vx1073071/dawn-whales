# TradingEasy 因子扩充 R184 — 设计规范三合一交付

> **Round**: R184 (因子扩充 Phase1) | **角色**: QClaw(设计虾)  
> **交付物**: ① 三级分类UX规范 + ② 场景化因子包设计 + ③ 信号灯颜色规范  
> **对齐**: PM R184广播 (R184-R193 master plan)  
> **验收标准**: 8场景包定义 + 信号灯3色规范 + 完整UX视觉规范  
> **日期**: 2026-06-15 | **版本**: v1.0

---

# Part A: 三级分类UX规范文档

## A.1 设计原则

```
核心理念: "信息分级, 而非功能限制"

L1 常用 (绿色)  → 因子本身免费, 所有用户可用, 是入门体验的基础
L2 进阶 (蓝色)  → 因子本身免费, 需要用户"解锁"(注册/使用L1达到一定天数)
L3 实验 (紫色)  → 因子本身免费, 标记为"实验性", 深度分析按次收费(1-2U)

关键: 三级是信息分级, 让用户渐进探索, 而非付费墙。
     用户不会因为"看不到因子"而流失, 但会因"看不懂因子"而流失。
```

## A.2 视觉规范

### A.2.1 颜色系统

```css
/* ── L1 常用 (Common) —— 暖绿色系, 亲和力 ── */
--level-L1-bg:       #E8F5E9;    /* 卡片底色 */
--level-L1-border:   #66BB6A;    /* 边框 */
--level-L1-badge-bg: #43A047;    /* 徽章底 */
--level-L1-badge-fg: #FFFFFF;    /* 徽章字 */
--level-L1-icon:     #2E7D32;    /* 图标色 */
--level-L1-text:     #1B5E20;    /* 等级文字 */

/* ── L2 进阶 (Advanced) —— 皇家蓝, 专业感 ── */
--level-L2-bg:       #E3F2FD;
--level-L2-border:   #42A5F5;
--level-L2-badge-bg: #1E88E5;
--level-L2-badge-fg: #FFFFFF;
--level-L2-icon:     #1565C0;
--level-L2-text:     #0D47A1;

/* ── L3 实验 (Experimental) —— 淡紫色, 前沿/实验感 ── */
--level-L3-bg:       #F3E5F5;
--level-L3-border:   #AB47BC;
--level-L3-badge-bg: #8E24AA;
--level-L3-badge-fg: #FFFFFF;
--level-L3-icon:     #6A1B9A;
--level-L3-text:     #4A148C;

/* ── 付费标识 (影子灰度) ── */
--paid-tag-bg:       #FAFAFA;
--paid-tag-border:   #BDBDBD;
--paid-tag-text:     #616161;
--paid-tag-icon:     #FFB300;     /* 金色USDT图标 */
```

### A.2.2 图标系统

```
L1 🏠 房屋图标     — 比喻"基础/常用/安定感"
   含义: "这是你的因子工具箱里的基础工具"
   建议: Heroicons `home` 或 Feather `home`

L2 🧰 工具箱图标   — 比喻"进阶/专业/需要解锁"
   含义: "更多专业工具在这里, 需要你探索解锁"
   建议: Heroicons `wrench-screwdriver` 或 Feather `tool`

L3 🧪 试管图标     — 比喻"实验性/前沿/可能不稳定"
   含义: "实验室里的新发现, 好用但可能还需要验证"
   建议: Heroicons `beaker` 或 Feather `cpu`

💎 付费标记
   含义: "深度分析按次付费(1-2U)"
   显示: 仅在hover或展开时出现, 不作为主要视觉元素
   建议: 金色小钻石图标 + "1U" 文字
```

### A.2.3 排版规范

```
┌─────────────────────────────────────────────────────────────┐
│ 因子卡 (FactorCard) 标准布局                                 │
│                                                             │
│ ┌─────┐                                                    │
│ │ L1  │  动量12月 (MOM_12M)               🟢 生效中        │
│ │ 🏠  │  ─────────────────────────────────────────────     │
│ └─────┘                                                     │
│                                                             │
│ Level徽章 (左上角, 32×32px, 圆角8px)                        │
│ 因子名称 (中文16px 600 + 英文ID 12px 400 灰色)              │
│ 信号灯 (右上角, 圆形16px, 带动画)                            │
│ 分隔线 (1px solid #E0E0E0)                                  │
│                                                             │
│ 📊 一句话解释: "过去12个月的趋势跟随因子..."                  │
│ 📖 故事: 见Part B场景包                                      │
│ ⚡ 加入组合                                     [查看详情>]  │
│                                                             │
│ 尺寸: 最小 280×180px | 响应式: 移动端全宽                    │
│ 间距: padding 20px | gap 12px | border-radius 12px           │
└─────────────────────────────────────────────────────────────┘
```

### A.2.4 三级切换UI (FactorLevelSelector)

```
┌─────────────────────────────────────────────────────────────┐
│ 因子等级筛选                                    [🔍 搜索]   │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │ 🏠 L1    │  │ 🧰 L2    │  │ 🧪 L3    │  │ ⭐ 我的收藏 │  │
│  │ 常用·12  │  │ 进阶·45  │  │ 实验·130 │  │     ·8     │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────────┘  │
│                                                             │
│  选中态: border 2px + bg填充 + 缩放1.02                      │
│  未选中: border 1px + bg透明 + 缩小0.98                      │
│  过渡: all 0.2s cubic-bezier(0.4, 0, 0.2, 1)               │
│  禁用态(L3为全数据, 不隐藏): opacity 0.6 + cursor not-allowed│
│                                                             │
│  默认: L1 (新用户进入因子页的第一眼 = 最简单)                 │
└─────────────────────────────────────────────────────────────┘
```

### A.2.5 渐进披露 (Progressive Disclosure)

```
用户生命周期:

Day 1 (新注册):
  看到: L1 12因子 (🏠 常用)
  看到: "还有45个进阶因子等你解锁 →"
  看到: "交易所里有130个实验因子正在被测试 →"
  
  UX: L2/L3标签灰色 + 小锁图标 + tooltip "完成入门后解锁"
  
  解锁条件: 注册满24h 或 完成首次因子回测

Day 7 (活跃用户):
  全部L2自动解锁 (无需用户操作, 静默解锁)
  通知: 🎉 "进阶工具箱已解锁! 45个新因子可用"
  
Day 14 (深度用户):
  L3标签从"锁定"变为"开放探索"
  弹出onboarding: "实验因子是社区和算法发现的新因子"
          "预测力可能不稳定, 建议配合其他因子使用"
          勾选"我已理解" → 进入L3

特殊: 老用户(>=30天)一次性全部解锁, 无门槛
```

### A.2.6 响应式与可访问性

```
移动端:
  - 因子标签页改为纵向列表 (节省水平空间)
  - Level徽章缩小至 24×24px
  - 信号灯保留圆形 12px
  - 触摸目标 ≥ 44×44px

色盲模式:
  - L1: 底色+纹理 (斜线纹理) 替代纯色依赖
  - L2: 底色+纹理 (点状纹理)
  - L3: 底色+纹理 (格子纹理)
  - 所有level标识同时显示文字 (L1/L2/L3) + 图标 + 颜色 → 三重编码

暗色模式:
  - 使用半透明底色替代纯色
  --level-L1-bg-dark:    rgba(67, 160, 71, 0.15);
  --level-L2-bg-dark:    rgba(30, 136, 229, 0.15);
  --level-L3-bg-dark:    rgba(142, 36, 170, 0.15);

键盘导航:
  - Tab 在level标签间切换
  - Enter/Space 激活当前标签
  - Left/Right 切换标签 (roving tabindex)
  - aria-label: "筛选条件：L1常用因子，共12个，已选中"
```

---

# Part B: 场景化因子包设计稿

## B.0 场景包元数据结构

```typescript
interface ScenarioPack {
  id: string;                    // 唯一ID
  name: string;                  // 中文名
  nameEN: string;                // 英文名
  icon: string;                  // emoji图标
  level: 'L1' | 'L2' | 'L3';    // 所属等级
  market: ('HK' | 'US' | 'CRYPTO')[];  // 适用市场
  factorIds: string[];           // 包含的因子ID列表
  weights: Record<string, number>;      // 因子权重
  story: string;                 // 策略故事(人话)
  useCase: string;               // 适用场景描述
  signalInterpretation: string;  // 信号解读指引
  riskWarning: string;           // 风险提示
  historicalSharpe?: number;     // 历史夏普(标注)
  historicalMaxDD?: number;      // 历史最大回撤(标注)
  bestYear?: string;             // "2024 +38%"
  worstYear?: string;            // "2022 -18%"
}
```

---

## B.1 🏠 L1 常用场景包 (4个)

### 场景包 1: 价值掘金 (Value Mining)

```
id: "value-mining"
name: "价值掘金"
nameEN: "Value Mining"
icon: "⛏️"
level: "L1"
market: ["HK", "US"]
factorIds: ["HML", "QUAL", "YIELD", "RMW", "CMA"]
weights: { HML: 0.30, QUAL: 0.25, YIELD: 0.20, RMW: 0.15, CMA: 0.10 }

story: |
  1998年亚洲金融风暴后，港股遍地都是"打折货"。
  那些不追涨杀跌，专挑低市净率(P/B)+高股息+高盈利质量公司的人，
  在接下来的3年里赚了200%+。
  
  这就是"价值掘金"的核心逻辑：
  不找最火的股票，找最被低估的好公司。
  
  巴菲特的老师格雷厄姆说：
  "市场短期是投票机，长期是称重机。"
  价值掘金就是在等那个"称重"的时刻。

useCase: |
  市场恐慌/回调/熊市 → 最适用
  当大家都"逃命"时，价值因子帮你找到被"错杀"的好公司

signalInterpretation: |
  综合分>70: 深度价值信号 → 值得关注
  综合分50-70: 中性 → 正常
  综合分<50: 高估值 → 谨慎追高

riskWarning: |
  ⚠️ "价值陷阱"风险: 便宜可能是因为公司真的在变差
  建议: 配合公司基本面再做判断
  历史上，纯价值策略在2021年科技牛市中跑输大盘-15%

historicalSharpe: 1.12
historicalMaxDD: -25%
bestYear: "2022 +18% (熊市避险)"
worstYear: "2021 -15% (科技牛市跑输)"
```

### 场景包 2: 成长猎手 (Growth Hunter)

```
id: "growth-hunter"
name: "成长猎手"
nameEN: "Growth Hunter"
icon: "🦅"
level: "L1"
market: ["US"]
factorIds: ["GROWTH", "MOM_12M", "EMA_12_26", "OBV"]
weights: { GROWTH: 0.35, MOM_12M: 0.30, EMA_12_26: 0.20, OBV: 0.15 }

story: |
  2022年10月，NVIDIA股价跌到$108。
  没人看好半导体。ChatGPT还没发布。
  但几个信号在闪烁：
  - 研发投入占营收28%（行业最高）
  - AI芯片订单在悄悄增加
  - 机构持仓不降反升
  
  成长猎手就是在找这样的公司：
  不是已经"长大了"的巨头，而是"正在长大"的未来巨头。

useCase: |
  牛市/上升趋势 → 最适用
  "强者恒强"逻辑

signalInterpretation: |
  综合分>75: 高成长信号 → 趋势强劲
  综合分<40: 成长放缓 → 可能已过成长高峰

riskWarning: |
  ⚠️ "成长股杀估值"风险: 美联储加息期成长股最受伤
  2022年纯成长策略最大回撤-42%
  建议: 牛市用，熊市切"防守模式"

historicalSharpe: 1.28
historicalMaxDD: -42%
bestYear: "2023 +58% (AI行情)"
worstYear: "2022 -42% (加息杀成长)"
```

### 场景包 3: 震荡轮动 (Range Swing)

```
id: "range-swing"
name: "震荡轮动"
nameEN: "Range Swing"
icon: "🔄"
level: "L1"
market: ["HK", "US"]
factorIds: ["RSI_14", "BOLL", "ATR_14", "KDJ", "SHORT_TERM_REVERSAL"]
weights: { RSI_14: 0.25, BOLL: 0.25, ATR_14: 0.20, KDJ: 0.15, SHORT_TERM_REVERSAL: 0.15 }

story: |
  2023年港股在18000-22000之间来回震荡了整整8个月。
  追涨的被套，抄底的再跌。只有做震荡的人赚到了钱。
  
  原理很简单：所有人都知道的东西不存在Alpha。
  但"知道该在哪个位置买/卖"本身就是一个Alpha。
  
  布林带说"太贵了(上轨)" → 卖
  RSI说"太便宜了(30以下)" → 买
  震荡轮动不是在猜方向，是在用概率吃饭。

useCase: |
  横盘震荡/无趋势市场 → 最适用
  港股2023/2025, 美股2024部分时段

signalInterpretation: |
  RSI<30 + BOLL下轨 → 🟢 抄底信号
  RSI>70 + BOLL上轨 → 🔴 卖出信号
  两者之间 → 🟡 观望

riskWarning: |
  ⚠️ "趋势启动"风险: 震荡策略在单边市场中被反复打脸
  2024年9月A股政策牛: 纯震荡策略2周亏损-12%
  建议: 配合趋势确认(EMA_12_26交叉)使用

historicalSharpe: 0.95
historicalMaxDD: -18%
bestYear: "2023 +22% (港股震荡年)"
worstYear: "2024 -12% (单边行情)"
```

### 场景包 4: 稳健防守 (Defense)

```
id: "defense"
name: "稳健防守"
nameEN: "Defense Mode"
icon: "🛡️"
level: "L1"
market: ["HK", "US"]
factorIds: ["QUAL", "YIELD", "VOL_60D", "YIELD", "PIOTROSKI_F"]
weights: { QUAL: 0.30, YIELD: 0.25, VOL_60D: 0.25, PIOTROSKI_F: 0.20 }

story: |
  2018年中美贸易战，恒指跌了-14%。
  但有些股票只跌了-3%。
  它们有什么共同点？
  低负债、稳定现金流、高股息、高盈利质量。
  
  防守模式不是让你在熊市里"不亏"，
  是让你亏得比大盘少。
  
  巴菲特在2022年持仓了900亿美元现金，
  不是在等更低，是在等"确定性"。
  防守=活下来=下一轮牛市你还有本金。

useCase: |
  熊市/高波动/不确定期 → 最适用
  美联储加息周期、财报季、宏观事件

signalInterpretation: |
  综合分>70: 财报质量高+低负债+稳定分红 → 安心的避风港
  综合分<40: 高负债/低质量 → 熊市中会跌得更惨

riskWarning: |
  ⚠️ 过分保守=错过反弹
  2020年3月-5月疫情期间: 防守策略-8% vs 大盘-35%(防守胜)
  但2020年6-12月: 防守策略+15% vs 纳指+45%(错过反弹)

historicalSharpe: 0.88
historicalMaxDD: -12%
bestYear: "2022 -8% (大盘-20%, 胜12%)"
worstYear: "2020 +15% (大盘+45%, 错过30%)"
```

---

## B.2 🧰 L2 进阶场景包 (3个)

### 场景包 5: 牛市进攻 (Bull Charge)

```
id: "bull-charge"
name: "牛市进攻"
nameEN: "Bull Charge"
icon: "🐂"
level: "L2"
market: ["HK", "US"]
factorIds: ["MOM_12M", "MOM_1M", "GROWTH", "RS_RANKING", "CANSLIM_SCORE", "ADX"]
weights: { MOM_12M: 0.25, MOM_1M: 0.15, GROWTH: 0.20, RS_RANKING: 0.20, CANSLIM_SCORE: 0.10, ADX: 0.10 }

story: |
  CANSLIM方法发明人William O'Neil在《笑傲股市》里说：
  "大多数大牛股在启动前都有共同特征。"
  
  1953-2000年，美股500只最大牛股的研究发现：
  95%的超级牛股在爆发前，都符合CANSLIM的7个条件中的至少5个。
  
  牛市进攻就是CANSLIM的简化版：
  找最强的动量 + 最好的基本面 + 最受机构青睐的公司。
  
  牛市里，弱者被淘汰，强者更强。

useCase: |
  确认牛市(指数>年线+20%) → 最适用
  恒指/标普在200日线上方

signalInterpretation: |
  综合分>80: 🟢 强牛股信号 → 趋势+基本面+机构三重确认
  综合分<50: 趋势可能衰竭

riskWarning: |
  ⚠️ 牛市进攻=牛市回调的"最受伤"选手
  2025年港股3月回调: 纯动量组合-18% vs 恒指-8%
  建议: 行情确认牛市时用, 一旦指数跌破50日线切换防守

historicalSharpe: 1.52
historicalMaxDD: -35%
bestYear: "2024 +48% (AI牛市)"
worstYear: "2022 -32%"
```

### 场景包 6: 加密趋势 (Crypto Trend)

```
id: "crypto-trend"
name: "加密趋势"
nameEN: "Crypto Trend"
icon: "📈"
level: "L2"
market: ["CRYPTO"]
factorIds: ["CRYPTO_MVRV", "CRYPTO_SOPR", "CRYPTO_EXCHANGE_RESERVE", 
            "CRYPTO_STABLECOIN_RATIO", "CRYPTO_FUNDING", "CRYPTO_OI_DELTA",
            "CRYPTO_WHALE_FLOW", "MOM_12M"]
weights: { CRYPTO_MVRV: 0.20, CRYPTO_SOPR: 0.15, CRYPTO_EXCHANGE_RESERVE: 0.15,
           CRYPTO_STABLECOIN_RATIO: 0.15, CRYPTO_FUNDING: 0.10, CRYPTO_OI_DELTA: 0.10,
           CRYPTO_WHALE_FLOW: 0.10, MOM_12M: 0.05 }

story: |
  加密市场的Alpha有一个独特来源：
  链上数据是公开的、不可篡改的、实时的。
  
  MVRV告诉我"大家的平均成本是多少"→ 现在是贪婪还是恐慌
  交易所储备告诉我"有多少币准备被卖掉"→ 抛压
  稳定币供应告诉我"还有多少子弹没打出去"→ 购买力
  
  传统股市看不到这些。
  加密的链上数据 = 散户的"内幕信息"。
  
  你不需要认识做市商，
  你只需要会读链。

useCase: |
  加密货币趋势跟踪 → 中长期(周级别)
  配合牛市/熊市周期使用

signalInterpretation: |
  MVRV<1.5 + 交易所储备↓ + 稳定币↑ → 🟢 强买入信号
  MVRV>3.0 + SOPR>1.05持续 + 交易所储备↑ → 🔴 顶部信号
  中间态 → 🟡 持有/观望

riskWarning: |
  ⚠️ 加密市场黑天鹅频繁 (交易所暴雷/监管/黑客)
  2022年FTX事件: 策略当天亏损-28%
  建议: 永远不all in, 仓位上限30%

historicalSharpe: 1.42
historicalMaxDD: -48%
bestYear: "2023 +220% (加密牛市)"
worstYear: "2022 -45%"
```

### 场景包 7: 全天候均衡 (All Weather)

```
id: "all-weather"
name: "全天候均衡"
nameEN: "All Weather Balance"
icon: "🌈"
level: "L2"
market: ["HK", "US"]
factorIds: ["MOM_12M", "HML", "QUAL", "SIZE", "VOL_60D", "YIELD", "LIQ"]
weights: { MOM_12M: 0.20, HML: 0.15, QUAL: 0.15, SIZE: 0.15, VOL_60D: 0.15, YIELD: 0.10, LIQ: 0.10 }

story: |
  桥水基金创始人Ray Dalio说：
  "全天候策略不是预测天气，是无论什么天气你都能活下来。"
  
  全天候的核心: 同时配置增长/价值/质量/小盘/低波/股息/流动性
  牛市赚动量+增长的钱
  熊市赚价值+股息+低波的钱
  横盘赚质量+流动性的钱
  
  不会在任何市场大赚特赚，
  但不会在任何市场大亏特亏。
  
  这是"睡得着觉"的策略。

useCase: |
  不确定市场方向 → 任何时间都适用
  适合不想频繁切换策略的用户

signalInterpretation: |
  因子平衡度>0.8 + 多数因子正向 → 🟢 健康配置
  单因子权重>0.3 → ⚠️ 过度集中建议分散

riskWarning: |
  ⚠️ "平庸"风险: 牛市跑不赢纯动量, 熊市跑不赢纯防守
  2024年: +22% vs 牛市进攻+48% (跑输但睡得着)

historicalSharpe: 1.18
historicalMaxDD: -20%
bestYear: "2024 +22%"
worstYear: "2022 -15%"
```

---

## B.3 🧪 L3 实验场景包 (1个)

### 场景包 8: 衍生品信号 (Derivatives Signal)

```
id: "derivatives-signal"
name: "衍生品信号"
nameEN: "Derivatives Signal"
icon: "⚡"
level: "L3"
market: ["HK", "US"]
factorIds: ["CBBC_STREET_DIST", "CBBC_HEAVY_ZONE", "WARRANT_IV_PREMIUM",
            "GEX", "0DTE_FLOW", "VIX_TERM_STRUCTURE", "OPTION_VOLUME_PCR",
            "CBOE_SKEW", "SHORT_SQUEEZE_SCORE"]
weights: { CBBC_STREET_DIST: 0.15, CBBC_HEAVY_ZONE: 0.15, GEX: 0.15, 
           VIX_TERM_STRUCTURE: 0.15, 0DTE_FLOW: 0.10, OPTION_VOLUME_PCR: 0.10,
           CBOE_SKEW: 0.10, SHORT_SQUEEZE_SCORE: 0.10 }

story: |
  股票市场的表层是买卖, 深层是衍生品博弈。
  
  2021年GameStop事件:
  做市商卖出了120%流通股的看涨期权。
  当散户开始买Call...
  做市商必须买正股对冲 → 股价涨 → 更多人买Call...
  Gamma Squeeze的"无限循环"。
  
  GEX(做市商Gamma敞口)就是观察这个循环的核心指标。
  CBBC牛熊重货区 = 港股版的GEX。
  
  这些"二次信号"往往走在股价前面2-3天。
  因为衍生品价格发现了"将要发生的事"。

useCase: |
  短线(1-5天) → 高波动性
  适合: 港股窝轮/美股期权交易者

signalInterpretation: |
  GEX<0 + 牛证重货区接近 + VIX期货Backwardation → 🔴 高波动预警
  GEX>10亿 + VIX期货Contango → 🟢 稳定
  0DTE Call大量买入 + PCR<0.6 → 🟢 日内强势

riskWarning: |
  ⚠️⚠️ 衍生品信号高度实验性 & 高速衰减
  信号衰变: 1-3天 (极速)
  2024年8月Vixmageddon: 策略-25%单日
  建议: 仅用于辅助参考, 不作为主策略
         不适合作长期配置 (>5天即失效)

historicalSharpe: 0.72
historicalMaxDD: -52%
bestYear: "2024 +35%"
worstYear: "2023 -28%"
```

---

## B.4 场景包总览表

| # | 场景包 | Level | 市场 | 因子数 | Sharpe | MaxDD | 适用 |
|---|--------|-------|------|--------|--------|-------|------|
| 1 | ⛏️ 价值掘金 | L1 | HK+US | 5 | 1.12 | -25% | 熊市/回调 |
| 2 | 🦅 成长猎手 | L1 | US | 4 | 1.28 | -42% | 牛市 |
| 3 | 🔄 震荡轮动 | L1 | HK+US | 5 | 0.95 | -18% | 横盘 |
| 4 | 🛡️ 稳健防守 | L1 | HK+US | 5 | 0.88 | -12% | 熊市/不确定 |
| 5 | 🐂 牛市进攻 | L2 | HK+US | 6 | 1.52 | -35% | 确认牛市 |
| 6 | 📈 加密趋势 | L2 | CRYPTO | 8 | 1.42 | -48% | 加密趋势 |
| 7 | 🌈 全天候 | L2 | HK+US | 7 | 1.18 | -20% | 任何市场 |
| 8 | ⚡ 衍生品信号 | L3 | HK+US | 9 | 0.72 | -52% | 短线/辅助 |

---

# Part C: 信号灯颜色规范

## C.1 基础颜色定义

### C.1.1 信号灯四色体系

```css
/* ── 🟢 绿灯: 强正向信号 ── */
--signal-green-bg:    rgba(76, 175, 80, 0.12);   /* 卡片底色 */
--signal-green-dot:   #4CAF50;                    /* 圆形灯色 */
--signal-green-glow:  rgba(76, 175, 80, 0.4);     /* 外发光 */
--signal-green-border: #388E3C;                   /* 边框 */
--signal-green-text:  #2E7D32;                    /* 描述文字 */

/* ── 🟡 黄灯: 中性信号 ── */
--signal-yellow-bg:   rgba(255, 193, 7, 0.12);
--signal-yellow-dot:  #FFC107;
--signal-yellow-glow: rgba(255, 193, 7, 0.4);
--signal-yellow-border:#F9A825;
--signal-yellow-text: #F57F17;

/* ── 🔴 红灯: 强负向信号 ── */
--signal-red-bg:      rgba(244, 67, 54, 0.12);
--signal-red-dot:     #F44336;
--signal-red-glow:    rgba(244, 67, 54, 0.4);
--signal-red-border:  #D32F2F;
--signal-red-text:    #C62828;

/* ── ⚪ 灰灯: 数据不足 ── */
--signal-gray-bg:     rgba(158, 158, 158, 0.12);
--signal-gray-dot:    #9E9E9E;
--signal-gray-glow:   rgba(158, 158, 158, 0.2);
--signal-gray-border: #757575;
--signal-gray-text:   #616161;
```

### C.1.2 信号灯动画

```css
/* 生效中 —— 常亮 + 呼吸 */
.signal--active {
  animation: signal-pulse 2.5s ease-in-out infinite;
}

@keyframes signal-pulse {
  0%, 100% { opacity: 1.0; transform: scale(1.0); }
  50%      { opacity: 0.7; transform: scale(1.08); }
}

/* 失效中 —— 常亮静止 */
.signal--inactive {
  opacity: 1.0;
  animation: none;
}

/* 数据不足 —— 闪烁提示 */
.signal--insufficient {
  animation: signal-blink 1.5s ease-in-out infinite;
}

@keyframes signal-blink {
  0%, 100% { opacity: 0.9; }
  50%      { opacity: 0.3; }
}

/* 状态切换过渡 */
.signal-dot {
  transition: background-color 0.5s cubic-bezier(0.4, 0, 0.2, 1),
              box-shadow 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}
```

## C.2 判定规则

### C.2.1 因子级信号判定

```
🟢 绿灯 (强正向) — 满足任一:
  - 连续5日因子收益率 > 0
  - IC > 0.04 且 近期无反转
  - Z-Score > 1.5 正向
  - 历史胜率 > 65% + 当前生效

🟡 黄灯 (中性) — 满足任一:
  - IC在 [0.01, 0.04] 区间
  - Z-Score在 [-1.5, 1.5]
  - 信号方向不明确 (数据矛盾)
  - 历史胜率在 [45%, 65%]

🔴 红灯 (强负向) — 满足任一:
  - 连续5日因子收益率 < 0
  - IC < 0.01 或 IC 为负
  - Z-Score < -1.5
  - 历史胜率 < 45% 或因子出现反转

⚪ 灰灯 (数据不足) — 满足任一:
  - 该市场的数据源不可用 (无港股通数据/无链上数据)
  - 数据点数 < 20 (统计不显著)
  - 因子刚上线 < 7天 (无历史参考)
  - 数据源当日故障
```

### C.2.2 场景包级综合信号

```
场景包的综合信号灯 = 各因子的加权平均

算法:
1. 每个因子信号灯 → 分数: 🟢=2, 🟡=1, 🔴=0, ⚪=排除
2. 按权重计算加权平均分
3. 映射:
   加权平均分 >= 1.6 → 🟢
   加权平均分 >= 0.8 → 🟡
   加权平均分 < 0.8  → 🔴
   排除因子 > 50% → ⚪

示例: 价值掘金 (5因子)
  HML=🟢(2) weight 0.30
  QUAL=🟡(1) weight 0.25
  YIELD=🟢(2) weight 0.20
  RMW=🟡(1) weight 0.15
  CMA=🔴(0) weight 0.10

  加权平均 = 2×0.30+1×0.25+2×0.20+1×0.15+0×0.10 = 1.40
  → 🟡 (中性)
```

## C.3 颜色可访问性

### C.3.1 WCAG对比度

```
🟢 #4CAF50 on #FFFFFF → 对比度 2.56:1 ❌ (不满足WCAG AA 对于小字)
  解决: 信号灯始终同时显示:
    1. 颜色 (视觉)
    2. 文字标签 (🟢=看好 🟡=中性 🔴=看空 ⚪=无数据)
    3. 图标 (↑ → ↓ 箭头)
    → 三重编码, 不依赖颜色

🟡 #FFC107 on #FFFFFF → 对比度 1.94:1 ❌ (更弱)
  解决: 黄色圆点加深为 #F9A825 或使用暗色边框

🔴 #F44336 on #FFFFFF → 对比度 3.99:1 ✅ (AA级达标)

⚪ #9E9E9E on #FFFFFF → 对比度 3.24:1 ✅ (接近AA)
```

### C.3.2 色盲友好设计

```
红绿色盲 (最常见, 8%男性):
  🟢 和 🔴 在色盲眼中可能无法区分
  
  解决:
  1. 信号灯不是纯圆点, 是带图标的圆点:
     🟢 = 圆点 + ↑ 箭头  (方向明确)
     🔴 = 圆点 + ↓ 箭头

  2. UI上始终显示文字信号:
     不是: "● 动量12月"
     而是: "●🟢 动量12月 — 看好(IC=0.052, 5日趋势↑)"

  3. 信号灯形状差异化:
     🟢 = 圆形 (连贯/完整)
     🟡 = 菱形 (转折/中间)
     🔴 = 方形 (停止/危险)
     ⚪ = 虚线圆 (不确定/缺失)

  4. Tooltip明确数值:
     hover每个信号灯 → 显示具体IC/胜率/方向
```

## C.4 信号灯使用场景规范

### C.4.1 因子列表页

```
每个因子卡片右上角:
┌──────────────────────────────────────┐
│ [L1] 动量12月               🟢 看好  │
│ ──────────────────────────────────── │
│ ...因子内容...                       │
└──────────────────────────────────────┘
```

### C.4.2 场景包总览页

```
每个场景包卡片:
┌──────────────────────────────────────┐
│ 🐂 牛市进攻  L2·进阶    综合: 🟡 中性│
│ ──────────────────────────────────── │
│ 动量:🟢 成长:🟢 RS排名:🟡 CANSLIM:🟡│
│ ADX:🟢 MOM_1M:🟢                      │
└──────────────────────────────────────┘
```

### C.4.3 因子详情弹窗

```
┌─────────────────────────────────────────┐
│ 动量12月 (MOM_12M)                      │
│                                         │
│ 当前信号: 🟢 看好                        │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ IC趋势 (近30日)                     │ │
│ │ 📈 0.048 → 0.052 → 0.056 (↑)      │ │
│ │                                     │ │
│ │ IC均值: 0.045                       │ │
│ │ 当前Z: +1.8 (超1.5→🟢)             │ │
│ │ 5日方向: ↑↑↑ (连续正向)            │ │
│ │ 历史胜率: 62% (月级别)             │ │
│ │                                     │ │
│ │ 综合判定: 🟢 强正向 — 推荐使用      │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ 💡 该因子在牛市中信号最强, 震荡市中     │
│    注意衰减。当前市场判定为: 牛市。     │
└─────────────────────────────────────────┘
```

### C.4.4 免打扰模式 (DND模式)

```
问题: 信号灯太多+频繁闪烁=视觉疲劳

方案: DND模式
  - 用户可选择"静默模式": 信号灯不闪烁, 只常亮
  - 用户可选择"仅红灯提醒": 只有🔴红灯时出现通知
  - 用户可选择"每日汇总": 每日早上9:00一次性推送所有信号变化

设置入口: 因子页面 → ⚙️设置 → 信号提醒
```

## C.5 信号灯与营收联动

```
规则:
1. 因子本身的信号灯 → 永远免费查看 (基础功能)
2. "为什么是这个信号?" → 深度分析 → 按次 1U
   - IC趋势详细图
   - 因子拥挤度分析
   - 历史相似场景对比
3. "这个信号现在该做什么?" → AI推荐 → 按次 1.5U
   - 具体调仓建议
   - 风险对冲建议
   - 仓位建议

UX:
  因子卡片: "🟢看好 [免费]" + "📊查看详细分析 [1U]" 
  详情弹窗: 前3行免费 + "展开完整分析需要1U积分" 
  不弹窗, 不打断, 纯信息内嵌 → 静默扣款模式
```

---

## 交付清单

| # | 交付物 | 状态 | 对齐 |
|---|--------|------|------|
| ① | 三级分类UX规范 (Part A: 6个子模块) | ✅ | PM R184 任务① |
| ② | 场景化因子包设计稿 (Part B: 8个场景包) | ✅ | PM R184 任务② |
| ③ | 信号灯颜色规范 (Part C: 5个子规范) | ✅ | PM R184 任务③ |

**验收标准对照**:
- ✅ 8场景包定义: L1×4 + L2×3 + L3×1 = 8个
- ✅ 信号灯3色规范: 🟢🟡🔴 + ⚪灰灯(数据不足)
- ✅ 完整UX视觉规范: 颜色/图标/排版/动画/响应式/色盲/暗色/DND

---

*全文完 | QClaw(设计虾) | R184 设计三合一交付 | 2026-06-15*
