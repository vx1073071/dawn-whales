// ── R133-M03 ProfitSplitVisualizer — 分润比例可视化 (15%/15%/10%) ─────────
// PM: 在跟单设置中显示三档分润结构

import { useState, useMemo } from 'react';
import {
  Card, Tag, Space, Slider, Statistic, Tooltip, Descriptions,
} from 'antd';
import {
  PercentageOutlined, UserOutlined, TeamOutlined, BankOutlined,
  InfoCircleOutlined, TrophyOutlined, StarOutlined, CrownOutlined,
} from '@ant-design/icons';

// ═══════════ Types ═══════════

interface TierInfo {
  key: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
  pct: number;
  minVolume: number;
  description: string;
  features: string[];
}

interface SignalProvider {
  id: string;
  name: string;
  tier: string;
  feePct: number;
}

// ═══════════ Constants ═══════════

const TIERS: TierInfo[] = [
  {
    key: 'platform',
    name: '平台费',
    icon: <BankOutlined />,
    color: '#3b82f6',
    bg: '#3b82f620',
    pct: 10,
    minVolume: 0,
    description: '平台运营费用，用于服务器/API/监控',
    features: ['实时行情', '信号推送', '风控引擎', '7×24 运行'],
  },
  {
    key: 'provider',
    name: '信号源分成',
    icon: <UserOutlined />,
    color: '#f59e0b',
    bg: '#f59e0b20',
    pct: 15,
    minVolume: 0,
    description: '信号提供商的收益分成',
    features: ['策略研发', '信号生成', '回测验证', '风险调整'],
  },
  {
    key: 'copier',
    name: '跟单者保留',
    icon: <TeamOutlined />,
    color: '#22c55e',
    bg: '#22c55e20',
    pct: 75,
    minVolume: 0,
    description: '跟单者保留的利润比例',
    features: ['自主控制', '随时暂停', '资金安全'],
  },
];

const SIGNAL_PROVIDERS: SignalProvider[] = [
  { id: 'sp1', name: 'AlphaQuant', tier: 'L3', feePct: 15 },
  { id: 'sp2', name: 'TrendMaster', tier: 'L2', feePct: 15 },
  { id: 'sp3', name: 'DeepSignal', tier: 'L1', feePct: 15 },
  { id: 'sp4', name: 'QuantumEdge', tier: 'L3', feePct: 15 },
];

// ═══════════ Sub-components ═══════════

// ── Donut Ring Chart (CSS) ──

function DonutRing({
  tiers,
  totalLabel,
  size,
}: {
  tiers: { label: string; pct: number; color: string }[];
  totalLabel: string;
  size: number;
}) {
  const radius = size / 2 - 12;
  const circumference = 2 * Math.PI * radius;
  const total = tiers.reduce((s, t) => s + t.pct, 0);

  let offset = 0;
  const segments = tiers.map((t) => {
    const length = (t.pct / total) * circumference;
    const seg = { ...t, length, offset };
    offset += length;
    return seg;
  });

  return (
    <div style={{ position: 'relative', width: size, height: size, margin: '0 auto' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#1a1d2e"
          strokeWidth={20}
        />
        {segments.map((seg, i) => (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={seg.color}
            strokeWidth={20}
            strokeDasharray={`${seg.length} ${circumference - seg.length}`}
            strokeDashoffset={-seg.offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ transition: 'stroke-dasharray 0.5s ease', strokeLinecap: 'round' }}
          />
        ))}
      </svg>
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 24, fontWeight: 700, color: '#e0e0e0' }}>{totalLabel}</div>
        <div style={{ fontSize: 11, color: '#6b7280' }}>分润结构</div>
      </div>
    </div>
  );
}

// ── Horizontal Bar Chart (CSS) ──

function SplitBar({
  tiers,
  height,
}: {
  tiers: { label: string; pct: number; color: string; icon: React.ReactNode }[];
  height: number;
}) {
  return (
    <div style={{
      width: '100%',
      height,
      display: 'flex',
      borderRadius: height / 2,
      overflow: 'hidden',
      background: '#0d0f1a',
      border: '1px solid #2a2d3e',
    }}>
      {tiers.map((t) => (
        <Tooltip
          key={t.label}
          title={`${t.label}: ${t.pct}%`}
        >
          <div
            style={{
              width: `${t.pct}%`,
              height: '100%',
              background: t.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              fontWeight: 600,
              color: '#fff',
              minWidth: t.pct > 8 ? 0 : 'auto',
              transition: 'width 0.3s ease',
            }}
          >
            {t.pct >= 10 && (
              <Space size={2}>
                {t.icon}
                <span>{t.pct}%</span>
              </Space>
            )}
          </div>
        </Tooltip>
      ))}
    </div>
  );
}

// ── Tier Cards ──

function TierCard({ tier }: { tier: TierInfo }) {
  return (
    <Card
      size="small"
      style={{
        background: '#1a1d2e',
        border: `1px solid ${tier.color}33`,
        borderRadius: 10,
      }}
      styles={{ body: { padding: '14px' } }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: tier.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
          color: tier.color,
        }}>
          {tier.icon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ color: '#e0e0e0', fontWeight: 600, fontSize: 14 }}>{tier.name}</div>
          <div style={{ color: '#6b7280', fontSize: 11 }}>{tier.description}</div>
        </div>
        <div style={{
          fontSize: 28,
          fontWeight: 800,
          color: tier.color,
          textAlign: 'right',
          fontFamily: 'monospace',
        }}>
          {tier.pct}%
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {tier.features.map((f) => (
          <Tag key={f} style={{
            fontSize: 10,
            lineHeight: '16px',
            background: tier.bg,
            border: 'none',
            color: tier.color,
          }}>
            {f}
          </Tag>
        ))}
      </div>
    </Card>
  );
}

// ── PnL Scenario Simulator ──

function ScenarioSimulator() {
  const [profit, setProfit] = useState(10000);

  const split = useMemo(() => {
    return {
      platform: Math.round(profit * 0.10 * 100) / 100,
      provider: Math.round(profit * 0.15 * 100) / 100,
      copier: Math.round(profit * 0.75 * 100) / 100,
    };
  }, [profit]);

  const marks: Record<number, string> = {
    1000: '$1K',
    5000: '$5K',
    10000: '$10K',
    25000: '$25K',
    50000: '$50K',
  };

  return (
    <Card
      size="small"
      title={
        <Space>
          <PercentageOutlined style={{ color: '#f59e0b' }} />
          <span style={{ color: '#e0e0e0', fontSize: 14 }}>收益模拟</span>
          <Tag color="blue" style={{ fontSize: 10 }}>拖动滑块调整利润</Tag>
        </Space>
      }
      style={{
        background: '#1a1d2e',
        border: '1px solid #2a2d3e',
        borderRadius: 10,
      }}
      styles={{ body: { padding: '16px' } }}
    >
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ color: '#6b7280', fontSize: 12 }}>跟单利润</span>
          <span style={{ color: '#22c55e', fontWeight: 700, fontSize: 16, fontFamily: 'monospace' }}>
            ${profit.toLocaleString()}
          </span>
        </div>
        <Slider
          min={100}
          max={50000}
          step={100}
          value={profit}
          onChange={setProfit}
          marks={marks}
          styles={{
            track: { background: '#22c55e' },
            rail: { background: '#1e2030' },
          }}
        />
      </div>

      {/* Split result bars */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', marginBottom: 6 }}>
          <div style={{ width: `${split.platform / profit * 100}%`, transition: 'width 0.3s' }}>
            <div style={{
              height: 8,
              background: '#3b82f6',
              borderRadius: '4px 0 0 4px',
            }} />
          </div>
          <div style={{ width: `${split.provider / profit * 100}%`, transition: 'width 0.3s' }}>
            <div style={{ height: 8, background: '#f59e0b' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{
              height: 8,
              background: '#22c55e',
              borderRadius: '0 4px 4px 0',
            }} />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#8b949e' }}>
          <Space size={2}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#3b82f6' }} />
            <span>平台 ${split.platform.toLocaleString()}</span>
          </Space>
          <Space size={2}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#f59e0b' }} />
            <span>信号源 ${split.provider.toLocaleString()}</span>
          </Space>
          <Space size={2}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#22c55e' }} />
            <span style={{ color: '#22c55e', fontWeight: 600 }}>你 ${split.copier.toLocaleString()}</span>
          </Space>
        </div>
      </div>

      {/* Detail numbers */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: 12,
      }}>
        <div style={{
          padding: '10px',
          background: '#3b82f610',
          borderRadius: 8,
          border: '1px solid #3b82f633',
          textAlign: 'center',
        }}>
          <div style={{ color: '#3b82f6', fontSize: 11 }}>平台费 (10%)</div>
          <div style={{ color: '#e0e0e0', fontSize: 20, fontWeight: 700, fontFamily: 'monospace' }}>
            ${split.platform.toLocaleString()}
          </div>
        </div>
        <div style={{
          padding: '10px',
          background: '#f59e0b10',
          borderRadius: 8,
          border: '1px solid #f59e0b33',
          textAlign: 'center',
        }}>
          <div style={{ color: '#f59e0b', fontSize: 11 }}>信号源 (15%)</div>
          <div style={{ color: '#e0e0e0', fontSize: 20, fontWeight: 700, fontFamily: 'monospace' }}>
            ${split.provider.toLocaleString()}
          </div>
        </div>
        <div style={{
          padding: '10px',
          background: '#22c55e10',
          borderRadius: 8,
          border: '1px solid #22c55e33',
          textAlign: 'center',
        }}>
          <div style={{ color: '#22c55e', fontSize: 11 }}>你的收益 (75%)</div>
          <div style={{ color: '#e0e0e0', fontSize: 20, fontWeight: 700, fontFamily: 'monospace' }}>
            ${split.copier.toLocaleString()}
          </div>
        </div>
      </div>
    </Card>
  );
}

// ── Provider Fee List ──

function ProviderFeeTable() {
  const [sortKey, setSortKey] = useState<'name' | 'tier' | 'fee'>('fee');

  const sorted = [...SIGNAL_PROVIDERS].sort((a, b) => {
    if (sortKey === 'name') return a.name.localeCompare(b.name);
    if (sortKey === 'tier') return b.tier.localeCompare(a.tier);
    return b.feePct - a.feePct;
  });

  return (
    <Card
      size="small"
      title={
        <Space>
          <UserOutlined style={{ color: '#f59e0b' }} />
          <span style={{ color: '#e0e0e0', fontSize: 14 }}>信号源分润</span>
          <Tag color="gold">统一 15%</Tag>
        </Space>
      }
      style={{
        background: '#1a1d2e',
        border: '1px solid #2a2d3e',
        borderRadius: 10,
      }}
      styles={{ body: { padding: '12px' } }}
    >
      <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 10 }}>
        所有信号源统一采用 15% 利润分成。跟单者保留 75%，平台收取 10%。
      </div>

      {sorted.map((p) => (
        <div
          key={p.id}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px 10px',
            background: '#0d0f1a',
            borderRadius: 6,
            marginBottom: 6,
            border: '1px solid #2a2d3e',
          }}
        >
          <Space size={8}>
            <span style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: '#f59e0b20',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#f59e0b',
              fontSize: 12,
              fontWeight: 600,
            }}>
              {p.name[0]}
            </span>
            <div>
              <div style={{ color: '#e0e0e0', fontSize: 13, fontWeight: 500 }}>{p.name}</div>
              <Tag color={p.tier === 'L3' ? 'gold' : p.tier === 'L2' ? 'blue' : 'green'} style={{ fontSize: 10, lineHeight: '14px' }}>
                {p.tier === 'L3' ? <CrownOutlined /> : p.tier === 'L2' ? <StarOutlined /> : <TrophyOutlined />} {p.tier}
              </Tag>
            </div>
          </Space>
          <div style={{ textAlign: 'right' }}>
            <div style={{
              color: '#f59e0b',
              fontSize: 18,
              fontWeight: 700,
              fontFamily: 'monospace',
            }}>
              {p.feePct}%
            </div>
            <div style={{ fontSize: 10, color: '#6b7280' }}>利润分成</div>
          </div>
        </div>
      ))}
    </Card>
  );
}

// ── Main ProfitSplitVisualizer ──

export default function ProfitSplitVisualizer() {
  const donutData = [
    { label: '平台 10%', pct: 10, color: '#3b82f6' },
    { label: '信号源 15%', pct: 15, color: '#f59e0b' },
    { label: '跟单者 75%', pct: 75, color: '#22c55e' },
  ];

  const barData = [
    { label: '平台', pct: 10, color: '#3b82f6', icon: <BankOutlined /> },
    { label: '信号源', pct: 15, color: '#f59e0b', icon: <UserOutlined /> },
    { label: '跟单者', pct: 75, color: '#22c55e', icon: <TeamOutlined /> },
  ];

  return (
    <div style={{ padding: '0 4px' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        padding: '12px 16px',
        background: 'linear-gradient(135deg, #1a1d2e 0%, #232740 100%)',
        borderRadius: 10,
        border: '1px solid #2a2d3e',
      }}>
        <Space>
          <PercentageOutlined style={{ fontSize: 20, color: '#f59e0b' }} />
          <div>
            <div style={{ color: '#e0e0e0', fontWeight: 600, fontSize: 15 }}>分润结构</div>
            <div style={{ color: '#6b7280', fontSize: 12 }}>
              平台 10% · 信号源 15% · 跟单者 75%
            </div>
          </div>
        </Space>
        <Tooltip title="所有跟单利润按此比例自动分配">
          <InfoCircleOutlined style={{ color: '#6b7280', fontSize: 16 }} />
        </Tooltip>
      </div>

      {/* Donut + Bar */}
      <Card
        size="small"
        style={{
          background: '#1a1d2e',
          border: '1px solid #2a2d3e',
          borderRadius: 10,
          marginBottom: 12,
        }}
        styles={{ body: { padding: '20px' } }}
      >
        <div style={{ maxWidth: 340, margin: '0 auto' }}>
          <DonutRing tiers={donutData} totalLabel="100%" size={240} />
        </div>

        <div style={{ marginTop: 20 }}>
          <SplitBar tiers={barData} height={36} />
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 24,
          marginTop: 14,
          fontSize: 12,
        }}>
          {barData.map((b) => (
            <Space key={b.label} size={4}>
              <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: b.color }} />
              <span style={{ color: '#8b949e' }}>{b.label}</span>
              <span style={{ color: '#e0e0e0', fontWeight: 600 }}>{b.pct}%</span>
            </Space>
          ))}
        </div>
      </Card>

      {/* 3 Tier Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 12,
        marginBottom: 12,
      }}>
        {TIERS.map((t) => (
          <TierCard key={t.key} tier={t} />
        ))}
      </div>

      {/* Scenario Simulator */}
      <div style={{ marginBottom: 12 }}>
        <ScenarioSimulator />
      </div>

      {/* Provider Fee Table */}
      <ProviderFeeTable />

      {/* Formula */}
      <Card
        size="small"
        style={{
          background: '#1a1d2e',
          border: '1px solid #2a2d3e',
          borderRadius: 10,
          marginTop: 12,
        }}
        styles={{ body: { padding: '12px 16px' } }}
      >
        <div style={{ fontSize: 13 }}>
          <div style={{ color: '#6b7280', marginBottom: 8 }}>计算公式</div>
          <code style={{
            display: 'block',
            padding: '10px 14px',
            background: '#0d0f1a',
            borderRadius: 6,
            color: '#22c55e',
            fontSize: 12,
            fontFamily: 'monospace',
            border: '1px solid #2a2d3e',
          }}>
            跟单净利润 × (1 - 10% - 15%) = 你的收益<br />
            平台费 = 净利润 × 10%<br />
            信号源费 = 净利润 × 15%<br />
            你的收益 = 净利润 × 75%
          </code>
        </div>
      </Card>
    </div>
  );
}
