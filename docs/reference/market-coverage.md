<!-- META
version: 1.12.0
last_updated: 2026-06-12
round: R108
owner: QClaw
purpose: (auto-generated, needs review)
-->

# TradingEasy — 市场覆盖参考文档

> **版本**: v1.11.0
> **最后更新**: 2026-06-12
> **适用引擎**: MarketClock (`electron/engine/data/market-clock.ts`) + StockCodeNormalizer (`electron/engine/data/stock-code-normalizer.ts`)

---

## 一、 7 大市场总览

| 代码 | 市场 | 国家/地区 | 时区 IANA | 货币 | UTC 偏移 (标准/夏令) | 开盘 | 收盘 |
|------|------|----------|-----------|------|---------------------|------|------|
| `US` | NYSE / NASDAQ | 美国 | `America/New_York` | USD | UTC-5 / UTC-4 | 09:30 | 16:00 |
| `HK` | HKEX | 香港 | `Asia/Hong_Kong` | HKD | UTC+8 (无DST) | 09:30 | 16:00 |
| `CN` | SSE / SZSE | 中国大陆 | `Asia/Shanghai` | CNY | UTC+8 (无DST) | 09:30 | 15:00 |
| `JP` | TSE | 日本 | `Asia/Tokyo` | JPY | UTC+9 (无DST) | 09:00 | 15:00 |
| `UK` | LSE | 英国 | `Europe/London` | GBP | UTC+0 / UTC+1 | 08:00 | 16:30 |
| `EU` | XETRA / Euronext | 欧盟 | `Europe/Berlin` | EUR | UTC+1 / UTC+2 | 09:00 | 17:30 |
| `CRYPTO` | 加密货币 | 全球 | `UTC` | USDT / BTC | UTC (24×7) | 00:00 | 24:00 |

---

## 二、 交易时间详细

### 2.1 常规交易时段 + 午休

| 市场 | 开盘 (local) | 收盘 (local) | 午休开始 | 午休结束 | 午休时长 |
|------|-------------|-------------|---------|---------|---------|
| US | 09:30 | 16:00 | — | — | 无 |
| HK | 09:30 | 16:00 | 12:00 | 13:00 | 1h |
| CN | 09:30 | 15:00 | 11:30 | 13:00 | 1.5h |
| JP | 09:00 | 15:00 | 11:30 | 12:30 | 1h |
| UK | 08:00 | 16:30 | — | — | 无 |
| EU | 09:00 | 17:30 | — | — | 无 |
| CRYPTO | 全天 | 全天 | — | — | 无 |

### 2.2 盘前/盘后 (仅 US)

| 时段 | 时间 (ET) | 时长 |
|------|----------|------|
| 盘前交易 (Pre-Market) | 04:00 – 09:30 | 5h 30m |
| 盘后交易 (After-Hours) | 16:00 – 20:00 | 4h |

### 2.3 市场状态机

```
     ┌─────────────────────────────────┐
     │                                 │
     ▼                                 │
   CLOSED ──→ PRE_OPEN ──→ OPEN ──→ PRE_CLOSE ──→ CLOSED
                 ▲                       │
                 │     ┌─────────────────┘
                 │     ▼
                 │  LUNCH_BREAK ──→ OPEN (resume)
                 │
                 └── (跳过早盘时段)
```

**状态定义**:

| 状态 | 含义 | 是否可交易 |
|------|------|-----------|
| `open` | 常规交易时段 | ✅ 是 |
| `lunch_break` | 午间休市 | ❌ 否 |
| `pre_open` | 盘前交易 (仅US) | ⚠️ 有限 |
| `pre_close` | 盘后交易 (仅US) | ⚠️ 有限 |
| `closed` | 市场关闭 | ❌ 否 |

---

## 三、 DST 夏令时规则

### 3.1 US (America/New_York)

| 事件 | 日期规则 | 调整 | 偏移 |
|------|---------|------|------|
| Spring Forward | 3月第二个周日 02:00 | 02:00 → 03:00 | EST (UTC-5) → EDT (UTC-4) |
| Fall Back | 11月第一个周日 02:00 | 02:00 → 01:00 | EDT (UTC-4) → EST (UTC-5) |

**代码处理**: `TimestampUtil.isDST('America/New_York')` 通过 Intl.DateTimeFormat 检测而非硬编码偏移

### 3.2 UK (Europe/London)

| 事件 | 日期规则 | 调整 | 偏移 |
|------|---------|------|------|
| Spring Forward | 3月最后一个周日 01:00 | 01:00 → 02:00 | GMT (UTC+0) → BST (UTC+1) |
| Fall Back | 10月最后一个周日 02:00 | 02:00 → 01:00 | BST (UTC+1) → GMT (UTC+0) |

### 3.3 EU (Europe/Berlin)

| 事件 | 日期规则 | 调整 | 偏移 |
|------|---------|------|------|
| Spring Forward | 3月最后一个周日 02:00 | 02:00 → 03:00 | CET (UTC+1) → CEST (UTC+2) |
| Fall Back | 10月最后一个周日 03:00 | 03:00 → 02:00 | CEST (UTC+2) → CET (UTC+1) |

### 3.4 无 DST 的市场

HK、CN、JP 全年无夏令时，UTC 偏移恒定 (HK/CN=+8, JP=+9)。

---

## 四、 节假日日历

节假日数据由 `electron/engine/data/trading-calendar.ts` 的 `TradingCalendar` 类管理，`MarketClock` 在判断 `US`、`HK`、`CN` 市场时主动查询节假日数据。

### 4.1 主要假日

| 市场 | 固定假日 | 可变假日 |
|------|---------|---------|
| US | New Year's Day (1/1), Independence Day (7/4), Christmas (12/25) | MLK Day, Presidents' Day, Memorial Day, Labor Day, Thanksgiving |
| HK | 元旦, 春节初一二三, 清明节, 劳动节, 端午节, 中秋翌日, 国庆, 重阳, 圣诞 | 佛诞 (农历四月初八) |
| CN | 元旦, 春节, 清明, 劳动节, 端午, 中秋, 国庆 (7天) | 调休日 (周末补班) |
| JP | 元日, 成人の日, 建国記念日, 天皇誕生日, 春分/秋分, 昭和の日, 憲法記念日, みどりの日, こどもの日, 海の日, 山の日, 敬老の日, 体育の日, 文化の日, 勤労感謝の日 | 振替休日 (周日→周一) |

### 4.2 假期影响

- 节假日期间 `getStatus()` 返回 `closed`
- `getNextOpen()` 返回假期后第一个交易日
- DST 切换日不影响交易日 (周末执行)

---

## 五、 股票代码格式

### 5.1 代码标准化 (StockCodeNormalizer)

| 市场 | 格式 | 正则 | 示例 | 说明 |
|------|------|------|------|------|
| US | `{TICKER}` | `^[A-Z]{1,5}$` | `AAPL`, `TSLA`, `BRK.A` | 无市场前缀，字母代码 |
| CN/SH | `{TICKER}` | `^6\d{5}$` | `600519` (茅台) | 6xxxxx = 上海主板 |
| CN/SZ | `{TICKER}` | `^[03]\d{5}$` | `000001` (平安), `300750` (宁德) | 0xxxxx=深圳主板, 3xxxxx=创业板 |
| HK | `0{TICKER}` | `^0\d{4}$` | `00700` (腾讯) | 5位，前导0 |
| JP | `{TICKER}` | `^\d{4}$` | `7203` (丰田) | 4位数字 |
| UK | `{TICKER}.L` | `^[A-Z]+\.L$` | `HSBA.L`, `BARC.L` | `.L` 后缀 = LSE |
| EU | `{TICKER}` | — | `SAP.DE`, `BNP.PA` | 交易所后缀 (`.DE`, `.PA`) |
| KR | `{TICKER}` | `^\d{6}$` | `005930` (三星) | 6位数字 |
| CRYPTO | `CC.{SYMBOL}` | `^CC\.` | `CC.BTCUSD`, `CC.ETHUSD` | `CC.` 前缀 = 加密货币 |

### 5.2 代码识别规则 (normalize 方法)

```typescript
// 输入 → 输出
normalize('AAPL')      → { market: 'US', ticker: 'AAPL', display: 'AAPL' }
normalize('600519')    → { market: 'CN', ticker: '600519', display: '600519' }
normalize('000001')    → { market: 'CN', ticker: '000001', display: '000001' }
normalize('00700')     → { market: 'HK', ticker: '00700', display: '00700' }
normalize('7203')      → { market: 'JP', ticker: '7203', display: '7203' }
normalize('HSBA.L')    → { market: 'UK', ticker: 'HSBA.L', display: 'HSBA.L' }
normalize('005930')    → { market: 'KR', ticker: '005930', display: '005930' }
normalize('CC.BTCUSD') → { market: 'CRYPTO', ticker: 'BTCUSD', display: 'BTC' }
```

### 5.3 模糊匹配场景

| 输入 | 猜测规则 | 结果 |
|------|---------|------|
| 6 位数字，以 `6` 开头 | CN/SH | `600519` |
| 6 位数字，以 `0`/`3` 开头 | CN/SZ | `000001` |
| 5 位数字，以 `0` 开头 | HK | `00700` |
| 4 位数字 | JP | `7203` |
| 含 `.L` 后缀 | UK | `HSBA.L` |
| 1-5 个字母 | US | `AAPL` |

---

## 六、 数字精度规则

### 6.1 价格精度 (pricePrecision)

| 市场 | 小数位 | 示例 | 来源 |
|------|--------|------|------|
| US | 2 | $123.45 | `number-precision.ts` |
| CN | 2 | ¥12.34 | `number-precision.ts` |
| HK | 2 | HK$456.78 | `number-precision.ts` |
| JP | 0 | ¥1,234 | `number-precision.ts` (日元无小数) |
| UK | 2 | £123.45 | `number-precision.ts` |
| EU | 2 | €123.45 | `number-precision.ts` |
| Crypto | 8 | 0.00012345 BTC | `number-precision.ts` |

### 6.2 货币精度 (formatMoney)

| 货币 | 小数位 | 千分位 | 符号位置 | 示例 |
|------|--------|--------|---------|------|
| USD | 2 | `,` | prefix `$` | $1,234.56 |
| CNY | 2 | `,` | prefix `¥` | ¥1,234.56 |
| HKD | 2 | `,` | prefix `HK$` | HK$1,234.56 |
| JPY | 0 | `,` | prefix `¥` | ¥1,234 |
| EUR | 2 | `.`(de) / `,`(fr) | suffix (fr) | 1.234,56 € |
| GBP | 2 | `,` | prefix `£` | £1,234.56 |
| USDT | 2 | `,` | suffix `USDT` | 1,234.56 USDT |

---

## 七、 汇率参考

### 7.1 静态汇率 (Fallback)

由 `currency-converter.ts` 维护，以 USD 为基准：

| 货币对 | 汇率 (1 USD →) | 更新频率 |
|--------|----------------|---------|
| USD/CNY | 7.24 | 静态 fallback |
| USD/HKD | 7.82 | 静态 fallback |
| USD/JPY | 155.6 | 静态 fallback |
| USD/EUR | 0.92 | 静态 fallback |
| USD/KRW | 1,380.0 | 静态 fallback |
| USD/GBP | 0.79 | 静态 fallback |

### 7.2 实时汇率

`CurrencyConverter.fetchRates()` 从外部 API 获取实时汇率，5 分钟 TTL 内存缓存。缓存过期自动刷新，网络失败回退到静态汇率。

---

## 八、 API 速查

### 8.1 MarketClock (electron/engine/data/market-clock.ts)

```typescript
import { MarketClock } from '@/engine/data/market-clock';

const clock = new MarketClock();

// 获取市场状态
const status = clock.getStatus('HK');
// → { market: 'HK', status: 'open', nextClose: Date, timezone: 'Asia/Hong_Kong' }

// 检查当前是否可交易
if (clock.isTradingHour('US')) { /* place order */ }

// 获取下次开盘时间
const next = clock.getNextOpen('CN');
// → { date: 2026-06-15T01:30:00.000Z, session: 'regular', market: 'CN' }

// 获取所有市场状态
const all = clock.getAllStatuses();
// → { US: {status:'closed',...}, HK: {status:'open',...}, ... }

// 获取当前活跃市场
const open = clock.getOpenMarkets();
// → ['HK', 'CN', 'JP']
```

### 8.2 TimestampUtil (electron/engine/data/timestamp-util.ts)

```typescript
import { TimestampUtil } from '@/engine/data/timestamp-util';

TimestampUtil.toUTC(Date.now(), 'Asia/Shanghai');     // → UTC ms
TimestampUtil.fromUTC(utcMs, 'America/New_York');      // → local ms
TimestampUtil.isDST('America/New_York');               // → boolean
TimestampUtil.getOffsetMinutes('Asia/Shanghai');       // → 480
TimestampUtil.now();                                   // → UTC ms
```

### 8.3 CurrencyConverter (electron/engine/data/currency-converter.ts)

```typescript
import { CurrencyConverter } from '@/engine/data/currency-converter';

const cc = new CurrencyConverter();
await cc.fetchRates();                                 // refresh cache
cc.convert(1000, 'USD', 'HKD');                       // → 7820.00
cc.getRate('USD', 'JPY');                             // → 155.6
```

### 8.4 StockCodeNormalizer (electron/engine/data/stock-code-normalizer.ts)

```typescript
import { StockCodeNormalizer } from '@/engine/data/stock-code-normalizer';

const scn = new StockCodeNormalizer();
scn.normalize('00700');
// → { market: 'HK', ticker: '00700', display: '00700', exchange: 'HKEX' }

scn.formatDisplay('600519', 'zh-CN');
// → "600519 (上海)"
```

---

## 九、 参考

| 资源 | 路径 |
|------|------|
| MarketClock 源码 | `electron/engine/data/market-clock.ts` |
| TimestampUtil 源码 | `electron/engine/data/timestamp-util.ts` |
| CurrencyConverter 源码 | `electron/engine/data/currency-converter.ts` |
| NumberPrecision 源码 | `electron/engine/data/number-precision.ts` |
| StockCodeNormalizer 源码 | `electron/engine/data/stock-code-normalizer.ts` |
| TradingCalendar 源码 | `electron/engine/data/trading-calendar.ts` |
| [i18n 开发者指南](../i18n-developer-guide.md) | 完整的格式化 API + 时区规范 |
| [LOCALIZATION.md](../LOCALIZATION.md) | 本地化贡献指南 |
| [部署指南](../deploy/deployment-guide.md) | 安装 + CI/CD |
| [测试架构文档](../testing/test-architecture.md) | 测试层级 + vitest/playwright |
| [项目架构文档](../architecture.md) | 整体架构 + 模块关系 |

---

*本文档基于真实项目引擎源码: market-clock.ts (317L, R98 J-02), timestamp-util.ts (163L, R98 J-01), currency-converter.ts (248L, R99 J-01), number-precision.ts (290L, R99 J-02), trading-calendar.ts, stock-code-normalizer.ts (R100 J-01)*
