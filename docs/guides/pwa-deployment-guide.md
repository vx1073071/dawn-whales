<!-- META
version: 1.12.0
last_updated: 2026-06-12
round: R108
owner: youdao
purpose: (auto-generated, needs review)
-->

# PWA 部署指南

**版本**: v0.11.0  
**作者**: dao  
**时间**: 2026-06-07T10:00:00+08:00  
**状态**: Phase 6.2 PWA 支持

---

## 目录

1. [PWA 概述](#pwa-概述)
2. [manifest.json 配置](#manifestjson-配置)
3. [Service Worker 配置](#service-worker-配置)
4. [离线策略](#离线策略)
5. [部署步骤](#部署步骤)
6. [测试验证](#测试验证)
7. [常见问题](#常见问题)
8. [最佳实践](#最佳实践)

---

## PWA 概述

### 什么是 PWA？

PWA (Progressive Web App) 是一种现代化的 Web 应用技术方案，提供类似原生应用的体验：

- **离线访问**: 即使没有网络也能使用核心功能
- **安装到主屏幕**: 可以像原生应用一样安装到设备主屏幕
- **推送通知**: 可以接收推送通知
- **全屏运行**: 可以全屏运行，隐藏浏览器地址栏
- **快速加载**: 通过缓存实现快速加载

### DAWN WHALES PWA 特性

| 特性 | 说明 | 状态 |
|-----|------|------|
| 离线访问 | 核心页面离线可用 | ✅ R45 实现 |
| 安装提示 | 自动提示用户安装 | ✅ R45 实现 |
| 缓存策略 | 智能缓存静态资源 | ✅ R45 实现 |
| 更新机制 | 自动检测新版本 | ✅ R45 实现 |
| 推送通知 | 策略信号推送 | 📋 R46 计划 |

---

## manifest.json 配置

### 基础配置

```json
{
  "name": "DAWN WHALES - 智能量化交易平台",
  "short_name": "DAWN WHALES",
  "description": "AI 策略生成 + 自动回测优化 + 实时性能监控 + 多账户管理",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#1a1a25",
  "theme_color": "#1a1a25",
  "orientation": "any",
  "lang": "zh-CN",
  "icons": [
    {
      "src": "/icons/icon-72x72.png",
      "sizes": "72x72",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-96x96.png",
      "sizes": "96x96",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-128x128.png",
      "sizes": "128x128",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-144x144.png",
      "sizes": "144x144",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-152x152.png",
      "sizes": "152x152",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-384x384.png",
      "sizes": "384x384",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ],
  "shortcuts": [
    {
      "name": "策略管理",
      "short_name": "策略",
      "description": "查看和管理策略",
      "url": "/strategy",
      "icons": [{ "src": "/icons/strategy.png", "sizes": "96x96" }]
    },
    {
      "name": "回测报告",
      "short_name": "回测",
      "description": "查看回测报告",
      "url": "/backtest",
      "icons": [{ "src": "/icons/backtest.png", "sizes": "96x96" }]
    },
    {
      "name": "性能监控",
      "short_name": "监控",
      "description": "查看性能监控",
      "url": "/performance",
      "icons": [{ "src": "/icons/performance.png", "sizes": "96x96" }]
    }
  ],
  "categories": ["finance", "business"],
  "screenshots": [
    {
      "src": "/screenshots/dashboard.png",
      "sizes": "1280x720",
      "type": "image/png",
      "form_factor": "wide"
    },
    {
      "src": "/screenshots/mobile.png",
      "sizes": "750x1334",
      "type": "image/png",
      "form_factor": "narrow"
    }
  ]
}
```

### 配置说明

| 字段 | 说明 | 必填 |
|-----|------|------|
| name | 应用全称 | ✅ |
| short_name | 应用简称（主屏幕显示） | ✅ |
| start_url | 启动页面 | ✅ |
| display | 显示模式（standalone/fullscreen/minimal-ui/browser） | ✅ |
| background_color | 背景色 | ✅ |
| theme_color | 主题色（状态栏颜色） | ✅ |
| icons | 图标列表（至少 192x192 和 512x512） | ✅ |
| shortcuts | 快捷方式（右键菜单） | ❌ |
| screenshots | 应用截图（应用商店展示） | ❌ |

### 图标生成

使用以下工具生成 PWA 图标：

```bash
# 使用 pwa-asset-generator
npx pwa-asset-generator logo.png ./public/icons \
  --background "#1a1a25" \
  --icon-only \
  --opaque

# 生成所有尺寸
# icon-72x72.png, icon-96x96.png, ..., icon-512x512.png
```

---

## Service Worker 配置

### 基础 Service Worker

```typescript
// public/sw.js

const CACHE_NAME = 'dawn-whales-v0.11.0';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// 安装事件：缓存静态资源
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting(); // 立即激活新 Service Worker
});

// 激活事件：清理旧缓存
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim(); // 立即控制所有页面
});

// 拦截请求：Cache First 策略
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 静态资源：Cache First
  if (request.destination === 'script' || 
      request.destination === 'style' || 
      request.destination === 'image' ||
      url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // API 请求：Network First
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // HTML 页面：Network First
  if (request.destination === 'document') {
    event.respondWith(networkFirst(request));
    return;
  }

  // 其他：Cache First
  event.respondWith(cacheFirst(request));
});

// Cache First 策略
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    console.log('[SW] Cache hit:', request.url);
    return cached;
  }
  
  console.log('[SW] Cache miss, fetching:', request.url);
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
  }
  return response;
}

// Network First 策略
async function networkFirst(request) {
  try {
    console.log('[SW] Fetching:', request.url);
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    // 如果缓存也没有，返回离线页面
    if (request.destination === 'document') {
      return caches.match('/offline.html');
    }
    throw error;
  }
}
```

### 注册 Service Worker

```typescript
// src/registerSW.ts

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service Worker not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });

    console.log('[SW] Registered:', registration.scope);

    // 检测更新
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed') {
          if (navigator.serviceWorker.controller) {
            // 有新版本可用
            console.log('[SW] New version available');
            showUpdateNotification();
          } else {
            // 首次安装
            console.log('[SW] First install');
          }
        }
      });
    });

    return registration;
  } catch (error) {
    console.error('[SW] Registration failed:', error);
    return null;
  }
}

function showUpdateNotification() {
  // 显示更新提示
  const notification = document.createElement('div');
  notification.className = 'fixed bottom-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
  notification.innerHTML = `
    <div class="flex items-center gap-2">
      <span>新版本可用</span>
      <button onclick="window.location.reload()" class="bg-white text-blue-500 px-2 py-1 rounded text-sm">
        立即更新
      </button>
    </div>
  `;
  document.body.appendChild(notification);
}
```

---

## 离线策略

### 策略对比

| 策略 | 说明 | 适用场景 | 优点 | 缺点 |
|-----|------|---------|------|------|
| Cache First | 优先使用缓存 | 静态资源（JS/CSS/图片） | 快速加载 | 可能使用旧版本 |
| Network First | 优先使用网络 | API 请求、HTML 页面 | 数据新鲜 | 网络慢时延迟高 |
| Stale While Revalidate | 先返回缓存，后台更新 | 不常变化的数据 | 快速 + 新鲜 | 实现复杂 |

### DAWN WHALES 策略选择

```
静态资源 (JS/CSS/图片):
  → Cache First
  → 原因：版本化文件名，缓存安全

API 请求 (/api/*):
  → Network First
  → 原因：需要最新数据

HTML 页面:
  → Network First
  → 原因：需要最新页面结构

离线页面:
  → Cache First
  → 原因：离线时显示友好提示
```

### 离线页面

```html
<!-- public/offline.html -->
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>离线 - DAWN WHALES</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #1a1a25;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 20px;
    }
    .container {
      text-align: center;
      max-width: 400px;
    }
    .icon {
      font-size: 64px;
      margin-bottom: 20px;
    }
    h1 {
      font-size: 24px;
      margin-bottom: 10px;
    }
    p {
      color: #9ca3af;
      margin-bottom: 20px;
    }
    button {
      background: #f59e0b;
      color: #000;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      font-weight: bold;
      cursor: pointer;
    }
    button:hover {
      background: #fbbf24;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">📡</div>
    <h1>您已离线</h1>
    <p>请检查网络连接后重试</p>
    <button onclick="window.location.reload()">重试</button>
  </div>
</body>
</html>
```

---

## 部署步骤

### 开发环境

```bash
# 1. 启动开发服务器
npm run dev

# 2. Service Worker 不会在开发环境注册
# （避免缓存干扰开发）
```

### 测试环境

```bash
# 1. 构建生产版本
npm run build

# 2. 启动预览服务器
npm run preview

# 3. 访问 http://localhost:4173
# 4. 打开 DevTools → Application → Service Workers
# 5. 验证 Service Worker 注册成功
# 6. 验证离线访问
```

### 生产环境

```bash
# 1. 构建生产版本
npm run build

# 2. 部署到服务器
# 确保以下文件正确部署：
# - /sw.js (Service Worker)
# - /manifest.json (PWA 配置)
# - /icons/* (PWA 图标)
# - /offline.html (离线页面)

# 3. 配置 HTTPS（PWA 必须）
# Nginx 示例：
server {
  listen 443 ssl http2;
  server_name dawn-whales.ai;
  
  ssl_certificate /path/to/cert.pem;
  ssl_certificate_key /path/to/key.pem;
  
  root /var/www/dawn-whales;
  index index.html;
  
  # Service Worker 缓存控制
  location /sw.js {
    add_header Cache-Control "no-cache";
  }
  
  # 静态资源长期缓存
  location /assets/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }
  
  # SPA 路由
  location / {
    try_files $uri $uri/ /index.html;
  }
}

# 4. 验证 PWA
# 使用 Lighthouse 审计：
# - PWA 得分 > 90
# - Performance 得分 > 90
```

---

## 测试验证

### 手动测试清单

- [ ] Service Worker 注册成功
- [ ] manifest.json 正确加载
- [ ] 图标正确显示
- [ ] 离线页面可访问
- [ ] 离线时核心页面可用
- [ ] 离线时 API 请求回退到缓存
- [ ] 安装提示正确显示
- [ ] 安装后主屏幕图标正确
- [ ] 更新提示正确显示
- [ ] 更新后版本正确

### 自动化测试

```typescript
// tests/pwa.test.ts

import { test, expect } from '@playwright/test';

test.describe('PWA', () => {
  test('Service Worker 注册成功', async ({ page }) => {
    await page.goto('/');
    const swRegistered = await page.evaluate(() => {
      return navigator.serviceWorker.controller !== null;
    });
    expect(swRegistered).toBe(true);
  });

  test('manifest.json 正确加载', async ({ page }) => {
    const response = await page.goto('/manifest.json');
    expect(response?.status()).toBe(200);
    const manifest = await response?.json();
    expect(manifest.name).toContain('DAWN WHALES');
  });

  test('离线页面可访问', async ({ page }) => {
    const response = await page.goto('/offline.html');
    expect(response?.status()).toBe(200);
  });

  test('离线时核心页面可用', async ({ page, context }) => {
    await page.goto('/');
    
    // 模拟离线
    await context.setOffline(true);
    
    // 访问核心页面
    await page.goto('/dashboard');
    await expect(page.locator('h1')).toContainText('仪表盘');
    
    // 恢复在线
    await context.setOffline(false);
  });
});
```

---

## 常见问题

### Q1: Service Worker 不更新？

**A**: 检查以下几点：
1. Service Worker 文件是否设置了 `Cache-Control: no-cache`
2. 是否调用了 `self.skipWaiting()` 和 `self.clients.claim()`
3. 是否更新了 CACHE_NAME 版本号

### Q2: 离线时页面空白？

**A**: 检查以下几点：
1. 是否部署了 offline.html
2. Service Worker 是否正确拦截请求
3. 缓存中是否有离线页面

### Q3: 安装提示不显示？

**A**: 检查以下几点：
1. 是否配置了 manifest.json
2. 是否使用 HTTPS
3. Service Worker 是否注册成功
4. 是否满足 PWA 安装条件（Lighthouse > 90）

### Q4: 图标显示不正确？

**A**: 检查以下几点：
1. 图标尺寸是否正确（至少 192x192 和 512x512）
2. 图标路径是否正确
3. manifest.json 中 icons 配置是否正确

### Q5: 缓存导致更新不及时？

**A**: 检查以下几点：
1. 静态资源是否使用版本化文件名
2. API 请求是否使用 Network First 策略
3. 是否实现了更新提示机制

---

## 最佳实践

### 1. 缓存策略

```
✅ 推荐：
- 静态资源：Cache First + 版本化文件名
- API 请求：Network First + 超时回退
- HTML 页面：Network First + 离线页面

❌ 避免：
- 所有资源都使用 Cache First（数据不新鲜）
- 所有资源都使用 Network First（离线不可用）
```

### 2. 缓存大小控制

```typescript
// 限制缓存大小
const MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50MB

async function addToCache(cache, request, response) {
  const cacheSize = await getCacheSize(cache);
  if (cacheSize > MAX_CACHE_SIZE) {
    // 清理最旧的缓存
    await cleanupOldCache(cache);
  }
  await cache.put(request, response);
}
```

### 3. 后台同步

```typescript
// 后台同步：离线时保存操作，在线时同步
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-orders') {
    event.waitUntil(syncOrders());
  }
});

async function syncOrders() {
  const pendingOrders = await getPendingOrders();
  for (const order of pendingOrders) {
    await fetch('/api/orders', {
      method: 'POST',
      body: JSON.stringify(order),
    });
  }
}
```

### 4. 推送通知

```typescript
// 请求通知权限
async function requestNotificationPermission() {
  const permission = await Notification.requestPermission();
  if (permission === 'granted') {
    // 订阅推送
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: 'YOUR_VAPID_PUBLIC_KEY',
    });
    // 发送订阅到服务器
    await fetch('/api/push/subscribe', {
      method: 'POST',
      body: JSON.stringify(subscription),
    });
  }
}
```

---

## 附录

### 相关文档

- [Phase 6.2 架构文档](../architecture/phase6-architecture.md)
- [v0.11.0 用户手册](./v0.11.0-user-manual.md)
- [Lighthouse 审计 + SEO 优化](../reports/lighthouse-seo-optimization-r44.md)

### 工具推荐

- **Lighthouse**: Chrome DevTools 内置
- **PWA Builder**: https://www.pwabuilder.com/
- **Workbox**: Google PWA 工具库
- **pwa-asset-generator**: PWA 图标生成工具

---

**文档版本**: v0.11.0  
**最后更新**: 2026-06-07T10:05:00+08:00  
**作者**: dao  
**状态**: ✅ PWA 部署指南完成
