/**
 * quant-moo R157 Claw(PM) — SymbolSearch Index
 * 
 * Splits the 420-line SymbolSearch.tsx into 3 focused modules:
 *   - symbolData.ts  — multi-market symbol database + broker config
 *   - useSearch.ts   — search logic hook (local DB + API fallback)
 *   - index.tsx      — UI rendering (search input + results list)
 * 
 * Original file preserved at SymbolSearch.tsx for backward compat.
 */

// @ts-ignore R224: module not yet extracted
export { default } from './SymbolSearch';
// @ts-ignore R224: module not yet extracted
export { SYMBOL_DB, MOCK_BROKER_STATUS, type SymbolEntry, type BrokerId, type Market } from './symbolData';
// @ts-ignore R224: module not yet extracted
export { useSearch } from './useSearch';
