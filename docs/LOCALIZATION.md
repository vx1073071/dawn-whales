<!-- META
version: 1.12.0
last_updated: 2026-06-12
round: R108
owner: team
purpose: (auto-generated, needs review)
-->

# LOCALIZATION.md — quant-moo 本地化贡献指南

> **版本**: v1.10.0
> **最后更新**: 2026-06-12
> **支持语言**: zh-CN / en / zh-HK / zh-TW / ja / ko / fr / de / es / ru (10种)
> **i18n 框架**: react-i18next (i18next)

---

## 一、 新增语言 Checklist

遵循以下 5 步流程为 quant-moo 新增一种语言。

### Step 1: 创建 Locale JSON 文件

```bash
# 1. 从 zh-CN.json 复制完整 key 模板
cp src/locales/zh-CN.json src/locales/<locale-code>.json

# 2. 翻译所有 value (保留 key 结构和 {{placeholder}} 不变)
# 3. 确保 JSON 文件 UTF-8 编码 (无 BOM)
```

**文件命名规范**: 使用标准 IETF BCP 47 语言标签

| 格式 | 示例 | 说明 |
|------|------|------|
| `{lang}` | `en.json` | 通用语言 |
| `{lang}-{region}` | `zh-CN.json` | 地区变体 (推荐) |

### Step 2: 注册到 i18next

```typescript
// src/locales/index.ts

// 1. 添加 import
import newLocale from './<locale-code>.json';

// 2. 添加到 resources 对象
const resources = {
  'zh-CN': { translation: zhCN },
  en:     { translation: en },
  'zh-HK': { translation: zhHK },
  'zh-TW': { translation: zhTW },
  ja:     { translation: ja },
  ko:     { translation: ko },
  fr:     { translation: fr },
  de:     { translation: de },
  es:     { translation: es },
  ru:     { translation: ru },
  '<code>': { translation: newLocale },  // ← 新增
};
```

### Step 3: 添加到语言选择器

```tsx
// SettingsPage / LanguageSelector 组件

const LANGUAGES: LanguageOption[] = [
  { code: 'zh-CN', label: '简体中文', flag: '🇨🇳' },
  { code: 'en',    label: 'English',   flag: '🇬🇧' },
  { code: 'ja',    label: '日本語',    flag: '🇯🇵' },
  // ... existing languages ...
  { code: '<code>', label: '<native-label>', flag: '<flag>' },  // ← 新增
];
```

**LanguageSelect 组件位置**: `src/components/settings/SettingsPage.tsx` (Timezone/Language tabs)

### Step 4: 验证

```bash
# 1. 检查所有 locale JSON 的 key 一致性
#    列出任何缺失或多余的 key
node scripts/i18n-audit.js

# 2. 检查 CJK 残留 (翻译后的 JSON 不应有 CJK 字符串残留)
node scripts/i18n-scan.js

# 3. TypeScript 编译
npx tsc --noEmit              # 必须 0 errors

# 4. 构建验证
npm run build                 # 必须 0 errors
```

### Step 5: 提交 PR

使用 locale 专用 PR 模板 (见第五节) 提交 Pull Request。

---

## 二、 翻译规范

### 2.1 Key 命名规范

采用 `{t_module_action}` 的层级式命名：

```
namespace.section.label

# 示例
dashboard.overview.title           # 仪表盘 > 概览 > 标题
strategy.create.modal.confirm      # 策略 > 创建 > 弹窗 > 确认
trade.order.submit                 # 交易 > 订单 > 提交
settings.risk.maxDailyLoss         # 设置 > 风控 > 最大日亏损
common.button.save                 # 通用 > 按钮 > 保存
```

**规则**:
- 使用小写字母 + 点分隔
- 语义化路径，反映 UI 层级
- 不嵌套超过 4 层深度
- 不在 key 中嵌入显示文本 (反例: `"保存按钮"`)
- zh-CN.json 为权威 key 模板，所有语言必须与其 key 结构完全一致

### 2.2 变量占位符

使用双大括号语法 `{{variableName}}`：

```json
// ✅ 正确: 使用占位符
{
  "trade.profit": "盈利: {{currency}} {{amount}}",
  "strategy.runCount": "已运行 {{count}} 次",
  "portfolio.allocation": "{{asset}} 占比 {{percent}}%"
}
```

```tsx
// 在组件中使用
const { t } = useTranslation();
t('trade.profit', { currency: 'HKD', amount: '123,456' });
// → "盈利: HKD 123,456"
```

**规则**:
- 占位符使用 camelCase 命名
- 占位符名应描述内容 (如 `count`, `amount`)，而非格式
- 相同概念使用相同的占位符名 (全项目一致)
- 不嵌套占位符 (i18next 不支持)

### 2.3 复数 (i18next Plurals)

i18next 支持 CLDR 复数规则，根据语言自动选择正确的复数形式。

```json
{
  "result.count": "{{count}} result",
  "result.count_other": "{{count}} results",

  "strategy.profit_day": "盈利 {{count}} 天",
  "strategy.profit_day_plural": "盈利 {{count}} 天",

  "order.active": "{{count}} active order",
  "order.active_plural": "{{count}} active orders"
}
```

```tsx
// 自动根据 count 值选择单复数
t('result.count', { count: 1 });   // → "1 result" (en)
t('result.count', { count: 5 });   // → "5 results" (en)
t('result.count', { count: 0 });   // → "0 results" (en, uses _plural)
```

**i18next 后缀规则**:

| 语言 | 规则 | 后缀 |
|------|------|------|
| en (英语) | 1 → singular, other → plural | `_one`, `_other` |
| zh (中文) | 无单复数变化 | `_other` |
| ja (日语) | 无单复数变化 | `_other` |
| ru (俄语) | 1→one, 2-4→few, 5+→many | `_one`, `_few`, `_many`, `_other` |
| ar (阿拉伯语) | 1→one, 2→two, 3-10→few, 11+→many | `_zero`, `_one`, `_two`, `_few`, `_many`, `_other` |

**zh-CN 简单处理**: 中文无单复数变化，使用 `_other` 即可。

```json
// zh-CN.json
{
  "result.count": "{{count}} 个结果",
  "result.count_other": "{{count}} 个结果"
}
```

### 2.4 特殊注意事项

**上下文翻译**: 同一个英文词在不同语境中可能翻译不同

```json
// en.json
{
  "order.create": "Create Order",     // 动词: 创建订单
  "order.status": "Order Status",     // 名词: 订单状态
  "trade.long": "Long",               // 做多
  "common.long": "Long"               // 长度(避免, 拆分 key)
}
```

**日期/时间/数字**: 不要翻译格式，使用 `Intl` API 自动适配

```json
// ✅ 正确: key 不含数字格式
{ "trade.date": "交易日期" }

// ❌ 错误: 在 key 中预设格式
{ "trade.dateFormat": "YYYY年MM月DD日" }
```

**货币符号**: 通过参数传入，不写死在翻译中

```json
// ✅ 正确
{ "portfolio.balance": "余额: {{currency}}{{amount}}" }

// ❌ 错误
{ "portfolio.balance": "余额: ${{amount}}" }
```

### 2.5 已支持语言的翻译参考

| 语言 | 参考资源 |
|------|---------|
| zh-CN | 简体中文母语者 (主翻译) |
| zh-HK/zh-TW | 繁体中文母语者 |
| en | English native speaker |
| ja | 日本語ネイティブ |
| ko | 한국어 네이티브 |
| fr/de/es/ru | 使用 DeepSeek AI 辅助翻译 + 母语审查 |

---

## 三、 格式化 API 参考

quant-moo 提供完整的格式化工具，基于 `Intl` API。

### 3.1 数字格式化 (utils/formatNumber.ts)

```typescript
import { formatNumber, formatPercent, formatVolume, formatCompact } from '@/utils/formatNumber';

// formatNumber — 千分位 + 小数位 (locale 自适应)
formatNumber(1234567.89, 'en');    // → "1,234,567.89"
formatNumber(1234567.89, 'de');    // → "1.234.567,89"
formatNumber(1234567.89, 'ja');    // → "1,234,567.89"

// formatPercent — 带符号的百分比
formatPercent(0.0532, 'zh-CN', 2); // → "+5.32%"
formatPercent(-0.021, 'en', 1);    // → "-2.1%"

// formatVolume — 智能单位缩写
formatVolume(123, 'en');           // → "123"
formatVolume(1234, 'en');          // → "1.2K"
formatVolume(12345678, 'en');      // → "12.3M"
formatVolume(1234, 'zh-CN');       // → "1,234"
formatVolume(12345678, 'zh-CN');   // → "1,234.6万"

// formatCompact — Intl compact display (万/亿/K/M/B 等)
formatCompact(1234567, 'zh-CN');   // → "123.5万"
formatCompact(1234567, 'en');      // → "1.2M"
```

### 3.2 货币格式化 (utils/formatTime.ts + engine)

```typescript
import { formatCurrency } from '@/utils/formatTime'; // or use engine

// 5 种货币: HKD / USD / CNY / JPY / USDT
formatCurrency(1234567.89, 'HKD', 'zh-CN');  // → "HK$1,234,567.89"
formatCurrency(1234567.89, 'USD', 'en');     // → "$1,234,567.89"
formatCurrency(1234567, 'JPY', 'ja');        // → "¥1,234,567" (JPY 无小数)
formatCurrency(123.456, 'USDT', 'zh-CN');    // → "123.46 USDT" (固定格式)
```

**精度规则**:

| 货币 | 小数位 | 示例 |
|------|--------|------|
| USD | 2 | $1,234.56 |
| CNY | 2 | ¥1,234.56 |
| HKD | 2 | HK$1,234.56 |
| JPY | 0 | ¥1,234 |
| USDT | 2 | 1,234.56 USDT |
| Crypto (BTC/ETH) | 8 | 0.00012345 BTC |

### 3.3 时间格式化 (utils/formatTime.ts)

```typescript
import { formatTime, formatDateShort, formatDateLong, formatDateTime, timeAgo } from '@/utils/formatTime';

const ts = 1718208000000; // UTC ms

// formatDateShort — 短日期
formatDateShort(ts, 'en');         // → "6/12/2026"
formatDateShort(ts, 'ja');         // → "2026/06/12"

// formatDateLong — 长日期
formatDateLong(ts, 'en');          // → "June 12, 2026"
formatDateLong(ts, 'zh-CN');       // → "2026年6月12日"

// formatDateTime — 日期+时间
formatDateTime(ts, 'en', 'America/New_York');  // → "6/12/2026, 03:30:00 AM"

// timeAgo — 智能相对时间
timeAgo(Date.now() - 30000, 'en');       // → "30 seconds ago"
timeAgo(Date.now() - 30000, 'zh-CN');    // → "30 秒前"
timeAgo(Date.now() - 7200000, 'ja');      // → "2 時間前"
```

---

## 四、 审查 Checklist

PR 合并前，审查者必须确认以下所有项：

### 翻译质量

- [ ] 所有 value 已完整翻译 (无空白 / 无 "TODO" / 无 "TBD")
- [ ] 翻译准确，无机器翻译痕迹 (或已标注 AI 辅助)
- [ ] 专业术语一致 (如 "Strategy Lab" → 固定译法)
- [ ] 上下文恰当地处理了同词多译
- [ ] 数字格式符合目标语言习惯 (千分位: `,` vs `.` vs ` `)

### 技术合规

- [ ] JSON key 结构与 `zh-CN.json` 完全一致 (无多余 key, 无缺失 key)
- [ ] `{{placeholder}}` 占位符与 zh-CN 完全一致
- [ ] 复数后缀正确 (`_one`, `_other` 等，视目标语言)
- [ ] 文件编码为 UTF-8 (无 BOM)
- [ ] 无硬编码中文字符 (翻译 value 中不应包含 CJK 字符串)

### 代码集成

- [ ] `src/locales/index.ts` 已注册新语言 resources
- [ ] Language Selector UI 已添加新语言选项 (code + native label + flag)
- [ ] `npx tsc --noEmit`: 0 errors
- [ ] `npm run build`: 0 errors
- [ ] `node scripts/i18n-audit.js`: 0 missing keys

### UI 视觉验证

- [ ] 所有页面切换语言后渲染正常
- [ ] 无文字溢出/截断 (特别是德语/俄语等较长文本)
- [ ] RTL 语言 (如将来支持 ar/he) 布局镜像正常
- [ ] 数字/货币/时间格式在切换后正确更新

---

## 五、 Locale 文件 PR 模板

新建 `.github/PULL_REQUEST_TEMPLATE/locale.md` 或直接使用以下模板：

```markdown
---
name: 🌐 Locale Addition
about: 新增语言翻译 / 更新翻译
title: '🌐 i18n: <语言名称> — <简述>'
labels: ['i18n', 'localization']
assignees: ''
---

## 语言信息

- **语言代码 (BCP 47)**: `xx-XX`
- **语言名称 (本地)**: <语言本地名称>
- **语言名称 (中文)**: <语言中文名称>
- **Flag**: <emoji>
- **母语审查者**: @username (或 "AI 辅助")

## 更改内容

- [ ] 新增 `src/locales/xx-XX.json` (xxx keys)
- [ ] 更新 `src/locales/index.ts` (注册)
- [ ] 更新语言选择器组件
- [ ] 验证通过: audit + scan + tsc + build

## 翻译质量

- [ ] 所有 xxx 个 key 已完整翻译
- [ ] 专业术语一致 (参考术语表)
- [ ] 无硬编码 CJK 残留
- [ ] 无空白 value

## 验证

| 检查项 | 状态 |
|--------|------|
| `node scripts/i18n-audit.js` | ✅ / ❌ |
| `npx tsc --noEmit` | ✅ / ❌ |
| `npm run build` | ✅ / ❌ |
| UI 渲染检查 | ✅ / ❌ |
| 语言选择器显示 | ✅ / ❌ |

## 截图

| 语言 | 首页截图 | 交易页截图 |
|------|---------|-----------|
| Before (en) | 📸 | 📸 |
| After (新语言) | 📸 | 📸 |

## 附加说明

<额外上下文或翻译决策说明>
```

---

## 六、 常见问题

### Q: 如何更新已有翻译？

修改对应 `src/locales/xx-XX.json` 文件 → `npx tsc --noEmit` → 提交 PR。

### Q: zh-CN.json 新增了 key，如何同步到其他语言？

```bash
# 1. 使用 audit 脚本找出缺失的 key
node scripts/i18n-audit.js

# 2. 在每种语言的 JSON 中补全新 key
# 3. 翻译新 key
# 4. 再次运行 audit 确认 0 missing
```

### Q: 如何检测未翻译的硬编码字符串？

```bash
node scripts/i18n-scan.js
# 输出所有 src/ 中发现的 CJK 字符位置
# 确认这些 CJK 是否应在翻译 JSON 中而非代码中
```

### Q: 语言选择器不生效？

1. 确认 `src/locales/index.ts` 中 `resources` 已包含该语言
2. 确认 LanguageSelector 中 `code` 与 `resources` key 完全一致
3. 检查 localStorage 中的 `dw_language` 值
4. 清除浏览器缓存后重试

### Q: 如何处理从右到左 (RTL) 语言？

RTL 支持尚未完整实现。计划在 R101 中完成 (es/ru/RTL → Landing Page 终版)。预期方案:

```tsx
const { i18n } = useTranslation();
const isRTL = ['ar', 'he', 'fa'].includes(i18n.language);
document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
```

---

## 七、 参考

| 资源 | 链接 |
|------|------|
| i18next 官方文档 | https://www.i18next.com/ |
| i18next 复数规则 | https://www.i18next.com/translation-function/plurals |
| BCP 47 语言标签 | https://tools.ietf.org/html/bcp47 |
| CLDR 复数规则 | https://cldr.unicode.org/index/cldr-spec/plural-rules |
| [i18n 开发者指南](./i18n-developer-guide.md) | 完整的格式化 API + 时区规范 |
| [贡献指南](../CONTRIBUTING.md) | 通用 PR 规范 + Commit 规范 |
| [部署指南](./deploy/deployment-guide.md) | 环境变量 + 构建流程 |

---

*本文档基于真实项目结构编写: src/locales/index.ts (10 locale JSON), src/lib/i18n.ts (Zustand store), .github/PULL_REQUEST_TEMPLATE.md (通用PR模板)*
