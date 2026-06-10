import React, { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

// ─── Types ────────────────────────────────────────────────────────────────────

type ExportTarget =
  | 'trades'
  | 'backtest_runs'
  | 'strategies'
  | 'kline_cache'
  | 'alerts'
  | 'portfolio';

type ExportFormat = 'csv' | 'json' | 'md';

interface ExportFilters {
  strategyId: string;
  symbol: string;
  startDate: string;
  endDate: string;
  status: string;
}

interface ExportResultItem {
  id: string;
  target: string;
  format: string;
  success: boolean;
  filePath?: string;
  rowCount?: number;
  fileSizeBytes?: number;
  error?: string;
  timestamp: number;
}

interface BatchExportPayload {
  targets: ExportTarget[];
  format: ExportFormat;
  filters: ExportFilters;
}

interface ExportApiResponse {
  success: boolean;
  data?: {
    filePath?: string;
    rowCount?: number;
    fileSizeBytes?: number;
    report?: string;
  };
  error?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const EXPORT_TARGETS: { key: ExportTarget; label: string; icon: string }[] = [
  { key: 'trades', label: '交易记录', icon: '📈' },
  { key: 'backtest_runs', label: '回测运行', icon: '🔄' },
  { key: 'strategies', label: '策略列表', icon: '🧠' },
  { key: 'kline_cache', label: 'K线缓存', icon: '📊' },
  { key: 'alerts', label: '预警记录', icon: '🔔' },
  { key: 'portfolio', label: '组合持仓', icon: '💼' },
];

const FORMAT_OPTIONS: { value: ExportFormat; label: string; desc: string }[] = [
  { value: 'csv', label: 'CSV', desc: '通用表格格式，Excel 可直接打开' },
  { value: 'json', label: 'JSON', desc: '结构化数据，适合程序解析' },
  { value: 'md', label: 'Markdown', desc: '可读性强的文档格式' },
];

const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
  { value: 'pending', label: 'Pending' },
  { value: 'cancelled', label: 'Cancelled' },
];

const DEFAULT_FILTERS: ExportFilters = {
  strategyId: '',
  symbol: '',
  startDate: '',
  endDate: '',
  status: '',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function extractFilename(filePath: string): string {
  return filePath.replace(/\\/g, '/').split('/').pop() || filePath;
}

let resultIdCounter = 0;
function nextResultId(): string {
  resultIdCounter += 1;
  return `export-${Date.now()}-${resultIdCounter}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

const DataExportPage: React.FC = () => {
  // State: target selection
  const [selectedTargets, setSelectedTargets] = useState<Set<ExportTarget>>(
    new Set(['trades']),
  );

  // State: format
  const [format, setFormat] = useState<ExportFormat>('csv');

  // State: filters
  const [filters, setFilters] = useState<ExportFilters>({ ...DEFAULT_FILTERS });

  // State: per-target loading
  const [loadingTargets, setLoadingTargets] = useState<Set<string>>(new Set());

  // State: batch loading
  const [batchLoading, setBatchLoading] = useState(false);

  // State: summary loading
  const [summaryLoading, setSummaryLoading] = useState(false);

  // State: results
  const [results, setResults] = useState<ExportResultItem[]>([]);

  // State: summary report text
  const [summaryReport, setSummaryReport] = useState<string | null>(null);

  // ─── Target toggle ────────────────────────────────────────────────────────

  const toggleTarget = useCallback((target: ExportTarget) => {
    setSelectedTargets((prev) => {
      const next = new Set(prev);
      if (next.has(target)) {
        next.delete(target);
      } else {
        next.add(target);
      }
      return next;
    });
  }, []);

  const selectAllTargets = useCallback(() => {
    setSelectedTargets(new Set(EXPORT_TARGETS.map((t) => t.key)));
  }, []);

  const clearAllTargets = useCallback(() => {
    setSelectedTargets(new Set());
  }, []);

  // ─── Filter update ────────────────────────────────────────────────────────

  const updateFilter = useCallback(
    <K extends keyof ExportFilters>(key: K, value: ExportFilters[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const resetFilters = useCallback(() => {
    setFilters({ ...DEFAULT_FILTERS });
  }, []);

  const hasActiveFilters = useMemo(
    () => Object.values(filters).some((v) => v !== ''),
    [filters],
  );

  // ─── API helpers ──────────────────────────────────────────────────────────

  const callExportApi = useCallback(
    async (
      target: ExportTarget,
      fmt: ExportFormat,
    ): Promise<ExportApiResponse> => {
      try {
        const api = window.api?.export;
        if (!api) {
          return { success: false, error: 'Bridge API 不可用' };
        }
        const methodMap: Record<ExportFormat, string> = {
          csv: 'csv',
          json: 'json',
          md: 'md',
        };
        const fn = api[methodMap[fmt]];
        if (typeof fn !== 'function') {
          return { success: false, error: `不支持的导出格式: ${fmt}` };
        }
        return await fn(target, filters);
      } catch (err: unknown) {
        return { success: false, error: err?.message || '未知错误' };
      }
    },
    [filters],
  );

  const callBatchApi = useCallback(
    async (payload: BatchExportPayload): Promise<ExportApiResponse> => {
      try {
        const api = window.api?.export;
        if (!api || typeof api.batch !== 'function') {
          return { success: false, error: 'Batch API 不可用' };
        }
        return await api.batch(payload);
      } catch (err: unknown) {
        return { success: false, error: err?.message || '批量导出失败' };
      }
    },
    [],
  );

  const callSummaryApi = useCallback(async (): Promise<ExportApiResponse> => {
    try {
      const api = window.api?.export;
      if (!api || typeof api.summaryReport !== 'function') {
        return { success: false, error: 'Summary API 不可用' };
      }
      return await api.summaryReport();
    } catch (err: unknown) {
      return { success: false, error: err?.message || '生成报告失败' };
    }
  }, []);

  // ─── Single export ────────────────────────────────────────────────────────

  const handleSingleExport = useCallback(
    async (target: ExportTarget) => {
      const loadingKey = `${target}-${format}`;
      setLoadingTargets((prev) => new Set(prev).add(loadingKey));

      const res = await callExportApi(target, format);

      const item: ExportResultItem = {
        id: nextResultId(),
        target,
        format,
        success: res.success,
        filePath: res.data?.filePath,
        rowCount: res.data?.rowCount,
        fileSizeBytes: res.data?.fileSizeBytes,
        error: res.error,
        timestamp: Date.now(),
      };

      setResults((prev) => [item, ...prev]);
      setLoadingTargets((prev) => {
        const next = new Set(prev);
        next.delete(loadingKey);
        return next;
      });
    },
    [format, callExportApi],
  );

  // ─── Batch export ─────────────────────────────────────────────────────────

  const handleBatchExport = useCallback(async () => {
    if (selectedTargets.size === 0) return;
    setBatchLoading(true);

    const targets = Array.from(selectedTargets);
    const res = await callBatchApi({ targets, format, filters });

    if (res.success) {
      // Batch API returns a single result; represent it
      const item: ExportResultItem = {
        id: nextResultId(),
        target: `batch (${targets.length} targets)`,
        format,
        success: true,
        filePath: res.data?.filePath,
        rowCount: res.data?.rowCount,
        fileSizeBytes: res.data?.fileSizeBytes,
        timestamp: Date.now(),
      };
      setResults((prev) => [item, ...prev]);
    } else {
      // Fallback: try individual exports
      for (const t of targets) {
        await handleSingleExport(t);
      }
    }

    setBatchLoading(false);
  }, [selectedTargets, format, filters, callBatchApi, handleSingleExport]);

  // ─── Summary report ───────────────────────────────────────────────────────

  const handleSummaryReport = useCallback(async () => {
    setSummaryLoading(true);
    const res = await callSummaryApi();
    if (res.success && res.data?.report) {
      setSummaryReport(res.data.report);
    }
    setSummaryLoading(false);
  }, [callSummaryApi]);

  // ─── Open folder ──────────────────────────────────────────────────────────

  const handleOpenFolder = useCallback((filePath: string) => {
    const api = window.api?.shell;
    if (api && typeof api.showItemInFolder === 'function') {
      api.showItemInFolder(filePath);
    } else if (api && typeof api.openPath === 'function') {
      const dir = filePath.replace(/\\/g, '/').split('/').slice(0, -1).join('/');
      api.openPath(dir);
    }
  }, []);

  // ─── Clear results ────────────────────────────────────────────────────────

  const clearResults = useCallback(() => {
    setResults([]);
    setSummaryReport(null);
  }, []);

  // ─── Derived ──────────────────────────────────────────────────────────────

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* Header */}
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">{t("components.dataExport")}</h1>
            <p className="text-sm text-gray-400 mt-1">
              选择目标数据、导出格式与筛选条件，一键导出或生成汇总报告
            </p>
          </div>
          <div className="flex items-center gap-3">
            {results.length > 0 && (
              <button
                onClick={clearResults}
                className="px-3 py-1.5 text-xs text-gray-400 hover:text-white border border-gray-700 rounded-md hover:border-gray-500 transition-colors"
              >
                清除记录
              </button>
            )}
            <div className="text-xs text-gray-500">
              {successCount > 0 && (
                <span className="text-emerald-400 mr-3">✓ {successCount}</span>
              )}
              {failCount > 0 && (
                <span className="text-red-400">✗ {failCount}</span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Left Column: Config ─────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-6">
            {/* Target Selector */}
            <section className="bg-gray-800 rounded-xl border border-gray-700 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold">导出目标</h2>
                <div className="flex gap-2">
                  <button
                    onClick={selectAllTargets}
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    全选
                  </button>
                  <span className="text-gray-600">|</span>
                  <button
                    onClick={clearAllTargets}
                    className="text-xs text-gray-400 hover:text-gray-300 transition-colors"
                  >
                    清除
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {EXPORT_TARGETS.map((t) => {
                  const checked = selectedTargets.has(t.key);
                  return (
                    <label
                      key={t.key}
                      className={`
                        flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all
                        ${
                          checked
                            ? 'border-blue-500 bg-blue-500/10'
                            : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                        }
                      `}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleTarget(t.key)}
                        className="w-4 h-4 rounded border-gray-600 text-blue-500 focus:ring-blue-500 focus:ring-offset-0 bg-gray-700"
                      />
                      <span className="text-lg">{t.icon}</span>
                      <span className="text-sm font-medium">{t.label}</span>
                    </label>
                  );
                })}
              </div>
            </section>

            {/* Format Selector */}
            <section className="bg-gray-800 rounded-xl border border-gray-700 p-5">
              <h2 className="text-base font-semibold mb-4">{t("components.exportFormat")}</h2>
              <div className="flex gap-4">
                {FORMAT_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={`
                      flex-1 flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-all
                      ${
                        format === opt.value
                          ? 'border-emerald-500 bg-emerald-500/10'
                          : 'border-gray-700 hover:border-gray-600'
                      }
                    `}
                  >
                    <input
                      type="radio"
                      name="exportFormat"
                      value={opt.value}
                      checked={format === opt.value}
                      onChange={() => setFormat(opt.value)}
                      className="mt-0.5 w-4 h-4 border-gray-600 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0 bg-gray-700"
                    />
                    <div>
                      <div className="text-sm font-semibold">{opt.label}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {opt.desc}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </section>

            {/* Filter Panel */}
            <section className="bg-gray-800 rounded-xl border border-gray-700 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold">筛选条件</h2>
                {hasActiveFilters && (
                  <button
                    onClick={resetFilters}
                    className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
                  >
                    重置筛选
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Strategy ID */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">
                    策略 ID
                  </label>
                  <input
                    type="text"
                    value={filters.strategyId}
                    onChange={(e) => updateFilter('strategyId', e.target.value)}
                    placeholder="例如: strategy_001"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                  />
                </div>

                {/* Symbol */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">
                    交易对 / Symbol
                  </label>
                  <input
                    type="text"
                    value={filters.symbol}
                    onChange={(e) => updateFilter('symbol', e.target.value)}
                    placeholder="例如: BTCUSDT"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                  />
                </div>

                {/* Status */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">
                    状态
                  </label>
                  <select
                    value={filters.status}
                    onChange={(e) => updateFilter('status', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Start Date */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">
                    开始日期
                  </label>
                  <input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => updateFilter('startDate', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors [color-scheme:dark]"
                  />
                </div>

                {/* End Date */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">
                    结束日期
                  </label>
                  <input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => updateFilter('endDate', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors [color-scheme:dark]"
                  />
                </div>
              </div>
            </section>

            {/* Action Buttons */}
            <section className="flex flex-wrap gap-3">
              <button
                onClick={handleBatchExport}
                disabled={selectedTargets.size === 0 || batchLoading}
                className={`
                  flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm transition-all
                  ${
                    selectedTargets.size === 0 || batchLoading
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20'
                  }
                `}
              >
                {batchLoading ? (
                  <svg
                    className="animate-spin h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                ) : (
                  <span>📦</span>
                )}
                批量导出 ({selectedTargets.size})
              </button>

              <button
                onClick={handleSummaryReport}
                disabled={summaryLoading}
                className={`
                  flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm transition-all
                  ${
                    summaryLoading
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20'
                  }
                `}
              >
                {summaryLoading ? (
                  <svg
                    className="animate-spin h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                ) : (
                  <span>📋</span>
                )}
                生成汇总报告
              </button>
            </section>

            {/* Per-target export cards */}
            <section className="bg-gray-800 rounded-xl border border-gray-700 p-5">
              <h2 className="text-base font-semibold mb-4">单项导出</h2>
              <div className="space-y-2">
                {EXPORT_TARGETS.map((t) => {
                  const loadingKey = `${t.key}-${format}`;
                  const isLoading = loadingTargets.has(loadingKey);
                  const isSelected = selectedTargets.has(t.key);
                  return (
                    <div
                      key={t.key}
                      className={`
                        flex items-center justify-between p-3 rounded-lg border transition-colors
                        ${isSelected ? 'border-gray-600' : 'border-gray-700/50 opacity-50'}
                      `}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-base">{t.icon}</span>
                        <span className="text-sm font-medium">{t.label}</span>
                        <span className="text-xs text-gray-500 uppercase">
                          {format}
                        </span>
                      </div>
                      <button
                        onClick={() => handleSingleExport(t.key)}
                        disabled={isLoading}
                        className={`
                          flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all
                          ${
                            isLoading
                              ? 'bg-gray-700 text-gray-500 cursor-wait'
                              : 'bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white'
                          }
                        `}
                      >
                        {isLoading ? (
                          <>
                            <svg
                              className="animate-spin h-3 w-3"
                              viewBox="0 0 24 24"
                              fill="none"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              />
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                              />
                            </svg>
                            导出中...
                          </>
                        ) : (
                          <>
                            <span>↓</span> 导出
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          {/* ── Right Column: Results ───────────────────────────────── */}
          <div className="space-y-6">
            {/* Results List */}
            <section className="bg-gray-800 rounded-xl border border-gray-700 p-5">
              <h2 className="text-base font-semibold mb-4">导出记录</h2>
              {results.length === 0 ? (
                <div className="text-center py-10 text-gray-500">
                  <div className="text-3xl mb-2">📭</div>
                  <p className="text-sm">暂无导出记录</p>
                  <p className="text-xs text-gray-600 mt-1">
                    选择目标并点击导出后，结果将显示在此处
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {results.map((r) => (
                    <div
                      key={r.id}
                      className={`
                        p-3 rounded-lg border text-sm
                        ${
                          r.success
                            ? 'border-emerald-700/50 bg-emerald-900/20'
                            : 'border-red-700/50 bg-red-900/20'
                        }
                      `}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={`text-xs font-bold ${
                                r.success ? 'text-emerald-400' : 'text-red-400'
                              }`}
                            >
                              {r.success ? '✓ 成功' : '✗ 失败'}
                            </span>
                            <span className="text-xs text-gray-500">
                              {r.target} · {r.format.toUpperCase()}
                            </span>
                          </div>
                          {r.success && r.filePath && (
                            <p
                              className="text-xs text-gray-400 truncate"
                              title={r.filePath}
                            >
                              {extractFilename(r.filePath)}
                            </p>
                          )}
                          {r.error && (
                            <p className="text-xs text-red-400 mt-0.5">
                              {r.error}
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-gray-600 whitespace-nowrap">
                          {formatTimestamp(r.timestamp)}
                        </span>
                      </div>
                      {r.success && (
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                          {r.rowCount != null && (
                            <span>{r.rowCount.toLocaleString()} 行</span>
                          )}
                          {r.fileSizeBytes != null && (
                            <span>{formatBytes(r.fileSizeBytes)}</span>
                          )}
                          {r.filePath && (
                            <button
                              onClick={() => handleOpenFolder(r.filePath!)}
                              className="ml-auto text-blue-400 hover:text-blue-300 transition-colors"
                            >
                              打开文件夹
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Summary Report Preview */}
            {summaryReport && (
              <section className="bg-gray-800 rounded-xl border border-gray-700 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-semibold">汇总报告</h2>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(summaryReport);
                    }}
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    复制
                  </button>
                </div>
                <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono bg-gray-900 rounded-lg p-4 max-h-80 overflow-y-auto border border-gray-700">
                  {summaryReport}
                </pre>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataExportPage;
