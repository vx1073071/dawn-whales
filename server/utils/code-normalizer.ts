// ── QUANT MOO Cross-Broker Code Normalizer ──────────────────────────
// R135-P02: Standardize stock codes across 6 markets for cross-broker copy trading
// Example: futu("HK.00700") → tiger("00700") → ib("0700.HK") → standard "HK:00700"

type Market = 'HK' | 'US' | 'CN' | 'JP' | 'CRYPTO' | 'EU';

interface BrokerCodeMap {
  brokerId: string;
  toStandard: (code: string) => string;
  fromStandard: (standard: string) => string;
}

// Internal standard format: "MARKET:CODE"
// e.g. HK:00700, US:AAPL, CRYPTO:BTC/USDT

const NORMALIZERS: Record<string, BrokerCodeMap> = {
  futu: {
    brokerId: 'futu',
    toStandard: (code: string) => {
      if (code.startsWith('HK.')) return `HK:${code.slice(3)}`;
      if (code.startsWith('US.')) return `US:${code.slice(3)}`;
      if (code.startsWith('SH.')) return `CN:${code.slice(3)}`;
      if (code.startsWith('SZ.')) return `CN:${code.slice(3)}`;
      return `HK:${code}`;
    },
    fromStandard: (standard: string) => {
      const [market, code] = standard.split(':');
      const prefix: Record<string, string> = { HK: 'HK.', US: 'US.', CN: 'SH.', JP: 'JP.', EU: 'EU.' };
      return `${prefix[market] || 'HK.'}${code}`;
    },
  },
  tiger: {
    brokerId: 'tiger',
    toStandard: (code: string) => {
      if (/^\d{5}$/.test(code)) return `HK:${code}`;
      if (/^[A-Z]{1,5}$/.test(code)) return `US:${code}`;
      return `HK:${code}`;
    },
    fromStandard: (standard: string) => standard.split(':')[1],
  },
  ib: {
    brokerId: 'ib',
    toStandard: (code: string) => {
      if (code.endsWith('.HK')) return `HK:${code.slice(0, -3)}`;
      if (code.includes(' ')) return `US:${code.split(' ')[0]}`;
      return `US:${code}`;
    },
    fromStandard: (standard: string) => {
      const [market, code] = standard.split(':');
      return market === 'HK' ? `${code}.HK` : code;
    },
  },
  binance: {
    brokerId: 'binance',
    toStandard: (code: string) => `CRYPTO:${code.replace('USDT', '/USDT')}`,
    fromStandard: (standard: string) => standard.split(':')[1].replace('/USDT', 'USDT'),
  },
  okx: {
    brokerId: 'okx',
    toStandard: (code: string) => `CRYPTO:${code.replace('-USDT', '/USDT')}`,
    fromStandard: (standard: string) => standard.split(':')[1].replace('/USDT', '-USDT-SWAP'),
  },
  bybit: {
    brokerId: 'bybit',
    toStandard: (code: string) => `CRYPTO:${code.replace('USDT', '/USDT')}`,
    fromStandard: (standard: string) => standard.split(':')[1].replace('/USDT', 'USDT'),
  },
  bitget: {
    brokerId: 'bitget',
    toStandard: (code: string) => `CRYPTO:${code.replace('USDT', '/USDT')}`,
    fromStandard: (standard: string) => standard.split(':')[1].replace('/USDT', 'USDT'),
  },
  robinhood: {
    brokerId: 'robinhood',
    toStandard: (code: string) => `CRYPTO:${code.replace(/USD$/, '/USDT')}`,
    fromStandard: (standard: string) => standard.split(':')[1].replace('/USDT', 'USD'),
  },
};

export function toStandardCode(code: string, brokerId: string): string {
  const normalizer = NORMALIZERS[brokerId];
  if (!normalizer) {
    console.warn(`[CodeNormalizer] Unknown broker: ${brokerId}, passing through: ${code}`);
    return `UNKNOWN:${code}`;
  }
  return normalizer.toStandard(code);
}

export function fromStandardCode(standardCode: string, brokerId: string): string {
  const normalizer = NORMALIZERS[brokerId];
  if (!normalizer) return standardCode.split(':')[1] || standardCode;
  return normalizer.fromStandard(standardCode);
}

// Check if two broker codes refer to the same symbol
export function isSameSymbol(
  code1: string, broker1: string,
  code2: string, broker2: string,
): boolean {
  return toStandardCode(code1, broker1) === toStandardCode(code2, broker2);
}

// Filter copiers by symbol compatibility
export function findCompatibleCopiers(
  signalSymbol: string,
  signalBroker: string,
  copiers: Array<{ brokerId: string; symbol: string; userId: string }>,
): Array<{ brokerId: string; symbol: string; userId: string }> {
  const signalStandard = toStandardCode(signalSymbol, signalBroker);
  const signalMarket = signalStandard.split(':')[0];

  return copiers.filter(copier => {
    const copierStandard = toStandardCode(copier.symbol, copier.brokerId);
    const copierMarket = copierStandard.split(':')[0];
    // Same market only — no cross-market (crypto cannot copy stock signals)
    return copierMarket === signalMarket;
  });
}
