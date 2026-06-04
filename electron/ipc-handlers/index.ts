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
