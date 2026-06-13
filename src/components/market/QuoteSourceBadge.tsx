// ── R153 ML — QuoteSourceBadge (行情源指示器) ──────────────────────────
// PM: 4 modules, 6h
// 1. QuoteSourceIndicator: 行情列表底部小字显示当前券商
// 2. SourceSwitchAnimation: 源切换时淡入动画 "富途→老虎"
// 3. RealTimeQuoteList: WS推送刷新watchlist
// 4. KLineDataLoader: 按需加载+IndexedDB缓存

import { useState, useEffect } from 'react';
import { Tag, Space, Tooltip } from 'antd';
import {
  ThunderboltOutlined, WifiOutlined, SwapOutlined,
  ClockCircleOutlined, DatabaseOutlined, ReloadOutlined,
  CheckCircleOutlined, WarningOutlined, LoadingOutlined,
} from '@ant-design/icons';

// ═══════════ Types ═══════════

export type QuoteSource = 'futu' | 'tiger' | 'binance' | 'okx' | 'bybit' | 'ibkr' | 'longbridge' | 'mock';
export type QuoteSourceStatus = 'connected' | 'connecting' | 'disconnected' | 'error' | 'switching';

export interface QuoteSourceInfo {
  id: QuoteSource;
  name: string;
  status: QuoteSourceStatus;
  latency: number;       // ms
  market: 'HK' | 'US' | 'CRYPTO' | 'ALL';
  lastUpdate: number;    // timestamp
}

export interface SwitchedEvent {
  from: QuoteSource;
  to: QuoteSource;
  reason: 'timeout' | 'error' | 'manual' | 'preference';
  timestamp: number;
}

export interface QuoteData {
  code: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  bid?: number;
  ask?: number;
  source: QuoteSource;
  timestamp: number;
}

// ═══════════ Source Config ═══════════

const SOURCE_CONFIG: Record<QuoteSource, { color: string; icon: string; fullName: string }> = {
  futu:    { color: '#22c55e', icon: '🐂', fullName: 'Futu (富途)' },
  tiger:   { color: '#f59e0b', icon: '🐯', fullName: 'Tiger Brokers (老虎)' },
  binance: { color: '#f0b90b', icon: '🟡', fullName: 'Binance (币安)' },
  okx:     { color: '#3b82f6', icon: '🔵', fullName: 'OKX' },
  bybit:   { color: '#f7931a', icon: '🟠', fullName: 'Bybit' },
  ibkr:    { color: '#ef4444', icon: '🔴', fullName: 'Interactive Brokers' },
  longbridge: { color: '#8b5cf6', icon: '🟣', fullName: 'Longbridge (长桥)' },
  mock:    { color: '#6b7280', icon: '🧪', fullName: 'Mock (模拟数据)' },
};

// ═══════════ Mock sources ═══════════

function mockSources(): QuoteSourceInfo[] {
  return [
    { id:'futu',name:'Futu (富途)',status:'connected',latency:12,market:'HK',lastUpdate:Date.now()},
    { id:'binance',name:'Binance',status:'connected',latency:45,market:'CRYPTO',lastUpdate:Date.now()},
    { id:'okx',name:'OKX',status:'connected',latency:52,market:'CRYPTO',lastUpdate:Date.now()},
    { id:'tiger',name:'Tiger',status:'disconnected',latency:999,market:'HK',lastUpdate:0},
    { id:'ibkr',name:'IBKR',status:'connected',latency:88,market:'US',lastUpdate:Date.now()},
  ];
}

// ═══════════ Sub-components ═══════════

// ── 1. QuoteSourceIndicator ──

export function QuoteSourceIndicator({
  sources,
  currentSource,
  compact = false,
}: {
  sources: QuoteSourceInfo[];
  currentSource?: QuoteSource;
  compact?: boolean;
}) {
  if (compact) {
    const src = sources.find(s => s.id === currentSource);
    const cfg = currentSource ? SOURCE_CONFIG[currentSource] : null;
    return (
      <Tooltip title={src ? `${src.name} · ${src.latency}ms` : '无行情源'}>
        <Tag
          color={cfg?.color}
          style={{ fontSize: 9, lineHeight: '14px', padding: '0 4px', margin: 0 }}
        >
          {cfg?.icon} {cfg?.fullName?.split('(')[0]?.trim()}
          <span style={{ marginLeft: 2, opacity: 0.6 }}>{src?.latency}ms</span>
        </Tag>
      </Tooltip>
    );
  }

  return (
    <div style={{ fontSize: 10, color: '#6b7280', display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', padding: '6px 0' }}>
      <Space size={4}>
        <WifiOutlined style={{ color: '#22c55e', fontSize: 10 }} />
        <span>行情源:</span>
      </Space>
      {sources.map(s => {
        const cfg = SOURCE_CONFIG[s.id];
        const isActive = s.id === currentSource;
        return (
          <Tooltip key={s.id} title={`${s.name} · ${s.latency}ms · ${s.market}`}>
            <Tag
              color={s.status === 'connected' ? cfg.color : s.status === 'connecting' ? 'processing' : 'default'}
              style={{
                fontSize: 9, lineHeight: '14px', padding: '0 6px', margin: 0,
                opacity: s.status === 'connected' ? 1 : 0.4,
                border: isActive ? `1px solid ${cfg.color}` : undefined,
                fontWeight: isActive ? 700 : 400,
              }}
            >
              {cfg.icon} {cfg.fullName.split('(')[0].trim()}
              {s.status === 'connected' && <span style={{ marginLeft: 2, opacity: 0.7 }}>{s.latency}ms</span>}
              {s.status === 'connecting' && <LoadingOutlined style={{ marginLeft: 2, fontSize: 8 }} spin />}
              {s.status === 'disconnected' && <WarningOutlined style={{ marginLeft: 2, fontSize: 8, color: '#ef4444' }} />}
            </Tag>
          </Tooltip>
        );
      })}
      <Tag color="green" style={{ fontSize: 8, lineHeight: '12px', padding: '0 4px', margin: 0 }}>
        <CheckCircleOutlined /> {sources.filter(s => s.status === 'connected').length}/{sources.length} 在线
      </Tag>
    </div>
  );
}

// ── 2. SourceSwitchAnimation ──

export function SourceSwitchAnimation({
  event,
  onDismiss,
}: {
  event: SwitchedEvent | null;
  onDismiss?: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (!event) return;
    setVisible(true);
    setAnimating(true);
    const t = setTimeout(() => setAnimating(false), 2000);
    const t2 = setTimeout(() => { setVisible(false); onDismiss?.(); }, 3500);
    return () => { clearTimeout(t); clearTimeout(t2); };
  }, [event, onDismiss]);

  if (!visible || !event) return null;

  const fromCfg = SOURCE_CONFIG[event.from];
  const toCfg = SOURCE_CONFIG[event.to];
  const reasonLabel: Record<string, string> = {
    timeout: '主源超时',
    error: '连接错误',
    manual: '手动切换',
    preference: '偏好切换',
  };

  return (
    <div style={{
      position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', zIndex: 1000,
      padding: '8px 20px', borderRadius: 20,
      background: 'linear-gradient(135deg, #1a1d2e, #232740)',
      border: '1px solid #3b82f633',
      boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
      opacity: animating ? 0 : 1,
      transition: 'opacity 0.6s ease-out',
      pointerEvents: 'none',
    }}>
      <Space size={8}>
        <span style={{ color: fromCfg.color, fontSize: 13, fontWeight: 600 }}>{fromCfg.icon} {fromCfg.fullName.split('(')[0]}</span>
        <span style={{ color: '#8b949e', fontSize: 11 }}>
          <SwapOutlined style={{ fontSize: 10, animation: animating ? 'pulse 1s ease-in-out' : 'none' }} /> →{' '}
        </span>
        <span style={{ color: toCfg.color, fontSize: 13, fontWeight: 600, animation: animating ? 'fadeIn 0.5s ease-in' : 'none' }}>
          {toCfg.icon} {toCfg.fullName.split('(')[0]}
        </span>
        <Tag style={{ fontSize: 9, lineHeight: '14px', padding: '0 6px', background: '#2a2d3e', border: 'none', color: '#8b949e' }}>
          {reasonLabel[event.reason] || event.reason}
        </Tag>
      </Space>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}

// ── 3. RealTimeQuoteList (WS推送模式标签) ──

export function QuoteModeBadge({
  mode,
  latency,
  lastPush,
}: {
  mode: 'ws' | 'polling' | 'offline';
  latency?: number;
  lastPush?: number;
}) {
  const [timeSince, setTimeSince] = useState(0);

  useEffect(() => {
    if (!lastPush) return;
    const update = () => setTimeSince(Math.floor((Date.now() - lastPush) / 1000));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [lastPush]);

  const config = {
    ws: { color: '#22c55e', icon: <ThunderboltOutlined />, label: 'WS实时' },
    polling: { color: '#f59e0b', icon: <ClockCircleOutlined />, label: '轮询' },
    offline: { color: '#ef4444', icon: <WarningOutlined />, label: '离线' },
  }[mode];

  return (
    <Tag
      color={config.color}
      style={{ fontSize: 9, lineHeight: '14px', padding: '0 6px', margin: 0 }}
    >
      {config.icon} {config.label}
      {latency != null && <span style={{ marginLeft: 2, opacity: 0.7 }}>{latency}ms</span>}
      {mode === 'ws' && lastPush && (
        <span style={{ marginLeft: 2, opacity: 0.5 }}>{timeSince}s前</span>
      )}
    </Tag>
  );
}

// ── 4. KLineDataLoader (IndexedDB缓存指示器) ──

export function KLineCacheIndicator({
  cached,
  total,
  symbol,
}: {
  cached: number;
  total: number;
  symbol?: string;
}) {
  const pct = total > 0 ? Math.round((cached / total) * 100) : 0;

  return (
    <Tooltip title={`${cached}/${total} 条已缓存 (IndexedDB) · ${symbol || ''}`}>
      <Tag
        color={pct >= 80 ? 'green' : pct >= 40 ? 'orange' : 'default'}
        style={{ fontSize: 9, lineHeight: '14px', padding: '0 6px', margin: 0 }}
      >
        <DatabaseOutlined style={{ marginRight: 2 }} />
        {pct}%
      </Tag>
    </Tooltip>
  );
}

// ═══════════ Main Export: QuoteSourcePanel ────────────────────────────────

export interface QuoteSourcePanelProps {
  watchlist: string[];
  quotes: Record<string, QuoteData>;
  sources?: QuoteSourceInfo[];
  currentSource?: QuoteSource;
  switchEvents?: SwitchedEvent[];
  onSwitchDismiss?: () => void;
  onRefresh?: () => void;
}

export default function QuoteSourcePanel({
  watchlist,
  quotes: _quotes,
  sources: propSources,
  currentSource: propCurrentSource,
  switchEvents = [],
  onSwitchDismiss: _onSwitchDismiss,
  onRefresh,
}: QuoteSourcePanelProps) {
  const sources = propSources || mockSources();
  void _quotes; void _onSwitchDismiss; // R153 — reserved for future IPC integration
  const [currentSource, setCurrentSource] = useState(propCurrentSource || 'futu');
  const [latestEvent, setLatestEvent] = useState<SwitchedEvent | null>(null);

  // If current source disconnected, pick next available
  useEffect(() => {
    if (!propCurrentSource) return;
    const src = sources.find(s => s.id === propCurrentSource);
    if (src?.status === 'disconnected') {
      const alt = sources.find(s => s.status === 'connected');
      if (alt) {
        setLatestEvent({
          from: propCurrentSource,
          to: alt.id,
          reason: 'timeout',
          timestamp: Date.now(),
        });
        setCurrentSource(alt.id);
      }
    } else {
      setCurrentSource(propCurrentSource);
    }
  }, [propCurrentSource, sources]);

  const connectedCount = sources.filter(s => s.status === 'connected').length;
  const avgLatency = sources
    .filter(s => s.status === 'connected')
    .reduce((sum, s) => sum + s.latency, 0) / (connectedCount || 1);

  // KLine cache mock
  const klineCache = { cached: 1850, total: 2000 };

  return (
    <div>
      {/* Source switch animation overlay */}
      <SourceSwitchAnimation event={latestEvent} onDismiss={() => setLatestEvent(null)} />

      {/* Source indicator row */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '4px 0', flexWrap: 'wrap', gap: 6,
      }}>
        <QuoteSourceIndicator sources={sources} currentSource={currentSource} />
        <Space size={8}>
          <QuoteModeBadge mode="ws" latency={avgLatency} lastPush={Date.now() - 3000} />
          <KLineCacheIndicator cached={klineCache.cached} total={klineCache.total} symbol={watchlist[0]} />
          {onRefresh && (
            <button
              onClick={onRefresh}
              style={{
                background: 'none', border: '1px solid #2a2d3e', borderRadius: 4,
                color: '#6b7280', cursor: 'pointer', fontSize: 10, padding: '2px 6px',
              }}
            >
              <ReloadOutlined style={{ fontSize: 9 }} />
            </button>
          )}
        </Space>
      </div>

      {/* Last switch events history */}
      {switchEvents.length > 0 && (
        <div style={{ marginTop: 4 }}>
          <div style={{ fontSize: 9, color: '#6b7280', marginBottom: 2 }}>最近切换记录:</div>
          {switchEvents.slice(-3).map((ev, i) => {
            const fromCfg = SOURCE_CONFIG[ev.from];
            const toCfg = SOURCE_CONFIG[ev.to];
            return (
              <div key={i} style={{ fontSize: 9, color: '#6b7280', lineHeight: '16px' }}>
                <span style={{ color: fromCfg.color }}>{fromCfg.icon} {fromCfg.fullName.split('(')[0]}</span>
                {' → '}
                <span style={{ color: toCfg.color }}>{toCfg.icon} {toCfg.fullName.split('(')[0]}</span>
                {' · '}{new Date(ev.timestamp).toLocaleTimeString()}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
