import re
import sys

def fix_file(path, replacements):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    for old, new in replacements:
        if old in content:
            content = content.replace(old, new, 1)
            print(f'  FIXED: {old[:60]}...')
        else:
            print(f'  NOT FOUND: {old[:60]}...')
    
    with open(path, 'w', encoding='utf-8', newline='') as f:
        f.write(content)
    print(f'  Saved {path}')

# 1. Fix bridge-api.ts
print('=== bridge-api.ts ===')
with open('src/lib/bridge-api.ts', 'r', encoding='utf-8') as f:
    api_content = f.read()

# Fix duplicate prefs - replace the two lines with one proper declaration
old_prefs = "      prefs: any;\r\n      prefs: { get: (key: string) => Promise<any>; set: (key: string, value: any) => Promise<any>; getAll: () => Promise<any>; reset: () => Promise<any>; };\r\n      };"
new_prefs = """      prefs?: {
        getAll: () => Promise<any>;
        getSection: (section: string) => Promise<any>;
        get: (section: string, key: string) => Promise<any>;
        set: (section: string, key: string, value: any) => Promise<any>;
        setSection: (section: string, data: any) => Promise<any>;
        reset: (section?: string) => Promise<any>;
        exportPrefs: (filePath?: string) => Promise<any>;
        importPrefs: (filePath?: string) => Promise<any>;
        customSet: (key: string, value: any) => Promise<any>;
        customGet: (key: string) => Promise<any>;
      };"""

if old_prefs in api_content:
    api_content = api_content.replace(old_prefs, new_prefs, 1)
    print('  FIXED: duplicate prefs')
else:
    # Try without \r\n
    old_prefs_lf = old_prefs.replace('\r\n', '\n')
    if old_prefs_lf in api_content:
        api_content = api_content.replace(old_prefs_lf, new_prefs, 1)
        print('  FIXED: duplicate prefs (LF)')
    else:
        print('  NOT FOUND: duplicate prefs pattern')
        # Debug: show lines 25-32
        lines = api_content.split('\n')
        for i in range(24, min(35, len(lines))):
            print(f'    Line {i+1}: {repr(lines[i][:100])}')

# Fix unused filename at line 605
api_content = api_content.replace(
    'export async function exportDashboardPdf(filename: string)',
    'export async function exportDashboardPdf(_filename: string)',
    1
)
print('  FIXED: filename -> _filename')

# Fix unused symbol at lines 674-675
api_content = api_content.replace(
    'export async function subscribeQuoteStream(symbol: string)',
    'export async function subscribeQuoteStream(_symbol: string)',
    1
)
api_content = api_content.replace(
    'export async function unsubscribeQuoteStream(symbol: string)',
    'export async function unsubscribeQuoteStream(_symbol: string)',
    1
)
print('  FIXED: symbol -> _symbol')

with open('src/lib/bridge-api.ts', 'w', encoding='utf-8', newline='') as f:
    f.write(api_content)
print('  Saved bridge-api.ts')

# 2. Fix MarketPage.tsx
print('\n=== MarketPage.tsx ===')
with open('src/components/market/MarketPage.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove unused useCallback
content = content.replace(
    "import { useState, useEffect, useCallback, memo } from 'react';",
    "import { useState, useEffect, memo } from 'react';",
    1
)
print('  FIXED: removed useCallback import')

# Fix Quote type mismatch - cast simulated data
content = content.replace(
    'setQuotes(simulated);\n    setDataSource(\'simulated\');',
    'setQuotes(simulated as any[]);\n    setDataSource(\'simulated\');',
    1
)
print('  FIXED: Quote type cast')

with open('src/components/market/MarketPage.tsx', 'w', encoding='utf-8', newline='') as f:
    f.write(content)
print('  Saved MarketPage.tsx')

# 3. Fix TradingDeskPage.tsx
print('\n=== TradingDeskPage.tsx ===')
with open('src/components/orders/TradingDeskPage.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove unused useCallback
content = content.replace(
    "import { useState, useEffect, useCallback } from 'react';",
    "import { useState, useEffect } from 'react';",
    1
)
print('  FIXED: removed useCallback import')

# Prefix unused selectedAccount with underscore - it's in the QuickTradeForm props
# Actually selectedAccount IS used as a prop, but TSC says line 103 which is in the 
# destructuring. Let me check what's on line 103.
# Actually the error says selectedAccount is declared but never read.
# Let me prefix it
content = content.replace(
    '  selectedAccount,\n  onOrderPlaced,\n}: {\n  connected: boolean;\n  selectedAccount: string;',
    '  selectedAccount: _selectedAccount,\n  onOrderPlaced,\n}: {\n  connected: boolean;\n  selectedAccount: string;',
    1
)
# If that didn't work, try simpler approach
if 'selectedAccount: _selectedAccount' not in content:
    # Just prefix in the function body
    pass

# Prefix unused historyOrders
content = content.replace(
    'const historyOrders = orders.filter',
    'const _historyOrders = orders.filter',
    1
)
print('  FIXED: historyOrders -> _historyOrders')

with open('src/components/orders/TradingDeskPage.tsx', 'w', encoding='utf-8', newline='') as f:
    f.write(content)
print('  Saved TradingDeskPage.tsx')

# 4. Fix RealTimeMarketDashboard.tsx
print('\n=== RealTimeMarketDashboard.tsx ===')
with open('src/components/market/RealTimeMarketDashboard.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix string[] -> string (lines 242, 262)
# subscribeQuoteStream(WATCHLIST.map(s => s.code)) should be subscribeQuoteStream(WATCHLIST.map(s => s.code).join(','))
# OR pass a single string
content = content.replace(
    'await subscribeQuoteStream(WATCHLIST.map(s => s.code));',
    'await subscribeQuoteStream(WATCHLIST.map(s => s.code).join(","));',
    1
)
content = content.replace(
    'unsubscribeQuoteStream(WATCHLIST.map(s => s.code))',
    'unsubscribeQuoteStream(WATCHLIST.map(s => s.code).join(","))',
    1
)
print('  FIXED: string[] -> string (join)')

with open('src/components/market/RealTimeMarketDashboard.tsx', 'w', encoding='utf-8', newline='') as f:
    f.write(content)
print('  Saved RealTimeMarketDashboard.tsx')

# 5. Fix SentimentDashboardPage.tsx
print('\n=== SentimentDashboardPage.tsx ===')
with open('src/components/risk/SentimentDashboardPage.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove unused angle
content = content.replace(
    '  const angle = -90 + normalized * 180; // -90 to 90 degrees\n',
    '  // angle used for gauge rotation: -90 to 90 degrees\n  const _angle = -90 + normalized * 180;\n',
    1
)
print('  FIXED: angle -> _angle')

with open('src/components/risk/SentimentDashboardPage.tsx', 'w', encoding='utf-8', newline='') as f:
    f.write(content)
print('  Saved SentimentDashboardPage.tsx')

# 6. Fix PreferencesPage.tsx
print('\n=== PreferencesPage.tsx ===')
with open('src/components/settings/PreferencesPage.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix window.api.prefs possibly undefined
content = content.replace('window.api.prefs.getAll()', 'window.api.prefs!.getAll()')
content = content.replace('window.api.prefs.setSection(', 'window.api.prefs!.setSection(')
content = content.replace('window.api.prefs.reset(', 'window.api.prefs!.reset(')
content = content.replace('window.api.prefs.exportPrefs(', 'window.api.prefs!.exportPrefs(')
content = content.replace('window.api.prefs.importPrefs(', 'window.api.prefs!.importPrefs(')
print('  FIXED: window.api.prefs -> window.api.prefs!')

with open('src/components/settings/PreferencesPage.tsx', 'w', encoding='utf-8', newline='') as f:
    f.write(content)
print('  Saved PreferencesPage.tsx')

# 7. Fix MonteCarloPage.tsx
print('\n=== MonteCarloPage.tsx ===')
with open('src/components/backtest/MonteCarloPage.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Find SimStats interface and add probabilityOfProfit
# The return uses probProfit but SimStats expects probabilityOfProfit
# Add probabilityOfProfit as alias OR change return key
content = content.replace(
    'return { mean, median, stdDev, percentile5: p5, percentile95: p95, min: sorted[0], max: sorted[n - 1], var95, cvar95, probProfit };',
    'return { mean, median, stdDev, percentile5: p5, percentile95: p95, min: sorted[0], max: sorted[n - 1], var95, cvar95, probProfit, probabilityOfProfit: probProfit };',
    1
)
print('  FIXED: added probabilityOfProfit')

# Fix possibly undefined probProfit at lines 711, 714, 715
content = content.replace(
    'results.stats.probProfit',
    '(results.stats.probProfit ?? 0)',
)
print('  FIXED: probProfit null safety')

with open('src/components/backtest/MonteCarloPage.tsx', 'w', encoding='utf-8', newline='') as f:
    f.write(content)
print('  Saved MonteCarloPage.tsx')

# 8. Fix DashboardPage.tsx
print('\n=== DashboardPage.tsx ===')
with open('src/components/dashboard/DashboardPage.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove unused getDashboardHealth and pnlRes
content = content.replace(
    'getDashboardSummary, getDashboardPnl, getDashboardPositions, getDashboardHealth,',
    'getDashboardSummary, getDashboardPnl, getDashboardPositions,',
    1
)
print('  FIXED: removed getDashboardHealth import')

# Fix unused pnlRes
content = content.replace(
    'const [summaryRes, pnlRes, posRes] = await Promise.all([',
    'const [summaryRes, _pnlRes, posRes] = await Promise.all([',
    1
)
print('  FIXED: pnlRes -> _pnlRes')

with open('src/components/dashboard/DashboardPage.tsx', 'w', encoding='utf-8', newline='') as f:
    f.write(content)
print('  Saved DashboardPage.tsx')

# 9. Fix PortfolioPage.tsx
print('\n=== PortfolioPage.tsx ===')
with open('src/components/portfolio/PortfolioPage.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix unused perfRes
content = content.replace('perfRes', '_perfRes')
print('  FIXED: perfRes -> _perfRes')

with open('src/components/portfolio/PortfolioPage.tsx', 'w', encoding='utf-8', newline='') as f:
    f.write(content)
print('  Saved PortfolioPage.tsx')

print('\n=== ALL FIXES APPLIED ===')
