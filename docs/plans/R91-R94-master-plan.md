# R91-R94 四轮总规划 — v1.10.0 收官路线

> **版本**: 草稿 v1.0 (PM 拟制, 待 Owner 审查)
> **日期**: 2026-06-11
> **目标版本**: v1.10.0
> **铁律**: 禁止撒谎 / 禁止偷懒 / 任务没做完不准停

---

## 📊 基线 vs 目标

| 指标 | R89实际 | R90预期 | R91目标 | R92目标 | R93目标 | R94验收 |
|------|---------|---------|---------|---------|---------|---------|
| TSC errors | 0 ✅ | 0 | 0 | 0 | 0 | **0** |
| Build errors | 0 ✅ | 0 | 0 | 0 | 0 | **0** |
| i18n 硬编码中文 | 32,975 | <18,000 | <8,000 | <3,000 | <2,000 | **<1,000** |
| EngineError 覆盖 | 12.9% | 35% | 50% | 60% | 65% | **≥65%** |
| 测试 fails | ≤84 | ≤30 | ≤10 | ≤3 | 0 | **0** |
| vitest exclude | 21 | ≤15 | ≤8 | ≤3 | 0 | **0** |
| npm audit | 1 high | 0 | 0 | 0 | 0 | **0** |
| raw throw new Error | 5 | 3(合理) | 3(合理) | 3(合理) | 3(合理) | **3(合理)** |
| E2E Playwright | 0 | 基础3个 | 8个 | 12个 | 15+ | **15+ 全绿** |
| Storybook | 0 | 0 | 5组件 | 15组件 | 25+ | **25+** |
| Lighthouse | — | — | — | ≥85 | ≥90 | **≥90** |
| Coverage statements | — | 报告 | ≥50% | ≥60% | ≥65% | **≥65%** |

---

## 🦐 R91 — i18n 收尾 + EngineError 达标 + 测试冲刺

**版本**: v1.10.0-alpha.2
**主题**: 核心质量指标全部达标

### 🦐ML (主龙虾) — 2 任务

| ID | 任务 | 描述 | 验收标准 |
|----|------|------|----------|
| M-01 | i18n 第三波: 全量压到 <8,000 | R90后预计<18,000 chars。本轮重点: server/层中文、配置文件中的用户可见字符串、错误消息模板。mock数据和注释中的中文不算。 | ① i18n-scan < 8,000 chars ② 所有用户可见字符串已 i18n.t() ③ TSC 0 ④ Build 0 ⑤ git commit |
| M-02 | 8语言翻译质量审查 + 缺失key补全 | 检查8个locale文件完整性: 缺失key补全, 空值翻译填充, 格式一致性(括号/占位符/标点)。确保zh-CN/zh-TW/en/ja/ko/fr/de/it全部完整 | ① 0个缺失key ② 0个空值翻译 ③ 所有locale key数量一致 ④ git commit |

### 🦐JVS (引擎虾) — 3 任务

| ID | 任务 | 描述 | 验收标准 |
|----|------|------|----------|
| J-01 | EngineError 批量转换: 覆盖率 35%→50% | R90后预计35%。本轮再转100+文件。重点: electron/ipc/ + electron/services/ + engine/子目录 | ① EngineError覆盖率 ≥50% ② raw throw new Error 仅剩3个合理处 ③ TSC 0 ④ Build 0 ⑤ git commit |
| J-02 | 性能基线建立 | 建立v1.10.0性能基线: Electron冷启动时间(ms), 稳态内存(MB), 打包体积(MB)。测量3次取中位数, 记录到docs/performance-baseline.md | ① 冷启动时间 ② 稳态内存(空闲5min后) ③ 打包体积 ④ 文档≥80行 ⑤ git commit |
| J-03 | IPC 通信层加固 | 审查electron/main/下所有IPC handler: 输入校验、错误处理统一为EngineError、超时机制、防重入锁 | ① 所有IPC handler有输入校验 ② 错误处理统一EngineError ③ 有超时机制 ④ TSC 0 ⑤ git commit |

### 🦐QClaw (测试虾) — 3 任务

| ID | 任务 | 描述 | 验收标准 |
|----|------|------|----------|
| Q-01 | 测试 fail 冲刺: ≤30→≤10 | R90后预计≤30。逐个分析fail原因, 修代码bug或修测试mock。**禁止新增exclude** | ① 真实fail ≤10 ② 禁止新增exclude ③ vitest exit code 显示具体fail列表 ④ git commit |
| Q-02 | 覆盖率提升: statements≥50% | R90报基线后, 补写engine/和electron/core/的单元测试 | ① statements ≥50% ② branches ≥35% ③ functions ≥40% ④ git commit |
| Q-03 | Flaky test 治理 | 连续跑5轮vitest, 识别flaky test。修复或记录原因。 | ① 5轮连续跑完 ② flaky test列表+原因 ③ 修复方案 ④ git commit |

### 🦐youdao (文档虾) — 2 任务

| ID | 任务 | 描述 | 验收标准 |
|----|------|------|----------|
| D-01 | R90 Release Notes | R90完成后的Release Notes: 变更摘要, 指标对比表, 已知问题 | ① CHANGELOG.md R90 section ② ≥150行 ③ git commit |
| D-02 | API文档: electron IPC + engine modules | electron/main/和engine/core/的public API写JSDoc + Markdown文档 | ① docs/api/electron-ipc.md ② docs/api/engine-core.md ③ 各≥200行 ④ git commit |

### 🦐PM (Claw/守护虾) — 1 任务

| ID | 任务 | 描述 | 验收标准 |
|----|------|------|----------|
| P-01 | R91 守护 + 审计 | 轮询chat-bridge, 审计各虾R91交付, 验证指标真实 | ① 所有虾commit验证 ② 指标真实输出 ③ git tag r91-complete |

**R91 总任务: 11 个**

---

## 🦐 R92 — 安全加固 + 性能优化 + UI 打磨

**版本**: v1.10.0-rc.1
**主题**: 从"能用"到"好用"

### 🦐ML (主龙虾) — 2 任务

| ID | 任务 | 描述 | 验收标准 |
|----|------|------|----------|
| M-01 | i18n 收尾: 全量 <3,000 + Storybook 5组件 | 残留硬编码中文继续清理到<3,000。同时为5个核心组件写Storybook stories | ① i18n-scan < 3,000 ② 5个Storybook stories ③ TSC 0 ④ Build 0 ⑤ git commit×2 |
| M-02 | 8核心页面响应式 + 暗色模式全面适配 | 检查并修复Dashboard/Market/Strategy/Trade/Portfolio/Risk/News/Settings的响应式和暗色模式 | ① 8页面响应式无broken ② 暗色模式全覆盖 ③ 无CSS overflow ④ git commit |

### 🦐JVS (引擎虾) — 3 任务

| ID | 任务 | 描述 | 验收标准 |
|----|------|------|----------|
| J-01 | 安全加固: CSP + 输入校验 + XSS 防护 | Electron CSP策略收紧, 所有IPC输入校验(已有则增强), DOMPurify集成防XSS | ① CSP策略配置 ② IPC输入校验中间件 ③ DOMPurify集成 ④ TSC 0 ⑤ git commit |
| J-02 | 性能优化: 路由级代码分割 + 懒加载 | Vite code splitting: 按路由分割, 非核心模块懒加载。目标首屏bundle <2MB | ① route-based splitting ② 非核心lazy import ③ 首屏bundle <2MB ④ git commit |
| J-03 | EngineError 覆盖率 50%→60% | 继续批量转换, 重点: src/components/ 下的UI组件错误处理 | ① 覆盖率 ≥60% ② TSC 0 ③ Build 0 ④ git commit |

### 🦐PM(Claw) — 代工测试+文档+守护 (youdao🪦+QClaw🪦 已双亡)

| ID | 任务 | 描述 | 验收标准 | 状态 |
|----|------|------|----------|------|
| Q-01 | 测试 fail ≤3 + exclude ≤3 | 接近清零。剩余fail必须有issue编号和修复计划 | ① 真实fail ≤3 ② exclude ≤3 ③ 每个残留有issue# ④ git commit | 待PM执行 |
| Q-02 | Lighthouse 审计 ≥85 | Electron Lighthouse: Performance/Accessibility/BestPractices/SEO 均≥85 | ① 4项均≥85 ② 报告输出 ③ 低于85的项有修复计划 ④ git commit | 待PM执行 |
| D-01 | 用户操作指南 | docs/user-guide.md | — | ✅ QClaw遗作 eff49c13 (683行) |
| D-02 | R91 Release Notes + 安全审计 | CHANGELOG + security-audit-r91.md | — | ✅ QClaw遗作 eff49c13 |
| P-01 | R92 守护 + 审计 + v1.10.0-rc.1 tag | 审计R92, 验证质量指标, 打rc.1 tag | ① 指标全部验证 ② git tag v1.10.0-rc.1 | 待PM执行 |

**R92 总任务: 10 个**

---

## 🦐 R93 — E2E 冲刺 + Storybook 完善 + 最终打磨

**版本**: v1.10.0-rc.2
**主题**: 端到端验证 + 文档完善

### 🦐ML (主龙虾) — 2 任务

| ID | 任务 | 描述 | 验收标准 |
|----|------|------|----------|
| M-01 | Storybook 扩充到 15 组件 | 为15个核心UI组件建stories: props文档, 交互示例, 变体展示, 暗色/亮色切换 | ① 15个stories ② Storybook build成功 ③ 各组件有controls ④ git commit |
| M-02 | Loading/Error/Empty 状态全覆盖 | 所有页面补充Loading skeleton, Error boundary fallback, Empty state组件 | ① 全局Loading组件 ② Error fallback统一 ③ Empty state美观 ④ git commit |

### 🦐JVS (引擎虾) — 2 任务

| ID | 任务 | 描述 | 验收标准 |
|----|------|------|----------|
| J-01 | Playwright E2E 扩充到 12 个 | 覆盖核心用户流程: 启动→Dashboard→市场→策略→交易→钱包→设置。包含正向和异常路径 | ① 12个test cases ② 全部通过 ③ CI可跑 ④ git commit |
| J-02 | Electron Auto-updater 集成 | electron-updater集成, 更新提示UI, 增量更新支持 | ① electron-updater集成 ② 更新UI提示 ③ TSC 0 ④ git commit |

### 🦐youdao (测试虾) — 3 任务 (已复活)

| ID | 任务 | 描述 | 验收标准 |
|----|------|------|----------|
| Q-01 | 全量回归: 5轮连续CI | 连续5轮完整CI(单元+集成+E2E)。目标5轮全绿 | ① 5/5轮全绿 ② 总测试时间报告 ③ flaky rate=0 ④ git commit |
| Q-02 | 内存泄漏检测 | Electron长时间运行内存监控: 空闲→操作→空闲, 内存应回落基线±10% | ① 内存监控脚本 ② 泄漏报告 ③ 修复(如有) ④ git commit |
| Q-03 | Coverage 冲刺: statements≥65% | 最终覆盖率冲刺 | ① statements ≥65% ② branches ≥45% ③ functions ≥55% ④ git commit |

### 🦐QClaw (文档虾) — 2 任务

| ID | 任务 | 描述 | 验收标准 |
|----|------|------|----------|
| D-01 | 开发者指南: 架构文档 + 贡献指南 | docs/architecture.md(系统架构) + CONTRIBUTING.md(代码规范+PR流程+测试要求) | ① architecture.md ≥300行 ② CONTRIBUTING.md ≥200行 ③ git commit |
| D-02 | R92 Release Notes | R92 Release Notes + 性能对比报告 | ① CHANGELOG R92 section ② 性能对比 ③ git commit |

### 🦐PM (Claw/守护虾) — 1 任务

| ID | 任务 | 描述 | 验收标准 |
|----|------|------|----------|
| P-01 | R93 守护 + 审计 + v1.10.0-rc.2 tag | 审计R93, E2E/Storybook验证, 打rc.2 tag | ① E2E 12/12 pass ② Storybook build OK ③ git tag v1.10.0-rc.2 |

**R93 总任务: 10 个**

---

## 🦐 R94 — 最终验收 + v1.10.0 正式发布 🔥 CURRENT ROUND

**版本**: v1.10.0 (正式版)
**主题**: 收官发布
**启动时间**: 2026-06-11 15:48 GMT+8

### 🦐ML (主龙虾) — 2 任务

| ID | 任务 | 描述 | 验收标准 |
|----|------|------|----------|
| M-01 | Landing Page v1.10.0 更新 | 更新落地页: v1.10.0特性列表, 下载链接, 版本说明, 截图 | ① 特性列表更新 ② 下载链接有效 ③ 版本号一致 ④ git commit |
| M-02 | 最终UI走查: 8语言 + 暗色 + 响应式 | 逐页面走查, 切换8种语言, 暗色模式, 响应式断点。i18n最终 <1,000 | ① 0 broken页面 ② 8语言无缺失 ③ i18n-scan <1,000 ④ git commit |

### 🦐JVS (引擎虾) — 2 任务

| ID | 任务 | 描述 | 验收标准 |
|----|------|------|----------|
| J-01 | v1.10.0 构建 + 安装包 | Windows安装包构建。输出installer .exe + 校验和SHA256 | ① installer构建成功 ② SHA256校验和文件 ③ 版本号1.10.0 ④ git tag v1.10.0 |
| J-02 | 发布文档: 部署清单 + 回滚方案 | docs/release/v1.10.0.md: 构建步骤, 部署清单, 回滚方案, 已知问题 | ① 发布文档完整 ② 回滚方案可执行 ③ git commit |

### 🦐youdao (测试虾) — 2 任务 (已复活)

| ID | 任务 | 描述 | 验收标准 |
|----|------|------|----------|
| Q-01 | 最终全量回归 + Playwright 15+ 全绿 | 单元测试0 fail + E2E 15+全绿。v1.10.0发布门禁 | ① 0 fail ② 0 unexpected skip ③ E2E 15/15 pass ④ git commit |
| Q-02 | 质量终报: v1.10.0 全指标报告 | 汇总全指标: TSC/Build/i18n/EngineError/测试/覆盖率/npm audit/性能/Lighthouse/E2E | ① 全指标表格 ② vs R89基线对比 ③ 达标/不达标标注 ④ git commit |

### 🦐QClaw (文档虾) — 2 任务

| ID | 任务 | 描述 | 验收标准 |
|----|------|------|----------|
| D-01 | v1.10.0 Release Notes (正式版) | 正式Release Notes: 特性列表, R89-R94变更日志, 升级指南, 已知问题, 致谢 | ① CHANGELOG v1.10.0 ② ≥500行 ③ git commit |
| D-02 | 项目回顾: R89-R94 总结文档 | docs/retrospective/r89-r94.md: 6轮做了什么, 学到了什么, 还有什么没做, 下一步建议 | ① 回顾文档 ≥300行 ② 数据统计 ③ 经验教训 ④ git commit |

### 🦐PM (Claw/守护虾) — 1 任务

| ID | 任务 | 描述 | 验收标准 |
|----|------|------|----------|
| P-01 | v1.10.0 最终验收 + 发布广播 | 逐项验收所有指标, 确认全部达标, git tag v1.10.0, 广播发布通知 | ① 全指标逐项验证通过 ② git tag v1.10.0 ③ 发布广播 ④ 🎉 |

**R94 总任务: 9 个**

---

## 📈 指标演进路线图

```
指标        R89实际     R90预期     R91目标     R92目标     R93目标     R94验收
─────────────────────────────────────────────────────────────────────────────
i18n chars  32,975     <18,000     <8,000      <3,000      <2,000      <1,000
EngineError 12.9%      35%         50%         60%         65%         ≥65%
Test fails  ≤84        ≤30         ≤10         ≤3          0           0
Exclude     21         ≤15         ≤8          ≤3          0           0
E2E tests   0          3           8           12          15+         15+
Storybook   0          0           5           15          25+         25+
Lighthouse  —          —           —           ≥85         ≥90         ≥90
Coverage    —          报告        ≥50%        ≥60%        ≥65%        ≥65%
```

## 📋 每轮任务数量汇总

| 轮次 | ML | JVS | QClaw | youdao | PM | 合计 |
|------|-----|------|-------|--------|-----|------|
| R90 (已分配) | 2 | 3 | 3 | 2 | 1 | **11** |
| R91 | 2 | 3 | 3 | 2 | 1 | **11** |
| R92 | 2 | 3 | 2 | 2 | 1 | **10** |
| R93 | 2 | 2 | 3 | 2 | 1 | **10** |
| R94 | 2 | 2 | 2 | 2 | 1 | **9** |
| **合计** | **10** | **13** | **13** | **10** | **5** | **51** |

## ⚠️ 风险项

| 风险 | 影响 | 缓解 |
|------|------|------|
| i18n JSX替换可能引入语法错误 | 中 | ML手动替换+每步验证TSC/Build |
| EngineError批量转换可能破坏现有逻辑 | 中 | JVS分批转换+每批跑测试 |
| electron升级可能breaking change | 低 | R90 J-02已安排, 有问题上报 |
| 测试fail修复可能暴露深层bug | 高 | QClaw逐个分析, 不掩盖 |
| E2E环境搭建可能耗时 | 中 | R90先搭基础, R91-R93增量扩展 |

## 🔒 铁律提醒 (每轮每虾必须)

1. **真实 git commit** — 不是口头说做了
2. **可验证的指标数据** — TSC/build/test 真实输出, 不编造
3. **不达标项标 ❌ + 修复计划** — 不掩盖
4. **禁止新增 vitest exclude** — 已有exclude必须有issue#
5. **禁止 TODO/FIXME/stub 充数 production code**
