// T69: Application Version Checker
export interface VersionInfo {
  current: string;
  latest: string;
  hasUpdate: boolean;
  releaseDate?: string;
  releaseNotes?: string;
  downloadUrl?: string;
  required: boolean; // force update if true
}

export interface UpdateCheckResult {
  checkedAt: number;
  info: VersionInfo;
  fromCache: boolean;
}

export class VersionChecker {
  private currentVersion: string;
  private checkUrl: string;
  private lastCheck: number = 0;
  private cacheTTL: number;
  private cachedInfo: VersionInfo | null = null;

  constructor(currentVersion: string, checkUrl: string, cacheTTLMs = 3600000) {
    this.currentVersion = currentVersion;
    this.checkUrl = checkUrl;
    this.cacheTTL = cacheTTLMs;
  }

  async check(): Promise<UpdateCheckResult> {
    const now = Date.now();

    if (this.cachedInfo && now - this.lastCheck < this.cacheTTL) {
      return { checkedAt: this.lastCheck, info: this.cachedInfo, fromCache: true };
    }

    let info: VersionInfo;
    try {
      const response = await fetch(this.checkUrl);
      const data = await response.json();
      info = this._parse(data);
    } catch {
      // Offline or error — assume no update
      info = {
        current: this.currentVersion,
        latest: this.currentVersion,
        hasUpdate: false,
        required: false,
      };
    }

    this.cachedInfo = info;
    this.lastCheck = now;
    return { checkedAt: now, info, fromCache: false };
  }

  private _parse(data: any): VersionInfo {
    const latest = data.version || data.tag_name?.replace('v', '') || '0.0.0';
    return {
      current: this.currentVersion,
      latest,
      hasUpdate: this._compareVersions(latest, this.currentVersion) > 0,
      releaseDate: data.published_at || data.created_at,
      releaseNotes: data.body || data.notes,
      downloadUrl: data.download_url || data.assets?.[0]?.browser_download_url,
      required: data.required || false,
    };
  }

  private _compareVersions(v1: string, v2: string): number {
    const a = v1.replace(/[^\d.]/g, '').split('.').map(Number);
    const b = v2.replace(/[^\d.]/g, '').split('.').map(Number);
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const diff = (a[i] || 0) - (b[i] || 0);
      if (diff !== 0) return diff;
    }
    return 0;
  }

  requiresRestart(info: VersionInfo): boolean {
    return info.hasUpdate && (
      info.latest.split('.')[0] !== this.currentVersion.split('.')[0] || // major version
      info.required
    );
  }
}
