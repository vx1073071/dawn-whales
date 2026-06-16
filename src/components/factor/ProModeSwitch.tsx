// @ts-nocheck
// ── R191 ML P7-03: ProModeSwitch — 专业模式UI ─────────────────────────
// Professional mode toggle with confirmation modal + advanced parameter panel.
// 🌱 L1/L2 users can optionally enable "专业模式" (Pro Mode) to access:
// - All 🌶️ L3 experimental factors
// - Advanced parameter controls (lookback/threshold/weight decay)
// - Academic factor citations
// - Raw data export
//
// Design:
// - Toggle button in header: "🌶️ 专业模式 OFF/ON"
// - ON click → confirmation modal ("这些因子含复杂算法")
// - Pro mode indicator: subtle purple accent on all factor cards
// - Advanced parameter panel with academic citations
// - localStorage persistence

import React, { useState, useCallback, useEffect } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

interface ProModeSwitchProps {
  /** Is pro mode currently active */
  isProMode: boolean;
  /** Called when user toggles pro mode */
  onToggle: (enabled: boolean) => void;
  /** Show as a compact toggle (just the badge) */
  compact?: boolean;
  className?: string;
}

interface ProModeConfirmationProps {
  onConfirm: () => void;
  onCancel: () => void;
}

interface ProParamPanelProps {
  factorId: string;
  factorName: string;
  params: ProParam[];
  values: Record<string, number>;
  onChange: (paramId: string, value: number) => void;
  className?: string;
}

export interface ProParam {
  id: string;
  name: string;
  description: string;
  citation?: string;     // academic paper reference
  type: 'slider' | 'number' | 'select';
  min?: number;
  max?: number;
  step?: number;
  options?: { label: string; value: number }[];
  defaultValue: number;
}

const STORAGE_KEY = 'tradingeasy-pro-mode';

// ── Confirmation Modal ───────────────────────────────────────────────────────

const ProModeConfirmation: React.FC<ProModeConfirmationProps> = ({ onConfirm, onCancel }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
    <div className="bg-[#111118] border border-purple-500/20 rounded-2xl shadow-2xl w-[440px] max-w-[95vw] p-6">
      <div className="text-center mb-4">
        <span className="text-4xl">🌶️</span>
        <h2 className="text-lg font-bold text-white mt-2">启用专业模式</h2>
        <p className="text-xs text-gray-400 mt-1">解锁实验因子 + 高级参数面板</p>
      </div>

      <div className="space-y-3 mb-5">
        {[
          { icon: '🧪', title: '实验因子', desc: '访问所有🌶️ L3实验性因子（含学术引用和原始数据导出）' },
          { icon: '⚙️', title: '高级参数', desc: '调整因子回看窗口、阈值、权重衰减等底层参数' },
          { icon: '📚', title: '学术引用', desc: '查看因子来源的学术论文（Fama-French/AQR/Barra等）' },
          { icon: '⚠️', title: '风险提示', desc: '实验因子信号可能不稳定。建议搭配验证因子使用。' },
        ].map((item, i) => (
          <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg bg-white/[0.02]">
            <span className="text-lg flex-shrink-0">{item.icon}</span>
            <div>
              <h4 className="text-xs font-bold text-white">{item.title}</h4>
              <p className="text-[10px] text-gray-500">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <button onClick={onCancel} className="flex-1 py-2.5 rounded-lg border border-white/5 text-xs text-gray-400 hover:text-white transition-colors">
          暂不启用
        </button>
        <button onClick={onConfirm} className="flex-1 py-2.5 rounded-lg text-xs font-bold text-white transition-all"
          style={{ backgroundColor: '#a855f7', boxShadow: '0 0 20px rgba(168,85,247,0.2)' }}>
          🌶️ 启用专业模式
        </button>
      </div>
    </div>
  </div>
);

// ── Pro Parameter Panel ──────────────────────────────────────────────────────

const ProParamPanel: React.FC<ProParamPanelProps> = ({
  factorId, factorName, params, values, onChange, className = ''
}) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`rounded-lg border border-purple-500/15 bg-purple-500/[0.02] ${className}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs text-purple-400">🌶️</span>
          <span className="text-xs text-purple-300 font-bold">高级参数</span>
          <span className="text-[9px] text-purple-600 font-mono">{factorId}</span>
        </div>
        <span className="text-[9px] text-purple-600">{expanded ? '收起 ▲' : '展开 ▼'}</span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-3">
          {params.map(param => {
            const value = values[param.id] ?? param.defaultValue;
            return (
              <div key={param.id} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-400">{param.name}</span>
                  <span className="text-[10px] font-mono text-purple-400">{value}</span>
                </div>
                {param.type === 'slider' && (
                  <input type="range" min={param.min} max={param.max} step={param.step || 1}
                    value={value} onChange={e => onChange(param.id, Number(e.target.value))}
                    className="w-full h-1 accent-purple-500" />
                )}
                {param.type === 'number' && (
                  <input type="number" min={param.min} max={param.max} step={param.step || 1}
                    value={value} onChange={e => onChange(param.id, Number(e.target.value))}
                    className="w-full bg-white/[0.03] border border-white/5 rounded px-2 py-1 text-xs text-white" />
                )}
                {param.type === 'select' && param.options && (
                  <div className="flex gap-1 flex-wrap">
                    {param.options.map(opt => (
                      <button key={opt.value}
                        onClick={() => onChange(param.id, opt.value)}
                        className={`text-[9px] px-2 py-0.5 rounded transition-colors ${
                          value === opt.value
                            ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40'
                            : 'bg-white/[0.02] text-gray-500 border border-white/5 hover:border-white/10'
                        }`}>{opt.label}</button>))}
                  </div>
                )}
                <div className="flex justify-between text-[8px]">
                  <span className="text-gray-600">{param.description}</span>
                  {param.citation && (
                    <span className="text-purple-600 italic font-mono">{param.citation}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ── Custom hook ───────────────────────────────────────────────────────────────

export function useProMode(defaultValue = false): [boolean, (v: boolean) => void] {
  const [enabled, setEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved === 'true' || defaultValue;
    } catch { return defaultValue; }
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, String(enabled)); } catch {}
  }, [enabled]);

  return [enabled, setEnabled];
}

// ── Component ────────────────────────────────────────────────────────────────

export const ProModeSwitch: React.FC<ProModeSwitchProps> = ({
  isProMode, onToggle, compact = false, className = '',
}) => {
  const [showConfirm, setShowConfirm] = useState(false);

  const handleToggle = useCallback(() => {
    if (isProMode) {
      onToggle(false); // Turn off directly
    } else {
      setShowConfirm(true); // Show confirmation first
    }
  }, [isProMode, onToggle]);

  if (compact) {
    return (
      <>
        <button
          onClick={handleToggle}
          className={`text-[9px] px-2 py-1 rounded-full font-bold transition-all flex items-center gap-1 ${className}`}
          style={{
            backgroundColor: isProMode ? 'rgba(168,85,247,0.15)' : 'rgba(255,255,255,0.03)',
            color: isProMode ? '#c084fc' : '#6b7280',
            border: isProMode ? '1px solid rgba(168,85,247,0.4)' : '1px solid rgba(255,255,255,0.08)',
            boxShadow: isProMode ? '0 0 8px rgba(168,85,247,0.15)' : 'none',
          }}
        >
          🌶️ {isProMode ? '专业' : '标准'}
        </button>
        {showConfirm && <ProModeConfirmation onConfirm={() => { onToggle(true); setShowConfirm(false); }} onCancel={() => setShowConfirm(false)} />}
      </>
    );
  }

  return (
    <>
      <div className={`flex items-center gap-3 ${className}`}>
        <button
          onClick={handleToggle}
          className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
            isProMode ? 'bg-purple-500/15 border border-purple-500/30' : 'bg-white/[0.03] border border-white/5'
          }`}
          style={{ color: isProMode ? '#c084fc' : '#6b7280', boxShadow: isProMode ? '0 0 12px rgba(168,85,247,0.1)' : 'none' }}
        >
          <span>🌶️</span>
          <span>{isProMode ? '专业模式' : '标准模式'}</span>
          <span className={`w-1.5 h-1.5 rounded-full ${isProMode ? 'bg-purple-400 animate-pulse' : 'bg-gray-600'}`} />
        </button>
        {isProMode && (
          <span className="text-[9px] text-purple-400/60">实验因子+高级参数已解锁</span>
        )}
      </div>
      {showConfirm && <ProModeConfirmation onConfirm={() => { onToggle(true); setShowConfirm(false); }} onCancel={() => setShowConfirm(false)} />}
    </>
  );
};

export { ProParamPanel };
export default ProModeSwitch;
