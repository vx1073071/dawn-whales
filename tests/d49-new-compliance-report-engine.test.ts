/**
 * Compliance Report Engine Tests
 * D-49-NEW [P1] - youdao
 * 
 * 测试覆盖:
 * - 合规规则管理
 * - 合规性检查
 * - 风险事件管理
 * - 报告生成
 * - 维护功能
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AuditTrailEngine } from '../electron/engine/portfolio/audit-trail-engine';
import { ComplianceReportEngine, ComplianceStatus } from '../electron/engine/risk/compliance-report-engine';

describe('ComplianceReportEngine', () => {
  let auditEngine: AuditTrailEngine;
  let complianceEngine: ComplianceReportEngine;

  beforeEach(() => {
    auditEngine = new AuditTrailEngine({ enabled: true });
    complianceEngine = new ComplianceReportEngine(auditEngine);
  });

  describe('Rule Management', () => {
    it('should initialize with default rules', () => {
      const rules = complianceEngine.getRules();
      expect(rules.length).toBeGreaterThan(0);
    });

    it('should add custom rule', () => {
      const initialCount = complianceEngine.getRules().length;
      
      complianceEngine.addRule({
        id: 'CUSTOM_001',
        name: 'Custom Rule',
        description: 'Test rule',
        type: 'SECURITY_POLICY',
        severity: 'INFO',
        checkFunction: () => ({
          ruleId: 'CUSTOM_001',
          status: 'COMPLIANT',
          message: 'Custom check passed',
        }),
        enabled: true,
      });

      expect(complianceEngine.getRules().length).toBe(initialCount + 1);
    });

    it('should remove rule', () => {
      const initialCount = complianceEngine.getRules().length;
      complianceEngine.removeRule('DATA_PRIVACY_001');
      expect(complianceEngine.getRules().length).toBe(initialCount - 1);
    });

    it('should enable/disable rule', () => {
      complianceEngine.setRuleEnabled('DATA_PRIVACY_001', false);
      const rule = complianceEngine.getRules().find(r => r.id === 'DATA_PRIVACY_001');
      expect(rule?.enabled).toBe(false);
    });
  });

  describe('Compliance Checks', () => {
    beforeEach(() => {
      // 添加一些审计日志
      auditEngine.log('user_001', 'LOGIN', 'user', 'user_001', 'INFO');
      auditEngine.log('user_001', 'STRATEGY_CREATE', 'strategy', 'strat_001', 'INFO');
      auditEngine.log('user_001', 'RISK_ALERT', 'risk', 'risk_001', 'WARNING');
    });

    it('should generate compliance report', () => {
      const now = Date.now();
      const report = complianceEngine.generateReport(now - 86400000, now);

      expect(report.id).toMatch(/^report_\d+_[a-z0-9]+$/);
      expect(report.generatedAt).toBeGreaterThan(0);
      expect(report.summary.totalRules).toBeGreaterThan(0);
      expect(report.checkResults.length).toBeGreaterThan(0);
    });

    it('should check data access audit', () => {
      const now = Date.now();
      const report = complianceEngine.generateReport(now - 86400000, now);
      
      const dataPrivacyCheck = report.checkResults.find(r => r.ruleId === 'DATA_PRIVACY_001');
      expect(dataPrivacyCheck).toBeDefined();
      expect(['COMPLIANT', 'NON_COMPLIANT']).toContain(dataPrivacyCheck?.status);
    });

    it('should check risk alert response', () => {
      const now = Date.now();
      const report = complianceEngine.generateReport(now - 86400000, now);
      
      const riskMgmtCheck = report.checkResults.find(r => r.ruleId === 'RISK_MGMT_001');
      expect(riskMgmtCheck).toBeDefined();
      expect(riskMgmtCheck?.details).toHaveProperty('complianceRate');
    });

    it('should check audit log integrity', () => {
      const now = Date.now();
      const report = complianceEngine.generateReport(now - 86400000, now);
      
      const auditCheck = report.checkResults.find(r => r.ruleId === 'AUDIT_REQ_001');
      expect(auditCheck).toBeDefined();
      expect(auditCheck?.status).toBe('COMPLIANT');
    });

    it('should calculate risk score', () => {
      const now = Date.now();
      const report = complianceEngine.generateReport(now - 86400000, now);
      
      expect(report.summary.riskScore).toBeGreaterThanOrEqual(0);
      expect(report.summary.riskScore).toBeLessThanOrEqual(100);
    });

    it('should determine overall status', () => {
      const now = Date.now();
      const report = complianceEngine.generateReport(now - 86400000, now);
      
      expect(['COMPLIANT', 'NON_COMPLIANT', 'PARTIAL']).toContain(report.summary.overallStatus);
    });

    it('should collect recommendations', () => {
      const now = Date.now();
      const report = complianceEngine.generateReport(now - 86400000, now);
      
      expect(Array.isArray(report.recommendations)).toBe(true);
    });

    it('should filter by user', () => {
      auditEngine.log('user_002', 'LOGIN', 'user', 'user_002', 'INFO');
      
      const now = Date.now();
      const report = complianceEngine.generateReport(now - 86400000, now, 'user_001');
      
      expect(report.auditTrail.totalLogs).toBeGreaterThan(0);
    });
  });

  describe('Risk Event Management', () => {
    it('should record risk event', () => {
      const event = complianceEngine.recordRiskEvent(
        'SECURITY_BREACH',
        'CRITICAL',
        'Unauthorized access detected',
        'HIGH'
      );

      expect(event.id).toMatch(/^risk_\d+_[a-z0-9]+$/);
      expect(event.type).toBe('SECURITY_BREACH');
      expect(event.severity).toBe('CRITICAL');
      expect(event.impact).toBe('HIGH');
      expect(event.status).toBe('OPEN');
    });

    it('should update risk event status', () => {
      const event = complianceEngine.recordRiskEvent(
        'SECURITY_BREACH',
        'CRITICAL',
        'Unauthorized access detected',
        'HIGH'
      );

      complianceEngine.updateRiskEventStatus(event.id, 'RESOLVED', 'Access revoked');

      const updated = complianceEngine.getRiskEvents().find(e => e.id === event.id);
      expect(updated?.status).toBe('RESOLVED');
      expect(updated?.resolution).toBe('Access revoked');
      expect(updated?.resolvedAt).toBeGreaterThan(0);
    });

    it('should get risk events by status', () => {
      complianceEngine.recordRiskEvent('TYPE_1', 'HIGH', 'Event 1', 'HIGH');
      complianceEngine.recordRiskEvent('TYPE_2', 'MEDIUM', 'Event 2', 'MEDIUM');

      const openEvents = complianceEngine.getRiskEvents({ status: 'OPEN' });
      expect(openEvents.length).toBe(2);
    });

    it('should get risk events by severity', () => {
      complianceEngine.recordRiskEvent('TYPE_1', 'CRITICAL', 'Event 1', 'HIGH');
      complianceEngine.recordRiskEvent('TYPE_2', 'HIGH', 'Event 2', 'MEDIUM');

      const criticalEvents = complianceEngine.getRiskEvents({ severity: 'CRITICAL' });
      expect(criticalEvents.length).toBe(1);
    });
  });

  describe('Report Management', () => {
    it('should store generated report', () => {
      const now = Date.now();
      const report = complianceEngine.generateReport(now - 86400000, now);
      
      const retrieved = complianceEngine.getReport(report.id);
      expect(retrieved).toEqual(report);
    });

    it('should get all reports', () => {
      const now = Date.now();
      complianceEngine.generateReport(now - 86400000, now);
      complianceEngine.generateReport(now - 172800000, now - 86400000);

      const reports = complianceEngine.getAllReports();
      expect(reports.length).toBe(2);
    });

    it('should return null for non-existent report', () => {
      const report = complianceEngine.getReport('non_existent');
      expect(report).toBeNull();
    });

    it('should export report as JSON', () => {
      const now = Date.now();
      const report = complianceEngine.generateReport(now - 86400000, now);
      
      const json = complianceEngine.exportReport(report.id, 'json');
      const parsed = JSON.parse(json);
      expect(parsed.id).toBe(report.id);
    });

    it('should export report as PDF', () => {
      const now = Date.now();
      const report = complianceEngine.generateReport(now - 86400000, now);
      
      const pdf = complianceEngine.exportReport(report.id, 'pdf');
      expect(pdf).toContain('合规性报告');
      expect(pdf).toContain('合规性报告');
    });

    it('should throw error for non-existent report export', () => {
      expect(() => {
        complianceEngine.exportReport('non_existent');
      }).toThrow();
    });
  });

  describe('Maintenance', () => {
    it('should cleanup expired reports', () => {
      const shortRetentionEngine = new ComplianceReportEngine(auditEngine, {
        retentionDays: 1,
      });

      // 添加旧报告
      const oldReport = shortRetentionEngine.generateReport(
        Date.now() - 2 * 86400000,
        Date.now() - 86400000
      );
      oldReport.generatedAt = Date.now() - 2 * 86400000;

      // 添加新报告
      shortRetentionEngine.generateReport(Date.now() - 86400000, Date.now());

      const { reportsRemoved } = shortRetentionEngine.cleanup();
      expect(reportsRemoved).toBe(1);
    });

    it('should cleanup expired risk events', () => {
      const shortRetentionEngine = new ComplianceReportEngine(auditEngine, {
        retentionDays: 1,
      });

      // 添加旧事件
      const oldEvent = shortRetentionEngine.recordRiskEvent('TYPE', 'HIGH', 'Old event', 'HIGH');
      oldEvent.timestamp = Date.now() - 2 * 86400000;

      // 添加新事件
      shortRetentionEngine.recordRiskEvent('TYPE', 'HIGH', 'New event', 'HIGH');

      const { eventsRemoved } = shortRetentionEngine.cleanup();
      expect(eventsRemoved).toBe(1);
    });
  });

  describe('Configuration', () => {
    it('should get config', () => {
      const config = complianceEngine.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.retentionDays).toBe(365);
    });

    it('should update config', () => {
      complianceEngine.updateConfig({ retentionDays: 180 });
      const config = complianceEngine.getConfig();
      expect(config.retentionDays).toBe(180);
    });

    it('should reset engine', () => {
      complianceEngine.recordRiskEvent('TYPE', 'HIGH', 'Event', 'HIGH');
      complianceEngine.reset();
      
      expect(complianceEngine.getRiskEvents().length).toBe(0);
      expect(complianceEngine.getAllReports().length).toBe(0);
    });
  });

  describe('Integration', () => {
    it('should work with audit engine', () => {
      auditEngine.log('user_001', 'LOGIN', 'user', 'user_001', 'INFO');
      auditEngine.log('user_001', 'STRATEGY_CREATE', 'strategy', 'strat_001', 'INFO');
      auditEngine.log('user_001', 'RISK_ALERT', 'risk', 'risk_001', 'WARNING');

      const now = Date.now();
      const report = complianceEngine.generateReport(now - 86400000, now);

      expect(report.auditTrail.totalLogs).toBe(3);
      expect(report.checkResults.length).toBeGreaterThan(0);
    });

    it('should generate comprehensive report', () => {
      // 添加多种审计日志
      auditEngine.log('user_001', 'LOGIN', 'user', 'user_001', 'INFO');
      auditEngine.log('user_001', 'STRATEGY_CREATE', 'strategy', 'strat_001', 'INFO');
      auditEngine.log('user_001', 'RISK_ALERT', 'risk', 'risk_001', 'WARNING');
      auditEngine.log('user_001', 'COMPLIANCE_CHECK', 'compliance', 'comp_001', 'CRITICAL');

      // 添加风险事件
      complianceEngine.recordRiskEvent('SECURITY_BREACH', 'CRITICAL', 'Breach detected', 'HIGH');

      const now = Date.now();
      const report = complianceEngine.generateReport(now - 86400000, now);

      expect(report.summary.totalRules).toBeGreaterThan(0);
      expect(report.riskEvents.length).toBe(1);
      expect(report.auditTrail.totalLogs).toBe(4);
      expect(report.recommendations.length).toBeGreaterThanOrEqual(0);
    });
  });
});
