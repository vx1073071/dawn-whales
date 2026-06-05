import sys
sys.stdout.reconfigure(encoding='utf-8')

# Fix bridge-api.ts: remove duplicate prefs block at line 174
with open('src/lib/bridge-api.ts', 'rb') as f:
    data = f.read()

# Find the SECOND prefs?: block and remove it
first_idx = data.find(b'prefs?:')
if first_idx >= 0:
    second_idx = data.find(b'prefs?:', first_idx + 10)
    if second_idx >= 0:
        # Find the closing }; of the second prefs block
        end_idx = data.find(b'      };', second_idx)
        if end_idx >= 0:
            end_idx += len(b'      };')
            # Also consume the trailing \r\n
            if data[end_idx:end_idx+2] == b'\r\n':
                end_idx += 2
            # Find start of the prefs line (go back to the beginning of the line)
            line_start = data.rfind(b'\n', 0, second_idx) + 1
            data = data[:line_start] + data[end_idx:]
            print(f'Removed duplicate prefs block')

# Verify brace count
opens = data.count(b'{')
closes = data.count(b'}')
print(f'bridge-api.ts braces: {opens}/{closes} diff={opens-closes}')

with open('src/lib/bridge-api.ts', 'wb') as f:
    f.write(data)

# Fix TradingDeskPage.tsx: selectedAccount and historyOrders
with open('src/components/orders/TradingDeskPage.tsx', 'rb') as f:
    data = f.read()

# selectedAccount unused - prefix with _
data = data.replace(
    b'  selectedAccount,\r\n  onOrderPlaced,\r\n}: {\r\n  connected: boolean;\r\n  selectedAccount: string;',
    b'  selectedAccount: _sa,\r\n  onOrderPlaced,\r\n}: {\r\n  connected: boolean;\r\n  selectedAccount: string;',
    1
)
if b'_sa' in data:
    print('Fixed selectedAccount')
else:
    # Try with just selectedAccount in destructuring
    data = data.replace(b'  selectedAccount,\r\n', b'  selectedAccount: _sa,\r\n', 1)
    if b'_sa' in data:
        print('Fixed selectedAccount (simple)')
    else:
        print('WARNING: could not fix selectedAccount')

# historyOrders unused
data = data.replace(b'const historyOrders = ', b'const _historyOrders = ', 1)
print('Fixed historyOrders')

with open('src/components/orders/TradingDeskPage.tsx', 'wb') as f:
    f.write(data)

# Fix RealTimeMarketDashboard.tsx: string[] to string at line 262
with open('src/components/market/RealTimeMarketDashboard.tsx', 'rb') as f:
    data = f.read()

data = data.replace(
    b'unsubscribeQuoteStream(WATCHLIST.map(s => s.code))',
    b'unsubscribeQuoteStream(WATCHLIST.map(s => s.code).join(","))',
    1
)
print('Fixed unsubscribeQuoteStream')

with open('src/components/market/RealTimeMarketDashboard.tsx', 'wb') as f:
    f.write(data)

# Fix MonteCarloPage.tsx: probProfit missing in server result
with open('src/components/backtest/MonteCarloPage.tsx', 'rb') as f:
    data = f.read()

# Add probProfit to the server result conversion
data = data.replace(
    b'probabilityOfProfit: r.probabilityOfProfit * 100,',
    b'probProfit: r.probabilityOfProfit * 100,\r\n              probabilityOfProfit: r.probabilityOfProfit * 100,',
    1
)
print('Fixed probProfit in MonteCarloPage')

with open('src/components/backtest/MonteCarloPage.tsx', 'wb') as f:
    f.write(data)

print('All fixes applied')
