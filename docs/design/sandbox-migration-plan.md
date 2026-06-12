# Sandbox:true Migration Plan

**Version:** v2.0.0  
**Date:** 2026-06-13  
**Status:** Implemented in R128

## Problem

Current `electron/main/browser.ts` sets `sandbox: false` because:
1. `better-sqlite3` is a native Node.js addon that requires direct C++ access
2. Electron sandbox mode blocks native module loading in preload/renderer

## Solution

Move **all native module operations to the main process**.
The renderer communicates exclusively via `contextBridge.exposeInMainWorld('api', ...)`.

```
┌─────────────────────────┐
│  Renderer (sandbox:true)│  ← NO native modules
│  React App              │
│  contextBridge API      │
└────────┬────────────────┘
         │ IPC (channel whitelist)
┌────────▼────────────────┐
│  Preload (sandbox:true) │  ← contextBridge only
│  exposeInMainWorld()    │     No node access
└────────┬────────────────┘
         │ IPC invoke/handle
┌────────▼────────────────┐
│  Main Process           │
│  sqlite-ipc.ts          │  ← better-sqlite3 here
│  broker connections     │
│  file operations        │
│  system APIs            │
└─────────────────────────┘
```

## Implementation

### Step 1: SQLite IPC Bridge
File: `electron/main/sqlite-ipc.ts`
- Uses `better-sqlite3` in main process
- Exposes: `db:query`, `db:exec`, `db:get`, `db:all`, `db:run`
- All IPC channels validated

### Step 2: Preload Update
File: `electron/preload.ts`
- Remove any `require('better-sqlite3')` or `require('electron')` from preload
- Add `db:` namespace to contextBridge API
- Whitelist only defined IPC channels

### Step 3: BrowserWindow Config
File: `electron/main/browser.ts`
- Set `sandbox: true`
- Remove `sandbox: false` justification comment
- Keep `contextIsolation: true`, `nodeIntegration: false`

### Step 4: Renderer Adapter
File: `src/lib/db-client.ts`
- Thin wrapper over `window.api.db.*`
- Cache results in IndexedDB for offline resilience (optional)

## Impact Assessment

| Module | Before | After |
|--------|--------|-------|
| browser.ts | sandbox:false | sandbox:true ✅ |
| preload.ts | ✓ contextBridge | ✓ contextBridge (unchanged) |
| sqlite usage | Direct require | IPC invoke |
| Performance | ~0.1ms sync | ~0.5ms async (negligible) |
| Security | Native modules exposed | Full sandbox isolation ✅ |
| Memory | 80MB per renderer | ~120MB main (sqlite in main) |

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| IPC latency for DB | Low | Low | SQLite is local, <1ms RTT |
| Main process memory | Low | Medium | SQLite uses <50MB typical |
| Breaking renderer DB calls | Medium | High | db-client.ts adapter layer |

## Verification Checklist

- [x] `sandbox: true` in BrowserWindow config
- [x] No native modules in preload.js
- [x] All DB calls pass through IPC `db:*` channels
- [x] `contextIsolation: true` maintained
- [x] `nodeIntegration: false` maintained
- [x] `webSecurity: true` maintained
- [x] CSP header unchanged
- [x] TSC 0 errors
- [x] Build PASS
- [x] npm audit 0 vulnerabilities
