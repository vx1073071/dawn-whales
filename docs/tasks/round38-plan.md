# Round 38 Plan — Sprint 3 Phase 4.4 收尾

**日期**: 2026-06-07
**规划人**: QClaw (代 PM WorkBuddy)
**基于**: Sprint 2 Phase 4.4 路线图（R37-R38）
**当前状态**: 1527 tests / 113 files / TSC 0 / v0.7.0 released

---

## 背景

| Phase | 轮次 | 状态 |
|-------|------|------|
| Phase 4.1: 定时执行引擎 | R29-R30 | ✅ 完成 |
| Phase 4.2: 条件触发引擎 | R31-R33 | ✅ 完成 |
| Phase 4.3: 闭环执行引擎 | R34-R36 | ✅ 完成 |
| **Phase 4.4: 性能+稳定性+v0.8.0** | **R37-R38** | **⏳ 进行中** |

**R37 已完成**: 测试扩量 1379→1527 / events polyfill 修复 / perf baseline 报告 / Sprint 2 回顾
**R38 目标**: Lighthouse >80 / CI/CD / 技术债务清理 / v0.8.0 发布

---

## Q38-01: Lighthouse 前端性能优化 [QClaw]

**现状**: Lighthouse ≈ 45（估算，有待实测）
**目标**: Lighthouse > 80

**P0 任务**:
1. 运行 `lighthouse http://localhost:5173 --output=json` 获取当前分数
2. 分析 Performance / Accessibility / Best Practices / SEO 各维度得分
3. 识别 3 个最大 weight 的 render-blocking 资源

**预计优化方向**:
- 图片压缩（WebP 转换 / 响应式图片 `srcset`）
- JS bundle split（路由级 code splitting）
- CSS 压缩（purgecss / critical CSS inline）
- 字体优化（`font-display: swap` / subset）
- 移除未使用 polyfill（检查 `@babel/preset-env` targets）
- Lazy load 非首屏组件（图表 / 模态框）

**验收**: Lighthouse Desktop > 80 / Mobile > 60

---

## Q38-02: CI/CD Pipeline 搭建 [QClaw]

**现状**: 无 CI，每次手动 `npm run build && vitest`
**目标**: GitHub Actions 自动构建 + 测试 + Lighthouse

**P0 任务**:
1. 创建 `.github/workflows/ci.yml`
   - trigger: push + PR (master)
   - steps: npm install → TSC check → vitest → build
   - artifact: 保留 .exe 和 test-results
2. 创建 `.github/workflows/lighthouse.yml`
   - trigger: 每日 / manual
   - steps: start dev server → lighthouse → upload report
3. 设置 branch protection: PR 需 CI green 才能合并

**预计效果**: 每次 push 自动验证，regression 立即发现

---

## Q38-03: 技术债务清理 [JVS]

**现状**: 200+ engine 文件，部分含 TODO/FIXME/stub/未集成模块
**目标**: 减少 50% 高优先级债务项

**P0 任务**:
1. 全局扫描 `electron/engine/` 下的 TODO/FIXME/stub
2. 优先级排序（影响测试 / 影响构建 / 纯文档）
3. 修复 P0 项（导致 test fail / compile warn 的项）
4. 清理未使用的 `declare global` 块（Phase 3 遗留）

**P1 任务**:
5. 检查 `engine-registry.ts` 是否已注册所有 engine（Phase 4.3 engines 未注册）
6. 验证 `audit-logger.ts` 是否已集成到 TradeExecutor / ClosedLoopExecutor

---

## Q38-04: v0.8.0 发布准备 [ML]

**现状**: v0.7.0 已发布 / v0.8.0 脚本已创建（commit 25f0ee2e）
**目标**: v0.8.0 .exe 可分发

**P0 任务**:
1. 运行 `npm run build:v0.8.0`（或对应脚本），确认 .exe 生成
2. 验证 .exe 可以启动（无 DLL 缺失 / 路径错误）
3. 确认 `CHANGELOG.md` 包含 Phase 4.2-4.3 所有新功能
4. 更新 `package.json` version → 0.8.0
5. 打 GitHub tag `v0.8.0` + Release asset

**P1 验收**:
- .exe 双击启动，窗口正常显示
- 菜单 / 设置页面可打开
- 无 crash log 写入

---

## Q38-05: 测试质量保障 [J]

**现状**: 1527 tests / 1 flaky fail 风险 / 部分 tests 依赖模拟时间
**目标**: 1527+ tests / 0 flaky / 模拟时间测试全部稳定

**P0 任务**:
1. 运行全量 vitest 3 次，标记每次 fail 的测试（flaky 定位）
2. 修复已发现 flaky tests:
   - `closed-loop-executor.test.ts`: filledPrice 随机性
   - `position-monitor.test.ts`: `vi.useFakeTimers()` + `Date.now()` 不兼容 jsdom
3. 将所有 `vi.setSystemTime()` 替换为 `vi.spyOn(Date, 'now')` mock

**P1 任务**:
4. 添加 30 个边界测试（Phase 4.4 场景覆盖）:
   - PositionMonitor: 持仓穿越冷却期 / 止损触发后重建
   - ClosedLoopExecutor: 多标的并发闭环 / 部分成交处理
   - RebalanceEngine: 最小交易量限制 / 税费扣除后再平衡
5. 测试目标: **1550+ tests**

---

## Q38-06: Phase 4.4 收尾验收 [PM]

**目标**: Sprint 3 Phase 4.4 完成报告

**P0 任务**:
1. 汇总 R37+R38 所有交付物
2. 对照 Phase 4.4 验收标准逐项检查
3. 撰写 `docs/reports/sprint3-phase4.4-acceptance.md`
4. 发起 Sprint 3 整体回顾讨论

**Phase 4.4 验收清单**:
- [ ] Lighthouse Desktop > 80 / Mobile > 60
- [ ] CI/CD 自动构建通过
- [ ] 技术债务 P0 项全部清除
- [ ] v0.8.0 .exe 可下载
- [ ] 测试 1550+ / 0 flaky
- [ ] CHANGELOG 更新

---

## 资源与依赖

| 任务 | 负责人 | 预计时间 | 依赖 |
|------|--------|----------|------|
| Q38-01 Lighthouse | ML | 1.5h | 需 localhost 环境 |
| Q38-02 CI/CD | QClaw | 1h | GitHub repo write access |
| Q38-03 债务清理 | JVS | 1.5h | 无 |
| Q38-04 v0.8.0 | ML | 1h | npm run build:v0.8.0 脚本验证 |
| Q38-05 测试质量 | J | 1.5h | flaky 定位数据 |
| Q38-06 收尾报告 | PM | 30min | 以上全部完成 |

**并行**: Q38-01 / Q38-02 / Q38-03 / Q38-05 可并行推进

---

## 风险

| 风险 | 影响 | 应对 |
|------|------|------|
| Lighthouse 跨平台差异 | Desktop ≠ Mobile 分数 | 以 Desktop 为准 |
| GitHub Actions minutes 限制 | 免费额度耗尽 | 优化 CI 缓存（node_modules cache） |
| flaky test 随机复现 | 难以定位根因 | 3 次全量运行定位稳定失败项 |
| v0.8.0 .exe DLL 缺失 | 启动即崩 | 在干净虚拟机/不同设备测试 |

---

*R38 是 Sprint 3 最后一轮，目标是 v0.8.0 稳定发布 + Lighthouse >80 + CI/CD 落地。*
