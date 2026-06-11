<!-- META
version: 1.12.0
last_updated: 2026-06-12
round: R108
owner: JVS
purpose: (auto-generated, needs review)
-->

# DAWN WHALES PWA 移动端技术评估报告

> **作者**: JVS (AI量化系统)  
> **日期**: 2026-06-04  
> **状态**: 评估完成，待团队决策  
> **预估工时**: 5h (本报告)

---

## 1. 当前架构分析

### 1.1 技术栈现状

| 层级 | 技术 | 移动端兼容性 |
|------|------|-------------|
| 桌面壳 | Electron 33 | ❌ 不适用 |
| 前端 | React 18 + TypeScript + Tailwind | ✅ 可复用 |
| 状态管理 | Zustand | ✅ 可复用 |
| 图表 | ECharts 5.5 + lightweight-charts | ✅ 可复用 (响应式) |
| 构建 | Vite 5 + vite-plugin-electron | ⚠️ 需拆分 |
| 后端 | Node.js (Electron Main) + SQLite | ❌ 需替代方案 |
| 行情 | futu-api (TCP protobuf) | ❌ 需 WebSocket 代理 |
| 数据 | better-sqlite3 | ⚠️ 需 IndexedDB 或远程 API |

### 1.2 关键约束

- **futu-api 是 TCP 协议**，浏览器无法直连，需要 WebSocket 代理层
- **SQLite 是本地数据库**，PWA 无法访问，需要云端 API 或 IndexedDB
- **策略执行依赖 Node.js**，PWA 只能做"只读监控"，不能执行交易
- **Electron IPC 通信**，PWA 需要替换为 REST/WebSocket API

---

## 2. PWA 可行性评估

### 2.1 PWA 能力矩阵

| 功能 | PWA 支持 | 备注 |
|------|---------|------|
| 安装到主屏幕 | ✅ 完全支持 | manifest.json + Service Worker |
| 离线访问 | ✅ 静态资源缓存 | 策略列表/历史数据可缓存 |
| 推送通知 | ✅ Web Push API | 策略信号/风控告警/止盈止损 |
| 实时行情 | ✅ WebSocket | 需要 futu-api WebSocket 代理 |
| 交易执行 | ⚠️ 技术上可行但不推荐 | 安全风险 + 合规要求 |
| 本地存储 | ✅ IndexedDB + Cache API | 替代 SQLite |
| 后台同步 | ✅ Background Sync | 离线操作同步 |
| 摄像头/麦克风 | ❌ 不需要 | 量化交易不需要 |

### 2.2 可行性结论

**PWA 技术上可行，但有明确边界：**

- ✅ **适合**: 策略监控、行情查看、信号推送、绩效查看、回测报告
- ❌ **不适合**: 策略执行、下单交易、实时风控计算

**推荐定位**: PWA 作为 DAWN WHALES 的"移动端只读伴侣"，不做交易执行。

---

## 3. 三种技术方案对比

### 方案 A: Vite PWA 插件 (推荐 ⭐)

**原理**: 用 `vite-plugin-pwa` 在现有 Vite 构建基础上生成 PWA 配置。

```
DAWN WHALES Desktop (Electron)
  └── React 前端 (共享)
       └── PWA 构建产物 (独立部署)
            ├── manifest.json
            ├── service-worker.js
            └── 静态资源 (HTML/CSS/JS)
```

**实现步骤**:
1. 拆分前端代码为 `@dawn-whales/ui` 共享包
2. 添加 `vite-plugin-pwa` 配置
3. 替换 Electron IPC 为 REST/WebSocket API
4. 部署到 Vercel/Netlify/Cloudflare Pages

**优点**:
- ✅ 复用 80% 前端代码 (React/Zustand/ECharts)
- ✅ 构建配置简单 (Vite 原生支持)
- ✅ 渐进增强 (先做监控，后加功能)
- ✅ 部署成本低 (静态托管)

**缺点**:
- ⚠️ 需要后端 API 服务 (替代 Electron Main)
- ⚠️ futu-api 需要 WebSocket 代理层
- ⚠️ 首次开发成本高 (拆分代码 + API 层)

**预估工时**: 40-60h (含 API 层 + PWA 配置 + 测试)

---

### 方案 B: Capacitor 混合应用

**原理**: 用 Capacitor 将 React 代码打包为原生 iOS/Android 应用。

```
DAWN WHALES Desktop (Electron)
  └── React 前端 (共享)
       └── Capacitor 壳 (iOS/Android)
            ├── WebView 渲染
            ├── Native Plugin (推送/存储)
            └── 原生桥接 (可选)
```

**实现步骤**:
1. 添加 `@capacitor/core` + `@capacitor/cli`
2. 配置 iOS/Android 项目
3. 替换 Electron IPC 为 Capacitor Plugin
4. 提交 App Store / Google Play

**优点**:
- ✅ 原生应用体验 (图标/启动屏/推送)
- ✅ 可上架 App Store
- ✅ 复用 80% 前端代码
- ✅ 原生 API 访问 (推送/存储/传感器)

**缺点**:
- ❌ 需要 Apple Developer 账号 ($99/年)
- ❌ 需要 Google Play 账号 ($25 一次性)
- ❌ App Store 审核周期 (1-7天)
- ❌ 维护两套构建 (Electron + Capacitor)
- ❌ 同样需要后端 API

**预估工时**: 60-80h (含 Capacitor 配置 + 双平台测试 + 上架)

---

### 方案 C: React Native 重写

**原理**: 用 React Native 重写移动端，共享业务逻辑但重写 UI。

```
DAWN WHALES Desktop (Electron)
  └── React 前端
  └── React Native 移动端 (独立项目)
       ├── 共享: Zustand store / 类型定义 / 工具函数
       ├── 重写: UI 组件 / 导航 / 动画
       └── 原生模块 (行情/交易)
```

**实现步骤**:
1. 初始化 React Native 项目 (Expo 或 bare)
2. 提取共享逻辑为 `@dawn-whales/core` 包
3. 重写 UI 组件 (React Native 组件)
4. 集成 WebSocket 行情 + REST API

**优点**:
- ✅ 真正的原生体验
- ✅ 性能最优
- ✅ 可深度定制

**缺点**:
- ❌ 重写 100% UI 代码
- ❌ 维护成本最高
- ❌ 需要 React Native 专业知识
- ❌ 开发周期最长

**预估工时**: 120-160h (全新项目)

---

## 4. 推荐方案

### 4.1 推荐: 方案 A (Vite PWA)

**理由**:
1. **开发成本最低** (40-60h vs 60-80h vs 120-160h)
2. **维护成本最低** (一套代码，多端部署)
3. **渐进增强** (先做只读监控，后加功能)
4. **部署灵活** (Vercel/Netlify/Cloudflare Pages)
5. **无需应用商店审核** (用户扫码即可安装)

### 4.2 推荐实施路线

#### Phase 1: 只读监控 PWA (40h)

**功能范围**:
- 实时行情查看 (WebSocket 代理 futu-api)
- 策略状态监控 (运行中/已停止/信号)
- 推送通知 (策略信号/风控告警)
- 绩效查看 (今日盈亏/总收益/夏普)
- 回测报告查看

**技术栈**:
- Vite + vite-plugin-pwa
- React + Zustand (共享)
- ECharts (响应式)
- WebSocket (行情)
- IndexedDB (离线缓存)

**部署**:
- Cloudflare Pages (免费 + 全球 CDN)
- 自定义域名: `m.dawnwhales.app` 或 `app.dawnwhales.app`

#### Phase 2: 交互增强 (可选, +20h)

- 策略参数调整 (只读预览，不执行)
- 回测参数配置 (提交到桌面端执行)
- 交易历史查看
- 风控面板

#### Phase 3: 交易执行 (不推荐)

**理由**:
- 合规风险 (需要金融牌照)
- 安全风险 (移动端交易易被攻击)
- 技术风险 (网络不稳定导致误操作)

**如果必须做**: 仅在 Phase 1+2 稳定后，作为"确认执行"功能 (用户在桌面端发起，移动端确认)。

---

## 5. 后端 API 层设计

PWA 需要后端 API 替代 Electron Main。推荐架构:

```
PWA (移动端)
  ↕ HTTPS/WebSocket
API Gateway (Node.js + Express/Fastify)
  ├── REST API (策略/回测/绩效)
  ├── WebSocket (实时行情/信号推送)
  ├── SQLite (云端数据库)
  └── futu-api WebSocket 代理
```

**关键模块**:
1. **WebSocket 代理**: 将 futu-api TCP 转为 WebSocket
2. **REST API**: 策略 CRUD / 回测执行 / 绩效查询
3. **推送服务**: Web Push API (策略信号/风控告警)
4. **认证**: JWT + 设备绑定 (复用 LicenseManager 逻辑)

**预估工时**: 30-40h (独立项目)

---

## 6. 成本与收益分析

### 6.1 开发成本

| 项目 | 工时 | 优先级 |
|------|------|--------|
| PWA Phase 1 (只读监控) | 40h | P1 |
| 后端 API 层 | 30h | P1 |
| PWA Phase 2 (交互增强) | 20h | P2 |
| **总计** | **90h** | — |

### 6.2 运营成本

| 项目 | 月成本 | 备注 |
|------|--------|------|
| Cloudflare Pages | $0 | 免费套餐足够 |
| 后端服务器 | $10-20 | Railway/Fly.io |
| 域名 | $1 | dawnwhales.app |
| **总计** | **$11-21/月** | — |

### 6.3 预期收益

- **用户留存**: 移动端随时查看策略状态，提升粘性
- **付费转化**: 移动端体验 → 桌面端付费订阅
- **竞争优势**: 竞品大多无移动端，PWA 是差异化卖点
- **市场推广**: "扫码即用" 降低获客成本

---

## 7. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| futu-api WebSocket 代理复杂度高 | 延迟 PWA Phase 1 | 先用 REST API 轮询，后升级 WebSocket |
| PWA 推送不可靠 (iOS Safari 限制) | 用户体验差 | 降级为邮件/短信推送 |
| 后端 API 安全风险 | 数据泄露 | HTTPS + JWT + 设备绑定 + 速率限制 |
| 移动端屏幕小，图表体验差 | 用户不满 | 响应式设计 + 简化版图表 |
| 合规风险 (如果加交易功能) | 法律风险 | PWA 仅做只读监控，不加交易 |

---

## 8. 下一步行动

### 8.1 团队决策点

1. **是否采纳 PWA 方案？** (推荐: 是)
2. **优先级**: P1 (与 USDT 支付并行) 还是 P2 (等 USDT 完成后做)？
3. **后端 API**: 自建 (Node.js) 还是用第三方 (Supabase/Firebase)？

### 8.2 如果采纳，下一步

1. **主龙虾**: 确认 PWA Phase 1 功能范围
2. **JVS**: 编写后端 API 设计文档 (REST + WebSocket)
3. **WorkBuddy**: 评估 futu-api WebSocket 代理可行性
4. **QClaw**: 研究 PWA 推送最佳实践 (iOS/Android 差异)

---

## 9. 参考资料

- [Vite PWA Plugin](https://vite-pwa-org.netlify.app/)
- [Web Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [futu-api WebSocket 文档](https://openapi.futunn.com/futu-api-doc/)
- [PWA 兼容性](https://whatwebcando.today/)
- [Cloudflare Pages 免费套餐](https://pages.cloudflare.com/)

---

## 附录: 技术细节

### A. vite-plugin-pwa 配置示例

```typescript
// vite.config.pwa.ts (独立配置)
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'DAWN WHALES · 道鲸',
        short_name: '道鲸',
        description: 'AI量化交易 · 说人话就能做量化',
        theme_color: '#0d1117',
        background_color: '#0d1117',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.dawnwhales\.app\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 300 },
            },
          },
        ],
      },
    }),
  ],
});
```

### B. WebSocket 代理架构

```typescript
// server/websocket-proxy.ts
import { WebSocketServer } from 'ws';
import { FutuOpenDClient } from '../electron/broker/futu-opend';

const wss = new WebSocketServer({ port: 8080 });
const futu = new FutuOpenDClient('127.0.0.1', 11111);

wss.on('connection', (ws) => {
  // 订阅行情
  futu.onQuotePush((quotes) => {
    ws.send(JSON.stringify({ type: 'quotes', data: quotes }));
  });

  // 接收 PWA 订阅请求
  ws.on('message', (msg) => {
    const { action, codes } = JSON.parse(msg.toString());
    if (action === 'subscribe') {
      futu.subscribeAndPush(codes);
    }
  });
});
```

### C. IndexedDB 缓存策略

```typescript
// lib/db.ts
import { openDB } from 'idb';

const db = await openDB('dawn-whales', 1, {
  upgrade(db) {
    db.createObjectStore('strategies', { keyPath: 'id' });
    db.createObjectStore('klines', { keyPath: ['symbol', 'time'] });
    db.createObjectStore('signals', { keyPath: 'id', autoIncrement: true });
  },
});

// 缓存策略列表
await db.put('strategies', strategyData);

// 读取缓存
const strategies = await db.getAll('strategies');
```

---

**报告完成。等待团队决策。**

— JVS
