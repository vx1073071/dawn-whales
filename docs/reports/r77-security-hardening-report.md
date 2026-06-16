<!-- META
version: 1.12.0
last_updated: 2026-06-12
round: R77
owner: QClaw
purpose: (auto-generated, needs review)
-->

# quant-moo v1.8.1 安全加固报告

**版本**: v1.8.1
**日期**: 2026-06-09
**轮次**: R77
**范围**: A1 (API Key 泄露) · A6 (命令注入沙箱) · A7 (CSRF/XSS/CSP) · C6 (硬编码端口)

---

## A1: DEEPSEEK_API_KEY 泄露修复

### 问题
`electron/engine/nl-parser.ts:524` 直接使用 `process.env.DEEPSEEK_API_KEY` 调用 LLM，违反防破解架构规则 #3（DeepSeek key 只在服务器）。

### 修复
- nl-parser.ts 所有 `process.env.DEEPSEEK_API_KEY` 引用 → 替换为 `/api/ai/gateway` 调用（携带用户 JWT Token）
- nl-parser.ts:390-391 硬编码 `LLM_API_URL` / `LLM_MODEL` → 迁移到 `/api/ai/gateway`
- 引擎内删除所有 `DEEPSEEK_API_KEY` 环境变量引用
- Electron 打包产物扫描确认无 Key 残留

### 验收
```bash
grep -r "DEEPSEEK_API_KEY" electron/engine/ → 返回空
grep -r "process.env.DEEPSEEK" src/ → 返回空
npm run dist && grep -r "sk-" dist/ → 返回空（打包产物不含 Key）
```

### 影响范围
- nl-parser.ts（自然语言策略解析引擎）
- 所有调用 `/api/ai/gateway` 的桌面端功能

---

## A6: child_process 命令注入沙箱

### 问题
5 个引擎使用 `spawn`/`exec`，未做输入校验，存在命令注入风险：
- `em-data-provider.ts` — 东方财富数据
- `push2-proxy.ts` — 行情推送代理
- `python-proxy.ts` — Python 策略执行
- `market-hotspot.ts` — 市场热点
- `nl-parser.ts` — 自然语言解析

### 修复
1. **输入校验**: 所有传入 shell 命令的字符串 → 正则过滤特殊字符 (`;`, `|`, `&`, `` ` ``, `$()`, `${}`)
2. **白名单命令**: 只允许已知安全路径的可执行文件
3. **超时自动 kill**: 所有子进程 30s 超时，自动 `SIGKILL`
4. **参数化调用**: 使用 `spawn(cmd, [args])` 替代 `exec(cmdStr)` 避免 shell 注入

### 验收
```bash
# 命令注入测试
echo "test; rm -rf /" | npm run test:security
# → 输入被拦截, 子进程未创建

# 超时测试
# 模拟阻塞进程 → 30s 后自动 SIGKILL
```

---

## A7: CSRF / XSS / CSP 安全防护

### XSS 防护
- 所有用户输入经 DOMPurify 或等效 HTML encoder 处理
- 富文本输入（策略描述、社区评论）→ 白名单标签+属性过滤
- React 默认 JSX 转义保留（禁止 `dangerouslySetInnerHTML` 除非经 sanitize）

### CSRF 防护
- `/api/*` 所有写操作（POST/PUT/DELETE）→ 验证 CSRF Token
- Token 来源: HTTP Header `X-CSRF-Token`（非 Cookie，防 SameSite 绕过）
- Token 生成: 登录时下发，1h 过期，每次刷新

### CSP Header
- `/api` + `/admin` → 添加 `Content-Security-Policy` header
- Electron main process → `session.defaultSession.webRequest.onHeadersReceived` 注册 CSP
- 策略:
  ```
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  connect-src 'self' https://api.quant-moo.com wss://api.quant-moo.com;
  frame-ancestors 'none';
  ```

### 验收
```bash
curl -I https://api.quant-moo.com/api/health | grep Content-Security-Policy
# → Content-Security-Policy: default-src 'self'; ...

# XSS 测试
# 提交 <script>alert(1)</script> 到社区评论 → 被转为纯文本
```

---

## C6: 硬编码端口迁移到环境变量

### 问题
8 处硬编码端口散落在引擎中：

| 引擎 | 硬编码值 | 改为 |
|------|----------|------|
| agent-orchestrator | `:8765` | `AGENT_PORT` (默认 8765) |
| cloud-opend | `:11111` | `CLOUD_OPEND_PORT` (默认 11111) |
| desktop-cleanup | `:3000` | `CLEANUP_PORT` (默认 3000) |
| docker-manager ×4 | 各自硬编码 | `DOCKER_API_PORT` (默认 2375) |

### 修复
- 每个硬编码值 → `process.env.VAR_NAME || default`
- 新增 `.env.example` 文档化所有环境变量
- 生产部署时通过 `.env` 覆盖默认值

### 验收
```bash
# 默认值测试（不设置环境变量）
npm start → 端口使用默认值，服务正常

# 覆盖测试
AGENT_PORT=9999 npm start → 端口使用 9999
```

---

## 安全加固总结

| 修复项 | 严重度 | 状态 | 验证方式 |
|--------|--------|------|----------|
| A1 API Key 泄露 | 🔴 致命 | 已修复 | grep 验证 |
| A6 命令注入沙箱 | 🔴 高 | 已修复 | 渗透测试 |
| A7 XSS 防护 | 🟡 中 | 已修复 | 输入测试 |
| A7 CSRF 防护 | 🟡 中 | 已修复 | Token 验证 |
| A7 CSP Header | 🟡 中 | 已部署 | curl 验证 |
| C6 硬编码端口 | 🟢 低 | 已迁移 | 环境变量测试 |

---

## 后续建议

- **npm audit fix**: 修复 protobufjs CRITICAL 漏洞（JVS J-77-01 范围外依赖升级）
- **依赖漏洞扫描**: 集成到 CI pipeline，每次 PR 自动检查
- **定期渗透测试**: 每季度一次外部审计
- **SECURITY.md**: 建立安全漏洞披露政策

---

**v1.8.1 安全加固完成。所有 AI Key 引用已从桌面端清除，沙箱已加固，CSRF/XSS/CSP 已部署。**
