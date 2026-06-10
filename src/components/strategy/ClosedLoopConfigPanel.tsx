// ClosedLoopConfigPanel — StrategyPage 闭环配置 UI
// Phase 4.3 R36 ML-36-02: Control panel for ClosedLoopExecutor + RebalanceEngine config
import { useState } from 'react';
interface LoopConfig {
  mode: 'immediate' | 'triggered' | 'scheduled';
  stopLoss: number;
  takeProfit: number;
  trailingStop: boolean;
  maxPositionTime: number; // hours
  maxDailyLoss: number;
  cooldownMs: number;
  maxRetries: number;
  retryStrategy: 'fixed' | 'exponential' | 'adaptive';
  schedule: string;
  rebalanceThreshold: number;
  rebalanceMethod: 'equal_weight' | 'target_weight' | 'risk_parity';
}

interface Props {
  onSave?: (config: LoopConfig) => void;
  onBack?: () => void;
  initialConfig?: Partial<LoopConfig>;
  strategyId?: string;
}

const DEFAULT_CONFIG: LoopConfig = {
  mode: 'triggered',
  stopLoss: 5,
  takeProfit: 15,
  trailingStop: false,
  maxPositionTime: 72,
  maxDailyLoss: 5,
  cooldownMs: 60000,
  maxRetries: 3,
  retryStrategy: 'exponential',
  schedule: '0 */4 * * *',
  rebalanceThreshold: 5,
  rebalanceMethod: 'equal_weight',
};

const MODE_LABELS: Record<LoopConfig['mode'], { icon: string; title: string; desc: string }> = {
  immediate: { icon: '⚡', title: 'immediateExec', desc: '手动触发，立即下单' },
  triggered: { icon: '🎯', title: 'triggeredExec', desc: '满足条件后自动执行' },
  scheduled: { icon: '⏰', title: 'scheduledExec', desc: '按 Cron 表达式定时执行' },
};

const RETRY_LABELS: Record<LoopConfig['retryStrategy'], string> = {
  fixed: '固定间隔 (1s)',
  exponential: '指数退避 (2^n × 1s)',
  adaptive: '自适应 (根据错误类型)',
};

const REBALANCE_LABELS: Record<LoopConfig['rebalanceMethod'], string> = {
  equal_weight: '等权重',
  target_weight: '目标权重',
  risk_parity: '风险平价',
};

export default function ClosedLoopConfigPanel({ onSave, onBack, initialConfig, strategyId }: Props) {
    const [config, setConfig] = useState<LoopConfig>({
  ...DEFAULT_CONFIG, ...initialConfig });
  const [saved, setSaved] = useState(false);

  function update<K extends keyof LoopConfig>(key: K, value: LoopConfig[K]) {
    setConfig(prev => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    onSave?.(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">闭环执行配置</h2>
          <p className="text-xs text-gray-500 mt-1">
            {strategyId ? `策略: ${strategyId}` : 'Phase 4.3 — ClosedLoopExecutor'}
          </p>
        </div>
        <div className="flex gap-2">
          {onBack && (
            <button onClick={onBack} className="px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors">{'goBack'}</button>
          )}
          <button
            onClick={handleSave}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
              saved
                ? 'bg-green-500/20 text-green-400'
                : 'bg-[#D4A853]/20 hover:bg-[#D4A853]/30 text-[#D4A853]'
            }`}
          >
            {saved ? '✓ 已保存' : '保存配置'}
          </button>
        </div>
      </div>

      {/* Execution Mode */}
      <div className="bg-[#12121a] border border-white/5 rounded-xl p-4">
        <h3 className="text-sm text-gray-400 mb-3">执行模式</h3>
        <div className="grid grid-cols-3 gap-3">
          {(Object.entries(MODE_LABELS) as [LoopConfig['mode'], typeof MODE_LABELS['immediate']][]).map(([mode, info]) => (
            <button
              key={mode}
              onClick={() => update('mode', mode)}
              className={`p-3 rounded-lg text-left border transition-all ${
                config.mode === mode
                  ? 'border-[#D4A853]/50 bg-[#D4A853]/10'
                  : 'border-white/5 hover:border-white/10'
              }`}
            >
              <div className="text-xl mb-1">{info.icon}</div>
              <div className="text-white text-xs font-medium">{info.title}</div>
              <div className="text-gray-500 text-[10px] mt-0.5">{info.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Risk Parameters */}
      <div className="bg-[#12121a] border border-white/5 rounded-xl p-4">
        <h3 className="text-sm text-gray-400 mb-3">风控参数</h3>
        <div className="grid grid-cols-2 gap-4">
          <NumberField
            label="止损 (%)"
            value={config.stopLoss}
            onChange={v => update('stopLoss', v)}
            min={0.5} max={20} step={0.5}
            color="text-yellow-400"
          />
          <NumberField
            label="止盈 (%)"
            value={config.takeProfit}
            onChange={v => update('takeProfit', v)}
            min={1} max={50} step={1}
            color="text-blue-400"
          />
          <NumberField
            label="最大持仓时间 (小时)"
            value={config.maxPositionTime}
            onChange={v => update('maxPositionTime', v)}
            min={1} max={720} step={1}
          />
          <NumberField
            label="日亏损限制 (%)"
            value={config.maxDailyLoss}
            onChange={v => update('maxDailyLoss', v)}
            min={0.5} max={20} step={0.5}
            color="text-red-400"
          />
        </div>

        <div className="mt-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.trailingStop}
              onChange={e => update('trailingStop', e.target.checked)}
              className="rounded border-white/10 bg-[#0a0a12] accent-[#D4A853]"
            />
            <span className="text-xs text-gray-400">启用追踪止损</span>
          </label>
        </div>
      </div>

      {/* Schedule (if scheduled mode) */}
      {config.mode === 'scheduled' && (
        <div className="bg-[#12121a] border border-white/5 rounded-xl p-4">
          <h3 className="text-sm text-gray-400 mb-3">Cron 表达式</h3>
          <input
            type="text"
            value={config.schedule}
            onChange={e => update('schedule', e.target.value)}
            className="w-full bg-[#0a0a12] border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-[#D4A853]/50 outline-none"
            placeholder="0 */4 * * *"
          />
          <p className="text-[10px] text-gray-600 mt-1">
            标准 6 位 Cron: 秒 分 时 日 月 周
          </p>
        </div>
      )}

      {/* Retry Settings */}
      <div className="bg-[#12121a] border border-white/5 rounded-xl p-4">
        <h3 className="text-sm text-gray-400 mb-3">重试策略</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">最大重试次数</label>
            <input
              type="number"
              value={config.maxRetries}
              onChange={e => update('maxRetries', parseInt(e.target.value) || 0)}
              min={0} max={10}
              className="w-24 bg-[#0a0a12] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[#D4A853]/50 outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">重试算法</label>
            <select
              value={config.retryStrategy}
              onChange={e => update('retryStrategy', e.target.value as LoopConfig['retryStrategy'])}
              className="w-40 bg-[#0a0a12] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[#D4A853]/50 outline-none"
            >
              {Object.entries(RETRY_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-3">
          <label className="text-xs text-gray-500 mb-1 block">冷却时间 (秒)</label>
          <input
            type="number"
            value={config.cooldownMs / 1000}
            onChange={e => update('cooldownMs', (parseInt(e.target.value) || 0) * 1000)}
            min={0} max={3600}
            className="w-24 bg-[#0a0a12] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[#D4A853]/50 outline-none"
          />
        </div>
      </div>

      {/* Rebalance Settings */}
      <div className="bg-[#12121a] border border-white/5 rounded-xl p-4">
        <h3 className="text-sm text-gray-400 mb-3">再平衡配置</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">触发阈值 (%)</label>
            <input
              type="number"
              value={config.rebalanceThreshold}
              onChange={e => update('rebalanceThreshold', parseFloat(e.target.value) || 0)}
              min={1} max={30} step={1}
              className="w-24 bg-[#0a0a12] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[#D4A853]/50 outline-none"
            />
            <p className="text-[10px] text-gray-600 mt-0.5">仓位偏离超过此值触发再平衡</p>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">再平衡方法</label>
            <select
              value={config.rebalanceMethod}
              onChange={e => update('rebalanceMethod', e.target.value as LoopConfig['rebalanceMethod'])}
              className="w-40 bg-[#0a0a12] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[#D4A853]/50 outline-none"
            >
              {Object.entries(REBALANCE_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Config Summary */}
      <div className="bg-[#0a0a12] border border-[#D4A853]/20 rounded-xl p-3">
        <h3 className="text-xs text-[#D4A853] font-medium mb-2">配置摘要</h3>
        <div className="grid grid-cols-4 gap-2 text-xs">
          <div>
            <span className="text-gray-600">模式: </span>
            <span className="text-white">{MODE_LABELS[config.mode].title}</span>
          </div>
          <div>
            <span className="text-gray-600">止损/盈: </span>
            <span className="text-white">-{config.stopLoss}% / +{config.takeProfit}%</span>
          </div>
          <div>
            <span className="text-gray-600">日限: </span>
            <span className="text-white">-{config.maxDailyLoss}%</span>
          </div>
          <div>
            <span className="text-gray-600">重试: </span>
            <span className="text-white">{config.maxRetries}次 ({config.retryStrategy})</span>
          </div>
          <div>
            <span className="text-gray-600">冷却: </span>
            <span className="text-white">{config.cooldownMs / 1000}s</span>
          </div>
          <div>
            <span className="text-gray-600">超时: </span>
            <span className="text-white">{config.maxPositionTime}h</span>
          </div>
          <div>
            <span className="text-gray-600">再平衡: </span>
            <span className="text-white">±{config.rebalanceThreshold}%</span>
          </div>
          <div>
            <span className="text-gray-600">追踪止损: </span>
            <span className={config.trailingStop ? 'text-green-400' : 'text-gray-600'}>
              {config.trailingStop ? '开' : '关'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-component ─────────────────────────────────────────────────────────

function NumberField({
  label, value, onChange, min, max, step, color = 'text-white',
}: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step: number; color?: string;
}) {
  return (
    <div>
      <label className="text-xs text-gray-500 mb-1 block">{label}</label>
      <input
        type="number"
        value={value}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        min={min} max={max} step={step}
        className={`w-24 bg-[#0a0a12] border border-white/10 rounded-lg px-3 py-2 text-sm ${color} focus:border-[#D4A853]/50 outline-none`}
      />
    </div>
  );
}
