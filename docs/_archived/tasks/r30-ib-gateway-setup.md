# IB Gateway Setup & Integration Guide

> **Task ID**: J-30-03  
> **Sprint**: 30 — Multi-Broker Expansion  
> **Last Updated**: 2026-06-06  
> **Status**: Reference Document

---

## Table of Contents

1. [IB Gateway Installation Guide](#1-ib-gateway-installation-guide)
2. [TWS API Connection](#2-tws-api-connection)
3. [API Examples](#3-api-examples)
4. [IB Contract Format](#4-ib-contract-format)
5. [Comparison with OpenD Protocol](#5-comparison-with-opend-protocol)
6. [Testing Strategy](#6-testing-strategy)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. IB Gateway Installation Guide

### 1.1 What is IB Gateway?

IB Gateway is a lightweight, headless application that provides API access to Interactive Brokers' trading infrastructure. Unlike Trader Workstation (TWS), it does not include a graphical trading interface — it exists purely to serve API connections. This makes it ideal for automated trading systems like quant-moo.

**Key differences:**

| Feature | IB Gateway | TWS |
|---------|-----------|-----|
| Purpose | API-only access | Full GUI + API |
| Resource usage | Low (~200MB RAM) | High (~1GB+ RAM) |
| Default live port | 4001 | 7496 |
| Default paper port | 4002 | 7497 |
| Auto-restart | Once per week | Daily |
| Recommended for | Automated/bot trading | Manual + API trading |

### 1.2 Download Links

**IB Gateway (recommended for quant-moo):**

| Platform | URL |
|----------|-----|
| Windows | https://www.interactivebrokers.com/en/trading/ibgateway-stable.php |
| macOS | https://www.interactivebrokers.com/en/trading/ibgateway-stable.php |
| Linux | https://www.interactivebrokers.com/en/trading/ibgateway-stable.php |

**TWS (alternative — includes GUI):**

| Platform | URL |
|----------|-----|
| Windows | https://www.interactivebrokers.com/en/trading/tws.php |
| macOS | https://www.interactivebrokers.com/en/trading/tws.php |
| Linux | https://www.interactivebrokers.com/en/trading/tws.php |

**Latest (beta) versions:**

- IB Gateway Latest: https://www.interactivebrokers.com/en/trading/ibgateway-latest.php
- TWS Latest: https://www.interactivebrokers.com/en/trading/tws-latest.php

> **Note:** Use the stable version for production. The latest/beta version may have newer API features but less stability testing.

### 1.3 Installation Steps

#### Windows

```powershell
# 1. Download the IB Gateway installer
#    Navigate to the download URL above and save the .msi file

# 2. Run the installer (silent install supported)
msiexec /i "ibgateway-stable.msi" /quiet /norestart

# 3. Default install location
#    C:\Jts\ibgateway\

# 4. Launch IB Gateway
& "C:\Jts\ibgateway\ibgateway.exe"
```

**Manual installation:**

1. Download `ibgateway-stable-windows-x64.msi` from the link above
2. Double-click the MSI file to launch the installer
3. Follow the wizard — accept defaults (install to `C:\Jts\ibgateway\`)
4. Launch IB Gateway from Start Menu or desktop shortcut
5. Log in with your IB account credentials
6. Select "Paper Trading" for testing or "Live Trading" for production

#### macOS

```bash
# 1. Download the DMG
curl -L -o ~/Downloads/ibgateway-stable.dmg \
  "https://download2.interactivebrokers.com/installers/ibgateway/stable-standalone/ibgateway-stable-standalone-macosx-x64.dmg"

# 2. Mount the DMG
hdiutil attach ~/Downloads/ibgateway-stable.dmg

# 3. Copy to Applications
cp -R "/Volumes/IB Gateway/IB Gateway.app" /Applications/

# 4. Unmount
hdiutil detach "/Volumes/IB Gateway"

# 5. Launch
open "/Applications/IB Gateway.app"
```

> **macOS Gatekeeper Note:** If macOS blocks the app, go to System Preferences → Security & Privacy → General, and click "Open Anyway" for IB Gateway.

#### Linux

```bash
# 1. Download the installer
wget -O ~/ibgateway-stable-linux-x64.sh \
  "https://download2.interactivebrokers.com/installers/ibgateway/stable-standalone/ibgateway-stable-standalone-linux-x64.sh"

# 2. Make executable
chmod +x ~/ibgateway-stable-linux-x64.sh

# 3. Run the installer (GUI mode)
~/ibgateway-stable-linux-x64.sh

# 4. For headless/server installation (no GUI)
~/ibgateway-stable-linux-x64.sh -- -q -dir ~/ibgateway

# 5. Launch
~/ibgateway/ibgateway
```

**Docker deployment (recommended for servers):**

```bash
# Use the community Docker image
docker run -d \
  --name ibgateway \
  -p 4001:4001 \
  -p 4002:4002 \
  -v ~/.ibgateway:/root/Jts \
  ghcr.io/gnzsnz/ib-gateway:stable

# Or with docker-compose
cat > docker-compose.yml << 'EOF'
version: '3.8'
services:
  ibgateway:
    image: ghcr.io/gnzsnz/ib-gateway:stable
    ports:
      - "4001:4001"   # Live trading
      - "4002:4002"   # Paper trading
    volumes:
      - ./ibgateway-data:/root/Jts
    environment:
      - TWS_USERID=your_username
      - TWS_PASSWORD=your_password
      - TRADING_MODE=paper   # or "live"
    restart: unless-stopped
EOF

docker compose up -d
```

### 1.4 Configuration

After launching IB Gateway, configure the API settings:

1. **Open Configuration**: Click the gear icon (⚙️) or go to `Configure → Settings`
2. **Navigate to API Settings**: `Settings → API → Settings`
3. **Apply these settings:**

| Setting | Value | Notes |
|---------|-------|-------|
| Enable ActiveX and Socket Clients | ✅ Checked | Required for TCP API access |
| Socket port (live) | **4001** | Default for live trading |
| Socket port (paper) | **4002** | Default for paper trading |
| Allow connections from localhost only | ✅ Checked | **Security: critical** |
| Allow connections from other computers | ❌ Unchecked | Unless remote access needed |
| Read-Only API | ❌ Unchecked | Must be unchecked for order placement |
| Create API message log file | ✅ Checked | Useful for debugging |
| Component Exchange Separator | Period (.) | Standard separator |

**Trusted IPs (if remote access is needed):**

```
127.0.0.1     # Always include localhost
192.168.1.0   # Local network (optional, if quant-moo runs on another machine)
```

### 1.5 Security Settings

**Critical security recommendations:**

1. **Always use "localhost only" connections** — IB Gateway should never be exposed to the internet directly
2. **Use IB Key (2FA)** — Enable two-factor authentication in IB Account Management
3. **Separate paper/live credentials** — Use different login sessions for paper and live accounts
4. **Firewall rules** — If running on a VPS, ensure port 4001/4002 are only accessible via localhost:

```bash
# Linux firewall — block external access to IB Gateway ports
sudo ufw deny 4001
sudo ufw deny 4002
sudo ufw allow from 127.0.0.1 to any port 4001
sudo ufw allow from 127.0.0.1 to any port 4002
```

```powershell
# Windows firewall — same concept
New-NetFirewallRule -DisplayName "IB Gateway - Block External" `
  -Direction Inbound -LocalPort 4001,4002 -Protocol TCP -Action Block
New-NetFirewallRule -DisplayName "IB Gateway - Allow Localhost" `
  -Direction Inbound -LocalPort 4001,4002 -Protocol TCP -Action Allow `
  -RemoteAddress 127.0.0.1
```

5. **API rate limits** — IB enforces pacing limits:
   - 60 historical data requests per 10 minutes
   - 100 simultaneous market data subscriptions
   - 200 orders per 10 seconds (max 10,000 per day for retail)

### 1.6 Auto-Restart Behavior

IB Gateway requires a weekly restart (typically Sunday morning). Configure auto-restart:

1. Go to `Configure → Settings → Auto Restart`
2. Set restart time to a low-activity period (e.g., Sunday 04:00 AM ET)
3. quant-moo should handle the brief disconnection gracefully via the auto-reconnect logic in `IBAdapter`

---

## 2. TWS API Connection

### 2.1 Connection Sequence

The IB API uses a TCP-based, null-delimited text protocol. The connection handshake follows this precise sequence:

```
Client                          IB Gateway/TWS
  |                                  |
  |──── TCP Connect ────────────────>|
  |<─── TCP Accept ─────────────────|
  |                                  |
  |──── "API\0" ────────────────────>|  (1. API prefix)
  |──── "v38..176\0" ───────────────>|  (2. Supported version range)
  |                                  |
  |<─── "serverVersion\0" ──────────|  (3. Server version number)
  |<─── "connectionTime\0" ─────────|  (4. Server connection timestamp)
  |                                  |
  |──── StartApi message ──────────>|  (5. Client ID + optional capabilities)
  |                                  |
  |<─── NextValidId ───────────────|  (6. First available order ID)
  |<─── ManagedAccounts ───────────|  (7. List of accessible accounts)
  |                                  |
  |    ═══ Connection established ═══|
  |                                  |
```

**Protocol details from `ib-adapter.ts`:**

```typescript
// Constants from the adapter
const IB_API_PREFIX = 'API\0';        // Protocol handshake prefix
const EOL = '\0';                      // Null byte delimiter
const MIN_SERVER_VERSION = 38;         // Minimum supported server version
const MAX_SERVER_VERSION = 176;        // Maximum supported server version
const IB_GATEWAY_LIVE_PORT = 4001;     // Gateway live trading
const IB_GATEWAY_PAPER_PORT = 4002;    // Gateway paper trading
const TWS_LIVE_PORT = 7496;            // TWS live trading
const TWS_PAPER_PORT = 7497;           // TWS paper trading
```

### 2.2 Authentication

IB Gateway uses **session-based authentication** — there are no API keys for local connections.

**Authentication model:**

- You authenticate by logging into IB Gateway with your IB account credentials (username + password + 2FA)
- Once logged in, any local TCP client can connect to the API port
- No OAuth tokens, no API keys, no HMAC signatures
- The security boundary is the IB Gateway login session itself

**For quant-moo:**

```typescript
// No API key configuration needed — just connect to the port
const adapter = createIBAdapter({
  host: '127.0.0.1',
  port: 4002,          // Paper trading via IB Gateway
  paperTrading: true,
  // No apiKey, apiSecret, or token fields!
});
await adapter.connect();
```

This is fundamentally different from Futu/Moomoo OpenD, which requires:
- `Trd_UnlockTrade` with a password hash to unlock trading
- Separate market data subscription verification

### 2.3 Client ID Management

Each TCP connection to IB Gateway must use a unique client ID (integer, 1-32).

**Rules:**

| Rule | Detail |
|------|--------|
| Range | 1 to 32 (some versions support up to 999) |
| Uniqueness | Must be unique per TWS/Gateway instance |
| Persistence | Orders are tied to client ID — reconnecting with the same ID shows those orders |
| Master client ID | ID 0 is special — it can see/cancel orders from all other clients |

**quant-moo usage:**

```typescript
// Main trading instance
const mainAdapter = createIBAdapter({ clientId: 1 });

// Secondary instance (e.g., for monitoring)
const monitorAdapter = createIBAdapter({ clientId: 2 });

// IMPORTANT: Never use the same client ID for two simultaneous connections
// The second connection will steal the first one's session
```

**Client ID conflict handling:**

If two connections use the same client ID, IB Gateway will disconnect the first one. The `IBAdapter` handles this via auto-reconnect, but it causes unnecessary churn. Always ensure unique client IDs across your application.

### 2.4 Error Handling

The `IBAdapter` implements comprehensive error handling for common connection scenarios:

#### Connection Refused

```
Error: TCP connection timeout (8000ms) to 127.0.0.1:4002
```

**Causes:**
- IB Gateway is not running
- Wrong port configured (live vs paper)
- Firewall blocking localhost connections

**Handling in adapter:**
```typescript
// The adapter catches TCP errors and falls back to mock mode
async connectReal(): Promise<boolean> {
  try {
    this.socket = await this.tcpConnect();
    // ... handshake ...
    return true;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn(`[IBAdapter] TCP connect failed: ${msg}`);
    this.cleanupSocket();
    return false;  // Caller will enable mock mode
  }
}
```

#### Timeout

```
Error: IB request timeout (15000ms) msgId=1
```

**Causes:**
- IB Gateway is overloaded or unresponsive
- Network latency (unlikely on localhost)
- Request was sent but no response received

**Handling:**
```typescript
// Each request has its own timeout
private async sendRequest(msgId, version, fields, timeout = 15000) {
  const timer = setTimeout(() => {
    this.pendingRequests.delete(reqId);
    reject(new Error(`IB request timeout (${timeout}ms) msgId=${msgId}`));
  }, timeout);
  // ...
}
```

#### Authentication Failed

IB doesn't have API-level auth failures. If you see authentication errors, it means:
- The IB Gateway session expired (weekly auto-restart)
- The account was locked due to too many failed login attempts
- Error code 502/504/2110 indicates connectivity issues

**Critical error codes from the adapter:**

```typescript
// Error codes that trigger disconnect/fallback
if (errorCode === 2110 || errorCode === 502 || errorCode === 504) {
  // 2110 = "Connectivity between IB and your workstation has been lost"
  // 502 = "Couldn't connect to TWS"
  // 504 = "Not connected"
  this.mockMode = true;
  // Notify disconnect callbacks
}
```

#### Auto-Reconnect

The adapter implements exponential backoff reconnection:

```typescript
private scheduleReconnect(): void {
  const delay = Math.min(1000 * Math.pow(1.6, this.reconnectAttempts), 30000);
  // Attempt 1: 1.0s
  // Attempt 2: 1.6s
  // Attempt 3: 2.6s
  // Attempt 4: 4.1s
  // ...
  // Max delay: 30s (capped)
  // Max attempts: 15 (configurable)
}
```

---

## 3. API Examples

### Example 1: Connect to IB Gateway and Get Account Info

```typescript
import { createIBAdapter } from './electron/broker/ib-adapter';

async function getAccountInfo() {
  // Create adapter — defaults to paper trading on port 4002
  const ib = createIBAdapter({
    id: 'ib-demo',
    host: '127.0.0.1',
    port: 4002,           // IB Gateway paper trading port
    paperTrading: true,
    clientId: 1,
    currency: 'USD',
  });

  // Connect (attempts TCP, falls back to mock if unavailable)
  await ib.connect();
  console.log(`Connected: ${ib.connected}, Mock mode: ${ib.isMockMode()}`);
  console.log(`Server version: ${ib.getServerVersion()}`);
  console.log(`Connection time: ${ib.getConnectionTime()}`);

  // Get account list
  const accounts = await ib.getAccounts();
  console.log('\n--- Accounts ---');
  for (const acc of accounts) {
    console.log(`  Account: ${acc.accountId}`);
    console.log(`  Name: ${acc.name}`);
    console.log(`  Net Assets: $${acc.netAssets.toLocaleString()}`);
    console.log(`  Cash: $${acc.cash.toLocaleString()}`);
    console.log(`  Market Value: $${acc.marketValue.toLocaleString()}`);
    console.log('');
  }

  // Get detailed funds for first account
  if (accounts.length > 0) {
    const funds = await ib.getFunds(accounts[0].accountId);
    console.log('--- Funds Detail ---');
    console.log(`  Total Assets: $${funds.totalAssets.toLocaleString()}`);
    console.log(`  Available Cash: $${funds.availableCash.toLocaleString()}`);
    console.log(`  Frozen Cash: $${funds.frozenCash.toLocaleString()}`);
    console.log(`  Market Value: $${funds.marketValue.toLocaleString()}`);
  }

  // Get positions
  const positions = await ib.getPositions(accounts[0].accountId);
  console.log('\n--- Positions ---');
  for (const pos of positions) {
    console.log(`  ${pos.code} ${pos.name}: ${pos.qty} shares`);
    console.log(`    Cost: $${pos.costPrice} | Market: $${pos.marketPrice}`);
    console.log(`    P&L: $${pos.pnl.toFixed(2)} (${pos.pnlPct.toFixed(2)}%)`);
  }

  // Disconnect
  ib.disconnect();
}

getAccountInfo().catch(console.error);
```

**Expected response (paper account):**

```
Connected: true, Mock mode: false
Server version: 176
Connection time: 20260606 09:30:00 EST

--- Accounts ---
  Account: U1234567
  Name: IB Live Account
  Net Assets: $250,000
  Cash: $125,000
  Market Value: $160,000

  Account: DU1234567
  Name: IB Paper Account
  Net Assets: $1,000,000
  Cash: $500,000
  Market Value: $500,000

--- Funds Detail ---
  Total Assets: $250,000
  Available Cash: $120,000
  Frozen Cash: $5,000
  Market Value: $160,000

--- Positions ---
  US.AAPL Apple Inc.: 200 shares
    Cost: $175.5 | Market: $195.5
    P&L: $4000.00 (11.40%)
  US.NVDA NVIDIA Corp.: 100 shares
    Cost: $95 | Market: $132.5
    P&L: $3750.00 (39.47%)
  ...
```

### Example 2: Get Real-Time Quotes for AAPL

```typescript
import { createIBAdapter } from './electron/broker/ib-adapter';

async function getAaplQuote() {
  const ib = createIBAdapter({
    clientId: 2,
    paperTrading: true,
  });

  await ib.connect();

  // ── One-shot quote (snapshot mode) ──
  const quotes = await ib.getQuotes(['AAPL']);
  const aapl = quotes[0];

  console.log('--- AAPL Quote (Snapshot) ---');
  console.log(`  Code: ${aapl.code}`);
  console.log(`  Price: $${aapl.price}`);
  console.log(`  Change: ${aapl.change > 0 ? '+' : ''}${aapl.change} (${aapl.changePct}%)`);
  console.log(`  Open: $${aapl.open}`);
  console.log(`  High: $${aapl.high}`);
  console.log(`  Low: $${aapl.low}`);
  console.log(`  Prev Close: $${aapl.prevClose}`);
  console.log(`  Volume: ${aapl.volume.toLocaleString()}`);
  console.log(`  Time: ${aapl.time}`);

  // ── Streaming quotes (push mode) ──
  console.log('\n--- Streaming AAPL for 10 seconds ---');

  ib.onQuotePush((updatedQuotes) => {
    for (const q of updatedQuotes) {
      console.log(`  [${new Date().toISOString()}] ${q.code}: $${q.price} (${q.changePct}%)`);
    }
  });

  await ib.subscribeAndPush(['AAPL']);

  // Let it stream for 10 seconds
  await new Promise(resolve => setTimeout(resolve, 10000));

  ib.disconnect();
}

getAaplQuote().catch(console.error);
```

**Expected response:**

```
--- AAPL Quote (Snapshot) ---
  Code: AAPL
  Price: $195.50
  Change: +2.35 (+1.22%)
  Open: $193.80
  High: $196.10
  Low: $193.20
  Prev Close: $193.15
  Volume: 54,231,000
  Time: 2026-06-06T14:30:00.000Z

--- Streaming AAPL for 10 seconds ---
  [2026-06-06T14:30:02.500Z] AAPL: $195.52 (+1.23%)
  [2026-06-06T14:30:05.000Z] AAPL: $195.48 (+1.21%)
  [2026-06-06T14:30:07.500Z] AAPL: $195.55 (+1.24%)
  [2026-06-06T14:30:10.000Z] AAPL: $195.61 (+1.27%)
```

### Example 3: Place a Market Order for 100 Shares of SPY

```typescript
import { createIBAdapter } from './electron/broker/ib-adapter';

async function placeSpyOrder() {
  const ib = createIBAdapter({
    clientId: 3,
    paperTrading: true,
  });

  await ib.connect();

  // ── Step 1: Check current quote ──
  const quotes = await ib.getQuotes(['SPY']);
  const spy = quotes[0];
  console.log(`SPY current price: $${spy.price}`);

  // ── Step 2: Verify contract details ──
  const contract = await ib.getContractDetails('SPY');
  console.log(`Contract resolved: conId=${contract.conId}, exchange=${contract.exchange}`);

  // ── Step 3: Place market order ──
  console.log('\nPlacing market order: BUY 100 SPY...');
  const result = await ib.placeOrder({
    code: 'SPY',          // or 'US.SPY' — both work
    side: 'BUY',
    qty: 100,
    orderType: 'MARKET',
    // price is ignored for MARKET orders
  });
  console.log(`Order placed! ID: ${result.orderId}`);

  // ── Step 4: Wait and check order status ──
  await new Promise(resolve => setTimeout(resolve, 2000));

  const orders = await ib.getOrders('U1234567');
  const myOrder = orders.find(o => o.orderId === result.orderId);
  if (myOrder) {
    console.log(`\n--- Order Status ---`);
    console.log(`  ID: ${myOrder.orderId}`);
    console.log(`  Status: ${myOrder.status}`);
    console.log(`  Filled: ${myOrder.filledQty} / ${myOrder.qty}`);
    console.log(`  Fill Price: $${myOrder.filledPrice}`);
  }

  // ── Step 5: Place a limit order for comparison ──
  console.log('\nPlacing limit order: SELL 50 SPY @ $545.00...');
  const limitResult = await ib.placeOrder({
    code: 'SPY',
    side: 'SELL',
    qty: 50,
    orderType: 'LIMIT',
    price: 545.00,
  });
  console.log(`Limit order placed! ID: ${limitResult.orderId}`);

  // ── Step 6: Cancel the limit order ──
  await new Promise(resolve => setTimeout(resolve, 1000));
  console.log(`\nCancelling order ${limitResult.orderId}...`);
  await ib.cancelOrder(limitResult.orderId, 'U1234567', 'SPY');
  console.log('Order cancelled.');

  ib.disconnect();
}

placeSpyOrder().catch(console.error);
```

**Expected response:**

```
SPY current price: $542.80
Contract resolved: conId=756733, exchange=SMART

Placing market order: BUY 100 SPY...
Order placed! ID: IB-1

--- Order Status ---
  ID: IB-1
  Status: FILLED
  Filled: 100 / 100
  Fill Price: $542.85

Placing limit order: SELL 50 SPY @ $545.00...
Limit order placed! ID: IB-2

Cancelling order IB-2...
Order cancelled.
```

### Example 4: K-line Historical Data

```typescript
import { createIBAdapter } from './electron/broker/ib-adapter';

async function getHistoricalData() {
  const ib = createIBAdapter({ clientId: 4, paperTrading: true });
  await ib.connect();

  // Get daily k-lines for TSLA
  const klines = await ib.getKlines('TSLA', '1d', 10);

  console.log('--- TSLA Daily K-lines (Last 10 Days) ---');
  console.log('Date         | Open    | High    | Low     | Close   | Volume');
  console.log('-------------|---------|---------|---------|---------|----------');

  for (const k of klines) {
    const date = new Date(k.time * 1000).toISOString().slice(0, 10);
    console.log(
      `${date} | $${k.open.toFixed(2).padStart(6)} | $${k.high.toFixed(2).padStart(6)}` +
      ` | $${k.low.toFixed(2).padStart(6)} | $${k.close.toFixed(2).padStart(6)}` +
      ` | ${k.volume.toLocaleString()}`
    );
  }

  // Get 5-minute bars for intraday
  const intraday = await ib.getKlines('AAPL', '5m', 20);
  console.log(`\nAAPL 5-min bars: ${intraday.length} bars received`);

  ib.disconnect();
}

getHistoricalData().catch(console.error);
```

---

## 4. IB Contract Format

### 4.1 Contract ID (conId) Mapping

IB uses numeric **Contract IDs (conId)** to uniquely identify every tradable instrument. Unlike Futu/Moomoo which uses string codes like `US.AAPL`, IB resolves instruments by their numeric conId.

**How conId resolution works in the adapter:**

```typescript
// The adapter maintains a cache of known contract IDs
const CONTRACT_ID_MAP: Record<string, number> = {
  'AAPL': 265598,
  'MSFT': 272093,
  'GOOGL': 208813720,
  // ...
};

// When sending a request, the conId is included in the contract fields
function lookupConId(symbol: string): number {
  return CONTRACT_ID_MAP[symbol] ?? 0;  // 0 = "resolve by symbol"
}
```

**Resolution priority:**

1. **Known conId cache** — fastest, no network round-trip
2. **ReqContractData query** — sends a contract resolution request to IB
3. **Symbol + exchange fallback** — if conId is 0, IB resolves by symbol name

### 4.2 Common US Stock conIds

| Symbol | conId | Exchange | Name |
|--------|-------|----------|------|
| AAPL | 265598 | NASDAQ | Apple Inc. |
| MSFT | 272093 | NASDAQ | Microsoft Corp. |
| GOOGL | 208813720 | NASDAQ | Alphabet Inc. (Class A) |
| GOOG | 208813721 | NASDAQ | Alphabet Inc. (Class C) |
| AMZN | 3691937 | NASDAQ | Amazon.com Inc. |
| TSLA | 76792991 | NASDAQ | Tesla Inc. |
| NVDA | 4391 | NASDAQ | NVIDIA Corp. |
| META | 107113386 | NASDAQ | Meta Platforms |
| NFLX | 320227571 | NASDAQ | Netflix Inc. |
| BABA | 169544879 | NYSE | Alibaba Group |
| JD | 207705973 | NASDAQ | JD.com Inc. |
| PDD | 339018504 | NASDAQ | PDD Holdings |
| BIDU | 48747409 | NASDAQ | Baidu Inc. |

**ETF conIds:**

| Symbol | conId | Exchange | Name |
|--------|-------|----------|------|
| SPY | 756733 | ARCA | SPDR S&P 500 ETF |
| QQQ | 320227571 | NASDAQ | Invesco QQQ Trust |
| IWM | 37704250 | ARCA | iShares Russell 2000 ETF |
| TLT | 99050517 | NASDAQ | iShares 20+ Year Treasury Bond ETF |
| GLD | 28928507 | ARCA | SPDR Gold Shares |
| VTI | 98988272 | ARCA | Vanguard Total Stock Market ETF |
| VOO | 141642069 | ARCA | Vanguard S&P 500 ETF |

**Leveraged ETF conIds:**

| Symbol | conId | Exchange | Name |
|--------|-------|----------|------|
| TQQQ | 37704303 | NASDAQ | ProShares UltraPro QQQ (3x) |
| SQQQ | 37704308 | NASDAQ | ProShares UltraPro Short QQQ (-3x) |
| SOXL | 37704296 | ARCA | Direxion Daily Semiconductor Bull 3x |
| SOXS | 37704297 | ARCA | Direxion Daily Semiconductor Bear 3x |

**Crypto conIds:**

| Symbol | conId | Exchange | Name |
|--------|-------|----------|------|
| BTC-USD | 457082756 | PAXOS | Bitcoin / USD |
| ETH-USD | 553985968 | PAXOS | Ethereum / USD |

### 4.3 Exchange Routing

IB supports smart routing across multiple exchanges. The adapter defines these supported exchanges:

```typescript
const IB_EXCHANGES = [
  'SMART',    // IB smart router (default) — auto-selects best exchange
  'NYSE',     // New York Stock Exchange
  'NASDAQ',   // NASDAQ Stock Market
  'ARCA',     // NYSE Arca (ETFs, options)
  'BATS',     // BATS Global Markets (now CBOE)
  'IEX',      // Investors Exchange
  'AMEX',     // NYSE American (formerly AMEX)
  'SEHK',     // Hong Kong Stock Exchange
  'TSEJ',     // Tokyo Stock Exchange
  'LSE',      // London Stock Exchange
  'EBS',      // SIX Swiss Exchange
  'IBIS',     // Frankfurt (Xetra)
] as const;
```

**Routing rules:**

| Scenario | Exchange | Notes |
|----------|----------|-------|
| US stock (default) | `SMART` | IB auto-routes to best venue |
| US stock (explicit) | `NYSE`, `NASDAQ`, `ARCA` | Direct exchange routing |
| HK stock | `SEHK` | Hong Kong Stock Exchange |
| ETFs | `ARCA` or `SMART` | Most US ETFs trade on ARCA |
| Crypto | `PAXOS` | IB routes crypto through Paxos |

**Symbol format parsing (from adapter):**

```typescript
// Supported input formats:
"AAPL"           → { symbol: "AAPL", exchange: "SMART" }
"US.AAPL"        → { symbol: "AAPL", exchange: "SMART" }
"AAPL.NASDAQ"    → { symbol: "AAPL", exchange: "NASDAQ" }
"00700.SEHK"     → { symbol: "00700", exchange: "SEHK" }
"HK.00700"       → { symbol: "00700", exchange: "SEHK" }
```

### 4.4 Security Types

IB supports multiple security types, identified by short string codes:

| Code | Type | Description |
|------|------|-------------|
| `STK` | Stock | Common stocks, ETFs |
| `OPT` | Option | Equity and index options |
| `FUT` | Future | Futures contracts |
| `CASH` | Cash | Forex pairs (e.g., EUR.USD) |
| `CFD` | CFD | Contract for Difference |
| `FOP` | Future Option | Options on futures |
| `WAR` | Warrant | Warrants |
| `BOND` | Bond | Fixed income |

**Contract field structure (as sent in TCP messages):**

```typescript
// The adapter builds contract fields in this order:
[
  conId,               // numeric contract ID (0 = resolve by symbol)
  symbol,              // ticker symbol
  secType,             // security type (STK, OPT, FUT, etc.)
  lastTradeDate,       // expiration date (options/futures only)
  strike,              // strike price (options only)
  right,               // PUT or CALL (options only)
  multiplier,          // contract multiplier (futures/options)
  exchange,            // target exchange (SMART, NYSE, etc.)
  currency,            // trading currency (USD, HKD, etc.)
  localSymbol,         // local exchange symbol
  tradingClass,        // trading class
  primaryExch,         // primary exchange
  includeExpired,      // include expired contracts
  secIdType,           // secondary ID type (CUSIP, ISIN, etc.)
  secId,               // secondary ID value
]
```

---

## 5. Comparison with OpenD Protocol

### 5.1 Protocol Architecture

The quant-moo codebase supports two broker protocol families:

| Aspect | OpenD (Futu/Moomoo) | IB Gateway/TWS |
|--------|---------------------|----------------|
| Base class | `OpenDBaseAdapter` | None (standalone) |
| Adapters | `FutuOpenDAdapter`, `MoomooAdapter` | `IBAdapter` |
| Transport | Binary TCP (Protobuf) | Text TCP (null-delimited) |
| Header | "FT" magic + 44-byte header | "API\0" prefix, no fixed header |
| Message format | Protobuf-encoded body | Null-separated text fields |
| Endianness | Big-endian network byte order | N/A (text protocol) |
| Content encoding | Protobuf varints + fields | Plain text numbers/strings |
| Market data | Qot_Sub / Qot_GetBasicQot | ReqMarketData (msgId=1) |
| Trading | Trd_PlaceOrder (msgId=2202) | PlaceOrder (msgId=3) |

### 5.2 Why IB Adapter Does NOT Inherit from OpenDBaseAdapter

The `IBAdapter` implements `IBrokerAdapter` directly rather than extending `OpenDBaseAdapter` for fundamental architectural reasons:

#### 5.2.1 Incompatible Wire Protocol

**OpenD protocol** uses a binary header:

```
┌──────────┬──────────┬──────────────┬──────────────┬─────────────┐
│ "FT" (2B)│ HeaderLen│ ProtoID (2B) │ ProtoFmtType │ SerialNo    │
│ Magic    │ (2B)     │ Command ID   │ (1B)         │ (4B)        │
├──────────┴──────────┴──────────────┴──────────────┴─────────────┤
│ BodyLen (4B) │ Reserved (8B) │ Body (Protobuf)                   │
└──────────────────────────────────────────────────────────────────┘
Total header: 44 bytes fixed
```

**IB protocol** uses null-delimited text:

```
┌──────────────────────────────────────────────────────┐
│ "3\045\0orderId\0symbol\0secType\0...\0action\0qty\0" │
│  msgId  version   field1    field2         fieldN     │
└──────────────────────────────────────────────────────┘
Each field separated by \0 (null byte)
```

These are fundamentally incompatible. Sharing binary parsing code with a text protocol would add complexity without benefit.

#### 5.2.2 Different Connection Handshake

**OpenD:**
```
Client → Server: InitConnect (protoId=1001, Protobuf body with clientID)
Server → Client: InitConnect response (server version, encryption flag)
```

**IB:**
```
Client → Server: "API\0" + "v38..176\0"  (raw text)
Server → Client: "176\0" + "20260606 09:30:00 EST\0"  (raw text)
Client → Server: StartApi message (msgId=71, version, clientId)
Server → Client: NextValidId + ManagedAccounts
```

The handshake sequences are entirely different and cannot share base class logic.

#### 5.2.3 Different Contract Identification

**OpenD:**
```typescript
// Futu/Moomoo use string market codes
{ market: 11, code: "AAPL" }      // market=11 means US
{ market: 1,  code: "00700" }     // market=1 means HK
```

**IB:**
```typescript
// IB uses numeric conIds + exchange strings
{ conId: 265598, symbol: "AAPL", exchange: "SMART", secType: "STK" }
```

The contract mapping tables, resolution logic, and display formats are incompatible.

#### 5.2.4 Different Order Model

**OpenD order fields:**
```typescript
// OpenD requires Protobuf-encoded Trd_PlaceOrder with:
{
  header: { trdEnv: 1, accID: "xxxxx" },
  orderCommon: {
    code: "AAPL",
    qty: 100,
    price: 195.0,
    orderType: 1,      // Normal
    trdSide: 1,        // Buy
    timeInForce: 1,    // Day
  }
}
```

**IB order fields:**
```typescript
// IB requires null-delimited PlaceOrder with:
// msgId=3, version=45, orderId, conId, symbol, secType, ...,
// action="BUY", totalQuantity=100, orderType="LMT", lmtPrice=195.0, ...
```

The order building logic shares zero common code.

#### 5.2.5 Different Authentication Model

**OpenD:**
- Requires `Trd_UnlockTrade` command with MD5 password hash
- Trade password is separate from login password
- Must unlock before any trading operation

**IB:**
- No trade unlock needed — API access is granted by the Gateway session
- Security is handled at the Gateway login level
- Read-only vs read-write is configured in Gateway settings, not per-request

### 5.3 Shared Interface: IBrokerAdapter

Both adapter families implement the same `IBrokerAdapter` interface, which is the correct abstraction point:

```typescript
interface IBrokerAdapter {
  readonly id: string;
  readonly type: string;
  readonly name: string;
  connected: boolean;

  connect(): Promise<void>;
  disconnect(): void;
  getAccounts(): Promise<AccountInfo[]>;
  getFunds(accountId: string): Promise<FundsInfo>;
  getPositions(accountId: string): Promise<PositionInfo[]>;
  getOrders(accountId: string): Promise<OrderInfo[]>;
  getQuotes(codes: string[]): Promise<QuoteInfo[]>;
  getKlines(code: string, period: string, count: number): Promise<KlineInfo[]>;
  placeOrder(order: PlaceOrderRequest): Promise<{ orderId: string }>;
  cancelOrder(orderId: string, accountId: string, code: string): Promise<void>;
  onQuotePush(callback: (quotes: QuoteInfo[]) => void): void;
  removeQuotePush(callback: (quotes: QuoteInfo[]) => void): void;
  onDisconnect(callback: () => void): void;
}
```

The `BrokerManager` and `AccountAggregator` interact with all adapters through this interface, making the protocol differences transparent to the application layer.

### 5.4 Message Format Comparison Table

| Operation | OpenD ProtoID | OpenD Format | IB MsgId | IB Format |
|-----------|---------------|-------------|----------|-----------|
| Handshake | 1001 (InitConnect) | Protobuf binary | N/A (text prefix) | `"API\0" + "v38..176\0"` |
| Subscribe quotes | 3001 (Qot_Sub) | Protobuf | 1 (ReqMarketData) | Null-delimited fields |
| Get quote | 3004 (Qot_GetBasicQot) | Protobuf | 1 (snapshot=1) | Null-delimited fields |
| Get k-lines | 3006 / 3103 | Protobuf | 20 (ReqHistoricalData) | Null-delimited fields |
| Get accounts | 2001 (Trd_GetAccList) | Protobuf | 62 (ReqAccountSummary) | Null-delimited fields |
| Get positions | 2102 (Trd_GetPositionList) | Protobuf | 61 (ReqPositions) | Null-delimited fields |
| Place order | 2202 (Trd_PlaceOrder) | Protobuf | 3 (PlaceOrder) | Null-delimited fields |
| Cancel order | 2205 (Trd_ModifyOrder) | Protobuf | 4 (CancelOrder) | Null-delimited fields |
| Push quotes | 3005 (Qot_UpdateBasicQot) | Protobuf | 1/2 (TickPrice/TickSize) | Null-delimited fields |
| Order status | Push (protoID varies) | Protobuf | 3 (OrderStatus) | Null-delimited fields |

---

## 6. Testing Strategy

### 6.1 IB Gateway Paper Account Testing

The recommended testing workflow uses IB Gateway's built-in paper trading mode:

**Setup:**

1. Launch IB Gateway
2. Log in with your IB credentials
3. Select **"Paper Trading"** when prompted
4. Verify port 4002 is active (paper trading default)
5. Confirm "Enable ActiveX and Socket Clients" is checked in API settings

**Running tests against paper account:**

```typescript
// tests/broker/ib-integration.test.ts
import { createIBAdapter } from '../../electron/broker/ib-adapter';

describe('IBAdapter Integration (Paper Account)', () => {
  let adapter: ReturnType<typeof createIBAdapter>;

  beforeAll(async () => {
    adapter = createIBAdapter({
      port: 4002,           // Paper trading port
      paperTrading: true,
      clientId: 99,         // Use high client ID for tests
    });
    await adapter.connect();

    // Skip if Gateway not available (CI/CD environment)
    if (adapter.isMockMode()) {
      console.warn('IB Gateway not available — skipping integration tests');
    }
  });

  afterAll(() => {
    adapter?.disconnect();
  });

  test('should connect and get server version', () => {
    expect(adapter.connected).toBe(true);
    expect(adapter.getServerVersion()).toBeGreaterThanOrEqual(38);
  });

  test('should return account list', async () => {
    const accounts = await adapter.getAccounts();
    expect(accounts.length).toBeGreaterThan(0);
    // Paper accounts start with "DU"
    expect(accounts.some(a => a.accountId.startsWith('DU'))).toBe(true);
  });

  test('should get AAPL quote', async () => {
    const quotes = await adapter.getQuotes(['AAPL']);
    expect(quotes.length).toBe(1);
    expect(quotes[0].price).toBeGreaterThan(0);
    expect(quotes[0].volume).toBeGreaterThanOrEqual(0);
  });

  test('should place and cancel a limit order', async () => {
    const result = await adapter.placeOrder({
      code: 'SPY',
      side: 'BUY',
      qty: 1,
      orderType: 'LIMIT',
      price: 1.00,  // Very low price — won't fill
    });

    expect(result.orderId).toMatch(/^IB-/);

    // Cancel immediately
    await adapter.cancelOrder(result.orderId, 'DU1234567', 'SPY');
  });

  test('should get k-line data', async () => {
    const klines = await adapter.getKlines('AAPL', '1d', 5);
    expect(klines.length).toBeGreaterThan(0);
    expect(klines.length).toBeLessThanOrEqual(5);
    for (const k of klines) {
      expect(k.open).toBeGreaterThan(0);
      expect(k.high).toBeGreaterThanOrEqual(k.low);
      expect(k.volume).toBeGreaterThanOrEqual(0);
    }
  });
});
```

### 6.2 Mock Mode Testing

Mock mode tests run without IB Gateway — ideal for CI/CD and development:

```typescript
// tests/broker/ib-mock.test.ts
import { createIBAdapter } from '../../electron/broker/ib-adapter';

describe('IBAdapter Mock Mode', () => {
  let adapter: ReturnType<typeof createIBAdapter>;

  beforeAll(async () => {
    // Use a port where nothing is listening — forces mock mode
    adapter = createIBAdapter({
      port: 19999,          // Non-existent port → mock fallback
      paperTrading: true,
    });
    await adapter.connect();
  });

  afterAll(() => {
    adapter?.disconnect();
  });

  test('should be in mock mode', () => {
    expect(adapter.isMockMode()).toBe(true);
    expect(adapter.connected).toBe(true);
  });

  test('should return mock accounts', async () => {
    const accounts = await adapter.getAccounts();
    expect(accounts).toHaveLength(2);
    expect(accounts[0].accountId).toBe('U1234567');
    expect(accounts[1].accountId).toBe('DU1234567');
    expect(accounts[0].netAssets).toBe(250000);
  });

  test('should return mock quotes with realistic prices', async () => {
    const quotes = await adapter.getQuotes(['AAPL', 'MSFT', 'TSLA']);
    expect(quotes).toHaveLength(3);

    // AAPL mock base price is ~195.50
    expect(quotes[0].price).toBeGreaterThan(180);
    expect(quotes[0].price).toBeLessThan(220);

    // All fields should be populated
    for (const q of quotes) {
      expect(q.code).toBeTruthy();
      expect(q.change).toBeDefined();
      expect(q.changePct).toBeDefined();
      expect(q.high).toBeGreaterThanOrEqual(q.low);
      expect(q.volume).toBeGreaterThan(0);
    }
  });

  test('should return mock positions', async () => {
    const positions = await adapter.getPositions('U1234567');
    expect(positions.length).toBeGreaterThan(0);

    for (const p of positions) {
      expect(p.code).toMatch(/^US\./);
      expect(p.qty).toBeGreaterThan(0);
      expect(p.marketValue).toBeGreaterThan(0);
    }
  });

  test('should handle mock order placement', async () => {
    const result = await adapter.placeOrder({
      code: 'AAPL',
      side: 'BUY',
      qty: 100,
      orderType: 'MARKET',
    });
    expect(result.orderId).toMatch(/^IB-/);
  });

  test('should handle mock order cancellation', async () => {
    await expect(
      adapter.cancelOrder('IB-12345', 'U1234567', 'AAPL')
    ).resolves.toBeUndefined();
  });

  test('should return mock k-lines', async () => {
    const klines = await adapter.getKlines('NVDA', '1d', 10);
    expect(klines).toHaveLength(10);

    // Verify k-line data integrity
    for (let i = 1; i < klines.length; i++) {
      // Timestamps should be in ascending order
      expect(klines[i].time).toBeGreaterThan(klines[i - 1].time);
    }
  });

  test('should push mock quotes via subscription', async () => {
    const receivedQuotes: any[] = [];

    adapter.onQuotePush((quotes) => {
      receivedQuotes.push(...quotes);
    });

    await adapter.subscribeAndPush(['AAPL', 'MSFT']);

    // Wait for at least 2 push cycles (mock pushes every 2500ms)
    await new Promise(resolve => setTimeout(resolve, 6000));

    expect(receivedQuotes.length).toBeGreaterThan(0);
    // Should have quotes for both symbols
    const codes = new Set(receivedQuotes.map(q => q.code));
    expect(codes.has('AAPL')).toBe(true);
    expect(codes.has('MSFT')).toBe(true);
  });

  test('should resolve known contract IDs', async () => {
    expect(adapter.hasKnownContract('AAPL')).toBe(true);
    expect(adapter.getContractId('AAPL')).toBe(265598);
    expect(adapter.hasKnownContract('UNKNOWN_SYMBOL')).toBe(false);
    expect(adapter.getContractId('UNKNOWN_SYMBOL')).toBe(0);
  });

  test('should get contract details', async () => {
    const details = await adapter.getContractDetails('AAPL');
    expect(details.resolved).toBe(true);
    expect(details.conId).toBe(265598);
    expect(details.symbol).toBe('AAPL');
    expect(details.secType).toBe('STK');
    expect(details.exchange).toBe('SMART');
  });
});
```

### 6.3 Integration Testing Approach

#### Test Environment Matrix

| Environment | IB Gateway | Port | Mode | Use Case |
|-------------|-----------|------|------|----------|
| Local dev | Running | 4002 | TCP real | Full integration testing |
| Local dev | Not running | Any | Mock fallback | Unit tests + UI development |
| CI/CD | Not available | 19999 | Mock forced | Automated test suites |
| Staging | Running (paper) | 4002 | TCP real | Pre-deployment validation |
| Production | Running (live) | 4001 | TCP real | Live trading |

#### Test Execution Order

```
Phase 1: Mock Mode Tests (always run)
  ├── ib-mock.test.ts
  ├── ib-contract-resolution.test.ts
  └── ib-order-types.test.ts

Phase 2: Integration Tests (requires IB Gateway)
  ├── ib-connection.test.ts
  ├── ib-quotes-live.test.ts
  ├── ib-orders-paper.test.ts
  └── ib-klines-live.test.ts

Phase 3: Stress Tests (optional, scheduled)
  ├── ib-reconnect.test.ts
  ├── ib-rate-limits.test.ts
  └── ib-multi-client.test.ts
```

#### Conditional Test Execution

```typescript
// Helper: skip test suite if IB Gateway is not available
async function skipIfNoGateway(adapter: any): Promise<boolean> {
  if (adapter.isMockMode()) {
    console.warn('IB Gateway not available — skipping integration test');
    return true;
  }
  return false;
}

// Usage in tests
test('real TCP connection', async () => {
  const adapter = createIBAdapter({ port: 4002 });
  await adapter.connect();

  if (await skipIfNoGateway(adapter)) return;

  // Real integration assertions...
  expect(adapter.getServerVersion()).toBeGreaterThan(100);
  adapter.disconnect();
});
```

#### IB Gateway Availability Detection

The adapter's auto-fallback mechanism makes it easy to write tests that work in both modes:

```typescript
// The adapter automatically falls back to mock if TCP fails
const adapter = createIBAdapter({ port: 4002 });
await adapter.connect();

// Check mode — tests can branch or skip
const isReal = !adapter.isMockMode();
console.log(`Running in ${isReal ? 'LIVE' : 'MOCK'} mode`);

// Both modes return valid data, just from different sources
const accounts = await adapter.getAccounts();
// Real: from IB Gateway TCP
// Mock: from built-in mock data generators
```

---

## 7. Troubleshooting

### Common Issues and Solutions

| Issue | Symptom | Solution |
|-------|---------|----------|
| Gateway not running | `TCP connection timeout` | Launch IB Gateway, log in, verify port |
| Wrong port | `TCP connection timeout` | Check paper (4002) vs live (4001) port |
| Client ID conflict | Previous session disconnected | Use unique clientId per connection |
| Weekly restart | Connection lost Sunday AM | Auto-reconnect handles this; schedule around it |
| Market data permissions | Error 354: "No market data permissions" | Subscribe to market data in IB Account Management |
| Rate limit exceeded | Error 162: "Historical data request pacing" | Reduce request frequency; wait 10 minutes |
| Read-only API | Orders rejected | Uncheck "Read-Only API" in Gateway settings |
| Java not found | Gateway fails to launch | Install JRE 11+ (Gateway requires Java) |
| Port already in use | `EADDRINUSE` error | Kill stale Gateway process or change port |

### Debug Logging

Enable verbose logging in quant-moo to diagnose IB issues:

```typescript
// In electron/main.ts or test setup
import log from 'electron-log';
log.transports.file.level = 'debug';
log.transports.console.level = 'debug';

// The adapter logs all key events:
// [IBAdapter] Connecting to 127.0.0.1:4002...
// [IBAdapter] TCP handshake OK: server=v176, connTime="..."
// [IBAdapter] Next valid order ID: 45
// [IBAdapter] Managed accounts: U1234567, DU1234567
// [IBAdapter] Subscribing to 5 symbols: AAPL, MSFT, ...
```

### IB Gateway Message Logs

IB Gateway writes its own API log file:

- **Windows**: `C:\Jts\ibgateway\IBGateway-XXXX\ibgw.XXXX.trace`
- **macOS**: `~/Jts/ibgateway/IBGateway-XXXX/ibgw.XXXX.trace`
- **Linux**: `~/Jts/ibgateway/IBGateway-XXXX/ibgw.XXXX.trace`

These logs show every API message sent/received and are invaluable for debugging protocol issues.

---

*This document is maintained as part of the quant-moo codebase. Update it whenever the IB adapter implementation changes significantly.*
