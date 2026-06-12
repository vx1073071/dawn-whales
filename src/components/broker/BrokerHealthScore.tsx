// @ts-nocheck
// ── R134-M03 BrokerHealthScore — 券商健康度评分 (0-100) ──────────────────
// PM: 连接率+延迟+错误率+WS状态→综合评分

import { useState, useMemo, useCallback } from 'react';
import {
  Card, Progress, Tag, Space, Tooltip, Statistic, Empty, Table, Badge,
} from 'antd';
import {
  HeartOutlined, WifiOutlined, ClockCircleOutlined, WarningOutlined,
  CheckCircleOutlined, CloseCircleOutlined, SyncOutlined,
  RiseOutlined, FallOutlined, ThunderboltOutlined, DashboardOutlined,
  SafetyCertificateOutlined, ApiOutlined,
} from '@ant-design/icons';

// ═══════════ Types ═══════════

interface HealthMetric {
  brokerId: string;
  brokerName: string;
  icon: string;
  market: string[];
  connectionRate: number;      // %
  avgLatency: number;          // ms
  errorRate24h: number;        // %
  wsStability: number;         // %
  uptime7d: number;            // %
  orderSuccessRate: number;    // %
  apiQuotaRemaining: number;   // %
  lastIncident?: string;
  score: number;               // 0-100 composite
  breakdown: {
    connection: number;        // 0-100 subscore
    latency: number;
    errors: number;
    ws: number;
    uptime: number;
  };
  trend: 'up' | 'down' | 'stable';
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
}

// ═══════════ Mock data ═══════════

const MOCK_HEALTH: HealthMetric[] = [
  {
    brokerId: 'futu', brokerName: 'Futu', icon: '🐂', market: ['HK', 'US'],
    connectionRate: 99.9, avgLatency: 8, errorRate24h: 0.02, wsStability: 99.99,
    uptime7d: 100, orderSuccessRate: 99.8, apiQuotaRemaining: 78,
    score: 97, trend: 'stable',
    breakdown: { connection: 100, latency: 98, errors: 99, ws: 99, uptime: 100 },
    grade: 'A',
  },
  {
    brokerId: 'binance', brokerName: 'Binance', icon: '🟡', market: ['Crypto'],
    connectionRate: 99.8, avgLatency: 12, errorRate24h: 0.15, wsStability: 99.95,
    uptime7d: 99.98, orderSuccessRate: 99.2, apiQuotaRemaining: 65,
    score: 94, trend: 'stable',
    breakdown: { connection: 99, latency: 95, errors: 91, ws: 98, uptime: 99 },
    grade: 'A',
  },
  {
    brokerId: 'okx', brokerName: 'OKX', icon: '⬜', market: ['Crypto'],
    connectionRate: 99.5, avgLatency: 45, errorRate24h: 0.6, wsStability: 99.8,
    uptime7d: 99.95, orderSuccessRate: 98.5, apiQuotaRemaining: 82,
    score: 88, trend: 'down',
    breakdown: { connection: 98, latency: 82, errors: 84, ws: 95, uptime: 99 },
    grade: 'B',
  },
  {
    brokerId: 'bybit', brokerName: 'Bybit', icon: '🟠', market: ['Crypto'],
    connectionRate: 97.2, avgLatency: 345, errorRate24h: 4.2, wsStability: 96.5,
    uptime7d: 99.5, orderSuccessRate: 95.1, apiQuotaRemaining: 91,
    score: 72, trend: 'down', lastIncident: 'API 限流 06-12',
    breakdown: { connection: 95, latency: 45, errors: 62, ws: 85, uptime: 97 },
    grade: 'C',
  },
  {
    brokerId: 'bitget', brokerName: 'Bitget', icon: '🟣', market: ['Crypto'],
    connectionRate: 98.0, avgLatency: 23, errorRate24h: 0.8, wsStability: 85.0,
    uptime7d: 99.9, orderSuccessRate: 0, apiQuotaRemaining: 100,
    score: 65, trend: 'down', lastIncident: 'WebSocket 断开 06-11',
    breakdown: { connection: 96, latency: 90, errors: 78, ws: 50, uptime: 99 },
    grade: 'C',
  },
  {
    brokerId: 'robinhood', brokerName: 'Robinhood Crypto', icon: '🟢', market: ['Crypto'],
    connectionRate: 0, avgLatency: 0, errorRate24h: 0, wsStability: 0,
    uptime7d: 0, orderSuccessRate: 0, apiQuotaRemaining: 0,
    score: 0, trend: 'stable',
    breakdown: { connection: 0, latency: 0, errors: 0, ws: 0, uptime: 0 },
    grade: 'F',
  },
  {
    brokerId: 'tiger', brokerName: 'Tiger', icon: '🐯', market: ['US', 'HK'],
    connectionRate: 92.0, avgLatency: 87, errorRate24h: 1.2, wsStability: 97.0,
    uptime7d: 99.8, orderSuccessRate: 97.2, apiQuotaRemaining: 55,
    score: 78, trend: 'up',
    breakdown: { connection: 88, latency: 76, errors: 75, ws: 90, uptime: 99 },
    grade: 'B',
  },
  {
    brokerId: 'ib', brokerName: 'IBKR', icon: '🏦', market: ['US', 'Global'],
    connectionRate: 0, avgLatency: 0, errorRate24h: 0, wsStability: 0,
    uptime7d: 0, orderSuccessRate: 0, apiQuotaRemaining: 0,
    score: 0, trend: 'stable',
    breakdown: { connection: 0, latency: 0, errors: 0, ws: 0, uptime: 0 },
    grade: 'F',
  },
  {
    brokerId: 'schwab', brokerName: 'Schwab', icon: '🔵', market: ['US'],
    connectionRate: 0, avgLatency: 0, errorRate24h: 0, wsStability: 0,
    uptime7d: 0, orderSuccessRate: 0, apiQuotaRemaining: 0,
    score: 0, trend: 'stable',
    breakdown: { connection: 0, latency: 0, errors: 0, ws: 0, uptime: 0 },
    grade: 'F',
  },
];

// ═══════════ Constants ═══════════

const GRADE_CONFIG: Record<string, { color: string; bg: string; label: string; icon: React.ReactNode }> = {
  A: { color: '#22c55e', bg: '#22c55e20', label: '优秀', icon: <CheckCircleOutlined /> },
  B: { color: '#3b82f6', bg: '#3b82f620', label: '良好', icon: <ThunderboltOutlined /> },
  C: { color: '#f59e0b', bg: '#f59e0b20', label: '一般', icon: <WarningOutlined /> },
  D: { color: '#f97316', bg: '#f9731620', label: '较差', icon: <FallOutlined /> },
  F: { color: '#ef4444', bg: '#ef444420', label: '未连接', icon: <CloseCircleOutlined /> },
};

const SCORE_COLOR = (score: number) =>
  score >= 90 ? '#22c55e' : score >= 70 ? '#3b82f6' : score >= 50 ? '#f59e0b' : score > 0 ? '#f97316' : '#ef4444';

const TREND_ICONS: Record<string, React.ReactNode> = {
  up: <RiseOutlined style={{ color: '#22c55e' }} />,
  down: <FallOutlined style={{ color: '#ef4444' }} />,
  stable: <span style={{ color: '#8b949e' }}>—</span>,
};

// ── Score Gauge (circular progress) ──

function ScoreGauge({ score, size, grade }: { score: number; size: number; grade: string }) {
  const g = GRADE_CONFIG[grade] || GRADE_CONFIG.F;
  const color = SCORE_COLOR(score);

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <Progress
        type="circle"
        percent={score}
        size={size}
        strokeColor={{
          '0%': color,
          '100%': color,
        }}
        trailColor="#1e2030"
        strokeWidth={8}
        format={(p) => (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: size > 80 ? 22 : 18, fontWeight: 800, color: '#e0e0e0', fontFamily: 'monospace' }}>
              {score}
            </div>
            <div style={{ fontSize: 10, color: color, fontWeight: 600 }}>
              {g.label}
            </div>
          </div>
        )}
      />
    </div>
  );
}

// ── Health Detail Card ──

function HealthDetailCard({ health }: { health: HealthMetric }) {
  const g = GRADE_CONFIG[health.grade];
  const isDisconnected = health.score === 0;

  return (
    <Card
      size="small"
      style={{
        background: isDisconnected ? '#1a1d2e' : '#1a1d2e',
        border: `1px solid ${g.color}22`,
        borderRadius: 10,
        marginBottom: 10,
      }}
      styles={{ body: { padding: '14px' } }}
    >
      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        {/* Gauge */}
        <ScoreGauge score={health.score} size={80} grade={health.grade} />

        {/* Info */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <Space size={6}>
              <span style={{ fontSize: 18 }}>{health.icon}</span>
              <span style={{ color: '#e0e0e0', fontWeight: 600, fontSize: 14 }}>{health.brokerName}</span>
            </Space>
            <Space size={4}>
              {TREND_ICONS[health.trend]}
              <Tag color={g.color === '#22c55e' ? 'green' : g.color === '#3b82f6' ? 'blue' : g.color === '#f59e0b' ? 'gold' : g.color === '#f97316' ? 'orange' : 'red'} style={{ fontSize: 10 }}>
                {g.icon} {g.label}
              </Tag>
            </Space>
          </div>

          {/* mini metrics */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 6,
          }}>
            {isDisconnected ? (
              <div style={{ gridColumn: '1 / -1', color: '#6b7280', fontSize: 11 }}>未连接 · 无健康数据</div>
            ) : (
              <>
                <HealthMini label="延迟" value={`${health.avgLatency}ms`} score={health.breakdown.latency} />
                <HealthMini label="成功率" value={`${health.orderSuccessRate}%`} score={health.breakdown.connection} />
                <HealthMini label="在线率" value={`${health.uptime7d}%`} score={health.breakdown.uptime} />
                <HealthMini label="WS稳定" value={`${health.wsStability}%`} score={health.breakdown.ws} />
              </>
            )}
          </div>

          {/* Incident */}
          {health.lastIncident && (
            <div style={{
              marginTop: 8,
              padding: '4px 8px',
              background: '#2e0a0a',
              borderRadius: 4,
              fontSize: 10,
              color: '#ef4444',
            }}>
              <WarningOutlined /> {health.lastIncident}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function HealthMini({ label, value, score }: { label: string; value: string; score: number }) {
  return (
    <div style={{ textAlign: 'center', fontSize: 10 }}>
      <div style={{ color: '#6b7280' }}>{label}</div>
      <div style={{ color: '#e0e0e0', fontWeight: 600 }}>{value}</div>
      <Progress
        percent={score}
        size="small"
        showInfo={false}
        strokeColor={SCORE_COLOR(score)}
        trailColor="#1e2030"
        style={{ margin: '2px 0 0 0' }}
      />
    </div>
  );
}

// ── Summary Overview ──

function OverviewSummary({ metrics }: { metrics: HealthMetric[] }) {
  const connected = metrics.filter((m) => m.score > 0);
  const avgScore = connected.length > 0
    ? Math.round(connected.reduce((s, m) => s + m.score, 0) / connected.length)
    : 0;
  const total = metrics.length;
  const connectedCount = connected.length;
  const gradeDist = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  for (const m of metrics) {
    gradeDist[m.grade] = (gradeDist[m.grade] || 0) + 1;
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(5, 1fr)',
      gap: 10,
      marginBottom: 14,
    }}>
      <Card size="small" styles={{ body: { padding: '12px 14px' } }} style={{ background: '#1a1d2e', border: '1px solid #2a2d3e', borderRadius: 10, textAlign: 'center' }}>
        <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 4 }}>平均健康度</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: SCORE_COLOR(avgScore), fontFamily: 'monospace' }}>{avgScore}</div>
        <div style={{ fontSize: 10, color: '#8b949e' }}>/100</div>
      </Card>

      {(['A', 'B', 'C', 'F'] as const).map((grade) => {
        const g = GRADE_CONFIG[grade];
        const count = gradeDist[grade];
        return (
          <Card
            key={grade}
            size="small"
            styles={{ body: { padding: '12px 14px' } }}
            style={{
              background: count > 0 ? g.bg : '#1a1d2e',
              border: `1px solid ${count > 0 ? g.color + '33' : '#2a2d3e'}`,
              borderRadius: 10,
              textAlign: 'center',
              opacity: count > 0 ? 1 : 0.4,
            }}
          >
            <div style={{ fontSize: 18, color: g.color, marginBottom: 4 }}>{g.icon}</div>
            <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 2 }}>{g.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: count > 0 ? g.color : '#8b949e', fontFamily: 'monospace' }}>
              {count}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ── Breakdown Radar Table ──

function BreakdownTable({ metrics }: { metrics: HealthMetric[] }) {
  const columns = [
    {
      title: '券商',
      dataIndex: 'brokerName',
      key: 'name',
      render: (_: any, r: HealthMetric) => (
        <Space size={6}>
          <span>{r.icon}</span>
          <span style={{ color: '#e0e0e0' }}>{r.brokerName}</span>
        </Space>
      ),
    },
    {
      title: '评分',
      dataIndex: 'score',
      key: 'score',
      width: 60,
      render: (v: number, r: HealthMetric) => (
        <span style={{ color: SCORE_COLOR(v), fontWeight: 700, fontFamily: 'monospace' }}>
          {v > 0 ? v : '—'}
        </span>
      ),
      sorter: (a: HealthMetric, b: HealthMetric) => a.score - b.score,
    },
    {
      title: '连接',
      dataIndex: ['breakdown', 'connection'],
      key: 'connection',
      render: (v: number) => <Progress percent={v} size="small" strokeColor={SCORE_COLOR(v)} trailColor="#1e2030" showInfo={false} style={{ width: 60 }} />,
    },
    {
      title: '延迟',
      dataIndex: ['breakdown', 'latency'],
      key: 'latency',
      render: (v: number) => <Progress percent={v} size="small" strokeColor={SCORE_COLOR(v)} trailColor="#1e2030" showInfo={false} style={{ width: 60 }} />,
    },
    {
      title: '错误',
      dataIndex: ['breakdown', 'errors'],
      key: 'errors',
      render: (v: number) => <Progress percent={v} size="small" strokeColor={SCORE_COLOR(v)} trailColor="#1e2030" showInfo={false} style={{ width: 60 }} />,
    },
    {
      title: 'WS',
      dataIndex: ['breakdown', 'ws'],
      key: 'ws',
      render: (v: number) => <Progress percent={v} size="small" strokeColor={SCORE_COLOR(v)} trailColor="#1e2030" showInfo={false} style={{ width: 60 }} />,
    },
    {
      title: '趋势',
      dataIndex: 'trend',
      key: 'trend',
      width: 60,
      render: (v: string) => TREND_ICONS[v] || '—',
    },
    {
      title: '等级',
      dataIndex: 'grade',
      key: 'grade',
      width: 70,
      render: (v: string) => {
        const g = GRADE_CONFIG[v];
        return <Tag color={v === 'A' ? 'green' : v === 'B' ? 'blue' : v === 'C' ? 'gold' : v === 'D' ? 'orange' : 'red'}>{g.icon} {v}</Tag>;
      },
    },
  ];

  return (
    <Table
      dataSource={metrics}
      columns={columns}
      rowKey="brokerId"
      size="small"
      pagination={false}
      style={{ background: 'transparent' }}
      rowClassName={() => 'dark-table-row'}
      locale={{ emptyText: <Empty description="无健康数据" /> }}
    />
  );
}

// ═══════════ Scoring formula info ──

function ScoringFormula() {
  return (
    <Card
      size="small"
      style={{
        background: '#1a1d2e',
        border: '1px solid #2a2d3e',
        borderRadius: 10,
        marginTop: 12,
      }}
      styles={{ body: { padding: '14px' } }}
    >
      <div style={{ fontSize: 13, color: '#e0e0e0', fontWeight: 600, marginBottom: 8 }}>
        <DashboardOutlined style={{ color: '#3b82f6', marginRight: 6 }} />
        评分公式
      </div>
      <code style={{
        display: 'block',
        padding: '10px 14px',
        background: '#0d0f1a',
        borderRadius: 6,
        color: '#a78bfa',
        fontSize: 11,
        fontFamily: 'monospace',
        border: '1px solid #2a2d3e',
        lineHeight: '20px',
      }}>
        健康度 = 连接率×25% + 延迟分×25% + 错误分×20% + WS稳定×15% + 在线率×15%<br />
        延迟分  = max(100 - latency/10, 0)<br />
        错误分  = max(100 - errorRate×15, 0)<br />
        等级: A≥90 · B≥70 · C≥50 · D≥20 · F&lt;20
      </code>
    </Card>
  );
}

// ── Main BrokerHealthScore ──

export default function BrokerHealthScore() {
  const sorted = useMemo(
    () => [...MOCK_HEALTH].sort((a, b) => b.score - a.score),
    []
  );

  return (
    <div style={{ padding: '0 4px' }}>
      {/* Title */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        padding: '10px 14px',
        background: 'linear-gradient(135deg, #1a1d2e 0%, #232740 100%)',
        borderRadius: 10,
        border: '1px solid #2a2d3e',
      }}>
        <Space>
          <HeartOutlined style={{ fontSize: 18, color: '#ef4444' }} />
          <div>
            <div style={{ color: '#e0e0e0', fontWeight: 600, fontSize: 15 }}>券商健康度</div>
            <div style={{ color: '#6b7280', fontSize: 11 }}>
              {MOCK_HEALTH.filter((m) => m.score > 0).length}/{MOCK_HEALTH.length} 在线 |
              平均 {Math.round(MOCK_HEALTH.filter((m) => m.score > 0).reduce((s, m) => s + m.score, 0) / Math.max(MOCK_HEALTH.filter((m) => m.score > 0).length, 1))}分
            </div>
          </div>
        </Space>
        <Badge color="#22c55e" text={<span style={{ color: '#8b949e', fontSize: 11 }}>实时监控</span>} />
      </div>

      {/* Summary grid */}
      <OverviewSummary metrics={MOCK_HEALTH} />

      {/* Health Cards */}
      {sorted.map((h) => (
        <HealthDetailCard key={h.brokerId} health={h} />
      ))}

      {/* Breakdown Table */}
      <Card
        size="small"
        title={<span style={{ color: '#e0e0e0', fontSize: 14 }}>📋 详细指标</span>}
        style={{ background: '#1a1d2e', border: '1px solid #2a2d3e', borderRadius: 10, marginBottom: 12 }}
        styles={{ body: { padding: '8px' } }}
      >
        <BreakdownTable metrics={sorted} />
      </Card>

      {/* Scoring Formula */}
      <ScoringFormula />
    </div>
  );
}
