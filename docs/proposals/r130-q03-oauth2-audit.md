# R130-Q03: OAuth2 安全审计报告

> **Author**: QClaw · **Task**: R130-Q03 · **Hours**: 2h
> **Scope**: OAuthBrokerBase.ts + OAuthTokenStore.ts + CredentialManager.ts
> **Severity**: 🔴 P0 (6) | 🟡 P1 (4) | 🟢 P2 (3)

---

## 一、审计总览

### 审计文件

| 文件 | 行数 | 角色 | 安全级别 |
|------|------|------|---------|
| electron/broker/adapters/OAuthBrokerBase.ts | 440+ | OAuth2/1.0a 授权流程 | 🔴 需要修复 |
| electron/broker/OAuthTokenStore.ts | 170+ | Token 安全存储 | 🟡 需加固 |
| electron/broker/CredentialManager.ts | 130+ | 统一凭证管理入口 | 🟡 设计问题 |
| server/utils/encryption.ts | 82 | AES-256-GCM 加密 (服务端) | ✅ 通过 |

---

## 二、🔴 P0 严重问题 (必须修复)

### P0-1: OAuth2 缺少 state 参数 — CSRF 攻击

**文件**: `electron/broker/adapters/OAuthBrokerBase.ts`  
**位置**: `_oauth2Flow()` 方法  
**严重性**: 🔴 CRITICAL

**问题**: OAuth2 授权流程未生成/验证 `state` 参数。

```typescript
// 当前实现 (有漏洞)
const authParams = new URLSearchParams({
  client_id: this.config.clientId,
  redirect_uri: this.config.redirectUri,
  response_type: 'code',
  scope: (this.config.scopes || []).join(' '),
  // ❌ 缺少 state 参数
});
```

**攻击场景**:
1. 攻击者发起 OAuth2 授权，获取自己的 authorization code
2. 欺骗受害者点击 `https://YOUR_APP/callback?code=ATTACKER_CODE&state=...`
3. 应用将攻击者的 account 绑定到受害者的 DAWN WHALES 账号
4. 攻击者通过跟单功能控制受攻击账户

**修复方案**:

```typescript
// ✅ 生成随机 state
const state = crypto.randomBytes(32).toString('hex');

// 存储到内存 (5分钟过期)
this.pendingStates.set(state, Date.now());

// 加入授权 URL
const authParams = new URLSearchParams({
  client_id: this.config.clientId,
  redirect_uri: this.config.redirectUri,
  response_type: 'code',
  scope: (this.config.scopes || []).join(' '),
  state,  // ✅ 防御 CSRF
  code_challenge,       // ✅ PKCE (见 P0-2)
  code_challenge_method: 'S256',
});

// 回调时验证
const returnedState = url.searchParams.get('state');
if (!returnedState || !this.pendingStates.has(returnedState)) {
  res.end('<h1>Invalid state parameter</h1>');
  resolve(false);
  return;
}
this.pendingStates.delete(returnedState);
```

---

### P0-2: 缺少 PKCE — Code Interception 攻击

**文件**: `electron/broker/adapters/OAuthBrokerBase.ts`  
**位置**: `_oauth2Flow()` → `_exchangeCodeForToken()`  
**严重性**: 🔴 CRITICAL

**问题**: Desktop 应用属于 **Public Client** (无法安全存储 client_secret)，OAuth 2.1 要求必须使用 PKCE。当前:

1. 未生成 `code_verifier` (43-128 char random string)
2. 未计算 `code_challenge = BASE64URL(SHA256(code_verifier))`
3. token 交换时未发送 `code_verifier`

**攻击场景**: Authorization Code Interception — 恶意软件监控本地回调端口，窃取 code 后直接兑换 token。

**修复方案**:

```typescript
// 生成 PKCE 参数
const codeVerifier = crypto.randomBytes(32).toString('base64url')
  .substring(0, 128);
const codeChallenge = crypto.createHash('sha256')
  .update(codeVerifier).digest('base64url');

// 授权请求中加入
authParams.set('code_challenge', codeChallenge);
authParams.set('code_challenge_method', 'S256');

// Token 交换时
async _exchangeCodeForToken(code: string): Promise<any> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: this.config.redirectUri,
    client_id: this.config.clientId,
    code_verifier: codeVerifier, // ✅ PKCE
  });
  // ...
}
```

---

### P0-3: `_oauthVersion()` 调用错误 — 运行时崩溃

**文件**: `electron/broker/adapters/OAuthBrokerBase.ts`  
**位置**: 第 69 行附近  
**严重性**: 🔴 CRITICAL

**问题**: `authorize()` 调用 `this.config._oauthVersion()` 而非 `this._oauthVersion()`。

```typescript
// ❌ 当前 (会炸)
async authorize(): Promise<boolean> {
  if (this.config._oauthVersion() === '2.0') {  // config 上没有 _oauthVersion!
    // ...
  }
}

// ✅ 修复
async authorize(): Promise<boolean> {
  if (this._oauthVersion() === '2.0') {
    // ...
  }
}
```

这个 bug 会导致所有 OAuth 授权流程在运行时抛出 `TypeError: this.config._oauthVersion is not a function`。

---

### P0-4: OAuthTokenStore XOR "加密" — 可逆且弱

**文件**: `electron/broker/OAuthTokenStore.ts`  
**严重性**: 🔴 CRITICAL

**问题**: 文件回退存储使用 XOR + 硬编码 Key。

```typescript
const ENCRYPTION_KEY = 'DW-BROKER-TOKEN-VAULT-2026';
// ❌ 硬编码密钥, 任何人读取源码都能解密

private _encrypt(data: string): string {
  // ❌ XOR 加密: 可逆、无认证、无IV
  let result = '';
  for (let i = 0; i < data.length; i++) {
    result += String.fromCharCode(
      data.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length)
    );
  }
  return Buffer.from(result).toString('base64');
}
```

**问题分解**:
1. 硬编码密钥 — Git 历史中可见
2. XOR 无认证 — 篡改无法检测
3. 无随机 IV — 相同明文产生相同密文
4. 文件存储无权限限制

**修复方案 (推荐 Electron safeStorage)**:

```typescript
import { safeStorage } from 'electron';

if (safeStorage.isEncryptionAvailable()) {
  const encrypted = safeStorage.encryptString(data);
  // 写入文件 (默认用户专属权限)
} else {
  // 降级: 仅内存, 或 AES-256-GCM + DPAPI
  this.memoryFallback.set(brokerId, data);
}
```

Electron 的 `safeStorage` API 封装了操作系统级别的加密 (DPAPI on Windows / Keychain on macOS)，是桌面端 token 存储的标准方案。

---

### P0-5: CredentialManager 将凭证序列化为 OAuthToken — 语义混淆

**文件**: `electron/broker/CredentialManager.ts`  
**严重性**: 🔴 P0

**问题**:

```typescript
const oauthToken: OAuthToken = {
  accessToken: JSON.stringify(entry),  // ❌ 整个凭证对象塞进 accessToken 字段
  tokenType: 'broker_credentials',     // ❌ 非标准 token type
  expiresAt: 0,                         // ❌ 永不过期的语义冲突
};
await this.tokenStore.storeToken(brokerId, oauthToken);
```

**攻击向量**: OAuthTokenStore 的 `getToken()` 设计为返回 OAuth token，但实际返回的 `accessToken` 是个 JSON 序列化的完整凭证。调用方如果按 `OAuthToken.accessToken` 类型 (string) 使用，可能错误地将其传给券商 API 作为 Bearer token。

**修复**: 扩展 `OAuthTokenStore` 以直接支持 `StoredCredential` 类型，不通过 OAuthToken 序列化。

---

### P0-6: 缺少 nonce 防重放 (OIDC 场景)

**文件**: `electron/broker/adapters/OAuthBrokerBase.ts`  
**严重性**: 🔴 P0 (若支持 OIDC)

如果未来支持 OpenID Connect (如 Schwab OIDC)，需在 ID Token 验证中检查 `nonce` 声明，防止重放攻击。

---

## 三、🟡 P1 高优先级

### P1-1: Token 刷新无保护

```typescript
// OAuthBrokerBase.ts
protected _scheduleTokenRefresh(): void {
  const expiresIn = (this.token!.expiresAt - Date.now()) - 60000; // 提前1分钟
  this.tokenRefreshTimer = setTimeout(async () => {
    if (this.token?.refreshToken) {
      const newToken = await this._refreshToken(this.token.refreshToken);
      this.token = newToken;  // ❌ 无原子性保证
    }
  }, expiresIn);
}
```

**建议**: 使用 Refresh Token Rotation (一次性 refresh token)，每次刷新时旧 refresh token 失效。

### P1-2: 本地回调服务器无 HTTPS

```
redirectUri: 'http://localhost:8083/callback'  // ❌ HTTP
```

桌面端 OAuth 回调通过 `http://localhost` 循环回环地址 (127.0.0.1)，虽然不经过网络，但本地其他进程可监听同一端口。建议使用随机端口 + 验证 Origin。

### P1-3: Token 过期时间未验证

```typescript
expiresAt: config.tokenExpiry || Date.now() + 3600000,
// ❌ 如果 config.tokenExpiry 是过去的时间, 仍然接受
```

**建议**: 加载已存储 token 时检查 `expiresAt > Date.now() + 60000`，否则触发 refresh。

### P1-4: keytar 可选依赖无降级检查

如果 keytar 不可用但也不报错，系统静默使用弱 XOR 加密，用户无感知。建议启动时告警。

---

## 四、🟢 P2 建议改进

| ID | 问题 | 建议 |
|----|------|------|
| P2-1 | `_encrypt` 方法命名误导 | 重命名为 `_obfuscate` (XOR ≠ encrypt) |
| P2-2 | CredentialManager 内存缓存无 TTL | token 加载后在内存中永久驻留，建议 5min TTL |
| P2-3 | OAuthBrokerBase 回调 HTML 无 CSP | 建议最小化 HTML + CSP header |

---

## 五、安全修复优先级路线图

### R131 (紧急修复, 2天)

- [ ] **P0-1**: OAuth2 state 参数 (CSRF) — 0.5h
- [ ] **P0-2**: PKCE code_verifier/code_challenge — 1h
- [ ] **P0-3**: `_oauthVersion()` 调用修复 — 0.1h
- [ ] **P0-4**: OAuthTokenStore 迁移至 Electron safeStorage — 2h
- [ ] **P0-5**: CredentialManager 类型重构 — 1h

### R132 (加固, 1天)

- [ ] **P1-1**: Refresh Token Rotation — 1.5h
- [ ] **P1-2**: 随机端口 + Origin 验证 — 0.5h
- [ ] **P1-3**: Token 过期验证 — 0.3h
- [ ] **P1-4**: keytar 降级告警 — 0.3h

### R133 (优化)

- [ ] **P2-1~P2-3**: 命名/缓存/CSP

---

## 六、服务端加密 (✅ 通过)

### server/utils/encryption.ts 安全评估

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 算法 | ✅ | AES-256-GCM (认证加密) |
| IV | ✅ | 随机 12 bytes |
| Auth Tag | ✅ | 16 bytes (防篡改) |
| 密钥派生 | ✅ | scrypt 32 bytes |
| 密钥长度 | ✅ | 256 bits |
| 独立 DB | ✅ | keys.db 与 main.db 分离 |
| 审计日志 | ✅ | key_audit_log 记录所有操作 |
| 格式 | ✅ | ivHex:tagHex:ciphertextHex |

服务端加密实现达到生产级别，无需修改。

---

## 七、总体评分

| 维度 | 评分 | 说明 |
|------|------|------|
| OAuth2 协议安全 | ⭐⭐ | 缺 state + PKCE → 两大致命漏洞 |
| Token 存储 | ⭐⭐ | XOR 与硬编码密钥, 需迁移 safeStorage |
| 服务端加密 | ⭐⭐⭐⭐⭐ | AES-256-GCM + scrypt, 生产级别 |
| 凭证管理 | ⭐⭐⭐ | 功能完整但序列化语义混淆 |
| 错误处理 | ⭐⭐⭐ | 基本 try/catch, 缺少分类 |
| **综合** | **⭐⭐½** | P0 必须在 R131 修复后才可部署 |

---

> **Signed**: QClaw — R130-Q03, OAuth2 安全审计 (350+ lines, 6 P0 + 4 P1 + 3 P2)
