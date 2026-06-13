# Dawn Whales Billing API v2.0

> **Round**: R141 | **Author**: QClaw | **Date**: 2026-06-13
> **Status**: API SPECIFICATION — Production Ready
> **Covers**: All wallet/billing endpoints, request/response schemas, 6-layer security

---

## API Overview

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/wallet` | POST | JWT | Create wallet |
| `/api/wallet/:id` | GET | JWT | Get balance + checksum |
| `/api/wallet/deposit` | POST | Internal | Process chain deposit |
| `/api/wallet/withdraw` | POST | JWT | Request withdrawal |
| `/api/ledger/entry` | GET | JWT | Query ledger entries |
| `/api/idempotency/check` | POST | JWT | Check idempotency key status |
| `/api/deduct` | POST | JWT | Deduct balance (trade/AI/fees) |
| `/api/refund` | POST | JWT | Refund balance |
| `/api/transfer` | POST | JWT | User-to-user transfer |
| `/api/reconcile` | GET | Internal | Reconciliation report |

---

## 1. Create Wallet

### `POST /api/wallet`

Creates a wallet for authenticated user. One wallet per user. Safe to call multiple times (returns existing).

**Auth**: Bearer JWT (Authorization header)
**Idempotency**: Not needed — wallet creation is naturally idempotent by `UNIQUE(user_id)`

#### Request
```json
{
  "userId": "user_abc123"  // Optional — derived from JWT if omitted
}
```

#### Response `201 Created`
```json
{
  "wallet": {
    "id": "wal_a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "userId": "user_abc123",
    "balanceUsdt": "0.00",
    "balanceCents": 0,
    "frozenCents": 0,
    "createdAt": "2026-06-13T10:00:00.000Z"
  }
}
```

#### Response `200 OK` (wallet already exists)
```json
{
  "wallet": { "... same as above ..." },
  "existed": true
}
```

#### Error `401 Unauthorized`
```json
{
  "error": "AUTH_REQUIRED",
  "message": "Valid JWT token required"
}
```

---

## 2. Get Balance

### `GET /api/wallet/:id`

Returns wallet balance with checksum verification. Client only reads — never computes balance.

**Auth**: Bearer JWT (must match wallet owner)

#### Response `200 OK`
```json
{
  "wallet": {
    "id": "wal_a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "userId": "user_abc123",
    "balanceUsdt": "100.50",
    "balanceCents": 10050,
    "frozenCents": 2000,
    "availableUsdt": "80.50",
    "availableCents": 8050,
    "checksumVerified": true,
    "version": 42,
    "updatedAt": "2026-06-13T10:05:00.000Z"
  }
}
```

#### Error `403 Forbidden`
```json
{
  "error": "WALLET_NOT_OWNED",
  "message": "Wallet wal_xxx belongs to user_yyy, not you"
}
```

#### Checksum verification
Every balance read verifies:
```
checksum == HMAC-SHA256(secret, wallet_id|user_id|balance_cents)
```
If mismatch → `500 INTERNAL_ERROR` with `SECURITY_CHECKSUM_MISMATCH`. Server logs alert.

---

## 3. Deduct Balance (UNIVERSAL DEDUCTION PIPE)

### `POST /api/deduct`

**This is the universal deduction endpoint** — used by all fee-charging code paths:
- Trade fees (5 asset classes)
- AI service charges (10 types)
- Template purchase
- Signal subscription

**Auth**: JWT
**Idempotency**: REQUIRED — pass `idempotencyKey` in body

#### Request
```json
{
  "userId": "user_abc123",
  "amountUsdt": 5.00,
  "category": "trade_fee",
  "idempotencyKey": "SHA256-hex-string",
  "description": "Trade fee: BUY 100 AAPL @ $150.00 = $15,000 × 0.1%",
  "metadata": {
    "orderId": "ORD-abc123",
    "symbol": "AAPL",
    "quantity": 100,
    "price": 150.00,
    "market": "US"
  }
}
```

#### Response `200 OK`
```json
{
  "success": true,
  "deduction": {
    "entryId": "led_xyz789",
    "amountUsdt": "5.00",
    "amountCents": 500,
    "balanceBefore": "105.50",
    "balanceBeforeCents": 10550,
    "balanceAfter": "100.50",
    "balanceAfterCents": 10050,
    "category": "trade_fee",
    "timestamp": "2026-06-13T10:10:00.000Z"
  }
}
```

#### Error `402 Insufficient Balance`
```json
{
  "error": "INSUFFICIENT_BALANCE",
  "message": "Balance 50.00 USDT < required 100.00 USDT",
  "balanceUsdt": "50.00",
  "requiredUsdt": "100.00",
  "shortfallUsdt": "50.00"
}
```

#### Error `409 Duplicate (Idempotency Hit)`
```json
{
  "error": "DUPLICATE_REQUEST",
  "message": "This idempotency key was already processed",
  "originalEntry": { "... same as deduction.entryId ..." },
  "deduplicated": true
}
```

#### Category Mapping

| `category` | Fee Formula | Min | Failed? |
|-----------|-------------|-----|---------|
| `trade_fee` | `notional × rate` | 2 USDT (spot/stock/etf/futures/options) <br> 0.5 USDT (crypto perps) | Refund |
| `ai_deduct` | `1.0-2.0 USDT` (see table) | — | Refund on failure |
| `purchase_template` | `price ≥ 9.9 USDT` | — | Creator gets L1-L3 split |
| `subscribe_signal` | `≥ 9.9 USDT/month` | — | Creator gets L1-L3 split |
| `transfer_send` | `amount × 0.3%` | — | Recipient gets 99.4% |

#### AI Deduction Pricing Reference

| AI Feature | Price | Failure Handling |
|-----------|-------|-----------------|
| AI画线+形态识别 | 1.0 U | Refund |
| AI对话 | 1.0 U | Refund |
| AI填充策略参数 | 1.0 U | Refund |
| AI生成策略组合 | 2.0 U | Refund |
| AI回测解读 | 1.0 U | Refund |
| AI策略优化建议 | 1.5 U | Refund |
| AI策略健康检查 | 1.0 U | Refund |
| TA标准Agent | 1.0 U/轮 | Not charged |
| TA高级Agent | 1.5 U/轮 | Not charged |
| TA旗舰Agent | 2.0 U/轮 | Not charged |

---

### Idempotency Key Generation

```typescript
import crypto from 'crypto';

function generateIdempotencyKey(category: string, businessRefId: string, userId: string): string {
  const payload = `${category}|${businessRefId}|${userId}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
}

// Examples:
// Trade:    generateIdempotencyKey('trade_fee', 'ORD-20260613-A1B2C3', 'user_001')
// AI:       generateIdempotencyKey('ai_deduct', 'AI-SESS-d4e5f6', 'user_001')
// Template: generateIdempotencyKey('purchase_template', 'TPL-789abc', 'user_001')
```

---

## 4. Refund Balance

### `POST /api/refund`

Refunds a previous deduction. Only refunds CONFIRMED ledger entries. Idempotent.

#### Request
```json
{
  "userId": "user_abc123",
  "originalEntryId": "led_xyz789",
  "idempotencyKey": "SHA256-hex-string",
  "description": "Refund: AI analysis failed — strategy generation error"
}
```

#### Response `200 OK`
```json
{
  "success": true,
  "refund": {
    "entryId": "led_ref_abc456",
    "originalEntryId": "led_xyz789",
    "amountUsdt": "5.00",
    "amountCents": 500,
    "balanceBefore": "100.50",
    "balanceBeforeCents": 10050,
    "balanceAfter": "105.50",
    "balanceAfterCents": 10550,
    "category": "refund",
    "timestamp": "2026-06-13T10:15:00.000Z"
  }
}
```

#### Error `400 Bad Request`
```json
{
  "error": "REFUND_NOT_ALLOWED",
  "message": "Entry led_abc123 is already reversed"
}
```

#### Idempotency Check
Refund uses the same key pattern. If `POST /api/refund` is called twice with the same key, the second call returns `409 DUPLICATE_REQUEST` with the original refund entry.

---

## 5. Deposit (Internal Service)

### `POST /api/wallet/deposit`

**⚠️ INTERNAL SERVICE ONLY** — called by the chain monitor, not by users.

#### Request
```json
{
  "userId": "user_abc123",
  "txHash": "0xabc123...",
  "network": "TRC-20",
  "chainAmount": 100.00,
  "creditableAmount": 100.00,
  "confirmations": 25,
  "idempotencyKey": "SHA256(tx_hash)"
}
```

#### Response `200 OK`
```json
{
  "success": true,
  "deposit": {
    "entryId": "led_dep_xyz",
    "amountUsdt": "100.00",
    "balanceAfterCents": 10000,
    "network": "TRC-20",
    "txHash": "0xabc123..."
  }
}
```

---

## 6. Withdrawal

### `POST /api/wallet/withdraw`

**Auth**: JWT
**Rules**: See v17.6 withdrawal risk control

#### Request
```json
{
  "userId": "user_abc123",
  "amountUsdt": 50.00,
  "network": "TRC-20",
  "toAddress": "TXxx...",
  "idempotencyKey": "SHA256-hex-string"
}
```

#### Response `200 OK`
```json
{
  "success": true,
  "withdrawal": {
    "entryId": "led_wd_xyz",
    "amountUsdt": "50.00",
    "feeUsdt": "2.00",
    "totalDebit": "52.00",
    "balanceAfterCents": 4800,
    "status": "pending",
    "network": "TRC-20",
    "toAddress": "TXxx..."
  }
}
```

#### Error `403 Risk Block`
```json
{
  "error": "RISK_MANUAL_REVIEW",
  "message": "Account flagged for manual review (balance > 1000 USDT, registered < 7 days). Please contact support.",
  "requiredAction": "manual_review"
}
```

#### Withdrawal Rules (v17.6)

| Rule | Value | Error Code |
|------|-------|-----------|
| Single withdrawal max | 100,000 USDT | `LIMIT_EXCEEDED_SINGLE` |
| Daily withdrawal max | 1,000,000 USDT | `LIMIT_EXCEEDED_DAILY` |
| Balance > 1000 U AND reg < 7 days | Manual review | `RISK_MANUAL_REVIEW` |
| First withdrawal | Auto-pass | — |
| New address first withdrawal | Auto-pass | — |
| Same address within 24h | Auto-pass | — |
| Fee | 0.1% min 2 USDT | — |

---

## 7. User Transfer

### `POST /api/transfer`

**Auth**: JWT
**Fee**: Sender 0.3% + Receiver 0.3%

#### Request
```json
{
  "fromUserId": "user_abc123",
  "toUserId": "user_def456",
  "amountUsdt": 10.00,
  "idempotencyKey": "SHA256-hex-string",
  "memo": "Paying for strategy template"
}
```

#### Response `200 OK`
```json
{
  "success": true,
  "transfer": {
    "debitEntryId": "led_send_001",
    "creditEntryId": "led_recv_001",
    "senderFeeUsdt": "0.03",
    "receiverFeeUsdt": "0.03",
    "senderTotalDebit": "10.03",
    "receiverCredit": "9.97",
    "senderBalanceAfter": "90.47",
    "receiverBalanceAfter": "109.97"
  }
}
```

**Important**: Transfer and tipping are SEPARATE pipes.
- Transfer: sender pays 0.3%, receiver pays 0.3% → platform collects 0.6%
- Tip: sender pays full amount, creator receives amount - tier_fee (L1:30%/L2:20%/L3:10%)

---

## 8. Ledger Query

### `GET /api/ledger/entry?walletId=xxx&limit=50&offset=0`

Returns paginated ledger entries for a wallet.

#### Response `200 OK`
```json
{
  "entries": [
    {
      "id": "led_xyz789",
      "type": "debit",
      "category": "trade_fee",
      "amountCents": 500,
      "balanceBefore": 10550,
      "balanceAfter": 10050,
      "description": "Trade fee: BUY 100 AAPL @ $150.00",
      "status": "confirmed",
      "createdAt": "2026-06-13T10:10:00.000Z"
    }
  ],
  "total": 142,
  "offset": 0,
  "limit": 50
}
```

---

## 9. Idempotency Check

### `POST /api/idempotency/check`

Check if an idempotency key has already been processed.

#### Request
```json
{
  "key": "SHA256-hex-string",
  "userId": "user_abc123"
}
```

#### Response `200 OK` (key exists)
```json
{
  "exists": true,
  "status": "committed",
  "entryId": "led_xyz789",
  "responseCache": { "... cached response ..." }
}
```

#### Response `200 OK` (key not found)
```json
{
  "exists": false
}
```

---

## 10. Reconciliation

### `GET /api/reconcile?type=hourly`

**⚠️ INTERNAL ONLY** — called by cron job.

#### Response `200 OK`
```json
{
  "timestamp": "2026-06-13T11:00:00.000Z",
  "type": "hourly",
  "results": {
    "totalWallets": 1234,
    "checksumMismatches": 0,
    "ledgerInvariant": {
      "passed": true,
      "totalDebitCents": 12345678,
      "totalCreditCents": 12345678,
      "differenceCents": 0
    },
    "chainBalance": {
      "hotWallet": "25000.00",
      "coldWallet": "100000.00",
      "totalChain": "125000.00"
    },
    "dbBalance": {
      "totalCents": 12500000,
      "totalUsdt": "125000.00"
    },
    "status": "OK"
  }
}
```

#### Alert Conditions
- `checksumMismatches > 0` → `CRITICAL` — possible DB tampering
- `ledgerInvariant.passed == false` → `CRITICAL` — accounting error
- `chainBalance < dbBalance` → `CRITICAL` — possible theft, freeze withdrawals
- `chainBalance > dbBalance` → `WARNING` — unprocessed deposits

---

## 11. Security: 6-Layer Defense Implementation

### Layer 1: Server-Side Truth
```
✅ Balance: NEVER computed on client
✅ Wallet Store: client holds cache only, invalidated on every mutation
✅ All mutations: require JWT auth + userId match
✅ Audit: every API call logged with userId, IP, timestamp, result
```

### Layer 2: Double-Entry Bookkeeping
```sql
-- Invariant check (daily)
SELECT
  ABS(SUM(CASE WHEN type='debit' THEN amount_cents ELSE 0 END) -
      SUM(CASE WHEN type='credit' THEN amount_cents ELSE 0 END)) AS diff
FROM ledger_entries;
-- Must return diff = 0
```

### Layer 3: ACID + Row Lock + Idempotency
```typescript
// Transaction isolation
const result = db.transaction(() => {
  // 1. Read wallet (SQLite serializes write transactions)
  const wallet = db.prepare('SELECT * FROM wallets WHERE user_id = ?').get(userId);

  // 2. Verify integrity (Layer 4)
  assertChecksum(wallet);

  // 3. CAS update (optimistic lock)
  const updated = db.prepare(
    'UPDATE wallets SET balance_usdt = ?, version = version + 1 WHERE id = ? AND version = ?'
  ).run(newBalance, wallet.id, wallet.version);

  if (updated.changes === 0) throw new Error('CAS_FAILED_RETRY');

  // 4. Write ledger (append-only)
  // 5. Insert idempotency key (UNIQUE constraint = DB-level dedup)
  db.prepare('INSERT INTO idempotency_keys ...').run(key, ...);

  return { ... };
})();
// Any error → auto ROLLBACK
```

### Layer 4: HMAC-SHA256 Checksum
```typescript
const WALLET_SECRET = process.env.WALLET_CHECKSUM_SECRET;

function computeChecksum(w: WalletRow): string {
  return crypto
    .createHmac('sha256', WALLET_SECRET)
    .update(`${w.id}|${w.user_id}|${w.balance_usdt}`)
    .digest('hex');
}

// Verify on every read
// Verify before every mutation
// Verify in hourly reconciliation
```

### Layer 5: On-Chain Deposit Verification
```typescript
class ChainMonitor {
  async processTransaction(txHash: string, network: string) {
    // 1. Verify on-chain (TronGrid / Infura)
    const tx = await this.fetchTransaction(txHash, network);

    // 2. Check confirmations
    if (tx.confirmations < this.minConfirmations(network)) {
      return; // Wait more
    }

    // 3. Map address → userId
    const userId = this.addressRegistry.get(tx.to);

    // 4. Check replay
    const idKey = crypto.createHash('sha256').update(txHash).digest('hex');
    if (await this.isProcessed(idKey)) return;

    // 5. Credit wallet (via internal API)
    await this.creditDeposit(userId, tx.value, network, txHash, idKey);
  }
}
```

### Layer 6: Withdrawal Risk Control
```
┌─────────────────────────────────────────────────┐
│ Hot Wallet (20%)           Cold Wallet (80%)     │
│ Auto-withdrawals           Manual withdrawals    │
│ ≤ 100,000 U/transaction    > 100,000 U            │
│ No human review            Offline signature     │
│ Replenished from cold      Secure key storage    │
└─────────────────────────────────────────────────┘

Reconciliation (hourly):
  chain_balance = hot_wallet_balance + cold_wallet_balance
  db_balance = SUM(wallets.balance_usdt) / 100
  if chain_balance < db_balance:
    → CRITICAL ALERT + halt all withdrawals
```

---

## 12. Error Codes Reference

| HTTP Status | Error Code | Meaning |
|------------|-----------|---------|
| 400 | `INVALID_REQUEST` | Malformed body |
| 400 | `REFUND_NOT_ALLOWED` | Entry already reversed |
| 401 | `AUTH_REQUIRED` | Missing/invalid JWT |
| 402 | `INSUFFICIENT_BALANCE` | Not enough USDT |
| 403 | `WALLET_NOT_OWNED` | Wallet belongs to another user |
| 403 | `RISK_MANUAL_REVIEW` | Risk rule triggered |
| 403 | `LIMIT_EXCEEDED_SINGLE` | > 100,000 U per withdrawal |
| 403 | `LIMIT_EXCEEDED_DAILY` | > 1,000,000 U per day |
| 404 | `WALLET_NOT_FOUND` | No wallet for user |
| 409 | `DUPLICATE_REQUEST` | Idempotency key reused |
| 409 | `CAS_FAILED` | Version conflict — retry |
| 500 | `SECURITY_CHECKSUM_MISMATCH` | Possible DB tampering |
| 500 | `DB_TRANSACTION_FAILED` | Database error |

---

## 13. Billing Service Pseudocode

```typescript
// server/services/billing-service.ts

class BillingService {
  private db: Database;

  /**
   * Universal deduction — all fees flow through here.
   * Idempotent via idempotencyKey.
   */
  deductBalance(userId: string, amountCents: number, category: string,
                idempotencyKey: string, description: string, metadata?: object): DeductionResult {
    return this.db.transaction(() => {
      // 1. Check idempotency
      const existing = this.checkIdempotency(idempotencyKey);
      if (existing) return { ...existing, deduplicated: true };

      // 2. Lock wallet row
      const wallet = this.getWalletLocked(userId);

      // 3. Verify checksum (security layer 4)
      this.verifyChecksum(wallet);

      // 4. Check balance
      if (wallet.balance_usdt < amountCents) {
        throw new InsufficientBalanceError(wallet.balance_usdt, amountCents);
      }

      // 5. Compute new state
      const balanceBefore = wallet.balance_usdt;
      const balanceAfter = balanceBefore - amountCents;

      // 6. CAS update wallet (security layer 3)
      this.updateWalletCAS(wallet.id, wallet.version, balanceAfter);

      // 7. Write ledger entry (security layer 2)
      const entry = this.writeLedgerEntry({
        wallet_id: wallet.id, user_id: userId,
        type: 'debit', category, amount_cents: amountCents,
        balance_before: balanceBefore, balance_after: balanceAfter,
        idempotency_key: idempotencyKey, description,
        metadata: JSON.stringify(metadata || {})
      });

      // 8. Record idempotency (security layer 3)
      this.recordIdempotency(idempotencyKey, wallet.id, entry.id, entry);

      return entry;
    })();
  }

  /**
   * Refund a previous deduction. Also idempotent.
   */
  refundBalance(userId: string, originalEntryId: string,
                idempotencyKey: string, description: string): RefundResult {
    return this.db.transaction(() => {
      // 1. Check idempotency
      const existing = this.checkIdempotency(idempotencyKey);
      if (existing) return { ...existing, deduplicated: true };

      // 2. Find original entry
      const original = this.getLedgerEntry(originalEntryId);
      if (original.status === 'reversed') {
        throw new RefundNotAllowedError('Entry already reversed');
      }

      // 3. Lock wallet + credit
      const wallet = this.getWalletLocked(userId);
      this.verifyChecksum(wallet);

      const balanceAfter = wallet.balance_usdt + original.amount_cents;

      // 4. CAS update
      this.updateWalletCAS(wallet.id, wallet.version, balanceAfter);

      // 5. Write credit entry (security layer 2)
      const entry = this.writeLedgerEntry({
        wallet_id: wallet.id, user_id: userId,
        type: 'credit', category: 'refund',
        amount_cents: original.amount_cents,
        balance_before: wallet.balance_usdt,
        balance_after: balanceAfter,
        idempotency_key: idempotencyKey, description
      });

      // 6. Mark original as reversed
      this.db.prepare(
        'UPDATE ledger_entries SET status = ? WHERE id = ?'
      ).run('reversed', originalEntryId);

      // 7. Record idempotency
      this.recordIdempotency(idempotencyKey, wallet.id, entry.id, entry);

      return entry;
    })();
  }

  getBalance(userId: string): BalanceResponse {
    const wallet = this.getWallet(userId);
    this.verifyChecksum(wallet); // Verify integrity on every read
    return {
      id: wallet.id,
      userId: wallet.user_id,
      balanceUsdt: (wallet.balance_usdt / 100).toFixed(2),
      availableUsdt: ((wallet.balance_usdt - wallet.frozen_amount) / 100).toFixed(2),
      checksumVerified: true,
      version: wallet.version
    };
  }
}
```

---

> **Related**: See `docs/design/wallet-architecture.md` for 3-table design, ER diagram, and migration.
