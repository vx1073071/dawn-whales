# R122 P0-2: 首次使用引导交互设计文档

> **任务**: R122-P02 | **工时**: 1h | **作者**: PM(Claw)
> **依赖**: R122数据链路打通后生效
> **状态**: ✅ 设计完成

---

## 一、问题定义

### 当前状态
- 用户打开App → 空白面板 → 不知道要做什么
- 券商列表为空 → 不知道要先连接券商
- K线显示Mock数据 → 用户困惑数据来源

### 目标
- 新用户打开App → 3步引导完成 → 看到真实K线
- 老用户(已有连接) → 跳过引导 → 直接显示持仓/K线

---

## 二、引导流程 (3步向导)

```
Step 1: 欢迎 + 搜索券商
  ┌────────────────────────────────────┐
  │  🐳 欢迎使用 TradingEasy           │
  │                                    │
  │  连接你的券商账户，开始专业交易      │
  │                                    │
  │  ┌──────────────────────────────┐  │
  │  │ 🔍 搜索你的券商...           │  │
  │  └──────────────────────────────┘  │
  │                                    │
  │  📋 已检测到的本地服务:             │
  │  ┌──────────────────────────────┐  │
  │  │ ● 富途 OpenD (192.168.1.5)  │  │
  │  │ ○ 币安 API                  │  │
  │  │ ○ 盈透 TWS                  │  │
  │  │ ...                         │  │
  │  └──────────────────────────────┘  │
  │                                    │
  │  [跳过，我稍后设置]                 │
  └────────────────────────────────────┘

Step 2: 连接券商
  ┌────────────────────────────────────┐
  │  连接 币安 API                      │
  │                                    │
  │  API Key: [__________________]     │
  │  Secret:  [__________________]     │
  │                                    │
  │  📖 如何获取API Key? → 查看教程     │
  │  📱 扫码连接 → [二维码]            │
  │                                    │
  │  [测试连接]  [跳过此券商]           │
  └────────────────────────────────────┘

Step 3: 完成!
  ┌────────────────────────────────────┐
  │  ✅ 已连接 3 家券商                │
  │                                    │
  │  富途 OpenD ......... ✅ 已连接     │
  │  币安 .............. ✅ 已连接     │
  │  盈透 TWS ......... ❌ 待配置      │
  │                                    │
  │  🎉 准备就绪！                     │
  │                                    │
  │  [开始交易]                        │
  └────────────────────────────────────┘
```

---

## 三、技术实现方案

### 3.1 组件结构

```
src/components/onboarding/
├── OnboardingWizard.tsx        ← 主向导容器 (3步, antd Steps)
├── Step1SearchBroker.tsx       ← 搜索+自动发现
├── Step2ConnectBroker.tsx      ← 配置API Key/扫码
├── Step3Completion.tsx         ← 完成页面
├── OnboardingTrigger.tsx       ← 入口判断逻辑
└── BrokerAutoDetect.tsx        ← 局域网自动发现(OpenD/TWS)
```

### 3.2 入口判断逻辑 (OnboardingTrigger.tsx)

```typescript
// 应用启动时判断
function shouldShowOnboarding(): boolean {
  // 1. 首次启动 → localStorage无任何记录 → 显示引导
  if (!localStorage.getItem('onboarding-completed')) return true;

  // 2. 已有连接券商 → 跳过引导，直接进主界面
  const activeCount = brokerManager.getActiveBrokers().length;
  if (activeCount > 0) return false;

  // 3. 曾完成引导但全部断开 → 显示简化版(仅Step1)
  return true; // mini-mode
}
```

### 3.3 自动发现 (BrokerAutoDetect.tsx)

```typescript
// 局域网扫描
async function autoDetect(): Promise<DetectedBroker[]> {
  const results: DetectedBroker[] = [];

  // 1. 扫描富途 OpenD (默认 127.0.0.1:11111)
  const opend = await detectOpenD('127.0.0.1', 11111);
  if (opend) results.push({ name: '富途 OpenD', type: 'local', ...opend });

  // 2. 扫描盈透 TWS (默认 127.0.0.1:7497)
  const tws = await detectTWS('127.0.0.1', 7497);
  if (tws) results.push({ name: '盈透 TWS', type: 'local', ...tws });

  // 3. 可选的 moomoo 本地
  const moomoo = await detectMoomoo('127.0.0.1', 11112);
  if (moomoo) results.push({ name: 'moomoo', type: 'local', ...moomoo });

  return results;
}
```

### 3.4 持久化

```typescript
interface OnboardingState {
  completed: boolean;           // 是否完成
  completedAt?: string;         // 完成时间
  connectedBrokers: string[];   // 已连接的券商列表
  skippedBrokers: string[];     // 跳过的券商
  currentStep?: number;         // 当前步骤(断点续传)
}
// 存储: localStorage key = 'onboarding-state'
```

---

## 四、与BrokerManagerV2的对接

引导完成后需要调用：
```typescript
// Step2 连接成功后
await brokerManager.registerFactory(brokerId, factory);
await brokerManager.connect(brokerId, credentials);

// Step3 完成后
localStorage.setItem('onboarding-completed', 'true');
localStorage.setItem('onboarding-state', JSON.stringify(state));
// 触发主界面刷新 → 显示真实K线
```

---

## 五、异常处理

| 场景 | 行为 |
|------|------|
| 自动发现0家券商 | Step1 显示空状态+手动搜索引导 |
| API Key验证失败 | Step2 红色提示 + 重试按钮 |
| 用户跳过所有券商 | 允许进入主界面, 顶部Bar显示"连接券商"入口 |
| 中途关闭App | 下次打开从上次步骤继续 |
| 已有连接但新增券商 | 不触发引导, 从"券商管理页"进入 |
| 断线30s以上 | 非引导场景, 由P0-2b(断线修复提示)处理 |

---

## 六、视觉规范

- 引导页: 全屏暗色背景 `bg-[#0d1117]`，居中卡片
- 步骤条: antd Steps，当前步骤高亮 `#378ADD`
- 已检测服务: 绿色圆点 `#639922`
- 按钮: 主操作蓝色，跳过灰色次级
- 进度指示: Step 1/3 小字显示

---

## 七、未来扩展 (R123+)

- R123: 扫码连接集成 (富途/moomoo QR code)
- R124: 多语言引导 (11语言)
- R125: 引导页主题跟随系统

---

*设计完成: 2026-06-12 HKT | 工时: 1h | 作者: PM(Claw)*
