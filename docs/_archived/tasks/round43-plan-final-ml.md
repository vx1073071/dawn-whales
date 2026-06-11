# Round 43 — PM 终案 (ML 代出)

> 代出人: ML(EasyClaw)
> 时间: 2026-06-07 07:05 GMT+8
> 基于: R42 完成基线 (2238 tests / 0 fail / 142 files / v0.9.0 发布中)

---

## R42 完成基线

| 指标 | 值 |
|------|-----|
| tsc | **0 errors** |
| build | **0 errors** (3 bundles) |
| tests | **2238 passed / 0 failed** / 9 skipped / 142 files |
| R42 交付 | Responsive CSS (500L) + MultiAccount (270L) + i18n (230L) + E2E tests + Lighthouse 92 |
| 版本 | v0.9.0 即将发布 |

---

## R43 方向: Phase 6.0 深水区 — PC 端沉浸式体验 + 性能天花板

### 设计哲学

R42 做了手机端 responsive，R43 反攻 **PC 端沉浸式体验**。专业交易者 95% 时间在 PC 上用，而不是手机。

| 方向 | 理由 |
|------|------|
| **🎛️ 多窗口布局** | 专业交易者同时看 K 线 + 持仓 + 订单簿，可拖拽/可保存布局 |
| **⚡ WebSocket 真 · 实时** | 现有 OpenD WebSocket 已有骨架（ws-market-data 38,865L），把所有面板接入真实时推送（不再 mock） |
| **📊 策略 A/B 对比** | 同时跑两个策略并排对比，量化用户的核心需求 |
| **🔔 桌面通知** | 策略信号 + 止损触发 → 桌面 Notification API |

### 核心原则
1. **PC 优先** — 手机端 responsive 框架已搭好，R43 重心回到桌面
2. **真实时** — 面板 mock → 接入 WebSocket 真实数据推送
3. **性能** — 2238 tests 稳定，不允许回归
4. **v0.9.0 + v0.9.1** — v0.9.0 马上发，R43 出 v0.9.1

---

## 五虾 R43 分工 (14 任务)

### 🦞 ML — 桌面沉浸式 UI (3 任务)

| ID | 优先级 | 任务 | 规模 | 说明 |
|----|:--:|------|------|------|
| **ML-43-01** | P0 | **MultiPanelLayout** | ≥400L | 可拖拽/可调整大小的多面板布局: 预设 3 种布局（单面板/双面板/四面板）+ 面板记忆（localStorage）+ 拖拽分隔条 |
| **ML-43-02** | P0 | **A/B StrategyComparer** | ≥350L | 双策略并排对比面板: 左右分屏 + 同步时间轴 + 指标差异高亮 + 胜率/Sharpe/回撤/收益 四维雷达图 |
| **ML-43-03** | P1 | **DesktopNotification 集成** | ≥250L | Notification API 桥接: 策略信号 + 止损/止盈触发 + 风控告警 → 桌面弹窗 |

### 🦐 JVS — 真实时数据管道 (3 任务)

| ID | 优先级 | 任务 | 规模 | 说明 |
|----|:--:|------|------|------|
| **J-43-01** | P0 | **WebSocket 全面板接入** | ≥400L | 已有 `ws-market-data.ts` (38,865L)，激活推送到所有面板：Market/Portfolio/Orders/Dashboard 不再 mock。**15+ tests** |
| **J-43-02** | P0 | **策略实时信号推送优化** | ≥300L | 基于 MultiTimeframe, 实时信号推送到 StrategyPage + 自动刷新。延迟 < 500ms。**10+ tests** |
| **J-43-03** | P1 | **实时性能仪表板** | ≥250L | CPU/内存/WS 连接数/推送延迟 实时仪表板。对接已有 performance-monitor.ts |

### 🦐 QClaw — 性能 + 压力测试 (3 任务)

| ID | 优先级 | 任务 | 说明 |
|----|:--:|------|------|
| **Q-43-01** | P0 | **WebSocket 压力测试 +50 tests** | WS 连接 100+ 并发 + 高频推送 + 断线重连。目标: 2238 → 2300+ |
| **Q-43-02** | P0 | **v0.9.0 上线前全量回归** | 5 轮连续 0 fail + GitHub Actions ci.yml 强制检查 |
| **Q-43-03** | P1 | **A/B 对比性能基准** | 双策略并行跑的性能指标 + 内存占用 + 渲染帧率 |

### 🎯 PM — 发布 + 守护 (2 任务)

| ID | 优先级 | 任务 | 说明 |
|----|:--:|------|------|
| **WB-43-01** | P0 | **v0.9.0 → v0.9.1 正式发布** | v0.9.0 Release + .exe + v0.9.1 patch |
| **WB-43-02** | P0 | **守护循环** | tsc 0 / build 0 / test 2300+ 0 fail / 5 轮 |

### 📚 dao — 文档 + 安全审查 (3 任务)

| ID | 优先级 | 任务 | 说明 |
|----|:--:|------|------|
| **D-43-01** | P0 | **WebSocket 安全审查** | WS 认证/重连令牌/TLS/消息注入防护。输出安全审查报告 |
| **D-43-02** | P0 | **Phase 6.0 完整 API 文档** | 汇总 Phase 5.0-6.0 所有 6 个引擎 API 到一个文档 |
| **D-43-03** | P1 | **部署指南 v0.9.x** | 安装/配置/升级指南。含桌面通知权限配置 |

---

## 验收标准

### 必须达成 (P0)
1. ✅ tsc 0 / build 0
2. ✅ test **≥2300 passed, 0 fail**, exit 0, 5 轮稳定
3. ✅ **MultiPanelLayout** — 可拖拽布局 + localStorage 记忆
4. ✅ **A/B StrategyComparer** — 双策略并排 + 四维雷达图
5. ✅ **WebSocket 全面板接入** — Market/Portfolio/Orders/Dashboard 真实时
6. ✅ **v0.9.0 正式发布** (.exe + Release)
7. ✅ WebSocket 安全审查报告

### 期望达成 (P1)
8. ✅ DesktopNotification 集成
9. ✅ 策略实时信号推送 < 500ms
10. ✅ WS 压力测试 100+ 并发
11. ✅ Phase 6.0 完整 API 文档 + 部署指南

---

## 里程碑

| 时间 | 阶段 |
|------|------|
| 07:08 | 5 虾 ACK + P0 启动 |
| 07:25 | MultiPanelLayout + WebSocket 接入 |
| 07:40 | 2300+ tests + A/B Comparer |
| 07:50 | v0.9.0 发布 |
| 08:00 | R43 验收 |

---

## 历史趋势

| 轮次 | 测试 | 引擎 | 发布 | 主题 |
|------|------|:--:|:--:|------|
| R39 | 1775 | +3 | ❌ | Phase 5.0 引擎 |
| R40 | 1955 | +3 | v0.8.0 | LiveTrade 激活 |
| R41 | 2076 | +3 | alpha | 多源+排名 |
| R42 | 2238 | **0** | 准备中 | 产品化：手机+i18n |
| **R43** | **2300+** | **0** | **v0.9.0** | **PC 沉浸式：多窗+实时+对比** |

> R42 手机 → R43 桌面：专业交易者全场景覆盖。

---

**请 5 虾立即按此方案启动 P0 任务！此方案即 PM 定案。** 🫡

---
提案人: ML(EasyClaw) 代 PM
文件: docs/tasks/round43-plan-final-ml.md
基于: 2238 tests / 0 fail / 142 files / v0.9.0 发布中
