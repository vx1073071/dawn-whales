// ── QUANT MOO — OAuth Token Secure Storage ───────────────────────────
// R1 SEC-02: OAuth token安全存储(keytar)
// 使用操作系统原生密钥管理(Windows Credential Manager/macOS Keychain/Linux libsecret)
// 封装 keytar 调用, 提供 fallback 文件存储

import log from 'electron-log';
import type { OAuthToken } from '../broker/adapters/OAuthBrokerBase';

// Try to import keytar, fallback to file-based secure storage
let keytar: any;
try {
  keytar = require('keytar');
  log.info('[OAuthStore] Using keytar (OS-level credential manager)');
} catch {
  log.warn('[OAuthStore] keytar not available, falling back to file-based encrypted storage');
}

// Simple AES-like XOR obfuscation for file-based fallback
// (Production should use Electron safeStorage API)
const ENCRYPTION_KEY = 'DW-BROKER-TOKEN-VAULT-2026';
import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export class OAuthTokenStore {
  private static SERVICE_NAME = 'quant-moo-broker-tokens';
  private filePath: string;

  constructor() {
    const userDataPath = app?.getPath?.('userData') || path.join(process.env.APPDATA || '', 'quant-moo');
    this.filePath = path.join(userDataPath, 'oauth-tokens.enc');
  }

  /**
   * Store an OAuth token securely.
   */
  async storeToken(brokerId: string, token: OAuthToken): Promise<void> {
    const json = JSON.stringify(token);
    if (keytar) {
      await keytar.setPassword(OAuthTokenStore.SERVICE_NAME, brokerId, json);
      log.info(`[OAuthStore] Stored token for ${brokerId} (keytar)`);
    } else {
      await this._storeToFile(brokerId, json);
      log.info(`[OAuthStore] Stored token for ${brokerId} (file)`);
    }
  }

  /**
   * Retrieve an OAuth token.
   */
  async getToken(brokerId: string): Promise<OAuthToken | null> {
    try {
      if (keytar) {
        const json = await keytar.getPassword(OAuthTokenStore.SERVICE_NAME, brokerId);
        if (json) return JSON.parse(json);
      } else {
        const json = await this._readFromFile(brokerId);
        if (json) return JSON.parse(json);
      }
    } catch (err: any) {
      log.warn(`[OAuthStore] Failed to get token for ${brokerId}: ${err.message}`);
    }
    return null;
  }

  /**
   * Delete a stored OAuth token.
   */
  async deleteToken(brokerId: string): Promise<void> {
    try {
      if (keytar) {
        await keytar.deletePassword(OAuthTokenStore.SERVICE_NAME, brokerId);
      } else {
        await this._deleteFromFile(brokerId);
      }
      log.info(`[OAuthStore] Deleted token for ${brokerId}`);
    } catch (err: any) {
      log.warn(`[OAuthStore] Failed to delete token for ${brokerId}: ${err.message}`);
    }
  }

  /**
   * List all stored broker token IDs.
   */
  async listBrokers(): Promise<string[]> {
    if (keytar) {
      try {
        const creds = await keytar.findCredentials(OAuthTokenStore.SERVICE_NAME);
        return creds.map((c: { account: string }) => c.account);
      } catch {
        return [];
      }
    }
    return this._listFromFile();
  }

  // ═══ File-based fallback with encryption ════════════

  private async _storeToFile(brokerId: string, json: string): Promise<void> {
    const all = await this._readAll();
    all[brokerId] = this._encrypt(json);
    await this._writeAll(all);
  }

  private async _readFromFile(brokerId: string): Promise<string | null> {
    const all = await this._readAll();
    const encrypted = all[brokerId];
    if (!encrypted) return null;
    return this._decrypt(encrypted);
  }

  private async _deleteFromFile(brokerId: string): Promise<void> {
    const all = await this._readAll();
    delete all[brokerId];
    await this._writeAll(all);
  }

  private _listFromFile(): string[] {
    try {
      return Object.keys(this._readAllSync());
    } catch {
      return [];
    }
  }

  private async _readAll(): Promise<Record<string, string>> {
    try {
      if (fs.existsSync(this.filePath)) {
        const content = fs.readFileSync(this.filePath, 'utf-8');
        return JSON.parse(content);
      }
    } catch (err: any) {
      log.warn(`[OAuthStore] Failed to read token file: ${err.message}`);
    }
    return {};
  }

  private _readAllSync(): Record<string, string> {
    try {
      if (fs.existsSync(this.filePath)) {
        return JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
      }
    } catch {}
    return {};
  }

  private async _writeAll(data: Record<string, string>): Promise<void> {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), { encoding: 'utf-8', mode: 0o600 });
  }

  private _encrypt(text: string): string {
    // Simple XOR obfuscation — production should use Electron safeStorage
    let result = '';
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(text.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length));
    }
    return Buffer.from(result, 'utf-8').toString('base64');
  }

  private _decrypt(encrypted: string): string {
    try {
      const decoded = Buffer.from(encrypted, 'base64').toString('utf-8');
      let result = '';
      for (let i = 0; i < decoded.length; i++) {
        result += String.fromCharCode(decoded.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length));
      }
      return result;
    } catch {
      return '';
    }
  }
}
