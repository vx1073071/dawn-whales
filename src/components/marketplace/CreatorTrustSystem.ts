/* ════════════════════════════════════════════════════════════════════════════
 * R228 QC-3.2 — 创作者信任体系 (Creator Trust System) 4元素设计
 * 
 * 背景: 创作者市场上架交易策略/signal/指标, 用户需要信任创作者才愿意付费。
 * 
 * 4个信任元素:
 *   1. 审核徽章 — 等级+认证, 一眼看懂创作者靠谱程度
 *   2. 真实数据 — 公开的历史表现, 不藏着掖着
 *   3. 定价透明 — 钱去哪了, 平台抽多少, 创作者挣多少
 *   4. 安全声明 — 你的钱和数据是安全的
 * 
 * 设计原则:
 *   - 每一条信任信息都"可验证" (不靠嘴说, 靠数据)
 *   - 不造假: 没有做假的空间 (数据来源清晰)
 *   - 渐进式: 新用户看得懂, 老手能深挖
 * ════════════════════════════════════════════════════════════════════════════ */

export const CREATOR_TRUST_SYSTEM = {
  version: 'v1.0',

  /* ═══════════════════════════════════════════════════════════════════════
   * Element 1: Audit Badges — 审核徽章
   * 
   * 层级: 创作者等级 (L1→L2→L3) + 专项认证徽章
   * 徽章设计:
   *   L1 新手: 🥉 铜色 #cd7f32 · 注册即可
   *   L2 进阶: 🥈 银色 #c0c0c0 · 销量≥100笔
   *   L3 旗舰: 🥇 金色 #ffd700 · 销量≥1000笔
   *   认证: ✅ 已验证 · 🔍 已审计 · ⭐ 编辑精选
   * ═══════════════════════════════════════════════════════════════════════ */
  element1_badges: {
    title: { zh: '审核徽章', en: 'Audit Badges', ja: '審査バッジ' },
    
    creatorLevels: [
      {
        level: 'L1',
        nameZh: '新手创作者', nameEn: 'Novice Creator', nameJa: '新米クリエイター',
        icon: '🥉', color: '#cd7f32',
        threshold: { zh: '注册即可上架', en: 'List as soon as you sign up', ja: '登録後すぐに出品可能' },
        revenueSplit: { zh: '创作者70% / 平台30%', en: 'Creator 70% / Platform 30%', ja: 'クリエイター70% / プラットフォーム30%' },
        badgeDesc: { zh: '新手上路, 品质待验证', en: 'New creator, quality unverified', ja: '新規クリエイター、品質検証中' },
      },
      {
        level: 'L2',
        nameZh: '进阶创作者', nameEn: 'Advanced Creator', nameJa: '中級クリエイター',
        icon: '🥈', color: '#c0c0c0',
        threshold: { zh: '累计销量≥100笔', en: 'Cumulative sales ≥100', ja: '累計販売数≥100件' },
        revenueSplit: { zh: '创作者80% / 平台20%', en: 'Creator 80% / Platform 20%', ja: 'クリエイター80% / プラットフォーム20%' },
        badgeDesc: { zh: '百笔交付, 市场认可', en: '100+ sales, market-proven', ja: '100件以上販売、市場で実証済み' },
      },
      {
        level: 'L3',
        nameZh: '旗舰创作者', nameEn: 'Flagship Creator', nameJa: 'フラッグシップクリエイター',
        icon: '🥇', color: '#ffd700',
        threshold: { zh: '累计销量≥1000笔', en: 'Cumulative sales ≥1,000', ja: '累計販売数≥1,000件' },
        revenueSplit: { zh: '创作者90% / 平台10%', en: 'Creator 90% / Platform 10%', ja: 'クリエイター90% / プラットフォーム10%' },
        badgeDesc: { zh: '千笔验证, 顶级信誉', en: '1,000+ sales, top-tier trust', ja: '1,000件以上販売、最高信頼' },
      },
    ],

    extraBadges: [
      { id: 'verified', icon: '✅', zh: '已认证', en: 'Verified', ja: '認証済み', descZh: '已绑定真实券商账户', descEn: 'Real broker account linked', descJa: '実際の証券口座と連携済み' },
      { id: 'audited', icon: '🔍', zh: '已审计', en: 'Audited', ja: '監査済み', descZh: '历史回测数据经平台审计', descEn: 'Backtest history audited by platform', descJa: 'バックテスト履歴をプラットフォームが監査' },
      { id: 'editor_pick', icon: '⭐', zh: '编辑精选', en: 'Editor\'s Pick', ja: 'エディターズチョイス', descZh: '平台团队认证的高质量策略', descEn: 'High-quality strategy curated by team', descJa: 'チーム厳選の高品質戦略' },
      { id: 'consistent', icon: '📈', zh: '持续盈利', en: 'Consistent', ja: '安定収益', descZh: '连续6个月正收益', descEn: '6 consecutive months positive return', descJa: '6ヶ月連続プラスリターン' },
      { id: 'low_dd', icon: '🛡️', zh: '低回撤', en: 'Low Drawdown', ja: '低ドローダウン', descZh: '历史最大回撤<15%', descEn: 'Historical max DD <15%', descJa: '過去最大DD <15%' },
    ],

    badgeLayout: {
      position: 'creator_card_header',
      style: 'inline-chip-row',
      maxVisible: 4,
      overflowLabel: { zh: '+{n}个徽章', en: '+{n} badges', ja: '+{n}個のバッジ' },
    },

    auditLog: {
      title: { zh: '审计记录', en: 'Audit Log', ja: '監査ログ' },
      emptyState: { zh: '该创作者暂无审计记录', en: 'No audit records for this creator yet', ja: 'このクリエイターの監査記録はまだありません' },
      entries: ['date', 'action', 'result', 'auditor'],
      auditTypes: [
        { id: 'signal_accuracy', zh: '信号准确率审计', en: 'Signal accuracy audit', ja: 'シグナル精度監査' },
        { id: 'backtest_verify', zh: '回测数据验证', en: 'Backtest data verification', ja: 'バックテストデータ検証' },
        { id: 'code_review', zh: '代码安全审查', en: 'Code security review', ja: 'コードセキュリティ審査' },
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════════════════
   * Element 2: Real Data — 真实数据
   * 
   * 展示创作者的历史表现, 不靠说靠数据。
   * 每一条数据都有来源 (可追溯)
   * 包含: 统计摘要 + 回测记录 + 实盘记录 (如有)
   * ═══════════════════════════════════════════════════════════════════════ */
  element2_data: {
    title: { zh: '真实数据', en: 'Real Data', ja: '実績データ' },

    summaryCard: {
      title: { zh: '历史表现', en: 'Historical Performance', ja: '過去のパフォーマンス' },
      disclaimer: { zh: '⚠️ 过去业绩不代表未来收益。以下数据由平台自动采集, 未篡改。', en: '⚠️ Past performance ≠ future results. Data auto-collected by platform, untampered.', ja: '⚠️ 過去の実績は将来のリターンを保証しません。以下はプラットフォームが自動収集した未改ざんデータです。' },
      fields: [
        { id: 'totalReturn', zh: '累计收益', en: 'Total Return', ja: '累計リターン', format: '0.0%' },
        { id: 'annualReturn', zh: '年化收益', en: 'Annualized', ja: '年率リターン', format: '0.0%' },
        { id: 'maxDrawdown', zh: '最大回撤', en: 'Max DD', ja: '最大DD', format: '0.0%' },
        { id: 'sharpe', zh: '夏普比率', en: 'Sharpe', ja: 'シャープレシオ', format: '0.00' },
        { id: 'winRate', zh: '胜率', en: 'Win Rate', ja: '勝率', format: '0%' },
        { id: 'avgHoldDays', zh: '均持仓天数', en: 'Avg Hold (Days)', ja: '平均保有日数', format: '0' },
        { id: 'signalCount', zh: '历史信号数', en: 'Signal Count', ja: 'シグナル数', format: '0' },
        { id: 'backtestPeriod', zh: '回测区间', en: 'Backtest Period', ja: 'バックテスト期間' },
      ],
      sourceLabel: { zh: '数据来源: 平台自动回测引擎 (unbiased)', en: 'Source: Platform auto-backtest engine', ja: 'データソース: プラットフォーム自動バックテストエンジン' },
    },

    equityCurve: {
      title: { zh: '净值曲线', en: 'Equity Curve', ja: '資産曲線' },
      benchmark: { zh: '对比基准: {benchmark}', en: 'vs {benchmark}', ja: '{benchmark}対比' },
    },

    drawdownChart: {
      title: { zh: '回撤曲线', en: 'Drawdown Chart', ja: 'ドローダウン推移' },
    },

    liveRecord: {
      title: { zh: '实盘跟单记录 (如有)', en: 'Live Copy Record (if any)', ja: '実運用コピー記録 (ある場合)' },
      emptyState: { zh: '该创作者尚未开启实盘跟单。以下为回测数据。', en: 'This creator hasn\'t enabled live copy trading. Below is backtest data.', ja: 'このクリエイターはまだ実運用コピー取引を有効にしていません。以下はバックテストデータです。' },
    },

    dataIntegrity: {
      title: { zh: '数据完整性', en: 'Data Integrity', ja: 'データ完全性' },
      fields: [
        { id: 'coverage', zh: '回测覆盖: {start} ~ {end}', en: 'Coverage: {start} ~ {end}', ja: 'カバレッジ: {start} ~ {end}' },
        { id: 'survivorship', zh: '生存偏差: 已剔除退市股票', en: 'Survivorship bias: delisted stocks excluded', ja: '生存バイアス: 上場廃止銘柄を除外済み' },
        { id: 'lookahead', zh: '前瞻偏差: 无 (逐日回测)', en: 'Look-ahead bias: None (daily walk-forward)', ja: '先読みバイアス: なし (日次ウォークフォワード)' },
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════════════════
   * Element 3: Transparent Pricing — 定价透明
   * 
   * 用户付的钱去哪了? 清清楚楚。
   * 拆解: 策略价格 = 创作者收入 + 平台服务费
   * ═══════════════════════════════════════════════════════════════════════ */
  element3_pricing: {
    title: { zh: '定价透明', en: 'Transparent Pricing', ja: '透明な価格設定' },

    priceBreakdown: {
      title: { zh: '价格构成', en: 'Price Breakdown', ja: '価格内訳' },
      layout: 'donut-chart',
      segments: [
        { id: 'creator', zh: '创作者收入', en: 'Creator Earns', ja: 'クリエイター収入', color: '#22c55e' },
        { id: 'platform', zh: '平台服务费', en: 'Platform Fee', ja: 'プラットフォーム手数料', color: '#6366f1' },
      ],
      formula: { zh: '你付的 {totalPrice} USDT = 创作者 {creatorEarns} ({pct}%) + 平台 {platformFee} ({platformPct}%)', en: 'You pay {totalPrice} USDT = Creator {creatorEarns} ({pct}%) + Platform {platformFee} ({platformPct}%)', ja: 'お支払い {totalPrice} USDT = クリエイター {creatorEarns} ({pct}%) + プラットフォーム {platformFee} ({platformPct}%)' },
    },

    pricingTier: {
      title: { zh: '产品定价', en: 'Product Pricing', ja: '商品価格' },
      tiers: [
        { type: 'strategy_template', zh: '策略模板', en: 'Strategy Template', ja: '戦略テンプレート', priceType: 'one_time', range: '9.9~199 USDT' },
        { type: 'strategy_bundle', zh: '策略组合包', en: 'Strategy Bundle', ja: '戦略バンドル', priceType: 'one_time', range: '19.9~499 USDT' },
        { type: 'signal_subscription', zh: '信号订阅(月)', en: 'Signal Sub (monthly)', ja: 'シグナル購読(月)', priceType: 'subscription', range: '9.9~99 USDT/月' },
        { type: 'tip', zh: '打赏', en: 'Tip', ja: '投げ銭', priceType: 'one_time', range: '9.9/19.9/49.9/99.9 USDT' },
      ],
    },

    noHiddenFees: {
      title: { zh: '无隐藏费用', en: 'No Hidden Fees', ja: '隠れた費用なし' },
      items: [
        { zh: '无需月费/会员费', en: 'No monthly or membership fees', ja: '月額・会員費不要' },
        { zh: '无需KYC认证', en: 'No KYC required', ja: 'KYC不要' },
        { zh: 'USDT支付, 无货币转换费', en: 'USDT only, no FX conversion', ja: 'USDT決済のみ、為替手数料なし' },
        { zh: '退款: 策略失效/信号错误可申请', en: 'Refund: eligible for broken strategies/signals', ja: '返金: 戦略不具合・シグナル誤りの場合対応' },
      ],
    },
  },

  /* ═══════════════════════════════════════════════════════════════════════
   * Element 4: Security — 安全声明
   * 
   * 用户的资金、数据、隐私都是安全的。
   * 不夸大, 实事求是。
   * ═══════════════════════════════════════════════════════════════════════ */
  element4_security: {
    title: { zh: '安全保障', en: 'Security', ja: 'セキュリティ' },

    sections: [
      {
        id: 'fund_safety',
        icon: '💰',
        title: { zh: '资金安全', en: 'Fund Safety', ja: '資金安全' },
        body: { zh: '你的资金始终在你的券商账户中。我们只是提供策略建议, 无法触碰你的资金。你不必"充值"到平台 — 你的钱在你自己的券商里。', en: 'Your money stays in your broker account. We only provide strategy advice — we can\'t touch your funds. You don\'t "deposit" to us — your money is in your own broker.', ja: 'あなたの資金は常に証券口座にあります。私たちは戦略アドバイスのみ提供し、資金に触れることはできません。プラットフォームに「入金」する必要はありません。' },
      },
      {
        id: 'data_privacy',
        icon: '🔒',
        title: { zh: '数据隐私', en: 'Data Privacy', ja: 'データプライバシー' },
        body: { zh: '你的持仓、交易记录、策略偏好仅存本机。我们不会上传、分析或出售你的交易数据。', en: 'Your holdings, trades, and strategy preferences are local-only. We do not upload, analyze, or sell your trading data.', ja: '保有銘柄、取引記録、戦略設定はローカルのみ保存。取引データをアップロード、分析、販売することはありません。' },
      },
      {
        id: 'api_key_safety',
        icon: '🔑',
        title: { zh: 'API密钥安全', en: 'API Key Safety', ja: 'APIキー安全' },
        body: { zh: '券商API Key经AES-256-GCM加密后仅存本机。连接测试后立即清除内存中的明文Key。你可以随时在券商后台撤销该Key。', en: 'Broker API Keys are AES-256-GCM encrypted, local-only. Plaintext keys are wiped from memory after connection test. Revoke anytime from your broker\'s site.', ja: '証券APIキーはAES-256-GCM暗号化でローカルのみ保存。接続テスト後、平文キーはメモリから即消去。いつでも証券会社サイトで無効化可能。' },
      },
      {
        id: 'strategy_safety',
        icon: '🛡️',
        title: { zh: '策略安全', en: 'Strategy Safety', ja: '戦略安全' },
        body: { zh: '所有上架策略经平台自动回测验证+人工抽查。策略代码不可执行恶意操作 — 我们只跑信号计算, 不会在您的设备上执行任何不受信任的代码。', en: 'All listed strategies are auto-backtested + manually sampled. Strategy code cannot execute malicious actions — we only run signal computation, never untrusted code on your device.', ja: '全出品戦略は自動バックテスト検証+人手サンプルチェック済み。戦略コードは悪意のある操作を実行できません — シグナル計算のみ実行、お客様の端末で信頼できないコードを実行することはありません。' },
      },
    ],

    footer: {
      guarantee: { zh: '✅ 30天策略效果保障: 如果策略在30天内失效 (信号准确率<50%), 可以申请全额退款。', en: '✅ 30-Day Performance Guarantee: Full refund if strategy signal accuracy drops below 50% within 30 days.', ja: '✅ 30日間パフォーマンス保証: 30日以内にシグナル精度が50%未満に低下した場合、全額返金。' },
      contact: { zh: '有安全问题? → 联系安全团队: security@quant-moo.io', en: 'Security concerns? → Contact: security@quant-moo.io', ja: 'セキュリティに関するお問い合わせ: security@quant-moo.io' },
    },
  },

  /* ═══════════════════════════════════════════════════════════════════════
   * Layout: Creator Profile Page
   * 
   * 创作者主页 = 创作者卡片 (顶部) → 信任体系4tab → 产品列表
   * ═══════════════════════════════════════════════════════════════════════ */
  pageLayout: {
    creatorCard: {
      fields: ['avatar', 'displayName', 'levelBadge', 'extraBadges', 'bio', 'joinedDate', 'totalSales', 'totalRevenue'],
    },
    trustTabs: [
      { id: 'badges', zh: '🏅 认证', en: '🏅 Credentials', ja: '🏅 認証', element: 1 },
      { id: 'data', zh: '📊 数据', en: '📊 Performance', ja: '📊 実績', element: 2 },
      { id: 'pricing', zh: '💲 定价', en: '💲 Pricing', ja: '💲 価格', element: 3 },
      { id: 'security', zh: '🔒 安全', en: '🔒 Security', ja: '🔒 セキュリティ', element: 4 },
    ],
    productList: {
      title: { zh: '上架产品 ({count})', en: 'Listed Products ({count})', ja: '出品商品 ({count})' },
      sortOptions: ['最新', '销量最高', '评分最高', '价格最低'],
    },
  },
};

export default CREATOR_TRUST_SYSTEM;
