// @ts-nocheck
// ── R133-M02 CopyTradeBrokerSelector — 跟单券商选择器改进 ────────────────
// PM: Cloud/OpenD 标签 + 过滤搜索 + 按市场/协议分组

import { useState, useMemo, useCallback } from 'react';
import {
  Card, Input, Select, Tag, Space, Badge, Tooltip, Switch, Empty,
} from 'antd';
import {
  SearchOutlined, CloudOutlined, ApiOutlined, FilterOutlined,
  CheckCircleOutlined, CloseCircleOutlined, ThunderboltOutlined,
  SafetyCertificateOutlined, BankOutlined,
} from '@ant-design/icons';

// ═══════════ Types ═══════════

interface CopyTradeBroker {
  brokerId: string;
  brokerName: string;
  icon: string;
  market: string[];
  type: 'cloud' | 'opend' | 'oauth2' | 'api';
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
  rank: number; // 1-5 recommended
}

// ═══════════ Mock data ═══════════

const MOCK_COPY_BROKERS: CopyTradeBroker[] = [
  {
    brokerId: 'futu',
    brokerName: 'Futu',
    icon: '🐂',
    market: ['HK', 'US'],
    type: 'opend',
    typeLabel: 'OpenD',
    status: 'connected',
    latency: 8,
    feeRate: '0.03%',
    copyTradeSupported: true,
    signalMatching: 'exact',
    minAmount: 100,
    maxSlippage: 0.5,
    supportedExchanges: ['HKEX', 'NASDAQ', 'NYSE'],
    region: 'HK',
    rank: 1,
  },
  {
    brokerId: 'ib',
    brokerName: 'IBKR',
    icon: '🏦',
    market: ['US', 'Global'],
    type: 'api',
    typeLabel: 'TWS API',
    status: 'disconnected',
    feeRate: '$0.005/share',
    copyTradeSupported: true,
    signalMatching: 'fuzzy',
    minAmount: 500,
    maxSlippage: 0.3,
    supportedExchanges: ['NASDAQ', 'NYSE', 'LSE', 'TSE'],
    region: 'US',
    rank: 2,
  },
  {
    brokerId: 'tiger',
    brokerName: 'Tiger',
    icon: '🐯',
    market: ['US', 'HK'],
    type: 'cloud',
    typeLabel: 'Cloud SDK',
    status: 'connecting',
    feeRate: '0.03%',
    copyTradeSupported: true,
    signalMatching: 'exact',
    minAmount: 200,
    maxSlippage: 0.5,
    supportedExchanges: ['HKEX', 'NASDAQ', 'NYSE'],
    region: 'HK',
    rank: 1,
  },
  {
    brokerId: 'schwab',
    brokerName: 'Schwab',
    icon: '🔵',
    market: ['US'],
    type: 'oauth2',
    typeLabel: 'OAuth2',
    status: 'disconnected',
    feeRate: '$0.00',
    copyTradeSupported: true,
    signalMatching: 'fuzzy',
    minAmount: 1000,
    maxSlippage: 0.3,
    supportedExchanges: ['NASDAQ', 'NYSE'],
    region: 'US',
    rank: 3,
  },
  {
    brokerId: 'binance',
    brokerName: 'Binance',
    icon: '🟡',
    market: ['Crypto'],
    type: 'cloud',
    typeLabel: 'Cloud REST',
    status: 'connected',
    latency: 12,
    feeRate: '0.10%',
    copyTradeSupported: true,
    signalMatching: 'exact',
    minAmount: 10,
    maxSlippage: 0.2,
    supportedExchanges: ['Binance'],
    region: 'Crypto',
    rank: 1,
  },
  {
    brokerId: 'okx',
    brokerName: 'OKX',
    icon: '⬜',
    market: ['Crypto'],
    type: 'cloud',
    typeLabel: 'Cloud REST',
    status: 'connected',
    latency: 45,
    feeRate: '0.08%',
    copyTradeSupported: true,
    signalMatching: 'exact',
    minAmount: 10,
    maxSlippage: 0.2,
    supportedExchanges: ['OKX'],
    region: 'Crypto',
    rank: 2,
  },
  {
    brokerId: 'longbridge',
    brokerName: 'Longbridge',
    icon: '🌉',
    market: ['HK', 'US'],
    type: 'opend',
    typeLabel: 'OpenD',
    status: 'disconnected',
    feeRate: '0.02%',
    copyTradeSupported: true,
    signalMatching: 'exact',
    minAmount: 200,
    maxSlippage: 0.5,
    supportedExchanges: ['HKEX', 'NASDAQ', 'NYSE'],
    region: 'HK',
    rank: 3,
  },
  {
    brokerId: 'etoro',
    brokerName: 'eToro',
    icon: '🔷',
    market: ['US', 'Global'],
    type: 'oauth2',
    typeLabel: 'OAuth2',
    status: 'disconnected',
    feeRate: '0.09%',
    copyTradeSupported: true,
    signalMatching: 'fuzzy',
    minAmount: 200,
    maxSlippage: 1.0,
    supportedExchanges: ['NASDAQ', 'NYSE'],
    region: 'US',
    rank: 4,
  },
];

// ═══════════ Components ═══════════

const TYPE_CONFIG: Record<string, { color: string; icon: React.ReactNode; bg: string }> = {
  cloud: { color: '#3b82f6', icon: <CloudOutlined />, bg: '#3b82f620' },
  opend: { color: '#22c55e', icon: <ApiOutlined />, bg: '#22c55e20' },
  oauth2: { color: '#a78bfa', icon: <SafetyCertificateOutlined />, bg: '#a78bfa20' },
  api: { color: '#f59e0b', icon: <ThunderboltOutlined />, bg: '#f59e0b20' },
};

const REGION_LABELS: Record<string, string> = {
  US: '🇺🇸 美股',
  HK: '🇭🇰 港股',
  CN: '🇨🇳 A股',
  Crypto: '🪙 加密货币',
  Global: '🌍 全球',
};

// ── Broker Selector Card ──

function BrokerSelectorCard({
  broker,
  selected,
  onToggle,
}: {
  broker: CopyTradeBroker;
  selected: boolean;
  onToggle: (id: string) => void;
}) {
  const typeCfg = TYPE_CONFIG[broker.type] || TYPE_CONFIG.api;

  return (
    <div
      onClick={() => broker.copyTradeSupported && onToggle(broker.brokerId)}
      style={{
        padding: '12px 14px',
        background: selected ? '#1e3a5f' : '#1a1d2e',
        border: `1px solid ${selected ? '#3b82f6' : '#2a2d3e'}`,
        borderRadius: 10,
        marginBottom: 8,
        cursor: broker.copyTradeSupported ? 'pointer' : 'not-allowed',
        opacity: broker.copyTradeSupported ? 1 : 0.5,
        transition: 'all 0.2s ease',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        {/* Left */}
        <Space size={10}>
          <span style={{ fontSize: 24 }}>{broker.icon}</span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: '#e0e0e0', fontWeight: 600, fontSize: 14 }}>
                {broker.brokerName}
              </span>
              <Badge
                color={broker.status === 'connected' ? '#22c55e' : broker.status === 'connecting' ? '#f59e0b' : '#8b949e'}
                text={
                  <span style={{ fontSize: 11, color: '#8b949e' }}>
                    {broker.status === 'connected' ? '已连接' : broker.status === 'connecting' ? '连接中' : '未连接'}
                  </span>
                }
              />
              {broker.rank <= 2 && (
                <Tag color="gold" style={{ fontSize: 10, lineHeight: '16px' }}>推荐</Tag>
              )}
            </div>
            <Space size={4} style={{ marginTop: 4 }}>
              <Tag
                color={typeCfg.color}
                style={{
                  fontSize: 10,
                  lineHeight: '16px',
                  background: typeCfg.bg,
                  border: 'none',
                }}
              >
                {typeCfg.icon} {typeCfg.color === typeCfg.color && broker.typeLabel}
              </Tag>
              <Tag color="cyan" style={{ fontSize: 10, lineHeight: '16px' }}>{REGION_LABELS[broker.region]}</Tag>
            </Space>
          </div>
        </Space>

        {/* Right */}
        <div style={{ textAlign: 'right' }}>
          <Switch
            size="small"
            checked={selected}
            onChange={() => broker.copyTradeSupported && onToggle(broker.brokerId)}
            disabled={!broker.copyTradeSupported}
          />
          <div style={{ marginTop: 6, fontSize: 11, color: '#8b949e' }}>
            {broker.latency ? `${broker.latency}ms` : '—'}
          </div>
        </div>
      </div>

      {/* Detail row */}
      <div style={{
        display: 'flex',
        gap: 16,
        marginTop: 10,
        padding: '8px 10px',
        background: '#0d0f1a',
        borderRadius: 6,
        fontSize: 11,
        color: '#8b949e',
      }}>
        <div>费率 <span style={{ color: '#e0e0e0' }}>{broker.feeRate}</span></div>
        <div>最小 <span style={{ color: '#e0e0e0' }}>${broker.minAmount}</span></div>
        <div>滑点 <span style={{ color: '#e0e0e0' }}>{broker.maxSlippage}%</span></div>
        <div>匹配 <Tag color={broker.signalMatching === 'exact' ? 'green' : 'orange'} style={{ fontSize: 10, lineHeight: '16px' }}>
          {broker.signalMatching === 'exact' ? '精确' : '模糊'}
        </Tag></div>
      </div>

      {selected && (
        <div style={{
          marginTop: 8,
          padding: '6px 10px',
          background: '#3b82f610',
          borderRadius: 6,
          fontSize: 11,
          color: '#3b82f6',
        }}>
          <CheckCircleOutlined /> 已选择为跟单券商
        </div>
      )}
    </div>
  );
}

// ── Main CopyTradeBrokerSelector ──

export default function CopyTradeBrokerSelector() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [regionFilter, setRegionFilter] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('dw-copytrade-brokers') || '[]');
    } catch {
      return ['futu', 'binance'];
    }
  });

  // Persist selection
  const handleToggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        localStorage.setItem('dw-copytrade-brokers', JSON.stringify(next));
      } catch { /* ignore */ }
      return next;
    });
  }, []);

  // Filter brokers
  const filtered = useMemo(() => {
    return MOCK_COPY_BROKERS.filter((b) => {
      if (search && !b.brokerName.toLowerCase().includes(search.toLowerCase()) && !b.brokerId.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      if (typeFilter.length > 0 && !typeFilter.includes(b.type)) return false;
      if (regionFilter.length > 0 && !regionFilter.includes(b.region)) return false;
      return true;
    });
  }, [search, typeFilter, regionFilter]);

  // Grouped
  const grouped = useMemo(() => {
    const groups: Record<string, CopyTradeBroker[]> = {};
    for (const b of filtered) {
      const key = REGION_LABELS[b.region] || b.region;
      if (!groups[key]) groups[key] = [];
      groups[key].push(b);
    }
    return groups;
  }, [filtered]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const b of MOCK_COPY_BROKERS) {
      counts[b.type] = (counts[b.type] || 0) + 1;
    }
    return counts;
  }, []);

  return (
    <div style={{ padding: '0 4px' }}>
      {/* Filter Bar */}
      <Card
        size="small"
        style={{
          background: '#1a1d2e',
          border: '1px solid #2a2d3e',
          borderRadius: 10,
          marginBottom: 12,
        }}
        styles={{ body: { padding: '12px 14px' } }}
      >
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <Input
            prefix={<SearchOutlined style={{ color: '#6b7280' }} />}
            placeholder="搜索券商..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 200, background: '#0d0f1a', border: '1px solid #2a2d3e' }}
            allowClear
          />
          <Select
            mode="multiple"
            placeholder="协议类型"
            value={typeFilter}
            onChange={setTypeFilter}
            style={{ minWidth: 180 }}
            options={[
              { label: <><CloudOutlined /> Cloud ({typeCounts.cloud || 0})</>, value: 'cloud' },
              { label: <><ApiOutlined /> OpenD ({typeCounts.opend || 0})</>, value: 'opend' },
              { label: <><SafetyCertificateOutlined /> OAuth2 ({typeCounts.oauth2 || 0})</>, value: 'oauth2' },
              { label: <><ThunderboltOutlined /> API ({typeCounts.api || 0})</>, value: 'api' },
            ]}
            allowClear
          />
          <Select
            mode="multiple"
            placeholder="市场区域"
            value={regionFilter}
            onChange={setRegionFilter}
            style={{ minWidth: 150 }}
            options={[
              { label: '🇺🇸 美股', value: 'US' },
              { label: '🇭🇰 港股', value: 'HK' },
              { label: '🪙 加密货币', value: 'Crypto' },
              { label: '🌍 全球', value: 'Global' },
            ]}
            allowClear
          />

          <div style={{ flex: 1 }} />

          <Space>
            <Tooltip title={`已选 ${selected.length} 个券商`}>
              <span style={{ color: '#8b949e', fontSize: 12 }}>
                已选: <span style={{ color: '#3b82f6', fontWeight: 600 }}>{selected.length}</span>
              </span>
            </Tooltip>
          </Space>
        </div>
      </Card>

      {/* Broker List by Region */}
      {Object.keys(grouped).length === 0 ? (
        <Empty description="无匹配券商" />
      ) : (
        Object.entries(grouped).map(([region, brokers]) => (
          <div key={region} style={{ marginBottom: 16 }}>
            <div style={{
              color: '#6b7280',
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 8,
              padding: '0 4px',
            }}>
              {region} · {brokers.length} 个
            </div>
            {brokers.map((b) => (
              <BrokerSelectorCard
                key={b.brokerId}
                broker={b}
                selected={selected.includes(b.brokerId)}
                onToggle={handleToggle}
              />
            ))}
          </div>
        ))
      )}

      {/* Legend */}
      <div style={{
        display: 'flex',
        gap: 16,
        marginTop: 8,
        padding: '8px 12px',
        fontSize: 11,
        color: '#6b7280',
        background: '#1a1d2e',
        borderRadius: 8,
        border: '1px solid #2a2d3e',
        flexWrap: 'wrap',
      }}>
        {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
          <Space key={key} size={4}>
            <span style={{ color: cfg.color, fontSize: 16 }}>{cfg.icon}</span>
            <span>{key.toUpperCase()}</span>
          </Space>
        ))}
        <div style={{ flex: 1 }} />
        <span>● 精确匹配 = 同代码 | ○ 模糊匹配 = 同名称</span>
      </div>
    </div>
  );
}
