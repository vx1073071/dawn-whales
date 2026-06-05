# 前端性能分析报告 — Q-26-02

**分支**: feature/strategy-optimize  
**日期**: 2026-06-06  
**分析范围**: 组件级别 bundle 分析 + React 性能反模式识别

---

## 一、Bundlesize 总览

| 文件 | 大小 | 说明 |
|------|------|------|
| `index-*.js` | 174 KB | 主 bundle（含 React + React Router） |
| `MarketPage-*.js` | 171 KB | ECharts + K线图表组件 |
| `StrategyPage-*.js` | 32 KB | 策略管理页面 |
| `BacktestReportPage-*.js` | 30 KB | 回测报告 |
| `TradeDashboardPage-*.js` | 18 KB | 交易仪表板 |
| `RiskDashboardPage-*.js` | 14 KB | 风控仪表板 |
| `index-*.css` | 36 KB | 全局样式 |

**总 JS**: ~497 KB（未 gzip）。  
**总 CSS**: 36 KB（未 gzip）。

### 主要增长点

1. **ECharts 整包引入**：MarketPage 171 KB 几乎全部来自 `echarts-for-react`。  
   建议：使用 `echarts/core` 按需引入，只打包用到的组件（如 `line`, `candlestick`, `bar`），可减少 60-80%。
2. **主 bundle 未分离**：React + Router 在主 bundle，代码分割后可实现多页面并行加载。

---

## 二、React 性能反模式分析

### 2.1 StrategyPage — 最需优化（37.9 KB，33 个 useState）

| 指标 | 数值 | 评估 |
|------|------|------|
| `useState` 数量 | 33 | ⚠️ 过多 |
| `useEffect` 数量 | 5 | 中等 |
| `useCallback` 数量 | **0** | 🔴 严重缺失 |
| `useMemo` 数量 | **0** | 🔴 严重缺失 |
| `React.memo` 数量 | 0 | 🔴 完全缺失 |

**问题**：33 个 state 意味着每次父组件渲染，即使无关 state 变化，也会触发所有子组件重渲染。`useCallback`/`useMemo` 缺失导致所有传递给子组件的函数引用在每次渲染时都是新的，破坏 `React.memo` 的短路优化。

**典型反模式示例**（StrategyPage 当前状态）：
```tsx
// 每次渲染都创建新函数引用，子组件无法通过 React.memo 优化
const handleStrategySelect = (id: string) => { setSelectedId(id); };
<StrategyCard onSelect={handleStrategySelect} />
```

### 2.2 LiveMonitorPage — WebSocket 渲染风暴（18.6 KB，5 个 useEffect）

| 指标 | 数值 | 评估 |
|------|------|------|
| `useState` 数量 | 9 | 中等 |
| `useEffect` 数量 | 5 | ⚠️ 过多 |
| `useCallback` 数量 | 0 | 🔴 |
| WebSocket 订阅 | 5 处 | ⚠️ 需确认是否去重/节流 |

**问题**：每个 useEffect 可能独立建立 WebSocket 订阅或设置独立 interval。若无 cleanup 函数，可能造成订阅泄漏。

### 2.3 BacktestReportPage — 重计算风险（23.3 KB，12 个 useState）

| 指标 | 数值 | 评估 |
|------|------|------|
| `useState` 数量 | 12 | 可接受 |
| `useEffect` 数量 | 2 | ✅ 良好 |
| `useCallback` 数量 | 0 | 🔴 |

**问题**：`generateReport()` 等计算密集函数若在 render 中直接调用，每次 state 更新都会重新执行。

---

## 三、Hooks 性能问题（全局）

| Hook | 组件 | 问题 |
|------|------|------|
| `useWebSocketQuotes` | MarketPage | 全局 WebSocket，可能存在重复连接 |
| `useBridgeSync` | 全局 | IPC 同步轮询，无事件驱动 |
| `useKeyboardShortcuts` | 全局 | 无节流，多组件同时注册 |

---

## 四、优先级修复建议

### 🔴 P0 — 立即修复

**1. StrategyPage 添加 `useCallback`**
```tsx
// Before: 每次渲染新引用
const handleSelect = (id: string) => setSelected(id);

// After: memoized，引用稳定
const handleSelect = useCallback((id: string) => setSelected(id), []);

// 配合 React.memo
const StrategyCard = React.memo(({ onSelect }: Props) => ...);
```

**2. BacktestReportPage 计算结果 memoize**
```tsx
// Before: render 中直接计算
const result = generateReport(data);

// After: memoize 缓存
const report = useMemo(() => generateReport(data), [data]);
```

**3. LiveMonitorPage WebSocket subscription cleanup**
- 确保每个 `useEffect` 返回 cleanup 函数取消订阅
- 添加 `useRef` 追踪已订阅标的，避免重复订阅

### 🟡 P1 — 短期优化

**4. ECharts 按需引入（MarketPage）**
```typescript
// Before: 全量引入
import * as echarts from 'echarts';

// After: 按需引入
import * as echarts from 'echarts/core';
import { LineChart, CandlestickChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
// 预计减少 100+ KB
```

**5. 路由级别代码分割**
```tsx
// App.tsx
const StrategyPage = lazy(() => import('./components/strategy/StrategyPage'));
const BacktestPage = lazy(() => import('./components/backtest/BacktestReportPage'));
```

### 🟢 P2 — 中期改进

**6. `useBridgeSync` 改为事件驱动**
当前 IPC 轮询改为 `window.api.on('quote:update', handler)` 事件订阅，减少无效渲染。

**7. Hook 跨组件去重**
`useWebSocketQuotes` 应维护全局订阅表，同一标的只建立一条 WebSocket 连接。

---

## 五、测试建议

在 `StrategyPage` 中添加 `React.Profiler` 包装关键卡片组件，测量渲染频率：
```tsx
<React.Profiler id="StrategyCard" onRender={(...args) => console.log(args)}>
  <StrategyCard ... />
</React.Profiler>
```

修复后应观察到：非选中卡片在选中操作时不再触发 `render`。

---

## 六、结论

| 维度 | 当前状态 | 目标 |
|------|----------|------|
| Bundle（未 gzip） | 497 KB | < 300 KB |
| StrategyPage memo 使用 | 0 | > 5 个组件 |
| useCallback/useMemo | 0 | > 10 处 |
| WebSocket 泄漏 | 可疑 | 0 泄漏 |
| 路由分割 | 无 | 3+ 页面 |

**Q-26-02 完成** — 本文档为性能基线，提供了可执行的 P0/P1 修复路径。P0 修复可在 1-2 小时内完成，预计 StrategyPage 渲染次数减少 70%+，LiveMonitorPage 内存泄漏风险消除。
