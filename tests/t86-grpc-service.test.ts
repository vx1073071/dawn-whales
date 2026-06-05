import { describe, it, expect } from 'vitest';
import { GrpcServer, StrategyGrpcService, MarketDataGrpcService } from '../electron/workers/grpc-service';

describe('GrpcServer', () => {
  it('should call registered method', async () => {
    const srv = new GrpcServer();
    new StrategyGrpcService(srv);
    const resp = await srv.call({
      service: 'dawnwhales.v1.StrategyService',
      method: 'CreateStrategy',
      request: { name: 'MA Cross' },
    });
    expect(resp.status.code).toBe(0);
    expect(resp.data.name).toBe('MA Cross');
  });

  it('should return error for unknown service', async () => {
    const srv = new GrpcServer();
    const resp = await srv.call({
      service: 'unknown.Service',
      method: 'Foo',
      request: {},
    });
    expect(resp.status.code).toBe(5);
  });

  it('should return error for unknown method', async () => {
    const srv = new GrpcServer();
    new StrategyGrpcService(srv);
    const resp = await srv.call({
      service: 'dawnwhales.v1.StrategyService',
      method: 'UnknownMethod',
      request: {},
    });
    expect(resp.status.code).toBe(12);
  });

  it('should handle MarketData service', async () => {
    const srv = new GrpcServer();
    new MarketDataGrpcService(srv);
    const resp = await srv.call({
      service: 'dawnwhales.v1.MarketDataService',
      method: 'GetQuote',
      request: { symbol: 'AAPL' },
    });
    expect(resp.data.price).toBe(150);
  });
});
