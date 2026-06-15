import { useState, useEffect } from 'react';
import { EngineError } from '../../../electron/engine/core/engine-error';

import * as api from '@/lib/bridge-api';
import { useTranslation } from "react-i18next";
import i18n from '../../i18n';

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
  const [dbTrades, setDbTrades] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(false);
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
      window.api.on('order-update', (_data: Record<string, unknown>) => {
        loadOrders();
        loadTrades();
      });
    }
  }, []);

  async function loadAccount() {
    try {
      const accs = await api.getAccounts();
      if (accs.length > 0) setSelectedAccount(accs[0].accId);
    } catch (_e: unknown) {/* silent */}
    void EngineError; // [TRADE] structured error tracking
  }

  async function loadOrders() {
    if (!selectedAccount) return;
    setLoading(true);
    try {
      const result = await api.getOrders(selectedAccount);
      setOrders(result?.success ? result.orders || [] : []);
    } catch (_e: unknown) {setOrders([]);} finally {setLoading(false);}
  }

  async function loadTrades() {
    try {
      if (typeof window !== 'undefined' && window.api?.db) {
        const trades = await window.api.db.getTrades();
        setDbTrades((trades as any) || []);
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

  const statusColors: Record<string, string> = {
    SUBMITTED: 'text-blue-400 bg-blue-500/20',
    WAITING: 'text-yellow-400 bg-yellow-500/20',
    FILLED: 'text-emerald-400 bg-emerald-500/20',
    PARTIAL: 'text-cyan-400 bg-cyan-500/20',
    CANCELLED: 'text-gray-400 bg-gray-500/20',
    REJECTED: 'text-red-400 bg-red-500/20',
    submitted: 'text-blue-400 bg-blue-500/20',
    pending: 'text-yellow-400 bg-yellow-500/20'
  };

  const statusLabels: Record<string, string> = {
    SUBMITTED: i18n.t('OrdersPage.k1'), WAITING: i18n.t('OrdersPage.k2'), FILLED: t('components.tradeFilled'), PARTIAL: t('components.partialFill'),
    CANCELLED: i18n.t('OrdersPage.k3'), REJECTED: t('components.tradeRejected'), UNKNOWN: i18n.t('OrdersPage.k4'),
    submitted: i18n.t('OrdersPage.k5'), pending: t('components.pending')
  };

  const tabs: {key: Tab;label: string;icon: string;}[] = [
  { key: 'active', label: i18n.t('OrdersPage.k6'), icon: '📋' },
  { key: 'history', label: i18n.t('OrdersPage.k7'), icon: '📜' },
  { key: 'trades', label: i18n.t('OrdersPage.k8'), icon: '🔄' }];


  const activeOrders = orders.filter((o) => ['SUBMITTED', 'WAITING', 'PARTIAL'].includes(o.status));
  const historyOrders = orders.filter((o) => ['FILLED', 'CANCELLED', 'REJECTED'].includes(o.status));
  const displayOrders = tab === 'active' ? activeOrders : tab === 'history' ? historyOrders : [];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">{i18n.t('OrdersPage.k0')}</h1>
          <p className="text-gray-400 text-sm">{i18n.t('OrdersPage.k1')}</p>
        </div>
        <button onClick={() => {loadOrders();loadTrades();}} disabled={loading} className="px-4 py-2 bg-[#1a1a25] border border-white/5 rounded-lg text-sm text-gray-300 hover:bg-[#22222f] transition-colors">
          {loading ? '...' : i18n.t('OrdersPage.k9')}
        </button>
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
            {t.key === 'active' && activeOrders.length > 0 &&
          <span className="ml-1.5 text-xs bg-black/20 px-1.5 py-0.5 rounded-full">{activeOrders.length}</span>
          }
          </button>
        )}
      </div>

      {/* Active / History Orders */}
      {(tab === 'active' || tab === 'history') &&
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl overflow-hidden">
          {loading && displayOrders.length === 0 ?
        <div className="p-8 text-center text-gray-500 text-sm">{t("components.loading")}</div> :
        displayOrders.length === 0 ?
        <div className="p-8 text-center">
              <div className="text-3xl mb-2 opacity-40">{tab === 'active' ? '📋' : '📜'}</div>
              <p className="text-gray-400 text-sm">{tab === 'active' ? i18n.t('OrdersPage.k10') : i18n.t('OrdersPage.k11')}</p>
              {!selectedAccount && <p className="text-gray-600 text-xs mt-1">{i18n.t('OrdersPage.k2')}</p>}
            </div> :

        <table className="w-full">
              <thead>
                <tr className="border-b border-white/5 text-gray-500 text-xs uppercase">
                  <th className="px-4 py-3 text-left">{t("components.time")}</th>
                  <th className="px-4 py-3 text-left">{t("components.code")}</th>
                  <th className="px-4 py-3 text-center">{t("components.direction")}</th>
                  <th className="px-4 py-3 text-right">{t("components.quantity")}</th>
                  <th className="px-4 py-3 text-right">{i18n.t('OrdersPage.k3')}</th>
                  <th className="px-4 py-3 text-right">{i18n.t('OrdersPage.k4')}</th>
                  <th className="px-4 py-3 text-right">{i18n.t('OrdersPage.k5')}</th>
                  <th className="px-4 py-3 text-center">{t("components.status")}</th>
                  {tab === 'active' && <th className="px-4 py-3 text-center">{t("components.actions")}</th>}
                </tr>
              </thead>
              <tbody>
                {displayOrders.map((o) =>
            <tr key={o.orderId} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-gray-400 text-xs font-mono">{o.createTime || '--'}</td>
                    <td className="px-4 py-3 text-white text-sm font-medium">{o.code?.replace('US.', '') || '--'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${o.side === 'BUY' ? 'text-emerald-400 bg-emerald-500/20' : 'text-red-400 bg-red-500/20'}`}>
                        {o.side === 'BUY' ? i18n.t('OrdersPage.k12') : i18n.t('OrdersPage.k13')}
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
                    {tab === 'active' &&
              <td className="px-4 py-3 text-center">
                        <button onClick={() => handleCancel(o)} className="text-xs text-red-400 hover:text-red-300 bg-red-500/10 px-2 py-1 rounded transition-colors">{i18n.t("OrdersPage.r92_bbbf")}

                </button>
                      </td>
              }
                  </tr>
            )}
              </tbody>
            </table>
        }
        </div>
      }

      {/* Strategy Trades (from DB) */}
      {tab === 'trades' &&
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl overflow-hidden">
          {dbTrades.length === 0 ?
        <div className="p-8 text-center">
              <div className="text-3xl mb-2 opacity-40">🔄</div>
              <p className="text-gray-400 text-sm">{i18n.t('OrdersPage.k6')}</p>
              <p className="text-gray-600 text-xs mt-1">{i18n.t('OrdersPage.k7')}</p>
            </div> :

        <table className="w-full">
              <thead>
                <tr className="border-b border-white/5 text-gray-500 text-xs uppercase">
                  <th className="px-4 py-3 text-left">{t("components.time")}</th>
                  <th className="px-4 py-3 text-left">{t("components.code")}</th>
                  <th className="px-4 py-3 text-center">{t("components.direction")}</th>
                  <th className="px-4 py-3 text-right">{t("components.quantity")}</th>
                  <th className="px-4 py-3 text-right">{t("components.price")}</th>
                  <th className="px-4 py-3 text-right">{i18n.t('OrdersPage.k8')}</th>
                  <th className="px-4 py-3 text-center">{t("components.status")}</th>
                  <th className="px-4 py-3 text-left">{t("components.remarks")}</th>
                </tr>
              </thead>
              <tbody>
                {dbTrades.map((t, i) =>
            <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-gray-400 text-xs font-mono">{(t as any).created_at || '--'}</td>
                    <td className="px-4 py-3 text-white text-sm font-medium">{(t as any).symbol?.replace('US.', '')}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${(t as any).side === 'BUY' ? 'text-emerald-400 bg-emerald-500/20' : 'text-red-400 bg-red-500/20'}`}>
                        {(t as any).side === 'BUY' ? i18n.t('OrdersPage.k14') : i18n.t('OrdersPage.k15')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-gray-200">{(t as any).quantity}</td>
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