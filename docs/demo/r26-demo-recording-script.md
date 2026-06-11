<!-- META
version: 1.12.0
last_updated: 2026-06-12
round: R26
owner: QClaw
purpose: (auto-generated, needs review)
-->

# Sprint 1 Demo 录制脚本 (R26)

**项目**: DAWN WHALES · 道鲸  
**版本**: v0.6.0  
**日期**: 2026-06-06  
**录制工具**: 推荐 ScreenToGif (Windows) 或 OBS  
**分辨率**: 1920×1080，窗口缩放 100%  
**时长目标**: 10 分钟（12 个场景）

---

## 录制前准备

### 环境检查
1. [ ] `npm run build` 成功，无 errors
2. [ ] `npm test` 129/129 pass
3. [ ] 启动应用：`npm start` 或双击 `.exe`
4. [ ] 确认 OpenD 连接正常（如需真实数据）
5. [ ] 关闭所有无关窗口，桌面整洁
6. [ ] 设置屏幕分辨率为 1920×1080

### 录制设置
- **ScreenToGif**: FPS 10，编码器 2.0，质量 80%
- **OBS**: 输出 1920×1080，60fps，编码器 x264
- **截图**: Win+Shift+S 或 Snipping Tool

---

## 场景 1: Dashboard 总资产概览（0:00–0:50）

**目标**: 展示应用启动后的主界面，突出实时数据和净值曲线

**操作步骤**:
1. 双击 `DAWN WHALES Setup 0.6.0.exe` 启动应用（或 `npm start`）
2. 等待应用加载完成（约 3–5 秒）
3. **截图 1**: 完整 Dashboard 页面（`docs/demo/r26-scene01-dashboard.png`）
4. 鼠标悬停在「总资产」卡片上，停留 2 秒
5. 鼠标悬停在「今日盈亏」卡片上，停留 2 秒
6. 滚动到净值曲线区域
7. **截图 2**: 净值曲线特写（`docs/demo/r26-scene01-equity.png`）

**验证点**:
- [ ] 窗口标题显示 "DAWN WHALES · 道鲸"
- [ ] 标题栏和任务栏显示 DW logo（非 Electron 默认图标）
- [ ] 总资产、现金、市值、今日盈亏 4 个卡片可见
- [ ] 持仓热力图显示至少 2 个持仓色块
- [ ] 净值曲线有数据点（非空）
- [ ] 侧边栏「连接状态」显示绿色/在线

**旁白建议**:
> 「这是 DAWN WHALES 的 Dashboard，启动后自动加载。总资产 150 万港元，今日盈利 1.25 万。净值曲线展示了策略运行以来的累计收益走势。」

---

## 场景 2: Market 行情页面（0:50–1:40）

**目标**: 展示行情搜索、添加股票、K-line 图表

**操作步骤**:
1. 点击侧边栏「行情」导航项
2. 等待 MarketPage 加载（约 1 秒）
3. **截图**: MarketPage 完整界面（`docs/demo/r26-scene02-market.png`）
4. 在搜索框输入 "00700"（腾讯控股）
5. 点击搜索结果中的 "HK.00700"
6. 观察 K-line 图表加载
7. 点击图表上方的周期切换按钮：1m → 5m → daily
8. **GIF**: K-line 周期切换动画（`docs/demo/r26-scene02-kline.gif`，5 秒）

**验证点**:
- [ ] 股票列表显示代码、名称、最新价、涨跌幅
- [ ] 涨跌幅用红色（涨）/ 绿色（跌）显示
- [ ] K-line 图表有数据蜡烛
- [ ] 周期切换后图表重新渲染
- [ ] 无白屏或卡顿

**旁白建议**:
> 「行情页面支持搜索和 K-line 分析。搜索腾讯控股，可以看到港股实时行情。K-line 支持 1 分钟到日线多个周期切换。」

---

## 场景 3: Strategy 策略模板（1:40–2:30）

**目标**: 展示策略模板库和创建流程

**操作步骤**:
1. 点击侧边栏「策略」导航项
2. 等待 StrategyPage 加载
3. **截图**: 策略模板网格（`docs/demo/r26-scene03-strategy.png`）
4. 滚动浏览策略模板（MA Cross / RSI / MACD / Bollinger 等）
5. 点击「新建策略」按钮
6. 输入策略名称："R26 Demo Strategy"
7. 选择模板："MA Cross"
8. 设置参数：Short MA = 10, Long MA = 30
9. 点击「保存」
10. **截图**: 策略列表中出现新策略（`docs/demo/r26-scene03-new-strategy.png`）

**验证点**:
- [ ] 显示 15+ 策略模板卡片
- [ ] 新建策略表单可正常填写
- [ ] 保存后策略出现在列表中
- [ ] 策略参数可配置

**旁白建议**:
> 「策略页面提供 15 种以上量化策略模板，包括均线交叉、RSI、MACD 等。用户可以基于模板快速创建自己的策略，并自定义参数。」

---

## 场景 4: Backtest 回测执行（2:30–3:30）

**目标**: 展示回测流程和结果可视化

**操作步骤**:
1. 在 StrategyPage 点击刚才创建的 "R26 Demo Strategy"
2. 点击「回测」按钮
3. 设置回测参数：起始日期 = 2025-01-01, 结束日期 = 2025-12-31, 标的 = US.TQQQ
4. 点击「执行回测」
5. 等待回测完成（进度条动画）
6. **截图**: 回测结果面板（`docs/demo/r26-scene04-backtest.png`）
7. 滚动查看：收益率、夏普比率、最大回撤、交易次数
8. 点击「净值曲线」Tab
9. **GIF**: 净值曲线渲染动画（`docs/demo/r26-scene04-equity.gif`，5 秒）
10. 点击「参数扫描」Tab（如有）

**验证点**:
- [ ] 回测进度条正常推进
- [ ] 结果显示年化收益率、夏普比率、最大回撤
- [ ] 净值曲线有数据点
- [ ] 交易列表显示买入/卖出记录
- [ ] 无报错或崩溃

**旁白建议**:
> 「创建策略后可以直接回测。选择 TQQQ 作为标的，运行 2025 年全年回测。结果包括年化收益、夏普比率、最大回撤，以及详细的交易记录和净值曲线。」

---

## 场景 5: TradeDashboard 交易台（3:30–4:20）

**目标**: 展示 Paper/Real 模式、持仓、订单历史

**操作步骤**:
1. 点击侧边栏「交易台」导航项
2. 等待 TradeDashboardPage 加载
3. **截图**: TradeDashboard 完整界面（`docs/demo/r26-scene05-trade.png`）
4. 观察 Paper/Real 模式切换按钮（当前应为 Paper）
5. 查看持仓列表（如有）
6. 点击「订单历史」Tab
7. 滚动查看历史订单
8. 点击「每日盈亏」Tab
9. **截图**: 每日盈亏统计（`docs/demo/r26-scene05-pnl.png`）

**验证点**:
- [ ] Paper/Real 模式切换按钮可见
- [ ] 持仓列表显示代码、数量、成本、市值、盈亏
- [ ] 订单历史显示提交时间、状态、价格
- [ ] 每日盈亏图表/表格正确显示
- [ ] 数据来自真实 IPC（非 MOCK）

**旁白建议**:
> 「交易台支持 Paper 模拟模式和 Real 实盘模式切换。当前是 Paper 模式，可以看到持仓列表、订单历史和每日盈亏统计。」

---

## 场景 6: RiskDashboard 风控面板（4:20–5:10）

**目标**: 展示 7 项风控检查和紧急停止

**操作步骤**:
1. 点击侧边栏「风控面板」导航项
2. 等待 RiskDashboardPage 加载
3. **截图**: RiskDashboard 完整界面（`docs/demo/r26-scene06-risk.png`）
4. 鼠标依次悬停在以下卡片上，各停留 1 秒：
   - VaR (99%)
   - 最大回撤
   - 保证金使用率
   - 单票仓位上限
   - Kelly 建议仓位
5. 滚动到「紧急停止」按钮
6. **GIF**: 鼠标悬停紧急停止按钮，显示提示信息（`docs/demo/r26-scene06-emergency.gif`，3 秒）
7. **截图**: Kelly 仓位建议和仓位限制状态（`docs/demo/r26-scene06-kelly.png`）

**验证点**:
- [ ] 7 个风控指标卡片全部显示
- [ ] 指标值在合理范围内（无 N/A）
- [ ] 紧急停止按钮红色醒目
- [ ] Kelly 建议仓位有数值
- [ ] 仓位限制状态显示「正常」或「警告」

**旁白建议**:
> 「风控面板实时监控 7 项风险指标，包括 VaR、最大回撤、保证金使用率等。Kelly 公式给出最优仓位建议。紧急停止按钮可以在极端行情下一键暂停所有交易。」

---

## 场景 7: AlertCenter 告警中心（5:10–5:50）

**目标**: 展示告警列表和系统通知

**操作步骤**:
1. 点击侧边栏「告警中心」导航项
2. 等待 AlertCenterPage 加载
3. **截图**: AlertCenter 完整界面（`docs/demo/r26-scene07-alert.png`）
4. 观察告警列表中的级别标识（info / warning / critical）
5. 点击一条 warning 级别告警
6. 观察告警详情展开
7. 点击「确认」按钮
8. 观察告警状态变为「已确认」
9. **截图**: 告警详情和确认后状态（`docs/demo/r26-scene07-alert-detail.png`）

**验证点**:
- [ ] 告警列表显示时间、级别、内容、状态
- [ ] 级别用颜色区分（蓝/黄/红）
- [ ] 点击告警可展开详情
- [ ] 确认按钮可用，确认后状态更新
- [ ] 系统通知区域显示最近事件

**旁白建议**:
> 「告警中心汇总所有风险告警和系统通知。告警分为 info、warning、critical 三级，用户可以逐一确认处理。」

---

## 场景 8: Settings 配置页面（5:50–6:30）

**目标**: 展示券商配置、风控配置、系统信息

**操作步骤**:
1. 点击侧边栏「设置」导航项
2. 等待 SettingsPage 加载
3. **截图**: SettingsPage 完整界面（`docs/demo/r26-scene08-settings.png`）
4. 点击「Futu OpenD」配置卡片
5. 输入 IP: 127.0.0.1，Port: 11111
6. 点击「保存」
7. 观察「连接状态」变为绿色
8. 点击「Moomoo OpenD」配置卡片
9. 输入 IP: 127.0.0.1，Port: 11211
10. 点击「保存」
11. **截图**: 两券商配置均显示已保存（`docs/demo/r26-scene08-brokers.png`）
12. 滚动到页面底部，查看版本号 v0.6.0

**验证点**:
- [ ] Futu / Moomoo 配置卡片可见
- [ ] IP 和 Port 输入框可编辑
- [ ] 保存后连接状态更新
- [ ] 版本号显示 v0.6.0
- [ ] 风控配置 Tab 可切换

**旁白建议**:
> 「设置页面配置券商连接。支持 Futu OpenD 和 Moomoo OpenD，输入 IP 和端口后保存即可连接。版本号显示当前是 v0.6.0。」

---

## 场景 9: Sidebar 导航切换（6:30–7:10）

**目标**: 展示流畅的页面切换和多语言支持

**操作步骤**:
1. 依次点击侧边栏每个导航项：
   - Dashboard → Market → Strategy → Trade → Risk → Alert → Settings
2. 每个页面停留 2–3 秒
3. **GIF**: 导航切换全过程（`docs/demo/r26-scene09-nav.gif`，10 秒）
4. 点击语言切换器（右下角或顶部）
5. 切换为 English
6. 观察页面文字变为英文
7. **截图**: 英文界面（`docs/demo/r26-scene09-english.png`）
8. 切换回 简体中文

**验证点**:
- [ ] 所有导航项可点击
- [ ] 页面切换无白屏、无卡顿（< 500ms）
- [ ] 当前页面导航项高亮
- [ ] 语言切换后所有 UI 文字更新
- [ ] 支持语言 ≥7 种（中/英/日/韩/法/意/德）

**旁白建议**:
> 「侧边栏导航流畅切换，所有页面加载迅速。应用支持 7 种语言，包括中文、英文、日文、韩文、法文、意大利文和德文。」

---

## 场景 10: Installer 安装流程（7:10–7:50）

**目标**: 展示从 .exe 到启动的完整安装流程

**操作步骤**:
1. 在文件资源管理器中定位 `DAWN WHALES Setup 0.6.0.exe`
2. **截图**: .exe 文件图标显示正确（`docs/demo/r26-scene10-exe-icon.png`）
3. 双击 .exe
4. 等待 NSIS 安装向导出现（约 2 秒）
5. **截图**: 安装向导首页（`docs/demo/r26-scene10-installer-welcome.png`）
6. 点击「Next」→ 选择安装路径 → 点击「Install」
7. 等待安装完成（约 10–20 秒）
8. **GIF**: 安装进度条（`docs/demo/r26-scene10-install.gif`，10 秒）
9. 勾选「Launch DAWN WHALES」→ 点击「Finish」
10. 应用自动启动
11. **截图**: 启动后 Dashboard（`docs/demo/r26-scene10-launched.png`）
12. 检查桌面快捷方式图标
13. **截图**: 桌面快捷方式（`docs/demo/r26-scene10-shortcut.png`）

**验证点**:
- [ ] .exe 文件图标为 DW logo（非默认 NSIS 图标）
- [ ] 安装向导显示应用名称和版本
- [ ] 安装过程无报错
- [ ] 安装完成后可自动启动
- [ ] 桌面快捷方式图标正确
- [ ] 启动后 DevTools Console 无红色报错

**旁白建议**:
> 「DAWN WHALES 提供 Windows 安装包。双击安装向导，选择路径后一键安装。安装完成后自动启动，桌面生成快捷方式。」

---

## 场景 11: WebSocket 实时数据（7:50–8:30）

**目标**: 展示实时行情推送和连接状态

**操作步骤**:
1. 确保 Dashboard 页面已加载
2. 观察持仓列表中的价格字段
3. **GIF**: 价格数字随 tick 实时跳动（`docs/demo/r26-scene11-ws.gif`，10 秒）
4. 切换到 Market 页面
5. 观察股票列表价格刷新
6. 切换到 Risk 页面
7. 观察 unrealized PnL 数值变化
8. **截图**: Risk 页面 PnL 动态更新（`docs/demo/r26-scene11-risk-pnl.png`）
9. 断开 OpenD 连接（停止 OpenD 服务或修改配置为错误端口）
10. 观察连接状态变为红色/离线
11. **截图**: 连接断开状态（`docs/demo/r26-scene11-disconnected.png`）
12. 恢复 OpenD 连接
13. 观察连接状态恢复绿色

**验证点**:
- [ ] Dashboard 持仓价格随 tick 更新
- [ ] Market 页面价格实时刷新
- [ ] Risk 面板 PnL 动态变化
- [ ] 连接断开时显示降级状态（红色/警告）
- [ ] 恢复连接后自动重连

**旁白建议**:
> 「WebSocket 实时推送行情数据。持仓价格随市场 tick 实时更新。如果连接断开，应用会显示离线状态并自动尝试重连。」

---

## 场景 12: Paper Trading 模拟下单（8:30–9:30）

**目标**: 展示 Paper 模式下的完整下单流程

**操作步骤**:
1. 切换到 TradeDashboard 页面
2. 确认当前为 Paper 模式（按钮显示「Paper」）
3. 点击「下单」按钮（或输入框）
4. 选择标的：US.TQQQ
5. 选择方向：BUY
6. 输入数量：100
7. 选择订单类型：MARKET
8. 点击「提交订单」
9. **GIF**: 订单提交到状态更新（`docs/demo/r26-scene12-order.gif`，5 秒）
10. 观察订单状态从「submitted」→「filled」
11. 查看持仓列表，TQQQ 数量增加 100
12. **截图**: 持仓列表更新（`docs/demo/r26-scene12-positions.png`）
13. 查看订单历史，新增一条记录
14. **截图**: 订单历史（`docs/demo/r26-scene12-history.png`）
15. 切换到 Portfolio 页面
16. 查看资产分配变化
17. **截图**: 资产分配（`docs/demo/r26-scene12-allocation.png`）

**验证点**:
- [ ] Paper 模式按钮清晰可见
- [ ] 下单表单可正常填写
- [ ] 提交后订单状态更新（submitted → filled）
- [ ] 持仓列表自动更新
- [ ] 订单历史新增记录
- [ ] Portfolio 资产分配同步更新

**旁白建议**:
> 「Paper 模式用于策略验证。下单 BUY TQQQ 100 股，订单立即模拟成交。持仓列表、订单历史和资产分配实时更新，零风险验证交易策略。」

---

## 收尾（9:30–10:00）

**操作步骤**:
1. 返回 Dashboard 页面
2. **截图**: 最终 Dashboard（`docs/demo/r26-final-dashboard.png`）
3. 点击系统托盘图标
4. **截图**: 托盘菜单（`docs/demo/r26-tray-menu.png`）
5. 右键托盘 → 选择「Quit」
6. 应用正常关闭
7. **截图**: 桌面，应用已关闭（`docs/demo/r26-closed.png`）

---

## 文件清单

| 文件 | 类型 | 用途 |
|------|------|------|
| `r26-scene01-dashboard.png` | 截图 | Dashboard 总览 |
| `r26-scene01-equity.png` | 截图 | 净值曲线 |
| `r26-scene02-market.png` | 截图 | Market 页面 |
| `r26-scene02-kline.gif` | GIF | K-line 切换 |
| `r26-scene03-strategy.png` | 截图 | 策略模板 |
| `r26-scene03-new-strategy.png` | 截图 | 新建策略 |
| `r26-scene04-backtest.png` | 截图 | 回测结果 |
| `r26-scene04-equity.gif` | GIF | 回测净值曲线 |
| `r26-scene05-trade.png` | 截图 | 交易台 |
| `r26-scene05-pnl.png` | 截图 | 每日盈亏 |
| `r26-scene06-risk.png` | 截图 | 风控面板 |
| `r26-scene06-emergency.gif` | GIF | 紧急停止按钮 |
| `r26-scene06-kelly.png` | 截图 | Kelly 建议 |
| `r26-scene07-alert.png` | 截图 | 告警中心 |
| `r26-scene07-alert-detail.png` | 截图 | 告警详情 |
| `r26-scene08-settings.png` | 截图 | 设置页面 |
| `r26-scene08-brokers.png` | 截图 | 券商配置 |
| `r26-scene09-nav.gif` | GIF | 导航切换 |
| `r26-scene09-english.png` | 截图 | 英文界面 |
| `r26-scene10-exe-icon.png` | 截图 | .exe 图标 |
| `r26-scene10-installer-welcome.png` | 截图 | 安装向导 |
| `r26-scene10-install.gif` | GIF | 安装过程 |
| `r26-scene10-launched.png` | 截图 | 安装后启动 |
| `r26-scene10-shortcut.png` | 截图 | 桌面快捷方式 |
| `r26-scene11-ws.gif` | GIF | 实时价格跳动 |
| `r26-scene11-risk-pnl.png` | 截图 | Risk PnL 更新 |
| `r26-scene11-disconnected.png` | 截图 | 连接断开 |
| `r26-scene12-order.gif` | GIF | 下单流程 |
| `r26-scene12-positions.png` | 截图 | 持仓更新 |
| `r26-scene12-history.png` | 截图 | 订单历史 |
| `r26-scene12-allocation.png` | 截图 | 资产分配 |
| `r26-final-dashboard.png` | 截图 | 最终画面 |
| `r26-tray-menu.png` | 截图 | 托盘菜单 |
| `r26-closed.png` | 截图 | 应用关闭 |

**总计**: 22 张截图 + 7 个 GIF

---

## 录制完成后检查

- [ ] 所有截图清晰，文字可读
- [ ] 所有 GIF 流畅，无卡顿
- [ ] 文件名与脚本一致
- [ ] 所有文件存放于 `docs/demo/` 目录
- [ ] `sprint1-demo-r25.md` 录制状态追踪表已更新
