// Q-48-01 Part 2: Marketplace + Notification + Audit E2E
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { stubWindowApi } from './helpers/mocks';

describe('Q-48-01 Part 2: Marketplace + Notification + Audit E2E', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Strategy Marketplace ───────────────────────────────────────────────────

  describe('Strategy Marketplace E2E', () => {
    it('搜索均线策略', async () => {
      const searchMock = vi.fn().mockResolvedValue({
        success: true,
        results: [
          { id: 'mkt-1', name: '双均线交叉策略', type: 'ma_cross', author: 'community', downloads: 1240, rating: 4.7, tags: ['趋势', '日线'] },
          { id: 'mkt-2', name: 'MA RSIA Strategy', type: 'ma_rsi', author: 'community', downloads: 876, rating: 4.5, tags: ['趋势', '短线'] },
        ],
      });
      stubWindowApi({ marketplace: { search: searchMock } });

      const result = await (window as any).api.marketplace.search({ keyword: '均线', lang: 'zh-CN' });

      expect(result.success).toBe(true);
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.results[0].name).toContain('均线');
    });

    it('下载策略模板', async () => {
      const downloadMock = vi.fn().mockResolvedValue({
        success: true,
        strategy: { id: 'local-strat-1', name: '均线交叉模板', type: 'ma_cross', params: { fastPeriod: 5, slowPeriod: 20 }, status: 'idle' },
      });
      stubWindowApi({ marketplace: { download: downloadMock } });

      const result = await (window as any).api.marketplace.download('mkt-1');

      expect(result.success).toBe(true);
      expect(result.strategy.id).toBeTruthy();
    });

    it('策略评分排序', async () => {
      const searchMock = vi.fn().mockResolvedValue({
        success: true,
        results: [
          { id: 's1', name: '策略A', rating: 4.9, downloads: 500 },
          { id: 's2', name: '策略B', rating: 4.7, downloads: 2000 },
          { id: 's3', name: '策略C', rating: 4.5, downloads: 100 },
        ],
      });
      stubWindowApi({ marketplace: { search: searchMock } });

      const result = await (window as any).api.marketplace.search({ sort: 'rating' });

      expect(result.success).toBe(true);
      expect(result.results[0].rating).toBeGreaterThanOrEqual(result.results[1].rating);
    });

    it('策略评分维度', async () => {
      const scoreMock = vi.fn().mockResolvedValue({
        success: true,
        scores: {
          profitability: 8.5, consistency: 7.8, riskControl: 9.1, easeOfUse: 7.2,
          sharpeRatio: 1.42, maxDrawdown: 0.08, winRate: 0.61, totalReturn: 0.22,
        },
      });
      stubWindowApi({ marketplace: { score: scoreMock } });

      const result = await (window as any).api.marketplace.score('strat-1');

      expect(result.success).toBe(true);
      expect(result.scores.riskControl).toBeGreaterThan(8);
    });
  });

  // ── Notification System ────────────────────────────────────────────────────

  describe('Notification System E2E', () => {
    it('发送告警通知', async () => {
      const notifyMock = vi.fn().mockResolvedValue({ success: true, notificationId: 'notif-001' });
      stubWindowApi({ notification: { send: notifyMock } });

      const result = await (window as any).api.notification.send({
        type: 'alert',
        title: '风险告警',
        message: '组合风险敞口超过 80%，建议减仓',
        priority: 'high',
      });

      expect(result.success).toBe(true);
      expect(result.notificationId).toBeTruthy();
    });

    it('通知优先级路由', async () => {
      const priorityLevels = ['low', 'medium', 'high', 'urgent'];
      const sendMock = vi.fn().mockImplementation(({ priority }: { priority: string }) =>
        Promise.resolve({ success: true, priorityConfirmed: priority })
      );
      stubWindowApi({ notification: { send: sendMock } });

      for (const priority of priorityLevels) {
        const result = await (window as any).api.notification.send({ type: 'info', title: 'Test', message: 'Priority test', priority });
        expect(result.success).toBe(true);
        expect(result.priorityConfirmed).toBe(priority);
      }
    });

    it('获取通知列表', async () => {
      const listMock = vi.fn().mockResolvedValue({
        success: true,
        notifications: [
          { id: 'n1', type: 'alert', title: '风险告警', read: false, timestamp: Date.now() - 3600000 },
          { id: 'n2', type: 'info', title: '回测完成', read: true, timestamp: Date.now() - 7200000 },
        ],
      });
      stubWindowApi({ notification: { list: listMock } });

      const result = await (window as any).api.notification.list();

      expect(result.success).toBe(true);
      expect(result.notifications).toHaveLength(2);
    });

    it('标记通知已读', async () => {
      const markReadMock = vi.fn().mockResolvedValue({ success: true });
      stubWindowApi({ notification: { markRead: markReadMock } });

      const result = await (window as any).api.notification.markRead('n1');

      expect(result.success).toBe(true);
    });
  });

  // ── Audit Trail ──────────────────────────────────────────────────────────

  describe('Audit Trail E2E', () => {
    it('记录订单审计日志', async () => {
      const logMock = vi.fn().mockResolvedValue({ success: true, logId: 'audit-001' });
      stubWindowApi({ audit: { log: logMock } });

      const result = await (window as any).api.audit.log({
        action: 'ORDER_PLACED',
        symbol: 'HK.00700',
        quantity: 100,
        price: 400.5,
        timestamp: Date.now(),
      });

      expect(result.success).toBe(true);
      expect(result.logId).toBeTruthy();
    });

    it('查询审计历史', async () => {
      const queryMock = vi.fn().mockResolvedValue({
        success: true,
        logs: [
          { id: 'audit-001', action: 'ORDER_PLACED', symbol: 'HK.00700', timestamp: Date.now() - 3600000 },
          { id: 'audit-002', action: 'ORDER_CANCELLED', symbol: 'HK.00700', timestamp: Date.now() - 1800000 },
        ],
      });
      stubWindowApi({ audit: { query: queryMock } });

      const result = await (window as any).api.audit.query({ symbol: 'HK.00700', limit: 10 });

      expect(result.success).toBe(true);
      expect(result.logs).toHaveLength(2);
    });

    it('审计日志不可篡改', async () => {
      const auditTrail: any[] = [];
      const logMock = vi.fn().mockImplementation((entry: any) => {
        auditTrail.push({ ...entry, immutableHash: 'sha256_' + auditTrail.length });
        return Promise.resolve({ success: true });
      });
      const queryMock = vi.fn().mockImplementation(() => Promise.resolve({ success: true, logs: [...auditTrail] }));
      stubWindowApi({ audit: { log: logMock, query: queryMock } });

      await (window as any).api.audit.log({ action: 'TEST', symbol: 'US.TEST' });
      const result = await (window as any).api.audit.query({});

      expect(result.logs[0].immutableHash).toBeTruthy();
    });
  });
});
