// ══ R273 QClaw Task 3: 多币种文案 (2h) ══
// 24种货币的报价/汇率/显示文案
// 交付: src/lib/market/multi-currency-copy-r273.ts

export const MULTI_CURRENCY_COPY = {

  // ── 1. 货币选择器 ──
  currencySelector: {
    title: "表示通貨",
    subtitle: "チャートの価格を表示する通貨を選択",
    default: "デフォルト(原通貨)",
    search: "通貨を検索...",
    recentlyUsed: "最近使用",
    allCurrencies: "すべての通貨",
  },

  // ── 2. 24种货币 ← 中文+日本語+現地名 ──
  currencies: [
    { code: "USD", symbol: "$",  nameZh: "美元",   nameJa: "米ドル",    flag: "🇺🇸", locale: "en-US" },
    { code: "EUR", symbol: "€",  nameZh: "欧元",   nameJa: "ユーロ",    flag: "🇪🇺", locale: "de-DE" },
    { code: "JPY", symbol: "¥",  nameZh: "日元",   nameJa: "日本円",    flag: "🇯🇵", locale: "ja-JP" },
    { code: "GBP", symbol: "£",  nameZh: "英镑",   nameJa: "英ポンド",   flag: "🇬🇧", locale: "en-GB" },
    { code: "CNY", symbol: "¥",  nameZh: "人民币",  nameJa: "中国人民元", flag: "🇨🇳", locale: "zh-CN" },
    { code: "HKD", symbol: "HK$",nameZh: "港元",   nameJa: "香港ドル",   flag: "🇭🇰", locale: "zh-HK" },
    { code: "KRW", symbol: "₩",  nameZh: "韩元",   nameJa: "韓国ウォン", flag: "🇰🇷", locale: "ko-KR" },
    { code: "TWD", symbol: "NT$",nameZh: "新台币",  nameJa: "台湾ドル",   flag: "🇹🇼", locale: "zh-TW" },
    { code: "INR", symbol: "₹",  nameZh: "印度卢比", nameJa: "インドルピー", flag: "🇮🇳", locale: "hi-IN" },
    { code: "BRL", symbol: "R$", nameZh: "巴西雷亚尔",nameJa: "ブラジルレアル", flag: "🇧🇷", locale: "pt-BR" },
    { code: "AUD", symbol: "A$", nameZh: "澳元",    nameJa: "豪ドル",    flag: "🇦🇺", locale: "en-AU" },
    { code: "CAD", symbol: "C$", nameZh: "加元",    nameJa: "カナダドル", flag: "🇨🇦", locale: "en-CA" },
    { code: "CHF", symbol: "CHF",nameZh: "瑞士法郎", nameJa: "スイスフラン", flag: "🇨🇭", locale: "de-CH" },
    { code: "SGD", symbol: "S$", nameZh: "新加坡元", nameJa: "シンガポールドル", flag: "🇸🇬", locale: "en-SG" },
    { code: "MYR", symbol: "RM", nameZh: "马来西亚林吉特",nameJa: "マレーシアリンギ", flag: "🇲🇾", locale: "ms-MY" },
    { code: "IDR", symbol: "Rp", nameZh: "印尼盾",  nameJa: "インドネシアルピア", flag: "🇮🇩", locale: "id-ID" },
    { code: "THB", symbol: "฿",  nameZh: "泰铢",    nameJa: "タイバーツ", flag: "🇹🇭", locale: "th-TH" },
    { code: "PHP", symbol: "₱",  nameZh: "菲律宾比索",nameJa: "フィリピンペソ", flag: "🇵🇭", locale: "en-PH" },
    { code: "VND", symbol: "₫",  nameZh: "越南盾",   nameJa: "ベトナムドン", flag: "🇻🇳", locale: "vi-VN" },
    { code: "MXN", symbol: "Mex$",nameZh: "墨西哥比索",nameJa: "メキシコペソ", flag: "🇲🇽", locale: "es-MX" },
    { code: "TRY", symbol: "₺",  nameZh: "土耳其里拉",nameJa: "トルコリラ", flag: "🇹🇷", locale: "tr-TR" },
    { code: "ZAR", symbol: "R",  nameZh: "南非兰特",  nameJa: "南アランド", flag: "🇿🇦", locale: "en-ZA" },
    { code: "AED", symbol: "د.إ",nameZh: "阿联酋迪拉姆",nameJa: "UAEディルハム", flag: "🇦🇪", locale: "ar-AE" },
    { code: "SAR", symbol: "﷼",  nameZh: "沙特里亚尔",nameJa: "サウジリヤル", flag: "🇸🇦", locale: "ar-SA" },
  ],

  // ── 3. 汇率面板 ──
  exchangePanel: {
    title: "為替レート",
    subtitle: "リアルタイム外国為替レート",
    base: "基準通貨",
    quote: "換算通貨",
    rate: "レート",
    change: "前日比",
    spread: "スプレッド",
    lastUpdate: "最終更新",
    autoRefresh: "自動更新中",

    empty: "通貨ペアを選択してください",
    loading: "レートを取得中...",
    error: "レートの取得に失敗しました",

    converter: {
      title: "通貨換算",
      from: "変換元",
      to: "変換先",
      amount: "金額",
      result: "換算結果",
      swap: "通貨を入れ替え",
    },
  },

  // ── 4. チャート価格表示 ──
  chartDisplay: {
    originalCurrency: "原通貨 — {symbol}{price}",
    convertedCurrency: "換算 — {symbol}{price} (≈¥{jpyPrice})",
    dualDisplay: "原通貨+換算の二段表示",
    rateNote: "換算レート: 1{base} = {rate}{quote}",

    tips: {
      whyConvert: "原通貨で価格を見たい=その市場の投資家と同じ目線。自国通貨に換算したい=自分の損益を把握したい。二段表示なら両方できる。",
      volatileFx: "⚠️ {pair}のボラティリティが高い — 為替の変動が株の損益を大きく左右する。新興国通貨ペアは特に注意。",
      peggedFx: "📌 {pair}はペッグ制 — 為替変動リスクが低い。香港ドル(USDペッグ)/サウジリヤル(USDペッグ)。",
    },
  },

  // ── 5. 多币种盈亏 ──
  pnl: {
    title: "損益計算",
    costPrice: "取得単価",
    currentPrice: "現在値",
    quantity: "数量",
    pnlLocal: "現地通貨損益",
    pnlBase: "基準通貨損益",
    pnlRate: "換算レート適用",
    unrealized: "評価損益",
    realized: "実現損益",
    fxPnl: "為替差損益",

    fxNote: "為替差損益=為替変動によって生じた損益。香港株を円換算している場合、株が上がっても円高になれば損益が相殺される。逆も然り。為替は無視できない。",
  },
};

export default MULTI_CURRENCY_COPY;
