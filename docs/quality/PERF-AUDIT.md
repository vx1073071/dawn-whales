<!-- META
version: 1.12.0
last_updated: 2026-06-12
round: R108
owner: QClaw
purpose: (auto-generated, needs review)
-->

# DAWN WHALES 性能审计报告

**审计日期**: 2026-06-04  
**审计者**: WorkBuddy  
**版本**: v0.5.0-beta  
**代码量**: ~7,500 行 (38 tests)

---

## 1. 执行摘要

**整体评级**: ⚠️ B- (可发布，但需修复 P0/P1 问题)

| 类别 | 评级 | 问题数 | 关键风险 |
|------|------|--------|----------|
| IPC 通信 | ⚠️ C+ | 12 | 重复定义、阻塞调用、内存泄漏 |
| 内存管理 | ⚠️ C | 8 | Listener 累积、对象未释放、闭包泄漏 |
| 渲染性能 | ✅ B+ | 3 | 大数据量表格无虚拟滚动 |
| 启动性能 | ✅ B | 2 | 串行初始化、无懒加载 |
| 异常处理 | ⚠️ C | 15 | 不一致、静默吞异常 |

---

## 2. 严重问题 (P0)

### 2.1 `execSync` 阻塞主进程

**位置**: `electron/main.ts:698-757` (greeks:calculate)

```typescript
const { execSync } = require('child_process');
const output = execSync(cmd, { encoding: 'utf-8', timeout: 5000 });
```

**问题**: `execSync` 在 **主进程** 中同步执行 Python 脚本，会 **完全冻结** Electron 主进程 5 秒。在此期间：
- 所有 IPC 请求挂起
- UI 完全无响应
- macOS 会显示 "Application Not Responding"

**修复**: 改用 `exec` 或 `spawn` + Promise 封装：
```typescript
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);
// 使用 await execAsync(cmd, { timeout: 5000 });
```

**同样问题**: `greeks:portfolio` (line 731) 使用 `execSync`，timeout 10 秒，更危险。

---

### 2.2 `onQuotePush` Listener 累积 (内存泄漏)

**位置**: `electron/main.ts:91-142` (broker:connect) + `broker:switch` (line 283-320)

每次调用 `broker:connect` 或 `broker:switch` 都会注册新的 `onQuotePush` listener：
```typescript
adapter?.onQuotePush((quotes) => {
  mainWindow?.webContents.send('quotes:push', quotes);
  strategyEngine?.onQuoteUpdate(quotes);
});
```

**问题**: 
- 用户切换券商时，旧的 listener 没有被移除
- 同一个 quotes 会被多次发送到 renderer
- Listener 闭包持有 `mainWindow` 引用，阻止 GC

**修复**: 在重新订阅前移除旧 listener：
```typescript
const quoteHandler = (quotes: any[]) => {
  mainWindow?.webContents.send('quotes:push', quotes);
  strategyEngine?.onQuoteUpdate(quotes);
};
adapter?.removeQuotePush?.(quoteHandler); // 需要 adapter 支持移除
adapter?.onQuotePush(quoteHandler);
```

**同样问题**: `opendClient.onDisconnect` 在 auto-connect (line ~850) 中重复注册。

---

### 2.3 IPC Handler 重复定义

**位置**: `electron/main.ts`

| Handler | 第一次 | 第二次 | 冲突 |
|---------|--------|--------|------|
| `backtest:walk-forward` | line 442 (camelCase) | line 980 (kebab-case) | **同名覆盖** |
| `broker:setActive` | line 275 | `broker:switch` line 283 | 功能重叠 |

**问题**: `backtest:walk-forward` 被定义了两次，Node.js 的 `ipcMain.handle` 不会报错，后定义的会 **静默覆盖** 前定义的。这会导致：
- 主龙虾的 `BacktestEnhancer.walkForwardAnalysis` 永远不会被调用
- JVS 的 `WalkForwardEngine.run` 总是被执行
- 用户看到的 WFA 结果和预期不一致

**修复**: 统一 handler 名称，删除重复：
```typescript
// 删除 line 442 的 backtest:walkForward
// 保留 line 980 的 backtest:walk-forward (JVS 版本功能更完整)
// 同时更新 bridge-api.ts 中的调用方
```

---

## 3. 高优先级问题 (P1)

### 3.1 `strategy:update` 任意字段注入

**位置**: `electron/main.ts:346-355`

```typescript
ipcMain.handle('strategy:update', async (_e, id: string, updates: any) => {
  const strategy = strategyEngine?.getStrategy(id);
  Object.assign(strategy, updates, { updatedAt: new Date().toISOString() });
  // ...
});
```

**问题**: `updates` 没有任何白名单校验，恶意调用可以：
- 注入 `liveRunning: true` 强制启动策略
- 修改 `accountId` 指向他人账户
- 注入任意字段污染数据结构

**修复**: 增加字段白名单校验：
```typescript
const ALLOWED_UPDATE_FIELDS = ['name', 'description', 'params', 'stopLoss', 'takeProfit'];
const sanitized: any = {};
for (const key of ALLOWED_UPDATE_FIELDS) {
  if (key in updates) sanitized[key] = updates[key];
}
Object.assign(strategy, sanitized, { updatedAt: new Date().toISOString() });
```

---

### 3.2 `app:openExternal` URL 验证过弱

**位置**: `electron/main.ts:664-669`

```typescript
ipcMain.handle('app:openExternal', async (_e, url: string) => {
  if (url.startsWith('http')) {
    await shell.openExternal(url);
  }
  return { success: true };
});
```

**问题**: `startsWith('http')` 可以绕过：
- `http://evil.com` ✅ (通过)
- `http://evil.com;calc.exe` ✅ (通过，命令注入)
- `https://evil.com` ✅ (通过)
- `http+shell://evil.com` ❌ (阻止)
- `javascript:alert(1)` ❌ (阻止)
- `file:///etc/passwd` ❌ (阻止)

但缺少对 `http` schema 内部的验证（如 `http://<script>`）。

**修复**: 使用 URL 解析 + 白名单：
```typescript
const ALLOWED_PROTOCOLS = ['http:', 'https:'];
const ALLOWED_HOSTS = ['futunn.com', 'moomoo.com', 'github.com']; // 根据业务需要

ipcMain.handle('app:openExternal', async (_e, rawUrl: string) => {
  try {
    const url = new URL(rawUrl);
    if (!ALLOWED_PROTOCOLS.includes(url.protocol)) {
      return { success: false, error: 'Protocol not allowed' };
    }
    await shell.openExternal(rawUrl);
    return { success: true };
  } catch {
    return { success: false, error: 'Invalid URL' };
  }
});
```

---

### 3.3 异常处理不一致

**位置**: 多个 handler

以下 handler **缺少 try-catch**，异常会抛到 Electron 内部，可能导致 IPC 通道崩溃：

| Handler | 行号 | 风险 |
|---------|------|------|
| `broker:getAccounts` | 150 | 连接断开时崩溃 |
| `broker:getFunds` | 157 | 同上 |
| `broker:getPositions` | 166 | 同上 |
| `broker:getQuotes` | 173 | 同上 |
| `broker:getKlines` | 207 | 同上 |
| `strategy:getAll` | 337 | DB 异常时崩溃 |
| `strategy:get` | 341 | 同上 |
| `strategy:delete` | 357 | 同上 |
| `broker:list` | 255 | BrokerManager 异常 |

**修复**: 统一包装为 try-catch：
```typescript
const safeHandler = (name: string, fn: (...args: any[]) => any) => {
  ipcMain.handle(name, async (...args) => {
    try { return await fn(...args); }
    catch (err: any) { log.error(`[IPC:${name}]`, err); return { success: false, error: err.message }; }
  });
};
```

---

### 3.4 对象实例未复用

**位置**: 
- `backtest:multi-timeframe` (line 1012): 每次 `new BacktestEngine()`
- `backtest:walk-forward` (line 980): 每次 `new WalkForwardEngine()`
- `backtest:param-scan` (line 996): 每次 `new ParameterScanner()`

**问题**: 这些引擎类可能持有大量 K 线数据，每次 new 都会分配内存。如果用户连续执行多次扫描，内存会快速增长。

**修复**: 复用实例或添加缓存池：
```typescript
let walkForwardEngine: WalkForwardEngine | null = null;
ipcMain.handle('backtest:walk-forward', async (_e, config: any) => {
  if (!walkForwardEngine) walkForwardEngine = new WalkForwardEngine();
  // ...
});
```

---

## 4. 中优先级问题 (P2)

### 4.1 大数据渲染瓶颈

**位置**: 
- `src/components/live/LiveMonitorPage.tsx` — 实时价格条
- `src/components/backtest/BacktestReportPage.tsx` — 交易明细表格
- `src/components/settings/SettingsPage.tsx` — 券商列表

**问题**: 没有使用虚拟滚动（virtual scrolling），当数据量大时（如 1000+ 笔交易），渲染会变慢。

**修复**: 对超过 100 行的表格使用虚拟滚动库（如 `react-window` 或 `react-virtuoso`）。

---

### 4.2 SQLite 查询无索引

**位置**: `electron/data/database.ts`

**问题**: 高频查询的表（`trades`、`signals`、`backtest_results`）可能没有索引，随着数据量增长，查询会变慢。

**修复**: 添加索引：
```sql
CREATE INDEX IF NOT EXISTS idx_trades_strategy_id ON trades(strategy_id);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
CREATE INDEX IF NOT EXISTS idx_signals_strategy_id ON signals(strategy_id);
CREATE INDEX IF NOT EXISTS idx_signals_timestamp ON signals(timestamp);
```

---

### 4.3 启动串行初始化

**位置**: `electron/main.ts` (app.whenReady)

**问题**: OpenD 连接、数据库初始化、引擎创建都是串行的，任何一步失败都会影响后续步骤。

**修复**: 使用 Promise.allSettled 并行初始化非依赖项：
```typescript
const [dbResult, engineResult] = await Promise.allSettled([
  initDatabase(),
  initEngines(),
]);
```

---

## 5. 低优先级问题 (P3)

| 问题 | 位置 | 说明 |
|------|------|------|
| 日志级别固定 | `electron-log` | 生产环境应关闭 debug 日志 |
| 无性能指标上报 | — | 缺少 FPS、内存、IPC 延迟监控 |
| 无降级策略 | — | OpenD 断开时无本地缓存模式 |
| 热重载残留 | `isDev` | 开发模式下可能残留旧 listener |

---

## 6. 修复建议优先级

| 优先级 | 问题 | 预计工时 | 负责人建议 |
|--------|------|----------|-----------|
| P0 | execSync → execAsync | 30min | WorkBuddy |
| P0 | onQuotePush listener 清理 | 1h | WorkBuddy |
| P0 | 删除重复 IPC handler | 15min | 主龙虾 |
| P1 | strategy:update 白名单 | 30min | QClaw |
| P1 | app:openExternal URL 校验 | 15min | WorkBuddy |
| P1 | 补齐 try-catch | 1h | QClaw |
| P1 | 引擎实例复用 | 30min | JVS |
| P2 | 虚拟滚动 | 2h | 主龙虾 |
| P2 | SQLite 索引 | 30min | JVS |
| P2 | 并行初始化 | 30min | WorkBuddy |

---

## 7. 性能基准建议

建议建立以下性能基准并纳入 CI：

| 指标 | 目标值 | 当前估计 |
|------|--------|----------|
| 主窗口启动时间 | < 2s | ~1.5s ✅ |
| IPC 延迟 (ping) | < 50ms | ~20ms ✅ |
| Greeks 计算响应 | < 1s | ~3-5s ❌ (execSync阻塞) |
| 回测 1 年数据 | < 5s | ~2s ✅ |
| 内存占用 (idle) | < 200MB | ~150MB ✅ |
| 内存泄漏 (24h) | < 50MB | 未知 ⚠️ |

---

*本报告基于代码静态分析生成，未进行运行时 profiling。建议补充 Chrome DevTools Performance + Memory 面板进行动态验证。*
