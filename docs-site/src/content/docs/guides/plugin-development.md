---
title: 插件 API 参考
description: QUANT MOO 插件系统完整 API 参考 — 清单格式、生命周期、权限模型、沙盒规则、IPC通道、示例代码
---

# 🔌 插件 API 参考

> 版本: v2.6.0 | 最后更新: 2026-06-16

## 概述

QUANT MOO 插件系统允许开发者扩展平台功能，包括自定义因子计算、数据源接入、UI 组件和交易信号处理。插件运行在隔离沙盒中，通过明确的权限模型确保安全性。

### 核心特性

| 特性 | 说明 |
|------|------|
| 🔐 沙盒隔离 | 插件运行在受限上下文中，分别崩溃不影响主应用 |
| 🔑 权限模型 | 8 种细粒度权限，危险权限需用户确认 |
| 🔄 完整生命周期 | validate → download → install → activate → deactivate → uninstall |
| 🏪 插件市场 | 搜索、安装、评分、版本管理 |
| 📦 依赖管理 | 语义化版本 + 依赖解析 + 兼容性检查 |
| 🔒 SHA-256 校验 | 安装包完整性验证 |

---

## 清单格式

每个插件必须包含 `manifest.json`：

```json
{
  "id": "publisher.plugin-name",
  "name": "插件显示名称",
  "version": "1.0.0",
  "description": "插件功能描述",
  "author": {
    "name": "作者名",
    "email": "author@example.com",
    "url": "https://author.example.com"
  },
  "minAppVersion": "2.6.0",
  "dependencies": {
    "other-plugin": ">=1.0.0"
  },
  "permissions": ["market-data", "storage", "notifications"],
  "main": "index.js",
  "ui": {
    "component": "panel.jsx",
    "slot": "sidebar"
  },
  "icon": "🧬",
  "repository": "https://github.com/author/plugin",
  "license": "MIT",
  "tags": ["factor", "indicator", "technical-analysis"],
  "sha256": "abc123..."
}
```

### 字段说明

| 字段 | 类型 | 必需 | 说明 |
|------|------|:---:|------|
| `id` | string | ✅ | 唯一标识，格式: `publisher.plugin-name` |
| `name` | string | ✅ | 显示名称 |
| `version` | string | ✅ | 语义化版本 (semver) |
| `description` | string | ✅ | 功能描述（≤200字符） |
| `author` | object | ✅ | 作者信息 |
| `minAppVersion` | string | ✅ | 最低 QUANT MOO 版本要求 |
| `dependencies` | object | ❌ | 插件依赖 (`"plugin-id": "version-range"`) |
| `permissions` | string[] | ✅ | 所需权限列表 |
| `main` | string | ✅ | 入口文件（相对于插件根目录） |
| `ui` | object | ❌ | UI 组件配置 |
| `icon` | string | ❌ | 图标（emoji 或 URL） |
| `repository` | string | ❌ | 代码仓库 URL |
| `license` | string | ❌ | 许可证 (SPDX identifier) |
| `tags` | string[] | ❌ | 市场搜索标签 |
| `sha256` | string | ❌ | 安装包 SHA-256（用于完整性校验） |

---

## 权限模型

### 8 种权限

| 权限 | 标识 | 危险等级 | 说明 |
|------|------|:---:|------|
| 网络 | `network` | 🟡 中 | HTTP/WebSocket 请求 |
| 文件系统 | `filesystem` | 🔴 高 | 读写本地文件 |
| 行情数据 | `market-data` | 🟢 低 | 访问行情报价和 K 线 |
| 交易执行 | `trade-exec` | 🔴 高 | 执行交易订单 |
| UI 扩展 | `ui` | 🟡 中 | 添加自定义 UI 组件 |
| 通知推送 | `notifications` | 🟢 低 | 发送桌面通知 |
| 持久存储 | `storage` | 🟢 低 | 插件私有存储（上限 10MB） |
| 身份信息 | `identity` | 🔴 高 | 访问用户身份信息 |

### 危险权限确认

以下权限需要用户在安装时显式确认：
- `trade-exec` — 可能执行真实交易
- `filesystem` — 可能读取用户文件
- `identity` — 可能获取用户身份

---

## 生命周期

```
  available ──→ downloading ──→ validating ──→ installed
                                                   │
                                          ┌────────┴────────┐
                                          ↓                  ↓
                                       active            inactive
                                          │                  │
                                          └────────┬─────────┘
                                                   ↓
                                             uninstalling
```

### 状态说明

| 状态 | 说明 | 触发条件 |
|------|------|----------|
| `available` | 市场中可见，未安装 | 初始状态 |
| `downloading` | 正在下载 | 用户点击安装 |
| `validating` | 签名校验 + 兼容性检查 | 下载完成 |
| `installed` | 已安装但未激活 | 校验通过 |
| `active` | 正在运行 | 用户激活 |
| `inactive` | 已停止 | 用户停用 |
| `error` | 异常状态 | 激活/运行失败 |
| `uninstalling` | 正在卸载 | 用户卸载 |

---

## 插件 API (PluginExposedAPI)

插件通过 `init(api)` 接收以下 API 对象：

### Logger

```javascript
api.logger.debug('调试信息');
api.logger.info('普通信息');
api.logger.warn('警告信息');
api.logger.error('错误信息');
```

### 行情数据

```javascript
// 获取单次报价
const quote = await api.getQuote('BTC/USDT');
// → { symbol: 'BTC/USDT', price: 65000, timestamp: 1718500000000 }

// 订阅实时行情
const unsubscribe = api.subscribe('BTC/USDT', (quote) => {
  console.log(quote.price);
});
// 取消订阅
unsubscribe();
```

### 配置管理

```javascript
// 读取配置
const config = await api.getConfig();

// 写入配置
await api.setConfig({ updateInterval: 60000 });
```

### 存储 (上限 10MB)

```javascript
// 写入
await api.storage.set('key', { data: 'value' });

// 读取
const value = await api.storage.get('key');

// 删除
await api.storage.delete('key');

// 列出所有 keys
const keys = await api.storage.keys();
```

### 通知

```javascript
api.notify('标题', '消息正文', {
  urgency: 'normal' // 'low' | 'normal' | 'critical'
});
```

### 事件系统

```javascript
// 发射自定义事件
api.emit('custom-event', { data: 'value' });

// 注册生命周期钩子
api.on('onActivate', () => { /* 插件激活 */ });
api.on('onDeactivate', () => { /* 插件停用 */ });
api.on('onTimer', () => { /* 定时触发 */ });
```

---

## 生命周期钩子

| 钩子 | 触发时机 | 用途 |
|------|----------|------|
| `onInit` | 插件初始化 | 加载配置、建立连接 |
| `onActivate` | 插件激活 | 启动服务、订阅数据 |
| `onDeactivate` | 插件停用 | 清理资源、取消订阅 |
| `onUninstall` | 插件卸载 | 删除插件数据 |
| `onMarketData` | 收到行情数据 | 处理实时报价 |
| `onTradeSignal` | 生成交易信号 | 响应交易信号 |
| `onOrderUpdate` | 订单状态变更 | 跟踪订单 |
| `onPositionUpdate` | 持仓变更 | 监控持仓 |
| `onTimer` | 定时触发 | 周期性任务（需插件自行调度） |

---

## 沙盒规则

插件运行在受限的 JavaScript 上下文中：

### ✅ 可用的 API

- `Math`, `Date`, `JSON`, `Promise`
- `Array`, `Object`, `String`, `Number`, `Boolean`
- `Map`, `Set`, `RegExp`
- `Error`, `TypeError`
- `setTimeout`, `clearTimeout`, `setInterval`, `clearInterval`
- `console` (重定向到 electron-log)

### ❌ 不可用的 API

- `require()` — 禁止加载模块
- `process` — 禁止访问进程
- `global` / `globalThis` — 禁止访问全局对象
- `fs` — 禁止直接文件操作
- `child_process` — 禁止创建子进程
- `eval()` / `new Function()` — 禁止动态代码执行

### 崩溃隔离

- 插件崩溃不会影响主应用
- 插件之间相互隔离
- 超时任务可被强制终止

---

## 插件入口文件

插件入口文件 (`index.js`) 必须导出一个包含 `init` 函数的对象：

```javascript
// index.js — 最小插件模板
module.exports = {
  name: 'My Plugin',
  version: '1.0.0',

  init(api) {
    api.logger.info('Plugin initialized');

    // 注册生命周期钩子
    api.on('onActivate', () => {
      api.logger.info('Plugin activated');
      api.notify('My Plugin', '插件已激活');
    });

    api.on('onDeactivate', () => {
      api.logger.info('Plugin deactivated');
    });

    // 返回插件公开的方法
    return {
      doSomething: () => {
        api.logger.info('Custom action executed');
      },
    };
  },
};
```

---

## 示例插件

QUANT MOO 提供两个官方示例插件：

### 1. 自定义因子插件 (`QuantMoo.custom-factor`)

添加 4 个自定义技术指标因子：
- **BBW** (Bollinger Band Width) — 布林带宽度
- **VWRSI** (Volume-Weighted RSI) — 成交量加权 RSI
- **CMOM** (Custom Momentum) — 自定义动量因子
- **PPOS** (Price Position) — 价格位置百分比

```javascript
// 安装
await ipc.invoke('plugin:install', 'QuantMoo.custom-factor');
// 激活
await ipc.invoke('plugin:activate', 'QuantMoo.custom-factor');
```

### 2. 自定义数据源插件 (`QuantMoo.custom-data-source`)

支持三种数据源接入方式：
- **TradingView Webhook** — 信号接收
- **自定义 REST API** — 周期性拉取
- **CSV 文件导入** — 离线数据导入

依赖 `QuantMoo.custom-factor` ≥ 1.0.0

---

## 插件市场 API

### 搜索插件

```typescript
// IPC: 'plugin:search'
const results = await ipc.invoke('plugin:search', 'factor', ['technical-analysis']);
// → PluginInfo[]
```

### 安装插件

```typescript
// IPC: 'plugin:install'
await ipc.invoke('plugin:install', 'QuantMoo.custom-factor');
// 或从自定义源安装
await ipc.invoke('plugin:install', 'my-plugin', 'https://my-server.com/plugin.zip');
```

### 管理插件

```typescript
// 列出已安装
const plugins = await ipc.invoke('plugin:list');

// 获取单个
const plugin = await ipc.invoke('plugin:get', 'my-plugin');

// 激活/停用
await ipc.invoke('plugin:activate', 'my-plugin');
await ipc.invoke('plugin:deactivate', 'my-plugin');

// 卸载
await ipc.invoke('plugin:uninstall', 'my-plugin');

// 获取配置
const config = await ipc.invoke('plugin:config', 'my-plugin');
```

---

## IPC 通道参考

| 通道 | 方向 | 参数 | 返回 |
|------|:---:|------|------|
| `plugin:list` | Renderer → Main | — | `PluginInfo[]` |
| `plugin:install` | Renderer → Main | `pluginId: string, sourceUrl?: string` | `{ success: true }` |
| `plugin:uninstall` | Renderer → Main | `pluginId: string` | `{ success: true }` |
| `plugin:activate` | Renderer → Main | `pluginId: string` | `{ success: true }` |
| `plugin:deactivate` | Renderer → Main | `pluginId: string` | `{ success: true }` |
| `plugin:config` | Renderer → Main | `pluginId: string` | `Record<string, unknown>` |
| `plugin:search` | Renderer → Main | `query: string, tags?: string[]` | `PluginInfo[]` |
| `plugin:get` | Renderer → Main | `pluginId: string` | `PluginInfo \| null` |

---

## 市场发布

### 上架流程

1. 开发插件并测试
2. 创建 GitHub Release，附 `manifest.json` + `package.zip`
3. 计算 SHA-256: `sha256sum package.zip`
4. 填写上架申请表单
5. QUANT MOO 团队审核（1-3 个工作日）
6. 审核通过后上架

### 版本更新

- 遵循 [SemVer](https://semver.org/) 版本号
- 更新 `manifest.json` 中的 `version`
- 重新计算 `sha256`
- 提交新版本审核

---

## 最佳实践

1. **最小权限原则**: 只请求必需权限
2. **错误处理**: 所有异步操作应 try-catch
3. **资源清理**: `onDeactivate` 中释放所有资源
4. **日志规范**: 使用 `api.logger` 而非 `console.log`
5. **存储限制**: 插件存储上限 10MB，超限会抛错
6. **版本兼容**: 声明准确的 `minAppVersion`

---

*更多信息: [贡献指南](/guides/contributing) | [GitHub](https://github.com/quant-moo)*
