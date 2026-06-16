// @ts-nocheck
// QUANT MOO — 市场热力图 (Market Heat Map)
// R254 ML#1 UI-02 — 板块热度可视化 (8h)

import React, { useState, useMemo } from 'react';
import {
  Card, Tabs, Tag, Tooltip, Segmented, Select, Space, Typography,
  Row, Col, Statistic, Divider, Switch, Button, Table, Progress, Badge
} from 'antd';
import {
  FireOutlined, RiseOutlined, FallOutlined, StockOutlined,
  ThunderboltOutlined, ReloadOutlined, GlobalOutlined,
  FundOutlined, EyeOutlined, AppstoreOutlined, TableOutlined,
  CaretUpOutlined, CaretDownOutlined, MinusOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

// ── Types ──
interface HeatCell {
  id: string;
  symbol: string;
  name: string;
  sector: string;
  market: 'us' | 'hk' | 'cn' | 'jp' | 'crypto';
  price: number;
  changePct: number;
  volume: number;
  marketCap: number;
  heatScore: number; // 0-100
  trend: 'up' | 'down' | 'flat';
}

interface SectorHeatBlock {
  sector: string;
  sectorCN: string;
  avgChangePct: number;
  totalVolume: number;
  marketCap: number;
  stockCount: number;
  upCount: number;
  downCount: number;
  heatScore: number;
  topPerformer: string;
  topPerformerPct: number;
}

interface HeatConfig {
  mode: 'absolute' | 'relative';
  metric: 'price_change' | 'volume' | 'heat_score';
  period: '1d' | '1w' | '1m';
}

// ── Mock Data ──
const mockCells: HeatCell[] = [
  // Semiconductors
  { id: 'nvda', symbol: 'NVDA', name: 'NVIDIA', sector: 'semiconductor', market: 'us', price: 148.35, changePct: 8.5, volume: 82.3, marketCap: 3650, heatScore: 95, trend: 'up' },
  { id: 'amd', symbol: 'AMD', name: 'AMD', sector: 'semiconductor', market: 'us', price: 185.60, changePct: 3.2, volume: 45.1, marketCap: 300, heatScore: 82, trend: 'up' },
  { id: 'smci', symbol: 'SMCI', name: 'Super Micro', sector: 'semiconductor', market: 'us', price: 892.00, changePct: 12.1, volume: 41.5, marketCap: 52, heatScore: 88, trend: 'up' },
  { id: 'tsm', symbol: 'TSM', name: '台积电', sector: 'semiconductor', market: 'us', price: 185.20, changePct: 1.8, volume: 12.3, marketCap: 960, heatScore: 75, trend: 'up' },
  { id: 'arm', symbol: 'ARM', name: 'ARM Holdings', sector: 'semiconductor', market: 'us', price: 162.40, changePct: 2.5, volume: 8.2, marketCap: 170, heatScore: 70, trend: 'up' },

  // AI/Cloud
  { id: 'msft', symbol: 'MSFT', name: 'Microsoft', sector: 'ai_cloud', market: 'us', price: 468.50, changePct: 1.2, volume: 28.7, marketCap: 3480, heatScore: 72, trend: 'up' },
  { id: 'googl', symbol: 'GOOGL', name: 'Google', sector: 'ai_cloud', market: 'us', price: 198.30, changePct: 0.8, volume: 22.1, marketCap: 2450, heatScore: 68, trend: 'up' },
  { id: 'amzn', symbol: 'AMZN', name: 'Amazon', sector: 'ai_cloud', market: 'us', price: 225.80, changePct: 0.5, volume: 35.2, marketCap: 2350, heatScore: 65, trend: 'up' },
  { id: '0700', symbol: '0700', name: '腾讯', sector: 'ai_cloud', market: 'hk', price: 485.60, changePct: 4.3, volume: 28.7, marketCap: 580, heatScore: 78, trend: 'up' },

  // Crypto
  { id: 'btc', symbol: 'BTC', name: 'Bitcoin', sector: 'crypto', market: 'crypto', price: 98450, changePct: 1.3, volume: 28.5, marketCap: 1940, heatScore: 85, trend: 'up' },
  { id: 'eth', symbol: 'ETH', name: 'Ethereum', sector: 'crypto', market: 'crypto', price: 4520, changePct: 2.1, volume: 15.8, marketCap: 545, heatScore: 78, trend: 'up' },
  { id: 'coin', symbol: 'COIN', name: 'Coinbase', sector: 'crypto', market: 'us', price: 342.00, changePct: 4.5, volume: 18.2, marketCap: 85, heatScore: 80, trend: 'up' },
  { id: 'mstr', symbol: 'MSTR', name: 'MicroStrategy', sector: 'crypto', market: 'us', price: 1850.00, changePct: -1.2, volume: 5.3, marketCap: 42, heatScore: 55, trend: 'down' },

  // Energy
  { id: 'xom', symbol: 'XOM', name: 'Exxon', sector: 'energy', market: 'us', price: 118.20, changePct: -1.2, volume: 15.6, marketCap: 525, heatScore: 32, trend: 'down' },
  { id: 'cvx', symbol: 'CVX', name: 'Chevron', sector: 'energy', market: 'us', price: 165.40, changePct: -0.8, volume: 8.9, marketCap: 310, heatScore: 35, trend: 'down' },

  // Real Estate
  { id: 'pld', symbol: 'PLD', name: 'Prologis', sector: 'realestate', market: 'us', price: 112.30, changePct: -1.5, volume: 6.2, marketCap: 104, heatScore: 28, trend: 'down' },

  // Consumer
  { id: 'tsla', symbol: 'TSLA', name: 'Tesla', sector: 'consumer', market: 'us', price: 342.80, changePct: -6.2, volume: 65.1, marketCap: 1090, heatScore: 45, trend: 'down' },
  { id: '9988', symbol: '9988', name: '阿里巴巴', sector: 'consumer', market: 'hk', price: 112.30, changePct: -3.1, volume: 35.2, marketCap: 280, heatScore: 40, trend: 'down' },
  { id: 'jd', symbol: 'JD', name: '京东', sector: 'consumer', market: 'us', price: 42.50, changePct: -0.5, volume: 12.1, marketCap: 68, heatScore: 42, trend: 'flat' },
];

const sectorMap: Record<string, SectorHeatBlock> = {
  semiconductor: {
    sector: 'semiconductor', sectorCN: '半导体', avgChangePct: 6.4, totalVolume: 189.4,
    marketCap: 5132, stockCount: 5, upCount: 5, downCount: 0, heatScore: 82, topPerformer: 'SMCI', topPerformerPct: 12.1
  },
  ai_cloud: {
    sector: 'ai_cloud', sectorCN: 'AI/云计算', avgChangePct: 1.7, totalVolume: 114.7,
    marketCap: 8860, stockCount: 4, upCount: 4, downCount: 0, heatScore: 71, topPerformer: '0700', topPerformerPct: 4.3
  },
  crypto: {
    sector: 'crypto', sectorCN: '加密货币', avgChangePct: 1.68, totalVolume: 67.8,
    marketCap: 2612, stockCount: 4, upCount: 3, downCount: 1, heatScore: 75, topPerformer: 'COIN', topPerformerPct: 4.5
  },
  energy: {
    sector: 'energy', sectorCN: '能源', avgChangePct: -1.0, totalVolume: 24.5,
    marketCap: 835, stockCount: 2, upCount: 0, downCount: 2, heatScore: 34, topPerformer: 'CVX', topPerformerPct: -0.8
  },
  realestate: {
    sector: 'realestate', sectorCN: '房地产', avgChangePct: -1.5, totalVolume: 6.2,
    marketCap: 104, stockCount: 1, upCount: 0, downCount: 1, heatScore: 28, topPerformer: 'PLD', topPerformerPct: -1.5
  },
  consumer: {
    sector: 'consumer', sectorCN: '消费', avgChangePct: -3.27, totalVolume: 112.4,
    marketCap: 1438, stockCount: 3, upCount: 0, downCount: 2, heatScore: 42, topPerformer: 'JD', topPerformerPct: -0.5
  },
};

// ── Heat Cell Color Helpers ──
const getHeatColor = (score: number, trend: 'up' | 'down' | 'flat'): string => {
  if (trend === 'up') {
    if (score >= 90) return '#237804';
    if (score >= 80) return '#389e0d';
    if (score >= 70) return '#52c41a';
    if (score >= 60) return '#73d13d';
    return '#b7eb8f';
  }
  if (trend === 'down') {
    if (score >= 80) return '#a8071a';
    if (score >= 60) return '#cf1322';
    if (score >= 40) return '#ff4d4f';
    return '#ffa39e';
  }
  return '#d9d9d9';
};

const getSectorBgColor = (avgPct: number): string => {
  if (avgPct >= 5) return '#d9f7be';
  if (avgPct >= 1) return '#f6ffed';
  if (avgPct >= 0) return '#fafafa';
  if (avgPct >= -1) return '#fff2f0';
  if (avgPct >= -3) return '#ffd8d2';
  return '#ffbbb0';
};

const formatMarketCap = (b: number): string => b >= 1000 ? `$${(b / 1000).toFixed(1)}T` : `$${b}B`;

// ── Sector Heat Map (Grid View) ──
const SectorHeatGrid: React.FC<{ cells: HeatCell[] }> = ({ cells }) => {
  const sectors = useMemo(() => {
    const map = new Map<string, HeatCell[]>();
    for (const c of cells) {
      if (!map.has(c.sector)) map.set(c.sector, []);
      map.get(c.sector)!.push(c);
    }
    return Array.from(map.entries()).sort((a, b) => {
      const aAvg = a[1].reduce((s, c) => s + c.changePct, 0) / a[1].length;
      const bAvg = b[1].reduce((s, c) => s + c.changePct, 0) / b[1].length;
      return bAvg - aAvg;
    });
  }, [cells]);

  return (
    <Row gutter={[8, 8]}>
      {sectors.map(([sector, stocks]) => {
        const info = sectorMap[sector];
        const avgPct = info?.avgChangePct || stocks.reduce((s, c) => s + c.changePct, 0) / stocks.length;
        const upCount = stocks.filter(s => s.changePct >= 0).length;
        return (
          <Col xs={24} sm={12} md={8} lg={6} key={sector}>
            <Card
              size="small"
              style={{ background: getSectorBgColor(avgPct), border: '1px solid #e8e8e8' }}
              bodyStyle={{ padding: 12 }}
            >
              {/* Sector Header */}
              <div style={{ marginBottom: 8 }}>
                <Space>
                  <Text strong>{info?.sectorCN || sector}</Text>
                  <Tag color={avgPct >= 0 ? 'green' : 'red'}>{avgPct >= 0 ? '+' : ''}{avgPct.toFixed(1)}%</Tag>
                </Space>
                <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                  {stocks.length}只 · {upCount}涨/{stocks.length - upCount}跌
                  {info?.totalVolume > 0 && <> · 量{info.totalVolume.toFixed(1)}B</>}
                </div>
              </div>

              {/* Heat blocks */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {stocks.sort((a, b) => b.heatScore - a.heatScore).map(s => (
                  <Tooltip key={s.id} title={
                    <div style={{ fontSize: 12 }}>
                      <div><strong>{s.symbol}</strong> {s.name}</div>
                      <div>${s.price.toLocaleString()} | {s.changePct >= 0 ? '+' : ''}{s.changePct}%</div>
                      <div>热度: {s.heatScore}/100 | 量: {s.volume}B</div>
                      <div>市值: {formatMarketCap(s.marketCap)}</div>
                    </div>
                  }>
                    <div style={{
                      width: 'calc(25% - 3px)',
                      aspectRatio: '1',
                      background: getHeatColor(s.heatScore, s.trend),
                      borderRadius: 4,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      flexDirection: 'column',
                      transition: 'transform 0.2s',
                    }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform = 'scale(1.1)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = 'scale(1)'}
                    >
                      <span style={{ color: '#fff', fontSize: 10, fontWeight: 'bold', lineHeight: 1.1 }}>{s.symbol}</span>
                      <span style={{ color: '#fff', fontSize: 9, lineHeight: 1.1 }}>
                        {s.changePct >= 0 ? '+' : ''}{s.changePct}%
                      </span>
                    </div>
                  </Tooltip>
                ))}
              </div>

              {info?.topPerformer && (
                <div style={{ fontSize: 11, color: '#666', marginTop: 6, textAlign: 'right' }}>
                  <CaretUpOutlined style={{ color: '#52c41a' }} /> {info.topPerformer} {info.topPerformerPct > 0 ? '+' : ''}{info.topPerformerPct}%
                </div>
              )}
            </Card>
          </Col>
        );
      })}
    </Row>
  );
};

// ── Table View ──
const HeatTableView: React.FC<{ cells: HeatCell[] }> = ({ cells }) => {
  const sorted = [...cells].sort((a, b) => b.heatScore - a.heatScore);
  return (
    <Table
      dataSource={sorted}
      rowKey="id"
      size="small"
      pagination={false}
      columns={[
        {
          title: '股票', key: 'name', width: 180, render: (_: any, r: HeatCell) => (
            <Space size={4}>
              <div style={{
                width: 10, height: 10, borderRadius: 2, background: getHeatColor(r.heatScore, r.trend),
              }} />
              <Text strong>{r.symbol}</Text>
              <Text type="secondary" style={{ fontSize: 11 }}>{r.name}</Text>
            </Space>
          )
        },
        {
          title: '板块', dataIndex: 'sector', key: 'sector', width: 80,
          render: (s: string) => <Tag>{sectorMap[s]?.sectorCN || s}</Tag>
        },
        {
          title: '价格', key: 'price', width: 80, render: (_: any, r: HeatCell) => (
            <Text>${r.price.toLocaleString()}</Text>
          )
        },
        {
          title: '涨跌', key: 'change', width: 80, render: (_: any, r: HeatCell) => (
            <Text type={r.changePct >= 0 ? 'success' : 'danger'} strong>
              {r.changePct >= 0 ? <CaretUpOutlined /> : <CaretDownOutlined />}
              {r.changePct >= 0 ? '+' : ''}{r.changePct}%
            </Text>
          )
        },
        {
          title: '热度', key: 'heat', width: 120, render: (_: any, r: HeatCell) => (
            <Space size={4}>
              <Progress percent={r.heatScore} size="small" showInfo={false}
                strokeColor={getHeatColor(r.heatScore, r.trend)} style={{ width: 60, margin: 0 }} />
              <Text style={{ fontSize: 11 }}>{r.heatScore}</Text>
            </Space>
          )
        },
        {
          title: '成交量', key: 'volume', width: 70, render: (_: any, r: HeatCell) => (
            <Text style={{ fontSize: 11 }}>{r.volume}B</Text>
          )
        },
        {
          title: '市值', key: 'mcap', width: 70, render: (_: any, r: HeatCell) => (
            <Text style={{ fontSize: 11 }}>{formatMarketCap(r.marketCap)}</Text>
          )
        },
      ]}
    />
  );
};

// ── Sector Summary ──
const SectorSummary: React.FC = () => (
  <Row gutter={[8, 8]} style={{ marginBottom: 16 }}>
    {Object.values(sectorMap).map(s => (
      <Col xs={12} sm={8} md={4} key={s.sector}>
        <Card size="small" bodyStyle={{ padding: '8px 12px' }}>
          <Space direction="vertical" size={0} style={{ width: '100%' }}>
            <Space>
              <Text>{s.sectorCN}</Text>
              <Text type={s.avgChangePct >= 0 ? 'success' : 'danger'} strong style={{ fontSize: 13 }}>
                {s.avgChangePct >= 0 ? '+' : ''}{s.avgChangePct}%
              </Text>
            </Space>
            <div style={{ height: 4, background: '#f0f0f0', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
              <div style={{
                width: `${Math.min(100, Math.abs(s.avgChangePct) * 8)}%`,
                height: '100%',
                background: s.avgChangePct >= 0 ? '#52c41a' : '#ff4d4f',
                borderRadius: 2,
              }} />
            </div>
            <Text type="secondary" style={{ fontSize: 10 }}>
              {s.upCount}↑{s.downCount}↓ · 量{s.totalVolume.toFixed(1)}B
            </Text>
          </Space>
        </Card>
      </Col>
    ))}
  </Row>
);

// ── Legend ──
const HeatLegend: React.FC = () => (
  <div style={{ marginBottom: 12, padding: '4px 8px', background: '#fafafa', borderRadius: 4 }}>
    <Space size={8}>
      <Text type="secondary" style={{ fontSize: 11 }}>热度:</Text>
      {[{ label: '极热', color: '#237804' }, { label: '热', color: '#52c41a' }, { label: '温', color: '#b7eb8f' },
        { label: '凉', color: '#fafafa' }, { label: '冷', color: '#ffa39e' }, { label: '极冷', color: '#a8071a' }]
        .map(h => (
          <Space key={h.label} size={2}>
            <div style={{ width: 12, height: 12, borderRadius: 2, background: h.color }} />
            <Text style={{ fontSize: 10 }}>{h.label}</Text>
          </Space>
        ))}
    </Space>
  </div>
);

// ── Main Component ──
const MarketHeatMap: React.FC = () => {
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [selectedMarket, setSelectedMarket] = useState('all');
  const [metric, setMetric] = useState<'price_change' | 'volume' | 'heat_score'>('heat_score');
  const [period, setPeriod] = useState<'1d' | '1w' | '1m'>('1d');

  const filteredCells = useMemo(() => {
    let filtered = mockCells;
    if (selectedMarket !== 'all') {
      filtered = filtered.filter(c => c.market === selectedMarket);
    }
    return filtered;
  }, [selectedMarket]);

  return (
    <div style={{ padding: 16, maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Space>
          <FireOutlined style={{ fontSize: 24, color: '#ff4d4f' }} />
          <Title level={3} style={{ margin: 0 }}>市场热力图</Title>
        </Space>
        <Space>
          <Select size="small" value={selectedMarket} onChange={setSelectedMarket} style={{ width: 90 }}
            options={[
              { label: '全部', value: 'all' }, { label: '美股', value: 'us' },
              { label: '港股', value: 'hk' }, { label: 'A股', value: 'cn' },
              { label: '日股', value: 'jp' }, { label: '加密', value: 'crypto' }
            ]} />
          <Select size="small" value={metric} onChange={setMetric} style={{ width: 80 }}
            options={[
              { label: '涨跌', value: 'price_change' }, { label: '量比', value: 'volume' }, { label: '热度', value: 'heat_score' }
            ]} />
          <Segmented size="small" value={period} onChange={setPeriod}
            options={[{ label: '1日', value: '1d' }, { label: '1周', value: '1w' }, { label: '1月', value: '1m' }]} />
          <Segmented size="small" value={viewMode} onChange={v => setViewMode(v as any)}
            options={[
              { label: <AppstoreOutlined />, value: 'grid' },
              { label: <TableOutlined />, value: 'table' },
            ]} />
        </Space>
      </div>

      <HeatLegend />
      <SectorSummary />
      <Divider style={{ margin: '8px 0' }} />

      {viewMode === 'grid'
        ? <SectorHeatGrid cells={filteredCells} />
        : <HeatTableView cells={filteredCells} />}
    </div>
  );
};

export default MarketHeatMap;
