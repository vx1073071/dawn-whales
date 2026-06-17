// ══ R274 QClaw Task 1: 香港6指標文案 (2h) ══
// 香港市場独自の6指標: 沽空率/恒指波幅/市場寬度/AH溢價/資金流/板塊輪動
// 交付: src/lib/market/hk-6-indicators-r274.ts

export const HK_6_INDICATORS = [

  // ── 1. 沽空率 (Short Sell Ratio) ──
  {
    id: "hk_short_sell_ratio",
    name: "沽空比率",
    emoji: "🐻",
    oneliner: "今日成交中有多少是沽空——看空情緒溫度計",
    description: "全日沽空成交額÷全日總成交額。20%以上=偏空，30%以上=非常空。但也注意——高沽空比率=潛在的逼空彈藥(空頭要買回來)。",
    ranges: [
      { max: 10, label: "<10%", meaning: "平淡——市場沒有明顯看空情緒", color: "green" },
      { max: 18, label: "10-18%", meaning: "正常——這是港股日常的沽空範圍", color: "neutral" },
      { max: 25, label: "18-25%", meaning: "偏空——看空者比平時多了", color: "yellow" },
      { max: 100, label: ">25%", meaning: "非常空——極端看空情緒。但也可能=逼空即將發生", color: "red" },
    ],
    signal: "沽空率突然從15%跳到25%+股價在跌 = 空頭得勢。沽空>25%+股價不跌反漲 = 逼空前兆——空頭可能會被迫買回來。",
  },

  // ── 2. 恆指波幅指數 (VHSI) ──
  {
    id: "hk_vhsi",
    name: "恒指波幅",
    emoji: "🌡️",
    oneliner: "恒指的「恐慌指數」——波幅指數VHSI",
    description: "VHSI=恒生指數的引伸波幅。就像VIX對於標普500——VHSI越高=市場越恐慌。30以上=恐慌。20以下=平靜。港股的恐慌來得快去得也快。",
    ranges: [
      { max: 15, label: "<15", meaning: "極度平靜——可能是暴風雨前的寧靜", color: "green" },
      { max: 20, label: "15-20", meaning: "正常——港股日常", color: "neutral" },
      { max: 30, label: "20-30", meaning: "緊張——市場在擔憂什麼", color: "yellow" },
      { max: 100, label: ">30", meaning: "恐慌——VHSI>30通常是階段性底部區域(非絕對)", color: "red" },
    ],
    signal: "VHSI>30 = 「別人恐懼我貪婪」的時刻——但要等VHSI開始回落再進場。VHSI還在上升=恐慌還沒結束。",
  },

  // ── 3. 市場寬度 ──
  {
    id: "hk_market_breadth",
    name: "市場寬度",
    emoji: "📊",
    oneliner: "漲跌比——多少股票在漲vs在跌",
    description: "恒生綜合指數成分股的漲跌比。上漲家數÷下跌家數。>1=漲的多。只看恒指點數看不出來——大股拉指數、小股在跌是「假強」。市場寬度告訴你真相。",
    ranges: [
      { max: 0.5, label: "<0.5", meaning: "極度弱——跌的股票是漲的兩倍以上", color: "red" },
      { max: 0.8, label: "0.5-0.8", meaning: "偏弱——跌多漲少", color: "yellow" },
      { max: 1.2, label: "0.8-1.2", meaning: "均衡——漲跌参半", color: "neutral" },
      { max: 2.0, label: "1.2-2.0", meaning: "偏強——漲多跌少", color: "green" },
      { max: 999, label: ">2.0", meaning: "極強——大面積上漲", color: "bright" },
    ],
    signal: "恒指漲1%+市場寬度<0.8 = 「假強」——只有幾隻大股在拉指數，大部分股票在跌。恒指跌1%+市場寬度>1.2 = 「假弱」——大股拖累，但大部分股票在漲。",
  },

  // ── 4. AH溢價指數 ──
  {
    id: "hk_ah_premium",
    name: "AH溢價",
    emoji: "📏",
    oneliner: "A股比H股貴多少——溢價率的溫度",
    description: "AH溢價指數=追蹤A股相對H股的溢價水平。>100=A股比H股貴。<100=A股比H股便宜。歷史範圍: 80-150。120以上=港股相對便宜——南下資金會增加。",
    ranges: [
      { max: 100, label: "<100", meaning: "罕見——A股比港股便宜(極少發生)", color: "blue" },
      { max: 115, label: "100-115", meaning: "正常偏低——AH差距不大", color: "green" },
      { max: 130, label: "115-130", meaning: "正常偏高——港股相對便宜", color: "neutral" },
      { max: 150, label: "130-150", meaning: "偏高——港股明顯便宜。南下資金可能流入", color: "yellow" },
      { max: 999, label: ">150", meaning: "極端——港股極度便宜。歷史高位=港股底部機會", color: "red" },
    ],
    signal: "AH溢價>140 = 港股比A股便宜40%以上——南下資金大概率會增加。同一間公司買H比買A便宜這麼多——長期來看這個差距會縮小。",
  },

  // ── 5. 港股通資金流 ──
  {
    id: "hk_connect_flow",
    name: "港股通",
    emoji: "🌉",
    oneliner: "內地資金南下的方向——真金白銀的態度",
    description: "滬深港股通的淨買入/淨賣出。淨買入=內地資金買港股。淨賣出=內地資金賣港股。持續淨買入是內地資金看好港股的最直接信號——這是實打實的錢。",
    ranges: [
      { max: -999, label: "大幅淨賣出", meaning: "內地資金在撤離港股——警惕", color: "red" },
      { max: 0, label: "小幅淨賣出", meaning: "微幅流出——不用過度解讀", color: "yellow" },
      { max: 30, label: "<30億", meaning: "輕度淨買入——正常水平", color: "neutral" },
      { max: 80, label: "30-80億", meaning: "顯著淨買入——內地資金看好", color: "green" },
      { max: 99999, label: ">80億", meaning: "大幅淨買入——極強看好信號", color: "bright" },
    ],
    signal: "港股通連續5日淨買入>30億 = 內地機構在「定投」港股。這時候做空港股要小心——北上資金的大腿比你的空單粗。",
  },

  // ── 6. 板塊資金流向 ──
  {
    id: "hk_sector_flow",
    name: "板塊資金",
    emoji: "💰",
    oneliner: "錢在往哪個板塊流——跟著錢走",
    description: "追蹤恒生各板塊的資金淨流入/流出。錢流入最多+漲幅最大的板塊=市場的「主線」。錢流入但沒漲=「悄悄吸籌」——注意。",
    sectors: ["金融", "地產", "科技", "消費", "醫藥", "能源", "電訊", "公用"],
    signal: "連續3天資金淨流入同一板塊+該板塊漲幅排名前三 = 市場主線確立。資金流入但板塊不漲 = 有人在大舉買入卻不推高價格——「壓著收貨」。",
  },
];

// ── 面板ヘッダー ──
export const HK_6_PANEL = {
  title: "香港市場信號",
  subtitle: "6個港股獨有指標——比單純看K線多一層信息",
  note: "沽空/波幅/寬度/AH溢價/港股通/板塊資金——這六個指標外國人不看，但做港股必須看。",
};

export default HK_6_INDICATORS;
