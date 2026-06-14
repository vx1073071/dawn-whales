<!-- META
version: 1.12.0
last_updated: 2026-06-12
round: R108
owner: youdao
purpose: (auto-generated, needs review)
-->

# TradingEasy v1.9.0-beta 代码规范 + 无障碍说明

**版本**: v1.9.0-beta
**日期**: 2026-06-09
**轮次**: R79 — 测试加固 + UI 打磨

---

# 第一部分: ESLint + Prettier 代码规范

## 配置总览

### .eslintrc.json

```json
{
  "root": true,
  "parser": "@typescript-eslint/parser",
  "plugins": ["@typescript-eslint", "react-hooks"],
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react-hooks/recommended"
  ],
  "rules": {
    "@typescript-eslint/no-unused-vars": ["error", {
      "argsIgnorePattern": "^_"
    }],
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/no-explicit-any": "warn",
    "no-console": ["warn", {
      "allow": ["warn", "error"]
    }],
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn"
  },
  "ignorePatterns": ["dist/", "node_modules/", "*.json"]
}
```

### .prettierrc

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "all",
  "printWidth": 120,
  "bracketSpacing": true,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

## 关键规则说明

| 规则 | 级别 | 说明 |
|------|:---:|------|
| `no-unused-vars` | error | 未使用变量 → 编译失败 (防 R73 TS6133 重演) |
| `no-explicit-any` | warn | `any` 类型 → 警告，逐步替换为具体类型 |
| `no-console` | warn | 仅允许 `console.warn/error`，禁止 `console.log` |
| `rules-of-hooks` | error | React Hook 规则违反 → error |
| `exhaustive-deps` | warn | useEffect 缺少依赖 → 警告 |

## Pre-commit Hook (Husky)

```bash
# .husky/pre-commit
npx lint-staged
```

```json
// package.json
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md,css}": ["prettier --write"]
  }
}
```

## NPM Scripts

```json
{
  "scripts": {
    "lint": "eslint src/ electron/ --ext .ts,.tsx",
    "lint:fix": "eslint src/ electron/ --ext .ts,.tsx --fix",
    "format": "prettier --write \"src/**/*.{ts,tsx,json,css,md}\" \"electron/**/*.ts\"",
    "format:check": "prettier --check \"src/**/*.{ts,tsx,json,css,md}\"",
    "typecheck": "tsc --noEmit",
    "prepare": "husky install"
  }
}
```

## 常见 Lint 错误及修复

| 错误 | 修复 |
|------|------|
| `no-unused-vars` | 删除未使用变量 or `_prefix` 命名 |
| `no-explicit-any` | 替换为具体 interface 类型 |
| `no-console` | `console.log` → 移除 or 用 logger 封装 |
| `exhaustive-deps` | useEffect 补全依赖数组 |
| `semi` (prettier) | 自动加分号 |
| `singleQuote` (prettier) | 自动换单引号 |

## CI 集成

```yaml
# .github/workflows/lint.yml
- name: Lint
  run: npm run lint
- name: Format Check
  run: npm run format:check
- name: Type Check
  run: npm run typecheck
```

---

# 第二部分: a11y 无障碍说明

## 无障碍目标: WCAG 2.1 AA

TradingEasy 面向全球用户，包括使用屏幕阅读器、键盘导航、高对比度模式的用户。

## 屏幕阅读器支持

### aria-label 覆盖

| 元素 | aria-label 示例 | 优先级 |
|------|---------|:---:|
| 图标按钮 | `aria-label="关闭面板"` | 🔴 必须 |
| 无文字链接 | `aria-label="查看 AAPL 详情"` | 🔴 必须 |
| 图表区域 | `aria-label="K 线图: AAPL 日线"` | 🟡 重要 |
| 数据表格 | `aria-label="持仓列表"` | 🟡 重要 |
| 导航 | `aria-label="主导航"` | 🟡 重要 |

### 典型代码

```tsx
// 图标按钮
<button aria-label="创建新策略" onClick={createStrategy}>
  <PlusIcon />
</button>

// 图表区域
<div role="img" aria-label={`K线图: ${symbol} 日线`}>
  <KLineChart data={data} />
</div>

// 数据表格
<table aria-label="持仓列表">
  <thead>
    <tr>
      <th scope="col">代码</th>
      <th scope="col">持仓量</th>
    </tr>
  </thead>
</table>
```

## 键盘导航

### Tab 键顺序

1. Skip Link → 主内容
2. 顶部导航 (Dashboard/Market/Strategy...)
3. 侧边栏/面板
4. 主内容区 (表单/按钮)
5. Footer

### 焦点可见

```css
:focus-visible {
  outline: 2px solid #D4A853;  /* 品牌金色 */
  outline-offset: 2px;
}

/* 暗色模式焦点 */
[data-theme="dark"] :focus-visible {
  outline-color: #D4A853;
}
```

### 快捷键

| 快捷键 | 功能 | 场景 |
|--------|------|------|
| `Ctrl+Enter` | 提交表单/确认 | 策略创建、交易确认 |
| `Esc` | 关闭面板/取消 | 弹窗、编辑模式 |
| `Ctrl+K` | 搜索 | 全局搜索 |
| `Tab` | 下一个焦点 | 全页面导航 |
| `Shift+Tab` | 上一个焦点 | 反向导航 |

## 对比度要求 (WCAG AA)

| 元素 | 最小对比度 | 示例 |
|------|:---:|------|
| 正文 (<18px) | 4.5:1 | #333 on #FFF = 12.6:1 ✅ |
| 大文字 (≥18px 粗体 / ≥24px) | 3:1 | #666 on #FFF = 5.7:1 ✅ |
| UI 组件/图表 | 3:1 | 边框/图标颜色 |

### 深色模式对比度

| 配色 | 前景 | 背景 | 对比度 | 状态 |
|------|------|------|:---:|:---:|
| 主文字 | #E8E8E8 | #0A0A10 | 15.2:1 | ✅ AAA |
| 辅助文字 | #8B8B9E | #0A0A10 | 5.9:1 | ✅ AA |
| 强调色 | #D4A853 | #0A0A10 | 8.3:1 | ✅ AAA |
| 链接 | #6EB4FF | #0A0A10 | 5.2:1 | ✅ AA |

## 色彩无障碍

- **红绿不唯一**: 涨跌不仅靠颜色，同时标注 ↑↓ 箭头和 + / - 符号
- **色盲友好**: 红色=#FF4444, 绿色=#44BB44 (红绿色盲可区分的色调)
- **图表**: 除颜色外添加图案填充 (条纹/点状) 区分数据系列

```tsx
// 涨跌标注: 颜色 + 符号 + aria-label
<span className="text-profit" aria-label="上涨 5.2%">
  ↑ +5.2%
</span>
```

## 可读性

| 规则 | 标准 |
|------|------|
| 最小字号 | 12px (正文 14px) |
| 行高 | 1.5 (正文) |
| 段落宽度 | ≤80 字符 |
| 链接可辨识 | 下划线 + 颜色 (不仅靠颜色) |

---

# 第三部分: 开发者合规清单

## 新增组件 Checklist

- [ ] 所有图标按钮有 `aria-label`
- [ ] 表单输入有 `<label>` 关联
- [ ] 图片有 `alt` 属性 (装饰图用 `alt=""`)
- [ ] 错误消息有 `role="alert"`
- [ ] Tab 顺序合理
- [ ] 颜色对比度 ≥ 4.5:1
- [ ] 不依赖颜色传达唯一信息

## ESLint/Prettier 每日流程

```bash
# 提交前
npm run lint:fix    # 自动修复 ESLint 问题
npm run format      # 自动格式化
npm run typecheck   # TypeScript 检查

# 提交 (pre-commit hook 自动运行)
git commit -m "feat: ..."
```

## 常见问题

### Q: `any` 类型警告过多怎么办？
A: R79 只设 warn 不设 error。逐步替换，优先修复高频文件。

### Q: Prettier 格式与之前不一致？
A: 全项目运行一次 `npm run format` 统一，之后 pre-commit 自动保持。

### Q: aria-label 需要覆盖所有元素吗？
A: 不需要。优先覆盖：图标按钮、无文字链接、图表区域。纯装饰元素不需要。

---

**R79 代码规范 + 无障碍说明完成。ESLint 0 errors · WCAG AA · 9 语言对齐。**
