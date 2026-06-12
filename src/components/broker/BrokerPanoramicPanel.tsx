// @ts-nocheck
// ── R134-M01 BrokerPanoramicPanel — 15家券商全景状态面板 ─────────────────
// PM: 所有15家券商一目了然的卡片阵列

import { useState, useMemo, useCallback } from 'react';
import {
  Card, Badge, Tag, Space, Tooltip, Input, Select, Statistic, Empty, Progress,
} from 'antd';
import {
  SearchOutlined, FilterOutlined, ApiOutlined, CloudOutlined,
  SafetyCertificateOutlined, ThunderboltOutlined, BankOutlined,
  CheckCircleOutlined, CloseCircleOutlined, SyncOutlined,
  WarningOutlined, ClockCircleOutlined, WifiOutlined, ReloadOutlined,
} from '@ant-design/icons';

// ═══════════ Types ═══════════

interface BrokerStatus {
  brokerId: string;
  brokerName: string;
  shortName: string;
  icon: string;
  market: string[];
  region: 'Crypto' | 'US' | 'HK' | 'Global' | 'CN';
  status: 'connected' | 'connecting' | 'stale' | 'disconnected' | 'error';
  protocol: 'REST' | 'WebSocket' | 'OpenD' | 'TWS' | 'TigerSDK' | 'OAuth2' | 'MetaApi';
  connectionType: 'cloud' | 'opend' | 'oauth2' | 'api';
  latency?: number;
  feeRate: string;
  configured: boolean;
  apiKeySet: boolean;
  wsStatus: 'active' | 'inactive';
  lastSeen?: number;
  uptime?: number;
  orderCount24h?: number;
  errorCount24h?: number;
  healthScore?: number;
}

// ═══════════ Mock data — 15 brokers ═══════════

const MOCK_ALL_15_BROKERS: BrokerStatus[] = [
  // ── Crypto ──
  { brokerId: 'binance', brokerName: 'Binance', shortName: 'BNB', icon: '🟡', market: ['Crypto'], region: 'Crypto', status: 'connected', protocol: 'REST', connectionType: 'cloud', latency: 12, feeRate: '0.10%', configured: true, apiKeySet: true, wsStatus: 'active', uptime: 99.98, orderCount24h: 1247, errorCount24h: 2, healthScore: 97 },
  { brokerId: 'okx', brokerName: 'OKX', shortName: 'OKX', icon: '⬜', market: ['Crypto'], region: 'Crypto', status: 'connected', protocol: 'REST', connectionType: 'cloud', latency: 45, feeRate: '0.08%', configured: true, apiKeySet: true, wsStatus: 'active', uptime: 99.95, orderCount24h: 832, errorCount24h: 5, healthScore: 94 },
  { brokerId: 'bybit', brokerName: 'Bybit', shortName: 'BYB', icon: '🟠', market: ['Crypto'], region: 'Crypto', status: 'stale', protocol: 'REST', connectionType: 'cloud', latency: 345, feeRate: '0.10%', configured: true, apiKeySet: true, wsStatus: 'active', uptime: 99.50, orderCount24h: 423, errorCount24h: 18, healthScore: 75 },
  { brokerId: 'bitget', brokerName: 'Bitget', shortName: 'BGT', icon: '🟣', market: ['Crypto'], region: 'Crypto', status: 'connected', protocol: 'REST', connectionType: 'cloud', latency: 23, feeRate: '0.10%', configured: true, apiKeySet: false, wsStatus: 'inactive', uptime: 99.90, orderCount24h: 0, healthScore: 68 },
  { brokerId: 'robinhood', brokerName: 'Robinhood Crypto', shortName: 'RH', icon: '🟢', market: ['Crypto'], region: 'Crypto', status: 'disconnected', protocol: 'REST', connectionType: 'api', latency: undefined, feeRate: '0.00%', configured: false, apiKeySet: false, wsStatus: 'inactive', healthScore: 0 },
  // ── US Stocks ──
  { brokerId: 'ib', brokerName: 'Interactive Brokers', shortName: 'IBKR', icon: '🏦', market: ['US', 'Global'], region: 'US', status: 'disconnected', protocol: 'TWS', connectionType: 'api', feeRate: '$0.005/sh', configured: true, apiKeySet: true, wsStatus: 'inactive', uptime: 99.99, orderCount24h: 0, healthScore: 45 },
  { brokerId: 'tiger', brokerName: 'Tiger Brokers', shortName: 'TIGR', icon: '🐯', market: ['US', 'HK'], region: 'HK', status: 'connecting', protocol: 'TigerSDK', connectionType: 'cloud', latency: 87, feeRate: '0.03%', configured: true, apiKeySet: true, wsStatus: 'active', uptime: 99.80, orderCount24h: 312, errorCount24h: 3, healthScore: 82 },
  { brokerId: 'schwab', brokerName: 'Charles Schwab', shortName: 'SCHW', icon: '🔵', market: ['US'], region: 'US', status: 'disconnected', protocol: 'OAuth2', connectionType: 'oauth2', feeRate: '$0.00', configured: false, apiKeySet: false, wsStatus: 'inactive', healthScore: 0 },
  // ── HK/US Hybrid ──
  { brokerId: 'futu', brokerName: 'Futu', shortName: 'FUTU', icon: '🐂', market: ['HK', 'US'], region: 'HK', status: 'connected', protocol: 'OpenD', connectionType: 'opend', latency: 8, feeRate: '0.03%', configured: true, apiKeySet: true, wsStatus: 'active', uptime: 99.99, orderCount24h: 2156, errorCount24h: 0, healthScore: 99 },
  { brokerId: 'moomoo', brokerName: 'Moomoo', shortName: 'MOO', icon: '🐮', market: ['HK', 'US'], region: 'HK', status: 'disconnected', protocol: 'OpenD', connectionType: 'opend', feeRate: '0.03%', configured: true, apiKeySet: true, wsStatus: 'inactive', healthScore: 40 },
  { brokerId: 'longbridge', brokerName: 'Longbridge', shortName: 'LB', icon: '🌉', market: ['HK', 'US'], region: 'HK', status: 'disconnected', protocol: 'REST', connectionType: 'cloud', feeRate: '0.02%', configured: false, apiKeySet: false, wsStatus: 'inactive', healthScore: 0 },
  // ── Batch2 NEW ──
  { brokerId: 'etrade', brokerName: 'E*TRADE', shortName: 'ETRD', icon: '💜', market: ['US'], region: 'US', status: 'disconnected', protocol: 'OAuth2', connectionType: 'oauth2', feeRate: '$0.00', configured: false, apiKeySet: false, wsStatus: 'inactive', healthScore: 0 },
  { brokerId: 'etoro', brokerName: 'eToro', shortName: 'eTR', icon: '🔷', market: ['US', 'Global'], region: 'US', status: 'disconnected', protocol: 'OAuth2', connectionType: 'oauth2', feeRate: '0.09%', configured: false, apiKeySet: false, wsStatus: 'inactive', healthScore: 0 },
  { brokerId: 'mt5', brokerName: 'MetaTrader 5', shortName: 'MT5', icon: '📊', market: ['Global', 'Forex'], region: 'Global', status: 'disconnected', protocol: 'MetaApi', connectionType: 'api', feeRate: 'Spread', configured: false, apiKeySet: false, wsStatus: 'inactive', healthScore: 0 },
  { brokerId: 'huasheng', brokerName: '华盛证券', shortName: 'VBKR', icon: '🏘️', market: ['HK', 'US'], region: 'HK', status: 'disconnected', protocol: 'REST', connectionType: 'cloud', feeRate: '0.03%', configured: false, apiKeySet: false, wsStatus: 'inactive', healthScore: 0 },
];

// ═══════════ Constants ═══════════

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: React.ReactNode }> = {
  connected: { color: '#22c55e', bg: '#22c55e15', icon: <CheckCircleOutlined /> },
  connecting: { color: '#f59e0b', bg: '#f59e0b15', icon: <SyncOutlined spin /> },
  stale: { color: '#f97316', bg: '#f9731615', icon: <WarningOutlined /> },
  disconnected: { color: '#8b949e', bg: '#8b949e15', icon: <CloseCircleOutlined /> },
  error: { color: '#ef4444', bg: '#ef444415', icon: <CloseCircleOutlined /> },
};

const PROTOCOL_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  REST: { label: 'REST', color: '#3b82f6', icon: <ApiOutlined /> },
  WebSocket: { label: 'WS', color: '#22c55e', icon: <WifiOutlined /> },
  OpenD: { label: 'OpenD', color: '#22c55e', icon: <ApiOutlined /> },
  TWS: { label: 'TWS', color: '#f59e0b', icon: <ThunderboltOutlined /> },
  TigerSDK: { label: 'SDK', color: '#f59e0b', icon: <CloudOutlined /> },
  OAuth2: { label: 'OAuth2', color: '#a78bfa', icon: <SafetyCertificateOutlined /> },
  MetaApi: { label: 'MetaApi', color: '#ec4899', icon: <CloudOutlined /> },
};

const REGION_ORDER: Record<string, number> = { Crypto: 0, US: 1, HK: 2, Global: 3, CN: 4 };
const REGION_LABELS: Record<string, string> = {
  Crypto: '🪙 加密货币',
  US: '🇺🇸 美股',
  HK: '🇭🇰 港股',
  Global: '🌍 全球',
  CN: '🇨🇳 A股',
};

// ── Health Score Badge ──

function HealthBadge({ score }: { score?: number }) {
  if (score === undefined || score === 0) {
    return <Tag color="default" style={{ fontSize: 10 }}>未连接</Tag>;
  }
  const color = score >= 90 ? '#22c55e' : score >= 70 ? '#f59e0b' : score >= 50 ? '#f97316' : '#ef4444';
  return (
    <Tooltip title={`健康度 ${score}/100`}>
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
        padding: '1px 6px',
        borderRadius: 10,
        background: `${color}20`,
        color,
        fontSize: 11,
        fontWeight: 600,
      }}>
        {score >= 90 ? '🟢' : score >= 70 ? '🟡' : score >= 50 ? '🟠' : '🔴'} {score}
      </span>
    </Tooltip>
  );
}

// ── Broker Status Card ──

function BrokerStatusCard({ broker }: { broker: BrokerStatus }) {
  const s = STATUS_CONFIG[broker.status] || STATUS_CONFIG.disconnected;
  const p = PROTOCOL_CONFIG[broker.protocol] || PROTOCOL_CONFIG.REST;

  return (
    <Card
      size="small"
      style={{
        background: broker.status === 'connected' ? '#1a2e1a' : broker.status === 'connecting' ? '#2e2a1a' : '#1a1d2e',
        border: `1px solid ${s.color}22`,
        borderRadius: 10,
        height: '100%',
        transition: 'all 0.2s ease',
      }}
      styles={{ body: { padding: '12px' } }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Space size={4}>
          <span style={{ fontSize: 20 }}>{broker.icon}</span>
          <span style={{ color: '#e0e0e0', fontSize: 12, fontWeight: 600 }}>{broker.shortName}</span>
        </Space>
        <Badge color={s.color} text={undefined} />
      </div>

      <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 8 }}>{broker.brokerName}</div>

      {/* Tags row */}
      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 8 }}>
        {broker.market.map((m) => (
          <Tag key={m} color="cyan" style={{ fontSize: 9, lineHeight: '14px', margin: 0 }}>{m}</Tag>
        ))}
        <Tag color={p.color} icon={p.icon} style={{ fontSize: 9, lineHeight: '14px', margin: 0 }}>{p.label}</Tag>
      </div>

      {/* Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '4px 8px',
        fontSize: 10,
        color: '#8b949e',
      }}>
        <div>延迟 <span style={{ color: '#e0e0e0' }}>{broker.latency ? `${broker.latency}ms` : '—'}</span></div>
        <div>费率 <span style={{ color: '#e0e0e0' }}>{broker.feeRate}</span></div>
        <div>在线 <span style={{ color: '#e0e0e0' }}>{broker.uptime ? `${broker.uptime}%` : '—'}</span></div>
        <div>24h <span style={{ color: '#e0e0e0' }}>{broker.orderCount24h ?? '—'}</span></div>
      </div>

      {/* Health bar */}
      {broker.healthScore !== undefined && broker.healthScore > 0 && (
        <div style={{ marginTop: 8 }}>
          <HealthBadge score={broker.healthScore} />
        </div>
      )}

      {/* WS status dot */}
      <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: broker.wsStatus === 'active' ? '#22c55e' : '#ef4444',
        }} />
        <span style={{ fontSize: 9, color: '#6b7280' }}>
          WS {broker.wsStatus === 'active' ? 'active' : 'off'}
        </span>
        {broker.errorCount24h !== undefined && broker.errorCount24h > 0 && (
          <span style={{ fontSize: 9, color: '#ef4444', marginLeft: 'auto' }}>
            ⚠ {broker.errorCount24h} 错误
          </span>
        )}
      </div>
    </Card>
  );
}

// ── Main BrokerPanoramicPanel ──

export default function BrokerPanoramicPanel() {
  const [search, setSearch] = useState('');
  const [regionFilter, setRegionFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const filtered = useMemo(() => {
    return MOCK_ALL_15_BROKERS
      .filter((b) => {
        if (search) {
          const q = search.toLowerCase();
          if (!b.brokerName.toLowerCase().includes(q) && !b.brokerId.toLowerCase().includes(q) && !b.shortName.toLowerCase().includes(q)) {
            return false;
          }
        }
        if (regionFilter.length > 0 && !regionFilter.includes(b.region)) return false;
        if (statusFilter.length > 0 && !statusFilter.includes(b.status)) return false;
        return true;
      })
      .sort((a, b) => (REGION_ORDER[a.region] ?? 5) - (REGION_ORDER[b.region] ?? 5));
  }, [search, regionFilter, statusFilter]);

  // Aggregate stats
  const stats = useMemo(() => {
    return {
      total: MOCK_ALL_15_BROKERS.length,
      connected: MOCK_ALL_15_BROKERS.filter((b) => b.status === 'connected').length,
      configured: MOCK_ALL_15_BROKERS.filter((b) => b.configured).length,
      avgLatency: Math.round(
        MOCK_ALL_15_BROKERS
          .filter((b) => b.latency !== undefined)
          .reduce((s, b) => s + (b.latency || 0), 0) /
          MOCK_ALL_15_BROKERS.filter((b) => b.latency !== undefined).length
      ),
      totalOrders24h: MOCK_ALL_15_BROKERS.reduce((s, b) => s + (b.orderCount24h || 0), 0),
      errors24h: MOCK_ALL_15_BROKERS.reduce((s, b) => s + (b.errorCount24h || 0), 0),
      avgHealth: Math.round(
        MOCK_ALL_15_BROKERS.reduce((s, b) => s + (b.healthScore || 0), 0) / MOCK_ALL_15_BROKERS.length
      ),
    };
  }, []);

  // Group by region
  const grouped = useMemo(() => {
    const groups: Record<string, BrokerStatus[]> = {};
    for (const b of filtered) {
      const key = REGION_LABELS[b.region] || b.region;
      if (!groups[key]) groups[key] = [];
      groups[key].push(b);
    }
    return groups;
  }, [filtered]);

  return (
    <div style={{ padding: '0 4px' }}>
      {/* Summary bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(6, 1fr)',
        gap: 10,
        marginBottom: 14,
      }}>
        {[
          { label: '券商总数', value: stats.total, color: '#e0e0e0' },
          { label: '已连接', value: stats.connected, color: '#22c55e' },
          { label: '已配置', value: stats.configured, color: '#f59e0b' },
          { label: '24h订单', value: stats.totalOrders24h, color: '#3b82f6' },
          { label: '24h错误', value: stats.errors24h, color: stats.errors24h > 5 ? '#ef4444' : '#8b949e' },
          { label: '平均健康', value: stats.avgHealth, color: stats.avgHealth >= 70 ? '#22c55e' : '#f59e0b' },
        ].map((s) => (
          <div key={s.label} style={{
            padding: '10px',
            background: '#1a1d2e',
            borderRadius: 8,
            border: '1px solid #2a2d3e',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color, fontFamily: 'monospace' }}>
              {typeof s.value === 'number' && s.value >= 1000
                ? `${(s.value / 1000).toFixed(1)}K`
                : s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex',
        gap: 10,
        marginBottom: 14,
        flexWrap: 'wrap',
        alignItems: 'center',
      }}>
        <Input
          prefix={<SearchOutlined style={{ color: '#6b7280' }} />}
          placeholder="搜索券商..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 200, background: '#1a1d2e', border: '1px solid #2a2d3e' }}
          allowClear
        />
        <Select
          mode="multiple"
          placeholder="市场"
          value={regionFilter}
          onChange={setRegionFilter}
          style={{ minWidth: 140 }}
          options={[
            { label: '🪙 加密货币', value: 'Crypto' },
            { label: '🇺🇸 美股', value: 'US' },
            { label: '🇭🇰 港股', value: 'HK' },
            { label: '🌍 全球', value: 'Global' },
          ]}
          allowClear
        />
        <Select
          mode="multiple"
          placeholder="状态"
          value={statusFilter}
          onChange={setStatusFilter}
          style={{ minWidth: 140 }}
          options={[
            { label: '✅ 已连接', value: 'connected' },
            { label: '🔄 连接中', value: 'connecting' },
            { label: '⚠ 延迟', value: 'stale' },
            { label: '⛔ 断开', value: 'disconnected' },
          ]}
          allowClear
        />
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: '#8b949e' }}>
          显示 {filtered.length}/{stats.total}
        </span>
      </div>

      {/* Cards grid grouped by region */}
      {filtered.length === 0 ? (
        <Empty description="无匹配券商" />
      ) : (
        Object.entries(grouped).map(([region, brokers]) => (
          <div key={region} style={{ marginBottom: 20 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 10,
              padding: '0 4px',
            }}>
              <span style={{ color: '#e0e0e0', fontSize: 14, fontWeight: 600 }}>{region}</span>
              <Tag style={{ fontSize: 10 }}>{brokers.length} 家</Tag>
              <div style={{ flex: 1, height: 1, background: '#2a2d3e' }} />
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 10,
            }}>
              {brokers.map((b) => (
                <BrokerStatusCard key={b.brokerId} broker={b} />
              ))}
            </div>
          </div>
        ))
      )}

      {/* Legend */}
      <div style={{
        padding: '8px 12px',
        background: '#1a1d2e',
        borderRadius: 8,
        border: '1px solid #2a2d3e',
        fontSize: 11,
        color: '#6b7280',
        display: 'flex',
        gap: 16,
        flexWrap: 'wrap',
        marginTop: 8,
      }}>
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
          <Space key={key} size={4}>
            <span style={{ color: cfg.color }}>{cfg.icon}</span>
            <span>{key === 'connected' ? '已连接' : key === 'connecting' ? '连接中' : key === 'stale' ? '延迟' : key === 'error' ? '错误' : '断开'}</span>
          </Space>
        ))}
      </div>
    </div>
  );
}
