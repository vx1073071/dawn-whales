# DAWN WHALES Plugin API Specification v1.0

## Overview

The DAWN WHALES plugin system lets third-party developers extend the platform with custom strategies, indicators, UI components, and data integrations.

## Architecture

```
Third-party Plugin Code
        │
        ▼
┌───────────────────┐
│   Plugin Sandbox  │  ← vm2 / isolated context
│  (restricted VM)  │     no require(), no fs, no process
└────────┬──────────┘
         │ PluginExposedAPI
         ▼
┌───────────────────┐
│  PluginManager    │  ← lifecycle, permissions, marketplace
└────────┬──────────┘
         │ IPC
         ▼
┌───────────────────┐
│  DAWN WHALES Core │  ← Factor engine, broker, signals
└───────────────────┘
```

## Plugin Lifecycle

```
available ──→ downloading ──→ validating ──→ installed ──→ active
  (market)                                                     │
                                                               │
                    uninstalled ←──── inactive ←──────────────┘
```

## Manifest Example

```json
{
  "id": "mycompany.grid-trading",
  "name": "Grid Trading Bot",
  "version": "1.0.0",
  "description": "Automated grid trading strategy for volatile markets",
  "author": { "name": "MyCompany", "email": "dev@myco.com" },
  "minAppVersion": "2.6.0",
  "permissions": ["market-data", "trade-exec", "storage", "notifications"],
  "main": "index.js",
  "ui": {
    "component": "GridConfig.tsx",
    "slot": "panel"
  },
  "icon": "https://myco.com/grid-icon.png",
  "tags": ["strategy", "grid", "automated"],
  "license": "MIT"
}
```

## Permissions

| Permission | Risk | Access Granted |
|------------|:----:|---------------|
| `network` | Medium | HTTP/WS to external APIs |
| `filesystem` | High | Read/write local files |
| `market-data` | Low | Real-time quotes, kline |
| `trade-exec` | **Critical** | Place/cancel orders |
| `ui` | Low | Add custom React components |
| `notifications` | Low | Push to user |
| `storage` | Medium | 10MB scoped key-value |
| `identity` | High | Read user identity |

## Plugin API

The `PluginExposedAPI` is injected at activation:

```typescript
interface PluginExposedAPI {
  // Logging (scoped to plugin)
  logger: {
    debug(msg: string): void;
    info(msg: string): void;
    warn(msg: string): void;
    error(msg: string): void;
  };

  // Market data
  getQuote(symbol: string): Promise<Quote>;
  subscribe(symbol: string, callback: (data: Quote) => void): () => void;

  // Config (persisted per-plugin)
  getConfig(): Promise<Record<string, unknown>>;
  setConfig(updates: Record<string, unknown>): Promise<void>;

  // Scoped storage (10MB max)
  storage: {
    get(key: string): Promise<unknown>;
    set(key: string, value: unknown): Promise<void>;
    delete(key: string): Promise<void>;
    keys(): Promise<string[]>;
  };

  // User notification
  notify(title: string, body: string, options?: NotifyOptions): void;

  // Events
  emit(event: string, data: unknown): void;
  on(hook: PluginHook, handler: (...args: any[]) => void): () => void;
}
```

## Hooks

| Hook | Trigger | Args |
|------|---------|------|
| `onInit` | Plugin loaded | `(api: PluginExposedAPI)` |
| `onActivate` | Plugin activated | `(api: PluginExposedAPI)` |
| `onDeactivate` | Plugin deactivated | `()` |
| `onUninstall` | Plugin removed | `()` |
| `onMarketData` | New market data | `(symbol: string, quote: Quote)` |
| `onTradeSignal` | Signal generated | `(signal: TradeSignal)` |
| `onOrderUpdate` | Order status change | `(order: Order)` |
| `onPositionUpdate` | Position change | `(position: Position)` |
| `onTimer` | Periodic (configurable) | `()` |

## Example Plugin: Momentum Monitor

```javascript
// my-plugin/main.js
module.exports = {
  async onInit(api) {
    api.logger.info('Momentum Monitor starting');
    
    // Subscribe to AAPL
    const unsubscribe = api.subscribe('AAPL', (quote) => {
      if (quote.change > 5) {
        api.notify('Momentum Alert', `AAPL moved ${quote.change}%!`);
      }
    });
    
    // Store subscription count
    const count = await api.storage.get('alerts_count') || 0;
    await api.storage.set('alerts_count', count + 1);
    
    // Save reference for cleanup
    this._unsubscribe = unsubscribe;
  },
  
  async onDeactivate(api) {
    this._unsubscribe?.();
    api.logger.info('Momentum Monitor stopped');
  }
};
```

## Sandbox Restrictions

- ❌ `require()` / `import()` — only preloaded modules
- ❌ `process`, `global`, `globalThis`
- ❌ `fs`, `child_process`, `os`
- ❌ `eval()`, `new Function()`
- ✅ Standard: `Math`, `Date`, `JSON`, `Promise`, `Array`, `Map`, `Set`
- ✅ Timers: `setTimeout`, `setInterval` (max 60s duration)
- ✅ Plugin API only via api parameter

## IPC Channels

| Channel | Direction | Description |
|---------|-----------|-------------|
| `plugin:list` | Renderer→Main | Get installed plugins |
| `plugin:install` | Renderer→Main | Install from marketplace |
| `plugin:uninstall` | Renderer→Main | Remove plugin |
| `plugin:activate` | Renderer→Main | Start plugin |
| `plugin:deactivate` | Renderer→Main | Stop plugin |
| `plugin:config` | Renderer→Main | Get plugin config |
| `plugin:search` | Renderer→Main | Search marketplace |
| `plugin:get` | Renderer→Main | Get plugin details |

## Marketplace

URL: `https://marketplace.dawnwhales.app/api/v1`

Endpoints:
- `GET /search?q=grid&tags=strategy` — Search plugins
- `GET /plugins/:id/manifest.json` — Plugin manifest
- `GET /plugins/:id/:version/package.zip` — Download package
