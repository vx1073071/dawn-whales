/**
 * R267 autoclaw 综合测试 — 画线→策略 + 云同步 + 社区分享
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { DrawingStrategyBridge, drawingStrategyBridge } from '../../electron/engine/data/drawing-strategy-bridge';
import { DrawingCloudSyncBridge, drawingCloudSyncBridge } from '../../electron/engine/data/drawing-cloud-sync-bridge';
import { DrawingCommunityShareBridge, drawingCommunityShareBridge } from '../../electron/engine/data/drawing-community-share-bridge';

// ═══════════════════════════════════════════════════════════════════════════
// DrawingStrategyBridge 测试
// ═══════════════════════════════════════════════════════════════════════════

describe('R267 DrawingStrategyBridge', () => {
  let bridge: DrawingStrategyBridge;
  beforeEach(() => { bridge = new DrawingStrategyBridge(); });

  describe('single drawing strategy', () => {
    it('should generate support bounce from horizontal line below price', () => {
      const strategies = bridge.generateStrategy({
        drawings: [{ drawingId: 'h1', type: 'horizontal-line', points: [{ price: 180, time: 1000 }] }],
        symbol: 'AAPL', currentPrice: 185, timeframe: 'D',
      });

      expect(strategies.length).toBeGreaterThanOrEqual(1);
      expect(strategies.some(s => s.type === 'support_bounce')).toBe(true);
    });

    it('should generate breakout from horizontal line above price', () => {
      const strategies = bridge.generateStrategy({
        drawings: [{ drawingId: 'h2', type: 'horizontal-line', points: [{ price: 200, time: 1000 }] }],
        symbol: 'MSFT', currentPrice: 190, timeframe: 'D',
      });

      expect(strategies.some(s => s.type === 'breakout_long')).toBe(true);
    });

    it('should generate trend-following from trend line', () => {
      const strategies = bridge.generateStrategy({
        drawings: [{
          drawingId: 't1', type: 'trend-line',
          points: [{ price: 175, time: 0 }, { price: 185, time: 1000 }],
        }],
        symbol: 'AAPL', currentPrice: 186, timeframe: 'D',
      });

      expect(strategies.length).toBeGreaterThanOrEqual(1);
    });

    it('should generate fibonacci strategy', () => {
      const strategies = bridge.generateStrategy({
        drawings: [{
          drawingId: 'f1', type: 'fib-retracement',
          points: [{ price: 900, time: 0 }, { price: 800, time: 1000 }],
        }],
        symbol: 'NVDA', currentPrice: 840, timeframe: '4h',
      });

      expect(strategies.some(s => s.type === 'fibonacci_retrace')).toBe(true);
    });

    it('should generate channel strategy', () => {
      const strategies = bridge.generateStrategy({
        drawings: [{
          drawingId: 'c1', type: 'parallel-channel',
          points: [{ price: 150, time: 0 }, { price: 140, time: 500 }, { price: 145, time: 1000 }],
        }],
        symbol: 'AMD', currentPrice: 142, timeframe: '1h',
      });

      expect(strategies.some(s => s.type === 'channel_trade')).toBe(true);
    });
  });

  describe('risk/reward', () => {
    it('should calculate risk/reward ratio', () => {
      const strategies = bridge.generateStrategy({
        drawings: [{ drawingId: 'h3', type: 'horizontal-line', points: [{ price: 100, time: 0 }] }],
        symbol: 'XYZ', currentPrice: 97, timeframe: 'D',
      });

      expect(strategies[0].riskReward.ratio).toBeGreaterThan(0);
      expect(strategies[0].riskReward.risk).toBeGreaterThan(0);
    });
  });

  describe('validation', () => {
    it('should validate strategy and return warnings', () => {
      const strategies = bridge.generateStrategy({
        drawings: [{ drawingId: 'h4', type: 'horizontal-line', points: [{ price: 50, time: 0 }] }],
        symbol: 'INTC', currentPrice: 48, timeframe: 'D',
      });

      const validation = bridge.validateStrategy(strategies[0]);
      expect(typeof validation.valid).toBe('boolean');
    });
  });

  describe('composite', () => {
    it('should generate composite from multiple drawings', () => {
      const composite = bridge.generateComposite({
        drawings: [
          { drawingId: 'h5', type: 'horizontal-line', points: [{ price: 180, time: 0 }] },
          { drawingId: 't2', type: 'trend-line', points: [{ price: 175, time: 0 }, { price: 185, time: 1000 }] },
        ],
        symbol: 'AAPL', currentPrice: 186, timeframe: 'D',
      });

      expect(composite).not.toBeNull();
      expect(composite?.type).toBe('composite');
    });

    it('should return null for single drawing', () => {
      const composite = bridge.generateComposite({
        drawings: [{ drawingId: 'h6', type: 'horizontal-line', points: [{ price: 180, time: 0 }] }],
        symbol: 'AAPL', currentPrice: 185, timeframe: 'D',
      });

      expect(composite).toBeNull();
    });
  });

  describe('singleton', () => {
    it('should have prebuilt instance', () => {
      expect(typeof drawingStrategyBridge.getStats().totalStrategies).toBe('number');
      drawingStrategyBridge.reset();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// DrawingCloudSyncBridge 测试
// ═══════════════════════════════════════════════════════════════════════════

describe('R267 DrawingCloudSyncBridge', () => {
  let bridge: DrawingCloudSyncBridge;
  beforeEach(() => { bridge = new DrawingCloudSyncBridge('device-test-1'); });

  describe('save/delete', () => {
    it('should save a new drawing', () => {
      const drawing = bridge.saveDrawing({
        drawingId: 'd1', symbol: 'AAPL', type: 'trend-line',
        category: 'line', state: { points: [{ price: 180, time: 1000 }], color: '#ff0000', lineWidth: 2, lineStyle: [], locked: false, visible: true, zIndex: 0 },
      });

      expect(drawing.version).toBe(1);
      expect(drawing.symbol).toBe('AAPL');
    });

    it('should bump version on re-save', () => {
      bridge.saveDrawing({
        drawingId: 'd2', symbol: 'AAPL', type: 'trend-line',
        category: 'line', state: { points: [{ price: 180, time: 1000 }], color: '#ff0000', lineWidth: 2, lineStyle: [], locked: false, visible: true, zIndex: 0 },
      });
      const v2 = bridge.saveDrawing({
        drawingId: 'd2', symbol: 'AAPL', type: 'trend-line',
        category: 'line', state: { points: [{ price: 182, time: 1000 }], color: '#00ff00', lineWidth: 3, lineStyle: [], locked: false, visible: true, zIndex: 0 },
      });

      expect(v2.version).toBe(2);
    });

    it('should soft-delete drawing', () => {
      bridge.saveDrawing({
        drawingId: 'd3', symbol: 'MSFT', type: 'horizontal-line',
        category: 'line', state: { points: [{ price: 400, time: 1000 }], color: '#0000ff', lineWidth: 1, lineStyle: [], locked: false, visible: true, zIndex: 0 },
      });

      expect(bridge.deleteDrawing('d3')).toBe(true);
      expect(bridge.getAllDrawings()).not.toContainEqual(expect.objectContaining({ drawingId: 'd3' }));
    });

    it('should restore deleted drawing', () => {
      bridge.saveDrawing({
        drawingId: 'd4', symbol: 'GOOG', type: 'text',
        category: 'text', state: { points: [{ price: 180, time: 1000 }], color: '#ff0000', lineWidth: 2, lineStyle: [], locked: false, visible: true, zIndex: 0 },
      });
      bridge.deleteDrawing('d4');
      expect(bridge.restoreDrawing('d4')).toBe(true);
      expect(bridge.getDrawingsBySymbol('GOOG').length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('version history', () => {
    it('should track version history', () => {
      bridge.saveDrawing({
        drawingId: 'd5', symbol: 'TSLA', type: 'trend-line',
        category: 'line', state: { points: [{ price: 250, time: 0 }], color: '#ff0000', lineWidth: 2, lineStyle: [], locked: false, visible: true, zIndex: 0 },
      });
      bridge.saveDrawing({
        drawingId: 'd5', symbol: 'TSLA', type: 'trend-line',
        category: 'line', state: { points: [{ price: 255, time: 1000 }], color: '#ff0000', lineWidth: 2, lineStyle: [], locked: false, visible: true, zIndex: 0 },
      });

      const history = bridge.getVersionHistory('d5');
      expect(history.length).toBe(2);
    });

    it('should restore to specific version', () => {
      bridge.saveDrawing({
        drawingId: 'd6', symbol: 'NVDA', type: 'horizontal-line',
        category: 'line', state: { points: [{ price: 800, time: 0 }], color: '#ff0000', lineWidth: 2, lineStyle: [], locked: false, visible: true, zIndex: 0 },
      });
      bridge.saveDrawing({
        drawingId: 'd6', symbol: 'NVDA', type: 'horizontal-line',
        category: 'line', state: { points: [{ price: 810, time: 1000 }], color: '#ff0000', lineWidth: 2, lineStyle: [], locked: false, visible: true, zIndex: 0 },
      });

      const restored = bridge.restoreVersion('d6', 1);
      expect(restored).not.toBeNull();
      expect(restored?.state.points[0].price).toBe(800);
    });
  });

  describe('sync', () => {
    it('should generate manifest', () => {
      bridge.saveDrawing({
        drawingId: 'd7', symbol: 'BTC', type: 'trend-line',
        category: 'line', state: { points: [{ price: 65000, time: 0 }], color: '#ff0000', lineWidth: 2, lineStyle: [], locked: false, visible: true, zIndex: 0 },
      });

      const manifest = bridge.generateManifest('BTC');
      expect(manifest.drawings.length).toBe(1);
      expect(manifest.deviceId).toBe('device-test-1');
    });

    it('should compare manifests and detect changes', () => {
      bridge.saveDrawing({
        drawingId: 'd8', symbol: 'ETH', type: 'horizontal-line',
        category: 'line', state: { points: [{ price: 3000, time: 0 }], color: '#ff0000', lineWidth: 2, lineStyle: [], locked: false, visible: true, zIndex: 0 },
      });

      const local = bridge.generateManifest('ETH');
      const remote: typeof local = {
        ...local,
        drawings: [{ drawingId: 'd9', hash: 'different', version: 2, updatedAt: Date.now() + 1000, isDeleted: false }],
      };

      const { toUpload, toDownload } = bridge.compareWithRemote(local, remote);
      expect(toUpload.length >= 1 || toDownload.length >= 1).toBe(true);
    });

    it('should sync and mark drawings as synced', () => {
      bridge.saveDrawing({
        drawingId: 'd10', symbol: 'DOGE', type: 'fib-retracement',
        category: 'fib', state: { points: [{ price: 0.1, time: 0 }], color: '#ff0000', lineWidth: 2, lineStyle: [], locked: false, visible: true, zIndex: 0 },
      });

      const local = bridge.generateManifest('DOGE');
      const result = bridge.sync('DOGE', local);
      expect(result.status).toBe('synced');
    });
  });

  describe('import/export', () => {
    it('should export drawings as JSON', () => {
      bridge.saveDrawing({
        drawingId: 'd11', symbol: 'SOL', type: 'trend-line',
        category: 'line', state: { points: [{ price: 100, time: 0 }], color: '#ff0000', lineWidth: 2, lineStyle: [], locked: false, visible: true, zIndex: 0 },
      });

      const exported = bridge.exportDrawings('SOL');
      const parsed = JSON.parse(exported);
      expect(parsed.drawingCount).toBe(1);
    });

    it('should import drawings from JSON', () => {
      const json = JSON.stringify({
        exportVersion: 1, deviceId: 'test', exportedAt: Date.now(),
        symbol: 'ADA',
        drawings: [{
          drawingId: 'di1', symbol: 'ADA', type: 'horizontal-line', category: 'line',
          state: { points: [{ price: 1.5, time: 0 }], color: '#ff0000', lineWidth: 2, lineStyle: [], locked: false, visible: true, zIndex: 0 },
        }],
        drawingCount: 1,
      });

      const result = bridge.importDrawings(json);
      expect(result.imported).toBe(1);
    });
  });

  describe('singleton', () => {
    it('should have prebuilt instance', () => {
      expect(typeof drawingCloudSyncBridge.getStats().totalDrawings).toBe('number');
      drawingCloudSyncBridge.reset();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// DrawingCommunityShareBridge 测试
// ═══════════════════════════════════════════════════════════════════════════

describe('R267 DrawingCommunityShareBridge', () => {
  let bridge: DrawingCommunityShareBridge;
  beforeEach(() => { bridge = new DrawingCommunityShareBridge(); });

  describe('sharing', () => {
    it('should create a share post', () => {
      const share = bridge.share({
        authorId: 'user1', authorName: 'TraderJoe',
        symbol: 'AAPL', title: 'Nice Support', titleCn: '漂亮支撑',
        description: 'Support at 180', descriptionCn: '支撑位180',
        type: 'drawing', content: { drawings: [] },
        tags: ['support', 'AAPL'],
      });

      expect(share.shareId).toBeTruthy();
      expect(share.stats.likes).toBe(0);
    });

    it('should create strategy share', () => {
      const share = bridge.share({
        authorId: 'user2', authorName: 'AlphaTrader',
        symbol: 'TSLA', title: 'Breakout Strategy', titleCn: '突破策略',
        description: 'TSLA breakout above 250', descriptionCn: 'TSLA突破250',
        type: 'strategy', content: {
          strategy: {
            strategyId: 's1', type: 'breakout',
            entry: { price: 251, condition: 'Break above', conditionCn: '突破' },
            stopLoss: { price: 245, percent: 2.4 },
            takeProfit: { price: 265, percent: 5.5 },
            riskReward: 2.3, confidence: 75,
          },
        },
        tags: ['breakout', 'TSLA'],
      });

      expect(share.type).toBe('strategy');
    });
  });

  describe('interactions', () => {
    it('should increment likes', () => {
      const share = bridge.share({
        authorId: 'u1', authorName: 'test', symbol: 'SPY', title: 'test', titleCn: '测试',
        description: 'test', descriptionCn: '测试', type: 'drawing', content: { drawings: [] },
      });

      bridge.like(share.shareId);
      bridge.like(share.shareId);
      expect(bridge.getShare(share.shareId)?.stats.likes).toBe(2);
    });

    it('should track views', () => {
      const share = bridge.share({
        authorId: 'u2', authorName: 'test', symbol: 'QQQ', title: 'test', titleCn: '测试',
        description: 'test', descriptionCn: '测试', type: 'drawing', content: { drawings: [] },
      });

      bridge.view(share.shareId);
      bridge.view(share.shareId);
      expect(bridge.getShare(share.shareId)?.stats.views).toBe(2);
    });

    it('should track adoptions', () => {
      const share = bridge.share({
        authorId: 'u3', authorName: 'test', symbol: 'DIA', title: 'test', titleCn: '测试',
        description: 'test', descriptionCn: '测试', type: 'drawing', content: { drawings: [] },
      });

      bridge.adopt(share.shareId);
      expect(bridge.getShare(share.shareId)?.stats.adoptions).toBe(1);
    });
  });

  describe('comments', () => {
    it('should add and retrieve comments', () => {
      const share = bridge.share({
        authorId: 'u4', authorName: 'poster', symbol: 'META', title: 'test', titleCn: '测试',
        description: 'test', descriptionCn: '测试', type: 'drawing', content: { drawings: [] },
      });

      bridge.addComment({ shareId: share.shareId, authorId: 'u5', authorName: 'commenter', text: 'Great setup!' });
      const comments = bridge.getComments(share.shareId);
      expect(comments.length).toBe(1);
      expect(comments[0].text).toBe('Great setup!');
    });
  });

  describe('templates', () => {
    it('should publish template', () => {
      const tmpl = bridge.publishTemplate({
        name: 'MA Crossover', nameCn: '均线交叉',
        description: '5/20 MA cross strategy', descriptionCn: '5/20均线交叉策略',
        type: 'strategy', category: 'indicator',
        drawings: [], tags: ['MA', 'crossover'],
        authorId: 'u6', authorName: 'creator',
      });

      expect(tmpl.templateId).toBeTruthy();
    });

    it('should rate template', () => {
      const tmpl = bridge.publishTemplate({
        name: 'Bollinger Bounce', nameCn: '布林反弹',
        description: 'Bollinger bounce strategy', descriptionCn: '布林反弹策略',
        type: 'strategy', category: 'indicator',
        drawings: [], tags: ['BOLL'], authorId: 'u7', authorName: 'creator',
      });

      bridge.rateTemplate(tmpl.templateId, 4);
      bridge.rateTemplate(tmpl.templateId, 5);

      const rated = bridge.getTemplates({}).find(t => t.templateId === tmpl.templateId);
      expect(rated?.rating).toBe(4.5);
    });
  });

  describe('feed', () => {
    it('should sort feed by new', () => {
      bridge.share({
        authorId: 'u8', authorName: 'a', symbol: 'AAPL', title: '1', titleCn: '1',
        description: '1', descriptionCn: '1', type: 'drawing', content: { drawings: [] },
      });
      bridge.share({
        authorId: 'u8', authorName: 'a', symbol: 'MSFT', title: '2', titleCn: '2',
        description: '2', descriptionCn: '2', type: 'drawing', content: { drawings: [] },
      });

      const feed = bridge.getFeed({ sort: 'new' });
      expect(feed.total).toBe(2);
      expect(feed.shares.length).toBe(2);
    });

    it('should filter feed by symbol', () => {
      bridge.share({
        authorId: 'u9', authorName: 'a', symbol: 'NVDA', title: 'NVDA', titleCn: 'NVDA',
        description: '', descriptionCn: '', type: 'drawing', content: { drawings: [] },
      });
      bridge.share({
        authorId: 'u9', authorName: 'a', symbol: 'AMD', title: 'AMD', titleCn: 'AMD',
        description: '', descriptionCn: '', type: 'drawing', content: { drawings: [] },
      });

      const feed = bridge.getFeed({ symbol: 'NVDA' });
      expect(feed.total).toBe(1);
    });
  });

  describe('trending tags', () => {
    it('should return trending tags', () => {
      bridge.share({
        authorId: 'u10', authorName: 'a', symbol: 'BTC', title: 'test', titleCn: '测试',
        description: '', descriptionCn: '', type: 'drawing', content: { drawings: [] },
        tags: ['crypto', 'breakout'],
      });
      bridge.share({
        authorId: 'u10', authorName: 'a', symbol: 'ETH', title: 'test', titleCn: '测试',
        description: '', descriptionCn: '', type: 'drawing', content: { drawings: [] },
        tags: ['crypto', 'support'],
      });

      const tags = bridge.getTrendingTags();
      expect(tags.length).toBeGreaterThan(0);
    });
  });

  describe('singleton', () => {
    it('should have prebuilt instance', () => {
      expect(typeof drawingCommunityShareBridge.getStats().totalShares).toBe('number');
      drawingCommunityShareBridge.reset();
    });
  });
});
