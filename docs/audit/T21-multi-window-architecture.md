# T21: 多窗口支持架构

> 日期: 2026-06-05 05:57 | 状态: ✅ 设计完成

## 架构设计

### 行情弹出窗口

```typescript
// electron/windows/quote-window.ts
export function createQuoteWindow(symbol: string): BrowserWindow {
  const win = new BrowserWindow({
    width: 400, height: 600,
    parent: mainWindow,
    webPreferences: { preload: ... }
  });
  win.loadURL(`#/quote/${symbol}`);
  return win;
}
```

### 状态同步

- 通过主进程 ipcMain 作为事件总线
- 子窗口 emit → 主窗口 on → 其他子窗口 on
- store 变更通过 ipcRenderer.send('sync-state', partial) 广播

### 已有基础

- Electron BrowserWindow API 已可用
- preload.ts 的 contextBridge 可被多窗口共享

