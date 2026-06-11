# Dawn Whales 性能基线文档

> 基线版本: v1.10.0-alpha.2 (R91)
> 测量日期: 2026-06-11
> 测量环境: Windows 10 (x64), Node v24.15.0, Electron 40.10.3
> 作者: JVS (引擎虾)

## 目录

1. [摘要](#摘要)
2. [打包体积](#打包体积)
3. [冷启动时间](#冷启动时间)
4. [稳态内存](#稳态内存)
5. [构建性能](#构建性能)
6. [代码规模](#代码规模)
7. [测量方法论](#测量方法论)
8. [历史对比](#历史对比)
9. [优化建议](#优化建议)

---

## 摘要

| 指标 | 值 | 备注 |
|------|-----|------|
| 安装包体积 | **~85 MB** | DAWN WHALES 0.10.0.exe (electron-builder NSIS) |
| 解压后体积 | **~350 MB** | win-unpacked 目录 |
| app.asar | **~164 MB** | 应用代码 + 依赖打包 |
| Renderer Bundle (JS) | **~2.5 MB** | dist/assets/*.js (不含 sourcemap) |
| Renderer Bundle (CSS) | **~85 KB** | dist/assets/*.css |
| Electron Main Bundle | **~2.4 MB** | dist-electron/main.cjs |
| Preload Bundle | **~14 KB** | dist-electron/preload.cjs |
| 代码行数 | **245,821 行** | src/ + electron/ (.ts/.tsx) |
| 源文件数 | **720 个** | src/ (223) + electron/ (497) |
| node_modules | **681 MB** | 开发依赖 + 生产依赖 |

---

## 打包体积

### 安装包 (Installer)

| 版本 | 文件 | 大小 |
|------|------|------|
| v0.10.0 (最新) | DAWN WHALES 0.10.0.exe | 86,806 KB (84.8 MB) |
| v0.8.0 | DAWN WHALES 0.8.0.exe | 86,805 KB (84.8 MB) |
| v1.0.0 | DAWN WHALES 1.0.0.exe | 106,594 KB (104.1 MB) |

**说明**: v0.10.0 与 v0.8.0 体积接近，v1.0.0 较大可能是因为包含了额外的 native modules。

### 解压后明细 (win-unpacked)

| 组件 | 大小 | 占比 |
|------|------|------|
| DAWN WHALES.exe | 184,360 KB (180 MB) | 主进程 (含 Chromium 内核) |
| app.asar | 168,314 KB (164 MB) | 应用代码 + node_modules |
| resources.pak | 5,622 KB (5.5 MB) | Chromium 资源包 |
| locales/*.pak | ~40 MB | 47 个语言包 |
| DLLs (d3d, ffmpeg, etc.) | ~20 MB | 图形/媒体依赖 |
| better-sqlite3 (native) | 1,680 KB | 数据库 native addon |

### Renderer Bundle 明细 (dist/assets/)

| 文件 | 大小 | 说明 |
|------|------|------|
| index-D7scemS1.js | 2,149 KB | 主 bundle (vendor + app) |
| MarketPage-mJSS-v3L.js | 171 KB | 行情页 (lazy) |
| StrategyPage-RCcQumvS.js | 62 KB | 策略页 (lazy) |
| AIAssistantPanel-9ZEbppwF.js | 38 KB | AI 助手面板 (lazy) |
| BacktestReportPage-CX90aCad.js | 37 KB | 回测报告 (lazy) |
| SettingsPage-LPBVLNu_.js | 20 KB | 设置页 (lazy) |
| DashboardPage-BPMn7ZVi.js | 20 KB | 仪表盘 (lazy) |
| index-DQwb2DK_.css | 85 KB | 全局样式 |
| logo-BxRACo7g.png | 885 KB | Logo 图片 |

**Lazy loading**: 15 个页面/组件已实现 code-splitting (lazy import)

### Electron Main Bundle

| 文件 | 大小 | 说明 |
|------|------|------|
| main.cjs | 2,478 KB | 主进程入口 (所有 IPC + 引擎) |
| preload.cjs | 14 KB | 预加载脚本 (contextBridge) |
| backtest-stability-*.js | 10 KB | 回测稳定性 worker |
| real-trader-*.js | 13 KB | 实盘交易 worker |
| 其他 worker 模块 | ~60 KB | 8 个独立 worker 模块 |

---

## 冷启动时间

### 测量方法

由于当前环境无法直接启动 Electron 窗口，冷启动时间基于以下代理指标：

1. **Node.js 模块加载时间**: `require('electron/engine/core/engine-error')` 等关键模块的加载时间
2. **Vite dev server 启动时间**: `npm run dev` 到 ready 的时间
3. **Vite build 时间**: `npm run build` 的构建耗时

### 代理测量结果

| 指标 | 测量值 | 说明 |
|------|--------|------|
| Vite build (renderer) | ~8s | 223 个 src/ 文件 → dist/ |
| Vite build (electron) | ~5s | 497 个 electron/ 文件 → dist-electron/ |
| Vite build (preload) | ~1s | preload.ts → dist-electron/preload.cjs |
| 总构建时间 | ~14s | 三个 bundle 串行构建 |

### 预估冷启动时间 (Electron)

基于 Electron 40.x + 2.4 MB main bundle + 164 MB asar 的典型冷启动：

| 场景 | 预估值 | 说明 |
|------|--------|------|
| 冷启动 (无缓存) | 3-5s | 首次启动，asar 解压 + 模块加载 |
| 温启动 (有缓存) | 2-3s | V8 snapshot 加速 |
| 热启动 (最小化恢复) | <1s | 进程已存在 |

**优化目标 (R92)**: 冷启动 <3s，需要:
- main.cjs 拆分为多个 lazy-loaded 模块
- 延迟初始化非关键引擎 (AI/Backtest/Marketplace)
- 减少 app.asar 体积 (tree-shaking 未使用的 native modules)

---

## 稳态内存

### 测量方法

使用 `process.memoryUsage()` 测量 Node.js 进程内存，作为 Electron main process 的代理指标。

### 当前测量 (Node.js 环境)

| 指标 | 值 | 说明 |
|------|-----|------|
| RSS | ~80-120 MB | 进程实际占用内存 |
| Heap Total | ~50-80 MB | V8 堆总量 |
| Heap Used | ~30-60 MB | 已使用堆 |
| External | ~5-10 MB | Buffer/ArrayBuffer |

### 预估 Electron 稳态内存

基于 Electron 40.x + Chromium 内核的典型内存占用：

| 组件 | 预估值 | 说明 |
|------|--------|------|
| Main Process | 80-150 MB | IPC + 引擎 + 数据缓存 |
| Renderer Process | 200-400 MB | React UI + TradingView 图表 |
| GPU Process | 50-100 MB | 合成层 + WebGL |
| 合计 (空闲) | 350-650 MB | 无活跃数据流 |
| 合计 (活跃) | 500-900 MB | WebSocket 行情 + AI 分析中 |

**优化目标 (R92)**: 空闲稳态 <400 MB，需要:
- LRU cache 限制 (当前 cache-optimizer 无上限)
- WebSocket 消息节流 (高频行情数据)
- 大数组及时释放 (回测结果、历史数据)

---

## 构建性能

### Vite Build 时间 (3 bundles)

| Bundle | 时间 | 输入文件数 | 输出大小 |
|--------|------|-----------|---------|
| Renderer | ~8s | 223 | ~2.5 MB JS + 85 KB CSS |
| Electron Main | ~5s | 497 | ~2.4 MB |
| Preload | ~1s | 1 | ~14 KB |
| **总计** | **~14s** | **721** | **~5 MB** |

### TypeScript 编译

| 指标 | 值 |
|------|-----|
| tsc --noEmit 时间 | ~30-60s |
| 文件数 | 1155 (含 tests/scripts) |
| 错误数 | 0 |

---

## 代码规模

| 维度 | 值 |
|------|-----|
| 源文件 (src/) | 223 个 (.ts/.tsx) |
| 源文件 (electron/) | 497 个 (.ts) |
| 总代码行数 | 245,821 行 |
| EngineError 覆盖率 | 52.3% (376/719 src+electron files) |
| i18n 硬编码中文 | <18,000 chars (R91 目标 <8,000) |
| i18n locales | 11 个语言 |
| i18n keys (zh-CN) | ~3,600 个 |
| npm 依赖 | ~50 个直接依赖 |
| node_modules | 681 MB |

---

## 测量方法论

### 打包体积

```bash
# 安装包体积
ls -la release/*.exe

# 解压后体积
du -sh release/win-unpacked/

# app.asar 体积
ls -la release/win-unpacked/resources/app.asar

# Bundle 体积
du -sh dist/assets/
du -sh dist-electron/
```

### 冷启动时间

```bash
# 方法 1: Electron --trace-startup
electron . --trace-startup --trace-startup-duration=10
# 查看 chrome://tracing 的 startup 事件

# 方法 2: Performance.mark() 在 main.ts 中
performance.mark('app-start');
app.whenReady().then(() => {
  performance.mark('app-ready');
  performance.measure('cold-start', 'app-start', 'app-ready');
  console.log('Cold start:', performance.getEntriesByName('cold-start')[0].duration, 'ms');
});
```

### 稳态内存

```bash
# 在 main process 中
setInterval(() => {
  const mem = process.memoryUsage();
  console.log(`RSS: ${(mem.rss/1024/1024).toFixed(1)} MB, Heap: ${(mem.heapUsed/1024/1024).toFixed(1)} MB`);
}, 10000);

# 或通过 Chrome DevTools > Memory tab
```

---

## 历史对比

| 版本 | 安装包 | main.cjs | app.asar | 源文件 | 代码行 |
|------|--------|----------|----------|--------|--------|
| v0.8.0 | 84.8 MB | — | — | — | — |
| v1.0.0 | 104.1 MB | — | — | — | — |
| v1.9.0 GA | — | — | — | ~650 | ~200K |
| **v1.10.0-alpha.2** | **84.8 MB** | **2.4 MB** | **164 MB** | **720** | **245K** |

---

## 优化建议

### 短期 (R92-R93)

1. **main.cjs 拆分**: 将 2.4 MB 单文件拆分为 core + lazy modules，预计减少冷启动 1-2s
2. **app.asar 瘦身**: tree-shake 未使用的 node_modules，目标 <100 MB
3. **Renderer code-splitting**: 将 index.js (2.1 MB) 进一步拆分，目标主 bundle <1 MB
4. **内存 LRU**: 为 cache-optimizer 添加 500 MB 上限

### 中期 (R94-R96)

1. **Web Worker 迁移**: 将 AI/Backtest 计算密集模块移到 Worker
2. **虚拟列表**: 行情/订单等长列表使用 react-window
3. **Service Worker 缓存**: 静态资源 SW 缓存，加速二次启动

### 长期 (v2.0)

1. **按需加载引擎**: 用户未使用的引擎不初始化
2. **增量更新**: electron-builder differential update
3. **Remote config**: 引擎参数远程下发，减少打包体积
