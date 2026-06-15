// ── R137-M02 CopyTradeStore (Zustand) — 跟单统一数据层 ──────────────────
// PM: 取代独立localStorage, 统一数据流
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ═══════════ Types ═══════════

export type TradeStatus = 'pending' | 'executing' | 'filled' | 'failed' | 'retrying' | 'skipped';
export type NotificationType = 'order_filled' | 'order_failed' | 'order_retrying' | 'signal_received' | 'stop_loss' | 'take_profit' | 'error';
export type CopyTradeMode = 'fixed' | 'ratio';
export type BrokerType = 'cloud' | 'opend' | 'oauth2' | 'api';
export type RiskLevel = 'low' | 'medium' | 'high';

export interface SignalProvider {
  id: string;
  name: string;
  icon: string;
  avatar: string;
  exchange: string;
  strategy: string;
  totalReturn: number;
  winRate: number;
  sharpeRatio: number;
  maxDrawdown: number;
  followers: number;
  fee: number;
  riskLevel: RiskLevel;
  verified: boolean;
  minAmount: number;
  description: string;
}

export interface CopyTradeConfig {
  providerId: string;
  brokerId: string;
  maxAmount: number;
  maxPositionSize: number;
  stopLossPct: number;
  takeProfitPct: number;
  maxSlippage: number;
  enabled: boolean;
  mode: CopyTradeMode;
  ratioPct?: number;
}

export interface CopyTradeRecord {
  id: string;
  signalId: string;
  providerId: string;
  providerName: string;
  symbol: string;
  side: 'buy' | 'sell';
  amount: number;
  price: number;
  brokerId: string;
  brokerName: string;
  status: TradeStatus;
  pnl?: number;
  pnlPct?: number;
  fee?: number;
  slippage?: number;
  retryCount: number;
  createdAt: number;
  updatedAt: number;
  error?: string;
}

export interface CopyTradeNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  data?: {
    symbol?: string;
    side?: string;
    amount?: number;
    price?: number;
    pnl?: number;
    providerName?: string;
    brokerName?: string;
    orderId?: string;
  };
}

export interface TradeRecord {
  id: string;
  signalId: string;
  providerName: string;
  symbol: string;
  side: 'buy' | 'sell';
  amount: number;
  price: number;
  total: number;
  brokerName: string;
  status: 'filled' | 'failed' | 'retrying';
  pnl?: number;
  pnlPct?: number;
  fee: number;
  feeCurrency: string;
  slippage?: number;
  error?: string;
  createdAt: number;
  filledAt?: number;
}

export interface CopyTradeBroker {
  brokerId: string;
  brokerName: string;
  icon: string;
  market: string[];
  type: BrokerType;
  typeLabel: string;
  status: 'connected' | 'disconnected' | 'connecting';
  latency?: number;
  feeRate: string;
  copyTradeSupported: boolean;
  signalMatching: 'exact' | 'fuzzy';
  minAmount: number;
  maxSlippage: number;
  supportedExchanges: string[];
  region: 'US' | 'HK' | 'CN' | 'Global' | 'Crypto';
  rank: number;
}

export interface BrokerCopyStatus {
  brokerId: string;
  brokerName: string;
  shortName: string;
  icon: string;
  type: BrokerType;
  typeLabel: string;
  market: string[];
  region: 'Crypto' | 'US' | 'HK' | 'Global';
  connectionStatus: 'online' | 'offline' | 'degraded';
  copyTradeActive: boolean;
  copyTradePaused: boolean;
  pendingSignals: number;
  activeCopies: number;
  todayCopies: number;
  todayPnL: number;
  signalHitRate: number;
  latency?: number;
}

export interface OpenDSignal {
  id: string;
  symbol: string;
  signal: 'BUY' | 'SELL';
  strategyName: string;
  price: number;
  quantity: number;
  confidence: number;
  reason: string;
  brokerId: string;
  brokerName: string;
  receivedAt: number;
  status: 'pending' | 'executing' | 'executed' | 'failed' | 'skipped';
  executionPrice?: number;
  errorMessage?: string;
  retryCount: number;
}

export interface OfflineConfig {
  showCloseWarning: boolean;
  trayBadge: boolean;
  offlineQueue: boolean;
  autoReconnect: boolean;
  notifyOnReconnect: boolean;
  minPendingThreshold: number;
}

export interface USBrokerConfig {
  brokerId: string;
  brokerName: string;
  icon: string;
  market: string[];
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  protocol: 'TWS' | 'TigerSDK' | 'OAuth2';
  authType: 'api_key' | 'username_password' | 'oauth2';
  features: string[];
  configured: boolean;
  tested: boolean;
  feeRate: string;
  marginAvailable: boolean;
  shortSelling: boolean;
  prePostMarket: boolean;
}

export interface PnLSummary {
  period: string;
  pnl: number;
  pnlPct: number;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  maxDrawdown: number;
  fees: number;
}

// ═══════════ Store ═══════════

interface CopyTradeStore {
  // Config
  config: CopyTradeConfig;
  setConfig: (cfg: Partial<CopyTradeConfig>) => void;
  enableCopyTrade: () => void;
  disableCopyTrade: () => void;

  // Signal Providers
  following: string[];
  toggleFollow: (providerId: string) => void;
  isFollowing: (providerId: string) => boolean;

  // Selected brokers for copy trade
  selectedBrokers: string[];
  toggleBroker: (brokerId: string) => void;

  // Trades
  tradeRecords: CopyTradeRecord[];
  addTradeRecord: (r: CopyTradeRecord) => void;
  updateTradeRecord: (id: string, updates: Partial<CopyTradeRecord>) => void;
  clearTradeRecords: () => void;

  // History
  tradeHistory: TradeRecord[];
  setTradeHistory: (records: TradeRecord[]) => void;

  // Notifications
  notifications: CopyTradeNotification[];
  addNotification: (n: CopyTradeNotification) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  clearNotifications: () => void;
  unreadCount: () => number;

  // Sound
  soundEnabled: boolean;
  setSoundEnabled: (v: boolean) => void;

  // Offline config
  offlineConfig: OfflineConfig;
  setOfflineConfig: (cfg: Partial<OfflineConfig>) => void;

  // US Brokers
  usBrokers: USBrokerConfig[];
  setUSBrokers: (brokers: USBrokerConfig[]) => void;

  // OpenD signals
  openDSignals: OpenDSignal[];
  setOpenDSignals: (signals: OpenDSignal[]) => void;

  // Signal Blacklist
  signalBlacklist: string[];
  addToBlacklist: (providerId: string) => void;
  removeFromBlacklist: (providerId: string) => void;
  isBlacklisted: (providerId: string) => boolean;

  // Kill Switch
  killSwitch: boolean;
  setKillSwitch: (v: boolean) => void;

  // version
  version: number;
}

export const useCopyTradeStore = create<CopyTradeStore>()(
  persist(
    (set, get) => ({
      // Config
      config: {
        providerId: '',
        brokerId: 'binance',
        maxAmount: 1000,
        maxPositionSize: 5000,
        stopLossPct: 5,
        takeProfitPct: 10,
        maxSlippage: 0.5,
        enabled: false,
        mode: 'fixed',
        ratioPct: 50,
      },
      setConfig: (cfg) => set((s) => ({ config: { ...s.config, ...cfg } })),
      enableCopyTrade: () => set((s) => ({ config: { ...s.config, enabled: true } })),
      disableCopyTrade: () => set((s) => ({ config: { ...s.config, enabled: false } })),

      // Following
      following: ['p1', 'p5'],
      toggleFollow: (id) =>
        set((s) => ({
          following: s.following.includes(id)
            ? s.following.filter((x) => x !== id)
            : [...s.following, id],
        })),
      isFollowing: (id) => get().following.includes(id),

      // Selected brokers
      selectedBrokers: ['futu', 'binance'],
      toggleBroker: (id) =>
        set((s) => ({
          selectedBrokers: s.selectedBrokers.includes(id)
            ? s.selectedBrokers.filter((x) => x !== id)
            : [...s.selectedBrokers, id],
        })),

      // Trade records
      tradeRecords: [],
      addTradeRecord: (r) =>
        set((s) => ({ tradeRecords: [r, ...s.tradeRecords].slice(0, 200) })),
      updateTradeRecord: (id, updates) =>
        set((s) => ({
          tradeRecords: s.tradeRecords.map((t) =>
            t.id === id ? { ...t, ...updates } : t
          ),
        })),
      clearTradeRecords: () => set({ tradeRecords: [] }),

      // Trade history
      tradeHistory: [],
      setTradeHistory: (records) => set({ tradeHistory: records }),

      // Notifications
      notifications: [],
      addNotification: (n) =>
        set((s) => ({ notifications: [n, ...s.notifications].slice(0, 100) })),
      markNotificationRead: (id) =>
        set((s) => ({
          notifications: s.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
        })),
      markAllNotificationsRead: () =>
        set((s) => ({
          notifications: s.notifications.map((n) => ({ ...n, read: true })),
        })),
      clearNotifications: () => set({ notifications: [] }),
      unreadCount: () => get().notifications.filter((n) => !n.read).length,

      // Sound
      soundEnabled: true,
      setSoundEnabled: (v) => set({ soundEnabled: v }),

      // Offline config
      offlineConfig: {
        showCloseWarning: true,
        trayBadge: true,
        offlineQueue: true,
        autoReconnect: true,
        notifyOnReconnect: true,
        minPendingThreshold: 3,
      },
      setOfflineConfig: (cfg) =>
        set((s) => ({ offlineConfig: { ...s.offlineConfig, ...cfg } })),

      // US Brokers
      usBrokers: [],
      setUSBrokers: (brokers) => set({ usBrokers: brokers }),

      // OpenD signals
      openDSignals: [],
      setOpenDSignals: (signals) => set({ openDSignals: signals }),

      // Signal Blacklist
      signalBlacklist: [],
      addToBlacklist: (id) =>
        set((s) => ({
          signalBlacklist: s.signalBlacklist.includes(id)
            ? s.signalBlacklist
            : [...s.signalBlacklist, id].slice(0, 50),
        })),
      removeFromBlacklist: (id) =>
        set((s) => ({
          signalBlacklist: s.signalBlacklist.filter((x) => x !== id),
        })),
      isBlacklisted: (id) => get().signalBlacklist.includes(id),

      // Kill switch
      killSwitch: false,
      setKillSwitch: (v) => set({ killSwitch: v }),

      // Version
      version: 1,
    }),
    {
      name: 'dw-ct-store',
      version: 1,
      partialize: (state) => ({
        config: state.config,
        following: state.following,
        signalBlacklist: state.signalBlacklist,
        selectedBrokers: state.selectedBrokers,
        soundEnabled: state.soundEnabled,
        offlineConfig: state.offlineConfig,
        version: state.version,
      }),
    }
  )
);
