# Dawn Whales Security Key Audit — v1.9.0 GA Post-GA

**审计时间**: 2026-06-10 10:45 HKT  
**审计范围**: 全项目 295K 行 (src + electron)  
**审计人**: QClaw (P0-2a R82)  

---

## 一、总体结论

**✅ 无真实密钥泄露风险**。471处匹配均为以下安全类别：

---

## 二、分类审计结果

### 🔒 A类 — process.env 安全引用 (17 env vars, ✅ SAFE)

所有环境变量均使用 `process.env.X || 'safe-default'` 模式，无硬编码实际值：

| 变量 | 用途 | 覆盖文件数 | 默认值 | 风险 |
|------|------|-----------|--------|------|
| `AI_GATEWAY_URL` | AI网关地址 | 1 | localhost:3001 | ✅ 本地默认 |
| `AI_GATEWAY_TOKEN` | AI网关令牌 | 1 | '' (空字符串) | ✅ 需显式配置 |
| `NOWPAYMENTS_API_KEY` | NowPayments支付 | 1 | 注释掉 | ✅ 已禁用 |
| `ORCHESTRATOR_URL` | Agent编排器地址 | 1 | localhost:8765 | ✅ 本地默认 |
| `ORCHESTRATOR_WS_URL` | WebSocket地址 | 1 | localhost:8765 | ✅ 本地默认 |
| `ORCHESTRATOR_TIMEOUT_MS` | 超时 | 1 | 120000 | ✅ 配置值 |
| `ORCHESTRATOR_RETRY_COUNT` | 重试次数 | 1 | 3 | ✅ 配置值 |
| `ORCHESTRATOR_RETRY_DELAY_MS` | 重试延迟 | 1 | 1000 | ✅ 配置值 |
| `ORCHESTRATOR_HEARTBEAT_MS` | 心跳间隔 | 1 | 10000 | ✅ 配置值 |
| `ORCHESTRATOR_MAX_SESSIONS` | 最大会话 | 1 | 5 | ✅ 配置值 |
| `OPEND_HOST` | OpenD主机 | 2 | opend.dawn-whales.cloud / 127.0.0.1 | ✅ 默认地址 |
| `OPEND_PORT` | OpenD端口 | 2 | 11111 | ✅ 标准端口 |
| `OPEND_TLS` | TLS开关 | 1 | true | ✅ 配置值 |
| `OPEND_TIMEOUT_MS` | 超时 | 1 | 5000 | ✅ 配置值 |
| `VITE_DEV_SERVER_URL` | 开发服务器 | 3 | (packaged判断) | ✅ 仅开发模式 |
| `NODE_ENV` | 环境 | 1 | development | ✅ 标准变量 |
| `npm_package_version` | 版本号 | 2 | package.json 版本 | ✅ 元数据 |

**结论**: 所有环境变量均安全，无硬编码实际密钥。

---

### 🔒 B类 — 127.0.0.1 / localhost 默认值 (12处, ✅ SAFE)

均为 broker 连接/本地服务的默认地址，属于正常开发配置：

| 文件 | 用途 | 值 |
|------|------|-----|
| futu-opend.ts | Futu OpenD 本地连接 | 127.0.0.1:11111 |
| ib-adapter.ts | IBKR Gateway 本地连接 | 127.0.0.1 |
| moomoo-adapter.ts | Moomoo OpenD 本地连接 | 127.0.0.1 |
| opend-base-adapter.ts | OpenD 基础适配器 | 127.0.0.1 |
| ws-data-stream.ts | WebSocket 数据流 | 127.0.0.1 |
| agent-orchestrator.ts | Agent 编排器本地 | localhost:8765 |
| cloud-opend-fragment.ts | 云端 OpenD 配置 | 环境变量覆盖 |
| desktop-cleanup.ts | 桌面清理服务 | localhost:3000 |

---

### 🔒 C类 — UI字段标签/变量名 (439处, ✅ BENIGN)

| 类别 | 数量 | 示例 | 说明 |
|------|------|------|------|
| UI表单字段 | ~180 | `password`, `confirmPassword`, `setPassword` | React state/表单字段名 |
| API参数名 | ~120 | `token`, `apiKey` | TypeScript接口定义 |
| 文档/注释 | ~80 | `API_KEY`, `SECRET` | 说明性注释 |
| LLM token计数 | ~40 | `inputTokens`, `outputTokens`, `tokens` | AI token 计数(非密钥) |
| 安全事件日志 | ~19 | `password_changed`, `2fa_enabled` | 安全审计事件类型 |

---

### 🔒 D类 — 邀请码/安全码生成 (3处, ✅ SAFE)

| 文件 | 代码 | 说明 |
|------|------|------|
| invite-referral.ts:53 | `INVITE_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'` | 邀请码字符集 |
| security-engine.ts:253 | `alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'` | TOTP种子生成 |
| security-engine.ts:273 | `alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'` | 备用码生成 |

---

## 三、KPI 汇总

| 分类 | 数量 | 风险 |
|------|------|------|
| A: process.env 安全引用 | 17 vars | ✅ SAFE |
| B: localhost 默认地址 | 12 处 | ✅ SAFE |
| C: UI字段/变量名 | 439 处 | ✅ BENIGN |
| D: 邀请码生成字符集 | 3 处 | ✅ SAFE |
| **总计** | **471 处** | **0 项泄露** |

---

## 四、安全建议 (非紧急)

1. **添加 .env.example**: 创建空值模板，标注必需/可选变量
2. **GitHub Secret Scanning**: 启用仓库 Secret Scanning (免费)
3. **pre-commit hook**: 添加 gitleaks 或 detect-secrets 预提交检查
4. **CI 环境变量注入**: 确保 CI/CD 中所有 `process.env.X` 变量已配置

---

## 五、验证命令

```bash
# 确认无硬编码密钥 (排除已知安全模式)
rg -n "(api_key|apikey|secret|password|token)\s*[=:]\s*['\"][a-zA-Z0-9_\-]{8,}" \
  --type ts --type tsx electron/ src/ \
  | grep -v "process\.env" \
  | grep -v "localhost\|127\.0\.0\.1" \
  | grep -v "\.state\|setState\|useState\|placeholder\|label\|className\|type="
```

**审计文档**: `security-key-audit-20260610.md` (本文件)
