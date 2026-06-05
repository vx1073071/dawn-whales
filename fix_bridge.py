import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('src/lib/bridge-api.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix line endings: ensure consistent LF (we'll convert to CRLF at the end if needed)
content = content.replace('\r\n', '\n').replace('\r', '\n')

# Check if R18 functions are missing
if 'getPortfolioRebalance' not in content:
    print('Adding missing R18 functions...')
    # Add missing R18 functions at the end
    missing_functions = '''

export async function getPortfolioRebalance(): Promise<any> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.portfolio.getRebalance();
}

export async function runMonteCarloSimulation(config: any): Promise<any> {
  if (!hasIPC()) return { success: false, error: 'Not in Electron' };
  return window.api.monteCarlo.simulate(config);
}
'''
    content = content.rstrip() + '\n' + missing_functions

# Fix duplicate prefs if it exists
if "prefs: any;" in content and "prefs: {" in content:
    print('Fixing duplicate prefs...')
    # Remove the simple prefs: any; line, keep the detailed one
    content = content.replace('      prefs: any;\n', '', 1)
    print('  Removed prefs: any;')

# Ensure file ends with newline
content = content.rstrip() + '\n'

# Write back with consistent LF line endings
with open('src/lib/bridge-api.ts', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)

print(f'File saved. Lines: {content.count(chr(10))}')

# Verify key functions exist
for fn in ['getDashboardSummary', 'getDashboardPnl', 'getDashboardPositions', 'getDashboardHealth',
           'getPortfolioAllocation', 'getPortfolioPerformance', 'getPortfolioRiskMetrics',
           'getPortfolioRebalance', 'runMonteCarloSimulation']:
    if fn in content:
        print(f'  {fn}: OK')
    else:
        print(f'  {fn}: MISSING!')
