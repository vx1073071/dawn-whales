import { describe, it, expect } from 'vitest';
import { electronIPCPlugin } from '../electron/workers/vite-electron-ipc-plugin';

describe('electronIPCPlugin', () => {
  it('should create plugin with default options', () => {
    const plugin = electronIPCPlugin();
    expect(plugin.name).toBe('vite-plugin-electron-ipc');
    expect(plugin.enforce).toBe('pre');
    expect(plugin.configResolved).toBeDefined();
    expect(plugin.buildStart).toBeDefined();
  });

  it('should accept custom output directory', () => {
    const plugin = electronIPCPlugin({ outputDir: 'custom/path' });
    expect(plugin.name).toBe('vite-plugin-electron-ipc');
  });

  it('should return proper plugin shape', () => {
    const plugin = electronIPCPlugin();
    expect(typeof plugin.configResolved).toBe('function');
    expect(typeof plugin.buildStart).toBe('function');
  });
});
