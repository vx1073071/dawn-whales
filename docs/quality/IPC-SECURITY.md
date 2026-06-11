<!-- META
version: 1.12.0
last_updated: 2026-06-12
round: R108
owner: QClaw
purpose: (auto-generated, needs review)
-->

# DAWN WHALES IPC 安全审计报告

**审计日期**: 2026-06-04  
**审计者**: WorkBuddy  
**审计范围**: electron/main.ts 中所有 `ipcMain.handle` 定义 (共 82 个 handler)  
**风险模型**: 恶意/错误 renderer 进程调用、中间人篡改、API key 泄露

---

## 1. 执行摘要

**整体评级**: ⚠️ C+ (有严重安全隐患，需立即修复)

| 风险类别 | 评级 | 数量 | 说明 |
|----------|------|------|------|
| 输入注入 | 🔴 高危 | 4 | 任意字段注入、URL 绕过、命令注入 |
| 类型安全 | 🟡 中危 | 12 | `any` 类型广泛使用 |
| 密钥管理 | 🟡 中危 | 2 | API key 在 env 中，无轮换机制 |
| 权限控制 | 🟡 中危 | 1 | 无角色/权限系统 |
| 日志泄露 | 🟢 低危 | 2 | 日志可能记录敏感数据 |

---

## 2. 高危风险 (必须立即修复)

### 2.1 `strategy:update` 任意字段注入

**位置**: `main.ts:346-355`  
**CVSS**: 7.5 (High)

```typescript
ipcMain.handle('strategy:update', async (_e, id: string, updates: any) => {
  const strategy = strategyEngine?.getStrategy(id);
  Object.assign(strategy, updates, { updatedAt: new Date().toISOString() });
  // ...
});
```

**攻击场景**:
1. 恶意 renderer 调用 `strategy:update('strategy-123', { liveRunning: true, accountId: '他人的账户' })`
2. 策略被强制启动并指向他人账户
3. 如果 auto-trade 开启，可能用他人资金下单

**修复** (白名单校验):
```typescript
const ALLOWED_UPDATE_FIELDS = ['name', 'description', 'params', 'stopLoss', 'takeProfit', 'symbol'];
const sanitized: any = {};
for (const key of ALLOWED_UPDATE_FIELDS) {
  if (key in updates) sanitized[key] = updates[key];
}
Object.assign(strategy, sanitized, { updatedAt: new Date().toISOString() });
```

---

### 2.2 `app:openExternal` URL 验证绕过

**位置**: `main.ts:664-669`  
**CVSS**: 6.5 (Medium)

```typescript
if (url.startsWith('http')) {
  await shell.openExternal(url);
}
```

**绕过方式**:
```
http://evil.com;calc.exe          → 可能执行命令 (取决于 shell.openExternal 实现)
http://evil.com%00.com             → null byte 注入
http://<script>alert(1)</script>   → 某些应用可能解析为 XSS
```

**修复**:
```typescript
const ALLOWED_PROTOCOLS = ['http:', 'https:'];
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

### 2.3 `broker:placeOrder` 参数未校验

**位置**: `main.ts:224-237`  
**CVSS**: 8.0 (High)

```typescript
ipcMain.handle('broker:placeOrder', async (_e, order: any) => {
  // 直接传入 opendClient.placeOrder(order)
  const result = await opendClient.placeOrder(order);
});
```

**风险**:
- `order.qty` 为负数 → 非法委托
- `order.price` 为 0 → 市价单（如果本意是限价单）
- `order.side` 为任意字符串 → OpenD 可能拒绝或产生意外行为
- 缺少数量上限检查 → 超大单可能触发风控但仍有风险

**修复**:
```typescript
const OrderSchema = z.object({
  code: z.string().min(1),
  side: z.enum(['BUY', 'SELL']),
  qty: z.number().int().positive().max(1000000),
  price: z.number().positive().optional(),
  orderType: z.enum(['LIMIT', 'MARKET']).default('LIMIT'),
});

ipcMain.handle('broker:placeOrder', async (_e, rawOrder: any) => {
  const parse = OrderSchema.safeParse(rawOrder);
  if (!parse.success) {
    return { success: false, error: `Invalid order: ${parse.error.message}` };
  }
  // ...
});
```

---

### 2.4 `data:save-*` 系列数据注入风险

**位置**: `main.ts:909-969`

```typescript
ipcMain.handle('data:save-fundamental', async (_e, data: any) => {
  dataProvider?.saveFundamental(data);
  // ...
});
```

**风险**: `data` 为 `any` 类型，如果 `dataProvider.saveFundamental` 使用字符串拼接 SQL，可能导致 SQL 注入。

**状态**: 需检查 `data-provider.ts` 的实现。

---

## 3. 中危风险 (1周内修复)

### 3.1 `any` 类型泛滥

**统计**: 在 82 个 IPC handler 中，约 15 个使用 `any` 类型参数：

| Handler | 参数类型 | 风险 |
|---------|----------|------|
| `strategy:create` | `dsl: any` | 任意策略结构 |
| `strategy:backtest` | `config: any` | 任意回测配置 |
| `strategy:explain` | `strategy: any` | 策略数据直接嵌入 LLM prompt |
| `strategy:compare` | `s1: any, s2: any` | 同上 |
| `backtest:multiPeriod` | `config: any` | 任意配置 |
| `backtest:paramSweep` | `config: any` | 同上 |
| `backtest:walkForward` | `config: any` | 同上 |
| `risk:updateConfig` | `config: any` | 风控配置 |
| `db:saveStrategy` | `strategy: any` | 策略数据 |
| `db:saveSettings` | `settings: any` | 设置数据 |
| `marketplace:savePerformance` | `data: any` | 业绩数据 |
| `data:save-*` | `data: any` | 各种数据 |

**建议**: 使用 `zod` 或 `io-ts` 为所有 IPC handler 添加运行时类型校验。

---

### 3.2 DeepSeek API Key 在环境变量中

**位置**: `main.ts:468-543` (strategy:explain + strategy:compare)

```typescript
const apiKey = process.env.DEEPSEEK_API_KEY;
```

**风险**:
- 环境变量可能被其他进程读取
- 无 key 轮换机制
- key 泄露后无检测手段

**建议**:
1. 使用 Electron 的 `safeStorage` 加密存储 API key
2. 添加 key 使用日志和异常检测
3. 支持用户手动输入 + 本地加密存储

---

### 3.3 无权限/角色系统

**现状**: 所有 renderer 进程可以调用所有 IPC handler。

**风险**: 如果应用支持多用户或策略市场共享，没有权限控制会导致：
- 用户 A 可以修改用户 B 的策略
- 普通用户可以调用 `app:emergencyStop`

**建议**: 在 Phase 3 后期添加简单的权限标记：
```typescript
interface IPCHandler {
  name: string;
  handler: (...args: any[]) => any;
  requiresAuth?: boolean;      // 需要登录
  requiresAdmin?: boolean;     // 需要管理员
  readOnly?: boolean;          // 只读操作
}
```

---

## 4. 低危风险 (后续优化)

### 4.1 日志泄露敏感数据

**位置**: 多处 `log.error('[Broker]', err.message)`

**风险**: 如果 `err.message` 包含订单详情、账户 ID、API key 等敏感信息，会被写入日志文件。

**建议**: 对日志进行敏感数据脱敏：
```typescript
function sanitizeLog(msg: string): string {
  return msg
    .replace(/accountId['"]?\s*[:=]\s*['"]?([^'"\s]+)/gi, 'accountId=***')
    .replace(/api[_-]?key['"]?\s*[:=]\s*['"]?([^'"\s]+)/gi, 'apiKey=***');
}
```

### 4.2 `mainWindow?.webContents.send` 在 window 关闭后调用

**位置**: 多处

**风险**: 如果 `mainWindow` 已被销毁（用户关闭了窗口），`mainWindow?.webContents` 会返回 undefined，但某些代码可能假设它存在。

**建议**: 统一封装：
```typescript
function sendToRenderer(channel: string, ...args: any[]) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, ...args);
  }
}
```

---

## 5. 修复计划

| 优先级 | 问题 | 预计工时 | 负责人 |
|--------|------|----------|--------|
| 🔴 P0 | strategy:update 白名单 | 30min | QClaw |
| 🔴 P0 | app:openExternal URL 校验 | 15min | WorkBuddy |
| 🔴 P0 | broker:placeOrder 参数校验 | 1h | WorkBuddy |
| 🔴 P0 | data:save-* 注入检查 | 30min | JVS |
| 🟡 P1 | any → zod 类型校验 | 4h | QClaw |
| 🟡 P1 | DeepSeek key 加密存储 | 2h | QClaw |
| 🟡 P1 | 日志脱敏 | 1h | WorkBuddy |
| 🟢 P2 | 权限系统 | 4h | 主龙虾 |
| 🟢 P2 | sendToRenderer 封装 | 30min | WorkBuddy |

---

## 6. 安全测试建议

建议添加以下安全测试：

```typescript
// ipc-security.test.ts
describe('IPC Security', () => {
  test('strategy:update rejects unknown fields', async () => {
    const result = await ipc.call('strategy:update', 'id', { liveRunning: true, hacked: true });
    expect(result.success).toBe(false);
  });

  test('app:openExternal rejects file://', async () => {
    const result = await ipc.call('app:openExternal', 'file:///etc/passwd');
    expect(result.success).toBe(false);
  });

  test('broker:placeOrder rejects negative qty', async () => {
    const result = await ipc.call('broker:placeOrder', { code: 'HK.00700', side: 'BUY', qty: -100 });
    expect(result.success).toBe(false);
  });
});
```

---

*本报告基于静态代码分析。建议补充动态安全测试（如模糊测试、渗透测试）。*
