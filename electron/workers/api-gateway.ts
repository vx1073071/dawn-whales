// T87: API Gateway with routing, rate-limiting, and auth
import { RateLimiter } from './rate-limiter';

export interface RouteConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  handler: (params: unknown, body: unknown, headers: unknown) => Promise<any>;
  rateLimit?: { burst: number; refillRate: number };
  auth?: boolean;
}

export interface GatewayRequest {
  method: string;
  path: string;
  params?: Record<string, string>;
  body?: unknown;
  headers?: Record<string, string>;
}

export interface GatewayResponse {
  statusCode: number;
  body: unknown;
  headers?: Record<string, string>;
}

export class ApiGateway {
  private routes: RouteConfig[] = [];
  private rateLimiters = new Map<string, RateLimiter>();
  private authHandler: ((headers: unknown) => Promise<{ userId: string } | null>) | null = null;

  route(config: RouteConfig): void {
    this.routes.push(config);
  }

  setAuthHandler(handler: (headers: unknown) => Promise<{ userId: string } | null>): void {
    this.authHandler = handler;
  }

  async handle(req: GatewayRequest): Promise<GatewayResponse> {
    // Find matching route
    const route = this.routes.find(r =>
      r.method === req.method && this._matchPath(r.path, req.path)
    );

    if (!route) {
      return { statusCode: 404, body: { error: 'Not found', path: req.path } };
    }

    // Auth check
    if (route.auth && this.authHandler) {
      const user = await this.authHandler(req.headers || {});
      if (!user) {
        return { statusCode: 401, body: { error: 'Unauthorized' } };
      }
    }

    // Rate limit check
    if (route.rateLimit) {
      const rlKey = `${route.method}:${route.path}`;
      if (!this.rateLimiters.has(rlKey)) {
        this.rateLimiters.set(rlKey, new RateLimiter(route.rateLimit.burst, route.rateLimit.refillRate));
      }
      const limiter = this.rateLimiters.get(rlKey)!;
      const allowed = await limiter.acquire(req.path);
      if (!allowed) {
        return { statusCode: 429, body: { error: 'Too many requests', retryAfter: 1 } };
      }
    }

    // Extract path params
    const params = this._extractParams(route.path, req.path);

    try {
      const result = await route.handler(params, req.body, req.headers);
      return { statusCode: 200, body: result };
    } catch (e) {
      return { statusCode: 500, body: { error: e.message } };
    }
  }

  private _matchPath(routePath: string, requestPath: string): boolean {
    const routeParts = routePath.split('/');
    const reqParts = requestPath.split('/');
    if (routeParts.length !== reqParts.length) return false;
    return routeParts.every((part, i) => part.startsWith(':') || part === reqParts[i]);
  }

  private _extractParams(routePath: string, requestPath: string): Record<string, string> {
    const params: Record<string, string> = {};
    const routeParts = routePath.split('/');
    const reqParts = requestPath.split('/');
    routeParts.forEach((part, i) => {
      if (part.startsWith(':')) {
        params[part.slice(1)] = reqParts[i];
      }
    });
    return params;
  }
}

export const apiGateway = new ApiGateway();
