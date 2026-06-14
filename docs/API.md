<!-- META
version: 1.12.0
last_updated: 2026-06-12
round: R108
owner: team
purpose: (auto-generated, needs review)
-->

# TradingEasy — API Reference

> Generated: 2026-06-04 | 9 modules

## Table of Contents
- [capital-flow-rank](#capital-flow-rank)
- [consumer-data](#consumer-data)
- [data-consistency-checker](#data-consistency-checker)
- [dragon-tiger-list](#dragon-tiger-list)
- [fund-holdings](#fund-holdings)
- [margin-data](#margin-data)
- [market-breadth](#market-breadth)
- [nl-parser](#nl-parser)
- [stock-diagnosis](#stock-diagnosis)

## capital-flow-rank

_个股资金流排行（今日）_

**File:** `electron/engine/capital-flow-rank.ts`

### `export async function getStockCapitalFlowRank`

**Kind:** function  

个股资金流排行（今日）

---

### `export async function getSectorCapitalFlowRank`

**Kind:** function  

行业板块资金流排行

---

### `export async function getConceptCapitalFlowRank`

**Kind:** function  

概念板块资金流排行

---

### `export async function getMainForceTopN`

**Kind:** function  

获取主力净流入 Top N

---

### `export async function getMainForceBottomN`

**Kind:** function  

获取主力净流出 Top N

---

### `export async function getSectorInflowTopN`

**Kind:** function  

获取行业资金流入 Top N（供 Sector Rotation 使用）

---

## consumer-data

_获取 CPI 细项数据_

**File:** `electron/engine/consumer-data.ts`

### `export async function getCPISubIndexes`

**Kind:** function  

获取 CPI 细项数据

---

### `export async function getRetailSales`

**Kind:** function  

获取社会消费品零售数据

---

### `export async function getConsumerConfidence`

**Kind:** function  

获取消费者信心指数

---

### `export async function getConsumerDataReport`

**Kind:** function  

获取完整消费者数据报告

---

## data-consistency-checker

_Validate stock data consistency_

**File:** `electron/engine/data-consistency-checker.ts`

### `export async function runConsistencyCheck`

**Kind:** class  

Validate stock data consistency / validateStockData(data: any[]): ConsistencyCheckResult { const checks: ConsistencyCheck[] = []; for (const stock of data) { const stockChecks = this.validateStockFiel

---

### `export function getConsistencyRules`

**Kind:** class  

Get current consistency validation rules

---

## dragon-tiger-list

_获取龙虎榜列表（当日或指定日期）_

**File:** `electron/engine/dragon-tiger-list.ts`

### `export async function getDragonTigerList`

**Kind:** function  

获取龙虎榜列表（当日或指定日期）

---

### `export async function getDragonTigerDetail`

**Kind:** function  

获取个股龙虎榜详情（买卖前五席位）

---

### `export async function getInstitutionalTrades`

**Kind:** function  

获取机构专用席位数据

---

### `export function clearDragonTigerCache`

**Kind:** function  

Clear cache

---

## fund-holdings

_获取基金持仓明细（按基金查）_

**File:** `electron/engine/fund-holdings.ts`

### `export async function getFundHoldings`

**Kind:** function  

获取基金持仓明细（按基金查）

---

### `export async function getStockFundOwnership`

**Kind:** function  

获取个股被基金持仓情况（按股票查）

---

### `export async function getFundIncreaseRank`

**Kind:** function  

获取基金增持榜（机构看好信号）

---

### `export async function getFundDecreaseRank`

**Kind:** function  

获取基金减持榜（机构看空信号）

---

## margin-data

_获取市场融资融券余额历史_

**File:** `electron/engine/margin-data.ts`

### `export async function getMarketMarginBalance`

**Kind:** function  

获取市场融资融券余额历史

---

### `export async function getStockMargin`

**Kind:** function  

获取个股融资融券数据

---

### `export async function getMarginBalanceRanking`

**Kind:** function  

获取融资余额排行（Top N）

---

### `export async function getShortInterestRanking`

**Kind:** function  

获取融券余量排行（Top N）

---

### `export async function getMarginDataReport`

**Kind:** function  

获取完整融资融券报告

---

## market-breadth

_获取当前市场广度数据_

**File:** `electron/engine/market-breadth.ts`

### `export async function getMarketBreadth`

**Kind:** function  

获取当前市场广度数据

---

## nl-parser

_将自然语言输入规范化：用同义词映射替换口语化表达_

**File:** `electron/engine/nl-parser.ts`

### `function normalizeInput`

**Kind:** function  

将自然语言输入规范化：用同义词映射替换口语化表达

---

## stock-diagnosis

_Batch diagnose multiple stocks_

**File:** `electron/engine/stock-diagnosis.ts`

### `export async function batchDiagnose`

**Kind:** function  

Batch diagnose multiple stocks

---
