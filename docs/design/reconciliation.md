# TradingEasy Reconciliation Engine v2.0

> **Round**: R142 | **Author**: QClaw | **Date**: 2026-06-13
> **Status**: DESIGN DOCUMENT — Production Ready
> **Covers**: Hourly/daily reconciliation, alert rules, checksum verification, chain vs DB balancing

---

## Overview

The reconciliation engine runs **automated checks** to ensure the wallet system's integrity. Three levels of verification run on different schedules:

| Level | Frequency | What It Checks | Failure Response |
|-------|-----------|---------------|-----------------|
| **Checksum Scan** | Hourly | Every wallet row HMAC integrity | CRITICAL: possible DB tampering |
| **Double-Entry Invariant** | Hourly | Σdebit = Σcredit across all ledgers | CRITICAL: accounting error |
| **Chain vs DB Balance** | Hourly | On-chain wallet balance vs DB SUM | CRITICAL: halt withdrawals if chain < DB |
| **Full Audit** | Daily | All three + per-wallet statement | Summary report |

---

## 1. Reconciliation Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                     Reconciliation Engine                         │
│                                                                  │
│  CRON: @hourly                                                    │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────────┐    │
│  │ Phase 1     │    │ Phase 2      │    │ Phase 3           │    │
│  │ Checksum    │───▶│ Double-Entry │───▶│ Chain vs DB       │    │
│  │ Scan        │    │ Invariant    │    │ Balance           │    │
│  └──────┬──────┘    └──────┬───────┘    └────────┬─────────┘    │
│         │                 │                      │               │
│         ▼                 ▼                      ▼               │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │               Reconciliation Report                       │   │
│  │  status: OK | WARNING | CRITICAL                          │   │
│  │  timestamp, findings[], actions[]                          │   │
│  └──────────────────────────────────────────────────────────┘   │
│         │                                                        │
│         ├─ OK → log, continue                                    │
│         ├─ WARNING → alert channel, no action                     │
│         └─ CRITICAL → alert + FREEZE WITHDRAWALS + page on-call  │
│                                                                  │
│  CRON: @daily (00:00 UTC)                                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Full Audit: all three + per-wallet statements            │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. Phase 1: Checksum Scan (Hourly)

### Purpose
Detects **direct database tampering** — if someone bypasses the API and modifies wallet balances manually.

### Algorithm

```typescript
interface ChecksumScanResult {
  ok: boolean;
  totalWallets: number;
  mismatches: ChecksumMismatch[];
  scannedAt: string;
  durationMs: number;
}

interface ChecksumMismatch {
  walletId: string;
  userId: string;
  storedChecksum: string;
  computedChecksum: string;
  storedBalance: number;
  lastUpdatedAt: string;
}

function runChecksumScan(db: Database): ChecksumScanResult {
  const start = performance.now();
  const wallets = db.prepare('SELECT id, user_id, balance_usdt, checksum, updated_at FROM wallets').all() as WalletRow[];
  const mismatches: ChecksumMismatch[] = [];

  for (const w of wallets) {
    const computed = computeChecksum(w.id, w.user_id, w.balance_usdt);
    if (computed !== w.checksum) {
      mismatches.push({
        walletId: w.id,
        userId: w.user_id,
        storedChecksum: w.checksum,
        computedChecksum: computed,
        storedBalance: w.balance_usdt,
        lastUpdatedAt: w.updated_at,
      });
    }
  }

  return {
    ok: mismatches.length === 0,
    totalWallets: wallets.length,
    mismatches,
    scannedAt: new Date().toISOString(),
    durationMs: performance.now() - start,
  };
}
```

### Severity & Response

| Mismatches | Severity | Action |
|-----------|----------|--------|
| 0 | ✅ OK | Log "All checksums valid" |
| 1-3 | 🟡 WARNING | Alert + investigate (could be bug) |
| > 3 | 🔴 CRITICAL | Alert + FREEZE all debit operations + page on-call |

### WARNING Investigation Steps
1. Check `ledger_entries` for recent entries on mismatched wallets
2. Compare `wallet.updated_at` with audit logs
3. If all mismatches have same `updated_at` → possible batch corruption
4. Recompute from ledger: `balance = SUM(credits) - SUM(debits)`

---

## 3. Phase 2: Double-Entry Invariant (Hourly)

### Purpose
Verifies the fundamental accounting equation: **total debits = total credits** per wallet and system-wide.

### Algorithm

```typescript
interface DoubleEntryResult {
  ok: boolean;
  systemWide: {
    totalDebitCents: number;
    totalCreditCents: number;
    differenceCents: number;
  };
  perWalletMismatches: WalletMismatch[];
}

interface WalletMismatch {
  walletId: string;
  totalDebitCents: number;
  totalCreditCents: number;
  expectedBalance: number;
  actualBalance: number;
  difference: number;
}

function runDoubleEntryCheck(db: Database): DoubleEntryResult {
  // System-wide check
  const systemWide = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'debit' THEN amount_cents ELSE 0 END), 0) AS total_debit,
      COALESCE(SUM(CASE WHEN type = 'credit' THEN amount_cents ELSE 0 END), 0) AS total_credit
    FROM ledger_entries WHERE status = 'confirmed'
  `).get() as { total_debit: number; total_credit: number };

  // Per-wallet check
  const perWallet = db.prepare(`
    SELECT
      l.wallet_id,
      COALESCE(SUM(CASE WHEN l.type = 'debit' THEN l.amount_cents ELSE 0 END), 0) AS total_debit,
      COALESCE(SUM(CASE WHEN l.type = 'credit' THEN l.amount_cents ELSE 0 END), 0) AS total_credit,
      w.balance_usdt AS actual_balance,
      (COALESCE(SUM(CASE WHEN l.type = 'credit' THEN l.amount_cents ELSE 0 END), 0) -
       COALESCE(SUM(CASE WHEN l.type = 'debit' THEN l.amount_cents ELSE 0 END), 0)) AS expected_balance
    FROM ledger_entries l
    JOIN wallets w ON w.id = l.wallet_id
    WHERE l.status = 'confirmed'
    GROUP BY l.wallet_id
  `).all() as any[];

  const perWalletMismatches = perWallet
    .filter(w => w.expected_balance !== w.actual_balance)
    .map(w => ({
      walletId: w.wallet_id,
      totalDebitCents: w.total_debit,
      totalCreditCents: w.total_credit,
      expectedBalance: w.expected_balance,
      actualBalance: w.actual_balance,
      difference: w.expected_balance - w.actual_balance,
    }));

  return {
    ok: systemWide.total_debit === systemWide.total_credit && perWalletMismatches.length === 0,
    systemWide: {
      totalDebitCents: systemWide.total_debit,
      totalCreditCents: systemWide.total_credit,
      differenceCents: systemWide.total_debit - systemWide.total_credit,
    },
    perWalletMismatches,
  };
}
```

### Invariant Rules

```
1. System-wide: Σ(type=debit, amount_cents) == Σ(type=credit, amount_cents)
2. Per-wallet: balance_usdt == Σ(credits) - Σ(debits)
3. Per-wallet ledger integrity:
   For consecutive entries e1, e2:
     e2.balance_before == e1.balance_after
```

### Severity

| Condition | Severity | Action |
|-----------|----------|--------|
| All pass | ✅ OK | Log |
| System-wide mismatch | 🔴 CRITICAL | Alert + freeze + investigate |
| 1-2 wallets mismatch | 🟡 WARNING | Alert + check those wallets |
| > 2 wallets mismatch | 🔴 CRITICAL | Alert + freeze |

---

## 4. Phase 3: Chain vs DB Balance (Hourly)

### Purpose
Compares the on-chain wallet holdings with the database balance sum. Ensures **no fractional reserve** — the platform must hold ≥ what users are owed.

### Algorithm

```typescript
interface ChainVsDbResult {
  ok: boolean;
  chainBalance: {
    hotWalletUsdt: number;
    coldWalletUsdt: number;
    totalChainUsdt: number;
  };
  dbBalance: {
    totalUsdt: number;
    totalCents: number;
    totalWallets: number;
  };
  differenceUsdt: number;
  status: 'OK' | 'WARNING' | 'CRITICAL';
}

async function runChainVsDbCheck(db: Database): Promise<ChainVsDbResult> {
  // 1. Fetch on-chain balances
  const hotWalletBalance = await fetchBalance(HOT_WALLET_ADDRESS, 'TRC-20');
  const coldWalletBalance = await fetchBalance(COLD_WALLET_ADDRESS, 'TRC-20');
  // Note: Add ERC-20 hot/cold wallets too

  const totalChain = hotWalletBalance + coldWalletBalance;

  // 2. Sum DB balances
  const dbSum = db.prepare(
    'SELECT COALESCE(SUM(balance_usdt), 0) AS total FROM wallets'
  ).get() as { total: number };

  const totalDb = dbSum.total / 100; // cents → USDT

  const diff = totalChain - totalDb;

  let status: 'OK' | 'WARNING' | 'CRITICAL';
  if (diff >= 0 && diff < 500) {
    status = 'OK'; // Minor surplus (unprocessed deposits, rounding)
  } else if (diff >= 500) {
    status = 'WARNING'; // Significant surplus — possible unprocessed deposits
  } else if (diff < 0) {
    status = 'CRITICAL'; // Chain < DB — possible theft or accounting error
  }

  return {
    ok: status !== 'CRITICAL',
    chainBalance: {
      hotWalletUsdt: hotWalletBalance,
      coldWalletUsdt: coldWalletBalance,
      totalChainUsdt: totalChain,
    },
    dbBalance: {
      totalUsdt: totalDb,
      totalCents: dbSum.total,
      totalWallets: (db.prepare('SELECT COUNT(*) AS c FROM wallets').get() as any).c,
    },
    differenceUsdt: diff,
    status,
  };
}
```

### Response Rules

| Status | Condition | Action |
|--------|-----------|--------|
| ✅ OK | chain ≥ DB, diff < 500 USDT | Log |
| 🟡 WARNING | chain ≥ DB, diff ≥ 500 USDT | Alert + check pending deposits |
| 🔴 CRITICAL | chain < DB | **HALT all withdrawals** + alert + page on-call |

### Why CRITICAL?

If on-chain balance < database sum, the platform is **insolvent** — it owes more USDT than it holds. Possible causes:
1. **Theft**: Someone withdrew more than recorded
2. **Accounting error**: Credits recorded without actual deposits
3. **Lost keys**: Wallet keys lost, funds unrecoverable

Immediate action:
1. **FREEZE withdrawals**: `SET global withdrawal_enabled = false`
2. **Alert**: page on-call immediately
3. **Investigate**: audit recent withdrawal ledger entries
4. **Recover**: check if cold wallet balance can cover deficit

---

## 5. Full Daily Audit

### Schedule: 00:00 UTC daily

### Operations
1. Run all three hourly checks
2. Generate per-wallet statements for last 24h
3. Verify ledger entry chain integrity (balance_before/after continuity)
4. Verify all checksums
5. Output audit report

### Audit Report Format

```json
{
  "reportId": "AUDIT-20260613-0000",
  "timestamp": "2026-06-13T00:00:00.000Z",
  "period": { "from": "2026-06-12T00:00:00.000Z", "to": "2026-06-13T00:00:00.000Z" },
  "results": {
    "checksumScan": { "ok": true, "totalWallets": 1234, "mismatches": 0 },
    "doubleEntry": {
      "ok": true,
      "systemWide": { "totalDebitCents": 12345678, "totalCreditCents": 12345678 },
      "perWalletMismatches": []
    },
    "chainVsDb": {
      "ok": true,
      "chainTotal": 125000.00,
      "dbTotal": 124900.00,
      "difference": 100.00,
      "status": "OK"
    }
  },
  "summary": {
    "totalTransactions24h": 567,
    "totalDeposits24h": 12500.00,
    "totalWithdrawals24h": 8200.00,
    "totalFees24h": 450.00,
    "activeWallets": 89,
    "newWallets": 12,
    "flaggedEvents": 0,
    "overallStatus": "OK"
  }
}
```

---

## 6. Alert Configuration

### Alert Levels

| Level | Channel | Who | When |
|-------|---------|-----|------|
| CRITICAL | Webhook + notification | On-call + PM | Immediately |
| WARNING | Dashboard + log | PM (review next day) | Batched |
| INFO | Log only | — | No alert |

### Alert Payload (CRITICAL)

```json
{
  "alert": "CRITICAL",
  "type": "RECONCILIATION_CHAIN_VS_DB",
  "severity": "P0",
  "timestamp": "2026-06-13T14:00:00.000Z",
  "detail": {
    "chainTotalUsdt": 124000.00,
    "dbTotalUsdt": 125000.00,
    "deficitUsdt": 1000.00,
    "status": "CRITICAL"
  },
  "action": "IMMEDIATE — Halt withdrawals, investigate deficit",
  "affectedWallets": 1234
}
```

---

## 7. Reconciliation Engine Pseudocode

```typescript
// server/services/reconciliation.ts

class ReconciliationEngine {
  private db: Database;

  async runHourly(): Promise<ReconciliationReport> {
    console.log('[Reconciliation] Hourly check starting...');
    const start = performance.now();

    // Phase 1
    const checksum = this.runChecksumScan();
    if (!checksum.ok) {
      this.alert('CRITICAL', 'checksum_mismatch', checksum);
      return { status: 'CRITICAL', ... };
    }

    // Phase 2
    const doubleEntry = this.runDoubleEntryCheck();
    if (!doubleEntry.ok) {
      this.alert('CRITICAL', 'double_entry_mismatch', doubleEntry);
      return { status: 'CRITICAL', ... };
    }

    // Phase 3
    const chainVsDb = await this.runChainVsDbCheck();
    if (!chainVsDb.ok) {
      await this.freezeWithdrawals(); // EMERGENCY HALT
      this.alert('CRITICAL', 'chain_vs_db_mismatch', chainVsDb);
      return { status: 'CRITICAL', ... };
    }

    console.log(`[Reconciliation] Hourly OK (${performance.now() - start}ms)`);
    return { status: 'OK', checksum, doubleEntry, chainVsDb };
  }

  private alert(level: string, type: string, detail: object): void {
    // Send alert via configured channels
    console.error(`[ALERT ${level}] ${type}`, detail);

    if (level === 'CRITICAL') {
      // Immediate notification
      sendWebhook(ALERT_WEBHOOK_URL, { level, type, detail });
    }
  }

  private async freezeWithdrawals(): Promise<void> {
    // Set global flag to reject all withdrawals
    this.db.prepare(
      "INSERT OR REPLACE INTO system_config (key, value) VALUES ('withdrawal_enabled', 'false')"
    ).run();
    console.error('[SECURITY] Withdrawals FROZEN due to reconciliation CRITICAL');
  }
}
```

---

> **Related**: `docs/design/wallet-architecture.md`, `docs/design/deposit-flow.md`, `docs/design/chain-security.md`
