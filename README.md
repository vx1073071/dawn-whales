# 🐋 DAWN WHALES

**全球首个四 Agent AI 协作量化交易平台**

[![Version](https://img.shields.io/badge/version-1.12.0-blue)](https://github.com/vx1073071/dawn-whales/releases)
[![Tests](https://img.shields.io/badge/tests-6500%2B%20%7C%200%20fail-brightgreen)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-Proprietary-red)]()

🌐 **官网**: [dawnwhales.com](https://dawnwhales.com) · 📥 **下载**: [最新版本](https://github.com/vx1073071/dawn-whales/releases)

> 选市场 → 套模板 → 一键回测 → AI 保驾护航。你的策略，你的收益。

---

## 核心能力

### 🤖 4Agent AI 协作
自研 TypeScript 原生 AI Agent 系统，4 个 Agent 协同分析，圆桌辩论 + Arena 投票：
- **基本面分析师** — 财报/估值/行业对比
- **技术面分析师** — K线/指标/趋势判断
- **情绪分析师** — 新闻/社交媒体/市场情绪
- **宏观分析师** — 利率/汇率/政策环境

### 🎨 AI 画线 + 形态识别
- 自动画线: 趋势线/支撑阻力/通道/斐波那契/江恩
- 22 种 K 线形态自动识别 + 置信度评分
- 创作者可拖拽修正、删除、确认

### 📊 策略工场
- 3 种创建方式: 模板套用 / AI 语音 / 手动填参
- 20+ 策略模板: 动量/均值回归/双均线/海龟/网格/DCA/期权跨式...
- 25+ 技术指标 + PineScript 风格编辑器
- 一键回测 → 发布到市场 → 赚取订阅收入

### 🌍 七市场全覆盖
| 市场 | 品种 |
|------|------|
| 🇭🇰 港股 (HKEX) | 正股/ETF/REIT/牛熊证/涡轮/期货/期权 |
| 🇺🇸 美股 (NYSE/NASDAQ) | 正股/ETF/ADR/期权/期货 |
| 🇸🇬 新加坡 (SGX) · 🇯🇵 日本 (TSE) | 正股/ETF/REIT |
| 🇦🇺 澳洲 (ASX) · 🇨🇦 加拿大 (TSX) · 🇲🇾 马来西亚 (Bursa) | 正股/ETF |

### 💰 USDT 积分系统
- 实时汇率引擎: CoinGecko→Binance→static 三级降级链, 6 种法币→USDT
- 原子积分扣费: check→deduct→ledger 串行, 余额不足自动拒绝
- 三级创作者费率: L1 0.1% / L2 0.02% / L3 0.04%
- 自动扣费钩子: 交易完成后自动扣积分, 3 次重试+死信队列
- 对账引擎: 账实核对/汇率异常检测/总量守恒/防重放

### 💰 策略市场
- 发布你的策略 → 别人订阅 → 你拿分成
- 6 级创作者体系: 青铜(70%)→王者(90%)
- 策略定价 50-1000 USDT
- 创作者成就徽章 + 排行榜

### 🔒 安全架构
- DeepSeek API Key **仅在服务器**暴露
- 桌面端不存 AI Key / 计费逻辑 / 钱包密钥
- child_process 沙箱 + CSRF + XSS + CSP 全防护
- npm audit: 0 vulnerabilities

---

## 技术栈

| 层 | 技术 |
|----|------|
| 桌面端 | Electron + React 18 + TypeScript strict |
| 构建 | Vite + esbuild + electron-builder |
| 服务端 | Node.js + PostgreSQL + Redis + Nginx |
| AI | DeepSeek V4 Pro (99% cache discount, 4-tier fallback) |
| 测试 | Vitest (6500+ tests) + Playwright (E2E) + Lighthouse |
| i18n | react-i18next (11 语言: zh-CN/zh-HK/zh-TW/en/ja/ko/fr/de/it/es/ru) |
| 券商 | Futu OpenD / Interactive Brokers |
| 支付 | USDT TRC-20 only |

---

## 快速开始

### 用户
1. 下载桌面端: [dawnwhales.com/download](https://dawnwhales.com/download) (Win/Mac/Linux)
2. 注册 → 连接券商 (Futu OpenD 或 IBKR)
3. 选市场 → 套模板 → 回测 → 发布
4. 新用户赠送 3 次免费 AI 分析

### 开发者

> **环境要求**: Node.js ≥ 20.x, npm ≥ 9.x

```bash
git clone <repo>
cd dawn-whales
npm ci
npm run dev          # 启动开发模式
npm run build        # 构建
npm test             # 运行测试 (6500+)
npm run lint         # ESLint
npm run typecheck    # TypeScript
```

### 服务器部署

```bash
cp .env.example .env    # 配置环境变量
npm run build:server
npm run db:migrate
npm run start:server    # /api :3001, /admin :3002
```

详见 [部署手册](docs/guides/deploy-license-guide.md)

---

## 项目结构

```
dawn-whales/
├── src/                    # 前端 (React)
│   ├── components/         # UI 组件 (30+ 目录)
│   ├── i18n/               # 国际化 (11 语言)
│   └── hooks/              # React Hooks
├── electron/               # 桌面端 (Electron)
│   ├── engine/             # 320+ 引擎 (策略/AI/风控/交易/回测...)
│   ├── main.ts             # Electron 主进程
│   └── preload.ts          # IPC 桥接
├── server/                 # 服务端
│   ├── api/                # REST API (/api/*)
│   └── admin/              # 管理后台 (/admin/*)
├── tests/                  # 测试 (374 测试套件)
├── docs/                   # 文档 (22+ 篇)
│   ├── guides/             # 用户指南
│   ├── api/                # API 参考
│   ├── releases/           # Release Notes
│   └── architecture/       # 架构文档
└── site/                   # 落地页 (静态)
```

---

## 路线图

| 阶段 | 轮次 | 版本 | 里程碑 |
|------|:---:|------|------|
| Sprint 2 | R52-R60 | v1.3.0 GA | 港股 GA + 策略引擎 |
| 功能扩张 | R61-R67 | v1.6.0 GA | 多市场 + P2P + 服务器化 + /admin + 落地页 |
| GA 前夜 | R68-R73 | v1.8.0 GA | IBKR + i18n + 社区 + 7市场 + AI 画线形态 |
| 5 轮收官 | R77-R81 | v1.9.0 GA | 安全→引擎→质量→增长→收尾 |
| 质量巩固 | R82-R86 | v1.9.x | ESLint/Mock/A股清理/any类型/i18n 50% |
| 国际化+积分 | R97-R104 | v1.12.0 | 11语言全球化 + USDT积分结算系统 |

**44 轮迭代 · 6800+ 测试 · 350+ 引擎 · 5 只虾**

---

## 贡献指南

1. Fork → Clone → `npm ci`
2. 创建分支: `feature/xxx` 或 `fix/xxx`
3. 确保: `npm test` 0 fail · `npm run lint` 0 error · `npm run typecheck` 0 error
4. Commit: `feat:` / `fix:` / `refactor:` / `docs:` / `chore:`
5. 提交 PR 到 `master`

详见 [CONTRIBUTING.md](CONTRIBUTING.md)

---

## 文档索引

| 角色 | 文档 |
|------|------|
| 🆕 新手 | [完整用户手册 v3](docs/guides/complete-user-manual-v3.md) · [快速入门](docs/guides/quickstart-guide.md) |
| 🎨 创作者 | [创作者指南 v2](docs/guides/ops-manual-v2-creator-growth.md) · [因子手册](docs/guides/factor-template-guide.md) |
| 🔧 运维 | [GA 公告 + 运营手册](docs/guides/ga-announcement-ops-manual.md) · [部署清单](docs/releases/v1.8.1-deploy-packaging-checklist.md) |
| 📝 开发者 | [API 文档](docs/api/) · [架构文档](docs/architecture/) · [安全加固报告](docs/reports/r77-security-hardening-report.md) |

---

## 许可证

Proprietary. Copyright © 2026 DAWN WHALES.
