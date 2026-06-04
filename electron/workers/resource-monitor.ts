// ── DAWN WHALES — Resource Monitor ─────────────────────────────────────────
// Monitors system resources and adjusts worker pool size adaptively

import os from 'os';

interface ResourceSnapshot {
  timestamp: number;
  cpuUsage: number;    // 0-100%
  memoryUsage: number; // MB
  memoryTotal: number; // MB
  loadAvg: number[];
  activeWorkers: number;
  queuedTasks: number;
  uptime: number;      // seconds
}

export class ResourceMonitor {
  private history: ResourceSnapshot[] = [];
  private maxHistory = 100;
  private startTime = Date.now();
  private interval: NodeJS.Timeout | null = null;

  start(intervalMs = 5000): void {
    this.interval = setInterval(() => this.sample(), intervalMs);
  }

  stop(): void {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
  }

  private sample(): void {
    const mem = process.memoryUsage();
    const totalMem = os.totalmem() / (1024 * 1024);
    const usedMem = mem.heapUsed / (1024 * 1024);
    
    const snapshot: ResourceSnapshot = {
      timestamp: Date.now(),
      cpuUsage: os.loadavg()[0] * 100 / os.cpus().length,
      memoryUsage: usedMem,
      memoryTotal: totalMem,
      loadAvg: os.loadavg(),
      activeWorkers: 0,  // to be updated externally
      queuedTasks: 0,    // to be updated externally
      uptime: (Date.now() - this.startTime) / 1000,
    };
    
    this.history.push(snapshot);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
  }

  get latest(): ResourceSnapshot | null {
    return this.history[this.history.length - 1] || null;
  }

  get history_(): ResourceSnapshot[] {
    return [...this.history];
  }

  get summary() {
    if (this.history.length === 0) return null;
    const recent = this.history.slice(-10);
    const avgCpu = recent.reduce((s, r) => s + r.cpuUsage, 0) / recent.length;
    const peakMem = Math.max(...recent.map(r => r.memoryUsage));
    return {
      avgCpu: avgCpu.toFixed(1) + '%',
      peakMem: peakMem.toFixed(1) + ' MB',
      uptime: this.history[this.history.length - 1].uptime.toFixed(0) + 's',
      samples: this.history.length,
    };
  }

  /** Returns recommended worker count based on current load */
  recommendWorkers(): number {
    const s = this.latest;
    if (!s) return 1;
    const cpuPerWorker = 15; // % CPU per worker (estimated)
    const maxByCpu = Math.floor(s.cpuUsage / cpuPerWorker);
    const maxByMem = Math.floor((s.memoryTotal - s.memoryUsage) / 200); // 200MB per worker
    return Math.max(1, Math.min(maxByCpu, maxByMem, os.cpus().length - 1));
  }
}
