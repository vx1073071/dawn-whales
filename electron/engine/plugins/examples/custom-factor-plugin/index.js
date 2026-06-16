/**
 * Custom Factor Plugin — 自定义因子计算示例
 *
 * 添加以下自定义因子到策略模板系统：
 *   1. Bollinger Band Width (BBW) — 布林带宽度
 *   2. Volume-Weighted RSI (VWRSI) — 成交量加权RSI
 *   3. Custom Momentum (CMOM) — 自定义动量因子
 *   4. Price Position (PPOS) — 价格位置百分比
 *
 * 展示 QUANT MOO 插件 API 的核心用法：
 *   - 获取行情数据 (getQuote)
 *   - 订阅实时行情 (subscribe)
 *   - 持久化存储 (storage)
 *   - 日志记录 (logger)
 *   - 发送通知 (notify)
 *   - 生命周期钩子 (onActivate, onDeactivate, onTimer)
 */

// ── Factor Computation ────────────────────────────────────────────────

/**
 * 布林带宽度 (Bollinger Band Width)
 * BBW = (Upper - Lower) / Middle × 100
 * 带宽越宽 = 波动性越高
 */
function computeBBW(closes, period = 20, multiplier = 2) {
  if (closes.length < period) return 0;
  const slice = closes.slice(-period);
  const sma = slice.reduce((s, v) => s + v, 0) / period;
  const variance = slice.reduce((s, v) => s + (v - sma) ** 2, 0) / period;
  const std = Math.sqrt(variance);
  const upper = sma + multiplier * std;
  const lower = sma - multiplier * std;
  return ((upper - lower) / sma) * 100;
}

/**
 * 成交量加权 RSI (Volume-Weighted RSI)
 * 用成交量加权价格变动，对放量涨跌更敏感
 */
function computeVWRSI(closes, volumes, period = 14) {
  if (closes.length < period + 1) return 50;
  let avgGain = 0, avgLoss = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const weight = volumes[i] || 1;
    if (diff >= 0) avgGain += diff * weight;
    else avgLoss -= diff * weight;
  }
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

/**
 * 自定义动量因子 (Custom Momentum)
 * CMOM = (Price(t) - Price(t-n)) / Price(t-n) × 100 × VolumeRatio
 */
function computeCMOM(closes, volumes, period = 10) {
  if (closes.length < period) return 0;
  const priceMomentum = (closes[closes.length - 1] - closes[closes.length - period]) /
    closes[closes.length - period] * 100;
  const recentVolAvg = volumes.slice(-5).reduce((s, v) => s + v, 0) / 5;
  const prevVolAvg = volumes.slice(-period, -5).reduce((s, v) => s + v, 0) / (period - 5);
  const volRatio = prevVolAvg > 0 ? recentVolAvg / prevVolAvg : 1;
  return priceMomentum * volRatio;
}

/**
 * 价格位置百分比 (Price Position)
 * PPOS = (Close - Lowest(low, N)) / (Highest(high, N) - Lowest(low, N)) × 100
 */
function computePPOS(highs, lows, closes, period = 20) {
  if (closes.length < period) return 50;
  const sliceH = highs.slice(-period);
  const sliceL = lows.slice(-period);
  const highest = Math.max(...sliceH);
  const lowest = Math.min(...sliceL);
  const range = highest - lowest;
  if (range === 0) return 50;
  return ((closes[closes.length - 1] - lowest) / range) * 100;
}

// ── Plugin State ──────────────────────────────────────────────────────

let config = {
  bbwPeriod: 20,
  vwrsiPeriod: 14,
  cmomPeriod: 10,
  pposPeriod: 20,
  updateIntervalMs: 60000, // 1 minute
};

let timerId = null;
let subUnsubscribe = null;

// ── Lifecycle: onActivate ─────────────────────────────────────────────

function onActivate(api) {
  api.logger.info('[CustomFactor] Activating...');

  // Load saved config
  api.storage.get('config').then(saved => {
    if (saved) {
      config = { ...config, ...saved };
      api.logger.info('[CustomFactor] Loaded saved config');
    }
  });

  // Subscribe to market data for BTC/USDT (example)
  subUnsubscribe = api.subscribe('BTC/USDT', (quote) => {
    api.logger.debug(`[CustomFactor] Quote: ${quote.symbol} @ ${quote.price}`);
  });

  // Start periodic factor computation
  timerId = setInterval(() => {
    computeAndStore(api);
  }, config.updateIntervalMs);

  // Initial computation
  computeAndStore(api);

  // Notify user
  api.notify('Custom Factor Plugin', '自定义因子插件已激活 — 4个新因子可用', {
    urgency: 'low',
  });
}

// ── Lifecycle: onDeactivate ───────────────────────────────────────────

function onDeactivate(api) {
  api.logger.info('[CustomFactor] Deactivating...');
  if (timerId) { clearInterval(timerId); timerId = null; }
  if (subUnsubscribe) { subUnsubscribe(); subUnsubscribe = null; }
}

// ── Core Logic ────────────────────────────────────────────────────────

async function computeAndStore(api) {
  try {
    // Get recent kline data (last 100 candles)
    // In production, this would call the FactorDataProvider
    const quote = await api.getQuote('BTC/USDT');

    // Simulated kline data for demo purposes
    // In production, you'd use the real kline API
    const closes = generateSimulatedCloses(100);
    const highs = closes.map(c => c * 1.02);
    const lows = closes.map(c => c * 0.98);
    const volumes = Array.from({ length: 100 }, () => 1000000 + Math.random() * 5000000);

    // Compute all factors
    const factors = {
      BBW_20: computeBBW(closes, config.bbwPeriod),
      VWRSI_14: computeVWRSI(closes, volumes, config.vwrsiPeriod),
      CMOM_10: computeCMOM(closes, volumes, config.cmomPeriod),
      PPOS_20: computePPOS(highs, lows, closes, config.pposPeriod),
      timestamp: Date.now(),
    };

    // Store results
    await api.storage.set('latestFactors', factors);

    // Emit custom factor event
    api.emit('custom-factors-computed', factors);

    api.logger.debug(`[CustomFactor] Computed: BBW=${factors.BBW_20.toFixed(2)} VWRSI=${factors.VWRSI_14.toFixed(2)} CMOM=${factors.CMOM_10.toFixed(2)} PPOS=${factors.PPOS_20.toFixed(2)}`);
  } catch (err) {
    api.logger.error(`[CustomFactor] Computation error: ${err.message}`);
  }
}

function generateSimulatedCloses(count) {
  const prices = [50000];
  for (let i = 1; i < count; i++) {
    const change = (Math.random() - 0.48) * 0.02;
    prices.push(prices[i - 1] * (1 + change));
  }
  return prices;
}

// ── Plugin Entry ──────────────────────────────────────────────────────

// QUANT MOO loads this file and calls the exported functions
module.exports = {
  name: 'Custom Factor Plugin',
  version: '1.0.0',

  /**
   * Plugin entry point — receives the PluginExposedAPI
   */
  init(api) {
    api.logger.info('[CustomFactor] Plugin initialized');

    // Register lifecycle hooks
    api.on('onActivate', () => onActivate(api));
    api.on('onDeactivate', () => onDeactivate(api));

    // Register timer for periodic factor computation
    api.on('onTimer', () => computeAndStore(api));

    // Register config update handler
    api.storage.get('config').then(saved => {
      if (saved) config = { ...config, ...saved };
    });

    return {
      // Expose factor computation for external use
      computeBBW,
      computeVWRSI,
      computeCMOM,
      computePPOS,

      // Config management
      getConfig: () => config,
      updateConfig: async (updates) => {
        config = { ...config, ...updates };
        await api.storage.set('config', config);
        api.logger.info(`[CustomFactor] Config updated: ${JSON.stringify(updates)}`);

        // Restart timer with new interval
        if (timerId) clearInterval(timerId);
        timerId = setInterval(() => computeAndStore(api), config.updateIntervalMs);
      },

      // Get latest computed factors
      getLatestFactors: async () => {
        return api.storage.get('latestFactors');
      },
    };
  },
};
