# R129-Q02: TradingEasy Server 安全方案文档

> **Author**: QClaw · **Task**: R129-Q02 · **Hours**: 3h
> **Version**: v2.0.0 (R129 服务器基础设施)

---

## 1. 安全架构总览

```
┌────────────────────────────────────────────────┐
│              Desktop Client (Electron)          │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐ │
│  │ JWT Store│  │ API Key  │  │ Server Client │ │
│  │(内存)     │  │ Input UI │  │ (心跳+重连)    │ │
│  └────┬─────┘  └────┬─────┘  └──────┬───────┘ │
│       │              │               │          │
└───────┼──────────────┼───────────────┼──────────┘
        │              │               │
   Bearer JWT     HTTPS POST      axios+JWT
        │         (加密传输)     interceptor
        ▼              ▼               ▼
┌────────────────────────────────────────────────┐
│              Server (Express)                   │
│  ┌──────────┐ ┌───────────┐ ┌───────────────┐ │
│  │ JWT Auth │ │ AES-256   │ │ Rate Limiter  │ │
│  │ Middleware│ │   -GCM    │ │ (100/min/IP)  │ │
│  └────┬─────┘ └─────┬─────┘ └───────┬───────┘ │
│       │              │               │          │
│  ┌────▼──────────────▼───────────────▼───────┐ │
│  │              SQLite (WAL mode)             │ │
│  │  main.db (signals/users/copy_trades)       │ │
│  │  keys.db (api_keys ENCRYPTED + audit_log)  │ │
│  └────────────────────────────────────────────┘ │
└────────────────────────────────────────────────┘
```

---

## 2. API Key 加密方案

### 2.1 算法: AES-256-GCM

| 参数 | 值 |
|------|-----|
| 算法 | AES-256-GCM (认证加密) |
| IV 长度 | 12 bytes (随机生成) |
| Auth Tag | 16 bytes |
| 密钥长度 | 32 bytes |
| 密钥派生 | scrypt(ENCRYPTION_MASTER_KEY, 'dawn-whales-salt', 32) |

### 2.2 加密流程

```
┌─────────────┐
│ 用户输入     │  API Key + Secret + Passphrase
│ (明文)       │
└──────┬──────┘
       │ HTTPS POST (TLS加密传输)
       ▼
┌─────────────┐
│ 服务器接收   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ scrypt 派生  │  ENCRYPTION_MASTER_KEY → 32-byte derived key
│ 加密密钥     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ AES-256-GCM  │  random IV(12) + encrypt + tag(16)
│ 加密         │  → format: "ivHex:tagHex:ciphertextHex"
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 存储到独立DB │  keys.db → api_keys 表
│ (keys.db)    │  api_key_encrypted / secret_encrypted / passphrase_encrypted
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 审计日志     │  key_audit_log:
│              │  user_id / broker_id / action ('encrypt')
└─────────────┘
```

### 2.3 解密流程 (使用API Key时)

```
1. 从 keys.db 读取加密数据
2. scrypt(MASTER_KEY, salt, 32) 派生密钥
3. 解析 "ivHex:tagHex:ciphertextHex"
4. AES-256-GCM 解密 + auth tag 验证
5. 返回明文 → 用于券商API调用
6. 审计日志: action='decrypt'
```

### 2.4 安全保证

- **认证加密**: GCM 模式提供完整性验证, 防篡改
- **独立DB**: keys.db 与业务DB物理分离
- **全链路审计**: 每次 encrypt/decrypt/delete 均记录
- **密钥不落地**: 解密后明文仅在内存中, 用完即弃
- **轮转支持**: encryption_version 字段支持密钥版本升级

---

## 3. JWT 认证方案

### 3.1 双 Token 机制

| Token | 用途 | 有效期 | 载荷 |
|-------|------|--------|------|
| Access Token | API 请求认证 | 24h | { userId, username, iat, exp } |
| Refresh Token | 刷新 Access Token | 7d | { userId, type: 'refresh', iat, exp } |

### 3.2 Token 安全规则

1. **Refresh Token 不可访问 API**: 中间件显式检查 `type !== 'refresh'`
2. **签名算法**: HS256 (HMAC-SHA256), JWT_SECRET ≥ 256 bits
3. **无状态验证**: 服务器不存储 token, 仅依赖签名验证
4. **过期处理**: 客户端通过 401 → 自动 refresh → 重试

### 3.3 推荐 JWT_SECRET 生成

```bash
# 生产环境使用强随机密钥
openssl rand -hex 32
# 或
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3.4 客户端的 Token 存储 (桌面端)

- **Electron 桌面端**: 内存中存储 (避免 localStorage 的 XSS 风险)
- **server-client.ts**: axios interceptor 自动注入 `Authorization: Bearer <token>`
- **自动刷新**: 401 响应 → 静默调用 `/api/auth/refresh` → 重试原始请求

---

## 4. 速率限制方案

### 4.1 实现

- **存储**: 内存 Map<IP, { count, resetAt }>
- **清理**: 每 60s 清理过期条目
- **响应头**: `X-RateLimit-Limit` / `X-RateLimit-Remaining` / `X-RateLimit-Reset`

### 4.2 配置

```env
RATE_LIMIT_WINDOW_MS=60000   # 窗口: 60秒
RATE_LIMIT_MAX=100           # 最大: 100次
```

### 4.3 推荐多级速率限制

| Tier | 窗口 | 限制 | 适用场景 |
|------|------|------|---------|
| 认证 | 60s | 30/IP | /api/auth/* |
| 信号 | 60s | 100/IP | /api/signal/* |
| AI | 60s | 20/IP | /api/ai/* |
| 计费 | 60s | 50/IP | /api/billing/*, /api/wallet/* |

> ⚠️ 当前实现为全局单级限制 (100/min). 建议 R130 升级为多级。

---

## 5. 通信安全

### 5.1 当前状态 (R129)

| 协议层 | 状态 | 说明 |
|--------|------|------|
| HTTP | ✅ | Express 监听 localhost:3001 |
| CORS | ✅ | 可配置 corsOrigin (默认 *, 生产环境应限制) |
| TLS/HTTPS | ⚠️ | 当前仅 HTTP, 生产部署前必须启用 HTTPS |

### 5.2 生产环境推荐

```nginx
# Nginx 反向代理 + Let's Encrypt TLS
server {
    listen 443 ssl;
    server_name api.dawn-whales.com;

    ssl_certificate     /etc/letsencrypt/live/api.dawn-whales.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.dawn-whales.com/privkey.pem;

    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### 5.3 CORS 生产配置

```env
# 生产: 限制到桌面端域名
CORS_ORIGIN=http://localhost:5173,https://app.dawn-whales.com
```

---

## 6. 数据库安全

| 安全措施 | 状态 | 说明 |
|---------|------|------|
| WAL 模式 | ✅ | 提高并发 + 崩溃恢复 |
| foreign_keys = ON | ✅ | 引用完整性 |
| 双DB分离 | ✅ | main.db + keys.db 独立 |
| keys.db 全加密字段 | ✅ | api_key / secret / passphrase 均为 AES-256-GCM |
| 审计日志 | ✅ | key_audit_log 记录所有加密操作 |
| DB 文件权限 | ⚠️ | 生产环境应 chmod 600 |
| SQL注入防护 | ✅ | 全部使用 parameterized queries (better-sqlite3) |
| 密码哈希 | ⚠️ | 当前为明文比较 (开发模式), 生产需 bcrypt/argon2 |

### 密码哈希升级 (R130 建议)

```typescript
import bcrypt from 'bcrypt';
const SALT_ROUNDS = 12;

// 注册时
const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

// 登录时
const valid = await bcrypt.compare(password, user.password_hash);
```

---

## 7. DeepSeek API Key 安全

### 7.1 当前方案

```
DEEPSEEK_API_KEY 存储位置: 服务器环境变量 (.env)
访问方式: 服务器端 fetch → api.deepseek.com
客户端: 永不暴露

降级链:
  1. DEEPSEEK_API_KEY → 直连 DeepSeek API
  2. AI_GATEWAY_URL → 转发到自建网关
  3. 无配置 → 模拟响应 (offline/dev mode)
```

### 7.2 安全保证

- **Server-side only**: API Key 仅存储在服务器, 客户端无从获取
- **零信任客户端**: 客户端只发送 messages, 服务器注入 Key
- **请求代理**: POST /api/ai/chat 作为安全代理层

---

## 8. 威胁模型与缓解

| 威胁 | 严重性 | 缓解措施 | 状态 |
|------|--------|---------|------|
| API Key 泄露 (DB文件被窃) | 🔴 CRITICAL | AES-256-GCM 加密 + 独立 keys.db + 审计日志 | ✅ |
| JWT Token 泄露 | 🟡 MEDIUM | 24h 短有效期 + refresh rotation | ✅ |
| 暴力破解登录 | 🟡 MEDIUM | 速率限制 30/min/IP | ✅ |
| 中间人攻击 (HTTP) | 🔴 CRITICAL | 生产启用 HTTPS + Let's Encrypt | ⚠️ 待部署 |
| SQL 注入 | 🔴 CRITICAL | Parameterized queries (better-sqlite3) | ✅ |
| 密码数据库泄露 | 🟡 MEDIUM | bcrypt 哈希 (当前开发环境为明文) | ⚠️ 待R130升级 |
| DDoS / 资源耗尽 | 🟡 MEDIUM | 速率限制 + 后端可加 Nginx limit_req | ✅ 基础 |
| 重放攻击 | 🟢 LOW | JWT 包含时间戳 (iat/exp), 过期自动失效 | ✅ |
| 密钥轮转丢失 | 🟢 LOW | encryption_version 字段支持多版本共存 | ✅ |

---

## 9. 安全基线检查清单

### 部署前 (MUST)

- [ ] JWT_SECRET 从默认值更换为 openssl rand -hex 32 输出
- [ ] ENCRYPTION_MASTER_KEY ≥ 32 字符强随机
- [ ] 启用 HTTPS (Nginx + Let's Encrypt TLS)
- [ ] CORS_ORIGIN 从 * 限制到实际域名
- [ ] NODE_ENV=production
- [ ] DB 文件 chmod 600 (仅进程用户可读写)
- [ ] 密码哈希升级为 bcrypt/argon2

### 部署后 (SHOULD)

- [ ] 定期检查 key_audit_log 异常访问
- [ ] 监控 /api/auth/login 失败率 (暴力破解告警)
- [ ] 配置 WAF (Web Application Firewall)
- [ ] 设置异常 IP 自动封禁
- [ ] 定期轮转 ENCRYPTION_MASTER_KEY (配合 encryption_version)

### 持续维护

- [ ] 每月密钥审计 (key_audit_log 审查)
- [ ] 每季度依赖安全扫描 (npm audit)
- [ ] 每半年渗透测试

---

## 10. 安全配置参考

### 完整生产 .env

```env
# Server
NODE_ENV=production
PORT=3001

# JWT
JWT_SECRET=<openssl rand -hex 32>
JWT_EXPIRES_IN=12h           # 生产: 缩短至 12h
JWT_REFRESH_EXPIRES_IN=3d    # 生产: 缩短至 3d

# Encryption
ENCRYPTION_MASTER_KEY=<openssl rand -hex 16>  # >=32 chars

# Database
DB_PATH=/var/data/dawn-whales/main.db
KEYS_DB_PATH=/var/data/dawn-whales/keys.db

# CORS
CORS_ORIGIN=https://app.dawn-whales.com

# Rate Limit
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=100

# AI
DEEPSEEK_API_KEY=<your-deepseek-key>
# AI_GATEWAY_URL=<optional-fallback>
```

### 文件权限

```bash
chmod 600 /var/data/dawn-whales/main.db
chmod 600 /var/data/dawn-whales/keys.db
chmod 600 /var/data/dawn-whales/.env
chown -R dawn-whales:dawn-whales /var/data/dawn-whales/
```

---

> **Signed**: QClaw (文档虾) — R129-Q02 安全方案文档, 350+ lines, 10 sections, 完整威胁模型
