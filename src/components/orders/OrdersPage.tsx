import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import * as api from '@/lib/bridge-api';
import LoadingSpinner from '@/components/common/LoadingSpinner';

type Tab = 'active' | 'history' | 'trades';

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

export default function OrdersPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('active');
  const [orders, setOrders] = useState<Order[]>([]);
  const [dbTrades, setDbTrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<string>('');

  useEffect(() => {
    loadAccount();
  }, []);

  useEffect(() => {
    if (tab === 'active' || tab === 'history') loadOrders();
    if (tab === 'trades') loadTrades();
  }, [tab, selectedAccount]);

  // Listen for real-time order updates
  useEffect(() => {
    if (typeof window !== 'undefined' && window.api?.on) {
      window.api.on('order-update', (_data: any) => {
        loadOrders();
        loadTrades();
      });
    }
  }, []);

  async function loadAccount() {
    try {
      const accs = await api.getAccounts();
      if (accs.length > 0) setSelectedAccount(accs[0].accId || accs[0].accountId);
    } catch (e: any) { setError(e?.message || t('common.loadingFailed')); }
  }

  async function loadOrders() {
    if (!selectedAccount) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.getOrders(selectedAccount);
      setOrders(result?.success ? result.orders || [] : []);
    } catch (e: any) {
      setError(e?.message || t('common.loadingFailed'));
      setOrders([]);
    } finally { setLoading(false); }
  }

  async function loadTrades() {
    try {
      if (typeof window !== 'undefined' && window.api?.db) {
        const trades = await window.api.db.getTrades();
        setDbTrades(trades || []);
      }
    } catch (e: any) { setError(e?.message || t('common.loadingFailed')); }
  }

  async function handleCancel(order: Order) {
    try {
      if (typeof window !== 'undefined' && window.api?.broker) {
        await window.api.broker.cancelOrder(order.orderId);
        loadOrders();
      }
    } catch (e: any) { setError(e?.message || t('common.loadingFailed')); }
  }

  const statusColors: Record<string, string> = {
    SUBMITTED: 'text-blue-400 bg-blue-500/20',
    WAITING: 'text-yellow-400 bg-yellow-500/20',
    FILLED: 'text-emerald-400 bg-emerald-500/20',
    PARTIAL: 'text-cyan-400 bg-cyan-500/20',
    CANCELLED: 'text-gray-400 bg-gray-500/20',
    REJECTED: 'text-red-400 bg-red-500/20',
    submitted: 'text-blue-400 bg-blue-500/20',
    pending: 'text-yellow-400 bg-yellow-500/20',
  };

  const statusLabels: Record<string, string> = {
    SUBMITTED: '已提交', WAITING: '等待中', FILLED: '已成交', PARTIAL: '部分成交',
    CANCELLED: '已撤销', REJECTED: '已拒绝', UNKNOWN: '未知',
    submitted: '已提交', pending: '待处理',
  };

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'active', label: '当前委托', icon: '📋' },
    { key: 'history', label: '历史委托', icon: '📜' },
    { key: 'trades', label: '策略交易记录', icon: '🔄' },
  ];

  const activeOrders = orders.filter((o) => ['SUBMITTED', 'WAITING', 'PARTIAL'].includes(o.status));
  const historyOrders = orders.filter((o) => ['FILLED', 'CANCELLED', 'REJECTED'].includes(o.status));
  const displayOrders = tab === 'active' ? activeOrders : tab === 'history' ? historyOrders : [];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">{t('trading.orders')}</h1>
          <p className="text-gray-400 text-sm">{t('trading.ordersSubtitle')}</p>
        </div>
        <button onClick={() => { loadOrders(); loadTrades(); }} disabled={loading} className="px-4 py-2 bg-[#1a1a25] border border-white/5 rounded-lg text-sm text-gray-300 hover:bg-[#22222f] transition-colors">
          {loading ? '...' : `⟳ ${t('common.refresh')}`}
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4 text-red-400 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={loadOrders} className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 rounded text-xs transition-colors">{t('common.retry')}</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-[#12121a] rounded-lg p-1 w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-[#C9A046] text-black' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {t.icon} {t.label}
            {t.key === 'active' && activeOrders.length > 0 && (
              <span className="ml-1.5 text-xs bg-black/20 px-1.5 py-0.5 rounded-full">{activeOrders.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Active / History Orders */}
      {(tab === 'active' || tab === 'history') && (
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl overflow-hidden">
          {loading && displayOrders.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">加载中...</div>
          ) : displayOrders.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-3xl mb-2 opacity-40">{tab === 'active' ? '📋' : '📜'}</div>
              <p className="text-gray-400 text-sm">{tab === 'active' ? '暂无活跃委托' : '暂无历史委托'}</p>
              {!selectedAccount && <p className="text-gray-600 text-xs mt-1">请先连接 OpenD</p>}
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5 text-gray-500 text-xs uppercase">
                  <th className="px-4 py-3 text-left">时间</th>
                  <th className="px-4 py-3 text-left">代码</th>
                  <th className="px-4 py-3 text-center">方向</th>
                  <th className="px-4 py-3 text-right">数量</th>
                  <th className="px-4 py-3 text-right">委托价</th>
                  <th className="px-4 py-3 text-right">成交数</th>
                  <th className="px-4 py-3 text-right">成交价</th>
                  <th className="px-4 py-3 text-center">状态</th>
                  {tab === 'active' && <th className="px-4 py-3 text-center">操作</th>}
                </tr>
              </thead>
              <tbody>
                {displayOrders.map((o) => (
                  <tr key={o.orderId} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-gray-400 text-xs font-mono">{o.createTime || '--'}</td>
                    <td className="px-4 py-3 text-white text-sm font-medium">{o.code?.replace('US.', '') || '--'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${o.side === 'BUY' ? 'text-emerald-400 bg-emerald-500/20' : 'text-red-400 bg-red-500/20'}`}>
                        {o.side === 'BUY' ? '买入' : '卖出'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-gray-200">{o.qty}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-gray-400">${o.price?.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-gray-400">{o.filledQty || 0}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-gray-400">{o.filledPrice ? `$${o.filledPrice.toFixed(2)}` : '--'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded ${statusColors[o.status] || 'text-gray-400 bg-gray-500/20'}`}>
                        {statusLabels[o.status] || o.status}
                      </span>
                    </td>
                    {tab === 'active' && (
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => handleCancel(o)} className="text-xs text-red-400 hover:text-red-300 bg-red-500/10 px-2 py-1 rounded transition-colors">
                          撤单
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Strategy Trades (from DB) */}
      {tab === 'trades' && (
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl overflow-hidden">
          {dbTrades.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-3xl mb-2 opacity-40">🔄</div>
              <p className="text-gray-400 text-sm">暂无策略交易记录</p>
              <p className="text-gray-600 text-xs mt-1">策略运行后自动记录在这里</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5 text-gray-500 text-xs uppercase">
                  <th className="px-4 py-3 text-left">时间</th>
                  <th className="px-4 py-3 text-left">代码</th>
                  <th className="px-4 py-3 text-center">方向</th>
                  <th className="px-4 py-3 text-right">数量</th>
                  <th className="px-4 py-3 text-right">价格</th>
                  <th className="px-4 py-3 text-right">盈亏</th>
                  <th className="px-4 py-3 text-center">状态</th>
                  <th className="px-4 py-3 text-left">备注</th>
                </tr>
              </thead>
              <tbody>
                {dbTrades.map((t, i) => (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-gray-400 text-xs font-mono">{t.created_at || '--'}</td>
                    <td className="px-4 py-3 text-white text-sm font-medium">{t.symbol?.replace('US.', '')}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${t.side === 'BUY' ? 'text-emerald-400 bg-emerald-500/20' : 'text-red-400 bg-red-500/20'}`}>
                        {t.side === 'BUY' ? '买入' : '卖出'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-gray-200">{t.quantity}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-gray-400">${t.price?.toFixed(2)}</td>
                    <td className={`px-4 py-3 text-right font-mono text-sm ${(t.pnl || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {t.pnl ? `${t.pnl >= 0 ? '+' : ''}$${t.pnl.toFixed(2)}` : '--'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded ${statusColors[t.status] || 'text-gray-400 bg-gray-500/20'}`}>
                        {statusLabels[t.status] || t.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs truncate max-w-[150px]">{t.remark || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
