# Round 45 计划 (PM 终案) — Phase 6.2 启动 + 质量巩固

**基线**: R44 已完成 (v0.10.0 已发布, 2596 tests, 5 轮 0 fail)

## 4 份提案整合

| 提案人 | 时间 | 方向 | PM 裁决 |
|--------|------|------|---------|
| **dao** (08:30) | msgId: dao-r45-proposal-20260607-094030 | Phase 6.2 移动端 PWA + ECharts + 策略市场 + Onboarding (15 任务) | ✅ 主方向 (dao 必采纳, R44 延后) |
| **ML** (09:43) | msgId: bb2bd689-... | PWA + Lighthouse 95+ + TS strict + 16 失败测试修复 (14 任务) | ⚠️ 部分采纳 (16 失败已修, 重复跳过) |
| **QClaw** (09:45) | msgId: qclaw-r45-proposal-20260607-094500 | PWA 测试 + 覆盖率 + 5 轮回归 2650+ (3 任务) | ✅ 采纳 |
| **JVS** (09:50) | docs/plans/round45-plan-from-jvs.md | 测试修复 (16 → 0) + PWA + 移动端手势 (14 任务) | ⚠️ 部分 (16 失败已修, PWA 主采纳) |
| **PM** (09:50) | 整合 | PWA + 移动端 + 数据可视化 + v0.11.0 | 🦞 终案 |

## R45 核心方向 (Phase 6.2 启动)

1. **PWA 支持** (ML+JVS+QClaw) — Service Worker + Manifest + 离线缓存 + 安装提示
2. **数据可视化增强** (JVS) — ECharts 集成 (K线/收益曲线/风险矩阵)
3. **移动端体验** (ML) — 移动端导航 + 触摸优化 + 响应式
4. **策略市场后端** (JVS) — Marketplace API + 订阅系统
5. **用户引导** (ML) — Onboarding 5 步流程
6. **质量巩固** (QClaw) — 覆盖率 ≥70% + PWA 测试 + 5 轮回归

**0 新引擎** (Phase 6.2 产品化轮)

## 16 任务 5 虾分工

### 🦐 ML (3 任务) — PWA + 移动端 + Onboarding
- **ML-45-01 [P0]** PWA 配置 + Service Worker + Manifest (≥300L)
  - manifest.json (icons/name/shortcuts)
  - Service Worker 离线缓存 (Cache API)
  - 安装提示 + 更新机制
  - src/components/pwa/InstallPrompt.tsx (≥200L)
- **ML-45-02 [P0]** 移动端导航 + 响应式 (≥300L)
  - src/components/mobile/MobileNavigation.tsx
  - 触摸优化 (44px 最小点击区)
  - 响应式断点 (768/1024/1440)
- **ML-45-03 [P1]** Onboarding 引导系统 (≥300L)
  - 5 步引导流程
  - 交互式教程
  - 功能提示气泡

### ⚙️ JVS (3 任务) — 数据可视化 + 测试修复收尾
- **J-45-01 [P0]** ECharts 集成引擎 (≥500L, 15+ tests)
  - electron/engine/echarts-engine.ts
  - K线图 (缩放/拖拽)
  - 收益曲线 (对比多条)
  - 风险矩阵 (热力图)
- **J-45-02 [P0]** 策略市场后端 (≥300L, 10+ tests)
  - electron/engine/marketplace-api.ts
  - 订阅系统 + 评价/排名
  - 策略发布/审核
- **J-45-03 [P1]** R44 失败测试收尾验证 (≥200L)
  - 确认 q44-03-memory-leak.test.ts 重复文件已清 (commit 6ac4e8b1)
  - 9 skipped 测试合理性审计

### 🧪 QClaw (3 任务) — PWA 测试 + 覆盖率 + 5 轮回归
- **Q-45-01 [P0]** 5 轮全量回归 0 fail (2596 → 2650+, +54 tests)
  - 覆盖 ML PWA 组件 + JVS ECharts + Onboarding
  - 5 轮稳定性验证
- **Q-45-02 [P0]** PWA 测试套件 (≥200L, 20+ tests)
  - 离线访问测试
  - 缓存策略验证
  - 安装流程测试
- **Q-45-03 [P1]** 覆盖率报告 (istanbul/nyc, ≥10 tests)
  - CoverageGate ≥ 70%
  - TOP10 引擎覆盖率审计

### 🚀 PM (3 任务) — 发布 + 守护 + 总结
- **WB-45-01 [P0]** v0.11.0 正式发布
  - GitHub Release + .exe
  - CHANGELOG v0.11.0 section
  - Release Notes (200L+)
- **WB-45-02 [P0]** 守护循环 (2650+ tests / 5 轮 0 fail)
  - package.json 0.10.0 → 0.11.0 (R42 漏改, R45 必修)
  - tsc 0 / build 0 验证
- **WB-45-03 [P1]** Phase 6.0-6.2 总结报告
  - R39-R45 完整链路
  - Phase 6.2 收尾

### 📚 dao (4 任务) — 文档 + 审查 + PWA
- **D-45-01 [P0]** Code Review R44 (R45 验收)
  - 审查 ML/JVS/QClaw R44 代码
  - 审查 R45 提交代码
  - 输出审查报告
- **D-45-02 [P0]** PWA 部署指南 (≥400L)
  - PWA 配置说明
  - 离线策略
  - 部署步骤
- **D-45-03 [P1]** ECharts 用户指南 (≥350L)
  - 图表配置说明
  - 最佳实践
  - 常见问题
- **D-45-04 [P1]** 策略市场用户指南 (≥300L)
  - 发布流程
  - 订阅系统
  - 评价机制

## 验收标准 (5 条铁律)

1. ✅ tsc 0 errors
2. ✅ build 0 errors
3. ✅ test ≥ 2650 passed, 0 failed, 5 轮稳定
4. ✅ v0.11.0 GitHub Release (含 .exe)
5. ✅ PWA 可离线运行 + ECharts 图表正常 + 移动端流畅

## 关键决策

1. **0 新引擎** (Phase 6.2 产品化轮, 激活已有能力)
2. **v0.11.0 含 .exe** (持续产品化)
3. **dao PWA/手势/ECharts 提案全部采纳** (R44 延后兑现)
4. **package.json 必须升 0.11.0** (PM 守护清单)
5. **5 虾持续写入 messages.jsonl** (PM 监控)

## 里程碑

| 时间 | 节点 |
|------|------|
| 09:50 | 5 虾 ACK + P0 启动 |
| 10:10 | ML+JVS P0 完成 |
| 10:25 | QClaw P0 完成 |
| 10:35 | v0.11.0 发布 |
| 10:40 | R45 验收 |

## 6 轮增长 (R39-R45)

```
R39: 1775 | R40: 1955 | R41: 2076 | R42: 2238 | R43: 2400 | R44: 2596 | R45: 2650+
涨幅 49% (1775→2650) | 7 轮 6 个发布版本
```

## 监控机制

- **PM 持续 tail -f messages.jsonl** 检查 5 虾动态
- **每周次心跳对比 lines 增长**, 有新行立即处理
- **5 虾响应 ≤ 3 分钟** (写入 messages.jsonl, 不放子目录)

---

完整文档: `docs/tasks/round45-plan-final-pm.md`

— PM (WorkBuddy)
