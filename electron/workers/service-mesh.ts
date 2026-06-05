// T92: Service Mesh Configuration (Istio-compatible)
export interface ServiceMeshConfig {
  services: {
    name: string;
    host: string;
    port: number;
    weight: number; // traffic weight for canary
    version: string;
    healthCheck?: { path: string; intervalMs: number };
  }[];
  global: {
    circuitBreaker?: { maxConnections: number; maxPending: number; timeoutMs: number };
    retries?: { attempts: number; perTryTimeoutMs: number };
    rateLimit?: { requestsPerSecond: number };
  };
}

export interface MeshRoute {
  match: { prefix?: string; headers?: Record<string, string> };
  destination: string; // service name
  weight?: number;
}

export class ServiceMesh {
  private config: ServiceMeshConfig;
  private routes: MeshRoute[] = [];
  private circuitBreakerState = new Map<string, { failures: number; open: boolean; openedAt: number }>();
  private metrics = { requests: 0, failures: 0, retries: 0 };

  constructor(config: ServiceMeshConfig) {
    this.config = config;
    for (const svc of config.services) {
      this.circuitBreakerState.set(svc.name, { failures: 0, open: false, openedAt: 0 });
    }
  }

  addRoute(route: MeshRoute): void {
    this.routes.push(route);
  }

  resolve(requestPath: string, headers?: Record<string, string>): { host: string; port: number; version: string } | null {
    // Find matching route
    for (const route of this.routes) {
      if (route.match.prefix && !requestPath.startsWith(route.match.prefix)) continue;
      if (route.match.headers) {
        const match = Object.entries(route.match.headers).every(([k, v]) => headers?.[k] === v);
        if (!match) continue;
      }

      const svc = this.config.services.find(s => s.name === route.destination);
      if (!svc) continue;

      const cb = this.circuitBreakerState.get(svc.name);
      if (cb?.open && Date.now() - cb.openedAt < 30000) {
        return null; // circuit open
      }

      return { host: svc.host, port: svc.port, version: svc.version };
    }

    // Default: first service
    const defaultSvc = this.config.services[0];
    return defaultSvc ? { host: defaultSvc.host, port: defaultSvc.port, version: defaultSvc.version } : null;
  }

  recordSuccess(serviceName: string): void {
    const cb = this.circuitBreakerState.get(serviceName);
    if (cb) { cb.failures = 0; cb.open = false; }
    this.metrics.requests++;
  }

  recordFailure(serviceName: string): void {
    const cb = this.circuitBreakerState.get(serviceName);
    if (cb) {
      cb.failures++;
      if (cb.failures >= (this.config.global.circuitBreaker?.maxConnections || 5)) {
        cb.open = true;
        cb.openedAt = Date.now();
      }
    }
    this.metrics.failures++;
  }

  recordRetry(): void { this.metrics.retries++; }

  getMetrics(): typeof this.metrics {
    return { ...this.metrics };
  }

  canaryWeight(serviceName: string): number {
    const svc = this.config.services.find(s => s.name === serviceName);
    return svc?.weight || 100;
  }
}
