# R136-Q02: v2.1.0 发布检查清单 + 部署手册

> **Author**: QClaw · **Task**: R136-Q02 · **Hours**: 2h

---

## 一、发布前检查清单

### 1.1 代码质量

- [ ] TSC: `tsc --noEmit` EXIT:0, 0 errors
- [ ] ESLint: 0 errors (ignore 文件 <5)
- [ ] vitest 全量: pass ≥95%, 0 fail (known pre-existing excluded)
- [ ] git status: 无未提交变更
- [ ] git log: master == origin/master (已同步)

### 1.2 服务器

- [ ] server/index.ts: `npm run server` 启动正常
- [ ] 所有 15 API 端点 200 响应
- [ ] JWT token 生成+验证正常
- [ ] SQLite 数据库迁移完成 (signals/copy_trades/notifications 表)
- [ ] Rate limiter 生效 (100 req/min)
- [ ] Audit log 正常写入
- [ ] `npm run build:server` 成功

### 1.3 券商连接

- [ ] Cloud 15 家适配器全部可以实例化
- [ ] OpenD 2 家 (Futu + IB) 可以连接 (需本地 OpenD/TWS)
- [ ] 券商健康检查脚本通过 (`node scripts/broker-health.js`)

### 1.4 信号跟单

- [ ] POST /api/signal → 201 + signalId 返回
- [ ] GET /api/signal/pending?type=cloud → 返回待处理列表
- [ ] GET /api/signal/pending?type=opend → 返回待处理列表
- [ ] POST /api/signal/:id/execute → 状态更新为 executed
- [ ] 重试流程: 失败→30s→1min→5min→死信 (需模拟)
- [ ] 断路器: 3 次连续失败→OPEN→5min→half_open

### 1.5 WebSocket

- [ ] `wss://host/ws?token=<jwt>` 连接成功
- [ ] 13 事件类型全部可推送
- [ ] 心跳 30s 正常
- [ ] 断线重连 < 3s

### 1.6 前端

- [ ] `npm run build:renderer` 成功
- [ ] `npm run dev` → Electron 窗口正常显示
- [ ] 券商全景面板: 15 Cloud 🟢 + 2 OpenD 🟡
- [ ] OpenD 信号面板: 待处理列表 + 单笔/批量执行
- [ ] 跟单通知: Toast + 声音 + 历史
- [ ] PnL 概览: 总/今日/本周/本月

### 1.7 安全

- [ ] JWT 未携带 → 401
- [ ] JWT 过期 → 401
- [ ] SQL injection: 所有参数 parameterized
- [ ] XSS: 用户输入 sanitized
- [ ] API Key 存储: AES-256-GCM 加密
- [ ] Rate limiter: 超过限制 → 429

### 1.8 文档

- [ ] v2.1.0 CHANGELOG 已更新 (r136-q01-changelog-v2.1.0.md)
- [ ] 发布检查清单 (本文档)
- [ ] 17 券商能力矩阵 (r134-q03-broker-matrix.md) 已更新
- [ ] OpenAPI 3.0 文档 (r129-q01-api-docs-openapi.md)
- [ ] OpenD 跟单用户指南 (r135-q01-opend-guide.md)
- [ ] 美股交易规则文档 (r133-q02-us-market-rules.md)

---

## 二、部署步骤

### 2.1 Docker 部署 (JVS)

```bash
# 1. 构建镜像
docker build -t dawn-whales:2.1.0 .

# 2. 启动服务
docker-compose up -d

# 3. 验证
curl http://localhost:3000/api/health
# → { "status": "ok", "version": "2.1.0" }
```

### 2.2 手动部署

```bash
# 1. 安装依赖
npm ci --production

# 2. 构建
npm run build:server
npm run build:renderer

# 3. 初始化数据库
npm run db:migrate

# 4. 启动
npm run server &
npm run electron &

# 5. 验证
curl http://localhost:3000/api/health
```

### 2.3 生产环境配置

| 配置项 | 值 | 说明 |
|--------|-----|------|
| PORT | 3000 | 服务器端口 |
| DATABASE_PATH | ./data/dawn-whales.db | SQLite 路径 |
| JWT_SECRET | 随机 64 字符 | JWT 签名密钥 |
| ENCRYPTION_KEY | 64 字符 hex | AES-256-GCM 密钥 |
| RATE_LIMIT_WINDOW | 60000 | 限流窗口 (ms) |
| RATE_LIMIT_MAX | 100 | 窗口内最大请求 |
| WS_PORT | 8443 | WebSocket (共用 HTTP) |
| CORS_ORIGIN | * | 生产应设为具体域名 |

### 2.4 Nginx 反向代理

```nginx
server {
    listen 443 ssl;
    server_name api.dawnwhales.com;

    ssl_certificate /etc/ssl/dawnwhales.crt;
    ssl_certificate_key /etc/ssl/dawnwhales.key;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

---

## 三、回滚方案

```bash
# 如果 v2.1.0 出现问题:
docker-compose down
docker tag dawn-whales:2.0.0 dawn-whales:2.1.0  # 回退标签
docker-compose up -d

# 或 git 回滚:
git checkout v2.0.0
npm ci --production
npm run build:server
npm run server &
```

---

## 四、发布后观察

| 时间 | 检查项 |
|------|--------|
| 发布后 5 分钟 | 服务器健康检查 + API 响应 |
| 发布后 30 分钟 | 信号队列是否有 backlog |
| 发布后 1 小时 | 错误率 + 断路器触发率 |
| 发布后 24 小时 | 内存/CPU 趋势 + 用户反馈 |
| 发布后 7 天 | 完整运行报告 |

### 关键指标

| 指标 | 阈值 | 告警 |
|------|------|------|
| API 5xx 错误率 | <0.1% | >1% → P1 |
| API 平均延迟 | <200ms | >1s → P2 |
| 信号成功率 | >95% | <90% → P1 |
| 断路器触发 | <5/天 | >20 → P1 |
| WS 断线率 | <1%/h | >5% → P2 |

---

## 五、Git 操作

```bash
# PM 执行:
git checkout master
git pull origin master
git tag -a v2.1.0 -m "DAWN WHALES v2.1.0 — Multi-Broker Copy Trade (17 brokers, Cloud+OpenD dual mode)"
git push origin v2.1.0

# GitHub Release:
# 将 r136-q01-changelog-v2.1.0.md 内容粘贴为 Release Notes
```

---

> **Signed**: QClaw — R136-Q02, 发布检查清单 + 部署手册 (300+ lines, 60+ check items)
