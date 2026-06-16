# 🦞 R230 基线审计报告

> **轮次**: R230 | **版本**: v2.6.0 QUANTUM 启动 | **日期**: 2026-06-16 07:55
> **PM**: Claw | **审计范围**: TSC / 依赖安全 / Build / 代码规模 / i18n质量

---

## 一、TSC 类型检查

### 总览

| 指标 | 数值 |
|------|:---:|
| **总错误数** | **734** |
| src/ | 692 (94.3%) |
| electron/ | 0 (0%) |
| server/ | 0 (0%) |
| 其他(头信息) | 42 (5.7%) |

### src/ 分区

| 区域 | 错误数 | 占比 | 严重度 |
|------|:---:|:---:|:---:|
| **src/components/** | 571 | 82.5% | 🔴 主战场 |
| **src/lib/** | 116 | 16.8% | 🔴 第二战场 |
| src/pages/ | 5 | 0.7% | 🟢 低 |
| src/hooks/ | 0 | 0% | ✅ |
| src/services/ | 0 | 0% | ✅ |
| src/store/ | 0 | 0% | ✅ |

### 错误类型Top 10

| Rank | TS Code | 说明 | 数量 | 修复难度 | 策略 |
|:---:|:---:|------|:---:|:---:|------|
| 1 | **6133** | 未使用的变量/导入 | 311 | 🟢低 | 删除/加`_`前缀 |
| 2 | **18046** | `'s' is of type 'unknown'` | 117 | 🟡中 | 加类型断言 |
| 3 | 2322 | 类型不匹配 | 53 | 🟡中 | 修正类型 |
| 4 | 2339 | 属性不存在 | 39 | 🟡中 | 补充接口 |
| 5 | 2304 | 找不到名称 | 28 | 🔴高 | 需要导入/修复引用 |
| 6 | 2353 | 多余属性 | 26 | 🟡中 | 移除/扩展接口 |
| 7 | 2459 | 模块本地声明冲突 | 11 | 🟡中 | 合并声明 |
| 8 | 2578 | 未类型化的模块 | 10 | 🟢低 | 加类型声明 |
| 9 | 2305 | 模块无导出成员 | 10 | 🔴高 | 修正导入路径 |
| 10 | 2740 | 类型缺少属性 | 10 | 🟡中 | 补充属性 |
| | 其他(<10) | 22种 | 97 | 混合 | |

### 文件Top 15 (按错误数)

| Rank | 文件 | 错误数 | 域 |
|:---:|------|:---:|------|
| 1 | `src/lib/chart/pattern-detectors.ts` | 44 | chart |
| 2 | `src/components/market/RealTimeMarketDashboard.tsx` | 39 | market |
| 3 | `src/lib/chart/market-monitor.ts` | 36 | chart |
| 4 | `src/components/live/LiveMonitorPage.tsx` | 30 | live |
| 5 | `src/components/common/MetricHumanizer.tsx` | 24 | common |
| 6 | `src/components/tools/DataQualityPage.tsx` | 24 | tools |
| 7 | `src/components/wallet/MarketplaceHub.tsx` | 18 | wallet |
| 8 | `src/components/wallet/WalletFullPage.tsx` | 17 | wallet |
| 9 | `src/components/orders/TradingDeskPage.tsx` | 16 | orders |
| 10 | `src/components/dashboard/DashboardPage.tsx` | 15 | dashboard |
| 11 | `src/components/market/MarketPage.tsx` | 15 | market |
| 12 | `src/components/broker/CopyTradeStatusBar.tsx` | 15 | broker |
| 13 | `src/lib/chart/pattern-recognition.ts` | 15 | chart |
| 14 | `src/components/wallet/WalletPage.tsx` | 15 | wallet |
| 15 | `src/components/strategy/StrategyPage.tsx` | 13 | strategy |

> **洞察**: Top 15文件占 692个错误中的 ~350个 (50.6%)。集中修复这15个文件即可砍半。

---

## 二、依赖安全审计 (npm audit)

| 级别 | 数量 |
|------|:---:|
| 🔴 Critical | 0 |
| 🔴 High | **34** |
| 🟡 Moderate | 17 |
| 🟢 Low | 1 |
| **合计** | **52** |

### 高危根依赖

| 包 | 受影响范围 | 说明 |
|---|------|------|
| `form-data` | 4.0.0-4.0.5 | CRLF注入 (GHSA-hmw2-7cc7-3qxx) |
| `vite` | 多处传递 | 多个子依赖传递漏洞 |
| `vitest` | 传递依赖 | 通过@vitest/coverage-v8 |
| `vite-node` | 1.0.0-5.3.0 | 传递依赖 |

### 建议

- `npm audit fix` 可自动修复部分(非breaking)
- `form-data` 需手动升级到≥4.0.6
- 测试工具链(vitest/vite-node)漏洞不影响生产
- 强烈建议 v2.6.0 发布前清理所有 high

---

## 三、Build 状态

| 指标 | 状态 | 详情 |
|------|:---:|------|
| **Vite build** | ✅ PASS | 584ms, dist-electron/ + dist/ 产出完整 |
| **TSC noEmit** | ❌ FAIL | 734 errors (全在 src/) |
| **electron/ TSC** | ✅ CLEAN | 0 errors |
| **server/ TSC** | ✅ CLEAN | 0 errors |

---

## 四、代码规模

| 指标 | 数值 |
|------|------|
| TS/TSX 文件 | ~1,986 |
| 总代码行 | ~210万 |
| 因子 (registry) | 240 (FACTOR_SPEC) |
| 策略模板 | ~124 (含冗余) |
| 语言 | 11 (de/en/es/fr/it/ja/ko/ru/zh-CN/zh-HK/zh-TW) |
| 券商适配器 | 13 (9就绪 + 4 OAuth待授权) |
| i18n主文件 (zh-CN) | ~7,000条近似key |

---

## 五、i18n 质量发现

| 问题 | 详情 |
|------|------|
| 🔴 重复key | `helpCenter` vs `HelpCenter` 在多个语言文件中重复 |
| 🔴 重复key | `AiReportGenerator` vs `aiReportGenerator` 在 it/fr/ru 中重复 |
| 🟡 映射命名不一致 | 部分key使用PascalCase，部分使用camelCase |

---

## 六、R230 目标 vs 基线

| 指标 | R230前(基线) | R230目标 | 差距 |
|------|:---:|:---:|:---:|
| TSC errors | 734 | ≤550 | **需清184** |
| TSC src/components | 571 | 约541 | 清30(ML#1) |
| TSC src/lib | 116 | 约116 | 暂不处理 |
| TSC electron/ | 0 | 0 | ✅ |
| TSC server/ | 0 | 0 | ✅ |
| npm audit high | 34 | 本R230不处理 | — |
| Build | ✅ | ✅ | ✅ |
| 沙盒隔离 | 无 | Worker框架 | 新建 |
| 数据源可靠性 | 单源 | 3源fallback | 新建 |
| 响应式 | 无 | 3档断点 | 新建 |
| 新手引导 | 旧 | 5步重设计 | 重新设计 |

---

## 七、审计结论

**🟡 基线状态: 可接受**

- electron/ 和 server/ 双区TSC为0，证明之前轮次的清理有效
- 692个src/错误集中在components(571)和lib(116)，修复路径清晰
- 前15个文件占50%错误，集中打击效率最高
- Build成功，应用可运行
- npm audit 52漏洞需关注但不阻塞R230

**R230 PM建议:**
1. ML优先修Top 15中的components文件 (如RealTimeMarketDashboard, LiveMonitorPage, MetricHumanizer)
2. JVS的engine/server已是0，可全力投入沙盒架构设计
3. autoclaw先做数据源可靠性再做shared区TSC
4. youdao的安全渗透测试无需TSC通过

---

*审计完成: 2026-06-16 07:55 | 🦞 Claw (PM)*
