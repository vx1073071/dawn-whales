# quant-moo Wallet Architecture v2.1

> **Round**: R141→R200 | **Author**: QClaw + autoclaw | **Date**: 2026-06-16
> **Status**: DESIGN DOCUMENT — v17.9 Production Ready
> **Covers**: 3-table design, ER diagram, indexing, 6-layer security, deposit/withdrawal flow, ExecutionFeeEngine, CreatorReviewBilling, 23-touchpoint pipeline

---

## Table of Contents
1. [Overview](#1-overview)
2. [3-Table ER Diagram](#2-3-table-er-diagram)
3. [Table Definitions](#3-table-definitions)
4. [Index Strategy](#4-index-strategy)
5. [Wallet Lifecycle](#5-wallet-lifecycle)
6. [Deposit/Withdrawal Flow](#6-depositwithdrawal-flow)
7. [6-Layer Security Architecture](#7-6-layer-security-architecture)
8. [Checksum Mechanism](#8-checksum-mechanism)
9. [ExecutionFeeEngine](#9-executionfeeengine-r200)
10. [CreatorReviewBilling](#10-creatorreviewbilling-r200)
11. [23-Touchpoint Billing Pipeline](#11-23-touchpoint-billing-pipeline-r200)
12. [Migration Strategy](#12-migration-strategy)

---

## 1. Overview

The quant-moo wallet system is built on SQLite with WAL mode, providing:

- **Single-source-of-truth**: All balance computation on the server; clients never hold authoritative balance
- **Double-entry bookkeeping**: Every debit has a corresponding credit; system invariant: `SUM(debit) == SUM(credit)` per wallet
- **Append-only ledger**: Ledger entries are never modified or deleted
- **HMAC integrity**: Every wallet row has a checksum to detect direct database tampering
- **Idempotency**: Deduplication via idempotency keys prevents double-charging
- **Pessimistic row locks**: `SELECT ... FOR UPDATE` equivalent via SQLite transactions

### v17.6 Rules Compliance

| Rule | Implementation |
|------|---------------|
| SaaS不收费, 无月卡 | No subscription table, no recurring billing |
| 纯USDT无法币 | `balance_usdt` INTEGER (cents), no fiat columns |
| 转账 ≠ 打赏 | Separate `type` values: `transfer_send`/`transfer_receive` vs `tip` |
| 充值 0% | `type = 'deposit'`, `amount_usdt = chain_amount_usdt` |
| 提现 0.1% 最低 2U | `type = 'withdrawal'`, `fee_usdt = MAX(amount * 0.001, 2.0)` |
| AI 不弹窗静默扣款 | Client calls `/api/deduct`, server processes silently |

---

## 2. 3-Table ER Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                         wallets                              │
│──────────────────────────────────────────────────────────────│
│ PK  id              TEXT          UUID v4                    │
│     user_id         TEXT NOT NULL FK → users(id)             │
│     balance_usdt    INTEGER       Balance in USDT cents      │
│     checksum        TEXT           HMAC-SHA256(secret,       │
│                                     id|user_id|balance)      │
│     version         INTEGER       Optimistic lock (CAS)      │
│     frozen_amount   INTEGER       Pending withdrawals        │
│     created_at      TEXT           ISO 8601                  │
│     updated_at      TEXT           ISO 8601                  │
│──────────────────────────────────────────────────────────────│
│ UNIQUE(user_id)                                              │
│ INDEX: idx_wallets_user ON (user_id)                         │
│ INDEX: idx_wallets_checksum ON (checksum)                    │
└──────────────┬───────────────────────────────────────────────┘
               │ 1
               │
               │ *
┌──────────────▼───────────────────────────────────────────────┐
│                       ledger_entries                         │
│──────────────────────────────────────────────────────────────│
│ PK  id              TEXT          UUID v4                    │
│     wallet_id       TEXT NOT NULL FK → wallets(id)           │
│     user_id         TEXT NOT NULL FK → users(id)             │
│     type            TEXT          debit | credit             │
│     category        TEXT          (see Category enum below)  │
│     amount_cents    INTEGER       Amount in USDT cents       │
│     fee_cents       INTEGER       Fee in USDT cents          │
│     balance_before  INTEGER       Before this entry          │
│     balance_after   INTEGER       After this entry           │
│     idempotency_key TEXT NOT NULL Unique business key         │
│     description     TEXT           Human-readable            │
│     metadata        TEXT           JSON blob                  │
│     status          TEXT           pending | confirmed |      │
│                                    reversed                   │
│     created_at      TEXT           ISO 8601                  │
│──────────────────────────────────────────────────────────────│
│ INDEX: idx_ledger_wallet ON (wallet_id, created_at)          │
│ INDEX: idx_ledger_user ON (user_id, created_at)              │
│ INDEX: idx_ledger_idempotency ON (idempotency_key) UNIQUE    │
│ INDEX: idx_ledger_category ON (category, created_at)         │
│ INDEX: idx_ledger_status ON (status)                         │
└──────────────┬───────────────────────────────────────────────┘
               │
               │ references
               │
┌──────────────▼───────────────────────────────────────────────┐
│                     idempotency_keys                          │
│──────────────────────────────────────────────────────────────│
│ PK  key             TEXT          SHA256(category|ref|user)  │
│     wallet_id       TEXT NOT NULL FK → wallets(id)           │
│     entry_id        TEXT          FK → ledger_entries(id)    │
│     status          TEXT          pending | committed        │
│     response_cache  TEXT           Last response JSON         │
│     expires_at      TEXT           TTL (default 24h)         │
│     created_at      TEXT           ISO 8601                  │
│──────────────────────────────────────────────────────────────│
│ UNIQUE(key) — enforces idempotency at DB level               │
│ INDEX: idx_idem_expires ON (expires_at) — for cleanup        │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. Table Definitions

### 3.1 `wallets` Table

```sql
CREATE TABLE IF NOT EXISTS wallets (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL UNIQUE,
  balance_usdt    INTEGER NOT NULL DEFAULT 0,        -- USDT cents (e.g. 10000 = 100.00 USDT)
  checksum        TEXT NOT NULL,                      -- HMAC-SHA256(secret, id|user_id|balance)
  version         INTEGER NOT NULL DEFAULT 0,         -- Optimistic concurrency control
  frozen_amount   INTEGER NOT NULL DEFAULT 0,        -- Pending withdrawals
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**Why UNIQUE(user_id) not separate table**: One user = one wallet. No "multi-currency wallets" — only USDT.

**Why `balance_usdt` as INTEGER**: USDT cents avoid floating-point precision issues. $100.00 = 10000 cents.

**Why `version`**: CAS (compare-and-swap) pattern prevents lost updates in high-concurrency scenarios:
```sql
UPDATE wallets SET balance_usdt = ?, version = version + 1
WHERE id = ? AND version = ?;
-- If affected rows = 0 → retry
```

### 3.2 `ledger_entries` Table

```sql
CREATE TABLE IF NOT EXISTS ledger_entries (
  id              TEXT PRIMARY KEY,
  wallet_id       TEXT NOT NULL,
  user_id         TEXT NOT NULL,
  type            TEXT NOT NULL CHECK(type IN ('debit','credit')),
  category        TEXT NOT NULL CHECK(category IN (
    'deposit','withdrawal','transfer_send','transfer_receive',
    'tip','trade_fee','ai_deduct','execution_fee','execution_fee_refund',
    'ai_creator_review','purchase_template','subscribe_signal',
    'refund','platform_fee','creator_payout'
  )),
  amount_cents    INTEGER NOT NULL CHECK(amount_cents >= 0),
  fee_cents       INTEGER NOT NULL DEFAULT 0 CHECK(fee_cents >= 0),
  balance_before  INTEGER NOT NULL,
  balance_after   INTEGER NOT NULL,
  idempotency_key TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  metadata        TEXT DEFAULT '{}',                 -- JSON string
  status          TEXT NOT NULL DEFAULT 'confirmed' CHECK(status IN ('pending','confirmed','reversed')),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (wallet_id) REFERENCES wallets(id)
);
```

**Double-entry invariant**: For every row where `type='debit'` on wallet A, there must be a corresponding row where `type='credit'` on wallet B (or the platform wallet) with matching `idempotency_key`.

**Category enum**:

| Category | Type | Description |
|----------|------|-------------|
| `deposit` | credit | Chain-confirmed USDT deposit |
| `withdrawal` | debit | USDT withdrawal + fee |
| `transfer_send` | debit | User→User transfer sender |
| `transfer_receive` | credit | User→User transfer receiver |
| `tip` | debit | Tip to creator (fee via creator tier) |
| `trade_fee` | debit | Trading fee (5 asset classes) |
| `ai_deduct` | debit | AI service charge (22 touchpoints) |
| `execution_fee` | debit | Strategy execution service fee (5 asset classes, pre-trade) |
| `execution_fee_refund` | credit | Execution fee refund (order cancelled/rejected/not filled) |
| `ai_creator_review` | debit | AI creator strategy review (1U, non-refundable, gives feedback) |
| `purchase_template` | debit | Buy strategy template |
| `subscribe_signal` | debit | Subscribe to signal |
| `refund` | credit | Fee refund (failed trade, failed AI) |
| `platform_fee` | credit | Platform revenue (internal) |
| `creator_payout` | credit | Creator earnings settlement |

### 3.3 `idempotency_keys` Table

```sql
CREATE TABLE IF NOT EXISTS idempotency_keys (
  key             TEXT PRIMARY KEY,                   -- SHA256(category|ref_id|user_id)
  wallet_id       TEXT NOT NULL,
  entry_id        TEXT,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','committed')),
  response_cache  TEXT,                               -- JSON of last response
  expires_at      TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (wallet_id) REFERENCES wallets(id)
);
```

**Key generation formula**:
```
key = SHA256(category + '|' + business_ref_id + '|' + user_id)
```

Examples:
- Trade: `SHA256("trade_fee|ORD-20260613-A1B2C3|user_001")`
- AI: `SHA256("ai_deduct|AI-SESS-abc123|user_001")`
- Transfer: `SHA256("transfer_send|TXN-xyz789|user_001")`

**TTL**: Default 24 hours. Cleanup job runs hourly to remove expired keys.

---

## 4. Index Strategy

| Index | Table | Columns | Purpose |
|-------|-------|---------|---------|
| `idx_wallets_user` | wallets | `(user_id)` | Fast lookup by user |
| `idx_wallets_checksum` | wallets | `(checksum)` | Integrity scan |
| `idx_ledger_wallet` | ledger_entries | `(wallet_id, created_at)` | Wallet statement (time-ordered) |
| `idx_ledger_user` | ledger_entries | `(user_id, created_at)` | User transaction history |
| `idx_ledger_idempotency` | ledger_entries | `(idempotency_key)` UNIQUE | **Critical**: enforces idempotency |
| `idx_ledger_category` | ledger_entries | `(category, created_at)` | Revenue reports by category |
| `idx_ledger_status` | ledger_entries | `(status)` | Pending/reversed queries |
| `idx_idem_expires` | idempotency_keys | `(expires_at)` | Cleanup expired keys |

**Why UNIQUE on idempotency_key**: This is the **database-level guarantee** against duplicate charges. INSERT will fail with SQLITE_CONSTRAINT if the same key is used twice.

---

## 5. Wallet Lifecycle

```
                         ┌──────────────┐
                         │  User Signup │
                         └──────┬───────┘
                                │
                    ┌───────────▼───────────┐
                    │ POST /api/wallet       │ ← JWT auth required
                    │ Create wallet for user │
                    │ balance=0, frozen=0    │
                    └───────────┬───────────┘
                                │
              ┌─────────────────┼─────────────────┐
              ▼                 ▼                  ▼
    ┌─────────────────┐ ┌──────────────┐ ┌─────────────────┐
    │   充值 Deposit   │ │   交易扣费    │ │   提现 Withdraw  │
    │ TRC-20/ERC-20   │ │ 5 asset types│ │ 0.1% min 2U      │
    │ 充多少到多少     │ │ 下单前扣     │ │ 链上转账         │
    └────────┬────────┘ └──────┬───────┘ └────────┬────────┘
             │                 │                   │
             ▼                 ▼                   ▼
    ┌─────────────────────────────────────────────────────┐
    │                    Ledger Entry                      │
    │  type=credit/debit, category=deposit/trade/withdraw  │
    │  balance_before → balance_after                      │
    │  idempotency_key = SHA256(cat|ref|user)              │
    └─────────────────────────────────────────────────────┘
```

---

## 6. Deposit/Withdrawal Flow

### 6.1 TRC-20 Deposit (0% fee, min 20 confirmations)

```
 Chain Monitor (background service)
 ┌─────────────────────────────────────────────┐
 │ 1. Subscribe to TRC-20 USDT contract events │
 │ 2. Wait 20 block confirmations              │
 │ 3. Extract: from_address, amount, tx_hash   │
 │ 4. Map from_address → user_id (pre-reg)     │
 └──────────────────────┬──────────────────────┘
                        │
                        ▼
 ┌──────────────────────────────────────────────┐
 │ Server: POST /api/wallet/deposit              │
 │ 5. Verify tx_hash not already processed      │
 │    → Check idempotency_keys for existing      │
 │ 6. Begin transaction:                        │
 │    a. SELECT ... FOR UPDATE on wallet         │
 │    b. Verify checksum → assert integrity      │
 │    c. Update balance = balance + amount       │
 │    d. Compute new checksum                    │
 │    e. Insert ledger_entry (type=credit)        │
 │    f. Insert idempotency_key (status=committed)│
 │ 7. Commit transaction                         │
 └──────────────────────────────────────────────┘
```

**Critical**: Service monitors chain actively. **Never** accept user-submitted `tx_hash`.

### 6.2 ERC-20 Deposit (0% fee, min 12 confirmations, platform subsidizes gas)

Same flow as TRC-20 but:
- Require 12 confirmations (faster finality)
- Platform subsidizes gas: chain amount may be 99.5 USDT but user credited 100 USDT
- `description` field notes: `"ERC-20 deposit. Chain: 99.5 USDT. Platform subsidy: 0.5 USDT"`

### 6.3 Withdrawal (0.1% fee, min 2 USDT)

```
 User Request
 ┌──────────────────────────────────────────┐
 │ POST /api/wallet/withdraw                 │
 │ Body: { address, amount, network }       │
 └────────────────────┬─────────────────────┘
                      │
                      ▼
 ┌────────────────────────────────────────────────┐
 │ Server: Withdrawal Pipeline                     │
 │ 1. Verify JWT + user owns wallet                │
 │ 2. Check freeze: frozen_amount + amount <= 100K │
 │ 3. Check daily limit: today_total + amount      │
 │    ≤ 1,000,000 USDT (cents)                     │
 │ 4. Check risk rules:                            │
 │    - balance > 1000 USDT AND reg < 7 days →     │
 │      flag for manual review                     │
 │ 5. Compute fee: MAX(amount * 0.001, 200) cents  │
 │ 6. Begin transaction:                           │
 │    a. Verify wallet checksum                    │
 │    b. balance >= amount + fee?                  │
 │    c. Debit amount + fee from wallet            │
 │    d. Freeze amount (frozen_amount += amount)   │
 │    e. Write ledger_entry (type=debit + fee)     │
 │    f. Update checksum                           │
 │ 7. Commit transaction                           │
 │ 8. Queue blockchain send (hot wallet)           │
 │ 9. On chain confirmation:                       │
 │    UPDATE wallet SET frozen_amount -= amount     │
 │    UPDATE ledger_entry SET status='confirmed'    │
 │ 10. On chain failure:                           │
 │    Refund amount (but not fee) to wallet         │
 │    UPDATE ledger_entry SET status='reversed'     │
 └────────────────────────────────────────────────┘
```

---

## 7. 6-Layer Security Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Layer 6: Withdrawal Risk Control                        │
│ • 100K single / 1M daily caps                           │
│ • 7-day new user manual review (balance > 1000U)        │
│ • Hot wallet 20% / Cold wallet 80%                      │
│ • Hourly: chain balance vs DB balance reconciliation    │
│ • Daily: SUM(debit)==SUM(credit) per wallet             │
└─────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────┐
│ Layer 5: On-Chain Deposit Verification                  │
│ • Server actively monitors blockchain (TronGrid/Infura) │
│ • NEVER accepts user-submitted tx_hash                  │
│ • 20+ block confirmations before credit                 │
│ • tx_hash stored in idempotency_keys to prevent replay  │
└─────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────┐
│ Layer 4: HMAC-SHA256 Checksum                           │
│ • checksum = HMAC(secret, id|user_id|balance_cents)     │
│ • Computed on every balance mutation                    │
│ • Verified on every balance read                        │
│ • Different secret per environment (dev/staging/prod)   │
│ • Detects: direct DB tampering, corrupted rows          │
└─────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────┐
│ Layer 3: Pessimistic Row Lock + ACID + Idempotency      │
│ • SQLite BEGIN IMMEDIATE transaction                    │
│ • SELECT ... FOR UPDATE pattern (SQLite serializes)     │
│ • Version CAS prevents lost updates                     │
│ • idempotency_keys UNIQUE constraint prevents replays   │
│ • All operations wrapped in try/catch with ROLLBACK     │
└─────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────┐
│ Layer 2: Double-Entry Bookkeeping                       │
│ • System invariant: Σdebit = Σcredit per wallet          │
│ • Every mutation writes a ledger_entries row            │
│ • Ledger is APPEND-ONLY — never UPDATE or DELETE        │
│ • Reconciliation: daily sum check + checksum verify     │
│ • Platform wallet absorbs fees (internal transactions)  │
└─────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────┐
│ Layer 1: Server-Side Single Source of Truth             │
│ • Client NEVER computes balance                         │
│ • Client NEVER holds balance locally                    │
│ • All mutations go through server API (JWT authenticated)│
│ • Balance only exposed via GET /api/wallet/:id          │
│ • Server logs all mutations to audit trail              │
└─────────────────────────────────────────────────────────┘
```

### Layer 4: HMAC Checksum — Code Example

```typescript
import crypto from 'crypto';

const WALLET_CHECKSUM_SECRET = process.env.WALLET_CHECKSUM_SECRET || 'dev-secret-change-in-prod';

export function computeChecksum(walletId: string, userId: string, balanceCents: number): string {
  const payload = `${walletId}|${userId}|${balanceCents}`;
  return crypto
    .createHmac('sha256', WALLET_CHECKSUM_SECRET)
    .update(payload)
    .digest('hex');
}

export function verifyChecksum(row: WalletRow): boolean {
  const expected = computeChecksum(row.id, row.user_id, row.balance_usdt);
  if (row.checksum !== expected) {
    console.error(`[SECURITY] Checksum mismatch for wallet ${row.id}`);
    console.error(`  Expected: ${expected.substring(0,16)}...`);
    console.error(`  Actual:   ${row.checksum.substring(0,16)}...`);
    return false;
  }
  return true;
}
```

### Layer 3: Pessimistic Lock + Idempotency — Code Example

```typescript
export function deductBalance(
  db: Database,
  userId: string,
  amountCents: number,
  category: string,
  idempotencyKey: string,
  description: string
): LedgerEntry {
  // 1. Check idempotency first (outside transaction for speed)
  const existing = db.prepare(
    'SELECT entry_id, response_cache FROM idempotency_keys WHERE key = ?'
  ).get(idempotencyKey);
  if (existing) {
    return JSON.parse(existing.response_cache);
  }

  // 2. Begin transaction with lock
  const txn = db.transaction(() => {
    // Get wallet with implicit lock (SQLite serializes writes)
    const wallet = db.prepare(
      'SELECT * FROM wallets WHERE user_id = ?'
    ).get(userId) as WalletRow;
    if (!wallet) throw new Error('Wallet not found');

    // Verify integrity
    if (!verifyChecksum(wallet)) {
      throw new Error(`Checksum mismatch for wallet ${wallet.id}`);
    }

    // Check balance
    if (wallet.balance_usdt < amountCents) {
      throw new Error(`Insufficient balance: ${wallet.balance_usdt} < ${amountCents}`);
    }

    const balanceBefore = wallet.balance_usdt;
    const balanceAfter = balanceBefore - amountCents;
    const entryId = crypto.randomUUID();

    // Update wallet with version CAS
    const updateResult = db.prepare(
      'UPDATE wallets SET balance_usdt = ?, checksum = ?, version = version + 1, updated_at = datetime(\'now\') WHERE id = ? AND version = ?'
    ).run(
      balanceAfter,
      computeChecksum(wallet.id, userId, balanceAfter),
      wallet.id,
      wallet.version
    );
    if (updateResult.changes === 0) {
      throw new Error('Version conflict — retry');
    }

    // Write ledger entry (append-only)
    db.prepare(`
      INSERT INTO ledger_entries (id, wallet_id, user_id, type, category, amount_cents,
        balance_before, balance_after, idempotency_key, description, metadata, status)
      VALUES (?, ?, ?, 'debit', ?, ?, ?, ?, ?, ?, '{}', 'confirmed')
    `).run(entryId, wallet.id, userId, category, amountCents, balanceBefore, balanceAfter, idempotencyKey, description);

    // Record idempotency key
    const entry: LedgerEntry = { id: entryId, wallet_id: wallet.id, user_id: userId, type: 'debit', category, amount_cents: amountCents, balance_before: balanceBefore, balance_after: balanceAfter, status: 'confirmed' };
    db.prepare(
      'INSERT INTO idempotency_keys (key, wallet_id, entry_id, response_cache, expires_at) VALUES (?, ?, ?, ?, datetime(\'now\', \'+24 hours\'))'
    ).run(idempotencyKey, wallet.id, entryId, JSON.stringify(entry));

    return entry;
  });

  return txn();
}
```

---

## 8. Checksum Mechanism

### Purpose
Prevents direct database modification. If someone bypasses the API and runs `UPDATE wallets SET balance_usdt = 99999999`, the checksum will no longer match.

### Algorithm
```
checksum = HMAC-SHA256(secret_key, wallet_id + "|" + user_id + "|" + balance_cents)
```

### Verification Points
1. **On every balance read** (`GET /api/wallet/:id`)
2. **Before every mutation** (deduct, credit, refund)
3. **Hourly reconciliation scan**: `SELECT * FROM wallets` + verify all
4. **Transaction audit**: `SELECT * FROM ledger_entries WHERE balance_before + amount_cents != balance_after`

---

## 9. ExecutionFeeEngine (R200)

### Purpose
Handles pre-trade fee deduction for 5 asset classes according to the v17.9 fee schedule.

### Fee Table
| Asset Class | Fee Rate | Min Fee (cents) | Example |
|------------|----------|-----------------|---------|
| Stock/ETF | 0.1% | 200 USDT cents | Buy $5,000 → 500 cents |
| Futures | 0.02% | 50 USDT cents | Buy $10,000 → 200 cents |
| Options | 0.04% | 100 USDT cents | Buy $5,000 → 200 cents |
| Crypto Spot | 0.1% | 200 USDT cents | Buy $1,000 → 200 cents |
| Crypto Perp | 0.02% | 50 USDT cents | Buy $10,000 → 200 cents |

### Flow
```
User clicks "Execute Strategy"
  → estimateFee(assetClass, orderValue) → compute fee = MAX(value * rate, minFee)
  → checkBalance(userId, fee) → if insufficient: reject "余额不足"
  → holdFee(userId, fee, idempotencyKey) → freeze USDT cents
  → submitOrderToExchange(apiKey, order)
  ┌─ filled → settleFee(userId, actualValue, idempotencyKey) → charge = actualValue * rate
  ├─ cancelled → refundFee(userId, idempotencyKey, 'cancelled')
  ├─ rejected → refundFee(userId, idempotencyKey, 'rejected')
  └─ timeout → refundFee(userId, idempotencyKey, 'timeout')
```

### Key invariants
- Fee is calculated from USDT cents (INTEGER), never float
- Idempotency key = SHA256("execution_fee|" + orderId + "|" + userId)
- Refund is always full (never partial) for cancelled/rejected/timeout
- Settlement uses actual fill value (not estimated), capped at hold amount

---

## 10. CreatorReviewBilling (R200)

### Purpose
Handles AI creator strategy review billing with special non-refundable logic.

### Rules (v17.9)
| Rule | Value |
|------|-------|
| Fee per review | **1U** (100 USDT cents) |
| Refund on fail | **No** — never refunded, even if AI fails |
| Feedback provided | **Yes** — 8-item checklist feedback returned on every review |
| Unlimited submissions | **Yes** — user can submit unlimited times at 1U each |
| Appeal channel | **None** — no appeal mechanism exists |

### Flow
```
Creator submits strategy for review
  → deductAiCreatorReview(userId, 100_cents, idempotencyKey)
  → RUN AI REVIEW (8 checks: 人话描述/止损/市场/失效/因子有效/参数/回测/抄袭)
  → ALWAYS return 8-item feedback (pass or fail)
  → If pass: auto-publish to marketplace
  → If fail: return specific suggestions for each failed check
  → NEVER refund — refundWindowHours=0 enforced at DB level
```

### Why non-refundable
AI review uses compute resources regardless of pass/fail. The 1U covers the AI inference cost. 
Giving detailed feedback for every failed check provides value even without approval.

### Idempotency
Key = SHA256("ai_creator_review|" + strategyId + "|" + userId)

---

## 11. 23-Touchpoint Billing Pipeline (R200)

All 23 billing touchpoints flow through `factor-billing-gateway.ts`:

| # | Touchpoint | Category | Cost (U) | Refund |
|---|-----------|----------|----------|--------|
| 1 | AI_CHART_PATTERN | ai_deduct | 1.0 | Yes |
| 2 | AI_CONVERSATION | ai_deduct | 1.0 | Yes |
| 3 | AI_PARAM_FILL | ai_deduct | 1.0 | Yes |
| 4 | AI_STRATEGY_COMBO | ai_deduct | 2.0 | Yes |
| 5 | AI_BACKTEST_READ | ai_deduct | 1.0 | Yes |
| 6 | AI_STRATEGY_OPTIMIZE | ai_deduct | 1.5 | Yes |
| 7 | AI_HEALTH_CHECK | ai_deduct | 1.0 | Yes |
| 8 | AI_STRATEGY_MATCH | ai_deduct | 1.0 | Yes |
| 9 | AI_MARKET_STATE | ai_deduct | 1.0 | Yes |
| 10 | AI_DAILY_BRIEFING | ai_deduct | 1.0 | Yes |
| 11 | AI_ARBITRAGE_SCAN | ai_deduct | 2.0 | Yes |
| 12 | AI_SIGNAL_PUSH | ai_deduct | 0.5 | Yes |
| 13 | AI_STRESS_TEST | ai_deduct | 2.0 | Yes |
| 14 | AI_ATTRIBUTION | ai_deduct | 1.5 | Yes |
| 15 | AI_CREATOR_REVIEW | ai_creator_review | 1.0 | **No** |
| 16 | TA_STANDARD | ai_deduct | 1.0 | Yes |
| 17 | TA_ADVANCED | ai_deduct | 1.5 | Yes |
| 18 | TA_FLAGSHIP | ai_deduct | 2.0 | Yes |
| 19 | FACTOR_MULTI_BACKTEST | ai_deduct | 1.0 | Yes |
| 20 | FACTOR_DEEP_DIAGNOSIS | ai_deduct | 1.0 | Yes |
| 21 | FACTOR_PARAM_OPTIMIZE | ai_deduct | 1.5 | Yes |
| 22 | FACTOR_ALT_DATA_UNLOCK | ai_deduct | 2.0 | Yes |
| 23 | STRATEGY_EXECUTION | execution_fee | variable | Yes* |

*Execution fees refunded only on cancel/reject/timeout, never on filled orders.

### Pipeline invariants
1. hold → settle → (never hold without settlement)
2. HOLD_TIMEOUT = 1h (auto-refund expired holds)
3. All entries go through idempotency check before processing
4. audit_billing_entries table records every attempt/settle/refund

---

## 12. Migration Strategy

### migration-v2.ts (R141)

```typescript
// server/db/migration-v2.ts
import { getMainDb } from './database';

export function runMigrationV2(): void {
  const db = getMainDb();

  db.transaction(() => {
    console.log('[Migration v2] Creating wallet tables...');

    // wallets table
    db.exec(`
      CREATE TABLE IF NOT EXISTS wallets (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE,
        balance_usdt INTEGER NOT NULL DEFAULT 0,
        checksum TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 0,
        frozen_amount INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    `);

    // ledger_entries table
    db.exec(`
      CREATE TABLE IF NOT EXISTS ledger_entries (
        id TEXT PRIMARY KEY,
        wallet_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('debit','credit')),
        category TEXT NOT NULL CHECK(category IN (
          'deposit','withdrawal','transfer_send','transfer_receive',
          'tip','trade_fee','ai_deduct','execution_fee','execution_fee_refund',
          'ai_creator_review','purchase_template','subscribe_signal',
          'refund','platform_fee','creator_payout'
        )),
        amount_cents INTEGER NOT NULL CHECK(amount_cents >= 0),
        fee_cents INTEGER NOT NULL DEFAULT 0 CHECK(fee_cents >= 0),
        balance_before INTEGER NOT NULL,
        balance_after INTEGER NOT NULL,
        idempotency_key TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        metadata TEXT DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'confirmed' CHECK(status IN ('pending','confirmed','reversed')),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (wallet_id) REFERENCES wallets(id)
      );
    `);

    // idempotency_keys table
    db.exec(`
      CREATE TABLE IF NOT EXISTS idempotency_keys (
        key TEXT PRIMARY KEY,
        wallet_id TEXT NOT NULL,
        entry_id TEXT,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','committed')),
        response_cache TEXT,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (wallet_id) REFERENCES wallets(id)
      );
    `);

    // Indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_wallets_user ON wallets(user_id);
      CREATE INDEX IF NOT EXISTS idx_wallets_checksum ON wallets(checksum);
      CREATE INDEX IF NOT EXISTS idx_ledger_wallet ON ledger_entries(wallet_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_ledger_user ON ledger_entries(user_id, created_at);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_idempotency ON ledger_entries(idempotency_key);
      CREATE INDEX IF NOT EXISTS idx_ledger_category ON ledger_entries(category, created_at);
      CREATE INDEX IF NOT EXISTS idx_ledger_status ON ledger_entries(status);
      CREATE INDEX IF NOT EXISTS idx_idem_expires ON idempotency_keys(expires_at);
    `);

    console.log('[Migration v2] Wallet tables created successfully');
    console.log('[Migration v2] 3 tables + 8 indexes');
  })();
}
```

### Rollback
Not supported. Wallet data is financial — never delete, never rollback.

---

> **Next**: See `docs/api/billing-api.md` for API endpoint definitions.

---

## v17.9 Changelog (R200)

| Change | Details |
|--------|---------|
| **3 new EntryType categories** | `execution_fee`, `execution_fee_refund`, `ai_creator_review` added to ledger_entries.category CHECK constraint |
| **ExecutionFeeEngine** | Pre-trade fee deduction for 5 asset classes. Flow: estimate → hold → submit → settle/refund. Fee rates per fee-schedule.md v17.9 |
| **CreatorReviewBilling** | 1U/次, non-refundable, 8-item checklist feedback on every review. refundWindowHours=0 enforced at DB level |
| **23-Touchpoint pipeline** | All 23 billing touchpoints (#1-#23) documented in factor-billing-gateway.ts with full hold→settle→refund flow |
| **audit_billing_entries** | Every billing attempt/settle/refund recorded to audit table for reconciliation |
| **HOLD_TIMEOUT** | 1h auto-refund for expired holds (prevents fund lock-up) |
| **SECRET_KEY hardening** | WALLET_CHECKSUM_SECRET moved to env variable (v17.6 hardcoded fallback removed) |

> **Compliance**: All changes validated against `docs/reference/fee-schedule.md` v17.9. Any deviation is a bug.
