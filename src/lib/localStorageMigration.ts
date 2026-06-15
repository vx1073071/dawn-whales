// ── R137-M03 localStorageMigration — dw:ct:统一前缀+版本号 ───────────────
// PM: 迁移旧localStorage key到新dw:ct:{namespace}格式+版本管理

const STORE_PREFIX = 'dw:ct:';
const STORE_VERSION = 1;

// Old → New key mapping
const KEY_MAP: Record<string, string> = {
  'dw-copytrade-config': 'config',
  'dw-following': 'following',
  'dw-copytrade-brokers': 'selectedBrokers',
  'dw-notifications': 'notifications',
  'dw-sound': 'soundEnabled',
  'dw-us-brokers': 'usBrokers',
  'dw-opend-offline-config': 'offlineConfig',
  'dw-server-config': 'serverConfig',
  'dw-crypto-api-keys': 'cryptoApiKeys',
  'dw-onboarding-done': 'onboardingDone',
};

// Get namespaced key
export function ctKey(namespace: string): string {
  return STORE_PREFIX + namespace;
}

// Check if migration has already run
function isMigrated(): boolean {
  try {
    return localStorage.getItem(ctKey('version')) === String(STORE_VERSION);
  } catch {
    return false;
  }
}

// Migrate old localStorage keys to new dw:ct: format
export function migrateLocalStorage(): { migrated: number; skipped: number } {
  if (isMigrated()) {
    return { migrated: 0, skipped: Object.keys(KEY_MAP).length };
  }

  let migrated = 0;
  let skipped = 0;

  for (const [oldKey, namespace] of Object.entries(KEY_MAP)) {
    try {
      const oldValue = localStorage.getItem(oldKey);
      if (oldValue !== null) {
        const newKey = ctKey(namespace);
        // Only write if new key doesn't already exist
        if (!localStorage.getItem(newKey)) {
          localStorage.setItem(newKey, oldValue);
          migrated++;
        } else {
          skipped++;
        }
        // Clean up old key
        localStorage.removeItem(oldKey);
      }
    } catch {
      skipped++;
    }
  }

  // Set version flag
  try {
    localStorage.setItem(ctKey('version'), String(STORE_VERSION));
  } catch {
    // If localStorage is full or unavailable, fail silently
  }

  console.log(
    `[dw:ct] localStorage migration complete: ${migrated} migrated, ${skipped} skipped`
  );
  return { migrated, skipped };
}

// Get value with new prefix (auto-migrates)
export function ctGet<T>(namespace: string, fallback?: T): T | undefined {
  try {
    const raw = localStorage.getItem(ctKey(namespace));
    if (raw !== null) {
      return JSON.parse(raw) as T;
    }
  } catch {
    // Parse error → return fallback
  }
  return fallback;
}

// Set value with new prefix
export function ctSet<T>(namespace: string, value: T): void {
  try {
    localStorage.setItem(ctKey(namespace), JSON.stringify(value));
  } catch {
    console.warn(`[dw:ct] Failed to write ${namespace} to localStorage`);
  }
}

// Remove a namespaced key
export function ctRemove(namespace: string): void {
  try {
    localStorage.removeItem(ctKey(namespace));
  } catch {
    // ignore
  }
}

// Get current version
export function ctVersion(): number {
  try {
    const v = localStorage.getItem(ctKey('version'));
    return v ? parseInt(v, 10) : 0;
  } catch {
    return 0;
  }
}

// List all dw:ct: keys
export function ctListKeys(): string[] {
  const keys: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORE_PREFIX)) {
        keys.push(key.replace(STORE_PREFIX, ''));
      }
    }
  } catch {
    // ignore
  }
  return keys;
}

// Clear all dw:ct: data
export function ctClearAll(): void {
  try {
    const keys = ctListKeys();
    for (const key of keys) {
      localStorage.removeItem(ctKey(key));
    }
  } catch {
    // ignore
  }
}
