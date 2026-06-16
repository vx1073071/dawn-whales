---
title: 贡献指南
description: 如何为 DAWN WHALES 项目做出贡献 — 代码贡献、文档翻译、插件开发、问题反馈
---

# 🤝 贡献指南

感谢你考虑为 DAWN WHALES 做出贡献！本文档将帮助你了解如何参与项目。

## 目录

1. [行为准则](#行为准则)
2. [如何贡献](#如何贡献)
3. [开发环境搭建](#开发环境搭建)
4. [代码规范](#代码规范)
5. [提交 Pull Request](#提交-pull-request)
6. [文档贡献](#文档贡献)
7. [翻译贡献](#翻译贡献)
8. [插件开发](#插件开发)
9. [问题反馈](#问题反馈)

---

## 行为准则

参与本项目即表示你同意遵守以下准则：

- **尊重他人**：使用友好、包容的语言
- **建设性反馈**：专注于改进而非批评
- **协作优先**：帮助他人，共同进步
- **遵守许可**：本项目使用 MIT 许可

---

## 如何贡献

### 贡献方式

| 方式 | 适合人群 | 时间投入 |
|------|----------|:--------:|
| 🐛 报告 Bug | 所有用户 | 5-10 min |
| 💡 功能建议 | 所有用户 | 10-30 min |
| 📝 文档改进 | 技术写作者 | 30 min+ |
| 🌍 翻译贡献 | 多语言使用者 | 1h+ |
| 🔧 代码贡献 | 开发者 | 2h+ |
| 🧩 插件开发 | 高级开发者 | 4h+ |

### 新手友好任务

我们标记了 `good first issue` 标签的问题，适合首次贡献者：

- 修复简单的 TypeScript 类型错误
- 完善 i18n 翻译
- 补充组件单元测试
- 改进错误提示文案

---

## 开发环境搭建

### 前置要求

- **Node.js** >= 18.0.0
- **pnpm** >= 8.0.0
- **Git**

### 快速开始

```bash
# 1. 克隆仓库
git clone https://github.com/dawn-whales/dawn-whales.git
cd dawn-whales

# 2. 安装依赖
pnpm install

# 3. 启动开发服务器
pnpm dev

# 4. 运行测试
pnpm test

# 5. 类型检查
pnpm tsc --noEmit
```

### 项目结构

```
dawn-whales/
├── electron/          # Electron 主进程
│   ├── engine/        # 策略引擎
│   │   ├── factors/   # 因子计算
│   │   ├── plugins/   # 插件系统
│   │   └── core/      # 核心逻辑
│   ├── main/          # 主窗口+IPC
│   └── preload/       # 预加载脚本
├── src/               # React 前端
│   ├── components/    # UI 组件
│   ├── hooks/         # 自定义 hooks
│   ├── stores/        # 状态管理 (zustand)
│   ├── i18n/          # 国际化
│   └── lib/           # 工具库
├── server/            # 后端服务
├── docs-site/         # 文档站点 (Astro + Starlight)
├── tests/             # 测试套件
│   ├── e2e/           # E2E 测试 (Playwright)
│   ├── plugins/       # 插件测试
│   └── unit/          # 单元测试
└── scripts/           # 构建/部署脚本
```

---

## 代码规范

### TypeScript

```typescript
// ✅ 好的实践
function calculateRSI(prices: number[], period: number): number {
  if (prices.length < period + 1) return 50;
  // ...
}

// ❌ 避免
function calculate(p: any, n: any): any {
  // 没有类型注解
}
```

### 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 组件 | PascalCase | `StrategyCompareEnhance` |
| 函数/变量 | camelCase | `calculateRSI` |
| 常量 | UPPER_SNAKE | `MAX_RETRY_COUNT` |
| 文件名 | kebab-case | `strategy-compare.tsx` |
| 类型/接口 | PascalCase | `PluginManifest` |

### Git 提交规范

使用 [Conventional Commits](https://www.conventionalcommits.org/)：

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

类型：
- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式
- `refactor`: 重构
- `test`: 测试
- `chore`: 构建/工具

示例：
```
feat(plugin): add custom factor example plugin
fix(strategy): correct RSI calculation for edge case
docs(api): update plugin API reference
```

---

## 提交 Pull Request

### PR 流程

1. **Fork** 仓库并创建分支
   ```bash
   git checkout -b feat/my-feature
   ```

2. **编写代码** 并通过测试
   ```bash
   pnpm tsc --noEmit   # 类型检查
   pnpm test           # 单元测试
   pnpm lint           # 代码检查
   ```

3. **提交** 清晰的 commit message
   ```bash
   git commit -m "feat(plugin): add custom factor example plugin"
   ```

4. **推送** 并创建 PR
   ```bash
   git push origin feat/my-feature
   ```

5. **等待审查** — 维护者会在 48 小时内审查

### PR 检查清单

- [ ] TSC 类型检查通过（0 错误）
- [ ] 所有测试通过
- [ ] 新功能有单元测试覆盖
- [ ] 新组件有 Loading/Empty/Error 状态
- [ ] 新文案已添加 i18n key
- [ ] Git commit 遵循 Conventional Commits
- [ ] 无 console.log 遗留

---

## 文档贡献

### 文档站结构

文档使用 [Astro Starlight](https://starlight.astro.build/) 构建，位于 `docs-site/` 目录：

```
docs-site/
├── src/
│   ├── content/docs/        # Markdown/MDX 文档
│   │   ├── api/             # API 参考
│   │   ├── broker/          # 券商指南
│   │   ├── getting-started/ # 快速开始
│   │   ├── guides/          # 开发指南
│   │   ├── reference/       # 技术参考
│   │   ├── strategy/        # 策略开发
│   │   └── user-manual/     # 用户手册
│   └── styles/              # 自定义样式
├── astro.config.mjs         # Starlight 配置
└── package.json
```

### 本地预览文档

```bash
cd docs-site
pnpm install
pnpm dev
# 访问 http://localhost:4321
```

---

## 翻译贡献

DAWN WHALES 支持 9 种语言。翻译文件位于：

- **前端 UI**: `src/i18n/locales/{locale}.json`
- **文档站**: 在 Markdown 文件中使用 Starlight 的 i18n 路由
- **因子体系**: `electron/engine/factors/locales/factor-locale-{locale}.json`
- **钱包/支付**: `src/i18n/locales/wallet-{locale}.json`
- **跟单系统**: `src/i18n/locales/copytrade-{locale}.json`

### 贡献步骤

1. 找到待翻译的语言文件
2. 对比英文 (`en.json`) 文件，补全缺失的 key
3. 确保翻译准确且自然
4. 提交 PR

### 当前翻译状态

| 语言 | 前端 | 文档 | 因子 | 钱包 | 跟单 |
|------|:---:|:---:|:---:|:---:|:---:|
| 简体中文 (zh-CN) | ✅ | ✅ | ✅ | ✅ | ✅ |
| 繁体中文 (zh-TW) | ✅ | - | ✅ | ✅ | ✅ |
| 粤语中文 (zh-HK) | ✅ | - | ✅ | ✅ | ✅ |
| English (en) | ✅ | ✅ | ✅ | ✅ | ✅ |
| 日本語 (ja) | ✅ | - | ✅ | ✅ | ✅ |
| 한국어 (ko) | ✅ | - | ✅ | ✅ | ✅ |
| Deutsch (de) | ✅ | - | ✅ | ✅ | ✅ |
| Français (fr) | ✅ | - | ✅ | ✅ | ✅ |
| Español (es) | ✅ | - | ✅ | ✅ | ✅ |
| Italiano (it) | ✅ | - | ✅ | ✅ | ✅ |
| Русский (ru) | ✅ | - | - | - | - |
| Português (pt) | - | - | - | - | ✅ |

---

## 插件开发

DAWN WHALES 提供完整的插件系统，支持：

- 自定义因子计算
- 自定义数据源接入
- 自定义 UI 组件
- 交易信号扩展

### 快速开始

参考示例插件：
- [自定义因子插件](https://github.com/dawn-whales/plugin-custom-factor) — 添加技术指标因子
- [自定义数据源插件](https://github.com/dawn-whales/plugin-custom-data-source) — 接入外部数据

### 插件结构

```
my-plugin/
├── manifest.json    # 插件元数据（必需）
├── index.js         # 插件入口（必需）
└── config.json      # 插件配置（可选）
```

详见 [插件 API 参考](/reference/plugin-api)

---

## 问题反馈

### Bug 报告

在 [GitHub Issues](https://github.com/dawn-whales/dawn-whales/issues) 提交，请包含：

- **版本号**：DAWN WHALES 版本
- **环境**：操作系统 + Electron 版本
- **复现步骤**：清晰的操作步骤
- **预期行为**：期望发生什么
- **实际行为**：实际发生了什么
- **截图/日志**：如果适用

### 功能建议

在 [GitHub Discussions](https://github.com/dawn-whales/dawn-whales/discussions) 提出，请说明：

- 功能的使用场景
- 期望的行为
- 是否有替代方案

---

## 联系我们

| 渠道 | 链接 |
|------|------|
| GitHub Issues | https://github.com/dawn-whales/dawn-whales/issues |
| GitHub Discussions | https://github.com/dawn-whales/dawn-whales/discussions |
| 邮件 | dev@dawnwhales.app |

---

*感谢每一位贡献者！你的参与让 DAWN WHALES 变得更好。* 🦞
