/**
 * R236-auto#1: Updated Preload IPC Types for Plugin System
 *
 * TypeScript type definitions for the Electron preload bridge,
 * extending window.electronAPI with plugin marketplace methods.
 */

export interface PluginInfo {
  id: string;
  name: string;
  version: string;
  status:
    | 'available'
    | 'downloading'
    | 'validating'
    | 'installed'
    | 'active'
    | 'inactive'
    | 'error'
    | 'uninstalling';
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
  minAppVersion?: string;
  dependencies?: Record<string, string>;
}

export interface Quote {
  symbol: string;
  price: number;
  volume?: number;
  timestamp: number;
  change?: number;
  changePercent?: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
}

export interface PluginConfig {
  updateIntervalMs?: number;
  [key: string]: unknown;
}

export interface ElectronAPI {
  // ── Plugin System (R236) ──────────────────────────────────────────
  'plugin:list': () => Promise<PluginInfo[]>;
  'plugin:install': (pluginId: string, sourceUrl?: string) => Promise<{ success: boolean }>;
  'plugin:uninstall': (pluginId: string) => Promise<{ success: boolean }>;
  'plugin:activate': (pluginId: string) => Promise<{ success: boolean }>;
  'plugin:deactivate': (pluginId: string) => Promise<{ success: boolean }>;
  'plugin:config': (pluginId: string) => Promise<Record<string, unknown>>;
  'plugin:search': (query: string, tags?: string[]) => Promise<PluginInfo[]>;
  'plugin:get': (pluginId: string) => Promise<PluginInfo | null>;

  // ── Market Data (existing) ────────────────────────────────────────
  'market:subscribe': (symbol: string, callback: (quote: Quote) => void) => () => void;
  'market:getQuote': (symbol: string) => Promise<Quote>;

  // ── General (existing) ────────────────────────────────────────────
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
