import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('src/lib/bridge-api.ts', 'rb') as f:
    data = f.read()

print(f'File size: {len(data)} bytes')
crlf = data.count(b'\r\n')
lf_only = data.count(b'\n') - crlf
print(f'CRLF: {crlf}, LF-only: {lf_only}')
print(f'Last 100 bytes: {repr(data[-100:])}')

# Check if R18 stubs exist
if b'getDashboardSummary' in data:
    print('R18 getDashboardSummary: PRESENT')
else:
    print('R18 getDashboardSummary: MISSING!')
    
if b'runMonteCarloSimulation' in data:
    print('R18 runMonteCarloSimulation: PRESENT')
else:
    print('R18 runMonteCarloSimulation: MISSING!')

# Count lines
lines = data.split(b'\n')
print(f'Total lines (split by \\n): {len(lines)}')
