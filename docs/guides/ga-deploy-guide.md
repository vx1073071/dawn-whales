# DAWN WHALES v1.7.0 GA 部署手册 & 最终创作者指南

**版本**: v1.7.0 GA  
**更新时间**: 2026-06-09  
**作者**: youdao  

---

## 一、部署清单

### 服务器部署

```bash
# 1. 环境准备
apt install nginx nodejs certbot

# 2. 代码部署
cd /opt/dawn-whales/server
npm ci && npm run build

# 3. 环境变量 (.env, 不提交 Git)
DEEPSEEK_API_KEY=sk-xxx
JWT_SECRET=xxx
NODE_ENV=production
PORT=3000

# 4. PM2 进程守护
pm2 start dist/index.js --name dawn-api
pm2 save && pm2 startup

# 5. Nginx 反向代理
server {
    listen 443 ssl;
    server_name api.dawnwhales.com;
    location / { proxy_pass http://127.0.0.1:3000; }
}

# 6. SSL 证书
certbot --nginx -d dawnwhales.com -d api.dawnwhales.com
```

### 落地页部署

```bash
cp site/index.html /var/www/dawnwhales.com/
nginx -s reload
```

### 桌面端打包

```bash
npm run dist:win    # Windows .exe
npm run dist:mac    # macOS .dmg
npm run dist:linux  # Linux .AppImage
```

---

## 二、上线验证

| 检查项 | ✅ |
|--------|-----|
| dawnwhales.com 可访问 | |
| /api/health 返回 200 | |
| /admin 2FA 登录正常 | |
| 桌面端下载+安装+启动 | |
| 注册→充值→AI分析→交易 全链路 | |
| SSL 证书有效 | |

---

## 三、创作者快速开始

```
下载 → 注册 → 充 USDT → 选 Agent → AI 分析 → 回测 → 发布信号 → 上架市场 → 赚钱
```

**无需激活码。新用户 3 次 AI 免费。充 USDT 即用。**

---

## 四、完整功能速查

| 模块 | 核心功能 |
|------|---------|
| AI | 4Agent 分析 (1.0/1.5/2.0 USDT) |
| 券商 | Futu 港/A/美 + IBKR 美/港 |
| 回测 | 并行 4 核 < 1.5s |
| 市场 | 策略发布/搜索/购买 |
| 社交 | 评论/点赞/关注/信号广场 |
| 资金 | USDT 充值(0费)/提现(0.1%)/P2P(0.3%) |
| 安全 | 2FA TOTP + 许可证 + 黑名单 |
| 语言 | 中/英/日/韩 |

---

**📦 v1.7.0 GA 正式发布。** 🚀
