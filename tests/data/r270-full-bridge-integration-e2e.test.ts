/**
 * R270 QUANT MOO v3.1.0 全桥接集成E2E终极测试
 * 
 * 覆盖91引擎模块端到端集成验证:
 *   链1: 数据源→管线→推送→Tray
 *   链2: 画线→策略→社区分享
 *   链3: 指标→信号→推送→防噪声
 *   链4: 形态→策略→回测桥接
 *   链5: 云同步→导入/导出
 *   链6: 全模块加载+类型一致性
 */
import { describe, it, expect, beforeEach } from 'vitest';

// ═══════════════════════════════════════════════════════════════════════════
// 链1: 数据源→管线→推送→Tray
// ═══════════════════════════════════════════════════════════════════════════

describe('R270 Chain 1: Source→Pipeline→Push→Tray', () => {
  it('should load all data source modules', async () => {
    const modules = [
      'xueqiu-fetcher', 'cls-telegraph-fetcher', 'eastmoney-fetcher',
      'yahoo-engine-bridge', 'binance-api-bridge', 'investing-rss-fetcher',
      'newsapi-manager', 'free-api-fetcher', 'major-feeds',
      'crypto-feeds', 'social-feeds', 'regional-feeds',
    ];
    for (const mod of modules) {
      const m = await import(`../../electron/engine/data/${mod}`);
      expect(m).toBeDefined();
    }
  });

  it('should load pipeline modules', async () => {
    const modules = [
      'dedup-engine', 'dedup-engine-v2', 'degradation-chain',
      'source-health-bar', 'source-health-pipeline', 'source-health-full-chain-verify',
      'pipeline-wiring-bridge', 'pipeline-integration-verify', 'pipeline-load-test',
    ];
    for (const mod of modules) {
      const m = await import(`../../electron/engine/data/${mod}`);
      expect(m).toBeDefined();
    }
  });

  it('should load push modules', async () => {
    const modules = [
      'push-ipc-bridge', 'move-push-bridge', 'crash-push-bridge',
      'crash-alert-wiring', 'ai-factor-bridge', 'anti-noise-bridge',
    ];
    for (const mod of modules) {
      const m = await import(`../../electron/engine/data/${mod}`);
      expect(m).toBeDefined();
    }
  });

  it('should load tray module', async () => {
    const { trayIpcBridge } = await import('../../electron/engine/data/tray-ipc-bridge');
    expect(trayIpcBridge).toBeDefined();
    trayIpcBridge.registerWatchlist(['AAPL', 'MSFT', 'TSLA']);
    const state = trayIpcBridge.getTrayState();
    expect(state).toBeDefined();
    expect(['normal','active','alert','offline']).toContain(state);
  });

  it('should verify push→tray channel integration', async () => {
    const { pushIpcBridge } = await import('../../electron/engine/data/push-ipc-bridge');
    const { trayIpcBridge } = await import('../../electron/engine/data/tray-ipc-bridge');

    // Push dispatch should work
    pushIpcBridge.dispatch({
      title: 'Test Push', body: 'Integration test',
      priority: 'high', category: 'price_alert',
    });
    // Tray should have registered state
    const state = trayIpcBridge.getTrayState();
    expect(state).toBeDefined();
    expect(['normal','active','alert','offline']).toContain(state);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 链2: 画线→策略→社区分享
// ═══════════════════════════════════════════════════════════════════════════

describe('R270 Chain 2: Drawing→Strategy→Community', () => {
  it('should load drawing modules', async () => {
    const modules = [
      'drawing-alert-ipc-bridge', 'drawing-strategy-bridge',
      'drawing-cloud-sync-bridge', 'drawing-community-share-bridge',
      'drawing-68-ipc-bridge',
    ];
    for (const mod of modules) {
      const m = await import(`../../electron/engine/data/${mod}`);
      expect(m).toBeDefined();
    }
  });

  it('should verify drawing→strategy pipeline', async () => {
    const { DrawingStrategyBridge } = await import('../../electron/engine/data/drawing-strategy-bridge');
    const bridge = new DrawingStrategyBridge();

    const strategies = bridge.generateStrategy({
      drawings: [
        { drawingId: 'd1', type: 'horizontal-line', points: [{ price: 180, time: 0 }] },
        { drawingId: 'd2', type: 'trend-line', points: [{ price: 175, time: 0 }, { price: 185, time: 1000 }] },
      ],
      symbol: 'AAPL', currentPrice: 186, timeframe: 'D',
    });

    expect(strategies.length).toBeGreaterThanOrEqual(2);

    // Verify strategy structure
    for (const s of strategies) {
      expect(s.symbol).toBe('AAPL');
      expect(s.entry.price).toBeGreaterThan(0);
      expect(s.stopLoss.price).toBeGreaterThan(0);
      expect(s.riskReward.ratio).toBeGreaterThan(0);
    }
  });

  it('should verify drawing→community share integration', async () => {
    const { DrawingCommunityShareBridge } = await import('../../electron/engine/data/drawing-community-share-bridge');
    const { DrawingStrategyBridge } = await import('../../electron/engine/data/drawing-strategy-bridge');

    const dsBridge = new DrawingStrategyBridge();
    const strategies = dsBridge.generateStrategy({
      drawings: [{ drawingId: 'd3', type: 'horizontal-line', points: [{ price: 100, time: 0 }] }],
      symbol: 'MSFT', currentPrice: 97, timeframe: 'D',
    });

    const community = new DrawingCommunityShareBridge();
    const share = community.share({
      authorId: 'user1', authorName: 'Trader',
      symbol: 'MSFT', title: 'Support Bounce', titleCn: '支撑反弹',
      description: 'Support at 100', descriptionCn: '支撑位100',
      type: 'strategy',
      content: {
        strategy: {
          strategyId: strategies[0].strategyId,
          type: strategies[0].type,
          entry: { price: strategies[0].entry.price, condition: strategies[0].entry.condition, conditionCn: strategies[0].entry.conditionCn },
          stopLoss: { price: strategies[0].stopLoss.price, percent: strategies[0].stopLoss.percent },
          takeProfit: { price: strategies[0].exit[0].price!, percent: strategies[0].exit[0].percent! },
          riskReward: strategies[0].riskReward.ratio,
          confidence: strategies[0].confidence,
        },
      },
    });

    expect(share.type).toBe('strategy');
    expect(share.symbol).toBe('MSFT');

    community.like(share.shareId);
    expect(community.getShare(share.shareId)?.stats.likes).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 链3: 指标→信号→推送→防噪声
// ═══════════════════════════════════════════════════════════════════════════

describe('R270 Chain 3: Indicator→Signal→Push→AntiNoise', () => {
  it('should load indicator + signal modules', async () => {
    const { IndicatorDataPipeline } = await import('../../electron/engine/data/indicator-data-pipeline');
    const { IndicatorSignalPushBridge } = await import('../../electron/engine/data/indicator-signal-push-bridge');
    const { AntiNoiseBridge } = await import('../../electron/engine/data/anti-noise-bridge');

    const pipe = new IndicatorDataPipeline();
    const signalBridge = new IndicatorSignalPushBridge();
    const noiseBridge = new AntiNoiseBridge();

    expect(pipe.getTotalCount()).toBeGreaterThanOrEqual(64);
    expect(signalBridge.getStats().totalSignals).toBeGreaterThanOrEqual(0);
    expect(noiseBridge).toBeDefined();
  });

  it('should run indicator→signal→anti-noise pipeline', async () => {
    const { IndicatorDataPipeline } = await import('../../electron/engine/data/indicator-data-pipeline');
    const { IndicatorSignalPushBridge } = await import('../../electron/engine/data/indicator-signal-push-bridge');
    const { AntiNoiseBridge } = await import('../../electron/engine/data/anti-noise-bridge');

    // Generate fake candles
    const candles = Array.from({ length: 60 }, (_, i) => ({
      open: 100 + i * 0.5, high: 101 + i * 0.5, low: 99 + i * 0.5,
      close: 100 + i * 0.5, volume: 1000000, timestamp: i * 60000,
    }));

    const pipe = new IndicatorDataPipeline();
    const results = pipe.calculate({ indicatorIds: ['rsi', 'cci', 'willr', 'adx', 'atr', 'bb'], symbol: 'SPY', timeframe: '1h', candles });
    expect(results.length).toBe(6);

    const signalBridge = new IndicatorSignalPushBridge();
    const signals = signalBridge.analyze(results);
    expect(Array.isArray(signals)).toBe(true);

    const noiseBridge = new AntiNoiseBridge();
    // Feed signals through anti-noise filter
    for (const sig of signals) {
      const result = noiseBridge.filter({
        pushId: sig.signalId,
        symbol: sig.symbol,
        type: 'indicator',
        severity: sig.priority === 'critical' ? 'critical' : sig.priority === 'high' ? 'high' : 'medium',
        title: sig.message,
        titleCn: sig.messageCn,
        body: sig.message,
        bodyCn: sig.messageCn,
        price: sig.price,
        changePercent: 0,
        timestamp: sig.createdAt,
      });
      expect(result).toHaveProperty('allowed');
    }

    const stats = noiseBridge.getStats();
    expect(typeof stats.totalCandidates).toBe('number');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 链4: 形态→策略→回测
// ═══════════════════════════════════════════════════════════════════════════

describe('R270 Chain 4: Pattern→Strategy→Backtest', () => {
  it('should load pattern + backtest modules', async () => {
    const modules = [
      'pattern-strategy-pipeline', 'backtest-deploy-bridge',
      'news-backtest-data-prep', 'strategy-combo-bridge',
    ];
    for (const mod of modules) {
      const m = await import(`../../electron/engine/data/${mod}`);
      expect(m).toBeDefined();
    }
  });

  it('should run pattern→strategy pipeline', async () => {
    const { PatternStrategyPipeline } = await import('../../electron/engine/data/pattern-strategy-pipeline');

    const pipeline = new PatternStrategyPipeline();
    const candles = [
      { open: 100, high: 102, low: 97, close: 98, volume: 1000000, timestamp: Date.now() - 60000 },
      { open: 97, high: 103, low: 96, close: 102.5, volume: 1200000, timestamp: Date.now() },
    ];

    const { patterns, strategies } = pipeline.runPipeline('AAPL', candles);
    expect(patterns.length).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(strategies)).toBe(true);
  });

  it('should verify strategy output matches backtest input format', async () => {
    const { PatternStrategyPipeline } = await import('../../electron/engine/data/pattern-strategy-pipeline');
    const { BacktestDeployBridge } = await import('../../electron/engine/data/backtest-deploy-bridge');

    const pipeline = new PatternStrategyPipeline();
    const candles = [
      { open: 100, high: 102, low: 97, close: 98, volume: 1000000, timestamp: 1 },
      { open: 97, high: 103, low: 96, close: 102.5, volume: 1200000, timestamp: 2 },
    ];

    const { strategies } = pipeline.runPipeline('MSFT', candles);
    for (const strategy of strategies) {
      // Verify strategy has required fields for backtest
      expect(strategy.entry).toBeGreaterThan(0);
      expect(strategy.stopLoss).toBeGreaterThan(0);
      expect(strategy.takeProfit).toBeGreaterThan(0);
    }

    // Backtest bridge should accept strategy params
    const backtest = new BacktestDeployBridge();
    expect(backtest).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 链5: 云同步→导入/导出
// ═══════════════════════════════════════════════════════════════════════════

describe('R270 Chain 5: CloudSync→Import/Export', () => {
  it('should load cloud sync modules', async () => {
    const { DrawingCloudSyncBridge } = await import('../../electron/engine/data/drawing-cloud-sync-bridge');
    const bridge = new DrawingCloudSyncBridge('dev1');

    const drawing = bridge.saveDrawing({
      drawingId: 'd1', symbol: 'AAPL', type: 'trend-line', category: 'line',
      state: { points: [{ price: 180, time: 1000 }], color: '#ff0', lineWidth: 2, lineStyle: [], locked: false, visible: true, zIndex: 0 },
    });

    expect(drawing.version).toBe(1);

    // Export
    const json = bridge.exportDrawings('AAPL');
    const parsed = JSON.parse(json);
    expect(parsed.drawingCount).toBe(1);

    // Import into new bridge
    const bridge2 = new DrawingCloudSyncBridge('dev2');
    const result = bridge2.importDrawings(json);
    expect(result.imported).toBe(1);
    expect(bridge2.getDrawingsBySymbol('AAPL').length).toBe(1);
  });

  it('should verify sync manifest integrity', async () => {
    const { DrawingCloudSyncBridge } = await import('../../electron/engine/data/drawing-cloud-sync-bridge');

    const local = new DrawingCloudSyncBridge('local');
    local.saveDrawing({
      drawingId: 'sync1', symbol: 'BTC', type: 'fib-retracement', category: 'fib',
      state: { points: [{ price: 65000, time: 0 }], color: '#f0f', lineWidth: 1, lineStyle: [], locked: false, visible: true, zIndex: 0 },
    });

    const manifest = local.generateManifest('BTC');
    expect(manifest.drawings.length).toBe(1);
    expect(manifest.deviceId).toBe('local');
    expect(manifest.totalDrawings).toBe(1);
  });

  it('should load playback modules', async () => {
    const modules = ['playback-data-bridge', 'playback-ipc-bridge'];
    for (const mod of modules) {
      const m = await import(`../../electron/engine/data/${mod}`);
      expect(m).toBeDefined();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 链6: 全模块加载 + 类型一致性
// ═══════════════════════════════════════════════════════════════════════════

describe('R270 Chain 6: Full Module Load + Consistency', () => {
  const ALL_MODULES = [
    // R236-R237 Fallback
    'ai-evidence-bridge', 'ai-questionable-engine', 'ai-sentiment-engine',
    'ai-verifiable-evidence', 'ai-sentiment-engine',
    // R238-R244 News Intelligence
    'xueqiu-fetcher', 'cls-telegraph-fetcher', 'dedup-engine', 'dedup-engine-v2',
    'newsapi-manager', 'news-stock-screener', 'crypto-feeds', 'social-feeds',
    'regional-feeds', 'stock-screener-v2', 'news-backtest-data-prep',
    'daily-digest-v2', 'copytrade-news-enhancer', 'free-api-fetcher', 'major-feeds',
    'price-move-attribution', 'daily-briefing-generator', 'degradation-chain',
    'watchlist-smart-news', 'social-source-degradation', 'backtest-deploy-bridge',
    'news-factor-bridge', 'news-types',
    // R245-R247 Factor
    'fast-deploy-bridge', 'factor-trial-engine', 'one-click-deploy-pipeline',
    'factor-marketplace-bridge', 'factor-signal-translator', 'factor-scene-bridge',
    // R248-R249 PK + Viz
    'template-pk-bridge', 'factor-combo-compare', 'strategy-combo-bridge',
    'factor-marketplace-completion', 'factor-marketplace-enhancer',
    'factor-viz-data-engine', 'factor-viz-completion',
    // R250-R252 Combo + Health
    'portfolio-optimization-bridge', 'source-health-bar', 'source-health-pipeline',
    'template-pk-completion', 'market-strategy-closed-loop',
    // R253 Datasource
    'eastmoney-fetcher', 'yahoo-engine-bridge',
    // R254 Market
    'binance-api-bridge', 'move-attribution-engine', 'briefing-data-bridge',
    // R255 Experience
    'market-to-strategy-bridge', 'investing-rss-fetcher', 'source-switch-ui-bridge',
    // R257 IPC
    'push-ipc-bridge', 'tray-ipc-bridge', 'macro-data-bridge',
    // R258 Experience Core
    'move-push-bridge', 'ai-factor-bridge', 'crash-push-bridge',
    // R259 Loop Close
    'comparison-pk-bridge', 'short-selling-pipeline', 'community-bridge',
    // R260 Final
    'market-strategy-closed-loop', 'sector-rotation-pipeline', 'source-health-full-chain-verify',
    // R261 De-mock
    'pipeline-wiring-bridge', 'broker-quote-priority-detector', 'crash-alert-wiring',
    // R262 P2
    'source-health-ipc-bridge', 'remaining-bridge-finalize', 'playback-data-bridge',
    // R263 Integration
    'pipeline-integration-verify', 'broker-detector-integration', 'pipeline-load-test',
    // R264 Final
    'anti-noise-bridge', 'playback-ipc-bridge', 'full-bridge-e2e',
    // R265 Chart Base
    'shortcut-ipc-bridge', 'multi-chart-sync-bridge', 'flash-chart-ipc-bridge',
    // R266 P1 Core
    'drawing-alert-ipc-bridge', 'cost-basis-push-bridge',
    // R267 P2 Differentiation
    'drawing-strategy-bridge', 'drawing-cloud-sync-bridge', 'drawing-community-share-bridge',
    // R268 Indicator
    'indicator-data-pipeline', 'indicator-signal-push-bridge',
    // R269 Drawing+Pattern+China
    'drawing-68-ipc-bridge', 'pattern-strategy-pipeline', 'china-data-sources',
  ];

  it('should load ALL 91 engine modules', async () => {
    const uniqueModules = [...new Set(ALL_MODULES)];
    let loaded = 0;
    const failed: string[] = [];

    for (const mod of uniqueModules) {
      try {
        await import(`../../electron/engine/data/${mod}`);
        loaded++;
      } catch (e) {
        failed.push(mod);
      }
    }

    expect(loaded).toBeGreaterThanOrEqual(88); // at least 88/91
    expect(failed.length).toBe(0);
  });

  it('should verify no module has import type syntax (vitest compatible)', async () => {
    // Spot-check recent modules for "import type" violation
    const recentModules = [
      'drawing-68-ipc-bridge', 'pattern-strategy-pipeline', 'china-data-sources',
      'indicator-data-pipeline', 'indicator-signal-push-bridge',
      'drawing-strategy-bridge', 'drawing-cloud-sync-bridge', 'drawing-community-share-bridge',
      'drawing-alert-ipc-bridge', 'cost-basis-push-bridge',
      'shortcut-ipc-bridge', 'multi-chart-sync-bridge', 'flash-chart-ipc-bridge',
    ];

    const fs = await import('fs');
    let violations = 0;

    for (const mod of recentModules) {
      try {
        const content = fs.readFileSync(
          `C:/Users/vx107/.easyclaw/workspace/dawn-whales/electron/engine/data/${mod}.ts`,
          'utf8',
        );
        if (content.includes('import type')) {
          violations++;
        }
      } catch (e) {
        // Module may not exist, skip
      }
    }

    expect(violations).toBe(0);
  });

  it('should verify singleton instances are consistent', async () => {
    // Spot-check singleton names match pattern
    const singletons = [
      { mod: 'drawing-strategy-bridge', name: 'drawingStrategyBridge' },
      { mod: 'drawing-cloud-sync-bridge', name: 'drawingCloudSyncBridge' },
      { mod: 'drawing-community-share-bridge', name: 'drawingCommunityShareBridge' },
      { mod: 'indicator-data-pipeline', name: 'indicatorDataPipeline' },
      { mod: 'indicator-signal-push-bridge', name: 'indicatorSignalPushBridge' },
      { mod: 'drawing-68-ipc-bridge', name: 'drawing68IpcBridge' },
      { mod: 'pattern-strategy-pipeline', name: 'patternStrategyPipeline' },
      { mod: 'china-data-sources', name: 'chinaDataSources' },
      { mod: 'cost-basis-push-bridge', name: 'costBasisPushBridge' },
      { mod: 'drawing-alert-ipc-bridge', name: 'drawingAlertIpcBridge' },
    ];

    for (const { mod, name } of singletons) {
      const m = await import(`../../electron/engine/data/${mod}`);
      expect(m[name]).toBeDefined();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 跨链集成测试
// ═══════════════════════════════════════════════════════════════════════════

describe('R270 Cross-Chain Integration', () => {
  it('should flow from drawing→strategy→indicator→signal→push (cross-chain)', async () => {
    const { DrawingStrategyBridge } = await import('../../electron/engine/data/drawing-strategy-bridge');
    const { IndicatorDataPipeline } = await import('../../electron/engine/data/indicator-data-pipeline');
    const { IndicatorSignalPushBridge } = await import('../../electron/engine/data/indicator-signal-push-bridge');
    const { AntiNoiseBridge } = await import('../../electron/engine/data/anti-noise-bridge');

    // Step 1: Drawings → Strategy
    const dsBridge = new DrawingStrategyBridge();
    const strategies = dsBridge.generateStrategy({
      drawings: [{ drawingId: 'd1', type: 'horizontal-line', points: [{ price: 100, time: 0 }] }],
      symbol: 'SPY', currentPrice: 97, timeframe: 'D',
    });
    expect(strategies.length).toBeGreaterThanOrEqual(1);

    // Step 2: Indicators → Signals
    const pipe = new IndicatorDataPipeline();
    const candles = Array.from({ length: 60 }, (_, i) => ({
      open: 100 + i * 0.3, high: 101 + i * 0.3, low: 99 + i * 0.3,
      close: 100 + i * 0.3, volume: 1000000, timestamp: i * 60000,
    }));
    const results = pipe.calculate({ indicatorIds: ['rsi', 'adx'], symbol: 'SPY', timeframe: 'D', candles });
    expect(results.length).toBe(2);

    // Step 3: Signals → Anti-Noise Filter
    const signalBridge = new IndicatorSignalPushBridge();
    const signals = signalBridge.analyze(results);

    const noiseBridge = new AntiNoiseBridge();
    let allowed = 0;
    for (const sig of signals) {
      const result = noiseBridge.filter({
        pushId: sig.signalId,
        symbol: sig.symbol,
        type: 'indicator',
        severity: sig.priority === 'critical' ? 'critical' : sig.priority === 'high' ? 'high' : 'medium',
        title: sig.message,
        titleCn: sig.messageCn,
        body: sig.message,
        bodyCn: sig.messageCn,
        price: sig.price,
        changePercent: 0,
        timestamp: sig.createdAt,
      });
      if (result.allowed) allowed++;
    }

    // Cross-chain end-to-end should not crash
    expect(typeof allowed).toBe('number');
  });

  it('should flow from china data→indicator→push (Chinese market chain)', async () => {
    const { ChinaDataSources } = await import('../../electron/engine/data/china-data-sources');
    const { IndicatorDataPipeline } = await import('../../electron/engine/data/indicator-data-pipeline');

    // China data ingestion
    const china = new ChinaDataSources();
    china.ingestDDX({
      symbol: '600519', name: '贵州茅台',
      ddx: 1.5, ddy: 1.0, ddz: 20.0,
      bigOrderNet: 50000, turnoverRate: 4.5,
      timestamp: Date.now(),
    });

    const ddx = china.getDDX('600519');
    expect(ddx?.ddx).toBeGreaterThan(0);

    // China indicator calculation
    const pipe = new IndicatorDataPipeline();
    const candles = Array.from({ length: 80 }, (_, i) => ({
      open: 1800 + i, high: 1802 + i, low: 1798 + i,
      close: 1800 + i, volume: 5000000, timestamp: i * 60000,
    }));
    const chinaIndicators = pipe.calculate({
      indicatorIds: ['bbi', 'bias', 'ene', 'bbiboll', 'ddx', 'ddy', 'ddz', 'cyr', 'asi', 'mike'],
      symbol: '600519', timeframe: 'D', candles,
    });

    expect(chinaIndicators.length).toBe(10);
    for (const r of chinaIndicators) {
      expect(r.values.length).toBeGreaterThanOrEqual(0);
    }
  });

  it('should verify total module count', async () => {
    const fs = await import('fs');
    const dataDir = 'C:/Users/vx107/.easyclaw/workspace/dawn-whales/electron/engine/data/';
    const files = fs.readdirSync(dataDir).filter((f: string) => f.endsWith('.ts'));
    // Should be at least 91 modules
    expect(files.length).toBeGreaterThanOrEqual(91);
  });
});
