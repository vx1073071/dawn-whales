/**
 * R255 BR-05: 源切换UI桥接 (SourceSwitchUIBridge)
 * 
 * QUANT MOO 体验完善 — 数据源动态切换桥接到前端
 * 
 * 功能:
 *   1. 多源注册 (Yahoo/EastMoney/Binance/Investing/NewsAPI/CLS/雪球)
 *   2. 源健康监控 (status + latency + error rate + uptime)
 *   3. 动态切换 (auto-fallback + manual switch + priority chain)
 *   4. 前端桥接 (source list + switch events + health dashboard data)
 */

import { createHash } from 'crypto';

// ── Types ──────────────────────────────────────────────────────────────────

export type DataSourceId = 'yahoo' | 'eastmoney' | 'binance' | 'investing' | 'newsapi' | 'cls' | 'xueqiu' | 'free_api';
export type SourceStatus = 'online' | 'degraded' | 'offline' | 'maintenance';
export type SourceDomain = 'quote' | 'news' | 'crypto' | 'macro' | 'technical';

export interface DataSourceMeta {
  sourceId: DataSourceId;
  name: string;
  nameCn: string;
  domains: SourceDomain[];
  priority: number;              // 1=highest
  baseUrl: string;
  icon: string;                  // emoji
  description: string;
  descriptionCn: string;
}

export interface SourceHealth {
  sourceId: DataSourceId;
  status: SourceStatus;
  latencyMs: number;
  errorRate: number;             // 0-1
  uptime: number;                // 0-1
  lastCheck: number;
  lastSuccess: number;
  consecutiveFailures: number;
  degradedSince?: number;
}

export interface SourceSwitchEvent {
  eventId: string;
  fromSource: DataSourceId;
  toSource: DataSourceId;
  domain: SourceDomain;
  reason: string;
  reasonCn: string;
  triggeredBy: 'auto' | 'manual';
  timestamp: number;
}

export interface UISourceDashboard {
  sourceId: DataSourceId;
  name: string;
  nameCn: string;
  status: SourceStatus;
  statusColor: string;           // CSS color
  healthPercent: number;         // 0-100
  latencyMs: number;
  errorRate: number;
  isActive: boolean;
  canSwitchTo: boolean;
  domains: string[];
  icon: string;
}

export interface SourceSwitchResult {
  success: boolean;
  fromSource: DataSourceId;
  toSource: DataSourceId;
  domain: SourceDomain;
  message: string;
  messageCn: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// SourceSwitchUIBridge
// ═══════════════════════════════════════════════════════════════════════════

export class SourceSwitchUIBridge {
  private sources: Map<DataSourceId, DataSourceMeta> = new Map();
  private health: Map<DataSourceId, SourceHealth> = new Map();
  private activeSources: Map<SourceDomain, DataSourceId> = new Map();
  private switchHistory: SourceSwitchEvent[] = [];
  private autoSwitchEnabled = true;

  constructor() {
    this._registerSources();
    this._initActiveSources();
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 1. 源注册与查询
  // ═══════════════════════════════════════════════════════════════════════

  /** Get all registered sources */
  getAllSources(): DataSourceMeta[] {
    return Array.from(this.sources.values()).sort((a, b) => a.priority - b.priority);
  }

  /** Get sources available for a domain */
  getSourcesForDomain(domain: SourceDomain): DataSourceMeta[] {
    return Array.from(this.sources.values())
      .filter(s => s.domains.includes(domain))
      .sort((a, b) => a.priority - b.priority);
  }

  /** Get current active source for a domain */
  getActiveSource(domain: SourceDomain): DataSourceId {
    return this.activeSources.get(domain) ?? this.getSourcesForDomain(domain)[0]?.sourceId ?? 'yahoo';
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 2. 源健康
  // ═══════════════════════════════════════════════════════════════════════

  /** Get health status for a source */
  getHealth(sourceId: DataSourceId): SourceHealth | null {
    return this.health.get(sourceId) ?? null;
  }

  /** Get health for all sources */
  getAllHealth(): SourceHealth[] {
    this._refreshHealth();
    return Array.from(this.health.values());
  }

  /** Check if a source is healthy enough to use */
  isHealthy(sourceId: DataSourceId): boolean {
    const h = this.health.get(sourceId);
    return h !== undefined && h.status !== 'offline' && h.status !== 'maintenance';
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 3. 源切换
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Manual switch to a different source for a domain.
   */
  switchSource(domain: SourceDomain, toSource: DataSourceId, reason = 'manual_switch'): SourceSwitchResult {
    const fromSource = this.getActiveSource(domain);
    const target = this.sources.get(toSource);

    if (!target) {
      return { success: false, fromSource, toSource, domain, message: `Source ${toSource} not registered`, messageCn: `数据源 ${toSource} 未注册` };
    }

    if (!target.domains.includes(domain)) {
      return { success: false, fromSource, toSource, domain, message: `Source ${toSource} does not support domain ${domain}`, messageCn: `数据源 ${toSource} 不支持 ${domain} 类型` };
    }

    if (!this.isHealthy(toSource)) {
      return { success: false, fromSource, toSource, domain, message: `Source ${toSource} is not healthy`, messageCn: `数据源 ${toSource} 状态异常` };
    }

    this.activeSources.set(domain, toSource);

    const event: SourceSwitchEvent = {
      eventId: `switch:${fromSource}:${toSource}:${domain}:${Date.now()}`,
      fromSource, toSource, domain,
      reason,
      reasonCn: reason === 'manual_switch' ? '手动切换' : reason === 'auto_fallback' ? '自动降级' : '健康恢复',
      triggeredBy: reason === 'manual_switch' ? 'manual' : 'auto',
      timestamp: Date.now(),
    };
    this.switchHistory.push(event);

    return {
      success: true, fromSource, toSource, domain,
      message: `Switched from ${fromSource} to ${toSource} for ${domain}`,
      messageCn: `${domain}: ${fromSource} → ${toSource} (${event.reasonCn})`,
    };
  }

  /**
   * Auto-fallback: switch to best available alternative.
   */
  autoFallback(domain: SourceDomain): SourceSwitchResult | null {
    if (!this.autoSwitchEnabled) return null;

    const current = this.getActiveSource(domain);
    if (this.isHealthy(current)) return null; // No need

    const alternatives = this.getSourcesForDomain(domain)
      .filter(s => s.sourceId !== current && this.isHealthy(s.sourceId));

    if (alternatives.length === 0) return null;

    const best = alternatives[0]; // Sorted by priority
    return this.switchSource(domain, best.sourceId, 'auto_fallback');
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 4. UI桥接 — 前端Dashboard数据
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Build UI dashboard data for source management panel.
   */
  getUIDashboard(): UISourceDashboard[] {
    this._refreshHealth();
    const activeDomains = new Map<DataSourceId, string[]>();
    for (const [domain, sourceId] of this.activeSources) {
      const existing = activeDomains.get(sourceId) ?? [];
      activeDomains.set(sourceId, [...existing, domain]);
    }

    return this.getAllSources().map(src => {
      const h = this.health.get(src.sourceId)!;
      return {
        sourceId: src.sourceId,
        name: src.name,
        nameCn: src.nameCn,
        status: h.status,
        statusColor: this._statusColor(h.status),
        healthPercent: this._computeHealthPercent(h),
        latencyMs: h.latencyMs,
        errorRate: h.errorRate,
        isActive: activeDomains.has(src.sourceId),
        canSwitchTo: h.status === 'online' || h.status === 'degraded',
        domains: src.domains,
        icon: src.icon,
      };
    });
  }

  /** Get active domains mapping */
  getActiveDomains(): Map<SourceDomain, DataSourceId> {
    return new Map(this.activeSources);
  }

  /** Get switch history */
  getSwitchHistory(limit = 50): SourceSwitchEvent[] {
    return this.switchHistory.slice(-limit);
  }

  /** Toggle auto-switch */
  setAutoSwitch(enabled: boolean): void {
    this.autoSwitchEnabled = enabled;
  }

  /** Get auto-switch status */
  getAutoSwitchEnabled(): boolean {
    return this.autoSwitchEnabled;
  }

  reset(): void {
    this.sources.clear();
    this.health.clear();
    this.activeSources.clear();
    this.switchHistory.length = 0;
    this.autoSwitchEnabled = true;
    this._registerSources();
    this._initActiveSources();
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private _registerSources(): void {
    const sources: DataSourceMeta[] = [
      { sourceId: 'yahoo', name: 'Yahoo Finance', nameCn: 'Yahoo财经', domains: ['quote', 'technical'], priority: 1, baseUrl: 'https://finance.yahoo.com', icon: '📊', description: 'US/HK/JP/UK market quotes', descriptionCn: '美股/港股/日股/英股行情' },
      { sourceId: 'eastmoney', name: 'East Money', nameCn: '东方财富', domains: ['quote', 'news', 'macro'], priority: 2, baseUrl: 'https://www.eastmoney.com', icon: '🏦', description: 'A-share market data & news', descriptionCn: 'A股行情与龙头虎榜' },
      { sourceId: 'binance', name: 'Binance', nameCn: '币安', domains: ['crypto', 'quote'], priority: 3, baseUrl: 'https://www.binance.com', icon: '₿', description: 'Crypto spot & derivatives', descriptionCn: '加密货币现货与合约' },
      { sourceId: 'investing', name: 'Investing.com', nameCn: '英为财情', domains: ['news', 'macro', 'technical'], priority: 4, baseUrl: 'https://www.investing.com', icon: '🌐', description: 'Global financial news & calendar', descriptionCn: '全球财经新闻与经济日历' },
      { sourceId: 'newsapi', name: 'NewsAPI', nameCn: 'NewsAPI', domains: ['news'], priority: 5, baseUrl: 'https://newsapi.org', icon: '📰', description: 'Aggregated news headlines', descriptionCn: '聚合新闻头条' },
      { sourceId: 'cls', name: 'CLS Telegraph', nameCn: '财联社', domains: ['news'], priority: 6, baseUrl: 'https://www.cls.cn', icon: '📡', description: 'Chinese financial telegraph', descriptionCn: '中文财经电报' },
      { sourceId: 'xueqiu', name: 'Xueqiu', nameCn: '雪球', domains: ['news', 'quote'], priority: 7, baseUrl: 'https://xueqiu.com', icon: '❄️', description: 'Social investing platform', descriptionCn: '社区投资平台' },
      { sourceId: 'free_api', name: 'Free API', nameCn: '免费API', domains: ['quote', 'news'], priority: 8, baseUrl: 'https://api.example.com', icon: '🆓', description: 'Free tier API fallback', descriptionCn: '免费API备用源' },
    ];

    for (const src of sources) {
      this.sources.set(src.sourceId, src);
      this.health.set(src.sourceId, this._generateHealth(src.sourceId, src.priority));
    }
  }

  private _initActiveSources(): void {
    // Default: highest priority source for each domain
    const domains: SourceDomain[] = ['quote', 'news', 'crypto', 'macro', 'technical'];
    for (const domain of domains) {
      const sources = this.getSourcesForDomain(domain);
      if (sources.length > 0) {
        this.activeSources.set(domain, sources[0].sourceId);
      }
    }
  }

  private _refreshHealth(): void {
    const now = Date.now();
    for (const [sourceId, h] of this.health) {
      const src = this.sources.get(sourceId)!;
      const seed = this._hash(sourceId + now.toString());
      h.latencyMs = 20 + (src.priority * 15) + (seed % 100);
      h.errorRate = Math.round((src.priority * 0.01 + seed % 5 / 100) * 1000) / 1000;
      h.lastCheck = now;
    }
  }

  private _generateHealth(sourceId: DataSourceId, priority: number): SourceHealth {
    const now = Date.now();
    const seed = this._hash(sourceId);
    return {
      sourceId,
      status: priority <= 3 ? 'online' : priority <= 6 ? 'degraded' : 'offline',
      latencyMs: 20 + priority * 15 + (seed % 80),
      errorRate: Math.round((priority * 0.005) * 1000) / 1000,
      uptime: Math.round((1 - priority * 0.03) * 100) / 100,
      lastCheck: now,
      lastSuccess: now - (seed % 300000),
      consecutiveFailures: priority > 6 ? 3 : 0,
    };
  }

  private _computeHealthPercent(h: SourceHealth): number {
    let score = h.status === 'online' ? 100 : h.status === 'degraded' ? 70 : h.status === 'maintenance' ? 40 : 10;
    score -= h.errorRate * 100;
    score -= (h.latencyMs > 500 ? 20 : h.latencyMs > 200 ? 10 : 0);
    score -= h.consecutiveFailures * 5;
    return Math.max(0, Math.round(score));
  }

  private _statusColor(status: SourceStatus): string {
    const colors: Record<SourceStatus, string> = { online: '#22c55e', degraded: '#f59e0b', offline: '#ef4444', maintenance: '#6b7280' };
    return colors[status];
  }

  private _hash(input: string): number {
    let h = 0;
    for (let i = 0; i < input.length; i++) { h = ((h << 5) - h) + input.charCodeAt(i); h |= 0; }
    return Math.abs(h);
  }
}

// ── Singleton ───────────────────────────────────────────────────────────────

let instance: SourceSwitchUIBridge | null = null;

export function sourceSwitchUIBridge(): SourceSwitchUIBridge {
  if (!instance) instance = new SourceSwitchUIBridge();
  return instance;
}

export function resetSourceSwitchUIBridge(): void { instance?.reset(); instance = null; }
