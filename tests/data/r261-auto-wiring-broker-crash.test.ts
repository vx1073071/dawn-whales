/**
 * R261 autoclaw 综合测试 — 管线接线 + broker报价优先级 + 崩盘推送接线
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { PipelineWiringBridge, pipelineWiringBridge } from '../../electron/engine/data/pipeline-wiring-bridge';
import { BrokerQuotePriorityDetector, brokerQuotePriorityDetector } from '../../electron/engine/data/broker-quote-priority-detector';
import { CrashAlertWiring, crashAlertWiring } from '../../electron/engine/data/crash-alert-wiring';

// ═══════════════════════════════════════════════════════════════════════════
// P0-02: PipelineWiringBridge 测试
// ═══════════════════════════════════════════════════════════════════════════

describe('R261 P0-02 PipelineWiringBridge', () => {
  let bridge: PipelineWiringBridge;
  beforeEach(() => { bridge = new PipelineWiringBridge(); });

  describe('topology', () => {
    it('should have 16 pipeline nodes', () => {
      const topo = bridge.getTopology();
      expect(topo.nodes.length).toBe(16);
    });

    it('should have correct upstream/downstream links', () => {
      const agg = bridge.getNode('n_agg');
      expect(agg).not.toBeNull();
      expect(agg!.upstream).toContain('n_yahoo');
      expect(agg!.downstream).toContain('n_dedup');
    });

    it('should route from data source to IPC', () => {
      bridge.wireAll();
      const route = bridge.getRoute('yahoo_engine', 'ipc_bridge');
      expect(route).not.toBeNull();
      expect(route!.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('wiring', () => {
    it('should wire all edges', () => {
      const result = bridge.wireAll();
      expect(result.nodes).toBe(16);
      expect(result.edges).toBeGreaterThan(0);
      expect(bridge.isWired()).toBe(true);
    });

    it('should verify all 15 checkpoints after wiring', () => {
      bridge.wireAll();
      const checkpoints = bridge.verifyWiring();
      expect(checkpoints.length).toBe(15);
    });
  });

  describe('data flow', () => {
    it('should process a packet through the pipeline', () => {
      bridge.wireAll();
      const packet = bridge.processPacket('quote', 'yahoo_engine', 'ipc_bridge', { symbol: 'AAPL', price: 185.50 });

      expect(packet.packetId).toMatch(/^pkt:quote:/);
      expect(packet.hops.length).toBeGreaterThanOrEqual(3);
      expect(packet.deliveredAt).toBeDefined();
      expect(packet.latencyMs).toBeDefined();
    });

    it('should simulate quote flow and deliver', () => {
      bridge.wireAll();
      const packet = bridge.simulateQuoteFlow('TSLA', 250);

      expect(packet).not.toBeNull();
      if (packet) {
        expect(packet.type).toBe('quote');
        expect(packet.hops).toContain('aggregator');
      }
    });

    it('should track pipeline stats', () => {
      bridge.wireAll();
      bridge.processPacket('alert', 'alert_engine', 'push_bridge', { symbol: 'AAPL', change: -5 });
      bridge.processPacket('alert', 'alert_engine', 'push_bridge', { symbol: 'MSFT', change: 3 });

      const stats = bridge.getStats();
      expect(stats.totalPackets).toBe(2);
      expect(stats.droppedPackets).toBe(0);
    });

    it('should drop packets when no route exists', () => {
      bridge.wireAll();
      // Route community_bridge → tray_bridge — community has no path to tray directly (not wired)
      // Actually community_bridge has downstream=['n_push'] but n_push is push_bridge, not type 'community_bridge'
      // Let me use a route that doesn't exist
      const packet = bridge.processPacket('rotation', 'community_bridge', 'short_selling', {});
      expect(packet.deliveredAt).toBeUndefined();
    });
  });

  describe('node health', () => {
    it('should update node health', () => {
      bridge.wireAll();
      bridge.updateNodeHealth('n_yahoo', false, 5000, 0.15);

      const node = bridge.getNode('n_yahoo');
      expect(node?.healthy).toBe(false);
      expect(node?.latencyMs).toBe(5000);
    });
  });

  describe('reports', () => {
    it('should generate wiring report', () => {
      bridge.wireAll();
      bridge.simulateQuoteFlow('AAPL', 185);

      const report = bridge.generateReport();
      expect(report.totalNodes).toBe(16);
      expect(report.totalEdges).toBeGreaterThan(0);
      expect(report.summaryEn).not.toBe('');
    });
  });

  describe('singleton', () => {
    it('should have prebuilt instance', () => {
      const stats = pipelineWiringBridge.getStats();
      expect(typeof stats.totalPackets).toBe('number');
      pipelineWiringBridge.reset();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// BrokerQuotePriorityDetector 测试
// ═══════════════════════════════════════════════════════════════════════════

describe('R261 BrokerQuotePriorityDetector', () => {
  let detector: BrokerQuotePriorityDetector;
  beforeEach(() => { detector = new BrokerQuotePriorityDetector(); });

  describe('broker detection', () => {
    it('should initially have no connected brokers', () => {
      const connected = detector.detectConnectedBrokers();
      expect(connected.length).toBe(0);
    });

    it('should detect connected brokers after setting status', () => {
      detector.setBrokerStatus('yahoo_finance', true, 150, 10);
      detector.setBrokerStatus('futu', true, 300, 5);

      const connected = detector.detectConnectedBrokers();
      expect(connected).toContain('yahoo_finance');
      expect(connected).toContain('futu');
    });

    it('should assign priority scores based on metrics', () => {
      detector.setBrokerStatus('yahoo_finance', true, 100, 10);
      detector.setBrokerStatus('interactive_brokers', true, 500, 3);

      const yahoo = detector.getConnection('yahoo_finance');
      const ib = detector.getConnection('interactive_brokers');
      expect(yahoo?.priorityScore).toBeGreaterThan(ib?.priorityScore ?? 0);
    });
  });

  describe('quote processing', () => {
    it('should submit and aggregate quotes', () => {
      detector.setBrokerStatus('yahoo_finance', true, 150, 10);
      detector.setBrokerStatus('futu', true, 300, 5);

      detector.submitQuote({ brokerId: 'yahoo_finance', symbol: 'AAPL', bid: 185.00, ask: 185.10, bidSize: 1000, askSize: 800, lastPrice: 185.05, latencyMs: 150 });
      detector.submitQuote({ brokerId: 'futu', symbol: 'AAPL', bid: 184.95, ask: 185.08, bidSize: 500, askSize: 600, lastPrice: 185.02, latencyMs: 300 });

      const quotes = detector.getQuotes('AAPL');
      expect(quotes.length).toBe(2);
    });

    it('should mark stale quotes', () => {
      detector.setBrokerStatus('yahoo_finance', true, 150, 10);
      detector.submitQuote({ brokerId: 'yahoo_finance', symbol: 'AAPL', bid: 185, ask: 185.1, bidSize: 1000, askSize: 800, lastPrice: 185.05, latencyMs: 7000 });

      const quotes = detector.getQuotes('AAPL');
      expect(quotes[0].isStale).toBe(true);
    });

    it('should aggregate best bid/ask across brokers', () => {
      detector.setBrokerStatus('yahoo_finance', true, 150, 10);
      detector.setBrokerStatus('futu', true, 300, 5);

      detector.submitQuote({ brokerId: 'yahoo_finance', symbol: 'AAPL', bid: 185.00, ask: 185.10, bidSize: 1000, askSize: 800, lastPrice: 185.05, latencyMs: 150 });
      detector.submitQuote({ brokerId: 'futu', symbol: 'AAPL', bid: 185.02, ask: 185.08, bidSize: 500, askSize: 600, lastPrice: 185.05, latencyMs: 300 });

      const agg = detector.getAggregatedQuote('AAPL');
      expect(agg).not.toBeNull();
      if (agg) {
        expect(agg.sourceCount).toBe(2);
        expect(agg.sources).toContain('yahoo_finance');
        expect(agg.sources).toContain('futu');
      }
    });
  });

  describe('best source selection', () => {
    it('should select best source by lowest latency', () => {
      detector.setBrokerStatus('yahoo_finance', true, 100, 10);
      detector.setBrokerStatus('webull', true, 800, 2);

      detector.submitQuote({ brokerId: 'yahoo_finance', symbol: 'AAPL', bid: 185, ask: 185.1, bidSize: 1000, askSize: 800, lastPrice: 185.05, latencyMs: 100 });
      detector.submitQuote({ brokerId: 'webull', symbol: 'AAPL', bid: 185, ask: 185.1, bidSize: 500, askSize: 400, lastPrice: 185.05, latencyMs: 800 });

      const best = detector.getBestSource('AAPL', 'lowest_latency');
      expect(best).toBe('yahoo_finance');
    });

    it('should select best source by composite score', () => {
      detector.setBrokerStatus('yahoo_finance', true, 100, 10);
      detector.setBrokerStatus('robinhood', true, 200, 2);

      detector.submitQuote({ brokerId: 'yahoo_finance', symbol: 'TSLA', bid: 250, ask: 250.2, bidSize: 2000, askSize: 1500, lastPrice: 250.1, latencyMs: 100 });
      detector.submitQuote({ brokerId: 'robinhood', symbol: 'TSLA', bid: 249.9, ask: 250.15, bidSize: 300, askSize: 200, lastPrice: 250.0, latencyMs: 200 });

      const best = detector.getBestSource('TSLA');
      expect(best).toBeDefined();
    });
  });

  describe('priority ranking', () => {
    it('should rank brokers by priority score', () => {
      detector.setBrokerStatus('yahoo_finance', true, 100, 10);
      detector.setBrokerStatus('binance', true, 50, 20);
      detector.setBrokerStatus('eastmoney_broker', true, 500, 2);

      const ranking = detector.getPriorityRanking();
      expect(ranking.length).toBeGreaterThanOrEqual(3);
      // Yahoo (ws + low latency + high freq) should rank high
      expect(ranking[0].brokerId).not.toBe('eastmoney_broker');
    });
  });

  describe('broker health', () => {
    it('should report health for all brokers', () => {
      detector.setBrokerStatus('yahoo_finance', true, 100, 10);
      detector.setBrokerStatus('binance', false, Infinity, 0);

      const health = detector.getBrokerHealth();
      expect(health.length).toBeGreaterThanOrEqual(2);

      const yahooHealth = health.find(h => h.brokerId === 'yahoo_finance');
      expect(yahooHealth?.status).toBe('online');

      const binanceHealth = health.find(h => h.brokerId === 'binance');
      expect(binanceHealth?.status).toBe('offline');
    });
  });

  describe('singleton', () => {
    it('should have prebuilt instance', () => {
      const stats = brokerQuotePriorityDetector.getStats();
      expect(typeof stats.totalQuotes).toBe('number');
      brokerQuotePriorityDetector.reset();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CrashAlertWiring 测试
// ═══════════════════════════════════════════════════════════════════════════

describe('R261 CrashAlertWiring', () => {
  let wiring: CrashAlertWiring;
  beforeEach(() => { wiring = new CrashAlertWiring(); });

  describe('wiring setup', () => {
    it('should wire all connections', () => {
      const conns = wiring.wire();
      expect(conns.length).toBe(3);
      expect(conns.every(c => c.status === 'active')).toBe(true);
    });

    it('should verify wiring', () => {
      wiring.wire();
      expect(wiring.verifyWiring()).toBe(true);
    });
  });

  describe('price monitoring', () => {
    it('should register and monitor symbols', () => {
      wiring.wire();
      wiring.registerMonitor('AAPL', 200);

      const monitors = wiring.getMonitors();
      expect(monitors.length).toBe(1);
      expect(monitors[0].symbol).toBe('AAPL');
    });

    it('should detect crash events from price drops', () => {
      wiring.wire();
      wiring.registerMonitor('TSLA', 300);
      const event = wiring.feedPrice('TSLA', 270); // -10%

      expect(event).not.toBeNull();
      if (event) {
        expect(event.severity).toBe('critical');
        expect(event.dropPercent).toBeCloseTo(10, 1);
        expect(event.pushLevel).toBe('holders');
      }
    });

    it('should detect emergency level crash', () => {
      wiring.wire();
      wiring.registerMonitor('NVDA', 500);
      const event = wiring.feedPrice('NVDA', 400); // -20%

      expect(event?.severity).toBe('emergency');
      expect(event?.pushLevel).toBe('all_users');
    });

    it('should return null for no significant drop', () => {
      wiring.wire();
      wiring.registerMonitor('IBM', 150);
      const event = wiring.feedPrice('IBM', 148); // -1.3%

      expect(event).toBeNull();
    });

    it('should reset baseline when price recovers', () => {
      wiring.wire();
      wiring.registerMonitor('AAPL', 200);
      wiring.feedPrice('AAPL', 201); // +0.5% — recovery

      const monitors = wiring.getMonitors();
      expect(monitors[0].dropPercent).toBe(0);
    });
  });

  describe('push dispatch', () => {
    it('should dispatch push for crash events', () => {
      wiring.wire();
      wiring.registerMonitor('AAPL', 200);
      const event = wiring.feedPrice('AAPL', 185); // -7.5%

      if (event) {
        wiring.dispatchPush(event);
        expect(event.pushDispatched).toBe(true);
        expect(event.pushLatencyMs).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('processTick', () => {
    it('should process tick end-to-end: detect + push', () => {
      wiring.wire();
      const { crash, pushed } = wiring.processTick('META', 400, 480);

      expect(crash).not.toBeNull();
      expect(pushed).toBe(true);
      if (crash) {
        expect(crash.dropPercent).toBeCloseTo(16.7, 1);
        expect(crash.severity).toBe('emergency');
      }
    });

    it('should not push for normal ticks', () => {
      wiring.wire();
      const { crash, pushed } = wiring.processTick('GOOGL', 175, 176);

      expect(crash).toBeNull();
      expect(pushed).toBe(false);
    });
  });

  describe('v-shape recovery', () => {
    it('should detect v-shape recovery after crash', () => {
      wiring.wire();
      wiring.processTick('AAPL', 170, 200);  // -15% crash
      const recovery = wiring.checkRecovery('AAPL', 185); // +50% retrace

      expect(recovery).not.toBeNull();
      expect(recovery?.recovering).toBe(true);
    });

    it('should not detect recovery for minor drops', () => {
      wiring.wire();
      wiring.processTick('IBM', 145, 150);   // -3.3% — below 5% threshold
      const recovery = wiring.checkRecovery('IBM', 146);

      expect(recovery).toBeNull();
    });
  });

  describe('reports', () => {
    it('should generate crash wiring report', () => {
      wiring.wire();
      wiring.processTick('AAPL', 180, 200);

      const report = wiring.generateReport();
      expect(report.connections.length).toBe(3);
      expect(report.totalMonitored).toBe(1);
      expect(report.summaryEn).not.toBe('');
    });
  });

  describe('severity levels', () => {
    it('should have 5 severity levels', () => {
      const levels = wiring.getSeverityLevels();
      expect(levels.length).toBe(5);
      expect(levels[0].severity).toBe('watch');
      expect(levels[4].severity).toBe('armageddon');
    });
  });

  describe('singleton', () => {
    it('should have prebuilt instance', () => {
      const stats = crashAlertWiring.getStats();
      expect(typeof stats.totalAlerts).toBe('number');
      crashAlertWiring.reset();
    });
  });
});
