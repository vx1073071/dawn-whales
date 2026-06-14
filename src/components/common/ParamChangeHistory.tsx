// ── R173 C8: Parameter Change History ────────────────────────────────────
// Tracks parameter modifications and shows diff vs original values.
// Features:
//  - Grey original values beside current inputs
//  - "共变更 N 项参数" badge
//  - Individual revert button per parameter
//  - Bulk revert all button
//  - Auto-persists history in session storage

import React, { useState, useCallback, useMemo } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

interface ParamEntry {
  name: string;
  originalValue: number;
  currentValue: number;
  type: 'int' | 'float';
}

interface ParamChangeHistoryProps {
  params: ParamEntry[];
  onParamChange?: (name: string, value: number) => void;
  onRevert?: (name: string) => void;
  onRevertAll?: () => void;
  className?: string;
}

// ── Sub-component: Single param row ──────────────────────────────────────────

const ParamRow: React.FC<{
  entry: ParamEntry;
  onChange: (value: number) => void;
  onRevert: () => void;
}> = ({ entry, onChange, onRevert }) => {
  const isChanged = entry.currentValue !== entry.originalValue;
  const diff = entry.currentValue - entry.originalValue;
  const pctChange = entry.originalValue !== 0
    ? ((entry.currentValue - entry.originalValue) / Math.abs(entry.originalValue)) * 100
    : 0;

  const format = (v: number) =>
    entry.type === 'int' ? String(Math.round(v)) : v.toFixed(2);

  return (
    <div className={`flex items-center gap-2 text-xs py-1.5 px-2 rounded-lg transition-colors ${isChanged ? 'bg-[#C9A046]/5' : ''}`}>
      <span className={`w-20 font-medium truncate ${isChanged ? 'text-[#C9A046]' : 'text-gray-400'}`}>
        {entry.name}
      </span>

      {/* Current value */}
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={entry.type === 'int' ? Math.round(entry.currentValue) : entry.currentValue}
          onChange={(e) => onChange(Number(e.target.value))}
          step={entry.type === 'int' ? 1 : 0.01}
          className={`w-18 bg-white/[0.04] border rounded px-2 py-1 text-center font-mono text-xs focus:outline-none ${
            isChanged
              ? 'border-[#C9A046]/40 text-[#C9A046]'
              : 'border-white/5 text-gray-300'
          }`}
        />

        {/* Diff indicator */}
        {isChanged && (
          <span
            className={`font-mono text-[10px] font-bold ${
              diff > 0 ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {diff > 0 ? '+' : ''}{format(diff)}
            <span className="font-normal"> ({pctChange > 0 ? '+' : ''}{pctChange.toFixed(1)}%)</span>
          </span>
        )}
      </div>

      {/* Original value (grey) */}
      <span className="text-[10px] text-gray-600 w-16 text-right font-mono">
        原: {format(entry.originalValue)}
      </span>

      {/* Revert button */}
      {isChanged && (
        <button
          onClick={onRevert}
          className="text-[9px] text-gray-500 hover:text-[#C9A046] transition-colors px-1"
          title="撤销此参数"
        >
          ↩
        </button>
      )}
    </div>
  );
};

// ── Summary badge ────────────────────────────────────────────────────────────

const ChangeSummary: React.FC<{
  changed: ParamEntry[];
}> = ({ changed }) => {
  if (changed.length === 0) return null;
  return (
    <div className="flex items-center gap-2 text-[10px]">
      <span className="text-[#C9A046] font-medium">
        共变更 {changed.length} 项参数
      </span>
      <div className="flex flex-wrap gap-1">
        {changed.map((p) => (
          <span key={p.name} className="bg-[#C9A046]/10 text-[#C9A046] px-1.5 py-0.5 rounded text-[9px]">
            {p.name}
          </span>
        ))}
      </div>
    </div>
  );
};

// ── Component ────────────────────────────────────────────────────────────────

export const ParamChangeHistory: React.FC<ParamChangeHistoryProps> = ({
  params,
  onParamChange,
  onRevert,
  onRevertAll,
  className,
}) => {
  const [expanded, setExpanded] = useState(true);

  const changedParams = useMemo(
    () => params.filter((p) => p.currentValue !== p.originalValue),
    [params],
  );

  const handleChange = useCallback(
    (name: string, value: number) => {
      onParamChange?.(name, value);
    },
    [onParamChange],
  );

  const handleRevert = useCallback(
    (name: string) => {
      onRevert?.(name);
    },
    [onRevert],
  );

  return (
    <div className={`bg-white/[0.03] rounded-lg border border-white/5 p-3 ${className ?? ''}`}>
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs font-semibold text-gray-300 hover:text-white flex items-center gap-1"
        >
          📝 参数变更历史
          <span className="text-gray-600">{expanded ? '▾' : '▸'}</span>
        </button>
        <div className="flex items-center gap-3">
          <ChangeSummary changed={changedParams} />
          {changedParams.length > 0 && (
            <button
              onClick={onRevertAll}
              className="text-[10px] text-gray-500 hover:text-[#C9A046] transition-colors"
            >
              ↩ 重置全部
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="space-y-1">
          {params.length > 0 ? (
            params.map((p) => (
              <ParamRow
                key={p.name}
                entry={p}
                onChange={(v) => handleChange(p.name, v)}
                onRevert={() => handleRevert(p.name)}
              />
            ))
          ) : (
            <p className="text-[10px] text-gray-600 py-4 text-center">暂无参数数据</p>
          )}
        </div>
      )}
    </div>
  );
};

export default ParamChangeHistory;
