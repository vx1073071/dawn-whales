// ── IPC Handlers — Index ────────────────────────────────────────────────────
// 导出所有 IPC handler 模块的注册函数
// 主龙虾拆分 main.ts 时的统一入口

export { registerBrokerHandlers } from './broker-handlers';
export { registerStrategyHandlers } from './strategy-handlers';
export { registerNlHandlers } from './nl-handlers';
export { registerRiskHandlers } from './risk-handlers';
export { registerDbHandlers } from './db-handlers';
export { registerAppHandlers } from './app-handlers';
export { registerGreeksHandlers } from './greeks-handlers';
export { registerMarketplaceHandlers } from './marketplace-handlers';
export { registerDataHandlers } from './data-handlers';

// 便捷函数：一次性注册所有 handlers
import { registerBrokerHandlers } from './broker-handlers';
import { registerStrategyHandlers } from './strategy-handlers';
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
  log.info('[IPC] ✓ Broker handlers registered');
  
  registerStrategyHandlers();
  log.info('[IPC] ✓ Strategy handlers registered');
  
  registerNlHandlers();
  log.info('[IPC] ✓ NL handlers registered');
  
  registerRiskHandlers();
  log.info('[IPC] ✓ Risk handlers registered');
  
  registerDbHandlers();
  log.info('[IPC] ✓ DB handlers registered');
  
  registerAppHandlers();
  log.info('[IPC] ✓ App handlers registered');
  
  registerGreeksHandlers();
  log.info('[IPC] ✓ Greeks handlers registered');
  
  registerMarketplaceHandlers();
  log.info('[IPC] ✓ Marketplace handlers registered');
  
  registerDataHandlers();
  log.info('[IPC] ✓ Data handlers registered');
  
  log.info('[IPC] All handlers registered successfully');
}
