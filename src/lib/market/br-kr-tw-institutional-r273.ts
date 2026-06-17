// ══ R273 QClaw Task 2: 巴西+韩国+台湾文案 (2h) ══
// 🇧🇷期权+ADR / 🇰🇷三大法人 / 🇹🇼三大法人
// 交付: src/lib/market/br-kr-tw-institutional-r273.ts

export const BR_KR_TW_COPY = {

  // ── 🇧🇷 巴西: 期权+ADR ──
  brazil: {
    panelTitle: "🇧🇷 オプション & ADR",
    panelSubtitle: "ブラジル市場の独自要素",

    options: {
      title: "B3オプション市場",
      description: "B3(ブラジル証券取引所)のオプション市場。ペトロブラス(PETR4)とヴァーレ(VALE3)が取引の中心。ブラジルオプションの特徴=ボラティリティが極めて高い——1日のIVが50%を超えることも珍しくない。",
      metrics: {
        iv: "インプライド・ボラティリティ",
        hv: "ヒストリカル・ボラティリティ",
        ivPercentile: "IVパーセンタイル",
        ivSkew: "IVスキュー",
        pcr: "プット/コール比",
        optionsVolume: "オプション出来高",
      },
      tips: {
        highIv: "IVが極端に高い(>60%)=ブラジル市場は「何か大きなことを織り込んでいる」。政治的イベント、コモディティショック、通貨危機——ブラジルはボラタイルな市場だということを忘れないで。",
        petrobras: "PETR4(Petrobras)のオプションは原油価格+政治リスクの二重の賭け。原油が上がっても政治スキャンダルが出れば株は下がる——どちらを賭けているのか分からなくなる。",
        adr: "PBR(ペトロブラスADR)/VALE(ヴァーレADR)は米国市場で取引されるブラジル株のADR。ADRとブラジル現地株の価格差は通貨変動(BRL/USD)を反映している。",
      },
    },

    adr: {
      title: "ADR価格差",
      description: "ADR=米国預託証券。ブラジル株が米国市場で取引される形態。ADR価格と現地株価格の差=為替+市場間の流動性格差。",
      metrics: {
        adrPrice: "ADR価格(USD)",
        localPrice: "現地価格(BRL)",
        impliedFx: "市場含意為替レート",
        spotFx: "実勢為替レート",
        premium: "ADRプレミアム/ディスカウント",
      },
      premium: {
        positive: "プレミアム>3% = ADRが割高。米国投資家がブラジルに強気。",
        negative: "ディスカウント>3% = ADRが割安。米国投資家がブラジルから逃げている。",
        neutral: "±3%以内 = 正常範囲。裁定取引で価格差は修正される。",
      },
    },
  },

  // ── 🇰🇷 韩国: 三大法人 ──
  korea: {
    panelTitle: "🇰🇷 3대법인(투자자별 매매동향)",
    panelSubtitle: "外国人·機関·個人——誰が買って誰が売っているか",

    basics: {
      whatIs: "韓国市場の「投資者別売買動向」。外国人の売買動向が最も注目される——「外人が買えば上がる、売れば下がる」と言われるほど。個人投資家は逆に動くことが多い(外人が売った株を個人が拾う=「個人の逆張り」)。",
      parties: {
        foreign: "외국인 外国人",
        institution: "기관 機関",
        individual: "개인 個人",
      },
    },

    columns: {
      date: "日付",
      foreignNet: "외국인 순매수",
      institutionNet: "기관 순매수",
      individualNet: "개인 순매수",
      foreignBuy: "외국인 매수",
      foreignSell: "외국인 매도",
      kospiForeignNet: "KOSPI 외국인",
      kosdaqForeignNet: "KOSDAQ 외국인",
    },

    signals: {
      foreignBuy: "外国人買い越し{n}日連続 = 強気シグナル——特に半導体(サムスン/SKハイニックス)に集中している場合は本格的な上昇相場の可能性。",
      foreignSell: "外国人売り越し{n}日連続 = 注意——ただし個人が買い支えている間は急落しにくい。個人の買い余力が尽きた時に注意。",
      foreignSemiBuy: "外国人+半導体銘柄集中買い = 最も強い韓国株シグナル——サムスン電子·SKハイニックスに外人買いが集中するとKOSPI全体が押し上げられる。",
      foreignShift: "外国人 KOSPI→KOSDAQシフト = 大型株から中小型株への資金シフト。リスク選好度が上がっているシグナル。", 
      program: "プログラム売買(차익+비차익) = 裁定取引·バスケット取引の動き。プログラム買い越し=機関投資家の機械的な買い。プログラム売り越し=ヘッジ需要。",
    },

    dataNote: "データはKRX(韓国取引所)が毎日15:30以降に公表。単位=億ウォン。1億ウォン≈7.5万米ドル(目安)。",
  },

  // ── 🇹🇼 台湾: 三大法人 ──
  taiwan: {
    panelTitle: "🇹🇼 三大法人買賣超",
    panelSubtitle: "外資·投信·自営——台湾市場を動かす三つの力",

    basics: {
      whatIs: "台湾市場の三大法人=外資(外国機関投資家)+投信(国内投資信託)+自営(証券会社自己売買部門)。外資が台湾市場の最大のプレイヤー——特にTSMC(台積電)の外資売買は台湾加権指数全体を動かす。",
      parties: {
        foreign: "外資",
        investmentTrust: "投信",
        dealer: "自営商",
      },
    },

    columns: {
      date: "日期",
      foreignNet: "外資買賣超",
      invTrustNet: "投信買賣超",
      dealerNet: "自營商買賣超",
      totalNet: "三大法人合計",
      foreignBuy: "外資買進",
      foreignSell: "外資賣出",
    },

    signals: {
      foreignBuy: "外資連{n}買 = 強気——特にTSMCへの集中買いは要注意。TSMCが加権指数の30%以上を占める=TSMCへの外資買いは指数全体を押し上げる。",
      foreignSell: "外資連{n}賣 = 弱気——ただし投信が買い支えている間は崩れにくい。投信は台湾の「護盤(市場防衛)」役。",
      invTrustBuy: "投信連買 = 国内マネーが強気——「元大」「国泰」などの台湾投信が買い続けているときは安心感がある。",
      dealerHedging: "自営商売り越し = 証券会社のヘッジ売り。これは必ずしも弱気ではない——顧客のワラント発行に伴うヘッジの場合が多い。自営商の数字を単独で判断しない。",
      tsmcForeign: "TSMC外資買い越し{n}億NT$ = 最重要シグナル。TSMC=台湾市場の心臓——外資がTSMCを買えば加権指数は上がる。シンプルだが本当。",
    },

    dataNote: "データはTWSE(台湾証券取引所)が毎日14:30以降に公表。単位=億NTドル。1億NTドル≈310万米ドル(目安)。",
  },
};

export default BR_KR_TW_COPY;
