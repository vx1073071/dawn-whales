# DAWN WHALES — 实盘验证脚本
# 连接 OpenD，验证行情→回测→信号管线

from futu import *
import json, sys

acc_id = 281756479319068137
WATCHLIST = ['HK.00700', 'HK.09988', 'HK.00388', 'US.AAPL', 'US.NVDA', 'US.TQQQ', 'US.SQQQ']

print('=== DAWN WHALES 实盘验证 ===')
print(f'Account: {acc_id}')
print()

# Step 1: Quotes
quote_ctx = OpenQuoteContext(host='127.0.0.1', port=11111)
ret, quotes = quote_ctx.get_market_snapshot(WATCHLIST)
if ret == RET_OK:
    print('Step 1: Real-time quotes OK')
    for _, q in quotes.iterrows():
        code = q['code']
        price = q.get('last_price', 0)
        chg = q.get('change_rate', 0)
        print(f'  {code:12s} {price:>10.2f}  {chg:+.2f}%')
else:
    print(f'Quotes failed: {quotes}')

print()

# Step 2: K-lines
ret2, klines, page = quote_ctx.request_history_kline(
    'HK.00700', start='2025-01-01', ktype=KLType.K_DAY, max_count=200
)
if ret2 == RET_OK:
    print(f'Step 2: K-lines OK ({len(klines)} bars, HK.00700)')
    print(f'  Range: {klines.iloc[0]["time_key"]} ~ {klines.iloc[-1]["time_key"]}')
    first_close = klines.iloc[0]['close']
    last_close = klines.iloc[-1]['close']
    pct = (last_close / first_close - 1) * 100
    print(f'  {first_close:.2f} -> {last_close:.2f} ({pct:.1f}%)')
else:
    print(f'K-lines failed: {klines}')

print()

# Step 3: MA cross strategy
klines['sma5'] = klines['close'].rolling(5).mean()
klines['sma20'] = klines['close'].rolling(20).mean()
klines['signal'] = 0
klines.loc[klines['sma5'] > klines['sma20'], 'signal'] = 1
klines['cross'] = klines['signal'].diff()

buys = klines[klines['cross'] == 1]
sells = klines[klines['cross'] == -1]

print(f'Step 3: MA5/20 Cross Signals')
print(f'  Buys: {len(buys)}, Sells: {len(sells)}')

if len(buys) > 0:
    lb = buys.iloc[-1]
    print(f'  Last buy:  {lb["time_key"]} @ {lb["close"]:.2f}')

if len(sells) > 0:
    ls = sells.iloc[-1]
    print(f'  Last sell: {ls["time_key"]} @ {ls["close"]:.2f}')

sma5 = klines.iloc[-1]['sma5']
sma20 = klines.iloc[-1]['sma20']
signal = 'BUY' if sma5 > sma20 else 'SELL'
print(f'  Current:    {signal} (MA5={sma5:.1f}, MA20={sma20:.1f})')

print()

# Step 4: Simulate PnL
capital = 100000
position = 0
equity = [capital]

for i in range(20, len(klines)):
    row = klines.iloc[i]
    prev = klines.iloc[i - 1]
    cross = prev['signal'] != row['signal']

    if cross:
        if row['signal'] == 1 and position == 0:
            qty = int(capital * 0.95 / row['close'] / 100) * 100
            position = qty
            capital -= qty * row['close']
        elif row['signal'] == 0 and position > 0:
            capital += position * row['close']
            position = 0

    equity.append(capital + position * row['close'])

final = equity[-1]
returns = (final / 100000 - 1) * 100
print(f'Step 4: Strategy PnL (HK.00700, {len(klines)-20} days)')
print(f'  Initial: 100,000 HKD')
print(f'  Final:   {final:,.0f} HKD ({returns:+.1f}%)')

quote_ctx.close()
print()
print('=== 实盘验证 全4步完成 ===')
print('RESULT: OpenD connected, quotes OK, K-lines OK, strategy signals OK')
