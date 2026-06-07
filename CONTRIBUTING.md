# 贡献指南 (CONTRIBUTING.md)

感谢您对 DAWN WHALES 项目的关注！我们欢迎各种形式的贡献。

---

## 目录

1. [行为准则](#行为准则)
2. [如何贡献](#如何贡献)
3. [开发环境设置](#开发环境设置)
4. [代码规范](#代码规范)
5. [提交规范](#提交规范)
6. [Pull Request 流程](#pull-request-流程)
7. [Issue 指南](#issue-指南)
8. [社区支持](#社区支持)

---

## 行为准则

本项目采用 [Contributor Covenant](https://www.contributor-covenant.org/version/2/0/code_of_conduct/) 行为准则。参与本项目即表示您同意遵守其条款。

### 我们的承诺

- 营造友好、包容的环境
- 尊重不同的观点和经验
- 优雅地接受建设性批评
- 关注对社区最有利的事情

---

## 如何贡献

### 报告 Bug

如果您发现了 Bug，请创建一个 Issue 并选择 "Bug Report" 模板。

**在报告之前，请检查：**
- 是否已经存在相同的 Issue
- 是否可以在最新版本中复现
- 是否提供了足够的信息（错误日志、复现步骤等）

### 建议新功能

如果您有新功能的想法，请创建一个 Issue 并选择 "Feature Request" 模板。

**在建议之前，请考虑：**
- 功能是否符合项目的愿景和目标
- 是否有其他用户也需要这个功能
- 是否可以提供详细的设计方案

### 贡献代码

#### 小型修复（文档、Typo、小 Bug）

可以直接创建 Pull Request，无需提前创建 Issue。

#### 大型功能

建议先创建 Issue 讨论，获得维护者确认后再开始开发。

### 贡献文档

文档改进是非常有价值的贡献！包括：
- 修正拼写错误和语法错误
- 改进文档结构和清晰度
- 添加示例和教程
- 翻译文档

### 贡献测试

测试是项目质量的保障！您可以：
- 为现有功能添加测试
- 改进测试覆盖率
- 修复失败的测试

---

## 开发环境设置

### 系统要求

- Node.js >= 18.0.0
- npm >= 9.0.0
- Git >= 2.30.0

### 安装步骤

1. **Fork 项目**

   点击 GitHub 页面右上角的 "Fork" 按钮。

2. **克隆仓库**

   ```bash
   git clone https://github.com/YOUR_USERNAME/dawn-whales.git
   cd dawn-whales
   ```

3. **安装依赖**

   ```bash
   npm install
   ```

4. **启动开发服务器**

   ```bash
   npm run dev
   ```

5. **运行测试**

   ```bash
   npm test
   ```

6. **构建项目**

   ```bash
   npm run build
   ```

### 项目结构

```
dawn-whales/
├── electron/          # Electron 主进程代码
│   ├── engine/        # 核心引擎（策略、回测、优化等）
│   ├── ipc/           # IPC 通信
│   └── broker/        # 券商适配器
├── src/               # React 前端代码
│   ├── components/    # React 组件
│   ├── hooks/         # 自定义 Hooks
│   ├── store/         # Zustand 状态管理
│   ├── i18n/          # 国际化
│   └── utils/         # 工具函数
├── tests/             # 测试文件
├── docs/              # 文档
└── scripts/           # 构建和部署脚本
```

---

## 代码规范

### TypeScript 规范

- 使用 TypeScript 严格模式
- 避免使用 `any` 类型
- 使用有意义的变量和函数名
- 添加 JSDoc 注释

```typescript
// ✅ 好的示例
export function calculateSharpeRatio(
  returns: number[],
  riskFreeRate: number = 0.02
): number {
  if (returns.length === 0) return 0;
  
  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const excessReturn = avgReturn - riskFreeRate;
  const stdDev = calculateStdDev(returns);
  
  return stdDev === 0 ? 0 : excessReturn / stdDev;
}

// ❌ 不好的示例
export function calc(r: any[]): any {
  // ...
}
```

### React 规范

- 使用函数组件和 Hooks
- 组件名使用 PascalCase
- 使用 TypeScript 定义 Props 类型
- 避免在渲染函数中创建新对象

```typescript
// ✅ 好的示例
interface StrategyCardProps {
  strategy: Strategy;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export const StrategyCard: React.FC<StrategyCardProps> = ({
  strategy,
  onEdit,
  onDelete,
}) => {
  // ...
};

// ❌ 不好的示例
export function StrategyCard(props: any) {
  // ...
}
```

### 样式规范

- 使用 Tailwind CSS
- 遵循项目的颜色和设计系统
- 使用语义化的类名

### 测试规范

- 使用 Vitest 进行单元测试
- 使用 Playwright 进行 E2E 测试
- 测试覆盖率目标：核心模块 > 95%
- 测试文件命名：`*.test.ts` 或 `*.spec.ts`

```typescript
// ✅ 好的测试示例
describe('calculateSharpeRatio', () => {
  it('should return 0 for empty returns', () => {
    expect(calculateSharpeRatio([])).toBe(0);
  });

  it('should calculate sharpe ratio correctly', () => {
    const returns = [0.1, 0.2, 0.15, 0.25];
    const result = calculateSharpeRatio(returns, 0.02);
    expect(result).toBeCloseTo(1.5, 2);
  });
});
```

---

## 提交规范

我们使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范。

### 提交消息格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type 类型

- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式（不影响功能）
- `refactor`: 代码重构
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建/工具/依赖

### Scope 范围

- `engine`: 核心引擎
- `ui`: 前端 UI
- `i18n`: 国际化
- `test`: 测试
- `docs`: 文档

### 示例

```
feat(engine): add strategy optimization engine

- Implement grid search optimization
- Add random search optimization
- Support multiple objectives (Sharpe, return, drawdown)

Closes #123
```

```
fix(ui): fix strategy card responsive layout

- Fix card overflow on mobile devices
- Adjust padding and margin
- Add proper breakpoints

Fixes #456
```

```
docs(i18n): add Japanese translation

- Translate user manual to Japanese
- Add i18n keys for new features
- Update language switcher

Closes #789
```

---

## Pull Request 流程

### 创建 PR

1. **创建分支**

   ```bash
   git checkout -b feat/your-feature-name
   # 或
   git checkout -b fix/your-bug-fix
   ```

2. **提交更改**

   ```bash
   git add .
   git commit -m "feat(engine): add your feature"
   ```

3. **推送分支**

   ```bash
   git push origin feat/your-feature-name
   ```

4. **创建 Pull Request**

   - 访问 GitHub 仓库页面
   - 点击 "New Pull Request"
   - 选择您的分支
   - 填写 PR 描述（使用 PR 模板）

### PR 审查流程

1. **自动化检查**
   - CI 会自动运行测试
   - 代码质量检查
   - 构建验证

2. **人工审查**
   - 至少需要 1 位维护者批准
   - 可能需要多轮讨论和修改

3. **合并**
   - 所有检查通过后，维护者会合并 PR
   - 使用 Squash and Merge 保持提交历史清晰

### PR 最佳实践

- ✅ 保持 PR 小而专注
- ✅ 提供清晰的描述和截图
- ✅ 确保所有测试通过
- ✅ 及时响应审查意见
- ❌ 避免在一个 PR 中包含多个不相关的更改
- ❌ 避免强制推送已审查的分支

---

## Issue 指南

### 报告 Bug

使用 "Bug Report" 模板，提供以下信息：

- **环境信息**: 操作系统、Node.js 版本、浏览器版本
- **复现步骤**: 详细的操作步骤
- **期望行为**: 您期望发生什么
- **实际行为**: 实际发生了什么
- **错误日志**: 完整的错误信息
- **截图**: 如果适用

### 建议功能

使用 "Feature Request" 模板，提供以下信息：

- **功能描述**: 您希望实现什么功能
- **使用场景**: 为什么需要这个功能
- **替代方案**: 是否考虑过其他解决方案
- **额外信息**: 任何相关的上下文

### Issue 标签

- `bug`: Bug 报告
- `enhancement`: 功能增强
- `documentation`: 文档相关
- `good first issue`: 适合新手
- `help wanted`: 需要帮助
- `priority:high`: 高优先级
- `priority:medium`: 中优先级
- `priority:low`: 低优先级

---

## 社区支持

### 沟通渠道

- **GitHub Issues**: Bug 报告和功能请求
- **GitHub Discussions**: 讨论和问答
- **Discord**: 实时聊天（链接待添加）
- **Email**: support@dawn-whales.ai

### 获取帮助

- 查看 [文档](./docs/README.md)
- 搜索已有的 Issues 和 Discussions
- 在 Discussions 中提问
- 加入 Discord 社区

### 成为维护者

如果您持续贡献并表现出色，可能会被邀请成为维护者。维护者可以：
- 审查和合并 PR
- 管理 Issues
- 参与项目决策
- 发布新版本

---

## 致谢

感谢所有贡献者！您的贡献让 DAWN WHALES 变得更好。

### 贡献者列表

查看 [贡献者页面](https://github.com/vx1073071/dawn-whales/graphs/contributors)

### 特别感谢

- 所有提交 Bug 报告的用户
- 所有贡献代码的开发者
- 所有改进文档的写作者
- 所有参与讨论的社区成员

---

## 许可证

通过贡献代码，您同意您的贡献将遵循项目的 [MIT 许可证](./LICENSE)。

---

**最后更新**: 2026-06-08  
**维护者**: DAWN WHALES Team  
**联系方式**: support@dawn-whales.ai
