// ── DAWN WHALES — PriceAlertPanel (价格告警面板) ───────────────────────────

import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next';

interface PriceAlert {
  id: string;
  symbol: string;
  targetPrice: number;
  condition: 'above' | 'below';
  createdAt: number;
  triggered?: boolean;
  triggeredAt?: number;
}

export default function PriceAlertPanel() {
  const { t } = useTranslation();

  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [symbol, setSymbol] = useState('');
  const [price, setPrice] = useState('');
  const [condition, setCondition] = useState<'above' | 'below'>('above');

  // Load from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('dawn-whales-alerts');
      if (saved) setAlerts(JSON.parse(saved));
    } catch (e) { console.error('[Error:PriceAlertPanel]', e); }
  }, []);

  // Save to localStorage
  useEffect(() => {
    if (alerts.length > 0) {
      localStorage.setItem('dawn-whales-alerts', JSON.stringify(alerts));
    }
  }, [alerts]);

  const addAlert = useCallback(() => {
    if (!symbol || !price) return;
    const newAlert: PriceAlert = {
      id: `alert-${Date.now()}`,
      symbol: symbol.toUpperCase(),
      targetPrice: parseFloat(price),
      condition,
      createdAt: Date.now(),
    };
    setAlerts((prev) => [newAlert, ...prev]);
    setSymbol('');
    setPrice('');
  }, [symbol, price, condition]);

  const removeAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const activeAlerts = alerts.filter((a) => !a.triggered);
  const triggeredAlerts = alerts.filter((a) => a.triggered);

  return (
    <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-white font-semibold text-sm">🔔 价格告警</h2>
          <p className="text-gray-500 text-[10px] mt-0.5">
            {activeAlerts.length} 个监控中 · {triggeredAlerts.length} 个已触发
          </p>
        </div>
      </div>

      {/* Add Alert */}
      <div className="flex items-center gap-2 mb-4">
        <input
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          placeholder={t("components.code")}
          className="flex-1 bg-[#12121a] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:border-[#C9A046] focus:outline-none"
        />
        <select
          value={condition}
          onChange={(e) => setCondition(e.target.value as any)}
          className="bg-[#12121a] border border-white/10 rounded-lg px-2 py-2 text-xs text-white"
        >
          <option value="above">≥</option>
          <option value="below">≤</option>
        </select>
        <input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          type="number"
          step="0.01"
          placeholder={t("components.price")}
          className="w-24 bg-[#12121a] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:border-[#C9A046] focus:outline-none"
        />
        <button
          onClick={addAlert}
          disabled={!symbol || !price}
          className="px-3 py-2 bg-[#C9A046]/10 text-[#D4A853] border border-[#C9A046]/20 rounded-lg text-xs font-medium hover:bg-[#C9A046]/20 transition-colors disabled:opacity-30"
        >
          添加
        </button>
      </div>

      {/* Active Alerts */}
      {activeAlerts.length === 0 ? (
        <p className="text-gray-500 text-xs text-center py-3">暂无监控中的告警</p>
      ) : (
        <div className="space-y-1 mb-3">
          {activeAlerts.map((alert) => (
            <div
              key={alert.id}
              className="flex items-center justify-between bg-[#12121a] rounded-lg px-3 py-2 border border-white/5"
            >
              <div className="flex items-center gap-2">
                <span className="text-white text-xs font-medium">{alert.symbol}</span>
                <span className="text-[10px] text-gray-500">
                  {alert.condition === 'above' ? '≥' : '≤'} ${alert.targetPrice.toFixed(2)}
                </span>
              </div>
              <button
                onClick={() => removeAlert(alert.id)}
                className="text-[10px] text-gray-600 hover:text-red-400 transition-colors"
              >
                删除
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Triggered Alerts */}
      {triggeredAlerts.length > 0 && (
        <div className="pt-2 border-t border-white/5">
          <div className="text-[10px] text-gray-500 mb-1">已触发</div>
          <div className="space-y-1">
            {triggeredAlerts.slice(0, 3).map((alert) => (
              <div
                key={alert.id}
                className="flex items-center justify-between bg-red-500/5 rounded-lg px-3 py-2 border border-red-500/10 opacity-60"
              >
                <div className="flex items-center gap-2">
                  <span className="text-red-400 text-xs font-medium">{alert.symbol}</span>
                  <span className="text-[10px] text-red-400">
                    {alert.condition === 'above' ? '≥' : '≤'} ${alert.targetPrice.toFixed(2)}
                  </span>
                </div>
                <button
                  onClick={() => removeAlert(alert.id)}
                  className="text-[10px] text-gray-600 hover:text-red-400"
                >
                  清除
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
