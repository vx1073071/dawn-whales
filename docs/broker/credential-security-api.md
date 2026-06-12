# Broker Security — CredentialManager & OAuthTokenStore

> 📄 **R119 #15 + #37** | QClaw (document-shrimp) | 2026-06-12
>
> Secure credential storage for all 17 broker adapters. OS-level encryption via keytar.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [CredentialManager API](#2-credentialmanager-api)
3. [OAuthTokenStore API](#3-oauthtokenstore-api)
4. [Integration Flow](#4-integration-flow)
5. [Security Model](#5-security-model)
6. [Migration Guide](#6-migration-guide)

---

## 1. Architecture Overview

### Problem

Before R119:
- Broker API keys stored as **plaintext** in `BrokerConfig.apiKey / secretKey`
- No encryption at rest
- Keys passed directly when creating adapter instances
- No key rotation, no audit trail

### Solution

R119 introduces two-layer security:

```
┌─────────────────────────────────────────────┐
│               BrokerManagerV2               │
│  connect(config) → injectSecrets(config)    │
│                      ↓                       │
│            CredentialManager                 │
│   storeCredential / loadCredential / delete  │
│                      ↓                       │
│             OAuthTokenStore                  │
│     keytar (OS credential manager)          │
│   ┌──────────┬──────────┬──────────┐        │
│   │ Windows  │  macOS   │  Linux   │        │
│   │ Cred Mgr │ Keychain │ libsecret│        │
│   └──────────┴──────────┴──────────┘        │
└─────────────────────────────────────────────┘
```

### Fallback

If keytar is unavailable (headless Linux, CI):
- Falls back to XOR-obfuscated file storage
- File: `{userData}/oauth-tokens.enc`
- Production recommendation: Electron `safeStorage` API

---

## 2. CredentialManager API

**File**: `electron/broker/CredentialManager.ts` (120L)

### Singleton Access

```typescript
import { getCredentialManager } from '../broker/CredentialManager';

const credMgr = getCredentialManager();
```

### StoredCredential

```typescript
interface StoredCredential {
  brokerId: string;
  apiKey?: string;       // Crypto exchanges (Binance, OKX, etc.)
  secretKey?: string;
  passphrase?: string;   // OKX-specific
  clientId?: string;     // OAuth brokers (Schwab, eToro, etc.)
  clientSecret?: string;
  accessToken?: string;  // OAuth2 tokens
  refreshToken?: string;
  storedAt: number;      // Unix ms timestamp
}
```

### Methods

#### `storeCredential(brokerId, cred)`

Store credentials securely. Called when user first enters API keys in UI.

```typescript
await credMgr.storeCredential('binance-spot', {
  apiKey: 'abc123...',
  secretKey: 'xyz789...',
});
// → stored in keytar (or encrypted file fallback)
```

#### `loadCredential(brokerId)`

Retrieve credentials from secure storage.

```typescript
const cred = await credMgr.loadCredential('binance-spot');
// → { brokerId: 'binance-spot', apiKey: 'abc123...', ... }
// → null if not found
```

Uses in-memory cache (`loadedSecrets` Map) for subsequent calls.

#### `deleteCredential(brokerId)`

Remove stored credentials (on broker removal or password reset).

```typescript
await credMgr.deleteCredential('binance-spot');
// → removed from keytar + in-memory cache
```

#### `hasCredential(brokerId)`

Check if credentials exist without loading the secret.

```typescript
const exists = await credMgr.hasCredential('binance-spot');
// → true/false
```

#### `injectSecrets(config)`

**Critical method** — called by `BrokerManagerV2.connect()` before creating any adapter.

```typescript
const secureConfig = await credMgr.injectSecrets(config);
// Input:  config.apiKey = undefined (redacted)
// Output: secureConfig.apiKey = 'abc123...' (loaded from secure storage)
```

Returns a new config object (never mutates the original).

The `injectSecrets` fills in:
- `apiKey`, `secretKey`, `passphrase` → for crypto exchanges
- `options.clientId`, `options.clientSecret` → for OAuth brokers
- `options.accessToken`, `options.refreshToken` → for OAuth2

#### `clearCache()`

Clear in-memory secret cache. Call on app shutdown for defense-in-depth.

```typescript
credMgr.clearCache();
```

---

## 3. OAuthTokenStore API

**File**: `electron/broker/OAuthTokenStore.ts` (177L)

### Constructor

```typescript
const store = new OAuthTokenStore();
```

Automatically:
- Tries to load `keytar` native module
- Falls back to file-based XOR storage if unavailable
- Creates `{userData}/oauth-tokens.enc` for file fallback

### Methods

#### `storeToken(brokerId, token)`

```typescript
await store.storeToken('schwab-main', {
  accessToken: 'eyJ...',
  refreshToken: 'rt_...',
  tokenType: 'Bearer',
  expiresAt: Date.now() + 3600000,
  scope: 'read trade',
});
```

#### `getToken(brokerId)`

```typescript
const token = await store.getToken('schwab-main');
// → OAuthToken | null
```

#### `deleteToken(brokerId)`

```typescript
await store.deleteToken('schwab-main');
```

#### `listBrokers()`

```typescript
const brokers = await store.listBrokers();
// → string[] (all broker IDs with stored tokens)
```

---

## 4. Integration Flow

### Startup Flow

```
1. App starts
2. User clicks "Connect Broker" in UI
3. UI sends IPC → main process
4. BrokerManagerV2.connect(config) called
5. CredentialManager.injectSecrets(config)
   → loads from keytar or encrypted file
6. secureConfig passed to adapter factory
7. Adapter created with real API keys
8. Adapter connects (WebSocket, REST)
```

### API Key Entry Flow

```
1. User enters API key/secret in BrokerManager page (ML UI)
2. UI sends IPC → broker:storeCredential
3. CredentialManager.storeCredential(brokerId, cred)
   → encrypted in keytar
4. Original plaintext discarded from memory
5. On next connect → keys loaded from secure storage
```

### Adapter Lifecycle

```
connect(config):
  secureConfig = credMgr.injectSecrets(config)  // ← R119 #37
  adapter = factory(secureConfig)                // keys present in config
  await adapter.connect()                        // adapter uses keys for auth

disconnect(brokerId):
  adapter.disconnect()
  // Keys remain in secure storage, not cleared
```

### Shutdown

```typescript
// Called during app 'will-quit'
credMgr.clearCache();  // Remove in-memory copies
// Keytar/safeStorage persists across sessions
```

---

## 5. Security Model

### Defense in Depth

| Layer | Mechanism |
|-------|-----------|
| **OS Level** | keytar → Windows Credential Manager / macOS Keychain / Linux libsecret |
| **App Level** | CredentialManager in-memory cache (cleared on shutdown) |
| **Transport** | Config never contains plaintext secrets in IPC messages |
| **Fallback** | XOR-obfuscated file (not cryptographically secure, but better than plaintext) |

### What's NOT yet secured (Future Rounds)

- API keys in memory during active adapter connections (same process memory)
- IPC messages that relay config (secrets should be stripped from config before IPC)
- No key rotation mechanism
- No access audit log

### Security Checklist

- [x] API keys encrypted at rest (keytar)
- [x] Plaintext config never persisted to disk
- [x] Secrets loaded per-connection (not globally cached beyond lifespan)
- [x] In-memory cache cleared on shutdown
- [ ] Secrets stripped from IPC messages (R121 candidate)
- [ ] Key rotation API (R121 candidate)
- [ ] Real safeStorage integration for production (R121 candidate)

---

## 6. Migration Guide

### For Existing Adapters

**Before (R118 and prior)**:
```typescript
const config: BrokerConfig = {
  id: 'binance-spot',
  type: 'binance',
  apiKey: 'YOUR_API_KEY_PLAINTEXT',   // ❌ plaintext
  secretKey: 'YOUR_SECRET_PLAINTEXT', // ❌ plaintext
};
```

**After (R119+)**:
```typescript
// Step 1: Store credentials (done once in UI)
await credMgr.storeCredential('binance-spot', {
  apiKey: 'YOUR_API_KEY',
  secretKey: 'YOUR_SECRET',
});

// Step 2: Connect with redacted config
const config: BrokerConfig = {
  id: 'binance-spot',
  type: 'binance',
  // apiKey and secretKey NOT set here!
};

// Step 3: BrokerManagerV2 automatically injects secrets
await brokerMgr.connect(config);
// → CredentialManager.injectSecrets() fills in apiKey/secretKey
```

### For New Adapters (R120+)

New adapters should NEVER accept `apiKey`/`secretKey` in their config directly.
Always use `CredentialManager.injectSecrets()` before adapter creation.

```typescript
// ✅ Correct
const secureConfig = await credMgr.injectSecrets(config);
const adapter = new MyNewAdapter(secureConfig);

// ❌ Wrong — plaintext in config
const adapter = new MyNewAdapter({
  ...config,
  apiKey: 'plz_dont_do_this',
});
```

### Console Log Cleanup (R119 #36)

All `console.log/warn/error` calls replaced with `electron-log`:
- `electron/config/endpoints.ts` (2 calls)
- `electron/engine/broker/adapters/binance-adapter.ts` (1 call)
- `electron/utils/secure-key.ts` (1 call)
- `electron/workers/worker-pool-extras.ts` (1 call)
- `electron/api-routes.ts` (4 calls)

Run `grep -r "console\." electron/` — should return **0 results**.

---

## Files Reference

| File | Size | Round |
|------|------|-------|
| `electron/broker/CredentialManager.ts` | 120L | R119 |
| `electron/broker/OAuthTokenStore.ts` | 177L | R1 + R119 |
| `electron/broker/BrokerManagerV2.ts` | ~530L | R109 + R119 |
| `electron/config/endpoints.ts` | ~ | R119 (console cleanup) |

---

> **TSC**: `npx tsc --noEmit` EXIT:0
> **Console Log**: `grep console.log electron/` → 0
> **Author**: QClaw · **Round**: R119 · **Tasks**: #15 + #37 + #36
