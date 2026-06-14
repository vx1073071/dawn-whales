/**
* DataClassificationBadge — ML R179 G30 [P0] 六部委合规对齐
* C3级金融数据分类标签 + 审计追踪护栏
* Per: 金融信息服务数据分类分级指南 (2026-06-08)
* Six ministries: CAC, PBOC, NFRA, CSRC, NBS, SAFE
*/

import { useMemo } from 'react';

// ── Types ───────────────────────────────────────────────────────────────

/**
 * C1-C3 classification per Chinese six-ministry guidelines.
 * C1 = 一般数据 (General)
 * C2 = 重要数据 (Important)
 * C3 = 核心数据 (Core / highest protection)
 */
type DataClass = 'C1' | 'C2' | 'C3';

interface ClassificationConfig {
  level: DataClass;
  label: string;
  color: string;
  bg: string;
  border: string;
  icon: string;
  description: string;
}

const CLASSIFICATIONS: Record<DataClass, ClassificationConfig> = {
  C3: {
    level: 'C3',
    label: '核心数据',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    icon: '🔴',
    description: '用户资金/交易执行/身份认证 — 最高保护级别',
  },
  C2: {
    level: 'C2',
    label: '重要数据',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/20',
    icon: '🟡',
    description: '持仓/策略/因子权重 — 需脱敏后展示',
  },
  C1: {
    level: 'C1',
    label: '一般数据',
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    border: 'border-green-500/20',
    icon: '🟢',
    description: '公开行情/因子IC — 自由展示',
  },
};

// ── Field mapping — which data fields map to which class ───────────────

const FIELD_CLASSIFICATION: Record<string, DataClass> = {
  walletBalance: 'C3',
  walletBalanceUSDT: 'C3',
  transactionHistory: 'C3',
  placeOrder: 'C3',
  executeTrade: 'C3',
  userId: 'C3',
  email: 'C3',
  apiKey: 'C3',
  privateKey: 'C3',
  positions: 'C2',
  strategyWeights: 'C2',
  factorComposition: 'C2',
  portfolioValue: 'C2',
  backtestResults: 'C2',
  userPreferences: 'C2',
  marketPrice: 'C1',
  factorIC: 'C1',
  factorIR: 'C1',
  tradingVolume: 'C1',
  historicalKline: 'C1',
};

/**
 * Classify a data field name.
 */
export function classifyField(fieldName: string): DataClass {
  for (const [key, cls] of Object.entries(FIELD_CLASSIFICATION)) {
    if (fieldName.toLowerCase().includes(key.toLowerCase())) return cls;
  }
  return 'C2'; // default to C2 when uncertain
}

// ── Component ───────────────────────────────────────────────────────────

interface DataClassificationBadgeProps {
  /** Field name or data type being displayed */
  field: string;
  /** Show description tooltip */
  showTooltip?: boolean;
  /** Compact mode */
  compact?: boolean;
  className?: string;
}

export default function DataClassificationBadge({
  field,
  showTooltip = true,
  compact = false,
  className = '',
}: DataClassificationBadgeProps) {
  const cls = useMemo(() => {
    const level = classifyField(field);
    return CLASSIFICATIONS[level];
  }, [field]);

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] ${cls.bg} ${cls.border} ${cls.color} ${className}`}
        title={showTooltip ? cls.description : undefined}
      >
        {cls.icon}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${cls.bg} ${cls.border} ${cls.color} ${className}`}
      title={showTooltip ? cls.description : undefined}
    >
      {cls.icon} {cls.label}
    </span>
  );
}

// ── Audit trail helper ──────────────────────────────────────────────────

export interface AuditEntry {
  timestamp: string;
  action: 'view' | 'export' | 'share' | 'modify' | 'delete';
  field: string;
  classification: DataClass;
  userId: string;
  ip?: string;
  success: boolean;
}

/**
 * Generate audit entry for C2/C3 data access.
 * In production, this would write to an append-only log.
 */
export function createAuditEntry(
  action: AuditEntry['action'],
  field: string,
  userId: string,
  success = true
): AuditEntry {
  return {
    timestamp: new Date().toISOString(),
    action,
    field,
    classification: classifyField(field),
    userId,
    success,
  };
}

/**
 * Format audit entries for display.
 */
export function formatAuditLog(entries: AuditEntry[]): string {
  return entries
    .map(
      (e) =>
        `[${e.timestamp}] ${e.userId} ${e.action} ${e.field} (${e.classification}) ${e.success ? 'OK' : 'DENIED'}`
    )
    .join('\n');
}

// ── Compliance summary (for settings/about page) ────────────────────────

export function ComplianceSummary() {
  return (
    <div className="bg-[#1a1a25] border border-white/5 rounded-lg p-4 space-y-3">
      <h4 className="text-sm font-semibold text-white">📋 数据合规声明</h4>

      <div className="grid grid-cols-3 gap-2">
        {(['C3', 'C2', 'C1'] as DataClass[]).map((level) => {
          const c = CLASSIFICATIONS[level];
          return (
            <div key={level} className={`rounded-lg p-3 border ${c.bg} ${c.border}`}>
              <div className={`text-sm font-bold ${c.color}`}>
                {c.icon} {c.level}
              </div>
              <div className={`text-xs mt-1 ${c.color}/70`}>{c.label}</div>
              <div className="text-[9px] text-gray-500 mt-1 leading-relaxed">
                {c.description}
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-[10px] text-gray-500 leading-relaxed pt-2 border-t border-white/5">
        依据《金融信息服务数据分类分级指南》(2026-06-08) 六部委联合发布。
        TradingEasy 对所有C3级数据实施:
        ①传输加密 ②访问控制 ③审计追踪 ④脱敏展示 ⑤最小权限原则。
      </div>
    </div>
  );
}
