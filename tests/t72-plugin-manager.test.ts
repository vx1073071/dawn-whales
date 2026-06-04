import { describe, it, expect, vi } from 'vitest';
import { PluginManager } from '../electron/workers/plugin-manager';

describe('PluginManager', () => {
  it('should enable and disable plugins', async () => {
    const pm = new PluginManager();
    const onEnable = vi.fn();
    const onDisable = vi.fn();

    pm.register({
      id: 'test-plugin',
      name: 'Test',
      version: '1.0.0',
      entry: async () => ({ onEnable, onDisable }),
    });

    await pm.enable('test-plugin');
    expect(onEnable).toHaveBeenCalledOnce();
    expect(pm.getEnabledPlugins()).toHaveLength(1);

    await pm.disable('test-plugin');
    expect(onDisable).toHaveBeenCalledOnce();
    expect(pm.getEnabledPlugins()).toHaveLength(0);
  });

  it('should call lifecycle hooks', async () => {
    const pm = new PluginManager();
    const onInit = vi.fn();
    const onDestroy = vi.fn();

    pm.register({
      id: 'p2',
      name: 'P2',
      version: '1.0',
      entry: async () => ({ onInit, onDestroy }),
    });

    await pm.enable('p2');
    expect(onInit).toHaveBeenCalledOnce();

    await pm.unload('p2');
    expect(onDestroy).toHaveBeenCalledOnce();
  });
});
