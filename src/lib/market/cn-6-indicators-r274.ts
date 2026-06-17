// ══ R274 QClaw Task 2: 中国6指標文案 (2h) ══
// A股独自の6指標: 漲跌停統計/融資融券/市場情緒/兩市成交/北向資金/板塊輪動
// 交付: src/lib/market/cn-6-indicators-r274.ts

export const CN_6_INDICATORS = [

  // ── 1. 漲跌停統計 ──
  {
    id: "cn_limit_stats",
    name: "漲跌停數",
    emoji: "🔢",
    oneliner: "今日多少股票漲停、多少跌停——市場最原始的溫度",
    description: "全市場漲停家數vs跌停家數。漲停>100家=強勢市場。跌停>50家=恐慌。漲跌停數量比指數更誠實——指數可以靠拉權重股做出來，漲跌停做不出來。",
    components: {
      limitUp: "漲停家數",
      limitDown: "跌停家數",
      consecutiveUp: "連板家數",
      firstBoard: "首板家數",
      sealRate: "封板率",
      boardBreak: "炸板數",
    },
    ranges: [
      { condition: "漲停>100+跌停<5", meaning: "極強——全市場做多熱情高漲", color: "bright" },
      { condition: "漲停50-100+跌停<10", meaning: "強——正常強勢市場", color: "green" },
      { condition: "漲停20-50+跌停<20", meaning: "偏強——溫和上漲", color: "neutral" },
      { condition: "跌停>50", meaning: "恐慌——不管指數漲跌，跌停超過50=有人在割肉", color: "red" },
      { condition: "跌停>100", meaning: "極度恐慌——千股跌停級別的行情(2015年以來很少見)", color: "dark" },
    ],
    signal: "封板率<60% = 漲停的股票很多被砸開了——追板的風險很高。首板占比>80%+連板少=板塊在輪動試探——還沒有形成主線。",
  },

  // ── 2. 融資融券 ──
  {
    id: "cn_margin",
    name: "融資融券",
    emoji: "🏦",
    oneliner: "借錢買股票的人多不多——槓桿溫度計",
    description: "融資餘額=A股投資者向券商借錢買股票的總金額。融資餘額上升=散戶在加槓桿。餘額急降=散戶被強平/砍倉。這是最真實的散戶情緒——是用錢投票不是用嘴投票。",
    components: {
      marginBalance: "融資餘額(億)",
      marginBuy: "融資買入額",
      marginRepay: "融資償還額",
      shortBalance: "融券餘額(億)",
      marginRatio: "融資佔成交比",
    },
    ranges: [
      { condition: "餘額連續上升+指數上漲", meaning: "良性加槓桿——跟趨勢", color: "green" },
      { condition: "餘額創新高", meaning: "⚠️ 槓桿到極限——歷史上融資餘額見頂=指數見頂(概率很高)", color: "red" },
      { condition: "餘額急降>5%/日", meaning: "🔴 強平潮——散戶在被迫砍倉。短期急跌後可能是買點(砍倉=不理性拋售)", color: "dark" },
      { condition: "融資佔成交>12%", meaning: "過熱——槓桿資金佔比過高", color: "yellow" },
    ],
    signal: "融資餘額持續下降+指數橫盤 = 籌碼從散戶轉移到主力——「洗盤」。這種橫盤後突破的方向大概率向上。",
  },

  // ── 3. 市場情緒指數 ──
  {
    id: "cn_sentiment",
    name: "情緒指數",
    emoji: "🎭",
    oneliner: "滬深兩市「貪婪vs恐懼」——大眾情緒的量化",
    description: "綜合漲跌比+成交量+漲跌停比+新高新低比+升水貼水+波動率——六個維度合成一個0-100的指數。>80=貪婪。<20=恐懼。極度貪婪=賣出信號。極度恐懼=買入機會。",
    components: {
      advanceDecline: "漲跌比",
      volume: "成交量比",
      limitRatio: "漲跌停比",
      newHighLow: "新高新低比",
      premiumDiscount: "期指升貼水",
      volatility: "波動率",
    },
    ranges: [
      { max: 20, label: "0-20 極度恐懼", meaning: "所有人都在害怕——歷史上這是買點", color: "red" },
      { max: 40, label: "20-40 恐懼", meaning: "偏恐慌——但還沒到底", color: "yellow" },
      { max: 60, label: "40-60 中性", meaning: "市場正常——沒有極端情緒", color: "neutral" },
      { max: 80, label: "60-80 貪婪", meaning: "有點過熱——注意風險", color: "green" },
      { max: 100, label: "80-100 極度貪婪", meaning: "所有人都覺得會繼續漲——歷史上這是賣點", color: "bright" },
    ],
    signal: "「別人恐懼我貪婪」——情緒指數<20的時候想一想這句話。但不代表<20就立刻反彈——可能在恐懼區待幾週。等它從<20回升到>30再買=更安全。",
  },

  // ── 4. 兩市成交額 ──
  {
    id: "cn_volume",
    name: "兩市成交",
    emoji: "📈",
    oneliner: "滬深兩市多少錢在交易——市場的「體溫」",
    description: "上海+深圳兩市合計成交額。一萬億=正常。一萬五千億=活躍。兩萬億=火爆。五千億以下=冷清(春節前後/國慶前後常見)。縮量上漲=不可持續。放量下跌=恐慌還沒結束。",
    components: {
      shVolume: "滬市成交",
      szVolume: "深市成交",
      totalVolume: "兩市合計",
      avg5d: "5日均量",
      volumeRatio: "量比",
    },
    ranges: [
      { condition: ">2萬億", meaning: "🔥 極度活躍——全市場都在交易", color: "bright" },
      { condition: "1.5-2萬億", meaning: "活躍——行情確立。上漲需要這個量", color: "green" },
      { condition: "1-1.5萬億", meaning: "正常——日常成交", color: "neutral" },
      { condition: "5000億-1萬億", meaning: "冷清——市場在觀望", color: "yellow" },
      { condition: "<5000億", meaning: "極度冷清——節前/節後常見。方向選擇後會放量", color: "red" },
    ],
    signal: "成交萎縮+指數橫盤 = 「方向選擇前的寧靜」——放量突破的方向大概率是接下來的主趨勢。量比>2+指數突破關鍵位 = 有效突破。量比<1+指數突破 = 假突破。",
  },

  // ── 5. 北向資金 ──
  {
    id: "cn_northbound",
    name: "北向資金",
    emoji: "🧭",
    oneliner: "外資通過滬深股通買A股的資金——「聰明錢」",
    description: "北向資金=外資通過滬港通/深港通買入A股的淨資金流。市場稱之為「聰明錢」——因為外資的買賣節奏確實比散戶準。連續淨買入=外資看好A股。連續淨賣出=外資在撤離。",
    components: {
      netFlow: "當日淨買入(億)",
      shFlow: "滬股通淨買入",
      szFlow: "深股通淨買入",
      monthlyNet: "本月累計",
      quarterlyNet: "本季累計",
      topBuy: "買入最多板塊",
      topSell: "賣出最多板塊",
    },
    signal: "北向資金連續5日淨買入+兩市成交>1萬億 = A股最可靠的做多信號組合。外資+內資一起發力=行情來了。外資買但內資縮量=外資獨角戲——難持續。",
  },

  // ── 6. 主力資金流向 ──
  {
    id: "cn_main_flow",
    name: "主力資金",
    emoji: "🐋",
    oneliner: "大單淨買入——主力在用真金白銀投票",
    description: "按單筆成交金額分大單(>100萬)/中單/小單。大單淨買入=主力資金。主力資金連續淨買入=市場有「莊」。主力資金連續淨賣出=主力在出貨。散戶的對手盤——看主力不看散戶。",
    components: {
      mainNet: "主力淨買入(億)",
      superLargeNet: "超大單淨買入",
      largeNet: "大單淨買入",
      mediumNet: "中單淨買入",
      smallNet: "小單淨買入",
    },
    signal: "超大單淨買入+中單小單淨賣出 = 主力在收貨——散戶在賣給主力。這是「洗盤吸籌」——短線難受但中線利好。超大單淨賣出+中單小單淨買入 = 主力在出貨給散戶——危險。",
  },
];

// ── 面板ヘッダー ──
export const CN_6_PANEL = {
  title: "A股市場信號",
  subtitle: "6個A股獨有指標——不做A股的外國軟件永遠不會有",
  note: "漲跌停/融資融券/情緒/成交量/北向資金/主力資金——這六個是A股的脈搏。個股的K線只在這個大背景下才有意義。",
  quote: "先看大市，再看個股。大市不行的時候——再好的股票也會被拖下水。",
};

export default CN_6_INDICATORS;
