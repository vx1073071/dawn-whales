// ── OpenD Health Monitor Data Layer (JVS-33) ──────────────────────────────
// Monitor OpenD connection status, latency, packet loss
// IPC: opd:health-status, opd:latency-check, opd:packet-stats

import log from 'electron-log';

// ── Types ──────────────────────────────────────────────────────────────────

export interface OpenDHealthStatus {
  connected: boolean;
  latency: number;          // ms
  packetLoss: number;       // 0-100%
  uptime: number;           // seconds
  lastHeartbeat: number;    // timestamp
  reconnectAttempts: number;
  status: 'healthy' | 'degraded' | 'disconnected';
}

export interface LatencyStats {
  current: number;
  avg: number;
  min: number;
  max: number;
  p95: number;
  p99: number;
}

export interface PacketStats {
  sent: number;
  received: number;
  lost: number;
  lossRate: number;         // 0-100%
  lastUpdate: number;
}

export interface OpenDHealthReport {
  status: OpenDHealthStatus;
  latency: LatencyStats;
  packets: PacketStats;
  timestamp: number;
}

// ── Health Monitor ─────────────────────────────────────────────────────────

class OpenDHealthMonitor {
  private connected: boolean = false;
  private latencyHistory: number[] = [];
  private maxHistory: number = 100;
  private lastHeartbeat: number = 0;
  private reconnectAttempts: number = 0;
  private startTime: number = 0;
  private packetStats: PacketStats = {
    sent: 0,
    received: 0,
    lost: 0,
    lossRate: 0,
    lastUpdate: Date.now(),
  };

  constructor() {
    log.info('[OpenDHealth] Initialized');
  }

  async checkConnection(): Promise<boolean> {
    // Simulate connection check
    this.connected = true;
    this.lastHeartbeat = Date.now();
    this.startTime = this.startTime || Date.now();
    return this.connected;
  }

  async measureLatency(): Promise<number> {
    // Simulate latency measurement
    const latency = Math.random() * 50 + 10; // 10-60ms
    this.latencyHistory.push(latency);
    if (this.latencyHistory.length > this.maxHistory) {
      this.latencyHistory.shift();
    }
    return latency;
  }

  getLatencyStats(): LatencyStats {
    if (this.latencyHistory.length === 0) {
      return { current: 0, avg: 0, min: 0, max: 0, p95: 0, p99: 0 };
    }

    const sorted = [...this.latencyHistory].sort((a, b) => a - b);
    const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    const p95Idx = Math.floor(sorted.length * 0.95);
    const p99Idx = Math.floor(sorted.length * 0.99);

    return {
      current: sorted[sorted.length - 1],
      avg,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p95: sorted[p95Idx],
      p99: sorted[p99Idx],
    };
  }

  getPacketStats(): PacketStats {
    return this.packetStats;
  }

  recordPacketSent(): void {
    this.packetStats.sent++;
    this.packetStats.lastUpdate = Date.now();
  }

  recordPacketReceived(): void {
    this.packetStats.received++;
    this.packetStats.lastUpdate = Date.now();
  }

  recordPacketLost(): void {
    this.packetStats.lost++;
    this.packetStats.lastUpdate = Date.now();
    this.packetStats.lossRate = (this.packetStats.lost / (this.packetStats.sent || 1)) * 100;
  }

  getStatus(): OpenDHealthStatus {
    const latencyStats = this.getLatencyStats();
    const status = !this.connected
      ? 'disconnected'
      : latencyStats.avg > 100 || this.packetStats.lossRate > 5
      ? 'degraded'
      : 'healthy';

    return {
      connected: this.connected,
      latency: latencyStats.current,
      packetLoss: this.packetStats.lossRate,
      uptime: this.startTime ? Math.floor((Date.now() - this.startTime) / 1000) : 0,
      lastHeartbeat: this.lastHeartbeat,
      reconnectAttempts: this.reconnectAttempts,
      status,
    };
  }

  async getFullReport(): Promise<OpenDHealthReport> {
    await this.checkConnection();
    await this.measureLatency();

    return {
      status: this.getStatus(),
      latency: this.getLatencyStats(),
      packets: this.getPacketStats(),
      timestamp: Date.now(),
    };
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let monitor: OpenDHealthMonitor | null = null;

export function getOpenDHealthMonitor(): OpenDHealthMonitor {
  if (!monitor) {
    monitor = new OpenDHealthMonitor();
  }
  return monitor;
}

// ── Main Functions ─────────────────────────────────────────────────────────

export async function getOpenDHealthStatus(): Promise<OpenDHealthStatus> {
  const monitor = getOpenDHealthMonitor();
  return monitor.getStatus();
}

export async function checkOpenDLatency(): Promise<LatencyStats> {
  const monitor = getOpenDHealthMonitor();
  await monitor.measureLatency();
  return monitor.getLatencyStats();
}

export async function getOpenDPacketStats(): Promise<PacketStats> {
  const monitor = getOpenDHealthMonitor();
  return monitor.getPacketStats();
}

export async function getOpenDHealthReport(): Promise<OpenDHealthReport> {
  const monitor = getOpenDHealthMonitor();
  return monitor.getFullReport();
}

export function recordOpenDPacketSent(): void {
  const monitor = getOpenDHealthMonitor();
  monitor.recordPacketSent();
}

export function recordOpenDPacketReceived(): void {
  const monitor = getOpenDHealthMonitor();
  monitor.recordPacketReceived();
}

export function recordOpenDPacketLost(): void {
  const monitor = getOpenDHealthMonitor();
  monitor.recordPacketLost();
}
