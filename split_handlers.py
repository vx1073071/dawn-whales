#!/usr/bin/env python3
"""
Robust handler extraction from main.ts.
Strategy: find all ipcMain.handle() calls, then find the arrow function body
by looking for '=>' and tracking braces from there.
"""
import re, sys, os
sys.stdout.reconfigure(encoding='utf-8')

MAIN_TS = 'electron/main.ts'
IPC_DIR = 'electron/ipc-handlers'

with open(MAIN_TS, 'r', encoding='utf-8') as f:
    content = f.read()

# Find all handler start positions in the entire file
handler_starts = []
for m in re.finditer(r"ipcMain\.handle\('([^']+)'", content):
    handler_starts.append((m.start(), m.group(1)))

print(f"Found {len(handler_starts)} handler starts")

# Extract each handler by finding the arrow function body
handlers = {}
for idx, (start, name) in enumerate(handler_starts):
    # Find the '=>' that starts the handler body
    arrow_pos = content.find('=>', start, start + 500)  # Look within 500 chars
    if arrow_pos == -1:
        print(f"WARNING: {name} - no arrow function found")
        continue
    
    # Find the opening brace after =>
    brace_start = content.find('{', arrow_pos)
    if brace_start == -1:
        print(f"WARNING: {name} - no opening brace found after =>")
        continue
    
    # Track braces from the opening brace
    brace_depth = 1
    pos = brace_start + 1
    while pos < len(content) and brace_depth > 0:
        ch = content[pos]
        if ch == '{':
            brace_depth += 1
        elif ch == '}':
            brace_depth -= 1
        elif ch == "'" or ch == '"' or ch == '`':
            # Skip string literals
            quote = ch
            pos += 1
            while pos < len(content) and content[pos] != quote:
                if content[pos] == '\\':
                    pos += 1  # Skip escaped char
                pos += 1
        pos += 1
    
    # Find the closing ");" after the handler body
    end = pos
    remaining = content[pos:pos+10].lstrip()
    if remaining.startswith(');'):
        end = pos + remaining.find(');') + 2
    elif remaining.startswith(')'):
        end = pos + remaining.find(')') + 1
    
    code = content[start:end]
    handlers[name] = code

print(f"Extracted {len(handlers)} handlers")

# Verify extraction - check that each handler has a complete body
for name, code in handlers.items():
    if code.count('{') != code.count('}'):
        print(f"WARNING: {name} has unbalanced braces: {code.count('{')} open, {code.count('}')} close")
    if '=>' not in code:
        print(f"WARNING: {name} missing arrow function")

# Group by prefix
groups = {}
for name, code in handlers.items():
    prefix = name.split(':')[0]
    if prefix not in groups:
        groups[prefix] = {}
    groups[prefix][name] = code

for prefix, hs in sorted(groups.items()):
    print(f"  {prefix}: {len(hs)} handlers")

# Transform code: replace module-level vars with shared.*
def transform(code):
    # Use word boundary regex for safe replacement
    replacements = [
        (r'\bmainWindow\b', 'shared.mainWindow'),
        (r'\bopendClient\b', 'shared.opendClient'),
        (r'\bbrokerManager\b', 'shared.brokerManager'),
        (r'\bstrategyEngine\b', 'shared.strategyEngine'),
        (r'\bbacktestEngine\b', 'shared.backtestEngine'),
        (r'\briskEngine\b', 'shared.riskEngine'),
        (r'\bmarketplaceService\b', 'shared.marketplaceService'),
        (r'\bdataProvider\b', 'shared.dataProvider'),
        (r'\bWATCHLIST\b', 'shared.WATCHLIST'),
        (r'\bquotePushHandler\b', 'shared.quotePushHandler'),
    ]
    for pat, repl in replacements:
        code = re.sub(pat, repl, code)
    
    # Handle db references - be careful not to match inside strings
    code = re.sub(r'(?<![.\w])db(?=\?\.|\.)', 'shared.db', code)
    
    # Fix double-shared
    code = code.replace('shared.shared.', 'shared.')
    return code

os.makedirs(IPC_DIR, exist_ok=True)

# Module definitions
MODULES = {
    'broker': {
        'imports': """import { ipcMain } from 'electron';
import { shared } from './_import-shared';
import { FutuOpenDClient } from '../broker/futu-opend';
import type { BrokerConfig } from '../broker/IBrokerAdapter';
import { validate, BrokerConnectSchema, BrokerGetFundsSchema, BrokerGetPositionsSchema, BrokerGetQuotesSchema, BrokerSubscribeSchema, BrokerGetKlinesSchema, BrokerPlaceOrderSchema, BrokerCancelOrderSchema, BrokerSwitchSchema, BrokerAddSchema } from '../ipc-schemas';
import log from 'electron-log';""",
        'func': 'registerBrokerHandlers',
    },
    'strategy': {
        'imports': """import { ipcMain, app } from 'electron';
import { shared } from './_import-shared';
import { validate, StrategyCreateSchema, StrategyUpdateSchema, StrategyGetSchema, StrategyBacktestSchema, StrategyExplainSchema, StrategyCompareSchema, StrategyOptimizeSchema } from '../ipc-schemas';
import { getDeepSeekKey } from '../utils/secure-key';
import log from 'electron-log';

const STRATEGY_UPDATE_WHITELIST = ['name', 'description', 'params', 'stopLoss', 'takeProfit', 'symbol'];""",
        'func': 'registerStrategyHandlers',
    },
    'backtest': {
        'imports': """import { ipcMain } from 'electron';
import { shared } from './_import-shared';
import { BacktestEngine } from '../engine/backtest-engine';
import { WalkForwardEngine } from '../engine/walk-forward';
import { ParameterScanner } from '../engine/parameter-scanner';
import { validate, BacktestMultiPeriodSchema, BacktestParamSweepSchema, BacktestRiskMetricsSchema, BacktestWalkForwardSchema, BacktestParamScanSchema, BacktestMultiTimeframeSchema } from '../ipc-schemas';
import log from 'electron-log';""",
        'func': 'registerBacktestHandlers',
    },
    'nl': {
        'imports': """import { ipcMain } from 'electron';
import { parseNaturalLanguage, STRATEGY_TEMPLATES } from '../engine/nl-parser';""",
        'func': 'registerNlHandlers',
    },
    'risk': {
        'imports': """import { ipcMain } from 'electron';
import { shared } from './_import-shared';""",
        'func': 'registerRiskHandlers',
    },
    'db': {
        'imports': """import { ipcMain } from 'electron';
import { shared } from './_import-shared';""",
        'func': 'registerDbHandlers',
    },
    'app': {
        'imports': """import { ipcMain, app, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import { shared } from './_import-shared';
import { validate } from '../ipc-schemas';
import { z } from 'zod';
import log from 'electron-log';

const ALLOWED_PROTOCOLS = ['http:', 'https:'];""",
        'func': 'registerAppHandlers',
    },
    'greeks': {
        'imports': """import { ipcMain } from 'electron';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { validate, GreeksPortfolioSchema } from '../ipc-schemas';
import log from 'electron-log';

const execAsync = promisify(exec);""",
        'func': 'registerGreeksHandlers',
    },
    'marketplace': {
        'imports': """import { ipcMain } from 'electron';
import { shared } from './_import-shared';
import { validate, MarketplaceRateSchema, MarketplaceCommentSchema, MarketplaceSavePerformanceSchema } from '../ipc-schemas';
import log from 'electron-log';""",
        'func': 'registerMarketplaceHandlers',
    },
    'data': {
        'imports': """import { ipcMain } from 'electron';
import { shared } from './_import-shared';
import log from 'electron-log';""",
        'func': 'registerDataHandlers',
    },
}

for prefix, mod in MODULES.items():
    if prefix not in groups:
        print(f"  SKIP {prefix}: no handlers found")
        continue
    
    hs = groups[prefix]
    func_name = mod['func']
    filename = f"{prefix}-handlers.ts"
    
    lines = [
        f"// -- IPC Handlers: {prefix} ({len(hs)} handlers) --",
        "",
        mod['imports'],
        "",
        f"export function {func_name}() {{",
    ]
    
    for name, code in hs.items():
        transformed = transform(code)
        # Indent by 2 spaces
        indented = '\n'.join(('  ' + line if line.strip() else '') for line in transformed.split('\n'))
        lines.append('')
        lines.append(indented)
        lines.append('')
    
    lines.append('}')
    lines.append('')
    
    with open(f'{IPC_DIR}/{filename}', 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))
    
    line_count = sum(len(code.split('\n')) for code in hs.values())
    print(f"  {filename}: {len(hs)} handlers, {line_count} lines of code")

# Write shared state file
shared_ts = """// -- IPC Handlers: Shared State & Imports --
import type { BrowserWindow, Tray } from 'electron';
import type { FutuOpenDClient } from '../broker/futu-opend';
import type { BrokerManager } from '../broker/BrokerManager';
import type { StrategyEngine } from '../engine/strategy-engine';
import type { BacktestEngine } from '../engine/backtest-engine';
import type { DatabaseManager } from '../data/database';
import type { RiskEngine } from '../engine/risk-engine';
import type { MarketplaceService } from '../data/marketplace-service';
import type { DataProviderService } from '../data/data-provider';
import type { BrokerConfig } from '../broker/IBrokerAdapter';

export interface SharedState {
  mainWindow: BrowserWindow | null;
  tray: Tray | null;
  opendClient: FutuOpenDClient | null;
  brokerManager: BrokerManager | null;
  strategyEngine: StrategyEngine | null;
  backtestEngine: BacktestEngine | null;
  riskEngine: RiskEngine | null;
  db: DatabaseManager | null;
  marketplaceService: MarketplaceService | null;
  dataProvider: DataProviderService | null;
  WATCHLIST: string[];
  quotePushHandler: ((quotes: any[]) => void) | null;
}

export const shared: SharedState = {
  mainWindow: null,
  tray: null,
  opendClient: null,
  brokerManager: null,
  strategyEngine: null,
  backtestEngine: null,
  riskEngine: null,
  db: null,
  marketplaceService: null,
  dataProvider: null,
  WATCHLIST: ['US.TQQQ','US.SOXL','US.QQQ','US.SPY','US.AAPL','US.NVDA','US.SQQQ','US.SOXS'],
  quotePushHandler: null,
};

import { validate as _validate } from '../ipc-schemas';
export { _validate as validate };
export type { BrokerConfig };
"""

with open(f'{IPC_DIR}/_import-shared.ts', 'w', encoding='utf-8') as f:
    f.write(shared_ts)

# Write index.ts
index_ts = """// -- IPC Handlers: Index --
export { registerBrokerHandlers } from './broker-handlers';
export { registerStrategyHandlers } from './strategy-handlers';
export { registerBacktestHandlers } from './backtest-handlers';
export { registerNlHandlers } from './nl-handlers';
export { registerRiskHandlers } from './risk-handlers';
export { registerDbHandlers } from './db-handlers';
export { registerAppHandlers } from './app-handlers';
export { registerGreeksHandlers } from './greeks-handlers';
export { registerMarketplaceHandlers } from './marketplace-handlers';
export { registerDataHandlers } from './data-handlers';

import { registerBrokerHandlers } from './broker-handlers';
import { registerStrategyHandlers } from './strategy-handlers';
import { registerBacktestHandlers } from './backtest-handlers';
import { registerNlHandlers } from './nl-handlers';
import { registerRiskHandlers } from './risk-handlers';
import { registerDbHandlers } from './db-handlers';
import { registerAppHandlers } from './app-handlers';
import { registerGreeksHandlers } from './greeks-handlers';
import { registerMarketplaceHandlers } from './marketplace-handlers';
import { registerDataHandlers } from './data-handlers';
import log from 'electron-log';

export function registerAllHandlers() {
  log.info('[IPC] Registering all handlers...');
  registerBrokerHandlers();
  registerStrategyHandlers();
  registerBacktestHandlers();
  registerNlHandlers();
  registerRiskHandlers();
  registerDbHandlers();
  registerAppHandlers();
  registerGreeksHandlers();
  registerMarketplaceHandlers();
  registerDataHandlers();
  log.info('[IPC] All handlers registered (87 handlers, 10 modules)');
}
"""

with open(f'{IPC_DIR}/index.ts', 'w', encoding='utf-8') as f:
    f.write(index_ts)

print(f"\nDone!")
