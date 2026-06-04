// ── Data Consistency Checker (JVS-39) ────────────────────────────────────────
// Cross-module data validation to ensure data integrity

import log from 'electron-log';
import { getMarketOverview } from './emi-unified';
import { getStockCapitalFlowRank, getSectorCapitalFlowRank } from './capital-flow-rank';
import { getDragonTigerList } from './dragon-tiger-list';
import { getMacroDataReport } from './macro-data';
import { getMarginDataReport } from './margin-data';
import { getConsumerDataReport } from './consumer-data';
import { getUnlockCalendar } from './unlock-calendar';
import { getDividendCalendar } from './dividend-calendar';
import { getEarningsCalendar } from './earnings-calendar';

// ── Types ──────────────────────────────────────────────────────────────────

export type ConsistencyLevel = 'pass' | 'warning' | 'error';

export interface ConsistencyCheck {
  name: string;
  level: ConsistencyLevel;
  message: string;
  details?: any;
  timestamp: number;
}

export interface ConsistencyReport {
  timestamp: number;
  totalChecks: number;
  passed: number;
  warnings: number;
  errors: number;
  checks: ConsistencyCheck[];
  overallStatus: ConsistencyLevel;
}

// ── Validation Rules ───────────────────────────────────────────────────────

interface ValidationRule {
  name: string;
  validate: () => Promise<ConsistencyCheck>;
}

// ── Helper Functions ───────────────────────────────────────────────────────

function createCheck(
  name: string,
  level: ConsistencyLevel,
  message: string,
  details?: any
): ConsistencyCheck {
  return {
    name,
    level,
    message,
    details,
    timestamp: Date.now(),
  };
}

// ── Validation Rules ───────────────────────────────────────────────────────

const rules: ValidationRule[] = [
  // 1. Market Overview Data Freshness
  {
    name: 'Market Overview Freshness',
    validate: async () => {
      try {
        const overview = await getMarketOverview();
        const age = Date.now() - overview.timestamp;
        const maxAge = 5 * 60 * 1000; // 5 minutes

        if (age > maxAge) {
          return createCheck(
            'Market Overview Freshness',
            'warning',
            `Market data is ${Math.round(age / 1000)}s old (max: ${maxAge / 1000}s)`,
            { age, timestamp: overview.timestamp }
          );
        }

        return createCheck(
          'Market Overview Freshness',
          'pass',
          `Market data is fresh (${Math.round(age / 1000)}s old)`
        );
      } catch (err: any) {
        return createCheck(
          'Market Overview Freshness',
          'error',
          `Failed to fetch market overview: ${err.message}`
        );
      }
    },
  },

  // 2. Capital Flow Data Availability
  {
    name: 'Capital Flow Data Availability',
    validate: async () => {
      try {
        const [stockFlow, sectorFlow] = await Promise.all([
          getStockCapitalFlowRank(10),
          getSectorCapitalFlowRank(10),
        ]);

        const stockCount = stockFlow?.length || 0;
        const sectorCount = sectorFlow?.length || 0;

        if (stockCount === 0 && sectorCount === 0) {
          return createCheck(
            'Capital Flow Data Availability',
            'error',
            'No capital flow data available'
          );
        }

        if (stockCount < 5 || sectorCount < 3) {
          return createCheck(
            'Capital Flow Data Availability',
            'warning',
            `Limited capital flow data: ${stockCount} stocks, ${sectorCount} sectors`,
            { stockCount, sectorCount }
          );
        }

        return createCheck(
          'Capital Flow Data Availability',
          'pass',
          `Capital flow data available: ${stockCount} stocks, ${sectorCount} sectors`
        );
      } catch (err: any) {
        return createCheck(
          'Capital Flow Data Availability',
          'error',
          `Failed to fetch capital flow data: ${err.message}`
        );
      }
    },
  },

  // 3. Dragon Tiger List Consistency
  {
    name: 'Dragon Tiger List Consistency',
    validate: async () => {
      try {
        const dragonTiger = await getDragonTigerList();

        if (!dragonTiger || !dragonTiger.entries) {
          return createCheck(
            'Dragon Tiger List Consistency',
            'warning',
            'Dragon tiger list is empty or unavailable'
          );
        }

        // Check for negative volumes (should be positive)
        const invalidVolumes = dragonTiger.entries.filter(
          (e: any) => e.volume !== undefined && e.volume < 0
        );

        if (invalidVolumes.length > 0) {
          return createCheck(
            'Dragon Tiger List Consistency',
            'error',
            `${invalidVolumes.length} entries have negative volumes`,
            { invalidCount: invalidVolumes.length }
          );
        }

        // Check for extreme price changes (>20%)
        const extremeChanges = dragonTiger.entries.filter(
          (e: any) => Math.abs(e.changePct || 0) > 20
        );

        if (extremeChanges.length > 0) {
          return createCheck(
            'Dragon Tiger List Consistency',
            'warning',
            `${extremeChanges.length} entries have extreme price changes (>20%)`,
            { extremeCount: extremeChanges.length }
          );
        }

        return createCheck(
          'Dragon Tiger List Consistency',
          'pass',
          `Dragon tiger list has ${dragonTiger.entries.length} valid entries`
        );
      } catch (err: any) {
        return createCheck(
          'Dragon Tiger List Consistency',
          'error',
          `Failed to fetch dragon tiger list: ${err.message}`
        );
      }
    },
  },

  // 4. Macro Data Completeness
  {
    name: 'Macro Data Completeness',
    validate: async () => {
      try {
        const macroData = await getMacroDataReport();

        if (!macroData) {
          return createCheck(
            'Macro Data Completeness',
            'error',
            'Macro data is unavailable'
          );
        }

        const requiredFields = ['gdp', 'cpi', 'pmi'];
        const missingFields = requiredFields.filter(field => !macroData[field]);

        if (missingFields.length > 0) {
          return createCheck(
            'Macro Data Completeness',
            'warning',
            `Missing macro fields: ${missingFields.join(', ')}`,
            { missingFields }
          );
        }

        return createCheck(
          'Macro Data Completeness',
          'pass',
          'All required macro fields present'
        );
      } catch (err: any) {
        return createCheck(
          'Macro Data Completeness',
          'error',
          `Failed to fetch macro data: ${err.message}`
        );
      }
    },
  },

  // 5. Margin Data Validation
  {
    name: 'Margin Data Validation',
    validate: async () => {
      try {
        const marginData = await getMarginDataReport();

        if (!marginData) {
          return createCheck(
            'Margin Data Validation',
            'warning',
            'Margin data is unavailable'
          );
        }

        // Check for negative balances (should be positive)
        if (marginData.marginBalance && marginData.marginBalance < 0) {
          return createCheck(
            'Margin Data Validation',
            'error',
            'Margin balance is negative',
            { marginBalance: marginData.marginBalance }
          );
        }

        return createCheck(
          'Margin Data Validation',
          'pass',
          'Margin data is valid'
        );
      } catch (err: any) {
        return createCheck(
          'Margin Data Validation',
          'error',
          `Failed to fetch margin data: ${err.message}`
        );
      }
    },
  },

  // 6. Calendar Events Consistency
  {
    name: 'Calendar Events Consistency',
    validate: async () => {
      try {
        const [unlock, dividend, earnings] = await Promise.all([
          getUnlockCalendar(),
          getDividendCalendar(),
          getEarningsCalendar(),
        ]);

        const now = Date.now();

        // Check for past events (should be filtered out)
        const pastUnlocks = unlock?.events?.filter((e: any) => e.date && new Date(e.date).getTime() < now) || [];
        const pastDividends = dividend?.events?.filter((e: any) => e.exDate && new Date(e.exDate).getTime() < now) || [];
        const pastEarnings = earnings?.events?.filter((e: any) => e.date && new Date(e.date).getTime() < now) || [];

        const totalPast = pastUnlocks.length + pastDividends.length + pastEarnings.length;

        if (totalPast > 10) {
          return createCheck(
            'Calendar Events Consistency',
            'warning',
            `${totalPast} past events found in calendar (should be filtered)`,
            { pastUnlocks: pastUnlocks.length, pastDividends: pastDividends.length, pastEarnings: pastEarnings.length }
          );
        }

        return createCheck(
          'Calendar Events Consistency',
          'pass',
          'Calendar events are properly filtered'
        );
      } catch (err: any) {
        return createCheck(
          'Calendar Events Consistency',
          'error',
          `Failed to fetch calendar events: ${err.message}`
        );
      }
    },
  },

  // 7. Cross-Module Stock Code Consistency
  {
    name: 'Cross-Module Stock Code Consistency',
    validate: async () => {
      try {
        const [stockFlow, dragonTiger] = await Promise.all([
          getStockCapitalFlowRank(50),
          getDragonTigerList(),
        ]);

        const flowCodes = new Set((stockFlow || []).map((s: any) => s.code));
        const dragonCodes = new Set((dragonTiger?.entries || []).map((e: any) => e.code));

        // Find stocks in dragon tiger but not in capital flow (unusual)
        const missingInFlow = Array.from(dragonCodes).filter(code => !flowCodes.has(code));

        if (missingInFlow.length > 10) {
          return createCheck(
            'Cross-Module Stock Code Consistency',
            'warning',
            `${missingInFlow.length} stocks in dragon tiger list but not in capital flow`,
            { missingInFlow: missingInFlow.slice(0, 10) }
          );
        }

        return createCheck(
          'Cross-Module Stock Code Consistency',
          'pass',
          'Stock codes are consistent across modules'
        );
      } catch (err: any) {
        return createCheck(
          'Cross-Module Stock Code Consistency',
          'error',
          `Failed to validate stock code consistency: ${err.message}`
        );
      }
    },
  },

  // 8. Consumer Data Range Validation
  {
    name: 'Consumer Data Range Validation',
    validate: async () => {
      try {
        const consumerData = await getConsumerDataReport();

        if (!consumerData) {
          return createCheck(
            'Consumer Data Range Validation',
            'warning',
            'Consumer data is unavailable'
          );
        }

        // Check CPI range (should be between -10% and +20%)
        if (consumerData.cpi && (consumerData.cpi < -10 || consumerData.cpi > 20)) {
          return createCheck(
            'Consumer Data Range Validation',
            'error',
            `CPI value out of range: ${consumerData.cpi}%`,
            { cpi: consumerData.cpi }
          );
        }

        return createCheck(
          'Consumer Data Range Validation',
          'pass',
          'Consumer data values are within expected ranges'
        );
      } catch (err: any) {
        return createCheck(
          'Consumer Data Range Validation',
          'error',
          `Failed to fetch consumer data: ${err.message}`
        );
      }
    },
  },
];

// ── Consistency Checker ────────────────────────────────────────────────────

export async function runConsistencyCheck(): Promise<ConsistencyReport> {
  log.info('[ConsistencyChecker] Running consistency check...');
  const startTime = Date.now();

  const checks: ConsistencyCheck[] = [];

  for (const rule of rules) {
    try {
      const check = await rule.validate();
      checks.push(check);
      log.debug(`[ConsistencyChecker] ${rule.name}: ${check.level}`);
    } catch (err: any) {
      checks.push(createCheck(
        rule.name,
        'error',
        `Unexpected error: ${err.message}`
      ));
    }
  }

  const passed = checks.filter(c => c.level === 'pass').length;
  const warnings = checks.filter(c => c.level === 'warning').length;
  const errors = checks.filter(c => c.level === 'error').length;

  let overallStatus: ConsistencyLevel = 'pass';
  if (errors > 0) overallStatus = 'error';
  else if (warnings > 0) overallStatus = 'warning';

  const duration = Date.now() - startTime;

  log.info(`[ConsistencyChecker] Check complete: ${passed} passed, ${warnings} warnings, ${errors} errors (${duration}ms)`);

  return {
    timestamp: Date.now(),
    totalChecks: checks.length,
    passed,
    warnings,
    errors,
    checks,
    overallStatus,
  };
}

export function getConsistencyRules(): string[] {
  return rules.map(r => r.name);
}
