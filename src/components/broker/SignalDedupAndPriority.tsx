// @ts-nocheck
// ── R140-M02 SignalDedupPanel + R140-M03 SignalPriorityVisual ────────────
// PM: P2-2(1h)跨券商去重 + P2-3(1h)优先级视觉

import { useState, useMemo } from 'react';
import {
  Card, Table, Tag, Space, Tooltip, Badge, Empty,
} from 'antd';
import {
  ThunderboltOutlined, CheckCircleOutlined, CloseCircleOutlined,
  WarningOutlined, SafetyCertificateOutlined, ApiOutlined,
  ReloadOutlined,
} from '@ant-design/icons';

// ═══════════ Types ═══════════

type SignalPriority = 'P0' | 'P1' | 'P2';
type DedupStatus = 'unique' | 'duplicate' | 'merged';

interface SignalEntry {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  price: number;
  quantity: number;
  confidence: number;
  strategyName: string;
  providers: string[];      // signal providers who sent this
  brokers: string[];        // brokers the signal applies to
  priority: SignalPriority;
  dedupStatus: DedupStatus;
  dedupGroup?: string;      // group key for duplicates
  duplicateCount?: number;
  receivedAt: number;
}

// ═══════════ Mock ═══════════

const MOCK_SIGNALS: SignalEntry[] = [
  { id: 's1', symbol: 'BTC-USDT', side: 'BUY', price: 97234, quantity: 0.01, confidence: 92, strategyName: '多因子趋势', providers: ['AlphaQuant', 'WhaleTracker'], brokers: ['Binance', 'OKX'], priority: 'P0', dedupStatus: 'merged', dedupGroup: 'BTC-USDT-BUY', duplicateCount: 2, receivedAt: Date.now() - 60000 },
  { id: 's2', symbol: 'ETH-USDT', side: 'SELL', price: 3821, quantity: 0.5, confidence: 88, strategyName: 'MACD背驰', providers: ['AlphaQuant'], brokers: ['Binance', 'OKX', 'Bybit'], priority: 'P0', dedupStatus: 'unique', receivedAt: Date.now() - 120000 },
  { id: 's3', symbol: 'SOL-USDT', side: 'SELL', price: 187.5, quantity: 5, confidence: 78, strategyName: 'MA死叉', providers: ['GoldenCross'], brokers: ['OKX'], priority: 'P1', dedupStatus: 'duplicate', dedupGroup: 'SOL-USDT-SELL', duplicateCount: 2, receivedAt: Date.now() - 180000 },
  { id: 's4', symbol: 'SOL-USDT', side: 'SELL', price: 187.2, quantity: 3, confidence: 75, strategyName: 'RSI超买', providers: ['ScalperBot'], brokers: ['Bybit'], priority: 'P1', dedupStatus: 'duplicate', dedupGroup: 'SOL-USDT-SELL', duplicateCount: 2, receivedAt: Date.now() - 190000 },
  { id: 's5', symbol: 'HK.00700', side: 'BUY', price: 388.6, quantity: 100, confidence: 85, strategyName: 'MACD底背离', providers: ['TrendRider'], brokers: ['Futu', 'Tiger'], priority: 'P0', dedupStatus: 'unique', receivedAt: Date.now() - 300000 },
  { id: 's6', symbol: 'DOGE-USDT', side: 'BUY', price: 0.172, quantity: 5000, confidence: 65, strategyName: '网格触底', providers: ['ScalperBot'], brokers: ['Bybit'], priority: 'P2', dedupStatus: 'unique', receivedAt: Date.now() - 600000 },
  { id: 's7', symbol: 'US.NVDA', side: 'BUY', price: 134.2, quantity: 40, confidence: 72, strategyName: 'VWAP支撑', providers: ['WhaleTracker'], brokers: ['IBKR', 'Tiger'], priority: 'P1', dedupStatus: 'unique', receivedAt: Date.now() - 900000 },
];

// ═══════════ Config ═══════════

const PRIORITY_CONFIG: Record<SignalPriority, { color: string; bg: string; label: string; icon: React.ReactNode }> = {
  P0: { color: '#ef4444', bg: '#ef444420', label: '紧急', icon: <ThunderboltOutlined /> },
  P1: { color: '#f59e0b', bg: '#f59e0b20', label: '重要', icon: <WarningOutlined /> },
  P2: { color: '#8b949e', bg: '#8b949e20', label: '普通', icon: <ReloadOutlined /> },
};

const DEDUP_CONFIG: Record<DedupStatus, { color: string; label: string; icon: React.ReactNode }> = {
  unique: { color: '#22c55e', label: '独立', icon: <CheckCircleOutlined /> },
  duplicate: { color: '#f59e0b', label: '重复', icon: <WarningOutlined /> },
  merged: { color: '#3b82f6', label: '已合并', icon: <ApiOutlined /> },
};

function fmtTime(ts: number) {
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 60) return `${sec}s 前`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m 前`;
  return `${Math.floor(sec / 3600)}h 前`;
}

// ── Main SignalDedupAndPriority ──

export default function SignalDedupAndPriority() {
  const signals = MOCK_SIGNALS;

  const stats = useMemo(() => ({
    total: signals.length,
    unique: signals.filter((s) => s.dedupStatus === 'unique').length,
    merged: signals.filter((s) => s.dedupStatus === 'merged').length,
    duplicate: signals.filter((s) => s.dedupStatus === 'duplicate').length,
    p0: signals.filter((s) => s.priority === 'P0').length,
    p1: signals.filter((s) => s.priority === 'P1').length,
    p2: signals.filter((s) => s.priority === 'P2').length,
  }), [signals]);

  const columns = [
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 70,
      render: (v: SignalPriority) => {
        const p = PRIORITY_CONFIG[v];
        return (
          <Tag color={p.color} style={{ fontSize: 10, fontWeight: 700 }}>
            {p.icon} {v}
          </Tag>
        );
      },
    },
    {
      title: '代码',
      dataIndex: 'symbol',
      key: 'symbol',
      width: 110,
      render: (v: string, r: SignalEntry) => (
        <div>
          <span style={{ color: '#e0e0e0', fontWeight: 600, fontSize: 12 }}>{v}</span>
          {r.dedupStatus === 'merged' && r.duplicateCount && r.duplicateCount > 1 && (
            <Badge count={r.duplicateCount} size="small" style={{ marginLeft: 4, fontSize: 9 }} />
          )}
        </div>
      ),
    },
    {
      title: '方向',
      dataIndex: 'side',
      key: 'side',
      width: 55,
      render: (v: string) => (
        <Tag color={v === 'BUY' ? 'green' : 'red'} style={{ fontSize: 10 }}>
          {v === 'BUY' ? '买' : '卖'}
        </Tag>
      ),
    },
    {
      title: '置信',
      dataIndex: 'confidence',
      key: 'confidence',
      width: 55,
      render: (v: number) => (
        <span style={{ color: v >= 80 ? '#22c55e' : v >= 65 ? '#f59e0b' : '#8b949e', fontWeight: 600 }}>
          {v}%
        </span>
      ),
    },
    {
      title: '信号源',
      dataIndex: 'providers',
      key: 'providers',
      width: 150,
      render: (providers: string[], r: SignalEntry) => (
        <Space size={2} wrap>
          {providers.map((p) => (
            <Tag key={p} color={r.dedupStatus === 'merged' ? 'blue' : 'cyan'} style={{ fontSize: 9, lineHeight: '14px' }}>
              {p}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '券商',
      dataIndex: 'brokers',
      key: 'brokers',
      width: 130,
      render: (brokers: string[]) => (
        <Space size={2} wrap>
          {brokers.map((b) => (
            <Tag key={b} color="geekblue" style={{ fontSize: 9, lineHeight: '14px' }}>{b}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '去重',
      dataIndex: 'dedupStatus',
      key: 'dedup',
      width: 90,
      render: (v: DedupStatus, r: SignalEntry) => {
        const d = DEDUP_CONFIG[v];
        return (
          <Tooltip title={
            v === 'merged' ? `${r.duplicateCount}个相同信号已合并为1个` :
            v === 'duplicate' ? '检测到重复信号，等待合并' :
            '独立信号'
          }>
            <Tag color={d.color} style={{ fontSize: 9, lineHeight: '14px' }}>
              {d.icon} {d.label}
              {v === 'merged' && r.duplicateCount && ` ×${r.duplicateCount}`}
            </Tag>
          </Tooltip>
        );
      },
    },
    {
      title: '时间',
      dataIndex: 'receivedAt',
      key: 'time',
      width: 60,
      render: (v: number) => <span style={{ color: '#8b949e', fontSize: 10 }}>{fmtTime(v)}</span>,
    },
  ];

  return (
    <div style={{ padding: '0 4px' }}>
      {/* Priority Legend + Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(6, 1fr)',
        gap: 8,
        marginBottom: 12,
      }}>
        {/* Dedup stats */}
        <div style={{ padding: '10px', background: '#1a1d2e', borderRadius: 8, border: '1px solid #2a2d3e', textAlign: 'center' }}>
          <div style={{ fontSize: 9, color: '#6b7280' }}>总信号</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#e0e0e0', fontFamily: 'monospace' }}>{stats.total}</div>
        </div>
        <div style={{ padding: '10px', background: '#1a2e1a', borderRadius: 8, border: '1px solid #22c55e33', textAlign: 'center' }}>
          <div style={{ fontSize: 9, color: '#22c55e' }}>独立</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#22c55e', fontFamily: 'monospace' }}>{stats.unique}</div>
        </div>
        <div style={{ padding: '10px', background: '#1a2e2a', borderRadius: 8, border: '1px solid #3b82f633', textAlign: 'center' }}>
          <div style={{ fontSize: 9, color: '#3b82f6' }}>已合并</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#3b82f6', fontFamily: 'monospace' }}>{stats.merged}</div>
        </div>
        {/* Priority stats */}
        <div style={{ padding: '10px', background: '#2e0a0a', borderRadius: 8, border: '1px solid #ef444433', textAlign: 'center' }}>
          <div style={{ fontSize: 9, color: '#ef4444' }}>P0 紧急</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#ef4444', fontFamily: 'monospace' }}>{stats.p0}</div>
        </div>
        <div style={{ padding: '10px', background: '#2e2a1a', borderRadius: 8, border: '1px solid #f59e0b33', textAlign: 'center' }}>
          <div style={{ fontSize: 9, color: '#f59e0b' }}>P1 重要</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#f59e0b', fontFamily: 'monospace' }}>{stats.p1}</div>
        </div>
        <div style={{ padding: '10px', background: '#1a1d2e', borderRadius: 8, border: '1px solid #2a2d3e', textAlign: 'center' }}>
          <div style={{ fontSize: 9, color: '#8b949e' }}>P2 普通</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#8b949e', fontFamily: 'monospace' }}>{stats.p2}</div>
        </div>
      </div>

      {/* Priority Legend */}
      <div style={{
        display: 'flex',
        gap: 16,
        marginBottom: 10,
        padding: '6px 12px',
        background: '#1a1d2e',
        borderRadius: 8,
        border: '1px solid #2a2d3e',
        fontSize: 11,
      }}>
        <Space size={4}><Tag color="red">P0</Tag><span style={{ color: '#e0e0e0' }}>紧急: 高置信(≥80%) + 多源</span></Space>
        <Space size={4}><Tag color="gold">P1</Tag><span style={{ color: '#e0e0e0' }}>重要: 中置信(65-79%)</span></Space>
        <Space size={4}><Tag color="default">P2</Tag><span style={{ color: '#e0e0e0' }}>普通: 低置信(&lt;65%)</span></Space>
      </div>

      {/* Dedup info banner */}
      <div style={{
        padding: '8px 12px',
        background: '#1a2e2a',
        borderRadius: 8,
        border: '1px solid #3b82f633',
        marginBottom: 10,
        fontSize: 11,
        color: '#8b949e',
      }}>
        <ApiOutlined style={{ color: '#3b82f6', marginRight: 6 }} />
        跨券商去重: 相同代码+方向的信号自动合并，不同券商的同一信号只创建一组跟单
      </div>

      {/* Signal Table */}
      <Card
        size="small"
        title={<Space><ThunderboltOutlined style={{ color: '#f59e0b' }} /><span style={{ color: '#e0e0e0', fontSize: 14 }}>信号队列</span></Space>}
        style={{ background: '#1a1d2e', border: '1px solid #2a2d3e', borderRadius: 10 }}
        styles={{ body: { padding: '8px' } }}
      >
        <Table
          dataSource={signals}
          columns={columns}
          rowKey="id"
          size="small"
          pagination={false}
          rowClassName={() => 'dark-table-row'}
          locale={{ emptyText: <Empty description="无待处理信号" /> }}
        />
      </Card>
    </div>
  );
}
