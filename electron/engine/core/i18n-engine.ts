import i18n from '../../../src/i18n';
/**
 * J-68-04 [P1] i18n 引擎完善 — 英/日/韩 翻译 + 日期/货币格式化
 *
 * PM specs:
 * - 新增: 英文/日文/韩文 翻译key补齐
 * - 引擎/策略/信号错误信息多语言
 * - 日期/货币格式化 (zh-CN/zh-TW/en/ja/ko)
 * - >=200L, 5 tests
 */

export type Locale = "zh-CN" | "zh-TW" | "en" | "ja" | "ko";

// ── Translation Catalog ──────────────────────────────────────────────────

export interface TranslationCatalog {
  locale: Locale;
  label: string;
  translations: Record<string, string>;
}

export const TRANSLATIONS: TranslationCatalog[] = [
  {
    locale: "zh-CN",
    label: i18n.t('i18nEngine.k1'),
    translations: {
      // Engine errors
      "error.broker.notConnected": i18n.t('i18nEngine.k2'),
      "error.broker.insufficientFunds": i18n.t('i18nEngine.k3'),
      "error.broker.positionLimit": i18n.t('i18nEngine.k4'),
      "error.broker.dailyLossLimit": i18n.t('i18nEngine.k5'),
      "error.broker.circuitBreaker": i18n.t('i18nEngine.k6'),
      "error.broker.coolDown": i18n.t('i18nEngine.k7'),

      // Strategy errors
      "error.strategy.invalidParams": i18n.t('i18nEngine.k8'),
      "error.strategy.noSignal": i18n.t('i18nEngine.k9'),
      "error.strategy.backtestFailed": i18n.t('i18nEngine.k10'),
      "error.strategy.notPublished": i18n.t('i18nEngine.k11'),

      // Signal errors
      "error.signal.expired": i18n.t('i18nEngine.k12'),
      "error.signal.confidenceLow": i18n.t('i18nEngine.k13'),
      "error.signal.marketClosed": i18n.t('i18nEngine.k14'),

      // Order errors
      "error.order.invalidQty": i18n.t('i18nEngine.k15'),
      "error.order.invalidPrice": i18n.t('i18nEngine.k16'),
      "error.order.partiallyFilled": i18n.t('i18nEngine.k17'),
      "error.order.rejected": i18n.t('i18nEngine.k18'),

      // UI labels
      "label.buy": i18n.t('i18nEngine.k19'),
      "label.sell": i18n.t('i18nEngine.k20'),
      "label.cancel": i18n.t('i18nEngine.k21'),
      "label.confirm": i18n.t('i18nEngine.k22'),
      "label.back": i18n.t('i18nEngine.k23'),
      "label.save": i18n.t('i18nEngine.k24'),
      "label.delete": i18n.t('i18nEngine.k25'),
      "label.search": i18n.t('i18nEngine.k26'),
      "label.filter": i18n.t('i18nEngine.k27'),
      "label.reset": i18n.t('i18nEngine.k28'),
      "label.loading": i18n.t('i18nEngine.k29'),
      "label.noData": i18n.t('i18nEngine.k30'),
      "label.error": i18n.t('i18nEngine.k31'),
      "label.success": i18n.t('i18nEngine.k32'),
      "label.warning": i18n.t('i18nEngine.k33'),
      "label.info": i18n.t('i18nEngine.k34'),

      // Trade labels
      "trade.orderPlaced": i18n.t('i18nEngine.k35'),
      "trade.orderFilled": i18n.t('i18nEngine.k36'),
      "trade.orderCancelled": i18n.t('i18nEngine.k37'),
      "trade.orderPartiallyFilled": i18n.t('i18nEngine.k38'),
      "trade.position": i18n.t('i18nEngine.k39'),
      "trade.account": i18n.t('i18nEngine.k40'),
      "trade.history": i18n.t('i18nEngine.k41'),
      "trade.pnl": i18n.t('i18nEngine.k42'),

      // Market labels
      "market.US": i18n.t('i18nEngine.k43'),
      "market.HK": i18n.t('i18nEngine.k44'),
      "market.ASH": i18n.t('i18nEngine.k45'),
      "market.ASZ": i18n.t('i18nEngine.k46'),
      "market.open": i18n.t('i18nEngine.k47'),
      "market.closed": i18n.t('i18nEngine.k48'),
      "market.preMarket": i18n.t('i18nEngine.k49'),
      "market.afterHours": i18n.t('i18nEngine.k50'),

      // Common
      "common.total": i18n.t('i18nEngine.k51'),
      "common.fee": i18n.t('i18nEngine.k52'),
      "common.rate": i18n.t('i18nEngine.k53'),
      "common.balance": i18n.t('i18nEngine.k54'),
      "common.profit": i18n.t('i18nEngine.k55'),
      "common.loss": i18n.t('i18nEngine.k56'),
    },
  },
  {
    locale: "zh-TW",
    label: i18n.t('i18nEngine.k57'),
    translations: {
      "error.broker.notConnected": i18n.t('i18nEngine.k58'),
      "error.broker.insufficientFunds": i18n.t('i18nEngine.k59'),
      "error.broker.positionLimit": i18n.t('i18nEngine.k60'),
      "error.broker.dailyLossLimit": i18n.t('i18nEngine.k61'),
      "error.broker.circuitBreaker": i18n.t('i18nEngine.k62'),
      "error.broker.coolDown": i18n.t('i18nEngine.k63'),

      "error.strategy.invalidParams": i18n.t('i18nEngine.k64'),
      "error.strategy.noSignal": i18n.t('i18nEngine.k65'),
      "error.strategy.backtestFailed": i18n.t('i18nEngine.k66'),
      "error.strategy.notPublished": i18n.t('i18nEngine.k67'),

      "error.signal.expired": i18n.t('i18nEngine.k68'),
      "error.signal.confidenceLow": i18n.t('i18nEngine.k69'),
      "error.signal.marketClosed": i18n.t('i18nEngine.k70'),

      "error.order.invalidQty": i18n.t('i18nEngine.k71'),
      "error.order.invalidPrice": i18n.t('i18nEngine.k72'),
      "error.order.partiallyFilled": i18n.t('i18nEngine.k73'),
      "error.order.rejected": i18n.t('i18nEngine.k74'),

      "label.buy": i18n.t('i18nEngine.k75'),
      "label.sell": i18n.t('i18nEngine.k76'),
      "label.cancel": i18n.t('i18nEngine.k77'),
      "label.confirm": i18n.t('i18nEngine.k78'),
      "label.back": i18n.t('i18nEngine.k79'),
      "label.save": i18n.t('i18nEngine.k80'),
      "label.delete": i18n.t('i18nEngine.k81'),
      "label.search": i18n.t('i18nEngine.k82'),
      "label.filter": i18n.t('i18nEngine.k83'),
      "label.reset": i18n.t('i18nEngine.k84'),
      "label.loading": i18n.t('i18nEngine.k85'),
      "label.noData": i18n.t('i18nEngine.k86'),
      "label.error": i18n.t('i18nEngine.k87'),
      "label.success": i18n.t('i18nEngine.k88'),
      "label.warning": i18n.t('i18nEngine.k89'),
      "label.info": i18n.t('i18nEngine.k90'),

      "trade.orderPlaced": i18n.t('i18nEngine.k91'),
      "trade.orderFilled": i18n.t('i18nEngine.k92'),
      "trade.orderCancelled": i18n.t('i18nEngine.k93'),
      "trade.orderPartiallyFilled": i18n.t('i18nEngine.k94'),
      "trade.position": i18n.t('i18nEngine.k95'),
      "trade.account": i18n.t('i18nEngine.k96'),
      "trade.history": i18n.t('i18nEngine.k97'),
      "trade.pnl": i18n.t('i18nEngine.k98'),

      "market.US": i18n.t('i18nEngine.k99'),
      "market.HK": i18n.t('i18nEngine.k100'),
      "market.ASH": i18n.t('i18nEngine.k101'),
      "market.ASZ": i18n.t('i18nEngine.k102'),
      "market.open": i18n.t('i18nEngine.k103'),
      "market.closed": i18n.t('i18nEngine.k104'),
      "market.preMarket": i18n.t('i18nEngine.k105'),
      "market.afterHours": i18n.t('i18nEngine.k106'),

      "common.total": i18n.t('i18nEngine.k107'),
      "common.fee": i18n.t('i18nEngine.k108'),
      "common.rate": i18n.t('i18nEngine.k109'),
      "common.balance": i18n.t('i18nEngine.k110'),
      "common.profit": i18n.t('i18nEngine.k111'),
      "common.loss": i18n.t('i18nEngine.k112'),
    },
  },
  {
    locale: "en",
    label: "English",
    translations: {
      "error.broker.notConnected": "Broker not connected",
      "error.broker.insufficientFunds": "Insufficient funds",
      "error.broker.positionLimit": "Position limit exceeded",
      "error.broker.dailyLossLimit": "Daily loss limit reached",
      "error.broker.circuitBreaker": "Circuit breaker triggered",
      "error.broker.coolDown": "Trading too frequent, cooling down",

      "error.strategy.invalidParams": "Invalid strategy parameters",
      "error.strategy.noSignal": "No trading signal",
      "error.strategy.backtestFailed": "Backtest failed",
      "error.strategy.notPublished": "Strategy not published",

      "error.signal.expired": "Signal expired",
      "error.signal.confidenceLow": "Signal confidence too low",
      "error.signal.marketClosed": "Market is closed",

      "error.order.invalidQty": "Invalid order quantity",
      "error.order.invalidPrice": "Invalid order price",
      "error.order.partiallyFilled": "Partially filled",
      "error.order.rejected": "Order rejected",

      "label.buy": "Buy",
      "label.sell": "Sell",
      "label.cancel": "Cancel",
      "label.confirm": "Confirm",
      "label.back": "Back",
      "label.save": "Save",
      "label.delete": "Delete",
      "label.search": "Search",
      "label.filter": "Filter",
      "label.reset": "Reset",
      "label.loading": "Loading...",
      "label.noData": "No data",
      "label.error": "Error",
      "label.success": "Success",
      "label.warning": "Warning",
      "label.info": "Info",

      "trade.orderPlaced": "Order placed",
      "trade.orderFilled": "Order filled",
      "trade.orderCancelled": "Order cancelled",
      "trade.orderPartiallyFilled": "Order partially filled",
      "trade.position": "Position",
      "trade.account": "Account",
      "trade.history": "History",
      "trade.pnl": "P&L",

      "market.US": "US Market",
      "market.HK": "HK Market",
      "market.ASH": "Shanghai Market",
      "market.ASZ": "Shenzhen Market",
      "market.open": "Market Open",
      "market.closed": "Market Closed",
      "market.preMarket": "Pre-market",
      "market.afterHours": "After Hours",

      "common.total": "Total",
      "common.fee": "Fee",
      "common.rate": "Rate",
      "common.balance": "Balance",
      "common.profit": "Profit",
      "common.loss": "Loss",
    },
  },
  {
    locale: "ja",
    label: i18n.t('i18nEngine.k113'),
    translations: {
      "error.broker.notConnected": i18n.t('i18nEngine.k114'),
      "error.broker.insufficientFunds": i18n.t('i18nEngine.k115'),
      "error.broker.positionLimit": i18n.t('i18nEngine.k116'),
      "error.broker.dailyLossLimit": i18n.t('i18nEngine.k117'),
      "error.broker.circuitBreaker": i18n.t('i18nEngine.k118'),
      "error.broker.coolDown": i18n.t('i18nEngine.k119'),

      "error.strategy.invalidParams": i18n.t('i18nEngine.k120'),
      "error.strategy.noSignal": i18n.t('i18nEngine.k121'),
      "error.strategy.backtestFailed": i18n.t('i18nEngine.k122'),
      "error.strategy.notPublished": i18n.t('i18nEngine.k123'),

      "error.signal.expired": i18n.t('i18nEngine.k124'),
      "error.signal.confidenceLow": i18n.t('i18nEngine.k125'),
      "error.signal.marketClosed": i18n.t('i18nEngine.k126'),

      "error.order.invalidQty": i18n.t('i18nEngine.k127'),
      "error.order.invalidPrice": i18n.t('i18nEngine.k128'),
      "error.order.partiallyFilled": i18n.t('i18nEngine.k129'),
      "error.order.rejected": i18n.t('i18nEngine.k130'),

      "label.buy": i18n.t('i18nEngine.k131'),
      "label.sell": i18n.t('i18nEngine.k132'),
      "label.cancel": "キャンセル",
      "label.confirm": i18n.t('i18nEngine.k133'),
      "label.back": i18n.t('i18nEngine.k134'),
      "label.save": i18n.t('i18nEngine.k135'),
      "label.delete": i18n.t('i18nEngine.k136'),
      "label.search": i18n.t('i18nEngine.k137'),
      "label.filter": "フィルター",
      "label.reset": "リセット",
      "label.loading": i18n.t('i18nEngine.k138'),
      "label.noData": "データなし",
      "label.error": "エラー",
      "label.success": i18n.t('i18nEngine.k139'),
      "label.warning": i18n.t('i18nEngine.k140'),
      "label.info": i18n.t('i18nEngine.k141'),

      "trade.orderPlaced": i18n.t('i18nEngine.k142'),
      "trade.orderFilled": i18n.t('i18nEngine.k143'),
      "trade.orderCancelled": i18n.t('i18nEngine.k144'),
      "trade.orderPartiallyFilled": i18n.t('i18nEngine.k145'),
      "trade.position": i18n.t('i18nEngine.k146'),
      "trade.account": i18n.t('i18nEngine.k147'),
      "trade.history": i18n.t('i18nEngine.k148'),
      "trade.pnl": i18n.t('i18nEngine.k149'),

      "market.US": i18n.t('i18nEngine.k150'),
      "market.HK": i18n.t('i18nEngine.k151'),
      "market.ASH": i18n.t('i18nEngine.k152'),
      "market.ASZ": i18n.t('i18nEngine.k153'),
      "market.open": i18n.t('i18nEngine.k154'),
      "market.closed": i18n.t('i18nEngine.k155'),
      "market.preMarket": "プレマーケット",
      "market.afterHours": i18n.t('i18nEngine.k156'),

      "common.total": i18n.t('i18nEngine.k157'),
      "common.fee": i18n.t('i18nEngine.k158'),
      "common.rate": "レート",
      "common.balance": i18n.t('i18nEngine.k159'),
      "common.profit": i18n.t('i18nEngine.k160'),
      "common.loss": i18n.t('i18nEngine.k161'),
    },
  },
  {
    locale: "ko",
    label: "한국어",
    translations: {
      "error.broker.notConnected": "브로커 연결 안됨",
      "error.broker.insufficientFunds": "가용 자금 부족",
      "error.broker.positionLimit": "포지션 한도 초과",
      "error.broker.dailyLossLimit": "일일 손실 한도 도달",
      "error.broker.circuitBreaker": "서킷 브레이커 발동",
      "error.broker.coolDown": "거래 빈도 과다, 쿨다운 중",

      "error.strategy.invalidParams": "잘못된 전략 매개변수",
      "error.strategy.noSignal": "거래 신호 없음",
      "error.strategy.backtestFailed": "백테스트 실패",
      "error.strategy.notPublished": "미발행 전략",

      "error.signal.expired": "신호 만료됨",
      "error.signal.confidenceLow": "신호 신뢰도 부족",
      "error.signal.marketClosed": "시장 마감",

      "error.order.invalidQty": "잘못된 주문 수량",
      "error.order.invalidPrice": "잘못된 주문 가격",
      "error.order.partiallyFilled": "부분 체결",
      "error.order.rejected": "주문 거부됨",

      "label.buy": "매수",
      "label.sell": "매도",
      "label.cancel": "취소",
      "label.confirm": "확인",
      "label.back": "뒤로",
      "label.save": "저장",
      "label.delete": "삭제",
      "label.search": "검색",
      "label.filter": "필터",
      "label.reset": "초기화",
      "label.loading": "로딩 중...",
      "label.noData": "데이터 없음",
      "label.error": "오류",
      "label.success": "성공",
      "label.warning": "경고",
      "label.info": "정보",

      "trade.orderPlaced": "주문 제출됨",
      "trade.orderFilled": "체결됨",
      "trade.orderCancelled": "주문 취소됨",
      "trade.orderPartiallyFilled": "부분 체결됨",
      "trade.position": "포지션",
      "trade.account": "계좌",
      "trade.history": "내역",
      "trade.pnl": "손익",

      "market.US": "미국 시장",
      "market.HK": "홍콩 시장",
      "market.ASH": "상하이 시장",
      "market.ASZ": "선전 시장",
      "market.open": "장중",
      "market.closed": "마감",
      "market.preMarket": "프리마켓",
      "market.afterHours": "시간외",

      "common.total": "합계",
      "common.fee": "수수료",
      "common.rate": "비율",
      "common.balance": "잔액",
      "common.profit": "수익",
      "common.loss": "손실",
    },
  },
];

// ── i18n Engine ───────────────────────────────────────────────────────────

export class I18nEngine {
  private catalog: Map<Locale, Record<string, string>> = new Map();
  private fallbackLocale: Locale = "en";

  constructor() {
    for (const cat of TRANSLATIONS) {
      this.catalog.set(cat.locale, cat.translations);
    }
  }

  /**
   * Translate a key to the specified locale, with fallback.
   */
  translate(key: string, locale: Locale = "en"): string {
    const map = this.catalog.get(locale);
    if (map && map[key]) {
      return map[key];
    }

    // Fallback to en
    const enMap = this.catalog.get("en");
    if (enMap && enMap[key]) {
      return enMap[key];
    }

    // Last resort: return key itself
    return key;
  }

  /**
   * Batch translate multiple keys.
   */
  translateAll(keys: string[], locale: Locale = "en"): Record<string, string> {
    const result: Record<string, string> = {};
    for (const key of keys) {
      result[key] = this.translate(key, locale);
    }
    return result;
  }

  /**
   * Get all available locales.
   */
  getLocales(): { code: Locale; label: string }[] {
    return TRANSLATIONS.map((c) => ({
      code: c.locale,
      label: c.label,
    }));
  }

  /**
   * Check if a locale is supported.
   */
  supportsLocale(locale: string): boolean {
    return this.catalog.has(locale as Locale);
  }

  /**
   * Get a map of all keys → a given locale.
   */
  getAllKeys(locale: Locale): Record<string, string> {
    const map = this.catalog.get(locale);
    return map ? { ...map } : {};
  }
}

// ── Date Formatting ──────────────────────────────────────────────────────

export function formatDate(
  date: Date | number,
  locale: Locale,
  style: "full" | "long" | "medium" | "short" = "medium",
): string {
  const localeMap: Record<Locale, string> = {
    "zh-CN": "zh-CN",
    "zh-TW": "zh-TW",
    en: "en-US",
    ja: "ja-JP",
    ko: "ko-KR",
  };

  const d = typeof date === "number" ? new Date(date) : date;

  try {
    return d.toLocaleDateString(localeMap[locale] ?? "en-US", {
      dateStyle: style,
    });
  } catch {
    return d.toISOString().split("T")[0]!;
  }
}

export function formatDateTime(
  date: Date | number,
  locale: Locale,
): string {
  const localeMap: Record<Locale, string> = {
    "zh-CN": "zh-CN",
    "zh-TW": "zh-TW",
    en: "en-US",
    ja: "ja-JP",
    ko: "ko-KR",
  };

  const d = typeof date === "number" ? new Date(date) : date;

  try {
    return d.toLocaleString(localeMap[locale] ?? "en-US");
  } catch {
    return d.toISOString();
  }
}

export function formatTime(
  date: Date | number,
  locale: Locale,
): string {
  const localeMap: Record<Locale, string> = {
    "zh-CN": "zh-CN",
    "zh-TW": "zh-TW",
    en: "en-US",
    ja: "ja-JP",
    ko: "ko-KR",
  };

  const d = typeof date === "number" ? new Date(date) : date;

  try {
    return d.toLocaleTimeString(localeMap[locale] ?? "en-US", {
      timeStyle: "medium",
    });
  } catch {
    return d.toTimeString().split(" ")[0]!;
  }
}

// ── Currency Formatting ──────────────────────────────────────────────────

export interface CurrencyFormatOptions {
  locale: Locale;
  currency: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

export function formatCurrency(
  amount: number,
  options: CurrencyFormatOptions,
): string {
  const localeMap: Record<Locale, string> = {
    "zh-CN": "zh-CN",
    "zh-TW": "zh-TW",
    en: "en-US",
    ja: "ja-JP",
    ko: "ko-KR",
  };

  // USDT is a custom token, not an ISO currency
  // Use USD formatting rules for display
  const displayCurrency = options.currency === "USDT" ? "USD" : options.currency;

  try {
    return new Intl.NumberFormat(localeMap[options.locale] ?? "en-US", {
      style: "currency",
      currency: displayCurrency,
      minimumFractionDigits: options.minimumFractionDigits ?? 2,
      maximumFractionDigits: options.maximumFractionDigits ?? 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${options.currency}`;
  }
}

export function formatNumber(
  amount: number,
  locale: Locale,
  minimumFractionDigits = 0,
  maximumFractionDigits = 2,
): string {
  const localeMap: Record<Locale, string> = {
    "zh-CN": "zh-CN",
    "zh-TW": "zh-TW",
    en: "en-US",
    ja: "ja-JP",
    ko: "ko-KR",
  };

  try {
    return new Intl.NumberFormat(localeMap[locale] ?? "en-US", {
      minimumFractionDigits,
      maximumFractionDigits,
    }).format(amount);
  } catch {
    return amount.toString();
  }
}
