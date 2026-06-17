// @ts-nocheck
// R283 ML#1: FactorFreshnessBadge — 数据新鲜度标签 (2h)
// Shows data staleness: 🟢实时(≤2h) 🟡延迟(≤24h) 🔴过期(>24h) ⚫未知
// Also shows "next update" countdown for scheduled releases (CPI, PMI, etc.)
// 数据新鲜度: 一眼看出数据是否还能用
import React, { useMemo } from 'react';

export type FreshnessLevel = 'realtime' | 'fresh' | 'stale' | 'expired' | 'unknown';

export interface FreshnessInfo {
  level: FreshnessLevel;
  hoursAgo: number;
  label: string;
  color: string;
  emoji: string;
  nextUpdate?: string; // "6月24日 09:30" for scheduled data
}

const HOUR = 3600000;

/** Compute freshness from a timestamp */
export function computeFreshness(lastUpdatedMs: number, nextUpdateDate?: string): FreshnessInfo {
  const now = Date.now();
  const hoursAgo = (now - lastUpdatedMs) / HOUR;

  if (hoursAgo < 0) {
    return { level: 'unknown', hoursAgo: 0, label: '时间异常', color: '#6b7280', emoji: '⚫', nextUpdate: nextUpdateDate };
  }
  if (hoursAgo <= 2) {
    return { level: 'realtime', hoursAgo, label: `${Math.round(hoursAgo * 60)}分钟前`, color: '#22c55e', emoji: '🟢', nextUpdate: nextUpdateDate };
  }
  if (hoursAgo <= 24) {
    return { level: 'fresh', hoursAgo, label: `${Math.round(hoursAgo)}小时前`, color: '#f59e0b', emoji: '🟡', nextUpdate: nextUpdateDate };
  }
  if (hoursAgo <= 72) {
    return { level: 'stale', hoursAgo, label: `${Math.round(hoursAgo / 24)}天前`, color: '#ef4444', emoji: '🔴', nextUpdate: nextUpdateDate };
  }
  return { level: 'expired', hoursAgo, label: `${Math.round(hoursAgo / 24)}天前`, color: '#6b7280', emoji: '⚫', nextUpdate: nextUpdateDate };
}

interface Props {
  lastUpdatedMs: number;
  nextUpdateDate?: string; // e.g., "2026-06-24 09:30" for macro data
  dark?: boolean;
  compact?: boolean;
}

export default function FactorFreshnessBadge({ lastUpdatedMs, nextUpdateDate, dark = true, compact = false }: Props) {
  const info = useMemo(() => computeFreshness(lastUpdatedMs, nextUpdateDate), [lastUpdatedMs, nextUpdateDate]);
  const c = dark ? { t2: '#64748b', t: '#e2e8f0' } : { t2: '#64748b', t: '#0f172a' };

  if (compact) {
    return <span style={{ fontSize: 10, color: info.color, fontWeight: 500 }}>
      {info.emoji} {info.label}
    </span>;
  }

  return <div style={{
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 500,
    background: info.color + '12', color: info.color, border: `1px solid ${info.color}25`,
  }}>
    {info.emoji} {info.label}
    {info.nextUpdate && <span style={{ marginLeft: 4, color: c.t2, fontSize: 10 }}>
      · 下次: {info.nextUpdate}
    </span>}
  </div>;
}

export { computeFreshness as getFreshness };
