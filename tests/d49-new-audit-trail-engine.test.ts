/**
 * Audit Trail Engine Tests
 * D-49-NEW [P0] - youdao
 * 
 * 测试覆盖:
 * - 日志记录
 * - 哈希链验证
 * - 签名验证
 * - 查询功能
 * - 统计信息
 * - 维护功能
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AuditTrailEngine, AuditAction, AuditSeverity } from '../electron/engine/audit-trail-engine';

describe('AuditTrailEngine', () => {
  let engine: AuditTrailEngine;

  beforeEach(() => {
    engine = new AuditTrailEngine({
      enabled: true,
      retentionDays: 90,
      signatureEnabled: true,
    });
  });

  describe('Log Creation', () => {
    it('should create audit log with all fields', () => {
      const log = engine.log(
        'user_001',
        'STRATEGY_CREATE',
        'strategy',
        'strat_001',
        'INFO',
        { name: 'Test Strategy' }
      );

      expect(log.id).toMatch(/^audit_\d+_[a-f0-9]{16}$/);
      expect(log.timestamp).toBeGreaterThan(0);
      expect(log.userId).toBe('user_001');
      expect(log.action).toBe('STRATEGY_CREATE');
      expect(log.resource).toBe('strategy');
      expect(log.resourceId).toBe('strat_001');
      expect(log.severity).toBe('INFO');
      expect(log.details).toEqual({ name: 'Test Strategy' });
      expect(log.previousHash).toMatch(/^[a-f0-9]{64}$/);
      expect(log.currentHash).toMatch(/^[a-f0-9]{64}$/);
      expect(log.signature).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should create hash chain', () => {
      const log1 = engine.log('user_001', 'LOGIN', 'user', 'user_001');
      const log2 = engine.log('user_001', 'STRATEGY_CREATE', 'strategy', 'strat_001');

      expect(log2.previousHash).toBe(log1.currentHash);
    });

    it('should throw error when disabled', () => {
      const disabledEngine = new AuditTrailEngine({ enabled: false });

      expect(() => {
        disabledEngine.log('user_001', 'LOGIN', 'user', 'user_001');
      }).toThrow('Audit trail is disabled');
    });

    it('should use default severity INFO', () => {
      const log = engine.log('user_001', 'LOGIN', 'user', 'user_001');
      expect(log.severity).toBe('INFO');
    });
  });

  describe('Signature Verification', () => {
    it('should verify valid signature', () => {
      const log = engine.log('user_001', 'LOGIN', 'user', 'user_001');
      expect(engine.verifySignature(log)).toBe(true);
    });

    it('should detect tampered signature', () => {
      const log = engine.log('user_001', 'LOGIN', 'user', 'user_001');
      log.signature = '0'.repeat(64);
      expect(engine.verifySignature(log)).toBe(false);
    });

    it('should skip verification when disabled', () => {
      const noSigEngine = new AuditTrailEngine({ signatureEnabled: false });
      const log = noSigEngine.log('user_001', 'LOGIN', 'user', 'user_001');
      expect(noSigEngine.verifySignature(log)).toBe(true);
    });
  });

  describe('Chain Verification', () => {
    it('should verify valid chain', () => {
      engine.log('user_001', 'LOGIN', 'user', 'user_001');
      engine.log('user_001', 'STRATEGY_CREATE', 'strategy', 'strat_001');
      engine.log('user_001', 'BACKTEST_RUN', 'backtest', 'bt_001');

      expect(engine.verifyChain()).toBe(true);
    });

    it('should detect tampered hash', () => {
      const log1 = engine.log('user_001', 'LOGIN', 'user', 'user_001');
      engine.log('user_001', 'STRATEGY_CREATE', 'strategy', 'strat_001');

      // 篡改第一条日志
      log1.currentHash = '0'.repeat(64);

      expect(engine.verifyChain()).toBe(false);
    });

    it('should verify empty chain', () => {
      expect(engine.verifyChain()).toBe(true);
    });
  });

  describe('Query', () => {
    beforeEach(() => {
      engine.log('user_001', 'LOGIN', 'user', 'user_001', 'INFO');
      engine.log('user_001', 'STRATEGY_CREATE', 'strategy', 'strat_001', 'INFO');
      engine.log('user_002', 'LOGIN', 'user', 'user_002', 'INFO');
      engine.log('user_001', 'RISK_ALERT', 'risk', 'risk_001', 'WARNING');
      engine.log('user_001', 'COMPLIANCE_CHECK', 'compliance', 'comp_001', 'CRITICAL');
    });

    it('should query all logs', () => {
      const result = engine.query({});
      expect(result.logs).toHaveLength(5);
      expect(result.total).toBe(5);
      expect(result.queryTime).toBeGreaterThanOrEqual(0);
    });

    it('should query by user', () => {
      const result = engine.query({ userId: 'user_001' });
      expect(result.logs).toHaveLength(4);
      expect(result.logs.every(log => log.userId === 'user_001')).toBe(true);
    });

    it('should query by action', () => {
      const result = engine.query({ action: 'LOGIN' });
      expect(result.logs).toHaveLength(2);
      expect(result.logs.every(log => log.action === 'LOGIN')).toBe(true);
    });

    it('should query by severity', () => {
      const result = engine.query({ severity: 'WARNING' });
      expect(result.logs).toHaveLength(1);
      expect(result.logs[0].severity).toBe('WARNING');
    });

    it('should query by resource', () => {
      const result = engine.query({ resource: 'strategy' });
      expect(result.logs).toHaveLength(1);
      expect(result.logs[0].resource).toBe('strategy');
    });

    it('should query by time range', () => {
      const now = Date.now();
      const result = engine.query({
        startDate: now - 1000,
        endDate: now + 1000,
      });
      expect(result.logs).toHaveLength(5);
    });

    it('should sort by timestamp descending', () => {
      const result = engine.query({});
      for (let i = 1; i < result.logs.length; i++) {
        expect(result.logs[i - 1].timestamp).toBeGreaterThanOrEqual(result.logs[i].timestamp);
      }
    });

    it('should paginate results', () => {
      const result = engine.query({ limit: 2, offset: 0 });
      expect(result.logs).toHaveLength(2);
      expect(result.total).toBe(5);
    });

    it('should respect max query limit', () => {
      const limitedEngine = new AuditTrailEngine({ maxQueryLimit: 3 });
      for (let i = 0; i < 10; i++) {
        limitedEngine.log('user_001', 'LOGIN', 'user', 'user_001');
      }

      const result = limitedEngine.query({ limit: 100 });
      expect(result.logs).toHaveLength(3);
    });

    it('should combine multiple filters', () => {
      const result = engine.query({
        userId: 'user_001',
        severity: 'INFO',
      });
      expect(result.logs).toHaveLength(2);
    });
  });

  describe('Get By ID/Resource/User', () => {
    it('should get log by ID', () => {
      const log = engine.log('user_001', 'LOGIN', 'user', 'user_001');
      const found = engine.getById(log.id);
      expect(found).toEqual(log);
    });

    it('should return null for non-existent ID', () => {
      const found = engine.getById('non_existent');
      expect(found).toBeNull();
    });

    it('should get logs by resource', () => {
      engine.log('user_001', 'STRATEGY_CREATE', 'strategy', 'strat_001');
      engine.log('user_001', 'STRATEGY_UPDATE', 'strategy', 'strat_001');
      engine.log('user_001', 'STRATEGY_CREATE', 'strategy', 'strat_002');

      const logs = engine.getByResource('strategy', 'strat_001');
      expect(logs).toHaveLength(2);
    });

    it('should get logs by user', () => {
      engine.log('user_001', 'LOGIN', 'user', 'user_001');
      engine.log('user_001', 'STRATEGY_CREATE', 'strategy', 'strat_001');
      engine.log('user_002', 'LOGIN', 'user', 'user_002');

      const logs = engine.getByUser('user_001');
      expect(logs).toHaveLength(2);
    });
  });

  describe('Statistics', () => {
    beforeEach(() => {
      engine.log('user_001', 'LOGIN', 'user', 'user_001', 'INFO');
      engine.log('user_001', 'STRATEGY_CREATE', 'strategy', 'strat_001', 'INFO');
      engine.log('user_002', 'LOGIN', 'user', 'user_002', 'INFO');
      engine.log('user_001', 'RISK_ALERT', 'risk', 'risk_001', 'WARNING');
      engine.log('user_001', 'COMPLIANCE_CHECK', 'compliance', 'comp_001', 'CRITICAL');
    });

    it('should get total logs count', () => {
      const stats = engine.getStats();
      expect(stats.totalLogs).toBe(5);
    });

    it('should get logs by action', () => {
      const stats = engine.getStats();
      expect(stats.logsByAction.LOGIN).toBe(2);
      expect(stats.logsByAction.STRATEGY_CREATE).toBe(1);
      expect(stats.logsByAction.RISK_ALERT).toBe(1);
    });

    it('should get logs by severity', () => {
      const stats = engine.getStats();
      expect(stats.logsBySeverity.INFO).toBe(3);
      expect(stats.logsBySeverity.WARNING).toBe(1);
      expect(stats.logsBySeverity.CRITICAL).toBe(1);
    });

    it('should get logs by user', () => {
      const stats = engine.getStats();
      expect(stats.logsByUser.user_001).toBe(4);
      expect(stats.logsByUser.user_002).toBe(1);
    });

    it('should get first and last log time', () => {
      const stats = engine.getStats();
      expect(stats.firstLogTime).toBeGreaterThan(0);
      expect(stats.lastLogTime).toBeGreaterThanOrEqual(stats.firstLogTime);
    });

    it('should handle empty stats', () => {
      const emptyEngine = new AuditTrailEngine();
      const stats = emptyEngine.getStats();
      expect(stats.totalLogs).toBe(0);
      expect(stats.firstLogTime).toBe(0);
      expect(stats.lastLogTime).toBe(0);
    });
  });

  describe('Maintenance', () => {
    it('should cleanup expired logs', () => {
      const shortRetentionEngine = new AuditTrailEngine({ retentionDays: 1 });

      // 添加旧日志
      const oldLog = shortRetentionEngine.log('user_001', 'LOGIN', 'user', 'user_001');
      oldLog.timestamp = Date.now() - 2 * 24 * 60 * 60 * 1000; // 2 天前

      // 添加新日志
      shortRetentionEngine.log('user_001', 'LOGIN', 'user', 'user_001');

      const removed = shortRetentionEngine.cleanup();
      expect(removed).toBe(1);
      expect(shortRetentionEngine.getStats().totalLogs).toBe(1);
    });

    it('should export as JSON', () => {
      engine.log('user_001', 'LOGIN', 'user', 'user_001');
      const json = engine.export('json');
      const parsed = JSON.parse(json);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].userId).toBe('user_001');
    });

    it('should export as CSV', () => {
      engine.log('user_001', 'LOGIN', 'user', 'user_001');
      const csv = engine.export('csv');
      const lines = csv.split('\n');
      expect(lines).toHaveLength(2); // header + 1 data row
      expect(lines[0]).toContain('id,timestamp,userId');
    });

    it('should import JSON', () => {
      const logs = [
        {
          id: 'audit_123',
          timestamp: Date.now(),
          userId: 'user_001',
          action: 'LOGIN',
          resource: 'user',
          resourceId: 'user_001',
          severity: 'INFO',
          details: {},
          previousHash: '0'.repeat(64),
          currentHash: '1'.repeat(64),
          signature: '2'.repeat(64),
        },
      ];

      const imported = engine.import(JSON.stringify(logs), 'json');
      expect(imported).toBe(1);
      expect(engine.getStats().totalLogs).toBe(1);
    });
  });

  describe('Configuration', () => {
    it('should get config', () => {
      const config = engine.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.retentionDays).toBe(90);
      expect(config.signatureEnabled).toBe(true);
    });

    it('should update config', () => {
      engine.updateConfig({ retentionDays: 180 });
      const config = engine.getConfig();
      expect(config.retentionDays).toBe(180);
    });

    it('should reset engine', () => {
      engine.log('user_001', 'LOGIN', 'user', 'user_001');
      engine.reset();
      expect(engine.getStats().totalLogs).toBe(0);
    });
  });

  describe('Performance', () => {
    it('should query within 100ms for 1000 logs', () => {
      // 添加 1000 条日志
      for (let i = 0; i < 1000; i++) {
        engine.log(`user_${i % 10}`, 'LOGIN', 'user', `user_${i % 10}`);
      }

      const start = Date.now();
      const result = engine.query({ userId: 'user_1' });
      const queryTime = Date.now() - start;

      expect(queryTime).toBeLessThan(100);
      expect(result.logs.length).toBeGreaterThan(0);
    });
  });
});
