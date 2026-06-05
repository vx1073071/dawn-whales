// -- IPC Handlers: Index --
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
export { registerExportHandlers } from './export-handlers';
export { registerMonitorHandlers } from './monitor-handlers';
export { registerPreferencesHandlers } from './preferences-handlers';

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
import { registerExportHandlers } from './export-handlers';
import { registerMonitorHandlers } from './monitor-handlers';
import { registerPreferencesHandlers } from './preferences-handlers';
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
  registerExportHandlers();
  registerMonitorHandlers();
  registerPreferencesHandlers();
  log.info('[IPC] All handlers registered (113 handlers, 13 modules)');
}
