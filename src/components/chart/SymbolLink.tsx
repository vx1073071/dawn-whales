// ── R123-M04 SymbolLink — 全局标的可点击链接 ──────────────────────────────
// PM: 所有面板中展示symbol的地方做成可点击链接
// 点击 → ChartStore.setSymbol() + ChartContext.setSymbol() → 全局同步
// R221: 已接入ChartContext双向同步

import { useCallback, ReactNode } from 'react';
import { useChartStore, Market } from '../store/ChartStore';
import { useChartSync } from '../../lib/chart/ChartContextMigration';

export interface SymbolLinkProps {
  symbol: string;
  market?: Market;
  /** Custom children — if not provided, shows the symbol string */
  children?: ReactNode;
  /** CSS class for the link wrapper */
  className?: string;
  /** If true, also copies symbol to clipboard on click */
  copyOnClick?: boolean;
  /** Called after setSymbol */
  onClick?: (symbol: string) => void;
}

/**
 * Clickable symbol link that syncs to global ChartStore.
 * Usage: <SymbolLink symbol="BTC-USDT" market="crypto" />
 */
export function SymbolLink({
  symbol,
  market,
  children,
  className = '',
  copyOnClick = true,
  onClick,
}: SymbolLinkProps) {
  const setSymbolStore = useChartStore((s) => s.setSymbol);
  const setMarketStore = useChartStore((s) => s.setMarket);
  const { setSymbol: setSymbolCtx, setMarket: setMarketCtx } = useChartSync();

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    // 双向同步: zustand store + React context
    setSymbolStore(symbol);
    setSymbolCtx(symbol);
    if (market) {
      setMarketStore(market);
      setMarketCtx(market);
    }
    if (copyOnClick) {
      navigator.clipboard.writeText(symbol).catch(() => {});
    }
    onClick?.(symbol);
  }, [symbol, market, setSymbolStore, setSymbolCtx, setMarketStore, setMarketCtx, copyOnClick, onClick]);

  const baseClass = 'cursor-pointer hover:text-[#58a6ff] transition-colors';

  return (
    <span
      className={`${baseClass} ${className}`}
      onClick={handleClick}
      title={`点击查看 ${symbol} K线图 (已复制到剪贴板)`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') handleClick(e as any); }}
    >
      {children || symbol}
    </span>
  );
}

/**
 * Clickable price display. Copies price on click.
 */
export function PriceLink({
  price,
  decimals = 2,
  className = '',
}: {
  price: number;
  decimals?: number;
  className?: string;
}) {
  const handleClick = useCallback(() => {
    navigator.clipboard.writeText(price.toFixed(decimals)).catch(() => {});
  }, [price, decimals]);

  return (
    <span
      className={`cursor-pointer hover:opacity-80 transition-opacity font-mono ${className}`}
      onClick={handleClick}
      title={`已复制: ${price.toFixed(decimals)}`}
    >
      {price.toFixed(decimals)}
    </span>
  );
}

/**
 * Combined symbol + price chip for quick display.
 */
export function SymbolChip({
  symbol,
  price,
  changePct,
  market,
  className = '',
}: {
  symbol: string;
  price?: number;
  changePct?: number;
  market?: Market;
  className?: string;
}) {
  const setSymbolStore = useChartStore((s) => s.setSymbol);
  const setMarketStore = useChartStore((s) => s.setMarket);
  const { setSymbol: setSymbolCtx, setMarket: setMarketCtx } = useChartSync();

  const handleClick = useCallback(() => {
    setSymbolStore(symbol);
    setSymbolCtx(symbol);
    if (market) {
      setMarketStore(market);
      setMarketCtx(market);
    }
    navigator.clipboard.writeText(symbol).catch(() => {});
  }, [symbol, market, setSymbolStore, setSymbolCtx, setMarketStore, setMarketCtx]);

  const isUp = changePct != null && changePct >= 0;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-[#1c2333] text-xs cursor-pointer hover:border-[#30363d] hover:bg-[#161b22] transition-all ${className}`}
      onClick={handleClick}
      title={`点击查看 ${symbol}`}
      role="button"
      tabIndex={0}
    >
      <span className="font-bold text-[#c9d1d9]">{symbol}</span>
      {price != null && (
        <span className={`font-mono ${isUp ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
          {price < 1 ? price.toFixed(4) : price.toFixed(2)}
        </span>
      )}
      {changePct != null && (
        <span className={`font-mono text-[10px] ${isUp ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
          {isUp ? '+' : ''}{changePct.toFixed(2)}%
        </span>
      )}
    </span>
  );
}

export default SymbolLink;
