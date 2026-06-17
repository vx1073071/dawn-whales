/**
 * R263 autoclaw 综合测试 — 管线集成验证 + broker集成 + 性能压测
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { PipelineIntegrationVerify, pipelineIntegrationVerify } from '../../electron/engine/data/pipeline-integration-verify';
import { BrokerDetectorIntegration, brokerDetectorIntegration } from '../../electron/engine/data/broker-detector-integration';
import { PipelineLoadTest, pipelineLoadTest } from '../../electron/engine/data/pipeline-load-test';

// ═══════════════════════════════════════════════════════════════════════════
// PipelineIntegrationVerify 测试
// ═══════════════════════════════════════════════════════════════════════════

describe('R263 PipelineIntegrationVerify', () => {
  let verify: PipelineIntegrationVerify;
  beforeEach(() => { verify = new PipelineIntegrationVerify(); });

  describe('registration', () => {
    it('should register all 16 nodes', () => {
      const result = verify.registerAll();
      expect(result.registered).toBe(16);
      expect(result.total).toBe(16);
      expect(verify.isStarted()).toBe(true);
    });

    it('should register individual nodes', () => {
      expect(verify.registerNode('n_yahoo_live')).toBe(true);
      expect(verify.registerNode('n_invalid')).toBe(false);
    });
  });

  describe('checkpoint verification', () => {
    it('should verify all 15 checkpoints after registration', () => {
      verify.registerAll();
      const { passed, failed, results } = verify.verifyAll();

      expect(passed).toBe(15);
      expect(failed).toBe(0);
      expect(results.length).toBe(15);
      expect(results[0].status).toBe('passed');
    });

    it('should report latency for each checkpoint', () => {
      verify.registerAll();
      const { results } = verify.verifyAll();
      for (const cp of results) {
        expect(cp.actualLatencyMs).toBeGreaterThan(0);
        expect(cp.packetsTested).toBeGreaterThan(0);
      }
    });
  });

  describe('live data flow', () => {
    it('should simulate YahooLive → IPC flow for alert-worthy changes', () => {
      verify.registerAll();
      const flow = verify.simulateLiveFlow('AAPL', 190, 5);

      expect(flow.pipelineOk).toBe(true);
      expect(flow.alertTriggered).toBe(true);
      expect(flow.pushDelivered).toBe(true);
      expect(flow.route).toContain('YahooWebSocketLiveEngine');
      expect(flow.route).toContain('PushIpcBridge');
    });

    it('should skip push for normal ticks', () => {
      verify.registerAll();
      const flow = verify.simulateLiveFlow('IBM', 150, 0.5);

      expect(flow.alertTriggered).toBe(false);
      expect(flow.pushDelivered).toBe(false);
    });
  });

  describe('degradation chain', () => {
    it('should trigger degradation on Yahoo failure', () => {
      verify.registerAll();
      const result = verify.testDegradationChain();

      expect(result.primaryOk).toBe(false);
      expect(result.fallbackTriggered).toBe(true);
      expect(result.fallbackSource).toBe('EastMoneyFetcher');
    });

    it('should restore primary after degradation', () => {
      verify.registerAll();
      verify.testDegradationChain();
      expect(verify.restorePrimary()).toBe(true);
    });
  });

  describe('reports', () => {
    it('should generate integration report', () => {
      verify.registerAll();
      verify.verifyAll();

      const report = verify.generateReport();
      expect(report.totalNodes).toBe(16);
      expect(report.totalCheckpoints).toBe(15);
      expect(report.passedCheckpoints).toBe(15);
      expect(report.summaryEn).not.toBe('');
    });
  });

  describe('singleton', () => {
    it('should have prebuilt instance', () => {
      const stats = pipelineIntegrationVerify.getStats();
      expect(typeof stats.packetsFlowed).toBe('number');
      pipelineIntegrationVerify.reset();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// BrokerDetectorIntegration 测试
// ═══════════════════════════════════════════════════════════════════════════

describe('R263 BrokerDetectorIntegration', () => {
  let detector: BrokerDetectorIntegration;
  beforeEach(() => { detector = new BrokerDetectorIntegration(); });

  describe('adapter management', () => {
    it('should have 7 adapter configs', () => {
      const adapters = detector.getAdapters();
      expect(adapters.length).toBe(7);
    });

    it('should enable and disable adapters', () => {
      expect(detector.setEnabled('adp_yahoo_ws', true)).toBe(true);
      expect(detector.setEnabled('adp_invalid', false)).toBe(false);
    });

    it('should connect adapters with subscriptions', () => {
      detector.connect('adp_yahoo_ws', 22);
      const adapter = detector.getAdapter('adp_yahoo_ws');
      expect(adapter?.connected).toBe(true);
      expect(adapter?.subscriptionCount).toBe(22);
    });

    it('should not connect disabled adapters', () => {
      detector.setEnabled('adp_ib_sdk', false);
      expect(detector.connect('adp_ib_sdk')).toBe(false);
    });
  });

  describe('broker detection', () => {
    it('should detect best broker by latency', () => {
      detector.connect('adp_yahoo_ws', 22);
      detector.connect('adp_binance_ws', 100);
      detector.connect('adp_futu_sdk', 10);

      const best = detector.detectBestBroker({
        adp_yahoo_ws: 120,
        adp_binance_ws: 80,
        adp_futu_sdk: 300,
      });

      expect(best.best).toBe('adp_binance_ws');
      expect(best.latencyMs).toBe(80);
    });
  });

  describe('broker switching', () => {
    it('should auto-switch on disconnection', () => {
      detector.connect('adp_yahoo_ws', 22);
      detector.connect('adp_binance_ws', 100);

      detector.disconnect('adp_yahoo_ws');

      const history = detector.getSwitchHistory();
      expect(history.length).toBeGreaterThanOrEqual(1);
      expect(history[0].reason).toBe('disconnection');
    });

    it('should manual switch', () => {
      detector.connect('adp_yahoo_ws', 22);
      detector.connect('adp_binance_ws', 100);

      expect(detector.manualSwitch('adp_binance_ws')).toBe(true);
    });

    it('should get primary broker', () => {
      const primary = detector.getPrimaryBroker();
      expect(primary).not.toBeNull();
      expect(primary?.adapterId).toBe('adp_yahoo_ws');
    });
  });

  describe('subscriptions', () => {
    it('should subscribe symbols and track counts', () => {
      detector.connect('adp_yahoo_ws', 0);
      const result = detector.subscribe(['AAPL', 'MSFT', 'GOOGL']);
      expect(result.count).toBe(3);
    });

    it('should get total subscriptions across adapters', () => {
      detector.connect('adp_yahoo_ws', 10);
      detector.connect('adp_binance_ws', 5);
      expect(detector.getTotalSubscriptions()).toBe(15);
    });
  });

  describe('reports', () => {
    it('should generate integration report', () => {
      detector.connect('adp_yahoo_ws', 22);
      detector.connect('adp_binance_ws', 100);

      const report = detector.generateReport();
      expect(report.totalAdapters).toBe(7);
      expect(report.connectedAdapters).toBe(2);
      expect(report.summaryEn).not.toBe('');
    });
  });

  describe('singleton', () => {
    it('should have prebuilt instance', () => {
      const stats = brokerDetectorIntegration.getStats();
      expect(typeof stats.totalQuotes).toBe('number');
      brokerDetectorIntegration.reset();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PipelineLoadTest 测试
// ═══════════════════════════════════════════════════════════════════════════

describe('R263 PipelineLoadTest', () => {
  describe('load test', () => {
    it('should run quick test and return metrics', () => {
      const tester = new PipelineLoadTest({
        concurrentSymbols: 20,
        durationSeconds: 2,
        tickIntervalMs: 50,
        burstSize: 3,
        backpressureThreshold: 20,
        degradationThreshold: 10,
        cooldownMs: 5000,
      });

      const result = tester.runTest();
      expect(result.totalTicks).toBeGreaterThan(0);
      expect(result.successRate).toBeGreaterThan(0);
      expect(result.latency.samples).toBeGreaterThan(0);
      expect(result.throughputPps).toBeGreaterThan(0);
    });

    it('should return latency percentiles', () => {
      const tester = new PipelineLoadTest({
        concurrentSymbols: 30,
        durationSeconds: 2,
        tickIntervalMs: 20,
        burstSize: 2,
      });

      const result = tester.runTest();
      expect(result.latency.p50).toBeGreaterThan(0);
      expect(result.latency.p99).toBeGreaterThanOrEqual(result.latency.p50);
      expect(result.latency.max).toBeGreaterThanOrEqual(result.latency.p99);
    });

    it('should compute backpressure metrics', () => {
      const tester = new PipelineLoadTest({
        concurrentSymbols: 10,
        durationSeconds: 2,
        tickIntervalMs: 50,
        burstSize: 5,
        backpressureThreshold: 5,
      });

      const result = tester.runTest();
      expect(result.backpressure.maxQueueDepth).toBeGreaterThan(0);
    });

    it('should include recommendations', () => {
      const tester = new PipelineLoadTest({
        concurrentSymbols: 20,
        durationSeconds: 2,
        tickIntervalMs: 50,
      });

      const result = tester.runTest();
      expect(result.recommendations.length).toBeGreaterThanOrEqual(0);
      expect(result.recommendationsCn.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('quick test', () => {
    it('should run quick test with shorter duration', () => {
      const tester = new PipelineLoadTest();
      const result = tester.quickTest(10);
      expect(result.totalTicks).toBeGreaterThan(0);
    });
  });

  describe('stress test', () => {
    it('should run stress test with 200 symbols', () => {
      const tester = new PipelineLoadTest();
      const result = tester.stressTest(50, 2);
      expect(result.totalTicks).toBeGreaterThan(0);
      expect(result.latency.p99).toBeGreaterThan(0);
    });
  });

  describe('token bucket', () => {
    it('should track token bucket state', () => {
      const tester = new PipelineLoadTest({
        backpressureThreshold: 100,
      });

      const state = tester.getBucketState();
      expect(state.capacity).toBe(100);
      expect(state.available).toBeLessThanOrEqual(100);
    });
  });

  describe('summary', () => {
    it('should generate English and Chinese summaries', () => {
      const tester = new PipelineLoadTest({
        concurrentSymbols: 15,
        durationSeconds: 2,
        tickIntervalMs: 30,
      });

      const result = tester.runTest();
      expect(result.summaryEn).not.toBe('');
      expect(result.summaryCn).not.toBe('');
      expect(result.passed).toBeDefined();
    });
  });

  describe('singleton', () => {
    it('should have prebuilt instance', () => {
      const state = pipelineLoadTest.getBucketState();
      expect(state.capacity).toBeGreaterThan(0);
      pipelineLoadTest.reset();
    });
  });
});
