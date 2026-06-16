<!-- META
version: 1.12.0
last_updated: 2026-06-12
round: R25
owner: QClaw
purpose: (auto-generated, needs review)
-->

# Sprint 1 Demo 验收清单 (R25)

**项目**: quant-moo · 道鲸  
**版本**: v0.6.0  
**日期**: 2026-06-06  
**状态**: 🔄 录制中

---

## 验收场景清单（≥10/12 通过）

### 场景 1: Dashboard 总资产概览
- [ ] 启动应用，Dashboard 页面自动加载
- [ ] 显示总资产、现金、市值、今日盈亏
- [ ] 持仓热力图显示至少 2 个持仓（TQQQ / NVDA）
- [ ] 净值曲线正确渲染
- [ ] 侧边栏显示连接状态

**截图路径**: `docs/demo/r25-scene01-dashboard.png`

---

### 场景 2: Market 行情页面
- [ ] 点击侧边栏「行情」进入 MarketPage
- [ ] 显示股票列表及实时价格
- [ ] K-line 图表可切换周期（1m/5m/15m/60m/daily/weekly）
- [ ] 价格变动用红绿颜色标识（涨红跌绿）

**截图路径**: `docs/demo/r25-scene02-market.png`

---

### 场景 3: Strategy 策略模板
- [ ] 点击侧边栏「策略」进入 StrategyPage
- [ ] 显示 15+ 策略模板（MA Cross / RSI / MACD 等）
- [ ] 可创建新策略并保存
- [ ] 策略列表正确显示

**截图路径**: `docs/demo/r25-scene03-strategy.png`

---

### 场景 4: Backtest 回测执行
- [ ] 选择策略 → 设置参数 → 执行回测
- [ ] 显示回测结果（收益率、交易次数、夏普比率、最大回撤）
- [ ] 净值曲线展示
- [ ] 参数扫描热力图（如有）

**截图路径**: `docs/demo/r25-scene04-backtest.png`

---

### 场景 5: TradeDashboard 交易台
- [ ] 点击侧边栏「交易台」进入 TradeDashboardPage
- [ ] 显示 Paper/Real 模式切换
- [ ] 显示当前持仓列表
- [ ] 显示订单历史
- [ ] 显示每日盈亏统计

**截图路径**: `docs/demo/r25-scene05-trade.png`

---

### 场景 6: RiskDashboard 风控面板
- [ ] 点击侧边栏「风控面板」进入 RiskDashboardPage
- [ ] 显示实时风险指标（VaR / 回撤 / 保证金使用率）
- [ ] 显示仓位限制状态
- [ ] Kelly 仓位建议
- [ ] 紧急停止按钮可用

**截图路径**: `docs/demo/r25-scene06-risk.png`

---

### 场景 7: AlertCenter 告警中心
- [ ] 点击侧边栏「告警中心」进入 AlertCenterPage
- [ ] 显示风险告警列表
- [ ] 显示系统通知
- [ ] 告警级别标识（info/warning/critical）

**截图路径**: `docs/demo/r25-scene07-alert.png`

---

### 场景 8: Settings 配置页面
- [ ] 点击侧边栏「设置」进入 SettingsPage
- [ ] 显示券商连接配置（Futu / Moomoo）
- [ ] 可保存配置并持久化
- [ ] 显示版本号 v0.6.0

**截图路径**: `docs/demo/r25-scene08-settings.png`

---

### 场景 9: Sidebar 导航切换
- [ ] 侧边栏所有导航项可点击
- [ ] 页面切换无白屏、无卡顿
- [ ] 当前页面高亮显示
- [ ] 语言切换器可用（中/英/日/韩/法/意/德）

**截图路径**: `docs/demo/r25-scene09-sidebar.png`

---

### 场景 10: .exe 安装 → 启动流程
- [ ] 双击 `quant-moo Setup 0.6.0.exe`
- [ ] NSIS 安装向导正常显示
- [ ] 安装完成自动/手动启动
- [ ] 启动后显示 Dashboard
- [ ] DevTools 无红色报错

**截图路径**: `docs/demo/r25-scene10-installer.png`

---

### 场景 11: WebSocket 实时数据（加分项）
- [ ] Dashboard 持仓价格随 tick 更新
- [ ] Market 页面价格实时刷新
- [ ] Risk 面板 unrealized PnL 动态变化
- [ ] 连接断开后显示降级状态

**截图路径**: `docs/demo/r25-scene11-websocket.gif`

---

### 场景 12: Paper Trading 模拟下单（加分项）
- [ ] TradeDashboard 切换至 Paper 模式
- [ ] 模拟下单 BUY US.TQQQ
- [ ] 订单状态从 submitted → filled
- [ ] 持仓列表更新
- [ ] 订单历史记录新增

**截图路径**: `docs/demo/r25-scene12-paper-trade.gif`

---

## 测试基线

| 指标 | 数值 | 状态 |
|------|------|:----:|
| TypeScript | 0 errors | ✅ |
| Build | 0 errors, 0 warnings | ✅ |
| Tests | 129/129 pass / 6 files | ✅ |
| Exit Code | 0 | ✅ |
| 版本号 | 0.6.0 | ✅ |
| .exe | quant-moo Setup 0.6.0.exe | 🔄 |

---

## 录制状态追踪

| 场景 | 截图 | GIF | 完成时间 |
|------|:----:|:---:|:--------:|
| 1. Dashboard | ⬜ | — | — |
| 2. Market | ⬜ | — | — |
| 3. Strategy | ⬜ | — | — |
| 4. Backtest | ⬜ | — | — |
| 5. TradeDashboard | ⬜ | — | — |
| 6. RiskDashboard | ⬜ | — | — |
| 7. AlertCenter | ⬜ | — | — |
| 8. Settings | ⬜ | — | — |
| 9. Sidebar | ⬜ | — | — |
| 10. Installer | ⬜ | — | — |
| 11. WebSocket | ⬜ | ⬜ | — |
| 12. Paper Trade | ⬜ | ⬜ | — |

---

## 备注

- 截图建议使用 1920×1080 分辨率
- GIF 建议时长 5-10 秒，帧率 10fps
- 所有图片存放于 `docs/demo/` 目录
- 本文件由 PM (WorkBuddy) 维护
