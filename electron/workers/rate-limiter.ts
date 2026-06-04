// T54: Token Bucket Rate Limiter
interface Bucket {
  tokens: number;
  lastRefill: number;
}

export class RateLimiter {
  private buckets = new Map<string, Bucket>();
  private maxTokens: number;
  private refillRate: number; // tokens per second
  private refillInterval: number; // ms

  constructor(maxTokens = 10, refillRate = 2) {
    this.maxTokens = maxTokens;
    this.refillRate = refillRate;
    this.refillInterval = 1000;
  }

  async acquire(key: string, tokens = 1): Promise<boolean> {
    let bucket = this.buckets.get(key);
    const now = Date.now();

    if (!bucket) {
      bucket = { tokens: this.maxTokens, lastRefill: now };
      this.buckets.set(key, bucket);
    }

    this._refill(bucket, now);

    if (bucket.tokens >= tokens) {
      bucket.tokens -= tokens;
      return true;
    }

    return false;
  }

  async waitForToken(key: string, maxWaitMs = 5000): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      const ok = await this.acquire(key);
      if (ok) return true;
      await new Promise(r => setTimeout(r, 100));
    }
    return false;
  }

  private _refill(bucket: Bucket, now: number): void {
    const elapsed = (now - bucket.lastRefill) / 1000;
    bucket.tokens = Math.min(
      this.maxTokens,
      bucket.tokens + elapsed * this.refillRate
    );
    bucket.lastRefill = now;
  }

  getTokens(key: string): number {
    return this.buckets.get(key)?.tokens ?? this.maxTokens;
  }

  reset(key: string): void {
    this.buckets.delete(key);
  }

  resetAll(): void {
    this.buckets.clear();
  }
}

export const apiRateLimiter = new RateLimiter(30, 5); // 30 burst, 5/s refill
export const authRateLimiter = new RateLimiter(5, 0.5); // 5 burst, 0.5/s
