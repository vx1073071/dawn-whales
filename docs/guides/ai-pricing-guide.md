<!-- META
version: 1.12.0
last_updated: 2026-06-12
round: R108
owner: youdao
purpose: (auto-generated, needs review)
-->


> ⚠️ **[DEPRECATED — 2026-06-13]** 本文档已过时。请以 docs/reference/fee-schedule.md (v17.6 永久锁版) 为准。
> 主要变更: (1) 不再区分 taker/maker/stop 费率，统一按 5 类资产计费 (2) AI 不再有免费轮次 (3) 创作者等级基于纯销量而非订阅者数。
> 替代文档: docs/reference/fee-schedule.md | docs/design/ai-billing-rules.md | docs/design/marketplace-guide.md

# AI 功能 & 收费说明

**版本**: v1.8.0-beta | **更新时间**: 2026-06-09 | **作者**: youdao  

---

## 🤖 AI 功能

### 4 Agent 圆桌

| Agent | 分析维度 | 数据源 |
|-------|---------|--------|
| 基本面 | PE/PB/ROE/DCF | Yahoo+AV+自研 |
| 技术面 | MA/MACD/RSI/形态 | 25+ 指标 |
| 情绪面 | 新闻/社交/恐惧贪婪 | NewsAPI+Reddit+StockTwits |
| 宏观面 | 利率/GDP/行业轮动 | 自研多源 |

### AI 画线 & 形态

自动识别趋势线、支撑阻力、通道、斐波那契、江恩。20+ K线形态半透明标注+置信度，可手动修正。

### AI 助手

策略问诊 / 自然语言指令 / 每日简报 / 术语解释（🤖 收费标签）

---

## 💰 收费

| 功能 | 价格 |
|------|------|
| AI 分析 (标准) | 1.0 USDT/次 |
| AI 分析 (高级) | 1.5 USDT/次 |
| AI 分析 (旗舰) | 2.0 USDT/次 |
| 自动交易 Taker | 0.1% |
| 自动交易 Maker | 0.02% |
| 平台自动交易 | 0.04% |

| 功能 | 价格 |
|------|------|
| 高级模板 | 100-1000 USDT |
| 信号订阅 | 创作者定价 |
| 跟单 | 创作者定价 |
| P2P 转账 | 0.3% 双向 |

### 免费 (永久)

基础指标 / 本地回测 / Futu/IBKR 连接 / 策略编辑 / 信号浏览 / 钱包查看 / 新用户 3 次 AI 免费

---

## 💵 充提

充值 TRC-20 USDT：**0 手续费**  
提现 TRC-20 USDT：**0.1%**，最低 10 USDT

---

**文档版本**: v1.8.0-beta | ✅ 完成
