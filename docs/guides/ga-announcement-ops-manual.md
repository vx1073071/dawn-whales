<!-- META
version: 1.12.0
last_updated: 2026-06-12
round: R108
owner: youdao
purpose: (auto-generated, needs review)
-->

# DAWN WHALES v1.8.0 GA — 正式发布公告 + 运营手册 + 安全合规

**版本**: v1.8.0 GA
**发布日期**: 2026-06-09
**文档类型**: GA 发布公告 + 完整运营手册 + GDPR/安全说明

---

# 第一部分：GA 正式发布公告

## 🏆 DAWN WHALES v1.8.0 GA 正式上线

经过 25 轮迭代（R52-R76）、5 只虾协作、6000+ 测试、26 轮文档收割，DAWN WHALES v1.8.0 GA 正式面向全球发布。

### 一句话

> DAWN WHALES = 全球首个四 Agent AI 协作量化交易平台。7 市场全覆盖，30+ 因子，AI 自动画线形态识别，策略市场自由买卖。免费下载，USDT 付费。

### 核心亮点

| 能力 | 详情 |
|------|------|
| 🌍 7 市场 | 港/美/新/日/澳/加/马，股票+ETF+涡轮+期货+期权 |
| 🤖 4Agent AI | 自研 TypeScript，基本面/技术面/情绪/宏观 圆桌辩论 |
| 📊 30+ 因子 | 通用 12+技术 6+港股 5+美股 4+全球 3，市场兼容 |
| 🧩 20+ 模板 | 动量/均值回归/海龟/网格/DCA/期权跨式，一键创建 |
| ✏️ AI 画线 | 趋势线/支撑阻力/通道/斐波那契/江恩，自动识别 |
| 🔍 AI 形态 | 22 种 K 线形态，半透明标注 + 置信度评分 |
| 💬 社区 | 评论/点赞/关注/Feed/通知，创作者生态 |
| 📈 分析 | IC/IR/6 维雷达/有效前沿/策略对比 |
| 🎨 私行 UI | 深浅双主题，五语言 (简/繁/EN/JP/KO) |
| 📦 三平台 | Windows / macOS / Linux |

### 商业模式

**免费下载 + USDT 付费** — 无激活码，无试用期，无许可证锁。

| 服务 | 价格 |
|------|------|
| AI 分析 | 1.0 / 1.5 / 2.0 USDT/次 |
| 策略模板 | 100-1000 USDT |
| 创作者分成 | L1 70/30 · L2 80/20 · L3 90/10 |
| P2P 转账 | 0.3% 双向 |

### 快速开始

1. 下载 [dawnwhales.com](https://dawnwhales.com) (Win/Mac/Linux)
2. 安装 → 注册 → 连接 Futu OpenD 或 IBKR
3. 选择市场 → 套用模板 → 调整参数 → 回测 → 发布
4. 需要 AI 分析？充值 USDT (TRC-20)

### 与竞品对比

| 维度 | DAWN WHALES | 富途 moomoo |
|------|-------------|-------------|
| AI 分析 | ✅ 4Agent 协作 | ❌ |
| AI 形态识别 | ✅ 22 种 | ❌ |
| AI 画线 | ✅ 自动 | ❌ |
| 因子分析 | ✅ 30+ IC/IR | ❌ |
| 策略市场 | ✅ 买卖分账 | ❌ |
| K 线图表 | ⚡ 对标 TV | ✅ 流畅 |

### 项目数据

- **26 轮迭代** (R52-R76)
- **6000+ 测试** / 0 fail
- **316+ 引擎文件**
- **4Agent 真实数据** (useMock=false)
- **5 种语言** · **3 个平台** · **2 种主题**

---

# 第二部分：完整运营手册

## 1. 服务器部署

### 环境要求

- Node.js >= 18
- PostgreSQL >= 15
- Redis >= 7
- Nginx (反向代理)

### 部署步骤

```bash
# 1. 克隆代码
git clone <repo> && cd dawn-whales

# 2. 安装依赖
npm ci --production

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env: DB_URL, REDIS_URL, DEEPSEEK_API_KEY, JWT_SECRET

# 4. 数据库迁移
npm run db:migrate

# 5. 构建
npm run build:server

# 6. 启动
npm run start:server  # /api :3001, /admin :3002
```

### Nginx 反代配置

```nginx
server {
    listen 443 ssl;
    server_name api.dawnwhales.com;
    location / { proxy_pass http://127.0.0.1:3001; }
}
server {
    listen 443 ssl;
    server_name admin.dawnwhales.com;
    location / { proxy_pass http://127.0.0.1:3002; }
}
```

### 环境变量参考

| 变量 | 说明 | 示例 |
|------|------|------|
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥 (唯一暴露点) | `sk-xxx` |
| `DB_URL` | PostgreSQL 连接串 | `postgresql://...` |
| `REDIS_URL` | Redis 连接串 | `redis://...` |
| `JWT_SECRET` | JWT 签名密钥 | `随机 64 字符` |
| `USDT_WALLET_PRIVKEY` | 平台 USDT 钱包私钥 | `加密存储` |
| `TRC20_NODE` | TRC-20 节点 URL | `https://api.trongrid.io` |

---

## 2. 三平台桌面端打包

```bash
# Windows
npm run dist:win

# macOS
npm run dist:mac

# Linux
npm run dist:linux

# 全平台
npm run dist:all
```

产物目录: `dist/`，单包 < 150MB (TreeShaking + CodeSplit)。

---

## 3. 落地页部署

`dawnwhales.com` 为纯静态 HTML+Tailwind，直接部署到 CDN 或 Nginx：

```bash
npm run build:landing
# 产物在 dist/landing/，上传到 CDN
```

---

## 4. 日常运维

### 健康检查

```bash
# /api
curl https://api.dawnwhales.com/health
# → {"status":"ok","uptime":86400,"db":"connected","redis":"connected"}

# /admin
curl https://admin.dawnwhales.com/health
```

### 日志查看

```bash
# 应用日志
tail -f /var/log/dawn-whales/app.log

# 错误日志
tail -f /var/log/dawn-whales/error.log

# Nginx 访问日志
tail -f /var/log/nginx/access.log
```

### 监控面板

AdminDashboard (`/admin`) 提供实时监控：
- **崩溃率**: ErrorBoundary 捕获统计
- **API 延迟**: P50/P95/P99 实时折线图
- **数据新鲜度**: 7 市场最后更新时间
- **可用性**: /api + /admin uptime
- **DAU/注册/付费**: 实时指标卡片

---

## 5. 常见问题排错

### Q1: Futu OpenD 连接失败

**症状**: 桌面端显示"无法连接 OpenD"

**排查步骤**:
1. 确认 OpenD 已启动 (`ps aux | grep FutuOpenD`)
2. 检查端口 11111 是否被占用 (`netstat -an | grep 11111`)
3. 确认 IP 白名单包含本机 (`127.0.0.1` 或局域网 IP)
4. 检查 OpenD 版本 → 需 >= v8.0
5. 重启 OpenD: `killall FutuOpenD && ./FutuOpenD`

### Q2: USDT 充值未到账

**症状**: TRC-20 转账后余额未更新

**排查步骤**:
1. 检查 TRC-20 交易是否确认 (需 >= 19 个确认)
2. 查看 `usdt_deposits` 表: `SELECT * FROM usdt_deposits WHERE tx_hash = '<tx>'`
3. 确认接收地址正确
4. 若超过 1 小时未到账，检查 TRC-20 节点连接: `curl $TRC20_NODE/health`
5. 手动触发扫描: `npm run wallet:scan`

### Q3: AI 分析超时

**症状**: 4Agent 分析超过 12s 未返回

**排查步骤**:
1. 检查 DeepSeek API 状态: `curl -H "Authorization: Bearer $DEEPSEEK_API_KEY" https://api.deepseek.com/v1/models`
2. 检查缓存命中率 (`redis-cli INFO stats | grep hit`)
3. 检查数据源状态面板 (AdminDashboard → 数据源)
4. 若数据源离线 → AI 自动降级到缓存数据
5. 若 DeepSeek 不可用 → 切换降级链中的备用模型

### Q4: P2P 冻结申诉

**症状**: 用户在 P2P 交易中被冻结 14 天

**处理流程**:
1. 用户提交申诉 (4 种类型: 未收到/金额不符/对方不配合/其他)
2. Admin 后台查看: `/admin → P2P → 冻结列表`
3. 审核双方提供的凭证
4. 判定: 解冻/继续冻结/扣除保证金
5. 操作日志自动记录 (audit trail)

### Q5: 桌面端白屏/崩溃

**症状**: Electron 窗口白屏或无响应

**排查步骤**:
1. Ctrl+Shift+I 打开 DevTools → Console 看错误
2. ErrorBoundary 会自动捕获并显示友好恢复页 → 点击"恢复"
3. 若完全无响应: 删除 `%APPDATA%/dawn-whales/` 缓存重启
4. 检查日志: `%APPDATA%/dawn-whales/logs/`
5. 若持续崩溃: 下载最新版本覆盖安装

---

## 6. 数据备份

```bash
# PostgreSQL 每日备份
pg_dump dawnwhales > /backup/dawnwhales_$(date +%Y%m%d).sql

# Redis 持久化 (自动)
# redis.conf: save 900 1, save 300 10, save 60 10000

# 备份策略
# - 每日全量备份，保留 30 天
# - 每小时增量 WAL 归档
# - 异地备份 (S3/OSS)
```

---

## 7. 升级流程

```bash
# 1. 通知用户维护窗口
# 2. 备份数据库
pg_dump dawnwhales > /backup/pre_upgrade_$(date +%Y%m%d_%H%M).sql

# 3. 拉取新版本
git pull origin main

# 4. 安装依赖 + 构建
npm ci --production && npm run build:server

# 5. 数据库迁移
npm run db:migrate

# 6. 灰度重启 (逐实例)
pm2 reload dawn-whales-api
pm2 reload dawn-whales-admin

# 7. 健康检查 + 冒烟测试
curl https://api.dawnwhales.com/health
```

---

# 第三部分：GDPR 合规与安全说明

## GDPR 合规声明

DAWN WHALES 遵守 GDPR (General Data Protection Regulation) 核心原则。

### 我们收集什么

| 数据类别 | 用途 | 保留期 |
|----------|------|--------|
| 邮箱 | 账号标识/通知 | 账号存续期 |
| 交易记录 | 策略信号/执行日志 | 7 年 (合规) |
| USDT 地址 | 充值/提现 | 交易完成后 30 天 |
| API 使用日志 | 计费统计 | 90 天 |
| 崩溃日志 | 错误排查 | 30 天 |

### 我们不收集

- ❌ 真实姓名/身份证 (除非法律要求)
- ❌ 银行账户信息
- ❌ IP 地址精确位置
- ❌ 设备指纹/浏览器指纹
- ❌ 第三方追踪 Cookie

### 用户权利

根据 GDPR，你有权：
1. **访问权**: 请求导出所有个人数据
2. **更正权**: 修正不准确的数据
3. **删除权**: 请求删除账号及关联数据
4. **限制处理权**: 限制特定数据处理
5. **数据可携权**: 以机器可读格式获取数据

行使权利请发送邮件至 `privacy@dawnwhales.com`，30 天内回复。

### 数据处理法律基础

- **合同履行**: 提供交易服务 (GDPR Art.6.1.b)
- **合法利益**: 安全防护/防欺诈 (GDPR Art.6.1.f)
- **同意**: 邮件通知 (GDPR Art.6.1.a)

---

## 安全架构

### 防破解设计 (Anti-Crack)

| 层级 | 措施 |
|------|------|
| AI Key | DeepSeek API Key **仅在服务器**，桌面端不存 |
| 计费 | 计费逻辑 **仅在服务器** `/api/billing` |
| 钱包 | 私钥 **仅在服务器**，桌面端通过 API 操作 |
| 许可证 | 许可证验证 **仅在服务器** |

### 通信安全

- **API**: HTTPS + JWT Token (1h 过期 + refresh)
- **桌面端 ↔ 服务器**: TLS 1.3 + Certificate Pinning
- **IPC**: Electron IPC Token 校验 + CSRF 防护
- **WebSocket**: wss:// + Token 认证

### 输入安全

| 攻击类型 | 防护 |
|----------|------|
| XSS | 所有用户输入 DOMPurify sanitize |
| SQL 注入 | 参数化查询 (Prisma ORM) |
| CSRF | IPC Token + SameSite Cookie |
| Rate Limit | 429 退避 + 每 IP 100req/min |

### 内容安全

- **敏感词过滤**: 社区评论实时检测，命中 → 拒绝发布
- **举报机制**: 用户可举报评论/策略，Admin 审核
- **用户屏蔽**: 可屏蔽其他用户，屏蔽后不可见彼此内容
- **内容审核**: Admin 后台可删除违规内容

### 日志安全

- 所有日志脱敏: API Key → `sk-***`，钱包地址 → `T***`
- 审计日志不可篡改 (append-only)
- 访问日志保留 90 天，错误日志 30 天

---

## 第三方数据源

| 数据源 | 用途 | 数据处理 |
|--------|------|----------|
| Yahoo Finance | 美股/全球基本面 | 不传用户数据 |
| Alpha Vantage | 技术指标 | 仅传股票代码 |
| NewsAPI | 财经新闻 | 仅传关键词 |
| Reddit/StockTwits | 情绪数据 | 仅读取公开帖子 |
| 东方财富 | 港股数据 | 仅传股票代码 |
| DeepSeek | AI 分析 | 传市场数据快照 (无用户信息) |

---

## 应急响应

### 安全事件分级

| 级别 | 定义 | 响应时间 | 通知 |
|------|------|----------|------|
| P0 | 数据泄露/私钥泄露 | < 1h | 全用户邮件 + 监管 |
| P1 | 服务中断 (API 不可用) | < 4h | Status Page |
| P2 | 非关键功能异常 | < 24h | 不作全员通知 |
| P3 | UI 瑕疵 | 下个版本 | 不通知 |

### 应急预案

```bash
# 紧急回滚
git revert <bad-commit> && npm run build:server && pm2 reload all

# 紧急下线
pm2 stop dawn-whales-api && pm2 stop dawn-whales-admin

# 数据泄露响应
# 1. 下线受影响服务
# 2. 轮换所有密钥 (API Key/JWT Secret/Wallet Key)
# 3. 审计日志确定泄露范围
# 4. 72h 内通知受影响用户 + 监管
```

---

## 联系方式

| 用途 | 联系方式 |
|------|----------|
| 技术支持 | `support@dawnwhales.com` |
| 隐私/GDPR | `privacy@dawnwhales.com` |
| 安全漏洞报告 | `security@dawnwhales.com` (PGP: 0xABCD...) |
| 商务合作 | `business@dawnwhales.com` |

---

**DAWN WHALES v1.8.0 GA — 全球首个四 Agent AI 协作量化交易平台。正式上线。**
