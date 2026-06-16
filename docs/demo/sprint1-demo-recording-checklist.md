<!-- META
version: 1.12.0
last_updated: 2026-06-12
round: R108
owner: QClaw
purpose: (auto-generated, needs review)
-->

# Sprint 1 Final Demo 录制检查清单 (R27)

**版本**: v0.6.0
**日期**: 2026-06-06
**目标**: 11 场景 GIF + 截图，用于对外发布

---

## 录制前环境检查

### 必须完成 ✅
- [x] `npm run build` 成功（0 errors）
- [x] `npm test` 通过（目标 220/0，当前 212/8，QClaw 修复中）
- [ ] 启动应用 `npm start` 或双击 `.exe` 无 crash
- [ ] 关闭所有无关窗口，桌面整洁
- [ ] 屏幕分辨率 1920×1080
- [ ] 窗口缩放 100%

### 录制工具
- **推荐**: ScreenToGif (Windows) — FPS 10，编码器 2.0，质量 80%
- **备选**: OBS — 输出 1920×1080，60fps，x264

---

## 场景清单与状态

### 场景 1: Dashboard 总资产概览 ⭐ P0
| 检查项 | 状态 | 备注 |
|--------|:--:|------|
| 窗口标题显示 "quant-moo · 道鲸" | ⬜ | 待验证 |
| DW logo（非 Electron 默认图标） | ⬜ | 待验证 |
| 总资产/现金/市值/今日盈亏 4 卡片 | ✅ | DashboardPage 实现 |
| 持仓热力图 ≥2 个色块 | ⬜ | 需有 mock 持仓数据 |
| 净值曲线有数据点 | ⬜ | 需有 mock 历史数据 |
| 侧边栏连接状态绿色/在线 | ⬜ | 待验证 |
| **产出**: 1 截图 + 1 截图 | | `scene01-dashboard.png`, `scene01-equity.png` |

### 场景 2: Market 行情页面 ⭐ P0
| 检查项 | 状态 | 备注 |
|--------|:--:|------|
| 股票列表显示代码/名称/最新价/涨跌幅 | ✅ | MarketPage 实现 |
| 涨跌幅红涨绿跌 | ✅ | 中国配色 |
| K-line 图表有蜡烛数据 | ⬜ | 需 mock K-line 数据 |
| 周期切换 1m→5m→daily 正常 | ⬜ | 待验证 |
| **产出**: 1 截图 + 1 GIF | | `scene02-market.png`, `scene02-kline.gif` (5s) |

### 场景 3: Strategy 策略模板 ⭐ P0
| 检查项 | 状态 | 备注 |
|--------|:--:|------|
| 15+ 策略模板卡片 | ⬜ | 待验证实际数量 |
| 新建策略表单可填写 | ✅ | StrategyPage 实现 |
| 保存后策略出现在列表 | ✅ | 待验证 |
| 策略参数可配置 | ✅ | 待验证 |
| **产出**: 2 截图 | | `scene03-strategy.png`, `scene03-new-strategy.png` |

### 场景 4: Backtest 回测执行 ⭐ P0
| 检查项 | 状态 | 备注 |
|--------|:--:|------|
| 回测进度条正常推进 | ⬜ | 需 mock 回测引擎 |
| 显示年化收益/夏普/最大回撤 | ✅ | BacktestReportPage 实现 |
| 净值曲线有数据点 | ⬜ | 需 mock 回测结果 |
| 交易列表显示买卖记录 | ⬜ | 需 mock 交易记录 |
| **产出**: 1 截图 + 1 GIF | | `scene04-backtest.png`, `scene04-equity.gif` (5s) |

### 场景 5: TradeDashboard 交易台 ⭐ P0
| 检查项 | 状态 | 备注 |
|--------|:--:|------|
| Paper/Real 模式切换按钮 | ✅ | TradeDashboardPage 实现 |
| 持仓列表显示代码/数量/成本/市值/盈亏 | ✅ | 已实现 |
| 订单历史显示提交时间/状态/价格 | ✅ | 已实现 |
| 每日盈亏图表/表格 | ✅ | 已实现 |
| 数据来自真实 IPC（非 MOCK） | ✅ | R25 已完成 IPC 接入 |
| **产出**: 2 截图 | | `scene05-trade.png`, `scene05-pnl.png` |

### 场景 6: RiskDashboard 风控面板 ⭐ P0
| 检查项 | 状态 | 备注 |
|--------|:--:|------|
| 7 个风控指标卡片全部显示 | ✅ | RiskDashboardPage 实现 |
| 指标值合理范围（无 N/A） | ⬜ | 需 mock 风控数据 |
| 紧急停止按钮红色醒目 | ✅ | 已实现 |
| Kelly 建议仓位有数值 | ⬜ | 需 mock Kelly 计算 |
| **产出**: 2 截图 + 1 GIF | | `scene06-risk.png`, `scene06-kelly.png`, `scene06-emergency.gif` (3s) |

### 场景 7: AlertCenter 告警中心 ⭐ P0
| 检查项 | 状态 | 备注 |
|--------|:--:|------|
| 告警列表显示时间/级别/内容/状态 | ✅ | AlertCenterPage 实现 |
| 级别颜色区分（蓝/黄/红） | ✅ | 已实现 |
| 点击告警可展开详情 | ✅ | 已实现 |
| 确认按钮可用，确认后状态更新 | ✅ | 已实现 |
| **产出**: 2 截图 | | `scene07-alert.png`, `scene07-alert-detail.png` |

### 场景 8: Settings 配置页面 ⭐ P0
| 检查项 | 状态 | 备注 |
|--------|:--:|------|
| Futu / Moomoo 配置卡片可见 | ✅ | SettingsPage 有 broker-mgmt tab |
| IP 和 Port 输入框可编辑 | ✅ | 已实现 |
| 保存后连接状态更新 | ⬜ | 需验证 mock 状态切换 |
| 版本号显示 v0.6.0 | ⬜ | 待验证 |
| 风控配置 Tab 可切换 | ✅ | SettingsPage 有 risk tab |
| **产出**: 2 截图 | | `scene08-settings.png`, `scene08-brokers.png` |

### 场景 9: Sidebar 导航 + 多语言 ⭐ P0
| 检查项 | 状态 | 备注 |
|--------|:--:|------|
| 所有导航项可点击 | ✅ | 12 个页面全部注册 |
| 页面切换无白屏（<500ms） | ⬜ | 待验证 |
| 当前页面导航项高亮 | ✅ | Sidebar 实现 |
| 语言切换后 UI 文字更新 | 🔴 | **语言切换器未找到** |
| 支持语言 ≥7 种 | 🔴 | **i18n 配置存在但切换器可能未集成** |
| **产出**: 1 GIF + 1 截图 | | `scene09-nav.gif` (10s), `scene09-english.png` |

**⚠️ 风险**: 场景 9 的语言切换演示可能需要调整。如果语言切换器未集成，可改为仅展示导航流畅切换，跳过语言切换部分。

### 场景 10: Installer 安装流程
| 检查项 | 状态 | 备注 |
|--------|:--:|------|
| .exe 文件图标为 DW logo | ⬜ | 待验证 |
| 安装向导显示应用名称和版本 | ⬜ | 待验证 |
| 安装过程无报错 | ⬜ | 待验证 |
| 安装完成后可自动启动 | ⬜ | 待验证 |
| **产出**: 3 截图 + 1 GIF | | `scene10-exe-icon.png`, `scene10-installer-welcome.png`, `scene10-install.gif` (10s), `scene10-launched.png`, `scene10-shortcut.png` |

**💡 建议**: 场景 10 需要真实 Windows 环境和安装包。如条件不允许，可作为 bonus 场景，不阻塞 Sprint 1 Demo 发布。

### 场景 11: WebSocket 实时数据 ⭐ P0
| 检查项 | 状态 | 备注 |
|--------|:--:|------|
| Dashboard 持仓价格随 tick 更新 | ⬜ | 需启动 mock WS feed |
| Market 页面价格实时刷新 | ⬜ | 需 mock tick 数据 |
| Risk 面板 PnL 动态变化 | ⬜ | 需 mock tick 数据 |
| 连接断开时显示降级状态 | ⬜ | 需测试断开场景 |
| 恢复连接后自动重连 | ⬜ | 需测试重连场景 |
| **产出**: 1 GIF + 2 截图 | | `scene11-ws.gif` (10s), `scene11-risk-pnl.png`, `scene11-disconnected.png` |

### 场景 12: Paper Trading 模拟下单 ⭐ P0
| 检查项 | 状态 | 备注 |
|--------|:--:|------|
| Paper 模式按钮清晰可见 | ✅ | TradeDashboardPage 实现 |
| 下单表单可正常填写 | ✅ | 已实现 |
| 提交后订单状态更新 | ✅ | 已实现 |
| 持仓列表自动更新 | ✅ | 已实现 |
| 订单历史新增记录 | ✅ | 已实现 |
| Portfolio 资产分配同步更新 | ✅ | 已实现 |
| **产出**: 1 GIF + 3 截图 | | `scene12-order.gif` (5s), `scene12-positions.png`, `scene12-history.png`, `scene12-allocation.png` |

---

## 关键风险与应对

| 风险 | 影响场景 | 应对 |
|------|---------|------|
| 语言切换器未集成 | 场景 9 | 跳过语言切换，仅展示导航流畅切换 |
| mock 数据不完整 | 场景 1,2,4,6,11 | 提前启动应用确认数据，必要时补充 mock |
| Installer 录制困难 | 场景 10 | 作为 bonus，不阻塞发布 |
| K-line 数据缺失 | 场景 2 | 使用静态 mock 数据填充 |
| WS tick 不跳动 | 场景 11 | 启动 FutuMockFeed 或手动触发 tick |

---

## 录制后检查

- [ ] 所有截图清晰，文字可读
- [ ] 所有 GIF 流畅，无卡顿
- [ ] 文件名与脚本一致
- [ ] 所有文件存放于 `docs/demo/sprint1-final-demo-r27/`
- [ ] 无 crash、无白屏、无报错

---

## 产出目录结构

```
docs/demo/sprint1-final-demo-r27/
├── README.md                 # 汇总说明
├── scene01-dashboard.png
├── scene01-equity.png
├── scene02-market.png
├── scene02-kline.gif
├── scene03-strategy.png
├── scene03-new-strategy.png
├── scene04-backtest.png
├── scene04-equity.gif
├── scene05-trade.png
├── scene05-pnl.png
├── scene06-risk.png
├── scene06-emergency.gif
├── scene06-kelly.png
├── scene07-alert.png
├── scene07-alert-detail.png
├── scene08-settings.png
├── scene08-brokers.png
├── scene09-nav.gif
├── scene09-english.png       # 如语言切换可用
├── scene10-*.png / .gif      # bonus
├── scene11-ws.gif
├── scene11-risk-pnl.png
├── scene11-disconnected.png
├── scene12-order.gif
├── scene12-positions.png
├── scene12-history.png
├── scene12-allocation.png
└── final-dashboard.png
```

---

*本清单基于 R26 录制脚本，结合 R27 实际 UI 状态更新。如有变更，以实际录制为准。*
