# 🐋 DAWN WHALES · 道鲸

**AI 量化交易系统 — 说人话就能做量化**

🌐 **官网：https://vx1073071.github.io/dawn-whales/**
📥 **下载：[v0.7.0 Windows 安装包](https://github.com/vx1073071/dawn-whales/releases)**
⚙️ **测试**: 259/259 passed | **构建**: 0 errors | **TSC**: 0 errors

零代码散户量化平台，支持 **Futu + Moomoo + IB** 三券商同时交易，自然语言创建策略、实时行情推送、回测引擎、多券商风控和策略市场。

---

## ✨ 核心特性

### 📊 实时行情
- **Push 模式**（<50ms 延迟）直连富途 OpenD
- 支持美股、港股、A股、加密货币
- TradingView Lightweight Charts K线图
- 自选股搜索 + 一键添加（24 只热门标的）
- **断线自动重连**（指数退避，50 次尝试，自动重新订阅 Push）

### 🤖 AI 策略创建（三种方式）
1. **自然语言** — "RSI 低于 30 时买入 TQQQ，涨 5% 卖出"
2. **模板选择** — 8 个预置经典策略（均线交叉、RSI、MACD、动量、布林带）
3. **表单配置** — 动态参数调整（根据策略类型自动切换）

### 📈 回测引擎
- 6 种技术指标：SMA、EMA、RSI、MACD、布林带、ATR
- 5 种策略类型：均线交叉、RSI 超买超卖、MACD 信号、动量突破、布林带突破
- 完整绩效指标：年化收益、夏普比率、最大回撤、胜率、盈亏比
- 权益曲线可视化 + 交易明细
- 止损 / 止盈支持
- K 线缓存加速（10x 回测速度）

### 🏪 策略市场
- 社区策略排名（热度/收益/稳健/新星/免费）
- 风险等级筛选（低/中/高）
- 收益曲线预览
- 发布策略：选策略 → 设价格 → 提交审核
- 创作者 70% 收入分成

### 🛡️ 风控系统
- 7 项盘前检查：频率、数量、价格、金额、黑名单、日亏损、集中度
- 日最大亏损限制
- 每分钟最大下单数
- 交易时段检测（美股 ET 时间）
- 告警历史记录
- 紧急止损（一键全平所有策略）

### 💼 账户管理
- 实时资金概览（总资产/今日盈亏/持仓市值/可用资金/购买力）
- 持仓明细 + 盈亏百分比
- 资产配置可视化（彩色条形图）
- 自动刷新（30 秒间隔）

### 📋 订单管理
- 当前委托 / 历史委托 / 策略交易记录三标签页
- 实时订单推送（IPC 事件）
- 一键撤单
- 策略自动交易记录

### 🔔 通知系统
- 全局 Toast 通知（成功/错误/警告/信息）
- 策略信号推送
- 风控拦截告警
- 订单状态更新
- 自动更新提醒

---

## 🏗️ 技术架构

```
┌─────────────────────────────────────────────┐
│              Electron 33                     │
│  ┌───────────────┐   ┌──────────────────┐   │
│  │  Main Process │   │ Renderer Process │   │
│  │               │   │                  │   │
│  │  ┌──────────┐ │   │  React 18 + TS   │   │
│  │  │FutuOpenD │ │   │  Tailwind CSS    │   │
│  │  │TCP Client│◄├───┤  TradingView     │   │
│  │  │+ Reconnect│   │  Lightweight     │   │
│  │  └──────────┘ │   │  Charts          │   │
│  │  ┌──────────┐ │   └──────────────────┘   │
│  │  │ Engines  │ │         IPC Bridge       │
│  │  │ Backtest │ │   (30 handlers +         │
│  │  │ Strategy │ │    push events)          │
│  │  │ NL Parse │ │                          │
│  │  │ Risk     │ │                          │
│  │  └──────────┘ │                          │
│  │  ┌──────────┐ │                          │
│  │  │ SQLite   │ │                          │
│  │  │ (7 tables)│                          │
│  │  └──────────┘ │                          │
│  └───────────────┘                          │
└─────────────────────────────────────────────┘
         │
         ▼ TCP (127.0.0.1:11111)
    ┌──────────┐
    │ Futu OpenD│
    └──────────┘
```

| 组件 | 技术 |
|------|------|
| 桌面框架 | Electron 33 |
| 前端 | React 18 + TypeScript |
| 样式 | Tailwind CSS 3 |
| 图表 | TradingView Lightweight Charts 4.2 |
| 数据库 | better-sqlite3 (WAL mode, 7 tables) |
| 行情 | Futu OpenD TCP 直连 (protobuf) + Push |
| 更新 | electron-updater + GitHub Releases |
| CI/CD | GitHub Actions |
| 测试 | tsx (38 unit tests) |
| 打包 | electron-builder (NSIS) |

---

## 🚀 快速开始

### 前置条件
- Node.js 22+
- [富途 OpenD](https://openapi.futunn.com/futu-api-doc/opend/opend-cmd.html) 运行中（默认端口 11111）

### 开发

```bash
git clone https://github.com/vx1073071/dawn-whales.git
cd dawn-whales
npm install
npm run dev
```

### 测试

```bash
npm test          # 运行 38 个单元测试
```

### 打包

```bash
npm run dist:win   # Windows .exe (NSIS installer)
npm run dist:mac   # macOS .dmg
npm run dist:linux # Linux .AppImage
```

### 发布

```bash
git tag v0.3.0
git push origin v0.3.0   # GitHub Actions 自动构建 + Release
```

---

## 💰 定价

| 套餐 | 价格 | 功能 |
|------|------|------|
| **免费版** | ¥0 | 1 个策略，仅模拟盘 |
| **Starter** | ¥99/月 | 5 个策略，实盘交易 |
| **Pro** | ¥299/月 | 无限策略 + AI 助手 + 策略市场优先展示 |

**策略市场收入分成：** 创作者 70% · 平台 30%

---

## 📂 项目结构

```
dawn-whales/
├── electron/                  # Electron 主进程
│   ├── main.ts               # 应用入口 + 30 IPC handlers + auto-updater
│   ├── preload.ts            # IPC Bridge (安全暴露 API)
│   ├── broker/
│   │   └── futu-opend.ts     # OpenD TCP 客户端 (protobuf + 自动重连)
│   ├── engine/
│   │   ├── backtest-engine.ts # 回测引擎 (6指标 + 5策略)
│   │   ├── strategy-engine.ts # 策略执行引擎 (实时信号 + 自动交易)
│   │   ├── nl-parser.ts       # 自然语言策略解析器
│   │   └── risk-engine.ts     # 风控引擎 (7项检查)
│   └── data/
│       └── database.ts        # SQLite (7张表 + K线缓存)
├── src/                       # React 渲染进程
│   ├── components/
│   │   ├── layout/           # Header, Sidebar, StatusBar
│   │   ├── market/           # 行情页面 + K线图
│   │   ├── strategy/         # 策略工坊 (NL/模板/表单)
│   │   ├── portfolio/        # 持仓管理 + 资产配置
│   │   ├── orders/           # 订单管理
│   │   ├── marketplace/      # 策略市场 + 发布
│   │   ├── settings/         # 系统设置
│   │   ├── OnboardingModal   # 新用户引导
│   │   └── NotificationToast # 全局通知
│   ├── hooks/                # useBridgeSync (Push 行情)
│   ├── stores/               # Zustand 状态管理
│   └── lib/                  # bridge-api (IPC 客户端)
├── tests/                     # 单元测试 (38 tests)
├── site/                      # Landing Page 源文件
├── docs/                      # GitHub Pages + 架构文档
├── .github/workflows/         # CI/CD (GitHub Actions)
└── build/                     # 打包图标
```

---

## 🔧 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `VITE_DEV_SERVER_URL` | - | 开发模式下 Vite 服务器 URL |
| `OPEND_HOST` | `127.0.0.1` | OpenD 地址 |
| `OPEND_PORT` | `11111` | OpenD 端口 |

---

## 📋 更新日志

详见 [CHANGELOG.md](./CHANGELOG.md)

---

## 📄 License

MIT

---

**Built with 🐋 by DAWN WHALES Team**
