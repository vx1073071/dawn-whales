<!-- META
version: 1.12.0
last_updated: 2026-06-12
round: R108
owner: JVS
purpose: (auto-generated, needs review)
-->

# 策略市场设计文档

## 核心模式

```
策略创作者（卖方�?                   平台                          策略使用者（买方�?     �?                               �?                               �?     �? 发布策略（定�?¥X/月）          �?                               �?     �?──────────────────────────────�?�?                               �?     �?                               �? 审核（自�?人工�?              �?     �?                               �? ←──────────────────────────�?  �?     �?                               �?                               �?     �?                               �?       浏览策略市场              �?     �?                               �?←──────────────────────────── �?     �?                               �?                               �?     �?                               �? 订阅策略（¥X/月）              �?     �?                               �?←──────────────────────────── �?     �?                               �?                               �?     �? 收到 70% 分成                  �? 平台�?30%                    �?     �?←──────────────────────────── �?───────────────────────────�?  �?     �?                               �?                               �?     �? 策略同步到买方（加密�?         �?                               �?     �?─────────────────────────────�?�?───────────────────────────�?  �?```

## 定价模型

| 策略等级 | 价格区间 | 平台抽成 | 创作者收�?|
|---------|---------|---------|-----------|
| 免费策略 | ¥0 | ¥0 | ¥0（引流） |
| 入门策略 | ¥9.9-29.9/�?| 30% | ¥6.9-20.9/�?|
| 进阶策略 | ¥49.9-99.9/�?| 30% | ¥34.9-69.9/�?|
| 专业策略 | ¥199-499/�?| 30% | ¥139-349/�?|
| 定制策略 | 议价 | 20% | 80% |

## 策略发布流程

```
1. 创作者创建策�?2. 回测报告自动生成（必须有回测数据才能发布�?3. 创作者设定：
   - 价格（免�?月付/年付折扣�?   - 最大订阅人数（稀缺性）
   - 适用市场（美�?港股/A股）
   - 风险等级（低/�?高）
   - 策略描述 + 使用说明
4. 提交审核
5. 平台自动审核�?   - 回测数据真实性验�?   - 策略代码安全检�?   - 风控参数合理性检�?6. 人工审核（专业级策略�?7. 上架
```

## 策略展示卡片

```
┌─────────────────────────────────�?�?📈 动量轮动 Pro                  �?�?@quantmaster · �?.8 (126�?    �?�?                                �?�?┌─────────────────────────────�?�?�?�?    收益曲线缩略�?          �?�?�?�?   ╱╲    ╱╲                 �?�?�?�?  �? �? �? ╲╱�? �?        �?�?�?�? �?   ╲╱      ╲╱           �?�?�?�?�?                 �?      �?�?�?└─────────────────────────────�?�?�?                                �?�?年化 28.3%  夏普 1.8  回撤 12%  �?�?胜率 62%    盈亏�?2.1          �?�?                                �?�?📊 美股 · 科技 · 月度轮动       �?�?⚠️ 中风�?                      �?�?👥 234人订�?                   �?�?                                �?�?┌──────────�?┌──────────�?     �?�?�?¥49.9/�?�?�?免费试用 �?     �?�?└──────────�?└──────────�?     �?└─────────────────────────────────�?```

## 排行榜系�?
| 榜单 | 排序依据 | 更新频率 |
|------|---------|---------|
| 🔥 热度�?| �?日订阅量 | 每小�?|
| 📈 收益�?| �?0日收益率 | 每日 |
| 🛡�?稳健�?| 夏普比率 | 每日 |
| �?口碑�?| 用户评分 | 实时 |
| 🆕 新星�?| 新策�?表现�?| 每日 |

## 收益认证系统

```
策略运行 �?每日自动记录净�?�?生成认证收益曲线
                                    �?                              ┌─────┴─────�?                              �?�?已认�? �?                              �?实盘数据   �?                              �?不可篡改   �?                              └───────────�?```

- 实盘收益 vs 回测收益对比
- 标记"已认�?徽章（实盘运�?> 30 天）
- 月度收益热力�?
## 跟单系统

```
订阅策略 �?选择跟单模式�?  ├── 完全自动（策略下单，自动执行�?  ├── 半自动（推送信号，手动确认�?  └── 仅通知（只看信号，不执行）

跟单参数覆盖�?  ├── 资金比例（默�?00%，可调低�?0%�?  ├── 最大单笔仓�?  └── 个人止损�?```

## 数据库设�?
```sql
-- 策略市场�?CREATE TABLE marketplace_strategies (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL,
  strategy_id TEXT REFERENCES strategies(id),
  title TEXT NOT NULL,
  description TEXT,
  price_monthly REAL DEFAULT 0,    -- 0 = 免费
  price_yearly REAL,                -- 年付优惠
  max_subscribers INTEGER,          -- NULL = 无限
  risk_level TEXT DEFAULT 'medium', -- low/medium/high
  market TEXT,                      -- US/HK/CN/CRYPTO
  tags TEXT,                        -- JSON array
  status TEXT DEFAULT 'pending',    -- pending/approved/rejected/removed
  backtest_summary TEXT,            -- JSON: 年化、夏普、回撤等
  verified BOOLEAN DEFAULT FALSE,   -- 实盘认证
  avg_rating REAL DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  subscriber_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 订阅记录
CREATE TABLE subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  strategy_id TEXT NOT NULL,
  status TEXT DEFAULT 'active',     -- active/cancelled/expired
  follow_mode TEXT DEFAULT 'auto',  -- auto/semi/notify
  capital_ratio REAL DEFAULT 1.0,   -- 跟单资金比例
  started_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT,
  auto_renew BOOLEAN DEFAULT TRUE
);

-- 评价
CREATE TABLE reviews (
  id TEXT PRIMARY KEY,
  strategy_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  rating INTEGER NOT NULL,          -- 1-5
  comment TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 收益认证
CREATE TABLE verified_performance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  strategy_id TEXT NOT NULL,
  date TEXT NOT NULL,
  daily_return REAL,
  cumulative_return REAL,
  nav REAL,                         -- 净�?  is_live BOOLEAN DEFAULT TRUE      -- 实盘 vs 回测
);

-- 分成记录
CREATE TABLE revenue_shares (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  author_id TEXT NOT NULL,
  strategy_id TEXT NOT NULL,
  subscriber_id TEXT NOT NULL,
  amount REAL,                      -- 总收�?  platform_share REAL,              -- 平台30%
  author_share REAL,                -- 作�?0%
  settled BOOLEAN DEFAULT FALSE,
  created_at TEXT DEFAULT (datetime('now'))
);
```

## 安全设计

| 风险 | 防护 |
|------|------|
| 策略被盗 | DSL 加密传输，本地解密，不可导出源码 |
| 虚假回测 | 平台独立重跑回测验证 |
| 恶意策略 | 沙箱运行 + 风控规则不可绕过 |
| 刷评�?| 只有真实订阅用户能评�?|
| 价格欺诈 | 平台审核定价合理�?|
| 收益造假 | 只认平台记录的实盘数�?|

## 商业模式预测

| 阶段 | 策略�?| 付费订阅 | 月收�?| 平台抽成 |
|------|-------|---------|--------|---------|
| Phase 6 上线 | 50 | 100 | ¥9,900 | ¥2,970 |
| 6个月�?| 200 | 500 | ¥49,500 | ¥14,850 |
| 12个月�?| 500 | 2,000 | ¥198,000 | ¥59,400 |
| 24个月�?| 2,000 | 10,000 | ¥990,000 | ¥297,000 |

假设平均策略价格 ¥99/月�?