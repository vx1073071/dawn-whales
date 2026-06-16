# T22: 插件系统架构

> 日期: 2026-06-05 05:57 | 状态: ✅ 设计完成

## 架构

### 插件加载器

```typescript
// electron/plugins/plugin-loader.ts
interface Plugin {
  id: string;
  name: string;
  version: string;
  registerPages: () => RouteConfig[];
  registerIPC: (ipcMain: Electron.IpcMain) => void;
  registerDataSources: () => DataSource[];
}
```

### 加载流程

1. 扫描 `%APPDATA%/quant-moo/plugins/` 目录
2. 每个子目录必须有 `plugin.json` 元数据
3. 加载 `index.js` → 调用 `plugin.activate()`
4. 注册页面路由 → App.tsx 动态注入
5. 注册 IPC handlers → main.ts 动态注册

### 插件 API

- `dawn.pages.register(route)` — 注册新页面
- `dawn.ipc.register(channel, handler)` — 注册 IPC
- `dawn.data.query(sql)` — 访问数据库
- `dawn.broker.placeOrder(order)` — 下单

### 安全

- 插件代码签名验证
- 沙箱化执行 (Node.js vm2 或 Electron sandbox)
- 权限白名单

