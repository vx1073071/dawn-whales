// ── Smart Notification Engine ────────────────────────────────────────────────
// Q3: AI-driven anomaly alerts + natural language notification generation
// Inputs: anomaly signals, risk alerts, market regime, portfolio state
// Output: prioritized smart notifications with LLM-generated natural language

import log from 'electron-log';

// ── Types ───────────────────────────────────────────────────────────────────

export type AlertLevel = 'info' | 'warning' | 'critical';

export interface SmartAlert {
  id: string;
  level: AlertLevel;
  category: 'technical' | 'capital' | 'derivatives' | 'sentiment' | 'risk' | 'market';
  title: string;          // short summary
  message: string;       // LLM-generated natural language
  symbol?: string;
  metrics?: Record<string, number>;
  timestamp: number;
  priority: number;       // 0=highest, 100=lowest
  actions?: string[];    // e.g. ["view chart", "dismiss", "snooze 1h"]
}

// ── Priority Templates ───────────────────────────────────────────────────────

const LEVEL_SCORE = { critical: 0, warning: 33, info: 66 };
const CATEGORY_SCORE = { risk: 0, derivatives: 15, technical: 30, capital: 45, sentiment: 60, market: 75 };

function computePriority(level: AlertLevel, category: string, hasMetrics: boolean): number {
  const base = (LEVEL_SCORE[level] ?? 33) + (CATEGORY_SCORE[category as keyof typeof CATEGORY_SCORE] ?? 33);
  return Math.min(99, base + (hasMetrics ? 5 : 0));
}

// ── Template-Based Message Generator ────────────────────────────────────────

function templateMessage(alert: Partial<SmartAlert>): string {
  const { level, category, symbol, metrics } = alert;
  const sym = symbol ? `[${symbol}] ` : '';
  const m = metrics ?? {};

  if (category === 'technical') {
    if (level === 'critical') return `${sym}技术异动警告：价格异动幅度 ${m.changePct ?? '?'}%，RSI ${m.rsi ?? '?'} 进入超买/超卖区间，建议关注持仓风险。`;
    if (level === 'warning') return `${sym}技术指标异常：MACD 背离，RSI ${m.rsi ?? '?'}，20日波动率 ${m.volatility ?? '?'}%。`;
    return `${sym}技术信号：成交量放大 ${m.volumeRatio ?? '?'}x，价格 ${m.trend ?? '平稳'}。`;
  }
  if (category === 'capital') {
    if (level === 'critical') return `${sym}资金异动警告：主力净流入 ${m.netFlow ?? '?'}万元，大单成交占比 ${m.blockTradePct ?? '?'}%，注意跟风风险。`;
    if (level === 'warning') return `${sym}资金流向：净流入 ${m.netFlow ?? '?'}万，换手率 ${m.turnover ?? '?'}%。`;
    return `${sym}资金面：成交量加权平均价 ${m.vwap ?? '?'}，带量上涨。`;
  }
  if (category === 'derivatives') {
    if (level === 'critical') return `${sym}衍生品信号：期权隐含波动率 IV ${m.iv ?? '?'}% 创 ${m.ivPercentile ?? '?'} 百分位，Put/Call 比 ${m.putCallRatio ?? '?'}，预警对冲需求。`;
    if (level === 'warning') return `${sym}期权异动：OI ${m.oiChange ?? '?'}% 变化，IV ${m.iv ?? '?'}%。`;
    return `${sym}期货升贴水：基差 ${m.basis ?? '?'}，未平仓合约 ${m.openInterest ?? '?'}。`;
  }
  if (category === 'sentiment') {
    if (level === 'critical') return `${sym}情绪极端预警：恐慌/贪婪指数 ${m.fearGreed ?? '?'}，新闻情绪 ${m.newsSentiment ?? '?'}，社交媒体 ${m.socialSentiment ?? '?'}。建议减仓。`;
    if (level === 'warning') return `${sym}市场情绪：偏向${m.fearGreed ?? '中性'}，分析师评级 ${m.analystRating ?? '?'}。`;
    return `${sym}情绪指标：搜索热度 ${m.searchInterest ?? '?'}，关注度上升。`;
  }
  if (category === 'risk') {
    if (level === 'critical') return `${sym}风险预警：最大回撤 ${m.maxDrawdown ?? '?'}% 超过阈值 ${m.drawdownLimit ?? '?'}%，Kelly 仓位 ${m.kellyExposure ?? '?'}%。建议降杠杆。`;
    if (level === 'warning') return `${sym}风险提醒：组合波动率 ${m.portfolioVol ?? '?'}%，VIX ${m.vix ?? '?'}。`;
    return `${sym}风险状态：VAR ${m.varPct ?? '?'}%，日盈亏 ${m.dailyPnl ?? '?'}%。`;
  }
  return `${sym}通知：${level} · ${category}`;
}

// ── LLM-Enhanced Message (DeepSeek) ─────────────────────────────────────────

export async function enhanceWithLLM(alert: SmartAlert, apiKey: string): Promise<string> {
  const prompt = `你是一个专业的量化交易警报助手。为以下警报生成一条简洁、专业的中文通知消息（50字以内）：
- 标的: ${alert.symbol ?? '组合'}
- 类别: ${alert.category}
- 级别: ${alert.level}
- 指标: ${JSON.stringify(alert.metrics ?? {})}
- 标题: ${alert.title}

要求：专业、简洁、 actionable。`;
  try {
    const { getDeepSeekKey } = await import('../utils/secure-key');
    const key = apiKey || getDeepSeekKey();
    if (!key) return alert.message;

    const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 80,
        temperature: 0.3,
      }),
    });
    const json = await resp.json() as any;
    const content = json?.choices?.[0]?.message?.content;
    if (content?.trim()) return content.trim();
  } catch (err) {
    log.warn('[NotificationEngine] LLM enhance failed:', err);
  }
  return alert.message;
}

// ── Core: Generate Smart Alerts ─────────────────────────────────────────────

export interface NotificationContext {
  anomalies?: { symbol: string; type: string; level: string; message: string; details?: Record<string, any>; timestamp: number }[];
  riskAlerts?: { type: string; level: string; message: string; metrics?: Record<string, number> }[];
  marketRegime?: { state: string; confidence: number; recommendation: string };
  positions?: { symbol: string; pnlPct: number; size: number }[];
  vix?: number;
}

export function generateSmartAlerts(ctx: NotificationContext): SmartAlert[] {
  const alerts: SmartAlert[] = [];
  const now = Date.now();

  // 1. Anomaly signals
  for (const a of (ctx.anomalies ?? [])) {
    const level = (a.level ?? 'info') as AlertLevel;
    const category = (a.type ?? 'technical') as SmartAlert['category'];
    const id = `anomaly-${a.symbol}-${a.timestamp}`;
    const alert: SmartAlert = {
      id,
      level,
      category,
      title: `[${a.type?.toUpperCase()}] ${a.symbol} 异动`,
      message: a.message ?? templateMessage({ level, category, symbol: a.symbol, metrics: a.details }),
      symbol: a.symbol,
      metrics: a.details,
      timestamp: a.timestamp,
      priority: computePriority(level, category, !!a.details),
      actions: ['查看图表', '标记已读', level === 'critical' ? '触发止损' : '忽略'],
    };
    alerts.push(alert);
  }

  // 2. Risk alerts
  for (const r of (ctx.riskAlerts ?? [])) {
    const level = (r.level ?? 'info') as AlertLevel;
    const id = `risk-${r.type}-${now}`;
    const alert: SmartAlert = {
      id,
      level,
      category: 'risk',
      title: `[风险] ${r.type}`,
      message: r.message ?? templateMessage({ level, category: 'risk', metrics: r.metrics }),
      metrics: r.metrics,
      timestamp: now,
      priority: computePriority(level, 'risk', !!r.metrics),
      actions: r.type.includes('drawdown') || r.type.includes('kelly')
        ? ['查看风险面板', '降低仓位', '忽略']
        : ['查看详情', '忽略'],
    };
    alerts.push(alert);
  }

  // 3. VIX regime
  if (ctx.vix !== undefined) {
    let level: AlertLevel = 'info';
    if (ctx.vix > 30) level = 'critical';
    else if (ctx.vix > 20) level = 'warning';
    if (level !== 'info') {
      alerts.push({
        id: `risk-vix-${now}`,
        level,
        category: 'market',
        title: `[VIX ${ctx.vix.toFixed(1)}] 市场波动率预警`,
        message: `VIX 达到 ${ctx.vix.toFixed(1)}，市场恐慌情绪${ctx.vix > 30 ? '极度' : '明显'}上升。建议${ctx.vix > 30 ? '大幅降低仓位，启用对冲' : '适当减仓'}。`,
        metrics: { vix: ctx.vix },
        timestamp: now,
        priority: computePriority(level, 'market', true),
        actions: ['查看 VIX 面板', '调整仓位', '忽略'],
      });
    }
  }

  // 4. Position-level P&L alerts
  for (const p of (ctx.positions ?? [])) {
    if (p.pnlPct < -5 || p.pnlPct > 8) {
      const level: AlertLevel = p.pnlPct < -10 ? 'critical' : p.pnlPct < -5 ? 'warning' : 'info';
      alerts.push({
        id: `position-${p.symbol}-${now}`,
        level,
        category: 'risk',
        title: `[${p.symbol}] ${p.pnlPct > 0 ? '盈利' : '亏损'} ${p.pnlPct.toFixed(1)}%`,
        message: `${p.symbol} 当前${p.pnlPct > 0 ? '盈利' : '亏损'} ${p.pnlPct.toFixed(1)}%，持仓 ${p.size} 股。${p.pnlPct < -5 ? '触发止损审核' : '注意仓位管理'}。`,
        symbol: p.symbol,
        metrics: { pnlPct: p.pnlPct, size: p.size },
        timestamp: now,
        priority: computePriority(level, 'risk', true),
        actions: ['查看持仓', '止损', '忽略'],
      });
    }
  }

  // Sort by priority (lower = more urgent)
  return alerts.sort((a, b) => a.priority - b.priority);
}

// ── LLM Summary Generator ─────────────────────────────────────────────────────

export async function generateAlertSummary(alerts: SmartAlert[], apiKey: string): Promise<string> {
  if (alerts.length === 0) return '暂无活跃警报。';
  const critical = alerts.filter(a => a.level === 'critical');
  const warning = alerts.filter(a => a.level === 'warning');
  const prompt = `你是一个量化交易助手。为以下警报生成一段简洁的市场警报总结（80字以内，中文）：
- 严重警报: ${critical.length}条 ${critical.map(a => `${a.symbol ?? '组合'}: ${a.title}`).join('; ')}
- 警告警报: ${warning.length}条 ${warning.map(a => `${a.symbol ?? '组合'}: ${a.title}`).join('; ')}
- 一般信息: ${alerts.length - critical.length - warning.length}条

要求：专业简洁，突出最紧迫风险。`;
  try {
    const key = apiKey || (await import('../utils/secure-key')).getDeepSeekKey();
    if (!key) return `${critical.length}条严重警报，${warning.length}条警告警报。`;
    const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 120,
        temperature: 0.2,
      }),
    });
    const json = await resp.json() as any;
    return json?.choices?.[0]?.message?.content?.trim() || `${critical.length}条严重警报，${warning.length}条警告警报。`;
  } catch {
    return `${critical.length}条严重警报，${warning.length}条警告警报。`;
  }
}