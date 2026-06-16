---
title: 架构概览
description: DAWN WHALES 系统架构与技术栈
---

# 系统架构

## 技术栈

| 层 | 技术 |
|----|------|
| 桌面框架 | Electron 28+ |
| 前端 | React 18 + TypeScript 5 |
| 图表 | Canvas API / Lightweight Charts |
| 后端 | Node.js 20 + Express |
| 数据库 | SQLite (WAL模式) |
| 消息 | IPC + WebSocket |
| 构建 | Webpack 5 / esbuild |
| 测试 | Vitest + Playwright |
| 文档 | Astro Starlight |

## 进程架构

```
┌────────────────────┐
│   Main Process     │  ← Node.js 环境
│  ├─ 券商适配器      │     文件系统/网络/SQLite
│  ├─ 因子管线        │
│  ├─ 策略引擎        │
│  ├─ 数据管理        │
│  └─ IPC 服务端      │
└──────┬─────────────┘
       │ IPC通道 (contextBridge)
┌──────┴─────────────┐
│  Renderer Process   │  ← Chromium 环境
│  ├─ React UI        │     DOM/CSS/Canvas
│  ├─ 图表组件         │
│  ├─ 用户交互         │
│  └─ IPC 客户端       │
└─────────────────────┘
```

## 数据架构

```
外部数据源 (API/WS) 
    ↓
DataSourceManager (3层回退: 主→备→缓存)
    ↓
FactorDataProvider (因子数据聚合)
    ↓
FactorSignalPipeline (信号生成+排序)
    ↓
┌──────────────┬──────────────────┐
│  Main侧消费    │  Renderer侧消费   │
│  · 策略引擎    │  · K线叠加         │
│  · 回测系统    │  · 热力图           │
│  · 风控引擎    │  · 信号面板         │
└──────────────┴──────────────────┘
```

## 模块索引

| 模块 | 路径 | 说明 |
|------|------|------|
| 因子引擎 | `electron/engine/factors/` | 240因子计算+数据 |
| 策略引擎 | `electron/engine/strategies/` | 196模板管理 |
| 券商适配 | `electron/broker/` | 15券商适配 |
| 计费引擎 | `electron/engine/billing/` | 用量+计费 |
| 安全引擎 | `electron/engine/security/` | AI安全+审计 |
| 回测引擎 | `electron/engine/backtest/` | 回测+步进前移 |
| 数据引擎 | `electron/engine/data/` | 数据管道+校验 |
| 风控引擎 | `electron/engine/risk/` | 风控+异常检测 |
| IPC系统 | `electron/ipc/` | 可靠通信+通道 |
| UI组件 | `src/components/` | React组件库 |
| 图表库 | `src/lib/chart/` | 图表+绘制适配 |
| i18n系统 | `src/i18n/` | 11语言 |
| 主题引擎 | `src/lib/theme/` | 6预设主题 |
| 格式化 | `src/lib/i18n/` | 统一数字/货币/日期 |
| 服务端 | `server/` | REST API+数据服务 |
