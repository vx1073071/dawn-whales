# P0-02 模板人话化文案审校标准

> **审校人**: Claw(PM) | **日期**: 2026-06-16 | **版本**: v1.0
> **关联**: R244 P0-02 — 模板人话化文案审校

---

## 📊 现状分析

### 数据源
- **模板注册表**: `electron/engine/analysis/strategy-templates.ts`
- **总模板数**: 22 (6大类)
- **分类**: trend(4) / mean_reversion(4) / momentum(4) / value(3) / multi_factor(3) / options(4)

### 当前问题

| 问题 | 严重程度 | 详情 |
|------|---------|------|
| oneLiner全英文 | 🔴 致命 | 22个模板的oneLiner全是英文技术描述，中文用户完全看不懂 |
| nameCn用i18n key | 🟡 重要 | 部分nameCn用了`i18n.t('strategyTemplates.k1')`格式，依赖翻译文件 |
| 无场景化命名 | 🟡 重要 | "MACD Dual Moving Average"不能告诉用户"这适合追涨还是抄底" |
| 缺少中文一句话 | 🔴 致命 | 没有任何模板有中文≤15字一句话介绍 |

---

## ✅ 审校标准 (QClaw 文案必须满足)

### oneLinerCn (≤15字一句话介绍, 主语"我/你")

| 级别 | 标准 | 示例 |
|------|------|------|
| 🟢 优秀 | 说清策略核心逻辑+适用场景, 主语"你" | "你跟着趋势走，涨了才买" |
| 🟡 合格 | 说清逻辑但偏技术 | "MACD金叉趋势策略" |
| 🔴 不合格 | 纯英文名/看不懂 | "MACD Dual Moving Average" |

### 建议中文一句话 (PM审校草稿)

| # | ID | nameEn | 当前oneLiner | 建议oneLinerCn |
|---|-----|--------|-------------|----------------|
| 1 | macd-dual-ma | MACD Dual MA | Classic MACD crossover... | 你跟着MACD金叉买，死叉卖 |
| 2 | n-breakout | N-Period Breakout | N-period high breakout... | 你等突破最高价再追进去 |
| 3 | ema-trend-atr | EMA Trend+ATR | EMA-trend aligned entries... | 你顺着均线方向买，用波动率控制仓位 |
| 4 | turtle | Turtle System | Classic Turtle system... | 你学海龟，突破20日高点才买 |
| 5 | bollinger-reversion | Bollinger Reversion | Fade extremes... | 你在布林带下轨捡便宜，涨回中间卖出 |
| 6 | rsi-reversal | RSI Reversal | Classic RSI reversal... | 你在超卖区买入，超买区卖出 |
| 7 | kdj-swing | KDJ Swing | KDJ oversold golden cross... | 你等KDJ金叉确认反弹再买 |
| 8 | cci-divergence | CCI Divergence | CCI divergence signals... | 你看CCI底背离抄底，顶背离逃顶 |
| 9 | momentum-rotation | Momentum Rotation | Absolute+relative momentum... | 你买最近涨最多的板块，轮着换 |
| 10 | rsi-momentum | RSI Momentum | RSI>60 momentum surge... | 你追已经很强还在加速的股票 |
| 11 | vwap-breakout | VWAP Breakout | VWAP-anchored breakouts... | 你跟着机构价格线突破买入 |
| 12 | sector-momentum | Sector Momentum | Top-3 sector rotation... | 你买最强的3个板块龙头 |
| 13 | deep-value | Deep Value | Deep value screener on P/E+P/B... | 你捡又便宜又盈利的好公司 |
| 14 | dividend-growth | Dividend Growth | Dividend growth with payout... | 你买年年多分红的公司收息 |
| 15 | net-net | Net-Net Value | Classic net-net working capital... | 你买比现金还便宜的公司 |
| 16 | balanced-multi | Balanced Multi-Factor | Balanced multi-factor scoring... | 你六个维度打分选股，不偏科 |
| 17 | regime-rotation | Regime Rotation | Regime-aware rotation... | 你根据市场状态在价值和动量之间切换 |
| 18 | buffett-quality | Buffett Quality | Buffett-style quality... | 你学巴菲特买高质量复利公司 |
| 19 | covered-call | Covered Call | Sell OTM calls... | 你手里有股票就卖个看涨期权赚外快 |
| 20 | iron-condor | Iron Condor | High-probability range... | 你赌股价在区间内不动，两边收钱 |
| 21 | put-spread | Put Spread | Sell put spreads... | 你在支撑位卖看跌期权收保费 |
| 22 | earnings-straddle | Earnings Straddle | Pre-earnings long straddle... | 你赌财报后大涨或大跌，方向不重要 |

---

## 📏 分类场景化命名规则

R244 QClaw 还有 P1-20 任务：把6大分类改为场景化命名

| 当前分类 | 当前名 | 建议场景名 | 场景描述 |
|---------|--------|-----------|---------|
| trend | 趋势 | 追涨型 | 涨了才买，顺势而为 |
| mean_reversion | 均值回归 | 抄底型 | 跌多了买，等它回来 |
| momentum | 动量 | 追强势 | 买最强的那个 |
| value | 价值 | 捡漏型 | 找被低估的好公司 |
| multi_factor | 多因子 | AI推荐型 | 多维度打分选股 |
| options | 期权 | 稳收租型 | 卖期权收保费 |

---

## ✅ 验收标准

1. 22模板100%有oneLinerCn (≤15字, 主语"你/我")
2. 6大分类全部改为场景化中文名
3. 抽样5个模板，非金融背景用户3秒内理解"这策略做什么"
4. oneLinerCn禁止出现英文缩写(MACD/RSI/KDJ等需用中文描述替代)
5. 每个oneLinerCn必须说清一个动作(买/卖/收/追/捡)

---

## 📌 PM审校结论

**当前质量**: 🔴 不合格 (oneLiner全是英文，中国用户无法理解)
**QClaw任务**: 22模板×(oneLinerCn+场景分类名) = 44条文案
**PM验收**: QClaw完成后，PM审校全部22条
**通过条件**: 22条中≥20条🟢优秀，0条🔴不合格
