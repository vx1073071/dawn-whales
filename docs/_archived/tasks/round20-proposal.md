# Round 20 提案 — Sprint 1 Demo Ready + Build Verification

**提案人:** QClaw
**时间:** 2026-06-06 02:18 GMT+8
**依据:** Round 19 执行后现状摸底结果

---

## 现状总览

| 指标 | 状态 | 备注 |
|------|------|------|
| TSC 编译 | ✅ 0 errors | clean |
| 单元测试 | ✅ 576/576 pass | 8 skipped（t105 等环境相关）|
| `npm run build` | ✅ success | 仅 CSS 警告，无错误 |
| `npm run start` | ❓ 未验证 | Electron 启动待测 |
| IPC Full-Link | ❓ 未验证 | 页面→IPC 链路待冒烟测试 |
| Sprint 1 Demo | ❌ 未验证 | 目标：Dashboard/Market/Portfolio 可演示 |

---

## Round 20 目标

**"Sprint 1 Demo Ready"** — 让 quant-moo v0.7.0 在 Electron 中真正跑起来，展示真实数据。

---

## 任务分工

### 🔵 QClaw — P0 任务

**Q-20-01: Electron 启动验证**
- 运行 `npm run start`，确认 Electron 窗口启动
- 验证 main.ts 模块加载无崩溃
- 验证 OpenD 连接状态正常（FutuOpenD 已运行）

**Q-20-02: IPC Full-Link 冒烟测试**
- DashboardPage → `getDashboardSummary/Positions/Pnl/Health` 真实调用
- MarketPage → 行情数据 IPC 调用
- PortfolioPage → `getPortfolioAllocation/Performance/RiskMetrics` 真实调用
- 验证数据流：IPC Handler → preload bridge → React 组件

**Q-20-03: Sprint 1 Demo 场景验证**
按 `docs/tasks/round18-demo-script.md` 12 场景逐一验证：
1. Dashboard 行情展示 ✅
2. Portfolio 持仓展示 ✅
3. MarketPage 实时行情 ✅
4. AlertCenter 告警 ✅
5. RiskDashboard 风险指标 ✅
6. StrategyPage 策略列表 ✅
7. Walk-Forward 分析 ✅
8. Engine Benchmark ✅
9. PaperTrader 下单模拟 ✅
10. Settings 配置 ✅
11. Preferences 个性化 ✅
12. DataExport 数据导出 ✅

### 🟢 JVS — P0 任务

**J-20-01: CSS 警告修复**
- 4 个 `Unexpected "#111119\\]" [css-syntax-error]` 警告
- 源文件定位（CSS 变量定义处）
- 验证修复后 build 仍然成功

**J-20-02: Sprint 2 技术规划**
- Multi-Broker 架构设计（IBrokerAdapter 接口扩展）
- USDT 支付通道方案
- 移动端适配方案
- 输出：`docs/architecture/sprint2-plan.md`

### 🟡 WorkBuddy — PM 协调

**W-20-01: Round 19 Retro**
- 汇总 R19 完成情况
- 更新项目进度面板

**W-20-02: Sprint 1 Demo 日期确认**
- 与用户确认 Demo 日期
- 确定需要优先展示的 3-5 个核心功能

### 🟠 主龙虾 — 架构审核

**L-20-01: main.ts 模块化 review**
- 确认 22 个模块拆分正确
- 确认 IPC 路由无遗漏

**L-20-02: 安全审查**
- API Key 暴露检查
- OpenD 交易密码保护审查

---

## 验收标准

```
✅ npm run start → Electron 窗口启动，无崩溃
✅ Dashboard/Market/Portfolio 页面有真实数据（非 mock）
✅ Sprint 1 Demo 12 场景全部可运行
✅ npm run build → success（CSS 警告已修复或可接受）
✅ 576 tests still pass（无回归）
```

---

## 时间估算

| Agent | 任务 | 预计时间 |
|-------|------|---------|
| QClaw | Q-20-01~03 | 60-90 min |
| JVS | J-20-01~02 | 45-60 min |
| WorkBuddy | W-20-01~02 | 15 min |
| 主龙虾 | L-20-01~02 | 30 min |
| **总计** | | **2-3 小时** |

---

## 下一步

等待 PM WorkBuddy 确认分工后立即开始。