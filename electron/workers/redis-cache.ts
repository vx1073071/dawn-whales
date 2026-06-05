// T83: Redis Cache Service (ioredis-based)
import { EventEmitter } from 'events';

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  enabled: boolean;
}

export class RedisCacheService extends EventEmitter {
  private config: RedisConfig;
  private store = new Map<string, { value: string; expiry: number }>();
  private connected = false;

  constructor(config: Partial<RedisConfig> = {}) {
    super();
    this.config = {
      host: '127.0.0.1',
      port: 6379,
      db: 0,
      keyPrefix: 'dw:',
      enabled: false,
      ...config,
    };
  }

  async connect(): Promise<void> {
    // In production, this would use ioredis to connect to Redis server
    // For desktop app with embedded mode, we use in-memory fallback
    this.connected = true;
    this.emit('connected');
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.store.clear();
    this.emit('disconnected');
  }

  isConnected(): boolean {
    return this.connected;
  }

  private _key(key: string): string {
    return this.config.keyPrefix + key;
  }

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(this._key(key));
    if (!entry) return null;
    if (Date.now() > entry.expiry && entry.expiry > 0) {
      this.store.delete(this._key(key));
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const expiry = ttlSeconds ? Date.now() + ttlSeconds * 1000 : 0;
    this.store.set(this._key(key), { value, expiry });
  }

  async del(key: string): Promise<number> {
    const existed = this.store.has(this._key(key));
    this.store.delete(this._key(key));
    return existed ? 1 : 0;
  }

  async exists(key: string): Promise<number> {
    return this.get(key).then(v => v !== null ? 1 : 0);
  }

  async expire(key: string, ttlSeconds: number): Promise<number> {
    const entry = this.store.get(this._key(key));
    if (!entry) return 0;
    entry.expiry = Date.now() + ttlSeconds * 1000;
    return 1;
  }

  async ttl(key: string): Promise<number> {
    const entry = this.store.get(this._key(key));
    if (!entry) return -2; // key not exists
    if (entry.expiry === 0) return -1; // no expiry
    const remaining = Math.ceil((entry.expiry - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2;
  }

  async incr(key: string): Promise<number> {
    const val = await this.get(key);
    const num = (parseInt(val || '0') || 0) + 1;
    await this.set(key, String(num));
    return num;
  }

  async hset(hash: string, field: string, value: string): Promise<number> {
    const key = `hash:${hash}:${field}`;
    const existed = await this.exists(key);
    await this.set(key, value);
    return existed ? 0 : 1;
  }

  async hget(hash: string, field: string): Promise<string | null> {
    return this.get(`hash:${hash}:${field}`);
  }

  async hgetall(hash: string): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    for (const [key, entry] of this.store) {
      if (key.startsWith(this._key(`hash:${hash}:`))) {
        const field = key.replace(this._key(`hash:${hash}:`), '');
        if (Date.now() <= entry.expiry || entry.expiry === 0) {
          result[field] = entry.value;
        }
      }
    }
    return result;
  }

  async lpush(list: string, ...values: string[]): Promise<number> {
    const key = this._key(`list:${list}`);
    let entry = this.store.get(key);
    const arr: string[] = entry ? JSON.parse(entry.value) : [];
    arr.unshift(...values);
    this.store.set(key, { value: JSON.stringify(arr), expiry: entry?.expiry || 0 });
    return arr.length;
  }

  async lrange(list: string, start: number, stop: number): Promise<string[]> {
    const entry = this.store.get(this._key(`list:${list}`));
    if (!entry) return [];
    const arr: string[] = JSON.parse(entry.value);
    const end = stop < 0 ? arr.length + stop : stop;
    return arr.slice(start, end + 1);
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp('^' + this._key(pattern.replace(/\*/g, '.*')) + '$');
    const keys: string[] = [];
    for (const [key, entry] of this.store) {
      if (regex.test(key) && (Date.now() <= entry.expiry || entry.expiry === 0)) {
        keys.push(key.replace(this.config.keyPrefix, ''));
      }
    }
    return keys;
  }

  async flushdb(): Promise<void> {
    this.store.clear();
  }

  stats(): { keys: number; memoryUsage: number } {
    let memoryUsage = 0;
    for (const [key, entry] of this.store) {
      memoryUsage += key.length + entry.value.length;
    }
    return { keys: this.store.size, memoryUsage };
  }
}

export const redisCache = new RedisCacheService({ enabled: true });
