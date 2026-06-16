/**
 * R236-auto#1: Plugin Marketplace Store (zustand)
 *
 * Frontend store for plugin marketplace browsing, installation,
 * and lifecycle management. Communicates with PluginManager via IPC.
 */

import { create } from 'zustand';

export type PluginStatus =
  | 'available'
  | 'downloading'
  | 'validating'
  | 'installed'
  | 'active'
  | 'inactive'
  | 'error'
  | 'uninstalling';

export interface PluginInfo {
  id: string;
  name: string;
  version: string;
  status: PluginStatus;
  description: string;
  author: { name: string; email?: string; url?: string };
  permissions: string[];
  icon?: string;
  tags?: string[];
  license?: string;
  repository?: string;
  installedAt?: number;
  activatedAt?: number;
  lastError?: string;
}

interface PluginStore {
  // Installed plugins
  installed: Map<string, PluginInfo>;
  // Marketplace search results
  marketplaceResults: PluginInfo[];
  // Loading states
  isLoadingMarketplace: boolean;
  isLoadingInstalled: boolean;
  // Search
  searchQuery: string;
  searchTags: string[];

  // Actions
  loadInstalled: () => Promise<void>;
  searchMarketplace: (query: string, tags?: string[]) => Promise<void>;
  installPlugin: (pluginId: string, sourceUrl?: string) => Promise<void>;
  uninstallPlugin: (pluginId: string) => Promise<void>;
  activatePlugin: (pluginId: string) => Promise<void>;
  deactivatePlugin: (pluginId: string) => Promise<void>;
  getPlugin: (pluginId: string) => Promise<PluginInfo | null>;
  getPluginConfig: (pluginId: string) => Promise<Record<string, unknown>>;
  setSearchQuery: (query: string) => void;
  setSearchTags: (tags: string[]) => void;
}

// IPC bridge — calls electron IPC handlers
const ipc = {
  async invoke(channel: string, ...args: unknown[]): Promise<unknown> {
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      return (window as any).electronAPI.invoke(channel, ...args);
    }
    // Fallback for dev/testing without electron
    console.warn(`[PluginStore] IPC not available, using mock for: ${channel}`);
    return mockIPC(channel);
  },
};

// Mock IPC for development
function mockIPC(channel: string): unknown {
  switch (channel) {
    case 'plugin:list':
      return [];
    case 'plugin:search':
      return [];
    case 'plugin:install':
      return { success: true };
    case 'plugin:uninstall':
      return { success: true };
    case 'plugin:activate':
      return { success: true };
    case 'plugin:deactivate':
      return { success: true };
    case 'plugin:config':
      return {};
    case 'plugin:get':
      return null;
    default:
      return null;
  }
}

export const usePluginStore = create<PluginStore>((set, get) => ({
  installed: new Map(),
  marketplaceResults: [],
  isLoadingMarketplace: false,
  isLoadingInstalled: false,
  searchQuery: '',
  searchTags: [],

  loadInstalled: async () => {
    set({ isLoadingInstalled: true });
    try {
      const plugins = (await ipc.invoke('plugin:list')) as PluginInfo[];
      const map = new Map<string, PluginInfo>();
      plugins.forEach(p => map.set(p.id, p));
      set({ installed: map, isLoadingInstalled: false });
    } catch (err: any) {
      console.error('[PluginStore] loadInstalled failed:', err.message);
      set({ isLoadingInstalled: false });
    }
  },

  searchMarketplace: async (query: string, tags?: string[]) => {
    set({ isLoadingMarketplace: true, searchQuery: query, searchTags: tags || [] });
    try {
      const results = (await ipc.invoke('plugin:search', query, tags)) as PluginInfo[];
      set({ marketplaceResults: results, isLoadingMarketplace: false });
    } catch (err: any) {
      console.error('[PluginStore] searchMarketplace failed:', err.message);
      set({ isLoadingMarketplace: false });
    }
  },

  installPlugin: async (pluginId: string, sourceUrl?: string) => {
    // Optimistic update
    const state = get();
    const existing = state.installed.get(pluginId);
    if (existing) {
      existing.status = 'downloading';
      set({ installed: new Map(state.installed) });
    }

    try {
      await ipc.invoke('plugin:install', pluginId, sourceUrl);
      await get().loadInstalled();
    } catch (err: any) {
      console.error('[PluginStore] installPlugin failed:', err.message);
      if (existing) {
        existing.status = 'error';
        existing.lastError = err.message;
        set({ installed: new Map(state.installed) });
      }
    }
  },

  uninstallPlugin: async (pluginId: string) => {
    try {
      await ipc.invoke('plugin:uninstall', pluginId);
      await get().loadInstalled();
    } catch (err: any) {
      console.error('[PluginStore] uninstallPlugin failed:', err.message);
    }
  },

  activatePlugin: async (pluginId: string) => {
    try {
      await ipc.invoke('plugin:activate', pluginId);
      await get().loadInstalled();
    } catch (err: any) {
      console.error('[PluginStore] activatePlugin failed:', err.message);
    }
  },

  deactivatePlugin: async (pluginId: string) => {
    try {
      await ipc.invoke('plugin:deactivate', pluginId);
      await get().loadInstalled();
    } catch (err: any) {
      console.error('[PluginStore] deactivatePlugin failed:', err.message);
    }
  },

  getPlugin: async (pluginId: string) => {
    try {
      return (await ipc.invoke('plugin:get', pluginId)) as PluginInfo | null;
    } catch {
      return null;
    }
  },

  getPluginConfig: async (pluginId: string) => {
    try {
      return (await ipc.invoke('plugin:config', pluginId)) as Record<string, unknown>;
    } catch {
      return {};
    }
  },

  setSearchQuery: (query: string) => set({ searchQuery: query }),
  setSearchTags: (tags: string[]) => set({ searchTags: tags }),
}));
