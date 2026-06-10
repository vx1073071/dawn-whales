// ── JVS-19: EMI Unified Service Layer (EMI数据统一服务层) ─────────────────
// Aggregates all 18 JVS modules into 3 convenient APIs:
//   em:get-stock-overview(code) — one-stop stock data
//   em:get-market-overview     — market panorama
//   em:get-daily-report        — daily market brief (MD format)

import log from 'electron-log';
import { getStockCapitalFlowRank } from './capital-flow-rank';
import { getDragonTigerList } from './dragon-tiger-list';
import { getStockFundOwnership } from './fund-holdings';
import { diagnoseStock } from './stock-diagnosis';
import { SentimentIndexEngine } from './sentiment-index';
import { NewsAggregatorService } from './news-aggregator';
import { StockAnomalyDetector } from './stock-anomaly-detector';
import { getMarketBreadth } from './market-breadth';
import { MacroDataProvider } from '../data/macro-provider';
import { EMDataProvider } from '../data/em-data-provider';

// ── Types ──────────────────────────────────────────────────────────────────

export interface StockOverview {
  code: string;
  name: string;
  timestamp: number;
  
  // Diagnosis
  diagnosis: {
    score: number;
    grade: string;
    recommendation: string;
    summary: string;
  };
  
  // Capital flow
  capitalFlow: {
    mainNetInflow: number | null;
    superLargeIn: number | null;
    largeIn: number | null;
    ranking: number | null;
    signal: string;
  };
  
  // Dragon tiger
  dragonTiger: {
    onBoard: boolean;
    netBuyAmount: number | null;
    reason: string | null;
  };
  
  // Fund holdings
  fundHoldings: {
    fundCount: number;
    totalShares: number;
    increaseCount: number;
    decreaseCount: number;
    signal: string;
  };
  
  // News
  news: {
    count: number;
    sentiment: string;
    mood: string;
    topHeadlines: string[];
  };
  
  // Anomalies
  anomalies: {
    alertCount: number;
    criticalCount: number;
    types: string[];
  };
}

export interface MarketOverview {
  timestamp: number;
  
  // Sector heatmap
  topSectors: {
    name: string;
    changePct: number;
    leadingStock: string;
  }[];
  
  // Macro summary
  macro: {
    gdp: number | null;
    cpi: number | null;
    pmi: number | null;
    ppi: number | null;
  };
  
  // Sentiment
  sentiment: {
    score: number;
    level: string;
    signal: string;
  };
  
  // Market breadth
  breadth: {
    advancing: number;
    declining: number;
    adRatio: number;
    trend: string;
    strength: number;
  };
  
  // Capital flow summary
  capitalFlow: {
    topInflowSectors: string[];
    topOutflowSectors: string[];
  };
}

export interface DailyReport {
  date: string;
  timestamp: number;
  content: string;       // Markdown formatted report
}

// ── Shared Instances ───────────────────────────────────────────────────────

const sentimentEngine = new SentimentIndexEngine();
const newsAggregator = new NewsAggregatorService();
const anomalyDetector = new StockAnomalyDetector();
const macroProvider = new MacroDataProvider();
const emProvider = new EMDataProvider();

// ── API: Stock Overview ────────────────────────────────────────────────────

export async function getStockOverview(code: string): Promise<StockOverview> {
  log.info(`[EMI-Unified] Stock overview: ${code}`);
  
  const result: StockOverview = {
    code,
    name: '',
    timestamp: Date.now(),
    diagnosis: { score: 0, grade: 'N/A', recommendation: 'N/A', summary: '' },
    capitalFlow: { mainNetInflow: null, superLargeIn: null, largeIn: null, ranking: null, signal: 'unknown' },
    dragonTiger: { onBoard: false, netBuyAmount: null, reason: null },
    fundHoldings: { fundCount: 0, totalShares: 0, increaseCount: 0, decreaseCount: 0, signal: 'unknown' },
    news: { count: 0, sentiment: 'neutral', mood: 'mixed', topHeadlines: [] },
    anomalies: { alertCount: 0, criticalCount: 0, types: [] },
  };

  // 1. Diagnosis (aggregates multiple dimensions)
  try {
    const diag = await diagnoseStock({ code });
    if (diag.success) {
      result.name = diag.name || '';
      result.diagnosis = {
        score: diag.overview.score,
        grade: diag.overview.grade,
        recommendation: diag.overview.recommendation,
        summary: diag.overview.summary,
      };
    }
  } catch (err: unknown) {
    log.warn('[EMI-Unified] Diagnosis error:', err.message);
  }

  // 2. Capital flow
  try {
    const flowResult = await getStockCapitalFlowRank('mainNetInflow', 'desc', 500);
    if (flowResult.success) {
      const stockFlow = flowResult.items.find((item: any) => item.code === code) as any;
      if (stockFlow) {
        result.name = result.name || stockFlow.name;
        result.capitalFlow = {
          mainNetInflow: stockFlow.mainNetInflow,
          superLargeIn: stockFlow.superLargeIn,
          largeIn: stockFlow.largeIn,
          ranking: flowResult.items.indexOf(stockFlow) + 1,
          signal: stockFlow.mainNetInflow > 0 ? 'inflow' : stockFlow.mainNetInflow < 0 ? 'outflow' : 'neutral',
        };
      }
    }
  } catch (err: unknown) {
    log.warn('[EMI-Unified] Capital flow error:', err.message);
  }

  // 3. Dragon tiger
  try {
    const dtResult = await getDragonTigerList();
    if (dtResult.success) {
      const dtEntry = dtResult.entries.find((e: any) => e.code === code) as any;
      if (dtEntry) {
        result.name = result.name || dtEntry.name;
        result.dragonTiger = {
          onBoard: true,
          netBuyAmount: dtEntry.netBuyAmount,
          reason: dtEntry.reason,
        };
      }
    }
  } catch (err: unknown) {
    log.warn('[EMI-Unified] Dragon tiger error:', err.message);
  }

  // 4. Fund holdings
  try {
    const fundResult = await getStockFundOwnership(code);
    if (fundResult.success) {
      const items = fundResult.items as any[];
      result.fundHoldings = {
        fundCount: items.length,
        totalShares: items.reduce((s: number, i: any) => s + (i.shares || 0), 0),
        increaseCount: items.filter((i: any) => (i.sharesChange || 0) > 0).length,
        decreaseCount: items.filter((i: any) => (i.sharesChange || 0) < 0).length,
        signal: items.length > 20 ? 'institutional_favorite' : items.length > 5 ? 'moderate' : 'low_coverage',
      };
    }
  } catch (err: unknown) {
    log.warn('[EMI-Unified] Fund holdings error:', err.message);
  }

  // 5. News
  try {
    const newsResult = await newsAggregator.search({ query: code, hoursBack: 72, limit: 10 });
    if (newsResult.success) {
      result.news = {
        count: newsResult.articles.length,
        sentiment: newsResult.sentimentSummary?.overallMood || 'mixed',
        mood: newsResult.sentimentSummary?.overallMood || 'mixed',
        topHeadlines: newsResult.articles.slice(0, 5).map((a: any) => a.title),
      };
    }
  } catch (err: unknown) {
    log.warn('[EMI-Unified] News error:', err.message);
  }

  // 6. Anomalies
  try {
    const alerts = anomalyDetector.getAlerts({ code, limit: 20 });
    result.anomalies = {
      alertCount: alerts.length,
      criticalCount: alerts.filter(a => a.level === 'critical').length,
      types: [...new Set(alerts.map(a => a.type))],
    };
  } catch (err: unknown) {
    log.warn('[EMI-Unified] Anomalies error:', err.message);
  }

  return result;
}

// ── API: Market Overview ───────────────────────────────────────────────────

export async function getMarketOverview(): Promise<MarketOverview> {
  log.info('[EMI-Unified] Market overview');

  const result: MarketOverview = {
    timestamp: Date.now(),
    topSectors: [],
    macro: { gdp: null, cpi: null, pmi: null, ppi: null },
    sentiment: { score: 50, level: 'neutral', signal: 'hold' },
    breadth: { advancing: 0, declining: 0, adRatio: 0, trend: 'neutral', strength: 50 },
    capitalFlow: { topInflowSectors: [], topOutflowSectors: [] },
  };

  // 1. Sector heatmap
  try {
    const heatmap = await emProvider.getHeatmap('industry', 10);
    if (heatmap.success) {
      result.topSectors = heatmap.sectors.slice(0, 5).map((s: any) => ({
        name: s.name,
        changePct: s.changePct,
        leadingStock: s.leadingStock,
      }));
    }
  } catch (err: unknown) {
    log.warn('[EMI-Unified] Heatmap error:', err.message);
  }

  // 2. Macro
  try {
    const dashboard = await macroProvider.getDashboard(['GDP', 'CPI', 'PMI', 'PPI']);
    if (dashboard.success) {
      for (const ind of dashboard.indicators) {
        if (ind.latest) {
          const key = ind.indicator.toLowerCase() as keyof typeof result.macro;
          (result.macro as any)[key] = ind.latest.value;
        }
      }
    }
  } catch (err: unknown) {
    log.warn('[EMI-Unified] Macro error:', err.message);
  }

  // 3. Sentiment
  try {
    const sent = sentimentEngine.compute({});
    result.sentiment = {
      score: sent.score,
      level: sent.level,
      signal: sent.signal,
    };
  } catch (err: unknown) {
    log.warn('[EMI-Unified] Sentiment error:', err.message);
  }

  // 4. Market breadth
  try {
    const breadth = await getMarketBreadth();
    if (breadth.success) {
      result.breadth = {
        advancing: breadth.current.advancing,
        declining: breadth.current.declining,
        adRatio: breadth.indicators.adRatio,
        trend: breadth.indicators.trend,
        strength: breadth.indicators.strength,
      };
    }
  } catch (err: unknown) {
    log.warn('[EMI-Unified] Breadth error:', err.message);
  }

  // 5. Capital flow sectors
  try {
    const { getSectorCapitalFlowRank } = require('./capital-flow-rank');
    const inflowResult = await getSectorCapitalFlowRank('mainNetInflow', 'desc', 5);
    const outflowResult = await getSectorCapitalFlowRank('mainNetInflow', 'asc', 5);
    if (inflowResult.success) {
      result.capitalFlow.topInflowSectors = inflowResult.items.slice(0, 5).map((s: any) => s.name);
    }
    if (outflowResult.success) {
      result.capitalFlow.topOutflowSectors = outflowResult.items.slice(0, 5).map((s: any) => s.name);
    }
  } catch (err: unknown) {
    log.warn('[EMI-Unified] Sector flow error:', err.message);
  }

  return result;
}

// ── API: Daily Report ──────────────────────────────────────────────────────

export async function getDailyReport(): Promise<DailyReport> {
  log.info('[EMI-Unified] Generating daily report');

  const marketOverview = await getMarketOverview();
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];

  const lines: string[] = [];
  lines.push(`# 📊 DAWN WHALES 每日市场简报`);
  lines.push(`**日期**: ${dateStr}  `);
  lines.push(`**生成时间**: ${now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);
  lines.push('');

  // Sentiment
  const sent = marketOverview.sentiment;
  const sentEmoji = sent.score >= 60 ? '🟢' : sent.score >= 40 ? '🟡' : '🔴';
  lines.push(`## ${sentEmoji} 市场情绪`);
  lines.push(`- **情绪指数**: ${sent.score}/100 (${sent.level})`);
  lines.push(`- **逆向信号**: ${sent.signal}`);
  lines.push('');

  // Market breadth
  const b = marketOverview.breadth;
  lines.push(`## 📈 市场广度`);
  lines.push(`- **上涨/下跌**: ${b.advancing} / ${b.declining} (A/D: ${b.adRatio})`);
  lines.push(`- **趋势**: ${b.trend} | **强度**: ${b.strength}/100`);
  lines.push('');

  // Macro
  const m = marketOverview.macro;
  lines.push(`## 🏛️ 宏观经济`);
  lines.push(`- **GDP**: ${m.gdp !== null ? m.gdp + '%' : 'N/A'}`);
  lines.push(`- **CPI**: ${m.cpi !== null ? m.cpi + '%' : 'N/A'}`);
  lines.push(`- **PMI**: ${m.pmi !== null ? m.pmi.toString() : 'N/A'}`);
  lines.push(`- **PPI**: ${m.ppi !== null ? m.ppi + '%' : 'N/A'}`);
  lines.push('');

  // Sectors
  if (marketOverview.topSectors.length > 0) {
    lines.push(`## 🔥 热门板块 Top 5`);
    for (const s of marketOverview.topSectors) {
      const arrow = s.changePct > 0 ? '📈' : s.changePct < 0 ? '📉' : '➡️';
      lines.push(`- ${arrow} **${s.name}** ${s.changePct > 0 ? '+' : ''}${s.changePct}% (领涨: ${s.leadingStock})`);
    }
    lines.push('');
  }

  // Capital flow
  const cf = marketOverview.capitalFlow;
  if (cf.topInflowSectors.length > 0) {
    lines.push(`## 💰 资金流向`);
    lines.push(`- **净流入 Top**: ${cf.topInflowSectors.join(', ')}`);
    if (cf.topOutflowSectors.length > 0) {
      lines.push(`- **净流出 Top**: ${cf.topOutflowSectors.join(', ')}`);
    }
    lines.push('');
  }

  // News
  try {
    const newsResult = await newsAggregator.search({ query: 'A股市场', hoursBack: 24, limit: 5 });
    if (newsResult.success && newsResult.articles.length > 0) {
      lines.push(`## 📰 今日要闻`);
      for (const a of newsResult.articles.slice(0, 5)) {
        lines.push(`- ${a.title}`);
      }
      lines.push('');
    }
  } catch (e) { logger.error('[backend:emi-unified]', e); }

  // Hotspot
  try {
    const { MarketHotspotService } = require('./market-hotspot');
    const hotspotService = new MarketHotspotService();
    const hotspot = await hotspotService.getReport({ limit: 5 });
    if (hotspot.success && hotspot.hotspots.length > 0) {
      lines.push(`## 🔍 市场热点`);
      for (const h of hotspot.hotspots.slice(0, 5)) {
        lines.push(`- [${h.category}] ${h.title} (热度: ${h.heat})`);
      }
      lines.push('');
    }
  } catch (e) { logger.error('[backend:emi-unified]', e); }

  lines.push(`---`);
  lines.push(`*Generated by JVS EMI Unified Service Layer*`);

  return {
    date: dateStr,
    timestamp: Date.now(),
    content: lines.join('\n'),
  };
}
