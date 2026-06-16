<!-- META
version: 1.12.0
last_updated: 2026-06-12
round: R108
owner: JVS
purpose: (auto-generated, needs review)
-->

# quant-moo P2P 引擎文档: 分发 + 黑名单管理

**版本**: v1.9.0-alpha
**日期**: 2026-06-09
**轮次**: R78 — 引擎补全 (1→4 拆分)

---

## 概述

R78 将 `p2p-transfer-engine.ts` (376 行混合) 拆分为 4 个独立引擎：

| 引擎 | 文件 | 职责 | 状态 |
|------|------|------|:---:|
| 转账引擎 | `p2p-transfer-engine.ts` | 纯 P2P 转账逻辑 | 已有，精简 |
| 争议申诉 | `p2p-dispute-engine.ts` | 4 种申诉类型处理 | **R78 新增** |
| 冻结管理 | `p2p-freeze-manager.ts` | 14 天倒计时 + 自动解冻 | **R78 新增** |
| 黑名单 | `blacklist-manager.ts` | 手动添加/移除 + 关联冻结 | **R78 新增** |

---

# 第一部分: P2P 转账引擎

## API 参考

### `p2pTransfer(from, to, amount, options?): Promise<TransferResult>`

```typescript
interface P2pTransferOptions {
  /** 转账备注 */
  remark?: string;
  /** 是否冻结 (默认 false, P2P 交易为 true) */
  freeze?: boolean;
  /** 冻结天数 (默认 14) */
  freezeDays?: number;
}

interface TransferResult {
  txId: string;           // 交易 ID
  from: string;           // 发送方钱包
  to: string;             // 接收方钱包
  amount: number;         // 金额 (USDT)
  fee: number;            // 手续费 (0.3%)
  status: 'pending' | 'confirmed' | 'frozen' | 'failed';
  frozenUntil?: number;   // 解冻时间戳 (freeze=true 时)
  timestamp: number;
}
```

### 手续费规则

| 方向 | 费率 | 最低 |
|------|------|------|
| 买方→卖方 | 0.3% | 1 USDT |
| 卖方→买方 | 0.3% | 1 USDT |

小计: 双向 0.3% = 平台收入 0.6%/笔。

---

# 第二部分: P2P 争议申诉引擎 [R78 新增]

## 概述

`p2p-dispute-engine.ts` 处理 P2P 交易中的 4 种争议申诉类型，由买方或卖方发起。

## API 参考

### `createDispute(transferId, type, reason, evidence?): Promise<DisputeResult>`

```typescript
type DisputeType = 
  | 'not_received'      // 买方未收到币
  | 'amount_mismatch'   // 金额不符
  | 'counterparty_unresponsive' // 对方不配合
  | 'other';            // 其他

interface DisputeEvidence {
  /** 截图/凭证 URL */
  images?: string[];
  /** 文字描述 */
  description?: string;
  /** 区块链交易哈希 */
  txHash?: string;
}

interface DisputeResult {
  disputeId: string;
  transferId: string;
  type: DisputeType;
  status: 'pending' | 'reviewing' | 'resolved' | 'rejected';
  initiator: string;     // 发起申诉的钱包地址
  respondent: string;    // 被申诉方
  reason: string;
  resolution?: 'unfreeze' | 'continue_freeze' | 'deduct_deposit';
  adminNote?: string;
  createdAt: number;
  resolvedAt?: number;
}
```

### `getDispute(disputeId): Promise<DisputeDetail>`

获取申诉详情，包括双方提交的所有凭证。

### `resolveDispute(disputeId, resolution, adminNote): Promise<void>`

管理员操作:
- `unfreeze`: 解冻资金 → 释放给买方
- `continue_freeze`: 继续冻结 → 等待更多证据
- `deduct_deposit`: 扣除卖方保证金 → 补偿买方

## 4 种申诉类型

| 类型 | 发起方 | 场景 | 默认处理 |
|------|--------|------|----------|
| `not_received` | 买方 | 付款后未收到 USDT | 冻结延长 + admin 审核 |
| `amount_mismatch` | 任一方 | 金额与约定不符 | admin 核对链上数据 |
| `counterparty_unresponsive` | 任一方 | 对方 24h 不回复 | 买方自动取消解锁 |
| `other` | 任一方 | 其他异常 | admin 人工判定 |

## 买方取消解锁

`not_received` 类型申诉中，买方可在冻结期内直接取消交易：
- 冻结中的 USDT → 退回买方
- 卖方保证金扣除 10% → 平台收入
- 仅限 `not_received` 和 `counterparty_unresponsive` 两种类型

```typescript
import { cancelTransfer } from './p2p-dispute-engine';

// 买方取消冻结中的转账
await cancelTransfer(transferId, buyerWallet);
// → USDT 退回, 卖方质押扣除 10%
```

---

# 第三部分: P2P 冻结管理引擎 [R78 新增]

## 概述

`p2p-freeze-manager.ts` 管理所有 P2P 交易的 14 天冻结周期及自动解冻。

## API 参考

### `freezeTransfer(transferId, days?): Promise<FreezeRecord>`

```typescript
interface FreezeRecord {
  transferId: string;
  amount: number;
  frozenAt: number;
  unfreezeAt: number;    // 解冻时间戳
  days: number;          // 冻结天数 (默认 14)
  status: 'frozen' | 'disputed' | 'released';
  autoRelease: boolean;  // 是否到时自动解冻
}
```

### `getFrozenTransfers(wallet?): Promise<FreezeRecord[]>`

查询某钱包的所有冻结记录。

### `getFreezeCountdown(transferId): Promise<FreezeCountdown>`

```typescript
interface FreezeCountdown {
  remainingDays: number;    // 剩余天数
  remainingHours: number;   // 剩余小时
  remainingMinutes: number; // 剩余分钟
  isExpired: boolean;       // 是否已过期
  unfreezeAt: number;
}
```

## 自动解冻机制

```
P2P 转账创建
    ↓
冻结 14 天 (dispute 期间延长)
    ↓
14 天后 ──→ 自动解冻 ──→ 释放给接收方
    ↓ (如被申诉)
dispute 期间 ──→ 暂停倒计时 ──→ admin 判定后继续/释放/扣除
```

### Cron 任务

```typescript
// 每分钟检查一次过期冻结
setInterval(async () => {
  const expired = await getExpiredFreezes();
  for (const freeze of expired) {
    if (freeze.autoRelease && !freeze.disputed) {
      await releaseTransfer(freeze.transferId);
    }
  }
}, 60_000);
```

---

# 第四部分: 黑名单管理引擎 [R78 新增]

## 概述

`blacklist-manager.ts` 提供管理员黑名单功能：手动添加/移除用户 + 自动冻结关联资金。

## API 参考

### `addToBlacklist(wallet, reason, adminId): Promise<BlacklistEntry>`

```typescript
interface BlacklistEntry {
  wallet: string;
  reason: string;
  addedBy: string;       // 管理员 ID
  addedAt: number;
  status: 'active' | 'expired' | 'removed';
  /** 关联自动操作 */
  autoActions: {
    freezeAssets: boolean;    // 冻结该地址所有资产
    cancelTrades: boolean;    // 取消该地址所有活跃 P2P 挂单
    blockTransfers: boolean;  // 阻止该地址发起新转账
  };
}
```

### `removeFromBlacklist(wallet, adminId): Promise<void>`

移除黑名单。不会自动解冻之前冻结的资产（需 admin 手动解冻）。

### `isBlacklisted(wallet): Promise<boolean>`

检查地址是否在黑名单中。

### `getBlacklist(filters?): Promise<BlacklistEntry[]>`

```typescript
interface BlacklistFilters {
  status?: 'active' | 'expired' | 'removed';
  addedAfter?: number;
  addedBy?: string;
  search?: string;  // 钱包地址模糊搜索
}
```

## 联动规则

| 操作 | 效果 |
|------|------|
| 加入黑名单 | 自动冻结该地址所有 USDT + 取消活跃 P2P 挂单 + 阻止新转账 |
| 移除黑名单 | 解除阻止，但已冻结资产需 admin 手动处理 |
| 黑名单中发起转账 | `p2p-transfer-engine` 检测 → 拒绝 → "账户已被限制" |

## 管理员操作流程

### 添加黑名单

```
/admin → 黑名单管理 → 添加
  ├── 钱包地址: T***...
  ├── 原因: 欺诈/洗钱/多次申诉/其他
  ├── 自动操作: ☑ 冻结资产 ☑ 取消挂单 ☑ 阻止转账
  └── 确认 → 生效
```

### 移除黑名单

```
/admin → 黑名单管理 → 搜索钱包 → 移除
  ├── 确认移除 → 解除转账限制
  └── 冻结资产 → 需手动解冻 (审核流程)
```

---

## 全流程示例

```typescript
// 1. 用户 A 转账 100 USDT 给用户 B
const transfer = await p2pTransfer('TA...', 'TB...', 100, { freeze: true });
// → { txId: 'P2P-001', status: 'frozen', frozenUntil: 14天后 }

// 2. 14 天后自动解冻
await checkExpiredFreezes();  // cron 每分钟
// → P2P-001: 自动释放, 'TB...' 收到 100 - 0.3 = 99.7 USDT

// 3. 如果 B 申诉未收到
const dispute = await createDispute('P2P-001', 'not_received', 
  '已付款但未收到 USDT', { txHash: '0x...' });
// → { disputeId: 'D-001', status: 'pending' }

// 4. Admin 审核
await resolveDispute('D-001', 'unfreeze', '链上已确认转账，解冻');
// → P2P-001 立即解冻, B 收到 USDT

// 5. 如果 C 是欺诈者
await addToBlacklist('TC...', '多次欺诈申诉', 'admin@quant-moo.com');
// → C 的所有资产冻结, P2P 挂单取消, 禁止新转账
```

---

## P2P 引擎拆分总结

| 引擎 | 文件 | 行数 | 测试文件 |
|------|------|:---:|------|
| 转账 | `p2p-transfer-engine.ts` | ~200L | `p2p-transfer.test.ts` |
| 申诉 | `p2p-dispute-engine.ts` | ~150L | `p2p-dispute.test.ts` |
| 冻结 | `p2p-freeze-manager.ts` | ~100L | `p2p-freeze.test.ts` |
| 黑名单 | `blacklist-manager.ts` | ~100L | `blacklist.test.ts` |

**拆分前**: 1 引擎 376 行，职责混合
**拆分后**: 4 引擎 ~550 行，职责清晰，独立测试

---

**R78 P2P 引擎拆分完成。1→4，独立引擎 + 独立测试 + 完整文档。**
