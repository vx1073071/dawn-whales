// T66: Feature Flag Service
export interface FeatureFlag {
  key: string;
  enabled: boolean;
  description: string;
  rolloutPercent?: number; // 0-100 gradual rollout
  targetUsers?: string[]; // specific user IDs
  targetVersions?: string[]; // min app versions
}

export class FeatureFlags {
  private flags = new Map<string, FeatureFlag>();
  private overrides = new Map<string, boolean>();

  register(flag: FeatureFlag): void {
    this.flags.set(flag.key, flag);
  }

  isEnabled(key: string, context?: { userId?: string; appVersion?: string }): boolean {
    // Check manual override first
    if (this.overrides.has(key)) {
      return this.overrides.get(key)!;
    }

    const flag = this.flags.get(key);
    if (!flag) return false;

    // Target user override
    if (context?.userId && flag.targetUsers?.includes(context.userId)) {
      return true;
    }

    // Version gate
    if (context?.appVersion && flag.targetVersions) {
      const meets = flag.targetVersions.some(v =>
        this._compareVersions(context.appVersion!, v) >= 0
      );
      if (!meets) return false;
    }

    // Gradual rollout
    if (flag.rolloutPercent !== undefined && flag.rolloutPercent < 100 && context?.userId) {
      const hash = this._hashString(context.userId);
      return (hash % 100) < flag.rolloutPercent;
    }

    return flag.enabled;
  }

  override(key: string, enabled: boolean): void {
    this.overrides.set(key, enabled);
  }

  clearOverride(key: string): void {
    this.overrides.delete(key);
  }

  getAll(): FeatureFlag[] {
    return Array.from(this.flags.values());
  }

  getEnabled(context?: { userId?: string; appVersion?: string }): string[] {
    return Array.from(this.flags.keys()).filter(k => this.isEnabled(k, context));
  }

  private _compareVersions(v1: string, v2: string): number {
    const a = v1.split('.').map(Number);
    const b = v2.split('.').map(Number);
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const diff = (a[i] || 0) - (b[i] || 0);
      if (diff !== 0) return diff;
    }
    return 0;
  }

  private _hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }
}

export const featureFlags = new FeatureFlags();
