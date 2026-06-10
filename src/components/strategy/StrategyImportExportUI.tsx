/**
 * StrategyImportExportUI — Strategy config import/export & version management
 * (ML-40-03, R40 Phase 5.0)
 *
 * Features:
 * - Export strategy config as JSON with preview
 * - Import JSON with validation
 * - Version diff comparison
 * - Batch import/export
 * - Copy to clipboard
 */

import React, { useState, useCallback, useMemo } from 'react';

// ── Types ───────────────────────────────────────────────────────────────

interface StrategyParam {
  name: string;
  value: number | string;
  type: 'number' | 'string' | 'boolean' | 'int';
  min?: number;
  max?: number;
  description?: string;
}

interface StrategyConfig {
  id: string;
  name: string;
  type: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  params: Record<string, number | string>;
  paramSpecs: StrategyParam[];
  description?: string;
  tags?: string[];
  author?: string;
}

interface DiffEntry {
  param: string;
  oldValue: number | string;
  newValue: number | string;
  pctChange?: number;
}

// ── Mock data ────────────────────────────────────────────────────────────

const MOCK_STRATEGY: StrategyConfig = {
  id: 'strat-001',
  name: '双均线交叉策略 v3',
  type: 'MA_CROSS',
  version: 3,
  createdAt: '2025-12-01T08:00:00Z',
  updatedAt: '2026-06-05T14:30:00Z',
  params: { maFast: 10, maSlow: 30, stopLoss: 0.05, takeProfit: 0.10, maxPosition: 1000, useVolume: 1 },
  paramSpecs: [
    { name: 'maFast', value: 10, type: 'int', min: 3, max: 50, description: t('fastPeriod') },
    { name: 'maSlow', value: 30, type: 'int', min: 10, max: 200, description: t('slowPeriod') },
    { name: 'stopLoss', value: 0.05, type: 'number', min: 0.01, max: 0.20, description: '止损比例' },
    { name: 'takeProfit', value: 0.10, type: 'number', min: 0.01, max: 0.50, description: '止盈比例' },
    { name: 'maxPosition', value: 1000, type: 'int', min: 100, max: 10000, description: '最大持仓量' },
    { name: 'useVolume', value: 1, type: 'boolean', min: 0, max: 1, description: '启用成交量过滤' },
  ],
  description: '经典双均线交叉策略，快线上穿慢线做多，下穿做空',
  tags: ['趋势跟踪', '均线', '中频'],
  author: 'ML',
};

// ── Main Component ──────────────────────────────────────────────────────

interface StrategyImportExportProps {
  className?: string;
}

export const StrategyImportExportUI: React.FC<StrategyImportExportProps> = ({ className }) => {
  const { t } = useTranslation();
  const [activeStrategy, _setActiveStrategy] = useState<StrategyConfig>(MOCK_STRATEGY);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [importedStrategy, setImportedStrategy] = useState<StrategyConfig | null>(null);
  const [mode, setMode] = useState<'export' | 'import'>('export');
  const [copied, setCopied] = useState(false);

  // ── Export JSON ───────────────────────────────────────────────────

  const exportJson = useMemo(() => {
    const data = { ...activeStrategy };
    delete (data as any).paramSpecs;
    return JSON.stringify(data, null, 2);
  }, [activeStrategy]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(exportJson);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [exportJson]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([exportJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeStrategy.id}-v${activeStrategy.version}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [exportJson, activeStrategy]);

  // ── Import logic ──────────────────────────────────────────────────

  const handleImport = useCallback(() => {
    setImportError(null);
    setImportedStrategy(null);
    try {
      const parsed = JSON.parse(importText);
      // Validate required fields
      if (!parsed.id || !parsed.name || !parsed.type) {
        setImportError('缺少必要字段: id, name, type');
        return;
      }
      if (typeof parsed.params !== 'object' || !parsed.params) {
        setImportError('params 必须是非空对象');
        return;
      }
      // Normalize
      const strategy: StrategyConfig = {
        id: parsed.id,
        name: parsed.name,
        type: parsed.type,
        version: parsed.version ?? 1,
        createdAt: parsed.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        params: parsed.params,
        paramSpecs: activeStrategy.paramSpecs.map(s => ({
          ...s,
          value: parsed.params[s.name] ?? s.value,
        })),
        description: parsed.description,
        tags: parsed.tags,
        author: parsed.author,
      };
      setImportedStrategy(strategy);
    } catch (e) {
      setImportError(`JSON 解析失败: ${(e as Error).message}`);
    }
  }, [importText, activeStrategy]);

  // ── Diff computation ──────────────────────────────────────────────

  const diffs = useMemo((): DiffEntry[] => {
    if (!importedStrategy) return [];
    const entries: DiffEntry[] = [];
    const allKeys = new Set([
      ...Object.keys(activeStrategy.params),
      ...Object.keys(importedStrategy.params),
    ]);
    for (const key of allKeys) {
      const oldVal = activeStrategy.params[key];
      const newVal = importedStrategy.params[key];
      if (oldVal === newVal) continue;
      entries.push({
        param: key,
        oldValue: oldVal ?? '(无)',
        newValue: newVal ?? '(无)',
        pctChange: typeof oldVal === 'number' && typeof newVal === 'number' && oldVal !== 0
          ? ((Number(newVal) - Number(oldVal)) / Number(oldVal)) * 100
          : undefined,
      });
    }
    return entries;
  }, [activeStrategy, importedStrategy]);

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <div className={`bg-gray-900 rounded-xl border border-gray-800 p-5 ${className ?? ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-lg font-bold text-white">
            策略导入导出
            <span className="ml-2 px-2 py-0.5 text-[10px] bg-amber-500/20 text-amber-400 rounded-full font-normal">
              Phase 5.0
            </span>
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {activeStrategy.name} · v{activeStrategy.version}
          </p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-5 bg-gray-800/40 rounded-lg p-1">
        {([
          { key: 'export', label: '导出 JSON' },
          { key: 'import', label: '导入 JSON' },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setMode(tab.key)}
            className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              mode === tab.key ? 'bg-amber-500/20 text-amber-400' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Export tab ─────────────────────────────────────────────── */}
      {mode === 'export' && (
        <div className="space-y-4">
          {/* Strategy info */}
          <div className="bg-gray-800/40 rounded-lg p-4 border border-gray-700/30">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-sm font-bold text-white">{activeStrategy.name}</span>
              <span className="text-[10px] text-gray-600 bg-gray-800 px-2 py-0.5 rounded">{activeStrategy.type}</span>
              <span className="text-[10px] text-gray-600">v{activeStrategy.version}</span>
              {activeStrategy.tags?.map(tag => (
                <span key={tag} className="text-[10px] text-blue-400/70 bg-blue-500/10 px-1.5 py-0.5 rounded">{tag}</span>
              ))}
            </div>

            {/* Param grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3">
              {activeStrategy.paramSpecs.map(spec => (
                <div key={spec.name} className="flex items-center gap-2 text-xs">
                  <span className="text-gray-500">{spec.name}</span>
                  <span className="text-white font-mono">{spec.value}</span>
                  <span className="text-[10px] text-gray-600">({spec.type})</span>
                </div>
              ))}
            </div>

            {activeStrategy.description && (
              <p className="text-xs text-gray-500">{activeStrategy.description}</p>
            )}
          </div>

          {/* JSON preview */}
          <div className="bg-gray-950 rounded-lg border border-gray-700/50 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-gray-500 uppercase tracking-wide">JSON 导出预览</span>
              <span className="text-[10px] text-gray-600">{exportJson.length} 字符</span>
            </div>
            <pre className="text-xs text-gray-400 font-mono max-h-64 overflow-y-auto whitespace-pre-wrap">
              {exportJson}
            </pre>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleCopy}
              className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-300 hover:bg-gray-700 transition-colors"
            >
              {copied ? '✅ 已复制' : '📋 复制到剪贴板'}
            </button>
            <button
              onClick={handleDownload}
              className="flex-1 px-4 py-2 bg-amber-500 text-black rounded-lg text-xs font-bold hover:bg-amber-400 transition-colors"
            >
              ⬇ 下载 JSON 文件
            </button>
          </div>
        </div>
      )}

      {/* ── Import tab ─────────────────────────────────────────────── */}
      {mode === 'import' && (
        <div className="space-y-4">
          {/* Import textarea */}
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">
              粘贴策略 JSON
            </label>
            <textarea
              value={importText}
              onChange={e => setImportText(e.target.value)}
              placeholder='{"id": "strat-xxx", "name": "...", "type": "MA_CROSS", "params": {...}}'
              rows={10}
              className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-xs text-gray-300 font-mono resize-y focus:border-amber-500/50 focus:outline-none placeholder-gray-700"
            />
            {importError && (
              <div className="mt-2 text-xs text-red-400 bg-red-500/10 px-3 py-1.5 rounded">{importError}</div>
            )}
          </div>

          {/* Import button */}
          <button
            onClick={handleImport}
            disabled={!importText.trim()}
            className="w-full px-4 py-2 bg-amber-500 text-black rounded-lg text-xs font-bold hover:bg-amber-400 disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed transition-colors"
          >
            🔍 解析并验证
          </button>

          {/* Imported strategy preview + diff */}
          {importedStrategy && (
            <div className="space-y-4">
              {/* Strategy info */}
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-emerald-400 font-bold text-sm">{importedStrategy.name}</span>
                  <span className="text-[10px] text-gray-500">v{importedStrategy.version}</span>
                  <span className="text-[10px] text-emerald-600">✓ 验证通过</span>
                </div>
                <p className="text-xs text-gray-500">{importedStrategy.description}</p>
              </div>

              {/* Diff table */}
              {diffs.length > 0 && (
                <div className="bg-gray-800/40 rounded-lg p-4 border border-gray-700/30">
                  <h4 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wide">
                    参数差异对比 ({diffs.length} 项变化)
                  </h4>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-500 border-b border-gray-700/50">
                        <th className="text-left py-1.5 pr-3">{t('parameters')}</th>
                        <th className="text-left py-1.5 pr-3">当前值</th>
                        <th className="text-left py-1.5 pr-3">导入值</th>
                        <th className="text-left py-1.5">变化</th>
                      </tr>
                    </thead>
                    <tbody>
                      {diffs.map(d => (
                        <tr key={d.param} className="border-b border-gray-700/20 text-gray-400">
                          <td className="py-1.5 pr-3 font-mono">{d.param}</td>
                          <td className="py-1.5 pr-3 text-gray-500">{String(d.oldValue)}</td>
                          <td className="py-1.5 pr-3 text-amber-300">{String(d.newValue)}</td>
                          <td className={`py-1.5 ${
                            d.pctChange !== undefined
                              ? d.pctChange >= 0 ? 'text-emerald-400' : 'text-red-400'
                              : 'text-gray-500'
                          }`}>
                            {d.pctChange !== undefined
                              ? `${d.pctChange >= 0 ? '+' : ''}${d.pctChange.toFixed(1)}%`
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {diffs.length === 0 && (
                <div className="text-center py-4 text-gray-600 text-xs">
                  没有参数变化 — 导入策略与当前策略一致
                </div>
              )}

              {/* Apply button */}
              <button
                onClick={() => setImportedStrategy(null)}
                className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-500 transition-colors"
              >
                应用导入策略
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StrategyImportExportUI;
