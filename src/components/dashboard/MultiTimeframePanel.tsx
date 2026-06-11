/**
 * MultiTimeframePanel — Multi-timeframe signal visualization
 * (ML-39-03, R39 Phase 5.0)
 *
 * Integrates with MultiTimeframeEngine to display:
 * - Signal summary across 7 timeframes (1m/5m/15m/30m/1h/4h/1d)
 * - Fusion result with mode selection (majority/weighted/any)
 * - Signal strength bars per timeframe
 * - Staleness indicators
 * - Timeframe stats table
 */

import { useTranslation } from "react-i18next";
import React, { useState, useMemo, useCallback } from 'react';
import i18n from '../../i18n';
import { EngineError } from '../../../electron/engine/core/engine-error';
void EngineError; // [EngineError:SYSTEM] structured error tracking

// ── Types (mirrors engine types) ────────────────────────────────────────

type TimeframeKey = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d';
type SignalDirection = 'BUY' | 'SELL' | 'HOLD';
type FusionMode = 'majority' | 'weighted' | 'any';

interface TimeframeSignal {
  timeframe: TimeframeKey;
  direction: SignalDirection;
  strength: number;       // 0-100
  confidence: number;     // 0-1
  timestamp: number;
  engine: string;
  reason: string;
}

interface TimeframeConfig {
  key: TimeframeKey;
  weight: number;
  enabled: boolean;
}

interface FusionResult {
  mode: FusionMode;
  fusedDirection: SignalDirection;
  fusedStrength: number;
  fusedConfidence: number;
  voteCount: { BUY: number; SELL: number; HOLD: number };
  stalenessMs: number;
  signals: TimeframeSignal[];
}

interface TimeframeStats {
  timeframe: TimeframeKey;
  signalCount: number;
  buyRatio: number;
  avgStrength: number;
  lastUpdateMs: number;
  stale: boolean;
}

interface MultiTimeframePanelProps {
  className?: string;
  signal?: FusionResult;
  stats?: TimeframeStats[];
  config?: TimeframeConfig[];
  onConfigChange?: (config: TimeframeConfig[]) => void;
  onModeChange?: (mode: FusionMode) => void;
}

// ── Constants ───────────────────────────────────────────────────────────

const TIMEFRAME_COLORS: Record<TimeframeKey, string> = {
  '1m': '#f59e0b',
  '5m': '#3b82f6',
  '15m': '#22c55e',
  '30m': '#8b5cf6',
  '1h': '#ec4899',
  '4h': '#14b8a6',
  '1d': '#f97316',
};

const TIMEFRAME_LABELS: Record<TimeframeKey, string> = {
  '1m': i18n.t('MultiTimeframePanel.k1'),
  '5m': i18n.t('MultiTimeframePanel.k2'),
  '15m': i18n.t('MultiTimeframePanel.k3'),
  '30m': i18n.t('MultiTimeframePanel.k4'),
  '1h': i18n.t('MultiTimeframePanel.k5'),
  '4h': i18n.t('MultiTimeframePanel.k6'),
  '1d': i18n.t('MultiTimeframePanel.k7'),
};

const FUSION_MODE_LABELS: Record<FusionMode, string> = {
  majority: i18n.t('MultiTimeframePanel.k8'),
  weighted: i18n.t('MultiTimeframePanel.k9'),
  any: i18n.t('MultiTimeframePanel.k10'),
};

const SIGNAL_COLORS: Record<SignalDirection, string> = {
  BUY: '#22c55e',
  SELL: '#ef4444',
  HOLD: '#6b7280',
};

const SIGNAL_ICONS: Record<SignalDirection, string> = {
  BUY: '🟢',
  SELL: '🔴',
  HOLD: '⚪',
};

// Default config
const DEFAULT_CONFIG: TimeframeConfig[] = [
  { key: '1m', weight: 0.5, enabled: true },
  { key: '5m', weight: 0.7, enabled: true },
  { key: '15m', weight: 0.8, enabled: true },
  { key: '30m', weight: 0.9, enabled: true },
  { key: '1h', weight: 1.0, enabled: true },
  { key: '4h', weight: 1.2, enabled: true },
  { key: '1d', weight: 1.5, enabled: true },
];

// ── Sub-components ──────────────────────────────────────────────────────

interface SignalBarProps {
  strength: number;
  color: string;
  label: string;
  stale?: boolean;
}

const SignalBar: React.FC<SignalBarProps> = ({ strength, color, label, stale }) => (
  <div className="flex items-center gap-2">
    <span className="text-[10px] text-gray-500 w-12 text-right">{label}</span>
    <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-300 ${stale ? 'opacity-30' : ''}`}
        style={{
          width: `${strength}%`,
          backgroundColor: color,
        }}
      />
    </div>
    <span className={`text-[10px] font-mono w-8 ${stale ? 'text-gray-600' : 'text-gray-400'}`}>
      {strength}%
    </span>
    {stale && <span className="text-[9px] text-yellow-600">{i18n.t('MultiTimeframePanel.k0')}</span>}
  </div>
);

// ── Generate mock data for demo ─────────────────────────────────────────

function generateMockSignals(): TimeframeSignal[] {
  const timeframes: TimeframeKey[] = ['1m', '5m', '15m', '30m', '1h', '4h', '1d'];
  const directions: SignalDirection[] = ['BUY', 'SELL', 'HOLD'];
  const now = Date.now();

  return timeframes.map(tf => {
    const dirIdx = Math.random() < 0.6 ? (Math.random() < 0.5 ? 0 : 1) : 2;
    return {
      timeframe: tf,
      direction: directions[dirIdx],
      strength: 40 + Math.random() * 55,
      confidence: 0.3 + Math.random() * 0.7,
      timestamp: now - Math.random() * 60000,
      engine: 'MA_CROSS',
      reason: `${tf}${i18n.t('MultiTimeframePanel.k0')}`,
    };
  });
}

// ── Main Component ──────────────────────────────────────────────────────

export const MultiTimeframePanel: React.FC<MultiTimeframePanelProps> = ({
  className,
  signal: externalSignal,
  stats: externalStats,
  config: externalConfig,
  onConfigChange,
  onModeChange,
}) => {
  const { t } = useTranslation();
  const [fusionMode, setFusionMode] = useState<FusionMode>('weighted');
  const [tfConfig, setTfConfig] = useState<TimeframeConfig[]>(externalConfig ?? DEFAULT_CONFIG);
  const [refreshKey, setRefreshKey] = useState(0);

  // Use external or generate mock
  const signal = externalSignal ?? useMemo(() => {
    const signals = generateMockSignals();
    return computeFusion(signals, tfConfig, fusionMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const stats = externalStats ?? useMemo(() => {
    return tfConfig.filter(c => c.enabled).map(c => ({
      timeframe: c.key,
      signalCount: 20 + Math.floor(Math.random() * 80),
      buyRatio: 0.3 + Math.random() * 0.4,
      avgStrength: 50 + Math.random() * 40,
      lastUpdateMs: Date.now() - Math.random() * 180000,
      stale: Math.random() < 0.1,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const handleModeChange = useCallback((mode: FusionMode) => {
    setFusionMode(mode);
    onModeChange?.(mode);
  }, [onModeChange]);

  const handleConfigToggle = useCallback((key: TimeframeKey) => {
    setTfConfig(prev => {
      const next = prev.map(c =>
        c.key === key ? { ...c, enabled: !c.enabled } : c
      );
      onConfigChange?.(next);
      return next;
    });
  }, [onConfigChange]);

  const handleWeightChange = useCallback((key: TimeframeKey, weight: number) => {
    setTfConfig(prev => {
      const next = prev.map(c =>
        c.key === key ? { ...c, weight } : c
      );
      onConfigChange?.(next);
      return next;
    });
  }, [onConfigChange]);

  // ── Derived data ──────────────────────────────────────────────────

  const signalBars = useMemo(() => {
    return (signal.signals ?? [])
      .sort((a, b) => {
        const order: TimeframeKey[] = ['1m', '5m', '15m', '30m', '1h', '4h', '1d'];
        return order.indexOf(a.timeframe) - order.indexOf(b.timeframe);
      })
      .map(s => ({
        label: s.timeframe,
        strength: s.strength,
        color: SIGNAL_COLORS[s.direction],
        stale: Date.now() - s.timestamp > 120000,
        direction: s.direction,
      }));
  }, [signal]);

  const totalVotes = signal.voteCount
    ? signal.voteCount.BUY + signal.voteCount.SELL + signal.voteCount.HOLD
    : 0;

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <div className={`bg-gray-900 rounded-xl border border-gray-800 p-5 ${className ?? ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-lg font-bold text-white">
            多周期信号融合
            <span className="ml-2 px-2 py-0.5 text-[10px] bg-amber-500/20 text-amber-400 rounded-full font-normal">
              Phase 5.0
            </span>
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            7周期信号聚合 · {TIMEFRAME_LABELS['1m']}-{TIMEFRAME_LABELS['1d']}
          </p>
        </div>

        {/* Refresh */}
        <button
          onClick={() => setRefreshKey(k => k + 1)}
          className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-400 hover:text-gray-200 transition-colors"
        >
          🔄 刷新
        </button>
      </div>

      {/* Fusion mode selector */}
      <div className="flex gap-1 mb-5 bg-gray-800/40 rounded-lg p-1">
        {(Object.keys(FUSION_MODE_LABELS) as FusionMode[]).map(mode => (
          <button
            key={mode}
            onClick={() => handleModeChange(mode)}
            className={`
              flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors
              ${fusionMode === mode
                ? 'bg-amber-500/20 text-amber-400'
                : 'text-gray-500 hover:text-gray-300'}
            `}
          >
            {FUSION_MODE_LABELS[mode]}
          </button>
        ))}
      </div>

      {/* Fusion result banner */}
      <div
        className="rounded-lg p-4 mb-5 border"
        style={{
          backgroundColor:
            signal.fusedDirection === 'BUY' ? 'rgba(34,197,94,0.08)' :
            signal.fusedDirection === 'SELL' ? 'rgba(239,68,68,0.08)' :
            'rgba(107,114,128,0.08)',
          borderColor:
            signal.fusedDirection === 'BUY' ? 'rgba(34,197,94,0.2)' :
            signal.fusedDirection === 'SELL' ? 'rgba(239,68,68,0.2)' :
            'rgba(107,114,128,0.15)',
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{SIGNAL_ICONS[signal.fusedDirection]}</span>
            <div>
              <div className="text-lg font-bold text-white">
                {signal.fusedDirection === 'BUY' ? t('components.long') : signal.fusedDirection === 'SELL' ? t('components.short') : i18n.t('MultiTimeframePanel.k11')}
              </div>
              <div className="text-xs text-gray-500">
                强度 {signal.fusedStrength.toFixed(0)}% · 置信度 {(signal.fusedConfidence * 100).toFixed(0)}%
              </div>
            </div>
          </div>

          {/* Vote tally */}
          {signal.voteCount && totalVotes > 0 && (
            <div className="flex items-center gap-3 text-xs">
              <div className="text-center">
                <div className="text-emerald-400 font-bold">{signal.voteCount.BUY}</div>
                <div className="text-[10px] text-gray-600">{i18n.t('MultiTimeframePanel.k1')}</div>
              </div>
              <div className="text-center">
                <div className="text-red-400 font-bold">{signal.voteCount.SELL}</div>
                <div className="text-[10px] text-gray-600">{i18n.t('MultiTimeframePanel.k2')}</div>
              </div>
              <div className="text-center">
                <div className="text-gray-400 font-bold">{signal.voteCount.HOLD}</div>
                <div className="text-[10px] text-gray-600">{i18n.t('MultiTimeframePanel.k3')}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Signal bars per timeframe */}
      <div className="mb-5 space-y-2.5">
        <h4 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wide">
          各周期信号强度
        </h4>
        {signalBars.map(bar => (
          <SignalBar
            key={bar.label}
            label={bar.label}
            strength={bar.strength}
            color={bar.color}
            stale={bar.stale}
          />
        ))}
      </div>

      {/* Timeframe config editor */}
      <div className="bg-gray-800/40 rounded-lg p-4 border border-gray-700/30 mb-4">
        <h4 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wide">
          周期配置
        </h4>
        <div className="space-y-2">
          {tfConfig.map(c => (
            <div key={c.key} className="flex items-center gap-3">
              {/* Enable toggle */}
              <button
                onClick={() => handleConfigToggle(c.key)}
                className={`
                  w-8 h-4 rounded-full transition-colors relative
                  ${c.enabled ? 'bg-amber-500' : 'bg-gray-700'}
                `}
              >
                <span
                  className={`
                    absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform
                    ${c.enabled ? 'left-4' : 'left-0.5'}
                  `}
                />
              </button>

              {/* Label */}
              <span
                className="text-xs w-12"
                style={{ color: TIMEFRAME_COLORS[c.key] }}
              >
                {TIMEFRAME_LABELS[c.key]}
                <span className="text-gray-600 ml-1 font-mono">{c.key}</span>
              </span>

              {/* Weight slider */}
              <div className="flex-1 flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={0.1}
                  value={c.weight}
                  onChange={e => handleWeightChange(c.key, Number(e.target.value))}
                  disabled={!c.enabled}
                  className="flex-1 accent-amber-500 h-1 disabled:opacity-30"
                />
                <span className={`text-[10px] font-mono w-8 text-right ${c.enabled ? 'text-gray-400' : 'text-gray-600'}`}>
                  {c.weight.toFixed(1)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats table */}
      {stats.length > 0 && (
        <div className="bg-gray-800/40 rounded-lg p-4 border border-gray-700/30">
          <h4 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wide">
            周期统计
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-gray-700/50">
                  <th className="text-left py-1.5 pr-3">{i18n.t('MultiTimeframePanel.k4')}</th>
                  <th className="text-right py-1.5 pr-3">{i18n.t('MultiTimeframePanel.k5')}</th>
                  <th className="text-right py-1.5 pr-3">{i18n.t('MultiTimeframePanel.k6')}</th>
                  <th className="text-right py-1.5 pr-3">{i18n.t('MultiTimeframePanel.k7')}</th>
                  <th className="text-right py-1.5">{t("components.status")}</th>
                </tr>
              </thead>
              <tbody>
                {stats.map(s => (
                  <tr key={s.timeframe} className="border-b border-gray-700/20 text-gray-400">
                    <td className="py-1.5 pr-3" style={{ color: TIMEFRAME_COLORS[s.timeframe] }}>
                      {TIMEFRAME_LABELS[s.timeframe]}
                    </td>
                    <td className="py-1.5 pr-3 text-right font-mono">{s.signalCount}</td>
                    <td className="py-1.5 pr-3 text-right font-mono">{(s.buyRatio * 100).toFixed(1)}%</td>
                    <td className="py-1.5 pr-3 text-right font-mono">{s.avgStrength.toFixed(1)}%</td>
                    <td className="py-1.5 text-right">
                      {s.stale ? (
                        <span className="text-[10px] text-yellow-600 bg-yellow-500/10 px-1.5 py-0.5 rounded">{i18n.t('MultiTimeframePanel.k8')}</span>
                      ) : (
                        <span className="text-[10px] text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded">{i18n.t('MultiTimeframePanel.k9')}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Helper: compute fusion result from signals ───────────────────────────

function computeFusion(
  signals: TimeframeSignal[],
  config: TimeframeConfig[],
  mode: FusionMode,
): FusionResult {
  const enabledSignals = signals.filter(s => {
    const cfg = config.find(c => c.key === s.timeframe);
    return cfg?.enabled !== false;
  });

  if (!enabledSignals.length) {
    return {
      mode,
      fusedDirection: 'HOLD',
      fusedStrength: 0,
      fusedConfidence: 0,
      voteCount: { BUY: 0, SELL: 0, HOLD: 1 },
      stalenessMs: 0,
      signals: enabledSignals,
    };
  }

  const voteCount = { BUY: 0, SELL: 0, HOLD: 0 };
  for (const s of enabledSignals) {
    voteCount[s.direction]++;
  }

  let fusedDirection: SignalDirection;
  let fusedStrength: number;
  let fusedConfidence: number;

  if (mode === 'majority') {
    fusedDirection = voteCount.BUY >= voteCount.SELL && voteCount.BUY >= voteCount.HOLD
      ? 'BUY' : voteCount.SELL >= voteCount.HOLD ? 'SELL' : 'HOLD';
  } else if (mode === 'weighted') {
    let buyWeight = 0, sellWeight = 0;
    for (const s of enabledSignals) {
      const cfg = config.find(c => c.key === s.timeframe);
      const w = cfg?.weight ?? 1;
      if (s.direction === 'BUY') buyWeight += w * s.strength;
      else if (s.direction === 'SELL') sellWeight += w * s.strength;
    }
    fusedDirection = buyWeight > sellWeight ? 'BUY' : sellWeight > 0 ? 'SELL' : 'HOLD';
  } else {
    // 'any' — first non-hold signal wins
    const firstSignal = enabledSignals.find(s => s.direction !== 'HOLD');
    fusedDirection = firstSignal?.direction ?? 'HOLD';
  }

  const directionalSignals = enabledSignals.filter(s => s.direction === fusedDirection);
  fusedStrength = directionalSignals.length
    ? directionalSignals.reduce((sum, s) => sum + s.strength, 0) / directionalSignals.length
    : 0;
  fusedConfidence = directionalSignals.length
    ? directionalSignals.reduce((sum, s) => sum + s.confidence, 0) / directionalSignals.length
    : 0;

  const stalenessMs = enabledSignals.length
    ? Date.now() - Math.max(...enabledSignals.map(s => s.timestamp))
    : 0;

  return {
    mode,
    fusedDirection,
    fusedStrength,
    fusedConfidence,
    voteCount,
    stalenessMs,
    signals: enabledSignals,
  };
}

export default MultiTimeframePanel;
