<!-- META
version: 1.12.0
last_updated: 2026-06-12
round: R108
owner: JVS
purpose: (auto-generated, needs review)
-->

# BacktestReplayEngine API 文档

**Phase**: 4.4 R38  
**文件**: `electron/engine/backtest-replay.ts` (742 行)  
**作者**: JVS  
**审查**: dao (96%)  

---

## 概述

BacktestReplayEngine 实现历史 K 线回放引擎，支持变速播放、断点设置、单步前进/后退、跳转、循环播放。

---

## 类型定义

### ReplayState

```typescript
type ReplayState = 'idle' | 'playing' | 'paused' | 'stepping' | 'finished';
```

### PlaybackSpeed

```typescript
type PlaybackSpeed = 0.5 | 1 | 2 | 5 | 10 | 20 | 50 | 100 | 'MAX';
```

### KLineBar

```typescript
interface KLineBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
```

### Breakpoint

```typescript
interface Breakpoint {
  id: string;
  type: 'price_above' | 'price_below' | 'volume_above' | 'drawdown' | 'custom';
  value: number;
  enabled: boolean;
  triggered: boolean;
  description?: string;
}
```

### ReplayConfig

```typescript
interface ReplayConfig {
  initialSpeed: PlaybackSpeed;    // default: 1
  loopEnabled: boolean;           // default: false
  autoPauseOnBreakpoint: boolean; // default: true
  historySize: number;            // default: 1000
  stepSize: number;               // default: 1
}
```

### ReplayStatus

```typescript
interface ReplayStatus {
  state: ReplayState;
  currentIndex: number;
  totalBars: number;
  currentBar: KLineBar | null;
  speed: PlaybackSpeed;
  elapsedMs: number;
  breakpoints: Breakpoint[];
  triggeredBreakpoints: Breakpoint[];
}
```

---

## BacktestReplayEngine 类

### 构造函数

```typescript
constructor(config?: Partial<ReplayConfig>)
```

### 数据管理

#### loadKLines(bars)
加载 K 线数据。

```typescript
loadKLines(bars: KLineBar[]): void
```

#### getBars(start?, end?)
获取 K 线数据（end exclusive）。

```typescript
getBars(start?: number, end?: number): KLineBar[]
```

#### reset()
重置引擎（清理 klines + breakpoints）。

```typescript
reset(): void
```

### 播放控制

#### play()
开始播放。

```typescript
play(): void
```

#### pause()
暂停播放。

```typescript
pause(): void
```

#### stop()
停止播放。

```typescript
stop(): void
```

#### stepForward()
单步前进。

```typescript
stepForward(): KLineBar | null
```

#### stepBackward()
单步后退。

```typescript
stepBackward(): KLineBar | null
```

#### seekTo(index)
跳转到指定位置。

```typescript
seekTo(index: number): KLineBar | null
```

#### setSpeed(speed)
设置播放速度。

```typescript
setSpeed(speed: PlaybackSpeed): void
```

#### toggleLoop()
切换循环播放。

```typescript
toggleLoop(): boolean
```

### 断点管理

#### addBreakpoint(bp)
添加断点。

```typescript
addBreakpoint(bp: Omit<Breakpoint, 'id' | 'triggered'>): string // returns bpId
```

#### removeBreakpoint(id)
移除断点。

```typescript
removeBreakpoint(id: string): void
```

#### enableBreakpoint(id, enabled)
启用/禁用断点。

```typescript
enableBreakpoint(id: string, enabled: boolean): void
```

#### clearBreakpoints()
清除所有断点。

```typescript
clearBreakpoints(): void
```

### 状态查询

#### getStatus()
获取回放状态。

```typescript
getStatus(): ReplayStatus
```

#### getCurrentBar()
获取当前 K 线。

```typescript
getCurrentBar(): KLineBar | null
```

#### isPlaying()
是否正在播放。

```typescript
isPlaying(): boolean
```

#### isFinished()
是否播放完毕。

```typescript
isFinished(): boolean
```

#### getProgress()
获取播放进度 (0-1)。

```typescript
getProgress(): number
```

---

## 事件列表

| 事件名 | 触发时机 | 回调参数 |
|-------|---------|---------|
| `playback:start` | 播放开始 | `{ speed }` |
| `playback:pause` | 播放暂停 | `{ currentIndex }` |
| `playback:stop` | 播放停止 | `{ currentIndex }` |
| `playback:finish` | 播放完成 | `{ totalBars }` |
| `playback:loop` | 循环重播 | `{ loopCount }` |
| `bar:update` | K 线更新 | `KLineBar` |
| `speed:change` | 速度变更 | `{ oldSpeed, newSpeed }` |
| `breakpoint:add` | 断点添加 | `Breakpoint` |
| `breakpoint:trigger` | 断点触发 | `Breakpoint` |
| `breakpoint:remove` | 断点移除 | `{ id }` |
| `step:forward` | 单步前进 | `KLineBar` |
| `step:backward` | 单步后退 | `KLineBar` |
| `seek:complete` | 跳转完成 | `KLineBar` |

---

## 使用示例

```typescript
import { BacktestReplayEngine } from './backtest-replay';

const engine = new BacktestReplayEngine({
  initialSpeed: 5,
  loopEnabled: true,
  autoPauseOnBreakpoint: true,
});

// 加载 K 线数据
engine.loadKLines(klineData);

// 添加断点
engine.addBreakpoint({
  type: 'price_above',
  value: 200,
  enabled: true,
  description: '价格突破 200',
});

// 监听事件
engine.on('bar:update', (bar) => {
  console.log(`K线更新: ${bar.close}`);
});

engine.on('breakpoint:trigger', (bp) => {
  console.log(`断点触发: ${bp.description}`);
});

// 开始播放
engine.play();

// 变速
engine.setSpeed(10);

// 暂停
engine.pause();

// 单步
engine.stepForward();
```

---

**文档生成**: dao  
**时间**: 2026-06-07T04:13:00+08:00
