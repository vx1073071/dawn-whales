// @ts-nocheck
// QUANT MOO — 自选+异动面板 (Watchlist + Movers Dashboard)
// R254 ML#2 UI-03 — 自选列表+实时异动监控 (6h)

import React, { useState, useMemo } from 'react';
import {
  Card, Tabs, Table, Tag, Space, Typography, Input, Button,
  Select, Switch, Badge, Progress, Tooltip, Segmented, Divider,
  Row, Col, Statistic, Dropdown, message, Checkbox, Modal
} from 'antd';
import {
  StarOutlined, StarFilled, ThunderboltOutlined, FireOutlined,
  RiseOutlined, FallOutlined, PlusOutlined, DeleteOutlined,
  SearchOutlined, SettingOutlined, CaretUpOutlined, CaretDownOutlined,
  BellOutlined, BellFilled, SwapOutlined, WarningOutlined,
  CheckCircleOutlined, CloseCircleOutlined, MinusOutlined,
  DragOutlined, EyeOutlined, ReloadOutlined
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

// ── Types ──
interface WatchlistItem {
  id: string;
  symbol: string;
  name: string;
  market: 'us' | 'hk' | 'cn' | 'jp' | 'crypto';
  price: number;
  changePct: number;
  volume: number;
  starred: boolean;
  alertEnabled: boolean;
  alertThresholdUp?: number;
  alertThresholdDown?: number;
  lastUpdate: number;
}

interface MoverItem {
  id: string;
  symbol: string;
  name: string;
  market: string;
  price: number;
  changePct: number;
  volume: number;
  reason: string;
  severity: 'extreme' | 'major' | 'notable' | 'minor';
  catalyst: 'earnings' | 'macro' | 'sector' | 'news' | 'technical' | 'social' | 'order_flow';
  direction: 'up' | 'down';
  timestamp: number;
  relativeVolume: number; // vs 20-day average
  isNew: boolean;
}

interface GroupedMover {
  sector: string;
  sectorCN: string;
  count: number;
  avgChange: number;
  direction: 'up' | 'down' | 'mixed';
  movers: MoverItem[];
}

interface FilterConfig {
  severity: string[];
  catalyst: string[];
  direction: 'all' | 'up' | 'down';
  minChangePct: number;
  minVolumeRatio: number;
}

// ── Mock Data ──
const mockWatchlist: WatchlistItem[] = [
  { id: 'w1', symbol: 'NVDA', name: 'NVIDIA', market: 'us', price: 148.35, changePct: 8.5, volume: 82.3, starred: true, alertEnabled: true, alertThresholdUp: 155, alertThresholdDown: 135, lastUpdate: Date.now() - 5000 },
  { id: 'w2', symbol: 'TSLA', name: 'Tesla', market: 'us', price: 342.80, changePct: -6.2, volume: 65.1, starred: true, alertEnabled: true, alertThresholdDown: 330, lastUpdate: Date.now() - 8000 },
  { id: 'w3', symbol: '0700', name: '腾讯', market: 'hk', price: 485.60, changePct: 4.3, volume: 28.7, starred: true, alertEnabled: false, lastUpdate: Date.now() - 15000 },
  { id: 'w4', symbol: 'BTC', name: 'Bitcoin', market: 'crypto', price: 98450, changePct: 1.3, volume: 28.5, starred: true, alertEnabled: true, alertThresholdUp: 100000, lastUpdate: Date.now() - 2000 },
  { id: 'w5', symbol: 'SMCI', name: 'Super Micro', market: 'us', price: 892.00, changePct: 12.1, volume: 41.5, starred: false, alertEnabled: false, lastUpdate: Date.now() - 12000 },
  { id: 'w6', symbol: '9988', name: '阿里巴巴', market: 'hk', price: 112.30, changePct: -3.1, volume: 35.2, starred: false, alertEnabled: false, lastUpdate: Date.now() - 10000 },
  { id: 'w7', symbol: 'MSFT', name: 'Microsoft', market: 'us', price: 468.50, changePct: 1.2, volume: 28.7, starred: true, alertEnabled: false, lastUpdate: Date.now() - 6000 },
  { id: 'w8', symbol: 'ETH', name: 'Ethereum', market: 'crypto', price: 4520, changePct: 2.1, volume: 15.8, starred: false, alertEnabled: false, lastUpdate: Date.now() - 3000 },
  { id: 'w9', symbol: 'COIN', name: 'Coinbase', market: 'us', price: 342.00, changePct: 4.5, volume: 18.2, starred: false, alertEnabled: true, alertThresholdUp: 360, lastUpdate: Date.now() - 7000 },
  { id: 'w10', symbol: 'XOM', name: 'Exxon', market: 'us', price: 118.20, changePct: -1.2, volume: 15.6, starred: false, alertEnabled: false, lastUpdate: Date.now() - 9000 },
];

const mockMovers: MoverItem[] = [
  { id: 'm1', symbol: 'NVDA', name: 'NVIDIA', market: 'US', price: 148.35, changePct: 8.5, volume: 82.3, reason: '新AI芯片发布 + 数据中心需求超预期', severity: 'extreme', catalyst: 'earnings', direction: 'up', timestamp: Date.now() - 300000, relativeVolume: 4.2, isNew: true },
  { id: 'm2', symbol: 'SMCI', name: 'Super Micro', market: 'US', price: 892.00, changePct: 12.1, volume: 41.5, reason: 'AI服务器订单暴增', severity: 'extreme', catalyst: 'earnings', direction: 'up', timestamp: Date.now() - 600000, relativeVolume: 5.8, isNew: true },
  { id: 'm3', symbol: 'TSLA', name: 'Tesla', market: 'US', price: 342.80, changePct: -6.2, volume: 65.1, reason: '交付量不及预期 + 欧盟关税提高', severity: 'major', catalyst: 'news', direction: 'down', timestamp: Date.now() - 900000, relativeVolume: 2.8, isNew: false },
  { id: 'm4', symbol: '0700', name: '腾讯', market: 'HK', price: 485.60, changePct: 4.3, volume: 28.7, reason: '游戏版号获批 + 广告收入复苏', severity: 'notable', catalyst: 'sector', direction: 'up', timestamp: Date.now() - 1800000, relativeVolume: 2.1, isNew: false },
  { id: 'm5', symbol: '9988', name: '阿里巴巴', market: 'HK', price: 112.30, changePct: -3.1, volume: 35.2, reason: '竞争加剧 + 利润率承压', severity: 'major', catalyst: 'earnings', direction: 'down', timestamp: Date.now() - 2400000, relativeVolume: 2.5, isNew: false },
  { id: 'm6', symbol: 'COIN', name: 'Coinbase', market: 'US', price: 342.00, changePct: 4.5, volume: 18.2, reason: 'BTC逼近10万 + ETF资金持续流入', severity: 'notable', catalyst: 'macro', direction: 'up', timestamp: Date.now() - 3600000, relativeVolume: 1.8, isNew: false },
  { id: 'm7', symbol: 'XOM', name: 'Exxon', market: 'US', price: 118.20, changePct: -1.2, volume: 15.6, reason: '原油价格回落 + 炼油利润率下降', severity: 'minor', catalyst: 'macro', direction: 'down', timestamp: Date.now() - 4200000, relativeVolume: 1.2, isNew: false },
  { id: 'm8', symbol: 'MSTR', name: 'MicroStrategy', market: 'US', price: 1850.00, changePct: -1.2, volume: 5.3, reason: 'BTC回调 + 溢价压缩', severity: 'minor', catalyst: 'macro', direction: 'down', timestamp: Date.now() - 4800000, relativeVolume: 1.5, isNew: false },
  { id: 'm9', symbol: 'MRVL', name: 'Marvell', market: 'US', price: 82.40, changePct: 5.3, volume: 22.1, reason: 'AI芯片收入超预期 + 大额订单', severity: 'notable', catalyst: 'earnings', direction: 'up', timestamp: Date.now() - 5400000, relativeVolume: 3.1, isNew: false },
  { id: 'm10', symbol: 'PLTR', name: 'Palantir', market: 'US', price: 45.80, changePct: 7.2, volume: 38.5, reason: '政府AI合同大单 + 商业业务加速', severity: 'major', catalyst: 'news', direction: 'up', timestamp: Date.now() - 6000000, relativeVolume: 4.0, isNew: true },
];

// ── Helpers ──
const severityColor = (s: string) => s === 'extreme' ? 'red' : s === 'major' ? 'volcano' : s === 'notable' ? 'blue' : 'default';
const catalystEmoji = (c: string) => ({ earnings: '📊', macro: '🏛️', sector: '🏭', news: '📰', technical: '📈', social: '💬', order_flow: '📋' })[c] || '❓';
const formatTime = (ts: number) => {
  const diff = Date.now() - ts;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分前`;
  return `${Math.floor(diff / 3600000)}时前`;
};

// ── Watchlist Panel ──
const WatchlistPanel: React.FC = () => {
  const [items, setItems] = useState<WatchlistItem[]>(mockWatchlist);
  const [searchText, setSearchText] = useState('');
  const [showOnlyStarred, setShowOnlyStarred] = useState(false);

  const toggleStar = (id: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, starred: !i.starred } : i));
  };

  const toggleAlert = (id: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, alertEnabled: !i.alertEnabled } : i));
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
    message.info('已从自选移除');
  };

  const filtered = useMemo(() => {
    let list = items;
    if (showOnlyStarred) list = list.filter(i => i.starred);
    if (searchText) {
      list = list.filter(i =>
        i.symbol.toLowerCase().includes(searchText.toLowerCase()) ||
        i.name.toLowerCase().includes(searchText.toLowerCase())
      );
    }
    return list.sort((a, b) => {
      if (a.starred !== b.starred) return a.starred ? -1 : 1;
      return Math.abs(b.changePct) - Math.abs(a.changePct);
    });
  }, [items, searchText, showOnlyStarred]);

  const totalPct = filtered.reduce((sum, i) => sum + i.changePct, 0);

  return (
    <div>
      {/* Quick Stats */}
      <Row gutter={[8, 8]} style={{ marginBottom: 12 }}>
        <Col xs={12} sm={6}>
          <Statistic title="自选数" value={items.length} prefix={<StarOutlined />} />
        </Col>
        <Col xs={12} sm={6}>
          <Statistic title="星标" value={items.filter(i => i.starred).length} prefix={<StarFilled style={{ color: '#faad14' }} />} />
        </Col>
        <Col xs={12} sm={6}>
          <Statistic title="警报" value={items.filter(i => i.alertEnabled).length} prefix={<BellFilled style={{ color: '#1677ff' }} />} />
        </Col>
        <Col xs={12} sm={6}>
          <Statistic
            title="今日总涨跌" value={totalPct} suffix="%"
            valueStyle={{ color: totalPct >= 0 ? '#52c41a' : '#ff4d4f' }}
            prefix={totalPct >= 0 ? <CaretUpOutlined /> : <CaretDownOutlined />}
          />
        </Col>
      </Row>

      {/* Toolbar */}
      <Space style={{ marginBottom: 8 }} size={8}>
        <Input.Search size="small" placeholder="搜索自选..." value={searchText}
          onChange={e => setSearchText(e.target.value)} style={{ width: 160 }} />
        <Button size="small" type="text" icon={<StarFilled />}
          onClick={() => setShowOnlyStarred(!showOnlyStarred)}
          danger={showOnlyStarred}>仅星标</Button>
        <Button size="small" type="dashed" icon={<PlusOutlined />}>添加</Button>
      </Space>

      {/* List */}
      <div style={{ maxHeight: 520, overflowY: 'auto' }}>
        {filtered.map(item => (
          <div key={item.id} style={{
            padding: '6px 0', borderBottom: '1px solid #f0f0f0',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            transition: 'background 0.2s',
          }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fafafa'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
          >
            <Space size={4}>
              <Button type="text" size="small"
                icon={item.starred ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined />}
                onClick={() => toggleStar(item.id)} />
              <Space size={2} direction="vertical" style={{ lineHeight: 1.1 }}>
                <Space size={4}>
                  <Text strong style={{ fontSize: 13 }}>{item.symbol}</Text>
                  <Tag style={{ fontSize: 9, padding: '0 3px', lineHeight: '16px' }}>
                    {item.market.toUpperCase()}
                  </Tag>
                </Space>
                <Text type="secondary" style={{ fontSize: 10 }}>{item.name}</Text>
              </Space>
            </Space>

            <Space size={8}>
              <Space size={2} direction="vertical" style={{ alignItems: 'flex-end', lineHeight: 1.1 }}>
                <Text style={{ fontSize: 13 }}>${item.price.toLocaleString()}</Text>
                <Text type={item.changePct >= 0 ? 'success' : 'danger'} strong style={{ fontSize: 11 }}>
                  {item.changePct >= 0 ? <CaretUpOutlined /> : <CaretDownOutlined />}
                  {item.changePct >= 0 ? '+' : ''}{item.changePct}%
                </Text>
              </Space>

              <Tooltip title={item.alertEnabled ? '关闭警报' : '开启警报'}>
                <Button type="text" size="small"
                  icon={item.alertEnabled ? <BellFilled style={{ color: '#1677ff' }} /> : <BellOutlined />}
                  onClick={() => toggleAlert(item.id)} />
              </Tooltip>
              <Tooltip title="移除">
                <Button type="text" size="small" danger icon={<DeleteOutlined />}
                  onClick={() => removeItem(item.id)} />
              </Tooltip>
            </Space>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 32, color: '#999' }}>
            暂无自选，点击"添加"搜索股票
          </div>
        )}
      </div>
    </div>
  );
};

// ── Movers Panel ──
const MoversPanel: React.FC = () => {
  const [movers] = useState<MoverItem[]>(mockMovers);
  const [filters, setFilters] = useState<FilterConfig>({
    severity: ['extreme', 'major', 'notable', 'minor'],
    catalyst: ['earnings', 'macro', 'sector', 'news', 'technical', 'social', 'order_flow'],
    direction: 'all',
    minChangePct: 1,
    minVolumeRatio: 1,
  });

  const filtered = useMemo(() => {
    return movers.filter(m => {
      if (!filters.severity.includes(m.severity)) return false;
      if (!filters.catalyst.includes(m.catalyst)) return false;
      if (filters.direction !== 'all' && m.direction !== filters.direction) return false;
      if (Math.abs(m.changePct) < filters.minChangePct) return false;
      if (m.relativeVolume < filters.minVolumeRatio) return false;
      return true;
    }).sort((a, b) => b.timestamp - a.timestamp);
  }, [movers, filters]);

  // Group by sector
  const grouped: GroupedMover[] = useMemo(() => {
    const map = new Map<string, MoverItem[]>();
    const sectorCN: Record<string, string> = {
      semiconductor: '半导体', ai_cloud: 'AI/云', crypto: '加密',
      energy: '能源', consumer: '消费', realestate: '房地产',
      tech: '科技', finance: '金融', healthcare: '医疗',
    };
    for (const m of filtered) {
      const sector = m.catalyst === 'earnings' ? 'earnings' : m.catalyst === 'macro' ? 'macro' : 'sector';
      if (!map.has(sector)) map.set(sector, []);
      map.get(sector)!.push(m);
    }
    return Array.from(map.entries()).map(([sector, ms]) => {
      const avg = ms.reduce((s, m) => s + m.changePct, 0) / ms.length;
      const upCount = ms.filter(m => m.direction === 'up').length;
      const downCount = ms.filter(m => m.direction === 'down').length;
      return {
        sector, sectorCN: sectorCN[sector] || sector,
        count: ms.length,
        avgChange: avg,
        direction: upCount > downCount ? 'up' : downCount > upCount ? 'down' : 'mixed',
        movers: ms,
      };
    });
  }, [filtered]);

  return (
    <div>
      {/* Quick Stats */}
      <Row gutter={[8, 8]} style={{ marginBottom: 12 }}>
        <Col xs={8} sm={6}>
          <Statistic title="总异动" value={filtered.length} prefix={<ThunderboltOutlined style={{ color: '#fa8c16' }} />} />
        </Col>
        <Col xs={8} sm={6}>
          <Statistic title="⬆飙升" value={filtered.filter(m => m.direction === 'up').length}
            valueStyle={{ color: '#52c41a' }} />
        </Col>
        <Col xs={8} sm={6}>
          <Statistic title="⬇暴跌" value={filtered.filter(m => m.direction === 'down').length}
            valueStyle={{ color: '#ff4d4f' }} />
        </Col>
        <Col xs={12} sm={6}>
          <Statistic title="极端" value={filtered.filter(m => m.severity === 'extreme').length}
            valueStyle={{ color: '#cf1322' }} prefix={<FireOutlined />} />
        </Col>
      </Row>

      {/* Filters */}
      <Space size={4} wrap style={{ marginBottom: 8 }}>
        <Select size="small" mode="multiple" value={filters.severity} onChange={v => setFilters(f => ({ ...f, severity: v }))}
          style={{ minWidth: 120 }} placeholder="严重度"
          options={[
            { label: '🔥 极端', value: 'extreme' }, { label: '⚠️ 重大', value: 'major' },
            { label: '📌 显著', value: 'notable' }, { label: '▪ 一般', value: 'minor' },
          ]} />
        <Segmented size="small" value={filters.direction} onChange={v => setFilters(f => ({ ...f, direction: v as any }))}
          options={[
            { label: '全部', value: 'all' },
            { label: <CaretUpOutlined style={{ color: '#52c41a' }} />, value: 'up' },
            { label: <CaretDownOutlined style={{ color: '#ff4d4f' }} />, value: 'down' },
          ]} />
      </Space>

      {/* Grouped Mover Cards */}
      <div style={{ maxHeight: 480, overflowY: 'auto' }}>
        {grouped.map(g => (
          <Card key={g.sector} size="small" style={{ marginBottom: 8 }}
            title={
              <Space>
                <Text strong>{g.sectorCN}</Text>
                <Tag color={g.direction === 'up' ? 'green' : g.direction === 'down' ? 'red' : 'default'}>
                  {g.avgChange >= 0 ? '+' : ''}{g.avgChange.toFixed(1)}%
                </Tag>
                <Badge count={g.count} overflowCount={99} />
              </Space>
            }
          >
            {g.movers.map(m => (
              <div key={m.id} style={{
                padding: '6px 0', borderBottom: '1px solid #f5f5f5',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <Space size={4}>
                  {m.isNew && <Badge status="processing" />}
                  <Tag color={severityColor(m.severity)} style={{ fontSize: 10, padding: '0 4px' }}>
                    {m.severity === 'extreme' ? '极端' : m.severity === 'major' ? '重大' : m.severity === 'notable' ? '显著' : '一般'}
                  </Tag>
                  <Text strong style={{ fontSize: 12 }}>{m.symbol}</Text>
                  <Text type="secondary" style={{ fontSize: 10 }}>{m.market}</Text>
                  <Tooltip title={m.reason}>
                    <Text style={{ fontSize: 10, color: '#999', maxWidth: 160 }} ellipsis>
                      {catalystEmoji(m.catalyst)} {m.reason}
                    </Text>
                  </Tooltip>
                </Space>
                <Space size={8}>
                  <Text type="secondary" style={{ fontSize: 10 }}>{formatTime(m.timestamp)}</Text>
                  <Text strong style={{ fontSize: 12, color: m.direction === 'up' ? '#52c41a' : '#ff4d4f' }}>
                    {m.direction === 'up' ? '▲' : '▼'} {Math.abs(m.changePct)}%
                  </Text>
                  <Tooltip title={`相对20日量比: ${m.relativeVolume}x`}>
                    <Progress percent={Math.min(100, m.relativeVolume * 20)} size="small" showInfo={false}
                      strokeColor={m.direction === 'up' ? '#52c41a' : '#ff4d4f'}
                      style={{ width: 40, margin: 0 }} />
                  </Tooltip>
                </Space>
              </div>
            ))}
          </Card>
        ))}
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 32, color: '#999' }}>
            当前筛选条件下无异动
          </div>
        )}
      </div>
    </div>
  );
};

// ── Main Component ──
const WatchlistMoversDashboard: React.FC = () => {
  return (
    <div style={{ padding: 16, maxWidth: 1400, margin: '0 auto' }}>
      <Space style={{ marginBottom: 12 }}>
        <EyeOutlined style={{ fontSize: 24, color: '#1677ff' }} />
        <Title level={3} style={{ margin: 0 }}>自选 & 异动</Title>
      </Space>
      <Tabs defaultActiveKey="watchlist" items={[
        {
          key: 'watchlist',
          label: <span><StarFilled style={{ color: '#faad14' }} /> 自选列表</span>,
          children: <WatchlistPanel />,
        },
        {
          key: 'movers',
          label: <span><ThunderboltOutlined style={{ color: '#fa8c16' }} /> 实时异动</span>,
          children: <MoversPanel />,
        },
      ]} />
    </div>
  );
};

export default WatchlistMoversDashboard;
