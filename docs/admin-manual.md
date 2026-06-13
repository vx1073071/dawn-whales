# Dawn Whales Administrator Manual v2.1.0

> **Version**: v2.1.0 | **Last Updated**: 2026-06-13
> **Audience**: Platform Administrators
> **Covers**: Admin dashboard, audit, review queues, risk monitoring, reconciliation

---

## Table of Contents

1. [Admin Dashboard](#1-admin-dashboard)
2. [User Management](#2-user-management)
3. [Withdrawal Review Queue](#3-withdrawal-review-queue)
4. [Creator Review](#4-creator-review)
5. [Reconciliation & Auditing](#5-reconciliation--auditing)
6. [Security Monitoring](#6-security-monitoring)
7. [System Health](#7-system-health)
8. [Incident Response](#8-incident-response)

---

## 1. Admin Dashboard

### Access
```
URL: {server}/admin
Auth: Admin credentials + 2FA (required)

Dashboard shows at a glance:
  - Active users (today / this week)
  - Total USDT in circulation
  - Pending withdrawal reviews
  - System health status
  - Recent alerts
```

### Dashboard Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  🔐 Admin Dashboard — Dawn Whales v2.1.0                         │
│                                                                  │
│  ┌─────────────┬─────────────┬─────────────┬─────────────┐      │
│  │ Users       │ Revenue      │ Pending      │ System       │      │
│  │ 1,247       │ 12,450 USDT  │ Reviews     │ Health       │      │
│  │ ▲ +23 today │ Today: +380  │ 3 ⚠         │ 🟢 Normal    │      │
│  └─────────────┴─────────────┴─────────────┴─────────────┘      │
│                                                                  │
│  Recent Alerts:                                                  │
│  ⚠ 2026-06-13 10:30 — Withdrawal review queue: 3 pending         │
│  ℹ 2026-06-13 10:00 — Daily reconciliation: PASSED              │
│  ⚠ 2026-06-13 09:15 — AI refund rate: 12% (>10% threshold)      │
│                                                                  │
│  Quick Links:                                                    │
│  [Withdrawal Queue] [Reconciliation] [Security Logs] [Users]     │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. User Management

### User List

```
GET /api/admin/users?page=1&limit=50&sort=created_desc

Fields:
  - userId, username, email
  - walletBalance (USDT)
  - creatorLevel (none/L1/L2/L3)
  - totalSales (if creator)
  - registrationDate
  - lastActive
  - status: active / suspended / banned
```

### User Detail View

```
User Detail — user_abc
├── Registration: 2026-05-15 (29 days ago)
├── Wallet Balance: 1,250.00 USDT
├── Creator: L2 (234 sales, 8,340 USDT earned)
├── Recent Activity:
│   ├── 06-13 10:00 AI Draw                   -1.00 USDT
│   ├── 06-13 09:30 Marketplace purchase      -49.90 USDT
│   └── 06-12 18:00 Deposit (TRC-20)          +500.00 USDT
├── Connected Brokers: Binance, IBKR
└── Status: active
    [Suspend] [Reset 2FA] [View Full Ledger]
```

### Actions

| Action | When | Effect |
|--------|------|--------|
| **View** | Normal operation | See user details |
| **Suspend** | TOS violation, fraud | User cannot trade or withdraw |
| **Unsuspend** | Appeal approved | Restore normal access |
| **Ban** | Severe violation | Permanent block |
| **Reset 2FA** | User lost 2FA device | Generates recovery code |

---

## 3. Withdrawal Review Queue

### When Review is Required

Withdrawals are **automatic** in most cases. Manual review is triggered ONLY when:

| Condition | Review? |
|-----------|---------|
| First withdrawal ever | ❌ Auto (first time is trusted) |
| Same address used in 24h | ❌ Auto |
| New address, first use | ❌ Auto |
| Amount ≤ 100,000 USDT | ❌ Auto (hot wallet) |
| Amount > 100,000 USDT | ✅ Manual (cold wallet, requires offline signing) |
| Balance > 1,000 USDT AND registered < 7 days | ✅ Manual (fraud risk) |

### Review Queue UI

```
┌──────────────────────────────────────────────────────────────────┐
│  📋 Withdrawal Review Queue                       3 Pending       │
│                                                                  │
│  Priority: 🔴 High | 🟡 Medium | 🟢 Low                          │
│                                                                  │
│  🟡 #WD-20260613-001                                    12 min   │
│     User: user_xyz | Balance: 5,200 USDT | Registered: 4 days    │
│     Amount: 2,500 USDT | Address: TXxx...xxxx (new)              │
│     Reason: Balance > 1,000 + registered < 7 days                │
│     [Approve]  [Reject]  [Request More Info]                     │
│                                                                  │
│  🔴 #WD-20260613-002                                     8 min   │
│     User: user_big (L3 creator) | Balance: 350,000 USDT          │
│     Amount: 150,000 USDT | Network: TRC-20                       │
│     Reason: Amount > 100,000 (cold wallet required)              │
│     [Initiate Cold Wallet Signing]  [Reject]                     │
│                                                                  │
│  🟢 #WD-20260612-089                                    4 hours  │
│     User: user_abc | Balance: 12,000 USDT                        │
│     Amount: 500 USDT | Network: ERC-20                           │
│     ⚠ Stale (> 4 hours) — review needed                          │
│     [Approve]  [Reject]                                          │
└──────────────────────────────────────────────────────────────────┘
```

### Review Actions

| Action | Result |
|--------|--------|
| **Approve** | Withdrawal processed. If cold wallet: begin multi-sig ceremony. |
| **Reject** | User notified with reason. Funds returned to wallet. |
| **Request Info** | Admin messages user with specific questions. Withdrawal paused. |

### Cold Wallet Process
```
For withdrawals > 100,000 USDT:
  1. Admin reviews request
  2. Admin initiates cold wallet signing
  3. Offline device generates signature (QR code or USB)
  4. Second admin (or hardware key) verifies + counter-signs
  5. Signed transaction broadcast to network
  6. Withdrawal marked as complete
```

---

## 4. Creator Review

### Automated Review
Most creator content is **automatically approved** if:
- Name: 3-50 characters
- Description: 50-500 characters
- Price ≥ 9.9 USDT
- Strategy file passes basic syntax check
- Backtest data present

### Manual Review Triggers
Manual review is ONLY required for:
- Strategy flagged by automated content filter
- Multiple user reports
- Suspicious pricing (e.g., $9,999 for a simple MA crossover)
- Duplicate content detection

### Review Queue

```
┌──────────────────────────────────────────────────────────────────┐
│  🎨 Creator Content Review                        0 Pending       │
│                                                                  │
│  No items pending review.                                        │
│                                                                  │
│  Recently Reviewed:                                              │
│  ✅ 06-13 09:00 — "Golden Cross Pro" by @crypto_whale (auto)     │
│  ✅ 06-13 08:30 — "RSI Mean Revert v2" by @trader_jane (auto)   │
│  ⚠ 06-12 22:00 — "Mystery Strategy" flagged (price: 999.00 USDT) │
│       → Manual review: price seems inflated for simple strategy  │
│       → Action: Requested creator justification                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 5. Reconciliation & Auditing

### Reconciliation Dashboard

```
┌──────────────────────────────────────────────────────────────────┐
│  📊 Reconciliation — v2.1.0                                      │
│                                                                  │
│  Hourly Checks:                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ 2026-06-13 10:00                                             │ │
│  │ ✅ Chain wallet ≥ DB balance (TRC-20: 45,230 ≥ 45,228)      │ │
│  │ ✅ Chain wallet ≥ DB balance (ERC-20: 12,450 ≥ 12,448)      │ │
│  │ ✅ sum(debit) = sum(credit): 1,245,678.50 = 1,245,678.50    │ │
│  │ ✅ Checksum verification: ALL wallets pass                  │ │
│  │ ✅ Transfer ≠ Tip isolation: 0 cross-contamination          │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  Daily Reconciliation:                                           │
│  2026-06-12: ✅ PASSED (report: docs/recon/2026-06-12.md)       │
│  2026-06-11: ✅ PASSED (report: docs/recon/2026-06-11.md)       │
│                                                                  │
│  [Run Manual Reconciliation]  [Export Reports]                   │
└──────────────────────────────────────────────────────────────────┘
```

### What Gets Reconciled

| Check | Frequency | What It Verifies |
|-------|-----------|-----------------|
| Chain balance ≥ DB balance | Hourly | No phantom USDT created |
| sum(debit) = sum(credit) | Hourly | Double-entry integrity |
| Checksum verification | Daily | No DB tampering |
| Transfer vs Tip isolation | Daily | Fee pipelines not mixed |
| Idempotency key audit | Daily | No duplicate transactions |
| AI billing: deductions = success + refunds | Daily | AI billing integrity |
| Creator revenue = sales × split% | Daily | Creator payouts correct |

### Alert Thresholds

| Condition | Alert |
|-----------|-------|
| Chain balance < DB balance | 🚨 CRITICAL: Stop all withdrawals immediately |
| sum(debit) ≠ sum(credit) | 🚨 CRITICAL: Accounting error |
| Checksum mismatch | 🚨 CRITICAL: Possible DB tampering |
| Transfer/Tip cross-contamination | ⚠ WARNING: Pipeline isolation breach |
| Idempotency collision | ⚠ WARNING: Duplicate transaction detected |

---

## 6. Security Monitoring

### 6-Layer Security Status

```
┌──────────────────────────────────────────────────────────────────┐
│  🔒 Security Status — 6 Layers                                    │
│                                                                  │
│  Layer 1: Server-side truth     ✅ All financial calc server-side │
│  Layer 2: Double-entry ledger   ✅ 1,245,678.50 = 1,245,678.50   │
│  Layer 3: Pessimistic row lock  ✅ 0 deadlocks in 24h             │
│  Layer 4: HMAC-SHA256 checksums ✅ All wallets verified           │
│  Layer 5: Chain verification    ✅ TRC-20 + ERC-20 monitoring     │
│  Layer 6: Withdrawal risk       ✅ 6 rules active                 │
└──────────────────────────────────────────────────────────────────┘
```

### Security Event Log

```
GET /api/admin/security/logs?severity=critical

Recent Events:
  06-13 10:00 ✅ Reconciliation: PASSED
  06-13 09:45 ⚠ Failed login: user_xyz (3 attempts, IP: 203.x.x.x)
  06-13 09:30 ✅ Withdrawal: 500 USDT to TXxx... (auto)
  06-13 09:15 ⚠ AI refund rate spike: 12% (threshold: 10%)
  06-13 09:00 ✅ Daily checksum: PASSED
```

---

## 7. System Health

### Service Status

```
┌──────────────────────────────────────────────────────────────────┐
│  ⚙️ System Health                                                 │
│                                                                  │
│  Services:                                                       │
│  🟢 API Server          (uptime: 14d 3h, 23 req/s, p99: 45ms)   │
│  🟢 Database (SQLite)   (size: 42MB, WAL: 8MB, 0 locks)         │
│  🟢 Chain Monitor TRC   (blocks behind: 2, scanning: active)    │
│  🟢 Chain Monitor ERC   (blocks behind: 4, scanning: active)    │
│  🟡 AI Service          (Tier: V4 Flash, V4 Pro degraded)        │
│  🟢 Cron Scheduler      (next: reconciliation in 12 min)         │
│                                                                  │
│  Resources:                                                      │
│  CPU: 34% | Memory: 1.2GB/4GB | Disk: 45GB free                 │
└──────────────────────────────────────────────────────────────────┘
```

### AI Service Monitoring

```
AI Metrics (last 24h):
  Total calls: 1,247
  Success rate: 96.8%
  Refund rate: 3.2% (normal: <10%)
  Tier distribution:
    V4 Pro discounted: 92%
    V4 Pro full: 5%
    V4 Flash: 3%
    MiniMax-M3: 0%
  Avg response time: 2.3s (V4 Pro), 1.1s (Flash)
  Platform cost: 342 USDT
  User revenue: 1,247 USDT
  Margin: 905 USDT (72.6%)
```

---

## 8. Incident Response

### Critical Incidents

| Incident | Response |
|----------|----------|
| Chain balance < DB balance | 🚨 1. Stop all withdrawals 2. Freeze deposits 3. Investigate discrepancy 4. Do NOT resume until reconciled |
| Checksum mismatch | 🚨 1. Identify affected wallets 2. Restore from backup 3. Verify integrity 4. Resume |
| sum(debit) ≠ sum(credit) | 🚨 1. Stop all transactions 2. Identify unbalanced entries 3. Apply corrective entries 4. Resume |
| Mass AI refunds | ⚠ 1. Check AI provider status 2. Consider pausing AI features 3. Investigate root cause |
| Withdrawal fraud detected | ⚠ 1. Freeze user account 2. Halt pending withdrawal 3. Review transaction history 4. Report to compliance |

### Emergency Contacts
- Platform Owner: (private)
- Lead Developer: (private)
- AI Provider (DeepSeek): Status page at status.deepseek.com

### Recovery Procedures

#### Database Corruption
```
1. Stop all services
2. Verify backup integrity (daily backup at 03:00 UTC)
3. Restore from most recent verified backup
4. Replay chain transactions since backup
5. Run full reconciliation
6. Resume services
```

#### Hot Wallet Compromise
```
1. Immediately move remaining hot wallet funds to cold wallet
2. Rotate hot wallet private key
3. Audit all withdrawals in last 24 hours
4. File incident report
5. Resume with new hot wallet
```

---

## Appendix: Admin API Reference

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/admin/users` | GET | Admin | List/search users |
| `/api/admin/users/:id` | GET | Admin | User detail |
| `/api/admin/users/:id/suspend` | POST | Admin | Suspend user |
| `/api/admin/withdrawals/pending` | GET | Admin | Pending withdrawal reviews |
| `/api/admin/withdrawals/:id/approve` | POST | Admin | Approve withdrawal |
| `/api/admin/withdrawals/:id/reject` | POST | Admin | Reject withdrawal |
| `/api/admin/creators/review` | GET | Admin | Pending creator reviews |
| `/api/admin/reconciliation/latest` | GET | Admin | Latest reconciliation report |
| `/api/admin/reconciliation/run` | POST | Admin | Run manual reconciliation |
| `/api/admin/security/logs` | GET | Admin | Security event log |
| `/api/admin/system/health` | GET | Admin | System health status |
| `/api/admin/system/services` | GET | Admin | Service status list |

---

> **Version**: v2.1.0 | **Compliance**: This manual covers all admin functions required by the v17.6 revenue model.
