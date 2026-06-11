# QuantDesk Pro 项目打磨报告 (R104 验收后)

> 生成时间: 2026-06-12 04:08
> 基准提交: `63bde7a5` (R104 M-01 Credits Dashboard + P2P Transfer Records)
> 测试基线: 7,052 passed, 17 skipped, 0 fail, 80.46s

---

## 一、项目健康概览

| 指标 | 状态 | 数值 |
|------|------|------|
| TypeScript 编译 | 🟢 | 0 errors |
| 单元测试 | 🟢 | 7,052 pass / 0 fail |
| i18n 完整度 | 🟢 | 1,385 keys / 0 missing |
| 代码体积 (src/) | 🟡 | 2.95 MB |
| 构建产物 (dist/) | 🟡 | 5.86 MB (81 files) |
| Electron 主进程 | 🟡 | 5.94 MB (507 files) |
| 测试骨架文件 | 🔴 | ~300 个 0-test 占位文件 |
| 超大组件文件 | 🔴 | 15 个 >28KB |

---

## 二、严重问题 (P0)

### 1. 测试骨架文件泛滥 🔴

**问题**: `tests/` 目录下 370 个 `.test.ts` 文件中，约 **300+ 个是 0 tests 的骨架占位文件**。

**影响**:
- 误导 CI 报告（看起来测试很多，实际运行很少）
- 增加维护负担
- 掩盖真实覆盖率

**有实际测试的文件** (仅 ~40 个):
```
nl-parser.test.ts          91 tests
jvs-37-ipc-validation.test.ts     64 tests
q77-01-security-e2e.test.ts       15 tests
q80-01-growth-funnel-invite.test.ts  14 tests
q78-01-three-engine-tests.test.ts   17 tests
q73-01-realdata-draw-pattern.test.ts 16 tests
jvs-44-01-ai-report.test.ts       15 tests
jvs-44-02-data-export.test.ts     20 tests
jvs-44-03-pdf-report.test.ts      25 tests
backtest-enhancer.test.ts         31 tests
q76-02-content-safety-gdpr.test.ts  7 tests
q72-02-factor-compare-portfolio.test.ts  7 tests
q72-03-monitoring-regression.test.ts  7 tests
strategy-nl-e2e.test.ts           7 tests
integration-full-pipeline.test.ts 18 tests
q75-01-real-vs-mock-compare.test.ts  10 tests
... (其他 ~20 个文件)
```

**建议**:
1. **立即**: 删除所有 0-test 骨架文件，或重命名为 `.test.ts.skip`
2. **R105**: 为核心模块补充真实测试（优先 CreditsDashboard、P2PTransferRecords、SettlementTimeline、PointsTopUpPage）
3. **长期**: 建立 "测试骨架必须先有至少 1 个真实断言" 的代码审查规则

---

## 三、高优先级问题 (P1)

### 2. 遗留支付代码未清理 🔴

**文件**: `src/lib/payment.ts`

```typescript
// TODO: Configure API keys in .env for production use
// TODO: Replace with actual Stripe API call
// TODO: Replace with actual WeChat Pay API call
// TODO: Replace with actual license server API
```

**问题**: 项目已改为 **USDT-only 支付** (v1.5.0 规格锁定)，但 `src/lib/payment.ts` 仍保留 Stripe/微信支付/license server 的 TODO 占位代码。

**建议**:
- **R105**: 删除 `src/lib/payment.ts` 或将其标记为 `@deprecated`
- 所有法币支付逻辑已迁移到 `PointsTopUpPage.tsx` + `ExchangeRateEngine`
- 检查是否还有其他地方引用 `src/lib/payment.ts`

### 3. 超大组件文件 🔴

| 文件 | 大小 | 风险 |
|------|------|------|
| `StrategyPage.tsx` | 42.3 KB | 过长，难以维护 |
| `PerformanceMonitorPanel.tsx` | 40.2 KB | 过长 |
| `AutomationPanel.tsx` | 40.1 KB | 过长 |
| `MonteCarloPage.tsx` | 39.3 KB | 过长 |
| `PreferencesPage.tsx` | 38.9 KB | 过长 |
| `SentimentDashboardPage.tsx` | 37.9 KB | 过长 |
| `DataQualityPage.tsx` | 35.8 KB | 过长 |
| `TradingDeskPage.tsx` | 33.5 KB | 过长 |
| `DataExportPage.tsx` | 31.8 KB | 过长 |
| `SignalFeedAndCopyPanel.tsx` | 30.6 KB | 过长 |
| `StrategyMarketplace.tsx` | 30.0 KB | 过长 |
| `OnboardingFullKit.tsx` | 29.6 KB | 过长 |
| `LiveExecutionConsole.tsx` | 29.3 KB | 过长 |
| `MobileResponsive.tsx` | 28.8 KB | 过长 |
| `AgentCollaborationPanel.tsx` | 28.7 KB | 过长 |

**建议**:
- **R106+**: 将 >30KB 的文件拆分为子组件
- 优先级最高: `StrategyPage.tsx` (42KB) — 拆分为 `StrategyHeader` / `StrategyForm` / `StrategyList` / `StrategyDetail`

### 4. 测试覆盖率缺口 🔴

**R104 新增组件无测试**:
- `PointsTopUpPage.tsx` — 0 tests
- `TopUpConfirmModal.tsx` — 0 tests
- `SettlementTimeline.tsx` — 0 tests
- `CreditsDashboard.tsx` — 0 tests
- `P2PTransferRecords.tsx` — 0 tests

**关键引擎无测试**:
- `ExchangeRateEngine.ts` — 0 tests (网络依赖，需要 mock)
- `ReconciliationEngine.ts` (J-01, `d88b9826`) — 0 tests
- `USDTPointsManager.ts` (J-01, `0f2878f`) — 0 tests

**建议**:
- **R105 M-02**: 为 R103-R104 新增组件编写 React Testing Library 测试
- **R105 J-02**: 为 ExchangeRateEngine 编写 mock 测试（静态汇率 fallback、缓存过期、错误处理）
- **R105 J-03**: 为 ReconciliationEngine 编写单元测试（对账逻辑、误差容忍、批量处理）

---

## 四、中优先级问题 (P2)

### 5. 内存泄漏风险 🟡

**发现**:
```
ErrorBoundary.tsx:51         setInterval (timerRef 有 cleanup)
AgentCollaborationPanel.tsx   setTimeout/setInterval (timerRef 有 cleanup)
AIAssistantPanel.tsx:283      setTimeout (需要确认 cleanup)
MonteCarloPage.tsx:498        setTimeout (需要确认 cleanup)
StrategyCommunityPanel.tsx    setTimeout (需要确认 cleanup)
DesktopCleanupSheet.tsx       setInterval (intervalRef 有 cleanup)
```

**建议**:
- **R105**: 审查所有 `setTimeout`/`setInterval` 是否在 `useEffect` cleanup 中清除
- 特别关注 `AIAssistantPanel.tsx` 和 `MonteCarloPage.tsx` 中的匿名 setTimeout

### 6. dangerouslySetInnerHTML 使用 🟡

**发现** (3 处，全部有 DOMPurify 保护):
```
AIAssistantPanel.tsx:425      DOMPurify.sanitize(bolded)
PineScriptEditor.tsx:201      DOMPurify.sanitize(highlight(code))
HelpCenter.tsx:105            JSON-LD structured data (无害)
```

**评估**: 风险可控，DOMPurify 已正确使用。

**建议**:
- **保持现状**，但考虑将 `PineScriptEditor.tsx` 改用 PrismJS 或 Shiki 等安全语法高亮库

### 7. i18n 微调 🟡

**发现**:
- `billing-it.json` 有 1 处重复值
- 所有 11 个 locale 的 1,385 个 key 100% 覆盖

**建议**:
- **R105**: 修复 `billing-it.json` 的重复值
- 考虑添加 `pl` (波兰语) 和 `pt` (葡萄牙语) locale 以覆盖更多欧洲用户

### 8. 构建产物优化 🟡

**当前**:
- `dist/`: 5.86 MB (81 files)
- `electron/`: 5.94 MB (507 files)

**建议**:
- **R106**: 检查 tree-shaking 是否生效（`dist/` 中是否有未使用的库被打包）
- 检查 `electron/` 中是否有废弃的适配器文件（如 `opend-adapter.ts` 的多个版本）

---

## 五、低优先级打磨 (P3)

### 9. 代码风格一致性

**建议**:
- 统一 `useState` 初始化模式 (121 处使用 `useState(0)`/`useState('')`/`useState([])`)
- 统一错误处理模式（有些用 `throw`，有些用 `return { success: false }`）

### 10. 文档更新

**建议**:
- 更新 `CHANGELOG.md` 添加 R103-R104 变更记录
- 更新 `README.md` 的积分系统说明
- `docs/tasks/` 中的规划文档需要归档（如 `riskengine-v3-planning.md` 是 R28 的，已过时）

### 11. 依赖审计

**建议**:
- 运行 `npm audit` 检查安全漏洞
- 检查是否有未使用的依赖（如 `@stripe/stripe-js` 如果已废弃）

---

## 六、具体行动清单 (按 Round 分配)

### R105 (建议)
- [ ] **M-01**: 删除所有 0-test 骨架文件（或重命名为 `.skip`）
- [ ] **M-02**: 为 R103-R104 新增 5 个组件编写 RTL 测试
- [ ] **J-01**: 删除/标记废弃 `src/lib/payment.ts`
- [ ] **J-02**: 为 `ExchangeRateEngine.ts` 编写 mock 测试
- [ ] **J-03**: 为 `ReconciliationEngine.ts` 编写单元测试
- [ ] **Q-01**: 审查所有 `setTimeout`/`setInterval` 的 cleanup
- [ ] **D-01**: 修复 `billing-it.json` 重复值
- [ ] **D-02**: 更新 CHANGELOG.md 和 README.md

### R106 (建议)
- [ ] **M-01**: 拆分 `StrategyPage.tsx` (>30KB 文件拆分子组件)
- [ ] **J-01**: 为 `USDTPointsManager.ts` 编写测试
- [ ] **DevOps-01**: 构建产物 tree-shaking 优化
- [ ] **DevOps-02**: `npm audit` 安全漏洞修复

### R107+ (建议)
- [ ] 添加 `pl` 和 `pt` locale
- [ ] 引入代码覆盖率工具（c8/istanbul）并设定阈值（如 60%）
- [ ] 引入 Lighthouse CI 进行性能回归测试
- [ ] 引入 dependency-cruiser 进行架构依赖分析

---

## 七、亮点保持

| 方面 | 现状 | 评价 |
|------|------|------|
| TypeScript 严格度 | 0 errors | ⭐⭐⭐⭐⭐ 优秀 |
| i18n 完整度 | 100% (1,385 keys) | ⭐⭐⭐⭐⭐ 优秀 |
| 代码体积 | ~15 MB total | ⭐⭐⭐⭐ 合理 |
| 安全实践 | DOMPurify + 无 eval | ⭐⭐⭐⭐⭐ 优秀 |
| Git 工作流 | 清晰的分支和提交 | ⭐⭐⭐⭐⭐ 优秀 |

---

## 八、总结

**QuantDesk Pro R104 是一个功能完整、编译干净、i18n 完善的版本。**

主要技术债务:
1. **~300 个空测试文件** — 需要立即清理
2. **遗留支付代码** — 需要标记废弃
3. **R103-R104 新增组件无测试** — 需要补充
4. **15 个超大组件** — 需要逐步拆分

**建议优先级**: P0 (测试清理) > P1 (遗留代码+覆盖率) > P2 (内存+构建优化) > P3 (文档+风格)
