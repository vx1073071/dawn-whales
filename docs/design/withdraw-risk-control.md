# TradingEasy Withdrawal Risk Control v17.6

> **Round**: R143 | **Author**: QClaw | **Date**: 2026-06-13
> **Status**: SPECIFICATION — v17.6 Final, Locked by Owner
> **Covers**: 6 withdrawal rules, cold/hot wallet operations, review queue, rollback

---

## Overview

TradingEasy manages USDT withdrawals through a **6-rule risk engine** with automated routing and manual review for high-risk cases. All withdrawals are non-custodial — the user owns the destination address.

---

## 1. Six Withdrawal Risk Rules

### Rule 1: Per-Transaction Limit

```
Single withdrawal: ≤ 100,000 USDT
If amount > 100,000: REJECT with "Exceeds per-transaction limit (max 100,000 USDT)"
```

| Amount | Result |
|--------|--------|
| 50 USDT | ✅ Auto-processed |
| 99,000 USDT | ✅ Auto-processed |
| 100,000 USDT | ✅ Auto-processed (boundary included) |
| 100,001 USDT | ❌ Rejected — exceeds limit |
| 1,000,000 USDT | ❌ Rejected — split into 10 transactions |

### Rule 2: Daily Cumulative Limit

```
24-hour total across all withdrawals: ≤ 1,000,000 USDT
Check: SUM(withdrawal_amount) WHERE user_id AND time > now - 24h
If daily total + pending > 1,000,000: REJECT
```

### Rule 3: First-Time No Review

```
First withdrawal: automatically approved (no manual review)
First withdrawal to a new address: automatically approved
```

Why: Low risk — user is withdrawing their own funds to their own wallet.

### Rule 4: Repeat Address Fast-Track

```
If same address was used in last 24h: auto-approve
No manual review needed regardless of amount.
```

### Rule 5: High Balance + New Account = Manual Review

```
IF wallet_balance > 1,000 USDT AND account_age < 7 days:
  → Flag for MANUAL REVIEW
  → Admin must approve before processing
```

### Rule 6: Cold/Hot Wallet Routing

```
Hot wallet (< 100,000 USDT, fully automated):
  → Signed on server
  → Broadcast immediately
  → Max delay: 30 seconds

Cold wallet (> 100,000 USDT, offline signature):
  → Requires offline HSM signature
  → Manual operator approval
  → Max delay: 1 business day
```

---

## 2. Withdrawal Pipeline

```
┌──────────────────────────────────────────────────────────────────┐
│                      WITHDRAWAL PIPELINE                          │
│                                                                  │
│  User                                                           │
│  │                                                               │
│  │  POST /api/wallet/withdraw                                    │
│  │  { amount: 5000, to_address: "TXxx...", network: "TRC-20" }  │
│  ▼                                                               │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ STEP 1: Validate Request                                  │   │
│  │  - amount > 0                                             │   │
│  │  - address format valid (TRC-20: T+33chars)              │   │
│  │  - network supported                                      │   │
│  └────────────────────────┬─────────────────────────────────┘   │
│                           │ PASS                                │
│                           ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ STEP 2: Risk Check (6 Rules)                              │   │
│  │  Rule 1: amount ≤ 100,000? ──── FAIL → 413 PAYLOAD_TOO_LARGE│
│  │  Rule 2: daily total ≤ 1,000,000? ─ FAIL → 429 TOO_MANY  │   │
│  │  Rule 3: first-time? → skip review                        │   │
│  │  Rule 4: address reused? → skip review                    │   │
│  │  Rule 5: high bal + new? → FLAG MANUAL_REVIEW             │   │
│  │  Rule 6: route to hot/cold                                │   │
│  └────────────────────────┬─────────────────────────────────┘   │
│                           │                                     │
│              ┌────────────┼────────────┐                        │
│              ▼            ▼            ▼                        │
│         AUTO-APPROVE  MANUAL_REVIEW  REJECT                     │
│              │            │            │                        │
│              ▼            ▼            ▼                        │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐           │
│  │ STEP 3:       │ │ STEP 3:      │ │ STEP 3:      │           │
│  │ Deduct balance│ │ Freeze funds │ │ Return error │           │
│  │ + 0.1% fee   │ │ (status:     │ │              │           │
│  │ (min 2 USDT) │ │  pending)    │ │              │           │
│  └──────┬───────┘ └──────┬───────┘ └──────────────┘           │
│         │                │                                      │
│         ▼                ▼                                      │
│  ┌──────────────┐ ┌──────────────┐                             │
│  │ STEP 4:       │ │ STEP 4:      │                             │
│  │ Sign tx        │ │ Admin review │                             │
│  │ (hot wallet)  │ │ → approve    │                             │
│  │ Broadcast      │ │ → reject    │                             │
│  └──────┬───────┘ └──────┬───────┘                             │
│         │                │                                      │
│         ▼                ▼                                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ STEP 5: Record Result                                     │   │
│  │  Success: status=confirmed, tx_hash saved                 │   │
│  │  Failure: status=failed, ROLLBACK balance                 │   │
│  │  Rejected: status=rejected, UNFREEZE balance              │   │
│  └──────────────────────────────────────────────────────────┘   │
│                           │                                     │
│                           ▼                                     │
│  End                                                           │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. Hot Wallet Operations

### Signing Flow

```typescript
async function processHotWithdrawal(
  userId: string,
  walletId: string,
  amount: number,      // in USDT
  toAddress: string,
  network: 'TRC-20' | 'ERC-20'
): Promise<WithdrawalResult> {
  // 1. Derive private key from encrypted env
  const keyEncrypted = process.env[`${network}_HOT_WALLET_KEY_ENCRYPTED`];
  const key = decrypt(keyEncrypted, process.env.WALLET_KEY_ENCRYPTION_KEY);

  // 2. Get current chain nonce
  const nonce = await getOnchainNonce(hotWalletAddress, network);

  // 3. Build unsigned transaction
  const tx = await buildTransferTx({
    from: hotWalletAddress,
    to: toAddress,
    amount,
    token: 'USDT',
    network,
    nonce,
    feeLimit: network === 'TRC-20' ? 10 : undefined,    // TRC-20 fee cap
    gasPrice: network === 'ERC-20' ? await getGasPrice() : undefined,
  });

  // 4. Sign with hot wallet private key
  const signedTx = await signTransaction(tx, key);

  // 5. Broadcast to chain
  const txHash = await broadcastTransaction(signedTx, network);

  // 6. Record in DB
  updateWithdrawalStatus(withdrawalId, 'confirmed', txHash);

  return { status: 'confirmed', txHash };
}
```

### Config

```typescript
const HOT_WALLET_CONFIG = {
  trc20: {
    address: process.env.TRC20_HOT_WALLET_ADDRESS,
    keyEnv: 'TRC20_HOT_WALLET_KEY_ENCRYPTED',
    maxTxUsdt: 100000,
    confirmRequired: 1,  // TRC-20 is fast
  },
  erc20: {
    address: process.env.ERC20_HOT_WALLET_ADDRESS,
    keyEnv: 'ERC20_HOT_WALLET_KEY_ENCRYPTED',
    maxTxUsdt: 100000,
    confirmRequired: 1,
  },
};
```

### Hot Wallet Monitoring

```
Check every 60 seconds:
  IF hot_balance < total_db_balance * 0.10:
    ALERT: "Hot wallet low, refill from cold wallet"
  IF hot_balance > total_db_balance * 0.30:
    ALERT: "Hot wallet excess, sweep to cold wallet"
```

---

## 4. Cold Wallet Operations

### Manual Offline Signing Protocol

```
┌─────────────────────────────────────────────────────────────┐
│                    COLD WALLET SIGNING                       │
│                                                             │
│  Online Server (Hot)              Offline Machine (Cold)    │
│  ───────────────                  ───────────────────       │
│                                                             │
│  1. Build unsigned tx                                      │
│  2. Export to QR code / USB                                │
│     └─────────────▶  air gap  ──────────────┐              │
│                                              ▼              │
│                                3. Scan QR / read USB        │
│                                4. Verify tx on screen:      │
│                                   - Amount: 150,000 U       │
│                                   - To: TXxx...             │
│                                   - Network: TRC-20         │
│                                5. Operator approves          │
│                                6. Sign with HSM key          │
│                                7. Export signed tx to        │
│                                   QR code / USB             │
│     ◀─────────────  air gap  ──────────────┘              │
│  8. Scan QR / read USB                                      │
│  9. Broadcast to chain                                      │
│  10. Record tx_hash                                        │
│                                                             │
│  Total delay: 1-4 hours (operator availability)            │
└─────────────────────────────────────────────────────────────┘
```

### Cold Wallet Config

```typescript
const COLD_WALLET_CONFIG = {
  trc20: {
    address: process.env.TRC20_COLD_WALLET_ADDRESS,
    // Private key stored in HSM — NEVER in environment
    hsmSlot: 1,
    thresholdUsdt: 100000,  // All withdrawals above this go to cold
  },
  erc20: {
    address: process.env.ERC20_COLD_WALLET_ADDRESS,
    hsmSlot: 2,
    thresholdUsdt: 100000,
  },
  multiSig: {
    required: 2,
    total: 3,
    signers: [/* hardware key locations */],
  },
};
```

---

## 5. Withdrawal Fee

```
Withdrawal fee: 0.1% of amount, minimum 2 USDT

Examples:
  100 USDT → fee = max(0.10, 2.00) = 2.00 USDT (user receives 98.00)
  500 USDT → fee = max(0.50, 2.00) = 2.00 USDT (user receives 498.00)
  1,000 USDT → fee = max(1.00, 2.00) = 2.00 USDT (user receives 998.00)
  5,000 USDT → fee = max(5.00, 2.00) = 5.00 USDT (user receives 4,995.00)
  50,000 USDT → fee = max(50.00, 2.00) = 50.00 USDT (user receives 49,950.00)
```

### Fee Breakdown
```
User pays:        balance - amount + fee
  ├─ amount: to user's wallet on chain (net)
  └─ fee: to platform (gross, pays for gas + operations)
```

---

## 6. Rollback: Chain Failure Recovery

### Failure Scenario

```
1. Deduct 5,000 USDT + 5 USDT fee from wallet
2. Build + sign transaction
3. Broadcast to TRC-20 → CONNECTION ERROR (TronGrid down)
4. Transaction status UNKNOWN (may or may not be confirmed on chain)
```

### Rollback Decision Tree

```
Chain status UNKNOWN:
├─ Wait 10 minutes, recheck chain
│   ├─ tx confirmed → update status to confirmed
│   └─ tx NOT found → rollback
│
├─ Rollback process:
│   1. BEGIN TRANSACTION
│   2. UPDATE wallet balance = balance + amount + fee
│   3. INSERT ledger_entry (type=credit, category=withdrawal_rollback)
│   4. INSERT idempotency_key (key = SHA256("rollback|" + withdrawalId))
│   5. Mark withdrawal as 'failed'
│   6. COMMIT
│   7. Notify user: "Withdrawal failed. Balance restored."
│
└─ Double-check: chain query again before closing
```

---

## 7. Manual Review Queue (Admin)

### When Review Required

| Condition | Priority | Review Within |
|-----------|----------|--------------|
| balance > 1,000 U + account < 7 days | MEDIUM | 2 hours |
| Cold wallet (amount > 100,000 U) | HIGH | 4 hours |
| Repeated flags (3+ in 24h) | HIGH | 1 hour |

### Admin Review Interface

```
┌─────────────────────────────────────────────────────────────┐
│  Withdrawal Review Queue  [5 pending]                        │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ #1  user_abc | 50,000 USDT | TRC-20                 │    │
│  │     Reason: Balance > 1,000 U + Account 3 days old   │    │
│  │     To: TXxx.....abcd                                │    │
│  │     History: 2 prior withdrawals, both OK            │    │
│  │     [APPROVE] [REJECT] [REQUEST MORE INFO]           │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ #2  user_xyz | 150,000 USDT | TRC-20 (COLD)         │    │
│  │     Reason: Cold wallet threshold exceeded           │    │
│  │     To: TXxx.....6789                                │    │
│  │     Offline signature required: [PENDING OPERATOR]   │    │
│  │     [NOTIFY OPERATOR]                                │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. API Endpoints

### `POST /api/wallet/withdraw`

Request:
```json
{
  "amount": 5000.00,
  "toAddress": "TXxx...",
  "network": "TRC-20",
  "memo": "optional note"
}
```

Response (success, auto-approved):
```json
{
  "withdrawalId": "WTH-abc123",
  "status": "processed",
  "amount": 5000.00,
  "fee": 5.00,
  "netAmount": 4995.00,
  "txHash": "abc123...",
  "estimatedArrival": "3-5 minutes",
  "newBalance": 12500.00
}
```

Response (pending review):
```json
{
  "withdrawalId": "WTH-def456",
  "status": "pending_review",
  "amount": 50000.00,
  "fee": 50.00,
  "netAmount": 49950.00,
  "reason": "Manual review required (high balance + new account)",
  "estimatedReviewTime": "Within 2 hours"
}
```

Response (rejected):
```json
{
  "error": "DAILY_LIMIT_EXCEEDED",
  "message": "Daily withdrawal limit of 1,000,000 USDT exceeded",
  "currentDailyTotal": 980000.00,
  "maximumAllowed": 20000.00
}
```

---

## 9. Monitoring & Alerts

| Metric | Threshold | Alert |
|--------|-----------|-------|
| Failed withdrawals (> 5%) | > 5% failure rate in 1h | WARNING |
| Pending manual reviews (> 20) | > 20 unprocessed | WARNING |
| Cold wallet refill needed | hot < 10% of total | INFO |
| Hot wallet excess | hot > 30% of total | INFO |
| Rollback event | Any rollback | CRITICAL: investigate immediately |
| Gas spike | ERC-20 gas > 100 USD | WARNING: delay non-urgent withdrawals |

---

> **Related**: `docs/design/wallet-architecture.md`, `docs/design/transfer-vs-tip.md`, `docs/design/reconciliation.md`
