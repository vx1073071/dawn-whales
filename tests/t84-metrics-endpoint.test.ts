import { describe, it, expect } from 'vitest';
import { MetricsCollector } from '../electron/workers/metrics-collector';
import { MetricsEndpoint } from '../electron/workers/metrics-endpoint';

describe('MetricsEndpoint', () => {
  it('should format metrics in Prometheus format', () => {
    const collector = new MetricsCollector();
    collector.counter('http_requests_total', { method: 'GET' });
    collector.gauge('active_connections', 42);
    const ep = new MetricsEndpoint(collector, 9999);
    
    // Access private method via reflection for testing
    const formatted = (ep as any)._formatMetrics();
    expect(formatted).toContain('http_requests_total');
    expect(formatted).toContain('active_connections');
    expect(formatted).toContain('# HELP');
    expect(formatted).toContain('# TYPE');
    expect(formatted).toContain('dw_memory_bytes');
  });
});
