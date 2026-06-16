import { describe, it, expect, beforeEach } from 'vitest';
import { AIWhalePersonaEngine } from '../electron/engine/news/AIWhalePersonaEngine';
import { AINotificationEngine } from '../electron/engine/news/AINotificationEngine';
import { BacktestAIInterpretationEngine } from '../electron/engine/news/BacktestAIInterpretationEngine';

// ═══════════════════════════════════════════════════════════════
// P1-04 AIWhalePersonaEngine Tests
// ═══════════════════════════════════════════════════════════════

describe('AIWhalePersonaEngine', () => {
  let engine: AIWhalePersonaEngine;
  beforeEach(() => { engine = AIWhalePersonaEngine.getInstance(); engine.reset(); });

  it('singleton', () => { expect(AIWhalePersonaEngine.getInstance()).toBe(engine); });

  it('get built-in personas', () => {
    const personas = engine.getPersonas();
    expect(personas.length).toBeGreaterThanOrEqual(4);
    expect(personas.find(p => p.id === 'default')).toBeTruthy();
    expect(personas.find(p => p.id === 'aggressive')).toBeTruthy();
    expect(personas.find(p => p.id === 'conservative')).toBeTruthy();
    expect(personas.find(p => p.id === 'mentor')).toBeTruthy();
  });

  it('get specific persona', () => {
    const p = engine.getPersona('aggressive')!;
    expect(p.name).toContain('激进');
    expect(p.tone).toBe('trader');
  });

  it('register custom persona', () => {
    const p = engine.registerPersona({
      id: 'custom-bot', name: 'Custom Bot',
      systemPrompt: 'You are custom', tone: 'casual',
      maxTurns: 10, noSmallTalk: true,
      allowedTopics: ['crypto'], bannedTopics: [],
    });
    expect(engine.getPersona('custom-bot')).toBeTruthy();
    expect(p.tone).toBe('casual');
  });

  it('update persona', () => {
    engine.registerPersona({ id: 'test-update', name: 'Old', systemPrompt: '...', tone: 'casual', maxTurns: 10, noSmallTalk: false, allowedTopics: [], bannedTopics: [] });
    const updated = engine.updatePersona('test-update', { name: 'New Name', tone: 'mentor' });
    expect(updated!.name).toBe('New Name');
    expect(updated!.tone).toBe('mentor');
  });

  it('delete custom persona', () => {
    engine.registerPersona({ id: 'to-delete', name: 'Delete Me', systemPrompt: '...', tone: 'casual', maxTurns: 5, noSmallTalk: false, allowedTopics: [], bannedTopics: [] });
    expect(engine.deletePersona('to-delete')).toBe(true);
    expect(engine.getPersona('to-delete')).toBeUndefined();
  });

  it('cannot delete built-in persona', () => {
    expect(engine.deletePersona('default')).toBe(false);
    expect(engine.getPersona('default')).toBeTruthy();
  });

  it('get default persona', () => {
    const d = engine.getDefaultPersona();
    expect(d.id).toBe('default');
    expect(d.tone).toBe('professional');
  });

  it('start session', () => {
    const session = engine.startSession({ userId: 'u1' });
    expect(session.id).toMatch(/conv-/);
    expect(session.personaId).toBe('default');
    expect(session.messages.length).toBe(1); // system message
    expect(session.messages[0].role).toBe('system');
    expect(session.active).toBe(true);
  });

  it('start session with specific persona', () => {
    const session = engine.startSession({ userId: 'u2', personaId: 'aggressive' });
    expect(session.personaId).toBe('aggressive');
    expect(session.messages[0].content).toContain('aggressive');
  });

  it('start session with language and tags', () => {
    const session = engine.startSession({ userId: 'u3', language: 'zh', tags: ['tutorial'] });
    expect(session.language).toBe('zh');
    expect(session.tags).toContain('tutorial');
  });

  it('get session', () => {
    const s = engine.startSession({ userId: 'u4' });
    expect(engine.getSession(s.id)).toBe(s);
  });

  it('get user sessions', () => {
    engine.startSession({ userId: 'u5' });
    engine.startSession({ userId: 'u5' });
    engine.startSession({ userId: 'u6' });
    expect(engine.getUserSessions('u5').length).toBe(2);
    expect(engine.getUserSessions('u6').length).toBe(1);
  });

  it('end session', () => {
    const s = engine.startSession({ userId: 'u7' });
    expect(engine.endSession(s.id)).toBe(true);
    expect(engine.getSession(s.id)!.active).toBe(false);
  });

  it('route intent: market_query', () => {
    const result = engine.routeIntent('what is the price of AAPL?');
    expect(result.intent).toBe('market_query');
    expect(result.targetHandler).toBe('quote-router');
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('route intent: trade_execution', () => {
    const result = engine.routeIntent('I want to buy 100 shares of TSLA');
    expect(result.intent).toBe('trade_execution');
    expect(result.requiresConfirmation).toBe(true);
    expect(result.suggestedActions).toContain('preview_order');
  });

  it('route intent: strategy_advice', () => {
    const result = engine.routeIntent('help me create a strategy for momentum trading');
    expect(result.intent).toBe('strategy_advice');
    expect(result.targetHandler).toBe('strategy-engine');
  });

  it('route intent: complaint', () => {
    const result = engine.routeIntent('this app is garbage I want a refund');
    expect(result.intent).toBe('complaint');
    expect(result.requiresConfirmation).toBe(true);
  });

  it('route intent: fallback to general_chat', () => {
    const result = engine.routeIntent('hello how are you today?');
    expect(result.intent).toBe('general_chat');
    expect(result.confidence).toBe(0.3);
  });

  it('check harassment: clean message', () => {
    const result = engine.checkHarassment('u-clean', 'What is the market outlook for today?');
    expect(result.isAbusive).toBe(false);
    expect(result.isSpam).toBe(false);
    expect(result.action).toBe('allow');
  });

  it('check harassment: abusive message', () => {
    const result = engine.checkHarassment('u-abusive', 'this is f***ing stupid!');
    expect(result.isAbusive).toBe(true);
    expect(result.flags).toContain('abusive_language');
    expect(result.action).toBe('warn');
  });

  it('check harassment: spam message', () => {
    const result = engine.checkHarassment('u-spam', 'CLICK HERE to earn MONEY http://scam.com');
    expect(result.isSpam).toBe(true);
    expect(result.flags).toContain('spam_pattern');
  });

  it('check harassment: excessive frequency', () => {
    for (let i = 0; i < 12; i++) {
      engine.checkHarassment('u-flood', `message ${i}`);
    }
    const result = engine.checkHarassment('u-flood', 'one more');
    expect(result.isRepetitive).toBe(true);
    expect(result.flags).toContain('excessive_frequency');
  });

  it('check harassment: blocked user', () => {
    for (let i = 0; i < 12; i++) {
      engine.checkHarassment('u-blocked', `f***k this hate you stupid bot ${i}`);
    }
    const result = engine.checkHarassment('u-blocked', 'one more');
    expect(['block', 'cooldown']).toContain(result.action);
    expect(result.cooldownMs).toBeGreaterThan(0);
  });

  it('cooldown check', () => {
    for (let i = 0; i < 12; i++) {
      engine.checkHarassment('u-cooldown', `f***k this hate you stupid bot ${i}`);
    }
    const remaining = engine.getCooldownRemaining('u-cooldown');
    expect(remaining).toBeGreaterThan(0);
  });

  it('lift cooldown', () => {
    for (let i = 0; i < 12; i++) {
      engine.checkHarassment('u-lift', `f***k this hate you stupid bot ${i}`);
    }
    expect(engine.liftCooldown('u-lift')).toBe(true);
    expect(engine.getCooldownRemaining('u-lift')).toBe(0);
  });

  it('assemble prompt', () => {
    const session = engine.startSession({ userId: 'u-prompt' });
    const prompt = engine.assemblePrompt({
      sessionId: session.id,
      userMessage: 'What stocks are moving today?',
      context: { current_time: '2026-06-17', portfolio_summary: 'AAPL, MSFT', market_status: 'open' },
    });
    expect(prompt).toBeTruthy();
    expect(prompt!.systemPrompt).toContain('2026-06-17');
    expect(prompt!.systemPrompt).toContain('AAPL, MSFT');
    expect(prompt!.userMessage).toBe('What stocks are moving today?');
    expect(prompt!.temperature).toBe(0.7);
    expect(prompt!.model).toBe('default');
  });

  it('process message: full flow', () => {
    const session = engine.startSession({ userId: 'u-process' });
    const result = engine.processMessage({
      sessionId: session.id, userId: 'u-process',
      message: 'show me TSLA quote please',
    });
    expect(result).toBeTruthy();
    expect(result!.harassment.action).toBe('allow');
    expect(result!.intent.intent).toBe('market_query');
    expect(result!.prompt).toBeTruthy();
    expect(session.messages.length).toBe(2); // system + user
    expect(session.turnCount).toBe(1);
  });

  it('process message: blocked user gets no prompt', () => {
    const session = engine.startSession({ userId: 'u-process-block' });
    // Trigger block first with high-score messages
    for (let i = 0; i < 12; i++) {
      engine.checkHarassment('u-process-block', `f***k you hate this stupid bot ${i}`);
    }
    const result = engine.processMessage({
      sessionId: session.id, userId: 'u-process-block',
      message: 'hello',
    });
    expect(result!.harassment.action).toBe('cooldown');
    expect(result!.prompt).toBeNull();
  });

  it('record response', () => {
    const session = engine.startSession({ userId: 'u-resp' });
    engine.processMessage({ sessionId: session.id, userId: 'u-resp', message: 'hi' });
    expect(engine.recordResponse(session.id, 'Hello! How can I help?')).toBe(true);
    const msgs = session.messages;
    expect(msgs[msgs.length - 1].role).toBe('assistant');
    expect(msgs[msgs.length - 1].content).toBe('Hello! How can I help?');
  });

  it('switch persona', () => {
    const session = engine.startSession({ userId: 'u-switch', personaId: 'default' });
    expect(engine.switchPersona(session.id, 'aggressive', 'User prefers aggressive')).toBe(true);
    expect(engine.getSession(session.id)!.personaId).toBe('aggressive');
    expect(engine.getSwitchHistory('u-switch').length).toBe(1);
    expect(engine.getSwitchHistory('u-switch')[0].from).toBe('default');
    expect(engine.getSwitchHistory('u-switch')[0].to).toBe('aggressive');
  });

  it('max turns auto re-prompt', () => {
    // Register a persona with very low max turns
    engine.registerPersona({
      id: 'short-turns', name: 'Short', systemPrompt: 'You are short-lived', tone: 'casual',
      maxTurns: 3, noSmallTalk: true, allowedTopics: [], bannedTopics: [],
    });
    const session = engine.startSession({ userId: 'u-turns', personaId: 'short-turns' });

    // Send 4 messages — should trigger re-prompt on the 4th
    for (let i = 0; i < 4; i++) {
      engine.processMessage({ sessionId: session.id, userId: 'u-turns', message: `msg ${i}` });
    }

    // After 4 messages, turnCount should be reset to 1 (re-prompt resets)
    expect(session.turnCount).toBe(1);
  });

  it('get stats', () => {
    engine.startSession({ userId: 'u-stats1' });
    engine.startSession({ userId: 'u-stats2' });
    const stats = engine.getStats();
    expect(stats.totalPersonas).toBeGreaterThanOrEqual(4);
    expect(stats.totalSessions).toBe(2);
    expect(stats.activeSessions).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════
// P1-05 AINotificationEngine Tests
// ═══════════════════════════════════════════════════════════════

describe('AINotificationEngine', () => {
  let engine: AINotificationEngine;
  beforeEach(() => { engine = AINotificationEngine.getInstance(); engine.reset(); });

  it('singleton', () => { expect(AINotificationEngine.getInstance()).toBe(engine); });

  it('get templates', () => {
    const tpls = engine.getTemplates();
    expect(tpls.length).toBe(5);
    expect(tpls.find(t => t.trigger === 'position_analysis')).toBeTruthy();
    expect(tpls.find(t => t.trigger === 'strategy_suggestion')).toBeTruthy();
  });

  it('register custom template', () => {
    const tpl = engine.registerTemplate({
      id: 'custom', trigger: 'position_analysis',
      title: 'Custom', body: 'Test',
      priority: 'low', channels: ['in_app'],
      dismissible: true, ttlMs: 1000, cooldownMs: 0,
    });
    expect(engine.getTemplate('custom')).toBe(tpl);
  });

  it('notify position analysis', () => {
    const notif = engine.notifyPositionAnalysis({
      userId: 'u1', symbols: ['AAPL', 'MSFT'],
      summary: 'Both stocks show bullish momentum',
    });
    expect(notif).toBeTruthy();
    expect(notif!.trigger).toBe('position_analysis');
    expect(notif!.title).toContain('AAPL');
    expect(notif!.status).toBe('delivered');
  });

  it('notify strategy suggestion', () => {
    const notif = engine.notifyStrategySuggestion({
      userId: 'u2', strategyName: 'Golden Cross V2',
      performance: '+15.3% annualized',
      recommendation: 'Continue monitoring with tight stops',
    });
    expect(notif).toBeTruthy();
    expect(notif!.priority).toBe('high');
    expect(notif!.body).toContain('+15.3%');
  });

  it('notify spending report', () => {
    const notif = engine.notifySpendingReport({
      userId: 'u3', period: 'May 2026',
      totalSpent: 125.5,
      breakdown: [
        { category: 'AI Services', amount: 80 },
        { category: 'Data Feeds', amount: 45.5 },
      ],
    });
    expect(notif).toBeTruthy();
    expect(notif!.trigger).toBe('spending_report');
    expect(notif!.body).toContain('125.50');
    expect(notif!.body).toContain('AI Services');
  });

  it('notify dividend', () => {
    const notif = engine.notifyDividend({
      userId: 'u4', symbol: 'AAPL', companyName: 'Apple Inc.',
      amountPerShare: 0.25, exDate: '2026-08-07',
      payDate: '2026-08-14', yield: 0.55,
    });
    expect(notif).toBeTruthy();
    expect(notif!.priority).toBe('high');
    expect(notif!.title).toContain('Apple');
    expect(notif!.body).toContain('0.2500');
  });

  it('notify inactive reminder', () => {
    const notif = engine.notifyInactiveReminder({
      userId: 'u5', daysInactive: 7,
      lastLoginDate: '2026-06-10',
      highlights: ['AAPL up 5%', 'New strategy available'],
    });
    expect(notif).toBeTruthy();
    expect(notif!.title).toContain('7 days');
  });

  it('delivery callback', () => {
    let delivered: any = null;
    engine.onDelivery((n) => { delivered = n; });
    const notif = engine.notifyPositionAnalysis({
      userId: 'u-cb', symbols: ['TSLA'],
      summary: 'Test',
    });
    expect(delivered).toBeTruthy();
    expect(delivered.id).toBe(notif!.id);
  });

  it('mark read', () => {
    const notif = engine.notifyPositionAnalysis({
      userId: 'u-mr', symbols: ['X'],
      summary: 'Test',
    });
    expect(engine.markRead('u-mr', notif!.id)).toBe(true);
    const { notifications } = engine.getUserNotifications('u-mr');
    expect(notifications[0].status).toBe('read');
  });

  it('dismiss notification', () => {
    const notif = engine.notifyDividend({
      userId: 'u-dismiss', symbol: 'X', companyName: 'Test',
      amountPerShare: 0.1, exDate: '2026-01-01',
      payDate: '2026-01-15', yield: 1.0,
    });
    expect(engine.dismiss('u-dismiss', notif!.id)).toBe(true);
    const { notifications } = engine.getUserNotifications('u-dismiss');
    expect(notifications[0].status).toBe('dismissed');
  });

  it('mark all read', () => {
    engine.notifyPositionAnalysis({ userId: 'u-mar', symbols: ['A'], summary: '1' });
    engine.notifyStrategySuggestion({ userId: 'u-mar', strategyName: 'S', performance: 'p', recommendation: 'r' });
    const count = engine.markAllRead('u-mar');
    expect(count).toBe(2);
    const unread = engine.getUnreadCount('u-mar');
    expect(unread).toBe(0);
  });

  it('get user notifications filtered', () => {
    engine.notifyPositionAnalysis({ userId: 'u-filt', symbols: ['A'], summary: 'pos' });
    engine.notifyStrategySuggestion({ userId: 'u-filt', strategyName: 'S', performance: 'p', recommendation: 'r' });
    engine.notifyDividend({ userId: 'u-filt', symbol: 'AAPL', companyName: 'Apple', amountPerShare: 0.25, exDate: '2026-01-01', payDate: '2026-01-15', yield: 0.5 });

    const all = engine.getUserNotifications('u-filt');
    expect(all.total).toBe(3);

    const filtered = engine.getUserNotifications('u-filt', { trigger: 'position_analysis' });
    expect(filtered.total).toBe(1);
  });

  it('get unread count', () => {
    // Use dividend (0 cooldown) + strategy_suggestion (different triggers bypass cooldown)
    engine.notifyDividend({ userId: 'u-ur', symbol: 'X', companyName: 'X', amountPerShare: 0.1, exDate: '2026-01-01', payDate: '2026-01-15', yield: 1 });
    engine.notifyStrategySuggestion({ userId: 'u-ur', strategyName: 'S', performance: 'p', recommendation: 'r' });
    // Both are delivered, unread count should be 2
    expect(engine.getUnreadCount('u-ur')).toBe(2);
    // Mark the oldest one read (notifications sorted newest first, so index 1 is oldest)
    const oldest = engine.getUserNotifications('u-ur', { limit: 2 }).notifications[1];
    engine.markRead('u-ur', oldest.id);
    expect(engine.getUnreadCount('u-ur')).toBe(1);
  });

  it('user preferences: disable trigger', () => {
    engine.updatePrefs('u-disable', { enabledTriggers: ['dividend_alert'] });
    const notif = engine.notifyPositionAnalysis({
      userId: 'u-disable', symbols: ['X'], summary: 'test',
    });
    expect(notif).toBeNull(); // Position analysis is disabled
  });

  it('user preferences: max per day', () => {
    engine.updatePrefs('u-max', { maxPerDay: 2 });
    // Use dividend alerts (cooldown=0) to avoid cooldown interference
    const n1 = engine.notifyDividend({ userId: 'u-max', symbol: 'A', companyName: 'A Corp', amountPerShare: 0.1, exDate: '2026-01-01', payDate: '2026-01-15', yield: 1 });
    const n2 = engine.notifyDividend({ userId: 'u-max', symbol: 'B', companyName: 'B Corp', amountPerShare: 0.2, exDate: '2026-01-01', payDate: '2026-01-15', yield: 2 });
    const n3 = engine.notifyDividend({ userId: 'u-max', symbol: 'C', companyName: 'C Corp', amountPerShare: 0.3, exDate: '2026-01-01', payDate: '2026-01-15', yield: 3 });
    expect(n1).toBeTruthy();
    expect(n2).toBeTruthy();
    expect(n3).toBeNull();
  });

  it('cooldown prevents duplicate', () => {
    // Position analysis has 6h cooldown
    const n1 = engine.notifyPositionAnalysis({ userId: 'u-cooldown', symbols: ['X'], summary: '1' });
    expect(n1).toBeTruthy();
    const n2 = engine.notifyPositionAnalysis({ userId: 'u-cooldown', symbols: ['Y'], summary: '2' });
    expect(n2).toBeNull(); // Within cooldown
  });

  it('get user stats', () => {
    engine.notifyPositionAnalysis({ userId: 'u-stats', symbols: ['A'], summary: '1' });
    engine.notifyStrategySuggestion({ userId: 'u-stats', strategyName: 'S', performance: 'p', recommendation: 'r' });
    engine.markRead('u-stats', engine.getUserNotifications('u-stats').notifications[0].id);

    const stats = engine.getUserStats('u-stats');
    expect(stats.totalGenerated).toBe(2);
    expect(stats.totalDelivered).toBe(2);
    expect(stats.totalRead).toBe(1);
  });

  it('get global stats', () => {
    engine.notifyPositionAnalysis({ userId: 'g1', symbols: ['A'], summary: '1' });
    engine.notifyDividend({ userId: 'g2', symbol: 'X', companyName: 'Test', amountPerShare: 0.1, exDate: '2026-01-01', payDate: '2026-01-15', yield: 1.0 });

    const stats = engine.getGlobalStats();
    expect(stats.totalUsers).toBe(2);
    expect(stats.totalNotifications).toBe(2);
    expect(stats.avgPerUser).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// P1-13 BacktestAIInterpretationEngine Tests
// ═══════════════════════════════════════════════════════════════

describe('BacktestAIInterpretationEngine', () => {
  let engine: BacktestAIInterpretationEngine;
  beforeEach(() => { engine = BacktestAIInterpretationEngine.getInstance(); engine.reset(); });

  it('singleton', () => { expect(BacktestAIInterpretationEngine.getInstance()).toBe(engine); });

  const makeMetrics = (overrides?: Partial<any>) => ({
    totalReturn: 0.25,
    annualizedReturn: 0.18,
    sharpeRatio: 1.8,
    sortinoRatio: 2.2,
    maxDrawdown: 0.12,
    volatility: 0.15,
    winRate: 0.58,
    profitFactor: 1.8,
    calmarRatio: 2.1,
    totalTrades: 120,
    avgHoldingDays: 5.3,
    ...overrides,
  });

  const makeInput = (metricsOverrides?: Partial<any>, nameOverrides?: Partial<any>) => ({
    strategyName: 'Test Strategy',
    symbols: ['AAPL', 'MSFT'],
    market: 'US',
    dateRange: { start: '2025-01-01', end: '2025-12-31' },
    metrics: makeMetrics(metricsOverrides),
    trades: [
      { id: 't1', symbol: 'AAPL', side: 'long' as const, entryDate: '2025-03-01', exitDate: '2025-03-15', entryPrice: 180, exitPrice: 195, quantity: 100, pnl: 1500, pnlPct: 0.083, holdingDays: 14 },
      { id: 't2', symbol: 'MSFT', side: 'long' as const, entryDate: '2025-04-01', exitDate: '2025-04-10', entryPrice: 400, exitPrice: 420, quantity: 50, pnl: 1000, pnlPct: 0.05, holdingDays: 9 },
      { id: 't3', symbol: 'AAPL', side: 'short' as const, entryDate: '2025-06-01', exitDate: '2025-06-05', entryPrice: 200, exitPrice: 190, quantity: 100, pnl: 1000, pnlPct: 0.05, holdingDays: 4 },
      { id: 't4', symbol: 'MSFT', side: 'long' as const, entryDate: '2025-08-01', exitDate: '2025-08-20', entryPrice: 450, exitPrice: 435, quantity: 50, pnl: -750, pnlPct: -0.033, holdingDays: 19 },
      { id: 't5', symbol: 'AAPL', side: 'long' as const, entryDate: '2025-10-01', exitDate: '2025-10-15', entryPrice: 210, exitPrice: 230, quantity: 100, pnl: 2000, pnlPct: 0.095, holdingDays: 14 },
    ],
    ...nameOverrides,
  });

  it('interpret: basic execution', () => {
    const result = engine.interpret(makeInput());
    expect(result.id).toMatch(/interp-/);
    expect(result.summary.length).toBeGreaterThan(20);
    expect(result.sentiment).toBe('bullish');
    expect(result.sentimentConfidence).toBeGreaterThan(0.5);
    expect(result.highlights.length).toBeGreaterThanOrEqual(3);
    expect(result.metricInsights.length).toBeGreaterThanOrEqual(5);
  });

  it('interpret: bullish strong', () => {
    const result = engine.interpret(makeInput({
      totalReturn: 0.45, sharpeRatio: 2.5, winRate: 0.70, maxDrawdown: 0.05, profitFactor: 2.5,
    }));
    expect(result.sentiment).toBe('bullish');
    expect(result.recommendedAction).toBe('go_live');
    expect(result.overallScore).toBeGreaterThanOrEqual(80);
  });

  it('interpret: bearish', () => {
    const result = engine.interpret(makeInput({
      totalReturn: -0.15, sharpeRatio: 0.3, winRate: 0.30, maxDrawdown: 0.40, profitFactor: 0.8, totalTrades: 50,
    }));
    expect(result.sentiment).toBe('bearish');
    expect(result.recommendedAction).toBeOneOf(['discard', 'review']);
  });

  it('interpret: neutral / mixed', () => {
    // Very balanced metrics should produce neutral or bearish
    const result = engine.interpret(makeInput({
      totalReturn: 0.02, sharpeRatio: 0.7, winRate: 0.44, maxDrawdown: 0.22, profitFactor: 1.1, totalTrades: 50,
    }));
    expect(['bearish', 'neutral']).toContain(result.sentiment);
  });

  it('metric insights: excellent sharpe', () => {
    const result = engine.interpret(makeInput({ sharpeRatio: 2.5 }));
    const sharpe = result.metricInsights.find(m => m.metricName === 'sharpeRatio')!;
    expect(sharpe.rating).toBe('excellent');
    expect(sharpe.interpretation).toContain('Excellent');
  });

  it('metric insights: poor win rate', () => {
    const result = engine.interpret(makeInput({ winRate: 0.25 }));
    const winRate = result.metricInsights.find(m => m.metricName === 'winRate')!;
    expect(winRate.rating).toBe('critical');
  });

  it('metric insights: critical drawdown', () => {
    const result = engine.interpret(makeInput({ maxDrawdown: 0.35 }));
    const dd = result.metricInsights.find(m => m.metricName === 'maxDrawdown')!;
    expect(dd.rating).toBe('critical');
    expect(dd.interpretation).toContain('Severe');
  });

  it('risk warnings: high drawdown', () => {
    const result = engine.interpret(makeInput({ maxDrawdown: 0.25 }));
    expect(result.riskWarnings.some(w => w.includes('drawdown'))).toBe(true);
  });

  it('risk warnings: low trade count', () => {
    const result = engine.interpret(makeInput({ totalTrades: 20 }));
    expect(result.riskWarnings.some(w => w.includes('trade count'))).toBe(true);
  });

  it('optimization suggestions for high drawdown', () => {
    const result = engine.interpret(makeInput({ maxDrawdown: 0.30 }));
    expect(result.optimizationSuggestions.some(s => s.category === 'risk')).toBe(true);
  });

  it('optimization suggestions for low win rate', () => {
    const result = engine.interpret(makeInput({ winRate: 0.35 }));
    expect(result.optimizationSuggestions.some(s => s.category === 'entry_exit')).toBe(true);
  });

  it('benchmark comparison', () => {
    const benchmark = makeMetrics({ totalReturn: 0.10, sharpeRatio: 0.9, maxDrawdown: 0.15, winRate: 0.45 });
    const result = engine.interpret(makeInput({}, { benchmark, benchmarkName: 'S&P 500' }));
    expect(result.benchmarkComparison).toBeTruthy();
    expect(result.benchmarkComparison!.benchmarkName).toBe('S&P 500');
    expect(result.benchmarkComparison!.outperformance).toBe(true);
  });

  it('get interpretation', () => {
    const result = engine.interpret(makeInput());
    expect(engine.getInterpretation(result.id)).toBe(result);
  });

  it('get all interpretations', () => {
    engine.interpret(makeInput({}, { strategyName: 'Strategy A' }));
    engine.interpret(makeInput({}, { strategyName: 'Strategy B' }));
    expect(engine.getAllInterpretations().length).toBe(2);
  });

  it('get by strategy name', () => {
    engine.interpret(makeInput({}, { strategyName: 'Alpha' }));
    engine.interpret(makeInput({}, { strategyName: 'Beta' }));
    engine.interpret(makeInput({}, { strategyName: 'Alpha' }));
    expect(engine.getByStrategy('Alpha').length).toBe(2);
    expect(engine.getByStrategy('Beta').length).toBe(1);
  });

  it('compare two interpretations', () => {
    const r1 = engine.interpret(makeInput({ totalReturn: 0.30, sharpeRatio: 2.5 }, { strategyName: 'Winner' }));
    const r2 = engine.interpret(makeInput({ totalReturn: -0.05, sharpeRatio: 0.5 }, { strategyName: 'Loser' }));
    const cmp = engine.compare(r1.id, r2.id);
    expect(cmp).toBeTruthy();
    expect(cmp!.winner).toBe('Winner');
    expect(cmp!.analysis.length).toBeGreaterThan(0);
  });

  it('stats', () => {
    engine.interpret(makeInput({ totalReturn: 0.3 }));
    engine.interpret(makeInput({ totalReturn: 0.1 }));
    const stats = engine.getStats();
    expect(stats.totalInterpretations).toBe(2);
    expect(stats.avgScore).toBeGreaterThan(0);
  });

  it('custom model version', () => {
    const result = engine.interpret(makeInput(), 'gpt-5-v2');
    expect(result.modelVersion).toBe('gpt-5-v2');
  });
});
