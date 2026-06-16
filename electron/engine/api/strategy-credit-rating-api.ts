/**
 * R247 P1-26: StrategyCreditRatingAPI — 策略信用评级前端API
 * LOBEHUB | v2.8.0
 *
 * 为前端展示提供评级数据。依赖 StrategyCreditRatingEngine (R246 P1-26)。
 *
 * API:
 *   GET /api/strategy-rating/:id       — 单个策略评级
 *   GET /api/strategy-rating/batch      — 批量评级 (POST ids[])
 *   GET /api/strategy-rating/radar/:id  — 五维雷达图数据
 *   GET /api/strategy-rating/leaderboard — A级排行
 *   GET /api/strategy-rating/stats       — 全局统计
 *
 * 约束: 纯TypeScript, ≥350L
 */

import type { StrategyCreditRatingEngine, CreditRatingResult } from '../analysis/strategy-credit-rating';

// ── 响应类型 ─────────────────────────────────────────────────

export interface RatingDetailResponse {
  success: boolean;
  data: {
    rating: CreditRatingResult | null;
    radar: { dimension: string; score: number; weight: number; label: string; }[];
    badge: { letter: string; color: string; bg: string; text: string; };
  } | null;
}

export interface BatchRatingResponse {
  success: boolean;
  data: { templateId: string; rating: string; score: number; }[];
}

export interface LeaderboardResponse {
  success: boolean;
  data: { templateId: string; name: string; nameCn: string; rating: string; score: number; market: string; category: string; }[];
}

export interface RatingStatsResponse {
  success: boolean;
  data: {
    total: number;
    distribution: Record<string, number>;
    avgScore: number;
    top3: { id: string; name: string; score: number; }[];
  };
}

// 评级徽章样式
const BADGE_STYLES: Record<string, { letter: string; color: string; bg: string; text: string; }> = {
  A: { letter: 'A', color: '#22c55e', bg: '#052e16', text: '稳健 — 适合长期配置' },
  B: { letter: 'B', color: '#3b82f6', bg: '#0c1a3a', text: '良好 — 注意风控' },
  C: { letter: 'C', color: '#f59e0b', bg: '#2d1b00', text: '一般 — 建议短期使用' },
  D: { letter: 'D', color: '#ef4444', bg: '#2d0000', text: '高风险 — 谨慎使用' },
};

const DIMENSION_LABELS: Record<string, string> = {
  stability: '稳健性',
  decayResistance: '抗衰减',
  transparency: '透明度',
  riskControl: '风控能力',
  creatorReputation: '创作者信誉',
};

// ── StrategyCreditRatingAPI ─────────────────────────────────

export class StrategyCreditRatingAPI {
  readonly id = 'strategy_credit_rating_api';
  readonly version = '2.8.0';

  private engine: StrategyCreditRatingEngine;

  constructor(engine: StrategyCreditRatingEngine) {
    this.engine = engine;
  }

  // ── GET /:id ─────────────────────────────────────────────

  getRating(templateId: string): RatingDetailResponse {
    try {
      const rating = this.engine.getResult(templateId);
      if (!rating) {
        return { success: false, data: null };
      }

      const radar = Object.entries(rating.dimensions).map(([key, val]) => ({
        dimension: key,
        score: val.score,
        weight: val.weight,
        label: DIMENSION_LABELS[key] || key,
      }));

      return {
        success: true,
        data: {
          rating,
          radar,
          badge: BADGE_STYLES[rating.rating] || BADGE_STYLES.D,
        },
      };
    } catch (e: any) {
      return { success: false, data: null };
    }
  }

  // ── POST /batch ──────────────────────────────────────────

  getBatch(templateIds: string[]): BatchRatingResponse {
    try {
      const data = templateIds.map(id => {
        const r = this.engine.getResult(id);
        return { templateId: id, rating: r?.rating || 'N/A', score: r?.totalScore || 0 };
      });
      return { success: true, data };
    } catch (e: any) {
      return { success: false, data: [] };
    }
  }

  // ── GET /radar/:id ───────────────────────────────────────

  getRadar(templateId: string): { success: boolean; data: any } {
    try {
      const rating = this.engine.getResult(templateId);
      if (!rating) return { success: false, data: null };

      return {
        success: true,
        data: {
          templateId,
          templateName: rating.templateName,
          rating: rating.rating,
          totalScore: rating.totalScore,
          dimensions: Object.entries(rating.dimensions).map(([k, v]) => ({
            axis: DIMENSION_LABELS[k] || k,
            score: v.score,
            weight: Math.round(v.weight * 100),
            fullMark: 100,
          })),
        },
      };
    } catch (e: any) {
      return { success: false, data: null };
    }
  }

  // ── GET /leaderboard ─────────────────────────────────────

  getLeaderboard(limit: number = 20): LeaderboardResponse {
    try {
      const all = this.engine.getAllResults();
      const sorted = all
        .filter(r => r.rating === 'A' || r.rating === 'B')
        .sort((a, b) => b.totalScore - a.totalScore)
        .slice(0, limit);

      return {
        success: true,
        data: sorted.map(r => ({
          templateId: r.templateId,
          name: r.templateName,
          nameCn: r.templateNameCn,
          rating: r.rating,
          score: r.totalScore,
          market: r.market,
          category: r.category,
        })),
      };
    } catch (e: any) {
      return { success: false, data: [] };
    }
  }

  // ── GET /stats ───────────────────────────────────────────

  getStats(): RatingStatsResponse {
    try {
      const all = this.engine.getAllResults();
      const dist: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
      all.forEach(r => { dist[r.rating] = (dist[r.rating] || 0) + 1; });
      const avgScore = all.length > 0 ? Math.round(all.reduce((s, r) => s + r.totalScore, 0) / all.length) : 0;
      const sorted = [...all].sort((a, b) => b.totalScore - a.totalScore);

      return {
        success: true,
        data: {
          total: all.length,
          distribution: dist,
          avgScore,
          top3: sorted.slice(0, 3).map(r => ({ id: r.templateId, name: r.templateName, score: r.totalScore })),
        },
      };
    } catch (e: any) {
      return { success: false, data: { total: 0, distribution: {}, avgScore: 0, top3: [] } };
    }
  }
}

export function bindCreditRatingRoutes(app: any, basePath: string, api: StrategyCreditRatingAPI): void {
  app.get(`${basePath}/:id`, (req: any, res: any) => res.json(api.getRating(req.params.id)));
  app.post(`${basePath}/batch`, (req: any, res: any) => res.json(api.getBatch(req.body?.ids || [])));
  app.get(`${basePath}/radar/:id`, (req: any, res: any) => res.json(api.getRadar(req.params.id)));
  app.get(`${basePath}/leaderboard`, (req: any, res: any) => res.json(api.getLeaderboard(parseInt(req.query.limit) || 20)));
  app.get(`${basePath}/stats`, (_req: any, res: any) => res.json(api.getStats()));
}

export default StrategyCreditRatingAPI;
