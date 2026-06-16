/**
 * Custom Data Source Plugin — 自定义数据源接入示例
 *
 * 展示如何接入外部数据源到 Dawn Whales 数据管线：
 *   1. TradingView Webhook 接收器
 *   2. 自定义 REST API 数据拉取
 *   3. CSV 文件导入器
 *   4. 数据质量校验与格式转换
 *
 * 展示 Dawn Whales 插件 API 的高级用法：
 *   - 网络请求 (network permission)
 *   - 文件系统访问 (filesystem permission)
 *   - 行情数据写入 (market-data permission)
 *   - 通知推送 (notifications permission)
 *   - 生命周期管理 (onActivate, onDeactivate, onTimer)
 *   - 事件发射 (emit)
 */

// ── Configuration ─────────────────────────────────────────────────────

const DEFAULT_CONFIG = {
  webhookPort: 0, // 0 = disabled
  restApiUrl: '',
  restApiKey: '',
  restApiIntervalMs: 300000, // 5 minutes
  csvWatchPath: '',
  csvWatchIntervalMs: 10000, // 10 seconds
  dataValidation: {
    requireTimestamp: true,
    requireOHLCV: true,
    maxPriceDeviation: 0.5, // 50% deviation from last known price
    minVolume: 0,
  },
};

let config = { ...DEFAULT_CONFIG };
let webhookServer = null;
let restApiInterval = null;
let csvWatcherInterval = null;

// ── Data Source: TradingView Webhook ──────────────────────────────────

/**
 * 启动 TradingView Webhook 接收器
 * 接收来自 TradingView Alert 的 JSON payload
 *
 * Expected payload format:
 * {
 *   "symbol": "BTC/USDT",
 *   "price": 65000.50,
 *   "volume": 1234.56,
 *   "timestamp": "2026-06-16T09:00:00Z",
 *   "action": "buy" | "sell" | "alert"
 * }
 */
function startWebhookReceiver(api, port) {
  if (port <= 0) {
    api.logger.info('[DataSource] Webhook receiver disabled');
    return null;
  }

  api.logger.info(`[DataSource] Starting webhook receiver on port ${port}`);

  // Simulated webhook server (in production, use http.createServer)
  // For demo, we'll simulate receiving data periodically
  const interval = setInterval(() => {
    const mockSignal = {
      symbol: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'][Math.floor(Math.random() * 3)],
      price: 50000 + Math.random() * 20000,
      volume: 1000000 + Math.random() * 5000000,
      timestamp: new Date().toISOString(),
      action: Math.random() > 0.5 ? 'buy' : 'sell',
    };

    processWebhookData(api, mockSignal);
  }, 30000); // Every 30 seconds

  api.logger.info('[DataSource] Webhook receiver started (demo mode)');
  return interval;
}

function processWebhookData(api, data) {
  // Validate
  if (!data.symbol || !data.price) {
    api.logger.warn(`[DataSource] Invalid webhook payload: missing symbol/price`);
    return;
  }

  // Transform to Dawn Whales format
  const quote = {
    symbol: data.symbol,
    price: data.price,
    volume: data.volume || 0,
    timestamp: data.timestamp ? new Date(data.timestamp).getTime() : Date.now(),
    source: 'tradingview-webhook',
    action: data.action || 'alert',
  };

  // Store and emit
  storeQuote(api, quote);
  api.emit('webhook-signal', quote);

  api.logger.debug(`[DataSource] Webhook: ${quote.symbol} @ ${quote.price} (${quote.action})`);
}

// ── Data Source: REST API ─────────────────────────────────────────────

/**
 * 从自定义 REST API 拉取数据
 * 支持任何返回 OHLCV 格式的 API
 *
 * Expected API response format:
 * {
 *   "symbols": ["BTC/USDT", ...],
 *   "data": {
 *     "BTC/USDT": {
 *       "open": 64000, "high": 66000, "low": 63500, "close": 65500,
 *       "volume": 1234567, "timestamp": 1718500000000
 *     }
 *   }
 * }
 */
async function fetchFromRestAPI(api) {
  if (!config.restApiUrl) {
    api.logger.debug('[DataSource] REST API not configured, skipping');
    return;
  }

  try {
    api.logger.debug(`[DataSource] Fetching from ${config.restApiUrl}`);

    // In production, use fetch() with the network permission
    // For demo, generate simulated data
    const symbols = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT'];
    const basePrices = { 'BTC/USDT': 65000, 'ETH/USDT': 3500, 'SOL/USDT': 150, 'BNB/USDT': 600, 'XRP/USDT': 0.5 };

    for (const symbol of symbols) {
      const base = basePrices[symbol] || 100;
      const quote = {
        symbol,
        price: base * (1 + (Math.random() - 0.5) * 0.02),
        open: base * (1 + (Math.random() - 0.5) * 0.01),
        high: base * (1 + Math.random() * 0.02),
        low: base * (1 - Math.random() * 0.02),
        close: base * (1 + (Math.random() - 0.5) * 0.02),
        volume: 1000000 + Math.random() * 10000000,
        timestamp: Date.now(),
        source: `rest-api:${config.restApiUrl}`,
      };

      storeQuote(api, quote);
    }

    api.logger.info(`[DataSource] REST API: fetched ${symbols.length} symbols`);
  } catch (err) {
    api.logger.error(`[DataSource] REST API error: ${err.message}`);
    api.notify('数据源错误', `REST API 拉取失败: ${err.message}`, { urgency: 'normal' });
  }
}

// ── Data Source: CSV Import ───────────────────────────────────────────

/**
 * 监听 CSV 文件变化并导入数据
 * CSV 格式: symbol,timestamp,open,high,low,close,volume
 */
async function watchCSVFile(api) {
  if (!config.csvWatchPath) {
    api.logger.debug('[DataSource] CSV watch path not configured, skipping');
    return;
  }

  try {
    api.logger.debug(`[DataSource] Watching CSV: ${config.csvWatchPath}`);

    // In production, use fs.watchFile() or chokidar
    // For demo, check if file exists and log
    const fs = require('fs');
    if (fs.existsSync(config.csvWatchPath)) {
      const stats = fs.statSync(config.csvWatchPath);
      const content = fs.readFileSync(config.csvWatchPath, 'utf-8');
      const lines = content.trim().split('\n');

      if (lines.length > 1) {
        // Skip header, parse data
        let imported = 0;
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',');
          if (cols.length >= 7) {
            const quote = {
              symbol: cols[0].trim(),
              timestamp: new Date(cols[1].trim()).getTime(),
              open: parseFloat(cols[2]),
              high: parseFloat(cols[3]),
              low: parseFloat(cols[4]),
              close: parseFloat(cols[5]),
              volume: parseFloat(cols[6]),
              source: `csv:${config.csvWatchPath}`,
            };
            storeQuote(api, quote);
            imported++;
          }
        }
        api.logger.info(`[DataSource] CSV imported: ${imported} rows from ${config.csvWatchPath} (${stats.size} bytes)`);
      }
    }
  } catch (err) {
    api.logger.error(`[DataSource] CSV watch error: ${err.message}`);
  }
}

// ── Data Quality Validation ───────────────────────────────────────────

const lastKnownPrices = new Map();

function validateQuote(api, quote) {
  const rules = config.dataValidation;

  // Check required fields
  if (rules.requireTimestamp && !quote.timestamp) {
    api.logger.warn(`[DataSource] Validation failed: missing timestamp for ${quote.symbol}`);
    return false;
  }

  if (rules.requireOHLCV) {
    if (!quote.open || !quote.high || !quote.low || !quote.close || !quote.volume) {
      api.logger.warn(`[DataSource] Validation failed: missing OHLCV for ${quote.symbol}`);
      return false;
    }
  }

  // Price deviation check
  if (rules.maxPriceDeviation > 0) {
    const lastPrice = lastKnownPrices.get(quote.symbol);
    if (lastPrice && quote.price) {
      const deviation = Math.abs(quote.price - lastPrice) / lastPrice;
      if (deviation > rules.maxPriceDeviation) {
        api.logger.warn(
          `[DataSource] Validation: ${quote.symbol} price deviation ${(deviation * 100).toFixed(1)}% exceeds limit ${(rules.maxPriceDeviation * 100).toFixed(0)}%`,
        );
      }
    }
  }

  // Min volume check
  if (rules.minVolume > 0 && quote.volume && quote.volume < rules.minVolume) {
    api.logger.warn(`[DataSource] Validation: ${quote.symbol} volume ${quote.volume} below minimum ${rules.minVolume}`);
    return false;
  }

  return true;
}

// ── Storage ───────────────────────────────────────────────────────────

async function storeQuote(api, quote) {
  if (!validateQuote(api, quote)) return;

  // Update last known price
  const price = quote.price || quote.close;
  if (price) lastKnownPrices.set(quote.symbol, price);

  // Store in plugin storage (ring buffer, keep last 1000)
  const key = `quotes:${quote.symbol}`;
  let quotes = (await api.storage.get(key)) || [];
  quotes.push(quote);
  if (quotes.length > 1000) quotes = quotes.slice(-1000);
  await api.storage.set(key, quotes);

  // Emit to Dawn Whales data pipeline
  api.emit('data-source-quote', quote);
}

// ── Lifecycle ─────────────────────────────────────────────────────────

function onActivate(api) {
  api.logger.info('[DataSource] Activating custom data source plugin...');

  // Load config
  api.storage.get('config').then(saved => {
    if (saved) {
      config = { ...DEFAULT_CONFIG, ...saved };
      api.logger.info('[DataSource] Loaded saved config');
    }
  });

  // Start webhook receiver
  webhookServer = startWebhookReceiver(api, config.webhookPort);

  // Start REST API polling
  if (config.restApiUrl) {
    fetchFromRestAPI(api);
    restApiInterval = setInterval(() => fetchFromRestAPI(api), config.restApiIntervalMs);
  }

  // Start CSV watcher
  if (config.csvWatchPath) {
    csvWatcherInterval = setInterval(() => watchCSVFile(api), config.csvWatchIntervalMs);
  }

  // Emit data source status
  api.emit('data-source-status', {
    status: 'active',
    sources: {
      webhook: !!webhookServer,
      restApi: !!restApiInterval,
      csvWatcher: !!csvWatcherInterval,
    },
  });

  api.notify('Custom Data Source', '自定义数据源插件已激活', { urgency: 'low' });
  api.logger.info('[DataSource] Plugin activated');
}

function onDeactivate(api) {
  api.logger.info('[DataSource] Deactivating...');

  if (webhookServer) { clearInterval(webhookServer); webhookServer = null; }
  if (restApiInterval) { clearInterval(restApiInterval); restApiInterval = null; }
  if (csvWatcherInterval) { clearInterval(csvWatcherInterval); csvWatcherInterval = null; }
}

// ── Plugin Entry ──────────────────────────────────────────────────────

module.exports = {
  name: 'Custom Data Source Plugin',
  version: '1.0.0',

  init(api) {
    api.logger.info('[DataSource] Plugin initialized');

    api.on('onActivate', () => onActivate(api));
    api.on('onDeactivate', () => onDeactivate(api));
    api.on('onTimer', () => fetchFromRestAPI(api));

    api.storage.get('config').then(saved => {
      if (saved) config = { ...DEFAULT_CONFIG, ...saved };
    });

    return {
      getConfig: () => config,
      updateConfig: async (updates) => {
        config = { ...config, ...updates };
        await api.storage.set('config', config);
        api.logger.info(`[DataSource] Config updated`);

        // Restart services with new config
        onDeactivate(api);
        onActivate(api);
      },

      // Manual data source triggers
      triggerRestFetch: () => fetchFromRestAPI(api),
      triggerCSVImport: () => watchCSVFile(api),

      // Get stored quotes
      getQuotes: async (symbol, limit = 100) => {
        const quotes = (await api.storage.get(`quotes:${symbol}`)) || [];
        return quotes.slice(-limit);
      },

      // Get validation stats
      getValidationStats: () => ({
        trackedSymbols: lastKnownPrices.size,
        symbols: [...lastKnownPrices.entries()].map(([symbol, price]) => ({ symbol, lastPrice: price })),
      }),
    };
  },
};
