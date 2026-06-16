// @ts-nocheck
// QUANT MOO — 桌面常驻行情条 (Desktop Mini Ticker Bar)
// R257 ML#3 P0-3 — Electron Tray迷你窗口+常驻自选条 (6h)

import React, { useState, useEffect, useCallback } from 'react';
import {
  Button, Space, Typography, Tag, Tooltip, Badge, Divider,
  Dropdown, Switch, Segmented, Popover, Card, Row, Col, Statistic,
  Select, message
} from 'antd';
import {
  CaretUpOutlined, CaretDownOutlined, MinusOutlined,
  PushpinOutlined, PushpinFilled, SettingOutlined,
  ReloadOutlined, CloseOutlined, ExpandOutlined,
  CompressOutlined, StarFilled, StarOutlined,
  BellOutlined, LineChartOutlined, DashboardOutlined,
  FireOutlined, RiseOutlined, FallOutlined,
  EyeOutlined, EyeInvisibleOutlined, CopyOutlined,
  AppstoreOutlined, MenuOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

// ── Types ──
interface TickerItem {
  id: string;
  symbol: string;
  name: string;
  market: string;
  price: number;
  changePct: number;
  starred: boolean;
  alertActive: boolean;
  volume?: number;
}

interface TrayConfig {
  position: 'top' | 'bottom';
  mode: 'compact' | 'expanded';
  showLabels: boolean;
  showChange: boolean;
  showVolume: boolean;
  maxItems: number;
  opacity: number;
  alwaysOnTop: boolean;
  collapsed: boolean;
}

// ── Mock Data ──
const mockTickerItems: TickerItem[] = [
  { id: 't1', symbol: 'NVDA', name: 'NVIDIA', market: 'US', price: 148.35, changePct: 8.52, starred: true, alertActive: true, volume: 82.3e6 },
  { id: 't2', symbol: 'TSLA', name: 'Tesla', market: 'US', price: 342.80, changePct: -6.21, starred: true, alertActive: true, volume: 65.1e6 },
  { id: 't3', symbol: 'BTC', name: 'Bitcoin', market: 'CRYPTO', price: 98450, changePct: 1.29, starred: true, alertActive: true },
  { id: 't4', symbol: '0700', name: '腾讯', market: 'HK', price: 485.60, changePct: 4.32, starred: true, alertActive: false },
  { id: 't5', symbol: 'SMCI', name: 'Super Micro', market: 'US', price: 892.00, changePct: 12.10, starred: false, alertActive: false },
  { id: 't6', symbol: 'ETH', name: 'Ethereum', market: 'CRYPTO', price: 4520, changePct: 2.15, starred: true, alertActive: false },
  { id: 't7', symbol: '9988', name: '阿里巴巴', market: 'HK', price: 112.30, changePct: -3.12, starred: false, alertActive: false },
  { id: 't8', symbol: 'MSFT', name: 'Microsoft', market: 'US', price: 468.50, changePct: 1.20, starred: true, alertActive: false },
  { id: 't9', symbol: 'SPX', name: 'S&P 500', market: 'US', price: 6047.82, changePct: 0.53, starred: false, alertActive: false },
  { id: 't10', symbol: 'GOLD', name: 'Gold', market: 'COMMODITY', price: 2685.30, changePct: 0.69, starred: false, alertActive: false },
];

// ── Compact Mode (single-row scrolling ticker, like Bloomberg) ──
const CompactTickerBar: React.FC<{
  items: TickerItem[];
  config: TrayConfig;
  onToggleStar: (id: string) => void;
}> = ({ items, config, onToggleStar }) => {
  const displayItems = items.filter(i => i.starred).slice(0, config.maxItems);
  const totalChange = displayItems.reduce((s, i) => s + i.changePct, 0);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', padding: '4px 12px',
      background: 'rgba(20, 20, 20, 0.92)', backdropFilter: 'blur(12px)',
      color: '#e8e8e8', borderRadius: 8, fontSize: 12,
      boxShadow: '0 2px 12px rgba(0,0,0,0.3)', gap: 8,
      width: 'fit-content', maxWidth: '100%', overflowX: 'auto',
      opacity: config.opacity,
    }}>
      {/* Portfolio summary pill */}
      <Tooltip title={`自选组合 ${totalChange >= 0 ? '+' : ''}${totalChange.toFixed(1)}%`}>
        <div style={{
          padding: '2px 8px', borderRadius: 12, fontSize: 10,
          background: totalChange >= 0 ? 'rgba(82,196,26,0.2)' : 'rgba(255,77,79,0.2)',
          border: `1px solid ${totalChange >= 0 ? 'rgba(82,196,26,0.4)' : 'rgba(255,77,79,0.4)'}`,
          marginRight: 4, whiteSpace: 'nowrap',
        }}>
          <Text style={{ color: totalChange >= 0 ? '#73d13d' : '#ff7875', fontSize: 10 }}>
            🐄 {totalChange >= 0 ? '↑' : '↓'} {totalChange >= 0 ? '+' : ''}{totalChange.toFixed(1)}%
          </Text>
        </div>
      </Tooltip>

      {/* Ticker items */}
      {displayItems.map(item => {
        const up = item.changePct >= 0;
        return (
          <Tooltip key={item.id} title={
            <div style={{ fontSize: 11 }}>
              <div><strong>{item.symbol}</strong> {item.name}</div>
              <div>${item.price.toLocaleString()} | {up ? '+' : ''}{item.changePct}%</div>
              {item.volume && <div>量: {(item.volume / 1e6).toFixed(1)}M</div>}
            </div>
          }>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 4, padding: '2px 6px',
              cursor: 'pointer', whiteSpace: 'nowrap', borderRadius: 4,
              transition: 'background 0.2s',
            }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
            >
              <Text strong style={{
                color: '#e8e8e8', fontSize: 11, minWidth: 36,
              }}>{item.symbol}</Text>
              <Text style={{
                color: up ? '#73d13d' : '#ff7875', fontSize: 11, fontWeight: 600,
              }}>
                {up ? '▲' : '▼'} {Math.abs(item.changePct).toFixed(1)}%
              </Text>
            </div>
          </Tooltip>
        );
      })}

      {/* Settings */}
      <Popover content={
        <div style={{ width: 200 }}>
          <Space direction="vertical" size={8}>
            <div>
              <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>显示数量</Text>
              <Segmented size="small" value={config.maxItems} options={[
                { label: '3', value: 3 }, { label: '5', value: 5 }, { label: '8', value: 8 }, { label: '10', value: 10 },
              ]} />
            </div>
            <div>
              <Space><Text style={{ fontSize: 12 }}>透明度</Text><Text type="secondary" style={{ fontSize: 12 }}>{Math.round(config.opacity * 100)}%</Text></Space>
            </div>
            <Space>
              <Switch size="small" checked={config.alwaysOnTop} /> <Text style={{ fontSize: 12 }}>置顶</Text>
            </Space>
          </Space>
        </div>
      } trigger="click">
        <Button type="text" size="small" icon={<SettingOutlined />}
          style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }} />
      </Popover>
    </div>
  );
};

// ── Expanded Mode (widget panel) ──
const ExpandedTickerPanel: React.FC<{
  items: TickerItem[];
  config: TrayConfig;
  onToggleStar: (id: string) => void;
  onToggleAlert: (id: string) => void;
  onRemove: (id: string) => void;
}> = ({ items, config, onToggleStar, onToggleAlert, onRemove }) => {
  const starredItems = items.filter(i => i.starred);
  const totalChange = starredItems.reduce((s, i) => s + i.changePct, 0);
  const upCount = starredItems.filter(i => i.changePct >= 0).length;
  const downCount = starredItems.filter(i => i.changePct < 0).length;

  return (
    <div style={{
      background: 'rgba(20, 20, 20, 0.95)', backdropFilter: 'blur(16px)',
      borderRadius: 12, padding: 12, width: 320,
      boxShadow: '0 4px 24px rgba(0,0,0,0.4)', color: '#e8e8e8',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Space>
          <Text strong style={{ color: '#fff', fontSize: 14 }}>🐄 QUANT MOO</Text>
          <Tag color={totalChange >= 0 ? 'green' : 'red'} style={{ fontSize: 10 }}>
            {totalChange >= 0 ? '+' : ''}{totalChange.toFixed(2)}%
          </Tag>
        </Space>
        <Space size={4}>
          <Text style={{ color: '#73d13d', fontSize: 10 }}>{upCount}↑</Text>
          <Text style={{ color: '#ff7875', fontSize: 10 }}>{downCount}↓</Text>
        </Space>
      </div>

      {/* Items */}
      <div style={{ maxHeight: 360, overflowY: 'auto' }}>
        {starredItems.map(item => {
          const up = item.changePct >= 0;
          return (
            <div key={item.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}>
              <Space size={4}>
                <Button type="text" size="small"
                  icon={<StarFilled style={{ color: '#faad14', fontSize: 12 }} />}
                  onClick={() => onToggleStar(item.id)}
                  style={{ padding: 0 }} />
                <div style={{ lineHeight: 1.2 }}>
                  <Text strong style={{ color: '#e8e8e8', fontSize: 12 }}>{item.symbol}</Text>
                  <Text type="secondary" style={{ color: '#8c8c8c', fontSize: 9, display: 'block' }}>{item.name}</Text>
                </div>
              </Space>
              <Space size={6}>
                <Text style={{ color: '#e8e8e8', fontSize: 11 }}>
                  ${item.price >= 1000 ? item.price.toLocaleString() : item.price.toFixed(2)}
                </Text>
                <Text strong style={{ color: up ? '#73d13d' : '#ff7875', fontSize: 11 }}>
                  {up ? '▲' : '▼'} {Math.abs(item.changePct).toFixed(2)}%
                </Text>
              </Space>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <Divider style={{ margin: '8px 0', borderColor: 'rgba(255,255,255,0.1)' }} />
      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
        <Button size="small" type="text" icon={<ExpandOutlined />}
          style={{ color: '#8c8c8c', fontSize: 11 }}>
          打开完整自选
        </Button>
        <Button size="small" type="text" icon={<SettingOutlined />}
          style={{ color: '#8c8c8c', fontSize: 11 }} />
      </Space>
    </div>
  );
};

// ── Tray Icon Simulator ──
const TrayIconSimulator: React.FC<{ items: TickerItem[] }> = ({ items }) => {
  const totalChange = items.filter(i => i.starred).reduce((s, i) => s + i.changePct, 0);
  const up = totalChange >= 0;
  return (
    <Tooltip title={`QUANT MOO · 自选 ${up ? '+' : ''}${totalChange.toFixed(2)}%`}>
      <div style={{
        width: 40, height: 40, borderRadius: 8, cursor: 'pointer',
        background: up ? 'linear-gradient(135deg, #52c41a, #237804)' : 'linear-gradient(135deg, #ff4d4f, #a8071a)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'transform 0.2s',
      }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform = 'scale(1.15)'}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = 'scale(1)'}
      >
        <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>🐄</Text>
      </div>
    </Tooltip>
  );
};

// ── Main Component ──
const DesktopTickerBar: React.FC = () => {
  const [items, setItems] = useState<TickerItem[]>(mockTickerItems);
  const [visible, setVisible] = useState(true);
  const [config, setConfig] = useState<TrayConfig>({
    position: 'top', mode: 'compact', showLabels: true,
    showChange: true, showVolume: false, maxItems: 6,
    opacity: 0.92, alwaysOnTop: true, collapsed: false,
  });

  const toggleStar = (id: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, starred: !i.starred } : i));
  };
  const toggleAlert = (id: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, alertActive: !i.alertActive } : i));
  };
  const removeItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const starredItems = items.filter(i => i.starred);

  return (
    <div style={{ padding: 16, maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <Space style={{ marginBottom: 12 }} direction="vertical" size={12} style={{ width: '100%' }}>
        <Space>
          <AppstoreOutlined style={{ fontSize: 24, color: '#722ed1' }} />
          <Title level={3} style={{ margin: 0 }}>桌面常驻行情条</Title>
        </Space>
        {/* Controls */}
        <Space size={8}>
          <Segmented size="small" value={config.mode} onChange={v => setConfig(c => ({ ...c, mode: v as any }))}
            options={[
              { label: <Space size={2}><MenuOutlined /> 紧凑</Space>, value: 'compact' },
              { label: <Space size={2}><AppstoreOutlined /> 展开</Space>, value: 'expanded' },
            ]} />
          <Select size="small" value={config.maxItems} onChange={v => setConfig(c => ({ ...c, maxItems: v }))}
            style={{ width: 70 }}
            options={[{ label: '3只', value: 3 }, { label: '5只', value: 5 }, { label: '8只', value: 8 }, { label: '10只', value: 10 }]} />
          <Badge count={starredItems.length} overflowCount={99} style={{ backgroundColor: '#fa8c16' }}>
            <Text type="secondary" style={{ fontSize: 11 }}>
              <StarFilled style={{ color: '#faad14' }} /> {starredItems.length}只星标
            </Text>
          </Badge>
        </Space>
      </Space>

      <Row gutter={[16, 16]}>
        {/* Preview Area */}
        <Col xs={24} lg={16}>
          {/* Tray Icon */}
          <Card size="small" title="🔽 系统托盘图标" style={{ marginBottom: 12 }}>
            <Space direction="vertical" size={8}>
              <Space>
                <TrayIconSimulator items={items} />
                <Text type="secondary" style={{ fontSize: 11 }}>
                  图标颜色随你的自选组合涨跌变化 · 点击展开迷你窗口
                </Text>
              </Space>
              <Space size={4}>
                <Tag color="green">绿底=组合上涨</Tag>
                <Tag color="red">红底=组合下跌</Tag>
                <Tag>hover显示百分比</Tag>
              </Space>
            </Space>
          </Card>

          {/* Compact Mode Preview */}
          <Card size="small" title="🖥 紧凑模式 (桌面顶部条)" style={{ marginBottom: 12 }}>
            <Text type="secondary" style={{ fontSize: 10, display: 'block', marginBottom: 8 }}>
              类似Bloomberg终端顶部ticker，悬浮在所有窗口上方，一眼看到自选组合
            </Text>
            <CompactTickerBar items={items} config={config} onToggleStar={toggleStar} />
          </Card>

          {/* Expanded Mode Preview */}
          <Card size="small" title="📋 展开模式 (迷你自选面板)">
            <Text type="secondary" style={{ fontSize: 10, display: 'block', marginBottom: 8 }}>
              点击托盘图标弹出，显示所有星标股详情
            </Text>
            <ExpandedTickerPanel items={items} config={config}
              onToggleStar={toggleStar} onToggleAlert={toggleAlert} onRemove={removeItem} />
          </Card>
        </Col>

        {/* Configuration */}
        <Col xs={24} lg={8}>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            {/* Quick Config */}
            <Card size="small" title={<Space><SettingOutlined /> 配置</Space>}>
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 12 }}>显示价格</Text>
                  <Switch size="small" checked={config.showLabels} onChange={v => setConfig(c => ({ ...c, showLabels: v }))} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 12 }}>显示涨跌</Text>
                  <Switch size="small" checked={config.showChange} onChange={v => setConfig(c => ({ ...c, showChange: v }))} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 12 }}>显示成交量</Text>
                  <Switch size="small" checked={config.showVolume} onChange={v => setConfig(c => ({ ...c, showVolume: v }))} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 12 }}>窗口置顶</Text>
                  <Switch size="small" checked={config.alwaysOnTop} onChange={v => setConfig(c => ({ ...c, alwaysOnTop: v }))} />
                </div>
              </Space>
            </Card>

            {/* Starred Summary */}
            <Card size="small" title={<Space><StarFilled style={{ color: '#faad14' }} /> 星标摘要</Space>}>
              {starredItems.map(item => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0' }}>
                  <Space size={4}>
                    <StarFilled style={{ color: '#faad14', fontSize: 10 }} />
                    <Text strong style={{ fontSize: 11 }}>{item.symbol}</Text>
                    {item.alertActive && <BellOutlined style={{ color: '#1677ff', fontSize: 10 }} />}
                  </Space>
                  <Space size={4}>
                    <Text style={{ fontSize: 11 }}>${item.price >= 1000 ? item.price.toLocaleString() : item.price.toFixed(2)}</Text>
                    <Text type={item.changePct >= 0 ? 'success' : 'danger'} strong style={{ fontSize: 11 }}>
                      {item.changePct >= 0 ? '+' : ''}{item.changePct}%
                    </Text>
                  </Space>
                </div>
              ))}
            </Card>

            {/* Upgrade */}
            <Card size="small" style={{
              background: 'linear-gradient(135deg, #722ed1, #1677ff)',
              border: 'none',
            }}>
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                <Text strong style={{ color: '#fff', fontSize: 13 }}>⭐ 桌面行情条 · 免费3只</Text>
                <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11 }}>
                  升级不限量 → 10只自选常驻桌面 + 实时更新
                </Text>
              </Space>
            </Card>
          </Space>
        </Col>
      </Row>
    </div>
  );
};

export default DesktopTickerBar;
