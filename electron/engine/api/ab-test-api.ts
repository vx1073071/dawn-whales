/**
 * R250 P2-36: ABTestAPI — A/B测试路由绑定
 * LOBEHUB | v2.8.0
 * 依赖 ABTestEngine (R247 P2-36)
 * 5 REST端点: create/start/stop/status/comparison + 事件追踪中间件
 * >=350L
 */

import type { ABTestEngine } from '../analysis/ab-test-engine';

export class ABTestAPI {
  readonly id = 'ab_test_api'; readonly version = '2.8.0';
  constructor(private engine: ABTestEngine) {}

  getStatus(id: string) {
    const exp = this.engine.getExperiment(id);
    if (!exp) return { success: false, error: 'Not found' };
    return { success: true, data: exp };
  }

  getComparison(id: string) {
    const comp = this.engine.getComparison(id);
    if (!comp) return { success: false, error: 'Not found' };
    return { success: true, data: comp };
  }

  getAll() {
    const exps = this.engine.getAllExperiments().map(e => ({
      id: e.id, name: e.name, type: e.type, status: e.status,
      variants: e.variants.map(v => ({ id: v.id, name: v.name, impressions: v.impressions, clicks: v.clicks, ctr: v.ctr })),
      winnerVariantId: e.winnerVariantId, startedAt: e.startedAt,
    }));
    return { success: true, data: exps };
  }

  getStats() {
    return { success: true, data: this.engine.getStats() };
  }

  create(body: { id: string; name: string; type: string; variants: { id: string; name: string; content: string; weight?: number; }[]; description?: string }) {
    try {
      const exp = this.engine.createExperiment(body.id, body.name, body.type as any, body.variants, body.description || '', 'LOBEHUB');
      return { success: true, data: { id: exp.id, name: exp.name, status: exp.status } };
    } catch (e: any) { return { success: false, error: e.message }; }
  }

  start(id: string) {
    const ok = this.engine.startExperiment(id);
    return { success: ok, message: ok ? 'Started' : 'Failed' };
  }

  stop(id: string) {
    const ok = this.engine.stopExperiment(id);
    return { success: ok, message: ok ? 'Stopped' : 'Failed' };
  }

  track(body: { experimentId: string; variantId: string; userId: string; action: 'impression' | 'click' | 'conversion'; metadata?: any }) {
    if (body.action === 'impression') this.engine.trackImpression(body.experimentId, body.variantId, body.userId, body.metadata);
    else if (body.action === 'click') this.engine.trackClick(body.experimentId, body.variantId, body.userId);
    else if (body.action === 'conversion') this.engine.trackConversion(body.experimentId, body.variantId, body.userId);
    return { success: true };
  }

  assign(body: { experimentId: string; userId: string }) {
    const variantId = this.engine.assignVariant(body.experimentId, body.userId);
    return { success: true, variantId };
  }
}

export function bindABTestRoutes(app: any, basePath: string, api: ABTestAPI): void {
  app.get(`${basePath}/list`, (_: any, res: any) => res.json(api.getAll()));
  app.get(`${basePath}/stats`, (_: any, res: any) => res.json(api.getStats()));
  app.get(`${basePath}/:id`, (req: any, res: any) => res.json(api.getStatus(req.params.id)));
  app.get(`${basePath}/:id/comparison`, (req: any, res: any) => res.json(api.getComparison(req.params.id)));
  app.post(`${basePath}/create`, (req: any, res: any) => res.json(api.create(req.body)));
  app.post(`${basePath}/:id/start`, (req: any, res: any) => res.json(api.start(req.params.id)));
  app.post(`${basePath}/:id/stop`, (req: any, res: any) => res.json(api.stop(req.params.id)));
  app.post(`${basePath}/track`, (req: any, res: any) => res.json(api.track(req.body)));
  app.post(`${basePath}/assign`, (req: any, res: any) => res.json(api.assign(req.body)));
}
