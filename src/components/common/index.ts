// ── Common UI Components ──────────────────────────────────────────────────
export { default as LoadingSpinner } from './LoadingSpinner';
export { default as ErrorBoundary } from './ErrorBoundary';
export { default as GlobalLoading } from './GlobalLoading';
export { default as ErrorFallback } from './ErrorFallback';
export { default as EmptyState } from './EmptyState';
// R99-R100: i18n formatting + market display
export { default as PriceDisplay, formatPrice, formatMarketCap } from './PriceDisplay';
export { default as MarketBadge, getMarketTradingStatus, getMarketConfig } from './MarketBadge';
export type { TradingStatus } from './MarketBadge';
export { default as StockCodeDisplay, normalizeStockCode } from './StockCodeDisplay';
export { default as TradingStatusIndicator } from './TradingStatusIndicator';
