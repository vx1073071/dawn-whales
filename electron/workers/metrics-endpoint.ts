// T84: Prometheus metrics HTTP endpoint
import * as http from 'http';
import { MetricsCollector } from './metrics-collector';
import log from 'electron-log';

export class MetricsEndpoint {
  private server: http.Server | null = null;
  private port: number;
  private metrics: MetricsCollector;

  constructor(metrics: MetricsCollector, port = 9091) {
    this.metrics = metrics;
    this.port = port;
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        if (req.url === '/metrics') {
          const data = this._formatMetrics();
          res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end(data);
        } else if (req.url === '/health') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'healthy', uptime: process.uptime() }));
        } else {
          res.writeHead(404);
          res.end('Not found');
        }
      });

      this.server.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          log.warn(`[Metrics] Port ${this.port} in use, skipping`);
          resolve();
        } else {
          reject(err);
        }
      });

      this.server.listen(this.port, '0.0.0.0', () => {
        log.info(`[Metrics] Endpoint ready on :${this.port}`);
        resolve();
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  private _formatMetrics(): string {
    const points = this.metrics.collect();
    const now = Date.now();
    const lines: string[] = [];

    // Group by metric name
    const grouped = new Map<string, typeof points>();
    for (const p of points) {
      if (!grouped.has(p.name)) grouped.set(p.name, []);
      grouped.get(p.name)!.push(p);
    }

    for (const [name, items] of grouped) {
      lines.push(`# HELP ${name} DAWN WHALES metric`);
      lines.push(`# TYPE ${name} gauge`);
      for (const item of items) {
        const labels = Object.entries(item.labels)
          .map(([k, v]) => `${k}="${v}"`)
          .join(',');
        const labelStr = labels ? `{${labels}}` : '';
        lines.push(`${name}${labelStr} ${item.value} ${now}`);
      }
    }

    // System metrics
    const mem = process.memoryUsage();
    lines.push('# HELP dw_memory_bytes Process memory usage');
    lines.push('# TYPE dw_memory_bytes gauge');
    lines.push(`dw_memory_bytes{type="heapUsed"} ${mem.heapUsed} ${now}`);
    lines.push(`dw_memory_bytes{type="heapTotal"} ${mem.heapTotal} ${now}`);
    lines.push(`dw_memory_bytes{type="rss"} ${mem.rss} ${now}`);

    lines.push('# HELP dw_uptime_seconds Process uptime');
    lines.push('# TYPE dw_uptime_seconds counter');
    lines.push(`dw_uptime_seconds ${process.uptime()} ${now}`);

    return lines.join('\n') + '\n';
  }
}
