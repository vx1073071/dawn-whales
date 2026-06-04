// T72: Plugin Manager
export interface Plugin {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  entry: () => Promise<PluginAPI>;
}

export interface PluginAPI {
  onInit?: () => Promise<void>;
  onEnable?: () => Promise<void>;
  onDisable?: () => Promise<void>;
  onDestroy?: () => Promise<void>;
  getMenuItems?: () => { label: string; action: string }[];
}

interface PluginState {
  plugin: Plugin;
  api: PluginAPI | null;
  enabled: boolean;
  loaded: boolean;
}

export class PluginManager {
  private plugins = new Map<string, PluginState>();

  register(plugin: Plugin): void {
    this.plugins.set(plugin.id, {
      plugin,
      api: null,
      enabled: false,
      loaded: false,
    });
  }

  async load(id: string): Promise<void> {
    const state = this.plugins.get(id);
    if (!state) throw new Error(`Plugin ${id} not registered`);
    if (state.loaded) return;

    state.api = await state.plugin.entry();
    state.loaded = true;
    if (state.api.onInit) await state.api.onInit();
  }

  async enable(id: string): Promise<void> {
    const state = this.plugins.get(id);
    if (!state) throw new Error(`Plugin ${id} not found`);
    await this.load(id);
    if (state.enabled) return;
    if (state.api!.onEnable) await state.api!.onEnable();
    state.enabled = true;
  }

  async disable(id: string): Promise<void> {
    const state = this.plugins.get(id);
    if (!state || !state.enabled) return;
    if (state.api!.onDisable) await state.api!.onDisable();
    state.enabled = false;
  }

  async unload(id: string): Promise<void> {
    const state = this.plugins.get(id);
    if (!state) return;
    if (state.enabled) await this.disable(id);
    if (state.api?.onDestroy) await state.api.onDestroy();
    this.plugins.delete(id);
  }

  getEnabledPlugins(): { id: string; name: string; version: string }[] {
    return Array.from(this.plugins.values())
      .filter(s => s.enabled)
      .map(s => ({ id: s.plugin.id, name: s.plugin.name, version: s.plugin.version }));
  }

  list(): { id: string; name: string; version: string; enabled: boolean; loaded: boolean }[] {
    return Array.from(this.plugins.values()).map(s => ({
      id: s.plugin.id, name: s.plugin.name, version: s.plugin.version,
      enabled: s.enabled, loaded: s.loaded,
    }));
  }
}

export const pluginManager = new PluginManager();
