import sys
sys.stdout.reconfigure(encoding='utf-8')

def check_endings(path):
    with open(path, 'rb') as f:
        data = f.read()
    crlf = data.count(b'\r\n')
    lf = data.count(b'\n') - crlf
    print(f'  {path}: CRLF={crlf}, LF-only={lf}, size={len(data)}')
    return crlf, lf

print('Checking line endings...')
check_endings('src/components/market/MarketPage.tsx')
check_endings('src/components/orders/TradingDeskPage.tsx')
check_endings('src/lib/bridge-api.ts')
check_endings('src/components/market/RealTimeMarketDashboard.tsx')
check_endings('src/components/risk/SentimentDashboardPage.tsx')
check_endings('src/components/settings/PreferencesPage.tsx')
check_endings('src/components/backtest/MonteCarloPage.tsx')
check_endings('src/components/dashboard/DashboardPage.tsx')
check_endings('src/components/portfolio/PortfolioPage.tsx')

# Fix: convert all modified files back to CRLF
print('\nConverting all .ts/.tsx files to CRLF...')
import os
for root, dirs, files in os.walk('src'):
    for fname in files:
        if fname.endswith(('.ts', '.tsx')):
            path = os.path.join(root, fname)
            with open(path, 'rb') as f:
                data = f.read()
            # Normalize to LF first, then convert to CRLF
            data = data.replace(b'\r\n', b'\n').replace(b'\r', b'\n')
            data = data.replace(b'\n', b'\r\n')
            with open(path, 'wb') as f:
                f.write(data)

print('Done converting to CRLF')
check_endings('src/components/market/MarketPage.tsx')
check_endings('src/lib/bridge-api.ts')
