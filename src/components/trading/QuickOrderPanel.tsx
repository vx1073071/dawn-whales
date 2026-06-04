import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { placeOrder } from '@/lib/bridge-api';

export default function QuickOrderPanel({ symbol, price }: { symbol?: string; price?: number }) {
  const { t } = useTranslation();
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [qty, setQty] = useState(100);
  const [orderType, setOrderType] = useState<'LIMIT' | 'MARKET'>('LIMIT');
  const [orderPrice, setOrderPrice] = useState(price || 0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; msg: string } | null>(null);

  async function handleSubmit() {
    if (!symbol) return;
    setSubmitting(true);
    setResult(null);
    try {
      const res = await placeOrder({
        code: symbol,
        side,
        qty,
        price: orderType === 'LIMIT' ? orderPrice : 0,
        orderType,
      });
      setResult({ success: res?.success, msg: res?.success ? t('trading.orderSubmitted') : (res?.error || t('common.unknownError')) });
    } catch (e: any) {
      setResult({ success: false, msg: e?.message || t('common.loadingFailed') });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-[#1a1a25] border border-white/5 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-white/5">
        <h3 className="text-sm font-medium text-white">{t('trading.quickOrder')}</h3>
      </div>
      <div className="p-4 space-y-3">
        {symbol && <div className="text-xs text-gray-500">{symbol} @ ${price?.toFixed(2) || '--'}</div>}

        <div className="flex gap-1">
          <button
            onClick={() => setSide('BUY')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${side === 'BUY' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-[#12121a] text-gray-400'}`}
          >
            {t('trading.buy')}
          </button>
          <button
            onClick={() => setSide('SELL')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${side === 'SELL' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-[#12121a] text-gray-400'}`}
          >
            {t('trading.sell')}
          </button>
        </div>

        <div className="flex gap-1">
          <button
            onClick={() => setOrderType('LIMIT')}
            className={`flex-1 py-1.5 rounded text-xs transition-colors ${orderType === 'LIMIT' ? 'bg-[#C9A046]/20 text-[#C9A046]' : 'bg-[#12121a] text-gray-400'}`}
          >
            {t('trading.limitOrder')}
          </button>
          <button
            onClick={() => setOrderType('MARKET')}
            className={`flex-1 py-1.5 rounded text-xs transition-colors ${orderType === 'MARKET' ? 'bg-[#C9A046]/20 text-[#C9A046]' : 'bg-[#12121a] text-gray-400'}`}
          >
            {t('trading.marketOrder')}
          </button>
        </div>

        {orderType === 'LIMIT' && (
          <input
            type="number"
            value={orderPrice}
            onChange={(e) => setOrderPrice(parseFloat(e.target.value))}
            placeholder={t('trading.price')}
            className="w-full bg-[#12121a] border border-white/5 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#C9A046]/50"
          />
        )}

        <input
          type="number"
          value={qty}
          onChange={(e) => setQty(parseInt(e.target.value))}
          placeholder={t('trading.quantity')}
          className="w-full bg-[#12121a] border border-white/5 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#C9A046]/50"
        />

        <button
          onClick={handleSubmit}
          disabled={submitting || !symbol}
          className={`w-full py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 ${
            side === 'BUY' ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
          }`}
        >
          {submitting ? t('common.loading') : `${side === 'BUY' ? t('trading.buy') : t('trading.sell')} ${qty} ${symbol?.split('.')[1] || ''}`}
        </button>

        {result && (
          <div className={`text-xs ${result.success ? 'text-emerald-400' : 'text-red-400'}`}>{result.msg}</div>
        )}
      </div>
    </div>
  );
}
