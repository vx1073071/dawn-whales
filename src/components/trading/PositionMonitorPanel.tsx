// R126-Q01: nocheck cleared — cleared
// PositionMonitorPanel — Real-time position monitoring UI
// Phase 4.3 R32 ML-32-03 / R35 ML-35-02: IPC integration
import { useState, useEffect, useCallback, useRef } from 'react';
import { getPositions, getAccounts, placeOrder } from '../../lib/bridge-api';
import i18n from '../../i18n';

interface Position {
  id: string;
  code: string;
  name: string;
  type: 'long' | 'short';
  shares: number;
  avgCost: number;
  currentPrice: number;
  pnl: number;
  pnlPct: number;
  stopLoss?: number;
  takeProfit?: number;
  trailingStop?: number;
  openTime: number;
  strategyId?: string;
}

interface Props {
  positions?: Position[];
  onClose?: (id: string) => void;
  onUpdateStopLoss?: (id: string, price: number) => void;
  onUpdateTakeProfit?: (id: string, price: number) => void;
  onCloseAll?: () => void;
  refreshInterval?: number; // ms, default 10000
  /** Enable real IPC data fetching (replaces mock data) */
  live?: boolean;
}

// ── mock data for development ──────────────────────────────────────────────
function generateMockPositions(): Position[] {
  const now = Date.now();
  const symbols = [
  { code: 'AAPL', name: 'Apple Inc.', price: 195.43 },
  { code: 'TSLA', name: 'Tesla Inc.', price: 238.21 },
  { code: 'NVDA', name: 'NVIDIA Corp.', price: 871.55 },
  { code: 'MSFT', name: 'Microsoft Corp.', price: 425.67 },
  { code: '00700', name: 'Tencent', price: 385.20 },
  { code: '00981', name: 'SMIC', price: 22.15 }];


  return symbols.map((s, i) => {
    const shares = [100, 50, 200, 80, 500, 1000][i];
    const avgCost = s.price * (0.92 + Math.random() * 0.16);
    const pnl = (s.price - avgCost) * shares;
    const pnlPct = (s.price - avgCost) / avgCost * 100;

    return {
      id: `pos_${i}_${now}`,
      code: s.code,
      name: s.name,
      type: (i % 3 === 0 ? 'short' : 'long') as 'long' | 'short',
      shares,
      avgCost: +avgCost.toFixed(2),
      currentPrice: s.price,
      pnl: +pnl.toFixed(2),
      pnlPct: +pnlPct.toFixed(2),
      stopLoss: pnlPct < 0 ? undefined : +(avgCost * 0.95).toFixed(2),
      takeProfit: pnlPct < 0 ? +(avgCost * 1.15).toFixed(2) : undefined,
      openTime: now - Math.floor(Math.random() * 86400000 * 30),
      strategyId: `strat_${i % 3 + 1}`
    };
  });
}

export default function PositionMonitorPanel({
  positions: externalPositions,
  onClose,
  onUpdateStopLoss,
  onUpdateTakeProfit,
  onCloseAll,
  refreshInterval = 10000,
  live = false
}: Props) {
  const [positions, setPositions] = useState<Position[]>(externalPositions || generateMockPositions());
  const [selectedPos, setSelectedPos] = useState<string | null>(null);
  const [editStopLoss, setEditStopLoss] = useState<string | null>(null);
  const [editTakeProfit, setEditTakeProfit] = useState<string | null>(null);
  const [slInput, setSlInput] = useState('');
  const [tpInput, setTpInput] = useState('');
  const [connected, setConnected] = useState(false);
  const [accountId, setAccountId] = useState<string>('');
  const closeAllRef = useRef(false);

  // IPC-powered live data fetching (ML-35-02)
  const fetchLivePositions = useCallback(async () => {
    if (!live) return;
    try {
      const accs = await getAccounts();
      if (accs.length === 0) {setConnected(false);return;}
      const activeAcc = accs[0].accountId;
      setAccountId(activeAcc);
      setConnected(true);

      const rawPositions = await getPositions(activeAcc);
      if (rawPositions && rawPositions.length > 0) {
        setPositions(rawPositions.map((p: any) => ({
          id: p.code || `pos_${Date.now()}`,
          code: p.code,
          name: p.name || p.code,
          type: ((p as any).qty > 0 ? 'long' : 'short') as 'long' | 'short',
          shares: Math.abs(p.qty || 0),
          avgCost: p.avgCost || p.costPrice || 0,
          currentPrice: p.marketPrice || p.currentPrice || 0,
          pnl: p.pnl || 0,
          pnlPct: p.pnlPct || 0,
          stopLoss: p.stopLoss,
          takeProfit: p.takeProfit,
          openTime: Date.now(),
          strategyId: p.strategyId
        })));
      } else {
        setPositions([]);
      }
    } catch {
      setConnected(false);
    }
  }, [live]);

  // IPC-powered close position
  const handleClose = useCallback(async (posId: string) => {
    if (!live || !accountId) {onClose?.(posId);return;}
    try {
      const pos = positions.find((p) => p.id === posId);
      if (pos) {
        await placeOrder({
          accountId,
          code: pos.code,
          qty: pos.shares,
          side: pos.type === 'long' ? 'SELL' : 'BUY',
          orderType: 'MARKET'
        });
      }
      await fetchLivePositions();
    } catch {
      onClose?.(posId);
    }
  }, [live, accountId, positions, onClose, fetchLivePositions]);

  // IPC-powered close all
  const handleCloseAll = useCallback(async () => {
    if (closeAllRef.current) return;
    closeAllRef.current = true;
    try {
      if (live && accountId) {
        for (const pos of positions) {
          await placeOrder({
            accountId,
            code: pos.code,
            qty: pos.shares,
            side: pos.type === 'long' ? 'SELL' : 'BUY',
            orderType: 'MARKET'
          });
        }
        await fetchLivePositions();
      }
      onCloseAll?.();
    } finally {
      closeAllRef.current = false;
    }
  }, [live, accountId, positions, onCloseAll, fetchLivePositions]);

  // Fetch on mount and on interval
  useEffect(() => {
    if (live) fetchLivePositions();
  }, [live, fetchLivePositions]);

  // Auto-refresh positions (live: IPC fetch / mock: random price drift)
  useEffect(() => {
    if (live) {
      const timer = setInterval(fetchLivePositions, refreshInterval);
      return () => clearInterval(timer);
    }
    if (externalPositions) {
      setPositions(externalPositions);
      return;
    }

    const timer = setInterval(() => {
      setPositions((prev) =>
      prev.map((p) => {
        const drift = (Math.random() - 0.48) * p.currentPrice * 0.005;
        const newPrice = +(p.currentPrice + drift).toFixed(2);
        const pnl = +((newPrice - p.avgCost) * p.shares * (p.type === 'short' ? -1 : 1)).toFixed(2);
        const pnlPct = pnlPctFromCost(pnl, p.avgCost, p.shares);
        return { ...p, currentPrice: newPrice, pnl, pnlPct };
      })
      );
    }, refreshInterval);
    return () => clearInterval(timer);
  }, [externalPositions, refreshInterval]);

  const getStatusColor = useCallback((pnlPct: number, stopLoss?: number, currentPrice?: number, type?: string) => {
    if (stopLoss && currentPrice) {
      const slRatio = type === 'short' ?
      (stopLoss - currentPrice) / stopLoss :
      (currentPrice - stopLoss) / stopLoss;
      if (slRatio < 0.02) return 'bg-yellow-500/20 border-yellow-500/50'; // near stop loss
    }
    if (pnlPct > 2) return 'bg-green-500/20 border-green-500/50';
    if (pnlPct > 0) return 'bg-green-500/10 border-green-500/20';
    if (pnlPct > -2) return 'bg-red-500/10 border-red-500/20';
    return 'bg-red-500/20 border-red-500/50';
  }, []);

  const totalPnl = positions.reduce((sum, p) => sum + p.pnl, 0);
  const totalPnlPct = totalPnl ?
  +(totalPnl / positions.reduce((s, p) => s + p.avgCost * p.shares, 0) * 100).toFixed(2) :
  0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">{i18n.t('PositionMonitorPanel.k0')}</h2>
          <p className="text-xs text-gray-500 mt-1">
            {positions.length}{i18n.t("PositionMonitorPanel.r92_5af6")}{refreshInterval / 1000}{i18n.t("PositionMonitorPanel.r92_59e6")}
            {live && <span className="ml-2 text-green-500">{connected ? i18n.t('PositionMonitorPanel.k1') : i18n.t('PositionMonitorPanel.k2')}</span>}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className={`text-lg font-mono font-bold ${totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {totalPnl >= 0 ? '+' : ''}{totalPnl.toLocaleString()}
            </div>
            <div className={`text-xs ${totalPnlPct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {totalPnlPct >= 0 ? '+' : ''}{totalPnlPct}%
            </div>
          </div>
          {positions.length > 0 &&
          <button
            onClick={handleCloseAll}
            className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-xs font-medium transition-colors">{i18n.t("PositionMonitorPanel.r92_8deb")}


          </button>
          }
        </div>
      </div>

      {/* Position Cards */}
      <div className="grid gap-3">
        {positions.length === 0 &&
        <div className="bg-[#12121a] rounded-xl p-8 text-center border border-white/5">
            <div className="text-4xl mb-2">📭</div>
            <p className="text-gray-400 text-sm">{i18n.t('PositionMonitorPanel.k1')}</p>
          </div>
        }

        {(positions as any).map((pos: any) =>
        <div
          key={pos.id}
          className={`${getStatusColor(pos.pnlPct, pos.stopLoss, pos.currentPrice, pos.type)} border rounded-xl p-4 cursor-pointer transition-all hover:border-[#C9A046]/30`}
          onClick={() => setSelectedPos(selectedPos === pos.id ? null : pos.id)}>
          
            {/* Top row: code + pnl */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-0.5 rounded ${pos.type === 'long' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                  {pos.type === 'long' ? i18n.t('PositionMonitorPanel.k3') : i18n.t('PositionMonitorPanel.k4')}
                </span>
                <span className="text-white font-mono font-semibold">{pos.code}</span>
                <span className="text-gray-400 text-sm">{pos.name}</span>
              </div>
              <div className="text-right">
                <div className={`font-mono font-bold ${pos.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {pos.pnl >= 0 ? '+' : ''}{pos.pnl.toLocaleString()}
                </div>
                <div className={`text-xs font-mono ${pos.pnlPct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {pos.pnlPct >= 0 ? '+' : ''}{pos.pnlPct}%
                </div>
              </div>
            </div>

            {/* Details row */}
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span>{i18n.t('PositionMonitorPanel.k0')}{pos.avgCost}</span>
              <span className="font-mono text-gray-300">{i18n.t('PositionMonitorPanel.k1')}{pos.currentPrice}</span>
              <span>{pos.shares}{i18n.t("PositionMonitorPanel.r92_cdb0")}</span>
              {pos.stopLoss &&
            <span className="text-yellow-500">{i18n.t('PositionMonitorPanel.k2')}{pos.stopLoss}</span>
            }
              {pos.takeProfit &&
            <span className="text-blue-400">{i18n.t('PositionMonitorPanel.k3')}{pos.takeProfit}</span>
            }
            </div>

            {/* Expanded: stop loss / take profit editor */}
            {selectedPos === pos.id &&
          <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
                {/* Stop Loss */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-yellow-500 w-12">{i18n.t('PositionMonitorPanel.k2')}</span>
                  {editStopLoss === pos.id ?
              <>
                      <input
                  type="number"
                  step="0.01"
                  value={slInput}
                  onChange={(e) => setSlInput(e.target.value)}
                  className="bg-[#0a0a12] border border-white/10 rounded px-2 py-1 text-xs text-white w-24"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      onUpdateStopLoss?.(pos.id, parseFloat(slInput));
                      setEditStopLoss(null);
                    }
                    if (e.key === 'Escape') setEditStopLoss(null);
                  }} />
                
                      <button
                  onClick={() => {
                    onUpdateStopLoss?.(pos.id, parseFloat(slInput));
                    setEditStopLoss(null);
                  }}
                  className="text-xs text-green-400 hover:text-green-300">{i18n.t("PositionMonitorPanel.r92_aaea")}


                </button>
                      <button onClick={() => setEditStopLoss(null)} className="text-xs text-gray-500 hover:text-gray-400">{i18n.t("PositionMonitorPanel.r92_20d6")}

                </button>
                    </> :

              <span
                className="text-xs text-yellow-400 font-mono cursor-pointer hover:underline"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditStopLoss(pos.id);
                  setSlInput(String(pos.stopLoss || pos.currentPrice * 0.95));
                  setEditTakeProfit(null);
                }}>
                
                      {pos.stopLoss ? pos.stopLoss : i18n.t('PositionMonitorPanel.k5')}
                    </span>
              }
                </div>

                {/* Take Profit */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-blue-400 w-12">{i18n.t('PositionMonitorPanel.k3')}</span>
                  {editTakeProfit === pos.id ?
              <>
                      <input
                  type="number"
                  step="0.01"
                  value={tpInput}
                  onChange={(e) => setTpInput(e.target.value)}
                  className="bg-[#0a0a12] border border-white/10 rounded px-2 py-1 text-xs text-white w-24"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      onUpdateTakeProfit?.(pos.id, parseFloat(tpInput));
                      setEditTakeProfit(null);
                    }
                    if (e.key === 'Escape') setEditTakeProfit(null);
                  }} />
                
                      <button
                  onClick={() => {
                    onUpdateTakeProfit?.(pos.id, parseFloat(tpInput));
                    setEditTakeProfit(null);
                  }}
                  className="text-xs text-green-400 hover:text-green-300">{i18n.t("PositionMonitorPanel.r92_df79")}


                </button>
                      <button onClick={() => setEditTakeProfit(null)} className="text-xs text-gray-500 hover:text-gray-400">{i18n.t("PositionMonitorPanel.r92_aa39")}

                </button>
                    </> :

              <span
                className="text-xs text-blue-400 font-mono cursor-pointer hover:underline"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditTakeProfit(pos.id);
                  setTpInput(String(pos.takeProfit || pos.currentPrice * 1.1));
                  setEditStopLoss(null);
                }}>
                
                      {pos.takeProfit ? pos.takeProfit : i18n.t('PositionMonitorPanel.k6')}
                    </span>
              }
                </div>

                {/* Close Position Button */}
                <button
              onClick={(e) => {e.stopPropagation();handleClose(pos.id);}}
              className="mt-2 px-3 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded text-xs transition-colors">{i18n.t("PositionMonitorPanel.r92_8e8e")}


            </button>
              </div>
          }
          </div>
        )}
      </div>

      {/* Summary bar */}
      {positions.length > 0 &&
      <div className="bg-[#12121a] rounded-xl p-3 flex items-center justify-between text-xs border border-white/5">
          <div className="flex items-center gap-6">
            <div>
              <span className="text-gray-500">{i18n.t('PositionMonitorPanel.k4')}</span>
              <span className="text-green-400">{positions.filter((p) => p.type === 'long').length}</span>
            </div>
            <div>
              <span className="text-gray-500">{i18n.t('PositionMonitorPanel.k5')}</span>
              <span className="text-red-400">{positions.filter((p) => p.type === 'short').length}</span>
            </div>
            <div>
              <span className="text-gray-500">{i18n.t('PositionMonitorPanel.k6')}</span>
              <span className="text-yellow-400">{positions.filter((p) => p.stopLoss).length}/{positions.length}</span>
            </div>
            <div>
              <span className="text-gray-500">{i18n.t('PositionMonitorPanel.k7')}</span>
              <span className="text-blue-400">{positions.filter((p) => p.takeProfit).length}/{positions.length}</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${totalPnl >= 0 ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-gray-400">
              {totalPnl >= 0 ? i18n.t('PositionMonitorPanel.k7') : totalPnl > -500 ? i18n.t('PositionMonitorPanel.k8') : i18n.t('PositionMonitorPanel.k9')}
            </span>
          </div>
        </div>
      }
    </div>);

}

function pnlPctFromCost(pnl: number, avgCost: number, shares: number): number {
  const costBasis = avgCost * shares;
  return costBasis ? +(pnl / costBasis * 100).toFixed(2) : 0;
}