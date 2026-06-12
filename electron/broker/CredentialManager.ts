// ── DAWN WHALES — CredentialManager (R119 #15 + #37) ──────────────────
// Secure credential storage for all broker adapters.
// Uses OAuthTokenStore (keytar) for OS-level encryption.
// Entry point for BrokerManagerV2 to load credentials before adapter creation.
//
// @author QClaw
// @round R119
// @task #15 (API Key security) + #37 (OAuthTokenStore integration)
// @since 2026-06-12

import { log } from 'electron-log';
import { OAuthTokenStore } from './OAuthTokenStore';
import type { BrokerConfig } from './IBrokerAdapterV2';

export interface StoredCredential {
  brokerId: string;
  apiKey?: string;
  secretKey?: string;
  passphrase?: string;
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  storedAt: number;
}

/**
 * CredentialManager — single entry point for all broker credential operations.
 *
 * Lifecycle:
 *   1. User enters credentials in UI → stored via storeCredential()
 *   2. BrokerManagerV2.connect() → loadCredential() retrieves secrets
 *   3. Adapter receives sanitized config with secrets injected
 *   4. Secrets cleared from memory after adapter initialization
 */
export class CredentialManager {
  private tokenStore: OAuthTokenStore;
  private loadedSecrets = new Map<string, StoredCredential>(); // in-memory cache

  constructor() {
    this.tokenStore = new OAuthTokenStore();
  }

  /** Store broker credentials securely (keytar or encrypted file). */
  async storeCredential(brokerId: string, cred: Omit<StoredCredential, 'brokerId' | 'storedAt'>): Promise<void> {
    const entry: StoredCredential = {
      brokerId,
      ...cred,
      storedAt: Date.now(),
    };
    await this.tokenStore.storeToken(brokerId, entry);
    log.info(`[CredentialManager] Stored credentials for: ${brokerId}`);
  }

  /** Load credentials from secure storage into memory. */
  async loadCredential(brokerId: string): Promise<StoredCredential | null> {
    const cached = this.loadedSecrets.get(brokerId);
    if (cached) return cached;

    const token = await this.tokenStore.getToken(brokerId);
    if (!token || !token.accessToken) return null;

    try {
      const cred = JSON.parse(token.accessToken) as StoredCredential;
      this.loadedSecrets.set(brokerId, cred);
      return cred;
    } catch {
      log.warn(`[CredentialManager] Failed to parse stored credential for: ${brokerId}`);
      return null;
    }
  }

  /** Remove stored credentials (on broker removal or password reset). */
  async deleteCredential(brokerId: string): Promise<void> {
    await this.tokenStore.deleteToken(brokerId);
    this.loadedSecrets.delete(brokerId);
    log.info(`[CredentialManager] Deleted credentials for: ${brokerId}`);
  }

  /** Check if credentials exist for a broker. */
  async hasCredential(brokerId: string): Promise<boolean> {
    if (this.loadedSecrets.has(brokerId)) return true;
    const token = await this.tokenStore.getToken(brokerId);
    return token !== null;
  }

  /**
   * Inject loaded secrets into a BrokerConfig.
   * Returns a new config with apiKey/secretKey/passphrase populated from secure storage.
   * The original config's raw fields are not mutated.
   */
  async injectSecrets(config: BrokerConfig): Promise<BrokerConfig> {
    const cred = await this.loadCredential(config.id);
    if (!cred) return config;

    return {
      ...config,
      apiKey: cred.apiKey || config.apiKey,
      secretKey: cred.secretKey || config.secretKey,
      passphrase: cred.passphrase || config.passphrase,
      options: {
        ...config.options,
        clientId: cred.clientId || (config.options as any)?.clientId,
        clientSecret: cred.clientSecret || (config.options as any)?.clientSecret,
        accessToken: cred.accessToken,
        refreshToken: cred.refreshToken,
      },
    };
  }

  /** Clear in-memory secret cache (call on app shutdown). */
  clearCache(): void {
    this.loadedSecrets.clear();
  }
}

// Singleton
let instance: CredentialManager | null = null;
export function getCredentialManager(): CredentialManager {
  if (!instance) instance = new CredentialManager();
  return instance;
}
