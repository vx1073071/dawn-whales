/**
 * StockCodeDisplay — Standardized stock code display (R100 M-01)
 *
 * Displays stock codes with market-aware formatting:
 *   US: "AAPL" (no prefix)
 *   HK: "0700.HK" or "00700"
 *   CN: "600519.SH" / "000001.SZ"
 *   JP: "7203.T"
 *   UK: "SHEL.L"
 *   EU: "MC.PA"
 */

export interface StockCodeDisplayProps {
  code: string;
  market?: string; // 'US' | 'HK' | 'CN' | 'JP' | 'UK' | 'EU'
  showMarket?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

// Market-specific code display config

/**
 * Normalize a stock code to { market, ticker, display } format.
 * Handles: "AAPL" → US, "0700.HK" → HK, "00700" → HK, "600519.SH" → CN, etc.
 */
export function normalizeStockCode(code: string): { market: string; ticker: string; display: string } {
  const clean = code.trim().toUpperCase();

  // Already has suffix: "0700.HK", "600519.SH", "7203.T"
  if (clean.includes('.')) {
    const [ticker, suffix] = clean.split('.');
    if (suffix === 'HK') return { market: 'HK', ticker, display: `${ticker}.HK` };
    if (suffix === 'SH') return { market: 'CN', ticker, display: `${ticker}.SH` };
    if (suffix === 'SZ') return { market: 'CN', ticker, display: `${ticker}.SZ` };
    if (suffix === 'T') return { market: 'JP', ticker, display: `${ticker}.T` };
    if (suffix === 'L') return { market: 'UK', ticker, display: `${ticker}.L` };
    if (suffix === 'PA') return { market: 'EU', ticker, display: `${ticker}.PA` };
    return { market: 'US', ticker: clean, display: clean };
  }

  // Numeric code → infer market by pattern
  if (/^\d+$/.test(clean)) {
    // HK: 5-digit codes (00700, 09988, 02318)
    if (clean.length === 5 || (clean.length <= 5 && clean.startsWith('0'))) {
      const padded = clean.padStart(5, '0');
      return { market: 'HK', ticker: padded, display: `${padded}.HK` };
    }
    // CN Shanghai: starts with 6 (600519, 601318)
    if (clean.startsWith('6') && clean.length === 6) {
      return { market: 'CN', ticker: clean, display: `${clean}.SH` };
    }
    // CN Shenzhen: starts with 0 or 3 (000001, 300750)
    if ((clean.startsWith('0') || clean.startsWith('3')) && clean.length === 6) {
      return { market: 'CN', ticker: clean, display: `${clean}.SZ` };
    }
    // JP: 4-digit codes (7203, 6758)
    if (clean.length === 4) {
      return { market: 'JP', ticker: clean, display: `${clean}.T` };
    }
    // KR: 6-digit codes starting with 0 (005930 Samsung)
    if (clean.length === 6 && clean.startsWith('0')) {
      return { market: 'KR', ticker: clean, display: clean };
    }
  }

  // Default: US-style ticker
  return { market: 'US', ticker: clean, display: clean };
}

export default function StockCodeDisplay({
  code,
  market: overrideMarket,
  showMarket = false,
  size = 'md',
  className = '',
}: StockCodeDisplayProps) {
  const normalized = normalizeStockCode(code);
  const displayMarket = overrideMarket || normalized.market;
  const fontSize = size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-base' : 'text-sm';

  return (
    <span className={`inline-flex items-center gap-1 font-mono ${fontSize} ${className}`}>
      <span className="font-semibold" style={{ color: 'var(--dw-text, #E5E7EB)' }}>
        {normalized.ticker}
      </span>
      {showMarket && normalized.display !== normalized.ticker && (
        <span className="text-xs" style={{ color: 'var(--dw-text-muted, #9CA3AF)' }}>
          {normalized.display.replace(normalized.ticker, '')}
        </span>
      )}
      {showMarket && (
        <span className="text-xs px-1 py-0.5 rounded" style={{ background: '#6366F122', color: '#818CF8' }}>
          {displayMarket}
        </span>
      )}
    </span>
  );
}
