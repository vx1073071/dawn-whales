import { describe, it, expect } from 'vitest';
import { ApiGateway } from '../electron/workers/api-gateway';

describe('ApiGateway', () => {
  it('should route to handler', async () => {
    const gw = new ApiGateway();
    gw.route({
      method: 'GET',
      path: '/api/strategies',
      handler: async () => ({ strategies: [] }),
    });
    const resp = await gw.handle({ method: 'GET', path: '/api/strategies' });
    expect(resp.statusCode).toBe(200);
    expect(resp.body.strategies).toEqual([]);
  });

  it('should extract path params', async () => {
    const gw = new ApiGateway();
    gw.route({
      method: 'GET',
      path: '/api/strategy/:id',
      handler: async (params) => ({ id: params.id }),
    });
    const resp = await gw.handle({ method: 'GET', path: '/api/strategy/abc123' });
    expect(resp.body.id).toBe('abc123');
  });

  it('should return 404 for unknown route', async () => {
    const gw = new ApiGateway();
    const resp = await gw.handle({ method: 'POST', path: '/api/unknown' });
    expect(resp.statusCode).toBe(404);
  });

  it('should check auth', async () => {
    const gw = new ApiGateway();
    gw.setAuthHandler(async (headers) => headers.authorization ? { userId: '1' } : null);
    gw.route({
      method: 'GET', path: '/api/secure', auth: true,
      handler: async () => 'ok',
    });
    const resp = await gw.handle({ method: 'GET', path: '/api/secure', headers: {} });
    expect(resp.statusCode).toBe(401);
  });

  it('should rate limit', async () => {
    const gw = new ApiGateway();
    gw.route({
      method: 'POST', path: '/api/order', rateLimit: { burst: 2, refillRate: 0 },
      handler: async () => 'placed',
    });
    await gw.handle({ method: 'POST', path: '/api/order' });
    await gw.handle({ method: 'POST', path: '/api/order' });
    const resp = await gw.handle({ method: 'POST', path: '/api/order' });
    expect(resp.statusCode).toBe(429);
  });
});
