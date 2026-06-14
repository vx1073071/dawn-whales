// ── R179 G22: Audit Anomaly Detection ───────────────────────────────────────
// Detects suspicious patterns in the audit trail that may indicate
// probing, brute-force attempts, or compromised accounts.
//
// Detection rules:
//   1. Rate anomaly: 200+ audit entries in 1 hour (single user)
//   2. IP cross-user: same IP accessing 5+ different user accounts
//   3. sk- pattern: any occurrence of "sk-" in audit data (API key leak attempt)
//   4. Sequential probing: rapid user enumeration across account IDs
//   5. Time anomaly: activities at unusual hours (02:00-05:00 local, non-maintenance)
//
// Usage:
//   import { detectAnomalies, getAnomalyQueue } from './audit-anomaly-detector';
//   const alerts = detectAnomalies(auditEntries);

import log from 'electron-log';

// ── Types ───────────────────────────────────────────────────────────────────

export interface AuditEntry {
  timestamp: string;      // ISO 8601
  userId: string;
  action: string;          // e.g., 'ai.recommend', 'login', 'view.strategy'
  ip?: string;
  userAgent?: string;
  details?: string;        // additional context
}

export interface AnomalyAlert {
  id: string;
  rule: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId?: string;
  ip?: string;
  evidence: string;
  timestamp: string;
}

export interface AuditAnomalyConfig {
  enabled: boolean;
  /** Max entries per user per hour before alerting */
  rateThreshold: number;
  /** Max users per IP before cross-user alert */
  ipUserThreshold: number;
  /** Time window in minutes */
  windowMinutes: number;
}

// ── Config ──────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: AuditAnomalyConfig = {
  enabled: true,
  rateThreshold: 200,
  ipUserThreshold: 5,
  windowMinutes: 60,
};

let config: AuditAnomalyConfig = { ...DEFAULT_CONFIG };

// ── Alert Queue ─────────────────────────────────────────────────────────────

const alerts: AnomalyAlert[] = [];
const MAX_ALERTS = 100;

function emitAlert(alert: Omit<AnomalyAlert, 'id' | 'timestamp'>): void {
  const entry: AnomalyAlert = {
    ...alert,
    id: `ANO-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
  };
  alerts.push(entry);
  if (alerts.length > MAX_ALERTS) alerts.shift();
  log.warn(`[AuditAnomaly] ${alert.rule} severity=${alert.severity} ${alert.evidence}`);
}

// ── Rule 1: Rate Anomaly ────────────────────────────────────────────────────

/**
 * Detect users generating excessive audit entries within the time window.
 * Threshold: 200 entries/hour by default.
 */
export function detectRateAnomaly(entries: AuditEntry[]): AnomalyAlert[] {
  if (!config.enabled || entries.length < config.rateThreshold) return [];

  const windowMs = config.windowMinutes * 60 * 1000;
  const now = Date.now();
  const userCounts: Record<string, number> = {};

  for (const entry of entries) {
    const entryTime = new Date(entry.timestamp).getTime();
    if (now - entryTime > windowMs) continue;

    userCounts[entry.userId] = (userCounts[entry.userId] || 0) + 1;
  }

  const results: AnomalyAlert[] = [];
  for (const [userId, count] of Object.entries(userCounts)) {
    if (count >= config.rateThreshold) {
      const alert: AnomalyAlert = {
        id: `RATE-${userId}-${Date.now()}`,
        rule: 'RATE_ANOMALY',
        severity: count >= 500 ? 'critical' : count >= 300 ? 'high' : 'medium',
        userId,
        evidence: `User ${userId} generated ${count} audit entries in the last ${config.windowMinutes} minutes`,
        timestamp: new Date().toISOString(),
      };
      results.push(alert);
      alerts.push(alert);
      if (alerts.length > MAX_ALERTS) alerts.shift();
      log.warn(`[AuditAnomaly] ${alert.evidence}`);
    }
  }

  return results;
}

// ── Rule 2: IP Cross-User ──────────────────────────────────────────────────

/**
 * Detect a single IP accessing multiple different user accounts.
 * Threshold: 5+ different users from same IP.
 */
export function detectIPCrossUser(entries: AuditEntry[]): AnomalyAlert[] {
  if (!config.enabled) return [];

  const ipUsers: Record<string, Set<string>> = {};

  for (const entry of entries) {
    if (!entry.ip) continue;
    if (!ipUsers[entry.ip]) ipUsers[entry.ip] = new Set();
    ipUsers[entry.ip].add(entry.userId);
  }

  const results: AnomalyAlert[] = [];
  for (const [ip, users] of Object.entries(ipUsers)) {
    if (users.size >= config.ipUserThreshold) {
      const alert: AnomalyAlert = {
        id: `IPXU-${ip.replace(/[.:]/g, '-')}-${Date.now()}`,
        rule: 'IP_CROSS_USER',
        severity: users.size >= 20 ? 'critical' : users.size >= 10 ? 'high' : 'medium',
        ip,
        evidence: `IP ${ip} accessed ${users.size} different user accounts: [${[...users].slice(0, 10).join(', ')}${users.size > 10 ? '...' : ''}]`,
        timestamp: new Date().toISOString(),
      };
      results.push(alert);
      alerts.push(alert);
      if (alerts.length > MAX_ALERTS) alerts.shift();
    }
  }

  return results;
}

// ── Rule 3: sk- Pattern Detection ───────────────────────────────────────────

/**
 * Detect "sk-" pattern in audit details — API key exfiltration attempt.
 * The "sk-" prefix is OpenAI-style API key format; also checks similar patterns.
 */
export function detectSKPattern(entries: AuditEntry[]): AnomalyAlert[] {
  if (!config.enabled) return [];

  const SK_PATTERNS = [
    /\bsk-[a-zA-Z0-9]{20,}\b/,
    /\bapi[_-]?key\s*[:=]\s*\S{16,}/i,
    /\bsecret\s*[:=]\s*\S{10,}/i,
    /\baccess[_-]?token\s*[:=]\s*\S{16,}/i,
  ];

  const results: AnomalyAlert[] = [];

  for (const entry of entries) {
    const testStr = [
      entry.action,
      entry.details,
      entry.userAgent,
    ].filter(Boolean).join(' ');

    for (const pattern of SK_PATTERNS) {
      if (pattern.test(testStr)) {
        pattern.lastIndex = 0;
        if (pattern.test(testStr)) {
          emitAlert({
            rule: 'SK_PATTERN',
            severity: 'critical',
            userId: entry.userId,
            ip: entry.ip,
            evidence: `Potential API key leak detected in audit data from user ${entry.userId} (action: ${entry.action}, IP: ${entry.ip || 'unknown'})`,
          });
          results.push(alerts[alerts.length - 1]);
          break; // one alert per entry
        }
      }
    }
  }

  return results;
}

// ── Rule 4: Sequential User Probing ─────────────────────────────────────────

/**
 * Detect rapid sequential access across different user IDs
 * (enumeration attempt through sequential account IDs).
 */
export function detectUserProbing(entries: AuditEntry[]): AnomalyAlert[] {
  if (!config.enabled || entries.length < 5) return [];

  // Group by (IP, userAgent) pairs within the window
  const windowMs = config.windowMinutes * 60 * 1000;
  const now = Date.now();

  const sessions: Record<string, AuditEntry[]> = {};

  for (const entry of entries) {
    if (now - new Date(entry.timestamp).getTime() > windowMs) continue;
    const key = `${entry.ip || 'noip'}|${entry.userAgent || 'noua'}`;
    if (!sessions[key]) sessions[key] = [];
    sessions[key].push(entry);
  }

  const results: AnomalyAlert[] = [];
  for (const [key, sessionEntries] of Object.entries(sessions)) {
    if (sessionEntries.length < 5) continue;

    // Count unique users
    const uniqueUsers = new Set(sessionEntries.map(e => e.userId));
    if (uniqueUsers.size >= 5) {
      emitAlert({
        rule: 'USER_PROBING',
        severity: uniqueUsers.size >= 20 ? 'critical' : 'high',
        ip: key.split('|')[0],
        evidence: `Potential user enumeration: ${uniqueUsers.size} different users accessed from ${key} within ${config.windowMinutes} minutes`,
      });
      results.push(alerts[alerts.length - 1]);
    }
  }

  return results;
}

// ── Rule 5: Time Anomaly ────────────────────────────────────────────────────

/**
 * Detect activity at unusual hours (02:00-05:00 local).
 * Flags high-frequency off-hours activity as potential automated probing.
 */
export function detectTimeAnomaly(entries: AuditEntry[]): AnomalyAlert[] {
  if (!config.enabled || entries.length === 0) return [];

  const ODD_HOURS = [2, 3, 4]; // 02:00-04:59
  const windowMs = config.windowMinutes * 60 * 1000;
  const now = Date.now();

  const oddHourEntries = entries.filter(e => {
    const hour = new Date(e.timestamp).getHours();
    return ODD_HOURS.includes(hour) && (now - new Date(e.timestamp).getTime() <= windowMs);
  });

  if (oddHourEntries.length >= 50) {
    const uniqueUsers = new Set(oddHourEntries.map(e => e.userId));
    emitAlert({
      rule: 'TIME_ANOMALY',
      severity: oddHourEntries.length >= 100 ? 'high' : 'medium',
      evidence: `${oddHourEntries.length} audit entries during off-hours (02:00-04:59) from ${uniqueUsers.size} users — possible automated activity`,
    });
    return [alerts[alerts.length - 1]];
  }

  return [];
}

// ── Top-Level Detection ─────────────────────────────────────────────────────

/**
 * Run all detection rules against a set of audit entries.
 * Returns all alerts found.
 */
export function detectAnomalies(entries: AuditEntry[]): AnomalyAlert[] {
  if (!config.enabled) return [];

  const allAlerts: AnomalyAlert[] = [
    ...detectRateAnomaly(entries),
    ...detectIPCrossUser(entries),
    ...detectSKPattern(entries),
    ...detectUserProbing(entries),
    ...detectTimeAnomaly(entries),
  ];

  if (allAlerts.length > 0) {
    log.warn(`[AuditAnomaly] ${allAlerts.length} anomalies detected across 5 rules`);
  }

  return allAlerts;
}

/**
 * Detect anomalies from a single new audit entry.
 * More lightweight — designed for real-time use.
 */
export function detectAnomalyFromEntry(entry: AuditEntry, recentEntries: AuditEntry[]): AnomalyAlert[] {
  return detectAnomalies([...recentEntries, entry]);
}

// ── Alert Queue ─────────────────────────────────────────────────────────────

export function getAnomalyQueue(): Readonly<AnomalyAlert[]> {
  return [...alerts];
}

export function clearAnomalyQueue(): void {
  alerts.length = 0;
}

export function getAnomalyStats(): {
  totalAlerts: number;
  byRule: Record<string, number>;
  bySeverity: Record<string, number>;
} {
  const byRule: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};

  for (const alert of alerts) {
    byRule[alert.rule] = (byRule[alert.rule] || 0) + 1;
    bySeverity[alert.severity] = (bySeverity[alert.severity] || 0) + 1;
  }

  return {
    totalAlerts: alerts.length,
    byRule,
    bySeverity,
  };
}

// ── Configuration ───────────────────────────────────────────────────────────

export function getAnomalyConfig(): Readonly<AuditAnomalyConfig> {
  return { ...config };
}

export function updateAnomalyConfig(partial: Partial<AuditAnomalyConfig>): void {
  config = { ...config, ...partial };
}

export function resetAnomalyConfig(): void {
  config = { ...DEFAULT_CONFIG };
  alerts.length = 0;
}

log.info('[AuditAnomalyDetector] Initialized — 5 anomaly detection rules active');
