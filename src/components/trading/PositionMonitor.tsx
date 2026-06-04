import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getAccounts, getPositions } from '@/lib/bridge-api';

interface Position {
  code: string;
  name?: string;
  qty: number;
  marketPrice: number;
  marketValue: number;
  pnl: number;
  pnlPct: number;
}

export default function PositionMonitor() {
  const { t } = useTranslation();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPositions();
    const interval = setInterval(loadPositions, 10000);
    return () => clearInterval(interval);
  }, []);

  async function loadPositions() {
    setLoading(true);
    setError(null);
    try {
      const accs = await getAccounts();
      if (!accs || accs.length === 0) { setLoading(false); return; }
      const pos = await getPositions(accs[0].accountId || accs[0].accId);
      setPositions(pos?.map((p: any) => ({
        code: p.code,
        name: p.name || p.code,
        qty: p.qty || 0,
        marketPrice: p.marketPrice || 0,
        marketValue: p.marketValue || 0,
        pnl: p.pnl || 0,
        pnlPct: p.pnlPct || 0,
      })) || []);
    } catch (e: any) {
      setError(e?.message || t('common.loadingFailed'));
    } finally {
      setLoading(false);
    }
  }

  const totalMV = positions.reduce((s, p) => s + p.marketValue, 0);
  const totalPnl = positions.reduce((s, p) => s + p.pnl, 0);
  const color = (n: number) => n >= 0 ? 'text-emerald-400' : 'text-red-400';

  return (
    <div className="bg-[#1a1a25] border border-white/5 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
        <h3 className="text-sm font-medium text-white">{t('trading.positions')}</h3>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium ${color(totalPnl)}`}>
            {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(0)}
          </span>
          <button onClick={loadPositions} disabled={loading} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
            {loading ? '...' : '⟳'}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 text-red-400 text-xs">{error}</div>
      )}

      {positions.length === 0 && !loading && !error ? (
        <div className="p-6 text-center text-gray-500 text-sm">{t('portfolio.noPositions')}</div>
      ) : (
        <div className="max-h-80 overflow-auto">
          {positions.map((p) => (
            <div key={p.code} className="px-4 py-2.5 border-b border-white/5 hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-white font-medium">{p.code.split('.')[1] || p.code}</div>
                  <div className="text-xs text-gray-500">{p.qty}股 · ${p.marketPrice.toFixed(2)}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-white">${(p.marketValue / 10000).toFixed(1)}万</div>
                  <div className={`text-xs ${color(p.pnl)}`}>
                    {p.pnl >= 0 ? '+' : ''}{p.pnl.toFixed(0)} ({p.pnlPct >= 0 ? '+' : ''}{p.pnlPct.toFixed(2)}%)
                  </div>
                </div>
              </div>
              <div className="mt-1 h-1 bg-[#12121a] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#C9A046] rounded-full"
                  style={{ width: `${totalMV > 0 ? (p.marketValue / totalMV) * 100 : 0}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
