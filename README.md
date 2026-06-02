# 🐋 DAWN WHALES · 道鲸

**AI 量化交易系统 — 说人话就能做量化**

🌐 **官网：https://vx1073071.github.io/dawn-whales/**

零代码散户量化平台，对接富途/moomoo OpenD，支持自然语言创建策略、实时行情推送、回测引擎和策略市场。

---

## ✨ 核心特性

### 📊 实时行情
- **Push 模式**（<50ms 延迟）直连富途 OpenD
- 支持美股、港股、A股、加密货币
- TradingView Lightweight Charts K线图
- 8 只自选股实时监控

### 🤖 AI 策略创建（三种方式）
1. **自然语言** — "RSI 低于 30 时买入 TQQQ，涨 5% 卖出"
2. **模板选择** — 预置经典策略（均线交叉、动量、均值回归）
3. **表单配置** — 拖拽式参数调整

### 📈 回测引擎
- 历史数据回测
- 收益率、夏普比率、最大回撤
- 权益曲线可视化

### 🏪 策略市场
- 社区策略排名（收益/夏普/回撤/热度）
- 风险等级筛选
- 创作者 70% 收入分成

### 🛡️ 风控系统
- 单笔订单限额
- 日内交易频率限制
- 紧急止损（一键全平）

### 💼 账户管理
- 真实持仓 / 模拟盘切换
- 资金概览（总资产/现金/购买力）
- 订单历史

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
│  │  └──────────┘ │   │  Lightweight     │   │
│  │       │       │   │  Charts          │   │
│  │  ┌──────────┐ │   └──────────────────┘   │
│  │  │ SQLite   │ │         IPC Bridge       │
│  │  │ (WAL)    │ │   (contextBridge)        │
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
| 数据库 | better-sqlite3 (WAL mode) |
| 行情 | Futu OpenD TCP 直连 (protobuf) |
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

### 打包

```bash
npm run dist:win   # Windows .exe
npm run dist:mac   # macOS .dmg
npm run dist:linux # Linux .AppImage
```

---

## 💰 定价

| 套餐 | 价格 | 功能 |
|------|------|------|
| **免费版** | ¥0 | 1 个策略，仅模拟盘 |
| **Starter** | ¥99/月 | 5 个策略，实盘交易 |
| **Pro** | ¥299/月 | 无限策略 + AI 助手 + 策略市场优先展示 |

---

## 📂 项目结构

```
dawn-whales/
├── electron/              # Electron 主进程
│   ├── main.ts           # 应用入口
│   ├── preload.ts        # IPC Bridge
│   └── broker/
│       └── futu-opend.ts # OpenD TCP 客户端
├── src/                   # React 渲染进程
│   ├── components/
│   │   ├── market/       # 行情页面
│   │   ├── strategy/     # 策略管理
│   │   ├── portfolio/    # 持仓/账户
│   │   ├── orders/       # 订单历史
│   │   ├── marketplace/  # 策略市场
│   │   └── settings/     # 设置
│   ├── hooks/            # 自定义 Hooks
│   ├── stores/           # Zustand 状态管理
│   └── lib/              # API 封装
├── docs/                  # 架构文档
└── build/                 # 打包图标
```

---

## 📄 License

MIT

---

**Built with 🐋 by DAWN WHALES Team**
