import { useState, useEffect, useCallback, useRef } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────

interface Strategy {
  id: string;
  name: string;
  description?: string;
  status: 'running' | 'stopped' | 'error';
  mode: 'dry-run' | 'live-run';
  signalCount?: number;
  lastSignal?: string;
  errorMessage?: string;
  createdAt?: string;
}

interface ExecutionRecord {
  id: string;
  time: string;
  strategyId: string;
  strategyName: string;
  signal: string;
  action: string;
  broker: string;
  result: 'profit' | 'loss' | 'neutral' | 'error';
  pnl?: number;
  details?: string;
}

interface AutomationRule {
  id: string;
  name: string;
  type: 'price-alert' | 'indicator-trigger' | 'time-based';
  enabled: boolean;
  condition: string;
  action: string;
  strategyId?: string;
  lastTriggered?: string;
  triggerCount: number;
}

interface BrokerStatus {
  connected: boolean;
  activeId?: string;
}

interface RiskSnapshot {
  totalExposure: number;
  maxDrawdown: number;
  dailyPnL: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

// ── Sub-Components ─────────────────────────────────────────────────────────

function StatusIndicator({ status }: { status: 'running' | 'stopped' | 'error' }) {
  const colors: Record<string, string> = {
    running: 'bg-emerald-400',
    stopped: 'bg-gray-500',
    error: 'bg-red-500',
  };
  const pulseClass = status === 'running' ? 'animate-pulse' : '';
  return (
    <div className="flex items-center gap-2">
      <span className={`w-2.5 h-2.5 rounded-full ${colors[status]} ${pulseClass}`} />
      <span className={`text-xs font-medium ${
        status === 'running' ? 'text-emerald-400' : status === 'error' ? 'text-red-400' : 'text-gray-400'
      }`}>
        {status === 'running' ? 'Running' : status === 'error' ? 'Error' : 'Stopped'}
      </span>
    </div>
  );
}

function ModeBadge({ mode }: { mode: 'dry-run' | 'live-run' }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
      mode === 'live-run'
        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
        : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
    }`}>
      {mode === 'live-run' ? '🔴 LIVE' : '🔵 DRY-RUN'}
    </span>
  );
}

function StrategyCard({
  strategy,
  onStart,
  onStop,
  onToggleMode,
}: {
  strategy: Strategy;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onToggleMode: (id: string, currentMode: 'dry-run' | 'live-run') => void;
}) {
  return (
    <div className="bg-[#1e2130] rounded-lg p-4 border border-[#2a2d3a] hover:border-[#3a3d4a] transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h4 className="text-sm font-semibold text-white">{strategy.name}</h4>
            <ModeBadge mode={strategy.mode} />
          </div>
          {strategy.description && (
            <p className="text-xs text-gray-500 mt-1">{strategy.description}</p>
          )}
        </div>
        <StatusIndicator status={strategy.status} />
      </div>

      <div className="flex items-center gap-4 text-xs text-gray-400 mb-3">
        {strategy.signalCount !== undefined && (
          <span>Signals: {strategy.signalCount}</span>
        )}
        {strategy.lastSignal && (
          <span>Last: {new Date(strategy.lastSignal).toLocaleTimeString()}</span>
        )}
      </div>

      {strategy.status === 'error' && strategy.errorMessage && (
        <div className="bg-red-500/10 border border-red-500/20 rounded px-3 py-2 mb-3">
          <span className="text-xs text-red-400">{strategy.errorMessage}</span>
        </div>
      )}

      <div className="flex items-center gap-2">
        {strategy.status === 'running' ? (
          <button
            onClick={() => onStop(strategy.id)}
            className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded text-xs font-medium transition-colors"
          >
            ⬛ Stop
          </button>
        ) : (
          <button
            onClick={() => onStart(strategy.id)}
            className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded text-xs font-medium transition-colors"
          >
            ▶ Start
          </button>
        )}
        <button
          onClick={() => onToggleMode(strategy.id, strategy.mode)}
          className="px-3 py-1.5 bg-[#2a2d3a] hover:bg-[#353849] text-gray-300 rounded text-xs font-medium transition-colors"
        >
          Switch to {strategy.mode === 'dry-run' ? 'Live' : 'Dry-Run'}
        </button>
      </div>
    </div>
  );
}

function ExecutionRow({ record }: { record: ExecutionRecord }) {
  const resultColors: Record<string, string> = {
    profit: 'text-emerald-400',
    loss: 'text-red-400',
    neutral: 'text-gray-400',
    error: 'text-yellow-400',
  };
  const resultBg: Record<string, string> = {
    profit: 'bg-emerald-500/10',
    loss: 'bg-red-500/10',
    neutral: 'bg-gray-500/10',
    error: 'bg-yellow-500/10',
  };
  return (
    <tr className="border-b border-[#2a2d3a] hover:bg-[#1e2130]/50 transition-colors">
      <td className="py-2 px-3 text-xs text-gray-400 font-mono">
        {new Date(record.time).toLocaleString()}
      </td>
      <td className="py-2 px-3 text-sm text-white">{record.strategyName}</td>
      <td className="py-2 px-3 text-sm text-gray-300 font-mono">{record.signal}</td>
      <td className="py-2 px-3 text-sm text-gray-300">{record.action}</td>
      <td className="py-2 px-3 text-sm text-gray-400">{record.broker}</td>
      <td className="py-2 px-3">
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${resultColors[record.result]} ${resultBg[record.result]}`}>
          {record.result}
        </span>
      </td>
      <td className={`py-2 px-3 text-right text-sm font-semibold ${
        (record.pnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
      }`}>
        {record.pnl !== undefined ? `${record.pnl >= 0 ? '+' : ''}${record.pnl.toLocaleString()}` : '—'}
      </td>
    </tr>
  );
}

function RuleCard({
  rule,
  onToggle,
  onDelete,
}: {
  rule: AutomationRule;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const typeIcons: Record<string, string> = {
    'price-alert': '💰',
    'indicator-trigger': '📊',
    'time-based': '⏰',
  };
  const typeLabels: Record<string, string> = {
    'price-alert': 'Price Alert',
    'indicator-trigger': 'Indicator',
    'time-based': 'Time-Based',
  };

  return (
    <div className={`bg-[#1e2130] rounded-lg p-4 border transition-colors ${
      rule.enabled ? 'border-[#2a2d3a] hover:border-[#3a3d4a]' : 'border-[#1a1b26] opacity-60'
    }`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{typeIcons[rule.type]}</span>
          <div>
            <h4 className="text-sm font-semibold text-white">{rule.name}</h4>
            <span className="text-xs text-gray-500">{typeLabels[rule.type]}</span>
          </div>
        </div>
        <button
          onClick={() => onToggle(rule.id)}
          className={`w-10 h-5 rounded-full transition-colors relative ${
            rule.enabled ? 'bg-emerald-500' : 'bg-gray-600'
          }`}
        >
          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
            rule.enabled ? 'left-5' : 'left-0.5'
          }`} />
        </button>
      </div>

      <div className="space-y-1 text-xs text-gray-400 mt-3">
        <div className="flex items-center gap-2">
          <span className="text-gray-500">IF:</span>
          <span className="text-gray-300 font-mono">{rule.condition}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-500">THEN:</span>
          <span className="text-emerald-400 font-mono">{rule.action}</span>
        </div>
      </div>

      <div className="flex items-center justify-between mt-3 pt-2 border-t border-[#2a2d3a]">
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>Triggered: {rule.triggerCount}x</span>
          {rule.lastTriggered && (
            <span>Last: {new Date(rule.lastTriggered).toLocaleDateString()}</span>
          )}
        </div>
        <button
          onClick={() => onDelete(rule.id)}
          className="text-xs text-red-400/60 hover:text-red-400 transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  confirmColor,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  confirmColor: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1e2130] rounded-xl border border-[#2a2d3a] p-6 max-w-md w-full mx-4 shadow-2xl">
        <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
        <p className="text-sm text-gray-400 mb-6">{message}</p>
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-[#2a2d3a] hover:bg-[#353849] text-gray-300 rounded-lg text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${confirmColor}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function AutomationPanel({ className }: { className?: string }) {
  // ── State ──
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [executions, setExecutions] = useState<ExecutionRecord[]>([]);
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [brokerStatus, setBrokerStatus] = useState<BrokerStatus>({ connected: false });
  const [riskSnapshot, setRiskSnapshot] = useState<RiskSnapshot>({
    totalExposure: 0,
    maxDrawdown: 0,
    dailyPnL: 0,
    riskLevel: 'low',
  });
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<'strategies' | 'history' | 'rules'>('strategies');

  // Filters
  const [historyFilter, setHistoryFilter] = useState<{ strategy: string; result: string }>({
    strategy: 'all',
    result: 'all',
  });

  // Confirmation dialog
  const [confirmDialog, setConfirmDialog] = useState<{
    show: boolean;
    strategyId?: string;
    title: string;
    message: string;
    confirmLabel: string;
    confirmColor: string;
    onConfirm: () => void;
  }>({
    show: false,
    title: '',
    message: '',
    confirmLabel: 'Confirm',
    confirmColor: 'bg-emerald-500 hover:bg-emerald-600 text-white',
    onConfirm: () => {},
  });

  // Add rule dialog
  const [showAddRule, setShowAddRule] = useState(false);
  const [newRule, setNewRule] = useState<Partial<AutomationRule>>({
    name: '',
    type: 'price-alert',
    condition: '',
    action: '',
    enabled: true,
  });

  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Data Fetching ────────────────────────────────────────────────────────

  const getApi = useCallback(() => {
    // R84: typed WindowApi — no more as any
    return window.api;
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const api = getApi();
      if (!api) {
        setLoading(false);
        return;
      }

      const [strategiesResult, brokerResult, riskResult] = await Promise.all([
        api.strategy?.getAll?.().catch(() => null),
        api.broker?.getStatus?.().catch(() => null),
        api.risk?.getStatusSnapshot?.().catch(() => null),
      ]);

      if (strategiesResult?.success) {
        setStrategies(strategiesResult.data ?? []);
      }
      if (brokerResult?.success) {
        setBrokerStatus(brokerResult.data ?? { connected: false });
      }
      if (riskResult?.success) {
        setRiskSnapshot(riskResult.data ?? {
          totalExposure: 0, maxDrawdown: 0, dailyPnL: 0, riskLevel: 'low',
        });
      }

      // Fetch execution history if available
      if (api.strategy?.getExecutionHistory) {
        const execResult = await (api.strategy as any).getExecutionHistory().catch(() => null);
        if (execResult?.success) {
          setExecutions(execResult.data ?? []);
        }
      }

      // Fetch automation rules if available
      if (api.strategy?.getAutomationRules) {
        const rulesResult = await (api.strategy as any).getAutomationRules().catch(() => null);
        if (rulesResult?.success) {
          setRules(rulesResult.data ?? []);
        }
      }
    } catch (err) {
      console.error('[AutomationPanel] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [getApi]);

  useEffect(() => {
    fetchData();
    autoRefreshRef.current = setInterval(fetchData, 10000);
    return () => {
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    };
  }, [fetchData]);

  // ── Strategy Actions ─────────────────────────────────────────────────────

  const handleStartStrategy = useCallback((id: string) => {
    const api = getApi();
    api?.strategy?.startLive?.(id).then((res: unknown) => {
      if (res?.success) {
        setStrategies(prev => prev.map(s =>
          s.id === id ? { ...s, status: 'running' as const } : s
        ));
      }
    }).catch((err: Error) => {
      console.error('[AutomationPanel] start strategy error:', err);
    });
  }, [getApi]);

  const handleStopStrategy = useCallback((id: string) => {
    const api = getApi();
    api?.strategy?.stopLive?.(id).then((res: unknown) => {
      if (res?.success) {
        setStrategies(prev => prev.map(s =>
          s.id === id ? { ...s, status: 'stopped' as const } : s
        ));
      }
    }).catch((err: Error) => {
      console.error('[AutomationPanel] stop strategy error:', err);
    });
  }, [getApi]);

  const handleToggleMode = useCallback((id: string, currentMode: 'dry-run' | 'live-run') => {
    const targetMode = currentMode === 'dry-run' ? 'live-run' : 'dry-run';

    if (targetMode === 'live-run') {
      setConfirmDialog({
        show: true,
        strategyId: id,
        title: '⚠️ Switch to Live Trading',
        message: 'This will enable real-money trading. All signals will be executed with actual orders. Make sure your risk limits are properly configured. Are you sure?',
        confirmLabel: 'Enable Live Trading',
        confirmColor: 'bg-red-500 hover:bg-red-600 text-white',
        onConfirm: () => {
          setStrategies(prev => prev.map(s =>
            s.id === id ? { ...s, mode: 'live-run' as const } : s
          ));
          setConfirmDialog(prev => ({ ...prev, show: false }));
        },
      });
    } else {
      setStrategies(prev => prev.map(s =>
        s.id === id ? { ...s, mode: 'dry-run' as const } : s
      ));
    }
  }, []);

  // ── Rule Actions ─────────────────────────────────────────────────────────

  const handleToggleRule = useCallback((id: string) => {
    setRules(prev => prev.map(r =>
      r.id === id ? { ...r, enabled: !r.enabled } : r
    ));
  }, []);

  const handleDeleteRule = useCallback((id: string) => {
    setRules(prev => prev.filter(r => r.id !== id));
  }, []);

  const handleAddRule = useCallback(() => {
    if (!newRule.name || !newRule.condition || !newRule.action) return;

    const rule: AutomationRule = {
      id: `rule-${Date.now()}`,
      name: newRule.name,
      type: newRule.type as AutomationRule['type'],
      enabled: newRule.enabled ?? true,
      condition: newRule.condition,
      action: newRule.action,
      triggerCount: 0,
    };

    setRules(prev => [...prev, rule]);
    setNewRule({ name: '', type: 'price-alert', condition: '', action: '', enabled: true });
    setShowAddRule(false);
  }, [newRule]);

  // ── Export ───────────────────────────────────────────────────────────────

  const handleExportHistory = useCallback(() => {
    const filtered = getFilteredExecutions();
    const csvLines = [
      'Time,Strategy,Signal,Action,Broker,Result,PnL',
      ...filtered.map(r =>
        `${r.time},${r.strategyName},${r.signal},${r.action},${r.broker},${r.result},${r.pnl ?? ''}`
      ),
    ];
    const text = csvLines.join('\n');
    navigator.clipboard.writeText(text).then(() => {
      alert('Execution history copied to clipboard (CSV format)');
    }).catch(() => {
      console.error('[AutomationPanel] clipboard write failed');
    });
  }, [executions, historyFilter]);

  // ── Filtered Executions ──────────────────────────────────────────────────

  function getFilteredExecutions(): ExecutionRecord[] {
    let filtered = [...executions];
    if (historyFilter.strategy !== 'all') {
      filtered = filtered.filter(r => r.strategyId === historyFilter.strategy);
    }
    if (historyFilter.result !== 'all') {
      filtered = filtered.filter(r => r.result === historyFilter.result);
    }
    return filtered;
  }

  // ── Computed Values ──────────────────────────────────────────────────────

  const runningCount = strategies.filter(s => s.status === 'running').length;
  const errorCount = strategies.filter(s => s.status === 'error').length;
  const uniqueStrategies = [...new Set(executions.map(e => e.strategyId))];
  const totalProfit = executions.filter(e => e.result === 'profit').reduce((s, e) => s + (e.pnl ?? 0), 0);
  const totalLoss = executions.filter(e => e.result === 'loss').reduce((s, e) => s + (e.pnl ?? 0), 0);
  const filteredExecutions = getFilteredExecutions();

  const riskLevelColors: Record<string, string> = {
    low: 'text-emerald-400 bg-emerald-500/20',
    medium: 'text-yellow-400 bg-yellow-500/20',
    high: 'text-orange-400 bg-orange-500/20',
    critical: 'text-red-400 bg-red-500/20',
  };

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading automation data...</div>
      </div>
    );
  }

  return (
    <div className={`p-6 space-y-6 ${className ?? ''}`}>
      {/* ── Confirmation Dialog ──────────────────────────────────────────── */}
      {confirmDialog.show && (
        <ConfirmDialog
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmLabel={confirmDialog.confirmLabel}
          confirmColor={confirmDialog.confirmColor}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(prev => ({ ...prev, show: false }))}
        />
      )}

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Automation Panel</h1>
          <p className="text-sm text-gray-400 mt-1">
            Strategy management, execution history, and automation rules
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Broker Status */}
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
            brokerStatus.connected
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
          }`}>
            {brokerStatus.connected ? '🟢 Broker Connected' : '⚫ Broker Offline'}
          </span>
          {/* Risk Level */}
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${riskLevelColors[riskSnapshot.riskLevel]}`}>
            Risk: {riskSnapshot.riskLevel.toUpperCase()}
          </span>
          <button
            onClick={fetchData}
            className="px-3 py-1.5 bg-[#2a2d3a] hover:bg-[#353849] text-gray-300 rounded-lg text-sm transition-colors"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* ── Quick Stats ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-[#1e2130] rounded-lg p-3 text-center">
          <div className="text-xs text-gray-400">Running</div>
          <div className="text-lg font-bold text-emerald-400 mt-1">{runningCount}</div>
        </div>
        <div className="bg-[#1e2130] rounded-lg p-3 text-center">
          <div className="text-xs text-gray-400">Total Strategies</div>
          <div className="text-lg font-bold text-white mt-1">{strategies.length}</div>
        </div>
        <div className="bg-[#1e2130] rounded-lg p-3 text-center">
          <div className="text-xs text-gray-400">Errors</div>
          <div className={`text-lg font-bold mt-1 ${errorCount > 0 ? 'text-red-400' : 'text-gray-400'}`}>
            {errorCount}
          </div>
        </div>
        <div className="bg-[#1e2130] rounded-lg p-3 text-center">
          <div className="text-xs text-gray-400">Total Profit</div>
          <div className="text-lg font-bold text-emerald-400 mt-1">
            +{totalProfit.toLocaleString()}
          </div>
        </div>
        <div className="bg-[#1e2130] rounded-lg p-3 text-center">
          <div className="text-xs text-gray-400">Total Loss</div>
          <div className="text-lg font-bold text-red-400 mt-1">
            {totalLoss.toLocaleString()}
          </div>
        </div>
      </div>

      {/* ── Section Tabs ─────────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-[#1a1b26] rounded-lg p-1 w-fit">
        {([
          { key: 'strategies' as const, label: 'Running Strategies', icon: '⚡' },
          { key: 'history' as const, label: 'Execution History', icon: '📋' },
          { key: 'rules' as const, label: 'Automation Rules', icon: '🔧' },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveSection(tab.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeSection === tab.key
                ? 'bg-[#2a2d3a] text-white'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ── Running Strategies Section ───────────────────────────────────── */}
      {activeSection === 'strategies' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-300">
              Active Strategies ({strategies.length})
            </h2>
          </div>

          {strategies.length === 0 ? (
            <div className="bg-[#1e2130] rounded-lg p-8 text-center">
              <span className="text-4xl mb-3 block">🤖</span>
              <p className="text-gray-400 text-sm">No strategies configured</p>
              <p className="text-gray-500 text-xs mt-1">
                Create strategies in the Strategy Editor to get started
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {strategies.map(strategy => (
                <StrategyCard
                  key={strategy.id}
                  strategy={strategy}
                  onStart={handleStartStrategy}
                  onStop={handleStopStrategy}
                  onToggleMode={handleToggleMode}
                />
              ))}
            </div>
          )}

          {/* Risk Snapshot */}
          <div className="bg-[#1e2130] rounded-lg p-4 border border-[#2a2d3a]">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Risk Snapshot</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <span className="text-xs text-gray-500">Total Exposure</span>
                <div className="text-sm font-semibold text-white mt-1">
                  {riskSnapshot.totalExposure.toLocaleString()} HKD
                </div>
              </div>
              <div>
                <span className="text-xs text-gray-500">Max Drawdown</span>
                <div className={`text-sm font-semibold mt-1 ${
                  riskSnapshot.maxDrawdown > 10 ? 'text-red-400' : 'text-yellow-400'
                }`}>
                  {riskSnapshot.maxDrawdown.toFixed(2)}%
                </div>
              </div>
              <div>
                <span className="text-xs text-gray-500">Daily P&L</span>
                <div className={`text-sm font-semibold mt-1 ${
                  riskSnapshot.dailyPnL >= 0 ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  {riskSnapshot.dailyPnL >= 0 ? '+' : ''}{riskSnapshot.dailyPnL.toLocaleString()} HKD
                </div>
              </div>
              <div>
                <span className="text-xs text-gray-500">Risk Level</span>
                <div className={`text-sm font-semibold mt-1 ${riskLevelColors[riskSnapshot.riskLevel]?.split(' ')[0] ?? 'text-gray-400'}`}>
                  {riskSnapshot.riskLevel.toUpperCase()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Execution History Section ────────────────────────────────────── */}
      {activeSection === 'history' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-sm font-semibold text-gray-300">
              Execution History ({filteredExecutions.length} records)
            </h2>
            <div className="flex items-center gap-3">
              {/* Strategy Filter */}
              <select
                value={historyFilter.strategy}
                onChange={e => setHistoryFilter(prev => ({ ...prev, strategy: e.target.value }))}
                className="bg-[#2a2d3a] text-gray-300 text-xs rounded-lg px-3 py-1.5 border border-[#3a3d4a] focus:outline-none focus:border-blue-500"
              >
                <option value="all">All Strategies</option>
                {uniqueStrategies.map(id => {
                  const strat = strategies.find(s => s.id === id);
                  return (
                    <option key={id} value={id}>
                      {strat?.name ?? id}
                    </option>
                  );
                })}
              </select>

              {/* Result Filter */}
              <select
                value={historyFilter.result}
                onChange={e => setHistoryFilter(prev => ({ ...prev, result: e.target.value }))}
                className="bg-[#2a2d3a] text-gray-300 text-xs rounded-lg px-3 py-1.5 border border-[#3a3d4a] focus:outline-none focus:border-blue-500"
              >
                <option value="all">All Results</option>
                <option value="profit">Profit</option>
                <option value="loss">Loss</option>
                <option value="neutral">Neutral</option>
                <option value="error">Error</option>
              </select>

              {/* Export Button */}
              <button
                onClick={handleExportHistory}
                className="px-3 py-1.5 bg-[#2a2d3a] hover:bg-[#353849] text-gray-300 rounded-lg text-xs transition-colors"
              >
                📋 Copy to Clipboard
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-[#2a2d3a]">
                  <th className="py-2 px-3 font-medium">Time</th>
                  <th className="py-2 px-3 font-medium">Strategy</th>
                  <th className="py-2 px-3 font-medium">Signal</th>
                  <th className="py-2 px-3 font-medium">Action</th>
                  <th className="py-2 px-3 font-medium">Broker</th>
                  <th className="py-2 px-3 font-medium">Result</th>
                  <th className="py-2 px-3 font-medium text-right">P&L</th>
                </tr>
              </thead>
              <tbody>
                {filteredExecutions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-500">
                      No execution records found
                    </td>
                  </tr>
                ) : (
                  filteredExecutions.map(record => (
                    <ExecutionRow key={record.id} record={record} />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Summary Row */}
          {filteredExecutions.length > 0 && (
            <div className="bg-[#1e2130] rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-6 text-sm">
                <span className="text-gray-400">
                  Total: <span className="text-white font-semibold">{filteredExecutions.length}</span> executions
                </span>
                <span className="text-gray-400">
                  Win: <span className="text-emerald-400 font-semibold">
                    {filteredExecutions.filter(e => e.result === 'profit').length}
                  </span>
                </span>
                <span className="text-gray-400">
                  Loss: <span className="text-red-400 font-semibold">
                    {filteredExecutions.filter(e => e.result === 'loss').length}
                  </span>
                </span>
              </div>
              <div className={`text-lg font-bold ${
                (totalProfit + totalLoss) >= 0 ? 'text-emerald-400' : 'text-red-400'
              }`}>
                Net: {(totalProfit + totalLoss) >= 0 ? '+' : ''}{(totalProfit + totalLoss).toLocaleString()} HKD
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Automation Rules Section ─────────────────────────────────────── */}
      {activeSection === 'rules' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-300">
              Automation Rules ({rules.length})
            </h2>
            <button
              onClick={() => setShowAddRule(true)}
              className="px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg text-xs font-medium transition-colors"
            >
              + Add Rule
            </button>
          </div>

          {/* Add Rule Form */}
          {showAddRule && (
            <div className="bg-[#1e2130] rounded-lg p-4 border border-blue-500/30">
              <h3 className="text-sm font-semibold text-white mb-3">New Automation Rule</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Rule Name</label>
                  <input
                    type="text"
                    value={newRule.name}
                    onChange={e => setNewRule(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., AAPL Price Alert"
                    className="w-full bg-[#2a2d3a] text-gray-300 text-sm rounded-lg px-3 py-2 border border-[#3a3d4a] focus:outline-none focus:border-blue-500 placeholder-gray-600"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Type</label>
                  <select
                    value={newRule.type}
                    onChange={e => setNewRule(prev => ({ ...prev, type: e.target.value as AutomationRule['type'] }))}
                    className="w-full bg-[#2a2d3a] text-gray-300 text-sm rounded-lg px-3 py-2 border border-[#3a3d4a] focus:outline-none focus:border-blue-500"
                  >
                    <option value="price-alert">💰 Price Alert</option>
                    <option value="indicator-trigger">📊 Indicator Trigger</option>
                    <option value="time-based">⏰ Time-Based</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Condition (IF)</label>
                  <input
                    type="text"
                    value={newRule.condition}
                    onChange={e => setNewRule(prev => ({ ...prev, condition: e.target.value }))}
                    placeholder="e.g., AAPL.price > 200"
                    className="w-full bg-[#2a2d3a] text-gray-300 text-sm rounded-lg px-3 py-2 border border-[#3a3d4a] focus:outline-none focus:border-blue-500 placeholder-gray-600 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Action (THEN)</label>
                  <input
                    type="text"
                    value={newRule.action}
                    onChange={e => setNewRule(prev => ({ ...prev, action: e.target.value }))}
                    placeholder="e.g., BUY 100 shares via momentum-strategy"
                    className="w-full bg-[#2a2d3a] text-gray-300 text-sm rounded-lg px-3 py-2 border border-[#3a3d4a] focus:outline-none focus:border-blue-500 placeholder-gray-600 font-mono"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 mt-4">
                <button
                  onClick={() => {
                    setShowAddRule(false);
                    setNewRule({ name: '', type: 'price-alert', condition: '', action: '', enabled: true });
                  }}
                  className="px-4 py-2 bg-[#2a2d3a] hover:bg-[#353849] text-gray-300 rounded-lg text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddRule}
                  disabled={!newRule.name || !newRule.condition || !newRule.action}
                  className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Create Rule
                </button>
              </div>
            </div>
          )}

          {/* Rules Grid */}
          {rules.length === 0 && !showAddRule ? (
            <div className="bg-[#1e2130] rounded-lg p-8 text-center">
              <span className="text-4xl mb-3 block">🔧</span>
              <p className="text-gray-400 text-sm">No automation rules configured</p>
              <p className="text-gray-500 text-xs mt-1">
                Create rules to automate trading based on price alerts, indicators, or schedules
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rules.map(rule => (
                <RuleCard
                  key={rule.id}
                  rule={rule}
                  onToggle={handleToggleRule}
                  onDelete={handleDeleteRule}
                />
              ))}
            </div>
          )}

          {/* Rule Templates */}
          <div className="bg-[#1e2130] rounded-lg p-4 border border-[#2a2d3a]">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Quick Templates</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                {
                  name: 'Price Breakout',
                  type: 'price-alert' as const,
                  condition: '{stock}.price > {stock}.high_20d',
                  action: 'TRIGGER breakout-strategy',
                  desc: 'Alert when price breaks 20-day high',
                },
                {
                  name: 'RSI Oversold',
                  type: 'indicator-trigger' as const,
                  condition: 'RSI({stock}, 14) < 30',
                  action: 'BUY via mean-reversion-strategy',
                  desc: 'Buy when RSI indicates oversold',
                },
                {
                  name: 'Market Open Trade',
                  type: 'time-based' as const,
                  condition: 'time == 09:30 AND dayOfWeek == MON-FRI',
                  action: 'EXECUTE morning-momentum-strategy',
                  desc: 'Execute strategy at market open',
                },
              ].map(template => (
                <button
                  key={template.name}
                  onClick={() => {
                    setNewRule({
                      name: template.name,
                      type: template.type,
                      condition: template.condition,
                      action: template.action,
                      enabled: true,
                    });
                    setShowAddRule(true);
                  }}
                  className="bg-[#2a2d3a] hover:bg-[#353849] rounded-lg p-3 text-left transition-colors"
                >
                  <div className="text-sm font-medium text-white">{template.name}</div>
                  <div className="text-xs text-gray-500 mt-1">{template.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
