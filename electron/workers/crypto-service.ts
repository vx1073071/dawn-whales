// T53: AES-256-GCM Encryption Service
import * as crypto from 'crypto';
import { EngineError, ErrorDomain, ErrorCode } from '../engine/core/engine-error';


const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const KEY_LENGTH = 32;
const PBKDF2_ITERATIONS = 100000;

export class CryptoService {
  private masterKey: Buffer | null = null;

  async init(password: string, salt?: Buffer): Promise<void> {
    const s = salt || crypto.randomBytes(SALT_LENGTH);
    this.masterKey = crypto.pbkdf2Sync(password, s, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha512');
  }

  encrypt(plaintext: string): { iv: string; ciphertext: string; authTag: string } {
    if (!this.masterKey) throw new EngineError(ErrorDomain.AUTH, ErrorCode.UNAUTHORIZED, 'CryptoService not initialized');
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.masterKey, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    return {
      iv: iv.toString('hex'),
      ciphertext: encrypted,
      authTag: authTag.toString('hex'),
    };
  }

  decrypt(iv: string, ciphertext: string, authTag: string): string {
    if (!this.masterKey) throw new EngineError(ErrorDomain.AUTH, ErrorCode.UNAUTHORIZED, 'CryptoService not initialized');
    const decipher = crypto.createDecipheriv(ALGORITHM, this.masterKey, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  encryptObject<T extends Record<string, any>>(obj: T): string {
    return JSON.stringify({
      payload: this.encrypt(JSON.stringify(obj)),
      _v: 1,
    });
  }

  decryptObject<T>(encrypted: string): T {
    const wrapper = JSON.parse(encrypted);
    return JSON.parse(this.decrypt(
      wrapper.payload.iv,
      wrapper.payload.ciphertext,
      wrapper.payload.authTag
    ));
  }

  generateKey(): string {
    return crypto.randomBytes(KEY_LENGTH).toString('hex');
  }

  hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  hmac(data: string, key?: string): string {
    const k = key || (this.masterKey ? this.masterKey.toString('hex') : '');
    return crypto.createHmac('sha256', k).update(data).digest('hex');
  }
}

export const cryptoService = new CryptoService();
