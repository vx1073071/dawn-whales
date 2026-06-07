/**
 * Compliance Report Engine - 合规性报告引擎
 * D-49-NEW [P1] - youdao
 * 
 * 功能:
 * - 合规性报告生成
 * - 风险事件记录
 * - 合规性检查
 * - 多维度报告
 * 
 * 验收标准:
 * - 代码量 >= 500L
 * - 报告格式完整
 * - 合规性检查通过
 */

import log from 'electron-log';
import { AuditTrailEngine, AuditLog, AuditAction, AuditSeverity } from './audit-trail-engine';

// ── Types ──────────────────────────────────────────────────────────────────

export type ComplianceRuleType = 
  | 'DATA_PRIVACY' | 'FINANCIAL_REGULATION' | 'RISK_MANAGEMENT'
  | 'AUDIT_REQUIREMENT' | 'SECURITY_POLICY' | 'OPERATIONAL_PROCEDURE';

export type ComplianceStatus = 'COMPLIANT' | 'NON_COMPLIANT' | 'PARTIAL' | 'UNKNOWN';

export interface ComplianceRule {
  id: string;
  name: string;
  description: string;
  type: ComplianceRuleType;
  severity: AuditSeverity;
  checkFunction: (context: ComplianceContext) => ComplianceCheckResult;
  enabled: boolean;
}

export interface ComplianceContext {
  auditLogs: AuditLog[];
  startDate: number;
  endDate: number;
  userId?: string;
  resource?: string;
  metadata?: Record<string, any>;
}

export interface ComplianceCheckResult {
  ruleId: string;
  status: ComplianceStatus;
  message: string;
  details?: Record<string, any>;
  recommendations?: string[];
}

export interface RiskEvent {
  id: string;
  timestamp: number;
  type: string;
  severity: AuditSeverity;
  description: string;
  impact: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'CLOSED';
  assignedTo?: string;
  resolution?: string;
  resolvedAt?: number;
}

export interface ComplianceReport {
  id: string;
  generatedAt: number;
  period: {
    startDate: number;
    endDate: number;
  };
  summary: {
    totalRules: number;
    compliantRules: number;
    nonCompliantRules: number;
    partialRules: number;
    overallStatus: ComplianceStatus;
    riskScore: number;
  };
  checkResults: ComplianceCheckResult[];
  riskEvents: RiskEvent[];
  recommendations: string[];
  auditTrail: {
    totalLogs: number;
    criticalEvents: number;
    warningEvents: number;
  };
}

export interface ComplianceConfig {
  enabled: boolean;
  autoGenerateReports: boolean;
  reportFrequency: 'daily' | 'weekly' | 'monthly';
  retentionDays: number;
  riskScoreThreshold: number;
}

// ── Compliance Report Engine ───────────────────────────────────────────────

export class ComplianceReportEngine {
  private rules: ComplianceRule[] = [];
  private riskEvents: RiskEvent[] = [];
  private reports: ComplianceReport[] = [];
  private auditEngine: AuditTrailEngine;
  private config: ComplianceConfig;

  constructor(auditEngine: AuditTrailEngine, config?: Partial<ComplianceConfig>) {
    this.auditEngine = auditEngine;
    this.config = {
      enabled: true,
      autoGenerateReports: true,
      reportFrequency: 'weekly',
      retentionDays: 365,
      riskScoreThreshold: 70,
      ...config,
    };

    // 初始化默认规则
    this.initializeDefaultRules();

    log.info('[ComplianceReportEngine] Initialized', {
      enabled: this.config.enabled,
      rulesCount: this.rules.length,
    });
  }

  // ── Rule Management ──────────────────────────────────────────────────────

  /**
   * 初始化默认合规规则
   */
  private initializeDefaultRules(): void {
    // 数据隐私规则
    this.addRule({
      id: 'DATA_PRIVACY_001',
      name: '数据访问审计',
      description: '所有数据访问操作必须记录审计日志',
      type: 'DATA_PRIVACY',
      severity: 'CRITICAL',
      checkFunction: (context) => this.checkDataAccessAudit(context),
      enabled: true,
    });

    // 风险管理规则
    this.addRule({
      id: 'RISK_MGMT_001',
      name: '风险预警响应',
      description: '风险预警必须在 24 小时内响应',
      type: 'RISK_MANAGEMENT',
      severity: 'HIGH',
      checkFunction: (context) => this.checkRiskAlertResponse(context),
      enabled: true,
    });

    // 审计要求规则
    this.addRule({
      id: 'AUDIT_REQ_001',
      name: '审计日志完整性',
      description: '审计日志必须完整，不可篡改',
      type: 'AUDIT_REQUIREMENT',
      severity: 'CRITICAL',
      checkFunction: (context) => this.checkAuditLogIntegrity(context),
      enabled: true,
    });

    // 安全策略规则
    this.addRule({
      id: 'SECURITY_001',
      name: '登录失败监控',
      description: '连续登录失败超过 5 次必须告警',
      type: 'SECURITY_POLICY',
      severity: 'HIGH',
      checkFunction: (context) => this.checkLoginFailureMonitor(context),
      enabled: true,
    });

    // 操作流程规则
    this.addRule({
      id: 'OPERATION_001',
      name: '关键操作审批',
      description: '关键操作必须有审批记录',
      type: 'OPERATIONAL_PROCEDURE',
      severity: 'MEDIUM',
      checkFunction: (context) => this.checkCriticalOperationApproval(context),
      enabled: true,
    });
  }

  /**
   * 添加合规规则
   */
  addRule(rule: ComplianceRule): void {
    this.rules.push(rule);
    log.info('[ComplianceReportEngine] Rule added', { ruleId: rule.id });
  }

  /**
   * 移除合规规则
   */
  removeRule(ruleId: string): void {
    this.rules = this.rules.filter(r => r.id !== ruleId);
    log.info('[ComplianceReportEngine] Rule removed', { ruleId });
  }

  /**
   * 启用/禁用规则
   */
  setRuleEnabled(ruleId: string, enabled: boolean): void {
    const rule = this.rules.find(r => r.id === ruleId);
    if (rule) {
      rule.enabled = enabled;
      log.info('[ComplianceReportEngine] Rule enabled/disabled', { ruleId, enabled });
    }
  }

  // ── Compliance Checks ────────────────────────────────────────────────────

  /**
   * 检查数据访问审计
   */
  private checkDataAccessAudit(context: ComplianceContext): ComplianceCheckResult {
    const dataAccessActions: AuditAction[] = ['CREATE', 'UPDATE', 'DELETE'];
    const dataAccessLogs = context.auditLogs.filter(log => 
      dataAccessActions.includes(log.action)
    );

    const allLogged = dataAccessLogs.length > 0;

    return {
      ruleId: 'DATA_PRIVACY_001',
      status: allLogged ? 'COMPLIANT' : 'NON_COMPLIANT',
      message: allLogged 
        ? '所有数据访问操作已记录审计日志'
        : '发现未记录的数据访问操作',
      details: {
        totalDataAccess: dataAccessLogs.length,
      },
      recommendations: allLogged ? [] : ['确保所有数据访问操作都记录审计日志'],
    };
  }

  /**
   * 检查风险预警响应
   */
  private checkRiskAlertResponse(context: ComplianceContext): ComplianceCheckResult {
    const riskAlerts = context.auditLogs.filter(log => 
      log.action === 'RISK_ALERT'
    );

    const respondedAlerts = riskAlerts.filter(alert => {
      const responseTime = 24 * 60 * 60 * 1000; // 24 小时
      return Date.now() - alert.timestamp < responseTime;
    });

    const complianceRate = riskAlerts.length > 0 
      ? (respondedAlerts.length / riskAlerts.length) * 100 
      : 100;

    const status: ComplianceStatus = complianceRate >= 100 
      ? 'COMPLIANT' 
      : complianceRate >= 80 
        ? 'PARTIAL' 
        : 'NON_COMPLIANT';

    return {
      ruleId: 'RISK_MGMT_001',
      status,
      message: `风险预警响应率: ${complianceRate.toFixed(1)}%`,
      details: {
        totalAlerts: riskAlerts.length,
        respondedAlerts: respondedAlerts.length,
        complianceRate,
      },
      recommendations: complianceRate < 100 
        ? ['加强风险预警响应流程', '设置自动提醒机制']
        : [],
    };
  }

  /**
   * 检查审计日志完整性
   */
  private checkAuditLogIntegrity(context: ComplianceContext): ComplianceCheckResult {
    const chainValid = this.auditEngine.verifyChain();

    return {
      ruleId: 'AUDIT_REQ_001',
      status: chainValid ? 'COMPLIANT' : 'NON_COMPLIANT',
      message: chainValid 
        ? '审计日志链完整，未被篡改'
        : '审计日志链被篡改',
      details: {
        totalLogs: context.auditLogs.length,
        chainValid,
      },
      recommendations: chainValid ? [] : ['立即调查日志篡改事件', '加强日志保护机制'],
    };
  }

  /**
   * 检查登录失败监控
   */
  private checkLoginFailureMonitor(context: ComplianceContext): ComplianceCheckResult {
    const loginFailures = context.auditLogs.filter(log => 
      log.action === 'LOGIN' && log.severity === 'WARNING'
    );

    // 按用户分组统计
    const failuresByUser: Record<string, number> = {};
    for (const log of loginFailures) {
      failuresByUser[log.userId] = (failuresByUser[log.userId] || 0) + 1;
    }

    const usersWithExcessiveFailures = Object.entries(failuresByUser)
      .filter(([_, count]) => count >= 5)
      .map(([userId, count]) => ({ userId, count }));

    const status: ComplianceStatus = usersWithExcessiveFailures.length === 0
      ? 'COMPLIANT'
      : 'NON_COMPLIANT';

    return {
      ruleId: 'SECURITY_001',
      status,
      message: status === 'COMPLIANT'
        ? '无异常登录失败'
        : `发现 ${usersWithExcessiveFailures.length} 个用户登录失败超过 5 次`,
      details: {
        totalLoginFailures: loginFailures.length,
        usersWithExcessiveFailures,
      },
      recommendations: status === 'COMPLIANT'
        ? []
        : ['启用账户锁定机制', '添加多因素认证', '监控异常登录行为'],
    };
  }

  /**
   * 检查关键操作审批
   */
  private checkCriticalOperationApproval(context: ComplianceContext): ComplianceCheckResult {
    const criticalActions: AuditAction[] = ['DELETE', 'PUBLISH'];
    const criticalOps = context.auditLogs.filter(log => 
      criticalActions.includes(log.action)
    );

    // 检查是否有审批记录（简化检查）
    const approvedOps = criticalOps.filter(op => 
      op.details?.approved === true
    );

    const approvalRate = criticalOps.length > 0
      ? (approvedOps.length / criticalOps.length) * 100
      : 100;

    const status: ComplianceStatus = approvalRate >= 100
      ? 'COMPLIANT'
      : approvalRate >= 80
        ? 'PARTIAL'
        : 'NON_COMPLIANT';

    return {
      ruleId: 'OPERATION_001',
      status,
      message: `关键操作审批率: ${approvalRate.toFixed(1)}%`,
      details: {
        totalCriticalOps: criticalOps.length,
        approvedOps: approvedOps.length,
        approvalRate,
      },
      recommendations: approvalRate < 100
        ? ['完善关键操作审批流程', '添加审批记录字段']
        : [],
    };
  }

  // ── Risk Event Management ────────────────────────────────────────────────

  /**
   * 记录风险事件
   */
  recordRiskEvent(
    type: string,
    severity: AuditSeverity,
    description: string,
    impact: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  ): RiskEvent {
    const event: RiskEvent = {
      id: `risk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      type,
      severity,
      description,
      impact,
      status: 'OPEN',
    };

    this.riskEvents.push(event);

    log.warn('[ComplianceReportEngine] Risk event recorded', {
      eventId: event.id,
      type,
      severity,
      impact,
    });

    return event;
  }

  /**
   * 更新风险事件状态
   */
  updateRiskEventStatus(
    eventId: string,
    status: RiskEvent['status'],
    resolution?: string
  ): void {
    const event = this.riskEvents.find(e => e.id === eventId);
    if (event) {
      event.status = status;
      if (resolution) {
        event.resolution = resolution;
        event.resolvedAt = Date.now();
      }

      log.info('[ComplianceReportEngine] Risk event updated', {
        eventId,
        status,
      });
    }
  }

  /**
   * 获取风险事件
   */
  getRiskEvents(filter?: { status?: RiskEvent['status']; severity?: AuditSeverity }): RiskEvent[] {
    let events = this.riskEvents;

    if (filter?.status) {
      events = events.filter(e => e.status === filter.status);
    }
    if (filter?.severity) {
      events = events.filter(e => e.severity === filter.severity);
    }

    return events;
  }

  // ── Report Generation ────────────────────────────────────────────────────

  /**
   * 生成合规性报告
   */
  generateReport(startDate: number, endDate: number, userId?: string): ComplianceReport {
    const auditLogs = this.auditEngine.query({ startDate, endDate, userId }).logs;

    const context: ComplianceContext = {
      auditLogs,
      startDate,
      endDate,
      userId,
    };

    // 执行所有规则检查
    const checkResults = this.rules
      .filter(rule => rule.enabled)
      .map(rule => rule.checkFunction(context));

    // 计算统计
    const compliantRules = checkResults.filter(r => r.status === 'COMPLIANT').length;
    const nonCompliantRules = checkResults.filter(r => r.status === 'NON_COMPLIANT').length;
    const partialRules = checkResults.filter(r => r.status === 'PARTIAL').length;

    // 计算整体状态
    const overallStatus: ComplianceStatus = nonCompliantRules > 0
      ? 'NON_COMPLIANT'
      : partialRules > 0
        ? 'PARTIAL'
        : 'COMPLIANT';

    // 计算风险分数 (0-100, 越高越好)
    const riskScore = Math.max(0, 100 - (nonCompliantRules * 20) - (partialRules * 10));

    // 收集所有建议
    const recommendations = checkResults
      .flatMap(r => r.recommendations || [])
      .filter((rec, index, self) => self.indexOf(rec) === index); // 去重

    // 统计审计轨迹
    const criticalEvents = auditLogs.filter(log => log.severity === 'CRITICAL').length;
    const warningEvents = auditLogs.filter(log => log.severity === 'WARNING').length;

    const report: ComplianceReport = {
      id: `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      generatedAt: Date.now(),
      period: { startDate, endDate },
      summary: {
        totalRules: checkResults.length,
        compliantRules,
        nonCompliantRules,
        partialRules,
        overallStatus,
        riskScore,
      },
      checkResults,
      riskEvents: this.riskEvents.filter(e => 
        e.timestamp >= startDate && e.timestamp <= endDate
      ),
      recommendations,
      auditTrail: {
        totalLogs: auditLogs.length,
        criticalEvents,
        warningEvents,
      },
    };

    this.reports.push(report);

    log.info('[ComplianceReportEngine] Report generated', {
      reportId: report.id,
      overallStatus,
      riskScore,
    });

    return report;
  }

  /**
   * 获取报告
   */
  getReport(reportId: string): ComplianceReport | null {
    return this.reports.find(r => r.id === reportId) || null;
  }

  /**
   * 获取所有报告
   */
  getAllReports(): ComplianceReport[] {
    return [...this.reports];
  }

  /**
   * 导出报告
   */
  exportReport(reportId: string, format: 'json' | 'pdf' = 'json'): string {
    const report = this.getReport(reportId);
    if (!report) {
      throw new Error(`Report not found: ${reportId}`);
    }

    if (format === 'json') {
      return JSON.stringify(report, null, 2);
    }

    // PDF 格式 (简化版)
    return this.generatePdfReport(report);
  }

  /**
   * 生成 PDF 报告 (简化版)
   */
  private generatePdfReport(report: ComplianceReport): string {
    const lines = [
      '合规性报告',
      '==========',
      '',
      `报告 ID: ${report.id}`,
      `生成时间: ${new Date(report.generatedAt).toISOString()}`,
      `报告期间: ${new Date(report.period.startDate).toISOString()} - ${new Date(report.period.endDate).toISOString()}`,
      '',
      '摘要',
      '----',
      `总规则数: ${report.summary.totalRules}`,
      `合规规则: ${report.summary.compliantRules}`,
      `不合规规则: ${report.summary.nonCompliantRules}`,
      `部分合规: ${report.summary.partialRules}`,
      `整体状态: ${report.summary.overallStatus}`,
      `风险分数: ${report.summary.riskScore}/100`,
      '',
      '检查结果',
      '--------',
    ];

    for (const result of report.checkResults) {
      lines.push(`\n规则: ${result.ruleId}`);
      lines.push(`状态: ${result.status}`);
      lines.push(`说明: ${result.message}`);
      if (result.recommendations && result.recommendations.length > 0) {
        lines.push('建议:');
        result.recommendations.forEach(rec => lines.push(`  - ${rec}`));
      }
    }

    lines.push('\n风险事件', '--------');
    for (const event of report.riskEvents) {
      lines.push(`\n事件 ID: ${event.id}`);
      lines.push(`类型: ${event.type}`);
      lines.push(`严重性: ${event.severity}`);
      lines.push(`影响: ${event.impact}`);
      lines.push(`状态: ${event.status}`);
      lines.push(`描述: ${event.description}`);
    }

    lines.push('\n建议', '----');
    report.recommendations.forEach((rec, index) => {
      lines.push(`${index + 1}. ${rec}`);
    });

    return lines.join('\n');
  }

  // ── Maintenance ──────────────────────────────────────────────────────────

  /**
   * 清理过期数据
   */
  cleanup(): { reportsRemoved: number; eventsRemoved: number } {
    const cutoffTime = Date.now() - (this.config.retentionDays * 24 * 60 * 60 * 1000);

    const reportsBefore = this.reports.length;
    this.reports = this.reports.filter(r => r.generatedAt > cutoffTime);
    const reportsRemoved = reportsBefore - this.reports.length;

    const eventsBefore = this.riskEvents.length;
    this.riskEvents = this.riskEvents.filter(e => e.timestamp > cutoffTime);
    const eventsRemoved = eventsBefore - this.riskEvents.length;

    log.info('[ComplianceReportEngine] Cleanup completed', {
      reportsRemoved,
      eventsRemoved,
    });

    return { reportsRemoved, eventsRemoved };
  }

  /**
   * 获取配置
   */
  getConfig(): ComplianceConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<ComplianceConfig>): void {
    this.config = { ...this.config, ...config };
    log.info('[ComplianceReportEngine] Config updated', this.config);
  }

  /**
   * 获取规则列表
   */
  getRules(): ComplianceRule[] {
    return [...this.rules];
  }

  /**
   * 重置 (仅用于测试)
   */
  reset(): void {
    this.rules = [];
    this.riskEvents = [];
    this.reports = [];
    this.initializeDefaultRules();
    log.info('[ComplianceReportEngine] Reset');
  }
}

// ── Export ──────────────────────────────────────────────────────────────────

export default ComplianceReportEngine;
