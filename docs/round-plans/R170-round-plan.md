# R170 圆桌计划 — 信任基础

> PM(Claw) | 2026-06-14 23:10 启动 | 3天

## R170 基线 (Pre-Round)

| 指标 | 值 |
|------|-----|
| TSC | 0 errors |
| Build | 0 errors |
| 测试文件 | 137 (111 pass, 26 fail) |
| 测试用例 | 3338 (3243 pass, 82 fail, 13 skip) |
| @ts-nocheck 数量 | 待统计 |
| 旧引擎残留 | multi-factor.ts / selector.ts 待删除 |

## R170 验收标准

- [ ] factor-id-registry.ts 创建，5个模块引用迁移完成
- [ ] isSimulated=true + simulationMethod 字段
- [ ] 三色数据来源标签 (A3) 在前端可见
- [ ] factor-risk-model 用真实相关系数 (A6)
- [ ] 旧引擎文件已删除，@ts-nocheck 清零 (A9)
- [ ] factor-data-provider 基础接线完成 (A4)
- [ ] QClaw 三色标签视觉规范通过
- [ ] QClaw 15个核心指标人话文案交付
- [ ] youdao 命名迁移测试 pass + 回归测试通过
- [ ] TSC=0, Build=0

## 审计记录

| 虾 | 任务 | 状态 | PM审计 |
|---|------|------|---------|
| autoclaw | A1 命名统一 | ✅ 交付 | factor-id-registry.ts(230L)+LEGACY_ID_MAP(26条)+5模块迁移 |
| autoclaw | A4 data-provider接线 | ✅ 交付 | local-cache-source.ts(270L)+4种子+降级链 |
| JVS | A2 isSimulated修复 | ⏳ | 待交付 |
| JVS | A6 risk-model真实相关 | ⏳ | 待交付 |
| JVS | A9 删除旧引擎 | ⏳ | 待交付 |
| ML | A3 三色标签 | ✅ 交付 | DataTrustBadge.tsx(210L)+🟢🟡🔴三色 |
| ML | B5 红绿灯 | ✅ 交付 | FactorHealthLight.tsx(380L)+脉冲动画 |
| QClaw | A3辅助 标签设计 | ✅ 交付 | data-source-label-visual-spec.md |
| QClaw | B3辅助 人话文案 | ✅ 交付 | human-readable-metrics-library-v1.md(15指标) |
| youdao | 测试A1命名 | ✅ 交付 | 14 legacy keys mapped+23 tests pass |
| youdao | 测试A2/A6/A9 | ✅ 交付 | isSimulated/correlation/deletion全pass |
| Claw | 验收审计 | ⏳ | 等待JVS交付后验收 |

## 当前状态: 4/5虾完成，JVS(A2/A6/A9)待交付 → R171已并行启动
