import { useState, useEffect } from 'react';
import { getAccounts, placeOrder, cancelOrder, getOrders, getFunds } from '@/lib/bridge-api';
import type { NewOrder, Order, OrderSide, OrderType, Market } from '@/lib/types';

const ORDER_TYPES: { label: string; value: OrderType }[] = [
  { label: '市价单', value: 'MARKET' },
  { label: '限价单', value: 'LIMIT' },
  { label: '止损单', value: 'STOP' },
  { label: '止损限价', value: 'STOP_LIMIT' },
];

const MARKETS: { label: string; value: Market }[] = [
  { label: '美股', value: 'US' },
  { label: '港股', value: 'HK' },
  { label: 'A股', value: 'CN' },
  { label: '新加坡', value: 'SG' },
];

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  PENDING: { label: '待提交', color: 'text-yellow-400' },
  SUBMITTED: { label: '已提交', color: 'text-blue-400' },
  FILLED: { label: '已成交', color: 'text-emerald-400' },
  PARTIAL: { label: '部分成交', color: 'text-orange-400' },
  CANCELLED: { label: '已撤单', color: 'text-gray-400' },
  REJECTED: { label: '已拒绝', color: 'text-red-400' },
};

export default function TradeExecutionPanel() {
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
    if (!code || !qty) { setError('请填写股票代码和数量'); return; }
    if ((orderType === 'LIMIT' || orderType === 'STOP_LIMIT') && !price) {
      setError('限价单需要填写价格'); return;
    }
    if ((orderType === 'STOP' || orderType === 'STOP_LIMIT') && !stopPrice) {
      setError('止损单需要填写止损价'); return;
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
        setError(res?.error || '下单失败');
      }
    } catch (e: any) {
      setError(e.message || '下单失败');
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
    if (orderType === 'MARKET') return q > 0 ? '市价' : '--';
    return q > 0 && p > 0 ? `$${(q * p).toLocaleString()}` : '--';
  })();

  return (
    <div className="p-6 space-y-6 bg-[#0a0a12] min-h-full">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">🚀 交易执行</h1>
          <p className="text-gray-400 text-sm">{isReal ? '实盘模式' : '模拟盘模式'} · 谨慎交易</p>
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
            {isReal ? '🔴 实盘模式' : '🟢 模拟盘模式'}
          </button>
        </div>
      </div>

      {/* Account & Funds */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">账户</div>
          <select
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
            className="w-full bg-[#0a0a12] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#C9A046]"
          >
            {accounts.map((a) => (
              <option key={a.accId} value={a.accId}>{a.accId} ({a.trdEnv === 'REAL' ? '实盘' : '模拟'})</option>
            ))}
          </select>
        </div>
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">可用资金</div>
          <div className="text-xl font-bold font-mono text-white">${funds?.cash.toLocaleString('en-US', { minimumFractionDigits: 2 }) ?? '--'}</div>
        </div>
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">购买力</div>
          <div className="text-xl font-bold font-mono text-white">${funds?.power.toLocaleString('en-US', { minimumFractionDigits: 2 }) ?? '--'}</div>
        </div>
      </div>

      {/* Order Form */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
        <h2 className="text-lg font-semibold text-white mb-4">下单</h2>
        {error && <div className="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">股票代码</label>
            <input
              type="text" value={code} onChange={(e) => setCode(e.target.value)}
              placeholder="如 AAPL"
              className="w-full bg-[#0a0a12] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A046] uppercase"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">市场</label>
            <select
              value={market} onChange={(e) => setMarket(e.target.value as Market)}
              className="w-full bg-[#0a0a12] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#C9A046]"
            >
              {MARKETS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">方向</label>
            <div className="flex gap-2">
              <button
                onClick={() => setSide('BUY')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  side === 'BUY' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-[#0a0a12] text-gray-400 border border-white/10'
                }`}
              >
                买入
              </button>
              <button
                onClick={() => setSide('SELL')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  side === 'SELL' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-[#0a0a12] text-gray-400 border border-white/10'
                }`}
              >
                卖出
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">订单类型</label>
            <select
              value={orderType} onChange={(e) => setOrderType(e.target.value as OrderType)}
              className="w-full bg-[#0a0a12] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#C9A046]"
            >
              {ORDER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">数量</label>
            <input
              type="number" value={qty} onChange={(e) => setQty(e.target.value)}
              placeholder="100"
              className="w-full bg-[#0a0a12] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A046]"
            />
          </div>
          {(orderType === 'LIMIT' || orderType === 'STOP_LIMIT') && (
            <div>
              <label className="text-xs text-gray-500 mb-1 block">限价</label>
              <input
                type="number" value={price} onChange={(e) => setPrice(e.target.value)}
                placeholder="150.00"
                className="w-full bg-[#0a0a12] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A046]"
              />
            </div>
          )}
          {(orderType === 'STOP' || orderType === 'STOP_LIMIT') && (
            <div>
              <label className="text-xs text-gray-500 mb-1 block">止损价</label>
              <input
                type="number" value={stopPrice} onChange={(e) => setStopPrice(e.target.value)}
                placeholder="140.00"
                className="w-full bg-[#0a0a12] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A046]"
              />
            </div>
          )}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">备注</label>
            <input
              type="text" value={remark} onChange={(e) => setRemark(e.target.value)}
              placeholder="策略信号..."
              className="w-full bg-[#0a0a12] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A046]"
            />
          </div>
        </div>
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
          <div className="text-sm text-gray-400">
            预估金额: <span className="text-white font-mono font-bold">{totalAmount}</span>
          </div>
          <button
            onClick={handlePreview}
            className="bg-[#C9A046] hover:bg-[#D4A853] text-black font-medium px-6 py-2 rounded-lg transition-colors"
          >
            预览订单
          </button>
        </div>
      </div>

      {/* Order List */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
        <h2 className="text-lg font-semibold text-white mb-4">当日委托</h2>
        {orders.length === 0 ? (
          <div className="text-gray-500 text-sm text-center py-8">暂无委托</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-gray-500 text-xs uppercase">
                  <th className="px-3 py-2 text-left">时间</th>
                  <th className="px-3 py-2 text-left">代码</th>
                  <th className="px-3 py-2 text-left">方向</th>
                  <th className="px-3 py-2 text-right">数量</th>
                  <th className="px-3 py-2 text-right">价格</th>
                  <th className="px-3 py-2 text-right">成交</th>
                  <th className="px-3 py-2 text-center">状态</th>
                  <th className="px-3 py-2 text-center">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {orders.map((o) => {
                  const status = STATUS_MAP[o.status] || { label: o.status, color: 'text-gray-400' };
                  return (
                    <tr key={o.orderId} className="hover:bg-white/[0.02]">
                      <td className="px-3 py-2 text-gray-400">{o.createTime.split(' ')[1] ?? o.createTime}</td>
                      <td className="px-3 py-2 text-white font-medium">{o.code}</td>
                      <td className={`px-3 py-2 ${o.side === 'BUY' ? 'text-red-400' : 'text-emerald-400'}`}>
                        {o.side === 'BUY' ? '买入' : '卖出'}
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
                            撤单
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
            <h2 className="text-lg font-bold text-white mb-1">确认订单</h2>
            <p className="text-sm text-gray-400 mb-4">请仔细核对以下信息</p>
            <div className="space-y-2 text-sm mb-4">
              <div className="flex justify-between"><span className="text-gray-500">股票</span><span className="text-white font-medium">{code.toUpperCase()}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">方向</span><span className={side === 'BUY' ? 'text-red-400' : 'text-emerald-400'}>{side === 'BUY' ? '买入' : '卖出'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">数量</span><span className="text-white font-mono">{qty}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">类型</span><span className="text-white">{ORDER_TYPES.find(t => t.value === orderType)?.label}</span></div>
              {price && <div className="flex justify-between"><span className="text-gray-500">价格</span><span className="text-white font-mono">${price}</span></div>}
              {stopPrice && <div className="flex justify-between"><span className="text-gray-500">止损价</span><span className="text-white font-mono">${stopPrice}</span></div>}
              <div className="flex justify-between"><span className="text-gray-500">预估金额</span><span className="text-[#D4A853] font-mono font-bold">{totalAmount}</span></div>
            </div>
            {isReal && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-xs text-red-400 mb-4">
                ⚠️ 实盘模式：此订单将使用真实资金执行
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 px-4 py-2 rounded-lg bg-[#0a0a12] text-gray-400 text-sm hover:text-white transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 px-4 py-2 rounded-lg bg-[#C9A046] hover:bg-[#D4A853] text-black font-medium text-sm transition-colors"
              >
                {submitting ? '提交中...' : '确认提交'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
