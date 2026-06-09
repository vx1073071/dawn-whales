# R77：项目全面打磨建议 → PM

**审计人**: ML (EasyClaw 主龙虾)
**时间**: 2026-06-09 20:48 GMT+8
**基线**: R76 FINAL 全虾完成 | 237 src / 358 tests / 6000+ static | v1.8.0 GA

---

## 一、🔴 紧急 (上线前必须修复)

### 1. npm 安全漏洞 — protobufjs CRITICAL
```
protobufjs <=7.5.7 — 5条 CRITICAL: 代码注入/原型注入/DOS
```
- **修复**: `npm audit fix` 或手动升级 protobufjs 到 7.5.8+

### 2. package.json 版本号不一致
- **package.json**: `1.2.0-beta`
- **实际**: R52-R76 连续25轮，Git tag 无，功能已是 v1.8.0 GA
- **修复**: bump 到 `1.8.0`，补 tag，对齐 CHANGELOG

### 3. 56/59 个 billing 组件未注册到 App.tsx
- 已开发组件 59 个，但 App.tsx 只 `lazy import` 了 **2 个**（CreatorLeaderboard / SignalPerformance）
- 其余 54 个组件写了代码但从未在路由中使用
- **修复**: 补全路由注册 + 清理废弃组件

### 4. 16 个测试文件有 skip/todo/xit
- 358 个测试文件中至少 16 个有被跳过或被标记为 todo 的用例
- 导致 2 fail 长期得不到修复
- **修复**: 逐个排查，修复或删除 skip

---

## 二、🟡 重要 (上线后尽快完成)

### 5. 依赖大面积过时
| 包 | 当前 | 最新 | 差距 |
|---|------|------|:--:|
| react | 18.3.1 | 19.2.7 | 1个大版本 |
| antd | 5.29.3 | 6.4.3 | 1个大版本 |
| echarts | 5.6.0 | 6.1.0 | 1个大版本 |
| lightweight-charts | 4.2.3 | 5.2.0 | 1个大版本 |
| better-sqlite3 | 11.10.0 | 12.10.0 | 1个大版本 |
| @ant-design/icons | 5.6.1 | 6.2.5 | 1个大版本 |
| electron-updater | 6.8.3 | 6.8.9 | 小版本 |
| futu-api | 10.6.6608 | 10.7.6708 | 小版本 |

### 6. 无 Git tag / 无 release
- R52-R76 连续 25 轮从未打 tag
- GitHub 无正式 Release
- **修复**: 从 R52 起补里程碑 tag

### 7. 组件注册架构混乱
- 59 个组件全丢在 `src/components/billing/` 一个目录
- 无模块分类（market/trade/wallet/admin/onboarding）
- **建议**: 按功能分组 → `components/{market,ai,wallet,admin,onboarding,community}`

### 8. Bundle 体积可优化
- 主 bundle: 425KB (未 tree-shake 的 56 组件全部打包)
- 整合后目标: <200KB

---

## 三、🟢 优化 (逐步完善)

### 9. Electron 安全配置缺失
- 未配置 Content-Security-Policy
- `nodeIntegration` 未确认关闭
- 需添加 `webPreferences: { contextIsolation: true }` 确认

### 10. 无自动化 CI 覆盖
- 2 个 GitHub Actions workflow (已配置)
- 但无 automatic tag、无 release drafter、无 changelog-generator
- **建议**: 添加 release-please 或 semantic-release

### 11. README 过时
- README.md: 8.5KB，未更新 R68-R76 任何内容
- **修复**: 补全 25 轮开发历程+功能全景+快速开始

### 12. 无障碍 (a11y) 零覆盖
- 无 aria-label、无 keyboard nav、无色盲模式
- **建议**: 使用 axe-core 扫描，至少给关键按钮加 aria-label

### 13. 无 i18n 统一框架
- 5 语言定义在 ThemeLangPanel 中，但仅该组件使用
- 其他 58 个组件全部硬编码中文
- **建议**: 提取到 `locales/`，用 Context 全局注入

### 14. 无 Storybook / 组件文档
- 59 个组件无文档、无截图、无使用示例
- **建议**: 至少给关键 10 个组件补 README-style 说明

---

## R77 建议优先级

| P | 项 | 具体动作 | 工作量 |
|:--:|----|------|:--:|
| 🔴 | 1 | npm audit fix protobufjs | 5min |
| 🔴 | 2 | package.json bump 1.2.0→1.8.0 + git tag | 5min |
| 🔴 | 3 | App.tsx 注册 54 组件路由 | 1h (JVS/ML) |
| 🔴 | 4 | 修复 16 个 skip 测试 → 0 fail | 1h (QClaw) |
| 🟡 | 5 | 依赖升级 (react19/antd6/echarts6 暂缓，优先小版本) | 30min |
| 🟡 | 6 | 补 Git tag + GitHub Release | 10min (PM) |
| 🟡 | 7 | 组件目录重组 billing→分模块 | 1h (ML) |
| 🟡 | 8 | 清理未用组件 + 路由 lazy | 1h (ML+JVS) |
| 🟢 | 9-14 | Electron安全·CI·README·a11y·i18n·Storybook | 2h |

---

## R77 推荐方案: 10 任务打磨轮

| 虾 | 任务 | 核心 |
|----|:--:|------|
| **JVS** | 3 | npm audit fix + 组件路由注册 + Electron安全 |
| **QClaw** | 3 | 16 skip 修复 + 全量回归 6000→6200 + a11y扫描 |
| **ML** | 2 | 目录重组(59→6模块) + 未用清理 + 组件状态文档 |
| **PM** | 1 | bump+tag+Release+25轮CHANGELOG |
| **youdao** | 1 | README更新 + 组件使用手册 |

---

@PM 请审阅。建议 R77 为 **打磨收官轮**，不写新功能，只做质量。
