/**
 * R251 P2-40: AIPerformanceDashboardAPI — AI仪表盘路由绑定
 * LOBEHUB | v2.8.0
 * 依赖 AIPerformanceDashboard (R249 P2-40)
 * 端点: dashboard/:userId actions/:userId summary milestones/:userId
 * >=350L
 */

import type { AIPerformanceDashboard, AIAction } from '../analysis/ai-performance-dashboard';

export class AIPerformanceDashboardAPI {
  readonly id = 'ai_dashboard_api'; readonly version = '2.8.0';
  private dashboard: AIPerformanceDashboard;
  private userActions: Map<string, AIAction[]> = new Map();

  constructor(dashboard: AIPerformanceDashboard) {
    this.dashboard = dashboard;
  }

  getDashboard(userId: string) {
    const actions = this.userActions.get(userId) || [];
    const d = this.dashboard.generate(actions, userId);
    return { success: true, data: d };
  }

  getActions(userId: string, limit: number = 20) {
    const actions = (this.userActions.get(userId) || []).slice(-limit).reverse();
    return { success: true, data: actions };
  }

  logAction(body: AIAction) {
    if (!this.userActions.has(body.userId)) this.userActions.set(body.userId, []);
    this.userActions.get(body.userId)!.push(body);
    return { success: true };
  }

  logBatch(events: AIAction[]) {
    for (const e of events) {
      if (!this.userActions.has(e.userId)) this.userActions.set(e.userId, []);
      this.userActions.get(e.userId)!.push(e);
    }
    return { success: true, count: events.length };
  }

  getSummary(userId: string) {
    const actions = this.userActions.get(userId) || [];
    const d = this.dashboard.generate(actions, userId);
    return {
      success: true,
      data: {
        netValue: d.netAIValue, savedHours: d.totalSavedHours,
        adoptionRate: d.adoptionRate, accuracyRate: d.accuracyRate,
        userLevel: d.userLevel, userTagline: d.userTagline,
        totalActions: d.totalAIActions,
      },
    };
  }

  getMilestones(userId: string) {
    const actions = this.userActions.get(userId) || [];
    const d = this.dashboard.generate(actions, userId);
    return { success: true, data: d.trustMilestones };
  }

  getWeeklyTrend(userId: string) {
    const actions = this.userActions.get(userId) || [];
    const d = this.dashboard.generate(actions, userId);
    return { success: true, data: d.weeklySnapshots };
  }

  getByType(userId: string) {
    const actions = this.userActions.get(userId) || [];
    const d = this.dashboard.generate(actions, userId);
    return { success: true, data: d.byType };
  }
}

export function bindAIDashboardRoutes(app: any, basePath: string, api: AIPerformanceDashboardAPI): void {
  app.get(`${basePath}/:userId`, (req: any, res: any) => res.json(api.getDashboard(req.params.userId)));
  app.get(`${basePath}/:userId/actions`, (req: any, res: any) => res.json(api.getActions(req.params.userId, parseInt(req.query.limit) || 20)));
  app.get(`${basePath}/:userId/summary`, (req: any, res: any) => res.json(api.getSummary(req.params.userId)));
  app.get(`${basePath}/:userId/milestones`, (req: any, res: any) => res.json(api.getMilestones(req.params.userId)));
  app.get(`${basePath}/:userId/trend`, (req: any, res: any) => res.json(api.getWeeklyTrend(req.params.userId)));
  app.get(`${basePath}/:userId/by-type`, (req: any, res: any) => res.json(api.getByType(req.params.userId)));
  app.post(`${basePath}/log`, (req: any, res: any) => res.json(api.logAction(req.body)));
  app.post(`${basePath}/log-batch`, (req: any, res: any) => res.json(api.logBatch(req.body?.events || [])));
}

export default AIPerformanceDashboardAPI;
