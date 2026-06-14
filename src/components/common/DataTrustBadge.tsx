// ── R170 A3: Data Trustworthiness Three-Color Badge ───────────────────────
// Unified component to show data authenticity across all factor displays.
//
// REAL (🟢): Data from live market source (Futu OpenD / server API)
// SIMULATED (🟡): Real methodology, simulated values (formats correct, values plausible)
// MOCK (🔴): Placeholder static values for UI preview only
//
// Also reports: source name, freshness (last update), degradation warnings.
//
// Usage: <DataTrustBadge source="REAL" provider="futu_openapi" freshness="2min ago" />
// All factor panels/charts MUST include this badge at top-right.

import React, { useState } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

export type DataSource = 'REAL' | 'SIMULATED' | 'MOCK';

export interface DataTrustBadgeProps {
  /** Data authenticity level */
  source: DataSource;
  /** Human-readable provider name */
  provider?: string;
  /** How fresh is the data */
  freshness?: string;
  /** Number of sources that degraded */
  degradedCount?: number;
  /** Array of source names that returned defaults */
  degradedSources?: string[];
  /** Whether to show a detailed tooltip on hover */
  showDetails?: boolean;
  /** Size variant */
  size?: 'sm' | 'md';
  className?: string;
}

// ── Configuration ────────────────────────────────────────────────────────────

const SOURCE_CONFIG: Record<DataSource, {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: string;
  description: string;
}> = {
  REAL: {
    label: '真实数据',
    color: '#22c55e',
    bgColor: 'rgba(34,197,94,0.12)',
    borderColor: 'rgba(34,197,94,0.3)',
    icon: '🟢',
    description: '数据来自真实市场API，可信任。',
  },
  SIMULATED: {
    label: '模拟数据',
    color: '#f59e0b',
    bgColor: 'rgba(245,158,11,0.12)',
    borderColor: 'rgba(245,158,11,0.3)',
    icon: '🟡',
    description: '使用真实方法论估算，值可信但可能有偏差。',
  },
  MOCK: {
    label: '占位数据',
    color: '#ef4444',
    bgColor: 'rgba(239,68,68,0.12)',
    borderColor: 'rgba(239,68,68,0.3)',
    icon: '🔴',
    description: '占位预览数据，不可用于决策！',
  },
};

// ── Size presets ─────────────────────────────────────────────────────────────

const SIZE_CLASSES: Record<string, { badge: string; text: string }> = {
  sm: { badge: 'text-[9px] px-1.5 py-0.5 gap-1', text: 'text-[9px]' },
  md: { badge: 'text-[10px] px-2 py-1 gap-1.5', text: 'text-[10px]' },
};

// ── Component ────────────────────────────────────────────────────────────────

export const DataTrustBadge: React.FC<DataTrustBadgeProps> = ({
  source,
  provider,
  freshness,
  degradedCount,
  degradedSources,
  showDetails = true,
  size = 'md',
  className,
}) => {
  const [expanded, setExpanded] = useState(false);
  const config = SOURCE_CONFIG[source];
  const sz = SIZE_CLASSES[size] || SIZE_CLASSES.md;

  return (
    <div className={`inline-flex flex-col ${className ?? ''}`}>
      {/* Badge button */}
      <button
        onClick={() => showDetails && setExpanded(!expanded)}
        className={`inline-flex items-center rounded-full font-medium border transition-colors cursor-default ${sz.badge}`}
        style={{
          color: config.color,
          backgroundColor: config.bgColor,
          borderColor: config.borderColor,
        }}
        title={config.description}
      >
        <span className="text-xs leading-none">{config.icon}</span>
        <span>{config.label}</span>
        {provider && (
          <span style={{ color: config.color, opacity: 0.7 }}>· {provider}</span>
        )}
        {freshness && (
          <span className="opacity-60">{freshness}</span>
        )}
        {degradedCount !== undefined && degradedCount > 0 && (
          <span style={{ color: '#f59e0b' }}>⚠️ {degradedCount}</span>
        )}
        {showDetails && (
          <span className="opacity-50 ml-0.5">{expanded ? '▴' : '▾'}</span>
        )}
      </button>

      {/* Expanded details */}
      {expanded && (
        <div
          className="mt-1 rounded-lg p-2 border text-[10px]"
          style={{
            backgroundColor: config.bgColor,
            borderColor: config.borderColor,
            color: config.color,
          }}
        >
          <p className="leading-relaxed opacity-90">{config.description}</p>
          {provider && (
            <p className="mt-1 opacity-70">
              📡 数据源: {provider}
            </p>
          )}
          {freshness && (
            <p className="mt-0.5 opacity-70">
              ⏱ 更新: {freshness}
            </p>
          )}
          {degradedSources && degradedSources.length > 0 && (
            <div className="mt-1">
              <p className="opacity-70">⚠️ 以下来源降级为估算值:</p>
              <ul className="list-disc list-inside mt-0.5 opacity-60">
                {degradedSources.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          {source === 'REAL' && (
            <p className="mt-1 opacity-50">✅ 可放心用于策略决策</p>
          )}
          {source === 'SIMULATED' && (
            <p className="mt-1 opacity-50">⚠️ 建议接入真实数据源后再用于实盘</p>
          )}
          {source === 'MOCK' && (
            <p className="mt-1 opacity-50">❌ 仅供UI预览，请勿用于任何决策</p>
          )}
        </div>
      )}
    </div>
  );
};

// ── Convenience: inline icon-only badge ──────────────────────────────────────

export const DataTrustDot: React.FC<{ source: DataSource; size?: number }> = ({
  source,
  size = 8,
}) => {
  const config = SOURCE_CONFIG[source];
  return (
    <span
      className="inline-block rounded-full"
      style={{
        width: size,
        height: size,
        backgroundColor: config.color,
        boxShadow: `0 0 ${size / 2}px ${config.color}40`,
      }}
      title={config.description}
    />
  );
};

export default DataTrustBadge;
