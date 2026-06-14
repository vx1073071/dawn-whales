# TradingEasy Chain Security v2.0

> **Round**: R142 | **Author**: QClaw | **Date**: 2026-06-13
> **Status**: SECURITY SPECIFICATION — Production Ready
> **Covers**: Anti-forgery, anti-replay, cold/hot wallet security, key management, attack vectors

---

## Overview

TradingEasy handles real USDT with a two-wallet architecture and server-side validation. This document covers all chain-level security threats and their mitigations.

---

## 1. Threat Model

```
                    ┌──────────────┐
                    │   Attacker   │
                    └──────┬───────┘
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                 ▼
   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
   │ Forge deposit │ │ Replay tx    │ │ Steal keys   │
   │ tx_hash       │ │ hash         │ │              │
   └──────┬───────┘ └──────┬───────┘ └──────┬───────┘
          │                │                 │
   ┌──────▼───────┐ ┌──────▼───────┐ ┌──────▼───────┐
   │ Mitigation:  │ │ Mitigation:  │ │ Mitigation:  │
   │ Server-only  │ │ Idempotency  │ │ Cold wallet  │
   │ chain scan   │ │ keys + UNIQUE│ │ 80%+offline  │
   │ (Section 2)  │ │ (Section 3)  │ │ (Section 5)  │
   └──────────────┘ └──────────────┘ └──────────────┘
```

### Additional Threats

| # | Threat | Vector | Severity | Mitigation |
|---|--------|--------|----------|-----------|
| 1 | **Forged deposit** | User submits fake tx_hash | HIGH | §2 |
| 2 | **Replay deposit** | Same tx_hash credited twice | CRITICAL | §3 |
| 3 | **Private key compromise** | Hot wallet key leaked | CRITICAL | §5 |
| 4 | **Insider attack** | DB admin modifies balance directly | HIGH | §4 |
| 5 | **Chain reorg** | Block reorganization invalidates tx | MEDIUM | §6 |
| 6 | **Dust attack** | Tiny deposits to probe address mapping | LOW | §7 |
| 7 | **Withdrawal to scam address** | User tricked into withdrawing | LOW | §8 |
| 8 | **API MITM** | Deposit address intercepted | HIGH | §9 |

---

## 2. Anti-Forgery: Server-Only Chain Validation

### Attack
User claims: "I deposited 10,000 USDT, tx_hash: 0xabc..."

### Why It's Dangerous
If the server trusts user-submitted `tx_hash`:
1. Attacker picks any valid USDT transfer on chain
2. Submits that tx_hash as their deposit
3. Gets credited without actually sending USDT to the platform

### Defense: Server-Only Chain Scanning

```
❌ WRONG:
  User → POST /api/deposit { tx_hash: "0xabc..." }
  Server → blindly trusts, credits wallet

✅ CORRECT:
  Server → runs ChainMonitor.scan() every 3-15 seconds
  Server → finds tx_hash "0xabc..." ON CHAIN
  Server → verifies:
    1. to_address ∈ deposit_addresses table
    2. confirmations ≥ minimum
    3. tx_hash not in idempotency_keys
  Server → credits wallet if all pass
```

### Key Principle
> **The server NEVER accepts `tx_hash` from a user. It only trusts what it observes directly on-chain.**

### Implementation Checklist

```
☐ Chain monitor runs as background service (not request-driven)
☐ User-facing API has NO deposit submission endpoint
☐ Deposit address is unique per user (derived from user_id)
☐ Address-to-user mapping stored securely in DB
☐ Only the ChainMonitor can call internal deposit credit API
☐ Internal deposit API requires service-level auth (not user JWT)
```

---

## 3. Anti-Replay: Idempotency via UNIQUE Constraint

### Attack
After a legitimate deposit is credited, the same `tx_hash` is re-submitted (chain monitor restart, bug, or malicious double-send).

### Defense: Database-Level Deduplication

```sql
-- idempotency_keys table with UNIQUE constraint
CREATE TABLE IF NOT EXISTS idempotency_keys (
  key TEXT PRIMARY KEY,           -- SHA256(tx_hash)
  wallet_id TEXT NOT NULL,
  entry_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  response_cache TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

The `PRIMARY KEY` (which is also `UNIQUE`) on `key` guarantees:

```
Attempt 1: INSERT INTO idempotency_keys (key='abc123', ...) → SUCCESS
Attempt 2: INSERT INTO idempotency_keys (key='abc123', ...) → SQLITE_CONSTRAINT → SKIP
```

### Key Generation

```typescript
// Deposit: key = SHA256(tx_hash)
// Trade fee: key = SHA256("trade_fee|orderId|userId")
// AI deduct: key = SHA256("ai_deduct|sessionId|userId")
// Withdrawal: key = SHA256("withdrawal|requestId|userId")

function idempotencyKey(category: string, refId: string, userId: string): string {
  return crypto.createHash('sha256').update(`${category}|${refId}|${userId}`).digest('hex');
}
```

### Why Database-Level (Not Application-Level)?

Application-level dedup has race conditions:

```typescript
// ❌ Race condition: two concurrent requests both check → both proceed
if (!await checkExisting(key)) {  // Request A passes
  if (!await checkExisting(key)) { // Request B ALSO passes (A hasn't committed yet)
    credit();                       // DOUBLE CREDIT!
  }
}

// ✅ Database-level: one INSERT succeeds, other gets constraint error
// Wrapped in a transaction
try {
  db.prepare('INSERT INTO idempotency_keys ...').run(key, ...);
  // Only one request reaches here
  credit();
} catch (e) {
  if (e.code === 'SQLITE_CONSTRAINT') return cachedResponse(key);
}
```

---

## 4. HMAC Checksum: Anti-Tampering

### Attack
An attacker with database access (insider, SQL injection, backup compromise) directly modifies:
```sql
UPDATE wallets SET balance_usdt = 99999999 WHERE user_id = 'attacker';
```

### Defense: Per-Row HMAC-SHA256

Every wallet row has a `checksum` field:
```
checksum = HMAC-SHA256(WALLET_SECRET, wallet_id + "|" + user_id + "|" + balance_usdt)
```

After the attack:
```
SELECT balance_usdt = 99999999  ← modified
SELECT checksum = HMAC(secret, "wal|user|5000")  ← NOT matching 99999999!
→ Reconciliation detects mismatch → CRITICAL alert
```

### Secret Management

```
Environment:  WALLET_CHECKSUM_SECRET
Dev:          "dev-test-key-do-not-use-in-prod-12345"
Staging:      Configured via .env file
Production:   Configured via secrets manager, NEVER in source code
              Rotated on key rotation schedule (quarterly)
```

---

## 5. Cold/Hot Wallet Architecture

### Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     Wallet Architecture                       │
│                                                              │
│  ┌─────────────────────────┐    ┌──────────────────────────┐ │
│  │     HOT WALLET (20%)    │    │   COLD WALLET (80%)      │ │
│  │                         │    │                          │ │
│  │  • Online server        │    │  • Offline machine       │ │
│  │  • Private key in       │    │  • Private key in        │ │
│  │    environment variable │    │    hardware wallet /     │ │
│  │    (encrypted at rest)  │    │    air-gapped HSM        │ │
│  │  • Auto-withdrawals     │    │  • Manual withdrawals    │ │
│  │    ≤ 100,000 U/trans    │    │    > 100,000 U           │ │
│  │  • Refilled from cold   │    │  • Multi-sig required    │ │
│  │    when < 10% total     │    │                          │ │
│  └─────────────────────────┘    └──────────────────────────┘ │
│                                                              │
│  Hot wallet balance monitor:                                  │
│    IF hot_balance < total_db_balance * 0.10:                 │
│      → Alert: refill hot wallet from cold                    │
│    IF hot_balance > total_db_balance * 0.30:                 │
│      → Sweep excess to cold wallet                           │
└──────────────────────────────────────────────────────────────┘
```

### Hot Wallet Configuration

```typescript
// server/services/chain-monitor.ts

const HOT_WALLET_CONFIG = {
  // TRC-20 Hot Wallet
  trc20: {
    address: process.env.TRC20_HOT_WALLET_ADDRESS,
    privateKeyEncrypted: process.env.TRC20_HOT_WALLET_KEY_ENCRYPTED,
    encryptionKey: process.env.WALLET_KEY_ENCRYPTION_KEY, // Separate from checksum secret
    maxTransactionUsdt: 100000,
  },
  // ERC-20 Hot Wallet
  erc20: {
    address: process.env.ERC20_HOT_WALLET_ADDRESS,
    privateKeyEncrypted: process.env.ERC20_HOT_WALLET_KEY_ENCRYPTED,
    encryptionKey: process.env.WALLET_KEY_ENCRYPTION_KEY,
    maxTransactionUsdt: 100000,
  },
};
```

### Cold Wallet Protocol

1. Cold wallet private key stored in **hardware security module (HSM)** or **air-gapped machine**
2. Withdrawals > 100,000 USDT require **offline signature**
3. Process:
   ```
   a. Server generates unsigned transaction
   b. Transaction transferred to offline machine (QR code / USB)
   c. Offline machine signs with HSM
   d. Signed transaction transferred back
   e. Server broadcasts to chain
   ```
4. Cold wallet NEVER connected to internet
5. Multi-sig (2-of-3) for cold wallet recovery

---

## 6. Chain Reorg Protection

### Attack
A blockchain reorganization replaces confirmed blocks, potentially invalidating a deposit that was already credited.

### Defense: Confirmation Threshold

| Network | Confirms | Reorg Probability Above Threshold |
|---------|----------|-----------------------------------|
| TRC-20 | 20 | < 0.001% |
| ERC-20 | 12 | < 0.001% |

Plus, the chain monitor **re-verifies** before crediting:

```
1. Observe tx in block N
2. Wait until block N + confirmations mined
3. Before crediting: CHECK tx is still in block N (not reorged out)
4. If reorged → mark STALE, do not credit
5. If still there → credit
```

### Reorg Recovery

If reorg detected AFTER crediting:
```
1. RESERVED: Do NOT debit the user — accept the loss
2. LOG: Record the event for audit
3. ALERT: Notify if amount > 500 USDT
4. This is a platform loss (cost of doing business)
```

---

## 7. Dust Attack Mitigation

### Attack
Attacker sends tiny amounts (0.000001 USDT) to deposit addresses to:
1. Probe which addresses are active
2. Link addresses to users
3. Poison blockchain analysis

### Defense

```typescript
function shouldCreditDeposit(amountUsdt: number): boolean {
  // Reject dust deposits below threshold
  const MIN_DEPOSIT_USDT = 1.0;
  return amountUsdt >= MIN_DEPOSIT_USDT;
}
```

Dust deposits < 1 USDT are **logged but not credited**. The ledger records them as `status: 'dust'`.

---

## 8. Withdrawal Address Validation

### Attack
User is tricked into withdrawing to a scam address.

### Mitigations (Best Effort)
- Display full address (not truncated) on confirmation screen
- Show "first time withdrawal to this address" warning
- Address format validation before broadcast:
  ```
  TRC-20: must start with 'T', 34 characters
  ERC-20: must start with '0x', 42 characters
  ```
- **Cannot prevent**: Blockchain transactions are irreversible. TradingEasy is non-custodial for withdrawals — user is responsible for address correctness.

---

## 9. API Security (Deposit Address Endpoint)

### Attack
MITM intercepts `POST /api/wallet/deposit-address` and replaces the address with attacker's address.

### Defense
1. **HTTPS only** — TLS 1.3 minimum
2. **JWT authentication** — address endpoint requires valid token
3. **Certificate pinning** on desktop client
4. **Address displayed with visual hash** to help users verify:
   ```
   Your TRC-20 deposit address:
   TUSDTxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   [Visual: 🟦🟥🟩🟨🟦]
   ```
5. First-use address confirmation: "Is this your first time using this address?"

---

## 10. Security Incident Response

### Incident Classification

| Severity | Definition | Response Time | Escalation |
|----------|-----------|--------------|------------|
| P0 (Critical) | Chain balance < DB balance, or key compromise | Immediate | PM + Owner |
| P1 (High) | Checksum mismatch > 3, or uncredited deposits > 1000 U | 15 min | PM |
| P2 (Medium) | Checksum mismatch 1-3, or pending deposits > 10 | 1 hour | — |
| P3 (Low) | Dust attack, single failed reconciliation | Next business day | — |

### P0 Response Playbook
```
1. DETECT: Reconciliation engine fires CRITICAL alert
2. CONTAIN:
   a. FREEZE all withdrawals (global flag)
   b. Revoke hot wallet API access (rotate key)
   c. Pause chain monitor (stop processing deposits)
3. INVESTIGATE:
   a. Audit ledger entries for last 24h
   b. Compare with on-chain transactions
   c. Identify root cause
4. RECOVER:
   a. Correct ledger entries if accounting error
   b. Replenish from cold if deficit
   c. Rotate compromised keys
5. RESUME:
   a. Verify all checksums pass
   b. Verify chain ≥ DB
   c. Re-enable withdrawals
   d. Resume chain monitor
```

---

## 11. Security Configuration Checklist

```
☐ WALLET_CHECKSUM_SECRET set in production (not default)
☐ WALLET_KEY_ENCRYPTION_KEY set (separate from checksum secret)
☐ Hot wallet private key encrypted at rest
☐ Cold wallet on air-gapped machine
☐ HTTPS enforced (TLS 1.3)
☐ JWT auth on all wallet endpoints
☐ Internal deposit API requires service auth
☐ idempotency_keys table has UNIQUE constraint
☐ wallets.checksum verified on every read
☐ Reconciliation engine runs hourly
☐ CRITICAL alerts configured (webhook)
☐ Withdrawal freeze mechanism tested
☐ Key rotation procedure documented
☐ Incident response playbook published
```

---

> **Related**: `docs/design/wallet-architecture.md`, `docs/design/deposit-flow.md`, `docs/design/reconciliation.md`, `docs/api/billing-api.md`
