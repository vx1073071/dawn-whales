/**
 * Audit Trail Enhancement - 审计轨迹增强引擎
 * D-49-NEW [P0] - youdao
 * 
 * 功能:
 * - 完整审计轨迹记录
 * - 不可篡改记录 (哈希链)
 * - 审计日志查询 (< 100ms)
 * - 多维度查询支持
 * 
 * 验收标准:
 * - 代码量 >= 800L
 * - 查询响应 < 100ms
 * - 测试覆盖完整
 */

import log from 'electron-log';
import { EngineError, ErrorCode } from '../errors';

// Node.js crypto — use require() to bypass vitest/jsdom Web Crypto API resolution
// eslint-disable-next-line @typescript-eslint/no-var-requires
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

    // 生成私钥用于签名
    this.privateKey = _crypto.randomBytes(32).toString('hex');

    log.info('[AuditTrailEngine] Initialized', {
      enabled: this.config.enabled,
      retentionDays: this.config.retentionDays,
    });
  }

  // ── Log Creation ─────────────────────────────────────────────────────────

  /**
   * 记录审计日志
   */
  log(
    userId: string,
    action: AuditAction,
    resource: string,
    resourceId: string,
    severity: AuditSeverity = 'INFO',
    details: Record<string, any> = {}
  ): AuditLog {
    if (!this.config.enabled) {
      throw new EngineError(ErrorCode.AI_QUERY_FAILED, 'Audit trail is disabled');
    }

    const timestamp = Date.now();
    const id = this.generateId();

    // 计算哈希链
    const previousHash = this.lastHash;
    const currentHash = this.calculateHash(timestamp, userId, action, resource, resourceId, previousHash);

    // 生成签名
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

    // 存储日志
    this.logs.push(auditLog);
    this.lastHash = currentHash;

    // 更新索引
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
   * 生成唯一 ID
   */
  private generateId(): string {
    return `audit_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * 计算哈希
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
   * 生成签名
   */
  private sign(hash: string): string {
    return crypto
      .createHmac('sha256', this.privateKey)
      .update(hash)
      .digest('hex');
  }

  /**
   * 验证签名
   */
  verifySignature(log: AuditLog): boolean {
    if (!this.config.signatureEnabled) {
      return true;
    }

    const expectedSignature = this.sign(log.currentHash);
    return log.signature === expectedSignature;
  }

  /**
   * 验证哈希链
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
   * 更新索引
   */
  private updateIndexes(auditLog: AuditLog): void {
    // 按用户索引
    if (!this.logsByUser.has(auditLog.userId)) {
      this.logsByUser.set(auditLog.userId, []);
    }
    this.logsByUser.get(auditLog.userId)!.push(auditLog);

    // 按操作索引
    if (!this.logsByAction.has(auditLog.action)) {
      this.logsByAction.set(auditLog.action, []);
    }
    this.logsByAction.get(auditLog.action)!.push(auditLog);

    // 按资源索引
    const resourceKey = `${auditLog.resource}:${auditLog.resourceId}`;
    if (!this.logsByResource.has(resourceKey)) {
      this.logsByResource.set(resourceKey, []);
    }
    this.logsByResource.get(resourceKey)!.push(auditLog);
  }

  // ── Query ────────────────────────────────────────────────────────────────

  /**
   * 查询审计日志
   */
  query(query: AuditQuery): AuditQueryResult {
    const startTime = Date.now();

    let results = this.logs;

    // 时间范围过滤
    if (query.startDate) {
      results = results.filter(log => log.timestamp >= query.startDate!);
    }
    if (query.endDate) {
      results = results.filter(log => log.timestamp <= query.endDate!);
    }

    // 用户过滤
    if (query.userId) {
      results = results.filter(log => log.userId === query.userId);
    }

    // 操作过滤
    if (query.action) {
      results = results.filter(log => log.action === query.action);
    }

    // 资源过滤
    if (query.resource) {
      results = results.filter(log => log.resource === query.resource);
    }
    if (query.resourceId) {
      results = results.filter(log => log.resourceId === query.resourceId);
    }

    // 严重性过滤
    if (query.severity) {
      results = results.filter(log => log.severity === query.severity);
    }

    // 排序 (按时间倒序)
    results = results.sort((a, b) => b.timestamp - a.timestamp);

    // 总数
    const total = results.length;

    // 分页
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
   * 根据 ID 获取日志
   */
  getById(id: string): AuditLog | null {
    return this.logs.find(log => log.id === id) || null;
  }

  /**
   * 获取资源的所有日志
   */
  getByResource(resource: string, resourceId: string): AuditLog[] {
    const key = `${resource}:${resourceId}`;
    return this.logsByResource.get(key) || [];
  }

  /**
   * 获取用户的所有日志
   */
  getByUser(userId: string): AuditLog[] {
    return this.logsByUser.get(userId) || [];
  }

  // ── Statistics ───────────────────────────────────────────────────────────

  /**
   * 获取统计信息
   */
  getStats(): AuditStats {
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
   * 清理过期日志
   */
  cleanup(): number {
    const cutoffTime = Date.now() - (this.config.retentionDays * 24 * 60 * 60 * 1000);
    const beforeCount = this.logs.length;

    this.logs = this.logs.filter(log => log.timestamp > cutoffTime);

    // 重建索引
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
   * 导出日志
   */
  export(format: 'json' | 'csv' = 'json'): string {
    if (format === 'json') {
      return JSON.stringify(this.logs, null, 2);
    }

    // CSV 格式
    const headers = ['id', 'timestamp', 'userId', 'action', 'resource', 'resourceId', 'severity'];
    const rows = this.logs.map(log => 
      [log.id, log.timestamp, log.userId, log.action, log.resource, log.resourceId, log.severity].join(',')
    );
    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * 导入日志
   */
  import(data: string, format: 'json' | 'csv' = 'json'): number {
    let importedLogs: AuditLog[];

    if (format === 'json') {
      importedLogs = JSON.parse(data);
    } else {
      // CSV 解析
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

    // 重建索引
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
   * 获取配置
   */
  getConfig(): AuditConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<AuditConfig>): void {
    this.config = { ...this.config, ...config };
    log.info('[AuditTrailEngine] Config updated', this.config);
  }

  /**
   * 重置 (仅用于测试)
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
