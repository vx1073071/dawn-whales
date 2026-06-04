import { describe, it, expect } from 'vitest';
import { JsonRpcServer } from '../electron/workers/json-rpc';

describe('JsonRpcServer', () => {
  it('should call registered method', async () => {
    const srv = new JsonRpcServer();
    srv.register('add', async ([a, b]) => a + b);

    const raw = JSON.stringify({ jsonrpc: '2.0', method: 'add', params: [2, 3], id: 1 });
    const resp = await srv.handle(raw) as any;
    expect(resp.result).toBe(5);
    expect(resp.id).toBe(1);
  });

  it('should return error for unknown method', async () => {
    const srv = new JsonRpcServer();
    const raw = JSON.stringify({ jsonrpc: '2.0', method: 'unknown', id: 2 });
    const resp = await srv.handle(raw) as any;
    expect(resp.error.code).toBe(-32601);
  });

  it('should handle notifications (no response)', async () => {
    const srv = new JsonRpcServer();
    srv.register('log', async () => {});
    const raw = JSON.stringify({ jsonrpc: '2.0', method: 'log' });
    const resp = await srv.handle(raw);
    expect(resp).toBeNull();
  });

  it('should handle batch', async () => {
    const srv = new JsonRpcServer();
    srv.register('echo', async ([x]) => x);
    const raw = JSON.stringify([
      { jsonrpc: '2.0', method: 'echo', params: ['a'], id: 1 },
      { jsonrpc: '2.0', method: 'echo', params: ['b'], id: 2 },
    ]);
    const resp = await srv.handle(raw) as any[];
    expect(resp).toHaveLength(2);
    expect(resp[0].result).toBe('a');
    expect(resp[1].result).toBe('b');
  });

  it('should handle parse error', async () => {
    const srv = new JsonRpcServer();
    const resp = await srv.handle('not json') as any;
    expect(resp.error.code).toBe(-32700);
  });
});
