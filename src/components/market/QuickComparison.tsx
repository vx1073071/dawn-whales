// @ts-nocheck
// QUANT MOO — 一键对比前端 (One-Click Comparison)
// R259 ML#2 P1-07 — 股票/策略/因子头对头PK界面 (8h)

import React, { useState, useMemo } from 'react';
import {
  Card, Row, Col, Space, Typography, Tag, Button, Select,
  Table, Progress, Divider, Segmented, Tooltip, Statistic,
  Empty, Input, message
} from 'antd';
import {
  SwapOutlined, CaretUpOutlined, CaretDownOutlined,
  PlusOutlined, DeleteOutlined, StarOutlined, StarFilled,
  ThunderboltOutlined, LineChartOutlined, FundOutlined,
  DollarOutlined, SafetyOutlined, RobotOutlined,
  ArrowRightOutlined, TrophyOutlined, MinusOutlined,
  CheckCircleOutlined, CopyOutlined, SettingOutlined
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

// ── Types ──
interface CompareItem {
  id: string;
  symbol: string;
  name: string;
  market: string;
  price: number;
  changePct: number;
  marketCap: number;
  pe: number;
  eps: number;
  revenue: number;
  revGrowth: number;
  roe: number;
  dividendYield: number;
  beta: number;
  score: number; // overall score 0-100
}

interface CompareDimension {
  key: string;
  label: string;
  icon: React.ReactNode;
  format: (v: number) => string;
  higher: 'better' | 'worse' | 'neutral';
}

// ── Mock Data ──
const mockStocks: CompareItem[] = [
  { id: 'nvda', symbol: 'NVDA', name: 'NVIDIA', market: 'US', price: 148.35, changePct: 8.52, marketCap: 3650, pe: 72.4, eps: 2.05, revenue: 32.5, revGrowth: 112, roe: 128, dividendYield: 0.02, beta: 1.68, score: 85 },
  { id: 'amd', symbol: 'AMD', name: 'AMD', market: 'US', price: 185.60, changePct: 3.20, marketCap: 300, pe: 48.2, eps: 3.85, revenue: 6.8, revGrowth: 18, roe: 22, dividendYield: 0, beta: 1.52, score: 68 },
  { id: 'tsm', symbol: 'TSM', name: '台积电', market: 'US', price: 185.20, changePct: 1.80, marketCap: 960, pe: 22.5, eps: 8.23, revenue: 22.8, revGrowth: 35, roe: 32, dividendYield: 1.8, beta: 0.95, score: 78 },
  { id: '0700', symbol: '0700', name: '腾讯', market: 'HK', price: 485.60, changePct: 4.32, marketCap: 580, pe: 18.5, eps: 26.25, revenue: 82.5, revGrowth: 12, roe: 24, dividendYield: 0.5, beta: 1.15, score: 72 },
  { id: 'msft', symbol: 'MSFT', name: 'Microsoft', market: 'US', price: 468.50, changePct: 1.20, marketCap: 3480, pe: 36.8, eps: 12.72, revenue: 62.0, revGrowth: 16, roe: 45, dividendYield: 0.8, beta: 0.89, score: 82 },
  { id: 'googl', symbol: 'GOOGL', name: 'Google', market: 'US', price: 198.30, changePct: 0.80, marketCap: 2450, pe: 28.5, eps: 6.96, revenue: 85.0, revGrowth: 14, roe: 32, dividendYield: 0.4, beta: 1.05, score: 76 },
];

const dimensions: CompareDimension[] = [
  { key: 'changePct', label: '今日涨跌', icon: <LineChartOutlined />, format: v => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`, higher: 'better' },
  { key: 'marketCap', label: '市值(B)', icon: <DollarOutlined />, format: v => `$${v.toFixed(0)}B`, higher: 'neutral' },
  { key: 'pe', label: 'PE', icon: <FundOutlined />, format: v => `${v.toFixed(1)}x`, higher: 'worse' },
  { key: 'eps', label: 'EPS', icon: <DollarOutlined />, format: v => `$${v.toFixed(2)}`, higher: 'better' },
  { key: 'revenue', label: '营收(B)', icon: <DollarOutlined />, format: v => `$${v.toFixed(1)}B`, higher: 'neutral' },
  { key: 'revGrowth', label: '营收增长', icon: <CaretUpOutlined />, format: v => `${v >= 0 ? '+' : ''}${v.toFixed(0)}%`, higher: 'better' },
  { key: 'roe', label: 'ROE', icon: <StarOutlined />, format: v => `${v.toFixed(0)}%`, higher: 'better' },
  { key: 'dividendYield', label: '股息率', icon: <DollarOutlined />, format: v => `${v.toFixed(2)}%`, higher: 'better' },
  { key: 'beta', label: 'Beta', icon: <SafetyOutlined />, format: v => v.toFixed(2), higher: 'worse' },
];

// ── Comparison Table ──
const ComparisonTable: React.FC<{
  items: CompareItem[];
  dims: CompareDimension[];
}> = ({ items, dims }) => {
  if (items.length < 2) return <Empty description="请选择至少2只股票进行对比" />;

  return (
    <Table
      dataSource={dimS}
      rowKey="key"
      size="small"
      pagination={false}
      columns={[
        {
          title: '维度', key: 'dim', width: 120, render: (_: any, d: CompareDimension) => (
            <Space size={4}>
              {d.icon}
              <Text style={{ fontSize: 12 }}>{d.label}</Text>
            </Space>
          )
        },
        ...items.map((item, idx) => ({
          title: (
            <Space size={2} direction="vertical" style={{ lineHeight: 1.1 }}>
              <Space size={4}>
                <Text strong style={{ fontSize: 13 }}>{item.symbol}</Text>
                <Tag style={{ fontSize: 9 }}>{item.market}</Tag>
              </Space>
              <Text type="secondary" style={{ fontSize: 9 }}>{item.name}</Text>
            </Space>
          ),
          key: item.id,
          width: 130,
          render: (_: any, d: CompareDimension) => {
            const val = (item as any)[d.key] as number;
            const allVals = items.map(i => (i as any)[d.key] as number);
            const isBest = d.higher === 'better' ? val === Math.max(...allVals) : d.higher === 'worse' ? val === Math.min(...allVals) : false;
            const isWorst = d.higher === 'better' ? val === Math.min(...allVals) : d.higher === 'worse' ? val === Math.max(...allVals) : false;
            return (
              <div style={{ position: 'relative', padding: '4px 0' }}>
                {isBest && items.length > 2 && (
                  <TrophyOutlined style={{ position: 'absolute', top: -2, right: -2, color: '#faad14', fontSize: 10 }} />
                )}
                <Text
                  strong
                  style={{
                    fontSize: 12, fontFamily: 'monospace',
                    color: isBest ? '#52c41a' : isWorst ? '#ff4d4f' : undefined,
                  }}>
                  {d.format(val)}
                </Text>
              </div>
            );
          },
        })),
      ]}
    />
  );
};

// ── Head-to-Head Card ──
const HeadToHead: React.FC<{ a: CompareItem; b: CompareItem }> = ({ a, b }) => {
  const aWins = dimensions.filter(d => {
    const av = (a as any)[d.key]; const bv = (b as any)[d.key];
    return d.higher === 'better' ? av > bv : d.higher === 'worse' ? av < bv : false;
  }).length;
  const bWins = dimensions.length - aWins;

  return (
    <Card size="small" style={{ marginBottom: 12, textAlign: 'center' }}>
      <Row align="middle">
        <Col span={10}>
          <Space direction="vertical" size={2}>
            <Text strong style={{ fontSize: 16 }}>{a.symbol}</Text>
            <Text type="secondary" style={{ fontSize: 10 }}>{a.name}</Text>
            <Text type={a.changePct >= 0 ? 'success' : 'danger'} strong>
              {a.changePct >= 0 ? '+' : ''}{a.changePct}%
            </Text>
          </Space>
        </Col>
        <Col span={4}>
          <Space direction="vertical" size={4}>
            <Text style={{ fontSize: 24, fontWeight: 'bold' }}>{aWins} : {bWins}</Text>
            <Tag color={aWins > bWins ? 'green' : aWins < bWins ? 'red' : 'default'}>
              {aWins > bWins ? `${a.symbol}胜` : aWins < bWins ? `${b.symbol}胜` : '平局'}
            </Tag>
          </Space>
        </Col>
        <Col span={10}>
          <Space direction="vertical" size={2}>
            <Text strong style={{ fontSize: 16 }}>{b.symbol}</Text>
            <Text type="secondary" style={{ fontSize: 10 }}>{b.name}</Text>
            <Text type={b.changePct >= 0 ? 'success' : 'danger'} strong>
              {b.changePct >= 0 ? '+' : ''}{b.changePct}%
            </Text>
          </Space>
        </Col>
      </Row>
    </Card>
  );
};

// ── Score Radar Summary ──
const ScoreSummary: React.FC<{ items: CompareItem[] }> = ({ items }) => (
  <Row gutter={[8, 8]} style={{ marginBottom: 12 }}>
    {items.map(item => (
      <Col xs={12} sm={6} key={item.id}>
        <Card size="small" bodyStyle={{ padding: '8px 10px', textAlign: 'center' }}>
          <Text strong>{item.symbol}</Text>
          <Progress
            type="circle"
            percent={item.score}
            size={60}
            strokeColor={item.score >= 80 ? '#52c41a' : item.score >= 60 ? '#1677ff' : '#fa8c16'}
            format={p => `${p}`}
          />
          <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>综合评分</Text>
        </Card>
      </Col>
    ))}
  </Row>
);

// ── Main Component ──
const QuickComparison: React.FC = () => {
  const [selected, setSelected] = useState<string[]>(['nvda', 'tsm']);
  const [compareMode, setCompareMode] = useState<'stocks' | 'strategies' | 'factors'>('stocks');

  const comparedItems = useMemo(() =>
    mockStocks.filter(s => selected.includes(s.id)),
    [selected]
  );

  const toggleStock = (id: string) => {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 4) { message.warning('最多对比4只'); return prev; }
      return [...prev, id];
    });
  };

  const addA = comparedItems[0]; const addB = comparedItems[1];

  return (
    <div style={{ padding: 16, maxWidth: 1400, margin: '0 auto' }}>
      <Space style={{ marginBottom: 12 }}>
        <SwapOutlined style={{ fontSize: 24, color: '#722ed1' }} />
        <Title level={3} style={{ margin: 0 }}>一键对比</Title>
      </Space>

      {/* Mode + Selection */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space size={12} style={{ width: '100%' }} direction="vertical">
          <Segmented value={compareMode} onChange={v => setCompareMode(v as any)}
            options={[
              { label: '📈 股票', value: 'stocks' },
              { label: '🧬 策略', value: 'strategies' },
              { label: '📊 因子', value: 'factors' },
            ]} />

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {mockStocks.map(s => (
              <Tag.CheckableTag
                key={s.id}
                checked={selected.includes(s.id)}
                onChange={() => toggleStock(s.id)}
                style={{
                  padding: '4px 12px', border: '1px solid #d9d9d9', borderRadius: 6,
                  background: selected.includes(s.id) ? '#e6f7ff' : undefined,
                }}
              >
                <Space size={2}>
                  <Text strong>{s.symbol}</Text>
                  <Text type="secondary" style={{ fontSize: 10 }}>{s.name}</Text>
                </Space>
              </Tag.CheckableTag>
            ))}
          </div>
        </Space>
      </Card>

      {comparedItems.length < 2 ? (
        <Empty description="选择至少2只股票开始对比" />
      ) : (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          {/* Head to head (if exactly 2) */}
          {comparedItems.length === 2 && <HeadToHead a={comparedItems[0]} b={comparedItems[1]} />}

          {/* Score summary */}
          <ScoreSummary items={comparedItems} />

          {/* Full comparison table */}
          <Card size="small" title="📊 详细对比">
            <ComparisonTable items={comparedItems} dims={dimensions} />
          </Card>

          {/* AI recommendation */}
          <Card size="small" style={{ background: '#f6ffed', border: '1px solid #b7eb8f' }}>
            <Space>
              <RobotOutlined style={{ color: '#52c41a' }} />
              <div>
                <Text strong>AI 对比总结</Text>
                <Paragraph style={{ fontSize: 12, margin: '4px 0 0' }}>
                  综合评分: {comparedItems.sort((a, b) => b.score - a.score).map((i, idx) => (
                    <span key={i.id}>{i.symbol}({i.score}分{idx === 0 ? '🥇' : idx === 1 ? '🥈' : ''}) </span>
                  ))}
                  · NVDA在增长动能(ROE 128%, 营收+112%)维度全面领先，但PE 72.4x显著偏高 · 
                  TSM估值合理(PE 22.5x)适合价值配置 · 建议NVDA+TSM组合持有
                </Paragraph>
                <Button size="small" type="link" icon={<ArrowRightOutlined />}>
                  生成AI对比报告 (1.5U)
                </Button>
              </div>
            </Space>
          </Card>
        </Space>
      )}
    </div>
  );
};

export default QuickComparison;
