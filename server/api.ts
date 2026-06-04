import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

// Import DAWN WHALES engines (same as Electron main process)
import { FutuOpenDClient } from '../electron/broker/futu-opend.js';
import { StrategyEngine } from '../electron/engine/strategy-engine.js';
import { RiskEngine } from '../electron/engine/risk-engine.js';
import { BacktestEngine } from '../electron/engine/backtest-engine.js';
import { DatabaseManager } from '../electron/data/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Middleware
app.use(cors());
app.use(express.json());

// Serve PWA static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../dist-pwa')));
}

// ── Initialize Engines ─────────────────────────────────────────────────────

const db = new DatabaseManager();
db.initialize();

const strategyEngine = new StrategyEngine();
const riskEngine = new RiskEngine();
const backtestEngine = new BacktestEngine();

// Connect risk engine to strategy engine
strategyEngine.setRiskEngine(riskEngine);
riskEngine.updateTotalAssets(100000); // Default, will update from broker

// ── Futu OpenD Connection ──────────────────────────────────────────────────

let opendClient: FutuOpenDClient | null = null;
let quotes: any[] = [];

async function connectOpenD() {
  try {
    opendClient = new FutuOpenDClient('127.0.0.1', 11111);
    await opendClient.connect();
    console.log('[API] OpenD connected');

    // Subscribe to default watchlist
    const watchlist = db.getWatchlist() || [
      'US.TQQQ', 'US.QQQ', 'US.SPY', 'HK.00700', 'HK.09988'
    ];
    await opendClient.subscribeAndPush(watchlist);

    // Listen for quote updates
    opendClient.onQuotePush((newQuotes) => {
      quotes = newQuotes;
      
      // Update strategy engine
      strategyEngine.onQuoteUpdate(newQuotes);
      
      // Broadcast to WebSocket clients
      broadcast({ type: 'quotes', data: newQuotes });
    });

    // Update total assets from broker
    const accounts = await opendClient.getAccounts();
    if (accounts.length > 0) {
      const funds = await opendClient.getFunds(accounts[0].accountId);
      if (funds?.totalAssets) {
        riskEngine.updateTotalAssets(funds.totalAssets);
      }
    }
  } catch (err) {
    console.error('[API] OpenD connection failed:', err);
  }
}

// ── WebSocket Broadcasting ─────────────────────────────────────────────────

function broadcast(message: any) {
  const data = JSON.stringify(message);
  wss.clients.forEach(client => {
    if (client.readyState === 1) { // OPEN
      client.send(data);
    }
  });
}

// Listen for strategy signals
strategyEngine.onSignal((signal) => {
  broadcast({ type: 'signal', data: signal });
});

// ── REST API Endpoints ─────────────────────────────────────────────────────

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    platform: 'pwa-api',
    opendConnected: opendClient?.connected || false,
  });
});

// ── Broker Endpoints ───────────────────────────────────────────────────────

app.get('/api/broker/status', (req, res) => {
  res.json({
    connected: opendClient?.connected || false,
    host: '127.0.0.1',
    port: 11111,
  });
});

app.get('/api/broker/accounts', async (req, res) => {
  try {
    if (!opendClient?.connected) {
      return res.status(503).json({ error: 'OpenD not connected' });
    }
    const accounts = await opendClient.getAccounts();
    res.json({ accounts });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/broker/quotes', async (req, res) => {
  try {
    if (!opendClient?.connected) {
      return res.status(503).json({ error: 'OpenD not connected' });
    }
    const { codes } = req.body;
    const quoteList = await opendClient.getQuotes(codes || []);
    res.json({ quotes: quoteList });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Strategy Endpoints ─────────────────────────────────────────────────────

app.get('/api/strategies', (req, res) => {
  const strategies = strategyEngine.getAllStrategies();
  res.json({ strategies });
});

app.get('/api/strategies/:id', (req, res) => {
  const strategy = strategyEngine.getStrategy(req.params.id);
  if (!strategy) {
    return res.status(404).json({ error: 'Strategy not found' });
  }
  res.json({ strategy });
});

// ── Backtest Endpoints ─────────────────────────────────────────────────────

app.post('/api/backtest', async (req, res) => {
  try {
    const result = await backtestEngine.run(req.body);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Risk Endpoints ─────────────────────────────────────────────────────────

app.get('/api/risk/status', (req, res) => {
  const snapshot = riskEngine.getStatusSnapshot();
  res.json({ success: true, snapshot });
});

// ── Marketplace Endpoints ──────────────────────────────────────────────────

app.get('/api/marketplace', (req, res) => {
  const sortBy = req.query.sortBy as string || 'rating';
  const strategies = db.getMarketplaceStrategies(sortBy, 50);
  res.json({ strategies });
});

// ── Data Provider Endpoints ────────────────────────────────────────────────

app.get('/api/data/fundamental/:symbol', async (req, res) => {
  try {
    // TODO: Implement data provider integration
    res.json({ data: null, message: 'Data provider not yet implemented in API server' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/data/regime', async (req, res) => {
  try {
    // TODO: Implement market regime detection
    res.json({ regime: 'unknown', message: 'Market regime not yet implemented' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── WebSocket Connection ───────────────────────────────────────────────────

wss.on('connection', (ws) => {
  console.log('[WS] Client connected');
  
  // Send initial data
  ws.send(JSON.stringify({
    type: 'init',
    data: {
      quotes,
      strategies: strategyEngine.getAllStrategies(),
      risk: riskEngine.getStatusSnapshot(),
    },
  }));

  ws.on('close', () => {
    console.log('[WS] Client disconnected');
  });
});

// ── SPA Fallback ───────────────────────────────────────────────────────────

if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../dist-pwa/index.html'));
  });
}

// ── Start Server ───────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;

server.listen(PORT, async () => {
  console.log(`[API] Server running on http://localhost:${PORT}`);
  console.log(`[API] WebSocket server running on ws://localhost:${PORT}`);
  
  // Connect to OpenD
  await connectOpenD();
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n[API] Shutting down...');
  opendClient?.disconnect();
  db.close();
  server.close();
  process.exit(0);
});
