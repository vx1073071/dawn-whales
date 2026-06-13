// ── R154 ML — BrokerPriority (券商优先级设置页) ────────────────────────
// PM: 4h — 拖拽排序+开关+市场覆盖+市场状态指示+延迟可视化
//
// Modules:
//  1. BrokerPriorityPanel: drag-to-reorder broker priority per market
//  2. MarketStatusIndicator: "港股已收盘/美股交易中" inline badge
//  3. LatencyVisualizer: green<50ms/yellow<200ms/red>500ms per broker

import { useState, useCallback, useMemo } from 'react';
import { Card, Switch, Tag, Space, Tooltip, Empty, Alert } from 'antd';
import {
  DragOutlined, TrophyOutlined,
  WarningOutlined,
  CheckCircleOutlined, CloseCircleOutlined,
  SettingOutlined,
} from '@ant-design/icons';

// ═══════════ Types ═══════════

type Market = 'HK' | 'US' | 'CRYPTO';
type BrokerId = 'futu' | 'tiger' | 'ibkr' | 'longbridge' | 'binance' | 'okx' | 'bybit' | 'bitget' | 'schwab' | 'etrade' | 'webull';

interface BrokerPriority {
  id: BrokerId;
  name: string;
  enabled: boolean;
  priority: number;      // lower = higher priority
  market: Market;
  latency: number;        // ms, live
  status: 'online' | 'degraded' | 'offline';
  errorRate: number;      // 0-1
  lastSeen: number;       // timestamp
}

// TODO R155: PriorityOverride for per-market custom priority config

// ═══════════ Market Session Config ═══════════

interface MarketSession {
  market: Market;
  label: string;
  icon: string;
  status: 'open' | 'closed' | 'lunch' | 'pre_open' | 'after_hours';
  openTime: string;   // HH:MM
  closeTime: string;
  timezone: string;
}

function getMarketSessions(): MarketSession[] {
  const now = new Date();
  const hkOpen = { start: 9, end: 12, lunchEnd: 13, close: 16 }; // HKT
  const usOpen = { start: 9, end: 16 }; // EST, unused: reserved for future US session precision
  void usOpen;
  const hkHour = now.getUTCHours() + 8;

  // HK session
  let hkStatus: MarketSession['status'] = 'closed';
  if (hkHour >= hkOpen.start && hkHour < hkOpen.end) hkStatus = 'open';
  else if (hkHour >= hkOpen.lunchEnd && hkHour < hkOpen.close) hkStatus = 'open';
  else if (hkHour >= hkOpen.end && hkHour < hkOpen.lunchEnd) hkStatus = 'lunch';
  else if (hkHour >= hkOpen.close && hkHour < hkOpen.close + 1) hkStatus = 'after_hours';

  // US session (simplified: primary US hours)
  const estHour = (hkHour + 11) % 24; // rough EST from HKT
  let usStatus: MarketSession['status'] = 'closed';
  if (estHour >= 9 && estHour < 16) usStatus = 'open';
  else if (estHour >= 4 && estHour < 9) usStatus = 'pre_open';
  else if (estHour >= 16 && estHour < 20) usStatus = 'after_hours';

  return [
    { market:'HK',label:'港股',icon:'🇭🇰',status:hkStatus,openTime:'09:00',closeTime:'16:00',timezone:'HKT' },
    { market:'US',label:'美股',icon:'🇺🇸',status:usStatus,openTime:'09:30',closeTime:'16:00',timezone:'EST' },
    { market:'CRYPTO',label:'加密货币',icon:'🪙',status:'open',openTime:'24/7',closeTime:'24/7',timezone:'UTC' },
  ];
}

// ═══════════ Mock brokers ═══════════

function mockBrokers(): BrokerPriority[] {
  return [
    { id:'futu',name:'Futu (富途)',enabled:true,priority:1,market:'HK',latency:12,status:'online',errorRate:0.001,lastSeen:Date.now() },
    { id:'tiger',name:'Tiger Brokers',enabled:true,priority:2,market:'HK',latency:245,status:'degraded',errorRate:0.03,lastSeen:Date.now()-60000 },
    { id:'longbridge',name:'长桥',enabled:false,priority:3,market:'HK',latency:999,status:'offline',errorRate:1,lastSeen:0 },
    { id:'ibkr',name:'IBKR',enabled:true,priority:1,market:'US',latency:88,status:'online',errorRate:0.002,lastSeen:Date.now() },
    { id:'schwab',name:'Schwab',enabled:false,priority:2,market:'US',latency:999,status:'offline',errorRate:1,lastSeen:0 },
    { id:'etrade',name:'E*TRADE',enabled:false,priority:3,market:'US',latency:999,status:'offline',errorRate:1,lastSeen:0 },
    { id:'binance',name:'Binance',enabled:true,priority:1,market:'CRYPTO',latency:45,status:'online',errorRate:0.005,lastSeen:Date.now() },
    { id:'okx',name:'OKX',enabled:true,priority:2,market:'CRYPTO',latency:52,status:'online',errorRate:0.008,lastSeen:Date.now() },
    { id:'bybit',name:'Bybit',enabled:true,priority:3,market:'CRYPTO',latency:67,status:'online',errorRate:0.01,lastSeen:Date.now() },
    { id:'bitget',name:'Bitget',enabled:false,priority:4,market:'CRYPTO',latency:999,status:'offline',errorRate:1,lastSeen:0 },
  ];
}

// ═══════════ Sub-components ═══════════

// ── 2. MarketStatusIndicator ──

export function MarketStatusIndicator({ compact = false }: { compact?: boolean }) {
  const sessions = getMarketSessions();

  const statusConfig: Record<MarketSession['status'], { color: string; label: string; pulse?: boolean }> = {
    open: { color: '#22c55e', label: '交易中', pulse: true },
    closed: { color: '#ef4444', label: '已收盘', pulse: false },
    lunch: { color: '#f59e0b', label: '午休', pulse: false },
    pre_open: { color: '#3b82f6', label: '盘前', pulse: true },
    after_hours: { color: '#8b5cf6', label: '盘后', pulse: false },
  };

  if (compact) {
    return (
      <Space size={4}>
        {sessions.map(s => {
          const sc = statusConfig[s.status];
          return (
            <Tooltip key={s.market} title={`${s.label} ${sc.label} · ${s.openTime}-${s.closeTime} ${s.timezone}`}>
              <Tag
                color={sc.color}
                style={{ fontSize: 9, lineHeight: '14px', padding: '0 6px', margin: 0 }}
              >
                {s.icon}
                {sc.label}
                {sc.pulse && <span style={{ marginLeft: 3, display: 'inline-block', width: 4, height: 4, borderRadius: 2, background: sc.color, animation: 'pulse 1.5s ease-in-out infinite' }} />}
              </Tag>
            </Tooltip>
          );
        })}
      </Space>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      {sessions.map(s => {
        const sc = statusConfig[s.status];
        const isOpen = s.status === 'open';
        return (
          <div
            key={s.market}
            style={{
              padding: '8px 14px', borderRadius: 10,
              background: isOpen ? '#1a2e1a' : '#2e0a0a',
              border: `1px solid ${sc.color}33`,
              display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            <span style={{ fontSize: 18 }}>{s.icon}</span>
            <div>
              <div style={{ color: '#e0e0e0', fontSize: 13, fontWeight: 600 }}>{s.label}</div>
              <Space size={6}>
                <span style={{
                  width: 6, height: 6, borderRadius: 3, background: sc.color,
                  display: 'inline-block', animation: sc.pulse ? 'pulse 1.5s ease-in-out infinite' : 'none',
                }} />
                <span style={{ color: sc.color, fontSize: 11 }}>{sc.label}</span>
                <span style={{ color: '#6b7280', fontSize: 9 }}>{s.openTime}-{s.closeTime} {s.timezone}</span>
              </Space>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── 3. LatencyVisualizer ──

function LatencyBar({ ms, size = 'default' }: { ms: number; size?: 'small' | 'default' }) {
  const color = ms < 50 ? '#22c55e' : ms < 200 ? '#f59e0b' : ms > 500 ? '#ef4444' : '#f59e0b';
  const label = ms < 50 ? '优秀' : ms < 200 ? '一般' : ms > 500 ? '延迟高' : '离线';
  const pct = Math.min(Math.max((ms / 500) * 100, 2), 100);

  if (size === 'small') {
    return (
      <Tooltip title={`${ms}ms · ${label}`}>
        <div style={{ width: 50, height: 4, borderRadius: 2, background: '#2a2d3e', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', borderRadius: 2, background: color, transition: 'width 0.5s ease' }} />
        </div>
        <span style={{ fontSize: 9, color, marginLeft: 4 }}>{ms}ms</span>
      </Tooltip>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 120, height: 6, borderRadius: 3, background: '#2a2d3e', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: `linear-gradient(90deg, ${color}, ${color}88)`, transition: 'width 0.5s ease' }} />
      </div>
      <span style={{ fontSize: 12, fontFamily: 'monospace', color, fontWeight: 600, minWidth: 45 }}>
        {ms > 900 ? '离线' : `${ms}ms`}
      </span>
      <Tag color={color} style={{ fontSize: 9, lineHeight: '14px', padding: '0 4px' }}>{label}</Tag>
    </div>
  );
}

// ── 1. BrokerPriorityPanel ──

export default function BrokerPriorityPanel() {
  const [brokers, setBrokers] = useState<BrokerPriority[]>(mockBrokers());
  const [selectedMarket, setSelectedMarket] = useState<Market>('HK');
  const [dragOver, setDragOver] = useState<string | null>(null);

  const marketBrokers = useMemo(
    () => brokers.filter(b => b.market === selectedMarket).sort((a, b) => a.priority - b.priority),
    [brokers, selectedMarket],
  );

  const toggleBroker = useCallback((id: BrokerId) => {
    setBrokers(prev => prev.map(b => b.id === id ? { ...b, enabled: !b.enabled } : b));
  }, []);

  const moveUp = useCallback((id: BrokerId) => {
    setBrokers(prev => {
      const idx = prev.findIndex(b => b.id === id && b.market === selectedMarket);
      if (idx <= 0) return prev;
      const list = [...prev].filter(b => b.market === selectedMarket).sort((a, b) => a.priority - b.priority);
      const globalList = prev.filter(b => b.market !== selectedMarket);
      const i = list.findIndex(b => b.id === id);
      if (i <= 0) return prev;
      [list[i], list[i - 1]] = [list[i - 1], list[i]];
      return [...globalList, ...list.map((b, idx) => ({ ...b, priority: idx + 1 }))];
    });
  }, [brokers, selectedMarket]);

  const moveDown = useCallback((id: BrokerId) => {
    setBrokers(prev => {
      const list = [...prev].filter(b => b.market === selectedMarket).sort((a, b) => a.priority - b.priority);
      const globalList = prev.filter(b => b.market !== selectedMarket);
      const i = list.findIndex(b => b.id === id);
      if (i < 0 || i >= list.length - 1) return prev;
      [list[i], list[i + 1]] = [list[i + 1], list[i]];
      return [...globalList, ...list.map((b, idx) => ({ ...b, priority: idx + 1 }))];
    });
  }, [brokers, selectedMarket]);

  const sessions = getMarketSessions();
  const currentSession = sessions.find(s => s.market === selectedMarket);

  return (
    <div style={{ padding: '0 4px' }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 16px', marginBottom: 12,
        background: 'linear-gradient(135deg, #1a1d2e 0%, #232740 100%)',
        borderRadius: 10, border: '1px solid #2a2d3e',
      }}>
        <Space>
          <SettingOutlined style={{ fontSize: 18, color: '#3b82f6' }} />
          <div>
            <div style={{ color: '#e0e0e0', fontWeight: 600, fontSize: 15 }}>券商优先级</div>
            <div style={{ color: '#6b7280', fontSize: 11 }}>拖拽排序 · 按市场配置 · 开关启用</div>
          </div>
        </Space>
        <MarketStatusIndicator compact />
      </div>

      {/* Market status banner */}
      <div style={{ marginBottom: 12 }}>
        <MarketStatusIndicator />
      </div>

      {/* Market tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {(['HK', 'US', 'CRYPTO'] as Market[]).map(m => {
          const s = sessions.find(x => x.market === m);
          const sc = s?.status === 'open' ? '#22c55e' : s?.status === 'lunch' ? '#f59e0b' : '#6b7280';
          return (
            <button
              key={m}
              onClick={() => setSelectedMarket(m)}
              style={{
                padding: '8px 16px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
                background: selectedMarket === m ? '#3b82f620' : '#1a1d2e',
                border: `1px solid ${selectedMarket === m ? '#3b82f633' : '#2a2d3e'}`,
                color: selectedMarket === m ? '#e0e0e0' : '#6b7280',
                fontWeight: selectedMarket === m ? 600 : 400,
              }}
            >
              {s?.icon} {s?.label}
              <span style={{ marginLeft: 6, fontSize: 9, color: sc }}>
                {s?.status === 'open' ? '●交易中' : s?.status === 'lunch' ? '◉午休' : '○收盘'}
              </span>
            </button>
          );
        })}
      </div>

      {/* Priority list */}
      <Card
        size="small"
        style={{ background: '#1a1d2e', border: '1px solid #2a2d3e', borderRadius: 10 }}
        styles={{ body: { padding: '12px' } }}
        title={
          <Space>
            <DragOutlined style={{ color: '#f59e0b' }} />
            <span style={{ color: '#e0e0e0', fontSize: 13 }}>
              {currentSession?.icon} {currentSession?.label} 行情源优先级
            </span>
            <Tag color="blue" style={{ fontSize: 9 }}>越高越优先</Tag>
          </Space>
        }
      >
        <Alert
          message="行情路由按优先级选择: 优先取第1个在线的券商行情。拖拽调整顺序，关闭的券商不会获取行情。"
          type="info" showIcon={false}
          style={{ background: '#1a2e2a', border: '1px solid #3b82f633', borderRadius: 8, marginBottom: 12, fontSize: 11 }}
        />

        {marketBrokers.length === 0 ? (
          <Empty description={`暂无${currentSession?.label}券商`} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {marketBrokers.map((b, idx) => {
              const isFirst = idx === 0 && b.enabled;
              return (
                <div
                  key={b.id}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px', borderRadius: 8,
                    background: dragOver === b.id ? '#3b82f610' : '#0d0f1a',
                    border: `1px solid ${isFirst ? '#22c55e33' : dragOver === b.id ? '#3b82f633' : '#2a2d3e'}`,
                    opacity: b.enabled ? 1 : 0.4,
                    transition: 'all 0.2s',
                  }}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(b.id); }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={() => setDragOver(null)}
                >
                  {/* Left: Rank + Name */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: 6,
                      background: isFirst ? '#22c55e20' : '#2a2d3e',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700,
                      color: isFirst ? '#22c55e' : '#6b7280',
                    }}>
                      {idx + 1}
                    </div>
                    {isFirst && <TrophyOutlined style={{ color: '#f59e0b', fontSize: 14 }} />}
                    <div>
                      <div style={{ color: '#e0e0e0', fontSize: 13, fontWeight: b.enabled ? 500 : 300 }}>
                        {b.name}
                        {b.status === 'online' && <CheckCircleOutlined style={{ color: '#22c55e', marginLeft: 6, fontSize: 10 }} />}
                        {b.status === 'degraded' && <WarningOutlined style={{ color: '#f59e0b', marginLeft: 6, fontSize: 10 }} />}
                        {b.status === 'offline' && <CloseCircleOutlined style={{ color: '#ef4444', marginLeft: 6, fontSize: 10 }} />}
                      </div>
                      <div style={{ marginTop: 2 }}>
                        <LatencyBar ms={b.latency} size="small" />
                      </div>
                    </div>
                  </div>

                  {/* Middle: Status tags */}
                  <Space size={4} style={{ marginRight: 10 }}>
                    <Tag color={b.errorRate < 0.01 ? 'green' : b.errorRate < 0.05 ? 'orange' : 'red'} style={{ fontSize: 9, lineHeight: '14px', padding: '0 4px' }}>
                      错误率 {(b.errorRate * 100).toFixed(1)}%
                    </Tag>
                    {b.lastSeen > 0 && (
                      <Tag style={{ fontSize: 9, lineHeight: '14px', padding: '0 4px', background: '#2a2d3e', border: 'none', color: '#8b949e' }}>
                        {Math.floor((Date.now() - b.lastSeen) / 1000)}s前
                      </Tag>
                    )}
                  </Space>

                  {/* Right: Controls */}
                  <Space size={4}>
                    <Tooltip title="上移优先级">
                      <button
                        onClick={() => moveUp(b.id)}
                        disabled={idx === 0}
                        style={{
                          width: 24, height: 24, borderRadius: 4,
                          background: idx === 0 ? '#1a1d2e' : '#2a2d3e',
                          border: '1px solid #3a3d4e', color: idx === 0 ? '#4a4d5e' : '#8b949e',
                          cursor: idx === 0 ? 'default' : 'pointer', fontSize: 11,
                        }}
                      >▲</button>
                    </Tooltip>
                    <Tooltip title="下移优先级">
                      <button
                        onClick={() => moveDown(b.id)}
                        disabled={idx === marketBrokers.length - 1}
                        style={{
                          width: 24, height: 24, borderRadius: 4,
                          background: idx === marketBrokers.length - 1 ? '#1a1d2e' : '#2a2d3e',
                          border: '1px solid #3a3d4e', color: idx === marketBrokers.length - 1 ? '#4a4d5e' : '#8b949e',
                          cursor: idx === marketBrokers.length - 1 ? 'default' : 'pointer', fontSize: 11,
                        }}
                      >▼</button>
                    </Tooltip>
                    <Tooltip title={b.enabled ? '禁用此券商' : '启用此券商'}>
                      <Switch
                        size="small"
                        checked={b.enabled}
                        onChange={() => toggleBroker(b.id)}
                      />
                    </Tooltip>
                  </Space>
                </div>
              );
            })}
          </div>
        )}

        {/* Latency legend */}
        <div style={{ marginTop: 12, padding: '8px 12px', background: '#0d0f1a', borderRadius: 6, display: 'flex', gap: 12, fontSize: 10, color: '#6b7280' }}>
          <span>延迟:</span>
          <span style={{ color: '#22c55e' }}>● &lt;50ms 优秀</span>
          <span style={{ color: '#f59e0b' }}>● 50-200ms 一般</span>
          <span style={{ color: '#ef4444' }}>● &gt;500ms 延迟高</span>
          <span style={{ color: '#6b7280' }}>● &gt;900ms 离线</span>
        </div>
      </Card>
    </div>
  );
}
