import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface TradeAlert {
  id: string;
  type: 'price' | 'volume' | 'pnl';
  symbol: string;
  message: string;
  triggeredAt: string;
  read: boolean;
}

export default function TradeAlertPanel() {
  const { t } = useTranslation();
  const [alerts, setAlerts] = useState<TradeAlert[]>([]);

  useEffect(() => {
    // Listen for real-time alerts from main process
    if (typeof window !== 'undefined' && window.api?.on) {
      window.api.on('trade-alert', (data: any) => {
        setAlerts((prev) => [{
          id: data?.id || String(Date.now()),
          type: data?.type || 'price',
          symbol: data?.symbol || '',
          message: data?.message || '',
          triggeredAt: new Date().toISOString(),
          read: false,
        }, ...prev].slice(0, 50));
      });
    }
  }, []);

  function markRead(id: string) {
    setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, read: true } : a));
  }

  function clearAll() {
    setAlerts([]);
  }

  const typeIcon: Record<string, string> = {
    price: '💰',
    volume: '📊',
    pnl: '📈',
  };

  return (
    <div className="bg-[#1a1a25] border border-white/5 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
        <h3 className="text-sm font-medium text-white">{t('trading.alerts')}</h3>
        {alerts.length > 0 && (
          <button onClick={clearAll} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
            {t('common.clear')}
          </button>
        )}
      </div>

      {alerts.length === 0 ? (
        <div className="p-6 text-center text-gray-500 text-sm">{t('trading.noAlerts')}</div>
      ) : (
        <div className="max-h-80 overflow-auto">
          {alerts.map((a) => (
            <div
              key={a.id}
              onClick={() => markRead(a.id)}
              className={`px-4 py-2.5 border-b border-white/5 hover:bg-white/[0.02] transition-colors cursor-pointer ${a.read ? 'opacity-50' : ''}`}
            >
              <div className="flex items-start gap-2">
                <span className="text-sm">{typeIcon[a.type] || '🔔'}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-white truncate">{a.symbol} {a.message}</div>
                  <div className="text-[10px] text-gray-500">{new Date(a.triggeredAt).toLocaleTimeString()}</div>
                </div>
                {!a.read && <div className="w-2 h-2 rounded-full bg-[#C9A046] mt-1" />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
