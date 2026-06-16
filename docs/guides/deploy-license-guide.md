<!-- META
version: 1.12.0
last_updated: 2026-06-12
round: R108
owner: youdao
purpose: (auto-generated, needs review)
-->

# quant-moo 服务器部署 + 许可证指南

**版本**: v1.5.0-rc  
**更新时间**: 2026-06-09  
**作者**: youdao  

---

## 1. 架构概览

v1.5.0-rc 完成服务器化：关键逻辑从桌面端迁移到 `/api`。

```
桌面端 (Electron)         服务端 (/api + /admin)
┌──────────────┐         ┌──────────────────────┐
│ 策略计算     │         │ AI Gateway           │
│ Futu OpenD   │──HTTP──▶│ 计费引擎             │
│ 本地缓存     │         │ 钱包服务             │
│ UI 渲染      │         │ P2P 服务             │
│              │         │ 许可证验证           │
│              │         │ 2FA 验证             │
└──────────────┘         └──────────────────────┘
                                  │
                          ┌───────┴───────┐
                          │ /admin 后台   │
                          │ (管理员专用)  │
                          └───────────────┘
```

### 防破解保障

- DeepSeek API key **仅在服务端暴露**
- 桌面端不存 AI key / 计费逻辑 / 钱包密钥
- AI 调用必须先通过许可证验证

---

## 2. 服务端部署

### 目录结构

```
server/
├── /api/
│   ├── gateway/       # AI Gateway (11 LLM 路由)
│   ├── billing/       # 计费引擎
│   ├── wallet/        # 钱包服务
│   ├── p2p/           # P2P 转账服务
│   ├── license/       # 许可证系统
│   └── auth/          # 2FA + JWT 认证
├── /admin/            # 管理员 Web 后台
└── config/            # 环境变量 + 密钥
```

### 环境变量

```
DEEPSEEK_API_KEY=     # 唯一暴露点
JWT_SECRET=           # JWT 签名密钥
USDT_WALLET_KEY=      # 钱包密钥
LICENSE_MASTER_KEY=   # 激活码签名密钥
ADMIN_2FA_SECRET=     # 管理员 2FA
```

### 启动

```bash
cd server && npm install && npm run build && npm start
# API: http://localhost:3000/api
# Admin: http://localhost:3000/admin
```

---

## 3. 许可证系统

### 试用期

- **7 天免费试用**
- 全功能可用
- 桌面端启动显示剩余天数

### 激活流程

```
1. 注册账号 (邮箱+密码)
2. 桌面端 → 许可证激活页
3. 输入激活码 (16位)
4. 服务端验证 → 邮箱绑定
5. 激活成功 → 永久使用
```

### 激活码规则

| 规则 | 说明 |
|------|------|
| 格式 | 16 位字母数字 |
| 绑定 | 一码一邮箱 |
| 吊销 | 管理员可吊销 |
| 生成 | 管理员后台批量生成 |

### 许可证状态

| 状态 | 效果 |
|------|------|
| NONE | 未激活，显示试用倒计时 |
| ACTIVE | 已激活，全功能 |
| EXPIRED | 已过期/被吊销，禁用 AI+交易 |

---

## 4. 桌面端适配

### 从本地到云端

| 功能 | v1.4.0 之前 | v1.5.0-rc |
|------|-----------|-----------|
| AI 分析 | 本地调用 LLM | → `/api/gateway` |
| 扣费 | 本地计费 | → `/api/billing` |
| 钱包 | 本地管理 | → `/api/wallet` |
| P2P | 本地引擎 | → `/api/p2p` |
| 许可证 | 无 | → `/api/license` |

### 错误处理

- API 不可用 → "服务暂不可用，请稍后重试"
- 许可证过期 → "请激活许可证以继续使用"
- 余额不足 → "USDT 余额不足，请充值"

---

## 5. API 参考

### AI Gateway

```
POST /api/gateway/analyze
Header: Authorization: Bearer <jwt>
Body: { strategy, market, timeframe }
→ 验证许可证 → 路由 LLM → 返回分析
```

### 计费

```
POST /api/billing/charge
→ 验证余额 → 冻结 → 扣费 → 返回余额
```

### 许可证

```
POST /api/license/activate
Body: { email, activationCode }
→ 验证 → 绑定 → 返回 licenseKey
```

---

## 6. 安全检查清单

- [ ] DeepSeek key 仅在服务端环境变量
- [ ] 桌面端无任何 API key 硬编码
- [ ] JWT 过期时间 ≤ 24h
- [ ] 2FA 强制管理员登录
- [ ] 许可证验证中间件覆盖所有 /api 端点
- [ ] 操作审计日志完整

---

**文档版本**: v1.5.0-rc  
**状态**: ✅ 完成
