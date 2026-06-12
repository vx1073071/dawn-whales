// @ts-nocheck
// ── R137-M04 copyTradeMockData.ts — 统一Mock数据 (全组件共用) ────────────
// PM: sp1-sp5统一ID/字段, 所有组件引用同一数据源
import type { SignalProvider, CopyTradeBroker, CopyTradeRecord, TradeRecord, CopyTradeNotification, OpenDSignal, USBrokerConfig, BrokerCopyStatus } from '@/stores/copyTradeStore';

// ═══════════ Signal Providers (sp1-sp5, unified fields) ═══════════

export const MOCK_PROVIDERS: SignalProvider[] = [
  { id: 'sp1', name: 'AlphaQuant', icon: 'AQ', avatar: 'AQ', exchange: 'Binance', strategy: '多因子+趋势跟踪', totalReturn: 380, winRate: 64.5, sharpeRatio: 2.4, maxDrawdown: 18, followers: 3420, fee: 15, riskLevel: 'medium', verified: true, minAmount: 100, description: '机构级量化策略，基于多因子模型和趋势跟踪，覆盖BTC/ETH/SOL等主流币种' },
  { id: 'sp2', name: 'GoldenCross', icon: 'GC', avatar: 'GC', exchange: 'Bybit', strategy: 'MA双均线交叉', totalReturn: 210, winRate: 58.2, sharpeRatio: 1.8, maxDrawdown: 25, followers: 1280, fee: 12, riskLevel: 'medium', verified: true, minAmount: 50, description: '经典均线策略，适合中长期趋势跟踪' },
  { id: 'sp3', name: 'ScalperBot', icon: 'SB', avatar: 'SB', exchange: 'OKX', strategy: '高频剥头皮', totalReturn: 156, winRate: 71.3, sharpeRatio: 2.1, maxDrawdown: 12, followers: 5600, fee: 20, riskLevel: 'high', verified: false, minAmount: 200, description: '高频短线策略，单笔持仓短，胜率高但需低延迟' },
  { id: 'sp4', name: 'TrendRider', icon: 'TR', avatar: 'TR', exchange: 'Bitget', strategy: '趋势跟随+网格', totalReturn: 89, winRate: 52.8, sharpeRatio: 1.2, maxDrawdown: 32, followers: 890, fee: 8, riskLevel: 'low', verified: true, minAmount: 50, description: '稳健型策略，低波动标的网格交易' },
  { id: 'sp5', name: 'WhaleTracker', icon: 'WT', avatar: 'WT', exchange: 'Binance', strategy: '链上鲸鱼追踪', totalReturn: 520, winRate: 67.0, sharpeRatio: 3.1, maxDrawdown: 15, followers: 8900, fee: 25, riskLevel: 'low', verified: true, minAmount: 500, description: '追踪链上鲸鱼地址交易行为，跟单大户操作' },
];

// ═══════════ Copy Trade Brokers (8 core + extended) ═══════════

export const MOCK_COPY_BROKERS: CopyTradeBroker[] = [
  { brokerId: 'futu', brokerName: 'Futu', icon: '🐂', market: ['HK', 'US'], type: 'opend', typeLabel: 'OpenD', status: 'connected', latency: 8, feeRate: '0.03%', copyTradeSupported: true, signalMatching: 'exact', minAmount: 100, maxSlippage: 0.5, supportedExchanges: ['HKEX', 'NASDAQ', 'NYSE'], region: 'HK', rank: 1 },
  { brokerId: 'ib', brokerName: 'IBKR', icon: '🏦', market: ['US', 'Global'], type: 'api', typeLabel: 'TWS API', status: 'disconnected', feeRate: '$0.005/sh', copyTradeSupported: true, signalMatching: 'fuzzy', minAmount: 500, maxSlippage: 0.3, supportedExchanges: ['NASDAQ', 'NYSE', 'LSE', 'TSE'], region: 'US', rank: 2 },
  { brokerId: 'tiger', brokerName: 'Tiger', icon: '🐯', market: ['US', 'HK'], type: 'cloud', typeLabel: 'Cloud SDK', status: 'connecting', feeRate: '0.03%', copyTradeSupported: true, signalMatching: 'exact', minAmount: 200, maxSlippage: 0.5, supportedExchanges: ['HKEX', 'NASDAQ', 'NYSE'], region: 'HK', rank: 1 },
  { brokerId: 'schwab', brokerName: 'Schwab', icon: '🔵', market: ['US'], type: 'oauth2', typeLabel: 'OAuth2', status: 'disconnected', feeRate: '$0.00', copyTradeSupported: true, signalMatching: 'fuzzy', minAmount: 1000, maxSlippage: 0.3, supportedExchanges: ['NASDAQ', 'NYSE'], region: 'US', rank: 3 },
  { brokerId: 'binance', brokerName: 'Binance', icon: '🟡', market: ['Crypto'], type: 'cloud', typeLabel: 'Cloud REST', status: 'connected', latency: 12, feeRate: '0.10%', copyTradeSupported: true, signalMatching: 'exact', minAmount: 10, maxSlippage: 0.2, supportedExchanges: ['Binance'], region: 'Crypto', rank: 1 },
  { brokerId: 'okx', brokerName: 'OKX', icon: '⬜', market: ['Crypto'], type: 'cloud', typeLabel: 'Cloud REST', status: 'connected', latency: 45, feeRate: '0.08%', copyTradeSupported: true, signalMatching: 'exact', minAmount: 10, maxSlippage: 0.2, supportedExchanges: ['OKX'], region: 'Crypto', rank: 2 },
  { brokerId: 'bybit', brokerName: 'Bybit', icon: '🟠', market: ['Crypto'], type: 'cloud', typeLabel: 'Cloud REST', status: 'connected', latency: 345, feeRate: '0.10%', copyTradeSupported: true, signalMatching: 'exact', minAmount: 10, maxSlippage: 0.2, supportedExchanges: ['Bybit'], region: 'Crypto', rank: 3 },
  { brokerId: 'longbridge', brokerName: 'Longbridge', icon: '🌉', market: ['HK', 'US'], type: 'opend', typeLabel: 'OpenD', status: 'disconnected', feeRate: '0.02%', copyTradeSupported: true, signalMatching: 'exact', minAmount: 200, maxSlippage: 0.5, supportedExchanges: ['HKEX', 'NASDAQ', 'NYSE'], region: 'HK', rank: 3 },
];

// ═══════════ Trade Records ═══════════

export const MOCK_TRADE_RECORDS: CopyTradeRecord[] = [
  { id: 'ct1', signalId: 's-001', providerId: 'sp1', providerName: 'AlphaQuant', symbol: 'BTC-USDT', side: 'buy', amount: 0.01, price: 97234, brokerId: 'binance', brokerName: 'Binance', status: 'filled', pnl: 156.8, pnlPct: 1.62, fee: 2.1, slippage: 0.02, retryCount: 0, createdAt: Date.now() - 3600000, updatedAt: Date.now() - 1800000 },
  { id: 'ct2', signalId: 's-002', providerId: 'sp1', providerName: 'AlphaQuant', symbol: 'ETH-USDT', side: 'buy', amount: 0.5, price: 3821, brokerId: 'binance', brokerName: 'Binance', status: 'filled', pnl: -24.5, pnlPct: -1.28, fee: 1.8, slippage: 0.05, retryCount: 0, createdAt: Date.now() - 7200000, updatedAt: Date.now() - 5400000 },
  { id: 'ct3', signalId: 's-003', providerId: 'sp2', providerName: 'GoldenCross', symbol: 'SOL-USDT', side: 'sell', amount: 5, price: 187.5, brokerId: 'okx', brokerName: 'OKX', status: 'executing', retryCount: 0, createdAt: Date.now() - 300000, updatedAt: Date.now() - 60000 },
  { id: 'ct4', signalId: 's-004', providerId: 'sp1', providerName: 'AlphaQuant', symbol: 'BNB-USDT', side: 'buy', amount: 0.3, price: 612, brokerId: 'binance', brokerName: 'Binance', status: 'failed', error: 'Insufficient balance', retryCount: 2, createdAt: Date.now() - 3600000, updatedAt: Date.now() - 3000000 },
  { id: 'ct5', signalId: 's-005', providerId: 'sp3', providerName: 'ScalperBot', symbol: 'DOGE-USDT', side: 'buy', amount: 5000, price: 0.172, brokerId: 'bybit', brokerName: 'Bybit', status: 'retrying', retryCount: 1, createdAt: Date.now() - 1200000, updatedAt: Date.now() - 600000 },
  { id: 'ct6', signalId: 's-006', providerId: 'sp5', providerName: 'WhaleTracker', symbol: 'BTC-USDT', side: 'buy', amount: 0.02, price: 97150, brokerId: 'binance', brokerName: 'Binance', status: 'pending', retryCount: 0, createdAt: Date.now() - 60000, updatedAt: Date.now() - 60000 },
];

// ═══════════ Trade History ═══════════

export const MOCK_TRADE_HISTORY: TradeRecord[] = [
  { id: 't1', signalId: 's-001', providerName: 'AlphaQuant', symbol: 'BTC-USDT', side: 'buy', amount: 0.01, price: 97234, total: 972.34, brokerName: 'Binance', status: 'filled', pnl: 156.8, pnlPct: 1.62, fee: 2.1, feeCurrency: 'USDT', slippage: 0.02, createdAt: Date.now() - 3600000, filledAt: Date.now() - 3540000 },
  { id: 't2', signalId: 's-002', providerName: 'AlphaQuant', symbol: 'ETH-USDT', side: 'buy', amount: 0.5, price: 3821, total: 1910.5, brokerName: 'Binance', status: 'filled', pnl: -24.5, pnlPct: -1.28, fee: 1.8, feeCurrency: 'USDT', slippage: 0.05, createdAt: Date.now() - 7200000, filledAt: Date.now() - 7140000 },
  { id: 't3', signalId: 's-003', providerName: 'GoldenCross', symbol: 'SOL-USDT', side: 'sell', amount: 5, price: 187.5, total: 937.5, brokerName: 'OKX', status: 'filled', pnl: 42.1, pnlPct: 2.25, fee: 0.9, feeCurrency: 'USDT', slippage: 0.01, createdAt: Date.now() - 10800000, filledAt: Date.now() - 10740000 },
  { id: 't4', signalId: 's-004', providerName: 'AlphaQuant', symbol: 'BNB-USDT', side: 'buy', amount: 0.3, price: 612, total: 183.6, brokerName: 'Binance', status: 'failed', fee: 0, feeCurrency: 'USDT', error: 'Insufficient balance', createdAt: Date.now() - 14400000 },
  { id: 't5', signalId: 's-005', providerName: 'WhaleTracker', symbol: 'BTC-USDT', side: 'buy', amount: 0.02, price: 97150, total: 1943, brokerName: 'Binance', status: 'filled', pnl: 89.3, pnlPct: 4.60, fee: 1.5, feeCurrency: 'USDT', slippage: 0.03, createdAt: Date.now() - 18000000, filledAt: Date.now() - 17940000 },
];

// ═══════════ Notifications ═══════════

export const MOCK_NOTIFICATIONS: CopyTradeNotification[] = [
  { id: 'n1', type: 'order_filled', title: '跟单成交', message: 'AlphaQuant: BTC-USDT 买入 0.01 @ $97,234.00', timestamp: Date.now() - 60000, read: false, data: { symbol: 'BTC-USDT', side: 'buy', amount: 0.01, price: 97234, pnl: 156.8, providerName: 'AlphaQuant', brokerName: 'Binance' } },
  { id: 'n2', type: 'signal_received', title: '收到信号', message: 'GoldenCross 发出 SOL-USDT 卖出信号', timestamp: Date.now() - 180000, read: false },
  { id: 'n3', type: 'order_failed', title: '跟单失败', message: 'AlphaQuant: BNB-USDT 买入失败 - 余额不足', timestamp: Date.now() - 600000, read: true },
  { id: 'n4', type: 'order_retrying', title: '正在重试', message: 'ScalperBot: DOGE-USDT 买入 第2次重试', timestamp: Date.now() - 1200000, read: true },
  { id: 'n5', type: 'stop_loss', title: '止损触发', message: 'WhaleTracker: ETH-USDT 触发止损 -2.5%', timestamp: Date.now() - 3600000, read: true, data: { symbol: 'ETH-USDT', pnl: -125, providerName: 'WhaleTracker' } },
  { id: 'n6', type: 'take_profit', title: '止盈触发', message: 'AlphaQuant: BTC-USDT 触发止盈 +3.2%', timestamp: Date.now() - 7200000, read: true, data: { symbol: 'BTC-USDT', pnl: 320, providerName: 'AlphaQuant' } },
];

// ═══════════ OpenD Signals ═══════════

export const MOCK_OPEND_SIGNALS: OpenDSignal[] = [
  { id: 's101', symbol: 'HK.00700', signal: 'BUY', strategyName: 'MACD背驰', price: 388.60, quantity: 100, confidence: 88, reason: '日线MACD底背离+放量', brokerId: 'futu', brokerName: 'Futu', receivedAt: Date.now() - 120000, status: 'pending', retryCount: 0 },
  { id: 's102', symbol: 'HK.09988', signal: 'SELL', strategyName: '均线死叉', price: 82.30, quantity: 200, confidence: 75, reason: '5日线下穿20日线+缩量', brokerId: 'futu', brokerName: 'Futu', receivedAt: Date.now() - 300000, status: 'pending', retryCount: 0 },
  { id: 's103', symbol: 'US.AAPL', signal: 'BUY', strategyName: '布林下轨', price: 198.50, quantity: 50, confidence: 82, reason: '触及布林下轨+RSI<30', brokerId: 'futu', brokerName: 'Futu', receivedAt: Date.now() - 600000, status: 'executing', retryCount: 1 },
  { id: 's104', symbol: 'US.TSLA', signal: 'SELL', strategyName: 'RSI超买', price: 267.80, quantity: 30, confidence: 70, reason: 'RSI 78超买+缩量', brokerId: 'moomoo', brokerName: 'Moomoo', receivedAt: Date.now() - 900000, status: 'failed', errorMessage: 'OpenD 连接超时', retryCount: 2 },
  { id: 's105', symbol: 'HK.03690', signal: 'BUY', strategyName: '趋势突破', price: 112.40, quantity: 150, confidence: 91, reason: '突破200日线+成交量放大3倍', brokerId: 'futu', brokerName: 'Futu', receivedAt: Date.now() - 1800000, status: 'executed', executionPrice: 112.45, retryCount: 0 },
  { id: 's106', symbol: 'US.NVDA', signal: 'BUY', strategyName: 'VWAP支撑', price: 134.20, quantity: 40, confidence: 78, reason: '回踩VWAP获得支撑', brokerId: 'futu', brokerName: 'Futu', receivedAt: Date.now() - 2400000, status: 'pending', retryCount: 0 },
];

// ═══════════ US Brokers ═══════════

export const MOCK_US_BROKERS: USBrokerConfig[] = [
  { brokerId: 'ib', brokerName: 'Interactive Brokers', icon: '🏦', market: ['US', 'Global'], status: 'disconnected', protocol: 'TWS', authType: 'api_key', features: ['股票', '期权', '期货', '外汇', '债券'], configured: true, tested: true, feeRate: '$0.005/share', marginAvailable: true, shortSelling: true, prePostMarket: true },
  { brokerId: 'tiger', brokerName: 'Tiger Brokers', icon: '🐯', market: ['US', 'HK'], status: 'connecting', protocol: 'TigerSDK', authType: 'api_key', features: ['股票', '期权', '港股打新'], configured: true, tested: false, feeRate: '0.03%', marginAvailable: true, shortSelling: true, prePostMarket: true },
  { brokerId: 'schwab', brokerName: 'Charles Schwab', icon: '🔵', market: ['US'], status: 'disconnected', protocol: 'OAuth2', authType: 'oauth2', features: ['股票', 'ETF', '共同基金', '债券'], configured: false, tested: false, feeRate: '$0.00 (零佣金)', marginAvailable: true, shortSelling: true, prePostMarket: true },
];

// ═══════════ Broker Copy Status (17 brokers) ═══════════

export const MOCK_BROKER_COPY_STATUS: BrokerCopyStatus[] = [
  { brokerId: 'binance', brokerName: 'Binance', shortName: 'BNB', icon: '🟡', type: 'cloud', typeLabel: 'Cloud REST', market: ['Crypto'], region: 'Crypto', connectionStatus: 'online', copyTradeActive: true, copyTradePaused: false, pendingSignals: 0, activeCopies: 5, todayCopies: 23, todayPnL: 1245, signalHitRate: 72, latency: 12 },
  { brokerId: 'okx', brokerName: 'OKX', shortName: 'OKX', icon: '⬜', type: 'cloud', typeLabel: 'Cloud REST', market: ['Crypto'], region: 'Crypto', connectionStatus: 'online', copyTradeActive: true, copyTradePaused: false, pendingSignals: 0, activeCopies: 3, todayCopies: 15, todayPnL: 890, signalHitRate: 65, latency: 45 },
  { brokerId: 'bybit', brokerName: 'Bybit', shortName: 'BYB', icon: '🟠', type: 'cloud', typeLabel: 'Cloud REST', market: ['Crypto'], region: 'Crypto', connectionStatus: 'degraded', copyTradeActive: true, copyTradePaused: true, pendingSignals: 2, activeCopies: 2, todayCopies: 8, todayPnL: -340, signalHitRate: 60, latency: 345 },
  { brokerId: 'futu', brokerName: 'Futu', shortName: 'FUTU', icon: '🐂', type: 'opend', typeLabel: 'OpenD', market: ['HK', 'US'], region: 'HK', connectionStatus: 'online', copyTradeActive: true, copyTradePaused: false, pendingSignals: 1, activeCopies: 8, todayCopies: 34, todayPnL: 3400, signalHitRate: 68, latency: 8 },
  { brokerId: 'moomoo', brokerName: 'Moomoo', shortName: 'MOO', icon: '🐮', type: 'opend', typeLabel: 'OpenD', market: ['HK', 'US'], region: 'HK', connectionStatus: 'offline', copyTradeActive: true, copyTradePaused: true, pendingSignals: 3, activeCopies: 4, todayCopies: 18, todayPnL: 1200, signalHitRate: 62 },
];
