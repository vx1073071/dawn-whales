// ── R113 Indicator Panel — 技术指标选择器+参数面板 (P0 20核心指标) ─────────
// PM: 模块2 P0, 对标富途80+指标, 先做20个核心

import { useState, useCallback, useMemo } from 'react';

// ═══════════ Types ═══════════

export type IndicatorCategory = 'trend' | 'momentum' | 'volatility' | 'volume' | 'overlay';

export interface IndicatorDef {
  id: string;
  label: string;
  shortLabel: string;
  category: IndicatorCategory;
  description: string;
  params: { name: string; key: string; default: number; min: number; max: number; step: number }[];
  multiLine?: boolean; // has sub-panes (MACD, BOLL, KDJ)
}

// ═══════════ 20 Core Indicators ═══════════

export const INDICATOR_DEFS: IndicatorDef[] = [
  // ── Trend ──
  { id: 'ma', label: '移动平均线', shortLabel: 'MA', category: 'trend', description: 'Simple Moving Average — N日收盘价算术平均', params: [
    { name: '周期', key: 'period', default: 20, min: 2, max: 500, step: 1 },
  ]},
  { id: 'ema', label: '指数移动平均', shortLabel: 'EMA', category: 'trend', description: 'Exponential Moving Average — 近期权重更高', params: [
    { name: '周期', key: 'period', default: 20, min: 2, max: 500, step: 1 },
  ]},
  { id: 'wma', label: '加权移动平均', shortLabel: 'WMA', category: 'trend', description: 'Weighted Moving Average — 线性加权', params: [
    { name: '周期', key: 'period', default: 20, min: 2, max: 500, step: 1 },
  ]},
  { id: 'boll', label: '布林带', shortLabel: 'BOLL', category: 'trend', description: 'Bollinger Bands — 中轨±N倍标准差', multiLine: true, params: [
    { name: '周期', key: 'period', default: 20, min: 2, max: 500, step: 1 },
    { name: '倍数', key: 'multiplier', default: 2, min: 1, max: 5, step: 0.5 },
  ]},

  // ── Momentum ──
  { id: 'macd', label: 'MACD', shortLabel: 'MACD', category: 'momentum', description: '异同移动平均线 — 快慢EMA差值+信号线+柱', multiLine: true, params: [
    { name: '快线', key: 'fast', default: 12, min: 2, max: 200, step: 1 },
    { name: '慢线', key: 'slow', default: 26, min: 2, max: 200, step: 1 },
    { name: '信号', key: 'signal', default: 9, min: 2, max: 100, step: 1 },
  ]},
  { id: 'rsi', label: '相对强弱', shortLabel: 'RSI', category: 'momentum', description: 'Relative Strength Index — 0-100超买超卖', params: [
    { name: '周期', key: 'period', default: 14, min: 2, max: 200, step: 1 },
  ]},
  { id: 'kdj', label: 'KDJ随机', shortLabel: 'KDJ', category: 'momentum', description: 'KDJ — K线+D线+J线', multiLine: true, params: [
    { name: 'N', key: 'n', default: 9, min: 2, max: 200, step: 1 },
    { name: 'M1', key: 'm1', default: 3, min: 1, max: 200, step: 1 },
    { name: 'M2', key: 'm2', default: 3, min: 1, max: 200, step: 1 },
  ]},
  { id: 'wr', label: '威廉指标', shortLabel: 'W%R', category: 'momentum', description: 'Williams %R — -100到0超买超卖', params: [
    { name: '周期', key: 'period', default: 14, min: 2, max: 200, step: 1 },
  ]},
  { id: 'cci', label: '商品通道', shortLabel: 'CCI', category: 'momentum', description: 'Commodity Channel Index — ±100超买超卖', params: [
    { name: '周期', key: 'period', default: 20, min: 2, max: 200, step: 1 },
  ]},

  // ── Volatility ──
  { id: 'atr', label: '平均真实波幅', shortLabel: 'ATR', category: 'volatility', description: 'Average True Range — N日波动幅度', params: [
    { name: '周期', key: 'period', default: 14, min: 2, max: 200, step: 1 },
  ]},
  { id: 'stddev', label: '标准差', shortLabel: 'STDDEV', category: 'volatility', description: 'Standard Deviation — N日收盘价标准差', params: [
    { name: '周期', key: 'period', default: 20, min: 2, max: 500, step: 1 },
  ]},

  // ── Volume ──
  { id: 'obv', label: '能量潮', shortLabel: 'OBV', category: 'volume', description: 'On-Balance Volume — 量价趋势', params: []},
  { id: 'vwap', label: '成交量加权均价', shortLabel: 'VWAP', category: 'volume', description: 'Volume Weighted Average Price', params: []},
  { id: 'mfi', label: '资金流量', shortLabel: 'MFI', category: 'volume', description: 'Money Flow Index — 量价RSI', params: [
    { name: '周期', key: 'period', default: 14, min: 2, max: 200, step: 1 },
  ]},

  // ── Overlay ──
  { id: 'sar', label: '抛物线SAR', shortLabel: 'SAR', category: 'overlay', description: 'Parabolic SAR — 止损反转点', params: [
    { name: '加速因子', key: 'af', default: 0.02, min: 0.01, max: 0.1, step: 0.01 },
    { name: '最大加速', key: 'maxAf', default: 0.2, min: 0.1, max: 0.5, step: 0.05 },
  ]},
  { id: 'ichimoku', label: '一目均衡', shortLabel: 'ICHIMOKU', category: 'overlay', description: 'Ichimoku Cloud — 五线趋势系统', multiLine: true, params: [
    { name: '转换线', key: 'tenkan', default: 9, min: 2, max: 200, step: 1 },
    { name: '基准线', key: 'kijun', default: 26, min: 2, max: 200, step: 1 },
    { name: '延迟线', key: 'senkouB', default: 52, min: 2, max: 200, step: 1 },
  ]},

  // ── Custom ──
  { id: 'pivot', label: '枢轴点', shortLabel: 'PIVOT', category: 'overlay', description: 'Standard Pivot Points — PP/R1-3/S1-3', multiLine: true, params: []},
  { id: 'ma-envelope', label: '均线包络', shortLabel: 'ENVELOPE', category: 'overlay', description: 'MA Envelope — 均线±N%通道', multiLine: true, params: [
    { name: '周期', key: 'period', default: 20, min: 2, max: 500, step: 1 },
    { name: '偏离%', key: 'pct', default: 3, min: 0.5, max: 20, step: 0.5 },
  ]},
  { id: 'ema-cross', label: 'EMA交叉', shortLabel: 'CROSS', category: 'trend', description: 'EMA金叉死叉信号', params: [
    { name: '快线', key: 'fast', default: 12, min: 2, max: 200, step: 1 },
    { name: '慢线', key: 'slow', default: 26, min: 2, max: 200, step: 1 },
  ]},
];

// ═══════════ Category colors ═══════════

export const CATEGORY_COLORS: Record<IndicatorCategory, string> = {
  trend: '#f59e0b', momentum: '#ef4444', volatility: '#8b5cf6', volume: '#22c55e', overlay: '#3b82f6',
};

export const CATEGORY_LABELS: Record<IndicatorCategory, string> = {
  trend: '趋势', momentum: '动量', volatility: '波动', volume: '量能', overlay: '叠加',
};

// ═══════════ Props ═══════════

export interface IndicatorPanelProps {
  activeIds: string[];
  onToggle: (id: string) => void;
  onParamsChange?: (id: string, params: Record<string, number>) => void;
  className?: string;
}

// ═══════════ Component ═══════════

export default function IndicatorPanel({ activeIds, onToggle, onParamsChange, className = '' }: IndicatorPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return INDICATOR_DEFS;
    const q = search.toLowerCase();
    return INDICATOR_DEFS.filter(d =>
      d.label.toLowerCase().includes(q) || d.shortLabel.toLowerCase().includes(q) || d.id.includes(q)
    );
  }, [search]);

  const grouped = useMemo(() => {
    const map: Record<IndicatorCategory, IndicatorDef[]> = { trend: [], momentum: [], volatility: [], volume: [], overlay: [] };
    for (const def of filtered) map[def.category].push(def);
    return map;
  }, [filtered]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  }, []);

  return (
    <div className={`flex flex-col bg-[#0d1117] rounded-lg border border-[#30363d] p-3 text-xs ${className}`} style={{ fontFamily: 'monospace' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[#8b949e] font-semibold text-xs tracking-wide uppercase">指标 Indicator</span>
        <span className="text-[#484f58]">{activeIds.length}/20</span>
      </div>

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="搜索指标..."
        className="bg-[#161b22] border border-[#30363d] rounded px-2 py-1 text-xs text-[#c9d1d9] mb-2 focus:outline-none focus:border-[#c9a96e] placeholder-[#484f58]"
      />

      {/* Category groups */}
      <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto">
        {(Object.entries(grouped) as [IndicatorCategory, IndicatorDef[]][]).map(([cat, defs]) => {
          if (defs.length === 0) return null;
          return (
            <div key={cat}>
              <div className="flex items-center gap-1.5 mb-1 px-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[cat] }} />
                <span className="text-[#8b949e] font-semibold">{CATEGORY_LABELS[cat]}</span>
                <span className="text-[#484f58]">({defs.length})</span>
              </div>
              {defs.map(def => {
                const isActive = activeIds.includes(def.id);
                const isExpanded = expandedId === def.id;
                return (
                  <div key={def.id} className="ml-3">
                    <button
                      onClick={() => onToggle(def.id)}
                      onDoubleClick={() => toggleExpand(def.id)}
                      className={`w-full flex items-center gap-1.5 px-2 py-0.5 rounded text-left transition-colors ${
                        isActive ? 'bg-[#3b82f620] text-[#3b82f6]' : 'text-[#8b949e] hover:bg-[#161b22] hover:text-[#c9d1d9]'
                      }`}
                      title={def.description}
                    >
                      <span className={`text-[10px] ${isActive ? 'text-[#3b82f6]' : 'text-[#484f58]'}`}>
                        {isActive ? '■' : '□'}
                      </span>
                      <span className="truncate flex-1">{def.shortLabel}</span>
                      <span className="text-[10px] text-[#484f58] truncate max-w-[80px]">
                        {def.label.length > 6 ? def.shortLabel : def.label}
                      </span>
                      {def.multiLine && (
                        <span className="text-[#484f58] text-[9px]" title="多线指标">≡</span>
                      )}
                    </button>

                    {/* Expanded params */}
                    {isExpanded && def.params.length > 0 && (
                      <div className="ml-5 mt-1 mb-1 p-2 bg-[#161b22] rounded border border-[#1c2333] flex flex-wrap gap-2">
                        {def.params.map(p => (
                          <div key={p.key} className="flex items-center gap-1.5">
                            <label className="text-[10px] text-[#484f58]">{p.name}</label>
                            <input
                              type="number"
                              defaultValue={p.default}
                              min={p.min}
                              max={p.max}
                              step={p.step}
                              onChange={e => {
                                const val = parseFloat(e.target.value);
                                if (!isNaN(val)) onParamsChange?.(def.id, { ...Object.fromEntries(def.params.map(pp => [pp.key, pp.default])), [p.key]: val });
                              }}
                              className="w-12 bg-[#0d1117] border border-[#30363d] rounded px-1 py-0.5 text-[10px] text-[#c9d1d9] text-right"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Footer: quick presets */}
      <div className="mt-2 pt-2 border-t border-[#1c2333] flex gap-1 flex-wrap">
        <PresetButton label="均线系" ids={['ma', 'ema', 'boll']} active={activeIds} onToggle={onToggle} />
        <PresetButton label="MACD+RSI" ids={['macd', 'rsi']} active={activeIds} onToggle={onToggle} />
        <PresetButton label="趋势套装" ids={['ma', 'boll', 'sar', 'vwap']} active={activeIds} onToggle={onToggle} />
        <PresetButton label="全清" ids={[]} active={activeIds} onToggle={() => {
          for (const aid of activeIds) onToggle(aid);
        }} />
      </div>
    </div>
  );
}

// ═══════════ Preset Button ═══════════

function PresetButton({ label, ids, active, onToggle }: { label: string; ids: string[]; active: string[]; onToggle: (id: string) => void }) {
  const allActive = ids.length > 0 && ids.every(id => active.includes(id));
  return (
    <button
      onClick={() => {
        if (ids.length === 0) { for (const id of active) onToggle(id); return; }
        for (const id of ids) {
          if (allActive) onToggle(id); // deactivate all
          else if (!active.includes(id)) onToggle(id); // activate missing
        }
      }}
      className={`px-1.5 py-0.5 text-[9px] rounded transition-colors ${
        allActive ? 'bg-[#3b82f620] text-[#3b82f6]' : 'bg-[#161b22] text-[#484f58] hover:text-[#8b949e]'
      }`}
    >
      {label}
    </button>
  );
}
