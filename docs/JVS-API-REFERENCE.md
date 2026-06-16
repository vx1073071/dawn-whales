<!-- META
version: 1.12.0
last_updated: 2026-06-12
round: R108
owner: team
purpose: (auto-generated, needs review)
-->

# JVS Data Layer API Reference

> **Author**: JVS  
> **Last Updated**: 2026-06-04  
> **Status**: JVS-1~8 Complete, All 38/38 Tests Pass  
> **Total Commits**: 12 commits (9 tasks + scheduler + macro fix + API doc)

---

## Overview

JVS provides the **market data infrastructure** for quant-moo, covering sector heatmaps, macro indicators, sentiment analysis, stock screening, news aggregation, sector rotation monitoring, anomaly detection, and market hotspot discovery.

All data is exposed via **IPC handlers** and accessible through the **preload bridge** and **renderer API**.

---

## 1. Sector Heatmap (JVS-1)

**File**: `electron/data/em-data-provider.ts`  
**Data Source**: East Money push2 API + Python skill fallback  
**Cache**: 5min (trading) / 30min (idle)

### IPC Handlers

#### `em:get-heatmap`
```typescript
// Get sector heatmap data
ipcRenderer.invoke('em:get-heatmap', boardType?: string, limit?: number)

// boardType: 'industry' | 'concept' | 'region' (default: 'industry')
// limit: number of sectors (default: 50)

// Returns:
{
  success: boolean,
  sectors: SectorData[],  // Array of sector data
  total: number,
  timestamp: number,
  source: string,
  error?: string
}
```

#### `em:get-all-heatmaps`
```typescript
// Get all board types at once
ipcRenderer.invoke('em:get-all-heatmaps')

// Returns:
{
  success: boolean,
  industry: HeatmapResult,
  concept: HeatmapResult,
  region: HeatmapResult
}
```

### Renderer API
```typescript
import { getSectorHeatmap, getAllSectorHeatmaps } from '@/lib/bridge-api'

const result = await getSectorHeatmap('industry', 50)
const all = await getAllSectorHeatmaps()
```

### Data Structure
```typescript
interface SectorData {
  name: string           // 板块名称
  code: string           // 板块代码
  changePct: number      // 涨跌幅 %
  changeAmt: number      // 涨跌额
  latestPrice: number    // 最新价
  volume: number         // 成交额 (元)
  leadingStock: string   // 领涨股名称
  leadingStockPct: number // 领涨股涨幅 %
  risingCount: number    // 上涨家数
  fallingCount: number   // 下跌家数
  turnoverRate: number   // 换手率 %
  timestamp: number
}
```

---

## 2. Macro Dashboard (JVS-2)

**File**: `electron/data/macro-provider.ts`  
**Data Source**: East Money datacenter API (HTTPS)  
**Cache**: 1h TTL

### Supported Indicators

| Indicator | API Status | Notes |
|-----------|-----------|-------|
| GDP | ✅ Working | `RPT_ECONOMY_GDP`, SUM_SAME = YoY% |
| CPI | ✅ Working | `RPT_ECONOMY_CPI`, NATIONAL_SAME = YoY% |
| PMI | ✅ Working | `RPT_ECONOMY_PMI`, MAKE_INDEX = manufacturing |
| PPI | ✅ Working | `RPT_ECONOMY_PPI`, BASE_SAME = YoY% |
| M2 | ⚠️ Fallback | Uses CPI table, needs em-mx-macro-data script |
| LPR | ⚠️ Fallback | Uses CPI table, needs em-mx-macro-data script |
| Unemployment | ⚠️ Fallback | Uses CPI table, needs em-mx-macro-data script |
| Industrial | ⚠️ Fallback | Uses PPI table, needs em-mx-macro-data script |

### IPC Handlers

#### `em:get-macro`
```typescript
// Get single indicator time series
ipcRenderer.invoke('em:get-macro', indicator?: string, limit?: number)

// indicator: 'GDP' | 'CPI' | 'PMI' | 'PPI' | 'M2' | 'LPR' | 'UNEMPLOYMENT' | 'INDUSTRIAL'
// limit: number of data points (default: 24)

// Returns:
{
  success: boolean,
  data: MacroIndicatorSummary
}
```

#### `em:get-macro-dashboard`
```typescript
// Get all indicators for dashboard view
ipcRenderer.invoke('em:get-macro-dashboard', indicators?: string[])

// Returns:
{
  success: boolean,
  indicators: MacroIndicatorSummary[],
  timestamp: number,
  source: string
}
```

### Renderer API
```typescript
import { getMacroIndicator, getMacroDashboard } from '@/lib/bridge-api'

const gdp = await getMacroIndicator('GDP', 12)
const dashboard = await getMacroDashboard(['GDP', 'CPI', 'PMI'])
```

### Data Structure
```typescript
interface MacroPoint {
  indicator: string
  date: string           // YYYY-MM or YYYY-MM-DD
  value: number
  yoy: number            // Year-over-year %
  mom: number            // Month-over-month %
  unit: string           // '%', 'billion', 'index'
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'
}

interface MacroIndicatorSummary {
  indicator: string
  latest: MacroPoint | null
  trend: 'up' | 'down' | 'flat'
  history: MacroPoint[]
  lastUpdated: number
}
```

---

## 3. Sentiment Index (JVS-3)

**File**: `electron/engine/sentiment-index.ts`  
**Algorithm**: Weighted composite of 6 market indicators

### IPC Handlers

#### `em:get-sentiment`
```typescript
// Compute composite sentiment score
ipcRenderer.invoke('em:get-sentiment', input?: SentimentInput)

// Returns:
{
  success: boolean,
  result: SentimentResult
}
```

### Renderer API
```typescript
import { computeSentiment } from '@/lib/bridge-api'

const result = await computeSentiment({
  capitalFlowNetInflow: 50,
  northboundNetBuy: 10,
  advanceCount: 3000,
  declineCount: 1500,
  totalTurnover: 1200,
  limitUpCount: 20,
  limitDownCount: 5
})
```

### Data Structure
```typescript
interface SentimentInput {
  capitalFlowNetInflow?: number      // 主力资金净流入 (亿元)
  capitalFlowTrend?: 'increasing' | 'decreasing' | 'flat'
  marginBalanceChange?: number       // 融资余额变化 (亿元)
  northboundNetBuy?: number          // 北向资金净买入 (亿元)
  advanceCount?: number              // 上涨家数
  declineCount?: number              // 下跌家数
  totalTurnover?: number             // 总成交额 (亿元)
  limitUpCount?: number              // 涨停家数
  limitDownCount?: number            // 跌停家数
}

interface SentimentResult {
  score: number              // 0-100 composite score
  level: 'extreme_fear' | 'fear' | 'neutral' | 'greed' | 'extreme_greed'
  description: string
  components: SentimentComponent[]
  signal: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell'
  timestamp: number
}
```

### Component Weights
| Component | Weight | Description |
|-----------|--------|-------------|
| Capital Flow | 25% | 主力资金流向 |
| Northbound | 20% | 北向资金 |
| Advance/Decline | 20% | 涨跌家数比 |
| Margin Balance | 15% | 融资余额变化 |
| Turnover | 10% | 市场成交额 |
| Limit Up/Down | 10% | 涨跌停家数 |

---

## 4. Stock Screener (JVS-4)

**File**: `electron/engine/stock-screener.ts`  
**Data Source**: em-mx-stocks-screener Python skill

### IPC Handlers

#### `screener:search`
```typescript
// Execute stock screening query
ipcRenderer.invoke('screener:search', request: ScreenerRequest)

// Returns:
{
  success: boolean,
  records: StockRecord[],
  total: number,
  query: string,
  selectType: string,
  durationMs: number,
  description: string,
  csvPath: string
}
```

### Renderer API
```typescript
import { searchStocks } from '@/lib/bridge-api'

const result = await searchStocks({
  query: '股价大于100元，主力流入，成交额前50',
  selectType: 'A股',
  limit: 50
})
```

### Supported Types
| SelectType | Description | Example Query |
|------------|-------------|---------------|
| A股 | A股股票 | '创业板市盈率最低的50只' |
| 港股 | 港股股票 | '港股的科技龙头' |
| 美股 | 美股股票 | '纳斯达克市值前30' |
| 板块 | 板块 | '今天涨幅最大板块' |
| 基金 | 基金 | '白酒主题基金近一年收益排名' |
| ETF | ETF | '规模超2亿的电力ETF' |
| 可转债 | 可转债 | '价格低于110元溢价率超5个点' |

### Data Structure
```typescript
interface StockRecord {
  code: string              // 股票代码
  name: string              // 股票名称
  price: number | null
  changePct: number | null
  pe: number | null         // 市盈率
  pb: number | null         // 市净率
  marketCap: number | null  // 总市值 (元)
  industry: string          // 所属行业
  extra: Record<string, any> // 其他字段
}
```

---

## 5. News Aggregator (JVS-5)

**File**: `electron/engine/news-aggregator.ts`  
**Data Source**: em-mx-finance-search Python skill  
**Cache**: 10min TTL

### IPC Handlers

#### `em:get-news-aggregate`
```typescript
// Search for financial news
ipcRenderer.invoke('em:get-news-aggregate', request: NewsSearchRequest)

// Returns:
{
  success: boolean,
  articles: NewsArticle[],
  total: number,
  sentimentSummary: SentimentSummary,
  durationMs: number
}
```

#### `em:get-market-mood`
```typescript
// Get overall market mood from recent news
ipcRenderer.invoke('em:get-market-mood', symbols?: string[])

// Returns:
{
  success: boolean,
  report: MarketMoodReport
}
```

### Renderer API
```typescript
import { searchNews, getMarketMood } from '@/lib/bridge-api'

const news = await searchNews({
  query: '半导体 芯片',
  hoursBack: 24,
  limit: 20
})

const mood = await getMarketMood(['002049', '600519'])
```

### Data Structure
```typescript
interface NewsArticle {
  id: string
  title: string
  source: string
  publishTime: number
  url: string
  summary: string
  sentiment: 'positive' | 'negative' | 'neutral'
  sentimentScore: number     // -1.0 to +1.0
  keywords: string[]
  symbols: string[]          // 相关股票代码
  category: 'news' | 'announcement' | 'research' | 'comment'
}

interface MarketMoodReport {
  mood: 'bullish' | 'bearish' | 'mixed' | 'unknown'
  score: number              // -100 to +100
  confidence: number         // 0-1
  topPositiveKeywords: string[]
  topNegativeKeywords: string[]
  articleCount: number
  timestamp: number
}
```

---

## 6. Sector Rotation Monitor (JVS-6)

**File**: `electron/engine/sector-rotation.ts`  
**Data Source**: JVS-1 heatmap snapshots over time  
**Storage**: SQLite 30-day history

### IPC Handlers

#### `em:get-sector-rotation`
```typescript
// Analyze sector rotation patterns
ipcRenderer.invoke('em:get-sector-rotation')

// Returns:
{
  success: boolean,
  hotSectors: SectorTimeSeries[],
  coldSectors: SectorTimeSeries[],
  signals: RotationSignal[],
  leaderBoard: SectorLeader[],
  summary: string
}
```

#### `em:record-sector-snapshot`
```typescript
// Record a new snapshot (call periodically)
ipcRenderer.invoke('em:record-sector-snapshot', sectors: SectorSnapshot[])
```

### Renderer API
```typescript
import { analyzeSectorRotation, recordSectorSnapshot } from '@/lib/bridge-api'

const report = await analyzeSectorRotation()
await recordSectorSnapshot(sectors)  // 由 Data Scheduler 自动调用
```

### Data Structure
```typescript
interface RotationSignal {
  type: 'sector_heating' | 'sector_cooling' | 'rotation_detected' | 'leader_change'
  fromSectors: string[]
  toSectors: string[]
  confidence: number         // 0-1
  description: string
  timestamp: number
}

interface SectorLeader {
  code: string
  name: string
  rank: number
  momentumScore: number      // 0-100
  changePct: number
  daysInTop: number
}
```

---

## 7. Stock Anomaly Detector (JVS-7)

**File**: `electron/engine/stock-anomaly-detector.ts`  
**Detection Types**: 8 types of market anomalies

### IPC Handlers

#### `em:get-anomaly-summary`
```typescript
// Get anomaly summary for last N hours
ipcRenderer.invoke('em:get-anomaly-summary')

// Returns:
{
  success: boolean,
  summary: AnomalySummary
}
```

#### `em:get-anomaly-alerts`
```typescript
// Get filtered anomaly alerts
ipcRenderer.invoke('em:get-anomaly-alerts', options?: AnomalyFilterOptions)

// Returns:
{
  success: boolean,
  alerts: AnomalyAlert[]
}
```

#### `em:process-anomaly-quotes`
```typescript
// Process real-time quotes for anomaly detection
ipcRenderer.invoke('em:process-anomaly-quotes', quotes: StockQuote[])

// Returns:
{
  success: boolean,
  newAlerts: number
}
```

#### `em:acknowledge-anomaly`
```typescript
// Acknowledge an alert
ipcRenderer.invoke('em:acknowledge-anomaly', id: string)
```

### Renderer API
```typescript
import { 
  getAnomalySummary, 
  getAnomalyAlerts,
  processAnomalyQuotes,
  acknowledgeAnomalyAlert 
} from '@/lib/bridge-api'

const summary = await getAnomalySummary()
const alerts = await getAnomalyAlerts({ level: 'critical', limit: 20 })
await processAnomalyQuotes(quotes)
await acknowledgeAnomalyAlert('alert-id')
```

### Detection Types
| Type | Description | Threshold |
|------|-------------|-----------|
| `limit_up` | 涨停 | changePct > 9.8% |
| `limit_down` | 跌停 | changePct < -9.8% |
| `volume_surge` | 成交量异动 | volume > 3x avg |
| `price_breakout` | 突破近期高/低点 | - |
| `rapid_change` | 快速涨跌 | > 3% in 5min |
| `gap_up` | 跳空高开 | open > prevClose + 3% |
| `gap_down` | 跳空低开 | open < prevClose - 3% |
| `turnover_spike` | 换手率异常 | turnover > 5x avg |

---

## 8. Market Hotspot Discovery (JVS-8)

**File**: `electron/engine/market-hotspot.ts`  
**Data Source**: em-stock-market-hotspot-discovery Python skill  
**Cache**: 15min TTL

### IPC Handlers

#### `em:get-hotspot`
```typescript
// Get market hotspot report
ipcRenderer.invoke('em:get-hotspot', query?: HotspotQuery)

// query.type: 'all' | 'sector' | 'stock' | 'theme'
// query.limit: number (default: 20)

// Returns:
{
  success: boolean,
  hotspots: HotspotItem[],
  hotStocks: HotStock[],
  topSectors: string[],
  topThemes: string[],
  summary: string
}
```

### Renderer API
```typescript
import { getMarketHotspot } from '@/lib/bridge-api'

const report = await getMarketHotspot({ type: 'all', limit: 20 })
```

### Data Structure
```typescript
interface HotspotItem {
  id: string
  title: string
  category: 'sector' | 'theme' | 'stock' | 'event' | 'policy'
  heat: number             // 0-100 heat score
  description: string
  relatedStocks: string[]
  relatedSectors: string[]
  source: string
  url: string
  timestamp: number
}

interface HotStock {
  code: string
  name: string
  reason: string           // 为什么热门
  changePct: number
  heatScore: number        // 0-100
  mentions: number         // 新闻提及次数
}
```

---

## 9. Data Scheduler (Infrastructure)

**File**: `electron/engine/data-scheduler.ts`  
**Purpose**: Periodic auto-refresh of market data

### Registered Modules
| Module | Trading Interval | Idle Interval | Description |
|--------|-----------------|---------------|-------------|
| `heatmap` | 5min | 30min | 板块热力图 |
| `macro` | 60min | 60min | 宏观数据 |
| `news` | 15min | 30min | 新闻聚合 |
| `hotspot` | 15min | 30min | 市场热点 |

### Trading Hours
- **Timezone**: Asia/Shanghai (UTC+8)
- **Hours**: 09:15 - 15:05
- **Days**: Monday - Friday (excluding weekends)

### IPC Handlers

#### `data:scheduler-status`
```typescript
// Get scheduler status
ipcRenderer.invoke('data:scheduler-status')

// Returns:
{
  success: boolean,
  status: {
    running: boolean,
    enabled: boolean,
    lastRefresh: Record<string, number>,
    nextRefresh: Record<string, number>,
    refreshCount: Record<string, number>,
    isTradingHours: boolean,
    uptime: number
  }
}
```

#### `data:scheduler-refresh`
```typescript
// Manually trigger refresh
ipcRenderer.invoke('data:scheduler-refresh', module?: string)

// module: 'heatmap' | 'macro' | 'news' | 'hotspot' (or undefined for all)
```

### Renderer API
```typescript
import { getSchedulerStatus, refreshDataNow } from '@/lib/bridge-api'

const status = await getSchedulerStatus()
await refreshDataNow('heatmap')  // 刷新单个模块
await refreshDataNow()           // 刷新所有模块
```

---

## Usage Examples

### Example 1: Dashboard with Real-time Data
```typescript
import { useEffect, useState } from 'react'
import { 
  getSectorHeatmap, 
  getMacroDashboard, 
  computeSentiment,
  getAnomalySummary 
} from '@/lib/bridge-api'

function Dashboard() {
  const [data, setData] = useState(null)

  useEffect(() => {
    async function loadData() {
      const [heatmap, macro, sentiment, anomalies] = await Promise.all([
        getSectorHeatmap('industry', 20),
        getMacroDashboard(['GDP', 'CPI', 'PMI']),
        computeSentiment({ capitalFlowNetInflow: 50 }),
        getAnomalySummary()
      ])
      
      setData({ heatmap, macro, sentiment, anomalies })
    }
    
    loadData()
    
    // Auto-refresh every 5 minutes
    const interval = setInterval(loadData, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  if (!data) return <div>Loading...</div>
  
  return (
    <div>
      <HeatmapChart data={data.heatmap.sectors} />
      <MacroCards data={data.macro.indicators} />
      <SentimentGauge score={data.sentiment.result.score} />
      <AnomalyAlerts alerts={data.anomalies.summary.topMovers} />
    </div>
  )
}
```

### Example 2: Stock Screener + News
```typescript
import { searchStocks, searchNews } from '@/lib/bridge-api'

async function researchStock(query: string) {
  // Screen stocks matching criteria
  const stocks = await searchStocks({
    query,
    selectType: 'A股',
    limit: 20
  })
  
  // Get news for top stocks
  const topCodes = stocks.records.slice(0, 5).map(r => r.code)
  const news = await searchNews({
    query: topCodes.join(' '),
    hoursBack: 48,
    limit: 30
  })
  
  return { stocks: stocks.records, news: news.articles }
}
```

### Example 3: Sector Rotation Strategy
```typescript
import { analyzeSectorRotation, getSectorHeatmap } from '@/lib/bridge-api'

async function rotationStrategy() {
  // Get current heatmap
  const heatmap = await getSectorHeatmap('industry')
  
  // Record snapshot
  await recordSectorSnapshot(heatmap.sectors.map(s => ({
    code: s.code,
    name: s.name,
    changePct: s.changePct,
    volume: s.volume,
    risingCount: s.risingCount,
    fallingCount: s.fallingCount,
    timestamp: Date.now()
  })))
  
  // Analyze rotation
  const report = await analyzeSectorRotation()
  
  // Generate trading signals
  const hotSectors = report.hotSectors.slice(0, 5)
  const coldSectors = report.coldSectors.slice(0, 5)
  
  return {
    buy: hotSectors.map(s => s.name),
    sell: coldSectors.map(s => s.name),
    confidence: report.signals[0]?.confidence || 0
  }
}
```

---

## Testing

All modules maintain **38/38 tests passing**. Run tests with:

```bash
cd C:\Users\vx107\.easyclaw\workspace\quant-moo
npx tsx tests/engine.test.ts
```

---

## Known Limitations

1. **push2 API**: Returns 502/302 in terminal Node.js, but works in Electron browser context. Python skill script fallback implemented.

2. **Macro Indicators**: M2/LPR/Unemployment/Industrial use CPI/PPI as fallback. Production should integrate em-mx-macro-data Python script.

3. **Rate Limiting**: East Money APIs may have rate limits. Data Scheduler intervals are designed to avoid throttling.

4. **Data Freshness**: Real-time data depends on East Money API availability. Cache TTLs balance freshness with API load.

---

## Next Steps

1. **Frontend Integration** (WorkBuddy W26-W28):
   - MarketHeatmapPage (em:get-heatmap)
   - MacroDashboardPage (em:get-macro)
   - SentimentGauge (em:get-sentiment)

2. **End-to-End Validation**:
   - Test all IPC handlers with real data
   - Verify cache behavior
   - Test error handling

3. **Performance Optimization**:
   - Profile data fetch times
   - Optimize SQLite queries
   - Consider data compression for large responses

---

**Questions?** Check the implementation files or ask JVS in the bridge channel.
