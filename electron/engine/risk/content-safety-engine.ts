import i18n from '../../../src/i18n';
// ── J-76-05 R76 VFINAL: Content Safety Engine ─────────────────────────────
// Sensitive word filtering + comment moderation + user blocking
// v1.8.0 GA: community safety baseline

export interface SafetyRule {
  id: string;
  type: "sensitive_word" | "regex" | "url_block" | "spam_pattern";
  pattern: string;
  severity: "low" | "medium" | "high" | "block";
  description: string;
}

export interface ContentCheckResult {
  passed: boolean;
  flags: Array<{
    ruleId: string;
    severity: SafetyRule["severity"];
    matchedWord: string;
    position: [number, number];
  }>;
  filteredText: string;
  action: "allow" | "warn" | "block";
}

export interface CommentModerationResult {
  approved: boolean;
  reason: string;
  action: "allow" | "review" | "block";
  warnings: string[];
}

export interface BlockedUser {
  userId: string;
  blockedAt: number;
  reason: string;
  blockedBy: string;
  expiresAt: number | null; // null = permanent
}

export interface ReportItem {
  id: string;
  type: "comment" | "post" | "user";
  targetId: string;
  reporterId: string;
  reason: string;
  timestamp: number;
  status: "pending" | "reviewed" | "actioned" | "dismissed";
}

// ── Default Safety Rules ──────────────────────────────────────────────────

const DEFAULT_RULES: SafetyRule[] = [
  // Financial scam patterns (Chinese)
  { id: "SW-001", type: "sensitive_word", pattern: i18n.t('contentSafetyEngine.k1'), severity: "block", description: "Guaranteed profit claim — scam indicator" },
  { id: "SW-002", type: "sensitive_word", pattern: i18n.t('contentSafetyEngine.k2'), severity: "block", description: "Insider information claim" },
  { id: "SW-003", type: "sensitive_word", pattern: i18n.t('contentSafetyEngine.k3'), severity: "high", description: "Daily limit recommendation" },
  { id: "SW-004", type: "sensitive_word", pattern: i18n.t('contentSafetyEngine.k4'), severity: "medium", description: "Stock recommendation (unqualified)" },
  { id: "SW-005", type: "sensitive_word", pattern: i18n.t('contentSafetyEngine.k5'), severity: "medium", description: "Group invite — potential fraud" },
  { id: "SW-006", type: "sensitive_word", pattern: i18n.t('contentSafetyEngine.k6'), severity: "high", description: "Follow-me buying signal" },
  { id: "SW-007", type: "sensitive_word", pattern: i18n.t('contentSafetyEngine.k7'), severity: "block", description: "Profit guarantee" },
  { id: "SW-008", type: "sensitive_word", pattern: i18n.t('contentSafetyEngine.k8'), severity: "low", description: "Free recommendation (could be legit or spam)" },

  // General scam/fraud
  { id: "SW-009", type: "sensitive_word", pattern: "guaranteed return", severity: "block", description: "Guaranteed return claim" },
  { id: "SW-010", type: "sensitive_word", pattern: "insider tip", severity: "block", description: "Insider tip claim" },
  { id: "SW-011", type: "sensitive_word", pattern: "pump and dump", severity: "block", description: "Market manipulation" },

  // Spam patterns
  { id: "SP-001", type: "regex", pattern: "(https?://t\\.me|https?://telegram\\.me)", severity: "block", description: "Telegram group link" },
  { id: "SP-002", type: "regex", pattern: "(https?://wa\\.me|https?://chat\\.whatsapp\\.com)", severity: "block", description: "WhatsApp group link" },
  { id: "SP-003", type: "spam_pattern", pattern: i18n.t('contentSafetyEngine.k9'), severity: "low", description: "Duplicate content detection" },
];

// ── Content Safety Engine ──────────────────────────────────────────────────

export class ContentSafetyEngine {
  private rules: SafetyRule[] = [];
  private blockedUsers: Map<string, BlockedUser> = new Map();
  private reports: ReportItem[] = [];
  private customWords: Set<string> = new Set();

  constructor(customRules?: SafetyRule[]) {
    this.rules = [...DEFAULT_RULES, ...(customRules ?? [])];
  }

  /** Check text content against all safety rules */
  checkContent(text: string, userId?: string): ContentCheckResult {
    // Check if user is blocked
    if (userId && this.blockedUsers.has(userId)) {
      const block = this.blockedUsers.get(userId)!;
      if (!block.expiresAt || block.expiresAt > Date.now()) {
        return {
          passed: false,
          flags: [{ ruleId: "USER_BLOCKED", severity: "block", matchedWord: "", position: [-1, -1] }],
          filteredText: i18n.t('contentSafetyEngine.k10'),
          action: "block",
        };
      }
    }

    const flags: ContentCheckResult["flags"] = [];
    let filteredText = text;

    for (const rule of this.rules) {
      if (rule.type === "regex") {
        const regex = new RegExp(rule.pattern, "gi");
        let match: RegExpExecArray | null;
        while ((match = regex.exec(text)) !== null) {
          flags.push({
            ruleId: rule.id,
            severity: rule.severity,
            matchedWord: match[0],
            position: [match.index, match.index + match[0].length],
          });
          filteredText = filteredText.replace(match[0], "***");
        }
      } else if (rule.type === "sensitive_word") {
        const idx = text.toLowerCase().indexOf(rule.pattern.toLowerCase());
        if (idx >= 0) {
          flags.push({
            ruleId: rule.id,
            severity: rule.severity,
            matchedWord: rule.pattern,
            position: [idx, idx + rule.pattern.length],
          });
          filteredText = filteredText.replace(new RegExp(rule.pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "***");
        }
      }
    }

    // Determine action
    let action: ContentCheckResult["action"] = "allow";
    if (flags.some((f) => f.severity === "block")) {
      action = "block";
    } else if (flags.some((f) => f.severity === "high")) {
      action = "warn";
    }

    return {
      passed: action !== "block",
      flags,
      filteredText: action === "block" ? i18n.t('contentSafetyEngine.k11') : filteredText,
      action,
    };
  }

  /** Moderate a comment with additional checks */
  moderateComment(comment: string, userId: string, history: { text: string; time: number }[] = []): CommentModerationResult {
    const warnings: string[] = [];

    // Content safety check
    const check = this.checkContent(comment, userId);
    if (check.action === "block") {
      return { approved: false, reason: i18n.t('contentSafetyEngine.k12'), action: "block", warnings };
    }

    // Spam detection: duplicate content
    const isDuplicate = history.some((h) => h.text === comment && Date.now() - h.time < 60_000);
    if (isDuplicate) {
      warnings.push(i18n.t('contentSafetyEngine.k13'));
    }

    // Spam detection: rate limiting (5 comments in 1 minute)
    const recentCount = history.filter((h) => Date.now() - h.time < 60_000).length;
    if (recentCount >= 5) {
      return { approved: false, reason: i18n.t('contentSafetyEngine.k14'), action: "block", warnings };
    }

    // Length check
    if (comment.length < 1) {
      return { approved: false, reason: i18n.t('contentSafetyEngine.k15'), action: "block", warnings };
    }
    if (comment.length > 2000) {
      return { approved: false, reason: i18n.t('contentSafetyEngine.k16'), action: "block", warnings };
    }

    const action = warnings.length > 0 ? "review" : "allow";
    return { approved: action !== "block", reason: warnings.join("; ") || i18n.t('contentSafetyEngine.k17'), action, warnings };
  }

  // ── User Blocking ─────────────────────────────────────────────────────

  blockUser(userId: string, reason: string, blockedBy: string, durationMs: number | null = null): BlockedUser {
    const record: BlockedUser = {
      userId,
      blockedAt: Date.now(),
      reason,
      blockedBy,
      expiresAt: durationMs ? Date.now() + durationMs : null,
    };
    this.blockedUsers.set(userId, record);
    return record;
  }

  unblockUser(userId: string): void {
    this.blockedUsers.delete(userId);
  }

  isBlocked(userId: string): boolean {
    const block = this.blockedUsers.get(userId);
    if (!block) return false;
    if (block.expiresAt && block.expiresAt < Date.now()) {
      this.blockedUsers.delete(userId);
      return false;
    }
    return true;
  }

  getBlockList(): BlockedUser[] {
    const now = Date.now();
    return [...this.blockedUsers.values()].filter((b) => !b.expiresAt || b.expiresAt > now);
  }

  // ── Reporting ─────────────────────────────────────────────────────────

  reportItem(type: ReportItem["type"], targetId: string, reporterId: string, reason: string): ReportItem {
    const report: ReportItem = {
      id: `report-${Date.now()}`,
      type, targetId, reporterId, reason,
      timestamp: Date.now(),
      status: "pending",
    };
    this.reports.push(report);
    return report;
  }

  getReports(status?: ReportItem["status"]): ReportItem[] {
    if (!status) return [...this.reports];
    return this.reports.filter((r) => r.status === status);
  }

  handleReport(reportId: string, action: "actioned" | "dismissed"): ReportItem | null {
    const report = this.reports.find((r) => r.id === reportId);
    if (!report) return null;
    report.status = action;
    return report;
  }

  // ── Custom Words ──────────────────────────────────────────────────────

  addCustomWord(word: string): void {
    this.customWords.add(word);
    this.rules.push({
      id: `CUSTOM-${Date.now()}`,
      type: "sensitive_word",
      pattern: word,
      severity: "medium",
      description: `Custom blocked word: ${word}`,
    });
  }

  removeCustomWord(word: string): void {
    this.customWords.delete(word);
    this.rules = this.rules.filter((r) => r.pattern !== word);
  }

  // ── Config ────────────────────────────────────────────────────────────

  addRule(rule: SafetyRule): void {
    this.rules.push(rule);
  }

  removeRule(ruleId: string): void {
    this.rules = this.rules.filter((r) => r.id !== ruleId);
  }

  getRules(): SafetyRule[] {
    return [...this.rules];
  }

  reset(): void {
    this.blockedUsers.clear();
    this.reports = [];
    this.customWords.clear();
    this.rules = [...DEFAULT_RULES];
  }
}

// ── Factory ──────────────────────────────────────────────────────────────

let _instance: ContentSafetyEngine | null = null;

export function getContentSafetyEngine(customRules?: SafetyRule[]): ContentSafetyEngine {
  if (!_instance) _instance = new ContentSafetyEngine(customRules);
  return _instance;
}

export function resetContentSafetyEngine(): void {
  _instance?.reset();
  _instance = null;
}

export default ContentSafetyEngine;
