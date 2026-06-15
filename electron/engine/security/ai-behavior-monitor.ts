// ── R183 P2-04: AI Behavior Anomaly Monitor ──────────────────────────────────
// Detects abnormal user usage patterns that may indicate:
//   - Automated/scripted access (high frequency, regular intervals)
//   - Data scraping (low intent diversity, no backtest)
//   - Auditing/attack patterns (off-hours, rapid intent switching)
//
// When anomaly detected:
//   riskScore 70+ → degrade to free mode, no billing
//   riskScore 90+ → block AI recommendations for 24h
//
// Reference: Robinhood AI fraud detection patterns, Azure anomaly detector.

import log from 'electron-log';

// ── Types ───────────────────────────────────────────────────────────────────

export type BehaviorFlag =
  | 'HIGH_FREQUENCY'       // >20 requests/hour
  | 'LOW_DIVERSITY'         // intent diversity <2 unique intents out of 10+ requests
  | 'OFF_HOURS'             // local time 0-6 am, high frequency
  | 'SCRIPT_PATTERN'        // regular intervals suggest script
  | 'NO_BACKTEST'           // many recommendations but zero backtests
  | 'RAPID_INTENT_SWITCH'   // switching intents too fast (<5s between)
  | 'MULTILINGUAL_GAMING'   // using multiple languages to bypass guards
  | 'CONSECUTIVE_FAILURES'; // many consecutive blocked/billing-failed attempts

export interface UserBehaviorProfile {
  userId: string;
  hourlyRequestTimes: number[];     // timestamps of last 24h requests
  uniqueIntents: Set<string>;       // unique intent types used
  lastIntentTime: number;           // ms between last two intents
  backtestCount: number;            // # of backtests requested
  recommendationCount: number;      // # of recommendations requested
  blockedCount: number;             // # of guard-blocked attempts
  billingFailureCount: number;      // # of billing failures
  languages: Set<string>;           // detected languages in queries
  riskScore: number;                // 0-100
  flags: BehaviorFlag[];
  blockUntil?: number;              // if riskScore > 90, blocked until timestamp
}

export interface AnomalyReport {
  userId: string;
  riskScore: number;
  flags: BehaviorFlag[];
  blocked: boolean;
  degraded: boolean;               // degraded to free mode
  summary: string;
  recommendation: string;
}

// ── Thresholds ──────────────────────────────────────────────────────────────

const FREQUENCY_THRESHOLD = 20;         // >20 requests/hour
const LOW_DIVERSITY_THRESHOLD = 2;     // <2 unique intents in 10+ requests
const SCRIPT_INTERVAL_JITTER = 0.15;   // <15% variance in intervals
const OFF_HOURS_START = 0;             // 0:00
const OFF_HOURS_END = 6;               // 6:00
const RAPID_SWITCH_MS = 5000;          // <5s between intents
const FAILURE_THRESHOLD = 5;           // >5 consecutive failures
const RISK_DEGRADE = 70;               // degrade to free
const RISK_BLOCK = 90;                 // block entirely
const WINDOW_MS = 24 * 3600000;        // 24h window

// ── Monitor ─────────────────────────────────────────────────────────────────

export class AIBehaviorMonitor {
  private profiles = new Map<string, UserBehaviorProfile>();
  private blockedUsers = new Set<string>();

  /** Record a single interaction for a user. */
  recordInteraction(
    userId: string,
    opts: {
      intent: string;
      query: string;
      blocked: boolean;
      billingFailed: boolean;
      hadBacktest: boolean;
      language?: string;
    },
  ): void {
    const now = Date.now();
    let profile = this.profiles.get(userId);

    if (!profile) {
      profile = {
        userId,
        hourlyRequestTimes: [],
        uniqueIntents: new Set(),
        lastIntentTime: 0,
        backtestCount: 0,
        recommendationCount: 0,
        blockedCount: 0,
        billingFailureCount: 0,
        languages: new Set(),
        riskScore: 0,
        flags: [],
      };
      this.profiles.set(userId, profile);
    }

    // Clean old timestamps
    profile.hourlyRequestTimes = profile.hourlyRequestTimes.filter(t => now - t < WINDOW_MS);

    // Record
    profile.hourlyRequestTimes.push(now);
    profile.uniqueIntents.add(opts.intent);
    profile.recommendationCount++;
    if (opts.hadBacktest) profile.backtestCount++;
    if (opts.blocked) profile.blockedCount++;
    if (opts.billingFailed) profile.billingFailureCount++;
    if (opts.language) profile.languages.add(opts.language);

    profile.lastIntentTime = now;

    // Truncate to last 24h
    if (profile.hourlyRequestTimes.length > 500) {
      profile.hourlyRequestTimes = profile.hourlyRequestTimes.slice(-500);
    }

    // Run anomaly detection
    this.detectAnomalies(profile);
  }

  /** Check if user is currently blocked. */
  isBlocked(userId: string): boolean {
    if (this.blockedUsers.has(userId)) {
      const profile = this.profiles.get(userId);
      if (profile?.blockUntil && Date.now() > profile.blockUntil) {
        this.blockedUsers.delete(userId);
        log.info(`[BehaviorMonitor] User ${userId.slice(0, 8)} block expired`);
        return false;
      }
      return true;
    }
    return false;
  }

  /** Get full anomaly report for a user. */
  getReport(userId: string): AnomalyReport {
    const profile = this.profiles.get(userId);
    if (!profile) {
      return {
        userId, riskScore: 0, flags: [],
        blocked: false, degraded: false,
        summary: '无用户数据',
        recommendation: '正常使用',
      };
    }

    const blocked = this.isBlocked(userId);
    const degraded = profile.riskScore >= RISK_DEGRADE && !blocked;

    return {
      userId,
      riskScore: profile.riskScore,
      flags: profile.flags,
      blocked,
      degraded,
      summary: this.buildSummary(profile),
      recommendation: blocked
        ? 'AI服务已暂停24h。请通过正常方式使用平台。'
        : degraded
          ? '检测到异常使用模式，已降级为免费模式。请联系客服恢复。'
          : '使用模式正常',
    };
  }

  /** Get stats for all users (admin dashboard). */
  getAllStats(): {
    totalUsers: number;
    blockedUsers: number;
    degradedUsers: number;
    avgRiskScore: number;
    topFlags: Array<{ flag: string; count: number }>;
  } {
    let totalRisk = 0;
    let blocked = 0;
    let degraded = 0;
    const flagCounts: Record<string, number> = {};

    for (const [userId, profile] of this.profiles) {
      totalRisk += profile.riskScore;
      if (this.isBlocked(userId)) blocked++;
      else if (profile.riskScore >= RISK_DEGRADE) degraded++;

      for (const flag of profile.flags) {
        flagCounts[flag] = (flagCounts[flag] || 0) + 1;
      }
    }

    const users = this.profiles.size || 1;
    return {
      totalUsers: users,
      blockedUsers: blocked,
      degradedUsers: degraded,
      avgRiskScore: Math.round(totalRisk / users),
      topFlags: Object.entries(flagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([flag, count]) => ({ flag, count })),
    };
  }

  /** Reset monitoring for a user (admin action). */
  resetUser(userId: string): void {
    this.profiles.delete(userId);
    this.blockedUsers.delete(userId);
    log.info(`[BehaviorMonitor] Reset user ${userId.slice(0, 8)}`);
  }

  // ── Internal ──────────────────────────────────────────────────────────

  private detectAnomalies(profile: UserBehaviorProfile): void {
    const now = Date.now();
    const flags: BehaviorFlag[] = [];
    let score = 0;

    // 1. Frequency check
    const recentRequests = profile.hourlyRequestTimes.filter(t => now - t < 3600000);
    const hourlyRate = recentRequests.length;
    if (hourlyRate > FREQUENCY_THRESHOLD) {
      flags.push('HIGH_FREQUENCY');
      score += Math.min(40, (hourlyRate - FREQUENCY_THRESHOLD) * 2);
    }

    // 2. Intent diversity
    const uniqueIntents = profile.uniqueIntents.size;
    if (profile.recommendationCount >= 10 && uniqueIntents < LOW_DIVERSITY_THRESHOLD) {
      flags.push('LOW_DIVERSITY');
      score += 20;
    }

    // 3. Off-hours check
    const hour = new Date().getHours();
    if (hour >= OFF_HOURS_START && hour < OFF_HOURS_END && hourlyRate > 5) {
      flags.push('OFF_HOURS');
      score += 15;
    }

    // 4. Script pattern detection
    if (recentRequests.length >= 5) {
      const sorted = recentRequests.sort((a, b) => a - b);
      const intervals: number[] = [];
      for (let i = 1; i < sorted.length; i++) {
        intervals.push(sorted[i] - sorted[i - 1]);
      }
      if (intervals.length >= 4) {
        const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const variance = intervals.reduce((a, b) => a + (b - mean) ** 2, 0) / intervals.length;
        const cv = Math.sqrt(variance) / Math.max(mean, 1); // coefficient of variation
        if (cv < SCRIPT_INTERVAL_JITTER) {
          flags.push('SCRIPT_PATTERN');
          score += 35;
        }
      }
    }

    // 5. No backtest
    if (profile.recommendationCount >= 5 && profile.backtestCount === 0) {
      flags.push('NO_BACKTEST');
      score += 10;
    }

    // 6. Rapid intent switching
    if (profile.recommendationCount >= 3 && profile.lastIntentTime > 0) {
      // Check if recent requests were rapid
      const rapidCount = recentRequests.filter((t, i) => {
        if (i === 0) return false;
        return t - recentRequests[i - 1] < RAPID_SWITCH_MS;
      }).length;
      if (rapidCount >= 3) {
        flags.push('RAPID_INTENT_SWITCH');
        score += 20;
      }
    }

    // 7. Multi-language gaming
    if (profile.languages.size >= 3) {
      flags.push('MULTILINGUAL_GAMING');
      score += 10;
    }

    // 8. Consecutive failures
    if (profile.blockedCount + profile.billingFailureCount >= FAILURE_THRESHOLD) {
      flags.push('CONSECUTIVE_FAILURES');
      score += 15;
    }

    profile.flags = flags;
    profile.riskScore = Math.min(100, score);

    // Enforce blocking
    if (profile.riskScore >= RISK_BLOCK && !this.blockedUsers.has(profile.userId)) {
      this.blockedUsers.add(profile.userId);
      profile.blockUntil = now + 24 * 3600000;
      log.warn(`[BehaviorMonitor] BLOCKED user ${profile.userId.slice(0, 8)} (risk=${profile.riskScore}, flags=${flags.join(',')})`);
    } else if (profile.riskScore >= RISK_DEGRADE && profile.riskScore < RISK_BLOCK) {
      log.info(`[BehaviorMonitor] DEGRADED user ${profile.userId.slice(0, 8)} (risk=${profile.riskScore})`);
    }
  }

  private buildSummary(profile: UserBehaviorProfile): string {
    if (profile.flags.length === 0) return '使用模式正常';
    const parts = profile.flags.map(f => {
      const map: Record<string, string> = {
        HIGH_FREQUENCY: '高频请求',
        LOW_DIVERSITY: '意图单一',
        OFF_HOURS: '深夜使用',
        SCRIPT_PATTERN: '疑似脚本',
        NO_BACKTEST: '无回测',
        RAPID_INTENT_SWITCH: '快速切换',
        MULTILINGUAL_GAMING: '多语言试探',
        CONSECUTIVE_FAILURES: '连续失败',
      };
      return map[f] || f;
    });
    return `检测到: ${parts.join('、')}。风险评分: ${profile.riskScore}/100`;
  }
}

// ── Singleton ───────────────────────────────────────────────────────────────

let _monitor: AIBehaviorMonitor | null = null;

export function getAIBehaviorMonitor(): AIBehaviorMonitor {
  if (!_monitor) _monitor = new AIBehaviorMonitor();
  return _monitor;
}

export function resetAIBehaviorMonitor(): void {
  _monitor = null;
}
