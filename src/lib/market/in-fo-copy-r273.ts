// ══ R273 QClaw Task 1: 印度F&O文案 (2h) ══
// 印度独有: F&O期货期权+Rollover展期+FII/DII外资/内资
// 交付: src/lib/market/in-fo-copy-r273.ts

export const IN_FO_COPY = {

  panelTitle: "F&O Dashboard",
  panelSubtitle: "インド先物·オプション — 世界最大のデリバティブ市場の一つ",

  // ── 1. F&O 基础 ──
  basics: {
    whatIs: "F&O=Futures & Options。印度国家证券交易所(NSE)的期货期权市场——日均成交额全球前三。每月最后一个周四到期(每月最后一个星期四=Expiry Day)。",
    expiryNote: "毎月最終木曜日がSQ(特別清算指数)算出日。SQ週(満期週)は取引量とボラティリティが急増する——インド市場で一番重要な日。",
    segments: {
      indexFutures: "指数先物",
      indexOptions: "指数オプション",
      stockFutures: "個別株先物",
      stockOptions: "個別株オプション",
    },
    keyIndex: {
      nifty: "Nifty 50 — インドの代表指数",
      bankNifty: "Bank Nifty — 銀行株指数(最も活発に取引されるF&O商品)",
      finNifty: "Fin Nifty — 金融サービス指数",
      sensex: "Sensex — BSE(ボンベイ証券取引所)の指数",
    },
  },

  // ── 2. Open Interest & Rollover ──
  oiRollover: {
    title: "建玉(OI)とロールオーバー",
    description: "ロールオーバー=当月限の建玉を翌月限に移すこと。ロール率が高い=市場参加者がポジションを持ち越す意思が強い=トレンド継続の可能性大。",

    metrics: {
      oi: "建玉(Open Interest)",
      oiChange: "建玉変化",
      rolloverRate: "ロールオーバー率",
      rolloverCost: "ロールコスト",
      pcr: "プット/コール比率(PCR)",
      maxPain: "マックスペイン",
    },

    interpretation: {
      oiUpPriceUp: "OI↑+価格↑ = 強気 — 新規買いが続々入っている",
      oiUpPriceDown: "OI↑+価格↓ = 弱気 — 新規売りが積み上がっている",
      oiDownPriceUp: "OI↓+価格↑ = 買いの巻き戻し — 上昇の勢いが弱まっている",
      oiDownPriceDown: "OI↓+価格↓ = 売りの巻き戻し — 下落の勢いが弱まっている",
      rolloverHigh: "ロールオーバー>70% = 強気の持ち越し — 市場参加者はトレンド継続を見込んでいる",
      rolloverLow: "ロールオーバー<50% = 弱気 — ポジションを清算して逃げている",
      pcrHigh: "PCR>1.5 = プットが多い=警戒感強い。ただし極端に高いと逆に底打ちのシグナル",
      pcrLow: "PCR<0.7 = コールが多い=強気。ただし極端に低いと過熱感",
      maxPain: "マックスペイン=オプションの買い手が一番損をする価格。SQ日にこの価格に収束しやすい——インド市場の「磁石の法則」。",
    },

    expiryWeek: "⏰ 今週はSQ週！取引量急増+値動きが荒くなる。マックスペイン価格を意識して。最終木曜日の午後は特に注意。",
  },

  // ── 3. FII/DII 外资/内资 ──
  fiiDii: {
    title: "FII/DII 資金フロー",
    description: "FII=海外機関投資家(外国のファンド), DII=国内機関投資家(インドのファンド)。FIIとDIIはしばしば逆の動きをする——DIIはFIIの売りを買い支える「防衛ライン」。",

    metrics: {
      fiiNet: "FIIネット",
      diiNet: "DIIネット",
      fiiBuy: "FII買い",
      fiiSell: "FII売り",
      diiBuy: "DII買い",
      diiSell: "DII売り",
      netTotal: "合計ネット",
      monthlyTotal: "月間累計",
    },

    columns: {
      date: "日付",
      fiiBuy: "FII買い(₹Cr)",
      fiiSell: "FII売り(₹Cr)",
      fiiNet: "FIIネット",
      diiBuy: "DII買い(₹Cr)",
      diiSell: "DII売り(₹Cr)",
      diiNet: "DIIネット",
    },

    interpretation: {
      fiiSellingDiiBuying: "FII売り+DII買い = 典型的パターン — 外国人は売っているがインド国内マネーは買い支えている。DIIが買い続ける限り=大崩れしにくい。",
      fiiDiiBothBuy: "FII買い+DII買い = 最強の強気シグナル — 外人も国内勢も買っている=全員強気。大相場の可能性。",
      fiiDiiBothSell: "FII売り+DII売り = 最弱の弱気シグナル — 全員が逃げている。パンデミック級の時だけ見られる。",
      fiiConsecutive: "FII連続{n}日売り越し — これは普通のこと。インド市場ではFIIの断続的な売り越しは珍しくない。DIIが買い支えているかを注視。",
      rupeeNote: "₹クロール(Crore=1000万ルピー)。1クロール≈12万米ドル(目安)。数字が大きいが気にしないで——クロールはインド市場の標準単位。",
    },

    dataTiming: "FII/DIIデータはSEBI(インド証券取引委員会)が翌営業日に公表。1日遅れ——リアルタイムではありません。",
  },

  // ── 4. 通知 ──
  alerts: {
    expiryWeekStart: "🇮🇳 SQ週スタート — Nifty/Bank Nifty 満期日{date}。OIロールオーバー開始",
    expiryDay: "🇮🇳 本日SQ日 — Nifty/Bank Nifty 最終取引。マックスペイン {price}。14:00以降ボラ急増注意",
    fiiBigSell: "🇮🇳 FII大幅売り越し — {amount}₹Cr — DIIは{diiamount}₹Cr買い支え",
    fiiBigBuy: "🇮🇳 FII大幅買い越し — {amount}₹Cr — 外国人投資家の強気転換",
    pcrExtreme: "🇮🇳 Nifty PCR {ratio} — {interpretation}",
    oiSpike: "🇮🇳 {symbol} OI急増 — {change}% — {interpretation}",
  },
};

export default IN_FO_COPY;
