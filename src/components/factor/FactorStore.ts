/* ════════════════════════════════════════════════════════════════════════════
 * R227 QC-2.2 — 因子超市 (Factor Store) 3层交互设计 + 因子卡片文案
 * 
 * 设计目标: 用户像逛超市一样浏览、筛选、比较因子
 * 3层结构:
 *   L1: 16大类 — 大类卡片矩阵 (全局浏览)
 *   L2: ~55中类 — 分类标签+搜索 (聚焦浏览)
 *   L3: 因子卡片 — 详细信息+添加/对比 (深入)
 * 
 * 核心原则:
 *   - 用「人话」替代因子ID和公式
 *   - 每张卡片回答: 这是什么? 怎么用? 靠谱吗?
 *   - 支持收藏/对比/添加到策略
 * ════════════════════════════════════════════════════════════════════════════ */

export const FACTOR_STORE_DESIGN = {
  version: 'v1.0',
  
  /* ═══════════════════════════════════════════════════════════════════════
   * L1: 16大类 — 卡片矩阵
   * Layout: 4×4 grid on desktop, 2-column on mobile
   * Each card: icon + name + count + 1-liner description
   * ═══════════════════════════════════════════════════════════════════════ */
  l1_categories: [
    {
      id: 'value',
      icon: '💰',
      nameZh: '价值因子', nameEn: 'Value', nameJa: 'バリュー',
      count: 18,
      color: '#22c55e',
      descZh: '捡便宜的: PE/PB/PS估值、股息率、现金流折现', descEn: 'Find bargains: PE, PB, PS, dividend yield, DCF', descJa: '割安銘柄: PER, PBR, PSR, 配当利回り, DCF',
    },
    {
      id: 'momentum',
      icon: '🚀',
      nameZh: '动量因子', nameEn: 'Momentum', nameJa: 'モメンタム',
      count: 14,
      color: '#f59e0b',
      descZh: '追涨的: 价格动量/相对强度/行业轮动/趋势强度', descEn: 'Ride the trend: price momentum, RSI, sector rotation, trend strength', descJa: 'トレンド追随: 価格モメンタム, RSI, セクターローテ',
    },
    {
      id: 'volatility',
      icon: '📊',
      nameZh: '波动因子', nameEn: 'Volatility', nameJa: 'ボラティリティ',
      count: 12,
      color: '#6366f1',
      descZh: '看波动的: 低波/高波/VIX/波动率偏度/振幅', descEn: 'Volatility plays: low-vol, high-vol, VIX, skew, amplitude', descJa: 'ボラティリティ: 低ボラ, 高ボラ, VIX, スキュー',
    },
    {
      id: 'quality',
      icon: '⭐',
      nameZh: '质量因子', nameEn: 'Quality', nameJa: 'クオリティ',
      count: 16,
      color: '#d4a574',
      descZh: '选好公司: ROE/ROA/毛利率/负债率/现金流质量', descEn: 'Pick quality: ROE, ROA, gross margin, debt ratio, cashflow quality', descJa: '優良銘柄: ROE, ROA, 粗利率, 負債比率, CFクオリティ',
    },
    {
      id: 'sentiment',
      icon: '💬',
      nameZh: '情绪因子', nameEn: 'Sentiment', nameJa: 'センチメント',
      count: 10,
      color: '#ec4899',
      descZh: '读人心的: 社交媒体/新闻舆情/分析师评级/散户情绪', descEn: 'Read the crowd: social media, news sentiment, analyst ratings, retail sentiment', descJa: '市場心理: SNS, ニュースセンチメント, アナリスト格付',
    },
    {
      id: 'macro',
      icon: '🌍',
      nameZh: '宏观因子', nameEn: 'Macro', nameJa: 'マクロ',
      count: 14,
      color: '#06b6d4',
      descZh: '看大局的: PMI/CPI/GDP/利率/汇率/央行政策/经济周期', descEn: 'Big picture: PMI, CPI, GDP, rates, FX, central bank policy, economic cycle', descJa: '大局観: PMI, CPI, GDP, 金利, 為替, 中銀政策, 景気循環',
    },
    {
      id: 'flow',
      icon: '💧',
      nameZh: '资金流向', nameEn: 'Capital Flow', nameJa: '資金フロー',
      count: 16,
      color: '#3b82f6',
      descZh: '跟大钱的: 北上南下资金/主力净流入/融资融券/大宗交易', descEn: 'Follow the money: north/southbound, institutional net flow, margin trading, block trades', descJa: '資金の流れ: 南北資金, 機関投資家ネット, 信用取引, ブロック取引',
    },
    {
      id: 'risk',
      icon: '🛡️',
      nameZh: '风险因子', nameEn: 'Risk', nameJa: 'リスク',
      count: 12,
      color: '#ef4444',
      descZh: '防风险的: Beta/最大回撤/VaR/尾部风险/集中度/相关系数', descEn: 'Risk guards: Beta, max drawdown, VaR, tail risk, concentration, correlation', descJa: 'リスク管理: ベータ, 最大DD, VaR, テールリスク, 集中度',
    },
    {
      id: 'dividend',
      icon: '💵',
      nameZh: '分红因子', nameEn: 'Dividend', nameJa: '配当',
      count: 8,
      color: '#f59e0b',
      descZh: '收息的: 股息率/分红增长率/派息率/除权日/分红稳定性', descEn: 'Income: dividend yield, growth, payout ratio, ex-date, stability', descJa: 'インカム: 配当利回り, 増配率, 配当性向, 権利落ち日',
    },
    {
      id: 'growth',
      icon: '📈',
      nameZh: '成长因子', nameEn: 'Growth', nameJa: 'グロース',
      count: 12,
      color: '#a855f7',
      descZh: '赌未来的: 营收增速/盈利增速/研发投入/市场份额/用户增长', descEn: 'Bet on future: revenue growth, EPS growth, R&D, market share, user growth', descJa: '将来に賭ける: 売上成長, EPS成長, 研究開発, 市場シェア',
    },
    {
      id: 'market_specific',
      icon: '🏛️',
      nameZh: '市场专属', nameEn: 'Market-Specific', nameJa: '市場固有',
      count: 20,
      color: '#14b8a6',
      descZh: '当地才有的: AH溢价/窝轮/牛熊证/南向/CarryTrade/财阀/BSE/NSE', descEn: 'Local flavors: AH premium, warrants, CBBC, southbound, carry trade, chaebol', descJa: 'ローカル: AHプレミアム, ワラント, 牛熊証券, キャリートレード',
    },
    {
      id: 'crypto',
      icon: '🪙',
      nameZh: '加密因子', nameEn: 'Crypto', nameJa: '暗号資産',
      count: 16,
      color: '#f7931a',
      descZh: '链上世界的: 资金费率/OI变化/巨鲸地址/Gas费/稳定币/交易所余额', descEn: 'On-chain: funding rate, OI delta, whale addresses, gas, stablecoin, exchange balance', descJa: 'オンチェーン: 資金調達率, OI変化, クジラ, ガス代, ステーブルコイン',
    },
    {
      id: 'commodity',
      icon: '⛽',
      nameZh: '商品因子', nameEn: 'Commodity', nameJa: '商品',
      count: 12,
      color: '#92400e',
      descZh: '实物世界的: 基差/库存/COT持仓/季节性/升贴水/现货溢价', descEn: 'Physical world: basis, inventory, COT, seasonality, contango/backwardation', descJa: '実物: ベーシス, 在庫, COT, 季節性, コンタンゴ/バックワーデ',
    },
    {
      id: 'derivatives',
      icon: '📜',
      nameZh: '衍生品因子', nameEn: 'Derivatives', nameJa: 'デリバティブ',
      count: 10,
      color: '#8b5cf6',
      descZh: '期权期货的: IV/IV Rank/PCR/Greeks/持仓量/行权价分布', descEn: 'Options & futures: IV, IV rank, PCR, Greeks, OI, strike distribution', descJa: 'オプション先物: IV, IVランク, PCR, グリークス, OI, 行使価格分布',
    },
    {
      id: 'technical',
      icon: '📐',
      nameZh: '技术因子', nameEn: 'Technical', nameJa: 'テクニカル',
      count: 14,
      color: '#64748b',
      descZh: '看K线的: MA/MACD/RSI/布林/KDJ/CCI/K线形态/支撑阻力', descEn: 'Chart patterns: MA, MACD, RSI, Bollinger, KDJ, CCI, candlestick patterns', descJa: 'チャート: MA, MACD, RSI, ボリンジャー, KDJ, CCI, ローソク足',
    },
    {
      id: 'alternative',
      icon: '🛰️',
      nameZh: '另类数据', nameEn: 'Alternative Data', nameJa: 'オルタナティブ',
      count: 8,
      color: '#10b981',
      descZh: '不寻常的: 卫星图像/供应链/信用卡消费/招聘数据/碳排放', descEn: 'Unusual: satellite imagery, supply chain, credit card spend, hiring, carbon', descJa: '非伝統的: 衛星画像, サプライチェーン, クレカ支出, 採用, 炭素',
    },
  ],

  /* ═══════════════════════════════════════════════════════════════════════
   * L2: ~55中类 — 分类标签+搜索
   * Layout: horizontal chip tabs + search bar at top
   * ═══════════════════════════════════════════════════════════════════════ */
  l2_subcategories: {
    value: [
      { id: 'pe_pb', zh: 'PE/PB估值', en: 'PE/PB Valuation', ja: 'PER/PBR評価' },
      { id: 'ps_pcf', zh: 'PS/PCF估值', en: 'PS/PCF Valuation', ja: 'PSR/PCFR評価' },
      { id: 'dividend_yield', zh: '股息率', en: 'Dividend Yield', ja: '配当利回り' },
      { id: 'dcf_ev', zh: 'DCF/EV估值', en: 'DCF/EV Valuation', ja: 'DCF/EV評価' },
      { id: 'book_value', zh: '市净率/破净', en: 'Book Value', ja: 'PBR/解散価値' },
    ],
    momentum: [
      { id: 'price_momentum', zh: '价格动量', en: 'Price Momentum', ja: '価格モメンタム' },
      { id: 'relative_strength', zh: '相对强度', en: 'Relative Strength', ja: '相対力' },
      { id: 'sector_rotation', zh: '行业轮动', en: 'Sector Rotation', ja: 'セクターローテ' },
      { id: 'trend_following', zh: '趋势跟随', en: 'Trend Following', ja: 'トレンド追随' },
      { id: 'breakout', zh: '突破信号', en: 'Breakout Signals', ja: 'ブレイクアウト' },
    ],
    volatility: [
      { id: 'low_vol', zh: '低波动', en: 'Low Volatility', ja: '低ボラティリティ' },
      { id: 'high_vol', zh: '高波动', en: 'High Volatility', ja: '高ボラティリティ' },
      { id: 'vix_vstoxx', zh: 'VIX/波动率指数', en: 'VIX/Vol Index', ja: 'VIX/ボラ指数' },
      { id: 'skew', zh: '偏度', en: 'Skew', ja: 'スキュー' },
    ],
    quality: [
      { id: 'roe_roa', zh: 'ROE/ROA', en: 'ROE/ROA', ja: 'ROE/ROA' },
      { id: 'margin', zh: '利润率', en: 'Profit Margin', ja: '利益率' },
      { id: 'debt', zh: '负债率', en: 'Leverage', ja: '負債比率' },
      { id: 'cashflow', zh: '现金流质量', en: 'Cashflow Quality', ja: 'CFクオリティ' },
    ],
    sentiment: [
      { id: 'social_media', zh: '社媒舆情', en: 'Social Media', ja: 'SNSセンチメント' },
      { id: 'news_sentiment', zh: '新闻情绪', en: 'News Sentiment', ja: 'ニュースセンチメント' },
      { id: 'analyst', zh: '分析师评级', en: 'Analyst Rating', ja: 'アナリスト格付' },
      { id: 'retail', zh: '散户情绪', en: 'Retail Sentiment', ja: '個人投資家心理' },
    ],
    macro: [
      { id: 'pmi', zh: 'PMI', en: 'PMI', ja: 'PMI' },
      { id: 'inflation', zh: '通胀/CPI', en: 'Inflation/CPI', ja: 'インフレ/CPI' },
      { id: 'interest_rate', zh: '利率/国债', en: 'Rates/Bonds', ja: '金利/国債' },
      { id: 'fx', zh: '汇率', en: 'FX', ja: '為替' },
      { id: 'central_bank', zh: '央行政策', en: 'Central Bank', ja: '中銀政策' },
    ],
    flow: [
      { id: 'north_south', zh: '北向/南向资金', en: 'North/Southbound', ja: '南北資金' },
      { id: 'institutional', zh: '主力净流入', en: 'Institutional Flow', ja: '機関投資家フロー' },
      { id: 'margin_short', zh: '融资融券', en: 'Margin/Short', ja: '信用/空売り' },
      { id: 'block_trade', zh: '大宗交易', en: 'Block Trades', ja: 'ブロック取引' },
    ],
    risk: [
      { id: 'beta', zh: 'Beta', en: 'Beta', ja: 'ベータ' },
      { id: 'drawdown', zh: '最大回撤', en: 'Max Drawdown', ja: '最大DD' },
      { id: 'var_tail', zh: 'VaR/尾部风险', en: 'VaR/Tail Risk', ja: 'VaR/テールリスク' },
      { id: 'correlation', zh: '相关系数', en: 'Correlation', ja: '相関係数' },
    ],
    dividend: [
      { id: 'yield', zh: '股息率', en: 'Dividend Yield', ja: '配当利回り' },
      { id: 'growth', zh: '分红增长', en: 'Dividend Growth', ja: '増配率' },
      { id: 'payout', zh: '派息率', en: 'Payout Ratio', ja: '配当性向' },
      { id: 'ex_date', zh: '除权日', en: 'Ex-Date', ja: '権利落ち日' },
    ],
    growth: [
      { id: 'revenue', zh: '营收增速', en: 'Revenue Growth', ja: '売上成長' },
      { id: 'eps', zh: '盈利增速', en: 'EPS Growth', ja: 'EPS成長' },
      { id: 'rd', zh: '研发投入', en: 'R&D Spend', ja: '研究開発費' },
      { id: 'user_growth', zh: '用户增长', en: 'User Growth', ja: 'ユーザー成長' },
    ],
    market_specific: [
      { id: 'ah_premium', zh: 'AH溢价', en: 'AH Premium', ja: 'AHプレミアム' },
      { id: 'warrant_cbbc', zh: '窝轮/牛熊证', en: 'Warrant/CBBC', ja: 'ワラント/牛熊' },
      { id: 'carry_trade', zh: 'Carry Trade', en: 'Carry Trade', ja: 'キャリートレード' },
      { id: 'chaebol', zh: '财阀/交叉持股', en: 'Chaebol/Cross-Hold', ja: '財閥/持合い' },
      { id: 'local_sentiment', zh: '本土投资者情绪', en: 'Local Sentiment', ja: '地元投資家心理' },
    ],
    crypto: [
      { id: 'funding_rate', zh: '资金费率', en: 'Funding Rate', ja: '資金調達率' },
      { id: 'oi_delta', zh: '未平仓变化', en: 'OI Delta', ja: 'OI変化' },
      { id: 'whale', zh: '巨鲸地址', en: 'Whale Addresses', ja: 'クジラアドレス' },
      { id: 'exchange_balance', zh: '交易所余额', en: 'Exchange Balance', ja: '取引所残高' },
      { id: 'stablecoin', zh: '稳定币', en: 'Stablecoin', ja: 'ステーブルコイン' },
    ],
    commodity: [
      { id: 'basis', zh: '基差', en: 'Basis', ja: 'ベーシス' },
      { id: 'inventory', zh: '库存', en: 'Inventory', ja: '在庫' },
      { id: 'cot', zh: 'COT持仓', en: 'COT Positions', ja: 'COTポジション' },
      { id: 'seasonality', zh: '季节性', en: 'Seasonality', ja: '季節性' },
    ],
    derivatives: [
      { id: 'iv', zh: '隐含波动率', en: 'Implied Volatility', ja: 'インプライドボラ' },
      { id: 'pcr', zh: 'Put/Call比', en: 'Put/Call Ratio', ja: 'プットコール比' },
      { id: 'greeks', zh: '希腊字母', en: 'Greeks', ja: 'グリークス' },
      { id: 'options_flow', zh: '期权大单', en: 'Options Flow', ja: 'オプション大口' },
    ],
    technical: [
      { id: 'trend_ma', zh: '均线系统', en: 'Moving Averages', ja: '移動平均線' },
      { id: 'oscillator', zh: '震荡指标', en: 'Oscillators', ja: 'オシレーター' },
      { id: 'candlestick', zh: 'K线形态', en: 'Candlestick Patterns', ja: 'ローソク足パターン' },
      { id: 'volume', zh: '成交量', en: 'Volume', ja: '出来高' },
    ],
    alternative: [
      { id: 'satellite', zh: '卫星图像', en: 'Satellite Imagery', ja: '衛星画像' },
      { id: 'supply_chain', zh: '供应链', en: 'Supply Chain', ja: 'サプライチェーン' },
      { id: 'credit_card', zh: '信用卡消费', en: 'Credit Card Spend', ja: 'クレカ支出' },
      { id: 'carbon_esg', zh: '碳排放/ESG', en: 'Carbon/ESG', ja: '炭素/ESG' },
    ],
  },

  /* ═══════════════════════════════════════════════════════════════════════
   * L3: 因子卡片 — 详细信息 + 交互
   * Layout: grid of cards, each card expandable
   * ═══════════════════════════════════════════════════════════════════════ */
  l3_card_template: {
    // Card size: 280×200px (compact), 280×340px (expanded)
    // Compact shows: name + type badge + IC + availability + star
    // Expanded adds: description + how-to-use + recent IC chart + add-to-strategy

    compact_fields: [
      { key: 'name', label: '名称' },
      { key: 'category_badge', label: '分类', type: 'chip' },
      { key: 'ic_30d', label: '近30日IC', format: '0.00', color: true }, // green positive, red negative
      { key: 'status', label: '状态', type: 'dot', values: { available: '🟢可用', degraded: '🟡数据延迟', unavailable: '🔴暂不可用' } },
    ],

    expanded_fields: [
      { key: 'short', label: '一句话', maxChars: 50, zh: '这个因子用简短的话告诉你它做什么', en: 'What this factor does in plain language', ja: 'このファクターが何をするか一言で' },
      { key: 'when', label: '适用场景', maxChars: 80, zh: '什么时候这个因子最有效', en: 'When this factor works best', ja: 'このファクターが最も効果的な場面' },
      { key: 'market', label: '适用市场', type: 'flags', zh: '哪些市场有这个因子', en: 'Which markets have this factor', ja: 'どの市場で使えるか' },
      { key: 'source', label: '数据来源', type: 'badge', values: { realtime: '实时', daily: '每日', weekly: '每周', monthly: '每月' } },
      { key: 'ic_90d', label: '近90日IC', format: '0.00' },
      { key: 'winrate_90d', label: '近90日胜率', format: '0%' },
      { key: 'sharpe_90d', label: '夏普比率', format: '0.00' },
      { key: 'params', label: '可调参数', type: 'chips', zh: '这个因子有哪些可以调的参数', en: 'Tunable parameters', ja: '調整可能パラメータ' },
    ],

    actions: [
      { id: 'add_to_strategy', zh: '加到策略', en: 'Add to Strategy', ja: '戦略に追加', icon: '+' },
      { id: 'compare', zh: '对比', en: 'Compare', ja: '比較', icon: '⇄' },
      { id: 'favorite', zh: '收藏', en: 'Favorite', ja: 'お気に入り', icon: '★' },
      { id: 'chart', zh: 'IC走势', en: 'IC Chart', ja: 'IC推移', icon: '📈' },
    ],
  },

  /* ═══════════════════════════════════════════════════════════════════════
   * UI Layout
   * ═══════════════════════════════════════════════════════════════════════ */
  layout: {
    search_bar: { placeholder: { zh: '搜索因子, 如"市盈率""动量""巨鲸"...', en: 'Search factors: "PE", "momentum", "whale"...', ja: 'ファクター検索: 「PER」「モメンタム」「クジラ」...' } },
    toolbar: [
      { id: 'filter_market', type: 'dropdown', options: ['全部', '港股', '美股', '加密', '商品', '日韩', '台新澳', '欧盟印'] },
      { id: 'filter_status', type: 'dropdown', options: ['全部', '可用', '延迟', '不可用'] },
      { id: 'filter_source', type: 'dropdown', options: ['全部', '实时', '每日', '每周', '每月'] },
      { id: 'sort_by', type: 'dropdown', options: ['默认排序', 'IC最高', 'IC最低', '胜率最高', '最新添加'] },
      { id: 'view_mode', type: 'toggle', options: { grid: '网格', list: '列表' } },
    ],
    empty_state: {
      zh: '没有匹配的因子。试试换个筛选条件, 或者搜索其他关键词。',
      en: 'No matching factors. Try different filters or search terms.',
      ja: '一致するファクターがありません。フィルターや検索語を変えてみてください。',
    },
    onboarding_tip: {
      zh: '💡 提示: 因子就像菜谱里的调料。选对了组合, 策略才好吃。从左侧16大类开始浏览吧！',
      en: '💡 Tip: Factors are like spices in a recipe. The right combo makes the strategy work. Start exploring from the 16 categories!',
      ja: '💡 ヒント: ファクターは料理の調味料。正しい組合せで戦略が輝く。16カテゴリーから探検しよう！',
    },
  },
};

export default FACTOR_STORE_DESIGN;
