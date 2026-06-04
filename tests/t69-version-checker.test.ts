import { describe, it, expect, vi } from 'vitest';
import { VersionChecker } from '../electron/workers/version-checker';

describe('VersionChecker', () => {
  it('should detect update available', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ version: '1.0.0' }),
    });
    const vc = new VersionChecker('0.9.0', 'https://api.example.com/release');
    const result = await vc.check();
    expect(result.info.hasUpdate).toBe(true);
    expect(result.info.latest).toBe('1.0.0');
  });

  it('should detect no update', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ version: '0.8.0' }),
    });
    const vc = new VersionChecker('0.9.0', 'https://api.example.com/release');
    const result = await vc.check();
    expect(result.info.hasUpdate).toBeFalsy();
  });

  it('should use cache', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ version: '2.0.0' }),
    });
    const vc = new VersionChecker('1.0.0', 'url', 99999);
    await vc.check();
    const result = await vc.check();
    expect(result.fromCache).toBe(true);
  });

  it('should report restart required for major', () => {
    const vc = new VersionChecker('0.9.0', 'url');
    const info = { current: '0.9.0', latest: '1.0.0', hasUpdate: true, required: false };
    expect(vc.requiresRestart(info)).toBe(true);
  });
});
