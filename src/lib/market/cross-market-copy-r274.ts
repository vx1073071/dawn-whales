// ══ R274 QClaw Task 3: 跨市场文案 (2h) ══
// 全球交易时间轴+联动热图+假期日历+汇率风险
// 交付: src/lib/market/cross-market-copy-r274.ts

export const CROSS_MARKET_COPY = {

  // ── 1. 全球交易時間軸 ──
  timeline: {
    title: "全球交易時間",
    subtitle: "哪個市場正在交易——一眼看清全球資金流向",
    now: "現在交易中的市場",
    next: "下一個開盤: {market} (還有{minutes}分鐘)",
    closed: "目前無市場交易中",

    markets: [
      { id: "nz", name: "新西蘭", open: "06:00", close: "12:45", tz: "NZST", statusNote: "最早開盤——全球交易日的起點" },
      { id: "au", name: "澳大利亞", open: "07:00", close: "13:00", tz: "AEST", statusNote: "資源/礦業期貨的早盤信號" },
      { id: "jp", name: "日本", open: "08:00", close: "14:00", tz: "JST", statusNote: "亞洲流動性的主力——午休11:30-12:30" },
      { id: "kr", name: "韓國", open: "08:00", close: "14:30", tz: "KST", statusNote: "半導體板塊的風向標" },
      { id: "cn", name: "中國", open: "09:30", close: "15:00", tz: "CST", statusNote: "亞洲最大的市場——11:30-13:00午休" },
      { id: "hk", name: "香港", open: "09:30", close: "16:00", tz: "HKT", statusNote: "12:00-13:00午休——與A股聯動最強" },
      { id: "tw", name: "台灣", open: "09:00", close: "13:30", tz: "TST", statusNote: "台積電產業鏈的風向標" },
      { id: "in", name: "印度", open: "09:15", close: "15:30", tz: "IST", statusNote: "新興市場的獨立行情" },
      { id: "de", name: "德國", open: "09:00", close: "17:30", tz: "CEST", statusNote: "歐洲的發動機——DAX" },
      { id: "uk", name: "英國", open: "08:00", close: "16:30", tz: "BST", statusNote: "歐洲第二大——FTSE" },
      { id: "us", name: "美國", open: "09:30", close: "16:00", tz: "EDT", statusNote: "全球最重要的市場——所有市場都會跟它走" },
    ],

    sessions: {
      asiaLabel: "亞洲時段",
      asiaDesc: "東京·上海·香港·新加坡——全球交易日的引擎啟動",
      europeLabel: "歐洲時段",
      europeDesc: "倫敦·法蘭克福——承接亞洲、預告美國",
      usLabel: "美國時段",
      usDesc: "紐約——決定全球方向的最後四小時(夜間盤繼續)",
      overlapAsiaEurope: "亞歐重疊(15:00-16:30 HKT)——流動性最高",
      overlapEuropeUS: "歐美重疊(20:30-23:30 HKT)——一天中最活躍",
    },
  },

  // ── 2. 聯動熱圖 ──
  correlation: {
    title: "聯動熱圖",
    subtitle: "各市場之間的相關性——誰在跟誰走",
    description: "過去30天的日收益率相關性。紅色=正相關(一起漲跌)。藍色=負相關(反向)。顏色越深=關係越強。",
    legend: {
      strongPositive: "強正相關(>0.7) — 一榮俱榮",
      moderatePositive: "中等正相關(0.3-0.7)",
      weak: "弱相關(-0.3~0.3) — 各走各的",
      moderateNegative: "中等負相關(-0.7~-0.3)",
      strongNegative: "強負相關(<-0.7) — 蹺蹺板",
    },
    signals: {
      divergence: "⚠️ 標普漲+日經跌 = 亞美背離——通常亞洲會跟著美國方向補漲/補跌。亞洲開盤的方向大概率是追隨美股。",
      convergence: "全球齊漲齊跌 = 被宏觀驅動(利率/美元/地緣)而非個股基本面。這種環境下——「擇時」比「擇股」更重要。",
      decoupling: "A股獨立行情(與美股相關性<0.2) = A股在走自己的邏輯——政策驅動/資金驅動。這段時間不要看美股做A股——會做反。",
    },
  },

  // ── 3. 假期日曆 ──
  holidays: {
    title: "假期日曆",
    subtitle: "哪個市場今天休市——避免在沒人的市場下單",
    today: "今日休市市場",
    upcoming: "未來7天休市",
    empty: "今日所有市場正常交易",

    events: [
      { market: "香港", date: "7/1", name: "香港回歸紀念日" },
      { market: "美國", date: "7/4", name: "獨立日" },
      { market: "日本", date: "7/15", name: "海の日" },
      { market: "中國", date: "10/1-10/7", name: "國慶節(7天)" },
      { market: "印度", date: "10/2", name: "甘地誕辰" },
      { market: "韓國", date: "10/3", name: "開天節" },
      { market: "日本", date: "12/31-1/3", name: "年末年始(4天)" },
      { market: "中國", date: "春節", name: "春節(7天,農曆)" },
      { market: "香港", date: "春節", name: "農曆新年(3天)" },
    ],

    tips: {
      beforeHoliday: "長假前最後一個交易日 = 成交量萎縮+波動率可能異常。很多人平倉過節——不要在這一天做大額交易。",
      afterHoliday: "長假後第一個交易日 = 消化假期期間海外市場的走勢。如果美股在A股休市期間大漲——A股開盤大概率補漲。反之亦然。",
      halfDay: "半天市 = 成交量只有平時的一半。大額下單可能影響價格——注意流動性。",
      overlappingHoliday: "⚠️ 多市場同時休市 = 全球流動性枯竭。匯率波動可能異常——注意新興市場貨幣。",
    },
  },

  // ── 4. 匯率風險 ──
  fxRisk: {
    title: "匯率風險",
    subtitle: "你買的是外國股票——匯率在吃你的利潤",
    description: "持有非本幣計價的資產=自動持有外匯倉位。股價漲5%但匯率跌3%=實際只賺2%。忽略匯率=你不知道自己真正賺了多少。",

    calculator: {
      localReturn: "現地通貨リターン",
      fxChange: "為替変動",
      totalReturn: "実質リターン(自国通貨)",
      formula: "(1+現地リターン)×(1+為替変動)-1 = 実質リターン",
    },

    scenarios: [
      { stock: "+10%", fx: "+5%", real: "+15.5%", message: "株も為替も追い風——最高" },
      { stock: "+10%", fx: "-5%", real: "+4.5%", message: "株は上がったが円高で利益半減" },
      { stock: "+10%", fx: "-10%", real: "-1%", message: "株が10%上がっても為替で全部消えた——円高の怖さ" },
      { stock: "-10%", fx: "+10%", real: "-1%", message: "株は下がったが円安が損失をカバー" },
    ],

    highRiskPairs: {
      title: "高リスク通貨ペア",
      items: [
        { pair: "USD/BRL", risk: "超高", note: "ブラジルレアル——政治的イベントで1日5%動くことも" },
        { pair: "USD/TRY", risk: "超高", note: "トルコリラ——慢性的な下落通貨。リラ建て利益は額面通りではない" },
        { pair: "USD/INR", risk: "中", note: "インドルピー——緩やかな下落トレンド。長期保有でジワジワ損" },
        { pair: "USD/ZAR", risk: "高", note: "南アランド——コモディティ価格+政治リスクで乱高下" },
      ],
    },

    hedging: {
      title: "為替ヘッジ",
      note: "為替変動リスクを完全に消すことはできないが、USD/JPYやUSD/HKDのような主要ペアなら為替ヘッジ手段がある。ただし新興国通貨のヘッジコストは高い——ヘッジするより通貨分散する方が現実的。",
    },
  },
};

export default CROSS_MARKET_COPY;
