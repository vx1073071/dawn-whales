// ── AI Report Generator ─────────────────────────────────────────────────────
// Q4: Backtest Result AI Interpretation
// Input: backtest results array → DeepSeek LLM → Markdown report
// Timeout fallback: 20s → English template, Markdown includes key metrics + risk + recommendations

import log from 'electron-log';
import type { BacktestResult } from './backtest-engine';

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
    ma_cross: '均线交叉 (MA Cross)',
    rsi: 'RSI 超买超卖',
    macd: 'MACD 金叉死叉',
    momentum: '动量突破',
    bollinger: '布林带突破',
    custom: '自定义策略',
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

// ── LLM Report Generator ─────────────────────────────────────────────────────

async function callDeepSeek(prompt: string, apiKey: string, signal?: AbortSignal): Promise<string> {
  const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 600,
      temperature: 0.25,
    }),
  });
  if (!resp.ok) throw new Error(`DeepSeek API error: ${resp.status}`);
  const json = await resp.json() as any;
  return (json?.choices?.[0]?.message?.content ?? '') as string;
}

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
  apiKey?: string,
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
  const prompt = `你是一个量化策略分析师。请为以下回测结果生成一份专业的 Markdown 格式分析报告。

**要求：**
- 语言：中文（简单易懂，避免过多术语）
- 格式：Markdown，含标题和 bullet points
- 包含：收益摘要、风险评估、策略评级、优化建议（3-5条具体可行的建议）
- 每个建议要具体、可操作
- 总体评价一段话（50字以内）

**回测数据：**
策略类型：${typeStr}
标的：${symbol ?? primary.result.config?.symbol ?? 'N/A'}

=== 单策略详情 ===
总收益率：${m.totalReturn}%
年化收益率：${m.annualReturn}%
夏普比率：${m.sharpeRatio}
最大回撤：${m.maxDrawdown}%
胜率：${m.winRate}%
盈亏比：${m.profitFactor}
总交易次数：${m.totalTrades}
平均每笔收益：${m.avgTradePnl}%
平均持仓周期：${m.avgHoldingBars} 根K线

=== 多策略对比（如适用）===
${compTable}

请直接输出 Markdown 报告内容，不需要解释。`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let raw = '';
    try {
      const { getDeepSeekKey } = await import('./utils/secure-key');
      const key = apiKey || getDeepSeekKey();
      if (!key) throw new Error('No DeepSeek API key');
      raw = await callDeepSeek(prompt, key, controller.signal);
    } finally {
      clearTimeout(timer);
    }

    if (!raw?.trim()) throw new Error('Empty LLM response');

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
  } catch (err: any) {
    const aborted = err.name === 'AbortError' || err.message?.includes('timeout');
    log.warn(`[AIReportGenerator] ${aborted ? 'Timeout' : 'LLM error'}: ${err.message}`);
    // Fallback to English template
    return fallbackReport(results, symbol);
  }
}

// ── Quick single-result report ───────────────────────────────────────────────

export async function generateQuickReport(result: BacktestResult, apiKey?: string): Promise<BacktestReport> {
  return generateBacktestReport([result], result.result.config?.symbol, apiKey);
}