<!-- META
version: 1.12.0
last_updated: 2026-06-12
round: R108
owner: youdao
purpose: (auto-generated, needs review)
-->

# PWA 故障排查指南

**版本**: v0.12.0  
**作者**: dao  
**时间**: 2026-06-07T11:08:00+08:00  
**状态**: Phase 6.3 PWA 故障排查

---

## 目录

1. [PWA 故障排查概述](#pwa-故障排查概述)
2. [离线问题诊断](#离线问题诊断)
3. [缓存策略调试](#缓存策略调试)
4. [Service Worker 问题](#service-worker-问题)
5. [安装问题](#安装问题)
6. [更新问题](#更新问题)
7. [性能问题](#性能问题)
8. [常见问题](#常见问题)
9. [调试工具](#调试工具)

---

## PWA 故障排查概述

### 故障排查流程

```
1. 识别问题类型
   ├─ 离线问题
   ├─ 缓存问题
   ├─ Service Worker 问题
   ├─ 安装问题
   ├─ 更新问题
   └─ 性能问题

2. 收集诊断信息
   ├─ 浏览器控制台日志
   ├─ Network 面板
   ├─ Application 面板
   └─ Lighthouse 报告

3. 定位根因
   ├─ 检查配置
   ├─ 检查代码
   └─ 检查环境

4. 解决问题
   ├─ 修复配置
   ├─ 修复代码
   └─ 清除缓存

5. 验证修复
   ├─ 功能测试
   ├─ 性能测试
   └─ 兼容性测试
```

### 诊断工具

| 工具 | 用途 | 访问方式 |
|-----|------|---------|
| Chrome DevTools | 调试 PWA | F12 |
| Lighthouse | 性能审计 | DevTools → Lighthouse |
| Application 面板 | 查看缓存/Service Worker | DevTools → Application |
| Network 面板 | 查看网络请求 | DevTools → Network |
| Console 面板 | 查看日志 | DevTools → Console |

---

## 离线问题诊断

### 问题 1: 离线时页面空白

**症状**:
- 断网后访问页面显示空白
- 控制台显示 "Failed to load resource"

**诊断步骤**:

1. **检查 Service Worker 是否注册**
   ```javascript
   // Console 面板执行
   navigator.serviceWorker.controller !== null
   // 应返回 true
   ```

2. **检查离线页面是否存在**
   ```bash
   # 检查文件是否存在
   ls public/offline.html
   ```

3. **检查 Service Worker 拦截逻辑**
   ```javascript
   // public/sw.js
   self.addEventListener('fetch', (event) => {
     // 检查是否拦截了文档请求
     if (event.request.destination === 'document') {
       // 检查是否返回离线页面
     }
   });
   ```

**解决方案**:

```javascript
// public/sw.js - 修复离线页面返回
self.addEventListener('fetch', (event) => {
  if (event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/offline.html');
      })
    );
  }
});
```

### 问题 2: 离线时 API 请求失败

**症状**:
- 断网后 API 请求返回 503
- 数据无法加载

**诊断步骤**:

1. **检查 API 请求是否使用 Network First**
   ```javascript
   // public/sw.js
   if (event.request.url.includes('/api/')) {
     // 检查是否使用 networkFirst 策略
   }
   ```

2. **检查缓存中是否有 API 数据**
   ```javascript
   // Application 面板 → Cache Storage
   // 检查是否有 API 缓存
   ```

**解决方案**:

```javascript
// public/sw.js - API 请求使用 Network First + 缓存回退
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open('api-cache');
    cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: 'Offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
```

### 问题 3: 离线时图片无法加载

**症状**:
- 断网后图片显示 broken
- 控制台显示 "Failed to load resource"

**诊断步骤**:

1. **检查图片是否被缓存**
   ```javascript
   // Application 面板 → Cache Storage
   // 检查图片是否在缓存中
   ```

2. **检查图片请求策略**
   ```javascript
   // public/sw.js
   if (event.request.destination === 'image') {
     // 检查是否使用 Cache First
   }
   ```

**解决方案**:

```javascript
// public/sw.js - 图片使用 Cache First
self.addEventListener('fetch', (event) => {
  if (event.request.destination === 'image') {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return cached || fetch(event.request);
      })
    );
  }
});
```

---

## 缓存策略调试

### 问题 1: 缓存未更新

**症状**:
- 更新代码后，用户仍看到旧版本
- 清除缓存后恢复正常

**诊断步骤**:

1. **检查 Service Worker 版本号**
   ```javascript
   // public/sw.js
   const CACHE_NAME = 'quant-moo-v0.12.0';
   // 检查版本号是否更新
   ```

2. **检查缓存清理逻辑**
   ```javascript
   // public/sw.js
   self.addEventListener('activate', (event) => {
     // 检查是否清理旧缓存
   });
   ```

**解决方案**:

```javascript
// public/sw.js - 更新版本号 + 清理旧缓存
const CACHE_NAME = 'quant-moo-v0.12.1'; // 更新版本号

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
});
```

### 问题 2: 缓存过大

**症状**:
- 应用占用大量存储空间
- 首次加载缓慢

**诊断步骤**:

1. **检查缓存大小**
   ```javascript
   // Application 面板 → Cache Storage
   // 查看每个缓存的大小
   ```

2. **检查缓存策略**
   ```javascript
   // public/sw.js
   // 检查是否缓存了不必要的资源
   ```

**解决方案**:

```javascript
// public/sw.js - 限制缓存大小
const MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50MB

async function addToCache(cache, request, response) {
  const cacheSize = await getCacheSize(cache);
  if (cacheSize > MAX_CACHE_SIZE) {
    await cleanupOldCache(cache);
  }
  await cache.put(request, response);
}

async function getCacheSize(cache) {
  const keys = await cache.keys();
  let size = 0;
  for (const key of keys) {
    const response = await cache.match(key);
    const blob = await response.blob();
    size += blob.size;
  }
  return size;
}

async function cleanupOldCache(cache) {
  const keys = await cache.keys();
  // 删除最旧的 10% 缓存
  const deleteCount = Math.floor(keys.length * 0.1);
  for (let i = 0; i < deleteCount; i++) {
    await cache.delete(keys[i]);
  }
}
```

### 问题 3: 缓存策略冲突

**症状**:
- 某些资源使用错误的缓存策略
- 静态资源使用 Network First

**诊断步骤**:

1. **检查请求拦截逻辑**
   ```javascript
   // public/sw.js
   self.addEventListener('fetch', (event) => {
     // 检查请求类型判断是否正确
   });
   ```

**解决方案**:

```javascript
// public/sw.js - 明确区分请求类型
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 静态资源: Cache First
  if (request.destination === 'script' || 
      request.destination === 'style' || 
      request.destination === 'image' ||
      url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // API 请求: Network First
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // HTML 页面: Network First
  if (request.destination === 'document') {
    event.respondWith(networkFirst(request));
    return;
  }

  // 其他: Cache First
  event.respondWith(cacheFirst(request));
});
```

---

## Service Worker 问题

### 问题 1: Service Worker 未注册

**症状**:
- Application 面板看不到 Service Worker
- PWA 功能不可用

**诊断步骤**:

1. **检查注册代码**
   ```javascript
   // src/registerSW.ts
   // 检查是否正确调用 register()
   ```

2. **检查控制台错误**
   ```javascript
   // Console 面板
   // 查看是否有注册错误
   ```

**解决方案**:

```javascript
// src/registerSW.ts - 确保正确注册
export async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });
      console.log('[SW] Registered:', registration.scope);
      return registration;
    } catch (error) {
      console.error('[SW] Registration failed:', error);
    }
  }
}

// 在应用入口调用
import { registerServiceWorker } from './registerSW';
registerServiceWorker();
```

### 问题 2: Service Worker 不更新

**症状**:
- 更新 sw.js 后，用户仍使用旧版本
- 需要手动清除缓存才能更新

**诊断步骤**:

1. **检查 skipWaiting 和 clients.claim**
   ```javascript
   // public/sw.js
   // 检查是否调用了 skipWaiting() 和 clients.claim()
   ```

2. **检查缓存版本号**
   ```javascript
   // public/sw.js
   // 检查 CACHE_NAME 是否更新
   ```

**解决方案**:

```javascript
// public/sw.js - 确保即时更新
self.addEventListener('install', (event) => {
  self.skipWaiting(); // 立即激活新版本
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim(); // 立即控制所有页面
});
```

### 问题 3: Service Worker 作用域错误

**症状**:
- Service Worker 只控制部分页面
- 某些页面无法离线访问

**诊断步骤**:

1. **检查注册时的 scope**
   ```javascript
   // src/registerSW.ts
   navigator.serviceWorker.register('/sw.js', {
     scope: '/', // 检查 scope 是否正确
   });
   ```

2. **检查 sw.js 位置**
   ```bash
   # sw.js 应该在根目录
   ls public/sw.js
   ```

**解决方案**:

```javascript
// src/registerSW.ts - 确保 scope 正确
navigator.serviceWorker.register('/sw.js', {
  scope: '/',
});

// public/sw.js - 确保在根目录
// 如果 sw.js 在 /public/sw.js，scope 最大为 /
```

---

## 安装问题

### 问题 1: 安装提示不显示

**症状**:
- 没有看到 "安装应用" 提示
- beforeinstallprompt 事件未触发

**诊断步骤**:

1. **检查 manifest.json**
   ```bash
   # 检查 manifest.json 是否存在且正确
   curl https://quant-moo.ai/manifest.json
   ```

2. **检查 HTTPS**
   ```bash
   # PWA 必须使用 HTTPS
   curl -I https://quant-moo.ai
   ```

3. **检查 Service Worker**
   ```javascript
   // Application 面板 → Service Workers
   // 检查 Service Worker 是否注册并激活
   ```

**解决方案**:

```javascript
// src/components/pwa/InstallPrompt.tsx - 监听 beforeinstallprompt
import { useState, useEffect } from 'react';

export const InstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  if (!deferredPrompt) return null;

  return (
    <button onClick={handleInstall}>
      安装应用
    </button>
  );
};
```

### 问题 2: 安装后图标不正确

**症状**:
- 安装后主屏幕图标模糊
- 图标显示错误

**诊断步骤**:

1. **检查 manifest.json icons**
   ```json
   {
     "icons": [
       {
         "src": "/icons/icon-192x192.png",
         "sizes": "192x192",
         "type": "image/png"
       },
       {
         "src": "/icons/icon-512x512.png",
         "sizes": "512x512",
         "type": "image/png"
       }
     ]
   }
   ```

2. **检查图标文件**
   ```bash
   # 检查图标文件是否存在且尺寸正确
   ls -la public/icons/
   ```

**解决方案**:

```json
// public/manifest.json - 提供多种尺寸图标
{
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
  ]
}
```

---

## 更新问题

### 问题 1: 更新提示不显示

**症状**:
- 新版本发布后，用户没有收到更新提示
- 需要手动刷新才能更新

**诊断步骤**:

1. **检查 updatefound 事件**
   ```javascript
   // src/registerSW.ts
   registration.addEventListener('updatefound', () => {
     // 检查是否监听更新
   });
   ```

2. **检查 Service Worker 状态**
   ```javascript
   // Application 面板 → Service Workers
   // 检查是否有新版本等待安装
   ```

**解决方案**:

```javascript
// src/registerSW.ts - 监听更新并显示提示
export async function registerServiceWorker() {
  const registration = await navigator.serviceWorker.register('/sw.js');

  registration.addEventListener('updatefound', () => {
    const newWorker = registration.installing;
    if (!newWorker) return;

    newWorker.addEventListener('statechange', () => {
      if (newWorker.state === 'installed') {
        if (navigator.serviceWorker.controller) {
          // 有新版本可用
          showUpdateNotification();
        }
      }
    });
  });
}

function showUpdateNotification() {
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

### 问题 2: 更新后缓存未清理

**症状**:
- 更新后仍看到旧版本内容
- 需要手动清除缓存

**诊断步骤**:

1. **检查 activate 事件**
   ```javascript
   // public/sw.js
   self.addEventListener('activate', (event) => {
     // 检查是否清理旧缓存
   });
   ```

2. **检查缓存版本号**
   ```javascript
   // public/sw.js
   // 检查 CACHE_NAME 是否更新
   ```

**解决方案**:

```javascript
// public/sw.js - 确保清理旧缓存
const CACHE_NAME = 'quant-moo-v0.12.1'; // 更新版本号

self.addEventListener('activate', (event) => {
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
});
```

---

## 性能问题

### 问题 1: 首次加载缓慢

**症状**:
- 首次访问加载时间 > 3s
- Lighthouse Performance < 90

**诊断步骤**:

1. **运行 Lighthouse 审计**
   ```bash
   # DevTools → Lighthouse → Generate report
   ```

2. **检查 Bundle 大小**
   ```bash
   # 分析 Bundle
   npm run build
   ls -lh dist/assets/
   ```

**解决方案**:

```javascript
// vite.config.ts - 代码分割
export default {
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-router': ['react-router-dom'],
          'vendor-charts': ['echarts'],
        },
      },
    },
  },
};

// src/App.tsx - 懒加载
const DashboardPage = lazy(() => import('./components/dashboard/DashboardPage'));
const StrategyPage = lazy(() => import('./components/strategy/StrategyPage'));
```

### 问题 2: 内存泄漏

**症状**:
- 长时间运行后内存持续增长
- 应用变慢或崩溃

**诊断步骤**:

1. **使用 Chrome DevTools Memory 面板**
   ```bash
   # DevTools → Memory → Take heap snapshot
   ```

2. **检查事件监听器**
   ```javascript
   // 检查是否有未清理的事件监听器
   ```

**解决方案**:

```javascript
// React 组件 - 清理事件监听器
useEffect(() => {
  const handler = () => { /* ... */ };
  window.addEventListener('resize', handler);
  
  return () => {
    window.removeEventListener('resize', handler);
  };
}, []);

// Service Worker - 清理缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(clearOldCaches());
});
```

---

## 常见问题

### Q1: PWA 在 iOS 上不工作？

**A**: iOS Safari 对 PWA 支持有限：
- 需要 iOS 11.3+
- 不支持推送通知
- 不支持后台同步
- 需要用户手动添加到主屏幕

### Q2: 如何测试离线功能？

**A**: 使用 Chrome DevTools：
1. 打开 DevTools → Network 面板
2. 勾选 "Offline"
3. 刷新页面测试离线功能

### Q3: Service Worker 可以访问 localStorage 吗？

**A**: 不可以。Service Worker 运行在独立线程，无法访问 DOM 和 localStorage。可以使用 Cache API 或 IndexedDB。

### Q4: 如何强制更新 Service Worker？

**A**: 
1. 更新 sw.js 文件
2. 更新 CACHE_NAME 版本号
3. 用户刷新页面
4. 或调用 `registration.update()`

### Q5: PWA 可以访问摄像头/麦克风吗？

**A**: 可以，但需要 HTTPS 和用户授权。使用 `navigator.mediaDevices.getUserMedia()`。

---

## 调试工具

### Chrome DevTools

#### Application 面板
- **Service Workers**: 查看注册的 Service Worker
- **Cache Storage**: 查看缓存内容
- **Local Storage**: 查看本地存储
- **Session Storage**: 查看会话存储

#### Network 面板
- **Offline**: 模拟离线状态
- **Throttling**: 模拟慢速网络
- **Disable cache**: 禁用缓存

#### Lighthouse 面板
- **Performance**: 性能审计
- **PWA**: PWA 审计
- **Best Practices**: 最佳实践审计

### 命令行工具

```bash
# Lighthouse CLI
npm install -g lighthouse
lighthouse https://quant-moo.ai --view

# Workbox CLI
npm install -g workbox-cli
workbox wizard

# PWA Builder
# https://www.pwabuilder.com/
```

---

## 附录

### 相关文档

- [PWA 部署指南](./pwa-deployment-guide.md)
- [Phase 6.3 架构文档](../architecture/phase6-architecture.md)
- [v0.12.0 用户手册](./v0.12.0-user-manual.md)

### 工具推荐

- **Lighthouse**: Chrome DevTools 内置
- **Workbox**: Google PWA 工具库
- **PWA Builder**: https://www.pwabuilder.com/
- **SW Debug**: Chrome DevTools Application 面板

---

**文档版本**: v0.12.0  
**最后更新**: 2026-06-07T11:10:00+08:00  
**作者**: dao  
**状态**: ✅ PWA 故障排查指南完成
