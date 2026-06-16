# quant-moo Transfer vs Tip — Two Independent Pipelines

> **Round**: R143 | **Author**: QClaw | **Date**: 2026-06-13
> **Status**: SPECIFICATION — v17.6 Final, Locked by Owner
> **Covers**: Transfer (0.3%×2) vs Tip (L1-L3 creator split), complete isolation

---

## ⚠️ Critical Rule

> **TRANSFER ≠ TIP. These are TWO COMPLETELY INDEPENDENT billing pipelines.**
> - Transfer: sender pays 0.3% + receiver pays 0.3% = total 0.6% to platform
> - Tip: sender pays full amount, creator receives (100% - platform_split%)

---

## 1. Visual Comparison

```
┌─────────────────────────────────────┐  ┌─────────────────────────────────────┐
│            TRANSFER                  │  │              TIP/DONATE             │
│                                      │  │                                     │
│  Sender           Receiver           │  │  Sender          Creator            │
│  ──────           ────────           │  │  ──────          ───────            │
│                                      │  │                                     │
│  100 U → [0.3%] → 99.7 U ─┐        │  │  100 U ──────────────────┐         │
│  -0.3 U fee                 │        │                          │         │
│                             ▼        │                          ▼         │
│                    99.7 U → [0.3%]   │  │    Platform keeps:     Creator gets:│
│                    -0.2991 U fee     │  │    L1: 30U (30%)      L1: 70U      │
│                             │        │  │    L2: 20U (20%)      L2: 80U      │
│                             ▼        │  │    L3: 10U (10%)      L3: 90U      │
│                    99.4009 U received │  │                                     │
│                                      │  │  Total from sender: 100 U          │
│  Platform earns:                     │  │  (NO additional fee on sender!)     │
│    0.3 + 0.2991 = 0.5991 U          │  │                                     │
│                                      │  │                                     │
│  Use case: person-to-person payment  │  │  Use case: reward a creator         │
└─────────────────────────────────────┘  └─────────────────────────────────────┘
```

---

## 2. Transfer Pipeline (0.3% × 2)

### Rules
- Sender charged: **0.3%** of transfer amount (added to amount)
- Receiver charged: **0.3%** of received amount (deducted from received)
- Total platform fee: ~0.6% total
- Minimum fee: **2 USDT** per side

### Code Reference

```typescript
// server/services/transfer.ts

function calculateTransferFees(amount: number): TransferFees {
  const amountCents = Math.round(amount * 100);

  // Sender fee: 0.3%, min 200 cents = 2 USDT
  const senderFeeCents = Math.max(Math.round(amountCents * 0.003), 200);

  // Amount after sender fee
  const netAmountCents = amountCents - senderFeeCents;

  // Receiver fee: 0.3% of net, min 200 cents = 2 USDT
  const receiverFeeCents = Math.max(Math.round(netAmountCents * 0.003), 200);

  // Amount receiver gets
  const receivedCents = netAmountCents - receiverFeeCents;

  return {
    senderFeeCents,        // Platform earns
    receiverFeeCents,      // Platform earns
    receivedCents,         // Receiver gets
    totalFeeCents: senderFeeCents + receiverFeeCents,
  };
}
```

### Examples

| Transfer | Sender Pays | Sender Fee | Net to Pipe | Receiver Fee | Receiver Gets | Platform |
|----------|------------|------------|-------------|--------------|---------------|----------|
| 100 U | 100 U | 2.00 U (min) | 98.00 U | 2.00 U (min) | 96.00 U | 4.00 U |
| 1,000 U | 1,000 U | 3.00 U | 997.00 U | 2.99 U | 994.01 U | 5.99 U |
| 10,000 U | 10,000 U | 30.00 U | 9,970.00 U | 29.91 U | 9,940.09 U | 59.91 U |

### Ledger Entries (Double-Entry)

```
// Sender side
INSERT ledger_entry:
  wallet_id: sender
  type: debit
  amount_cents: 10000  (100.00 U)
  category: transfer_out
  description: "Transfer to user_xyz"

INSERT ledger_entry:
  wallet_id: sender
  type: debit
  amount_cents: 300  (3.00 U)
  category: transfer_fee
  description: "Transfer fee (0.3% × 1000 U)"

// Internal: fee goes to platform
INSERT ledger_entry:
  wallet_id: platform_fee
  type: credit
  amount_cents: 300 (3.00 U)
  category: transfer_fee_income

// Receiver side (after sender fee deducted)
INSERT ledger_entry:
  wallet_id: receiver
  type: credit
  amount_cents: 99700 (997.00 U)  // receiver gets this before their fee
  category: transfer_in

INSERT ledger_entry:
  wallet_id: receiver
  type: debit
  amount_cents: 299 (2.99 U)
  category: transfer_fee
  description: "Transfer fee (0.3% × 997 U)"

// Internal: fee goes to platform
INSERT ledger_entry:
  wallet_id: platform_fee
  type: credit
  amount_cents: 299 (2.99 U)
  category: transfer_fee_income
```

---

## 3. Tip/Donate Pipeline (Creator Level Split)

### Rules
- Sender pays: **full tip amount** (no additional fee on sender!)
- Platform takes: **L1 30% / L2 20% / L3 10%** from the tip
- Creator receives: **100% - platform_split%**
- Minimum tip: **9.9 USDT** (same as all marketplace products)

### Code Reference

```typescript
// server/services/tip.ts

type CreatorLevel = 'L1' | 'L2' | 'L3';

const CREATOR_SPLITS: Record<CreatorLevel, { platform: number; creator: number }> = {
  L1: { platform: 0.30, creator: 0.70 },   // ≥0 sales (new creator)
  L2: { platform: 0.20, creator: 0.80 },   // ≥100 sales
  L3: { platform: 0.10, creator: 0.90 },   // ≥1000 sales
};

function calculateTipSplit(amount: number, creatorLevel: CreatorLevel): TipSplit {
  const split = CREATOR_SPLITS[creatorLevel];
  const amountCents = Math.round(amount * 100);

  const platformCents = Math.round(amountCents * split.platform);
  const creatorCents = amountCents - platformCents;

  return {
    tipAmount: amount,
    senderPays: amount,       // Sender pays full amount, NO extra fee!
    platformFee: Number((platformCents / 100).toFixed(2)),
    creatorReceives: Number((creatorCents / 100).toFixed(2)),
    level: creatorLevel,
    split: split.platform,
  };
}
```

### Examples

| Tip | Creator Level | Platform Takes | Creator Gets | Sender Pays |
|-----|---------------|---------------|-------------|-------------|
| 10 U | L1 (30%) | 3.00 U | 7.00 U | 10.00 U |
| 50 U | L1 (30%) | 15.00 U | 35.00 U | 50.00 U |
| 100 U | L2 (20%) | 20.00 U | 80.00 U | 100.00 U |
| 500 U | L3 (10%) | 50.00 U | 450.00 U | 500.00 U |
| 9.9 U (min) | L1 (30%) | 2.97 U | 6.93 U | 9.90 U |

### Ledger Entries

```
// Sender side: simple debit
INSERT ledger_entry:
  wallet_id: sender
  type: debit
  amount_cents: 10000 (100.00 U)
  category: tip_out

// Creator side: credit (after split)
INSERT ledger_entry:
  wallet_id: creator
  type: credit
  amount_cents: 7000 (70.00 U)
  category: tip_income
  description: "Tip from user_abc (L1, 70% creator share)"

// Platform fee side
INSERT ledger_entry:
  wallet_id: platform_fee
  type: credit
  amount_cents: 3000 (30.00 U)
  category: tip_platform_fee
  description: "Tip platform fee (L1, 30% split)"
```

---

## 4. Side-by-Side Feature Comparison

| Feature | Transfer | Tip/打赏 |
|---------|----------|---------|
| **Use case** | Send money to another user | Reward a creator |
| **Sender fee** | 0.3% of amount (min 2 U) | **0%** — sender pays tip amount only |
| **Receiver fee** | 0.3% of received (min 2 U) | Platform split deducted from tip |
| **Creator split** | N/A (not for creators) | L1:70% / L2:80% / L3:90% |
| **Minimum amount** | No minimum (practical: > 4 U) | 9.9 USDT |
| **Tax type** | `transfer_out` + `transfer_in` | `tip_out` + `tip_income` |
| **Ledger category** | `transfer_fee` | `tip_platform_fee` |
| **Recipient** | Any user | Creator only |
| **Instant?** | Yes (same-server) | Yes |
| **Reversible?** | No | No |

---

## 5. Why Two Separate Pipelines?

### Architecture Decision

Keeping transfer and tip isolated prevents:

1. **Accidental double-charging**: If tip used the transfer pipeline, sender would pay 0.3% + platform split = double taxed
2. **Incorrect creator earnings**: Transfer pipeline can't know about creator levels
3. **Audit complexity**: Mixed ledger categories make reconciliation harder
4. **Bug risk**: "Oh I thought this was a transfer, not a tip" → wrong fee applied

### Database Separation

```sql
-- Transfer uses these categories
category IN ('transfer_out', 'transfer_in', 'transfer_fee', 'transfer_fee_income')

-- Tip uses these categories
category IN ('tip_out', 'tip_income', 'tip_platform_fee')

-- NEVER THE TWO SHALL MEET
-- Reconciliation verifies these stay separate
```

### Reconciliation Checks

```sql
-- Verify transfer integrity
SELECT
  (SELECT COALESCE(SUM(amount_cents), 0) FROM ledger_entries
   WHERE category = 'transfer_fee_income' AND status = 'confirmed') -
  (SELECT COALESCE(SUM(amount_cents), 0) FROM ledger_entries
   WHERE category = 'transfer_fee' AND status = 'confirmed') AS transfer_diff;

-- Verify tip integrity
SELECT
  (SELECT COALESCE(SUM(amount_cents), 0) FROM ledger_entries
   WHERE category = 'tip_platform_fee' AND status = 'confirmed') -
  (SELECT COALESCE(SUM(amount_cents), 0) FROM ledger_entries
   WHERE category = 'tip_out' AND status = 'confirmed') *
  (SELECT AVG(CASE WHEN creator_level = 'L1' THEN 0.30
                    WHEN creator_level = 'L2' THEN 0.20
                    WHEN creator_level = 'L3' THEN 0.10 END)
   FROM tips WHERE status = 'confirmed') AS tip_diff;

-- Both should be ~0
```

---

## 6. Tip UI

### Quick Tip Amounts (Predefined)

```
┌─────────────────────────────────────────┐
│  💝 Tip @CreatorName (L2 • 80% yours)   │
│                                         │
│  Select amount:                         │
│  [ 9.9 U ]  [ 19.9 U ]                │
│  [ 49.9 U ] [ 99.9 U ]                │
│  [ Custom ]                             │
│                                         │
│  ───────────────────────────────        │
│  Creator receives: 8.00 U (L2, 80%)    │
│  Platform fee:     2.00 U (20%)        │
│  You pay:          10.00 U             │
│                                         │
│  [Send Tip]                             │
└─────────────────────────────────────────┘
```

### Transfer UI (For Comparison)

```
┌─────────────────────────────────────────┐
│  💸 Transfer to @UserName               │
│                                         │
│  Amount: [    100.00 U    ]            │
│                                         │
│  ───────────────────────────────        │
│  You send:      100.00 U               │
│  Sender fee:      2.00 U (0.3%, min)   │
│  Receiver gets:  96.00 U               │
│  Receiver fee:    2.00 U (0.3%, min)   │
│                                         │
│  [Confirm Transfer]                     │
└─────────────────────────────────────────┘
```

---

## 7. Common Mistakes to Avoid

| ❌ Wrong | ✅ Correct |
|---------|-----------|
| "Tip should charge sender 0.3% fee" | Tip has **NO sender fee** |
| "Transfer should split by creator level" | Transfer is user-to-user, has no split |
| "Just use the same billing function" | Two separate functions with different logic |
| "Tip is just a special kind of transfer" | They are fundamentally different products |
| "Min tip is 2 U like transfers" | Min tip is 9.9 U (marketplace minimum) |

---

> **Related**: `docs/design/withdraw-risk-control.md`, `docs/design/wallet-architecture.md`, `docs/api/billing-api.md`
