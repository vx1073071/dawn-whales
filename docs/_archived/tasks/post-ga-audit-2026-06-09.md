# v1.9.0 GA 项目独立审计 → PM

**审计人**: ML (EasyClaw 主龙虾)
**时间**: 2026-06-09 23:45 GMT+8
**基线**: R81 全虾完成 | 232 src / 374 tests / 6500+ | v1.9.0 GA 已发布

---

## ✅ 已完成 (R77-R81 5轮打磨)

- ✅ npm audit 0 vulns (protobufjs 8.6.1 override)
- ✅ package.json 1.9.0
- ✅ 组件清理 59→55
- ✅ ErrorBoundary 统一到 common/
- ✅ 落地页 site/index.html
- ✅ 3引擎补完 (signal-backtesting / realtime-news / P2P拆分)
- ✅ 三态统一+私行风+a11y+触控 (UIPolishKit)
- ✅ GA最终面板+30轮总结
- ✅ 增长运营 (审核/邀请/成就)

---

## 🔴 紧急 (建议立即处理)

### 1. payment.ts 还有 4 个 TODO
- `src/payment.ts` 文件存在 4 处 TODO/FIXME
- 涉及真实支付逻辑, 必须清理
- 风险: 用户实际支付时可能因 TODO 路径走错

### 2. 27 个组件目录未分类
- `src/components/` 下 27 个子目录（含 billing），如 `pm/` `pwa/` `roadmap/` `release/` `skeleton/` `tools/` 等空目录或临时目录
- 多数目录仅 1-2 个文件，未按功能模块化
- 风险: 维护成本高，新人接手混乱

### 3. 127 处 test skip 分散在 374 测试文件中
- 374 个测试文件中 127 处 `it.skip / describe.skip / xit / xtest`
- 占总用例 34% — 过高
- 多数 skip 是 R77/R79 留下的"待修"标记
- 风险: 实际功能回归率被掩盖

### 4. common/ 目录仅 1 个文件
- `src/common/ErrorBoundary.tsx` — 单文件目录
- 其他 55 个组件散在 `billing/` + 27 个其他目录
- 应合并到合理结构（`components/{core,ai,trade,wallet,community,growth}/`）

---

## 🟡 重要 (建议1-2周内)

### 5. src/locales/ 不存在
- 9语言承诺（中文简/繁/英/日/韩+...）但无 locales/ 目录
- i18n 散在 ThemeLangPanel 单文件 + 各组件硬编码
- 缺统一架构: 4种用法混用
- 风险: 5语言后实际翻第2种就破窗

### 6. 大量被 .skip 的测试是潜在 bug
- 127 skip 中含: q51-chaos / jvs-83-benchmark 等
- 这些是性能/压测跳过，可能掩盖回归
- 建议: 分阶段修复，至少 80% skip 转为正常 test

### 7. 缺少 i18n 集中管理
- 没有 `t('key')` 模式
- 全部用 `if (lang === 'zh-CN')` 字符串硬编码
- 9语言扩展时成本翻倍

### 8. 27 个子目录需要重组
```
src/components/
  ai/          (AI AssistantPanel 等)
  backtest/    (回测相关)
  billing/     (55个混合)
  common/      (ErrorBoundary)
  dashboard/
  data/        (数据源相关)
  ...
```
- 55个组件堆在 billing/
- 应拆为: `core/` + `ai/` + `trade/` + `wallet/` + `community/` + `growth/` + `admin/`

### 9. CHANGELOG 跟不上
- CHANGELOG.md: 17KB 已存在
- 但 R77-R81 5轮打磨无任何记录
- 5轮新增 7+ 组件全部未写入
- 风险: 用户看不到 5轮新增能力

### 10. 缺乏版本化打包记录
- package.json v1.9.0 ✅
- 但 git tag 没有 v1.9.0（仍是 v0.13.0 最后）
- GitHub Release 未发布

---

## 🟢 优化 (持续改进)

### 11. App.tsx 路由仅注册 2 个组件
- 55 个组件开发完毕，仅 2 个 `lazy()` 引入
- 大部分组件只是"已开发"未真正接入
- 应分批路由化 (按用户角色/功能)

### 12. 没有 Storybook
- 55 个组件无独立文档/演示
- 新人无法预览

### 13. 没有 a11y 自动化测试
- a11y 通过 UIPolishPanel 手动展示
- 无 axe-core 扫描

### 14. 没有 e2e Playwright 验证
- 374 个单元测试，但端到端靠手测
- WebappTesting 技能未集成

### 15. 监控埋点只是声明
- JVS R80 加了漏斗/留存/邀请
- 但 UI 没有可视化（仅后台 API）
- 建议加 admin Dashboard 直接看数据

### 16. README 仍过时
- R77-R81 5轮成果未记录

### 17. 依赖 dev/prod 不分离
- vite 是 devDep，但许多 production-only 的 electron-builder 在 devDeps

### 18. 国际化硬编码文字
- 19 个 UI 组件中 80% 文字硬编码
- 难以扩展新语言

---

## v1.9.0 GA 之后建议路径 (R82-R85)

| 轮次 | 主题 | 关键动作 |
|:--:|------|----------|
| **R82** | 组件重组 | 27子目录→7模块化·App.tsx全路由注册 |
| **R83** | i18n架构 | locales/ 9语言统一·t()模式替换硬编码 |
| **R84** | 测试清理 | 127 skip→<30·Storybook搭建·Playwright e2e |
| **R85** | 监控可视化 | admin Dashboard 漏斗/留存/邀请 实时显示 |

---

## 立即可做 (15min 内)

| 优先级 | 动作 | 收益 |
|:--:|------|------|
| 1 | `src/payment.ts` 4 TODO 修复 | 消除支付风险 |
| 2 | git tag v1.9.0 + GitHub Release | 完成GA发布 |
| 3 | 补 5 轮 CHANGELOG | 用户可见5轮成果 |
| 4 | `src/locales/` 创建 9 语言 JSON 骨架 | 启动 i18n 架构 |
| 5 | App.tsx 路由化 55 组件 → 至少 20 接入 | 解决"开发完用不上" |

---

## 总评

**v1.9.0 GA 标志着产品从 0 到 1 的完成。**

但 30 轮高速开发留下:
- 📦 大量"开发完成未使用"组件 (55个→接2个)
- 🌍 国际化承诺未兑现 (5语言但无locales/)
- 🧪 测试债务 (127 skip 未还)
- 📂 目录混乱 (27子目录 + billing 55个堆叠)

**下个里程碑 v2.0.0**: 从"功能多"到"用得好"。建议 R82-R85 用 4 轮做架构偿还。
