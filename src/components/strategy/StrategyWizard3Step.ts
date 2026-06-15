/**
 * R226 QC-2.1 — 3步到策略：完整交互设计+文案
 * 
 * 目标: 新用户从「第一次打开」到「运行第一个策略」,
 *       最大3步, 每步≤3个选择, 全程≤2分钟。
 * 
 * 设计哲学:
 * - 每一步都是选择题, 不是填空题
 * - 用交易者听得懂的语言, 不用量化术语
 * - 每步给出实时预览, 让人看到「选了这条路会怎样」
 * 
 * 三步骤:
 *  Step 1: 定位 — 市场+风险+风格
 *  Step 2: AI推荐 — 基于Step1匹配Top3策略
 *  Step 3: 预览定制 — 预览信号+调整参数+一键跑
 */

export const STRATEGY_WIZARD_3STEP = {
  version: 'v1.0',
  totalTimeEstimate: '<2分钟',
  totalSteps: 3,
  
  steps: [
    // ════════════════════════════════════════════════════════════════════
    // Step 1: 定位 — 「你在哪? 你能承受多大风浪? 你想怎么赚钱?」
    // ════════════════════════════════════════════════════════════════════
    {
      step: 1,
      title: { 'zh-CN': '第一步：告诉我你在哪', en: 'Step 1: Where are you?', ja: 'ステップ1: あなたはどこに?' },
      timeEstimate: '30秒',
      
      // Q1: 你想交易哪个市场?
      question1: {
        id: 'market',
        label: { 'zh-CN': '你想交易哪个市场?', en: 'Which market?', ja: 'どの市場で取引しますか?' },
        hint: { 'zh-CN': '选你最熟悉的市场, 后期可以加', en: 'Pick your home market; you can add more later', ja: '最も慣れた市場を選んでください。後から追加できます' },
        type: 'single-select-card',
        options: [
          { id: 'hk', icon: '🇭🇰', label: { 'zh-CN': '港股', en: 'HK Stocks', ja: '香港株' }, desc: { 'zh-CN': 'AH溢价/窝轮/南向资金', en: 'AH premium, warrants, southbound flow', ja: 'AHプレミアム/ワラント/サウスバウンド' } },
          { id: 'us', icon: '🇺🇸', label: { 'zh-CN': '美股', en: 'US Stocks', ja: '米国株' }, desc: { 'zh-CN': '财报/回购/VIX/股息套利', en: 'Earnings, buybacks, VIX, dividend', ja: '決算/自社株買い/VIX/配当' } },
          { id: 'crypto', icon: '🪙', label: { 'zh-CN': '加密货币', en: 'Crypto', ja: '暗号資産' }, desc: { 'zh-CN': '链上数据/合约费率/巨鲸', en: 'On-chain, funding rate, whales', ja: 'オンチェーン/資金調達率/クジラ' } },
          { id: 'commodity', icon: '🏭', label: { 'zh-CN': '商品期货', en: 'Commodities', ja: '商品先物' }, desc: { 'zh-CN': '基差/COT/库存/季节性', en: 'Basis, COT, inventory, seasonality', ja: 'ベーシス/COT/在庫/季節性' } },
          { id: 'multi', icon: '🌐', label: { 'zh-CN': '跨市场/全球', en: 'Multi/Global', ja: 'クロス/グローバル' }, desc: { 'zh-CN': '全天候/风险平价/黑天鹅', en: 'All-weather, risk parity, black-swan', ja: 'オールウェザー/リスクパリティ/ブラックスワン' } },
          { id: 'jpkr', icon: '🇯🇵🇰🇷', label: { 'zh-CN': '日韩', en: 'JP/KR', ja: '日韓' }, desc: { 'zh-CN': 'NISA/Carry Trade/财阀', en: 'NISA, carry trade, chaebol', ja: 'NISA/キャリートレード/財閥' } },
        ],
      },

      // Q2: 你能承受多大风险?
      question2: {
        id: 'risk',
        label: { 'zh-CN': '你能承受多大波动?', en: 'How much risk can you handle?', ja: 'どのくらいのリスクを許容できますか?' },
        hint: { 'zh-CN': '如实选择, 我们会匹配合适难度的策略', en: 'Be honest — we\'ll match strategies to your tolerance', ja: '正直に選んでください。あなたの許容度に合った戦略を提案します' },
        type: 'single-select-slider',
        options: [
          { id: 'low', label: { 'zh-CN': '低风险', en: 'Low Risk', ja: '低リスク' }, desc: { 'zh-CN': '最大回撤≤10%/年, 宁可少赚不愿大亏', en: 'Max DD ≤10%/yr; prefer sleep over returns', ja: '最大DD ≤10%/年; リターンより安眠優先' }, color: '#22c55e' },
          { id: 'medium', label: { 'zh-CN': '中等风险', en: 'Medium Risk', ja: '中リスク' }, desc: { 'zh-CN': '最大回撤≤20%/年, 愿意承受一定波动', en: 'Max DD ≤20%/yr; comfortable with moderate swings', ja: '最大DD ≤20%/年; ある程度の変動は許容' }, color: '#f59e0b' },
          { id: 'high', label: { 'zh-CN': '高风险', en: 'High Risk', ja: '高リスク' }, desc: { 'zh-CN': '最大回撤≤40%/年, 追求高收益不怕大波动', en: 'Max DD ≤40%/yr; chasing alpha, unfazed by swings', ja: '最大DD ≤40%/年; 高リターン追求、変動は気にしない' }, color: '#ef4444' },
        ],
      },

      // Q3: 你想怎么赚?
      question3: {
        id: 'style',
        label: { 'zh-CN': '你喜欢什么交易风格?', en: 'What\'s your trading style?', ja: 'あなたの取引スタイルは?' },
        type: 'multi-select-chip',
        maxSelect: 2,
        options: [
          { id: 'trend', label: { 'zh-CN': '跟随趋势', en: 'Follow Trend', ja: 'トレンド追随' }, desc: { 'zh-CN': '顺势而为, 不猜顶底', en: 'Ride the wave, don\'t guess tops', ja: '波に乗る、天底予想しない' } },
          { id: 'value', label: { 'zh-CN': '价值挖掘', en: 'Value Hunting', ja: 'バリュー発掘' }, desc: { 'zh-CN': '找被低估的好公司, 耐心等回归', en: 'Find undervalued gems, wait for mean reversion', ja: '割安な良質銘柄を探し、平均回帰を待つ' } },
          { id: 'arbitrage', label: { 'zh-CN': '套利对冲', en: 'Arbitrage', ja: '裁定取引' }, desc: { 'zh-CN': '跨市场/跨品种价差套利', en: 'Cross-market/cross-asset spread trading', ja: 'クロスマーケット/クロスアセット裁定' } },
          { id: 'dividend', label: { 'zh-CN': '稳健收息', en: 'Dividend Income', ja: '配当収入' }, desc: { 'zh-CN': '收股息+REITs分红, 稳定现金流', en: 'Dividends + REITs for steady cashflow', ja: '配当+REITで安定キャッシュフロー' } },
          { id: 'momentum', label: { 'zh-CN': '动量追击', en: 'Momentum', ja: 'モメンタム' }, desc: { 'zh-CN': '强者恒强, 追涨杀跌有纪律', en: 'Strong gets stronger, but with discipline', ja: '強いものはさらに強くなる、ただし規律付き' } },
          { id: 'ai', label: { 'zh-CN': 'AI辅助', en: 'AI-Assisted', ja: 'AI支援' }, desc: { 'zh-CN': '让AI帮你分析+调参+及时提醒', en: 'AI analyzes, tunes params, alerts you', ja: 'AIが分析+パラメータ調整+アラート' } },
        ],
      },

      // Preview sidebar (updates in real-time as user selects)
      preview: {
        label: { 'zh-CN': '实时预览', en: 'Live Preview', ja: 'ライブプレビュー' },
        emptyMessage: { 'zh-CN': '选择市场和风险偏好后, 这里会显示匹配的策略数量', en: 'Select market and risk to see matching strategies', ja: '市場とリスクを選ぶと、マッチする戦略数が表示されます' },
        template: {
          'zh-CN': '已匹配 {count} 个策略 · 难度 {difficulty} · {style}风格',
          en: '{count} strategies matched · Difficulty {difficulty} · {style}',
          ja: '{count}件の戦略がマッチ · 難易度{difficulty} · {style}スタイル',
        },
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // Step 2: AI推荐 — Top 3 match
    // ════════════════════════════════════════════════════════════════════
    {
      step: 2,
      title: { 'zh-CN': '第二步：AI为你推荐', en: 'Step 2: AI Recommends', ja: 'ステップ2: AIがおすすめ' },
      timeEstimate: '45秒',
      
      header: {
        'zh-CN': '基于你选择的 {market} + {risk}风险 + {style}风格, AI为你找到以下3个最匹配的策略：',
        en: 'Based on {market} + {risk} risk + {style} style, AI found these 3 best-fit strategies:',
        ja: '{market} + {risk}リスク + {style}スタイルに基づき、AIが最適な3つの戦略を見つけました：',
      },

      // Mobile: swipeable cards. Desktop: side-by-side 3 cards.
      layout: 'card-row',
      
      cardTemplate: {
        rank: { 'zh-CN': '推荐#{n}', en: 'Pick #{n}', ja: 'おすすめ#{n}' },
        matchScore: { 'zh-CN': '匹配度 {pct}%', en: 'Match {pct}%', ja: 'マッチ度{pct}%' },
        difficultyBadge: { 'zh-CN': '⭐⭐⭐ 中等', en: '⭐⭐⭐ Medium', ja: '⭐⭐⭐ 中級' },
        fields: [
          { key: 'strategyName', label: { 'zh-CN': '策略名称', en: 'Strategy', ja: '戦略名' } },
          { key: 'humanLine', label: { 'zh-CN': '一句话', en: 'In a Nutshell', ja: '一言で' }, maxChars: 80 },
          { key: 'expectedReturn', label: { 'zh-CN': '预期年化', en: 'Expected Annual', ja: '期待年利' } },
          { key: 'maxDrawdown', label: { 'zh-CN': '最大回撤', en: 'Max Drawdown', ja: '最大DD' } },
          { key: 'holdingPeriod', label: { 'zh-CN': '持仓周期', en: 'Hold Period', ja: '保有期間' } },
        ],
        action: { 'zh-CN': '选这个 →', en: 'Choose →', ja: 'これにする →' },
      },

      // AI explanation panel (below cards)
      aiExplanation: {
        title: { 'zh-CN': '🤖 AI为什么推荐这些?', en: '🤖 Why these?', ja: '🤖 なぜこれら?' },
        placeholder: { 'zh-CN': 'AI正在分析你的选择...', en: 'AI analyzing your picks...', ja: 'AIがあなたの選択を分析中...' },
        template: {
          'zh-CN': '因为你选择了{market}市场+{risk}风险偏好+{style}风格, 且{market}市场当前处于{marketState}状态, AI认为{top1}最适合, {top2}是备选, {top3}作为互补。',
          en: 'You chose {market} + {risk} risk + {style} style. With {market} in {marketState} mode, AI thinks {top1} fits best, {top2} as backup, {top3} for diversification.',
          ja: '{market}+{risk}リスク+{style}スタイルを選択、現在{market}は{marketState}状態のため、AIは{top1}が最適、{top2}が予備、{top3}が分散用と判断しました。',
        },
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // Step 3: 预览定制 — 看看效果, 调一调
    // ════════════════════════════════════════════════════════════════════
    {
      step: 3,
      title: { 'zh-CN': '第三步：预览并微调', en: 'Step 3: Preview & Tune', ja: 'ステップ3: プレビューと微調整' },
      timeEstimate: '45秒',
      
      header: { 'zh-CN': '这是 {strategyName} 的完整预览。你可以直接运行, 也可以先微调参数。', en: 'Full preview of {strategyName}. Run as-is, or tweak first.', ja: '{strategyName}の完全プレビュー。このまま実行するか、微調整も可能です。' },

      // Layout: main area = strategy detail, sidebar = param tuning
      layout: 'split',

      mainPanel: {
        sections: [
          {
            id: 'iron-rules',
            title: { 'zh-CN': '🔒 四条铁律(不可改)', en: '🔒 Four Iron Rules (locked)', ja: '🔒 四つの鉄則(変更不可)' },
            fields: [
              { key: 'humanLine', label: { 'zh-CN': '核心逻辑', en: 'Core Logic', ja: '核心ロジック' } },
              { key: 'stopLossRule', label: { 'zh-CN': '止损规则', en: 'Stop Loss', ja: '損切りルール' } },
              { key: 'marketScope', label: { 'zh-CN': '适用范围', en: 'Scope', ja: '適用範囲' } },
              { key: 'failureCheck', label: { 'zh-CN': '失效条件', en: 'When to Stop', ja: '停止条件' } },
            ],
          },
          {
            id: 'factor-combo',
            title: { 'zh-CN': '📊 因子组合', en: '📊 Factor Combo', ja: '📊 ファクター組合せ' },
            showWeightChart: true, // donut/pie
            showFactorList: true,
          },
          {
            id: 'ai-triggers',
            title: { 'zh-CN': '🤖 AI辅助功能', en: '🤖 AI Services', ja: '🤖 AIサービス' },
            showToggle: true, // user can toggle each AI service on/off
          },
        ],
      },

      sidebar: {
        title: { 'zh-CN': '⚙️ 参数微调', en: '⚙️ Tune Parameters', ja: '⚙️ パラメータ調整' },
        params: null, // dynamic: populated from template.tunableParams
        paramCard: {
          humanLabel: null, // from ParamHumanization
          humanDesc: null,
          currentValue: null,
          range: null,
          slider: true, // use range slider
        },
        resetButton: { 'zh-CN': '恢复默认', en: 'Reset Defaults', ja: 'デフォルトに戻す' },
      },

      actions: {
        primary: {
          label: { 'zh-CN': '🚀 开始运行这个策略', en: '🚀 Run This Strategy', ja: '🚀 この戦略を実行' },
          desc: { 'zh-CN': '费用: {cost} USDT/轮 · 3次免费试用', en: 'Cost: {cost} USDT/turn · 3 free trials', ja: '費用: {cost} USDT/回 · 3回無料' },
        },
        secondary: [
          { label: { 'zh-CN': '先回测看看', en: 'Backtest First', ja: 'まずバックテスト' }, cost: '1 USDT' },
          { label: { 'zh-CN': '加到自选稍后试', en: 'Save for Later', ja: '後で試す' }, cost: '免费' },
        ],
      },
    },
  ],

  // ── Full wizard metadata ──
  metadata: {
    name: { 'zh-CN': '策略导航', en: 'Strategy Wizard', ja: '戦略ナビ' },
    tagline: { 'zh-CN': '3步找到你的策略', en: 'Find your strategy in 3 steps', ja: '3ステップであなたの戦略を見つける' },
    entryPoints: [
      { id: 'onboarding', desc: { 'zh-CN': '新用户首次打开自动弹出', en: 'Auto-launch for new users', ja: '新規ユーザーに自動表示' } },
      { id: 'strategy-page', desc: { 'zh-CN': '策略页面顶部横幅"找不到合适的策略? 试试策略导航"', en: 'Banner on strategy page', ja: '戦略ページのバナー' } },
      { id: 'empty-state', desc: { 'zh-CN': '自选/策略列表为空时的引导入口', en: 'Empty state CTA', ja: '空状態のCTA' } },
    ],
    progress: {
      bar: true,
      stepLabels: {
        'zh-CN': ['市场定位', 'AI推荐', '预览运行'],
        en: ['Positioning', 'AI Picks', 'Preview & Run'],
        ja: ['市場選択', 'AI推薦', 'プレビュー実行'],
      },
    },
    canSkip: true,
    canGoBack: true,
    exitConfirmation: { 'zh-CN': '策略选择未完成, 确定退出吗? 可以稍后从策略页面重新进入。', en: 'Strategy selection not complete. Exit? You can resume later.', ja: '戦略選択が完了していません。終了しますか? 後で再開できます。' },
  },
};

export default STRATEGY_WIZARD_3STEP;
