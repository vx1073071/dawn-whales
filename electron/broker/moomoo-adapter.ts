// ── DAWN WHALES — Moomoo OpenD Adapter ──────────────────────────────────────
// Moomoo shares the same OpenD protocol as Futu (futu-api SDK)
// Adapter wraps FutuOpenD with moomoo-specific config and defaults
// M7: Multi-broker phase 1

import { FutuOpenD } from './futu-opend';
import type { BrokerConfig, IBrokerAdapter, AccountInfo, FundsInfo, PositionInfo, OrderInfo, KLineInfo, QuoteInfo } from './IBrokerAdapter';

export class MoomooBrokerAdapter extends FutuOpenDClient implements IBrokerAdapter {
  readonly brokerType = 'moomoo' as const;
  readonly brokerName = 'Moomoo';

  private moomooConfig: BrokerConfig;

  constructor(config: BrokerConfig) {
    // Moomoo OpenD typically runs on port 11112 (vs Futu 11111)
    super({ ...config, host: config.host || '127.0.0.1', port: config.port || 11112 });
    this.moomooConfig = config;

    const log = require('electron-log');
    log.info('[MoomooOpenD] Initialized:', this.moomooConfig.name, `${config.host}:${config.port}`);
  }

  // Override to add moomoo-specific account filtering
  async getAccounts(): Promise<AccountInfo[]> {
    const accounts = await super.getAccounts();
    return accounts.filter(a => !a.accountId?.startsWith('FT_'));
  }

  // Override to add moomoo-specific market prefix handling  
  normalizeCode(code: string): string {
    // US.HK.00700 -> HK.00700 or US.AAPL -> US.AAPL (same as futu)
    return code;
  }

  // Get broker info
  getBrokerInfo(): { id: string; name: string; type: string; connected: boolean } {
    return {
      id: this.moomooConfig.id,
      name: this.moomooConfig.name,
      type: 'moomoo',
      connected: this.isConnected(),
    };
  }
}
