// @ts-nocheck
// ── R135-M03 CopyTradeStatusBar — 跟单状态总栏 (15家Cloud绿+2家OpenD黄) ──
// PM: 一眼看清所有券商跟单状态

import { useState, useMemo, useCallback } from 'react';
import {
  Card, Badge, Tag, Space, Tooltip, Progress, Switch, Empty,
} from 'antd';
import {
  CloudOutlined, DesktopOutlined, CheckCircleOutlined,
  SyncOutlined, CloseCircleOutlined, ThunderboltOutlined,
  ApiOutlined, SafetyCertificateOutlined, BankOutlined,
  WarningOutlined, ClockCircleOutlined, PauseCircleOutlined,
  ReloadOutlined, SettingOutlined,
} from '@ant-design/icons';

// ═══════════ Types ═══════════

interface BrokerCopyStatus {
  brokerId: string;
  brokerName: string;
  shortName: string;
  icon: string;
  type: 'cloud' | 'opend' | 'oauth2' | 'api';
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
  lastSignalAt?: number;
  latency?: number;
}

// ═══════════ Mock data — 17 brokers ═══════════

const MOCK_COPY_STATUS: BrokerCopyStatus[] = [
  // ── Cloud (green) — 15 ──
  { brokerId: 'binance', brokerName: 'Binance', shortName: 'BNB', icon: '🟡', type: 'cloud', typeLabel: 'Cloud REST', market: ['Crypto'], region: 'Crypto', connectionStatus: 'online', copyTradeActive: true, copyTradePaused: false, pendingSignals: 0, activeCopies: 5, todayCopies: 23, todayPnL: 1245, signalHitRate: 72, latency: 12 },
  { brokerId: 'okx', brokerName: 'OKX', shortName: 'OKX', icon: '⬜', type: 'cloud', typeLabel: 'Cloud REST', market: ['Crypto'], region: 'Crypto', connectionStatus: 'online', copyTradeActive: true, copyTradePaused: false, pendingSignals: 0, activeCopies: 3, todayCopies: 15, todayPnL: 890, signalHitRate: 65, latency: 45 },
  { brokerId: 'bybit', brokerName: 'Bybit', shortName: 'BYB', icon: '🟠', type: 'cloud', typeLabel: 'Cloud REST', market: ['Crypto'], region: 'Crypto', connectionStatus: 'degraded', copyTradeActive: true, copyTradePaused: true, pendingSignals: 2, activeCopies: 2, todayCopies: 8, todayPnL: -340, signalHitRate: 60, latency: 345 },
  { brokerId: 'bitget', brokerName: 'Bitget', shortName: 'BGT', icon: '🟣', type: 'cloud', typeLabel: 'Cloud REST', market: ['Crypto'], region: 'Crypto', connectionStatus: 'online', copyTradeActive: false, copyTradePaused: true, pendingSignals: 0, activeCopies: 0, todayCopies: 0, todayPnL: 0, signalHitRate: 0, latency: 23 },
  { brokerId: 'robinhood', brokerName: 'Robinhood', shortName: 'RH', icon: '🟢', type: 'api', typeLabel: 'ED25519', market: ['Crypto'], region: 'Crypto', connectionStatus: 'offline', copyTradeActive: false, copyTradePaused: false, pendingSignals: 0, activeCopies: 0, todayCopies: 0, todayPnL: 0, signalHitRate: 0 },
  { brokerId: 'ib', brokerName: 'IBKR', shortName: 'IBKR', icon: '🏦', type: 'api', typeLabel: 'TWS API', market: ['US', 'Global'], region: 'US', connectionStatus: 'offline', copyTradeActive: false, copyTradePaused: false, pendingSignals: 0, activeCopies: 0, todayCopies: 0, todayPnL: 0, signalHitRate: 0 },
  { brokerId: 'tiger', brokerName: 'Tiger', shortName: 'TIGR', icon: '🐯', type: 'cloud', typeLabel: 'TigerSDK', market: ['US', 'HK'], region: 'HK', connectionStatus: 'online', copyTradeActive: true, copyTradePaused: false, pendingSignals: 0, activeCopies: 2, todayCopies: 12, todayPnL: 560, signalHitRate: 55, latency: 87 },
  { brokerId: 'schwab', brokerName: 'Schwab', shortName: 'SCHW', icon: '🔵', type: 'oauth2', typeLabel: 'OAuth2', market: ['US'], region: 'US', connectionStatus: 'offline', copyTradeActive: false, copyTradePaused: false, pendingSignals: 0, activeCopies: 0, todayCopies: 0, todayPnL: 0, signalHitRate: 0 },
  { brokerId: 'etrade', brokerName: 'E*TRADE', shortName: 'ETRD', icon: '💜', type: 'oauth2', typeLabel: 'OAuth2', market: ['US'], region: 'US', connectionStatus: 'offline', copyTradeActive: false, copyTradePaused: false, pendingSignals: 0, activeCopies: 0, todayCopies: 0, todayPnL: 0, signalHitRate: 0 },
  { brokerId: 'etoro', brokerName: 'eToro', shortName: 'eTR', icon: '🔷', type: 'oauth2', typeLabel: 'OAuth2', market: ['US', 'Global'], region: 'US', connectionStatus: 'offline', copyTradeActive: false, copyTradePaused: false, pendingSignals: 0, activeCopies: 0, todayCopies: 0, todayPnL: 0, signalHitRate: 0 },
  { brokerId: 'mt5', brokerName: 'MT5', shortName: 'MT5', icon: '📊', type: 'api', typeLabel: 'MetaApi', market: ['Global', 'Forex'], region: 'Global', connectionStatus: 'offline', copyTradeActive: false, copyTradePaused: false, pendingSignals: 0, activeCopies: 0, todayCopies: 0, todayPnL: 0, signalHitRate: 0 },
  { brokerId: 'huasheng', brokerName: '华盛', shortName: 'VBKR', icon: '🏘️', type: 'cloud', typeLabel: 'VBKR', market: ['HK', 'US'], region: 'HK', connectionStatus: 'offline', copyTradeActive: false, copyTradePaused: false, pendingSignals: 0, activeCopies: 0, todayCopies: 0, todayPnL: 0, signalHitRate: 0 },
  { brokerId: 'longbridge', brokerName: 'Longbridge', shortName: 'LB', icon: '🌉', type: 'cloud', typeLabel: 'Cloud REST', market: ['HK', 'US'], region: 'HK', connectionStatus: 'offline', copyTradeActive: false, copyTradePaused: false, pendingSignals: 0, activeCopies: 0, todayCopies: 0, todayPnL: 0, signalHitRate: 0 },
  { brokerId: 'yingli', brokerName: '盈立', shortName: 'uSM', icon: '🔶', type: 'cloud', typeLabel: 'uSMART', market: ['HK', 'US'], region: 'HK', connectionStatus: 'offline', copyTradeActive: false, copyTradePaused: false, pendingSignals: 0, activeCopies: 0, todayCopies: 0, todayPnL: 0, signalHitRate: 0 },
  { brokerId: 'webull', brokerName: 'Webull', shortName: 'WB', icon: '⬛', type: 'oauth2', typeLabel: 'OAuth2', market: ['US'], region: 'US', connectionStatus: 'offline', copyTradeActive: false, copyTradePaused: false, pendingSignals: 0, activeCopies: 0, todayCopies: 0, todayPnL: 0, signalHitRate: 0 },
  // ── OpenD (yellow) — 2 ──
  { brokerId: 'futu', brokerName: 'Futu', shortName: 'FUTU', icon: '🐂', type: 'opend', typeLabel: 'OpenD', market: ['HK', 'US'], region: 'HK', connectionStatus: 'online', copyTradeActive: true, copyTradePaused: false, pendingSignals: 1, activeCopies: 8, todayCopies: 34, todayPnL: 3400, signalHitRate: 68, latency: 8, lastSignalAt: Date.now() - 30000 },
  { brokerId: 'moomoo', brokerName: 'Moomoo', shortName: 'MOO', icon: '🐮', type: 'opend', typeLabel: 'OpenD', market: ['HK', 'US'], region: 'HK', connectionStatus: 'offline', copyTradeActive: true, copyTradePaused: true, pendingSignals: 3, activeCopies: 4, todayCopies: 18, todayPnL: 1200, signalHitRate: 62, latency: undefined, lastSignalAt: Date.now() - 3600000 },
];

// ═══════════ Constants ═══════════

const TYPE_DOT: Record<string, { color: string; icon: React.ReactNode }> = {
  cloud: { color: '#22c55e', icon: <CloudOutlined /> },
  opend: { color: '#f59e0b', icon: <DesktopOutlined /> },
  oauth2: { color: '#a78bfa', icon: <SafetyCertificateOutlined /> },
  api: { color: '#3b82f6', icon: <ApiOutlined /> },
};

const REGION_LABELS: Record<string, string> = {
  Crypto: '🪙',
  US: '🇺🇸',
  HK: '🇭🇰',
  Global: '🌍',
};

// ── Status Dot ──

function BrokerStatusDot({
  broker,
  compact,
}: {
  broker: BrokerCopyStatus;
  compact?: boolean;
}) {
  const typeCfg = TYPE_DOT[broker.type] || TYPE_DOT.cloud;
  const isOnline = broker.connectionStatus === 'online';
  const isDegraded = broker.connectionStatus === 'degraded';
  const isOpend = broker.type === 'opend';
  const hasPending = broker.pendingSignals > 0;

  if (compact) {
    // Compact: single dot row
    return (
      <Tooltip
        title={
          <div>
            <div>{broker.brokerName} ({broker.typeLabel})</div>
            <div>{isOnline ? '在线' : isDegraded ? '降级' : '离线'}</div>
            {broker.copyTradeActive && <div>跟单活跃 · {broker.activeCopies} 个</div>}
            {hasPending && <div>⚠ {broker.pendingSignals} 待处理</div>}
          </div>
        }
      >
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 2,
          padding: '2px 6px',
          borderRadius: 4,
          background: isOnline ? (isOpend ? '#f59e0b15' : '#22c55e15') : isDegraded ? '#f9731615' : '#8b949e10',
          border: `1px solid ${isOnline ? (isOpend ? '#f59e0b44' : '#22c55e44') : isDegraded ? '#f9731644' : '#8b949e22'}`,
          fontSize: 10,
          cursor: 'pointer',
        }}>
          <span style={{ color: typeCfg.color }}>{typeCfg.icon}</span>
          <span style={{ color: '#e0e0e0' }}>{broker.shortName}</span>
          {hasPending && (
            <Badge count={broker.pendingSignals} size="small" style={{ fontSize: 9 }} />
          )}
        </span>
      </Tooltip>
    );
  }

  // Full card
  return (
    <div style={{
      padding: '8px 10px', borderLeft: broker.copyTradeActive ? '3px solid #d4a574' : '3px solid transparent',
      background: isOnline ? (isOpend ? '#2e2a1a' : '#1a2e1a') : isDegraded ? '#2e1a1a' : '#1a1d2e',
      border: `1px solid ${isOnline ? (isOpend ? '#f59e0b33' : '#22c55e33') : isDegraded ? '#f9731633' : '#2a2d3e'}`,
      borderRadius: 8,
      minWidth: 140,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <Space size={4}>
          <span>{broker.icon}</span>
          <span style={{ color: '#e0e0e0', fontSize: 11, fontWeight: 600 }}>{broker.shortName}</span>
        </Space>
        <Space size={2}>
          <Badge
            color={isOnline ? '#22c55e' : isDegraded ? '#f97316' : '#8b949e'}
            text={undefined}
          />
          {hasPending && (
            <Badge count={broker.pendingSignals} size="small" style={{ fontSize: 9 }} />
          )}
        </Space>
      </div>

      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', fontSize: 9 }}>
        <Tag color={typeCfg.color} style={{ fontSize: 9, lineHeight: '14px', margin: 0 }}>
          {typeCfg.icon} {broker.typeLabel}
        </Tag>
        <Tag color="cyan" style={{ fontSize: 9, lineHeight: '14px', margin: 0 }}>{REGION_LABELS[broker.region]}</Tag>
        {broker.copyTradeActive && (
          <Tag color="green" style={{ fontSize: 9, lineHeight: '14px', margin: 0 }}>
            {broker.activeCopies} 跟单
          </Tag>
        )}
        {broker.copyTradePaused && (
          <Tag color="gold" style={{ fontSize: 9, lineHeight: '14px', margin: 0 }}>暂停</Tag>
        )}
      </div>

      {/* Mini stats */}
      {isOnline && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 4,
          fontSize: 9,
          color: '#8b949e',
        }}>
          <span>今日 {broker.todayCopies}单</span>
          <span style={{ color: broker.todayPnL >= 0 ? '#22c55e' : '#ef4444' }}>
            {broker.todayPnL >= 0 ? '+' : ''}${broker.todayPnL}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Main CopyTradeStatusBar ──

export default function CopyTradeStatusBar() {
  const brokers = MOCK_COPY_STATUS;

  const stats = useMemo(() => {
    const cloud = brokers.filter((b) => b.type === 'cloud' || b.type === 'oauth2' || (b.type === 'api' && b.connectionStatus === 'online'));
    const opend = brokers.filter((b) => b.type === 'opend');
    const totalPending = brokers.reduce((s, b) => s + b.pendingSignals, 0);
    const totalActive = brokers.filter((b) => b.copyTradeActive).length;
    const totalTodayPnL = brokers.reduce((s, b) => s + b.todayPnL, 0);

    return {
      cloudOnline: cloud.filter((b) => b.connectionStatus === 'online').length,
      cloudTotal: cloud.length,
      opendOnline: opend.filter((b) => b.connectionStatus === 'online').length,
      opendTotal: opend.length,
      totalPending,
      totalActive,
      totalTodayPnL,
      totalTodayCopies: brokers.reduce((s, b) => s + b.todayCopies, 0),
    };
  }, [brokers]);

  return (
    <div style={{ padding: '0 4px' }}>
      {/* KPI Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(6, 1fr)',
        gap: 8,
        marginBottom: 12,
      }}>
        <div style={{ padding: '10px', background: '#1a2e1a', borderRadius: 8, border: '1px solid #22c55e33', textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: '#22c55e' }}><CloudOutlined /> Cloud 在线</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#22c55e', fontFamily: 'monospace' }}>
            {stats.cloudOnline}<span style={{ fontSize: 14, color: '#8b949e' }}>/{stats.cloudTotal}</span>
          </div>
        </div>
        <div style={{ padding: '10px', background: '#2e2a1a', borderRadius: 8, border: '1px solid #f59e0b33', textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: '#f59e0b' }}><DesktopOutlined /> OpenD 在线</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#f59e0b', fontFamily: 'monospace' }}>
            {stats.opendOnline}<span style={{ fontSize: 14, color: '#8b949e' }}>/{stats.opendTotal}</span>
          </div>
        </div>
        <div style={{ padding: '10px', background: '#1a1d2e', borderRadius: 8, border: '1px solid #2a2d3e', textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: '#6b7280' }}>活跃跟单</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#e0e0e0', fontFamily: 'monospace' }}>{stats.totalActive}</div>
        </div>
        <div style={{ padding: '10px', background: stats.totalPending > 0 ? '#2e0a0a' : '#1a1d2e', borderRadius: 8, border: `1px solid ${stats.totalPending > 0 ? '#ef444433' : '#2a2d3e'}`, textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: stats.totalPending > 0 ? '#ef4444' : '#6b7280' }}>待处理</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: stats.totalPending > 0 ? '#ef4444' : '#8b949e', fontFamily: 'monospace' }}>{stats.totalPending}</div>
        </div>
        <div style={{ padding: '10px', background: '#1a1d2e', borderRadius: 8, border: '1px solid #2a2d3e', textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: '#6b7280' }}>今日跟单</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#e0e0e0', fontFamily: 'monospace' }}>{stats.totalTodayCopies}</div>
        </div>
        <div style={{
          padding: '10px',
          background: stats.totalTodayPnL >= 0 ? '#1a2e1a' : '#2e1a1a',
          borderRadius: 8,
          border: `1px solid ${stats.totalTodayPnL >= 0 ? '#22c55e33' : '#ef444433'}`,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 10, color: '#6b7280' }}>今日盈亏</div>
          <div style={{
            fontSize: 24,
            fontWeight: 700,
            color: stats.totalTodayPnL >= 0 ? '#22c55e' : '#ef4444',
            fontFamily: 'monospace',
          }}>
            {stats.totalTodayPnL >= 0 ? '+' : ''}${(stats.totalTodayPnL / 1000).toFixed(1)}K
          </div>
        </div>
      </div>

      {/* Type Summary Legend */}
      <div style={{
        display: 'flex',
        gap: 12,
        marginBottom: 12,
        padding: '8px 12px',
        background: '#1a1d2e',
        borderRadius: 8,
        border: '1px solid #2a2d3e',
        fontSize: 11,
        flexWrap: 'wrap',
      }}>
        {Object.entries(TYPE_DOT).map(([key, cfg]) => {
          const count = brokers.filter((b) => b.type === key).length;
          const online = brokers.filter((b) => b.type === key && b.connectionStatus === 'online').length;
          return (
            <Space key={key} size={4}>
              <span style={{ color: cfg.color, fontSize: 14 }}>{cfg.icon}</span>
              <span style={{ color: '#e0e0e0' }}>{key.toUpperCase()}</span>
              <span style={{ color: online > 0 ? '#22c55e' : '#8b949e', fontWeight: 600 }}>
                {online}/{count}
              </span>
            </Space>
          );
        })}
      </div>

      {/* Broker Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))',
        gap: 8,
      }}>
        {brokers.map((b) => (
          <BrokerStatusDot key={b.brokerId} broker={b} />
        ))}
      </div>

      {/* Summary Footer */}
      <Card
        size="small"
        style={{
          background: '#1a1d2e',
          border: '1px solid #2a2d3e',
          borderRadius: 10,
          marginTop: 10,
        }}
        styles={{ body: { padding: '10px 14px' } }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: '#8b949e' }}>
          <Space size={16}>
            <Space size={4}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
              <span>Cloud 在线</span>
            </Space>
            <Space size={4}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
              <span>OpenD 在线</span>
            </Space>
            <Space size={4}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f97316', display: 'inline-block' }} />
              <span>降级</span>
            </Space>
            <Space size={4}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#8b949e', display: 'inline-block' }} />
              <span>离线</span>
            </Space>
          </Space>
          <span>
            总跟单券商: {brokers.filter((b) => b.copyTradeActive).length}/{brokers.length} |
            总在线: {brokers.filter((b) => b.connectionStatus === 'online').length}/{brokers.length}
          </span>
        </div>
      </Card>
    </div>
  );
}
