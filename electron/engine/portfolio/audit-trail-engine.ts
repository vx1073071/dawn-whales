/**
 * Audit Trail Enhancement - audit
 * D-49-NEW [P0] - youdao
 * 
 * :
 * - audit
 * - (hash)
 * - audit logquery (< 100ms)
 * - query
 * 
 * :
 * - >= 800L
 * - queryresponse < 100ms
 *
 */

import log from 'electron-log';
import { EngineError, ErrorCode } from '../../errors';

// Node.js crypto — use require() to bypass vitest/jsdom Web Crypto API resolution
// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-explicit-any
const _crypto = typeof require !== 'undefined' ? require('crypto') : (globalThis as any).crypto;

// ── Types ──────────────────────────────────────────────────────────────────

export type AuditAction = 
  | 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT'
  | 'STRATEGY_CREATE' | 'STRATEGY_UPDATE' | 'STRATEGY_DELETE'
  | 'BACKTEST_RUN' | 'OPTIMIZATION_RUN'
  | 'SUBSCRIBE' | 'UNSUBSCRIBE' | 'PUBLISH'
  | 'RISK_ALERT' | 'COMPLIANCE_CHECK';

export type AuditSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface AuditLog {
  id: string;
  timestamp: number;
  userId: string;
  action: AuditAction;
  resource: string;
  resourceId: string;
  severity: AuditSeverity;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details: Record<string, any>;
  previousHash: string;
  currentHash: string;
  signature: string;
}

export interface AuditQuery {
  startDate?: number;
  endDate?: number;
  userId?: string;
  action?: AuditAction;
  resource?: string;
  resourceId?: string;
  severity?: AuditSeverity;
  limit?: number;
  offset?: number;
}

export interface AuditQueryResult {
  logs: AuditLog[];
  total: number;
  queryTime: number;
}

export interface AuditStats {
  totalLogs: number;
  logsByAction: Record<AuditAction, number>;
  logsBySeverity: Record<AuditSeverity, number>;
  logsByUser: Record<string, number>;
  firstLogTime: number;
  lastLogTime: number;
}

export interface AuditConfig {
  enabled: boolean;
  retentionDays: number;
  hashAlgorithm: string;
  signatureEnabled: boolean;
  maxQueryLimit: number;
}

// ── Audit Trail Engine ─────────────────────────────────────────────────────

export class AuditTrailEngine {
  private logs: AuditLog[] = [];
  private logsByUser: Map<string, AuditLog[]> = new Map();
  private logsByAction: Map<AuditAction, AuditLog[]> = new Map();
  private logsByResource: Map<string, AuditLog[]> = new Map();
  private lastHash: string = '0'.repeat(64);
  private config: AuditConfig;
  private privateKey: string;
  private logger = log;

  constructor(config?: Partial<AuditConfig>) {
    this.config = {
      enabled: true,
      retentionDays: 90,
      hashAlgorithm: 'sha256',
      signatureEnabled: true,
      maxQueryLimit: 1000,
      ...config,
    };

 // sign
    this.privateKey = _crypto.randomBytes(32).toString('hex');

    log.info('[AuditTrailEngine] Initialized', {
      enabled: this.config.enabled,
      retentionDays: this.config.retentionDays,
    });
  }

  // ── Log Creation ─────────────────────────────────────────────────────────

  /**
 * audit log
   */
  log(
    userId: string,
    action: AuditAction,
    resource: string,
    resourceId: string,
    severity: AuditSeverity = 'INFO',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    details: Record<string, any> = {}
  ): AuditLog {
    if (!this.config.enabled) {
      throw new EngineError(ErrorCode.AI_QUERY_FAILED, 'Audit trail is disabled');
    }

    const timestamp = Date.now();
    const id = this.generateId();

 // hash
    const previousHash = this.lastHash;
    const currentHash = this.calculateHash(timestamp, userId, action, resource, resourceId, previousHash);

 // sign
    const signature = this.config.signatureEnabled
      ? this.sign(currentHash)
      : '';

    const auditLog: AuditLog = {
      id,
      timestamp,
      userId,
      action,
      resource,
      resourceId,
      severity,
      details,
      previousHash,
      currentHash,
      signature,
    };

 // log
    this.logs.push(auditLog);
    this.lastHash = currentHash;

    // updateindex
    this.updateIndexes(auditLog);

    log.info('[AuditTrailEngine] Log recorded', {
      id,
      userId,
      action,
      resource,
      resourceId,
    });

    return auditLog;
  }

  /**
 * ID
   */
  private generateId(): string {
    return `audit_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
 * hash
   */
  private calculateHash(
    timestamp: number,
    userId: string,
    action: string,
    resource: string,
    resourceId: string,
    previousHash: string
  ): string {
    const data = `${timestamp}:${userId}:${action}:${resource}:${resourceId}:${previousHash}`;
    return crypto
      .createHash(this.config.hashAlgorithm)
      .update(data)
      .digest('hex');
  }

  /**
 * sign
   */
  private sign(hash: string): string {
    return crypto
      .createHmac('sha256', this.privateKey)
      .update(hash)
      .digest('hex');
  }

  /**
 * sign
   */
  verifySignature(log: AuditLog): boolean {
    if (!this.config.signatureEnabled) {
      return true;
    }

    const expectedSignature = this.sign(log.currentHash);
    return log.signature === expectedSignature;
  }

  /**
 * hash
   */
  verifyChain(): boolean {
    let previousHash = '0'.repeat(64);

    for (const entry of this.logs) {
      if (entry.previousHash !== previousHash) {
        this.logger.error('[AuditTrailEngine] Chain verification failed', {
          logId: entry.id,
          expected: previousHash,
          actual: entry.previousHash,
        });
        return false;
      }

      const expectedHash = this.calculateHash(
        entry.timestamp,
        entry.userId,
        entry.action,
        entry.resource,
        entry.resourceId,
        entry.previousHash
      );

      if (entry.currentHash !== expectedHash) {
        this.logger.error('[AuditTrailEngine] Hash verification failed', {
          logId: entry.id,
          expected: expectedHash,
          actual: entry.currentHash,
        });
        return false;
      }

      previousHash = entry.currentHash;
    }

    this.logger.info('[AuditTrailEngine] Chain verification passed', {
      totalLogs: this.logs.length,
    });

    return true;
  }

  /**
   * updateindex
   */
  private updateIndexes(auditLog: AuditLog): void {
 // userindex
    if (!this.logsByUser.has(auditLog.userId)) {
      this.logsByUser.set(auditLog.userId, []);
    }
    this.logsByUser.get(auditLog.userId)!.push(auditLog);

 // index
    if (!this.logsByAction.has(auditLog.action)) {
      this.logsByAction.set(auditLog.action, []);
    }
    this.logsByAction.get(auditLog.action)!.push(auditLog);

 // index
    const resourceKey = `${auditLog.resource}:${auditLog.resourceId}`;
    if (!this.logsByResource.has(resourceKey)) {
      this.logsByResource.set(resourceKey, []);
    }
    this.logsByResource.get(resourceKey)!.push(auditLog);
  }

  // ── Query ────────────────────────────────────────────────────────────────

  /**
   * queryaudit log
   */
  query(query: AuditQuery): AuditQueryResult {
    const startTime = Date.now();

    let results = this.logs;

 //
    if (query.startDate) {
      results = results.filter(log => log.timestamp >= query.startDate!);
    }
    if (query.endDate) {
      results = results.filter(log => log.timestamp <= query.endDate!);
    }

 // user
    if (query.userId) {
      results = results.filter(log => log.userId === query.userId);
    }

 //
    if (query.action) {
      results = results.filter(log => log.action === query.action);
    }

 //
    if (query.resource) {
      results = results.filter(log => log.resource === query.resource);
    }
    if (query.resourceId) {
      results = results.filter(log => log.resourceId === query.resourceId);
    }

 //
    if (query.severity) {
      results = results.filter(log => log.severity === query.severity);
    }

 // sort ()
    results = results.sort((a, b) => b.timestamp - a.timestamp);

 //
    const total = results.length;

    // pagination
    const offset = query.offset || 0;
    const limit = Math.min(query.limit || 100, this.config.maxQueryLimit);
    results = results.slice(offset, offset + limit);

    const queryTime = Date.now() - startTime;

    log.info('[AuditTrailEngine] Query executed', {
      queryTime,
      total,
      returned: results.length,
    });

    return {
      logs: results,
      total,
      queryTime,
    };
  }

  /**
 * ID log
   */
  getById(id: string): AuditLog | null {
    return this.logs.find(log => log.id === id) || null;
  }

  /**
 * log
   */
  getByResource(resource: string, resourceId: string): AuditLog[] {
    const key = `${resource}:${resourceId}`;
    return this.logsByResource.get(key) || [];
  }

  /**
 * userlog
   */
  getByUser(userId: string): AuditLog[] {
    return this.logsByUser.get(userId) || [];
  }

  // ── Statistics ───────────────────────────────────────────────────────────

  /**
 * info
   */
  getStats(): AuditStats {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const logsByAction: Record<AuditAction, number> = {} as any;
    for (const [action, logs] of this.logsByAction.entries()) {
      logsByAction[action] = logs.length;
    }

    const logsBySeverity: Record<AuditSeverity, number> = {
      INFO: 0,
      WARNING: 0,
      CRITICAL: 0,
    };
    for (const log of this.logs) {
      logsBySeverity[log.severity]++;
    }

    const logsByUser: Record<string, number> = {};
    for (const [userId, logs] of this.logsByUser.entries()) {
      logsByUser[userId] = logs.length;
    }

    return {
      totalLogs: this.logs.length,
      logsByAction,
      logsBySeverity,
      logsByUser,
      firstLogTime: this.logs.length > 0 ? this.logs[0].timestamp : 0,
      lastLogTime: this.logs.length > 0 ? this.logs[this.logs.length - 1].timestamp : 0,
    };
  }

  // ── Maintenance ──────────────────────────────────────────────────────────

  /**
 * expirylog
   */
  cleanup(): number {
    const cutoffTime = Date.now() - (this.config.retentionDays * 24 * 60 * 60 * 1000);
    const beforeCount = this.logs.length;

    this.logs = this.logs.filter(log => log.timestamp > cutoffTime);

 // index
    this.logsByUser.clear();
    this.logsByAction.clear();
    this.logsByResource.clear();
    for (const log of this.logs) {
      this.updateIndexes(log);
    }

    const removedCount = beforeCount - this.logs.length;

    log.info('[AuditTrailEngine] Cleanup completed', {
      removed: removedCount,
      remaining: this.logs.length,
    });

    return removedCount;
  }

  /**
   * exportlog
   */
  export(format: 'json' | 'csv' = 'json'): string {
    if (format === 'json') {
      return JSON.stringify(this.logs, null, 2);
    }

 // CSV 
    const headers = ['id', 'timestamp', 'userId', 'action', 'resource', 'resourceId', 'severity'];
    const rows = this.logs.map(log => 
      [log.id, log.timestamp, log.userId, log.action, log.resource, log.resourceId, log.severity].join(',')
    );
    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * importlog
   */
  import(data: string, format: 'json' | 'csv' = 'json'): number {
    let importedLogs: AuditLog[];

    if (format === 'json') {
      importedLogs = JSON.parse(data);
    } else {
 // CSV 
      const lines = data.split('\n');
      const headers = lines[0].split(',');
      importedLogs = lines.slice(1).map(line => {
        const values = line.split(',');
        return {
          id: values[0],
          timestamp: parseInt(values[1]),
          userId: values[2],
          action: values[3] as AuditAction,
          resource: values[4],
          resourceId: values[5],
          severity: values[6] as AuditSeverity,
          details: {},
          previousHash: '',
          currentHash: '',
          signature: '',
        };
      });
    }

    const beforeCount = this.logs.length;
    this.logs.push(...importedLogs);

 // index
    for (const log of importedLogs) {
      this.updateIndexes(log);
    }

    const importedCount = this.logs.length - beforeCount;

    log.info('[AuditTrailEngine] Import completed', {
      imported: importedCount,
      total: this.logs.length,
    });

    return importedCount;
  }

  /**
 * config
   */
  getConfig(): AuditConfig {
    return { ...this.config };
  }

  /**
   * updateconfig
   */
  updateConfig(config: Partial<AuditConfig>): void {
    this.config = { ...this.config, ...config };
    log.info('[AuditTrailEngine] Config updated', this.config);
  }

  /**
 * reset ()
   */
  reset(): void {
    this.logs = [];
    this.logsByUser.clear();
    this.logsByAction.clear();
    this.logsByResource.clear();
    this.lastHash = '0'.repeat(64);
    log.info('[AuditTrailEngine] Reset');
  }
}

// ── Export ──────────────────────────────────────────────────────────────────

export default AuditTrailEngine;
