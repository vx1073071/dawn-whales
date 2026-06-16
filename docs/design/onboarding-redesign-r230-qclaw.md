/* ════════════════════════════════════════════════════════════════════════════
 * R230-QClaw#1 — 新手引导完整重设计 (Onboarding Redesign)
 *           8h: 5-Step Full-Funnel Onboarding Design
 *
 * 设计目标:
 *   1. 新用户从零到首笔交易 ≤15 分钟
 *   2. 每一步有明确CTA + 跳过/返回
 *   3. 11 语言完整文案
 *   4. 响应式: sm (mobile) / md (tablet) / lg (desktop)
 *   5. 暗色模式 + 品牌金主色调
 *
 * 五步流程:
 *   Step 1: Connect Broker  (连接券商, 3min)
 *   Step 2: Discover Strategy (选择策略, 4min)
 *   Step 3: Configure Parameters (微调参数, 3min)
 *   Step 4: Paper Trade Backtest (模拟回测验证, 3min)
 *   Step 5: First Live Trade (首笔真实交易, 2min)
 *
 *   Total: ~15 minutes
 * ════════════════════════════════════════════════════════════════════════════ */

// ═══════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════

export interface OnboardingStep {
  id: number;
  slug: string;
  title: string;
  subtitle: string;
  icon: string;           // Emoji/svg
  estimatedMinutes: number;
  completionCriteria: string[];
}

export interface OnboardingUserProfile {
  targetMarket: string;       // 'hk' | 'us' | 'crypto' | 'jp' | 'global'
  riskTolerance: string;      // 'low' | 'medium' | 'high'
  accountSize: string;        // 'small' | 'medium' | 'large'
  tradingStyle: string;       // 'swing' | 'day' | 'position' | 'auto'
  experienceLevel: string;    // 'beginner' | 'intermediate' | 'advanced'
}

export interface OnboardingState {
  currentStep: number;        // 1-5
  completed: boolean;
  skippedSteps: number[];
  profile: OnboardingUserProfile;
  selectedBroker: string | null;
  selectedStrategy: string | null;
  selectedParams: Record<string, number>;
  backtestResult: { totalReturn: number; maxDrawdown: number; sharpe: number; winRate: number } | null;
  firstTradeComplete: boolean;
}

// ═══════════════════════════════════════════════════════════
// STEP DEFINITIONS
// ═══════════════════════════════════════════════════════════

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 1,
    slug: 'connect-broker',
    title: 'Connect Your Broker',
    subtitle: 'Link your trading account in 60 seconds',
    icon: '🔌',
    estimatedMinutes: 3,
    completionCriteria: [
      'Select a broker from 13 supported',
      'Enter API credentials (local AES-256 encrypted)',
      'Verify connection with latency test',
      'View your current balance & positions',
    ],
  },
  {
    id: 2,
    slug: 'discover-strategy',
    title: 'Discover Your Strategy',
    subtitle: 'AI recommends strategies that fit you',
    icon: '🧠',
    estimatedMinutes: 4,
    completionCriteria: [
      'Answer 4 questions about your trading style',
      'AI scans 124 templates across 11 markets',
      'Review top 3 personalized recommendations',
      'Each strategy shows: description / risk / expected return',
    ],
  },
  {
    id: 3,
    slug: 'configure-params',
    title: 'Fine-Tune Parameters',
    subtitle: 'Keep defaults or customize your edge',
    icon: '🎛️',
    estimatedMinutes: 3,
    completionCriteria: [
      'Preview all tunable parameters with human explanations',
      'Drag sliders: stop-loss / position size / holding period',
      'See real-time impact on risk/reward ratio',
      'One-click "Use AI Suggested" or customize freely',
    ],
  },
  {
    id: 4,
    slug: 'paper-trade',
    title: 'Paper Trade Backtest',
    subtitle: 'Run a risk-free simulation before going live',
    icon: '📊',
    estimatedMinutes: 3,
    completionCriteria: [
      'Auto-backtest with last 6 months of market data',
      'See performance: return / drawdown / Sharpe / win rate',
      'View equity curve chart',
      'One-click promote to live when ready',
    ],
  },
  {
    id: 5,
    slug: 'first-trade',
    title: 'Your First Live Trade',
    subtitle: 'With one click, turn strategy into action',
    icon: '🚀',
    estimatedMinutes: 2,
    completionCriteria: [
      'Review final confirmation: strategy + broker + size',
      'USDT wallet balance check for fees',
      'One-click "Execute First Trade"',
      'Confetti celebration + next steps guide',
    ],
  },
];

// ═══════════════════════════════════════════════════════════
// STEP 1: CONNECT BROKER — UX Design
// ═══════════════════════════════════════════════════════════

export const STEP1_DESIGN = {
  layout: 'Split layout: left=broker grid (3-col), right=connection detail panel',
  structure: {
    brokerGrid: {
      description: 'Cards showing 13 supported brokers in 3 rows',
      each: {
        logo: 'broker logo (24px)',
        name: 'broker friendly name',
        region: 'market flag emoji + region name',
        features: 'tag badges (Stocks / Options / Futures / Crypto / Paper)',
        status: 'disconnected = gray / connected = green badge',
        action: 'click = open connection drawer on right side',
      },
    },
    connectionPanel: {
      description: 'Right-side drawer showing connection flow for selected broker',
      steps: [
        { title: 'Where to get your API Key', content: 'Step-by-step link to broker\'s API management page' },
        { title: 'Enter credentials', content: '2 fields: API Key + Secret (password masked)' },
        { title: 'Test connection', content: 'Ping latency + balance check + permissions verify' },
        { title: 'Done!', content: 'Green checkmark + broker card lights up' },
      ],
      securityNotice: {
        icon: '🔒',
        text: 'Your API key is encrypted with AES-256-GCM and stored ONLY on this device. Never uploaded to our servers.',
        style: 'amber/gold security banner at top of panel',
      },
    },
  },
  skipButton: { text: 'Skip for now (you can connect later)', style: 'text-secondary link at bottom' },
  edgeCases: {
    noBroker: 'Show "Paper Trading Only" option — use simulated market data with no real broker needed',
    failedConnection: 'Retry button + troubleshooting link (firewall / 2FA / API permissions)',
    regionBlocked: 'Suggest alternative broker available in user\'s country',
  },
};

// ═══════════════════════════════════════════════════════════
// STEP 2: DISCOVER STRATEGY — UX Design
// ═══════════════════════════════════════════════════════════

export const STEP2_DESIGN = {
  layout: 'Vertical flow: quiz → scan animation → top 3 cards',
  structure: {
    quizPhase: {
      description: '4 quick questions in a card-based flow (1 at a time)',
      questions: [
        {
          id: 'market',
          question: 'Which market do you mostly trade?',
          options: [
            { label: '🇭🇰 Hong Kong Stocks', value: 'hk' },
            { label: '🇺🇸 US Stocks', value: 'us' },
            { label: '🪙 Crypto', value: 'crypto' },
            { label: '🇯🇵 Japan', value: 'jp' },
            { label: '🌍 Global / Others', value: 'global' },
          ],
        },
        {
          id: 'risk',
          question: 'How much risk can you tolerate?',
          options: [
            { label: '🛡️ Conservative', value: 'low', desc: 'I\'d rather sleep well than chase high returns' },
            { label: '⚖️ Moderate', value: 'medium', desc: 'Some volatility is fine' },
            { label: '🔥 Aggressive', value: 'high', desc: 'I want maximum upside potential' },
          ],
        },
        {
          id: 'style',
          question: 'What\'s your preferred trading style?',
          options: [
            { label: '📅 Swing (days-weeks)', value: 'swing' },
            { label: '⚡ Day Trading (intraday)', value: 'day' },
            { label: '🏛️ Position (months+)', value: 'position' },
            { label: '🤖 Automated (set & forget)', value: 'auto' },
          ],
        },
        {
          id: 'size',
          question: 'Roughly, what\'s your account size?',
          options: [
            { label: '<$10,000', value: 'small' },
            { label: '$10,000 - $100,000', value: 'medium' },
            { label: '$100,000+', value: 'large' },
          ],
          privacyNote: 'Not stored anywhere. Used only to filter strategy suitability.',
        },
      ],
    },
    scanningPhase: {
      description: 'AI spins through 124 templates, scores by match %',
      animation: 'Radar scan effect with factor names flying by',
      duration: '~3 seconds (simulated, cached results)',
      filter: 'Exclude: incompatible markets / risk mismatch / insufficient capital',
      rank: 'Sort by: profile match (60%) + backtest Sharpe (25%) + creator reputation (15%)',
    },
    resultsPhase: {
      description: '3 cards side by side (responsive: vertical on mobile)',
      eachCard: {
        header: 'strategy name + match % badge',
        body: 'One-liner description (CN ≤24 chars), market / risk / expected return / max dd',
        features: '3 key factor highlights with tooltip explanations',
        actions: 'Tap to select → auto-fills Step 3 params',
      },
      empty: 'If 0 results: "No strategies match yet. Try broader filters or <Explore All 124 Templates>"',
      fallback: 'Always show 1 fallback: "Simple Moving Average Crossover" (universal, safe baseline)',
    },
  },
  skipButton: { text: 'I know what I want — take me to all strategies', style: 'primary-outline' },
};

// ═══════════════════════════════════════════════════════════
// STEP 3: CONFIGURE PARAMETERS — UX Design
// ═══════════════════════════════════════════════════════════

export const STEP3_DESIGN = {
  layout: 'Split: left=parameter list with sliders, right=live impact preview',
  structure: {
    paramList: {
      description: 'Vertical list of tunable parameters from the selected strategy',
      maxParams: 8, // Cap at 8 visible; scroll if more
      eachParam: {
        humanLabel: 'Friendly name (e.g. "Stop-Loss Threshold" not "stopLossPct")',
        humanDesc: 'One-line plain-language explanation',
        unit: '% | days | USD | ratio',
        currentValue: 'Pre-filled from AI recommendation or default',
        range: 'min — max (inclusive)',
        slider: 'Interactive range slider with live thumb value',
        impact: 'Small badge showing "🟡 Moderate risk" / "🟢 Conservative" / "🔴 Aggressive"',
        reset: 'Reset to default button per parameter',
      },
      aiSuggestButton: {
        text: '✨ Use AI Suggested Values',
        desc: 'One click fills all parameters with DeepSeek-optimized values based on current market conditions',
        cost: '1 USDT (deducted from wallet)',
        style: 'gold primary CTA at top of param list',
      },
    },
    livePreview: {
      description: 'Right panel updates in real-time as you slide',
      shows: {
        riskRewardBar: 'Visual bar: Risk --- Reward (color-coded)',
        expectedMetrics: 'Annualized return / Max drawdown / Win rate / Avg holding days',
        scenarioSim: '3 scenarios: Bull case 🟢 / Base case 🟡 / Bear case 🔴',
        positionSizing: 'Recommended position size (in USD and % of portfolio)',
      },
    },
  },
  guardrails: {
    maxLeverage: '⛔ Position size × leverage must not exceed 200% of account',
    minCapital: '⛔ Position size must be ≥ broker minimum lot size',
    riskWarn: '⚠️ Warning banner if max drawdown > 50% of account',
  },
  edgeCases: {
    paramMissing: 'Show "Default" badge and disable slider if param undefined',
    invalidCombo: 'Red highlight + tooltip if two params conflict (e.g. tight stop-loss + high leverage)',
  },
};

// ═══════════════════════════════════════════════════════════
// STEP 4: PAPER TRADE BACKTEST — UX Design
// ═══════════════════════════════════════════════════════════

export const STEP4_DESIGN = {
  layout: 'Centered dashboard with metric cards + equity curve chart',
  structure: {
    progressAnimation: {
      description: 'While backtest runs (~5s): progress bar + factor names scrolling',
      messages: ['Fetching 6 months of market data...', 'Running strategy signal computation...', 'Calculating performance metrics...', 'Rendering results...'],
    },
    resultDashboard: {
      topRow: '4 metric cards (centered, large numbers)',
      metrics: [
        { key: 'totalReturn', label: 'Total Return', format: '+XX.X%', color: 'up-blue or down-orange' },
        { key: 'maxDrawdown', label: 'Max Drawdown', format: '-XX.X%', color: 'down-orange' },
        { key: 'sharpeRatio', label: 'Sharpe Ratio', format: 'X.XX', color: 'text-primary' },
        { key: 'winRate', label: 'Win Rate', format: 'XX.X%', color: 'text-primary' },
      ],
      equityCurve: {
        type: 'ECharts line chart',
        data: 'Daily equity values over 6 months',
        style: 'Dark background, blue(#3b82f6) line, orange(#f97316) drawdown fill',
        annotations: 'Auto-mark highest/lowest points',
      },
      scenarioBadges: {
        bull: { label: 'Bull Case 🟢', value: '+XX%', condition: 'Top 20% volatility scenario' },
        base: { label: 'Base Case 🟡', value: '+XX%', condition: 'Median scenario' },
        bear: { label: 'Bear Case 🔴', value: '-XX%', condition: 'Bottom 20% volatility scenario' },
      },
    },
    actions: {
      primaryCTA: '🚀 Go Live — Start Real Trading',
      secondaryCTA: '📋 Export Report',
      tertiaryCTA: '🔄 Try Different Parameters',
    },
  },
  edgeCases: {
    insufficientData: 'Strategy requires ≥1 year data but only 6 months available → warning banner + still run',
    backtestError: 'Retry button + "Try simpler strategy" suggestion',
    veryBadResults: '🤔 "This strategy underperformed. Here are 3 alternatives." — show suggestions instead of dead end',
  },
};

// ═══════════════════════════════════════════════════════════
// STEP 5: FIRST LIVE TRADE — UX Design
// ═══════════════════════════════════════════════════════════

export const STEP5_DESIGN = {
  layout: 'Centered card: confirmation checklist → execute button → celebration',
  structure: {
    confirmationChecklist: {
      items: [
        { icon: '✅', label: 'Broker', value: '{broker name} — Connected', style: 'green' },
        { icon: '✅', label: 'Strategy', value: '{strategy name}', style: 'text-primary' },
        { icon: '✅', label: 'Position Size', value: '{size} ({pct}% of portfolio)', style: 'text-primary' },
        { icon: '✅', label: 'Stop-Loss', value: '-{stopLoss}%', style: 'orange' },
        { icon: '✅', label: 'Take-Profit', value: '+{takeProfit}%', style: 'blue' },
        { icon: '💰', label: 'Fee', value: '{fee} USDT will be deducted', style: 'text-secondary' },
        { icon: '🔒', label: 'Security', value: 'Order sent via encrypted broker API', style: 'green' },
      ],
      walletBalance: {
        label: 'USDT Wallet Balance',
        value: '{balance} USDT',
        warning: '⚠️ Insufficient balance — Top up now' if balance < fee,
      },
    },
    executeButton: {
      text: '⚡ Execute First Trade',
      style: 'Gold gradient pulse animation, 72px wide',
      countdown: '3-step confirm: Tap "Execute" → "Are you sure?" → "Go!" (prevents accidental click)',
    },
    celebration: {
      trigger: 'On successful order confirmation from broker',
      animation: [
        'Confetti burst (🥳🎉✨) for 3 seconds',
        'Large checkmark ✅ animation',
        'Order confirmation details slide in from bottom',
      ],
      nextSteps: [
        '📊 View in Portfolio',
        '🔔 Set up price alerts for this position',
        '📈 Track performance in Analytics',
        '🚀 Discover more strategies',
      ],
      social: 'Optional: "Share my first trade" — generates anonymized card for creator social proof',
    },
  },
  edgeCases: {
    orderRejected: 'Show broker error message + retry button + "Edit parameters" link',
    walletInsufficient: 'Auto-redirect to deposit page with pre-filled amount',
    brokerDisconnected: 'Auto-redirect to Step 1 reconnect flow',
    marketClosed: 'Queue order for next market open + notification',
    priceSlippage: 'Shows warning if current price deviates >2% from expected',
  },
};

// ═══════════════════════════════════════════════════════════
// GLOBAL ONBOARDING UX RULES
// ═══════════════════════════════════════════════════════════

export const ONBOARDING_UX_RULES = {
  progress: {
    indicator: '5-dot stepper at top, connected by line (completed=gold, current=blue glow, future=gray)',
    resume: 'Remember progress in IndexedDB. On restart: "Continue where you left off?" modal',
    skip: 'Every step can be skipped. Skipped steps appear as orange dots in stepper.',
    back: 'Every step has ← Back button to previous step (editing is safe)',
  },
  timing: {
    totalEstimated: '15 minutes',
    noTimeout: 'No countdown timer. Users can take hours or days. Progress persists.',
    returnCTA: 'If returning after >1 hour: "Welcome back! You were at Step X. Continue?"',
  },
  language: {
    support: '11 languages: en/zh-CN/zh-HK/zh-TW/ja/ko/de/fr/es/it/ru',
    detect: 'Auto-detect browser language on first load (fallback: en)',
    switch: 'Language switcher in top-right corner available throughout onboarding',
  },
  theme: {
    mode: 'Dark mode only (matches app default)',
    accent: 'Brand gold (#d4a574) for CTAs and progress indicators',
    animation: 'Subtle transitions (fade/slide, 200ms ease-out). No autoplay video.',
  },
  responsive: {
    sm: '<640px — Single column, cards stack vertically, bottom nav',
    md: '640-1024px — Two column where applicable, side nav',
    lg: '>1024px — Full desktop: left nav + content area + live preview',
  },
  accessibility: {
    keyboard: 'Full keyboard nav (Tab/Enter/Escape) through all steps',
    screenReader: 'aria-labels on all interactive elements, alt text on icons',
    focus: 'Visible focus ring (2px #d4a574) on Tab navigation',
    reduceMotion: 'Respect prefers-reduced-motion: disable animations/confetti',
  },
  dataPrivacy: {
    apiKeys: 'Never stored, never transmitted. AES-256-GCM encrypted local-only.',
    preferences: 'Saved to IndexedDB only. No server upload.',
    analytics: 'Anonymous onboarding completion rate only (no personal data)',
    deleteData: '"Reset Onboarding" button in settings: clears all progress and starts fresh',
  },
};

// ═══════════════════════════════════════════════════════════
// COMPONENT ARCHITECTURE
// ═══════════════════════════════════════════════════════════

export const COMPONENT_ARCHITECTURE = {
  container: 'OnboardingWizard.tsx',       // State machine, step router, progress bar
  stepComponents: {
    step1: 'ConnectBrokerStep.tsx',         // Broker grid + connection panel
    step2: 'DiscoverStrategyStep.tsx',      // Quiz + AI scan + results cards
    step3: 'ConfigureParamsStep.tsx',       // Sliders + live preview
    step4: 'PaperTradeStep.tsx',            // Backtest runner + results dashboard
    step5: 'FirstTradeStep.tsx',            // Confirmation + execute + celebration
  },
  sharedComponents: {
    stepper: 'OnboardingStepper.tsx',       // 5-dot progress indicator
    card: 'OnboardingCard.tsx',             // Reusable card shell
    button: 'OnboardingCTA.tsx',            // Branded CTA button variants
    security: 'SecurityBanner.tsx',          // AES-256 info banner
    skip: 'SkipButton.tsx',                 // Consistent skip UI
  },
  state: {
    store: 'onboardingStore.ts',            // Zustand + IndexedDB persistence
    reset: 'clearOnboarding() action',       // Wipes all progress
  },
};

// This file: complete design spec for the full 5-step onboarding flow.
// Next: QC-3.2t extends with full i18n keys for all copy strings across 11 languages.
