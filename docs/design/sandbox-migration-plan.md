# R127-P04: Electron sandbox:true 迁移预研

> **任务**: R127-P04 | **工时**: 2h | **作者**: PM(Claw)
> **当前**: sandbox:false, nodeIntegration:true, contextIsolation:true
> **目标**: sandbox:true, nodeIntegration:false, contextIsolation:true (preload contextBridge)

---

## 一、当前架构问题

```javascript
// main.ts 当前配置
webPreferences: {
  sandbox: false,           // ❌ 安全漏洞
  nodeIntegration: true,    // ❌ renderer可直接访问Node API
  contextIsolation: true,   // ✅ 已启用
  webSecurity: false,       // ❌ CSP失效
}
```

**影响**: renderer进程可以require('fs')/require('child_process')等，任意XSS可执行系统命令。

---

## 二、sandbox:true 要求

| 限制 | 说明 |
|------|------|
| 禁止 require() | renderer不能调用Node模块 |
| 禁止 process | 无process.env/process.cwd等 |
| 禁止 __dirname | 无文件系统路径 |
| 仅保留 contextBridge | preload暴露的API |

---

## 三、迁移方案

### 3.1 拆分清单

```
当前依赖Node的renderer文件: 预估155个
需审查分类:
  ├── 通过IPC通信的 → 保留, 改用contextBridge
  ├── require('electron') → 改为window.api
  ├── require('fs') → 改为IPC:file:*通道
  ├── require('path') → 纯逻辑, 用path-browserify
  └── require('child_process') → 改为IPC:shell:*通道
```

### 3.2 preload.ts 扩展示例

```typescript
// preload.ts — 当前仅暴露 broker API
// 需扩展以下模块:

contextBridge.exposeInMainWorld('api', {
  // 现有: broker, marketplace, strategy, ...
  
  // 新增:
  file: {
    read: (filePath: string) => ipcRenderer.invoke('file:read', filePath),
    write: (filePath: string, data: string) => ipcRenderer.invoke('file:write', filePath, data),
    exists: (filePath: string) => ipcRenderer.invoke('file:exists', filePath),
    list: (dirPath: string) => ipcRenderer.invoke('file:list', dirPath),
  },
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
    showItemInFolder: (path: string) => ipcRenderer.invoke('shell:showItem', path),
  },
  app: {
    getPath: (name: string) => ipcRenderer.invoke('app:getPath', name),
    quit: () => ipcRenderer.invoke('app:quit'),
  }
});
```

### 3.3 main.ts 配置变更

```javascript
webPreferences: {
  sandbox: true,            // ✅
  nodeIntegration: false,   // ✅
  contextIsolation: true,   // ✅
  preload: path.join(__dirname, 'preload.js'),
  webSecurity: true,        // ✅ 恢复CSP
}
```

---

## 四、风险矩阵

| 风险 | 级别 | 影响 | 缓解 |
|------|------|------|------|
| 155文件需审查 | HIGH | 3-5天逐文件改 | 分3批: 核心→常用→边缘 |
| require('electron')散落 | HIGH | import改为window.api | 全局搜索替换 |
| 第三方库依赖Node | MEDIUM | 部分npm包不可用 | 找浏览器替代或IPC包装 |
| webSecurity:true 破坏CSP | MEDIUM | 外部资源被拦截 | 配置CSP whitelist |
| 性能下降 | LOW | IPC调用延迟 | 批量IPC + cache |

---

## 五、分阶段实施 (建议R128执行)

| 阶段 | 工时 | 内容 |
|------|------|------|
| Phase 1 | 2h | preload扩展 + main.ts配置 + CSP |
| Phase 2 | 2h | 核心组件迁移(require→window.api) |
| Phase 3 | 1h | 测试验证 + E2E修复 |
| **合计** | **5h** | |

---

*预研完成: 2026-06-13 HKT | 工时: 2h | PM(Claw)*
