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
    label: "简体中文",
    translations: {
      // Engine errors
      "error.broker.notConnected": "券商未连接",
      "error.broker.insufficientFunds": "可用资金不足",
      "error.broker.positionLimit": "超过持仓限制",
      "error.broker.dailyLossLimit": "达到每日亏损上限",
      "error.broker.circuitBreaker": "熔断机制已触发",
      "error.broker.coolDown": "交易频率过快，冷却中",

      // Strategy errors
      "error.strategy.invalidParams": "策略参数无效",
      "error.strategy.noSignal": "无交易信号",
      "error.strategy.backtestFailed": "回测失败",
      "error.strategy.notPublished": "策略未发布",

      // Signal errors
      "error.signal.expired": "信号已过期",
      "error.signal.confidenceLow": "信号置信度过低",
      "error.signal.marketClosed": "市场已休市",

      // Order errors
      "error.order.invalidQty": "委托数量无效",
      "error.order.invalidPrice": "委托价格无效",
      "error.order.partiallyFilled": "部分成交",
      "error.order.rejected": "委托被拒绝",

      // UI labels
      "label.buy": "买入",
      "label.sell": "卖出",
      "label.cancel": "取消",
      "label.confirm": "确认",
      "label.back": "返回",
      "label.save": "保存",
      "label.delete": "删除",
      "label.search": "搜索",
      "label.filter": "筛选",
      "label.reset": "重置",
      "label.loading": "加载中...",
      "label.noData": "暂无数据",
      "label.error": "错误",
      "label.success": "成功",
      "label.warning": "警告",
      "label.info": "信息",

      // Trade labels
      "trade.orderPlaced": "委托已提交",
      "trade.orderFilled": "委托已成交",
      "trade.orderCancelled": "委托已撤销",
      "trade.orderPartiallyFilled": "委托部分成交",
      "trade.position": "持仓",
      "trade.account": "账户",
      "trade.history": "历史",
      "trade.pnl": "盈亏",

      // Market labels
      "market.US": "美股",
      "market.HK": "港股",
      "market.ASH": "沪市",
      "market.ASZ": "深市",
      "market.open": "开市",
      "market.closed": "休市",
      "market.preMarket": "盘前",
      "market.afterHours": "盘后",

      // Common
      "common.total": "总计",
      "common.fee": "手续费",
      "common.rate": "费率",
      "common.balance": "余额",
      "common.profit": "收益",
      "common.loss": "亏损",
    },
  },
  {
    locale: "zh-TW",
    label: "繁體中文",
    translations: {
      "error.broker.notConnected": "券商未連接",
      "error.broker.insufficientFunds": "可用資金不足",
      "error.broker.positionLimit": "超過持倉限制",
      "error.broker.dailyLossLimit": "達到每日虧損上限",
      "error.broker.circuitBreaker": "熔斷機制已觸發",
      "error.broker.coolDown": "交易頻率過快，冷卻中",

      "error.strategy.invalidParams": "策略參數無效",
      "error.strategy.noSignal": "無交易信號",
      "error.strategy.backtestFailed": "回測失敗",
      "error.strategy.notPublished": "策略未發佈",

      "error.signal.expired": "信號已過期",
      "error.signal.confidenceLow": "信號置信度過低",
      "error.signal.marketClosed": "市場已休市",

      "error.order.invalidQty": "委託數量無效",
      "error.order.invalidPrice": "委託價格無效",
      "error.order.partiallyFilled": "部分成交",
      "error.order.rejected": "委託被拒絕",

      "label.buy": "買入",
      "label.sell": "賣出",
      "label.cancel": "取消",
      "label.confirm": "確認",
      "label.back": "返回",
      "label.save": "儲存",
      "label.delete": "刪除",
      "label.search": "搜尋",
      "label.filter": "篩選",
      "label.reset": "重設",
      "label.loading": "載入中...",
      "label.noData": "暫無資料",
      "label.error": "錯誤",
      "label.success": "成功",
      "label.warning": "警告",
      "label.info": "資訊",

      "trade.orderPlaced": "委託已提交",
      "trade.orderFilled": "委託已成交",
      "trade.orderCancelled": "委託已撤銷",
      "trade.orderPartiallyFilled": "委託部分成交",
      "trade.position": "持倉",
      "trade.account": "帳戶",
      "trade.history": "歷史",
      "trade.pnl": "盈虧",

      "market.US": "美股",
      "market.HK": "港股",
      "market.ASH": "滬市",
      "market.ASZ": "深市",
      "market.open": "開市",
      "market.closed": "休市",
      "market.preMarket": "盤前",
      "market.afterHours": "盤後",

      "common.total": "總計",
      "common.fee": "手續費",
      "common.rate": "費率",
      "common.balance": "餘額",
      "common.profit": "收益",
      "common.loss": "虧損",
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
    label: "日本語",
    translations: {
      "error.broker.notConnected": "ブローカー接続なし",
      "error.broker.insufficientFunds": "利用可能資金不足",
      "error.broker.positionLimit": "保有ポジション上限超過",
      "error.broker.dailyLossLimit": "日次損失制限到達",
      "error.broker.circuitBreaker": "サーキットブレーカー発動",
      "error.broker.coolDown": "取引頻度が高すぎます、冷却中",

      "error.strategy.invalidParams": "無効な戦略パラメータ",
      "error.strategy.noSignal": "取引シグナルなし",
      "error.strategy.backtestFailed": "バックテスト失敗",
      "error.strategy.notPublished": "未公開の戦略",

      "error.signal.expired": "シグナル期限切れ",
      "error.signal.confidenceLow": "シグナル確信度不足",
      "error.signal.marketClosed": "市場は休場中",

      "error.order.invalidQty": "無効な注文数量",
      "error.order.invalidPrice": "無効な注文価格",
      "error.order.partiallyFilled": "一部約定",
      "error.order.rejected": "注文拒否",

      "label.buy": "買い",
      "label.sell": "売り",
      "label.cancel": "キャンセル",
      "label.confirm": "確認",
      "label.back": "戻る",
      "label.save": "保存",
      "label.delete": "削除",
      "label.search": "検索",
      "label.filter": "フィルター",
      "label.reset": "リセット",
      "label.loading": "読み込み中...",
      "label.noData": "データなし",
      "label.error": "エラー",
      "label.success": "成功",
      "label.warning": "警告",
      "label.info": "情報",

      "trade.orderPlaced": "注文送信済み",
      "trade.orderFilled": "約定済み",
      "trade.orderCancelled": "注文取消",
      "trade.orderPartiallyFilled": "一部約定",
      "trade.position": "保有ポジション",
      "trade.account": "口座",
      "trade.history": "履歴",
      "trade.pnl": "損益",

      "market.US": "米国市場",
      "market.HK": "香港市場",
      "market.ASH": "上海市場",
      "market.ASZ": "深セン市場",
      "market.open": "取引時間中",
      "market.closed": "休場",
      "market.preMarket": "プレマーケット",
      "market.afterHours": "時間外",

      "common.total": "合計",
      "common.fee": "手数料",
      "common.rate": "レート",
      "common.balance": "残高",
      "common.profit": "利益",
      "common.loss": "損失",
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
