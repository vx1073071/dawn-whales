import { EngineError, ErrorCode } from '../../errors';
// ── AI Report Generator ─────────────────────────────────────────────────────
// Q4: Backtest Result AI Interpretation
// Input: backtest results array → DeepSeek LLM → Markdown report
// Timeout fallback: 20s → English template, Markdown includes key metrics + risk + recommendations

import log from 'electron-log';
import type { BacktestResult } from '../backtest/backtest-engine';
import i18n from '../../../src/i18n';

export interface ReportSection {
  heading: string;
  content: string;
}

export interface BacktestReport {
  title: string;
  sections: ReportSection[];
  raw: string;          // full LLM output
  fallback: boolean;    // true if LLM timed out
  generatedAt: number;
  tokensUsed?: number;
}

// ── Metric Extraction ─────────────────────────────────────────────────────────

function extractMetrics(result: BacktestResult) {
  const r = result.result;
  return {
    totalReturn: r.totalReturn.toFixed(2),
    annualReturn: r.annualReturn.toFixed(2),
    sharpeRatio: r.sharpeRatio.toFixed(2),
    maxDrawdown: r.maxDrawdown.toFixed(2),
    winRate: r.winRate.toFixed(1),
    profitFactor: r.profitFactor.toFixed(2),
    totalTrades: r.totalTrades,
    avgTradePnl: r.avgTradePnl.toFixed(2),
    avgHoldingBars: r.avgHoldingBars.toFixed(1),
  };
}

// ── Strategy Type Label ─────────────────────────────────────────────────────

function strategyTypeLabel(config: BacktestResult['result']['config']): string {
  const t = config?.strategy?.type ?? 'unknown';
  const labels: Record<string, string> = {
    ma_cross: i18n.t('aiReportGenerator.k1'),
    rsi: i18n.t('aiReportGenerator.k2'),
    macd: i18n.t('aiReportGenerator.k3'),
    momentum: i18n.t('aiReportGenerator.k4'),
    bollinger: i18n.t('aiReportGenerator.k5'),
    custom: i18n.t('aiReportGenerator.k6'),
  };
  return labels[t] ?? t;
}

// ── Fallback Report (English template, no LLM) ───────────────────────────────

function fallbackReport(results: BacktestResult[], symbol?: string): BacktestReport {
  const primary = results[0];
  const m = extractMetrics(primary);
  const type = strategyTypeLabel(primary.result.config);

  const comparisons = results.slice(1).map(r => {
    const mm = extractMetrics(r);
    return `| ${r.result.config?.strategyName ?? 'Strategy'} | ${mm.totalReturn}% | ${mm.sharpeRatio} | ${mm.maxDrawdown}% | ${mm.winRate}% |`;
  }).join('\n');

  const sections: ReportSection[] = [
    {
      heading: '📊 Performance Summary',
      content: [
        `**Symbol:** ${symbol ?? primary.result.config?.symbol ?? 'N/A'}`,
        `**Strategy Type:** ${type}`,
        `**Total Return:** ${m.totalReturn}%`,
        `**Annual Return:** ${m.annualReturn}%`,
        `**Sharpe Ratio:** ${m.sharpeRatio}`,
        `**Max Drawdown:** ${m.maxDrawdown}%`,
        `**Win Rate:** ${m.winRate}%`,
        `**Profit Factor:** ${m.profitFactor}`,
        `**Total Trades:** ${m.totalTrades}`,
        `**Avg Trade P&L:** ${m.avgTradePnl}%`,
        `**Avg Holding Period:** ${m.avgHoldingBars} bars`,
      ].join('\n'),
    },
  ];

  if (comparisons) {
    sections.push({
      heading: '📈 Multi-Strategy Comparison',
      content: [
        '| Strategy | Total Return | Sharpe | Max Drawdown | Win Rate |',
        '|----------|-------------|--------|--------------|----------|',
        comparisons,
      ].join('\n'),
    });
  }

  // Risk assessment
  const riskLevel = parseFloat(m.maxDrawdown) > 20 ? '🔴 HIGH' : parseFloat(m.maxDrawdown) > 10 ? '🟡 MEDIUM' : '🟢 LOW';
  const sharpeGood = parseFloat(m.sharpeRatio) > 1 ? '🟢 Strong' : parseFloat(m.sharpeRatio) > 0.5 ? '🟡 Moderate' : '🔴 Weak';

  sections.push({
    heading: '⚠️ Risk Assessment',
    content: [
      `**Risk Level:** ${riskLevel}`,
      `**Sharpe Quality:** ${sharpeGood}`,
      `**Drawdown Control:** ${parseFloat(m.maxDrawdown) > 15 ? '⚠️ Exceeds 15% threshold — review stop-loss' : '✅ Within acceptable range'}`,
      `**Win Rate Quality:** ${parseFloat(m.winRate) > 50 ? '✅ Above breakeven' : '⚠️ Below breakeven — verify strategy edge'}`,
    ].join('\n'),
  });

  sections.push({
    heading: '💡 Recommendations',
    content: [
      parseFloat(m.sharpeRatio) < 0.5 ? '- ⚠️ Sharpe < 0.5 — strategy may lack edge, reduce position size or optimize parameters' : '- ✅ Positive Sharpe indicates good risk-adjusted returns',
      parseFloat(m.maxDrawdown) > 20 ? '- 🔴 Max drawdown > 20% — implement dynamic stop-loss (ATR-based) or reduce exposure' : '- ✅ Drawdown within limits',
      parseFloat(m.winRate) < 45 ? '- ⚠️ Win rate below 45% — verify signal quality, consider longer holding periods' : '- ✅ Win rate acceptable',
      `**Overall:** ${parseFloat(m.sharpeRatio) > 0.8 && parseFloat(m.maxDrawdown) < 15 ? 'Strategy shows solid performance. Consider Walk-Forward validation.' : 'Strategy needs parameter optimization or risk adjustment before live deployment.'}`,
    ].join('\n'),
  });

  return {
    title: `Backtest Report — ${symbol ?? primary.result.config?.symbol ?? 'N/A'}`,
    sections,
    raw: '',
    fallback: true,
    generatedAt: Date.now(),
  };
}

// ── LLM Report Generator (via server AI gateway, R83 P0-2b) ────────────────
// AI calls now routed through utils/ai-gateway-client.ts — no client-side API key

// ── Multi-Strategy Comparison Table ─────────────────────────────────────────

function buildComparisonTable(results: BacktestResult[]): string {
  const rows = results.map(r => {
    const m = extractMetrics(r);
    const name = r.result.config?.strategyName ?? r.result.config?.strategy?.type ?? 'Strategy';
    return `| **${name}** | ${m.totalReturn}% | ${m.annualReturn}% | ${m.sharpeRatio} | ${m.maxDrawdown}% | ${m.winRate}% | ${m.profitFactor} | ${m.totalTrades} |`;
  });
  return [
    '| Strategy | Total Ret | Ann. Ret | Sharpe | Max DD | Win Rate | PF | Trades |',
    '|----------|-----------|---------|--------|--------|----------|----|--------|',
    ...rows,
  ].join('\n');
}

// ── Main: Generate Backtest Report ──────────────────────────────────────────

export async function generateBacktestReport(
  results: BacktestResult[],
  symbol?: string,

  timeoutMs = 20000
): Promise<BacktestReport> {
  if (results.length === 0) {
    return { title: 'No Data', sections: [{ heading: 'Error', content: 'No backtest results provided.' }], raw: '', fallback: true, generatedAt: Date.now() };
  }

  log.info('[AIReportGenerator] Generating report for', results.length, 'result(s), symbol:', symbol);

  // Build comparison table
  const compTable = buildComparisonTable(results);
  const primary = results[0];
  const m = extractMetrics(primary);
  const typeStr = strategyTypeLabel(primary.result.config);

  // Priority instructions
  const prompt = `${i18n.t('AiReportGenerator.k0')}

${i18n.t('AiReportGenerator.k1')}
${i18n.t('AiReportGenerator.k2')}
${i18n.t('AiReportGenerator.k3')}
${i18n.t('AiReportGenerator.k4')}
${i18n.t('AiReportGenerator.k5')}
${i18n.t('AiReportGenerator.k6')}

${i18n.t('AiReportGenerator.k7')}
${i18n.t('AiReportGenerator.k8')}${typeStr}
${i18n.t('AiReportGenerator.k9')}${symbol ?? primary.result.config?.symbol ?? 'N/A'}

${i18n.t('AiReportGenerator.k10')}
${i18n.t('AiReportGenerator.k11')}${m.totalReturn}%
${i18n.t('AiReportGenerator.k12')}${m.annualReturn}%
${i18n.t('AiReportGenerator.k13')}${m.sharpeRatio}
${i18n.t('AiReportGenerator.k14')}${m.maxDrawdown}%
${i18n.t('AiReportGenerator.k15')}${m.winRate}%
${i18n.t('AiReportGenerator.k16')}${m.profitFactor}
${i18n.t('AiReportGenerator.k17')}${m.totalTrades}
${i18n.t('AiReportGenerator.k18')}${m.avgTradePnl}%
${i18n.t('AiReportGenerator.k19')}${m.avgHoldingBars} ${i18n.t('AiReportGenerator.k20')}

${i18n.t('AiReportGenerator.k21')}
${compTable}

${i18n.t('AiReportGenerator.k22')}`;

  try {
    let raw = '';
    try {
      const { callChatCompletions } = await import('./utils/ai-gateway-client');
      const result = await callChatCompletions({
        messages: [{ role: 'user', content: prompt }],
        model: 'deepseek-chat',
        temperature: 0.25,
        max_tokens: 600,
      }, timeoutMs);
      if (!result.success) throw new EngineError("result.error", { code: ErrorCode.ENGINE_INTERNAL_ERROR });
      raw = result.content;
    } catch (e) {
      throw new EngineError("AI Gateway error: ' + e.message", { code: ErrorCode.ENGINE_AI_ERROR });
    }

    if (!raw?.trim()) throw new EngineError("Empty LLM response", { code: ErrorCode.ENGINE_AI_ERROR });

    // Parse sections from LLM output (split by ## headings)
    const sectionBlocks = raw.split(/(?=^#{1,3}\s)/m);
    const sections: ReportSection[] = sectionBlocks
      .map(block => {
        const lines = block.trim().split('\n');
        const heading = lines[0]?.replace(/^#+\s*/, '').trim() || 'Analysis';
        return { heading, content: lines.slice(1).join('\n').trim() };
      })
      .filter(s => s.content.length > 0);

    return {
      title: `Backtest Report — ${symbol ?? primary.result.config?.symbol ?? 'N/A'}`,
      sections: sections.length > 0 ? sections : [{ heading: 'Analysis', content: raw }],
      raw,
      fallback: false,
      generatedAt: Date.now(),
    };
  } catch (err: unknown) {
    const aborted = err.name === 'AbortError' || err.message?.includes('timeout');
    log.warn(`[AIReportGenerator] ${aborted ? 'Timeout' : 'LLM error'}: ${err.message}`);
    // Fallback to English template
    return fallbackReport(results, symbol);
  }
}

// ── Quick single-result report ───────────────────────────────────────────────

/** @deprecated R83 — use server-side AI Gateway token */
export async function generateQuickReport(result: BacktestResult, apiKey?: string): Promise<BacktestReport> {
  return generateBacktestReport([result], result.result.config?.symbol, apiKey);
}

// ── Daily Report Generation ─────────────────────────────────────────────────

export interface DailyReportData {
  date: string;
  portfolioValue: number;
  dailyPnl: number;
  dailyPnlPct: number;
  topPerformers: Array<{ symbol: string; pnl: number; pnlPct: number }>;
  worstPerformers: Array<{ symbol: string; pnl: number; pnlPct: number }>;
  signals: { buy: number; sell: number; hold: number };
  riskLevel: 'low' | 'medium' | 'high';
  alertsTriggered: number;
}

export async function generateDailyReport(
  data: DailyReportData,
  timeoutMs = 15000
): Promise<BacktestReport> {
  log.info('[AIReportGenerator] Generating daily report for', data.date);

  const prompt = `${i18n.t('AiReportGenerator.k23')}

${i18n.t('AiReportGenerator.k24')}
${i18n.t('AiReportGenerator.k25')}
${i18n.t('AiReportGenerator.k26')}
${i18n.t('AiReportGenerator.k27')}
${i18n.t('AiReportGenerator.k28')}

${i18n.t('AiReportGenerator.k29')}
${i18n.t('AiReportGenerator.k30')}${data.date}
${i18n.t('AiReportGenerator.k31')}${data.portfolioValue.toFixed(2)}
${i18n.t('AiReportGenerator.k32')}${data.dailyPnl.toFixed(2)} (${data.dailyPnlPct.toFixed(2)}%)

${i18n.t('AiReportGenerator.k33')}
${data.topPerformers.slice(0, 3).map(p => `- ${p.symbol}: $${p.pnl.toFixed(2)} (${p.pnlPct.toFixed(2)}%)`).join('\n')}

${i18n.t('AiReportGenerator.k34')}
${data.worstPerformers.slice(0, 3).map(p => `- ${p.symbol}: $${p.pnl.toFixed(2)} (${p.pnlPct.toFixed(2)}%)`).join('\n')}

${i18n.t('AiReportGenerator.k35')}
${i18n.t('AiReportGenerator.k36')}${data.signals.buy} ${i18n.t('AiReportGenerator.k37')}
${i18n.t('AiReportGenerator.k38')}${data.signals.sell} ${i18n.t('AiReportGenerator.k39')}
${i18n.t('AiReportGenerator.k40')}${data.signals.hold} ${i18n.t('AiReportGenerator.k41')}

${i18n.t('AiReportGenerator.k42')}${data.riskLevel}
${i18n.t('AiReportGenerator.k43')}${data.alertsTriggered} ${i18n.t('AiReportGenerator.k44')}

${i18n.t('AiReportGenerator.k45')}`;

  try {
    let raw = '';
    try {
      const { callChatCompletions } = await import('./utils/ai-gateway-client');
      const result = await callChatCompletions({
        messages: [{ role: 'user', content: prompt }],
        model: 'deepseek-chat',
        temperature: 0.25,
        max_tokens: 600,
      }, timeoutMs);
      if (!result.success) throw new EngineError("result.error", { code: ErrorCode.ENGINE_INTERNAL_ERROR });
      raw = result.content;
    } catch (e) {
      throw new EngineError("AI Gateway error: ' + e.message", { code: ErrorCode.ENGINE_AI_ERROR });
    }

    if (!raw?.trim()) throw new EngineError("Empty LLM response", { code: ErrorCode.ENGINE_AI_ERROR });

    const sectionBlocks = raw.split(/(?=^#{1,3}\s)/m);
    const sections: ReportSection[] = sectionBlocks
      .map(block => {
        const lines = block.trim().split('\n');
        const heading = lines[0]?.replace(/^#+\s*/, '').trim() || 'Daily Summary';
        return { heading, content: lines.slice(1).join('\n').trim() };
      })
      .filter(s => s.content.length > 0);

    return {
      title: `Daily Report — ${data.date}`,
      sections: sections.length > 0 ? sections : [{ heading: 'Daily Summary', content: raw }],
      raw,
      fallback: false,
      generatedAt: Date.now(),
    };
  } catch (err: unknown) {
    const aborted = err.name === 'AbortError' || err.message?.includes('timeout');
    log.warn(`[AIReportGenerator] Daily report ${aborted ? 'timeout' : 'error'}: ${err.message}`);
    return fallbackDailyReport(data);
  }
}

function fallbackDailyReport(data: DailyReportData): BacktestReport {
  const sections: ReportSection[] = [
    {
      heading: '📊 Daily Summary',
      content: [
        `**Date:** ${data.date}`,
        `**Portfolio Value:** $${data.portfolioValue.toFixed(2)}`,
        `**Daily P&L:** $${data.dailyPnl.toFixed(2)} (${data.dailyPnlPct.toFixed(2)}%)`,
      ].join('\n'),
    },
    {
      heading: '🏆 Top Performers',
      content: data.topPerformers
        .slice(0, 3)
        .map(p => `- **${p.symbol}:** $${p.pnl.toFixed(2)} (${p.pnlPct.toFixed(2)}%)`)
        .join('\n'),
    },
    {
      heading: '📉 Worst Performers',
      content: data.worstPerformers
        .slice(0, 3)
        .map(p => `- **${p.symbol}:** $${p.pnl.toFixed(2)} (${p.pnlPct.toFixed(2)}%)`)
        .join('\n'),
    },
    {
      heading: '📡 Signal Summary',
      content: [
        `- Buy signals: ${data.signals.buy}`,
        `- Sell signals: ${data.signals.sell}`,
        `- Hold signals: ${data.signals.hold}`,
      ].join('\n'),
    },
    {
      heading: '⚠️ Risk Status',
      content: [
        `**Risk Level:** ${data.riskLevel}`,
        `**Alerts Triggered:** ${data.alertsTriggered}`,
        data.riskLevel === 'high'
          ? '- 🔴 High risk — consider reducing exposure'
          : data.riskLevel === 'medium'
          ? '- 🟡 Medium risk — monitor closely'
          : '- 🟢 Low risk — portfolio stable',
      ].join('\n'),
    },
  ];

  return {
    title: `Daily Report — ${data.date}`,
    sections,
    raw: '',
    fallback: true,
    generatedAt: Date.now(),
  };
}

// ── Weekly Report Generation ─────────────────────────────────────────────────

export interface WeeklyReportData {
  weekStart: string;
  weekEnd: string;
  weeklyPnl: number;
  weeklyPnlPct: number;
  weeklyWinRate: number;
  bestStrategies: Array<{ name: string; pnl: number; pnlPct: number }>;
  worstStrategies: Array<{ name: string; pnl: number; pnlPct: number }>;
  weekOverWeekChange: number;
}

export async function generateWeeklyReport(
  data: WeeklyReportData,
  timeoutMs = 15000
): Promise<BacktestReport> {
  log.info('[AIReportGenerator] Generating weekly report for', data.weekStart, 'to', data.weekEnd);

  const prompt = `${i18n.t('AiReportGenerator.k46')}

${i18n.t('AiReportGenerator.k47')}
${i18n.t('AiReportGenerator.k48')}
${i18n.t('AiReportGenerator.k49')}
${i18n.t('AiReportGenerator.k50')}
${i18n.t('AiReportGenerator.k51')}

${i18n.t('AiReportGenerator.k52')}
${i18n.t('AiReportGenerator.k53')}${data.weekStart} ${i18n.t('AiReportGenerator.k54')} ${data.weekEnd}
${i18n.t('AiReportGenerator.k55')}${data.weeklyPnl.toFixed(2)} (${data.weeklyPnlPct.toFixed(2)}%)
${i18n.t('AiReportGenerator.k56')}${data.weeklyWinRate.toFixed(1)}%

${i18n.t('AiReportGenerator.k57')}
${data.bestStrategies.slice(0, 3).map(s => `- ${s.name}: $${s.pnl.toFixed(2)} (${s.pnlPct.toFixed(2)}%)`).join('\n')}

${i18n.t('AiReportGenerator.k58')}
${data.worstStrategies.slice(0, 3).map(s => `- ${s.name}: $${s.pnl.toFixed(2)} (${s.pnlPct.toFixed(2)}%)`).join('\n')}

${i18n.t('AiReportGenerator.k59')}${data.weekOverWeekChange > 0 ? '+' : ''}${data.weekOverWeekChange.toFixed(2)}%

${i18n.t('AiReportGenerator.k60')}`;

  try {
    let raw = '';
    try {
      const { callChatCompletions } = await import('./utils/ai-gateway-client');
      const result = await callChatCompletions({
        messages: [{ role: 'user', content: prompt }],
        model: 'deepseek-chat',
        temperature: 0.25,
        max_tokens: 600,
      }, timeoutMs);
      if (!result.success) throw new EngineError("result.error", { code: ErrorCode.ENGINE_INTERNAL_ERROR });
      raw = result.content;
    } catch (e) {
      throw new EngineError("AI Gateway error: ' + e.message", { code: ErrorCode.ENGINE_AI_ERROR });
    }

    if (!raw?.trim()) throw new EngineError("Empty LLM response", { code: ErrorCode.ENGINE_AI_ERROR });

    const sectionBlocks = raw.split(/(?=^#{1,3}\s)/m);
    const sections: ReportSection[] = sectionBlocks
      .map(block => {
        const lines = block.trim().split('\n');
        const heading = lines[0]?.replace(/^#+\s*/, '').trim() || 'Weekly Summary';
        return { heading, content: lines.slice(1).join('\n').trim() };
      })
      .filter(s => s.content.length > 0);

    return {
      title: `Weekly Report — ${data.weekStart} to ${data.weekEnd}`,
      sections: sections.length > 0 ? sections : [{ heading: 'Weekly Summary', content: raw }],
      raw,
      fallback: false,
      generatedAt: Date.now(),
    };
  } catch (err: unknown) {
    const aborted = err.name === 'AbortError' || err.message?.includes('timeout');
    log.warn(`[AIReportGenerator] Weekly report ${aborted ? 'timeout' : 'error'}: ${err.message}`);
    return fallbackWeeklyReport(data);
  }
}

function fallbackWeeklyReport(data: WeeklyReportData): BacktestReport {
  const sections: ReportSection[] = [
    {
      heading: '📊 Weekly Summary',
      content: [
        `**Period:** ${data.weekStart} to ${data.weekEnd}`,
        `**Weekly P&L:** $${data.weeklyPnl.toFixed(2)} (${data.weeklyPnlPct.toFixed(2)}%)`,
        `**Win Rate:** ${data.weeklyWinRate.toFixed(1)}%`,
        `**Week-over-Week:** ${data.weekOverWeekChange > 0 ? '+' : ''}${data.weekOverWeekChange.toFixed(2)}%`,
      ].join('\n'),
    },
    {
      heading: '🏆 Best Strategies',
      content: data.bestStrategies
        .slice(0, 3)
        .map(s => `- **${s.name}:** $${s.pnl.toFixed(2)} (${s.pnlPct.toFixed(2)}%)`)
        .join('\n'),
    },
    {
      heading: '📉 Worst Strategies',
      content: data.worstStrategies
        .slice(0, 3)
        .map(s => `- **${s.name}:** $${s.pnl.toFixed(2)} (${s.pnlPct.toFixed(2)}%)`)
        .join('\n'),
    },
    {
      heading: '💡 Weekly Insights',
      content: [
        data.weeklyPnlPct > 5
          ? '- ✅ Strong weekly performance — continue current strategy'
          : data.weeklyPnlPct > 0
          ? '- 🟡 Moderate performance — review underperforming strategies'
          : '- 🔴 Negative week — consider strategy adjustments',
        data.weekOverWeekChange > 0
          ? '- 📈 Positive week-over-week trend'
          : '- 📉 Negative week-over-week trend — investigate causes',
      ].join('\n'),
    },
  ];

  return {
    title: `Weekly Report — ${data.weekStart} to ${data.weekEnd}`,
    sections,
    raw: '',
    fallback: true,
    generatedAt: Date.now(),
  };
}

// ── Monthly Report Generation ────────────────────────────────────────────────

export interface MonthlyReportData {
  month: string;
  monthlyPnl: number;
  monthlyPnlPct: number;
  monthlySharpe: number;
  monthlySortino: number;
  maxDrawdown: number;
  strategyRanking: Array<{ name: string; pnl: number; pnlPct: number; sharpe: number }>;
  monthOverMonthChange: number;
}

export async function generateMonthlyReport(
  data: MonthlyReportData,
  timeoutMs = 20000
): Promise<BacktestReport> {
  log.info('[AIReportGenerator] Generating monthly report for', data.month);

  const prompt = `${i18n.t('AiReportGenerator.k61')}

${i18n.t('AiReportGenerator.k62')}
${i18n.t('AiReportGenerator.k63')}
${i18n.t('AiReportGenerator.k64')}
${i18n.t('AiReportGenerator.k65')}
${i18n.t('AiReportGenerator.k66')}

${i18n.t('AiReportGenerator.k67')}
${i18n.t('AiReportGenerator.k68')}${data.month}
${i18n.t('AiReportGenerator.k69')}${data.monthlyPnl.toFixed(2)} (${data.monthlyPnlPct.toFixed(2)}%)
${i18n.t('AiReportGenerator.k70')}${data.monthlySharpe.toFixed(2)}
${i18n.t('AiReportGenerator.k71')}${data.monthlySortino.toFixed(2)}
${i18n.t('AiReportGenerator.k72')}${data.maxDrawdown.toFixed(2)}%

${i18n.t('AiReportGenerator.k73')}
${data.strategyRanking.slice(0, 5).map(s => `- ${s.name}: $${s.pnl.toFixed(2)} (${s.pnlPct.toFixed(2)}%, Sharpe: ${s.sharpe.toFixed(2)})`).join('\n')}

${i18n.t('AiReportGenerator.k74')}${data.monthOverMonthChange > 0 ? '+' : ''}${data.monthOverMonthChange.toFixed(2)}%

${i18n.t('AiReportGenerator.k75')}`;

  try {
    let raw = '';
    try {
      const { callChatCompletions } = await import('./utils/ai-gateway-client');
      const result = await callChatCompletions({
        messages: [{ role: 'user', content: prompt }],
        model: 'deepseek-chat',
        temperature: 0.25,
        max_tokens: 600,
      }, timeoutMs);
      if (!result.success) throw new EngineError("result.error", { code: ErrorCode.ENGINE_INTERNAL_ERROR });
      raw = result.content;
    } catch (e) {
      throw new EngineError("AI Gateway error: ' + e.message", { code: ErrorCode.ENGINE_AI_ERROR });
    }

    if (!raw?.trim()) throw new EngineError("Empty LLM response", { code: ErrorCode.ENGINE_AI_ERROR });

    const sectionBlocks = raw.split(/(?=^#{1,3}\s)/m);
    const sections: ReportSection[] = sectionBlocks
      .map(block => {
        const lines = block.trim().split('\n');
        const heading = lines[0]?.replace(/^#+\s*/, '').trim() || 'Monthly Summary';
        return { heading, content: lines.slice(1).join('\n').trim() };
      })
      .filter(s => s.content.length > 0);

    return {
      title: `Monthly Report — ${data.month}`,
      sections: sections.length > 0 ? sections : [{ heading: 'Monthly Summary', content: raw }],
      raw,
      fallback: false,
      generatedAt: Date.now(),
    };
  } catch (err: unknown) {
    const aborted = err.name === 'AbortError' || err.message?.includes('timeout');
    log.warn(`[AIReportGenerator] Monthly report ${aborted ? 'timeout' : 'error'}: ${err.message}`);
    return fallbackMonthlyReport(data);
  }
}

function fallbackMonthlyReport(data: MonthlyReportData): BacktestReport {
  const sections: ReportSection[] = [
    {
      heading: '📊 Monthly Performance',
      content: [
        `**Month:** ${data.month}`,
        `**Monthly P&L:** $${data.monthlyPnl.toFixed(2)} (${data.monthlyPnlPct.toFixed(2)}%)`,
        `**Sharpe Ratio:** ${data.monthlySharpe.toFixed(2)}`,
        `**Sortino Ratio:** ${data.monthlySortino.toFixed(2)}`,
        `**Max Drawdown:** ${data.maxDrawdown.toFixed(2)}%`,
        `**Month-over-Month:** ${data.monthOverMonthChange > 0 ? '+' : ''}${data.monthOverMonthChange.toFixed(2)}%`,
      ].join('\n'),
    },
    {
      heading: '🏆 Strategy Ranking',
      content: data.strategyRanking
        .slice(0, 5)
        .map(s => `- **${s.name}:** $${s.pnl.toFixed(2)} (${s.pnlPct.toFixed(2)}%, Sharpe: ${s.sharpe.toFixed(2)})`)
        .join('\n'),
    },
    {
      heading: '⚠️ Risk Assessment',
      content: [
        `**Risk Level:** ${data.maxDrawdown > 20 ? '🔴 HIGH' : data.maxDrawdown > 10 ? '🟡 MEDIUM' : '🟢 LOW'}`,
        `**Sharpe Quality:** ${data.monthlySharpe > 1 ? '🟢 Strong' : data.monthlySharpe > 0.5 ? '🟡 Moderate' : '🔴 Weak'}`,
        data.maxDrawdown > 15
          ? '- ⚠️ Drawdown exceeds 15% — review risk management'
          : '- ✅ Drawdown within acceptable range',
      ].join('\n'),
    },
    {
      heading: '💡 Monthly Insights',
      content: [
        data.monthlySharpe > 1
          ? '- ✅ Excellent risk-adjusted returns this month'
          : data.monthlySharpe > 0.5
          ? '- 🟡 Good performance — consider position optimization'
          : '- 🔴 Weak risk-adjusted returns — review strategy selection',
        data.monthOverMonthChange > 5
          ? '- 📈 Strong month-over-month growth'
          : data.monthOverMonthChange > 0
          ? '- 📈 Positive monthly trend'
          : '- 📉 Negative month-over-month — investigate underperformers',
        data.maxDrawdown > 20
          ? '- 🔴 High drawdown — implement tighter stop-losses'
          : '- ✅ Drawdown well controlled',
      ].join('\n'),
    },
  ];

  return {
    title: `Monthly Report — ${data.month}`,
    sections,
    raw: '',
    fallback: true,
    generatedAt: Date.now(),
  };
}