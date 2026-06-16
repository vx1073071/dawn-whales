// @ts-nocheck
// QUANT MOO — 今日驾驶舱 (Today's Cockpit)
// R253 ML#1 UI-01 — 实时行情仪表板 (12h)

import React, { useState, useEffect, useMemo } from 'react';
import {
  Card, Tabs, Tag, Progress, Badge, Space, Tooltip, Statistic,
  Select, Switch, Button, Spin, Row, Col, Table, Typography, Divider,
  Segmented, Dropdown
} from 'antd';
import {
  ThunderboltOutlined, RiseOutlined, FallOutlined, FireOutlined,
  StockOutlined, LineChartOutlined, DashboardOutlined, WarningOutlined,
  ReloadOutlined, SettingOutlined, BellOutlined, EyeOutlined,
  RightOutlined, CaretUpOutlined, CaretDownOutlined, MinusOutlined,
  ApiOutlined, GlobalOutlined, CheckCircleOutlined, ExclamationCircleOutlined
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

// ── Types ──
interface MarketSnapshot {
  index: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  status: 'open' | 'pre' | 'post' | 'closed';
}

interface SectorHeat {
  sector: string;
  changePct: number;
  volume: number;
  trend: 'up' | 'down' | 'flat';
  topStock: string;
  topStockChange: number;
}

interface TopMover {
  symbol: string;
  name: string;
  price: number;
  changePct: number;
  volume: number;
  reason: string;
  severity: 'extreme' | 'major' | 'notable' | 'minor';
  catalyst: 'earnings' | 'macro' | 'sector' | 'news' | 'technical' | 'social';
}

interface FactorSnapshot {
  factor: string;
  category: string;
  signal: 'strong_bull' | 'bull' | 'neutral' | 'bear' | 'strong_bear';
  ic: number;
  sharpe: number;
  trend: string;
}

interface AIQuickTake {
  id: string;
  market: 'us' | 'hk' | 'jp' | 'crypto' | 'global';
  sentiment: 'bullish' | 'bearish' | 'neutral' | 'cautious' | 'excited';
  headline: string;
  body: string;
  confidence: number;
  keyFactors: string[];
  timestamp: number;
}

interface PricingAlert {
  symbol: string;
  name: string;
  field: string;
  threshold: number;
  current: number;
  direction: 'above' | 'below';
  triggered: number;
}

// ── Mock Data ──
const mockMarkets: MarketSnapshot[] = [
  { index: 'SPX', name: 'S&P 500', price: 6047.82, change: 32.15, changePct: 0.53, volume: 2.1e9, status: 'open' },
  { index: 'NDX', name: 'Nasdaq 100', price: 21634.50, change: 142.30, changePct: 0.66, volume: 3.8e9, status: 'open' },
  { index: 'DJI', name: 'DJIA', price: 43397.20, change: -18.40, changePct: -0.04, volume: 980e6, status: 'open' },
  { index: 'HSI', name: '恒生指数', price: 24580.90, change: -312.60, changePct: -1.25, volume: 1.5e9, status: 'closed' },
  { index: 'N225', name: '日経225', price: 41532.00, change: 285.00, changePct: 0.69, volume: 890e6, status: 'closed' },
  { index: 'BTC', name: 'Bitcoin', price: 98450.00, change: 1250.00, changePct: 1.29, volume: 28.5e9, status: 'open' },
];

const mockSectors: SectorHeat[] = [
  { sector: '半导体', changePct: 2.8, volume: 45.2, trend: 'up', topStock: 'NVDA', topStockChange: 3.2 },
  { sector: 'AI/ML', changePct: 2.1, volume: 38.7, trend: 'up', topStock: 'MSFT', topStockChange: 1.8 },
  { sector: '加密货币', changePct: 1.9, volume: 52.3, trend: 'up', topStock: 'COIN', topStockChange: 4.5 },
  { sector: '能源', changePct: -1.4, volume: 22.1, trend: 'down', topStock: 'XOM', topStockChange: -1.2 },
  { sector: '房地产', changePct: -0.8, volume: 15.6, trend: 'down', topStock: 'PLD', topStockChange: -1.5 },
  { sector: '消费', changePct: 0.3, volume: 28.9, trend: 'flat', topStock: 'AMZN', topStockChange: 0.5 },
];

const mockMovers: TopMover[] = [
  { symbol: 'NVDA', name: 'NVIDIA', price: 148.35, changePct: 8.5, volume: 82.3, reason: '新芯片发布+AI需求超预期', severity: 'extreme', catalyst: 'earnings' },
  { symbol: 'TSLA', name: 'Tesla', price: 342.80, changePct: -6.2, volume: 65.1, reason: '交付量不及预期+欧盟关税', severity: 'major', catalyst: 'news' },
  { symbol: 'SMCI', name: 'Super Micro', price: 892.00, changePct: 12.1, volume: 41.5, reason: 'AI服务器订单暴增', severity: 'extreme', catalyst: 'earnings' },
  { symbol: '0700', name: '腾讯', price: 485.60, changePct: 4.3, volume: 28.7, reason: '游戏版号+广告复苏', severity: 'notable', catalyst: 'sector' },
  { symbol: '9988', name: '阿里巴巴', price: 112.30, changePct: -3.1, volume: 35.2, reason: '竞争加剧+利润率承压', severity: 'major', catalyst: 'earnings' },
  { symbol: 'BTC', name: 'Bitcoin', price: 98450, changePct: 1.3, volume: 28.5, reason: 'ETF流入+减半效应', severity: 'notable', catalyst: 'macro' },
];

const mockFactors: FactorSnapshot[] = [
  { factor: 'mom_12m1m', category: '动量', signal: 'strong_bull', ic: 0.082, sharpe: 1.45, trend: '加速上行' },
  { factor: 'roe_ttm', category: '质量', signal: 'bull', ic: 0.065, sharpe: 1.12, trend: '稳定' },
  { factor: 'pe_ttm_inv', category: '价值', signal: 'neutral', ic: 0.031, sharpe: 0.52, trend: '减弱' },
  { factor: 'vol_20d', category: '低波', signal: 'bear', ic: -0.044, sharpe: -0.78, trend: '持续走弱' },
  { factor: 'illiq_amihud', category: '技术', signal: 'bull', ic: 0.058, sharpe: 0.95, trend: '温和上升' },
  { factor: 'btc_ret_7d', category: '加密', signal: 'strong_bull', ic: 0.095, sharpe: 1.68, trend: '强势' },
];

const mockAITakes: AIQuickTake[] = [
  {
    id: 'ai1', market: 'us', sentiment: 'bullish', headline: '美股强韧: AI芯片+消费韧性双轮驱动',
    body: 'NVDA新芯片发布带动芯片板块+3.2%。Q2消费数据超预期，SPX短期支撑位5950。动能因子IC 0.082为本周最强信号。关注今晚FOMC纪要。',
    confidence: 85, keyFactors: ['mom_12m1m', 'roe_ttm', 'sector_ai_corr'], timestamp: Date.now() - 1800000
  },
  {
    id: 'ai2', market: 'hk', sentiment: 'cautious', headline: '港股承压: 恒指-1.25%，科技板块分化',
    body: '腾讯游戏版号利好+4.3% vs 阿里竞争利空-3.1%。内资南下放缓，恒指支撑24000。价值因子减弱，防御型配置为主。',
    confidence: 72, keyFactors: ['southbound_flow', 'pe_ttm_inv', 'earning_surprise_hk'], timestamp: Date.now() - 3600000
  },
  {
    id: 'ai3', market: 'crypto', sentiment: 'excited', headline: '比特币逼近10万: ETF净流入+减半效应',
    body: 'BTC ETF连续5日净流入>3.5亿美元。减半后矿工抛压消退。加密因子IC 0.095创年内新高。关注10万突破后的逼空行情。',
    confidence: 90, keyFactors: ['btc_ret_7d', 'btc_etf_flow', 'btc_hash_rate'], timestamp: Date.now() - 7200000
  },
];

const mockAlerts: PricingAlert[] = [
  { symbol: 'NVDA', name: 'NVIDIA', field: 'MA20', threshold: 142, current: 148.35, direction: 'above', triggered: Date.now() - 300000 },
  { symbol: 'TSLA', name: 'Tesla', field: 'RSI', threshold: 70, current: 72.4, direction: 'above', triggered: Date.now() - 600000 },
  { symbol: 'BTC', name: 'Bitcoin', field: 'price', threshold: 100000, current: 98450, direction: 'below', triggered: Date.now() - 1200000 },
];

// ── Components ──

const MarketIndexCard: React.FC<{ m: MarketSnapshot }> = ({ m }) => {
  const isUp = m.change >= 0;
  return (
    <Card size="small" className="mb-2" style={{ borderLeft: `3px solid ${isUp ? '#52c41a' : '#ff4d4f'}` }}>
      <Space direction="vertical" size={0} style={{ width: '100%' }}>
        <Space>
          <Text strong>{m.index}</Text>
          <Tag color={m.status === 'open' ? 'green' : m.status === 'closed' ? 'default' : 'orange'}>
            {m.status === 'open' ? '● 交易中' : m.status === 'closed' ? '已收市' : m.status === 'pre' ? '盘前' : '盘后'}
          </Tag>
        </Space>
        <Text strong style={{ fontSize: 18 }}>{m.price.toLocaleString()}</Text>
        <Space>
          <Text type={isUp ? 'success' : 'danger'} strong>
            {isUp ? <CaretUpOutlined /> : <CaretDownOutlined />}
            {Math.abs(m.change).toFixed(2)} ({isUp ? '+' : ''}{m.changePct.toFixed(2)}%)
          </Text>
        </Space>
      </Space>
    </Card>
  );
};

const SectorHeatmap: React.FC<{ sectors: SectorHeat[] }> = ({ sectors }) => {
  const maxAbs = Math.max(...sectors.map(s => Math.abs(s.changePct)));
  return (
    <Card title="🔥 板块热度" size="small">
      {sectors.map(s => (
        <div key={s.sector} className="mb-2">
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Text>{s.sector}</Text>
            <Space size={4}>
              <Text type={s.trend === 'up' ? 'success' : s.trend === 'down' ? 'danger' : 'secondary'} strong>
                {s.trend === 'up' ? <CaretUpOutlined /> : s.trend === 'down' ? <CaretDownOutlined /> : <MinusOutlined />}
                {s.changePct > 0 ? '+' : ''}{s.changePct}%
              </Text>
            </Space>
          </Space>
          <div style={{ background: '#f0f0f0', borderRadius: 4, height: 6, overflow: 'hidden' }}>
            <div style={{
              width: `${(Math.abs(s.changePct) / maxAbs) * 100}%`,
              height: '100%',
              background: s.changePct >= 0 ? '#52c41a' : '#ff4d4f',
              borderRadius: 4,
              transition: 'width 0.3s'
            }} />
          </div>
          <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
            <EyeOutlined /> {s.topStock} {s.topStockChange > 0 ? '+' : ''}{s.topStockChange}%
          </div>
        </div>
      ))}
    </Card>
  );
};

const TopMoversTable: React.FC<{ movers: TopMover[] }> = ({ movers }) => {
  const severityColor = (s: string) => s === 'extreme' ? 'red' : s === 'major' ? 'orange' : s === 'notable' ? 'blue' : 'default';
  const catalystEmoji = (c: string) => {
    const map: Record<string, string> = { earnings: '📊', macro: '🏛️', sector: '🏭', news: '📰', technical: '📈', social: '💬' };
    return map[c] || '❓';
  };
  return (
    <Card title="⚡ 今日异动" size="small" className="mb-2">
      <div style={{ maxHeight: 340, overflowY: 'auto' }}>
        {movers.map(m => (
          <div key={m.symbol} className="mb-3" style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              <Space>
                <Tag color={severityColor(m.severity)}>{m.severity}</Tag>
                <Text strong>{m.symbol}</Text>
                <Text type="secondary">{m.name}</Text>
              </Space>
              <Text type={m.changePct >= 0 ? 'success' : 'danger'} strong>
                {m.changePct >= 0 ? '+' : ''}{m.changePct}%
              </Text>
            </Space>
            <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
              <Space size={4}>
                <Text type="secondary">{catalystEmoji(m.catalyst)} {m.reason}</Text>
              </Space>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

const FactorSignalBar: React.FC<{ factors: FactorSnapshot[] }> = ({ factors }) => {
  const signalColor = (s: string) => {
    const map: Record<string, string> = { strong_bull: '#237804', bull: '#52c41a', neutral: '#8c8c8c', bear: '#fa8c16', strong_bear: '#ff4d4f' };
    return map[s] || '#8c8c8c';
  };
  const signalLabel = (s: string) => {
    const map: Record<string, string> = { strong_bull: '强多', bull: '偏多', neutral: '中性', bear: '偏空', strong_bear: '强空' };
    return map[s] || '未知';
  };
  return (
    <Card title="🧬 因子信号" size="small">
      {factors.map(f => (
        <div key={f.factor} className="mb-2">
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Space size={4}>
              <Tag color={f.category === '动量' ? 'blue' : f.category === '质量' ? 'purple' : f.category === '价值' ? 'green' : f.category === '低波' ? 'orange' : f.category === '加密' ? 'gold' : 'default'}>
                {f.category}
              </Tag>
              <Text>{f.factor}</Text>
            </Space>
            <Space size={4}>
              <Tag color={signalColor(f.signal)}>{signalLabel(f.signal)}</Tag>
              <Text type="secondary" style={{ fontSize: 11 }}>IC {f.ic.toFixed(3)}</Text>
            </Space>
          </Space>
        </div>
      ))}
    </Card>
  );
};

const AIQuickTakePanel: React.FC<{ takes: AIQuickTake[] }> = ({ takes }) => {
  const sentimentEmoji = (s: string) => {
    const map: Record<string, string> = { bullish: '🐂', bearish: '🐻', neutral: '😐', cautious: '⚠️', excited: '🚀' };
    return map[s] || '🤖';
  };
  const sentimentColor = (s: string) => {
    const map: Record<string, string> = { bullish: 'green', bearish: 'red', neutral: 'default', cautious: 'orange', excited: 'gold' };
    return map[s] || 'default';
  };
  return (
    <Card title="🤖 AI 快评" size="small">
      {takes.map(t => (
        <div key={t.id} className="mb-3" style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
          <Space>
            <Tag color={sentimentColor(t.sentiment)}>{sentimentEmoji(t.sentiment)} {t.market.toUpperCase()}</Tag>
            <Text strong>{t.headline}</Text>
          </Space>
          <Paragraph ellipsis={{ rows: 2 }} style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{t.body}</Paragraph>
          <Space size={4} style={{ marginTop: 4 }}>
            {t.keyFactors.map(kf => <Tag key={kf} style={{ fontSize: 10 }}>{kf}</Tag>)}
            <Text type="secondary" style={{ fontSize: 10 }}>置信 {t.confidence}%</Text>
          </Space>
        </div>
      ))}
    </Card>
  );
};

const AlertBar: React.FC<{ alerts: PricingAlert[] }> = ({ alerts }) => (
  <Card size="small" style={{ background: '#fff7e6', border: '1px solid #faad14' }}>
    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
      <Space>
        <WarningOutlined style={{ color: '#faad14' }} />
        <Text strong>定价警报</Text>
      </Space>
      <Space size={16}>
        {alerts.map(a => (
          <Tag key={a.symbol} color="warning">
            {a.symbol} {a.field} {a.direction === 'above' ? '>=' : '<='} {a.threshold} → {a.current}
          </Tag>
        ))}
      </Space>
    </Space>
  </Card>
);

// ── Main Cockpit ──
const QuantMooCockpit: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedMarket, setSelectedMarket] = useState('all');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => {
      setLoading(true);
      setTimeout(() => setLoading(false), 800);
    }, refreshInterval * 1000);
    return () => clearInterval(timer);
  }, [autoRefresh, refreshInterval]);

  const overviewEl = (
    <Spin spinning={loading}>
      <div style={{ padding: '12px 0' }}>
        {mockAlerts.length > 0 && <AlertBar alerts={mockAlerts} />}
        <Divider orientation="left" style={{ fontSize: 13, margin: '12px 0 8px' }}>
          <GlobalOutlined /> 全球指数
        </Divider>
        <Row gutter={[8, 8]}>
          {mockMarkets.map(m => (
            <Col xs={12} sm={8} md={8} lg={4} key={m.index}>
              <MarketIndexCard m={m} />
            </Col>
          ))}
        </Row>
        <Divider orientation="left" style={{ fontSize: 13, margin: '12px 0 8px' }}>
          <StockOutlined /> 概览面板
        </Divider>
        <Row gutter={[8, 8]}>
          <Col xs={24} md={12} lg={8}>
            <SectorHeatmap sectors={mockSectors} />
          </Col>
          <Col xs={24} md={12} lg={8}>
            <TopMoversTable movers={mockMovers} />
          </Col>
          <Col xs={24} md={12} lg={8}>
            <FactorSignalBar factors={mockFactors} />
          </Col>
        </Row>
        <Divider orientation="left" style={{ fontSize: 13, margin: '12px 0 8px' }}>
          <ThunderboltOutlined /> AI 快评
        </Divider>
        <Row gutter={[8, 8]}>
          {mockAITakes.map(t => (
            <Col xs={24} md={12} lg={8} key={t.id}>
              <AIQuickTakePanel takes={[t]} />
            </Col>
          ))}
        </Row>
      </div>
    </Spin>
  );

  return (
    <div style={{ padding: 16, maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <DashboardOutlined style={{ fontSize: 24, color: '#1677ff' }} />
          <Title level={3} style={{ margin: 0 }}>QUANT MOO 今日驾驶舱</Title>
        </Space>
        <Space>
          <Select size="small" value={selectedMarket} onChange={setSelectedMarket} style={{ width: 100 }}
            options={[
              { label: '全部', value: 'all' }, { label: '美股', value: 'us' },
              { label: '港股', value: 'hk' }, { label: '日股', value: 'jp' }, { label: '加密', value: 'crypto' }
            ]} />
          <Tooltip title="自动刷新">
            <Switch size="small" checked={autoRefresh} onChange={setAutoRefresh} />
          </Tooltip>
          <Select size="small" value={refreshInterval} onChange={setRefreshInterval} style={{ width: 80 }}
            options={[{ label: '10s', value: 10 }, { label: '30s', value: 30 }, { label: '60s', value: 60 }]} />
          <Button size="small" icon={<ReloadOutlined />} onClick={() => { setLoading(true); setTimeout(() => setLoading(false), 800); }}>
            刷新
          </Button>
        </Space>
      </div>

      {/* Tabs */}
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
        { key: 'overview', label: <span><EyeOutlined /> 概览</span>, children: overviewEl },
        { key: 'movers', label: <span><FireOutlined /> 异动</span>, children: <TopMoversTable movers={mockMovers} /> },
        { key: 'factors', label: <span><LineChartOutlined /> 因子</span>, children: <FactorSignalBar factors={mockFactors} /> },
        { key: 'ai', label: <span><ThunderboltOutlined /> AI 快评</span>, children: <AIQuickTakePanel takes={mockAITakes} /> },
      ]} />
    </div>
  );
};

export default QuantMooCockpit;
