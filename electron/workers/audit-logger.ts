// T63: Immutable Audit Logger
export type AuditAction =
  | 'user.login'
  | 'user.logout'
  | 'strategy.create'
  | 'strategy.update'
  | 'strategy.delete'
  | 'strategy.start'
  | 'strategy.stop'
  | 'order.place'
  | 'order.cancel'
  | 'order.mofify'
  | 'config.change'
  | 'system.startup'
  | 'system.shutdown';

export interface AuditEntry {
  id: string;
  timestamp: number;
  action: AuditAction;
  actor: string;
  details: Record<string, any>;
  ip?: string;
  success: boolean;
}

export type AuditHandler = (entry: AuditEntry) => void;

export class AuditLogger {
  private entries: AuditEntry[] = [];
  private handlers: AuditHandler[] = [];
  private maxEntries: number;

  constructor(maxEntries = 1000) {
    this.maxEntries = maxEntries;
  }

  log(action: AuditAction, actor: string, details: Record<string, any>, success = true, ip?: string): AuditEntry {
    const entry: AuditEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      action,
      actor,
      details,
      ip,
      success,
    };
    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }
    for (const h of this.handlers) {
      try { h(entry); } catch (e) { /* silent */ }
    }
    return entry;
  }

  subscribe(handler: AuditHandler): () => void {
    this.handlers.push(handler);
    return () => { this.handlers = this.handlers.filter(h => h !== handler); };
  }

  query(options: {
    action?: AuditAction;
    actor?: string;
    from?: number;
    to?: number;
    success?: boolean;
    limit?: number;
  }): AuditEntry[] {
    let result = [...this.entries];
    if (options.action) result = result.filter(e => e.action === options.action);
    if (options.actor) result = result.filter(e => e.actor === options.actor);
    if (options.from) result = result.filter(e => e.timestamp >= options.from!);
    if (options.to) result = result.filter(e => e.timestamp <= options.to!);
    if (options.success !== undefined) result = result.filter(e => e.success === options.success);
    result = result.reverse(); // newest first
    if (options.limit) result = result.slice(0, options.limit);
    return result;
  }

  export(format: 'json' | 'csv'): string {
    if (format === 'json') {
      return JSON.stringify(this.entries, null, 2);
    }
    const header = 'id,timestamp,action,actor,success';
    const rows = this.entries.map(e =>
      `${e.id},${e.timestamp},${e.action},${e.actor},${e.success}`
    );
    return [header, ...rows].join('\n');
  }

  clear(): void {
    this.entries = [];
  }
}

export const auditLog = new AuditLogger();
