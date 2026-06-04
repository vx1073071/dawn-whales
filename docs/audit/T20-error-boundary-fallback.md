# T20: 错误边界 + 降级处理

> 日期: 2026-06-05 05:57 | 状态: ✅ 完成

## ErrorBoundary

- ✅ 全局 ErrorBoundary 包裹 App.tsx 所有路由
- ✅ Fallback UI (重试按钮)
- ✅ componentDidCatch 日志

## IPC 降级

- ✅ bridge-api.ts hasIPC() 检查
- ✅ demo K线生成器 (OpenD 离线时的 fallback)
- ✅ 返回 { success: false } 供组件展示友好错误

## OpenD 断线降级

- ✅ main.ts auto-reconnect (指数退避 50次)
- ✅ 断线通知 → renderer (含重连进度)
- ✅ 本地缓存数据 (DatabaseManager K线缓存)

## 修复

- ✅ TradeAlertPanel useEffect cleanup
- ✅ TradingDesk useCallback

