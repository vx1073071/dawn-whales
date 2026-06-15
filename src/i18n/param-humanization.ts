/* ════════════════════════════════════════════════════════════════════════════
 * R226 QC-2.4 — 参数人话化文案 (Parameter Humanization Copy)
 * 
 * 覆盖: 46 个含 deepSeekChat 的策略模板
 * 语言: zh-CN / en / ja
 * 
 * 设计原则:
 * - humanLabel: ≤8 汉字/≤15 英文 (简洁, 适合 UI label)
 * - humanDesc: ≤30 汉字/≤60 英文 (一句话解释, 适合 tooltip)
 * - 用交易者听得懂的日常类比替代技术术语
 * ════════════════════════════════════════════════════════════════════════════ */

export const PARAM_HUMAN_MAP: Record<string, {
  'zh-CN': { label: string; desc: string };
  en: { label: string; desc: string };
  ja: { label: string; desc: string };
}> = {

  // ── Financial metrics ──
  peMax: {
    'zh-CN': { label: '市盈率上限', desc: '公司股价不超过每股盈利的多少倍，数值越低越保守' },
    en: { label: 'PE Cap', desc: 'Max price-to-earnings ratio; lower = more conservative stock selection' },
    ja: { label: 'PER上限', desc: '株価が1株利益の何倍まで許容するか; 低いほど保守的' },
  },
  pbMax: {
    'zh-CN': { label: '市净率上限', desc: '公司股价不超过每股净资产的多少倍，抓被低估的公司' },
    en: { label: 'PB Cap', desc: 'Max price-to-book ratio; catches undervalued companies below book value' },
    ja: { label: 'PBR上限', desc: '株価が純資産の何倍までか; 割安株を見つける閾値' },
  },
  pbThreshold: {
    'zh-CN': { label: '破净阈值', desc: '股价跌到净资产的多少倍才算严重低估，低于1=跌破净资产' },
    en: { label: 'Book Threshold', desc: 'PB floor for deep-value entry; below 1 = trading below liquidation value' },
    ja: { label: '解散価値閾値', desc: 'PBRがここを下回ったら割安と判断; 1未満=解散価値割れ' },
  },
  roeMin: {
    'zh-CN': { label: 'ROE最低线', desc: '公司用股东的钱每年至少赚多少，低于这条线的公司不碰' },
    en: { label: 'Min ROE', desc: 'Minimum return on equity a company must generate; filters out capital destroyers' },
    ja: { label: '最低ROE', desc: '株主資本に対する最低利回り; これを下回る会社は除外' },
  },
  peMax_alt: {
    'zh-CN': { label: 'PE上限', desc: '买入时市盈率不能超过此值，防止追高买贵' },
    en: { label: 'PE Cap', desc: 'Max PE at entry; prevents buying at inflated valuations' },
    ja: { label: 'PER上限', desc: '購入時PERの上限; 高値掴みを防ぐ' },
  },

  // ── Stop loss / Risk ──
  stopLossPct: {
    'zh-CN': { label: '止损线', desc: '亏损到百分之多少就果断卖，保命红线' },
    en: { label: 'Stop Loss', desc: 'Cut losses when drawdown hits this percentage; your survival line' },
    ja: { label: '損切りライン', desc: 'この損失率に達したら即決済; 命綱のライン' },
  },
  trailingStop: {
    'zh-CN': { label: '移动止损', desc: '价格从最高点回落这么多就止盈，让利润奔跑但有底线' },
    en: { label: 'Trailing Stop', desc: 'Lock profits when price drops this far from peak; let winners run with a floor' },
    ja: { label: 'トレーリング', desc: '最高値からこの％下落で利確; 利益を伸ばしつつ最低限を確保' },
  },
  maxDrawdown: {
    'zh-CN': { label: '最大回撤', desc: '整个策略从高点最多允许跌多少，超过就暂停' },
    en: { label: 'Max DD', desc: 'Maximum allowed drawdown from peak for the whole strategy before pause' },
    ja: { label: '最大DD', desc: '戦略全体の高値からの最大許容下落率; 超えたら一時停止' },
  },
  maxDrawdownLimit: {
    'zh-CN': { label: '回撤熔断', desc: '单次回撤到多少就触发保护，防连续亏损' },
    en: { label: 'DD Circuit', desc: 'Circuit breaker: pause trading when single drawdown exceeds this level' },
    ja: { label: 'DD遮断器', desc: '1回のドローダウンがここまで達したら取引停止' },
  },

  // ── Position sizing ──
  positionSize: {
    'zh-CN': { label: '仓位比例', desc: '这只股票占你总资金的比例，别把鸡蛋放一个篮子里' },
    en: { label: 'Position Size', desc: 'How much of your portfolio goes into one bet; don\'t put all eggs in one basket' },
    ja: { label: 'ポジション比率', desc: '1銘柄に投じる資金割合; 卵は一つのかごに盛るな' },
  },
  maxPosition: {
    'zh-CN': { label: '持仓上限', desc: '单只股票最多占总资金的比例，防集中风险' },
    en: { label: 'Max Position', desc: 'Hard cap on single-stock exposure to prevent concentration risk' },
    ja: { label: '最大保有', desc: '1銘柄の最大資金比率; 集中リスク防止' },
  },
  positionPct: {
    'zh-CN': { label: '仓位占比', desc: '这个策略用多少资金来跑，其余的留着备用' },
    en: { label: 'Allocation', desc: 'What percentage of capital this strategy uses; the rest stays as buffer' },
    ja: { label: '資金配分', desc: 'この戦略に割り当てる資金比率; 残りはバッファ' },
  },
  maxPositionPct: {
    'zh-CN': { label: '开仓上限', desc: '一次最多拿总资金的多少去开仓' },
    en: { label: 'Entry Cap', desc: 'Maximum capital committed per entry signal' },
    ja: { label: '建玉上限', desc: '1シグナルあたりの最大資金投入率' },
  },
  maxLeverage: {
    'zh-CN': { label: '杠杆倍数', desc: '借多少钱放大收益，3倍=跌33%就爆仓，慎用' },
    en: { label: 'Leverage', desc: 'Borrow multiplier; 3x = liquidation at 33% drop — use with extreme caution' },
    ja: { label: 'レバレッジ', desc: '借入倍率; 3倍=33%下落でロスカット; 慎重に' },
  },

  // ── Timing / Holding ──
  holdingDays: {
    'zh-CN': { label: '持有时长', desc: '买了拿多久，短线几小时、中线几天、长线几周到几月' },
    en: { label: 'Hold Period', desc: 'How long to hold; hours=intraday, days=swing, weeks=position trade' },
    ja: { label: '保有期間', desc: '何日保有するか; 時間=デイトレ、日=スイング、週=ポジション' },
  },
  holdingMonths: {
    'zh-CN': { label: '持有月数', desc: '长线策略拿几个月，分红/价值类通常3-12个月' },
    en: { label: 'Hold Months', desc: 'Position holding in months; typically 3-12 for dividend/value strategies' },
    ja: { label: '保有月数', desc: '長期保有の月数; 配当・バリュー系は通常3-12ヶ月' },
  },
  maxHoldingHours: {
    'zh-CN': { label: '最长持仓', desc: '最多拿多少小时，到期无论盈亏都平仓' },
    en: { label: 'Max Hours', desc: 'Hard time limit in hours; close regardless of PnL when time expires' },
    ja: { label: '最大保有時間', desc: '時間制限; ここまで来たら損益に関わらず決済' },
  },
  timeHorizon: {
    'zh-CN': { label: '投资周期', desc: '策略适合多久一次操作，跟你的交易频率要对上' },
    en: { label: 'Time Horizon', desc: 'Natural rhythm of this strategy; must match your trading frequency' },
    ja: { label: '投資期間', desc: '戦略の自然なリズム; 自分の取引頻度と合わせること' },
  },
  rotationPeriod: {
    'zh-CN': { label: '轮动周期', desc: '多久换一次仓，周=每周调仓，月=每月调仓' },
    en: { label: 'Rotation Cycle', desc: 'How often to rebalance; weekly=fast, monthly=steady' },
    ja: { label: 'ローテ周期', desc: 'リバランス頻度; 週=速い、月=安定' },
  },

  // ── Rebalance ──
  rebalanceFrequency: {
    'zh-CN': { label: '调仓频率', desc: '多久重新调整一次仓位配比，跟市场变化同步' },
    en: { label: 'Rebalance', desc: 'How often weights are reset to target; keeps risk aligned with plan' },
    ja: { label: 'リバランス', desc: '目標比率に戻す頻度; リスクを計画通りに保つ' },
  },
  rebalancePeriod: {
    'zh-CN': { label: '再平衡周期', desc: '多少天调整一次仓位，让组合回到目标配比' },
    en: { label: 'Rebalance Days', desc: 'Days between portfolio weight resets to target allocation' },
    ja: { label: '再調整日数', desc: 'ポートフォリオを目標配分に戻す間隔日数' },
  },
  rebalanceQuarter: {
    'zh-CN': { label: '调仓节奏', desc: '按季度还是月度调仓，跟财报/分红节奏配合' },
    en: { label: 'Rebalance Pace', desc: 'Quarterly vs monthly rebalancing; align with earnings/dividend cycles' },
    ja: { label: '調整ペース', desc: '四半期か月次か; 決算・配当サイクルに合わせる' },
  },
  rotationFrequency: {
    'zh-CN': { label: '换仓天数', desc: '每隔多少天卖掉弱的换强的，太快=频繁交易成本高' },
    en: { label: 'Rotation Days', desc: 'Days between selling losers and buying winners; too fast = high churn cost' },
    ja: { label: 'ローテ日数', desc: '弱い銘柄を売り強い銘柄に乗換える間隔; 短すぎるとコスト増' },
  },

  // ── Momentum / Trend ──
  momentumLookback: {
    'zh-CN': { label: '动量回看', desc: '往回看多久来判断涨跌趋势，3个月=季度的动量' },
    en: { label: 'Momentum Window', desc: 'Lookback period for trend; 3 months = quarterly momentum' },
    ja: { label: 'モメンタム期間', desc: 'トレンド判定の遡り期間; 3ヶ月=四半期モメンタム' },
  },
  momentumPeriod: {
    'zh-CN': { label: '动量天数', desc: '用过去多少天的涨跌来衡量趋势强度' },
    en: { label: 'Momentum Days', desc: 'Number of days used to measure trend strength' },
    ja: { label: 'モメンタム日数', desc: 'トレンド強度を測る遡り日数' },
  },
  momentumThreshold: {
    'zh-CN': { label: '动量门槛', desc: '趋势要多强才算有效，太低=假信号，太高=等不到机会' },
    en: { label: 'Momentum Bar', desc: 'Minimum trend strength to trigger; too low=noise, too high=missed chances' },
    ja: { label: 'モメンタム閾値', desc: 'シグナル発動の最低トレンド強度; 低すぎ=ノイズ、高すぎ=機会損失' },
  },
  trendPeriod: {
    'zh-CN': { label: '趋势周期', desc: '用多少天来判断主要趋势方向，跟随大势' },
    en: { label: 'Trend Period', desc: 'Days for identifying the dominant trend direction; follow the big picture' },
    ja: { label: 'トレンド周期', desc: '主要トレンド方向を判断する日数; 大局に従う' },
  },
  minMomentumScore: {
    'zh-CN': { label: '动量及格线', desc: '动量评分起码过这条线才考虑买入，筛掉弱势股' },
    en: { label: 'Momentum Pass', desc: 'Minimum momentum score to qualify; filters out weak stocks' },
    ja: { label: 'モメンタム合格', desc: '最低モメンタムスコア; 弱い銘柄をふるい落とす' },
  },

  // ── Signal / Entry ──
  signalThreshold: {
    'zh-CN': { label: '信号强度', desc: '综合信号要多强才下单，低=多交易但可能假信号多' },
    en: { label: 'Signal Strength', desc: 'Composite signal threshold to fire; lower=more trades but more false signals' },
    ja: { label: 'シグナル強度', desc: '発注に必要な総合シグナル強度; 低=取引多+誤信号多' },
  },
  premiumThreshold: {
    'zh-CN': { label: '溢价门槛', desc: 'AH/跨市场价差多大才值得套利，太小=不够手续费' },
    en: { label: 'Premium Floor', desc: 'Minimum cross-market spread for arbitrage; too narrow = not worth fees' },
    ja: { label: 'プレミアム下限', desc: '裁定取引に必要な最低価格差; 狭すぎ=手数料割れ' },
  },
  premiumEntry: {
    'zh-CN': { label: '溢价入场', desc: '折价/溢价到这个幅度就动手套利' },
    en: { label: 'Premium Entry', desc: 'Discount/premium threshold to trigger arbitrage entry' },
    ja: { label: 'プレミアム参入', desc: '裁定取引を発動する割引/割増率' },
  },
  spreadEntry: {
    'zh-CN': { label: '价差入场', desc: '两个相关品种价差拉大到多少时进场，等待价差收敛赚钱' },
    en: { label: 'Spread Entry', desc: 'Enter when spread between related assets widens; profit from convergence' },
    ja: { label: 'スプレッド参入', desc: '関連銘柄間スプレッドがここまで開いたら参入; 収束で利益' },
  },
  spreadThreshold: {
    'zh-CN': { label: '价差收窄', desc: '价差回到多少就平仓止盈，价差收敛=套利成功' },
    en: { label: 'Spread Exit', desc: 'Close when spread narrows to this level; convergence = arbitrage complete' },
    ja: { label: 'スプレッド決済', desc: 'スプレッドがここまで縮まったら利確; 収束=裁定成功' },
  },
  reEntryCooldown: {
    'zh-CN': { label: '冷却间隔', desc: '止损后再等几天才能重新开仓，避免情绪化报复交易' },
    en: { label: 'Cooldown Days', desc: 'Wait days after stop-loss before re-entry; prevents revenge trading' },
    ja: { label: '冷却日数', desc: '損切り後再参入までの待機日数; リベンジ取引を防ぐ' },
  },

  // ── Dividend / Yield ──
  divYieldMin: {
    'zh-CN': { label: '最低股息', desc: '每年分红至少百分之几才考虑，股息太低不够吸引力' },
    en: { label: 'Min Dividend %', desc: 'Minimum annual dividend yield to qualify; too low = not worth the hold' },
    ja: { label: '最低配当利回り', desc: '年間配当利回りの最低ライン; 低すぎると保有価値なし' },
  },
  dividendMin: {
    'zh-CN': { label: '分红底线', desc: '股息率低于这条线的股票不纳入候选' },
    en: { label: 'Dividend Floor', desc: 'Minimum dividend yield for stock selection' },
    ja: { label: '配当下限', desc: '銘柄選択に必要な最低配当利回り' },
  },
  yieldMin: {
    'zh-CN': { label: '最低收益率', desc: '策略预期年化收益必须超过这个数，低于储蓄不如存银行' },
    en: { label: 'Min Yield', desc: 'Minimum expected annual return; below this, you\'re better off in a savings account' },
    ja: { label: '最低利回り', desc: '最低期待年利回り; これを下回るなら預金の方がマシ' },
  },
  minAPY: {
    'zh-CN': { label: '最低年化', desc: 'DeFi/质押年化收益最低要求，低于就不值得锁仓' },
    en: { label: 'Min APY', desc: 'Minimum DeFi/staking annual yield; below this, locking capital isn\'t worth it' },
    ja: { label: '最低APY', desc: 'DeFi/ステーキングの最低年利; これを下回るとロックする価値なし' },
  },
  frankingYield: {
    'zh-CN': { label: '税收抵扣', desc: '股息含税抵扣后实际收益，澳洲特有的税务优势' },
    en: { label: 'Franking Yield', desc: 'After-tax dividend yield with franking credits; Australia-specific advantage' },
    ja: { label: '税控除後利回り', desc: '税額控除込みの実質配当利回り; 豪州固有の税制優遇' },
  },

  // ── Market flow / Sentiment ──
  flowThreshold: {
    'zh-CN': { label: '资金流强度', desc: '北向/南向资金流多强才算有效信号，抓主力动向' },
    en: { label: 'Flow Strength', desc: 'Northbound/Southbound capital flow threshold to trigger; follows smart money' },
    ja: { label: '資金流強度', desc: 'ノース/サウスバウンド資金流のトリガー強度; スマートマネー追随' },
  },
  sentimentThreshold: {
    'zh-CN': { label: '情绪临界点', desc: '市场恐惧/贪婪到多少才触发反向操作，别人恐惧我贪婪' },
    en: { label: 'Fear/Greed Trigger', desc: 'Sentiment extreme to trigger contrarian move; be greedy when others are fearful' },
    ja: { label: 'センチメント閾値', desc: '逆張り発動の恐怖/強欲レベル; 人が恐れる時に貪欲に' },
  },
  foreignFlow: {
    'zh-CN': { label: '外资流阈值', desc: '外资净买入超过多少亿才跟进，跟着聪明钱走' },
    en: { label: 'Foreign Flow', desc: 'Foreign net-buy threshold in billions; follow the smart money' },
    ja: { label: '外人買い越し', desc: '外国人のネット買い越し額の閾値; スマートマネーに追随' },
  },
  shortRatio: {
    'zh-CN': { label: '沽空比例', desc: '沽空占总成交多少以上算危险信号，太高可能被逼空' },
    en: { label: 'Short Ratio', desc: 'Short selling as % of volume; too high = squeeze risk or bearish signal' },
    ja: { label: '空売り比率', desc: '出来高に占める空売り比率; 高すぎ=ショートスクイーズ警戒' },
  },
  longShortRatio: {
    'zh-CN': { label: '多空比', desc: '多头资金vs空头资金的比值，大于2=市场过度乐观' },
    en: { label: 'Long/Short', desc: 'Long vs short capital ratio; above 2 = excessive bullish positioning' },
    ja: { label: 'ロング/ショート比', desc: 'ロング資金対ショート資金の比率; 2超=過度な強気' },
  },
  cottonThreshold: {
    'zh-CN': { label: 'COT阀值', desc: '大户持仓极端到什么程度才反向操作，跟着大钱走，但别追尾' },
    en: { label: 'COT Extreme', desc: 'COT positioning extreme threshold; follow big money, but don\'t chase the tail' },
    ja: { label: 'COT極限', desc: '投機筋ポジションの極限閾値; 大金に従うが追いかけすぎない' },
  },

  // ── Filter conditions ──
  minLiquidity: {
    'zh-CN': { label: '最低流动性', desc: '股票每天成交起码这么多才好进出，太小=想卖卖不掉' },
    en: { label: 'Min Liquidity', desc: 'Minimum daily volume to ensure you can exit; too thin = trapped position' },
    ja: { label: '最低流動性', desc: '最低日次出来高; 薄すぎると出口で詰まる' },
  },
  liqThreshold: {
    'zh-CN': { label: '流动性线', desc: '日成交低于这个数就不碰，给自己留退路' },
    en: { label: 'Liquidity Line', desc: 'Skip stocks with daily volume below this; always keep an exit door' },
    ja: { label: '流動性ライン', desc: '日次出来高がこれを下回る銘柄は除外; 出口を常に確保' },
  },
  numHoldings: {
    'zh-CN': { label: '持仓数量', desc: '最多同时持有几只股票，太多看不过来，太少风险集中' },
    en: { label: 'Holdings Count', desc: 'Maximum concurrent positions; too many=unmanageable, too few=concentrated risk' },
    ja: { label: '保有銘柄数', desc: '最大同時保有数; 多すぎ=管理不能、少なすぎ=集中リスク' },
  },
  numPicks: {
    'zh-CN': { label: '选股数量', desc: '每次从候选池里挑几只最强的，精选优于撒网' },
    en: { label: 'Top Picks', desc: 'Number of strongest candidates selected per batch; quality over quantity' },
    ja: { label: '選抜数', desc: '候補プールから選ぶ上位銘柄数; 質は量に勝る' },
  },
  topSectors: {
    'zh-CN': { label: '行业聚焦', desc: '只关注最强势的几个行业板块，不贪多' },
    en: { label: 'Sector Focus', desc: 'Limit to top-performing sectors only; don\'t spread too thin' },
    ja: { label: 'セクター数', desc: '最強セクターのみに絞る; 分散しすぎない' },
  },

  // ── Weight / Exposure ──
  dimensionWeight: {
    'zh-CN': { label: '维度权重', desc: '各评分维度的占比，调节你对不同因素的重视程度' },
    en: { label: 'Dimension Weight', desc: 'Relative importance of each scoring dimension; tune what you care about most' },
    ja: { label: '次元ウェイト', desc: '各評価次元の比重; 最も重視する要素を調整' },
  },
  hedgeRatio: {
    'zh-CN': { label: '对冲比例', desc: '用多少仓位做对冲保护，50%=一半攻一半守' },
    en: { label: 'Hedge Ratio', desc: 'How much of the position is hedged; 50% = half offense, half defense' },
    ja: { label: 'ヘッジ比率', desc: 'ポジションの何％をヘッジするか; 50%=攻守半々' },
  },
  goldWeight: {
    'zh-CN': { label: '黄金权重', desc: '组合里配多少黄金做避险，乱世黄金的配置比例' },
    en: { label: 'Gold Weight', desc: 'How much gold in the portfolio as a safe haven; crisis insurance allocation' },
    ja: { label: 'ゴールド比率', desc: 'ポートフォリオ内の金配分; 危機時の保険' },
  },

  // ── Crypto ──
  whaleThreshold: {
    'zh-CN': { label: '巨鲸门槛', desc: '单笔转账多少BTC算大户异动，跟庄还是跟大户' },
    en: { label: 'Whale Bar', desc: 'Transfer size in BTC to flag as whale movement; follow or fade?' },
    ja: { label: 'クジラ閾値', desc: '大口異動と判定するBTC転送量; 追随するか逆張りするか' },
  },
  whaleListSize: {
    'zh-CN': { label: '跟踪大户数', desc: '同时盯多少个巨鲸钱包，太多=噪音，太少=遗漏' },
    en: { label: 'Whale Count', desc: 'How many whale wallets to track; too many=noise, too few=miss movements' },
    ja: { label: 'クジラ追跡数', desc: '追跡するクジラウォレット数; 多すぎ=ノイズ、少なすぎ=見逃し' },
  },
  fundingThreshold: {
    'zh-CN': { label: '资金费率线', desc: '永续合约资金费率多少算极端，太高=多头拥挤→可能反转' },
    en: { label: 'Funding Rate', desc: 'Perpetual funding rate extreme threshold; too high=overcrowded longs→reversal' },
    ja: { label: '資金調達率', desc: '無期限先物の資金調達率極限; 高すぎ=ロング過密→反転警戒' },
  },
  exitFunding: {
    'zh-CN': { label: '退出费率', desc: '费率回到多少就平仓，费率回归正常=市场恢复理性' },
    en: { label: 'Exit Funding', desc: 'Close when funding rate normalizes to this level; market regains sanity' },
    ja: { label: '決済調達率', desc: '資金調達率がここまで正常化したら決済; 市場が正気に戻る' },
  },
  gasIndicator: {
    'zh-CN': { label: 'Gas费信号', desc: '链上Gas费高=链上活跃, 用来判断市场热度' },
    en: { label: 'Gas Signal', desc: 'On-chain gas as activity indicator; high gas = high chain usage = hot market' },
    ja: { label: 'ガス代信号', desc: 'オンチェーンガス代を活動指標として使用; 高い=市場活発' },
  },
  stablecoinMint: {
    'zh-CN': { label: '稳定币增发', desc: '稳定币新增发行量占比, 增发=新钱入场信号' },
    en: { label: 'Stablecoin Mint', desc: 'New stablecoin issuance weight; more minting = fresh capital entering' },
    ja: { label: 'ステーブル増発', desc: '新規ステーブルコイン発行の重み; 増加=新規資金流入' },
  },
  carryThreshold: {
    'zh-CN': { label: '利差门槛', desc: '现货与期货年化利差多大才套利，太小不够手续费' },
    en: { label: 'Carry Spread', desc: 'Minimum annualized spot-futures spread for carry trade; too thin = fee erosion' },
    ja: { label: 'キャリースプレッド', desc: '現物先物間の最低年率スプレッド; 薄すぎ=手数料負け' },
  },

  // ── Correlation / Volatility ──
  volAlertThreshold: {
    'zh-CN': { label: '波动预警', desc: 'VIX/波动率指数到多少就算恐慌，超出=避险模式开启' },
    en: { label: 'Volatility Alert', desc: 'VIX/volatility level triggering panic mode; above this = go defensive' },
    ja: { label: 'ボラティリティ警報', desc: 'VIXがここを超えたらパニックモード; 防御体制へ' },
  },
  volatility: {
    'zh-CN': { label: '波动率敞口', desc: '组合里波动率因素的权重，较高=更激进' },
    en: { label: 'Vol Exposure', desc: 'How much portfolio sensitivity to volatility; higher = more aggressive' },
    ja: { label: 'ボラティリティ感度', desc: 'ポートフォリオのボラティリティ感応度; 高い=攻撃的' },
  },
  corrAlertThreshold: {
    'zh-CN': { label: '相关性预警', desc: '两个资产相关度高到多少就注意，太高=同涨同跌没分散效果' },
    en: { label: 'Correlation Alarm', desc: 'Cross-asset correlation ceiling; too high = no diversification benefit' },
    ja: { label: '相関警報', desc: '資産間相関の上限; 高すぎ=分散効果なし' },
  },
  rateSensitivity: {
    'zh-CN': { label: '利率敏感度', desc: '利率变1%组合波动多少, 敏感度高=利率一动组合大波动' },
    en: { label: 'Rate Sensitivity', desc: 'Portfolio sensitivity to 1% rate change; high=big swings on rate moves' },
    ja: { label: '金利感応度', desc: '金利1%変動に対する感度; 高い=金利変動で大きく揺れる' },
  },
  commodityCorr: {
    'zh-CN': { label: '商品关联度', desc: '策略跟商品价格联动多强，用于通胀对冲' },
    en: { label: 'Commodity Corr', desc: 'Strategy correlation with commodity prices; used for inflation hedging' },
    ja: { label: '商品相関', desc: '戦略と商品価格の相関; インフレヘッジに使用' },
  },

  // ── DCA / Cost ──
  dcaAmount: {
    'zh-CN': { label: '定投金额', desc: '每次定投多少钱，不择时、不猜顶底' },
    en: { label: 'DCA Amount', desc: 'How much to invest each time; no timing, no guessing tops and bottoms' },
    ja: { label: '積立額', desc: '毎回の積立金額; タイミング計らず、天底予想せず' },
  },
  buybackWeight: {
    'zh-CN': { label: '回购权重', desc: '公司回购股票这个因素的权重, 回购=管理层看好' },
    en: { label: 'Buyback Weight', desc: 'How much buyback matters in scoring; buyback = management confidence' },
    ja: { label: '自社株買い比重', desc: '自社株買いの評価比重; 経営陣の自信の表れ' },
  },
  costLimit: {
    'zh-CN': { label: '成本上限', desc: '交易成本占总资金的比例上限，控制摩擦成本' },
    en: { label: 'Cost Cap', desc: 'Maximum transaction costs as % of capital; controls friction drag' },
    ja: { label: 'コスト上限', desc: '取引コストの対資本比率上限; 摩擦コストを抑制' },
  },
  costThreshold: {
    'zh-CN': { label: '成本阈值', desc: '费用超过这个基点就等一等，别让手续费吃掉利润' },
    en: { label: 'Cost Bar', desc: 'Fee threshold in basis points; above this, delay entry to protect margins' },
    ja: { label: 'コスト閾値', desc: '手数料のbps閾値; これを超えたら参入延期' },
  },
  borrowCost: {
    'zh-CN': { label: '借券成本', desc: '做空借股票的年化费率，成本太高就不值得空' },
    en: { label: 'Borrow Cost', desc: 'Annualized stock borrow rate for shorting; too expensive = not worth shorting' },
    ja: { label: '株借コスト', desc: '空売り用株借入の年率; 高すぎると空売りの価値なし' },
  },
  maxTurnover: {
    'zh-CN': { label: '换手上限', desc: '每次调仓最多换掉组合的多少，控制交易冲击成本' },
    en: { label: 'Turnover Cap', desc: 'Max portfolio turnover per rebalance; controls market impact' },
    ja: { label: '回転率上限', desc: 'リバランス毎の最大入れ替え率; 市場インパクトを制御' },
  },

  // ── Upside / Target ──
  targetReturn: {
    'zh-CN': { label: '目标收益', desc: '达到这个收益率就止盈，落袋为安' },
    en: { label: 'Target Return', desc: 'Take profit when return hits this level; lock it in' },
    ja: { label: '目標リターン', desc: 'このリターンに達したら利確; 確保する' },
  },
  discountTarget: {
    'zh-CN': { label: '折价目标', desc: '折价多少算够便宜了, 达到就买' },
    en: { label: 'Discount Target', desc: 'How cheap is cheap enough; buy when discount reaches this level' },
    ja: { label: '割安目標', desc: 'ここまで割安になったら買い; 十分安いと判断' },
  },

  // ── Nation / Sector specific ──
  esgThreshold: {
    'zh-CN': { label: 'ESG及格线', desc: '环保/社会/治理评分最低要求, 低于这个不做' },
    en: { label: 'ESG Threshold', desc: 'Minimum environmental/social/governance score; below=excluded' },
    ja: { label: 'ESG基準', desc: '環境/社会/ガバナンスの最低スコア; 以下は除外' },
  },
  greenTaxonomy: {
    'zh-CN': { label: '绿色标签', desc: '符合欧盟绿色分类法的业务占比权重' },
    en: { label: 'Green Taxonomy', desc: 'Weight for EU taxonomy-aligned revenue share' },
    ja: { label: 'グリーン分類', desc: 'EUタクソノミー適合収益比率の重み' },
  },
  carbonWeight: {
    'zh-CN': { label: '碳排放权重', desc: '碳排放指标在策略里的重要性，碳税风险定价' },
    en: { label: 'Carbon Weight', desc: 'Carbon emission importance in scoring; pricing in carbon tax risk' },
    ja: { label: '炭素ウェイト', desc: '炭素排出の評価比重; 炭素税リスクを織り込む' },
  },
  nisaAllocation: {
    'zh-CN': { label: 'NISA配置', desc: '日本免税账户内日股vs全球的比例, 利用税收优惠' },
    en: { label: 'NISA Split', desc: 'Japan tax-free account: domestic vs global allocation; maximize tax advantage' },
    ja: { label: 'NISA配分', desc: '日本株vsグローバルの比率; 税制優遇を最大活用' },
  },
  yenHedge: {
    'zh-CN': { label: '日元对冲', desc: '多少海外仓位做日元对冲，防汇率吞噬收益' },
    en: { label: 'Yen Hedge', desc: 'How much foreign exposure to yen-hedge; prevents FX from eating returns' },
    ja: { label: '円ヘッジ', desc: '海外エクスポージャーの円ヘッジ比率; 為替の収益侵食を防ぐ' },
  },
  audHedge: {
    'zh-CN': { label: '澳元对冲', desc: '澳元汇率对冲比例, 澳元波动大需要保护' },
    en: { label: 'AUD Hedge', desc: 'AUD FX hedge ratio; AUD is volatile, protection matters' },
    ja: { label: '豪ドルヘッジ', desc: '豪ドルの為替ヘッジ比率; AUDは変動が大きい' },
  },
  usdInrWeight: {
    'zh-CN': { label: '卢比兑美元', desc: '美元/卢比汇率的策略权重，印度进口依赖度高' },
    en: { label: 'USD/INR Weight', desc: 'Dollar-rupee FX weight; India has high import dependency' },
    ja: { label: 'ドル/ルピー比重', desc: 'ドルルピー為替の戦略比重; インドは輸入依存度が高い' },
  },
  semiconductorWeight: {
    'zh-CN': { label: '半导体权重', desc: '台积电和半导体在策略里的比重，台股核心驱动' },
    en: { label: 'Semicon Weight', desc: 'TSMC/semiconductor sector weight; core driver of Taiwan market' },
    ja: { label: '半導体比重', desc: 'TSMC/半導体セクターの比重; 台湾市場の中核' },
  },
  foreignWeight: {
    'zh-CN': { label: '外资动向', desc: '外资买卖的权重, 外资是台股主要推动力' },
    en: { label: 'Foreign Flow Wt', desc: 'Foreign investor flow weight; key driver of Taiwan equities' },
    ja: { label: '外人動向比重', desc: '外国人投資家フローの比重; 台湾株の主要ドライバー' },
  },
  fiiWeight: {
    'zh-CN': { label: '外资权重', desc: 'FII资金流在策略里的重要性，外资决定印度市场方向' },
    en: { label: 'FII Weight', desc: 'Foreign institutional investor weight; FIIs drive Indian market direction' },
    ja: { label: 'FII比重', desc: '外国人機関投資家の比重; FIIがインド市場方向を決める' },
  },
  exdivLookback: {
    'zh-CN': { label: '除权回看', desc: '往回看多少天捕捉除权除息机会' },
    en: { label: 'Ex-Div Window', desc: 'Lookback days to capture ex-dividend opportunities' },
    ja: { label: '権利落ち遡及', desc: '権利落ち機会を捉える遡り日数' },
  },
  oversubscription: {
    'zh-CN': { label: '超额认购', desc: 'IPO超额认购多少倍才算热，倍数越高越抢手' },
    en: { label: 'Oversubscription', desc: 'IPO oversubscription multiple to qualify as hot; higher = more demand' },
    ja: { label: '超過応募倍率', desc: 'IPOの超過応募倍率の閾値; 高いほど人気' },
  },
  consumptionSector: {
    'zh-CN': { label: '消费权重', desc: '消费品/内需行业的配置权重，内需是经济压舱石' },
    en: { label: 'Consumption Wt', desc: 'Consumer/domestic-demand sector weight; consumption anchors the economy' },
    ja: { label: '消費セクター比重', desc: '消費財・内需セクターの配分; 消費は経済の安定装置' },
  },
  ironOreWeight: {
    'zh-CN': { label: '铁矿石权重', desc: '铁矿石价格在澳洲策略里的重要度, 矿业大国' },
    en: { label: 'Iron Ore Wt', desc: 'Iron ore price weight in Australian strategy; mining-heavy economy' },
    ja: { label: '鉄鉱石比重', desc: '豪州戦略における鉄鉱石価格の比重; 鉱業大国' },
  },
  propertyType: {
    'zh-CN': { label: '物业类型', desc: 'REITs投写字楼/商场/工业还是综合型, 不同类型周期不同' },
    en: { label: 'Property Type', desc: 'REIT sector: office/retail/industrial/mixed; each has its own cycle' },
    ja: { label: '物件タイプ', desc: 'REIT対象: オフィス/商業/工業/混合; それぞれ周期が異なる' },
  },
  sectorRotation: {
    'zh-CN': { label: '板块轮动', desc: '多久切换一次板块，跟着经济周期轮转' },
    en: { label: 'Sector Rotation', desc: 'How often to rotate sectors; follow the economic cycle' },
    ja: { label: 'セクターローテ', desc: 'セクター切替頻度; 景気循環に従う' },
  },
  flipStrategy: {
    'zh-CN': { label: '打新策略', desc: '上市后持股/首日卖出/锁仓, 不同策略收益差很大' },
    en: { label: 'IPO Strategy', desc: 'Hold/sell-day1/lockup; post-IPO approach dramatically affects returns' },
    ja: { label: 'IPO戦略', desc: '上場後の保有/初日売却/ロックアップ; 戦略で収益が大きく変わる' },
  },

  // ── Macro ──
  cpiThreshold: {
    'zh-CN': { label: '通胀警戒线', desc: 'CPI超过这个数就进入防御模式，高通胀=股市承压' },
    en: { label: 'CPI Alert', desc: 'Go defensive when CPI exceeds this; high inflation = equity headwind' },
    ja: { label: 'CPI警戒線', desc: 'CPIがこれを超えたら防御モード; 高インフレ=株に逆風' },
  },
  centralBank: {
    'zh-CN': { label: '央行信号', desc: '央行政策信号权重, 加息/降息对股市影响巨大' },
    en: { label: 'Central Bank', desc: 'Central bank policy signal weight; rate decisions are market-moving' },
    ja: { label: '中央銀行', desc: '中央銀行政策シグナルの比重; 金利決定は市場を動かす' },
  },
  globalPMI: {
    'zh-CN': { label: '全球PMI', desc: '全球制造业PMI权重, 高于50=扩张, 低于50=收缩' },
    en: { label: 'Global PMI', desc: 'Global manufacturing PMI weight; above 50=expansion, below 50=contraction' },
    ja: { label: '世界PMI', desc: '世界製造業PMIの比重; 50超=拡大、50未満=縮小' },
  },
  policyCatalyst: {
    'zh-CN': { label: '政策催化', desc: '政策利好因素的权重，政策=最大的市场催化剂' },
    en: { label: 'Policy Catalyst', desc: 'Policy catalyst weight; policy = the ultimate market mover' },
    ja: { label: '政策触媒', desc: '政策カタリストの比重; 政策は最大の市場変動要因' },
  },
  cyclePosition: {
    'zh-CN': { label: '周期定位', desc: '当前经济周期位置的权重，顺周期/逆周期策略不同' },
    en: { label: 'Cycle Position', desc: 'Economic cycle positioning weight; pro- vs counter-cyclical matters' },
    ja: { label: 'サイクル位置', desc: '景気循環位置の比重; 順サイクルか逆サイクルかが重要' },
  },
  dealPipeline: {
    'zh-CN': { label: '并购管线', desc: '并购重组消息的权重，并购活跃=市场健康信号' },
    en: { label: 'M&A Pipeline', desc: 'Merger & acquisition pipeline weight; active M&A = healthy market signal' },
    ja: { label: 'M&Aパイプライン', desc: '合併買収パイプラインの比重; 活発なM&A=健全な市場シグナル' },
  },
  exportGrowth: {
    'zh-CN': { label: '出口增速', desc: '出口增长率的策略权重, 出口型经济的关键指标' },
    en: { label: 'Export Growth', desc: 'Export growth rate weight; key indicator for export-driven economies' },
    ja: { label: '輸出成長率', desc: '輸出成長率の比重; 輸出主導型経済の重要指標' },
  },
  revenueGrowth: {
    'zh-CN': { label: '营收增速', desc: '公司营收增长率最低要求，营收不涨=长期难涨' },
    en: { label: 'Revenue Growth', desc: 'Minimum revenue growth rate required; no top-line growth = hard to rally' },
    ja: { label: '売上成長率', desc: '最低売上成長率; トップライン成長なし=長期的上昇困難' },
  },

  // ── Other ──
  minIC: {
    'zh-CN': { label: '最低IC值', desc: '因子预测能力的最低要求，IC太低=因子失效' },
    en: { label: 'Min IC', desc: 'Minimum information coefficient for factor efficacy; too low = dead factor' },
    ja: { label: '最低IC', desc: 'ファクター有効性の最低情報係数; 低すぎ=死にファクター' },
  },
  fillRatioMin: {
    'zh-CN': { label: '最低成交率', desc: '信号发出后实际成交多少才算有效，太低=信号跟成交脱节' },
    en: { label: 'Min Fill Ratio', desc: 'Minimum signal-to-fill rate for efficacy; too low = signal disconnected from execution' },
    ja: { label: '最低約定率', desc: 'シグナル発信後の最低約定率; 低すぎ=シグナルと執行が乖離' },
  },
  followDelay: {
    'zh-CN': { label: '跟单延迟', desc: '信号发出后等多久再跟单，避免追到最高点' },
    en: { label: 'Follow Delay', desc: 'Wait time after signal before following; avoid chasing the top tick' },
    ja: { label: '追随遅延', desc: 'シグナル後の追随待機時間; 最高値での飛びつき防止' },
  },
  recoveryWait: {
    'zh-CN': { label: '恢复等待', desc: '断电/断连后等多久恢复交易，防数据不完整' },
    en: { label: 'Recovery Wait', desc: 'Cooldown after outage before resuming; prevents trading on incomplete data' },
    ja: { label: '復旧待機', desc: '障害後の取引再開待ち時間; 不完全データでの取引防止' },
  },
  bonusMultiplier: {
    'zh-CN': { label: '奖金倍数', desc: '交易员业绩奖金计算倍数, 激励超额收益' },
    en: { label: 'Bonus Multiplier', desc: 'Trader bonus multiplier for outperformance; incentivizes alpha' },
    ja: { label: 'ボーナス倍率', desc: 'トレーダーの超過収益ボーナス倍率; アルファを奨励' },
  },
  consensusRequired: {
    'zh-CN': { label: '共识数量', desc: '至少需要几个因子同时确认才下单，防单一因子误判' },
    en: { label: 'Consensus Min', desc: 'Minimum factors required to agree before trading; prevents single-factor whipsaw' },
    ja: { label: '合意最小数', desc: '発注に必要な最低因子同意数; 単一因子の誤判断を防ぐ' },
  },
  durationTarget: {
    'zh-CN': { label: '久期目标', desc: '债券组合目标久期, 久期越长利率敏感度越高' },
    en: { label: 'Duration', desc: 'Target bond portfolio duration; longer = more rate sensitive' },
    ja: { label: 'デュレーション', desc: '債券ポートフォリオの目標デュレーション; 長いほど金利感応度大' },
  },
  minTransfer: {
    'zh-CN': { label: '最低转移', desc: '做市商最低转账金额, 太小不够效率' },
    en: { label: 'Min Transfer', desc: 'Minimum transfer amount for market maker; too small = inefficient' },
    ja: { label: '最低送金額', desc: 'マーケットメイカーの最低送金額; 小さすぎ=非効率' },
  },
  maxTenor: {
    'zh-CN': { label: '最长期限', desc: '期货合约最长持有天数, 到期前必须移仓' },
    en: { label: 'Max Tenor', desc: 'Maximum futures contract holding days; must roll before expiry' },
    ja: { label: '最長期間', desc: '先物契約の最大保有日数; 期限前にロール必須' },
  },
  defaultProb: {
    'zh-CN': { label: '违约概率', desc: '公司违约概率上限, 超过就不碰, 信用风险第一' },
    en: { label: 'Default Prob Cap', desc: 'Maximum default probability allowed; credit risk above all' },
    ja: { label: 'デフォルト確率上限', desc: '最大許容デフォルト確率; 信用リスク最優先' },
  },
  ratingMin: {
    'zh-CN': { label: '最低评级', desc: '债券最低信用评级, 投资级=BBB-以上' },
    en: { label: 'Min Rating', desc: 'Minimum credit rating for bonds; investment grade = BBB- or higher' },
    ja: { label: '最低格付', desc: '債券の最低信用格付; 投資適格=BBB-以上' },
  },
  cdsSpread: {
    'zh-CN': { label: 'CDS息差', desc: '信用违约互换息差上限, 太高=市场认为违约概率大' },
    en: { label: 'CDS Spread Cap', desc: 'Credit default swap spread ceiling; too high = market pricing high default risk' },
    ja: { label: 'CDSスプレッド', desc: 'CDSスプレッド上限; 高すぎ=市場がデフォルト確率高と見做す' },
  },
  eventWindowHours: {
    'zh-CN': { label: '事件窗口', desc: '重大事件前后多少小时有效, 窗口外不触发' },
    en: { label: 'Event Window', desc: 'Hours around major events when strategy is active; outside = dormant' },
    ja: { label: 'イベント窓口', desc: '重要イベント前後の有効時間; 窓口外は休止' },
  },
  crowningLimit: {
    'zh-CN': { label: '拥挤度上限', desc: '持仓集中度到多少就算拥挤, 太高=踩踏风险' },
    en: { label: 'Crowding Cap', desc: 'Position concentration limit; too crowded = stampede risk' },
    ja: { label: '混雑度上限', desc: 'ポジション集中度の上限; 混雑しすぎ=パニック売りリスク' },
  },
  sentimentWeight: {
    'zh-CN': { label: '情绪权重', desc: '市场情绪在策略里占多大比重, 跟基本面互补' },
    en: { label: 'Sentiment Wt', desc: 'How much market sentiment matters; complements fundamentals' },
    ja: { label: 'センチメント比重', desc: '市場センチメントの比重; ファンダメンタルズを補完' },
  },
  soraWeight: {
    'zh-CN': { label: 'SORA权重', desc: '新加坡隔夜利率在策略中的权重, 反映借贷成本' },
    en: { label: 'SORA Weight', desc: 'Singapore Overnight Rate Average weight; reflects borrowing costs' },
    ja: { label: 'SORA比重', desc: 'シンガポール翌日物金利の比重; 借入コストを反映' },
  },
  instruments: {
    'zh-CN': { label: '交易工具', desc: '用期权/期货/ETF哪种工具执行, 不同工具杠杆不同' },
    en: { label: 'Instruments', desc: 'Which instruments to use: options/futures/ETF; each has different leverage profile' },
    ja: { label: '取引手段', desc: '執行手段: オプション/先物/ETF; それぞれレバレッジが異なる' },
  },
  invflowSignal: {
    'zh-CN': { label: '流入信号', desc: '资金流入信号强度, 资金持续流入=持续看好' },
    en: { label: 'Inflow Signal', desc: 'Capital inflow signal weight; persistent inflow = persistent bullishness' },
    ja: { label: '流入シグナル', desc: '資金流入シグナル強度; 継続流入=継続強気' },
  },
};

export default PARAM_HUMAN_MAP;
