// JVS-116: WebSocket Performance Monitor Test (standalone tsx)
import { WebSocketPerformanceMonitor } from '../electron/engine/websocket-performance-monitor';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${msg}`);
  } else {
    failed++;
    console.log(`  ❌ ${msg}`);
  }
}

async function run() {
  console.log('\n━━ JVS-116: WebSocket Performance Monitor ━━');

  const mon = new WebSocketPerformanceMonitor({ enableAutoSnapshot: false });

  assert(mon.getAllMetrics().length === 0, 'init: 0 clients');

  // Track connections
  mon.trackConnection('client-1');
  mon.trackConnection('client-2');
  assert(mon.getAllMetrics().length === 2, 'trackConnection: 2 clients');

  // Update latency
  mon.updateLatency('client-1', 50);
  const m1 = mon.getClientMetrics('client-1');
  assert(m1 !== null && m1.latencyMs === 50, 'updateLatency: 50ms');

  // Track messages
  mon.trackMessageSent('client-1', 1024);
  mon.trackMessageReceived('client-1', 2048);
  const m1b = mon.getClientMetrics('client-1');
  assert(m1b!.messagesSent === 1 && m1b!.messagesReceived === 1, 'trackMessages');
  assert(m1b!.bytesTransferred === 3072, 'bytesTransferred: 3072');

  // Track errors
  mon.trackError('client-1');
  assert(mon.getClientMetrics('client-1')!.errorCount === 1, 'trackError');

  // Track reconnection
  mon.trackReconnection('client-1');
  assert(mon.getClientMetrics('client-1')!.reconnectCount === 1, 'trackReconnection');

  // High latency warning
  let warningEmitted = false;
  mon.on('latencyWarning', () => { warningEmitted = true; });
  mon.updateLatency('client-2', 1000);
  assert(warningEmitted, 'latencyWarning emitted');

  // Snapshot
  const snap = mon.takeSnapshot();
  assert(snap.totalClients === 2, 'snapshot: 2 clients');
  assert(snap.avgLatencyMs > 0, 'snapshot: avgLatency > 0');
  assert(snap.totalMessages > 0, 'snapshot: totalMessages > 0');

  // History
  assert(mon.getHistory().length === 1, 'history: 1 snapshot');

  // Summary
  const summary = mon.getSummary();
  assert(summary.totalClients === 2, 'summary: 2 clients');
  assert(summary.totalMessages > 0, 'summary: totalMessages > 0');
  assert(summary.uptimeMs > 0, 'summary: uptime > 0');

  // Disconnect
  mon.trackDisconnection('client-2');
  assert(mon.getAllMetrics().length === 1, 'disconnection: 1 client remaining');

  // Clear
  mon.clearAll();
  assert(mon.getAllMetrics().length === 0, 'clearAll: 0 clients');
  assert(mon.getHistory().length === 0, 'clearAll: 0 history');

  mon.destroy();

  console.log(`\n━━ Results: ${passed} passed, ${failed} failed ━━`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(1); });
