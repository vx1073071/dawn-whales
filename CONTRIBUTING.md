# 贡献指南

**DAWN WHALES** 欢迎贡献！请阅读以下规范。

---

## 快速开始

```bash
git clone <repo-url>
cd dawn-whales
npm ci
npm run dev          # 启动开发
npm test             # 运行测试
npm run lint         # ESLint
npm run typecheck    # TypeScript
```

---

## 分支规范

| 前缀 | 用途 | 示例 |
|------|------|------|
| `feature/` | 新功能 | `feature/docker-support` |
| `fix/` | Bug 修复 | `fix/tsc-errors` |
| `refactor/` | 重构 | `refactor/i18n-migration` |
| `docs/` | 文档 | `docs/api-reference` |
| `chore/` | 构建/工具 | `chore/update-deps` |

创建分支：
```bash
git checkout -b feature/my-feature
```

---

## Commit 规范

```
<type>: <description>

feat: add Docker support for server deployment
fix: resolve TSC errors in billing component
refactor: extract utility functions to utils/math.ts
docs: update API reference for signal backtesting
chore: upgrade dependencies
```

### 支持的 type

- `feat` — 新功能
- `fix` — Bug 修复
- `refactor` — 代码重构
- `docs` — 文档变更
- `test` — 测试相关
- `chore` — 构建/工具/依赖
- `style` — 格式变更（不影响逻辑）
- `perf` — 性能优化

---

## PR Checklist

提交 Pull Request 前确认：

- [ ] `npm test` — 所有测试通过，0 fail
- [ ] `npm run lint` — ESLint 0 errors
- [ ] `npm run typecheck` — TypeScript 0 errors
- [ ] 不包含 console.log（生产代码中）
- [ ] 新增功能有对应测试
- [ ] 相关文档已更新

---

## 代码风格

项目使用 **ESLint** + **Prettier** 强约束：

```bash
npm run lint:fix     # 自动修复 ESLint
npm run format       # 自动格式化 (Prettier)
```

Pre-commit hook 会在 `git commit` 时自动运行：
- `eslint --fix` 对 `.ts/.tsx` 文件
- `prettier --write` 对 `.ts/.tsx/.json/.md/.css` 文件

---

## Commitizen 配置

可选：使用交互式提交工具

```bash
npm install -g commitizen cz-conventional-changelog
echo '{ "path": "cz-conventional-changelog" }' > ~/.czrc
git cz   # 替代 git commit
```

---

## 测试

```bash
npm test              # 全量测试
npm run test:unit     # 单元测试
npm run test:e2e      # E2E 测试
npm run coverage      # 覆盖率报告
```

覆盖率目标：
- Lines: ≥ 60%
- Branches: ≥ 50%
- Functions: ≥ 55%

---

## 目录结构

```
dawn-whales/
├── src/components/    # 前端 React 组件
├── electron/engine/   # 320+ 交易引擎
├── server/api/        # REST API
├── tests/             # 374 测试套件
└── docs/              # 文档
    ├── INDEX.md       # 文档导航
    ├── guides/        # 用户指南
    ├── api/           # API 参考
    ├── releases/      # Release Notes
    └── architecture/  # 架构文档
```

---

## 需要帮助？

- 查看 [文档索引](docs/INDEX.md)
- 阅读 [代码规范 + 无障碍说明](docs/guides/code-standard-a11y-guide.md)
- 提交 Issue: [GitHub Issues](https://github.com/vx1073071/dawn-whales/issues)
