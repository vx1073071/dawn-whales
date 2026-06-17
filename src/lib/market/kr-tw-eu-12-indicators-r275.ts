// ══ R275 QClaw Task 2: 🇰🇷🇹🇼🇪🇺 12指標文案 (2h) ══
// 韩国4+台湾4+欧洲4 = 12全球指標
// 交付: src/lib/market/kr-tw-eu-12-indicators-r275.ts

export const KR_TW_EU_12_INDICATORS = {

  // ══════ 🇰🇷 韩国4指標 ══════
  korea: {
    panelTitle: "🇰🇷 한국 시장 시그널",
    panelSubtitle: "외국인·기관·개인——누가 사고 파는가",

    indicators: [

      // ── 1. 외국인 순매수 ──
      {
        id: "kr_foreign_net",
        name: "외국인",
        emoji: "🌏",
        oneliner: "外國人淨買賣——半導體資金流向的決定者",
        description: "外国人の韓国株式ネット売買額。外国人がコスピ(KOSPI)の方向を決める最大のプレイヤー——特にサムスン電子·SKハイニックスなどの半導体銘柄への集中売買が市場全体を動かす。",
        ranges: [
          { condition: "連続5日買い越し", meaning: "強気——特に半導体集中なら本格上昇の可能性", color: "green" },
          { condition: "連続5日売り越し", meaning: "弱気——外国人撤退中。個人が買い支えている間は急落しにくい", color: "red" },
          { condition: "売り+個人買い支え", meaning: "調整中——典型的パターン。個人の買い余力切れに注意", color: "yellow" },
        ],
        signal: "外国人+半導体銘柄集中買い = 韓国株最強の買いシグナル。サムスン電子·SKハイニックスに外人買い集中=코스피全体が押し上げられる。",
        source: "KRX 毎日15:30以降公表",
        unit: "억원(億ウォン)",
      },

      // ── 2. 기관 순매수 ──
      {
        id: "kr_institution_net",
        name: "기관",
        emoji: "🏢",
        oneliner: "機関投資家淨買賣——プログラム売買の主役",
        description: "韓国機関投資家(年金·投信·銀行)のネット売買。プログラム売買(차익+비차익)を含む。機関のプログラム買い=先物·現物裁定。プログラム売り=ヘッジ。必ずしも方向感を示さない——仕組み取引の色が強い。",
        signal: "機関買い+外國人買い = 両方強気——最強。機関売り+外國人買い = 外國人の独り舞台——慎重に。",
        unit: "억원",
      },

      // ── 3. 개인 순매수 ──
      {
        id: "kr_individual_net",
        name: "개인",
        emoji: "🙋",
        oneliner: "個人投資家淨買賣——「逆張りの達人」",
        description: "韓国個人投資家のネット売買。個人は外国人·機関と逆方向に動くことが多い——外國人が売っている時に拾い、外國人が買っている時に売る。韓国個人投資家は「동학개미(アリの群れ)」と呼ばれ、集団としての逆張り力が大きい。",
        signal: "個人が大量買い+株価下落 = 個人が「落ちるナイフ」を掴んでいる可能性。個人買いが尽きた後の一段安に注意。",
        unit: "억원",
      },

      // ── 4. KOSPI VIX ──
      {
        id: "kr_kospi_vix",
        name: "VKOSPI",
        emoji: "🌡️",
        oneliner: "コスピの恐怖指数——韓国版VIX",
        description: "KOSPI 200オプションのインプライド·ボラティリティ指数。韓国VIXは地政学リスク(北朝鮮)に敏感——ミサイル発射·核実験のたびに急騰する。>30=警戒。>40=地政学的危機。",
        ranges: [
          { max: 12, label: "<12", meaning: "極度平穏", color: "green" },
          { max: 20, label: "12-20", meaning: "正常", color: "neutral" },
          { max: 30, label: "20-30", meaning: "警戒——北朝鮮リスクまたは市場不安", color: "yellow" },
          { max: 100, label: ">30", meaning: "恐慌/地政学的危機", color: "red" },
        ],
        signal: "VKOSPIが北朝鮮関連で急騰→数日で正常化=一過性の買い場。北朝鮮リスクで売られた良質株を拾うタイミング。",
        unit: "指数",
      },
    ],
  },

  // ══════ 🇹🇼 台湾4指標 ══════
  taiwan: {
    panelTitle: "🇹🇼 台湾市場シグナル",
    panelSubtitle: "外資·投信·自營——TSMCで動く市場の羅針盤",

    indicators: [

      // ── 5. 外資買賣超 ──
      {
        id: "tw_foreign_net",
        name: "外資",
        emoji: "🌏",
        oneliner: "外資淨買賣——台積電(TSMC)就代表台灣",
        description: "外國機関投資家の台湾株式ネット売買。外資が台湾市場の最大勢力。特にTSMC(台積電/2330)への集中売買が加権指数をダイレクトに動かす——TSMCが指数の30%以上を占めるため。",
        ranges: [
          { condition: "連続5日買い越し", meaning: "強気——特にTSMC集中買いなら本格上昇", color: "green" },
          { condition: "連続5日売り越し", meaning: "弱気——外資撤退中。投信が買い支えているか確認", color: "red" },
          { condition: "TSMC単独買い+他銘柄売り", meaning: "選択的強気——TSMCにだけ強気で他は売っている=指数は上がるが中身が薄い", color: "yellow" },
        ],
        signal: "TSMC外資買い越し = 最重要シグナル。TSMCを買えば加権指数は上がる——これ以上シンプルな真実はない。",
        source: "TWSE 毎日14:30以降公表",
        unit: "億NTドル",
      },

      // ── 6. 投信買賣超 ──
      {
        id: "tw_trust_net",
        name: "投信",
        emoji: "🏠",
        oneliner: "國內基金淨買賣——護盤部隊",
        description: "台湾国内投資信託(元大·国泰·復華など)のネット売買。投信は台湾の「護盤(市場防衛)」役——外資が売っている時に投信が買い支える。台湾ETFブームで投信の影響力が急速に拡大中。",
        signal: "投信連続買い越し+外資売り越し = 護盤発動中。投信が買い続ければ崩れない。投信買いが止まった時が本当の危険。",
        unit: "億NTドル",
      },

      // ── 7. 自營商買賣超 ──
      {
        id: "tw_dealer_net",
        name: "自營",
        emoji: "🏦",
        oneliner: "證券商自營——ヘッジ売りに注意",
        description: "証券会社自己売買部門(自營商)のネット売買。自營商の売りは必ずしも弱気ではない——ワラント(権利証書)発行に伴うヘッジ売りの場合が多い。自營商の数字を単独で判断しない。",
        signal: "自營商大幅売り越し = ワラントヘッジの可能性が高い——弱気シグナルではない。自營+外資+投信が三者とも売り越し = 本当の危険信号。",
        unit: "億NTドル",
      },

      // ── 8. 台指VIX ──
      {
        id: "tw_taiex_vix",
        name: "台指VIX",
        emoji: "🌡️",
        oneliner: "台湾の恐怖指数——TSMCリスクを反映",
        description: "台湾加権指数オプションのインプライド·ボラティリティ。中国·台湾地政学リスクに敏感——海峡危機のたびに急騰する。>25=警戒。>30=地政学的緊張。",
        ranges: [
          { max: 12, label: "<12", meaning: "極度平穏", color: "green" },
          { max: 20, label: "12-20", meaning: "正常——台湾日常", color: "neutral" },
          { max: 30, label: "20-30", meaning: "警戒——海峡リスクor世界的半導体不安", color: "yellow" },
          { max: 100, label: ">30", meaning: "危機——地政学的緊張。半導体サプライチェーンリスク", color: "red" },
        ],
        signal: "台指VIX>30 = 市場が海峡リスクを織り込んでいる。緊張緩和→VIX急低下=強い買いシグナル。",
        unit: "指数",
      },
    ],
  },

  // ══════ 🇪🇺 欧洲4指標 ══════
  europe: {
    panelTitle: "🇪🇺 欧州市場シグナル",
    panelSubtitle: "VDAX+STOXX+国別格差——欧州の独自指標",

    indicators: [

      // ── 9. VDAX (ドイツVIX) ──
      {
        id: "eu_vdax",
        name: "VDAX",
        emoji: "🌡️",
        oneliner: "ドイツ版VIX——DAXの恐怖指数",
        description: "DAXオプションのインプライド·ボラティリティ。ヨーロッパのセンチメント指標として最も注目される。>30=欧州恐慌。<15=極度平穏。エネルギー危機·地政学リスクに敏感。",
        ranges: [
          { max: 15, label: "<15", meaning: "極度平穏——欧州に不安なし", color: "green" },
          { max: 22, label: "15-22", meaning: "正常——欧州日常", color: "neutral" },
          { max: 30, label: "22-30", meaning: "警戒——不安材料あり", color: "yellow" },
          { max: 100, label: ">30", meaning: "恐慌——エネルギー危機/戦争/銀行危機", color: "red" },
        ],
        signal: "VDAX>30 = 欧州危機。2022年のエネルギー危機でVDAXは40超。歴史的にVDAXピークからの反転=強い買いシグナル。",
        unit: "指数",
      },

      // ── 10. STOXX 600 マーケット幅 ──
      {
        id: "eu_stoxx_breadth",
        name: "STOXX幅",
        emoji: "📊",
        oneliner: "欧州600社の漲跌比——欧州市場の幅",
        description: "STOXX Europe 600構成銘柄の騰落比率。>1=上昇銘柄が多い。<1=下落銘柄が多い。欧州は国ごとに経済格差が大きい——全体幅より国内幅の方が意味があることも。",
        ranges: [
          { max: 0.5, label: "<0.5", meaning: "極度弱——欧州全域で売り", color: "red" },
          { max: 0.9, label: "0.5-0.9", meaning: "やや弱", color: "yellow" },
          { max: 1.3, label: "0.9-1.3", meaning: "均衡", color: "neutral" },
          { max: 2.0, label: "1.3-2.0", meaning: "やや強", color: "green" },
          { max: 999, label: ">2.0", meaning: "強——欧州全域で買い", color: "bright" },
        ],
        signal: "STOXX幅>2+VDAX<15 = 欧州リスクオン——最強の買い環境。DAXが引っ張り、周辺国が追随する展開。",
        unit: "倍",
      },

      // ── 11. 欧州周縁国スプレッド ──
      {
        id: "eu_periphery_spread",
        name: "周縁スプレッド",
        emoji: "⚡",
        oneliner: "イタリア·スペイン国債 vs ドイツ国債——欧州のストレス指標",
        description: "イタリア10年国債利回り－ドイツ10年国債利回りのスプレッド。>200bp=イタリアへの信認低下(ユーロ圏のストレス)。>300bp=危機レベル。欧州株式市場はこのスプレッドに敏感——スプレッド拡大=銀行株·イタリア株が売られる。",
        ranges: [
          { max: 150, label: "<150bp", meaning: "正常——周縁国リスク低い", color: "green" },
          { max: 200, label: "150-200bp", meaning: "やや警戒——イタリア政治不安か", color: "yellow" },
          { max: 300, label: "200-300bp", meaning: "危険——ユーロ圏ストレス。銀行株注意", color: "red" },
          { max: 999, label: ">300bp", meaning: "危機——ソブリン危機再燃の可能性", color: "dark" },
        ],
        signal: "スプレッド急拡大 = 欧州銀行株の「売り」シグナル。2011年ソブリン危機の再現に注意。",
        unit: "bp",
      },

      // ── 12. 欧州セクターローテーション ──
      {
        id: "eu_sector_rotation",
        name: "セクター",
        emoji: "🔄",
        oneliner: "欧州セクター間の資金回転——景気サイクルの位置",
        description: "STOXX 600の10セクターの相対パフォーマンス。銀行·自動車が強い=景気拡大期待。公益·ヘルスケアが強い=ディフェンシブシフト(景気減速警戒)。エネルギーが強い=コモディティ·スーパーサイクル。",
        sectors: ["銀行", "自動車", "エネルギー", "素材", "テクノロジー", "消費", "公益", "ヘルスケア", "不動産", "通信"],
        signal: "銀行·自動車→公益·ヘルスケアへの資金シフト = 景気サイクルのピークアウト警戒シグナル。逆に公益→銀行へのシフト=景気回復期待。",
        unit: "相対リターン %",
      },
    ],
  },
};

// ── 12指標一覧 ──
export const KR_TW_EU_12_LIST = [
  "kr_foreign_net", "kr_institution_net", "kr_individual_net", "kr_kospi_vix",
  "tw_foreign_net", "tw_trust_net", "tw_dealer_net", "tw_taiex_vix",
  "eu_vdax", "eu_stoxx_breadth", "eu_periphery_spread", "eu_sector_rotation",
];

export default KR_TW_EU_12_INDICATORS;
