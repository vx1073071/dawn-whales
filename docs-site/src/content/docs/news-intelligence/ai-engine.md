---
title: AI 情绪引擎
description: QUANT MOO DeepSeek AI 情绪分析引擎 — 原理、Prompt 设计、降级策略、准确率
---

# 🤖 AI 情绪引擎

> 版本: v2.7.0 | 最后更新: 2026-06-16

## 概述

QUANT MOO 使用 **DeepSeek V4 Pro** 作为情绪分析引擎，对所有新闻进行自动化情绪分类和影响评估。引擎采用分级处理 + 多层降级策略，确保高可用性和低延迟。

---

## 核心指标

| 指标 | 值 |
|------|:---:|
| 模型 | DeepSeek V4 Pro + Flash |
| F1 分数 | > 0.85 (100 条人工标注验证) |
| 平均延迟 | P0: < 2s, P1: < 3s, P2: < 5s |
| 日处理量 | ~5,000 条 |
| 缓存命中率 | ~60% (24h TTL) |
| 单条成本 | ~0.0002U |

---

## 架构

```
新闻输入 → 分级队列 → DeepSeek API → 结构化输出 → 缓存 + 管线
                │
                ├─ P0 (黑天鹅/突发)
                │  └─ DeepSeek V4 Pro (低延迟)
                │
                ├─ P1 (财报/政策/重要)
                │  └─ DeepSeek V4 Pro
                │
                └─ P2 (一般/行业)
                   └─ DeepSeek Flash (低成本)
                   │
                   ▼ (失败时)
              降级链: DeepSeek → 关键词分析 → 中性默认
```

---

## Prompt 设计

### 结构化输出格式

引擎要求 AI 返回严格的 JSON 结构：

```json
{
  "score": -0.8,
  "confidence": 0.92,
  "tickers": ["TSLA"],
  "keywords": ["recall", "safety", "NHTSA"],
  "category": "company",
  "impact": 8,
  "reasoning": "Safety recall of 2M vehicles suggests short-term negative sentiment"
}
```

### 输出字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `score` | -1.0~+1.0 | 情绪得分，负=利空，正=利好 |
| `confidence` | 0.0~1.0 | AI 置信度 |
| `tickers` | string[] | 关联股票代码 |
| `keywords` | string[] | 关键主题词 (≤5) |
| `category` | enum | 新闻分类 |
| `impact` | 1-10 | 影响力评估 |
| `reasoning` | string | 分析理由 |

### 多语言原生支持

DeepSeek V4 Pro 原生支持 11 种语言，新闻原文直传，不做翻译：

```
中文新闻 → DeepSeek (中文理解) → 结构化输出
日文新闻 → DeepSeek (日文理解) → 结构化输出
英文新闻 → DeepSeek (英文理解) → 结构化输出
```

---

## 新闻分类体系

| 分类 | 说明 | 示例 |
|------|------|------|
| `earnings` | 财报 | Apple 超预期、Tesla 不达预期 |
| `policy` | 政策 | Fed 加息、PBOC 降准 |
| `industry` | 行业 | 半导体短缺、新能源补贴 |
| `company` | 公司 | 产品发布、管理层变动 |
| `macro` | 宏观 | GDP 数据、CPI 报告 |
| `technical` | 技术面 | 突破关键均线、RSI 超买 |
| `social` | 社交情绪 | WSB 讨论、Twitter 趋势 |
| `breaking` | 突发 | 黑天鹅事件、盘前急变 |

---

## 降级策略 (Degradation Chain)

当 DeepSeek API 不可用时，系统自动降级：

| 优先级 | 策略 | 延迟 | 准确率 |
|:---:|------|:---:|:---:|
| 1 | DeepSeek V4 Pro / Flash | < 5s | > 0.85 |
| 2 | **关键词匹配** | < 100ms | ~0.60 |
| 3 | **中性默认** | < 1ms | ~0.50 |

**关键词库**: 500+ 中英文金融关键词，覆盖多空双向。

---

## 熔断器 (Circuit Breaker)

防止 API 故障级联：

```
连续失败 5 次 → 熔断开启 (60s)
         │
         ├─ 期间所有请求走降级链
         │
         └─ 60s 后 → 半开 (允许 1 次探测)
              │
              ├─ 成功 → 关闭熔断
              └─ 失败 → 重新 60s
```

---

## 缓存策略

| 缓存层 | TTL | 容量 |
|------|:---:|:---:|
| L1 (内存 LRU) | 24h | 500 条目 |
| L2 (文件) | 48h | 5,000 条目 |

缓存键: `SHA-256(title + source + tickers)`

---

## 成本追踪

系统自动追踪每次 API 调用的成本和延迟：

```typescript
interface AIUsageRecord {
  totalCalls: number;
  totalCost: number;
  avgLatency: number;
  circuitOpenings: number;
  degradationRate: number;
}
```

月度预估成本: ~25U (5 万条新闻 × 0.0005U/条)

---

## 准确率验证

测试方法: 100 条人工标注新闻 vs DeepSeek 输出

| 指标 | 值 |
|------|:---:|
| 精确率 (Precision) | 0.87 |
| 召回率 (Recall) | 0.84 |
| F1 分数 | **0.85** |
| 分类准确率 | 0.91 |

---

## 相关模块

| 模块 | 路径 |
|------|------|
| AI 情绪引擎 | `electron/engine/data/ai-sentiment-engine.ts` |
| 去重引擎 | `electron/engine/data/dedup-engine.ts` |
| NewsAPI 管理器 | `electron/engine/data/newsapi-manager.ts` |
