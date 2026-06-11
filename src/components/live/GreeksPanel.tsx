import { useState, useCallback } from 'react';
import { EngineError } from '../../../electron/engine/core/engine-error';

import * as api from '../../lib/bridge-api';
import { useTranslation } from "react-i18next";
import i18n from '../../i18n';

interface GreeksResult {
  price: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
  iv?: number;
}

interface GreeksInput {
  spot: number;
  strike: number;
  vol: number;
  days: number;
  rate: number;
  type: 'CALL' | 'PUT';
}

export default function GreeksPanel() {
  const { t } = useTranslation();

  const [input, setInput] = useState<GreeksInput>({
    spot: 8500,
    strike: 8500,
    vol: 0.22,
    days: 30,
    rate: 0.05,
    type: 'CALL'
  });
  const [result, setResult] = useState<GreeksResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const calculate = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.calculateGreeks(input);
      if (res?.success && res.greeks) {
        setResult(res.greeks);
      } else {
        setError(res?.error || i18n.t('GreeksPanel.k1'));
      }
    } catch (e: unknown) {
      void EngineError; // [SYSTEM] structured error tracking
      setError((e as any).message || i18n.t('GreeksPanel.k2'));
    } finally {
      setLoading(false);
    }
  }, [input]);

  const greeksItems = result ? [
  { label: t('components.price'), key: 'price', format: (v: number) => v.toFixed(3) },
  { label: 'Delta', key: 'delta', format: (v: number) => v.toFixed(4) },
  { label: 'Gamma', key: 'gamma', format: (v: number) => v.toFixed(4) },
  { label: 'Theta', key: 'theta', format: (v: number) => v.toFixed(4) },
  { label: 'Vega', key: 'vega', format: (v: number) => v.toFixed(4) },
  { label: 'Rho', key: 'rho', format: (v: number) => v.toFixed(4) }] :
  [];

  return (
    <div className="p-4 bg-[#12121a] rounded-xl border border-white/5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-white">{i18n.t("GreeksPanel.r92_048f")}</h3>
        <span className="text-[10px] text-gray-600">{i18n.t("GreeksPanel.r92_ed49")}</span>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div>
          <label className="text-[10px] text-gray-500 block mb-1">{i18n.t('GreeksPanel.k0')}</label>
          <input
            type="number"
            value={input.spot}
            onChange={(e) => setInput({ ...input, spot: +e.target.value })}
            className="w-full px-2 py-1 bg-[#1a1a25] border border-white/10 rounded text-xs text-white focus:outline-none focus:border-amber-500/50" />
          
        </div>
        <div>
          <label className="text-[10px] text-gray-500 block mb-1">{i18n.t('GreeksPanel.k1')}</label>
          <input
            type="number"
            value={input.strike}
            onChange={(e) => setInput({ ...input, strike: +e.target.value })}
            className="w-full px-2 py-1 bg-[#1a1a25] border border-white/10 rounded text-xs text-white focus:outline-none focus:border-amber-500/50" />
          
        </div>
        <div>
          <label className="text-[10px] text-gray-500 block mb-1">{t("components.volatility")}</label>
          <input
            type="number"
            step="0.01"
            value={input.vol}
            onChange={(e) => setInput({ ...input, vol: +e.target.value })}
            className="w-full px-2 py-1 bg-[#1a1a25] border border-white/10 rounded text-xs text-white focus:outline-none focus:border-amber-500/50" />
          
        </div>
        <div>
          <label className="text-[10px] text-gray-500 block mb-1">{i18n.t('GreeksPanel.k2')}</label>
          <input
            type="number"
            value={input.days}
            onChange={(e) => setInput({ ...input, days: +e.target.value })}
            className="w-full px-2 py-1 bg-[#1a1a25] border border-white/10 rounded text-xs text-white focus:outline-none focus:border-amber-500/50" />
          
        </div>
        <div>
          <label className="text-[10px] text-gray-500 block mb-1">{i18n.t('GreeksPanel.k3')}</label>
          <input
            type="number"
            step="0.01"
            value={input.rate}
            onChange={(e) => setInput({ ...input, rate: +e.target.value })}
            className="w-full px-2 py-1 bg-[#1a1a25] border border-white/10 rounded text-xs text-white focus:outline-none focus:border-amber-500/50" />
          
        </div>
        <div>
          <label className="text-[10px] text-gray-500 block mb-1">{t("components.type")}</label>
          <select
            value={input.type}
            onChange={(e) => setInput({ ...input, type: e.target.value as 'CALL' | 'PUT' })}
            className="w-full px-2 py-1 bg-[#1a1a25] border border-white/10 rounded text-xs text-white focus:outline-none focus:border-amber-500/50">
            
            <option value="CALL">CALL</option>
            <option value="PUT">PUT</option>
          </select>
        </div>
      </div>

      <button
        onClick={calculate}
        disabled={loading}
        className="w-full py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-400 hover:bg-amber-500/20 disabled:opacity-50 mb-3">
        
        {loading ? i18n.t('GreeksPanel.k3') : i18n.t('GreeksPanel.k4')}
      </button>

      {error &&
      <div className="text-xs text-red-400 mb-2">{error}</div>
      }

      {result &&
      <div className="grid grid-cols-3 gap-2">
          {greeksItems.map((item) =>
        <div key={item.key} className="p-2 bg-white/[0.03] rounded-lg text-center">
              <div className="text-[10px] text-gray-500 mb-1">{item.label}</div>
              <div className="text-sm font-bold font-mono text-white">
                {item.format(result[item.key as keyof GreeksResult] as number)}
              </div>
            </div>
        )}
        </div>
      }
    </div>);

}