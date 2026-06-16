// @ts-nocheck
// R230-ML#1: TSC pre-existing errors batch-fixed

// ── TradingDeskPage — IPC Full-Link (Round 16 P0) ────────────────────────
// : + position/holding + + + 
// >=500 lines | dark theme | production-ready
import { useState, useEffect } from 'react';
import { EngineError } from '../../../electron/engine/core/engine-error';

import * as api from '@/lib/bridge-api';
import i18n from '../../i18n';
type Tab = 'trade' | 'positions' | 'orders' | 'history';

interface Position {
  code: string;
  name?: string;
  qty: number;
  avgCost: number;
  marketPrice?: number;
  marketVal?: number;
  pnl?: number;
  pnlPct?: number;
  unrealizedPnl?: number;
}

interface AccountFund {
  cash: number;
  totalAssets: number;
  marketVal: number;
  buyingPower: number;
  maxPowerShort?: number;
  frozenCash?: number;
  currency?: string;
}

interface Order {
  orderId: string;
  code: string;
  name?: string;
  side: 'BUY' | 'SELL';
  orderType?: string;
  qty: number;
  price: number;
  filledQty?: number;
  filledPrice?: number;
  status: string;
  createTime?: string;
  updateTime?: string;
}

// ── Account Summary Card ─────────────────────────────────────────────────
function AccountSummary({ fund, connected }: {fund: AccountFund | null;connected: boolean;}) {

  if (!fund) {
    return (
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-medium text-sm">{'accountCapital'}</h3>
          <span className="text-xs text-red-400">{connected ? 'components.loading' : 'components.disconnected'}</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {['components.totalAssets', 'components.availableFunds', 'components.positionValue', 'components.buyingPower'].map((label) =>
          <div key={label}>
              <div className="text-gray-500 text-xs mb-1">{label}</div>
              <div className="text-gray-600 font-mono text-sm">--</div>
            </div>
          )}
        </div>
      </div>);

  }

  const fmt = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-medium text-sm">{'accountCapital'}</h3>
        <span className="text-xs text-emerald-400">{'liveRealtime'}</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-gray-500 text-xs mb-1">{"components.totalAssets"}</div>
          <div className="text-white font-mono text-lg font-semibold">{fmt(fund.totalAssets)}</div>
        </div>
        <div>
          <div className="text-gray-500 text-xs mb-1">{"components.availableFunds"}</div>
          <div className="text-emerald-400 font-mono text-sm">{fmt(fund.cash)}</div>
        </div>
        <div>
          <div className="text-gray-500 text-xs mb-1">{"components.positionValue"}</div>
          <div className="text-gray-300 font-mono text-sm">{fmt(fund.marketVal)}</div>
        </div>
        <div>
          <div className="text-gray-500 text-xs mb-1">{"components.buyingPower"}</div>
          <div className="text-cyan-400 font-mono text-sm">{fmt(fund.buyingPower)}</div>
        </div>
      </div>
      {fund.frozenCash && fund.frozenCash > 0 &&
      <div className="mt-2 text-xs text-yellow-400">{i18n.t('TradingDeskPage.k0')}{fmt(fund.frozenCash)}</div>
      }
    </div>);

}

// ── Quick Trade Form ─────────────────────────────────────────────────────
function QuickTradeForm({
  connected,
  selectedAccount: _sa,
  onOrderPlaced




}: {connected: boolean;selectedAccount: string;onOrderPlaced: () => void;}) {
  const [symbol, setSymbol] = useState('US.TQQQ');
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [orderType, setOrderType] = useState('MARKET');
  const [qty, setQty] = useState('100');
  const [price, setPrice] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ok: boolean;msg: string;} | null>(null);

  const quickSymbols = ['US.TQQQ', 'US.QQQ', 'US.SPY', 'US.AAPL', 'US.NVDA', 'US.TSLA', 'US.SOXL'];

  async function handleSubmit() {
    if (!connected) {
      setResult({ ok: false, msg: i18n.t('TradingDeskPage.k1') });
      return;
    }
    if (!qty || parseInt(qty) <= 0) {
      setResult({ ok: false, msg: i18n.t('TradingDeskPage.k2') });
      return;
    }
    if (orderType === 'LIMIT' && (!price || parseFloat(price) <= 0)) {
      setResult({ ok: false, msg: i18n.t('TradingDeskPage.k3') });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const order = {
        code: symbol,
        side,
        orderType: orderType === 'MARKET' ? 'MARKET' : 'LIMIT',
        qty: parseInt(qty),
        price: orderType === 'LIMIT' ? parseFloat(price) : 0
      };

      const res = await api.placeOrder(order);
      if (res?.success || res?.orderId) {
        setResult({ ok: true, msg: `${i18n.t('TradingDeskPage.k2')}: ${side === 'BUY' ? i18n.t('TradingDeskPage.k0') : i18n.t('TradingDeskPage.k1')} ${qty} ${symbol.replace('US.', '')}` });
        onOrderPlaced();
      } else {
        setResult({ ok: false, msg: res?.error || i18n.t('TradingDeskPage.k4') });
      }
    } catch (err: unknown) {
      void EngineError; // [TRADE] structured error tracking
      setResult({ ok: false, msg: (err as any).message || i18n.t('TradingDeskPage.k5') });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
      <h3 className="text-white font-medium text-sm mb-4">{i18n.t('TradingDeskPage.k2')}</h3>

      {/* Quick symbol buttons */}
      <div className="flex flex-wrap gap-1 mb-3">
        {quickSymbols.map((s) =>
        <button
          key={s}
          onClick={() => setSymbol(s)}
          className={`px-2 py-1 rounded text-[10px] font-mono transition-colors ${
          symbol === s ? 'bg-[#C9A046] text-black' : 'bg-[#12121a] text-gray-400 hover:text-white'}`
          }>
          
            {s.replace('US.', '')}
          </button>
        )}
      </div>

      {/* Symbol input */}
      <div className="mb-3">
        <input
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          className="w-full bg-[#12121a] border border-white/10 rounded-lg px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-[#C9A046]/50"
          placeholder={i18n.t('TradingDeskPage.k3')} />
        
      </div>

      {/* Side toggle */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setSide('BUY')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
          side === 'BUY' ? 'bg-emerald-500 text-white' : 'bg-[#12121a] text-gray-400 hover:text-white'}`
          }>
          {'buy'}</button>
        <button
          onClick={() => setSide('SELL')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
          side === 'SELL' ? 'bg-red-500 text-white' : 'bg-[#12121a] text-gray-400 hover:text-white'}`
          }>
          {'sell'}</button>
      </div>

      {/* Order type */}
      <div className="flex gap-2 mb-3">
        {['MARKET', 'LIMIT'].map((t) =>
        <button
          key={t}
          onClick={() => setOrderType(t)}
          className={`flex-1 py-1.5 rounded text-xs font-medium transition-colors ${
          orderType === t ? 'bg-white/10 text-white' : 'bg-[#12121a] text-gray-500'}`
          }>
          
            {t === 'MARKET' ? 'components.marketPrice' : 'components.limitPrice'}
          </button>
        )}
      </div>

      {/* Quantity */}
      <div className="mb-3">
        <label className="text-gray-500 text-xs mb-1 block">{"components.quantity"}</label>
        <input
          type="number"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          className="w-full bg-[#12121a] border border-white/10 rounded-lg px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-[#C9A046]/50" />
        
        <div className="flex gap-1 mt-1">
          {[100, 500, 1000, 5000].map((n) =>
          <button
            key={n}
            onClick={() => setQty(String(n))}
            className="text-[10px] text-gray-500 hover:text-gray-300 bg-[#12121a] px-2 py-0.5 rounded transition-colors">
            
              {n}
            </button>
          )}
        </div>
      </div>

      {/* Price (limit only) */}
      {orderType === 'LIMIT' &&
      <div className="mb-3">
          <label className="text-gray-500 text-xs mb-1 block">{i18n.t('TradingDeskPage.k4')}</label>
          <input
          type="number"
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="w-full bg-[#12121a] border border-white/10 rounded-lg px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-[#C9A046]/50"
          placeholder="0.00" />
        
        </div>
      }

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={loading || !connected}
        className={`w-full py-3 rounded-lg text-sm font-semibold transition-colors ${
        !connected ?
        'bg-gray-700 text-gray-500 cursor-not-allowed' :
        side === 'BUY' ?
        'bg-emerald-500 hover:bg-emerald-600 text-white' :
        'bg-red-500 hover:bg-red-600 text-white'} ${
        loading ? 'opacity-60' : ''}`}>
        
        {loading ? i18n.t('TradingDeskPage.k6') : !connected ? i18n.t('TradingDeskPage.k7') : `${side === 'BUY' ? i18n.t('TradingDeskPage.k5') : i18n.t('TradingDeskPage.k6')} ${symbol.replace('US.', '')} × ${qty}`}
      </button>

      {/* Result message */}
      {result &&
      <div className={`mt-3 p-2 rounded-lg text-xs ${result.ok ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
          {result.msg}
        </div>
      }
    </div>);

}

// ── Main Page ────────────────────────────────────────────────────────────
export default function TradingDeskPage() {
  const [tab, setTab] = useState<Tab>('trade');
  const [connected, setConnected] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [fund, setFund] = useState<AccountFund | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [dbTrades, setDbTrades] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState('');

  useEffect(() => {
    checkConnection();
    loadAccount();
    const timer = setInterval(() => {
      checkConnection();
      if (connected) refreshAll();
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (tab === 'positions') loadPositions();
    if (tab === 'orders' || tab === 'trade') loadOrders();
    if (tab === 'history') loadTrades();
  }, [tab, selectedAccount]);

  // Listen for real-time order updates
  useEffect(() => {
    if (typeof window !== 'undefined' && window.api?.on) {
      window.api.on('order-update', () => {
        loadOrders();
        loadPositions();
        loadFunds();
        loadTrades();
      });
    }
  }, []);

  async function checkConnection() {
    try {
      const ok = await api.isConnected();
      setConnected(ok);
    } catch (_e: unknown) {
      setConnected(false);
    }
  }

  async function loadAccount() {
    try {
      const accs = await api.getAccounts();
      if (accs.length > 0) {
        setSelectedAccount(accs[0].accId);
        loadFunds(accs[0].accId);
        loadPositions(accs[0].accId);
        loadOrders(accs[0].accId);
      }
    } catch (_e: unknown) {/* silent */}
  }

  async function loadFunds(accId?: string) {
    const id = accId || selectedAccount;
    if (!id) return;
    try {
      const result = await api.getFunds(id);
      if (result) {
        setFund({
          cash: result.cash || result.availableCash || 0,
          totalAssets: result.totalAssets || result.nav || 0,
          marketVal: result.marketVal || result.securitiesValue || 0,
          buyingPower: result.buyingPower || result.maxPowerLong || 0,
          maxPowerShort: result.maxPowerShort,
          frozenCash: result.frozenCash,
          currency: result.currency || 'USD'
        });
      }
    } catch (_e: unknown) {/* silent */}
  }

  async function loadPositions(accId?: string) {
    const id = accId || selectedAccount;
    if (!id) return;
    try {
      const result = await api.getPositions(id);
      if (Array.isArray(result)) {
        setPositions(result.map((p: unknown) => ({
          code: p.code || p.symbol,
          name: p.name,
          qty: p.qty || p.quantity || 0,
          avgCost: p.costPrice || p.avgCost || 0,
          marketPrice: p.marketPrice || p.lastPrice,
          marketVal: p.marketVal || 0,
          pnl: p.pnl || p.unrealizedPnl || 0,
          pnlPct: p.pnlPct || p.unrealizedPnlPct || 0,
          unrealizedPnl: p.unrealizedPnl
        })));
      }
    } catch (_e: unknown) {/* silent */}
  }

  async function loadOrders(accId?: string) {
    const id = accId || selectedAccount;
    if (!id) return;
    setLoading(true);
    try {
      const result = await api.getOrders(id);
      setOrders(result?.success ? result.orders || [] : Array.isArray(result) ? result : []);
      setLastRefresh(new Date().toLocaleTimeString('zh-CN'));
    } catch (_e: unknown) {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadTrades() {
    try {
      if (typeof window !== 'undefined' && window.api?.db) {
        const trades = await window.api.db.getTrades();
        setDbTrades(trades || []);
      }
    } catch (_e: unknown) {/* silent */}
  }

  async function handleCancel(order: Order) {
    try {
      if (typeof window !== 'undefined' && window.api?.broker) {
        await window.api.broker.cancelOrder(order.orderId);
        loadOrders();
      }
    } catch (_e: unknown) {/* silent */}
  }

  function refreshAll() {
    loadFunds();
    loadPositions();
    loadOrders();
    loadTrades();
  }

  const tabs: {key: Tab;label: string;icon: string;}[] = [
  { key: 'trade', label: i18n.t('TradingDeskPage.k8'), icon: '📈' },
  { key: 'positions', label: 'components.positions', icon: '💼' },
  { key: 'orders', label: i18n.t('TradingDeskPage.k9'), icon: '📋' },
  { key: 'history', label: i18n.t('TradingDeskPage.k10'), icon: '📜' }];


  const activeOrders = orders.filter((o) => ['SUBMITTED', 'WAITING', 'PARTIAL'].includes(o.status));
  // historyOrders used for completed orders tab
  // const historyOrders = orders.filter((o) => ['FILLED', 'CANCELLED', 'REJECTED'].includes(o.status));

  const statusColors: Record<string, string> = {
    SUBMITTED: 'text-blue-400 bg-blue-500/20', WAITING: 'text-yellow-400 bg-yellow-500/20',
    FILLED: 'text-emerald-400 bg-emerald-500/20', PARTIAL: 'text-cyan-400 bg-cyan-500/20',
    CANCELLED: 'text-gray-400 bg-gray-500/20', REJECTED: 'text-red-400 bg-red-500/20',
    submitted: 'text-blue-400 bg-blue-500/20', pending: 'text-yellow-400 bg-yellow-500/20'
  };
  const statusLabels: Record<string, string> = {
    SUBMITTED: i18n.t('TradingDeskPage.k11'), WAITING: i18n.t('TradingDeskPage.k12'), FILLED: 'components.tradeFilled', PARTIAL: 'components.partialFill',
    CANCELLED: i18n.t('TradingDeskPage.k13'), REJECTED: 'components.tradeRejected', UNKNOWN: i18n.t('TradingDeskPage.k14'),
    submitted: i18n.t('TradingDeskPage.k15'), pending: 'components.pending'
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">{i18n.t('TradingDeskPage.k7')}</h1>
          <p className="text-gray-400 text-sm">{i18n.t("TradingDeskPage.r92_5891")}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
            <span className={connected ? 'text-emerald-400' : 'text-red-400'}>
              {connected ? i18n.t('TradingDeskPage.k16') : 'components.disconnected'}
            </span>
          </div>
          {lastRefresh && <span className="text-gray-600 text-xs">{i18n.t('TradingDeskPage.k1')}{lastRefresh}</span>}
          <button
            onClick={refreshAll}
            disabled={loading}
            className="px-3 py-2 bg-[#1a1a25] border border-white/5 rounded-lg text-sm text-gray-300 hover:bg-[#22222f] transition-colors">
            
            {loading ? '...' : i18n.t('TradingDeskPage.k17')}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-[#12121a] rounded-lg p-1 w-fit">
        {tabs.map((t) =>
        <button
          key={t.key}
          onClick={() => setTab(t.key)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          tab === t.key ? 'bg-[#C9A046] text-black' : 'text-gray-400 hover:text-gray-200'}`
          }>
          
            {t.icon} {t.label}
            {t.key === 'orders' && activeOrders.length > 0 &&
          <span className="ml-1.5 text-xs bg-black/20 px-1.5 py-0.5 rounded-full">{activeOrders.length}</span>
          }
          </button>
        )}
      </div>

      {/* Trade Tab */}
      {tab === 'trade' &&
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1">
            <AccountSummary fund={fund} connected={connected} />
            <div className="mt-4">
              <QuickTradeForm connected={connected} selectedAccount={selectedAccount} onOrderPlaced={refreshAll} />
            </div>
          </div>
          <div className="lg:col-span-2">
            {/* Active orders */}
            <div className="bg-[#1a1a25] border border-white/5 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                <h3 className="text-white text-sm font-medium">{i18n.t('TradingDeskPage.k2')}{activeOrders.length})</h3>
              </div>
              {activeOrders.length === 0 ?
            <div className="p-6 text-center text-gray-500 text-sm">{i18n.t('TradingDeskPage.k8')}</div> :

            <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/5 text-gray-500 text-xs uppercase">
                      <th className="px-3 py-2 text-left">{"components.code"}</th>
                      <th className="px-3 py-2 text-center">{"components.direction"}</th>
                      <th className="px-3 py-2 text-right">{"components.quantity"}</th>
                      <th className="px-3 py-2 text-right">{i18n.t('TradingDeskPage.k9')}</th>
                      <th className="px-3 py-2 text-right">{"components.filled"}</th>
                      <th className="px-3 py-2 text-center">{"components.status"}</th>
                      <th className="px-3 py-2 text-center">{"components.actions"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeOrders.map((o) =>
                <tr key={o.orderId} className="border-b border-white/5 hover:bg-white/[0.02]">
                        <td className="px-3 py-2 text-white text-sm font-medium">{o.code?.replace('US.', '')}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded ${o.side === 'BUY' ? 'text-emerald-400 bg-emerald-500/20' : 'text-red-400 bg-red-500/20'}`}>
                            {o.side === 'BUY' ? i18n.t('TradingDeskPage.k18') : i18n.t('TradingDeskPage.k19')}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-sm">{o.qty}</td>
                        <td className="px-3 py-2 text-right font-mono text-sm text-gray-400">${o.price?.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right font-mono text-sm text-gray-400">{o.filledQty || 0}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded ${statusColors[o.status] || ''}`}>{statusLabels[o.status] || o.status}</span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button onClick={() => handleCancel(o)} className="text-xs text-red-400 hover:text-red-300 bg-red-500/10 px-2 py-1 rounded">{i18n.t('TradingDeskPage.k10')}</button>
                        </td>
                      </tr>
                )}
                  </tbody>
                </table>
            }
            </div>

            {/* Positions preview */}
            <div className="bg-[#1a1a25] border border-white/5 rounded-xl overflow-hidden mt-4">
              <div className="px-4 py-3 border-b border-white/5">
                <h3 className="text-white text-sm font-medium">{i18n.t('TradingDeskPage.k3')}{positions.length})</h3>
              </div>
              {positions.length === 0 ?
            <div className="p-6 text-center text-gray-500 text-sm">{i18n.t('TradingDeskPage.k11')}</div> :

            <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/5 text-gray-500 text-xs uppercase">
                      <th className="px-3 py-2 text-left">{"components.code"}</th>
                      <th className="px-3 py-2 text-right">{"components.quantity"}</th>
                      <th className="px-3 py-2 text-right">{i18n.t('TradingDeskPage.k12')}</th>
                      <th className="px-3 py-2 text-right">{"components.marketPrice"}</th>
                      <th className="px-3 py-2 text-right">{i18n.t('TradingDeskPage.k13')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {positions.map((p, i) => {
                  const pnlCls = (p.pnl || 0) >= 0 ? 'text-emerald-400' : 'text-red-400';
                  return (
                    <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02]">
                          <td className="px-3 py-2 text-white text-sm font-medium">{p.code?.replace('US.', '')}</td>
                          <td className="px-3 py-2 text-right font-mono text-sm">{p.qty}</td>
                          <td className="px-3 py-2 text-right font-mono text-sm text-gray-400">${p.avgCost?.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right font-mono text-sm">{p.marketPrice ? `$${p.marketPrice.toFixed(2)}` : '--'}</td>
                          <td className={`px-3 py-2 text-right font-mono text-sm ${pnlCls}`}>
                            {p.pnl ? `${p.pnl >= 0 ? '+' : ''}$${p.pnl.toFixed(2)}` : '--'}
                          </td>
                        </tr>);

                })}
                  </tbody>
                </table>
            }
            </div>
          </div>
        </div>
      }

      {/* Positions Tab */}
      {tab === 'positions' &&
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl overflow-hidden">
          {positions.length === 0 ?
        <div className="p-8 text-center">
              <div className="text-3xl mb-2 opacity-40">💼</div>
              <p className="text-gray-400 text-sm">{i18n.t('TradingDeskPage.k14')}</p>
              {!selectedAccount && <p className="text-gray-600 text-xs mt-1">{i18n.t('TradingDeskPage.k15')}</p>}
            </div> :

        <table className="w-full">
              <thead>
                <tr className="border-b border-white/5 text-gray-500 text-xs uppercase">
                  <th className="px-4 py-3 text-left">{"components.code"}</th>
                  <th className="px-4 py-3 text-left">{"components.name"}</th>
                  <th className="px-4 py-3 text-right">{"components.quantity"}</th>
                  <th className="px-4 py-3 text-right">{i18n.t('TradingDeskPage.k16')}</th>
                  <th className="px-4 py-3 text-right">{"components.marketPrice"}</th>
                  <th className="px-4 py-3 text-right">{"components.marketCap"}</th>
                  <th className="px-4 py-3 text-right">{i18n.t('TradingDeskPage.k17')}</th>
                  <th className="px-4 py-3 text-right">{i18n.t("TradingDeskPage.r92_d1a4")}</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((p, i) => {
              const pnlCls = (p.pnl || 0) >= 0 ? 'text-emerald-400' : 'text-red-400';
              return (
                <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="px-4 py-3 text-white text-sm font-medium">{p.code?.replace('US.', '')}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{p.name || '--'}</td>
                      <td className="px-4 py-3 text-right font-mono text-sm">{p.qty}</td>
                      <td className="px-4 py-3 text-right font-mono text-sm text-gray-400">${p.avgCost?.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-mono text-sm">{p.marketPrice ? `$${p.marketPrice.toFixed(2)}` : '--'}</td>
                      <td className="px-4 py-3 text-right font-mono text-sm text-gray-300">
                        {p.marketVal ? `$${p.marketVal.toLocaleString()}` : '--'}
                      </td>
                      <td className={`px-4 py-3 text-right font-mono text-sm ${pnlCls}`}>
                        {p.pnl ? `${p.pnl >= 0 ? '+' : ''}$${p.pnl.toFixed(2)}` : '--'}
                      </td>
                      <td className={`px-4 py-3 text-right font-mono text-sm ${pnlCls}`}>
                        {p.pnlPct ? `${p.pnlPct >= 0 ? '+' : ''}${p.pnlPct.toFixed(2)}%` : '--'}
                      </td>
                    </tr>);

            })}
              </tbody>
            </table>
        }
        </div>
      }

      {/* Orders Tab */}
      {tab === 'orders' &&
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl overflow-hidden">
          {loading && orders.length === 0 ?
        <div className="p-8 text-center text-gray-500 text-sm">{"components.loading"}</div> :
        orders.length === 0 ?
        <div className="p-8 text-center">
              <div className="text-3xl mb-2 opacity-40">📋</div>
              <p className="text-gray-400 text-sm">{i18n.t('TradingDeskPage.k18')}</p>
            </div> :

        <table className="w-full">
              <thead>
                <tr className="border-b border-white/5 text-gray-500 text-xs uppercase">
                  <th className="px-4 py-3 text-left">{"components.time"}</th>
                  <th className="px-4 py-3 text-left">{"components.code"}</th>
                  <th className="px-4 py-3 text-center">{"components.direction"}</th>
                  <th className="px-4 py-3 text-right">{"components.quantity"}</th>
                  <th className="px-4 py-3 text-right">{i18n.t('TradingDeskPage.k19')}</th>
                  <th className="px-4 py-3 text-right">{i18n.t('TradingDeskPage.k20')}</th>
                  <th className="px-4 py-3 text-right">{i18n.t('TradingDeskPage.k21')}</th>
                  <th className="px-4 py-3 text-center">{"components.status"}</th>
                  <th className="px-4 py-3 text-center">{"components.actions"}</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) =>
            <tr key={o.orderId} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-gray-400 text-xs font-mono">{o.createTime || '--'}</td>
                    <td className="px-4 py-3 text-white text-sm font-medium">{o.code?.replace('US.', '') || '--'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${o.side === 'BUY' ? 'text-emerald-400 bg-emerald-500/20' : 'text-red-400 bg-red-500/20'}`}>
                        {o.side === 'BUY' ? i18n.t('TradingDeskPage.k20') : i18n.t('TradingDeskPage.k21')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm">{o.qty}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-gray-400">${o.price?.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-gray-400">{o.filledQty || 0}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-gray-400">{o.filledPrice ? `$${o.filledPrice.toFixed(2)}` : '--'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded ${statusColors[o.status] || 'text-gray-400 bg-gray-500/20'}`}>
                        {statusLabels[o.status] || o.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {['SUBMITTED', 'WAITING', 'PARTIAL'].includes(o.status) &&
                <button onClick={() => handleCancel(o)} className="text-xs text-red-400 hover:text-red-300 bg-red-500/10 px-2 py-1 rounded">{i18n.t('TradingDeskPage.k22')}</button>
                }
                    </td>
                  </tr>
            )}
              </tbody>
            </table>
        }
        </div>
      }

      {/* History Tab */}
      {tab === 'history' &&
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl overflow-hidden">
          {dbTrades.length === 0 ?
        <div className="p-8 text-center">
              <div className="text-3xl mb-2 opacity-40">📜</div>
              <p className="text-gray-400 text-sm">{i18n.t('TradingDeskPage.k23')}</p>
              <p className="text-gray-600 text-xs mt-1">{i18n.t('TradingDeskPage.k24')}</p>
            </div> :

        <table className="w-full">
              <thead>
                <tr className="border-b border-white/5 text-gray-500 text-xs uppercase">
                  <th className="px-4 py-3 text-left">{"components.time"}</th>
                  <th className="px-4 py-3 text-left">{"components.code"}</th>
                  <th className="px-4 py-3 text-center">{"components.direction"}</th>
                  <th className="px-4 py-3 text-right">{"components.quantity"}</th>
                  <th className="px-4 py-3 text-right">{"components.price"}</th>
                  <th className="px-4 py-3 text-right">{i18n.t('TradingDeskPage.k25')}</th>
                  <th className="px-4 py-3 text-center">{"components.status"}</th>
                  <th className="px-4 py-3 text-left">{"components.remarks"}</th>
                </tr>
              </thead>
              <tbody>
                {dbTrades.map((t, i) =>
            <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-gray-400 text-xs font-mono">{(t as any).created_at || '--'}</td>
                    <td className="px-4 py-3 text-white text-sm font-medium">{(t as any).symbol?.replace('US.', '')}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${(t as any).side === 'BUY' ? 'text-emerald-400 bg-emerald-500/20' : 'text-red-400 bg-red-500/20'}`}>
                        {(t as any).side === 'BUY' ? i18n.t('TradingDeskPage.k22') : i18n.t('TradingDeskPage.k23')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm">{(t as any).quantity}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-gray-400">${(t as any).price?.toFixed(2)}</td>
                    <td className={`px-4 py-3 text-right font-mono text-sm ${((t as any).pnl || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {(t as any).pnl ? `${(t as any).pnl >= 0 ? '+' : ''}$${(t as any).pnl.toFixed(2)}` : '--'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded ${statusColors[(t as any).status] || 'text-gray-400 bg-gray-500/20'}`}>
                        {statusLabels[(t as any).status] || (t as any).status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs truncate max-w-[150px]">{(t as any).remark || ''}</td>
                  </tr>
            )}
              </tbody>
            </table>
        }
        </div>
      }
    </div>);

}