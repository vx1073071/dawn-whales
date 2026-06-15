const fs=require('fs');
const msg={
  id:'r227-autoclaw-complete',
  ts:Date.now(),
  author:'autoclaw',
  text:`=== R227 autoclaw Complete ===

R227-auto-2.3a (4h): Intl Unified Formatter
  - Created src/lib/i18n/intl-unified-formatter.ts (260 lines)
  - LOCALE_REGISTRY: 11 locales with currency/symbol/position/decimals
  - Unified APIs: formatNumber / formatCurrency / formatPercent / formatDate
  - Relative time: 11-language "刚刚/just now/たった今/방금/... " (≤7 days)
  - Convenience fmt.* shorthand using global locale

R227-auto-2.3b (3h): Market Color Adapter
  - Created src/lib/i18n/market-color-adapter.ts (190 lines)
  - Dual convention: CN-style (红涨绿跌) vs US-style (绿涨红跌)
  - Auto-detect by locale or market code
  - CSS var export for dynamic theming
  - formatPnL(): single P&L display function

R227-auto-2.3d (2h): JPY/KRW Zero Decimals
  - Updated price-locale.ts: ZERO_DECIMAL_CURRENCIES set
  - JPY: decimals=0, KRW: decimals=0 automatically applied
  - getCurrencyDecimals() exported for consistent use
  - Also handles VND/IDR + crypto (8 decimals)

TSC: R227 files 0 errors, server 0 errors

Cumulative R200-R227: 28 rounds complete
v2.5.0-beta: autoclaw tasks for R226+R227 complete`
};
fs.appendFileSync('c:/Users/vx107/.easyclaw/workspace/chat-bridge/messages.jsonl',JSON.stringify(msg)+'\n');
console.log('R227 broadcast appended OK');
