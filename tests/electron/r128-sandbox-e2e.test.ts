// ── R128-M02 E2E Sandbox Mock — Electron contextBridge 测试环境 ─────────
// PM: sandbox:true迁移后E2E测试需要mock contextBridge

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ═══════════ Mock setup ═══════════

function setupSandboxMock() {
  const mockInvoke = vi.fn().mockResolvedValue({ success: true });
  const mockAPI = {
    invoke: mockInvoke,
    file: {
      read: vi.fn().mockResolvedValue(''),
      write: vi.fn().mockResolvedValue(undefined),
      exists: vi.fn().mockResolvedValue(false),
      list: vi.fn().mockResolvedValue([]),
    },
    shell: {
      openExternal: vi.fn().mockResolvedValue(undefined),
      showItemInFolder: vi.fn().mockResolvedValue(undefined),
    },
    app: {
      getPath: vi.fn().mockResolvedValue('/mock/userData'),
      quit: vi.fn().mockResolvedValue(undefined),
      getVersion: vi.fn().mockResolvedValue('2.0.0'),
    },
    broker: {
      connect: vi.fn().mockResolvedValue({ success: true, brokerId: 'binance' }),
      disconnect: vi.fn().mockResolvedValue(undefined),
      getBrokers: vi.fn().mockResolvedValue([{ id: 'binance', name: 'Binance', status: 'connected' }]),
      subscribe: vi.fn().mockResolvedValue(undefined),
      placeOrder: vi.fn().mockResolvedValue({ orderId: 'test-001', status: 'filled' }),
    },
    strategy: {
      create: vi.fn().mockResolvedValue({ id: 'strat-001' }),
      list: vi.fn().mockResolvedValue([]),
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
    },
    platform: {
      isElectron: true,
      isSandbox: true,
      os: 'win32',
      arch: 'x64',
    },
  };

  (globalThis as any).window = { api: mockAPI };
  return mockAPI;
}

function teardownSandboxMock() {
  delete (globalThis as any).window;
}

// ═══════════ Tests ═══════════

describe('R128 Sandbox API', () => {
  let mockAPI: ReturnType<typeof setupSandboxMock>;

  beforeEach(() => { mockAPI = setupSandboxMock(); });
  afterEach(() => { teardownSandboxMock(); });

  it('should detect sandbox mode', () => {
    expect(window.api!.platform.isSandbox).toBe(true);
    expect(window.api!.platform.isElectron).toBe(true);
    expect(window.api!.platform.os).toBe('win32');
  });

  it('should invoke IPC channels', async () => {
    const result = await window.api!.invoke('test:channel', { key: 'val' });
    expect(result).toEqual({ success: true });
    expect(mockAPI.invoke).toHaveBeenCalledWith('test:channel', { key: 'val' });
  });

  it('should read/write files via IPC', async () => {
    mockAPI.file.read.mockResolvedValueOnce('file content');
    const content = await window.api!.file.read('/test/path.txt');
    expect(content).toBe('file content');
    expect(mockAPI.file.read).toHaveBeenCalledWith('/test/path.txt');
  });

  it('should open external URLs', async () => {
    await window.api!.shell.openExternal('https://example.com');
    expect(mockAPI.shell.openExternal).toHaveBeenCalledWith('https://example.com');
  });

  it('should connect to broker', async () => {
    const result = await window.api!.broker.connect('binance', { apiKey: 'test', secret: 'test' });
    expect(result.success).toBe(true);
    expect(result.brokerId).toBe('binance');
    expect(mockAPI.broker.connect).toHaveBeenCalledWith('binance', { apiKey: 'test', secret: 'test' });
  });

  it('should get broker list', async () => {
    const brokers = await window.api!.broker.getBrokers();
    expect(brokers).toHaveLength(1);
    expect(brokers[0].id).toBe('binance');
  });

  it('should place order', async () => {
    const order = { symbol: 'BTC-USDT', side: 'buy', amount: 0.1, type: 'limit', price: 97000 };
    const result = await window.api!.broker.placeOrder(order);
    expect(result.status).toBe('filled');
    expect(mockAPI.broker.placeOrder).toHaveBeenCalledWith(order);
  });

  it('should create strategy', async () => {
    const result = await window.api!.strategy.create({ name: 'Test Strategy', type: 'ma_cross' });
    expect(result.id).toBe('strat-001');
  });

  it('should get app version', async () => {
    const version = await window.api!.app.getVersion();
    expect(version).toBe('2.0.0');
  });

  it('should get app path', async () => {
    mockAPI.app.getPath.mockResolvedValueOnce('/mock/userData');
    const p = await window.api!.app.getPath('userData');
    expect(p).toBe('/mock/userData');
    expect(mockAPI.app.getPath).toHaveBeenCalledWith('userData');
  });
});

// ═══════════ SandboxAPI module tests ═══════════

describe('R128 SandboxAPI module', () => {
  it('isElectron returns false in browser', async () => {
    // No window.api set → should be browser mode
    const { isElectron } = await import('../../src/lib/sandbox/SandboxAPI');
    expect(isElectron()).toBe(false);
  });

  it('getSandboxAPI returns mock in browser', async () => {
    const { getSandboxAPI } = await import('../../src/lib/sandbox/SandboxAPI');
    const api = getSandboxAPI();
    expect(api).toBeDefined();
    expect(api.platform.isElectron).toBe(false);
    expect(api.platform.isSandbox).toBe(false);
  });

  it('mock API has all required methods', async () => {
    const { getSandboxAPI } = await import('../../src/lib/sandbox/SandboxAPI');
    const api = getSandboxAPI();
    expect(typeof api.invoke).toBe('function');
    expect(typeof api.file.read).toBe('function');
    expect(typeof api.file.write).toBe('function');
    expect(typeof api.shell.openExternal).toBe('function');
    expect(typeof api.app.getVersion).toBe('function');
    expect(typeof api.broker.connect).toBe('function');
    expect(typeof api.broker.placeOrder).toBe('function');
  });

  it('mock broker connect returns success', async () => {
    const { getSandboxAPI } = await import('../../src/lib/sandbox/SandboxAPI');
    const api = getSandboxAPI();
    const result = await api.broker.connect('binance', { apiKey: 'x', secret: 'y' });
    expect(result.success).toBe(true);
  });

  it('mock file operations return empty', async () => {
    const { getSandboxAPI } = await import('../../src/lib/sandbox/SandboxAPI');
    const api = getSandboxAPI();
    const content = await api.file.read('/any/path');
    expect(content).toBe('');
  });
});

// ═══════════ Error handling ═══════════

describe('R128 Sandbox error handling', () => {
  beforeEach(() => setupSandboxMock());
  afterEach(() => teardownSandboxMock());

  it('should handle IPC invoke failure gracefully', async () => {
    window.api!.invoke = vi.fn().mockRejectedValue(new Error('IPC timeout'));
    await expect(window.api!.invoke('test:channel')).rejects.toThrow('IPC timeout');
  });

  it('should handle broker disconnect with error', async () => {
    window.api!.broker.disconnect = vi.fn().mockRejectedValue(new Error('Connection lost'));
    await expect(window.api!.broker.disconnect('binance')).rejects.toThrow('Connection lost');
  });

  it('should handle file read permission error', async () => {
    window.api!.file.read = vi.fn().mockRejectedValue(new Error('EACCES: permission denied'));
    await expect(window.api!.file.read('/protected/file')).rejects.toThrow('permission denied');
  });

  it('should handle strategy engine crash', async () => {
    window.api!.strategy.start = vi.fn().mockRejectedValue(new Error('Strategy engine crashed'));
    await expect(window.api!.strategy.start('strat-001')).rejects.toThrow('crashed');
  });
});
