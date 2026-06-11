/**
 * J-80-02: 7 F5
 * v1.9.0 GA — Retention analytics: Day1/Day3/Day7 retention rates
 *
 * Active definition: at least 1 AI analysis or 1 trade per day
 * API: /api/analytics/retention returns retention dashboard data
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface DailyActivity {
  userId: string;
  date: string; // YYYY-MM-DD
  aiAnalysisCount: number;
  tradeCount: number;
}

export interface RetentionCohort {
  cohortDate: string; // YYYY-MM-DD — the day users first appeared
  cohortSize: number;
  day1: { retained: number; rate: number };
  day3: { retained: number; rate: number };
  day7: { retained: number; rate: number };
}

export interface RetentionReport {
  generatedAt: number;
  maxCohorts: number;
  cohorts: RetentionCohort[];
  summary: {
    avgDay1Retention: number;
    avgDay3Retention: number;
    avgDay7Retention: number;
    totalCohorts: number;
    totalUsers: number;
  };
}

// ── Engine ─────────────────────────────────────────────────────────────────

const DAY_MS = 86400000;

function dateKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export class RetentionTracker {
  private activities = new Map<string, DailyActivity[]>(); // userId → activities
  private maxCohorts = 30;

  constructor(maxCohorts = 30) {
    this.maxCohorts = maxCohorts;
  }

  /** Record user activity */
  recordActivity(userId: string, type: 'ai_analysis' | 'trade', timestamp = Date.now()): void {
    const dk = dateKey(timestamp);
    let list = this.activities.get(userId);
    if (!list) {
      list = [];
      this.activities.set(userId, list);
    }

    let entry = list.find((a) => a.date === dk);
    if (!entry) {
      entry = { userId, date: dk, aiAnalysisCount: 0, tradeCount: 0 };
      list.push(entry);
    }

    if (type === 'ai_analysis') entry.aiAnalysisCount++;
    if (type === 'trade') entry.tradeCount++;
  }

  /** Check if a user was active on a specific date */
  private isActiveOnDate(userId: string, date: string): boolean {
    const list = this.activities.get(userId);
    if (!list) return false;
    const entry = list.find((a) => a.date === date);
    if (!entry) return false;
    return entry.aiAnalysisCount > 0 || entry.tradeCount > 0;
  }

  /** Get the first active date for a user */
  private getFirstActiveDate(userId: string): string | null {
    const list = this.activities.get(userId);
    if (!list || list.length === 0) return null;
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
    return sorted[0].date;
  }

  /** Get all unique active dates for a user */
  private getActiveDates(userId: string): Set<string> {
    const set = new Set<string>();
    const list = this.activities.get(userId);
    if (list) list.forEach((a) => set.add(a.date));
    return set;
  }

  /** Generate retention report */
  generateReport(now = Date.now()): RetentionReport {
    // Build cohorts: group users by their first active date
    const users = [...this.activities.keys()];
    const cohortMap = new Map<string, Set<string>>();

    for (const userId of users) {
      const first = this.getFirstActiveDate(userId);
      if (!first) continue;
      let cohort = cohortMap.get(first);
      if (!cohort) {
        cohort = new Set<string>();
        cohortMap.set(first, cohort);
      }
      cohort.add(userId);
    }

    // Sort cohorts by date, take most recent maxCohorts
    const sortedCohorts = [...cohortMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-this.maxCohorts);

    const nowDate = dateKey(now);

    const cohorts: RetentionCohort[] = sortedCohorts.map(([cohortDate, members]) => {
      const size = members.size;

      // Compute day+1, day+3, day+7 from cohort date
      const d = new Date(cohortDate);
      const d1Date = dateKey(d.getTime() + DAY_MS);
      const d3Date = dateKey(d.getTime() + 3 * DAY_MS);
      const d7Date = dateKey(d.getTime() + 7 * DAY_MS);

      const d1Retained = [...members].filter((uid) => this.isActiveOnDate(uid, d1Date)).length;
      const d3Retained = [...members].filter((uid) => this.isActiveOnDate(uid, d3Date)).length;
      const d7Retained = [...members].filter((uid) => this.isActiveOnDate(uid, d7Date)).length;

      return {
        cohortDate,
        cohortSize: size,
        day1: {
          retained: d1Retained,
          rate: size > 0 ? Math.round((d1Retained / size) * 10000) / 10000 : 0,
        },
        day3: {
          retained: d3Retained,
          rate: size > 0 ? Math.round((d3Retained / size) * 10000) / 10000 : 0,
        },
        day7: {
          retained: d7Retained,
          rate: size > 0 ? Math.round((d7Retained / size) * 10000) / 10000 : 0,
        },
      };
    });

    // Summary
    const totalUsers = users.length;
    const avgD1 = cohorts.length > 0 ? cohorts.reduce((s, c) => s + c.day1.rate, 0) / cohorts.length : 0;
    const avgD3 = cohorts.length > 0 ? cohorts.reduce((s, c) => s + c.day3.rate, 0) / cohorts.length : 0;
    const avgD7 = cohorts.length > 0 ? cohorts.reduce((s, c) => s + c.day7.rate, 0) / cohorts.length : 0;

    return {
      generatedAt: now,
      maxCohorts: this.maxCohorts,
      cohorts,
      summary: {
        avgDay1Retention: Math.round(avgD1 * 10000) / 10000,
        avgDay3Retention: Math.round(avgD3 * 10000) / 10000,
        avgDay7Retention: Math.round(avgD7 * 10000) / 10000,
        totalCohorts: cohorts.length,
        totalUsers,
      },
    };
  }

  /** Get daily active users for a date range */
  getDAU(startDate: string, endDate: string): number {
    const active = new Set<string>();
    for (const [userId, activities] of this.activities.entries()) {
      if (
        activities.some((a) => a.date >= startDate && a.date <= endDate && (a.aiAnalysisCount > 0 || a.tradeCount > 0))
      ) {
        active.add(userId);
      }
    }
    return active.size;
  }

  /** Reset all data */
  reset(): void {
    this.activities.clear();
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let instance: RetentionTracker | null = null;

export function getRetentionTracker(): RetentionTracker {
  if (!instance) instance = new RetentionTracker();
  return instance;
}

export function resetRetentionTracker(): void {
  instance?.reset();
  instance = null;
}

export default { RetentionTracker, getRetentionTracker, resetRetentionTracker };
