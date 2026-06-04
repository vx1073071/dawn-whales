import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getAccounts, placeOrder, cancelOrder, getOrders, getFunds } from '@/lib/bridge-api';
import type { NewOrder, Order, OrderSide, OrderType, Market } from '@/lib/types';

function OrderTypes() {
  const { t } = useTranslation();
  return [
    { label: t('trading.marketOrder'), value: 'MARKET' as OrderType },
    { label: t('trading.limitOrder'), value: 'LIMIT' as OrderType },
    { label: t('trading.stopOrder'), value: 'STOP' as OrderType },
    { label: t('trading.stopLimitOrder'), value: 'STOP_LIMIT' as OrderType },
  ];
}

function Markets() {
  const { t } = useTranslation();
  return [
    { label: t('market.US'), value: 'US' as Market },
    { label: t('market.HK'), value: 'HK' as Market },
    { label: t('market.CN'), value: 'CN' as Market },
    { label: t('market.SG'), value: 'SG' as Market },
  ];
}

function StatusMap() {
  const { t } = useTranslation();
  return {
    PENDING: { label: t('orderStatus.pending'), color: 'text-yellow-400' },
    SUBMITTED: { label: t('orderStatus.submitted'), color: 'text-blue-400' },
    FILLED: { label: t('orderStatus.filled'), color: 'text-emerald-400' },
    PARTIAL: { label: t('orderStatus.partial'), color: 'text-orange-400' },
    CANCELLED: { label: t('orderStatus.cancelled'), color: 'text-gray-400' },
    REJECTED: { label: t('orderStatus.rejected'), color: 'text-red-400' },
  };
}

export default function TradeExecutionPanel() {
  const { t } = useTranslation();
  const [accounts, setAccounts] = useState<{ accId: string; trdEnv: string }[]>([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [funds, setFunds] = useState<{ cash: number; power: number } | null>(null);

  // Order form
  const [code, setCode] = useState('');
  const [market, setMarket] = useState<Market>('US');
  const [side, setSide] = useState<OrderSide>('BUY');
  const [orderType, setOrderType] = useState<OrderType>('MARKET');
  const [qty, setQty] = useState('');
  const [price, setPrice] = useState('');
  const [stopPrice, setStopPrice] = useState('');
  const [remark, setRemark] = useState('');

  const [orders, setOrders] = useState<Order[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Paper/Real mode
  const [isReal, setIsReal] = useState(false);

  useEffect(() => { loadAccounts(); }, []);
  useEffect(() => {
    if (selectedAccount) { loadFunds(); loadOrders(); }
    const interval = setInterval(() => { if (selectedAccount) loadOrders(); }, 5000);
    return () => clearInterval(interval);
  }, [selectedAccount]);

  async function loadAccounts() {
    try {
      const res = await getAccounts();
      if (Array.isArray(res)) {
        setAccounts(res);
        if (res.length > 0) setSelectedAccount(res[0].accId);
      }
    } catch { /* silent */ }
  }

  async function loadFunds() {
    try {
      const f = await getFunds(selectedAccount);
      if (f) setFunds({ cash: f.cash, power: f.power });
    } catch { /* silent */ }
  }

  async function loadOrders() {
    try {
      const res = await getOrders(selectedAccount);
      if (Array.isArray(res)) setOrders(res);
    } catch { /* silent */ }
  }

  function handlePreview() {
    setError('');
    if (!code || !qty) { setError(t('trading.errorCodeQty')); return; }
    if ((orderType === 'LIMIT' || orderType === 'STOP_LIMIT') && !price) {
      setError(t('trading.errorLimitPrice')); return;
    }
    if ((orderType === 'STOP' || orderType === 'STOP_LIMIT') && !stopPrice) {
      setError(t('trading.errorStopPrice')); return;
    }
    setShowConfirm(true);
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const order: NewOrder = {
        accountId: selectedAccount,
        code: code.toUpperCase(),
        market,
        side,
        orderType,
        qty: parseInt(qty, 10),
        ...(price ? { price: parseFloat(price) } : {}),
        ...(stopPrice ? { stopPrice: parseFloat(stopPrice) } : {}),
        ...(remark ? { remark } : {}),
      };
      const res = await placeOrder(order);
      if (res?.success) {
        setShowConfirm(false);
        setCode(''); setQty(''); setPrice(''); setStopPrice(''); setRemark('');
        loadOrders(); loadFunds();
      } else {
        setError(res?.error || t('trading.orderFailed'));
      }
    } catch (e: any) {
      setError(e.message || t('trading.orderFailed'));
    }
    setSubmitting(false);
  }

  async function handleCancel(orderId: string) {
    try {
      await cancelOrder(orderId);
      loadOrders();
    } catch { /* silent */ }
  }

  const totalAmount = (() => {
    const q = parseInt(qty, 10) || 0;
    const p = parseFloat(price) || 0;
    if (orderType === 'MARKET') return q > 0 ? t('trading.marketPrice') : '--';
    return q > 0 && p > 0 ? `$${(q * p).toLocaleString()}` : '--';
  })();

  return (
    <div className="p-6 space-y-6 bg-[#0a0a12] min-h-full">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">🚀 {t('trading.tradeExecution')}</h1>
          <p className="text-gray-400 text-sm">{isReal ? t('trading.liveMode') : t('trading.paperMode')} · {t('trading.tradeCarefully')}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsReal(!isReal)}
            className={`text-xs px-4 py-2 rounded-lg font-medium transition-colors ${
              isReal
                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
            }`}
          >
            {isReal ? `🔴 ${t('trading.liveMode')}` : `🟢 ${t('trading.paperMode')}`}
          </button>
        </div>
      </div>

      {/* Account & Funds */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">{t('portfolio.account')}</div>
          <select
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
            className="w-full bg-[#0a0a12] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#C9A046]"
          >
            {accounts.map((a) => (
              <option key={a.accId} value={a.accId}>{a.accId} ({a.trdEnv === 'REAL' ? t('settings.realTrading') : t('settings.simulateTrading')})</option>
            ))}
          </select>
        </div>
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">{t('portfolio.availableCash')}</div>
          <div className="text-xl font-bold font-mono text-white">${funds?.cash.toLocaleString('en-US', { minimumFractionDigits: 2 }) ?? '--'}</div>
        </div>
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">{t('portfolio.buyingPower')}</div>
          <div className="text-xl font-bold font-mono text-white">${funds?.power.toLocaleString('en-US', { minimumFractionDigits: 2 }) ?? '--'}</div>
        </div>
      </div>

      {/* Order Form */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
        <h2 className="text-lg font-semibold text-white mb-4">{t('trading.placeOrder')}</h2>
        {error && <div className="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">{t('trading.code')}</label>
            <input
              type="text" value={code} onChange={(e) => setCode(e.target.value)}
              placeholder={t('trading.codePlaceholder')}
              className="w-full bg-[#0a0a12] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A046] uppercase"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">{t('trading.market')}</label>
            <select
              value={market} onChange={(e) => setMarket(e.target.value as Market)}
              className="w-full bg-[#0a0a12] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#C9A046]"
            >
              {Markets().map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">{t('trading.direction')}</label>
            <div className="flex gap-2">
              <button
                onClick={() => setSide('BUY')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  side === 'BUY' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-[#0a0a12] text-gray-400 border border-white/10'
                }`}
              >
                {t('common.buy')}
              </button>
              <button
                onClick={() => setSide('SELL')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  side === 'SELL' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-[#0a0a12] text-gray-400 border border-white/10'
                }`}
              >
                {t('common.sell')}
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">{t('trading.orderType')}</label>
            <select
              value={orderType} onChange={(e) => setOrderType(e.target.value as OrderType)}
              className="w-full bg-[#0a0a12] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#C9A046]"
            >
              {OrderTypes().map((ot) => <option key={ot.value} value={ot.value}>{ot.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">{t('trading.quantity')}</label>
            <input
              type="number" value={qty} onChange={(e) => setQty(e.target.value)}
              placeholder="100"
              className="w-full bg-[#0a0a12] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A046]"
            />
          </div>
          {(orderType === 'LIMIT' || orderType === 'STOP_LIMIT') && (
            <div>
              <label className="text-xs text-gray-500 mb-1 block">{t('trading.limitPrice')}</label>
              <input
                type="number" value={price} onChange={(e) => setPrice(e.target.value)}
                placeholder="150.00"
                className="w-full bg-[#0a0a12] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A046]"
              />
            </div>
          )}
          {(orderType === 'STOP' || orderType === 'STOP_LIMIT') && (
            <div>
              <label className="text-xs text-gray-500 mb-1 block">{t('trading.stopPrice')}</label>
              <input
                type="number" value={stopPrice} onChange={(e) => setStopPrice(e.target.value)}
                placeholder="140.00"
                className="w-full bg-[#0a0a12] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A046]"
              />
            </div>
          )}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">{t('trading.remark')}</label>
            <input
              type="text" value={remark} onChange={(e) => setRemark(e.target.value)}
              placeholder={t('trading.remarkPlaceholder')}
              className="w-full bg-[#0a0a12] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A046]"
            />
          </div>
        </div>
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
          <div className="text-sm text-gray-400">
            {t('trading.estimatedAmount')}: <span className="text-white font-mono font-bold">{totalAmount}</span>
          </div>
          <button
            onClick={handlePreview}
            className="bg-[#C9A046] hover:bg-[#D4A853] text-black font-medium px-6 py-2 rounded-lg transition-colors"
          >
            {t('trading.previewOrder')}
          </button>
        </div>
      </div>

      {/* Order List */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
        <h2 className="text-lg font-semibold text-white mb-4">{t('trading.todayOrders')}</h2>
        {orders.length === 0 ? (
          <div className="text-gray-500 text-sm text-center py-8">{t('trading.noOrders')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-gray-500 text-xs uppercase">
                  <th className="px-3 py-2 text-left">{t('trading.time')}</th>
                  <th className="px-3 py-2 text-left">{t('trading.code')}</th>
                  <th className="px-3 py-2 text-left">{t('trading.direction')}</th>
                  <th className="px-3 py-2 text-right">{t('trading.quantity')}</th>
                  <th className="px-3 py-2 text-right">{t('trading.price')}</th>
                  <th className="px-3 py-2 text-right">{t('trading.filled')}</th>
                  <th className="px-3 py-2 text-center">{t('trading.status')}</th>
                  <th className="px-3 py-2 text-center">{t('common.operation')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {orders.map((o) => {
                  const status = StatusMap()[o.status] || { label: o.status, color: 'text-gray-400' };
                  return (
                    <tr key={o.orderId} className="hover:bg-white/[0.02]">
                      <td className="px-3 py-2 text-gray-400">{o.createTime.split(' ')[1] ?? o.createTime}</td>
                      <td className="px-3 py-2 text-white font-medium">{o.code}</td>
                      <td className={`px-3 py-2 ${o.side === 'BUY' ? 'text-red-400' : 'text-emerald-400'}`}>
                        {o.side === 'BUY' ? t('common.buy') : t('common.sell')}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-white">{o.qty}</td>
                      <td className="px-3 py-2 text-right font-mono text-white">${o.price?.toFixed(2) ?? '--'}</td>
                      <td className="px-3 py-2 text-right font-mono text-gray-300">{o.filledQty}/{o.qty}</td>
                      <td className={`px-3 py-2 text-center text-xs ${status.color}`}>{status.label}</td>
                      <td className="px-3 py-2 text-center">
                        {(o.status === 'PENDING' || o.status === 'SUBMITTED') && (
                          <button
                            onClick={() => handleCancel(o.orderId)}
                            className="text-xs text-gray-400 hover:text-red-400 transition-colors"
                          >
                            {t('trading.cancelOrder')}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirm Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1a1a25] border border-white/10 rounded-2xl p-6 w-[400px] max-w-[90vw]">
            <h2 className="text-lg font-bold text-white mb-1">{t('trading.confirmOrder')}</h2>
            <p className="text-sm text-gray-400 mb-4">{t('trading.pleaseCheck')}</p>
            <div className="space-y-2 text-sm mb-4">
              <div className="flex justify-between"><span className="text-gray-500">{t('trading.code')}</span><span className="text-white font-medium">{code.toUpperCase()}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">{t('trading.direction')}</span><span className={side === 'BUY' ? 'text-red-400' : 'text-emerald-400'}>{side === 'BUY' ? t('common.buy') : t('common.sell')}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">{t('trading.quantity')}</span><span className="text-white font-mono">{qty}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">{t('trading.orderType')}</span><span className="text-white">{OrderTypes().find(ot => ot.value === orderType)?.label}</span></div>
              {price && <div className="flex justify-between"><span className="text-gray-500">{t('trading.price')}</span><span className="text-white font-mono">${price}</span></div>}
              {stopPrice && <div className="flex justify-between"><span className="text-gray-500">{t('trading.stopPrice')}</span><span className="text-white font-mono">${stopPrice}</span></div>}
              <div className="flex justify-between"><span className="text-gray-500">{t('trading.estimatedAmount')}</span><span className="text-[#D4A853] font-mono font-bold">{totalAmount}</span></div>
            </div>
            {isReal && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-xs text-red-400 mb-4">
                ⚠️ {t('trading.liveModeWarning')}
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 px-4 py-2 rounded-lg bg-[#0a0a12] text-gray-400 text-sm hover:text-white transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 px-4 py-2 rounded-lg bg-[#C9A046] hover:bg-[#D4A853] text-black font-medium text-sm transition-colors"
              >
                {submitting ? t('common.submitting') : t('common.confirmSubmit')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
