// ── TradingEasy — QuickTrade () ────────────────────────────────────

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';

interface QuickTradeProps {
  onPlaceOrder?: (order: {code: string;side: 'BUY' | 'SELL';qty: number;price: number;type: 'LIMIT' | 'MARKET';}) => void;
}

export default function QuickTrade({ onPlaceOrder }: QuickTradeProps) {
  const { t } = useTranslation();

  const [code, setCode] = useState('');
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [qty, setQty] = useState('100');
  const [price, setPrice] = useState('');
  const [orderType, setOrderType] = useState<'LIMIT' | 'MARKET'>('LIMIT');
  const [preview, setPreview] = useState(false);

  const total = (parseFloat(qty) || 0) * (parseFloat(price) || 0);

  const handleSubmit = useCallback(() => {
    if (!code || !qty || orderType === 'LIMIT' && !price) return;
    onPlaceOrder?.({
      code: code.toUpperCase(),
      side,
      qty: parseInt(qty),
      price: orderType === 'MARKET' ? 0 : parseFloat(price),
      type: orderType
    });
    setPreview(false);
    setCode('');
    setPrice('');
  }, [code, side, qty, price, orderType, onPlaceOrder]);

  return (
    <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-semibold text-sm">{i18n.t("QuickTrade.r92_471d")}</h2>
        <div className="flex items-center gap-1 bg-[#12121a] rounded-lg p-0.5">
          <button
            onClick={() => setSide('BUY')}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
            side === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'text-gray-400'}`
            }>{i18n.t("QuickTrade.r92_86d2")}


          </button>
          <button
            onClick={() => setSide('SELL')}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
            side === 'SELL' ? 'bg-red-500/20 text-red-400' : 'text-gray-400'}`
            }>{i18n.t("QuickTrade.r92_d4e7")}


          </button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-[10px] text-gray-500 mb-1 block">{t("components.code")}</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={i18n.t('QuickTrade.k0')}
              className="w-full bg-[#12121a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-[#C9A046] focus:outline-none" />
            
          </div>
          <div>
            <label className="text-[10px] text-gray-500 mb-1 block">{t("components.quantity")}</label>
            <input
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              type="number"
              className="w-full bg-[#12121a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[#C9A046] focus:outline-none" />
            
          </div>
          <div>
            <label className="text-[10px] text-gray-500 mb-1 block">{t("components.type")}</label>
            <select
              value={orderType}
              onChange={(e) => setOrderType(e.target.value as any)}
              className="w-full bg-[#12121a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[#C9A046] focus:outline-none">
              
              <option value="LIMIT">{t("components.limitPrice")}</option>
              <option value="MARKET">{t("components.marketPrice")}</option>
            </select>
          </div>
        </div>

        {orderType === 'LIMIT' &&
        <div>
            <label className="text-[10px] text-gray-500 mb-1 block">{t("components.price")}</label>
            <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            type="number"
            step="0.01"
            placeholder="0.00"
            className="w-full bg-[#12121a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-[#C9A046] focus:outline-none" />
          
          </div>
        }

        {total > 0 &&
        <div className="flex items-center justify-between text-xs bg-[#12121a] rounded-lg px-3 py-2">
            <span className="text-gray-500">{i18n.t('QuickTrade.k1')}</span>
            <span className="text-white font-mono font-medium">${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </div>
        }

        <button
          onClick={() => setPreview(true)}
          disabled={!code || !qty || orderType === 'LIMIT' && !price}
          className={`w-full py-2.5 rounded-lg text-sm font-medium transition-colors ${
          side === 'BUY' ?
          'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20' :
          'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20'} disabled:opacity-30 disabled:cursor-not-allowed`
          }>
          
          {side === 'BUY' ? i18n.t('QuickTrade.k1') : i18n.t('QuickTrade.k2')} {code.toUpperCase() || '---'}
        </button>
      </div>

      {/* Preview Modal */}
      {preview &&
      <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setPreview(false)} />
          <div className="relative bg-[#12121a] border border-white/10 rounded-xl p-5 w-full max-w-sm mx-4">
            <h3 className="text-white font-semibold text-sm mb-3">{i18n.t('QuickTrade.k2')}</h3>
            <div className="space-y-2 text-xs mb-4">
              <div className="flex justify-between"><span className="text-gray-500">{t("components.direction")}</span><span className={side === 'BUY' ? 'text-emerald-400' : 'text-red-400'}>{side === 'BUY' ? i18n.t('QuickTrade.k3') : i18n.t('QuickTrade.k4')}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">{t("components.code")}</span><span className="text-white font-mono">{code.toUpperCase()}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">{t("components.quantity")}</span><span className="text-white font-mono">{qty}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">{t("components.price")}</span><span className="text-white font-mono">{orderType === 'MARKET' ? t('components.marketPrice') : `$${parseFloat(price).toFixed(2)}`}</span></div>
              <div className="flex justify-between pt-2 border-t border-white/5"><span className="text-gray-500">{i18n.t('QuickTrade.k3')}</span><span className="text-white font-mono font-bold">${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleSubmit} className={`flex-1 py-2 rounded-lg text-sm font-medium ${side === 'BUY' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>{i18n.t("QuickTrade.r92_f7b1")}
              {side === 'BUY' ? i18n.t('QuickTrade.k5') : i18n.t('QuickTrade.k6')}
              </button>
              <button onClick={() => setPreview(false)} className="px-4 py-2 text-gray-400 text-sm hover:text-gray-200">{t("components.cancel")}</button>
            </div>
          </div>
        </div>
      }
    </div>);

}