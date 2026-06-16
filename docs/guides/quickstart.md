<!-- META
version: 1.12.0
last_updated: 2026-06-12
round: R108
owner: youdao
purpose: (auto-generated, needs review)
-->

# quant-moo · 道鲸 — Quick Start Guide

**Version**: v0.7.0
**Last Updated**: 2026-06-06

---

## Overview

quant-moo (道鲸) is an AI-powered quantitative trading desktop application. It supports:

- **Natural Language Strategy Creation**: Type "买入TQQQ 100股，止损-5%" and let AI parse it
- **Multi-Broker Trading**: Futu OpenD + Moomoo OpenD + Interactive Brokers (IB)
- **Real-time Execution**: WebSocket market data → strategy signal → order routing → risk check
- **Comprehensive Analytics**: Backtest reports, equity curves, risk dashboards, alert center

---

## System Requirements

- **OS**: Windows 10/11 (x64), macOS 12+, Linux (x64)
- **Node.js**: v18+ (included in installer)
- **Disk**: ~500 MB
- **Broker**: Futu OpenD (port 11111) or Moomoo OpenD (port 11211) or IB Gateway (port 4001/7496)

---

## Installation

### Option 1: Installer (Windows)

1. Download `quant-moo Setup 0.7.0.exe` from [GitHub Releases](https://github.com/vx1073071/quant-moo/releases)
2. Run the installer
3. Launch from desktop shortcut

### Option 2: From Source

```bash
git clone https://github.com/vx1073071/quant-moo.git
cd quant-moo
npm ci
npm run dev          # dev mode
npm run build        # production build
npm run dist:win     # package .exe
```

---

## Quick Start — Your First Trade in 5 Minutes

### Step 1: Connect a Broker

1. Launch quant-moo
2. Go to **Settings** → **券商设置** (Broker Settings)
3. Enter your broker connection:
   - **Futu OpenD**: host `127.0.0.1`, port `11111`
   - **Moomoo OpenD**: host `127.0.0.1`, port `11211`
   - **IB Gateway**: host `127.0.0.1`, port `4001`
4. Click **Connect** — status indicator turns green when connected

### Step 2: Create a Strategy

1. Go to **策略工坊** (Strategy Workshop)
2. In the **自然语言** (Natural Language) tab, type:
   ```
   买入TQQQ 100股，止损设置为-5%
   ```
3. Click **解析** (Parse) — the form auto-fills
4. Select target broker from the dropdown (Futu / Moomoo / IB)
5. Click **创建** (Create)

### Step 3: Backtest

1. With your strategy selected, click **回测** (Backtest)
2. Set period: Daily, 2 years, initial capital $100,000
3. Click **运行** (Run) — results show total return, Sharpe ratio, max drawdown, equity curve
4. Click **保存** (Save) to persist

### Step 4: Go Live

1. Click **启动实盘** (Start Live)
2. Strategy status changes to **running** (green)
3. When market conditions match, the strategy generates buy/sell signals
4. Orders are routed to your selected broker and risk-checked
5. Track all orders in **交易台** (Trade Desk) or **委托订单** (Orders)

### Step 5: Monitor

- **总览看板** (Dashboard): Real-time portfolio overview
- **风控面板** (Risk Dashboard): 7 risk indicators, emergency stop
- **告警中心** (Alert Center): All strategy signals, risk warnings, order confirmations
- **持仓管理** (Portfolio): Cross-broker position aggregation

---

## Multi-Broker Architecture

```
┌─────────────────────────────────────────────────┐
│                   quant-moo                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │  Futu    │  │ Moomoo   │  │    IB    │       │
│  │ OpenD    │  │ OpenD    │  │ Gateway  │       │
│  │ :11111   │  │ :11211   │  │ :4001    │       │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘       │
│       │              │              │            │
│  ┌────┴──────────────┴──────────────┴────┐      │
│  │        UnifiedAccountManager          │      │
│  │  cross-broker aggregation, best quote │      │
│  └────────────────┬──────────────────────┘      │
│                   │                              │
│  ┌────────────────┴──────────────────────┐      │
│  │         Strategy Engine               │      │
│  │  NL → Strategy → Signal → Order Route │      │
│  └────────────────┬──────────────────────┘      │
│                   │                              │
│  ┌────────────────┴──────────────────────┐      │
│  │           Risk Engine                 │      │
│  │  7 checks · daily loss · margin · VaR │      │
│  └───────────────────────────────────────┘      │
└─────────────────────────────────────────────────┘
```

---

## Key Concepts

### Strategies

Strategies define **when** to buy/sell (conditions) and **how much** (position size). Created via:
- **Natural Language** (推荐): Type in Chinese/English
- **Templates**: MA Crossover, RSI, MACD, Bollinger Bands, etc.
- **Form**: Manual parameter entry

### Brokers

quant-moo supports three brokers simultaneously. Switch between them in the top bar **BrokerSelector**. Account assets and positions are **aggregated** in the sidebar and Portfolio page.

### Risk Management

7 built-in risk checks before every order:
1. Concentration limit
2. Daily loss limit
3. Position size limit
4. Margin threshold
5. Volatility adjuster
6. Blacklist filter
7. Trading hours check

**Emergency Stop** button in the top bar halts all running strategies immediately.

---

## Running Tests

```bash
npm test           # 259+ tests, all passing
npm run build      # Production build, 0 errors
npx tsc --noEmit   # Type check, 0 errors
```

---

## Documentation

- [Sprint 1 Retrospective](../sprints/sprint1-retrospective.md)
- [Installation Checklist](../demo/r26-installer-checklist.md)
- [Demo Script (11 scenes)](../demo/r26-demo-script.md)
- [RiskEngine v2 Validation](../tasks/r26-riskengine-v2-validation.md)
- [Performance Baseline](../performance/baseline-q25-02.md)
- [Sprint 2 Phase 3 Roadmap](../roadmap/sprint2-phase3-execution.md)
- [CHANGELOG](../../CHANGELOG.md)

---

## Support

- **GitHub Issues**: https://github.com/vx1073071/quant-moo/issues
- **Futu OpenD**: https://openapi.futunn.com
- **Moomoo OpenD**: https://www.moomoo.com/api
- **IB Gateway**: https://www.interactivebrokers.com/api
