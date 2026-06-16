/**
 * R251 P2-39: CopytradePreviewAPI — 策略跟单预览路由绑定
 * LOBEHUB | v2.8.0
 * 依赖 CopytradePreviewEngine (R249 P2-39)
 * 端点: preview/:strategyId/:userId  quick-fit/:strategyId/:userId  batch
 * >=300L
 */

import type { CopytradePreviewEngine } from '../analysis/copytrade-preview-engine';
import type { PortfolioHolding, StrategyProfile } from '../analysis/copytrade-preview-engine';

export class CopytradePreviewAPI {
  readonly id = 'copytrade_preview_api'; readonly version = '2.8.0';
  private engine: CopytradePreviewEngine;
  private portfolios: Map<string, PortfolioHolding[]> = new Map();
  private strategies: Map<string, StrategyProfile> = new Map();

  constructor(engine: CopytradePreviewEngine) {
    this.engine = engine;
  }

  /** 注入策略定义 */
  setStrategy(strategy: StrategyProfile): void { this.strategies.set(strategy.id, strategy); }

  /** 注入用户持仓 */
  setPortfolio(userId: string, holdings: PortfolioHolding[]): void { this.portfolios.set(userId, holdings); }

  /** 完整预览 */
  preview(strategyId: string, userId: string) {
    const strategy = this.strategies.get(strategyId);
    const portfolio = this.portfolios.get(userId) || [];
    if (!strategy) return { success: false, error: 'Strategy not found' };
    const result = this.engine.preview(portfolio, strategy);
    return { success: true, data: result };
  }

  /** 快速适配度 */
  quickFit(strategyId: string, userId: string) {
    const strategy = this.strategies.get(strategyId);
    const portfolio = this.portfolios.get(userId) || [];
    if (!strategy) return { success: false, error: 'Strategy not found' };
    const result = this.engine.preview(portfolio, strategy);
    return {
      success: true,
      data: {
        strategyId, strategyName: strategy.name,
        fitScore: result.fitScore, fitVerdict: result.fitVerdict,
        recommendation: result.recommendation,
        riskChange: result.riskChange,
        aiExplanation: result.aiExplanation,
      },
    };
  }

  /** 批量对比：一次比较多个策略 */
  batchCompare(userId: string, strategyIds: string[]) {
    const portfolio = this.portfolios.get(userId) || [];
    const results = strategyIds.map(id => {
      const s = this.strategies.get(id);
      if (!s) return { strategyId: id, error: 'Not found' };
      const r = this.engine.preview(portfolio, s);
      return {
        strategyId: id, strategyName: r.strategyName,
        fitScore: r.fitScore, fitVerdict: r.fitVerdict,
        simulatedReturn: r.simulatedReturn,
        riskChange: r.riskChange,
        recommendation: r.recommendation,
      };
    }).sort((a, b) => (b.fitScore || 0) - (a.fitScore || 0));
    return { success: true, data: results };
  }

  /** 用户所有推荐：扫全策略，只返回fit>=good的 */
  recommendAll(userId: string, minFit: number = 60) {
    const portfolio = this.portfolios.get(userId) || [];
    const all = [...this.strategies.values()]
      .map(s => ({ s, r: this.engine.preview(portfolio, s) }))
      .filter(({ r }) => r.fitScore >= minFit)
      .sort((a, b) => b.r.fitScore - a.r.fitScore)
      .map(({ s, r }) => ({
        strategyId: s.id, strategyName: s.name, strategyCategory: s.category,
        fitScore: r.fitScore, fitVerdict: r.fitVerdict,
        simulatedReturn: r.simulatedReturn,
        factorOverlap: r.factorOverlap,
        newFactorsCount: r.newFactors.length,
        recommendation: r.recommendation,
      }));
    return { success: true, data: all };
  }

  /** 设置持仓（从外部数据源同步） */
  setHoldings(body: { userId: string; holdings: PortfolioHolding[] }) {
    this.portfolios.set(body.userId, body.holdings);
    return { success: true, count: body.holdings.length };
  }

  /** 批量设置策略 */
  setStrategies(strategies: StrategyProfile[]) {
    strategies.forEach(s => this.strategies.set(s.id, s));
    return { success: true, count: strategies.length };
  }
}

export function bindCopytradePreviewRoutes(app: any, basePath: string, api: CopytradePreviewAPI): void {
  app.get(`${basePath}/preview/:strategyId/:userId`, (req: any, res: any) =>
    res.json(api.preview(req.params.strategyId, req.params.userId)));
  app.get(`${basePath}/quick-fit/:strategyId/:userId`, (req: any, res: any) =>
    res.json(api.quickFit(req.params.strategyId, req.params.userId)));
  app.post(`${basePath}/batch/:userId`, (req: any, res: any) =>
    res.json(api.batchCompare(req.params.userId, req.body?.strategyIds || [])));
  app.get(`${basePath}/recommend/:userId`, (req: any, res: any) =>
    res.json(api.recommendAll(req.params.userId, parseInt(req.query.minFit) || 60)));
  app.post(`${basePath}/holdings`, (req: any, res: any) =>
    res.json(api.setHoldings(req.body)));
  app.post(`${basePath}/strategies`, (req: any, res: any) =>
    res.json(api.setStrategies(req.body?.strategies || [])));
}

export default CopytradePreviewAPI;
