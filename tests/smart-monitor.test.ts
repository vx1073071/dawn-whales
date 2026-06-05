// ── Unit Tests — JVS-107: Smart Monitor ─────────────────────────────────────
// Run: npx tsx tests/smart-monitor.test.ts

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    passed++;
  } else {
    console.error(`  ❌ ${message}`);
    failed++;
  }
}

function section(name: string) {
  console.log(`\n━━━ ${name} ━━━`);
}

// ── Inline SmartMonitor (no electron dependency) ──────────────────────────
// Minimal reimplementation for testing core logic

type AlertLevel = 'info' | 'warning' | 'critical';
type AlertSource = 'market' | 'risk' | 'system' | 'strategy' | 'broker' | 'data';
type AlertStatus = 'active' | 'acknowledged' | 'resolved' | 'suppressed';

interface SmartAlert {
  id: string;
  level: AlertLevel;
  source: AlertSource;
  category: string;
  title: string;
  message: string;
  data?: Record<string, any>;
  status: AlertStatus;
  createdAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  ttl?: number;
  dedupeKey?: string;
  relatedEntityId?: string;
}

class TestMonitor {
  alerts: SmartAlert[] = [];
  private lastAlertTimes: Map<string, number> = new Map();
  private alertCounts: Map<string, number[]> = new Map();

  emitAlert(input: Omit<SmartAlert, 'id' | 'status' | 'createdAt' | 'dedupeKey'> & { cooldownSeconds?: number; maxPerHour?: number }): SmartAlert | null {
    const dedupeKey = `${input.source}:${input.category}:${input.relatedEntityId || 'global'}`;

    // Cooldown check
    const lastTime = this.lastAlertTimes.get(dedupeKey);
    const cooldown = input.cooldownSeconds !== undefined ? input.cooldownSeconds : 60;
    if (lastTime && (Date.now() - lastTime) / 1000 < cooldown) {
      return null;
    }

    // Rate limit check
    const ruleId = `rule-${input.source}-${input.category}`;
    const now = Date.now();
    const hourAgo = now - 3600000;
    const recentCounts = (this.alertCounts.get(ruleId) || []).filter(t => t > hourAgo);
    const maxPerHour = input.maxPerHour !== undefined ? input.maxPerHour : 30;
    if (recentCounts.length >= maxPerHour) return null;

    const alert: SmartAlert = {
      id: `alert-${now}-${Math.random().toString(36).slice(2, 8)}`,
      level: input.level,
      source: input.source,
      category: input.category,
      title: input.title,
      message: input.message,
      data: input.data,
      status: 'active',
      createdAt: new Date().toISOString(),
      ttl: input.ttl,
      dedupeKey,
      relatedEntityId: input.relatedEntityId,
    };

    this.alerts.unshift(alert);
    this.lastAlertTimes.set(dedupeKey, now);
    this.alertCounts.set(ruleId, [...recentCounts, now]);

    return alert;
  }

  acknowledge(alertId: string): SmartAlert | null {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert && alert.status === 'active') {
      alert.status = 'acknowledged';
      alert.acknowledgedAt = new Date().toISOString();
      return alert;
    }
    return null;
  }

  acknowledgeAll(level?: AlertLevel): number {
    let count = 0;
    for (const a of this.alerts) {
      if (a.status === 'active' && (!level || a.level === level)) {
        a.status = 'acknowledged';
        a.acknowledgedAt = new Date().toISOString();
        count++;
      }
    }
    return count;
  }

  resolve(alertId: string): SmartAlert | null {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert && (alert.status === 'active' || alert.status === 'acknowledged')) {
      alert.status = 'resolved';
      alert.resolvedAt = new Date().toISOString();
      return alert;
    }
    return null;
  }

  resolveByEntity(entityId: string): number {
    let count = 0;
    for (const a of this.alerts) {
      if (a.relatedEntityId === entityId && (a.status === 'active' || a.status === 'acknowledged')) {
        a.status = 'resolved';
        a.resolvedAt = new Date().toISOString();
        count++;
      }
    }
    return count;
  }

  getActive(): SmartAlert[] {
    return this.alerts.filter(a => a.status === 'active');
  }

  getCritical(): SmartAlert[] {
    return this.alerts.filter(a => a.level === 'critical' && a.status === 'active');
  }

  query(q: { level?: AlertLevel; source?: AlertSource; status?: AlertStatus; limit?: number } = {}): SmartAlert[] {
    let results = this.alerts;
    if (q.level) results = results.filter(a => a.level === q.level);
    if (q.source) results = results.filter(a => a.source === q.source);
    if (q.status) results = results.filter(a => a.status === q.status);
    return results.slice(0, q.limit || 100);
  }

  getStats() {
    const stats = {
      total: this.alerts.length,
      active: this.alerts.filter(a => a.status === 'active').length,
      acknowledged: this.alerts.filter(a => a.status === 'acknowledged').length,
      resolved: this.alerts.filter(a => a.status === 'resolved').length,
      byLevel: { info: 0, warning: 0, critical: 0 } as Record<string, number>,
    };
    for (const a of this.alerts) stats.byLevel[a.level]++;
    return stats;
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────

section('SmartMonitor — Alert Creation');
{
  const m = new TestMonitor();
  const alert = m.emitAlert({
    level: 'warning',
    source: 'market',
    category: 'price_anomaly',
    title: 'TQQQ 价格急涨 6.5%',
    message: 'TQQQ 在 5 分钟内上涨 6.5%',
    relatedEntityId: 'US.TQQQ',
    cooldownSeconds: 0,
  });

  assert(alert !== null, 'alert should be created');
  assert(alert!.level === 'warning', 'level is warning');
  assert(alert!.source === 'market', 'source is market');
  assert(alert!.status === 'active', 'status is active');
  assert(alert!.relatedEntityId === 'US.TQQQ', 'entity ID preserved');
  assert(m.alerts.length === 1, 'monitor has 1 alert');
}

section('SmartMonitor — Cooldown');
{
  const m = new TestMonitor();

  const a1 = m.emitAlert({
    level: 'warning', source: 'market', category: 'price_anomaly',
    title: 'Test 1', message: 'Test 1', relatedEntityId: 'US.TQQQ',
    cooldownSeconds: 60,
  });
  assert(a1 !== null, 'first alert should succeed');

  const a2 = m.emitAlert({
    level: 'warning', source: 'market', category: 'price_anomaly',
    title: 'Test 2', message: 'Test 2', relatedEntityId: 'US.TQQQ',
    cooldownSeconds: 60,
  });
  assert(a2 === null, 'second alert within cooldown should be suppressed');

  // Different entity should not be affected
  const a3 = m.emitAlert({
    level: 'warning', source: 'market', category: 'price_anomaly',
    title: 'Test 3', message: 'Test 3', relatedEntityId: 'US.AAPL',
    cooldownSeconds: 60,
  });
  assert(a3 !== null, 'different entity should not be affected by cooldown');
}

section('SmartMonitor — Rate Limit');
{
  const m = new TestMonitor();

  for (let i = 0; i < 3; i++) {
    m.emitAlert({
      level: 'info', source: 'strategy', category: 'trade_signal',
      title: `Signal ${i}`, message: `Signal ${i}`,
      cooldownSeconds: 0, maxPerHour: 3,
    });
  }
  assert(m.alerts.length === 3, '3 alerts within limit');

  const a4 = m.emitAlert({
    level: 'info', source: 'strategy', category: 'trade_signal',
    title: 'Signal 4', message: 'Signal 4',
    cooldownSeconds: 0, maxPerHour: 3,
  });
  assert(a4 === null, '4th alert should be rate limited');
}

section('SmartMonitor — Acknowledge');
{
  const m = new TestMonitor();
  const a = m.emitAlert({
    level: 'critical', source: 'risk', category: 'drawdown',
    title: 'Drawdown', message: 'Drawdown 12%',
    cooldownSeconds: 0,
  });

  assert(m.getActive().length === 1, '1 active before ack');

  m.acknowledge(a!.id);
  assert(m.getActive().length === 0, '0 active after ack');
  assert(m.alerts[0].status === 'acknowledged', 'status changed to acknowledged');
  assert(m.alerts[0].acknowledgedAt !== undefined, 'acknowledgedAt set');
}

section('SmartMonitor — Acknowledge All');
{
  const m = new TestMonitor();
  m.emitAlert({ level: 'warning', source: 'market', category: 'c1', title: 'A', message: 'A', cooldownSeconds: 0 });
  m.emitAlert({ level: 'warning', source: 'market', category: 'c2', title: 'B', message: 'B', cooldownSeconds: 0 });
  m.emitAlert({ level: 'critical', source: 'risk', category: 'c3', title: 'C', message: 'C', cooldownSeconds: 0 });

  const count = m.acknowledgeAll('warning');
  assert(count === 2, 'acknowledged 2 warning alerts');
  assert(m.getActive().length === 1, '1 critical still active');
}

section('SmartMonitor — Resolve');
{
  const m = new TestMonitor();
  const a = m.emitAlert({
    level: 'warning', source: 'system', category: 'connection',
    title: 'Disconnected', message: 'OpenD disconnected',
    relatedEntityId: 'OpenD', cooldownSeconds: 0,
  });

  m.resolve(a!.id);
  assert(m.alerts[0].status === 'resolved', 'status changed to resolved');
  assert(m.alerts[0].resolvedAt !== undefined, 'resolvedAt set');
}

section('SmartMonitor — Resolve By Entity');
{
  const m = new TestMonitor();
  m.emitAlert({ level: 'critical', source: 'system', category: 'connection', title: 'Disc1', message: '1', relatedEntityId: 'OpenD', cooldownSeconds: 0 });
  m.emitAlert({ level: 'warning', source: 'system', category: 'connection', title: 'Disc2', message: '2', relatedEntityId: 'OpenD', cooldownSeconds: 0 });
  m.emitAlert({ level: 'warning', source: 'market', category: 'price_anomaly', title: 'Price', message: '3', relatedEntityId: 'US.TQQQ', cooldownSeconds: 0 });

  const count = m.resolveByEntity('OpenD');
  assert(count === 2, 'resolved 2 OpenD alerts');
  assert(m.getActive().length === 1, 'TQQQ alert still active');
}

section('SmartMonitor — Query');
{
  const m = new TestMonitor();
  m.emitAlert({ level: 'warning', source: 'market', category: 'price_anomaly', title: 'W1', message: '1', cooldownSeconds: 0 });
  m.emitAlert({ level: 'critical', source: 'risk', category: 'drawdown', title: 'C1', message: '2', cooldownSeconds: 0 });
  m.emitAlert({ level: 'info', source: 'strategy', category: 'trade_signal', title: 'I1', message: '3', cooldownSeconds: 0 });

  const warnings = m.query({ level: 'warning' });
  assert(warnings.length === 1, 'query warnings returns 1');

  const critical = m.query({ level: 'critical' });
  assert(critical.length === 1, 'query critical returns 1');

  const marketAlerts = m.query({ source: 'market' });
  assert(marketAlerts.length === 1, 'query market source returns 1');

  const limited = m.query({ limit: 2 });
  assert(limited.length === 2, 'query with limit returns 2');
}

section('SmartMonitor — Stats');
{
  const m = new TestMonitor();
  m.emitAlert({ level: 'warning', source: 'market', category: 'c1', title: '1', message: '1', cooldownSeconds: 0 });
  m.emitAlert({ level: 'critical', source: 'risk', category: 'c2', title: '2', message: '2', cooldownSeconds: 0 });
  m.emitAlert({ level: 'info', source: 'strategy', category: 'c3', title: '3', message: '3', cooldownSeconds: 0 });
  m.acknowledge(m.alerts[0].id);

  const stats = m.getStats();
  assert(stats.total === 3, 'total is 3');
  assert(stats.active === 2, 'active is 2');
  assert(stats.acknowledged === 1, 'acknowledged is 1');
  assert(stats.byLevel.warning === 1, 'warning count is 1');
  assert(stats.byLevel.critical === 1, 'critical count is 1');
  assert(stats.byLevel.info === 1, 'info count is 1');
}

section('SmartMonitor — Get Critical');
{
  const m = new TestMonitor();
  m.emitAlert({ level: 'critical', source: 'risk', category: 'drawdown', title: 'Crit1', message: '1', cooldownSeconds: 0 });
  m.emitAlert({ level: 'warning', source: 'market', category: 'price_anomaly', title: 'Warn1', message: '2', cooldownSeconds: 0 });
  m.emitAlert({ level: 'critical', source: 'system', category: 'connection', title: 'Crit2', message: '3', cooldownSeconds: 0 });

  const crits = m.getCritical();
  assert(crits.length === 2, '2 critical active alerts');
  assert(crits.every(a => a.level === 'critical'), 'all are critical');
  assert(crits.every(a => a.status === 'active'), 'all are active');
}

section('SmartMonitor — Price Change Check');
{
  const m = new TestMonitor();

  // Simulate price surge
  const changePct = ((53 - 50) / 50) * 100;
  assert(changePct === 6, 'price change is 6%');

  if (changePct >= 5) {
    m.emitAlert({
      level: 'warning', source: 'market', category: 'price_anomaly',
      title: `TQQQ 价格急涨 ${changePct.toFixed(2)}%`,
      message: `TQQQ 在 5 分钟内上涨 ${changePct.toFixed(2)}%`,
      data: { symbol: 'US.TQQQ', changePct },
      relatedEntityId: 'US.TQQQ',
      cooldownSeconds: 0,
    });
  }

  assert(m.alerts.length === 1, 'surge alert created');
  assert(m.alerts[0].level === 'warning', 'surge is warning level');
}

// ── Summary ────────────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(50)}`);
console.log(`  Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(`${'═'.repeat(50)}`);

if (failed > 0) process.exit(1);
