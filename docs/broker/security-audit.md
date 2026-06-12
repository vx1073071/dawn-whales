# API Key / Token 加密存储安全审计

> R3 SEC-03 | 版本 1.0 | 2026-06-12 | 审计员: youdao

---

## 审计范围

审查 `electron/broker/` 目录下所有适配器文件的 API Key、Secret、Token 存储方式。

审计文件列表:

| 文件 | 适配器 | 存储方式 | 风险等级 |
|------|--------|---------|---------|
| moomoo-adapter.ts | MoomooAdapter | ✅ 通过 OpenDBaseAdapter TCP 连接, Mimosa本身无 Key 持久化 | 🟢 低 |
| longbridge-adapter.ts | LongbridgeAdapter | ⚠️ apiKey/secretKey 从 BrokerConfig 传入, 存储在内存变量 | 🟡 中 |
| futu-opend.ts | FutuOpenDClient | ✅ OpenD TCP 连接, 无持久化 | 🟢 低 |
| opend-base-adapter.ts | OpenDBaseAdapter | ✅ 无 Key 存储, TCP 连接管理 | 🟢 低 |
| BrokerManagerV2.ts | BrokerManagerV2 | ❌ BrokerConfig 含 apiKey/secretKey 明文传入 | 🔴 高 |
| IBrokerAdapterV2.ts | 类型定义 | ✅ 仅类型, 无存储 | 🟢 无风险 |

---

## 逐项审计

### 1. BrokerManagerV2 — 🔴 高风险

**问题**: BrokerConfig 接口包含明文字段:
```typescript
export interface BrokerConfig {
  // ...
  apiKey?: string;      // REST/WS API Key (❌ 明文)
  secretKey?: string;   // Secret Key (❌ 明文)
  passphrase?: string;  // OKX特殊字段 (❌ 明文)
  options?: Record<string, unknown>; // 券商特有配置
}
```

**风险**: 
- 配置以明文 JSON 存储时, 密钥直接暴露在文件中
- `connect(config)` 时密钥在内存中以明文传递

**建议**:
1. 配置中的 apiKey/secretKey 应改为引用, 如 `keyId` 指向 OAuthTokenStore
2. 实际密钥通过 OAuthTokenStore.keytar 读取
3. 连接时: `BrokerConfig.keyId` → `OAuthTokenStore.getToken(keyId)` → `adapter.connect(token)`

### 2. LongbridgeAdapter — 🟡 中风险

**问题**:
```typescript
this.accessToken = data.access_token;    // ⚠️ 内存明文
this.refreshToken = data.refresh_token;  // ⚠️ 内存明文
```

**风险**: Token 在内存中明文存储, 可通过内存dump提取

**评估**: 🟡 可接受 — 内存明文存储是运行时必需, 关键确保不落到磁盘

**建议**:
- 使用 OAuthTokenStore 持久化 refresh_token
- access_token 仅内存持有, 不序列化
- disconnect 时清除所有 token

### 3. BinanceAdapter (由 ML 开发) — 🟡 中风险

**已有措施**: HMAC-SHA256 签名在本地完成, 密钥不出境 ✅
**风险**: Secret 以明文传入 adapter, 需确认不走磁盘

### 4. OAuthBrokerBase (JVS R1) — 🟢 低风险

**已有措施**: JVS 在 R2 完成 SEC-02 (`OAuthTokenStore.ts`, 180行)
- keytar (OS credential manager) 作为主存储
- 文件加密作为 fallback (XOR + chmod 600)
- API: storeToken / getToken / deleteToken

**结论**: ✅ OAuth broker 安全达标

---

## 安全矩阵汇总

| 条件 | 状态 |
|------|------|
| 无硬编码 API Key | ✅ 全部通过 (所有key来自配置或环境) |
| 无 Git 提交 API Key | ✅ 全部通过 (.gitignore 覆盖) |
| OAuth Token 使用 keytar | ✅ R2 SEC-02 已实现 |
| API Secret 在本地签名 | ✅ 全部通过 (签名在本地计算) |
| WebSocket 使用 TLS | ⚠️ 部分未强制 (需在 adapter 中检查协议) |
| 内存中 Token 自动清除 | ⚠️ LongbridgeAdapter 缺少 disconnect 清除 |
| persist 落盘加密 | ❌ BrokerConfig 中的 apiKey 会以明文 JSON 存入配置文件 |

---

## 改进建议 (优先级排序)

### P0: BrokerConfig 密钥字段重构 (影响全部适配器)

**当前**:
```typescript
// ❌ 密钥明文
config = { apiKey: 'abc123', secretKey: 'xyz789' }
manager.connect(config)
```

**建议**:
```typescript
// ✅ 密钥引用
config = { keyId: 'binance-spot-key' }
// 密钥从 keytar 读取
const { apiKey, secret } = await tokenStore.getToken(config.keyId)
const adapter = new BinanceAdapter({ ...config, apiKey, secret })
```

**影响范围**: BrokerManagerV2.connect() + 所有 adapter 构造函数

### P1: LongbridgeAdapter disconnect 清理

```typescript
disconnect(): void {
  this.accessToken = null;    // ✅ 清除内存token
  this.refreshToken = null;   // ✅ 清除内存token
  this.connected = false;
}
```

### P2: WebSocket TLS 强制检查

在所有使用 WebSocket 的适配器中添加:
```typescript
if (!url.startsWith('wss://') && !this.config.options?.allowInsecureWs) {
  throw new Error('WebSocket must use wss:// for security');
}
```

---

## 审计结论

| 指标 | 结果 |
|------|------|
| 审计文件 | 6 个 |
| 高风险项 | 1 个 (BrokerConfig 明文密钥) |
| 中风险项 | 2 个 (LongbridgeAdapter 内存token, Binance secret) |
| 低风险项 | 3 个 |
| 安全达标 | ⚠️ 部分达标 — 核心问题需在 R3/R4 修复 |
| 通过门槛 | ⚠️ 条件通过 — OAuth 已达标准, 需修复 BrokerConfig 密钥存储 |

**关键建议**: P0 重构 BrokerConfig 密钥字段是系统级安全修复，建议 JVS (INF-02 所有者) 协调完成。其余低风险项可在适配器级别修复。

---

*审计版本: 1.0 | 审计日期: 2026-06-12 | 审计员: youdao (R3 SEC-03)*
