# DAWN WHALES — 回测压力测试 (主账户 281756477617822986)
# 验证引擎在大量K线数据下的响应时间

from futu import *
import time

acc_id = 281756477617822986
quote_ctx = OpenQuoteContext(host='127.0.0.1', port=11111)

# 测试品种
symbols = ['HK.03417', 'HK.07500', 'HK.07200', 'HK.03416', 'US.SQQQ', 'US.TQQQ', 'US.SOXL']
results = []

print('=== DAWN WHALES 回测压力测试 ===')
print(f'Account: {acc_id}')
print()

for symbol in symbols:
    for count in [200, 500, 1000]:
        try:
            start = time.time()
            ret, klines, page = quote_ctx.request_history_kline(
                symbol, start='2020-01-01', ktype=KLType.K_DAY, max_count=count
            )
            elapsed = (time.time() - start) * 1000

            if ret == RET_OK:
                results.append({
                    'symbol': symbol,
                    'count': count,
                    'actual': len(klines),
                    'time_ms': round(elapsed, 1),
                    'status': 'OK'
                })
                close_vals = klines['close'].values
                pct = (close_vals[-1] / close_vals[0] - 1) * 100
                print(f'  {symbol:12s} x{count:4d} → {len(klines):4d} bars  {elapsed:6.1f}ms  ({pct:+.1f}%)')
            else:
                results.append({'symbol': symbol, 'count': count, 'actual': 0, 'time_ms': 0})
                print(f'  {symbol:12s} x{count:4d} → FAILED')
        except Exception as e:
            print(f'  {symbol:12s} x{count:4d} → ERROR: {e}')

print()

# Summary
ok_count = sum(1 for r in results if r['status'] == 'OK')
avg_time = sum(r['time_ms'] for r in results if r['status'] == 'OK') / max(1, ok_count)
max_time = max((r['time_ms'] for r in results if r['status'] == 'OK'), default=0)
print(f'=== Summary ===')
print(f'  Total tests: {len(results)}')
print(f'  Passed: {ok_count}/{len(results)}')
print(f'  Avg response: {avg_time:.1f}ms')
print(f'  Max response: {max_time:.1f}ms')
print(f'  Status: {"PASS" if ok_count == len(results) else "FAIL"}')

quote_ctx.close()
