// ══ R264 LOBEHUB P2: 行情回放体验评估 ══
// Market Replay UX Evaluator — 回放功能的流畅度+可用性+学习价值

export type ReplayAction = 'PLAY' | 'PAUSE' | 'STEP_FORWARD' | 'STEP_BACK' | 'SPEED_1X' | 'SPEED_2X' | 'SPEED_4X' | 'SPEED_8X' | 'JUMP_TO' | 'SCRUB';

export interface ReplayUXSample {
  sessionId: string;
  symbol: string;
  market: string;
  durationMinutes: number;
  actions: Array<{ action: ReplayAction; timestamp: number; responseMs: number }>;
  completed: boolean;
  userRating?: number;       // 1-5
  timeSpentSeconds: number;
}

export interface ReplayUXResult {
  symbol: string;
  sessions: number;
  avgDuration: number;
  completionRate: number;     // %
  avgActionsPerSession: number;
  mostUsedActions: ReplayAction[];
  avgResponseMs: number;      // 操作响应延迟
  p95ResponseMs: number;
  avgRating: number;
  engagementScore: number;    // 0-100
  status: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
}

export interface ReplayUXReport {
  timestamp: number;
  totalSessions: number;
  overallCompletionRate: number;
  overallEngagementScore: number;
  bySymbol: ReplayUXResult[];
  actionFrequency: Record<ReplayAction, number>;
  latencyStatus: 'FAST' | 'ACCEPTABLE' | 'SLOW';
  recommendations: string[];
}

// ═══════════════════ 单标的回放UX ═══════════════════

export function evaluateReplayUX(sessions: ReplayUXSample[]): ReplayUXResult {
  if (sessions.length === 0) {
    return { symbol: 'N/A', sessions: 0, avgDuration: 0, completionRate: 0, avgActionsPerSession: 0, mostUsedActions: [], avgResponseMs: 0, p95ResponseMs: 0, avgRating: 0, engagementScore: 0, status: 'POOR' };
  }

  const symbol = sessions[0].symbol;
  const completed = sessions.filter(s => s.completed).length;
  const completionRate = completed / sessions.length * 100;

  const avgDuration = sessions.reduce((s, x) => s + x.durationMinutes, 0) / sessions.length;
  const allActions = sessions.flatMap(s => s.actions);
  const avgActionsPerSession = allActions.length / sessions.length;

  // Most used actions
  const actionCounts = new Map<ReplayAction, number>();
  for (const a of allActions) {
    actionCounts.set(a.action, (actionCounts.get(a.action) || 0) + 1);
  }
  const mostUsedActions = [...actionCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([a]) => a);

  const responseTimes = allActions.filter(a => a.responseMs > 0).map(a => a.responseMs);
  const avgResponse = responseTimes.length > 0 ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0;
  const sorted = [...responseTimes].sort((a, b) => a - b);
  const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;

  const rated = sessions.filter(s => s.userRating !== undefined);
  const avgRating = rated.length > 0 ? rated.reduce((s, x) => s + (x.userRating || 0), 0) / rated.length : 0;

  // Engagement score
  let engagementScore = 50;
  if (completionRate > 80) engagementScore += 20;
  else if (completionRate > 50) engagementScore += 10;
  if (avgActionsPerSession > 5) engagementScore += 15;
  else if (avgActionsPerSession > 2) engagementScore += 8;
  if (avgRating >= 4) engagementScore += 15;
  else if (avgRating >= 3) engagementScore += 8;
  engagementScore = Math.min(100, engagementScore);

  let status: ReplayUXResult['status'];
  if (engagementScore >= 80) status = 'EXCELLENT';
  else if (engagementScore >= 60) status = 'GOOD';
  else if (engagementScore >= 40) status = 'FAIR';
  else status = 'POOR';

  return {
    symbol, sessions: sessions.length, avgDuration: Math.round(avgDuration * 10) / 10,
    completionRate: Math.round(completionRate * 10) / 10,
    avgActionsPerSession: Math.round(avgActionsPerSession * 10) / 10,
    mostUsedActions, avgResponseMs: Math.round(avgResponse), p95ResponseMs: Math.round(p95),
    avgRating: Math.round(avgRating * 100) / 100,
    engagementScore, status,
  };
}

// ═══════════════════ 全量报告 ═══════════════════

export function generateReplayUXReport(allSessions: ReplayUXSample[]): ReplayUXReport {
  const symbols = [...new Set(allSessions.map(s => s.symbol))];
  const bySymbol = symbols.map(s => evaluateReplayUX(allSessions.filter(x => x.symbol === s)));

  const completed = allSessions.filter(s => s.completed).length;
  const overallCompletionRate = allSessions.length > 0 ? completed / allSessions.length * 100 : 0;

  const engagementScores = bySymbol.map(b => b.engagementScore);
  const overallEngagement = engagementScores.reduce((a, b) => a + b, 0) / Math.max(1, engagementScores.length);

  // Action frequency
  const actionFrequency: Record<ReplayAction, number> = {
    PLAY: 0, PAUSE: 0, STEP_FORWARD: 0, STEP_BACK: 0, SPEED_1X: 0, SPEED_2X: 0, SPEED_4X: 0, SPEED_8X: 0, JUMP_TO: 0, SCRUB: 0,
  };
  for (const s of allSessions) {
    for (const a of s.actions) {
      actionFrequency[a.action] = (actionFrequency[a.action] || 0) + 1;
    }
  }

  const allResponse = allSessions.flatMap(s => s.actions).filter(a => a.responseMs > 0).map(a => a.responseMs);
  const avgResp = allResponse.length > 0 ? allResponse.reduce((a, b) => a + b, 0) / allResponse.length : 0;

  let latencyStatus: ReplayUXReport['latencyStatus'];
  if (avgResp < 100) latencyStatus = 'FAST';
  else if (avgResp < 300) latencyStatus = 'ACCEPTABLE';
  else latencyStatus = 'SLOW';

  const recs: string[] = [];
  if (overallCompletionRate < 60) recs.push('⚠️ 回放完成率<60%—用户可能不懂如何使用');
  if (overallEngagement < 60) recs.push('⚠️ 回放参与度低—需要更好的引导或更直观的UI');
  if (bySymbol.filter(b => b.status === 'POOR').length > 0) recs.push('⚠️ 部分标的回放体验差');
  if (latencyStatus !== 'FAST') recs.push('⚠️ 回放操作延迟需优化');

  return {
    timestamp: Date.now(),
    totalSessions: allSessions.length,
    overallCompletionRate: Math.round(overallCompletionRate * 10) / 10,
    overallEngagementScore: Math.round(overallEngagement),
    bySymbol,
    actionFrequency,
    latencyStatus,
    recommendations: recs,
  };
}

export default ReplayUXReport;
