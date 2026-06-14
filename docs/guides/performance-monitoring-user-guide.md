<!-- META
version: 1.12.0
last_updated: 2026-06-12
round: R108
owner: youdao
purpose: (auto-generated, needs review)
-->

# 性能监控用户指南

**版本**: v0.9.1-alpha  
**作者**: dao  
**时间**: 2026-06-07T07:29:00+08:00  

---

## 目录

1. [性能监控概述](#性能监控概述)
2. [快速开始](#快速开始)
3. [性能指标说明](#性能指标说明)
4. [多账户性能对比](#多账户性能对比)
5. [告警规则配置](#告警规则配置)
6. [趋势分析](#趋势分析)
7. [实时数据流](#实时数据流)
8. [数据质量监控](#数据质量监控)
9. [异常检测](#异常检测)
10. [最佳实践](#最佳实践)
11. [常见问题](#常见问题)

---

## 性能监控概述

### 什么是性能监控？

性能监控是 TradingEasy Phase 6.1 的核心功能，提供实时的系统性能指标采集、多账户性能对比、可配置告警规则、性能趋势分析，帮助您及时发现和解决性能问题。

### 核心功能

1. **实时性能指标**: CPU/内存/延迟/QPS 实时监控
2. **多账户对比**: 识别性能瓶颈账户
3. **告警规则**: 可配置的阈值告警
4. **趋势分析**: 线性回归预测性能趋势
5. **数据质量**: 5 维度质量评分
6. **异常检测**: 3 种统计异常检测方法

---

## 快速开始

### 第一步：打开性能监控面板

1. 点击左侧导航栏 **性能监控** 📊
2. 或按快捷键 `Ctrl/Cmd + Shift + P`

### 第二步：查看实时指标

性能监控面板显示 4 个核心指标：

```
┌─────────────┬─────────────┬─────────────┬─────────────┐
│  CPU 使用率  │  内存使用    │   延迟      │    QPS      │
│    45%      │   512MB     │   85ms      │   1250      │
│   🟢 正常   │  🟢 正常    │  🟢 正常    │  🟢 正常    │
└─────────────┴─────────────┴─────────────┴─────────────┘
```

### 第三步：配置告警规则

1. 点击右上角 **设置** ⚙️
2. 选择 **告警规则**
3. 添加告警规则（例如：CPU > 80% 触发警告）

---

## 性能指标说明

### CPU 使用率

**含义**: 当前 CPU 使用百分比（0-100%）

**健康范围**:
- 🟢 0-60%: 正常
- 🟡 60-80%: 警告
- 🔴 80-100%: 严重

**优化建议**:
- 持续 > 80%: 考虑升级 CPU 或优化代码
- 间歇性峰值: 检查是否有定时任务

### 内存使用

**含义**: 当前内存使用量（MB）

**健康范围**:
- 🟢 0-500MB: 正常
- 🟡 500-800MB: 警告
- 🔴 800MB+: 严重

**优化建议**:
- 持续增长: 检查内存泄漏
- 突然飙升: 检查大数据加载

### 延迟

**含义**: 请求响应时间（ms）

**健康范围**:
- 🟢 0-100ms: 优秀
- 🟡 100-200ms: 良好
- 🔴 200ms+: 需优化

**优化建议**:
- 持续 > 200ms: 检查网络/数据库
- 间歇性延迟: 检查是否有阻塞操作

### QPS (Queries Per Second)

**含义**: 每秒查询数

**健康范围**:
- 🟢 > 1000: 优秀
- 🟡 100-1000: 良好
- 🔴 < 100: 需优化

**优化建议**:
- QPS 过低: 检查是否有性能瓶颈
- QPS 波动大: 检查负载均衡

---

## 多账户性能对比

### 什么是多账户性能对比？

多账户性能对比功能允许您同时监控多个账户的性能指标，自动识别性能最优和最差的账户。

### 使用步骤

#### 1. 添加账户指标

```typescript
import { PerformanceMonitor } from './performance-monitor';

const monitor = new PerformanceMonitor();

// 记录账户 A 的性能指标
monitor.recordAccountMetrics({
  accountId: 'account-a',
  cpuUsage: 45,
  memoryUsage: 512,
  latencyMs: 85,
  qps: 1250,
  timestamp: Date.now(),
});

// 记录账户 B 的性能指标
monitor.recordAccountMetrics({
  accountId: 'account-b',
  cpuUsage: 78,
  memoryUsage: 768,
  latencyMs: 150,
  qps: 800,
  timestamp: Date.now(),
});
```

#### 2. 对比账户性能

```typescript
const comparison = monitor.compareAccounts(['account-a', 'account-b']);

console.log('平均 CPU:', comparison.averages.cpuUsage);
console.log('最优 CPU:', comparison.best.cpuUsage);
console.log('最差 CPU:', comparison.worst.cpuUsage);
```

#### 3. 查看对比结果

性能监控面板会自动显示：

```
┌─────────────────────────────────────────────────────────┐
│              多账户性能对比                               │
├─────────────┬─────────┬─────────┬─────────┬─────────────┤
│   账户      │  CPU    │  内存   │  延迟   │    QPS      │
├─────────────┼─────────┼─────────┼─────────┼─────────────┤
│ account-a   │  45% 🟢 │ 512MB 🟢│ 85ms 🟢 │ 1250 🟢    │
│ account-b   │  78% 🟡 │ 768MB 🟡│ 150ms 🟡│ 800 🟡     │
├─────────────┼─────────┼─────────┼─────────┼─────────────┤
│ 平均        │  61.5%  │ 640MB   │ 117ms   │   1025      │
│ 最优        │  acct-a │ acct-a  │ acct-a  │   acct-a    │
│ 最差        │  acct-b │ acct-b  │ acct-b  │   acct-b    │
└─────────────┴─────────┴─────────┴─────────┴─────────────┘
```

---

## 告警规则配置

### 告警类型

| 类型 | 说明 | 默认阈值 |
|-----|------|---------|
| CPU_HIGH | CPU 使用率过高 | > 80% |
| MEMORY_HIGH | 内存使用过高 | > 800MB |
| LATENCY_HIGH | 延迟过高 | > 200ms |
| QPS_LOW | QPS 过低 | < 100 |

### 告警级别

| 级别 | 说明 | 颜色 |
|-----|------|------|
| info | 信息提示 | 🔵 蓝色 |
| warning | 警告 | 🟡 黄色 |
| critical | 严重 | 🔴 红色 |

### 添加告警规则

#### 方法 1: UI 配置

1. 打开性能监控面板
2. 点击右上角 **设置** ⚙️
3. 选择 **告警规则**
4. 点击 **添加规则**
5. 填写规则信息：
   - 类型: CPU_HIGH
   - 操作符: >
   - 阈值: 80
   - 级别: warning
6. 点击 **保存**

#### 方法 2: API 配置

```typescript
monitor.addAlertRule({
  type: 'CPU_HIGH',
  metric: 'cpuUsage',
  operator: '>',
  threshold: 80,
  severity: 'warning',
  enabled: true,
});
```

### 查看告警

```typescript
const alerts = monitor.getAlerts();
alerts.forEach(alert => {
  console.log(`[${alert.severity}] ${alert.type}: ${alert.message}`);
});
```

---

## 趋势分析

### 什么是趋势分析？

趋势分析使用线性回归算法，分析性能指标的历史趋势，预测未来性能变化。

### 使用步骤

#### 1. 分析 CPU 趋势

```typescript
const cpuTrend = monitor.analyzeTrend('cpuUsage', 10);

console.log('趋势方向:', cpuTrend.direction);  // increasing/decreasing/stable
console.log('斜率:', cpuTrend.slope);
console.log('平均值:', cpuTrend.average);
console.log('最小值:', cpuTrend.min);
console.log('最大值:', cpuTrend.max);
```

#### 2. 查看趋势图表

性能监控面板会自动显示趋势图表：

```
CPU 使用率趋势 (最近 10 个数据点)

100% ┤
     │
 80% ┤                              ●
     │                         ●
 60% ┤                    ●
     │               ●
 40% ┤          ●
     │     ●
 20% ┤●
     └────────────────────────────────────
       1   2   3   4   5   6   7   8   9   10

趋势: increasing (上升) ↗
斜率: 2.5
```

### 趋势方向说明

| 方向 | 说明 | 建议 |
|-----|------|------|
| increasing | 上升趋势 | 关注是否会超过阈值 |
| decreasing | 下降趋势 | 性能在改善 |
| stable | 稳定 | 性能稳定 |

---

## 实时数据流

### 什么是实时数据流？

实时数据流引擎提供 WebSocket 连接管理、数据聚合、冲突解决、数据质量监控等功能。

### WebSocket 连接管理

#### 添加连接

```typescript
import { RealtimeDataFlow } from './realtime-data-flow';

const dataFlow = new RealtimeDataFlow();

dataFlow.addConnection({
  id: 'ws-1',
  url: 'wss://api.example.com/ws',
  protocols: ['json'],
  reconnectEnabled: true,
  maxRetries: 5,
  baseRetryMs: 1000,
  maxRetryMs: 30000,
  pingIntervalMs: 30000,
  heartbeatTimeoutMs: 10000,
});
```

#### 连接 WebSocket

```typescript
await dataFlow.connect('ws-1');
```

#### 查看连接状态

```typescript
const state = dataFlow.getConnectionState('ws-1');
console.log('状态:', state.status);
console.log('重试次数:', state.retryCount);
console.log('接收消息数:', state.messagesReceived);
```

### 数据订阅

#### 订阅数据

```typescript
const subscriptionId = dataFlow.subscribe('HK.00700', (data) => {
  console.log('收到数据:', data);
});
```

#### 取消订阅

```typescript
dataFlow.unsubscribe(subscriptionId);
```

### 冲突解决策略

当多个数据源提供相同数据时，需要解决冲突：

```typescript
// 设置冲突解决策略
dataFlow.setConflictResolution('priority');  // 优先级高的源获胜
// 或
dataFlow.setConflictResolution('majority');  // 多数投票
// 或
dataFlow.setConflictResolution('average');   // 平均值
```

---

## 数据质量监控

### 数据质量维度

| 维度 | 说明 | 评分范围 |
|-----|------|---------|
| freshness | 数据新鲜度 | 0-100 |
| completeness | 数据完整性 | 0-100 |
| consistency | 数据一致性 | 0-100 |
| accuracy | 数据准确性 | 0-100 |
| reliability | 数据可靠性 | 0-100 |
| overall | 综合评分 | 0-100 |

### 查看数据质量

```typescript
const quality = dataFlow.getDataQualityScore('HK.00700');

console.log('新鲜度:', quality.freshness);
console.log('完整性:', quality.completeness);
console.log('一致性:', quality.consistency);
console.log('准确性:', quality.accuracy);
console.log('可靠性:', quality.reliability);
console.log('综合评分:', quality.overall);
```

### 质量阈值

```typescript
dataFlow.setQualityThresholds({
  freshness: 80,      // 新鲜度低于 80 分触发告警
  completeness: 90,   // 完整性低于 90 分触发告警
  consistency: 85,    // 一致性低于 85 分触发告警
  accuracy: 90,       // 准确性低于 90 分触发告警
  reliability: 85,    // 可靠性低于 85 分触发告警
});
```

---

## 异常检测

### 异常检测方法

| 方法 | 说明 | 适用场景 |
|-----|------|---------|
| z-score | 标准分数检测 | 正态分布数据 |
| IQR | 四分位距检测 | 偏态分布数据 |
| percentile | 百分位数检测 | 非参数分布 |

### 配置异常检测

```typescript
dataFlow.configureAnomalyDetection({
  method: 'z-score',
  threshold: 3.0,      // z-score > 3 视为异常
  windowSize: 100,     // 滑动窗口大小
  enabled: true,
});
```

### 查看异常事件

```typescript
const anomalies = dataFlow.getAnomalyEvents(10);  // 获取最近 10 个异常

anomalies.forEach(event => {
  console.log(`[${event.severity}] ${event.type}: ${event.value} (期望: ${event.expected})`);
  console.log(`偏差: ${event.deviation}`);
});
```

---

## 最佳实践

### 性能监控

1. **定期检查**: 每天至少检查一次性能指标
2. **设置告警**: 为关键指标设置告警规则
3. **趋势分析**: 每周分析一次性能趋势
4. **多账户对比**: 定期对比多账户性能

### 实时数据流

1. **连接池管理**: 合理控制 WebSocket 连接数
2. **心跳检测**: 启用心跳检测，及时发现断连
3. **数据质量**: 定期检查数据质量评分
4. **异常检测**: 启用异常检测，及时发现数据问题

### 告警配置

1. **合理阈值**: 根据实际业务设置阈值
2. **分级告警**: 区分 info/warning/critical
3. **告警收敛**: 避免告警风暴
4. **告警通知**: 配置告警通知（邮件/短信/Webhook）

---

## 常见问题

### Q1: 性能指标不更新？

**A**: 检查以下几点：
1. 确认性能监控面板已打开
2. 检查采集间隔配置（默认 1s）
3. 查看浏览器控制台是否有错误

### Q2: 告警规则不触发？

**A**: 检查以下几点：
1. 确认规则已启用（enabled: true）
2. 检查阈值设置是否合理
3. 查看告警历史是否有触发记录

### Q3: 多账户对比数据为空？

**A**: 检查以下几点：
1. 确认已记录至少 2 个账户的指标
2. 检查账户 ID 是否正确
3. 查看账户指标是否过期

### Q4: 趋势分析不准确？

**A**: 检查以下几点：
1. 确认历史数据足够（至少 10 个数据点）
2. 检查窗口大小设置
3. 查看数据是否有异常值

### Q5: WebSocket 连接频繁断开？

**A**: 检查以下几点：
1. 检查网络连接是否稳定
2. 确认心跳检测配置
3. 查看服务器端日志

### Q6: 数据质量评分低？

**A**: 检查以下几点：
1. 数据源是否稳定
2. 数据更新频率是否正常
3. 是否有数据丢失

### Q7: 异常检测误报？

**A**: 调整以下参数：
1. 增大阈值（例如 z-score 从 3.0 调整到 4.0）
2. 增大窗口大小
3. 更换检测方法（z-score → IQR）

---

## 附录

### 快捷键

| 快捷键 | 功能 |
|-------|------|
| Ctrl/Cmd + Shift + P | 打开性能监控面板 |
| Ctrl/Cmd + R | 刷新性能指标 |
| Ctrl/Cmd + A | 添加告警规则 |

### 相关文件

| 文件 | 说明 |
|-----|------|
| `performance-monitor.ts` | 性能监控引擎 |
| `realtime-data-flow.ts` | 实时数据流引擎 |
| `PerformanceMonitorPanel.tsx` | 性能监控面板 UI |

### 相关文档

- [PerformanceMonitor API](./api/performance-monitor-api.md)
- [RealtimeDataFlow API](./api/realtime-dataflow-api.md)
- [Phase 6.1 架构文档](./architecture/phase6-architecture.md)

---

**文档生成**: dao  
**时间**: 2026-06-07T07:30:00+08:00  
**版本**: v0.9.1-alpha  
**状态**: 性能监控用户指南完成
