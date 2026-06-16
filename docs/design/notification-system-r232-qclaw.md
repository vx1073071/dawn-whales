/* ════════════════════════════════════════════════════════════════════════════
 * R232-QClaw#1 — Strategy Signal Notification System Design
 *           10h: Full notification architecture + 3-level priority + DnD
 *
 * 设计范围:
 *   1. 通知架构 (Push推送 + 桌面通知 + 应用内通知中心)
 *   2. 3级通知体系 (P0-紧急 / P1-重要 / P2-信息)
 *   3. 通知类型目录 (信号/系统/社交/营销/入门)
 *   4. 免打扰模式 (时间段/静默策略/白名单)
 *   5. 渠道分发规则 (每个通知类型的渠道x级别矩阵)
 *   6. 桌面通知规范 (Electron Notification API)
 *   7. 通知偏好UI设计
 *   8. 通知模板i18n (9语言)
 * ════════════════════════════════════════════════════════════════════════════ */

// ═══════════════════════════════════════════════════════════
// 1. NOTIFICATION ARCHITECTURE
// ═══════════════════════════════════════════════════════════

export const NOTIFICATION_ARCHITECTURE = {
  overview: 'Strategy Signal Notification System (SSNS) — unified notification pipeline for Dawh Whales',

  dataFlow: [
    '1. Event Source (strategy engine / broker / system / social)',
    '2. NotificationRouter — classifies priority, checks DnD, selects channels',
    '3. Channel Dispatchers — Push / Desktop / InApp / Email / SMS',
    '4. NotificationStore (zustand + IndexedDB) — persistence, read/unread, history',
    '5. UI Layer — InApp NotificationCenter / Desktop Toast / OS Tray Badge',
  ],

  components: {
    eventSources: {
      strategyEngine: 'Signal generated, stop-loss hit, take-profit hit, strategy health <40',
      brokerAdapter: 'Order filled/rejected, connection lost/restored, balance low, margin call',
      marketData: 'Price alert triggered, volatility spike, market open/close',
      social: 'Copy trade executed, creator new strategy, follower milestone',
      system: 'Update available, backup needed, disk space low, API key expiring',
      onboarding: 'Step completed, milestone reached, feature unlocked',
    },
    router: 'NotificationRouter.ts — single entry point, decides priority + channels + DnD',
    channels: {
      push: 'In-app push via WebSocket (already connected for market data)',
      desktop: 'Electron Notification API (native OS notification)',
      inApp: 'Notification Center component (bell icon + unread badge)',
      email: 'Deferred batch (daily digest, weekly summary) — optional, user opt-in',
      sms: 'P0 only (margin call, liquidation warning) — optional, user opt-in',
    },
    persist: 'NotificationStore — IndexedDB backed, 30-day retention, max 1000 items',
  },

  techStack: {
    push: 'Existing UnifiedWebSocketManager (reuse market data WS connection)',
    desktop: 'Electron main-process Notification API',
    store: 'zustand + idb-keyval for IndexedDB persistence',
    i18n: 'All notification templates via i18n (9 languages)',
  },
};

// ═══════════════════════════════════════════════════════════
// 2. THREE-LEVEL PRIORITY SYSTEM
// ═══════════════════════════════════════════════════════════

export const PRIORITY_LEVELS = {
  P0_URGENT: {
    level: 0,
    name: 'P0 · Emergency',
    color: '#ef4444',    // red
    icon: '🔴',
    maxPerHour: Infinity, // no cap
    breakDnD: true,       // bypasses Do Not Disturb
    channels: ['push', 'desktop', 'inApp', 'sms'],  // all channels
    desktop: { urgency: 'critical', sound: 'alert.wav', sticky: true },
    examples: [
      'Stop-loss triggered',
      'Take-profit hit',
      'Margin call / liquidation warning',
      'Broker connection lost during active trade',
      'Critical system failure',
    ],
  },

  P1_IMPORTANT: {
    level: 1,
    name: 'P1 · Important',
    color: '#f59e0b',    // amber
    icon: '🟡',
    maxPerHour: 20,
    breakDnD: false,
    channels: ['push', 'inApp', 'desktop'],
    desktop: { urgency: 'normal', sound: 'chime.wav', sticky: false },
    examples: [
      'New strategy signal generated',
      'Order partially filled',
      'Strategy health dropped below 60',
      'Copy trade executed by followed creator',
      'Price alert triggered',
      'USDT wallet balance below threshold',
    ],
  },

  P2_INFO: {
    level: 2,
    name: 'P2 · Info',
    color: '#3b82f6',    // blue
    icon: '🔵',
    maxPerHour: 50,
    breakDnD: false,
    channels: ['push', 'inApp'],
    desktop: null,        // no desktop notification for info level
    examples: [
      'Daily market open/close',
      'Strategy backtest completed',
      'New strategy published by creator',
      'Weekly performance summary ready',
      'Onboarding milestone reached',
      'Software update available',
    ],
  },
};

// ═══════════════════════════════════════════════════════════
// 3. NOTIFICATION TYPE CATALOG (40 types)
// ═══════════════════════════════════════════════════════════

export const NOTIFICATION_CATALOG = {
  // ── TRADING SIGNALS (12 types) ──
  signal_entry: {
    category: 'trading',
    priority: 'P1_IMPORTANT',
    titleKey: 'notif_signal_entry_title',
    bodyKey: 'notif_signal_entry_body',
    params: ['strategy', 'symbol', 'direction', 'price'],
    actionRoute: '/portfolio/positions',
  },
  signal_exit: {
    category: 'trading',
    priority: 'P1_IMPORTANT',
    titleKey: 'notif_signal_exit_title',
    bodyKey: 'notif_signal_exit_body',
    params: ['strategy', 'symbol', 'price', 'pnl'],
    actionRoute: '/portfolio/history',
  },
  stoploss_hit: {
    category: 'trading',
    priority: 'P0_URGENT',
    titleKey: 'notif_stoploss_title',
    bodyKey: 'notif_stoploss_body',
    params: ['symbol', 'stopPrice', 'lossAmount'],
    actionRoute: '/portfolio/positions',
    sound: 'alert.wav',
  },
  takeprofit_hit: {
    category: 'trading',
    priority: 'P1_IMPORTANT',
    titleKey: 'notif_takeprofit_title',
    bodyKey: 'notif_takeprofit_body',
    params: ['symbol', 'targetPrice', 'profitAmount'],
    actionRoute: '/portfolio/positions',
  },
  order_filled: {
    category: 'trading',
    priority: 'P1_IMPORTANT',
    titleKey: 'notif_order_filled_title',
    bodyKey: 'notif_order_filled_body',
    params: ['symbol', 'direction', 'quantity', 'price'],
    actionRoute: '/portfolio/positions',
  },
  order_partial: {
    category: 'trading',
    priority: 'P2_INFO',
    titleKey: 'notif_order_partial_title',
    bodyKey: 'notif_order_partial_body',
    params: ['symbol', 'filledQty', 'totalQty'],
    actionRoute: '/trading/orders',
  },
  order_rejected: {
    category: 'trading',
    priority: 'P1_IMPORTANT',
    titleKey: 'notif_order_rejected_title',
    bodyKey: 'notif_order_rejected_body',
    params: ['symbol', 'reason'],
    actionRoute: '/trading/orders',
  },
  margin_call: {
    category: 'trading',
    priority: 'P0_URGENT',
    titleKey: 'notif_margin_call_title',
    bodyKey: 'notif_margin_call_body',
    params: ['marginUsed', 'marginLimit'],
    actionRoute: '/portfolio',
    sound: 'alert.wav',
  },

  // ── PRICE ALERTS (4 types) ──
  alert_price_above: {
    category: 'alert',
    priority: 'P1_IMPORTANT',
    titleKey: 'notif_price_above_title',
    bodyKey: 'notif_price_above_body',
    params: ['symbol', 'currentPrice', 'targetPrice'],
    actionRoute: '/watchlist',
  },
  alert_price_below: {
    category: 'alert',
    priority: 'P1_IMPORTANT',
    titleKey: 'notif_price_below_title',
    bodyKey: 'notif_price_below_body',
    params: ['symbol', 'currentPrice', 'targetPrice'],
    actionRoute: '/watchlist',
  },
  alert_volatility_spike: {
    category: 'alert',
    priority: 'P2_INFO',
    titleKey: 'notif_volatility_title',
    bodyKey: 'notif_volatility_body',
    params: ['symbol', 'volatility', 'threshold'],
    actionRoute: '/watchlist',
  },

  // ── SYSTEM (8 types) ──
  sys_broker_disconnected: {
    category: 'system',
    priority: 'P0_URGENT',
    titleKey: 'notif_broker_disconnected_title',
    bodyKey: 'notif_broker_disconnected_body',
    params: ['broker'],
    actionRoute: '/settings/brokers',
    sound: 'alert.wav',
  },
  sys_broker_reconnected: {
    category: 'system',
    priority: 'P2_INFO',
    titleKey: 'notif_broker_reconnected_title',
    bodyKey: 'notif_broker_reconnected_body',
    params: ['broker', 'downtime'],
    actionRoute: '/settings/brokers',
  },
  sys_update_available: {
    category: 'system',
    priority: 'P2_INFO',
    titleKey: 'notif_update_available_title',
    bodyKey: 'notif_update_available_body',
    params: ['version'],
    actionRoute: '/settings/updates',
  },
  sys_backup_needed: {
    category: 'system',
    priority: 'P2_INFO',
    titleKey: 'notif_backup_needed_title',
    bodyKey: 'notif_backup_needed_body',
    params: ['lastBackup'],
    actionRoute: '/settings/backup',
  },
  sys_api_expiring: {
    category: 'system',
    priority: 'P1_IMPORTANT',
    titleKey: 'notif_api_expiring_title',
    bodyKey: 'notif_api_expiring_body',
    params: ['broker', 'daysLeft'],
    actionRoute: '/settings/brokers',
  },
  sys_disk_low: {
    category: 'system',
    priority: 'P1_IMPORTANT',
    titleKey: 'notif_disk_low_title',
    bodyKey: 'notif_disk_low_body',
    params: ['freeGB'],
    actionRoute: '/settings',
  },

  // ── STRATEGY HEALTH (4 types) ──
  strat_health_critical: {
    category: 'strategy',
    priority: 'P1_IMPORTANT',
    titleKey: 'notif_strat_health_critical_title',
    bodyKey: 'notif_strat_health_critical_body',
    params: ['strategy', 'score'],
    actionRoute: '/strategies/detail',
  },
  strat_health_improved: {
    category: 'strategy',
    priority: 'P2_INFO',
    titleKey: 'notif_strat_health_improved_title',
    bodyKey: 'notif_strat_health_improved_body',
    params: ['strategy', 'score'],
    actionRoute: '/strategies/detail',
  },
  strat_backtest_done: {
    category: 'strategy',
    priority: 'P2_INFO',
    titleKey: 'notif_backtest_done_title',
    bodyKey: 'notif_backtest_done_body',
    params: ['strategy', 'sharpe', 'totalReturn'],
    actionRoute: '/strategies/detail',
  },

  // ── SOCIAL (5 types) ──
  social_copytrade_executed: {
    category: 'social',
    priority: 'P2_INFO',
    titleKey: 'notif_copytrade_executed_title',
    bodyKey: 'notif_copytrade_executed_body',
    params: ['creator', 'strategy', 'symbol'],
    actionRoute: '/copy-trade',
  },
  social_creator_new_strategy: {
    category: 'social',
    priority: 'P2_INFO',
    titleKey: 'notif_creator_new_strat_title',
    bodyKey: 'notif_creator_new_strat_body',
    params: ['creator', 'strategy'],
    actionRoute: '/marketplace',
  },
  social_follower_milestone: {
    category: 'social',
    priority: 'P2_INFO',
    titleKey: 'notif_follower_milestone_title',
    bodyKey: 'notif_follower_milestone_body',
    params: ['count'],
    actionRoute: '/profile',
  },
  social_leaderboard_change: {
    category: 'social',
    priority: 'P2_INFO',
    titleKey: 'notif_leaderboard_title',
    bodyKey: 'notif_leaderboard_body',
    params: ['rank', 'strategy'],
    actionRoute: '/leaderboard',
  },

  // ── ONBOARDING (5 types) ──
  onboard_step_complete: {
    category: 'onboarding',
    priority: 'P2_INFO',
    titleKey: 'notif_onboard_step_title',
    bodyKey: 'notif_onboard_step_body',
    params: ['step', 'stepName'],
    actionRoute: '/onboarding',
  },
  onboard_all_done: {
    category: 'onboarding',
    priority: 'P1_IMPORTANT',
    titleKey: 'notif_onboard_done_title',
    bodyKey: 'notif_onboard_done_body',
    params: [],
    actionRoute: '/dashboard',
  },
  onboard_reminder: {
    category: 'onboarding',
    priority: 'P2_INFO',
    titleKey: 'notif_onboard_reminder_title',
    bodyKey: 'notif_onboard_reminder_body',
    params: ['daysInactive'],
    actionRoute: '/onboarding',
    schedule: 'If inactive > 3 days',
  },
};

// ═══════════════════════════════════════════════════════════
// 4. DO NOT DISTURB (DND) SYSTEM
// ═══════════════════════════════════════════════════════════

export const DND_SYSTEM = {
  modes: {
    scheduled: {
      name: 'Scheduled DnD',
      description: 'Auto-enable during configured hours',
      config: {
        startHour: 22,  // default: 22:00
        endHour: 7,     // default: 07:00
        timezone: 'auto-detect from system',
      },
    },
    manual: {
      name: 'Manual DnD',
      description: 'Toggle on/off anytime. Shows in system tray.',
      duration: 'Until manually disabled',
    },
    trading: {
      name: 'Trading Focus',
      description: 'Only P0 trading signals get through. Mutes everything else.',
      breakP1: true,  // even P1 is muted in focus mode
      exceptions: ['stoploss_hit', 'margin_call', 'sys_broker_disconnected'],
    },
    sleeping: {
      name: 'Sleep Mode',
      description: 'Complete silence. No sound, no toast, no badge. P0 still queued in Notification Center.',
      muteAll: true,
      queueP0: true,
    },
  },

  behavior: {
    duringDnD: {
      P0: 'Delivered anyway (except Sleep Mode). Sound + desktop + in-app.',
      P1: 'Queued in Notification Center. No sound, no desktop toast.',
      P2: 'Silently logged. No notification, no badge increment.',
    },
    afterDnD: {
      summary: 'DnD digest: "You missed X notifications during quiet hours"',
      P0Summary: 'List all P0 events that fired during DnD',
      style: 'Non-intrusive banner at top of Notification Center',
    },
  },

  scheduledSettings: {
    default: { start: '22:00', end: '07:00', timezone: 'auto' },
    weekends: { start: '23:00', end: '08:00' },  // separate weekend schedule (optional)
    marketDependent: 'If market is open and user has active positions, DnD auto-delays by 30min',
  },
};

// ═══════════════════════════════════════════════════════════
// 5. CHANNEL DISPATCHING RULES
// ═══════════════════════════════════════════════════════════

export const CHANNEL_DISPATCH_RULES = {
  // Channels: push (in-app WS), desktop (OS native), inApp (bell center), email (batch), sms (P0 only)
  matrix: {
    //   P0      P1      P2
    push:    ['✅',   '✅',   '✅'],
    desktop: ['✅',   '✅',   '❌'],
    inApp:   ['✅',   '✅',   '✅'],
    email:   ['✅',   '⭕',   '⭕'],  // ⭕ = user opt-in only
    sms:     ['⭕',   '❌',   '❌'],  // ⭕ = opt-in + verified phone
  },

  throttling: {
    sameType: 'Max 1 notification of same type per minute (prevents spam)',
    sameStrategy: 'Max 3 notifications per strategy per hour',
    sound: 'Max 1 alert sound per 30 seconds (prevents cacophony)',
    desktopToast: 'Max 2 desktop toasts per 10 seconds (OS limits on Windows/macOS)',
  },

  grouping: {
    multipleOrders: 'Group N order updates into 1 notification: "3 orders updated"',
    multipleAlerts: 'Group concurrent price alerts: "5 price alerts triggered"',
    strategyBatch: 'Group strategy health updates into daily rollup',
    groupWindow: '30 second window for grouping before dispatch',
  },
};

// ═══════════════════════════════════════════════════════════
// 6. DESKTOP NOTIFICATION SPEC
// ═══════════════════════════════════════════════════════════

export const DESKTOP_NOTIFICATION_SPEC = {
  api: 'Electron main-process Notification (renderer sends IPC → main creates Notification)',

  structure: {
    title: 'Max 60 chars. {app} prefix auto-added: "QUANT MOO — {title}"',
    body: 'Max 120 chars. Truncated with "…" if longer.',
    icon: 'app-icon.png (QUANT MOO logo)',
    urgency: 'critical | normal (maps to Windows 10+/macOS priority)',
    actions: [
      { type: 'button', textKey: 'notif_action_view', action: 'focusWindow' },
      { type: 'button', textKey: 'notif_action_dismiss', action: 'dismiss' },
    ],
    P0_actions: [
      { type: 'button', textKey: 'notif_action_view', action: 'focusWindow' },
      { type: 'button', textKey: 'notif_action_acknowledge', action: 'ackP0' },
    ],
  },

  platformSpecific: {
    windows: {
      template: 'Toast notification (action center compatible)',
      maxActions: 2,
      image: 'Optional hero image (364×180px, PNG) — P0 only',
    },
    macOS: {
      template: 'Banner (default) or Alert (P0)',
      maxActions: 1 + reply field for P0,
      sound: 'Can use custom .caf files',
    },
  },

  clickBehavior: {
    default: 'Focus app window + navigate to actionRoute',
    P0: 'Focus window immediately + jump to relevant page',
    P1: 'Focus window + open Notification Center',
    P2: 'No desktop notification (in-app only)',
  },
};

// ═══════════════════════════════════════════════════════════
// 7. NOTIFICATION CENTER UI DESIGN
// ═══════════════════════════════════════════════════════════

export const NOTIFICATION_CENTER_UI = {
  entry: {
    icon: '🔔 Bell icon in top-right toolbar',
    badge: 'Red number badge (unread count, max "99+")',
    position: 'Right side of toolbar, before profile avatar',
    empty: 'Bell with no badge if 0 unread',
  },

  panel: {
    position: 'Dropdown from bell icon (right-aligned, 380px wide)',
    header: 'Notifications (Mark all read · Settings ⚙️)',
    tabs: ['All', 'Trading', 'System', 'Social'],
    maxVisible: 20,  // scroll for more
    empty: '🔔 No notifications yet. You\'re all caught up!',
  },

  item: {
    structure: [
      'Left: Priority dot (🔴🟡🔵) + Category icon',
      'Center: Title (bold, 1 line) + Body (2 lines max, truncated)',
      'Right: Relative timestamp ("2m ago", "1h ago", "Yesterday")',
    ],
    unread: 'Subtle blue left-border accent',
    read: 'Gray left-border, slightly dimmed text',
    hover: 'Slight background highlight + "Mark read" icon appears',
    tap: 'Navigate to actionRoute + auto mark read',
    swipe: 'Swipe right to dismiss (mobile), click X on desktop',
  },

  persistence: {
    store: 'IndexedDB via zustand persist middleware',
    retention: '30 days (auto-delete older)',
    maxCount: '1000 items (FIFO eviction beyond limit)',
    clear: '"Clear All" button with confirmation dialog',
  },
};

// ═══════════════════════════════════════════════════════════
// 8. NOTIFICATION PREFERENCES UI DESIGN
// ═══════════════════════════════════════════════════════════

export const PREFERENCES_UI = {
  page: 'Settings → Notifications',
  sections: [

    // Section 1: General
    {
      titleKey: 'notif_pref_general',
      toggles: [
        { key: 'notif_enabled', labelKey: 'notif_pref_enable_all', default: true },
        { key: 'notif_sound', labelKey: 'notif_pref_sound', default: true },
        { key: 'notif_desktop', labelKey: 'notif_pref_desktop', default: true,
          sub: 'Requires OS notification permission' },
      ],
    },

    // Section 2: Do Not Disturb
    {
      titleKey: 'notif_pref_dnd',
      controls: [
        { key: 'dnd_enabled', type: 'toggle', labelKey: 'notif_dnd_scheduled', default: true },
        { key: 'dnd_start', type: 'timepicker', labelKey: 'notif_dnd_start', default: '22:00' },
        { key: 'dnd_end', type: 'timepicker', labelKey: 'notif_dnd_end', default: '07:00' },
        { key: 'dnd_trading_focus', type: 'toggle', labelKey: 'notif_dnd_trading_focus',
          sub: 'During active trading hours, only P0 alerts get through' },
      ],
    },

    // Section 3: Per-Category Toggles
    {
      titleKey: 'notif_pref_categories',
      perCategory: [
        {
          category: 'trading',
          labelKey: 'notif_cat_trading',
          icon: '📊',
          toggles: {
            desktop: { labelKey: 'notif_pref_desktop', default: true },
            sound: { labelKey: 'notif_pref_sound', default: true },
          },
        },
        {
          category: 'alert',
          labelKey: 'notif_cat_alert',
          icon: '🚨',
          toggles: { desktop: { default: true }, sound: { default: true } },
        },
        {
          category: 'system',
          labelKey: 'notif_cat_system',
          icon: '⚙️',
          toggles: { desktop: { default: true }, sound: { default: false } },
        },
        {
          category: 'strategy',
          labelKey: 'notif_cat_strategy',
          icon: '🧠',
          toggles: { desktop: { default: false }, sound: { default: false } },
        },
        {
          category: 'social',
          labelKey: 'notif_cat_social',
          icon: '👥',
          toggles: { desktop: { default: false }, sound: { default: false } },
        },
        {
          category: 'onboarding',
          labelKey: 'notif_cat_onboarding',
          icon: '🎓',
          toggles: { desktop: { default: false }, sound: { default: false } },
        },
      ],
    },

    // Section 4: Email Digest
    {
      titleKey: 'notif_pref_email',
      controls: [
        { key: 'email_daily', type: 'toggle', labelKey: 'notif_email_daily', default: false,
          sub: 'Daily performance summary at 21:00' },
        { key: 'email_weekly', type: 'toggle', labelKey: 'notif_email_weekly', default: false,
          sub: 'Weekly strategy report every Monday' },
        { key: 'email_marketing', type: 'toggle', labelKey: 'notif_email_marketing', default: false },
      ],
    },
  ],

  resetButton: {
    labelKey: 'notif_pref_reset',
    text: 'Reset to defaults',
    confirmationDialog: true,
  },
};

// ═══════════════════════════════════════════════════════════
// 9. TECHNICAL IMPLEMENTATION NOTES
// ═══════════════════════════════════════════════════════════

export const IMPLEMENTATION_NOTES = {
  files: {
    engine: 'electron/engine/notifications/NotificationRouter.ts (classifies + dispatches)',
    dispatch: 'electron/engine/notifications/ChannelDispatcher.ts (push/desktop/inApp/email/sms)',
    dnd: 'electron/engine/notifications/DnDManager.ts (schedule + mode check + exceptions)',
    templates: 'electron/engine/notifications/NotificationTemplates.ts (all 40 templates with i18n keys)',
    store: 'src/stores/notificationStore.ts (zustand + IndexedDB)',
    ui: 'src/components/notification/NotificationCenter.tsx (bell + dropdown)',
    item: 'src/components/notification/NotificationItem.tsx (single notification row)',
    pref: 'src/components/settings/NotificationPreferences.tsx (settings page)',
    desktop: 'electron/main/desktopNotifier.ts (main-process Notification API wrapper)',
    types: 'electron/engine/notifications/types.ts (shared types)',
  },

  ipcChannels: {
    'notify:show': 'Renderer → Main: request desktop notification',
    'notify:click': 'Main → Renderer: user clicked notification',
    'notify:action': 'Main → Renderer: user clicked action button',
    'notify:pref:get': 'Get notification preferences',
    'notify:pref:set': 'Set notification preferences',
    'notify:dnd:status': 'Current DnD status (for tray icon indicator)',
  },

  performance: {
    groupBatch: 'Batch process notifications every 500ms (not per-event)',
    templateCache: 'Cache compiled notification templates (avoid repeated i18n lookups)',
    indexDBBatch: 'Batch-write unread status updates every 5s (not per-click)',
    wsrReuse: 'Reuse existing WS connection — no new connection for push',
  },

  testing: {
    unit: 'NotificationRouter classification / DnDManager scheduling / template rendering',
    integration: 'Full pipeline: event source → router → dispatch → store → UI',
    e2e: 'Desktop notification appears → user clicks → window focuses → correct page loaded',
  },
};

// ═══════════════════════════════════════════════════════════
// 10. NOTIFICATION i18n KEYS (66 keys)
// ═══════════════════════════════════════════════════════════

export const NOTIFICATION_I18N_KEYS = {
  // ── Notification Titles (signal types → 8 keys) ──
  'notif_signal_entry_title': 'New {direction} Signal: {symbol}',
  'notif_signal_entry_body': '{strategy} suggests {direction} on {symbol} at {price}',
  'notif_signal_exit_title': 'Exit Signal: {symbol}',
  'notif_signal_exit_body': '{strategy} suggests closing {symbol}. PnL: {pnl}',
  'notif_stoploss_title': '⛔ Stop-Loss Hit: {symbol}',
  'notif_stoploss_body': 'Stop-loss triggered at {stopPrice}. Loss: {lossAmount}',
  'notif_takeprofit_title': '🎯 Take-Profit Hit: {symbol}',
  'notif_takeprofit_body': 'Target reached at {targetPrice}. Profit: {profitAmount}',
  'notif_order_filled_title': 'Order Filled: {symbol}',
  'notif_order_filled_body': '{direction} {quantity} at {price}',
  'notif_order_partial_title': 'Order Partially Filled: {symbol}',
  'notif_order_partial_body': '{filledQty}/{totalQty} units filled',
  'notif_order_rejected_title': 'Order Rejected: {symbol}',
  'notif_order_rejected_body': 'Reason: {reason}',
  'notif_margin_call_title': '⚠️ Margin Call: {marginUsed}% Used',
  'notif_margin_call_body': 'Margin usage approaching limit ({marginLimit}%). Reduce positions.',

  // ── Price Alerts (4 keys) ──
  'notif_price_above_title': 'Price Alert: {symbol} ↑',
  'notif_price_above_body': 'Now at {currentPrice}. Crossed above {targetPrice}.',
  'notif_price_below_title': 'Price Alert: {symbol} ↓',
  'notif_price_below_body': 'Now at {currentPrice}. Dropped below {targetPrice}.',
  'notif_volatility_title': 'Volatility Spike: {symbol}',
  'notif_volatility_body': 'Volatility at {volatility}%, exceeding {threshold}% threshold.',

  // ── System (7 keys) ──
  'notif_broker_disconnected_title': '⚠️ {broker} Disconnected',
  'notif_broker_disconnected_body': 'Connection lost. Reconnecting automatically...',
  'notif_broker_reconnected_title': '{broker} Reconnected',
  'notif_broker_reconnected_body': 'Connection restored after {downtime}.',
  'notif_update_available_title': 'Update Available: v{version}',
  'notif_update_available_body': 'New version ready. Update to get the latest features.',
  'notif_backup_needed_title': 'Backup Reminder',
  'notif_backup_needed_body': 'Last backup was {lastBackup}. Back up your data.',
  'notif_api_expiring_title': 'API Key Expiring: {broker}',
  'notif_api_expiring_body': 'Your API key expires in {daysLeft} days. Renew to avoid disruption.',
  'notif_disk_low_title': 'Low Disk Space',
  'notif_disk_low_body': 'Only {freeGB}GB free. Clear old data to avoid issues.',

  // ── Strategy Health (6 keys) ──
  'notif_strat_health_critical_title': 'Strategy Health Low: {strategy}',
  'notif_strat_health_critical_body': 'Score dropped to {score}/100. Review parameters.',
  'notif_strat_health_improved_title': 'Strategy Health Improved: {strategy}',
  'notif_strat_health_improved_body': 'Score recovered to {score}/100. Nice!',
  'notif_backtest_done_title': 'Backtest Complete: {strategy}',
  'notif_backtest_done_body': 'Sharpe: {sharpe}, Return: {totalReturn}. View results.',

  // ── Social (6 keys) ──
  'notif_copytrade_executed_title': 'Copy Trade: {creator}',
  'notif_copytrade_executed_body': 'Auto-copied {symbol} trade from {strategy} by {creator}.',
  'notif_creator_new_strat_title': 'New Strategy: {creator}',
  'notif_creator_new_strat_body': '{strategy} — a new strategy from {creator} just dropped.',
  'notif_follower_milestone_title': '🎉 {count} Followers!',
  'notif_follower_milestone_body': 'Your strategy has reached {count} followers. Keep it up!',
  'notif_leaderboard_title': '🏆 Rank #{rank}: {strategy}',
  'notif_leaderboard_body': 'Your strategy climbed to #{rank} on the leaderboard.',

  // ── Onboarding (5 keys) ──
  'notif_onboard_step_title': 'Step {step} Complete',
  'notif_onboard_step_body': 'You\'ve finished {stepName}. Keep going!',
  'notif_onboard_done_title': '🎉 Onboarding Complete!',
  'notif_onboard_done_body': 'All 5 steps done. Your trading journey starts now.',
  'notif_onboard_reminder_title': 'Continue Your Setup',
  'notif_onboard_reminder_body': 'You\'re almost there. Finish setup in 5 minutes.',

  // ── Notification UI (10 keys) ──
  'notif_center_title': 'Notifications',
  'notif_center_empty': 'No notifications yet. You\'re all caught up! ✨',
  'notif_center_mark_all': 'Mark all read',
  'notif_center_settings': 'Notification Settings',
  'notif_center_tab_all': 'All',
  'notif_center_tab_trading': 'Trading',
  'notif_center_tab_system': 'System',
  'notif_center_tab_social': 'Social',
  'notif_center_clear': 'Clear All',
  'notif_center_clear_confirm': 'Delete all notifications? This cannot be undone.',

  // ── Notification Action Buttons (3 keys) ──
  'notif_action_view': 'View',
  'notif_action_dismiss': 'Dismiss',
  'notif_action_acknowledge': 'Got it',

  // ── DnD Related (5 keys) ──
  'notif_dnd_active': '🔕 Do Not Disturb is on',
  'notif_dnd_summary': 'You missed {count} notifications during quiet hours.',
  'notif_dnd_toggle': 'Turn off DnD',
  'notif_dnd_schedule': 'Scheduled {start}–{end}',
  'notif_tray_dnd': 'DnD Active',

  // ── Preferences (12 keys) ──
  'notif_pref_title': 'Notification Preferences',
  'notif_pref_general': 'General',
  'notif_pref_enable_all': 'Enable Notifications',
  'notif_pref_sound': 'Sound',
  'notif_pref_desktop': 'Desktop Notifications',
  'notif_pref_dnd': 'Do Not Disturb',
  'notif_dnd_scheduled': 'Scheduled Quiet Hours',
  'notif_dnd_start': 'Start',
  'notif_dnd_end': 'End',
  'notif_dnd_trading_focus': 'Trading Focus Mode',
  'notif_pref_categories': 'Per-Category Settings',
  'notif_cat_trading': 'Trading Signals',
  'notif_cat_alert': 'Price Alerts',
  'notif_cat_system': 'System',
  'notif_cat_strategy': 'Strategy Health',
  'notif_cat_social': 'Social',
  'notif_cat_onboarding': 'Onboarding',
  'notif_pref_email': 'Email Digest',
  'notif_email_daily': 'Daily Performance Summary',
  'notif_email_weekly': 'Weekly Strategy Report',
  'notif_email_marketing': 'Product Updates & Tips',
  'notif_pref_reset': 'Reset to Defaults',

  // ── Permission (2 keys) ──
  'notif_permission_title': 'Enable Notifications',
  'notif_permission_body': 'Get real-time trading alerts, price notifications, and system updates. You can change this anytime in Settings.',
};

// Total: 66 i18n keys × 9 languages = 594 entries
