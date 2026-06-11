<!-- META
version: 1.12.0
last_updated: 2026-06-12
round: R108
owner: team
purpose: (auto-generated, needs review)
-->

# DAWN WHALES i18n 开发者指南

> **版本**: v1.10.0
> **最后更新**: 2026-06-12
> **维护人**: QClaw (文档虾)
> **受众**: 全体 Dawn Whales 开发者

---

## 一、 i18n 架构总览

Dawn Whales 使用**双轨制**国际化架构：

| 系统 | 库 | 语言数 | 用途 | 文件 |
|------|-----|--------|------|------|
| **react-i18next (标准)** | i18next + react-i18next | 10 种 | 全局翻译，React 组件 | `src/locales/index.ts` |
| **Zustand Store (轻量)** | Zustand | 3 种 | 简写 API，传统组件 | `src/lib/i18n.ts` |

### 1.1 react-i18next 系统（推荐，用于新代码）

```
src/locales/
├── index.ts             # i18next 初始化 + 语言注册
├── I18nProvider.tsx      # React 包装器 <I18nextProvider>
├── zh-CN.json            # 简体中文 (460+ keys)
├── en.json               # 英语
├── zh-HK.json            # 繁體中文 (香港)
├── zh-TW.json            # 繁體中文 (臺灣)
├── ja.json               # 日本語
├── ko.json               # 한국어
├── fr.json               # Français
├── de.json               # Deutsch
├── es.json               # Español
└── ru.json               # Русский
```

**用法:**
```tsx
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation();
  return <span>{t('dashboard.title')}</span>;
}
```

### 1.2 Zustand Store 系统（兼容旧代码）

**文件**: `src/lib/i18n.ts`
**支持语言**: zh / en / ja
**持久化**: `localStorage.dw_locale`

**用法:**
```tsx
import { useI18nStore, useT } from '@/lib/i18n';

// 方式1: 完整 store
const { t, locale, setLocale } = useI18nStore();
<span>{t('nav.market')}</span>

// 方式2: 简写 hook
const t = useT();
<span>{t('common.save')}</span>

// 切换语言
setLocale('en');
```

---

## 二、 格式化 API 全览

### 2.1 时间格式化

Dawn Whales 提供统一的时间格式化工具，基于 `Intl.DateTimeFormat` API。

```typescript
// utils/formatTime.ts (R98)

/**
 * 格式化时间戳为可读字符串
 * @param ts - Unix 毫秒时间戳 (UTC)
 * @param locale - IANA locale (如 'zh-CN', 'en', 'ja')
 * @param timezone - IANA 时区 (如 'Asia/Shanghai', 'America/New_York')
 * @param options - 格式化选项
 */
function formatTime(
  ts: number,
  locale: string = 'zh-CN',
  timezone?: string,
  options?: Intl.DateTimeFormatOptions
): string {
  const opts: Intl.DateTimeFormatOptions = {
    timeZone: timezone,
    ...options,
  };
  return new Intl.DateTimeFormat(locale, opts).format(new Date(ts));
}

// 短日期: "06/12/2026" (en) / "2026/12/06" (ja)
function formatDateShort(ts: number, locale: string, timezone?: string): string {
  return formatTime(ts, locale, timezone, {
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
}

// 长日期: "June 12, 2026" (en) / "2026年6月12日" (ja)
function formatDateLong(ts: number, locale: string, timezone?: string): string {
  return formatTime(ts, locale, timezone, {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

// 日期时间: "6/12/2026, 3:30 PM" (en) / "2026/06/12 15:30" (ja)
function formatDateTime(ts: number, locale: string, timezone?: string): string {
  return formatTime(ts, locale, timezone, {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}
```

### 2.2 智能相对时间 (timeAgo)

```typescript
/**
 * 相对时间显示 (智能递减)
 * 1分钟内: "just now" / "刚刚" / "たった今"
 * 1小时内: "5 minutes ago" / "5分钟前" / "5分前"
 * 24小时内: "3 hours ago" / "3小时前" / "3時間前"
 * 7天内: "2d ago" / "2天前" / "2日前"
 * 30天内: "3w ago" / "3周前" / "3週間前"
 * 超过30天: fallback to formatDateShort
 */
function timeAgo(ts: number, locale: string = 'zh-CN', maxAgeMs?: number): string {
  const now = Date.now();
  const diff = now - ts;

  // 未来的时间
  if (diff < 0) return formatDateShort(ts, locale);

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (maxAgeMs && diff > maxAgeMs) return formatDateShort(ts, locale);

  if (seconds < 60) return tRelative(locale, 'now');
  if (minutes < 60) return tRelative(locale, 'minute', minutes);
  if (hours < 24) return tRelative(locale, 'hour', hours);
  if (days < 7) return tRelative(locale, 'day', days);
  if (days < 30) return tRelative(locale, 'week', Math.floor(days / 7));

  return formatDateShort(ts, locale);
}
```

### 2.3 数字格式化

```typescript
/**
 * 根据 locale 格式化数字
 * en: "1,234,567.89"
 * de: "1.234.567,89"
 * ja: "1,234,567.89"
 * zh-CN: "123.46万" (compressed)
 */
function formatNumber(num: number, locale: string, decimals?: number, compact?: boolean): string {
  if (compact) {
    return new Intl.NumberFormat(locale, {
      notation: 'compact',
      maximumFractionDigits: decimals ?? 1,
    }).format(num);
  }
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals ?? 0,
    maximumFractionDigits: decimals ?? 2,
  }).format(num);
}
```

### 2.4 货币格式化

```typescript
/**
 * 根据 locale 和货币代码格式化金额
 * USD in en-US: "$1,234.56"
 * HKD in zh-HK: "HK$1,234.56"
 * JPY in ja: "¥1,234"
 * USDT: "1,234.56 USDT" (不随 locale 变化)
 */
function formatCurrency(
  amount: number,
  currency: 'HKD' | 'USD' | 'CNY' | 'JPY' | 'USDT',
  locale: string = 'zh-CN'
): string {
  if (currency === 'USDT') {
    // USDT 无 locale 货币格式，固定展示
    return `${amount.toFixed(2)} USDT`;
  }
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
  }).format(amount);
}
```

### 2.5 百分比格式化

```typescript
function formatPercent(value: number, locale: string, decimals: number = 2): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    signDisplay: 'exceptZero',   // +5.32% / -2.10% / 0.00%
  }).format(value);
}
```

---

## 三、 时区规范

### 3.1 核心原则

```
    存储层 (UTC)              展示层 (Local)
    ──────────                ──────────
    所有 timestamp            基于用户时区
    统一 UTC 毫秒             Intl.DateTimeFormat
    Date.now() 直接写入       自动转换展示
```

### 3.2 UTC 存储 (数据层)

```typescript
// ✅ 正确: 所有引擎生成的时间戳使用 UTC 毫秒
const orderTime = Date.now();                    // UTC ms
const tradeTime = new Date().getTime();          // UTC ms
const marketDataTimestamp = Date.UTC(2026, 5, 12, 14, 30, 0);

// ✅ 正确: 从外部源获取已有时间 (保持原时区标记，转为 UTC)
function toUTC(localTs: number, sourceTimezone: string): number {
  // 使用源时区解析，输出 UTC ms
  const dateStr = new Date(localTs).toLocaleString('en-US', { timeZone: sourceTimezone });
  return new Date(dateStr).getTime();
}

// ❌ 错误: 使用 toString() 等依赖本地时区的方法存储
localStorage.setItem('time', new Date().toString());   // 时区歧义!
```

### 3.3 本地展示 (展示层)

```typescript
// 获取用户时区
import { guess } from '@/utils/timezone';
const userTimezone = guess();  // 'Asia/Shanghai', 'America/New_York', etc.

// 使用 Intl API 进行时区转换展示
const localTime = new Intl.DateTimeFormat(locale, {
  timeZone: userTimezone,
  dateStyle: 'full',
  timeStyle: 'long',
}).format(timestamp);

// 在 React 中使用
const { t } = useTranslation();
const timeStr = formatDateTime(trade.timestamp, currentLocale, userTimezone);
```

### 3.4 市场交易时间 (MarketClock)

```typescript
// electron/engine/data/market-clock.ts (R98 J-02)

interface MarketSession {
  market: string;         // 'US'|'HK'|'CN'|'JP'|'UK'|'EU'|'CRYPTO'
  status: 'open' | 'pre_open' | 'lunch_break' | 'closed';
  nextOpen: number;       // UTC ms
  nextClose: number;      // UTC ms
  timezone: string;       // IANA 时区
}

// 查询市场状态
const status = marketClock.getStatus('HK');
// → { market: 'HK', status: 'open', nextClose: 1718208000000, timezone: 'Asia/Hong_Kong' }

// 检查是否可交易
if (marketClock.isTradingHour('US')) {
  placeOrder(order);
}
```

**7 市场时区表:**

| 市场 | 交易时间 | 时区 | 时区 IANA | 午饭时间 |
|------|---------|------|-----------|---------|
| US/NYSE | 9:30-16:00 | EST/EDT | `America/New_York` | - |
| HK/HKEX | 9:30-16:00 | HKT | `Asia/Hong_Kong` | 12:00-13:00 |
| CN/SSE | 9:30-15:00 | CST | `Asia/Shanghai` | 11:30-13:00 |
| JP/TSE | 9:00-15:00 | JST | `Asia/Tokyo` | 11:30-12:30 |
| UK/LSE | 8:00-16:30 | GMT/BST | `Europe/London` | - |
| EU/XETRA | 9:00-17:30 | CET/CEST | `Europe/Berlin` | - |
| CRYPTO | 24×7 | UTC | `UTC` | - |

---

## 四、 Locale 数据源

### 4.1 react-i18next locale 管理

语言 JSON 文件位于 `src/locales/`，命名空间为 `translation`。

```json
// src/locales/en.json (excerpt)
{
  "dashboard": {
    "title": "Dashboard",
    "overview": "Overview",
    "pnl": "P&L",
    "exposure": "Exposure",
    "allocation": "Allocation",
    "heatmap": "Heatmap"
  },
  "createStrategy": {
    "title": "Create Strategy"
  },
  "trade": {
    "title": "Trade"
  }
}
```

```tsx
// 在 React 中使用嵌套 key
const { t } = useTranslation();
<span>{t('dashboard.title')}</span>   // → "Dashboard"
<span>{t('dashboard.pnl')}</span>     // → "P&L"
```

### 4.2 支持的语言 (10 种)

| Locale | 语言 | Flag | JSON 文件 | Keys |
|--------|------|------|-----------|------|
| `zh-CN` | 简体中文 | 🇨🇳 | `zh-CN.json` | 650+ |
| `en` | English | 🇬🇧 | `en.json` | 463 |
| `zh-HK` | 繁體中文 (香港) | 🇭🇰 | `zh-HK.json` | 463 |
| `zh-TW` | 繁體中文 (臺灣) | 🇹🇼 | `zh-TW.json` | 463 |
| `ja` | 日本語 | 🇯🇵 | `ja.json` | 463 |
| `ko` | 한국어 | 🇰🇷 | `ko.json` | 463 |
| `fr` | Français | 🇫🇷 | `fr.json` | 463 |
| `de` | Deutsch | 🇩🇪 | `de.json` | 463 |
| `es` | Español | 🇪🇸 | `es.json` | 463 |
| `ru` | Русский | 🇷🇺 | `ru.json` | 463 |

### 4.3 Zustand 系统 locale (3 种，兼容旧代码)

```typescript
// src/lib/i18n.ts
type Locale = 'zh' | 'en' | 'ja';
```

---

## 五、 新增语言 Checklist

### Step 1: 创建 JSON 文件

```bash
# 1. 从 zh-CN 复制模板
cp src/locales/zh-CN.json src/locales/<new-locale>.json

# 2. 翻译所有 key 的 value
# 3. 保持 key 结构不变，只翻译右侧 value
```

### Step 2: 注册语言

```typescript
// src/locales/index.ts
import newLocale from './<new-locale>.json';  // + 新增 import

const resources = {
  // ... existing ...
  '<new-code>': { translation: newLocale },   // + 新增注册
};
```

### Step 3: 更新语言选择器

```typescript
// 在 Settings/LanguageSelector 组件中添加新语言选项
const LANGUAGES = [
  { code: 'zh-CN', label: '简体中文' },
  { code: 'en',    label: 'English' },
  { code: 'ja',    label: '日本語' },
  // ... add new language ...
];
```

### Step 4: 验证

```bash
# 检查所有语言的 key 一致性
node scripts/i18n-audit.js

# 检查是否有未翻译的 CJK
node scripts/i18n-scan.js

# ESLint: 确保没有硬编码文本
npx tsc --noEmit     # 0 errors
npm run build        # 0 errors
```

### 注意事项

- ✅ 所有 JSON 文件 key 结构必须完全一致（zh-CN 是参考模板）
- ✅ 使用语义化 key 路径：`component.section.label` (如 `dashboard.overview.title`)
- ✅ zh-CN.json 为 fallback，任何缺少翻译的 key 自动回退到简体中文
- ❌ 不在 key 中嵌入显示文本（如 `"save": "保存"` → 应使用 `"common.save"`）
- ❌ 不在组件中硬编码中文字符串
- ❌ 不修改 JSON key 名称而不更新所有 10 个文件

---

## 六、 代码规范

### 6.1 React 组件 (推荐: react-i18next)

```tsx
// ✅ 正确: 使用 useTranslation hook
import { useTranslation } from 'react-i18next';

function TradePanel() {
  const { t, i18n } = useTranslation();

  return (
    <div>
      <h1>{t('trade.title')}</h1>
      <Button>{t('trade.submit')}</Button>
      <span>{t('trade.amount', { count: 100 })}</span>
    </div>
  );
}
```

### 6.2 Electron/非 React (使用 Zustand store)

```typescript
// ✅ 正确: 使用 Zustand store
import { useI18nStore, useT } from '@/lib/i18n';

const { t } = useI18nStore.getState();
console.log(t('nav.market')); // "市场" (zh)
```

### 6.3 带参数的翻译

```typescript
// ✅ 正确: 使用 {param} 占位符
t('trade.profit', { amount: 123.45, currency: 'HKD' });
// en: "Profit: HKD 123.45"
// zh: "盈利: HKD 123.45"

// JSON key:
// "trade.profit": "Profit: {currency} {amount}"
```

### 6.4 条件渲染

```tsx
// ✅ 正确: 根据语言显示不同内容
const { t, i18n } = useTranslation();
const isRTL = ['ar', 'he'].includes(i18n.language);

<div dir={isRTL ? 'rtl' : 'ltr'}>
  {t('greeting')}
</div>
```

### 6.5 数字/时间始终用 locale

```typescript
// ✅ 正确: 数字格式化随 locale
const pnl = formatCurrency(1234567.89, 'HKD', i18n.language);
// zh-CN: "HK$1,234,567.89"
// en: "HK$1,234,567.89"
// de: "1.234.567,89 HK$"

// ✅ 正确: 时间格式化随 locale + timezone
const time = formatDateTime(trade.time, i18n.language, userTimezone);
// zh-CN+Asia/Shanghai: "2026/06/12 15:30:00"
// en+America/New_York: "6/12/2026, 03:30:00 AM"
```

---

## 七、 常见陷阱

### 7.1 CJK 残留检测

```bash
# 检测 src/ 中所有 CJK 字符
node scripts/i18n-scan.js
# 预期: 0 CJK (注释除外)
```

### 7.2 翻译 key 缺失

```bash
# 检查所有 locale JSON 的 key 一致性
node scripts/i18n-audit.js
# 列出每个文件中缺失的 key
```

### 7.3 禁止硬编码

```typescript
// ❌ 错误: 硬编码中文字符串
<span>保存</span>
alert('连接失败');

// ❌ 错误: 在 JSX 属性中硬编码
<Button label="保存" />

// ❌ 错误: 在 type 定义中硬编码
type Status = '已连接' | '已断开' | '连接中';

// ✅ 正确: 所有用户可见文本使用 t()
<span>{t('common.save')}</span>
alert(t('status.connectionFailed'));
<Button label={t('common.save')} />
type Status = 'connected' | 'disconnected' | 'connecting';
```

### 7.4 编码问题

```typescript
// ❌ 错误: Python 等脚本修改文件时可能破坏 UTF-8 编码
// 现象: 中文变成 ???? 或乱码
// 解决: 使用 node 脚本 (Buffer with utf8 encoding) 而非 python

// ✅ 正确: 所有 i18n 脚本使用 node
// const fs = require('fs');
// fs.writeFileSync(file, content, 'utf-8');
```

---

## 八、 工具脚本

| 脚本 | 功能 |
|------|------|
| `scripts/i18n-audit.js` | 检查所有 locale JSON key 一致性 |
| `scripts/i18n-scan.js` | 扫描 src/ 中 CJK 残留字符 |
| `scripts/i18n-ast-extract.js` | AST 提取硬编码中文 → 生成 keys |
| `scripts/i18n-tokenizer.js` | CJK token 分割器 |
| `scripts/i18n-r92-strip-cjk-comments.js` | 清理注释中的 CJK (保留功能性) |

---

## 九、 参考

- [react-i18next 文档](https://react.i18next.com/)
- [Intl.DateTimeFormat MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat)
- [Intl.NumberFormat MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat)
- [IANA Time Zone Database](https://www.iana.org/time-zones)
- [项目 CONTRIBUTING.md](../CONTRIBUTING.md)
- [部署指南](./deploy/deployment-guide.md)
- [测试架构文档](../testing/test-architecture.md)
