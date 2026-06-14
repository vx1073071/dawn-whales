# TradingEasy Deposit Flow v2.0

> **Round**: R142 | **Author**: QClaw | **Date**: 2026-06-13
> **Status**: DESIGN DOCUMENT — Production Ready
> **Covers**: Chain monitoring, confirmation, credit pipeline, anti-forgery, anti-replay

---

## Overview

TradingEasy processes USDT deposits via **server-side chain monitoring** — the server actively scans blockchain transactions and credits wallets automatically. **Users never submit `tx_hash`** — this prevents forgery.

### Supported Networks

| Network | Min Confirmations | Finality | Gas Subsidy |
|---------|-------------------|----------|-------------|
| TRC-20 (TRON) | 20 confirmations (~3 min) | Probabilistic | No — 0% fee |
| ERC-20 (Ethereum) | 12 confirmations (~2.5 min) | Probabilistic | **Platform subsidizes gas** |

---

## 1. End-to-End Deposit Pipeline

```
┌─────────────────────────────────────────────────────────────────────┐
│                       DEPOSIT PIPELINE                              │
│                                                                     │
│  User                               Server         Blockchain       │
│  ────                               ──────         ──────────       │
│                                                                     │
│  Get deposit address                                 Pre-registered │
│  │                                                         │        │
│  │  POST /api/wallet/deposit-address                          │        │
│  │  → Returns: TXxx...(TRC-20) / 0x...(ERC-20)              │        │
│  │  → Address is user-unique, derived from user_id           │        │
│  ▼                                                            │        │
│  Send USDT from wallet                                              │
│  │                                                                   │
│  │                                                                    │
│  ▼         (tx broadcasted)                                          │
│  ⏳ Wait ────────────────────────▶ ChainMonitor.scan()               │
│                                    │                                 │
│                                    ▼                                 │
│                              Get block events (TronGrid/Infura)      │
│                                    │                                 │
│                                    ▼                                 │
│                              Filter: to_addr in deposit_addresses    │
│                                    │                                 │
│                                    ├─ No match → skip                │
│                                    │                                 │
│                                    ▼                                 │
│                              Check confirmations                     │
│                                    │                                 │
│                                    ├─ < min → mark pending, re-check  │
│                                    │                                 │
│                                    ▼                                 │
│                              Anti-replay check: tx_hash processed?   │
│                                    │                                 │
│                                    ├─ Already processed → skip       │
│                                    │                                 │
│                                    ▼                                 │
│                              POST /api/wallet/deposit (internal)     │
│                              ├─ Begin transaction                    │
│                              ├─ Verify wallet checksum               │
│                              ├─ UPDATE balance_usdt += amount        │
│                              ├─ Recompute checksum                   │
│                              ├─ INSERT ledger_entry (type=credit)    │
│                              ├─ INSERT idempotency_key               │
│                              └─ COMMIT                               │
│                                    │                                 │
│                                    ▼                                 │
│  ◄──────── Deposit credited ──── Push notification                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Chain Monitor Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      ChainMonitor Service                        │
│                                                                 │
│  ┌──────────────────┐    ┌──────────────────┐                   │
│  │  TronGrid Poller │    │  Infura Poller    │                   │
│  │  (every 3s)      │    │  (every 15s)      │                   │
│  │  API: TronGrid    │    │  API: Infura      │                   │
│  │  Chains: TRC-20   │    │  Chains: ERC-20   │                   │
│  └────────┬─────────┘    └────────┬─────────┘                   │
│           │                       │                              │
│           └───────────┬───────────┘                              │
│                       ▼                                          │
│           ┌───────────────────────┐                              │
│           │   Confirmation Queue  │                              │
│           │   tx_hash → confirms  │                              │
│           └───────────┬───────────┘                              │
│                       ▼                                          │
│           ┌───────────────────────┐                              │
│           │   Drop Filter         │                              │
│           │   dedup + blacklist   │                              │
│           └───────────┬───────────┘                              │
│                       ▼                                          │
│           ┌───────────────────────┐                              │
│           │   Credit Wallet       │                              │
│           │   (internal API call) │                              │
│           └───────────────────────┘                              │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ deposit_addresses table                                   │   │
│  │  address (PK) | user_id | network | created_at            │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ processed_tx_hashes table                                 │   │
│  │  tx_hash (PK) | processed_at | blocks_confirming          │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Poller Configuration

| Parameter | TRC-20 (TronGrid) | ERC-20 (Infura) |
|-----------|-------------------|-----------------|
| Poll interval | 3 seconds | 15 seconds |
| Block range per poll | Last 100 blocks | Last 50 blocks |
| Min confirmations | 20 | 12 |
| Max confirmations wait | 100 blocks (~5 min timeout) | 60 blocks (~12 min timeout) |
| API endpoint | `api.trongrid.io` | `mainnet.infura.io/v3` |
| Contract | TR7NHq... (USDT) | 0xdac17... (USDT) |

---

## 3. Confirmation Lifecycle

```
State flow for a deposit:

  [UNCONFIRMED] ──→ [PENDING] ──→ [CONFIRMED] ──→ [CREDITED]
       │                │              │              │
       │          confirms < min   confirms ≥ min   wallet updated
       │                            AND checksum OK
       │
  Timeout (>5 min TRC / >12 min ERC) → [STALE] → alert, but keep polling

  On [CONFIRMED]:
    1. Begin DB transaction
    2. Lock wallet row
    3. Verify wallet checksum (Layer 4)
    4. UPDATE balance_usdt += amount
    5. Recompute checksum → UPDATE
    6. INSERT ledger_entry (type=credit, category=deposit)
    7. INSERT idempotency_key (key = SHA256(tx_hash))
    8. COMMIT
    9. Push notification to user
```

---

## 4. Deposit Address Management

### `POST /api/wallet/deposit-address`

Returns user's unique deposit address. Address is derived from `SHA256(user_id + secret_salt)` — collision-proof.

```typescript
// Address derivation
function deriveDepositAddress(userId: string, network: 'TRC-20' | 'ERC-20'): string {
  const salt = process.env.DEPOSIT_ADDRESS_SALT || 'default-salt';
  const hash = crypto.createHash('sha256').update(`${userId}|${salt}`).digest('hex');

  if (network === 'TRC-20') {
    // TRON address: 34 chars starting with 'T'
    // We use a deterministic derivation from the hash
    return generateTronAddress(hash);
  } else {
    // ERC-20: standard Ethereum address
    return '0x' + hash.substring(0, 40);
  }
}
```

### Response
```json
{
  "address": "TXxx...",
  "network": "TRC-20",
  "userId": "user_abc123",
  "createdAt": "2026-06-13T10:00:00.000Z"
}
```

### Key Rules
- One user = one address per network
- Address is **deterministically derived** — no need to store generation state
- Address → user_id mapping stored in `deposit_addresses` table for reverse lookup
- User can regenerate address (re-derives same one)

---

## 5. Anti-Forgery (Layer 5)

### Problem
Users could submit fake `tx_hash` values claiming a deposit that never happened.

### Defense
- **Server NEVER accepts user-submitted `tx_hash`**
- Server **actively monitors blockchain** via TronGrid/Infura
- Only transactions confirmed on-chain are counted
- `tx_hash` stored in `idempotency_keys` → replay impossible

```
User says: "I deposited 100 USDT, tx_hash: abc123"

Server: 1. Ignore user claim
        2. Check TronGrid/Infura for tx_hash abc123
        3. If NOT on-chain → no credit
        4. If ON-CHAIN but < 20 confirmations → wait
        5. If ON-CHAIN, ≥ 20 confirms, not yet processed → credit
```

---

## 6. Anti-Replay (Layer 5)

### Problem
A single `tx_hash` could be processed multiple times if the chain monitor restarts mid-processing.

### Defense
`idempotency_keys` table with `key = SHA256(tx_hash)` + UNIQUE constraint:

```sql
-- No replay possible
INSERT INTO idempotency_keys (key, wallet_id, entry_id, status, expires_at, created_at)
VALUES (?, ?, ?, 'committed', datetime('now', '+24 hours'), datetime('now'));
-- If tx_hash was already processed → SQLITE_CONSTRAINT → skip
```

Chain monitor flow:
```
1. Scan blockchain → find tx_hash XYZ
2. Compute idempotency_key = SHA256("deposit|XYZ")
3. Check idempotency_keys WHERE key = ?
4. If EXISTS → SKIP (already processed)
5. If NOT EXISTS → process + insert
```

---

## 7. ERC-20 Gas Subsidy

ERC-20 deposits incur gas fees paid in ETH. TradingEasy **subsidizes gas** — the user always receives the full amount they sent.

```
User sends: 100 USDT via ERC-20
Chain receives: 99.5 USDT (0.5 USDT worth of ETH spent on gas)
Platform credits: 100 USDT (0.5 USDT subsidized)
```

### Accounting
```
Ledger entry:
  type: credit
  category: deposit
  amount_cents: 10000 (100.00 USDT)
  description: "ERC-20 deposit: chain 99.5 USDT + platform subsidy 0.5 USDT"
```

Platform subsidy tracked as internal expense:
```
Internal ledger entry (separate):
  type: debit
  category: gas_subsidy
  amount_cents: 50 (0.50 USDT)
  wallet_id: platform_reserve_wallet
```

---

## 8. Common Error Scenarios

| Scenario | Detection | Handling |
|----------|-----------|----------|
| User sends to wrong address | Cannot detect (blockchain is open) | No credit; funds lost unless address is another TradingEasy user |
| User sends to old address | Old address still maps to user | Credit as normal |
| Chain reorg removes tx | Confirmations drop | Re-verify before crediting; if confirms < min, mark STALE |
| Network congestion (slow confirms) | Confirmations < min | Poller keeps checking, up to timeout |
| Double notification on restart | idempotency_key UNIQUE | DB constraint blocks second credit |
| User sends non-USDT token to USDT contract | Contract rejects or ignores | No credit (token must be USDT) |

---

## 9. Monitoring & Alerts

| Metric | Threshold | Alert |
|--------|-----------|-------|
| Pending deposits > 10 | > 10 uncredited deposits | WARNING: Chain congested? |
| Stale deposits | > 1 deposit > 60 min unconfirmed | ALERT: Possible fork or network issue |
| Deposit credits/hour = 0 | > 2 hours zero credits | WARNING: Chain monitor may be down |
| Gas subsidy > 100 U/day | Daily total > 100 USDT | INFO: High subsidy spend |

---

> **Related**: `docs/design/wallet-architecture.md`, `docs/api/billing-api.md`, `docs/design/chain-security.md`
