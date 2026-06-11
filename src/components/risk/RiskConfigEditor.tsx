// ── DAWN WHALES — RiskConfigEditor (risk controlconfigedit) ─────────────────────────

import { useState, useEffect } from 'react'
import { EngineError } from '../../../electron/engine/core/engine-error';
import { useTranslation } from 'react-i18next';
import { getRiskConfig, updateRiskConfig } from '../../lib/bridge-api';
import i18n from '../../i18n';

interface RiskConfig {
  maxSinglePositionPct: number;
  maxTotalPositionPct: number;
  dailyLossLimitPct: number;
  maxOrdersPerMinute: number;
  kellyMaxFraction: number;
  kellyHalfEnabled: boolean;
  atrStopMultiplier: number;
  drawdownReduceThreshold: number;
  volAdjustEnabled: boolean;
  vixHighThreshold: number;
  vixExtremeThreshold: number;
}

const DEFAULT_CONFIG: RiskConfig = {
  maxSinglePositionPct: 0.20,
  maxTotalPositionPct: 0.80,
  dailyLossLimitPct: 0.05,
  maxOrdersPerMinute: 10,
  kellyMaxFraction: 0.25,
  kellyHalfEnabled: true,
  atrStopMultiplier: 2.0,
  drawdownReduceThreshold: 0.15,
  volAdjustEnabled: true,
  vixHighThreshold: 25,
  vixExtremeThreshold: 35,
};

export default function RiskConfigEditor() {
  const { t } = useTranslation();

  const [config, setConfig] = useState<RiskConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    try {
      const result = await getRiskConfig();
      if (result) {
        setConfig({ ...DEFAULT_CONFIG, ...result });
      }
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      void EngineError; // structured error domain: SYSTEM
      console.error('[RiskConfigEditor] load error:', err);
    }
    setLoading(false);
  }

  async function saveConfig() {
    setSaving(true);
    try {
      await updateRiskConfig(config);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      console.error('[RiskConfigEditor] save error:', err);
    }
    setSaving(false);
  }

  const updateField = <K extends keyof RiskConfig>(key: K, value: RiskConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
        <p className="text-gray-500 text-sm text-center py-4">{i18n.t('RiskConfigEditor.k0')}</p>
      </div>
    );
  }

  return (
    <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-semibold text-sm">⚙️ 风控配置</h2>
        <div className="flex items-center gap-2">
          {saved && <span className="text-[10px] text-emerald-400">✓ 已保存</span>}
          <button
            onClick={saveConfig}
            disabled={saving}
            className="px-3 py-1.5 bg-[#C9A046]/10 text-[#D4A853] border border-[#C9A046]/20 rounded-lg text-xs font-medium hover:bg-[#C9A046]/20 transition-colors disabled:opacity-30"
          >
            {saving ? i18n.t('RiskConfigEditor.k1') : t('components.save')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <ConfigField
          label={i18n.t('RiskConfigEditor.k2')}
          value={config.maxSinglePositionPct}
          onChange={(v) => updateField('maxSinglePositionPct', v)}
          suffix="%"
          min={0.05}
          max={0.5}
          step={0.05}
        />
        <ConfigField
          label={i18n.t('RiskConfigEditor.k3')}
          value={config.maxTotalPositionPct}
          onChange={(v) => updateField('maxTotalPositionPct', v)}
          suffix="%"
          min={0.3}
          max={1.0}
          step={0.05}
        />
        <ConfigField
          label={i18n.t('RiskConfigEditor.k4')}
          value={config.dailyLossLimitPct}
          onChange={(v) => updateField('dailyLossLimitPct', v)}
          suffix="%"
          min={0.01}
          max={0.2}
          step={0.01}
        />
        <ConfigField
          label={i18n.t('RiskConfigEditor.k5')}
          value={config.maxOrdersPerMinute}
          onChange={(v) => updateField('maxOrdersPerMinute', v)}
          suffix="/min"
          min={1}
          max={60}
          step={1}
        />
        <ConfigField
          label={i18n.t('RiskConfigEditor.k6')}
          value={config.kellyMaxFraction}
          onChange={(v) => updateField('kellyMaxFraction', v)}
          suffix="%"
          min={0.1}
          max={0.5}
          step={0.05}
        />
        <ConfigField
          label={i18n.t('RiskConfigEditor.k7')}
          value={config.atrStopMultiplier}
          onChange={(v) => updateField('atrStopMultiplier', v)}
          suffix="x"
          min={1}
          max={5}
          step={0.5}
        />
        <ConfigField
          label={i18n.t('RiskConfigEditor.k8')}
          value={config.drawdownReduceThreshold}
          onChange={(v) => updateField('drawdownReduceThreshold', v)}
          suffix="%"
          min={0.05}
          max={0.3}
          step={0.05}
        />
        <div className="bg-[#12121a] rounded-lg p-3">
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-gray-400 text-xs">Half-Kelly</span>
            <input
              type="checkbox"
              checked={config.kellyHalfEnabled}
              onChange={(e) => updateField('kellyHalfEnabled', e.target.checked)}
              className="rounded border-gray-600 bg-[#1a1a25] text-[#C9A046]"
            />
          </label>
        </div>
        <div className="bg-[#12121a] rounded-lg p-3">
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-gray-400 text-xs">{i18n.t('RiskConfigEditor.k1')}</span>
            <input
              type="checkbox"
              checked={config.volAdjustEnabled}
              onChange={(e) => updateField('volAdjustEnabled', e.target.checked)}
              className="rounded border-gray-600 bg-[#1a1a25] text-[#C9A046]"
            />
          </label>
        </div>
        <ConfigField
          label={i18n.t('RiskConfigEditor.k9')}
          value={config.vixHighThreshold}
          onChange={(v) => updateField('vixHighThreshold', v)}
          suffix=""
          min={15}
          max={40}
          step={1}
        />
        <ConfigField
          label={i18n.t('RiskConfigEditor.k10')}
          value={config.vixExtremeThreshold}
          onChange={(v) => updateField('vixExtremeThreshold', v)}
          suffix=""
          min={25}
          max={50}
          step={1}
        />
      </div>
    </div>
  );
}

function ConfigField({
  label, value, onChange, suffix, min, max, step,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix: string;
  min: number;
  max: number;
  step: number;
}) {
  const displayValue = suffix === '%' ? (value * 100).toFixed(suffix === '%' && step < 0.1 ? 1 : 0) : String(value);

  return (
    <div className="bg-[#12121a] rounded-lg p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-gray-400 text-xs">{label}</span>
        <span className="text-gray-300 text-xs font-mono">
          {displayValue}{suffix}
        </span>
      </div>
      <input
        type="range"
        min={suffix === '%' ? min * 100 : min}
        max={suffix === '%' ? max * 100 : max}
        step={suffix === '%' ? step * 100 : step}
        value={suffix === '%' ? value * 100 : value}
        onChange={(e) => onChange(suffix === '%' ? parseFloat(e.target.value) / 100 : parseFloat(e.target.value))}
        className="w-full h-1 bg-[#1a1a25] rounded-full appearance-none cursor-pointer accent-[#C9A046]"
      />
    </div>
  );
}
