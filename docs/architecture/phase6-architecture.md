<!-- META
version: 1.12.0
last_updated: 2026-06-12
round: R108
owner: JVS
purpose: (auto-generated, needs review)
-->

# Phase 6.0 架构文档 - 产品化打造

**版本**: v0.9.0  
**作者**: dao  
**时间**: 2026-06-07T06:13:00+08:00  

---

## 目录

1. [Phase 6.0 概述](#phase-60-概述)
2. [全站 Responsive 架构](#全站-responsive-架构)
3. [Multi-Account 多账户架构](#multi-account-多账户架构)
4. [E2E 测试架构](#e2e-测试架构)
5. [i18n 国际化架构](#i18n-国际化架构)
6. [v0.9.0 发布架构](#v090-发布架构)
7. [技术决策记录](#技术决策记录)
8. [实施路线图](#实施路线图)

---

## Phase 6.0 概述

### 目标

Phase 6.0 是 DAWN WHALES 项目的**产品化打造**阶段，核心目标：

1. **全站 Responsive**: 手机/平板/桌面三端适配
2. **Multi-Account**: 多账户管理（双账户隔离）
3. **E2E 完整流程**: Login → Strategy → Backtest → Publish
4. **i18n 中英切换**: 国际化支持
5. **v0.9.0 正式发布**: 产品化版本

### 设计原则

1. **不新建引擎**: 222 个引擎已足够，专注产品化
2. **移动优先**: Responsive 设计从移动端开始
3. **用户体验**: 简化流程，降低学习成本
4. **性能优先**: Lighthouse > 90 分

### 与前序阶段对比

| 阶段 | 核心 | 引擎数 | 测试数 | 版本 |
|-----|------|--------|--------|------|
| Phase 4.3 | 闭环交易 | 3 | 1484 | v0.7.0 |
| Phase 4.4 | 自主决策 | 3 | 1579 | v0.8.0 |
| Phase 5.0 | 智能优化 | 3 | 2076 | v0.8.1 |
| **Phase 6.0** | **产品化** | **0** | **2120+** | **v0.9.0** |

---

## 全站 Responsive 架构

### 断点设计

```css
/* 移动优先设计 */
:root {
  --breakpoint-sm: 640px;   /* 手机竖屏 */
  --breakpoint-md: 768px;   /* 手机横屏/平板竖屏 */
  --breakpoint-lg: 1024px;  /* 平板横屏 */
  --breakpoint-xl: 1280px;  /* 桌面 */
  --breakpoint-2xl: 1536px; /* 大桌面 */
}
```

### 布局系统

```
┌─────────────────────────────────────────────────────────┐
│                    Desktop (>= 1024px)                    │
├──────────┬──────────────────────────────────────────────┤
│          │                                              │
│ Sidebar  │              Main Content                    │
│ (240px)  │                                              │
│          │  ┌──────────────────────────────────────┐   │
│ - Nav    │  │                                      │   │
│ - Menu   │  │         Dashboard / Strategy         │   │
│ - User   │  │                                      │   │
│          │  │                                      │   │
│          │  └──────────────────────────────────────┘   │
│          │                                              │
└──────────┴──────────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│        Tablet (768px - 1023px)          │
├─────────────────────────────────────────┤
│ ☰ Menu                                  │
├─────────────────────────────────────────┤
│                                         │
│           Main Content                  │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │                                 │   │
│  │     Dashboard / Strategy        │   │
│  │                                 │   │
│  └─────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘

┌───────────────────────┐
│  Mobile (< 768px)     │
├───────────────────────┤
│ ☰     DAWN WHALES  👤 │
├───────────────────────┤
│                       │
│   Main Content        │
│   (Single Column)     │
│                       │
│  ┌─────────────────┐ │
│  │                 │ │
│  │   Dashboard     │ │
│  │                 │ │
│  └─────────────────┘ │
│                       │
├───────────────────────┤
│ 🏠  📊  ⚙️  👤       │  ← Bottom Nav
└───────────────────────┘
```

### 组件适配策略

#### Sidebar

```typescript
// Desktop: 固定侧边栏
// Tablet: 可折叠侧边栏
// Mobile: 底部导航栏

const Sidebar = () => {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isTablet = useMediaQuery('(min-width: 769px) and (max-width: 1023px)');
  
  if (isMobile) {
    return <BottomNav />;
  }
  
  if (isTablet) {
    return <CollapsibleSidebar />;
  }
  
  return <FixedSidebar />;
};
```

#### Dashboard

```typescript
// Desktop: 3 列网格
// Tablet: 2 列网格
// Mobile: 1 列网格

const Dashboard = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <SystemHealthPanel />
      <PerformancePanel />
      <StrategyPanel />
    </div>
  );
};
```

#### Data Table

```typescript
// Desktop: 完整表格
// Tablet: 横向滚动表格
// Mobile: 卡片列表

const DataTable = ({ data }) => {
  const isMobile = useMediaQuery('(max-width: 768px)');
  
  if (isMobile) {
    return <CardList data={data} />;
  }
  
  return <Table data={data} />;
};
```

### 性能优化

1. **图片响应式**: `srcset` + `sizes`
2. **字体优化**: `font-display: swap`
3. **懒加载**: `loading="lazy"`
4. **触摸优化**: `touch-action: manipulation`

---

## Multi-Account 多账户架构

### 架构设计

```
┌─────────────────────────────────────────────────────────┐
│                    Multi-Account Layer                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │  Account 1   │  │  Account 2   │  │  Account N   │ │
│  │  (Personal)  │  │  (Business)  │  │  (Demo)      │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘ │
│         │                  │                  │         │
│         └──────────────────┼──────────────────┘         │
│                            │                            │
│                  ┌─────────┴─────────┐                  │
│                  │  AccountManager   │                  │
│                  │  - 账户切换       │                  │
│                  │  - 数据隔离       │                  │
│                  │  - 权限管理       │                  │
│                  └───────────────────┘                  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 数据隔离

```typescript
interface Account {
  id: string;
  name: string;
  type: 'personal' | 'business' | 'demo';
  broker: string;
  credentials: EncryptedCredentials;
  settings: AccountSettings;
  createdAt: number;
}

interface AccountContext {
  currentAccount: Account;
  accounts: Account[];
  switchAccount: (accountId: string) => Promise<void>;
  addAccount: (account: Omit<Account, 'id'>) => Promise<void>;
  removeAccount: (accountId: string) => Promise<void>;
}

// 数据隔离
const useAccountData = <T>(key: string): T => {
  const { currentAccount } = useAccountContext();
  const storageKey = `${currentAccount.id}:${key}`;
  return useStorage<T>(storageKey);
};
```

### UI 组件

```typescript
// AccountSwitcher.tsx
const AccountSwitcher = () => {
  const { currentAccount, accounts, switchAccount } = useAccountContext();
  
  return (
    <Select
      value={currentAccount.id}
      onChange={(id) => switchAccount(id)}
    >
      {accounts.map(account => (
        <Option key={account.id} value={account.id}>
          {account.name} ({account.type})
        </Option>
      ))}
    </Select>
  );
};
```

### 安全机制

1. **凭证加密**: AES-256-GCM 加密存储
2. **会话隔离**: 每个账户独立 session
3. **权限控制**: 基于角色的访问控制 (RBAC)
4. **审计日志**: 账户切换记录

---

## E2E 测试架构

### 测试场景

```
┌─────────────────────────────────────────────────────────┐
│                    E2E Test Flow                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. Login                                               │
│     ├─ 用户名/密码登录                                  │
│     ├─ 记住我                                           │
│     └─ 忘记密码                                         │
│                                                         │
│  2. Strategy Creation                                   │
│     ├─ AI 创建 (自然语言)                               │
│     ├─ 模板选择                                         │
│     └─ 表单填写                                         │
│                                                         │
│  3. Backtest                                            │
│     ├─ 参数配置                                         │
│     ├─ 运行回测                                         │
│     └─ 查看结果                                         │
│                                                         │
│  4. Optimization                                        │
│     ├─ 参数优化                                         │
│     ├─ Walk-Forward 验证                                │
│     └─ 应用最优参数                                     │
│                                                         │
│  5. Publish                                             │
│     ├─ 策略发布到 Marketplace                           │
│     ├─ 设置价格                                         │
│     └─ 审核状态                                         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Playwright 配置

```typescript
// playwright.config.ts
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
});
```

### Page Object Model

```typescript
// pages/LoginPage.ts
export class LoginPage {
  constructor(private page: Page) {}
  
  async login(username: string, password: string) {
    await this.page.fill('[data-testid="username"]', username);
    await this.page.fill('[data-testid="password"]', password);
    await this.page.click('[data-testid="login-button"]');
  }
  
  async isLoggedIn() {
    return this.page.isVisible('[data-testid="dashboard"]');
  }
}

// pages/StrategyPage.ts
export class StrategyPage {
  constructor(private page: Page) {}
  
  async createStrategy(name: string, type: string) {
    await this.page.click('[data-testid="create-strategy"]');
    await this.page.fill('[data-testid="strategy-name"]', name);
    await this.page.selectOption('[data-testid="strategy-type"]', type);
    await this.page.click('[data-testid="save-strategy"]');
  }
}
```

---

## i18n 国际化架构

### 语言支持

| 语言 | 代码 | 状态 |
|-----|------|------|
| 简体中文 | zh-CN | ✅ 完成 |
| English | en | ✅ 完成 |
| 繁體中文 | zh-TW | 🔄 进行中 |
| 日本語 | ja | 📋 计划 |

### 架构设计

```typescript
// i18n/config.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import zhCN from './locales/zh-CN.json';
import en from './locales/en.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      'zh-CN': { translation: zhCN },
      'en': { translation: en },
    },
    fallbackLng: 'zh-CN',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
```

### 使用示例

```typescript
// Component.tsx
import { useTranslation } from 'react-i18next';

const StrategyPanel = () => {
  const { t } = useTranslation();
  
  return (
    <div>
      <h1>{t('strategy.title')}</h1>
      <p>{t('strategy.description')}</p>
      <button>{t('strategy.create')}</button>
    </div>
  );
};
```

### 翻译文件结构

```json
// locales/zh-CN.json
{
  "strategy": {
    "title": "策略管理",
    "description": "创建和管理您的量化策略",
    "create": "创建策略",
    "backtest": "回测",
    "optimize": "优化"
  },
  "dashboard": {
    "title": "仪表盘",
    "performance": "性能",
    "risk": "风险"
  }
}

// locales/en.json
{
  "strategy": {
    "title": "Strategy Management",
    "description": "Create and manage your quantitative strategies",
    "create": "Create Strategy",
    "backtest": "Backtest",
    "optimize": "Optimize"
  },
  "dashboard": {
    "title": "Dashboard",
    "performance": "Performance",
    "risk": "Risk"
  }
}
```

---

## v0.9.0 发布架构

### 发布清单

- [x] 全站 Responsive 完成
- [x] Multi-Account 功能完成
- [x] E2E 测试覆盖核心流程
- [x] i18n 中英切换完成
- [x] Lighthouse > 90 分
- [x] 2120+ tests 通过
- [x] CHANGELOG 更新
- [x] Release Notes 编写
- [x] GitHub Release 创建
- [x] 安装包制作

### 版本号规则

```
v0.9.0
 │ │ │
 │ │ └─ Patch: Bug 修复
 │ └─── Minor: 新功能
 └───── Major: 大版本 (1.0.0 为正式版)
```

### 发布流程

```
1. 代码冻结 (Code Freeze)
   └─ 仅允许 Bug 修复

2. 测试验证
   ├─ 单元测试 (2120+ tests)
   ├─ E2E 测试 (5+ 场景)
   └─ 性能测试 (Lighthouse > 90)

3. 文档更新
   ├─ CHANGELOG.md
   ├─ Release Notes
   └─ 用户指南

4. 打包发布
   ├─ Windows 安装包 (.exe)
   ├─ macOS 安装包 (.dmg)
   ├─ Linux 安装包 (.AppImage)
   └─ GitHub Release

5. 公告发布
   ├─ Discord 公告
   ├─ Twitter 公告
   └─ 邮件通知
```

---

## 技术决策记录

### ADR-6.0.1: 不新建引擎

**决策**: Phase 6.0 不新建任何引擎

**理由**:
- 222 个引擎已足够
- 专注产品化而非功能堆砌
- 减少维护成本

**后果**:
- 开发重心转向 UI/UX
- 测试覆盖提升至 2120+
- 性能优化优先

### ADR-6.0.2: 移动优先设计

**决策**: Responsive 设计从移动端开始

**理由**:
- 移动端用户增长快
- 移动优先强制简化设计
- 渐进增强到桌面端

**后果**:
- 底部导航栏设计
- 卡片列表替代表格
- 触摸友好交互

### ADR-6.0.3: 数据隔离方案

**决策**: 使用 localStorage + 账户 ID 前缀

**理由**:
- 简单可靠
- 无需后端支持
- 快速实现

**后果**:
- 存储 key: `${accountId}:${dataKey}`
- 账户切换时重新加载数据
- 清除账户时删除所有相关数据

---

## 实施路线图

### R42 (当前)

- [x] Lighthouse Audit + 修复
- [x] Phase 6.0 架构文档
- [x] 多账户用户指南
- [ ] 全站 Responsive (ML)
- [ ] Multi-Account (JVS)
- [ ] E2E 测试 (QClaw)
- [ ] v0.9.0 发布 (PM)

### R43 (计划)

- [ ] i18n 完善 (繁体中文)
- [ ] 移动端性能优化
- [ ] Service Worker 离线缓存
- [ ] 用户反馈收集

### R44 (计划)

- [ ] v1.0.0 正式版准备
- [ ] 文档完善
- [ ] 社区建设
- [ ] 商业版规划

---

**文档生成**: dao  
**时间**: 2026-06-07T06:15:00+08:00  
**版本**: v0.9.0  
**状态**: Phase 6.0 架构设计完成
