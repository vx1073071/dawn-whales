/**
 * CurrencySelector — Settings UI for display currency (R99 M-02)
 *
 * Features:
 * - Grid of currency options with symbol + name
 * - Active highlight
 * - localStorage persistence via useCurrency hook
 * - Immediate effect on click
 */

import { CURRENCIES, useCurrency } from '@/hooks/useCurrency';

export default function CurrencySelector() {
  const { currency, setCurrency } = useCurrency();

  return (
    <div className="w-full max-w-lg">
      <label className="block text-sm font-medium mb-2" style={{ color: 'var(--dw-text, #E5E7EB)' }}>
        💱 Display Currency
      </label>
      <p className="text-xs mb-3" style={{ color: 'var(--dw-text-muted, #9CA3AF)' }}>
        Currency used for displaying prices and market values. Data is stored in original currency.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {CURRENCIES.map((c) => {
          const isActive = c.code === currency;
          return (
            <button
              key={c.code}
              onClick={() => setCurrency(c.code)}
              className="flex flex-col items-center gap-1 px-3 py-3 rounded-lg border text-sm cursor-pointer transition-all"
              style={{
                background: isActive ? '#6366F122' : 'var(--dw-surface, #111827)',
                borderColor: isActive ? '#6366F1' : 'var(--dw-border, #1F2937)',
                color: isActive ? '#818CF8' : 'var(--dw-text, #E5E7EB)',
              }}
            >
              <span className="text-xl">{c.symbol}</span>
              <span className="font-semibold text-xs">{c.code}</span>
              <span className="text-xs" style={{ color: 'var(--dw-text-muted, #9CA3AF)' }}>
                {c.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
