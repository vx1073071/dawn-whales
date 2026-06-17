// ══ R275 QClaw Task 1: 🇯🇵🇮🇳🇧🇷 13指標文案 (2h) ══
// 日本5+印度5+巴西3 = 13全球指標
// 交付: src/lib/market/jp-in-br-13-indicators-r275.ts

export const JP_IN_BR_13_INDICATORS = {

  // ══════ 🇯🇵 日本5指標 ══════
  japan: {
    panelTitle: "🇯🇵 日本市場信號",
    panelSubtitle: "信用取引+VIX+法人——日本獨有的交易信號",

    indicators: [

      // ── 1. 信用買残 ──
      {
        id: "jp_margin_buy",
        name: "信用買残",
        emoji: "📈",
        oneliner: "借錢買股票的餘額——日本散戶的槓桿溫度",
        description: "信用買残=日本個人投資者向券商借錢買股票的未償還餘額。餘額上升=散戶在加槓桿。餘額急降=追証(追加保證金)導致的強制平倉。每週水曜·金曜公佈。",
        ranges: [
          { condition: "餘額連升+股價上漲", meaning: "良性加槓桿——散戶跟隨趨勢", color: "green" },
          { condition: "餘額創新高", meaning: "⚠️ 槓桿極限——歷史數據:信用買残ピーク=株価ピーク(概率高い)", color: "red" },
          { condition: "餘額急降(前週比>5%)", meaning: "🔴 追証売——散戶強平潮。短期急跌後可能=買點(非理性拋售)", color: "dark" },
          { condition: "餘額連降+股價橫盤", meaning: "洗盤——籌碼從散戶轉移到機関投資家", color: "yellow" },
        ],
        signal: "信用買残が高水準で株価が伸び悩む = 買い疲れ。上値を買う余力が尽きている可能性。逆に買残が急減した後=売り圧力が一巡——リバウンドの可能性。",
        source: "JPX·東証 毎週水·金公表",
        unit: "株",
      },

      // ── 2. 信用売残 ──
      {
        id: "jp_margin_sell",
        name: "信用売残",
        emoji: "📉",
        oneliner: "空賣的餘額——日本散戶在看空什麼",
        description: "信用売残=散戶借股票賣出的未償還餘額。売残高=散戶的空頭總量。売残急増=散戶看空。売残高水準で株価下がらず=潛在的逼空(踏み上げ)彈藥。",
        ranges: [
          { condition: "売残急増", meaning: "散戶看空情緒濃厚——但要注意=散戶集體看空時反而容易踏み上げ", color: "yellow" },
          { condition: "売残高+株価横ばい", meaning: "⚡ 踏み上げリスク——空頭の買い戻しが上昇を加速させる可能性", color: "red" },
          { condition: "売残減少", meaning: "空頭解消——売り方が降参している", color: "green" },
        ],
        signal: "売残>買残の50% = 散戶大幅偏空。歴史的に「逆指標」になりやすい——これを見て売るのは危険。むしろ買い戻しによる急騰に注意。",
        source: "JPX·東証 毎週水·金公表",
        unit: "株",
      },

      // ── 3. 日経VI ──
      {
        id: "jp_nikkei_vi",
        name: "日経VI",
        emoji: "🌡️",
        oneliner: "日本版VIX——日経平均の恐怖指数",
        description: "日経平均ボラティリティー·インデックス。日経225オプションのインプライド·ボラティリティを指数化。>30=恐慌。<20=平穏。日本のVIは米国VIXより上下が激しい傾向。",
        ranges: [
          { max: 15, label: "<15", meaning: "極度に平穏——嵐の前の静けさか", color: "green" },
          { max: 20, label: "15-20", meaning: "平穏——日本の日常", color: "neutral" },
          { max: 30, label: "20-30", meaning: "警戒——市場に不安材料あり", color: "yellow" },
          { max: 100, label: ">30", meaning: "恐慌——歴史的には底値圏(ただし絶対ではない)", color: "red" },
        ],
        signal: "日経VI>30 = 恐怖ピークの可能性。ただしVIが上昇中はまだ底打ちしていない——VIが天井を打って下がり始めてからが買い場。",
        unit: "指数",
      },

      // ── 4. 信用倍率 ──
      {
        id: "jp_margin_ratio",
        name: "信用倍率",
        emoji: "⚖️",
        oneliner: "買残÷売残——散戶的淨方向",
        description: "信用買残÷信用売残。>1=買超(散戶看多)。<1=売超(散戶看空)。歴史的範囲:0.3-6.0。倍率>6=買われ過ぎ。倍率<0.5=売られ過ぎ。",
        ranges: [
          { max: 0.5, label: "<0.5", meaning: "極端な売り越し——散戶極度看空=逆に買いシグナル", color: "red" },
          { max: 1.0, label: "0.5-1.0", meaning: "やや売り越し——散戶偏空", color: "yellow" },
          { max: 3.0, label: "1.0-3.0", meaning: "正常——輕度買超", color: "neutral" },
          { max: 6.0, label: "3.0-6.0", meaning: "買われ過ぎ——散戶過度看多", color: "green" },
          { max: 999, label: ">6.0", meaning: "極端な買い越し——散戶狂熱=売りシグナル", color: "bright" },
        ],
        signal: "倍率>6 = 散戶が全力買い——これ以上買う人がいなくなる=天井の可能性。倍率<0.5 = 散戶が壊滅的に弱気——ここからの反転上昇は強い。",
        unit: "倍",
      },

      // ── 5. 東証マザーズ指数 ──
      {
        id: "jp_mothers",
        name: "マザーズ",
        emoji: "🚀",
        oneliner: "新興市場——日本散戶的風險偏好溫度計",
        description: "東証マザーズ(新興企業向け市場)の指数。日本の個人投資家のリスク選好度を最も鋭く反映する——マザーズが強い=散戶がリスクを取っている。マザーズが弱い=散戶が逃げている。",
        ranges: [
          { condition: "マザーズ>日経平均(相対パフォーマンス)", meaning: "リスクオン——散戶が積極的にリスクを取っている。強気相場の特徴", color: "green" },
          { condition: "マザーズ<日経平均", meaning: "リスクオフ——散戶が安全資産に逃げている。調整局面の特徴", color: "red" },
        ],
        signal: "マザーズが日経平均に先行して動く傾向。マザーズが底打ちしたら=日経平均も近いうちに底を打つ可能性が高い。",
        unit: "指数",
      },
    ],
  },

  // ══════ 🇮🇳 印度5指標 ══════
  india: {
    panelTitle: "🇮🇳 インド市場シグナル",
    panelSubtitle: "FII/DII+OI Rollover+PCR——世界最大級デリバティブ市場の指標",

    indicators: [

      // ── 6. FIIネット ──
      {
        id: "in_fii_net",
        name: "FIIネット",
        emoji: "🌏",
        oneliner: "海外機関投資家的淨買賣——「外國人的態度」",
        description: "FII(Foreign Institutional Investors)のインド株式ネット売買額。FIIがインド市場の方向を決める最大のプレイヤー。連続買い越し=強気。連続売り越し=弱気。DIIと逆方向に動くことが多い。",
        ranges: [
          { condition: "連続5日買い越し", meaning: "強気確定——外国人マネーがインドに流入中", color: "green" },
          { condition: "単日大幅買い越し(>5000₹Cr)", meaning: "突発的強気——特定イベント(選挙/政策)への反応", color: "bright" },
          { condition: "連続5日売り越し", meaning: "弱気——外国人がインドから撤退中。DIIが買い支えているか確認", color: "red" },
          { condition: "売り越し+DII買い支え", meaning: "調整中だが崩れない——典型的インド市場パターン", color: "yellow" },
        ],
        signal: "FIIの連続売り越しはインド市場の日常——慌てない。FII+DII両方売り越し=パンデミック級の非常事態。",
        source: "SEBI(翌営業日公表)",
        unit: "₹クロール",
      },

      // ── 7. DIIネット ──
      {
        id: "in_dii_net",
        name: "DIIネット",
        emoji: "🏠",
        oneliner: "国内機関投資家的淨買賣——印度的「防衛線」",
        description: "DII(Domestic Institutional Investors)=インド国内の投資信託·保険会社のネット売買。FIIが売っているときにDIIが買い支えるのがインド市場の「日常」。DIIが買わなくなった時が本当の危険シグナル。",
        signal: "DII連続買い越し+株式市場下落 = 「押し目買い」——国内マネーは長期的にインドを信じている。DIIが買い控えたときこそ警戒。",
        unit: "₹クロール",
      },

      // ── 8. ロールオーバー率 ──
      {
        id: "in_rollover",
        name: "ロール率",
        emoji: "🔄",
        oneliner: "当月限→翌月限へのポジション持ち越し率——トレンド継続の意思表示",
        description: "Nifty/Bank Nifty先物の満期ロールオーバー率。>70%=強気の持ち越し(トレンド継続を見込む)。<50%=弱気(ポジション清算して逃げ)。SQ週の最重要指標。",
        ranges: [
          { max: 50, label: "<50%", meaning: "逃げ腰——参加者がポジション清算を急いでいる", color: "red" },
          { max: 65, label: "50-65%", meaning: "やや弱気——通常より低い", color: "yellow" },
          { max: 80, label: "65-80%", meaning: "正常——標準的なロールオーバー", color: "neutral" },
          { max: 100, label: ">80%", meaning: "強気——高い確信でポジションを持ち越し", color: "green" },
        ],
        signal: "ロール率>80%+ロールコスト高い = 強気の確信が極めて強い——高いコストを払ってでもポジションを持ち越す価値があると思っている。",
        unit: "%",
      },

      // ── 9. PCR (プット/コール比) ──
      {
        id: "in_pcr",
        name: "PCR",
        emoji: "⚔️",
        oneliner: "プット÷コール——インド市場のセンチメント尺度",
        description: "Niftyオプションのプット建玉÷コール建玉。>1=プット過多(警戒)。<1=コール過多(強気)。>1.5=極度警戒→底値の可能性。<0.5=極度強気→過熱の可能性。",
        ranges: [
          { max: 0.5, label: "<0.5", meaning: "過度な強気——コールが多すぎる=過熱感", color: "red" },
          { max: 0.9, label: "0.5-0.9", meaning: "やや強気——正常高め", color: "green" },
          { max: 1.3, label: "0.9-1.3", meaning: "中立——均衡", color: "neutral" },
          { max: 1.8, label: "1.3-1.8", meaning: "警戒——プットが増えている=不安", color: "yellow" },
          { max: 999, label: ">1.8", meaning: "極度警戒——逆に底打ちシグナル。恐怖のピーク", color: "red" },
        ],
        signal: "PCRは逆張り指標として使える——PCRが極端に高い=みんながプットを買っている=みんなが怖がっている=買い場の可能性。ただしPCR>2でもSQまで下がり続けることもある。",
        unit: "倍",
      },

      // ── 10. インドVIX ──
      {
        id: "in_vix",
        name: "INDIA VIX",
        emoji: "🌪️",
        oneliner: "Niftyの恐怖指数——インド版VIX",
        description: "India VIX=Niftyオプションのインプライド·ボラティリティ。インドVIXは他の市場より高い傾向(通常15-30)。>30=高ボラティリティ。>40=極度の不確実性(選挙/予算発表時)。",
        ranges: [
          { max: 15, label: "<15", meaning: "低ボラ——インド市場としては極めて平穏", color: "green" },
          { max: 25, label: "15-25", meaning: "正常——インドの日常ボラティリティ", color: "neutral" },
          { max: 35, label: "25-35", meaning: "高ボラ——不安定。イベントドリブン", color: "yellow" },
          { max: 100, label: ">35", meaning: "恐慌レベル。選挙/予算/危機", color: "red" },
        ],
        signal: "インドVIX急騰からの反転下降=強い買いシグナル。恐慌が去ったあとの相場は力強い。",
        unit: "指数",
      },
    ],
  },

  // ══════ 🇧🇷 巴西3指標 ══════
  brazil: {
    panelTitle: "🇧🇷 ブラジル市場シグナル",
    panelSubtitle: "オプション+ADR——ボラタイルな市場の羅針盤",

    indicators: [

      // ── 11. インプライド·ボラティリティ ──
      {
        id: "br_iv",
        name: "IVレベル",
        emoji: "🌡️",
        oneliner: "ブラジルのインプライド·ボラティリティ——常に高い",
        description: "B3オプション(PETR4/VALE3中心)のインプライド·ボラティリティ。ブラジルのIVは他市場より恒常的に高い(30-60%)。IV>60%=何か大きなイベントを織り込んでいる(政治/コモディティ/通貨)。",
        ranges: [
          { max: 30, label: "<30%", meaning: "ブラジルとしては極めて低ボラ", color: "green" },
          { max: 45, label: "30-45%", meaning: "正常——ブラジル日常", color: "neutral" },
          { max: 60, label: "45-60%", meaning: "高ボラ——警戒", color: "yellow" },
          { max: 999, label: ">60%", meaning: "極度の不確実性——政治的危機/コモディティショック", color: "red" },
        ],
        signal: "IV>60% = 混沌——この時はポジションを小さく。ブラジルは世界一地政学リスクが株価に直結する市場。",
        unit: "%",
      },

      // ── 12. PCR ──
      {
        id: "br_pcr",
        name: "PCR",
        emoji: "🐻",
        oneliner: "プット÷コール——ブラジル市場のベア度",
        description: "B3オプション全体のプット/コール比率。>1.5=警戒感強い。<0.5=強気。ブラジルは政治リスクが大きいのでPCRが構造的に高め。",
        unit: "倍",
      },

      // ── 13. ADRプレミアム ──
      {
        id: "br_adr_premium",
        name: "ADR格差",
        emoji: "📏",
        oneliner: "ADR vs 現地株——外国人のブラジル評価",
        description: "PBR(ペトロブラスADR)/VALE(ヴァーレADR)と現地株(BRL建て)の価格差。プレミアム(ADR>現地株)=米国投資家がブラジルに強気。ディスカウント=米国投資家がブラジルから逃げている。",
        ranges: [
          { condition: "プレミアム>5%", meaning: "米国投資家がブラジルに強気——ADRを高い値段で買っている", color: "green" },
          { condition: "±5%以内", meaning: "正常範囲——裁定取引が機能", color: "neutral" },
          { condition: "ディスカウント>5%", meaning: "米国投資家がブラジルから撤退中——ADRを投げ売り", color: "red" },
        ],
        unit: "%",
      },
    ],
  },
};

// ── 13指標一覧 ──
export const JP_IN_BR_13_LIST = [
  "jp_margin_buy", "jp_margin_sell", "jp_nikkei_vi", "jp_margin_ratio", "jp_mothers",
  "in_fii_net", "in_dii_net", "in_rollover", "in_pcr", "in_vix",
  "br_iv", "br_pcr", "br_adr_premium",
];

export default JP_IN_BR_13_INDICATORS;
