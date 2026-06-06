git add -A
git commit -m "Q-29 R3: RiskEngineV3 30 tests pass + StrategyPage/LiveMonitorPage perf fixes

Q-29-01: RiskEngineV3 30 tests (30/30 pass)
- Fix currency conversion expectations (double-conversion bug)
- Fix SECTOR_MAP entries (HK.00700 Internet, US.AMD Technology)
- Fix totalAssets formula (funds.totalAssets in HKD, not USD)
- Fix bySector test (US.AMD makes Technology 40%, not 30%)

Q-29-03: Frontend performance fixes
- StrategyPage: useCallback loadStrategies/refresh/handleParse/handleCreate/handleBacktest
- LiveMonitorPage: useCallback stable IPC handlers, cleanup removeEventListener
- Remove duplicate useEffect blocks in LiveMonitorPage
- Fix useEffect ordering (callbacks must be defined before useEffect referencing them)
- Add useCallback import to LiveMonitorPage"
git push origin feature/strategy-optimize
