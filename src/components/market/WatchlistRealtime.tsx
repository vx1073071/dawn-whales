// @ts-nocheck
// QUANT MOO — 自选列表实时刷新 (Watchlist Real-Time Refresh)
// R258 ML#2 P1-03 — 自选实时更新+闪烁+排序+批量操作 (8h)

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Card, Table, Tag, Space, Typography, Input, Button, Select,
  Switch, Badge, Progress, Tooltip, Segmented, Row, Col,
  Statistic, Divider, Dropdown, message, Popconfirm, Empty,
  Checkbox, Modal
} from 'antd';
import {
  StarOutlined, StarFilled, BellOutlined, BellFilled,
  CaretUpOutlined, CaretDownOutlined, ReloadOutlined,
  PlusOutlined, DeleteOutlined, SettingOutlined,
  ThunderboltOutlined, FireOutlined, EyeOutlined,
  SwapOutlined, ArrowUpOutlined, ArrowDownOutlined,
  SearchOutlined, FilterOutlined, CopyOutlined,
  DragOutlined, CheckOutlined, ExportOutlined,
  PauseCircleOutlined, PlayCircleOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

// ── Types ──
interface LiveQuote {
  id: string;
  symbol: string;
  name: string;
  market: string;
  price: number;
  prevPrice: number;
  change: number;
  changePct: number;
  volume: number;
  bid: number;
  ask: number;
  lastUpdate: number;
  starred: boolean;
  alertOn: boolean;
  alertUp?: number;
  alertDown?: number;
  sector: string;
  isNew: boolean; // just updated indicator
}

interface SortConfig {
  field: 'symbol' | 'price' | 'changePct' | 'volume' | 'lastUpdate';
  direction: 'asc' | 'desc';
}

interface WatchlistGroup {
  id: string;
  name: string;
  items: string[];
}

// ── Mock Data Generator ──
const generateQuotes = (prev?: LiveQuote[]): LiveQuote[] => {
  const base: Omit<LiveQuote, 'prevPrice' | 'isNew'>[] = [
    { id: 'w1', symbol: 'NVDA', name: 'NVIDIA', market: 'US', price: 148.35 + (Math.random() - 0.5) * 2, change: 11.65, changePct: 8.52, volume: 82.3e6, bid: 148.32, ask: 148.38, lastUpdate: Date.now(), starred: true, alertOn: true, alertUp: 155, alertDown: 135, sector: '半导体' },
    { id: 'w2', symbol: 'TSLA', name: 'Tesla', market: 'US', price: 342.80 + (Math.random() - 0.5) * 3, change: -22.7, changePct: -6.21, volume: 65.1e6, bid: 342.75, ask: 342.85, lastUpdate: Date.now(), starred: true, alertOn: true, alertDown: 330, sector: '汽车' },
    { id: 'w3', symbol: '0700', name: '腾讯', market: 'HK', price: 485.60 + (Math.random() - 0.5) * 2, change: 20.1, changePct: 4.32, volume: 28.7e6, bid: 485.40, ask: 485.80, lastUpdate: Date.now(), starred: true, alertOn: false, sector: '科技' },
    { id: 'w4', symbol: 'BTC', name: 'Bitcoin', market: 'CRYPTO', price: 98450 + (Math.random() - 0.5) * 300, change: 1250, changePct: 1.29, volume: 28.5, bid: 98440, ask: 98460, lastUpdate: Date.now(), starred: true, alertOn: true, alertUp: 100000, sector: '加密' },
    { id: 'w5', symbol: 'SMCI', name: 'Super Micro', market: 'US', price: 892.00 + (Math.random() - 0.5) * 5, change: 96.1, changePct: 12.10, volume: 41.5e6, bid: 891.80, ask: 892.20, lastUpdate: Date.now(), starred: false, alertOn: false, sector: '半导体' },
    { id: 'w6', symbol: '9988', name: '阿里巴巴', market: 'HK', price: 112.30 + (Math.random() - 0.5) * 3, change: -3.61, changePct: -3.12, volume: 35.2e6, bid: 112.20, ask: 112.40, lastUpdate: Date.now(), starred: false, alertOn: false, sector: '电商' },
    { id: 'w7', symbol: 'MSFT', name: 'Microsoft', market: 'US', price: 468.50 + (Math.random() - 0.5) * 2, change: 5.56, changePct: 1.20, volume: 28.7e6, bid: 468.40, ask: 468.60, lastUpdate: Date.now(), starred: true, alertOn: false, sector: 'AI/云' },
    { id: 'w8', symbol: 'ETH', name: 'Ethereum', market: 'CRYPTO', price: 4520 + (Math.random() - 0.5) * 30, change: 95.1, changePct: 2.15, volume: 15.8, bid: 4518, ask: 4522, lastUpdate: Date.now(), starred: false, alertOn: false, sector: '加密' },
  ];

  return base.map((item, i) => {
    const prevItem = prev?.find(p => p.id === item.id);
    const prevPrice = prevItem?.price || item.price;
    const isNew = prevItem ? Math.abs(item.price - prevItem.price) > 0.01 : true;
    return { ...item, prevPrice, isNew } as LiveQuote;
  });
};

// ── Flashing price cell ──
const FlashingPrice: React.FC<{ current: number; previous: number; isNew: boolean }> = ({ current, previous, isNew }) => {
  const up = current >= previous;
  return (
    <span style={{
      fontFamily: 'monospace',
      fontWeight: 600,
      fontSize: 12,
      color: up ? '#52c41a' : '#ff4d4f',
      transition: 'all 0.1s',
      background: isNew ? (up ? 'rgba(82,196,26,0.1)' : 'rgba(255,77,79,0.1)') : 'transparent',
      padding: '2px 4px',
      borderRadius: 3,
    }}>
      {up ? '▲' : '▼'} {current.toFixed(2)}
    </span>
  );
};

// ── Batch Operations Bar ──
const BatchBar: React.FC<{
  selected: string[];
  onSelectAll: () => void;
  onClear: () => void;
  onBatchStar: () => void;
  onBatchAlert: () => void;
  onBatchRemove: () => void;
}> = ({ selected, onSelectAll, onClear, onBatchStar, onBatchAlert, onBatchRemove }) => {
  if (selected.length === 0) return null;
  return (
    <Card size="small" style={{ marginBottom: 8, background: '#e6f7ff', border: '1px solid #91d5ff' }}>
      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
        <Space>
          <Text strong>已选 {selected.length} 只</Text>
          <Button size="small" type="link" onClick={onSelectAll}>全选</Button>
          <Button size="small" type="link" onClick={onClear}>清除</Button>
        </Space>
        <Space>
          <Button size="small" icon={<StarOutlined />} onClick={onBatchStar}>批量星标</Button>
          <Button size="small" icon={<BellOutlined />} onClick={onBatchAlert}>批量警报</Button>
          <Popconfirm title="确认删除?" onConfirm={onBatchRemove}>
            <Button size="small" danger icon={<DeleteOutlined />}>批量移除</Button>
          </Popconfirm>
        </Space>
      </Space>
    </Card>
  );
};

// ── Quick Stats Header ──
const QuickStats: React.FC<{ quotes: LiveQuote[] }> = ({ quotes }) => {
  const upCount = quotes.filter(q => q.changePct >= 0).length;
  const downCount = quotes.filter(q => q.changePct < 0).length;
  const maxUp = quotes.reduce((max, q) => q.changePct > max ? q.changePct : max, -Infinity);
  const maxDown = quotes.reduce((min, q) => q.changePct < min ? q.changePct : min, Infinity);
  const totalChange = quotes.reduce((s, q) => s + q.changePct, 0) / quotes.length;

  return (
    <Row gutter={[8, 8]} style={{ marginBottom: 8 }}>
      <Col xs={12} sm={6} lg={3}>
        <Statistic title="总览" value={`${upCount}↑${downCount}↓`} valueStyle={{ fontSize: 16 }} />
      </Col>
      <Col xs={12} sm={6} lg={3}>
        <Statistic title="平均涨跌" value={`${totalChange >= 0 ? '+' : ''}${totalChange.toFixed(2)}%`}
          valueStyle={{ color: totalChange >= 0 ? '#52c41a' : '#ff4d4f', fontSize: 16 }} />
      </Col>
      <Col xs={12} sm={6} lg={3}>
        <Statistic title="最大涨幅" value={`+${maxUp.toFixed(2)}%`} valueStyle={{ color: '#52c41a', fontSize: 16 }} />
      </Col>
      <Col xs={12} sm={6} lg={3}>
        <Statistic title="最大跌幅" value={`${maxDown.toFixed(2)}%`} valueStyle={{ color: '#ff4d4f', fontSize: 16 }} />
      </Col>
    </Row>
  );
};

// ── Main Component ──
const WatchlistRealtime: React.FC = () => {
  const [quotes, setQuotes] = useState<LiveQuote[]>(() => generateQuotes());
  const [selected, setSelected] = useState<string[]>([]);
  const [searchText, setSearchText] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: 'lastUpdate', direction: 'desc' });
  const [marketFilter, setMarketFilter] = useState('all');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [pingMs, setPingMs] = useState(42);
  const [refreshCount, setRefreshCount] = useState(0);

  // Simulate real-time refresh every 3 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => {
      setQuotes(prev => generateQuotes(prev));
      setRefreshCount(c => c + 1);
      setPingMs(30 + Math.floor(Math.random() * 30));
    }, 3000);
    return () => clearInterval(timer);
  }, [autoRefresh]);

  const toggleStar = (id: string) => {
    setQuotes(prev => prev.map(q => q.id === id ? { ...q, starred: !q.starred } : q));
  };
  const toggleAlert = (id: string) => {
    setQuotes(prev => prev.map(q => q.id === id ? { ...q, alertOn: !q.alertOn } : q));
  };
  const removeItem = (id: string) => {
    setQuotes(prev => prev.filter(q => q.id !== id));
    message.info('已移除');
  };

  // Batch
  const onSelectAll = () => setSelected(quotes.map(q => q.id));
  const onClear = () => setSelected([]);
  const onBatchStar = () => {
    setQuotes(prev => prev.map(q => selected.includes(q.id) ? { ...q, starred: true } : q));
    onClear(); message.success('已批量星标');
  };
  const onBatchAlert = () => {
    setQuotes(prev => prev.map(q => selected.includes(q.id) ? { ...q, alertOn: true } : q));
    onClear(); message.success('已批量开启警报');
  };
  const onBatchRemove = () => {
    setQuotes(prev => prev.filter(q => !selected.includes(q.id)));
    onClear(); message.info('已批量移除');
  };

  const filtered = useMemo(() => {
    let list = quotes;
    if (marketFilter !== 'all') list = list.filter(q => q.market === marketFilter);
    if (searchText) {
      list = list.filter(q =>
        q.symbol.toLowerCase().includes(searchText.toLowerCase()) ||
        q.name.includes(searchText)
      );
    }
    return list.sort((a, b) => {
      const dir = sortConfig.direction === 'asc' ? 1 : -1;
      const af = a[sortConfig.field];
      const bf = b[sortConfig.field];
      if (typeof af === 'string' && typeof bf === 'string') return af.localeCompare(bf) * dir;
      return ((af as number) - (bf as number)) * dir;
    });
  }, [quotes, marketFilter, searchText, sortConfig]);

  return (
    <div style={{ padding: 16, maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Space>
          <EyeOutlined style={{ fontSize: 24, color: '#1677ff' }} />
          <Title level={3} style={{ margin: 0 }}>自选列表</Title>
          <Badge count={quotes.length} overflowCount={99} style={{ backgroundColor: '#1677ff' }} />
        </Space>
        <Space>
          <Tooltip title={`数据延迟: ${pingMs}ms`}>
            <Tag color={pingMs < 50 ? 'green' : 'orange'}>
              <ThunderboltOutlined /> {pingMs}ms
            </Tag>
          </Tooltip>
          <Tooltip title={`刷新次数: ${refreshCount}`}>
            <Tag>{refreshCount}次</Tag>
          </Tooltip>
          <Switch checked={autoRefresh} onChange={setAutoRefresh}
            checkedChildren={<PlayCircleOutlined />} unCheckedChildren={<PauseCircleOutlined />} />
          <Button size="small" icon={<ReloadOutlined />}
            onClick={() => { setQuotes(generateQuotes()); setRefreshCount(c => c + 1); }}>
            刷新
          </Button>
        </Space>
      </div>

      <QuickStats quotes={quotes} />

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <Input.Search size="small" placeholder="搜索代码/名称..." value={searchText}
          onChange={e => setSearchText(e.target.value)} style={{ width: 180 }} />
        <Select size="small" value={marketFilter} onChange={setMarketFilter} style={{ width: 80 }}
          options={[
            { label: '全部', value: 'all' }, { label: '美股', value: 'US' },
            { label: '港股', value: 'HK' }, { label: '加密', value: 'CRYPTO' },
          ]} />
        <Button size="small" type="dashed" icon={<PlusOutlined />}>添加自选</Button>
        <Button size="small" icon={<ExportOutlined />}>导出</Button>
      </div>

      {/* Batch Bar */}
      <BatchBar selected={selected} onSelectAll={onSelectAll} onClear={onClear}
        onBatchStar={onBatchStar} onBatchAlert={onBatchAlert} onBatchRemove={onBatchRemove} />

      {/* Table */}
      <Table
        dataSource={filtered}
        rowKey="id"
        size="small"
        pagination={false}
        rowClassName={(record) => record.isNew ? 'quote-flash' : ''}
        rowSelection={{
          selectedRowKeys: selected,
          onChange: (keys) => setSelected(keys as string[]),
        }}
        columns={[
          {
            title: '自选', key: 'star', width: 40, render: (_: any, r: LiveQuote) => (
              <Button size="small" type="text" style={{ padding: 0 }}
                icon={r.starred ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined />}
                onClick={() => toggleStar(r.id)} />
            )
          },
          {
            title: '代码', key: 'symbol', width: 90,
            render: (_: any, r: LiveQuote) => (
              <Space size={2} direction="vertical" style={{ lineHeight: 1.1 }}>
                <Space size={4}>
                  <Text strong style={{ fontSize: 12 }}>{r.symbol}</Text>
                  {r.isNew && <Badge status="processing" />}
                </Space>
                <Text type="secondary" style={{ fontSize: 9 }}>{r.name.substring(0, 8)}</Text>
              </Space>
            )
          },
          {
            title: '最新价', key: 'price', width: 100,
            render: (_: any, r: LiveQuote) => <FlashingPrice current={r.price} previous={r.prevPrice} isNew={r.isNew} />
          },
          {
            title: '涨跌', key: 'change', width: 80,
            sorter: true, render: (_: any, r: LiveQuote) => (
              <Text type={r.changePct >= 0 ? 'success' : 'danger'} strong style={{ fontSize: 12 }}>
                {r.changePct >= 0 ? <CaretUpOutlined /> : <CaretDownOutlined />}
                {r.changePct >= 0 ? '+' : ''}{r.changePct.toFixed(2)}%
              </Text>
            )
          },
          {
            title: '买', key: 'bid', width: 65, render: (_: any, r: LiveQuote) => (
              <Text style={{ fontSize: 11, fontFamily: 'monospace' }}>{r.bid.toFixed(2)}</Text>
            )
          },
          {
            title: '卖', key: 'ask', width: 65, render: (_: any, r: LiveQuote) => (
              <Text style={{ fontSize: 11, fontFamily: 'monospace' }}>{r.ask.toFixed(2)}</Text>
            )
          },
          {
            title: '量', key: 'volume', width: 60, render: (_: any, r: LiveQuote) => (
              <Text style={{ fontSize: 11 }}>{r.market === 'CRYPTO' ? `${r.volume.toFixed(1)}B` : `${(r.volume / 1e6).toFixed(1)}M`}</Text>
            )
          },
          {
            title: '操作', key: 'actions', width: 80, render: (_: any, r: LiveQuote) => (
              <Space size={2}>
                <Tooltip title={r.alertOn ? '关闭警报' : '开启警报'}>
                  <Button size="small" type="text" style={{ padding: 0 }}
                    icon={r.alertOn ? <BellFilled style={{ color: '#1677ff' }} /> : <BellOutlined />}
                    onClick={() => toggleAlert(r.id)} />
                </Tooltip>
                <Popconfirm title="移除?" onConfirm={() => removeItem(r.id)}>
                  <Button size="small" type="text" danger style={{ padding: 0 }} icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            )
          },
        ]}
        onChange={(_pagination, _filters, sorter: any) => {
          if (sorter.field) {
            setSortConfig({ field: sorter.field as any, direction: sorter.order === 'ascend' ? 'asc' : 'desc' });
          }
        }}
      />

      {filtered.length === 0 && <Empty description="暂无自选" style={{ marginTop: 32 }} />}
    </div>
  );
};

// CSS animation for flashing rows
const style = document.createElement('style');
style.textContent = `
  .quote-flash td {
    animation: flashGreen 0.6s ease-out;
  }
  @keyframes flashGreen {
    0% { background-color: rgba(82,196,26,0.15); }
    100% { background-color: transparent; }
  }
`;
document.head.appendChild(style);

export default WatchlistRealtime;
