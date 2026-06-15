
/**
 * @deprecated — v17.6 MANDATES pure USDT (no fiat top-up). Points removed entirely.
 * Top-up replaced by on-chain USDT deposit (0% fee, TRC-20/ERC-20) in WalletFullPage (wallet/, R143).
 * This component is a v17.6 VIOLATION and must NOT be routed or rendered.
 * Refer to MEMORY.md v17.6 六-B (充值免费, 充100到100积分). | [DEPRECATED v17.6]
 *
 * PointsTopUpPage — R103 M-01: USDT points top-up flow [VIOLATES v17.6]
 *
 * Features:
 * - Input fiat amount → real-time USDT estimate via ExchangeRateEngine
 * - 6 fiat currencies (HKD/CNY/USD/JPY/EUR/GBP)
 * - Live exchange rate display with source indicator
 * - Confirmation modal before executing top-up
 * - Settlement history timeline with filter + pagination + CSV export
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import TopUpConfirmModal from './TopUpConfirmModal';
import SettlementTimeline from './SettlementTimeline.tsx';
import { useCredits } from '@/hooks/useCredits';
import i18n from '../../i18n';

// Fiat currencies supported for top-up
const FIAT_CURRENCIES = ['HKD', 'CNY', 'USD', 'JPY', 'EUR', 'GBP'] as const;
type FiatCurrency = typeof FIAT_CURRENCIES[number];

const CURRENCY_FLAGS: Record<FiatCurrency, string> = {
  HKD: '🇭🇰', CNY: '🇨🇳', USD: '🇺🇸', JPY: '🇯🇵', EUR: '🇪🇺', GBP: '🇬🇧',
};

// Static fallback rates (matches ExchangeRateEngine STATIC_RATES)
const STATIC_RATES: Record<FiatCurrency, number> = {
  HKD: 0.1277, CNY: 0.1381, USD: 1.0, JPY: 0.00643, EUR: 1.089, GBP: 1.273,
};

const PRESET_AMOUNTS: Record<FiatCurrency, number[]> = {
  HKD: [100, 500, 1000, 5000],
  CNY: [100, 500, 1000, 5000],
  USD: [10, 50, 100, 500],
  JPY: [1000, 5000, 10000, 50000],
  EUR: [10, 50, 100, 500],
  GBP: [10, 50, 100, 500],
};

export default function PointsTopUpPage() {
  const { t: _t } = useTranslation();
  const { balance, addTransaction } = useCredits();

  // ── v17.6 VIOLATION: Fiat top-up is FORBIDDEN. Block render. ──
  // Replaced by: on-chain USDT deposit in WalletFullPage (wallet/, R143)
  return (
    <div style={{ padding: 32, textAlign: 'center', color: '#ef4444' }}>
      <h2>⚠️ This page has been removed (v17.6)</h2>
      <p style={{ color: '#8b949e', fontSize: 13 }}>
        Fiat top-up is no longer supported. Use on-chain USDT deposit instead — visit <strong>Wallet</strong> page.
      </p>
    </div>
  );
}

// ── Original code below (preserved for archaeology) ──
// @ts-nocheck
const _PointsTopUpPage = () => {

  const [currency, setCurrency] = useState<FiatCurrency>('USD');
  const [amount, setAmount] = useState<string>('');
  const [rate, setRate] = useState<number>(STATIC_RATES.USD);
  const [rateSource, setRateSource] = useState<string>('static');
  const [rateTimestamp, setRateTimestamp] = useState<number>(Date.now());
  const [showConfirm, setShowConfirm] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);

  // Fetch live rate
  const fetchRate = useCallback(async (curr: FiatCurrency) => {
    try {
      // Try dynamic import of exchange rate engine
      const { ExchangeRateEngine } = await import('../../../electron/engine/data/exchange-rate-engine');
      const engine = new ExchangeRateEngine();
      const r = await engine.getRate(curr);
      if (r && r > 0) {
        setRate(r);
        setRateSource('live');
        setRateTimestamp(Date.now());
        return;
      }
    } catch {
      // fallback to static
    }
    setRate(STATIC_RATES[curr]);
    setRateSource('static');
    setRateTimestamp(Date.now());
  }, []);

  useEffect(() => {
    fetchRate(currency);
  }, [currency, fetchRate]);

  // Auto-refresh rate every 60s
  useEffect(() => {
    const interval = setInterval(() => fetchRate(currency), 60000);
    return () => clearInterval(interval);
  }, [currency, fetchRate]);

  const numericAmount = parseFloat(amount) || 0;
  const estimatedUSDT = numericAmount * rate;
  const isRateStale = Date.now() - rateTimestamp > 300000; // 5 min

  const handleConfirmTopUp = () => {
    if (numericAmount <= 0) return;
    setShowConfirm(true);
  };

  const handleExecuteTopUp = () => {
    addTransaction({
      type: 'topup',
      amount: estimatedUSDT,
      source: `Top-up ${numericAmount} ${currency}`,
      currency,
      originalAmount: numericAmount,
    });
    setShowConfirm(false);
    setAmount('');
  };

  const handleExportCSV = () => {
    // Delegate to SettlementTimeline
    const event = new CustomEvent('export-settlement-csv');
    window.dispatchEvent(event);
  };

  return (
    <div className="space-y-4">
      {/* Top-up Card */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-6">
        <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
          <span>💰</span> {i18n.t('credits.topUp') || 'Top Up Credits'}
        </h2>

        {/* Current balance */}
        <div className="flex items-center justify-between mb-6 p-3 bg-[#0f0f18] rounded-lg border border-white/5">
          <span className="text-gray-400 text-sm">{i18n.t('credits.balance') || 'Balance'}</span>
          <span className="text-[#D4A853] font-bold font-mono text-lg tabular-nums">
            {balance.toFixed(6)} <span className="text-xs">USDT</span>
          </span>
        </div>

        {/* Currency selector */}
        <div className="mb-4">
          <label className="text-gray-400 text-xs block mb-2">
            {i18n.t('credits.currency') || 'Currency'}
          </label>
          <div className="flex gap-2 flex-wrap">
            {FIAT_CURRENCIES.map(c => (
              <button
                key={c}
                onClick={() => setCurrency(c)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  currency === c
                    ? 'bg-[#D4A853]/20 text-[#D4A853] border border-[#D4A853]/50'
                    : 'bg-[#0f0f18] text-gray-400 border border-white/5 hover:border-white/20'
                }`}
              >
                <span>{CURRENCY_FLAGS[c]}</span>
                <span>{c}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Amount input */}
        <div className="mb-4">
          <label className="text-gray-400 text-xs block mb-2">
            {i18n.t('credits.amount') || 'Amount'}
          </label>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              min="0"
              step="any"
              className="w-full bg-[#0f0f18] border border-white/10 rounded-lg px-4 py-3 text-white text-lg font-mono focus:outline-none focus:border-[#D4A853]/50 transition-colors"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
              {currency}
            </span>
          </div>
          {/* Preset amounts */}
          <div className="flex gap-2 mt-2 flex-wrap">
            {PRESET_AMOUNTS[currency].map(preset => (
              <button
                key={preset}
                onClick={() => setAmount(String(preset))}
                className="px-3 py-1 rounded-md bg-white/5 text-gray-400 text-xs hover:bg-white/10 hover:text-white transition-colors"
              >
                {preset.toLocaleString()}
              </button>
            ))}
          </div>
        </div>

        {/* Exchange rate display */}
        <div className="mb-4 p-3 bg-[#0f0f18] rounded-lg border border-white/5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">
              {i18n.t('credits.exchangeRate') || 'Exchange Rate'}
              {isRateStale && (
                <span className="text-yellow-400 ml-1">⚠️ {i18n.t('credits.stale') || 'Stale'}</span>
              )}
            </span>
            <span className={`font-mono ${rateSource === 'live' ? 'text-green-400' : 'text-gray-400'}`}>
              1 {currency} = {rate.toFixed(6)} USDT
              <span className="text-[9px] ml-1 opacity-60">
                ({rateSource === 'live' ? '🟢 Live' : '⚪ Static'})
              </span>
            </span>
          </div>
        </div>

        {/* USDT estimate */}
        <div className="mb-6 p-4 bg-gradient-to-r from-[#D4A853]/10 to-[#D4A853]/5 rounded-lg border border-[#D4A853]/20">
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-sm">
              {i18n.t('credits.estimatedUSDT') || 'Estimated USDT'}
            </span>
            <div className="text-right">
              <div className="text-[#D4A853] font-bold font-mono text-xl tabular-nums">
                {estimatedUSDT.toFixed(6)}
              </div>
              <div className="text-gray-500 text-[10px]">
                {numericAmount > 0 ? `${numericAmount} ${currency} × ${rate.toFixed(6)}` : '—'}
              </div>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleConfirmTopUp}
            disabled={numericAmount <= 0}
            className="flex-1 py-3 rounded-lg bg-[#D4A853] text-[#0a0a10] font-bold text-sm hover:bg-[#D4A853]/90 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            {i18n.t('credits.confirmTopUp') || 'Confirm Top Up'}
          </button>
          <button
            onClick={() => fetchRate(currency)}
            className="px-4 py-3 rounded-lg bg-white/5 text-gray-400 text-sm hover:bg-white/10 hover:text-white transition-colors"
            title={i18n.t('credits.refreshRate') || 'Refresh Rate'}
          >
            🔄
          </button>
        </div>
      </div>

      {/* Settlement History */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <h2 className="text-white font-semibold flex items-center gap-2">
            <span>📜</span> {i18n.t('credits.settlementHistory') || 'Settlement History'}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTimeline(!showTimeline)}
              className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-white/5 transition-colors"
            >
              {showTimeline ? '▲ Collapse' : '▼ Expand'}
            </button>
            <button
              onClick={handleExportCSV}
              className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-white/5 transition-colors flex items-center gap-1"
            >
              <span>📊</span> CSV
            </button>
          </div>
        </div>
        {showTimeline && <SettlementTimeline />}
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <TopUpConfirmModal
          currency={currency}
          amount={numericAmount}
          rate={rate}
          estimatedUSDT={estimatedUSDT}
          rateSource={rateSource}
          onConfirm={handleExecuteTopUp}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  );
};

// Original component archived — DO NOT USE
void _PointsTopUpPage;
