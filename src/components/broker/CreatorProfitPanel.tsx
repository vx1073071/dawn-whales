// ── R139-M03 CreatorProfitPanel — 创作者分润面板 (接线ProfitSplit) ────────
// PM: P1-8, 3h
import { useState, useMemo } from 'react';
import {
  Card, Table, Tag, Space, Statistic, Progress, DatePicker, Empty,
} from 'antd';
import {
  DollarOutlined, UserOutlined, TeamOutlined, BankOutlined,
  RiseOutlined, FallOutlined, TrophyOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

// ═══════════ Types ═══════════

interface CreatorEarning {
  creatorId: string;
  creatorName: string;
  strategyName: string;
  followers: number;
  totalProfit: number;     // total profit generated
  platformFee: number;     // 10% to platform
  creatorFee: number;      // 15% to creator
  followerRetained: number; // 75% to follower
  thisMonthProfit: number;
  thisMonthFee: number;
  totalTrades: number;
  winRate: number;
  rank: number;
}

interface MonthlySettlement {
  month: string;
  totalProfit: number;
  platformCut: number;
  creatorCut: number;
  followerCut: number;
  trades: number;
  activeFollowers: number;
}

// ═══════════ Mock ═══════════

const MOCK_CREATOR_EARNINGS: CreatorEarning[] = [
  { creatorId: 'sp1', creatorName: 'AlphaQuant', strategyName: '多因子+趋势', followers: 3420, totalProfit: 389200, platformFee: 38920, creatorFee: 58380, followerRetained: 291900, thisMonthProfit: 45200, thisMonthFee: 6780, totalTrades: 284, winRate: 64.5, rank: 1 },
  { creatorId: 'sp5', creatorName: 'WhaleTracker', strategyName: '链上鲸鱼追踪', followers: 8900, totalProfit: 534500, platformFee: 53450, creatorFee: 80175, followerRetained: 400875, thisMonthProfit: 89100, thisMonthFee: 13365, totalTrades: 356, winRate: 67.0, rank: 2 },
  { creatorId: 'sp2', creatorName: 'GoldenCross', strategyName: 'MA双均线', followers: 1280, totalProfit: 156800, platformFee: 15680, creatorFee: 23520, followerRetained: 117600, thisMonthProfit: 21200, thisMonthFee: 3180, totalTrades: 198, winRate: 58.2, rank: 3 },
  { creatorId: 'sp3', creatorName: 'ScalperBot', strategyName: '高频剥头皮', followers: 5600, totalProfit: 89400, platformFee: 8940, creatorFee: 13410, followerRetained: 67050, thisMonthProfit: 12300, thisMonthFee: 1845, totalTrades: 420, winRate: 71.3, rank: 4 },
  { creatorId: 'sp4', creatorName: 'TrendRider', strategyName: '趋势跟随+网格', followers: 890, totalProfit: 45600, platformFee: 4560, creatorFee: 6840, followerRetained: 34200, thisMonthProfit: 5600, thisMonthFee: 840, totalTrades: 112, winRate: 52.8, rank: 5 },
];

const MOCK_MONTHLY: MonthlySettlement[] = [
  { month: '2026-06', totalProfit: 173400, platformCut: 17340, creatorCut: 26010, followerCut: 130050, trades: 1452, activeFollowers: 8920 },
  { month: '2026-05', totalProfit: 156200, platformCut: 15620, creatorCut: 23430, followerCut: 117150, trades: 1287, activeFollowers: 8450 },
  { month: '2026-04', totalProfit: 142800, platformCut: 14280, creatorCut: 21420, followerCut: 107100, trades: 1134, activeFollowers: 7890 },
];

// ── Split Bar Visual ──

function SplitBar({ platform, creator, follower }: { platform: number; creator: number; follower: number }) {
  const total = platform + creator + follower;
  if (total === 0) return null;

  return (
    <div>
      <div style={{ height: 20, display: 'flex', borderRadius: 10, overflow: 'hidden', background: '#0d0f1a' }}>
        <Tooltip title={`平台 10%: $${platform.toLocaleString()}`}>
          <div style={{ width: '10%', height: '100%', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#fff' }}>
            10%
          </div>
        </Tooltip>
        <Tooltip title={`创作者 15%: $${creator.toLocaleString()}`}>
          <div style={{ width: '15%', height: '100%', background: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#fff' }}>
            15%
          </div>
        </Tooltip>
        <Tooltip title={`跟单者 75%: $${follower.toLocaleString()}`}>
          <div style={{ width: '75%', height: '100%', background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#fff' }}>
            75%
          </div>
        </Tooltip>
      </div>
    </div>
  );
}

import { Tooltip } from 'antd';

// ── Main CreatorProfitPanel ──

export default function CreatorProfitPanel() {
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-06');
  const monthData = MOCK_MONTHLY.find((m) => m.month === selectedMonth);

  // Total platform earnings
  const totalPlatform = MOCK_CREATOR_EARNINGS.reduce((s, c) => s + c.platformFee, 0);
  const totalCreator = MOCK_CREATOR_EARNINGS.reduce((s, c) => s + c.creatorFee, 0);
  const totalFollower = MOCK_CREATOR_EARNINGS.reduce((s, c) => s + c.followerRetained, 0);

  const columns = [
    {
      title: '排名',
      dataIndex: 'rank',
      key: 'rank',
      width: 50,
      render: (v: number) => (
        <span style={{ fontSize: 16 }}>
          {v === 1 ? '🥇' : v === 2 ? '🥈' : v === 3 ? '🥉' : `#${v}`}
        </span>
      ),
    },
    {
      title: '创作者',
      dataIndex: 'creatorName',
      key: 'name',
      render: (v: string, r: CreatorEarning) => (
        <div>
          <div style={{ color: '#e0e0e0', fontWeight: 500 }}>{v}</div>
          <Tag color="blue" style={{ fontSize: 9 }}>{r.strategyName}</Tag>
        </div>
      ),
    },
    {
      title: '关注者',
      dataIndex: 'followers',
      key: 'followers',
      render: (v: number) => <span style={{ color: '#e0e0e0' }}>{v.toLocaleString()}</span>,
    },
    {
      title: '总利润',
      dataIndex: 'totalProfit',
      key: 'profit',
      render: (v: number) => (
        <span style={{ color: '#22c55e', fontFamily: 'monospace', fontWeight: 600 }}>
          ${v.toLocaleString()}
        </span>
      ),
      sorter: (a: CreatorEarning, b: CreatorEarning) => a.totalProfit - b.totalProfit,
    },
    {
      title: '创作者收益',
      dataIndex: 'totalProfit',
      key: 'creator',
      render: (_: any, r: CreatorEarning) => (
        <div>
          <div style={{ color: '#f59e0b', fontFamily: 'monospace', fontSize: 12 }}>
            ${r.creatorFee.toLocaleString()}
          </div>
          <Progress
            percent={r.winRate}
            size="small"
            showInfo={false}
            strokeColor={r.winRate >= 65 ? '#22c55e' : '#f59e0b'}
            trailColor="#1e2030"
            style={{ width: 60 }}
          />
          <span style={{ fontSize: 9, color: '#8b949e' }}>胜率 {r.winRate}%</span>
        </div>
      ),
    },
    {
      title: '本月',
      key: 'thisMonth',
      render: (_: any, r: CreatorEarning) => (
        <div>
          <div style={{ color: '#22c55e', fontFamily: 'monospace', fontSize: 12 }}>
            +${r.thisMonthProfit.toLocaleString()}
          </div>
          <div style={{ color: '#f59e0b', fontSize: 10 }}>
            分润 ${r.thisMonthFee.toLocaleString()}
          </div>
        </div>
      ),
    },
    {
      title: '分润结构',
      key: 'split',
      render: (_: any, r: CreatorEarning) => (
        <SplitBar
          platform={r.platformFee}
          creator={r.creatorFee}
          follower={r.followerRetained}
        />
      ),
    },
  ];

  return (
    <div style={{ padding: '0 4px' }}>
      {/* KPI */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 10,
        marginBottom: 12,
      }}>
        <Card size="small" styles={{ body: { padding: '12px 14px' } }} style={{ background: '#1a1d2e', border: '1px solid #2a2d3e', borderRadius: 10 }}>
          <Space size={4}><BankOutlined style={{ color: '#3b82f6' }} /><span style={{ color: '#6b7280', fontSize: 11 }}>平台累计收入</span></Space>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#3b82f6', fontFamily: 'monospace', marginTop: 4 }}>
            ${totalPlatform.toLocaleString()}
          </div>
        </Card>
        <Card size="small" styles={{ body: { padding: '12px 14px' } }} style={{ background: '#1a1d2e', border: '1px solid #2a2d3e', borderRadius: 10 }}>
          <Space size={4}><UserOutlined style={{ color: '#f59e0b' }} /><span style={{ color: '#6b7280', fontSize: 11 }}>创作者累计收益</span></Space>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#f59e0b', fontFamily: 'monospace', marginTop: 4 }}>
            ${totalCreator.toLocaleString()}
          </div>
        </Card>
        <Card size="small" styles={{ body: { padding: '12px 14px' } }} style={{ background: '#1a1d2e', border: '1px solid #2a2d3e', borderRadius: 10 }}>
          <Space size={4}><TeamOutlined style={{ color: '#22c55e' }} /><span style={{ color: '#6b7280', fontSize: 11 }}>跟单者保留收益</span></Space>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#22c55e', fontFamily: 'monospace', marginTop: 4 }}>
            ${totalFollower.toLocaleString()}
          </div>
        </Card>
        <Card size="small" styles={{ body: { padding: '12px 14px' } }} style={{ background: '#1a1d2e', border: '1px solid #2a2d3e', borderRadius: 10 }}>
          <Space size={4}><TrophyOutlined style={{ color: '#a78bfa' }} /><span style={{ color: '#6b7280', fontSize: 11 }}>活跃创作者</span></Space>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#e0e0e0', fontFamily: 'monospace', marginTop: 4 }}>
            {MOCK_CREATOR_EARNINGS.length}
          </div>
        </Card>
      </div>

      {/* Monthly settlement */}
      <Card
        size="small"
        title={<Space><DollarOutlined style={{ color: '#22c55e' }} /><span style={{ color: '#e0e0e0', fontSize: 14 }}>月度结算</span></Space>}
        style={{ background: '#1a1d2e', border: '1px solid #2a2d3e', borderRadius: 10, marginBottom: 12 }}
        styles={{ body: { padding: '14px' } }}
      >
        {monthData && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ color: '#e0e0e0' }}>{monthData.month}</span>
              <Tag color="green">已结算</Tag>
            </div>
            <SplitBar platform={monthData.platformCut} creator={monthData.creatorCut} follower={monthData.followerCut} />
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 8,
              marginTop: 10,
              fontSize: 11,
            }}>
              <div><span style={{ color: '#6b7280' }}>交易量</span> <span style={{ color: '#e0e0e0', fontWeight: 600 }}>{monthData.trades}</span></div>
              <div><span style={{ color: '#6b7280' }}>活跃跟单者</span> <span style={{ color: '#e0e0e0', fontWeight: 600 }}>{monthData.activeFollowers.toLocaleString()}</span></div>
              <div><span style={{ color: '#6b7280' }}>总利润</span> <span style={{ color: '#22c55e', fontWeight: 600 }}>${monthData.totalProfit.toLocaleString()}</span></div>
            </div>
          </div>
        )}
      </Card>

      {/* Creator earnings table */}
      <Card
        size="small"
        title={<Space><UserOutlined style={{ color: '#f59e0b' }} /><span style={{ color: '#e0e0e0', fontSize: 14 }}>创作者收益排名</span></Space>}
        style={{ background: '#1a1d2e', border: '1px solid #2a2d3e', borderRadius: 10 }}
        styles={{ body: { padding: '8px' } }}
      >
        <Table
          dataSource={MOCK_CREATOR_EARNINGS}
          columns={columns}
          rowKey="creatorId"
          size="small"
          pagination={false}
          rowClassName={() => 'dark-table-row'}
          locale={{ emptyText: <Empty description="暂无数据" /> }}
        />
      </Card>
    </div>
  );
}
