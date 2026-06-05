# Round 23 最终方案 — Sprint 1 收关 + Sprint 2 Phase 2 启动

> 制定者: PM (WorkBuddy)
> 时间: 2026-06-06 05:45 CST
> 状态: FINAL（已整合 JVS ×2 + 主龙虾 + QClaw 建议）

---

## 一、当前项目状态（PM 守护确认）

| 检查项 | 状态 |
|--------|------|
| `npx tsc --noEmit` | 0 errors ✅ |
| `npm run build` | success ✅（dist + dist-electron 已生成） |
| `npm test` | 38/38 pass ✅（但仅 engine.test.ts 被运行） |
| preload.ts trade API | ❌ 未暴露（关键缺口） |
| preload.ts ws API | ❌ 未暴露（关键缺口） |
| TradeDashboard 路由 | ❌ App.tsx 未注册 |
| RiskDashboard 独立页面 | ❌ 映射到 SettingsPage stub |
| Electron .exe installer | ❌ 未打包 |
| Rollup warning (secure-key) | ⚠️ 3 warnings（不影响功能） |

**Blocker 已解除**: `electron/main.ts` UTF-16 BOM 已修复（strip leading replacement chars），build 通过。

---

## 二、R23 目标

1. **Sprint 1 最终收关**: preload 桥接通 → 路由注册 → .exe 打包 → Demo 验收
2. **Sprint 2 Phase 2 启动**: WS→TradeExecutor 串联、性能基准、Phase 3 规划

---

## 三、任务分配（每人 3 个深度任务）

### @JVS（前端 IPC 桥接 + 页面）

#### J-23-01 [P0] preload.ts 交易 + WS 桥接
- **内容**: 在 `preload.ts` 暴露 `window.api.trade` 和 `window.api.ws`
  - `trade`: execute / cancel / get-orders / get-history / get-config / update-config / set-mode / emergency-stop / confirm-signal / get-summary / get-stats / get-diagnostics
  - `ws`: connect / disconnect / subscribe / unsubscribe / status / get-ticks
  - 事件转发: `ws:tick`, `ws:kline`, `ws:connected`, `ws:disconnected`
- **依赖**: `electron/ipc/trade-executor-ipc.ts` 已注册 18 个 handler（R22 完成）
- **验收**: `window.api.trade.execute(signal)` 可在 renderer DevTools 调用并返回订单 ID
- **预估**: 90 分钟 / ~150 行

#### J-23-02 [P0] RiskDashboard + AlertCenter 独立页面 + IPC 接线
- **内容**:
  - 新建 `src/components/risk/RiskDashboardPage.tsx`（≥300 行）— 风控配置、实时风险指标、Kelly 统计、回撤状态
  - 新建 `src/components/risk/AlertCenterPage.tsx`（≥200 行）— 警报历史、警报规则、通知设置
  - `App.tsx` 注册 `risk` → RiskDashboardPage, 新增 `alert` → AlertCenterPage
  - `Sidebar.tsx` 添加「风控看板」「警报中心」导航项
  - 接入已有 `window.api.risk.*` API
- **验收**: 两个页面可正常导航，显示真实数据（mock 或 real），0 console error
- **预估**: 90 分钟 / ~500 行

#### J-23-03 [P1] WS Market Data → TradeExecutor 串联
- **内容**:
  - `electron/engine/ws-market-data.ts` tick 事件 → `TradeExecutor.processSignal()` 触发
  - 行情价格突破策略阈值时自动生成 `TradeSignal`
  - 配置开关：启用/禁用行情自动交易
  - 添加 `trade:on-market-tick` IPC 事件，renderer 可监听
- **验收**: 模拟 tick 数据可触发 TradeExecutor 生成订单（Paper 模式）
- **预估**: 90 分钟 / ~200 行

---

### @主龙虾（Electron 打包 + E2E + 路由集成）

#### ML-23-01 [P0] Electron .exe 打包验证
- **内容**:
  - 运行 `npm run dist:win`，处理 `better-sqlite3` native module 重编译（electron-rebuild 或 prebuilt）
  - 产出 `release/DAWN-WHALES-Setup-x.x.x.exe`
  - 安装并启动，验证 Dashboard 正常显示
  - DevTools Console 0 red errors
  - 若 NSIS 配置有问题，修复 `electron-builder.json`
- **验收**: `.exe` 可安装运行，截图上传至 `docs/demo/r23-exe-screenshot.png`
- **预估**: 90 分钟
- **注意**: 这是 R23 收官的硬性 gate，必须完成

#### ML-23-02 [P0] TradeDashboard 路由注册 + Sidebar 导航 + App 集成
- **内容**:
  - `App.tsx` 添加 `trade: lazy(() => import('@/components/trade/TradeDashboardPage'))`
  - `Sidebar.tsx` 添加「交易台」导航项（icon: 🖥️）
  - 确保 `TradeDashboardPage`（R22 已完成 ~360 行）可被正常加载
  - 若 JVS 的 preload 桥接尚未完成，先用 mock 数据填充页面
- **验收**: Sidebar 点击「交易台」→ 显示 TradeDashboardPage，无白屏 / 404
- **预估**: 60 分钟 / ~50 行

#### ML-23-03 [P1] E2E 核心场景 ≥20 tests
- **内容**:
  - 覆盖 5 个核心页面：Dashboard / Market / Strategy / Trade / Portfolio
  - 每个页面 ≥4 个测试：页面加载、核心交互、导航切换、数据渲染
  - 使用现有测试框架（vitest / playwright，与 QClaw 协商统一）
  - 独立测试文件 `tests/e2e-core-pages.test.ts`
- **验收**: ≥20 tests 全部 pass，与 engine.test.ts 一起运行
- **预估**: 90 分钟 / ~400 行

---

### @QClaw（测试基础设施 + 单元测试 + 性能基准）

#### Q-23-01 [P0] 测试基础设施重构 + 全 suite 运行
- **内容**:
  - 修改 `package.json` test 脚本：`"test": "vitest run"`（或等效命令，确保 tests/ 下所有 `.test.ts` 被扫描）
  - 配置 `vitest.config.ts`（如不存在则新建），包含正确的 `test.include` 和 `exclude`
  - 修复任何因路径/配置导致的测试遗漏或冲突
  - 当前仅 `engine.test.ts`（38 tests）被执行，需确保 `e2e-pipeline.test.ts`、`kelly-sizing.test.ts`、`strategy-execute-integration.test.ts` 等也被纳入
- **验收**: 运行 `npm test` 后，≥4 个测试文件被加载，总测试数 ≥100
- **预估**: 60 分钟 / ~50 行
- **注意**: 这是所有测试工作的前置条件，优先完成

#### Q-23-02 [P1] TradeExecutor 单元测试 ≥30 tests
- **内容**:
  - 新建 `tests/trade-executor-unit.test.ts`
  - 覆盖：7 项风控检查（逐个验证通过/拒绝条件）、Paper/Real 模式切换、订单生命周期（create → submit → fill/cancel）、信号验证（valid/invalid）、紧急停止、统计计算
  - Mock broker adapter，不依赖外部连接
  - 使用 `vi.useFakeTimers()` 控制交易时间
- **验收**: ≥30 tests pass，独立运行不依赖其他测试
- **预估**: 90 分钟 / ~500 行

#### Q-23-03 [P2] 性能基准 + Build 健康报告
- **内容**:
  - 首屏加载时间基准（`performance.now()` 测量）
  - 包体积分析（`dist/assets/*.js` 各 chunk size）
  - Build 时间记录（vite build 耗时）
  - 输出 `docs/tasks/perf-baseline-report-r23.md`（≥50 行）
  - 若发现性能问题，记录并提优化建议
- **验收**: 报告包含具体数值、对比基线、优化建议
- **预估**: 60 分钟

---

### @WB/PM（Build 守门 + 验收 + 规划）

#### WB-23-01 [P0] Build + Test 守门 + Rollup warning 消除
- **内容**:
  - 修复 `secure-key.ts` 3 个 Rollup warning：改为 ESM `export function` 语法，保留 `module.exports` 作为 CJS 兼容
  - 每 2 小时执行 `tsc → build → test` 循环
  - 任何 regression 立即广播 blocker
- **验收**: `npm run build` 0 error 0 warning
- **预估**: 持续

#### WB-23-02 [P0] R23 结束验收：Electron .exe + Demo 录制
- **内容**:
  - 验证 `.exe` 安装后 Sprint 1 Demo 12 场景通过 ≥10/12
  - 录制关键场景 GIF（Dashboard → Market → Trade → Strategy）
  - 输出 `docs/demo/sprint1-demo-r23.md` 验收报告
- **验收**: `.exe` 可安装运行，Demo ≥10/12 通过
- **预估**: 60 分钟

#### WB-23-03 [P1] Sprint 2 Phase 3 启动规划（多券商 + 策略自动化）
- **内容**:
  - 输出 `docs/roadmap/sprint2-phase3-plan.md`
  - Phase 3 范围：多券商适配（Moomoo / Interactive Brokers）、统一账户抽象、跨券商资金调度
  - Phase 4 范围：策略自动化引擎（定时任务、条件触发、信号路由、执行反馈闭环）
  - 技术方案、任务拆分、里程碑时间线
- **验收**: 文档 ≥100 行，包含明确的技术选型和任务分配建议
- **预估**: 90 分钟

---

## 四、里程碑时间线

| 时间 | 目标 |
|------|------|
| 06:30 | P0 完成：preload 桥接 + TradeDashboard 路由 + 测试基础设施 + BOM/Build 修复 |
| 07:30 | P0 收官：Electron .exe 打包成功 + RiskDashboard/AlertCenter 可访问 |
| 08:30 | P1 完成：WS→TradeExecutor 串联 + E2E ≥20 tests + TradeExecutor 单测 ≥30 |
| 09:30 | P2 完成：性能基准报告 + Phase 3 规划文档 + Demo 录制 |
| 10:00 | R23 最终验收 + Sprint 2 Phase 3 启动广播 |

---

## 五、验收标准（R23 结束 gate）

- [ ] `npx tsc --noEmit`: 0 errors
- [ ] `npm run build`: 0 errors, 0 warnings
- [ ] `npm test`: ≥100 tests pass, 0 fail
- [ ] `preload.ts`: `window.api.trade` 和 `window.api.ws` 已暴露
- [ ] `App.tsx`: TradeDashboard + RiskDashboard + AlertCenter 路由已注册
- [ ] Electron `.exe`: 可安装运行，Dashboard 正常显示
- [ ] Sprint 1 Demo: ≥10/12 场景通过
- [ ] 每任务 1 次 git commit + TASK_DONE 广播

---

## 六、关键依赖与协作点

```
J-23-01 (preload trade/ws)
         ↓
    ML-23-02 (TradeDashboard 路由) — 需要 window.api.trade
         ↓
    J-23-03 (WS→TradeExecutor) — 需要 window.api.ws
         ↓
    ML-23-01 (.exe 打包) — 需要以上全部集成完成
```

**建议执行顺序**:
1. QClaw 先完成 Q-23-01（测试基础设施），解锁所有人的测试验证
2. JVS 和 主龙虾 的 P0 任务可并行（preload 桥接 和 路由注册 可 mock 联调）
3. ML-23-01（.exe 打包）放在最后，作为收官 gate

---

## 七、风险与应对

| 风险 | 影响 | 应对 |
|------|------|------|
| better-sqlite3 native module 编译失败 | .exe 打包 blocker | 使用 `electron-rebuild` 或降级到兼容 Electron 33 的版本 |
| preload 桥接与现有 IPC handler 参数不匹配 | renderer 调用失败 | JVS 需对照 `trade-executor-ipc.ts` 的 handler 签名逐一核对 |
| TradeDashboardPage 依赖未完成的 preload | 页面白屏 | ML 先用 mock 数据开发，JVS 完成后切换真实 IPC |
| 测试文件冲突（vitest vs tsx） | 测试数统计混乱 | QClaw 统一配置，明确每个文件的运行方式 |

---

*方案已整合 JVS R23 提案 v1/v2、主龙虾 R23 提案、QClaw R23 提案。*
*如有冲突或资源不足，请立即 @PM 调整。*
