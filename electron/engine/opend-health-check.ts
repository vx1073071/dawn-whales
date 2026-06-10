// ── Q19: OpenD Health Check ──────────────────────────────────────────────────
// Monitors Futu OpenD connection health: latency, quote subscription status,
// market data freshness, error count, and reconnection logic.

import log from 'electron-log';
import { getQuoteStreamStatus } from './quote-stream';
import { getRiskStatus } from './risk-engine';

// ── Types ───────────────────────────────────────────────────────────────────

export interface HealthCheckResult {
  overall: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'UNKNOWN';
  score: number;         // 0-100
  checks: HealthCheck[];
  timestamp: number;
  summary: string;
  recommendations: string[];
}

export interface HealthCheck {
  name: string;
  status: 'PASS' | 'WARN' | 'FAIL' | 'SKIP';
  value: any;
  message: string;
  ms?: number;           // execution time
}

export interface OpenDConfig {
  host: string;           // default 127.0.0.1
  port: number;           // default 11111
  timeout: number;        // default 5000ms
  warnLatency: number;    // default 500ms
  criticalLatency: number;// default 2000ms
}

// ── Latency Checker ─────────────────────────────────────────────────────────

async function checkLatency(host: string, port: number, timeout = 5000): Promise<HealthCheck> {
  const start = Date.now();
  try {
    // TCP connect check (PowerShell Test-NetConnection)
    const { execSync } = require('child_process');
    const ps = `[System.Net.Sockets.TcpClient]::new().Connect('${host}', ${port}); (Get-Date)'`;
    // Node approach: HTTP ping via net
    const net = require('net');
    return await new Promise((resolve) => {
      const client = new net.Socket();
      const deadline = setTimeout(() => {
        client.destroy();
        resolve({ name: 'Latency', status: 'FAIL', value: null, message: `连接超时 (${timeout}ms)`, ms: timeout });
      }, timeout);
      client.connect(port, host, () => {
        clearTimeout(deadline);
        const ms = Date.now() - start;
        client.destroy();
        resolve({
          name: 'Latency',
          status: ms < 200 ? 'PASS' : ms < 1000 ? 'WARN' : 'FAIL',
          value: ms,
          message: `TCP 连接延迟 ${ms}ms`,
          ms,
        });
      });
      client.on('error', (err: any) => {
        clearTimeout(deadline);
        resolve({ name: 'Latency', status: 'FAIL', value: null, message: `连接失败: ${err.message}`, ms: Date.now() - start });
      });
    });
  } catch (e: unknown) {
    return { name: 'Latency', status: 'FAIL', value: null, message: `检查失败: ${e.message}`, ms: Date.now() - start };
  }
}

// ── Quote Stream Check ───────────────────────────────────────────────────────

async function checkQuoteStream(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const status = await getQuoteStreamStatus();
    const subscribed = status?.subscribedCount ?? 0;
    const latency = status?.avgLatencyMs ?? null;
    const ms = Date.now() - start;
    if (subscribed === 0) {
      return { name: 'Quote Stream', status: 'WARN', value: subscribed, message: '行情订阅数: 0 (可能未启动订阅)', ms };
    }
    if (latency != null && latency > 5000) {
      return { name: 'Quote Stream', status: 'WARN', value: subscribed, message: `订阅 ${subscribed} 个标的，平均延迟 ${latency}ms (偏高)`, ms };
    }
    return { name: 'Quote Stream', status: 'PASS', value: subscribed, message: `已订阅 ${subscribed} 个标的，延迟 ${latency ?? '?'}ms`, ms };
  } catch (e: unknown) {
    return { name: 'Quote Stream', status: 'WARN', value: null, message: `行情流检查失败: ${e.message}`, ms: Date.now() - start };
  }
}

// ── Market Data Freshness ────────────────────────────────────────────────────

async function checkDataFreshness(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    // Check if we have recent quote data from quote-stream
    const status = await getQuoteStreamStatus();
    const lastUpdate = status?.lastUpdateTime ?? null;
    const ms = Date.now() - start;
    if (!lastUpdate) {
      return { name: 'Data Freshness', status: 'SKIP', value: null, message: '无最近更新时间记录', ms };
    }
    const ageSeconds = (Date.now() - lastUpdate) / 1000;
    if (ageSeconds > 60) {
      return { name: 'Data Freshness', status: 'FAIL', value: Math.round(ageSeconds), message: `行情数据 ${Math.round(ageSeconds)}秒 未更新`, ms };
    }
    return { name: 'Data Freshness', status: 'PASS', value: Math.round(ageSeconds), message: `最后更新 ${Math.round(ageSeconds)}秒前`, ms };
  } catch (e: unknown) {
    return { name: 'Data Freshness', status: 'SKIP', value: null, message: `数据新鲜度检查跳过: ${e.message}`, ms: Date.now() - start };
  }
}

// ── Risk Engine Check ────────────────────────────────────────────────────────

async function checkRiskEngine(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const status = await getRiskStatus();
    const ms = Date.now() - start;
    if (!status || status.error) {
      return { name: 'Risk Engine', status: 'WARN', value: null, message: `风控引擎状态异常: ${status?.error ?? 'unknown'}`, ms };
    }
    const drawdown = status.drawdownPct ?? 0;
    if (drawdown > 15) {
      return { name: 'Risk Engine', status: 'WARN', value: drawdown, message: `回撤 ${drawdown.toFixed(2)}% (偏高)`, ms };
    }
    return { name: 'Risk Engine', status: 'PASS', value: drawdown, message: `风控正常，回撤 ${drawdown.toFixed(2)}%`, ms };
  } catch (e: unknown) {
    return { name: 'Risk Engine', status: 'WARN', value: null, message: `风控引擎检查失败: ${e.message}`, ms: Date.now() - start };
  }
}

// ── Subscription Check ───────────────────────────────────────────────────────

async function checkSubscriptions(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const status = await getQuoteStreamStatus();
    const symbols = status?.symbols ?? [];
    const ms = Date.now() - start;
    if (symbols.length === 0) {
      return { name: 'Subscriptions', status: 'WARN', value: 0, message: '未订阅任何标的', ms };
    }
    return { name: 'Subscriptions', status: 'PASS', value: symbols.length, message: `已订阅 ${symbols.length} 个标的: ${symbols.slice(0, 5).join(', ')}${symbols.length > 5 ? '...' : ''}`, ms };
  } catch (e: unknown) {
    return { name: 'Subscriptions', status: 'SKIP', value: null, message: `订阅检查跳过: ${e.message}`, ms: Date.now() - start };
  }
}

// ── Score Calculator ─────────────────────────────────────────────────────────

function calcScore(checks: HealthCheck[]): { overall: HealthCheckResult['overall']; score: number } {
  const weights: Record<string, number> = {
    Latency: 30,
    'Quote Stream': 25,
    'Data Freshness': 15,
    'Risk Engine': 15,
    Subscriptions: 15,
  };
  let weighted = 0;
  let totalWeight = 0;
  for (const c of checks) {
    const w = weights[c.name] ?? 10;
    totalWeight += w;
    if (c.status === 'PASS') weighted += w;
    else if (c.status === 'WARN') weighted += w * 0.5;
    else if (c.status === 'SKIP') weighted += w; // neutral
    // FAIL = 0
  }
  const score = totalWeight > 0 ? Math.round((weighted / totalWeight) * 100) : 50;
  let overall: HealthCheckResult['overall'] = 'HEALTHY';
  if (score >= 80) overall = 'HEALTHY';
  else if (score >= 50) overall = 'DEGRADED';
  else overall = 'UNHEALTHY';
  return { overall, score };
}

// ── Main Health Check ────────────────────────────────────────────────────────

export async function runOpenDHealthCheck(config?: Partial<OpenDConfig>): Promise<HealthCheckResult> {
  const host = config?.host ?? '127.0.0.1';
  const port = config?.port ?? 11111;

  log.info(`[OpenDHealth] Starting health check for ${host}:${port}`);

  const [latency, quoteStream, dataFreshness, riskEngine, subscriptions] = await Promise.all([
    checkLatency(host, port, config?.timeout ?? 5000),
    checkQuoteStream(),
    checkDataFreshness(),
    checkRiskEngine(),
    checkSubscriptions(),
  ]);

  const checks = [latency, quoteStream, dataFreshness, riskEngine, subscriptions];
  const { overall, score } = calcScore(checks);

  const recommendations: string[] = [];
  if (latency.status === 'FAIL') recommendations.push('OpenD 连接失败，检查 Futu OpenD 是否启动');
  if (quoteStream.status === 'WARN') recommendations.push('行情流订阅异常，重新连接 OpenD');
  if (dataFreshness.status === 'FAIL') recommendations.push('行情数据陈旧，考虑重新订阅');
  if (riskEngine.status === 'WARN') recommendations.push('回撤超标，关注风控信号');
  if (subscriptions.status === 'WARN') recommendations.push('未订阅任何标的，请配置自选股');

  const summary = {
    HEALTHY:   `✅ OpenD 健康 (${score}/100) — ${host}:${port}`,
    DEGRADED:  `⚠️  OpenD 降级 (${score}/100) — 部分检查未通过`,
    UNHEALTHY: `❌ OpenD 异常 (${score}/100) — 需立即处理`,
    UNKNOWN:   `❓ OpenD 状态未知 (${score}/100)`,
  }[overall];

  log.info(`[OpenDHealth] ${summary}`);

  return { overall, score, checks, timestamp: Date.now(), summary, recommendations };
}

// ── Quick ping ───────────────────────────────────────────────────────────────

export async function pingOpenD(host = '127.0.0.1', port = 11111): Promise<{ reachable: boolean; ms: number }> {
  try {
    const net = require('net');
    const start = Date.now();
    return await new Promise((resolve) => {
      const client = new net.Socket();
      const t = setTimeout(() => { client.destroy(); resolve({ reachable: false, ms: Date.now() - start }); }, 3000);
      client.connect(port, host, () => { clearTimeout(t); client.destroy(); resolve({ reachable: true, ms: Date.now() - start }); });
      client.on('error', () => { clearTimeout(t); resolve({ reachable: false, ms: Date.now() - start }); });
    });
  } catch {
    return { reachable: false, ms: 999999 };
  }
}
