// @ts-nocheck
// QUANT MOO — 个股K线深度页面 (Individual Stock K-Line Deep Page)
// R255 ML#1 UI-04 — 个股K线+技术分析+基本面+新闻+AI解读 (10h)

import React, { useState, useMemo } from 'react';
import {
  Card, Tabs, Table, Tag, Space, Typography, Select, Input, Button,
  Segmented, Row, Col, Statistic, Progress, Tooltip, Divider, Badge,
  Descriptions, Switch, Spin, Empty, Timeline, Popover, Slider
} from 'antd';
import {
  StockOutlined, LineChartOutlined, BarChartOutlined, FundOutlined,
  ThunderboltOutlined, FileTextOutlined, GlobalOutlined,
  CaretUpOutlined, CaretDownOutlined, MinusOutlined, ReloadOutlined,
  SettingOutlined, BellOutlined, ExpandOutlined, CompressOutlined,
  ZoomInOutlined, ZoomOutOutlined, PictureOutlined, CalculatorOutlined,
  CalendarOutlined, InfoCircleOutlined, WarningOutlined, FireOutlined,
  DollarOutlined, PieChartOutlined, NodeIndexOutlined, BranchesOutlined
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

// ── Types ──
interface KLineData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  ma5?: number;
  ma10?: number;
  ma20?: number;
  ma60?: number;
  macd?: number;
  macd_signal?: number;
  macd_hist?: number;
  rsi?: number;
  boll_upper?: number;
  boll_mid?: number;
  boll_lower?: number;
}

interface CurrentQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  open: number;
  high: number;
  low: number;
  prevClose: number;
  volume: number;
  turnover: number;
  marketCap: number;
  pe: number;
  pb: number;
  eps: number;
  dividendYield: number;
  sector: string;
  sectorCN: string;
  market: string;
  currency: string;
  status: 'trading' | 'pre' | 'post' | 'closed';
  time: string;
}

interface TechnicalIndicator {
  name: string;
  value: number;
  signal: 'bull' | 'bear' | 'neutral';
  description: string;
}

interface NewsEvent {
  id: string;
  title: string;
  source: string;
  time: number;
  sentiment: 'positive' | 'negative' | 'neutral';
  impact: 'high' | 'medium' | 'low';
  summary: string;
}

interface AIStockInsight {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  keyLevels: { level: number; type: 'support' | 'resistance'; strength: 'strong' | 'moderate' | 'weak' }[];
  recentDrivers: { event: string; impact: string; direction: 'up' | 'down' }[];
  outlook: string;
  confidence: number;
}

// ── Mock Data ──
const mockQuote: CurrentQuote = {
  symbol: 'NVDA', name: 'NVIDIA Corporation',
  price: 148.35, change: 11.65, changePct: 8.52,
  open: 141.20, high: 150.80, low: 140.50, prevClose: 136.70,
  volume: 82.3e6, turnover: 12.2e9, marketCap: 3650e9,
  pe: 72.4, pb: 38.5, eps: 2.05, dividendYield: 0.02,
  sector: 'semiconductor', sectorCN: '半导体', market: 'US',
  currency: 'USD', status: 'trading',
  time: new Date().toISOString(),
};

const mockKLines: KLineData[] = Array.from({ length: 120 }, (_, i) => {
  const date = new Date();
  date.setDate(date.getDate() - (119 - i));
  const baseClose = 136 + (i - 60) * 0.5 + Math.sin(i * 0.15) * 8;
  const open = baseClose + (Math.random() - 0.5) * 3;
  const high = Math.max(open, baseClose) + Math.random() * 5;
  const low = Math.min(open, baseClose) - Math.random() * 5;
  const volume = 60e6 + Math.random() * 40e6;
  const ma20 = baseClose + Math.sin(i * 0.3) * 2;
  return {
    date: date.toISOString().slice(0, 10),
    open: +open.toFixed(2), high: +high.toFixed(2), low: +low.toFixed(2), close: +baseClose.toFixed(2),
    volume: Math.round(volume), ma20: +ma20.toFixed(2),
  };
});

const mockIndicators: TechnicalIndicator[] = [
  { name: 'MACD', value: 2.35, signal: 'bull', description: 'MACD金叉，DIF在DEA上方且柱线为正' },
  { name: 'RSI(14)', value: 68.5, signal: 'neutral', description: 'RSI接近超买区间(>70)，但尚未触发' },
  { name: 'MA20', value: 142.30, signal: 'bull', description: '价格站上20日均线，均线向上发散' },
  { name: 'Bollinger', value: 148.35, signal: 'bull', description: '价格在上轨附近运行，波动率扩张' },
  { name: 'KDJ', value: 85.2, signal: 'bull', description: 'K>D>50，多头排列，但接近超买' },
  { name: 'Volume', value: 82.3, signal: 'bull', description: '放量突破，量比4.2x，资金明显流入' },
  { name: 'WR', value: -15.3, signal: 'bull', description: '威廉指标接近0轴，超买警示' },
  { name: 'OBV', value: 1.45, signal: 'bull', description: '能量潮持续上升，量价配合良好' },
];

const mockNews: NewsEvent[] = [
  { id: 'n1', title: 'NVIDIA发布新一代AI芯片Blackwell Ultra', source: 'Reuters', time: Date.now() - 7200000, sentiment: 'positive', impact: 'high', summary: '新芯片性能提升3倍，预计Q3量产，多家云厂商已预订' },
  { id: 'n2', title: '数据中心收入超预期，同比增长112%', source: 'Bloomberg', time: Date.now() - 18000000, sentiment: 'positive', impact: 'high', summary: 'Q2数据中心收入$32.5B，超预期$28B，AI需求持续强劲' },
  { id: 'n3', title: '美国加强对华AI芯片出口限制', source: 'WSJ', time: Date.now() - 43200000, sentiment: 'negative', impact: 'medium', summary: '新规可能限制H200/B200对华销售，影响约$5B年收入' },
  { id: 'n4', title: '机构上调目标价至$180', source: 'Morgan Stanley', time: Date.now() - 86400000, sentiment: 'positive', impact: 'medium', summary: 'MS将NVDA目标价从$150上调至$180，维持增持评级' },
  { id: 'n5', title: '台积电CoWoS封装产能翻倍', source: 'DigiTimes', time: Date.now() - 129600000, sentiment: 'positive', impact: 'low', summary: '先进封装产能扩张利好NVDA GPU供应' },
];

const mockAIInsight: AIStockInsight = {
  summary: 'NVDA处于AI芯片超级周期的核心位置。最新Blackwell Ultra发布+数据中心收入超预期是短期催化剂。估值偏高(PE 72x)但增长动能强劲(同比+112%)。',
  strengths: [
    'AI GPU市场份额>80%，近乎垄断地位',
    '数据中心收入同比+112%，增长动能强劲',
    'CUDA生态系统形成技术护城河',
    '新芯片发布周期缩短至1年，迭代加速',
  ],
  weaknesses: [
    'PE 72x估值偏高，对增长预期极度敏感',
    '中国出口管制风限$5B年收入',
    '供应链依赖台积电单一供应商',
    '竞争加剧(AMD/Intel/Google TPU)',
  ],
  keyLevels: [
    { level: 155, type: 'resistance', strength: 'strong' },
    { level: 150, type: 'resistance', strength: 'moderate' },
    { level: 135, type: 'support', strength: 'strong' },
    { level: 142, type: 'support', strength: 'moderate' },
  ],
  recentDrivers: [
    { event: 'Blackwell Ultra发布', impact: '新芯片性能3x提升', direction: 'up' },
    { event: '中国出口管制', impact: '可能影响$5B收入', direction: 'down' },
    { event: '数据中心Q2超预期', impact: '$32.5B vs $28B预期', direction: 'up' },
  ],
  outlook: '短期看多(1-3月)，中期谨慎(6月+)。建议关注MA20支撑位142，跌破考虑减仓。建议使用AI回测解读(1U)验证趋势持续性。',
  confidence: 82,
};

// ── Chart Area (simplified SVG) ──
const SimpleKLineChart: React.FC<{ data: KLineData[] }> = ({ data }) => {
  const recent = data.slice(-40);
  const allHigh = Math.max(...recent.map(d => d.high));
  const allLow = Math.min(...recent.map(d => d.low));
  const range = allHigh - allLow;
  const w = 780;
  const h = 300;
  const pad = { top: 20, right: 20, bottom: 30, left: 60 };

  const x = (i: number) => pad.left + (i / (recent.length - 1)) * (w - pad.left - pad.right);
  const y = (val: number) => pad.top + ((allHigh - val) / range) * (h - pad.top - pad.bottom);

  return (
    <div style={{ position: 'relative', border: '1px solid #f0f0f0', borderRadius: 8, overflow: 'hidden' }}>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h}>
        {/* Grid */}
        {[allHigh, (allHigh + allLow) / 2, allLow].map(v => (
          <g key={v}>
            <line x1={pad.left} y1={y(v)} x2={w - pad.right} y2={y(v)} stroke="#f0f0f0" strokeWidth={0.5} />
            <text x={pad.left - 5} y={y(v) + 4} textAnchor="end" fontSize={10} fill="#999">{v.toFixed(0)}</text>
          </g>
        ))}

        {/* Volume */}
        {recent.map((d, i) => (
          <rect key={`vol-${i}`}
            x={x(i) - 1.5} y={h - pad.bottom + 5}
            width={3} height={d.volume / 6e7}
            fill={d.close >= d.open ? 'rgba(82,196,26,0.3)' : 'rgba(255,77,79,0.3)'} />
        ))}

        {/* Candles */}
        {recent.map((d, i) => {
          const isUp = d.close >= d.open;
          const color = isUp ? '#52c41a' : '#ff4d4f';
          return (
            <g key={i}>
              <line x1={x(i)} y1={y(d.high)} x2={x(i)} y2={y(d.low)} stroke={color} strokeWidth={1} />
              <rect
                x={x(i) - 2.5} y={y(Math.max(d.open, d.close))}
                width={5} height={Math.max(1, Math.abs(y(d.open) - y(d.close)))}
                fill={isUp ? '#52c41a' : '#ff4d4f'}
              />
            </g>
          );
        })}

        {/* MA20 */}
        {recent.map((d, i) => {
          if (i === 0 || d.ma20 === undefined) return null;
          const prev = recent[i - 1];
          if (prev.ma20 === undefined) return null;
          return (
            <line key={`ma-${i}`}
              x1={x(i - 1)} y1={y(prev.ma20!)}
              x2={x(i)} y2={y(d.ma20!)}
              stroke="#fa8c16" strokeWidth={1.5} strokeDasharray="4,2" />
          );
        })}

        {/* Current price line */}
        <line x1={pad.left} y1={y(recent[recent.length - 1].close)} x2={w - pad.right} y2={y(recent[recent.length - 1].close)}
          stroke="#1677ff" strokeWidth={1} strokeDasharray="3,3" />
      </svg>
    </div>
  );
};

// ── Quote Header ──
const QuoteHeader: React.FC<{ q: CurrentQuote }> = ({ q }) => (
  <Card size="small" style={{ marginBottom: 12, background: q.changePct >= 0 ? '#f6ffed' : '#fff2f0' }}>
    <Row align="middle" justify="space-between">
      <Col>
        <Space size={4}>
          <Title level={4} style={{ margin: 0 }}>{q.symbol}</Title>
          <Text type="secondary" style={{ fontSize: 14 }}>{q.name}</Text>
          <Tag>{q.market}</Tag>
          <Badge status={q.status === 'trading' ? 'processing' : 'default'} text={q.status === 'trading' ? '交易中' : q.status} />
        </Space>
      </Col>
      <Col>
        <Space size={16}>
          <Space size={4}>
            <Title level={3} style={{ margin: 0, color: q.changePct >= 0 ? '#52c41a' : '#ff4d4f' }}>
              {q.price.toFixed(2)}
            </Title>
            <Text type="secondary">{q.currency}</Text>
          </Space>
          <Space size={4}>
            <Text type={q.changePct >= 0 ? 'success' : 'danger'} strong style={{ fontSize: 18 }}>
              {q.changePct >= 0 ? <CaretUpOutlined /> : <CaretDownOutlined />}
              {q.change >= 0 ? '+' : ''}{q.change.toFixed(2)} ({q.changePct >= 0 ? '+' : ''}{q.changePct.toFixed(2)}%)
            </Text>
          </Space>
        </Space>
      </Col>
    </Row>
    <Row gutter={[16, 8]} style={{ marginTop: 12 }}>
      {[
        { label: '开盘', value: q.open.toFixed(2) }, { label: '最高', value: q.high.toFixed(2), up: true },
        { label: '最低', value: q.low.toFixed(2), up: false }, { label: '昨收', value: q.prevClose.toFixed(2) },
        { label: '成交量', value: (q.volume / 1e6).toFixed(1) + 'M' },
        { label: '成交额', value: (q.turnover / 1e9).toFixed(1) + 'B' },
        { label: '市值', value: (q.marketCap / 1e9).toFixed(0) + 'B' },
        { label: 'PE', value: q.pe.toFixed(1) },
        { label: 'EPS', value: q.eps.toFixed(2) },
        { label: '股息率', value: q.dividendYield.toFixed(2) + '%' },
        { label: 'PB', value: q.pb.toFixed(1) },
        { label: '板块', value: q.sectorCN },
      ].map(s => (
        <Col xs={12} sm={6} md={4} lg={3} key={s.label}>
          <Text type="secondary" style={{ fontSize: 11 }}>{s.label}</Text>
          <br />
          <Text strong style={{ fontSize: 12, color: s.up === true ? '#52c41a' : s.up === false ? '#ff4d4f' : undefined }}>
            {s.value}
          </Text>
        </Col>
      ))}
    </Row>
  </Card>
);

// ── Technical Indicators Panel ──
const TechnicalPanel: React.FC<{ indicators: TechnicalIndicator[] }> = ({ indicators }) => (
  <Card title={<Space><LineChartOutlined /> 技术指标</Space>} size="small">
    <Row gutter={[8, 8]}>
      {indicators.map(ind => (
        <Col xs={24} sm={12} md={6} key={ind.name}>
          <Card size="small" bodyStyle={{ padding: '8px 10px' }}>
            <Space direction="vertical" size={2}>
              <Space>
                <Tag color={ind.signal === 'bull' ? 'green' : ind.signal === 'bear' ? 'red' : 'default'}>
                  {ind.signal === 'bull' ? '看多' : ind.signal === 'bear' ? '看空' : '中性'}
                </Tag>
                <Text strong style={{ fontSize: 13 }}>{ind.name}</Text>
              </Space>
              <Text style={{ fontSize: 16, fontFamily: 'monospace' }}>{ind.value.toFixed(2)}</Text>
              <Text type="secondary" style={{ fontSize: 10 }}>{ind.description}</Text>
            </Space>
          </Card>
        </Col>
      ))}
    </Row>
  </Card>
);

// ── AI Stock Insight Panel ──
const AIInsightPanel: React.FC<{ insight: AIStockInsight }> = ({ insight }) => (
  <Card
    title={<Space><ThunderboltOutlined style={{ color: '#722ed1' }} /> AI 深度解读 (1U)</Space>}
    size="small"
    extra={<Tag color="purple">置信度 {insight.confidence}%</Tag>}
  >
    <Paragraph style={{ fontSize: 13 }}>{insight.summary}</Paragraph>

    <Row gutter={[12, 12]}>
      {/* Strengths & Weaknesses */}
      <Col xs={24} md={12}>
        <Card size="small" title={<Text type="success">🟢 优势</Text>} bodyStyle={{ padding: '8px 12px' }}>
          {insight.strengths.map((s, i) => (
            <div key={i} style={{ fontSize: 12, marginBottom: 4 }}>• {s}</div>
          ))}
        </Card>
      </Col>
      <Col xs={24} md={12}>
        <Card size="small" title={<Text type="danger">🔴 风险</Text>} bodyStyle={{ padding: '8px 12px' }}>
          {insight.weaknesses.map((w, i) => (
            <div key={i} style={{ fontSize: 12, marginBottom: 4 }}>• {w}</div>
          ))}
        </Card>
      </Col>
    </Row>

    {/* Key Levels */}
    <Card size="small" title="📏 关键价位" bodyStyle={{ padding: '8px 12px' }} style={{ marginTop: 12 }}>
      <Row gutter={[8, 8]}>
        {insight.keyLevels.map((l, i) => (
          <Col xs={12} sm={6} key={i}>
            <Space size={2}>
              <Tag color={l.type === 'support' ? 'green' : 'red'} style={{ fontSize: 10 }}>
                {l.type === 'support' ? '支撑' : '阻力'} ({l.strength === 'strong' ? '强' : l.strength === 'moderate' ? '中' : '弱'})
              </Tag>
              <Text strong style={{ fontSize: 14 }}>${l.level}</Text>
            </Space>
          </Col>
        ))}
      </Row>
    </Card>

    {/* Drivers */}
    <Card size="small" title="📰 近期驱动" bodyStyle={{ padding: '8px 12px' }} style={{ marginTop: 12 }}>
      {insight.recentDrivers.map((d, i) => (
        <div key={i} style={{ fontSize: 12, marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
          <Space size={4}>
            <Text>{d.event}</Text>
            <Text type="secondary">{d.impact}</Text>
          </Space>
          <Tag color={d.direction === 'up' ? 'green' : 'red'}>{d.direction === 'up' ? '↑利多' : '↓利空'}</Tag>
        </div>
      ))}
    </Card>

    {/* Outlook */}
    <Card size="small" style={{ marginTop: 12, background: '#f6ffed' }}>
      <Space>
        <InfoCircleOutlined style={{ color: '#52c41a' }} />
        <Text strong>AI 展望 (1U回测解读可用)</Text>
      </Space>
      <Paragraph style={{ fontSize: 12, marginTop: 4 }}>{insight.outlook}</Paragraph>
    </Card>
  </Card>
);

// ── News Timeline ──
const NewsTimeline: React.FC<{ news: NewsEvent[] }> = ({ news }) => (
  <Card title={<Space><FileTextOutlined /> 相关新闻</Space>} size="small">
    {news.map(n => (
      <div key={n.id} style={{ padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
        <Space style={{ marginBottom: 2 }}>
          <Tag color={n.sentiment === 'positive' ? 'green' : n.sentiment === 'negative' ? 'red' : 'default'}
            style={{ fontSize: 10 }}>
            {n.sentiment === 'positive' ? '利好' : n.sentiment === 'negative' ? '利空' : '中性'}
          </Tag>
          <Tag color={n.impact === 'high' ? 'red' : n.impact === 'medium' ? 'orange' : 'default'} style={{ fontSize: 10 }}>
            {n.impact === 'high' ? '高影响' : n.impact === 'medium' ? '中影响' : '低影响'}
          </Tag>
          <Text strong style={{ fontSize: 13 }}>{n.title}</Text>
        </Space>
        <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
          <Text type="secondary">{n.source}</Text>
          <Divider type="vertical" />
          <Text type="secondary">{new Date(n.time).toLocaleDateString()}</Text>
          <Divider type="vertical" />
          <Text ellipsis style={{ maxWidth: 400 }}>{n.summary}</Text>
        </div>
      </div>
    ))}
  </Card>
);

// ── Mini Order Panel ──
const MiniOrderPanel: React.FC<{ q: CurrentQuote }> = ({ q }) => {
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  return (
    <Card size="small" title={<Space><DollarOutlined /> 快速交易</Space>}>
      <Segmented value={side} onChange={v => setSide(v as any)} block
        options={[
          { label: <Text type="success">买入</Text>, value: 'buy' },
          { label: <Text type="danger">卖出</Text>, value: 'sell' },
        ]} />
      <div style={{ marginTop: 8 }}>
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Select size="small" defaultValue="limit" style={{ width: '100%' }}
            options={[
              { label: '限价单', value: 'limit' },
              { label: '市价单', value: 'market' },
              { label: '止损单', value: 'stop' },
            ]} />
          <div style={{ display: 'flex', gap: 8 }}>
            <Input size="small" placeholder="价格" defaultValue={q.price.toFixed(2)} style={{ flex: 1 }} />
            <Input size="small" placeholder="数量" defaultValue="100" style={{ flex: 1 }} />
          </div>
          <Button type={side === 'buy' ? 'primary' : 'danger'} block size="small"
            icon={side === 'buy' ? <CaretUpOutlined /> : <CaretDownOutlined />}>
            {side === 'buy' ? '买入' : '卖出'} NVDA
          </Button>
          <Text type="secondary" style={{ fontSize: 11, textAlign: 'center', display: 'block' }}>
            交易手续费 0.1% 最低2 USDT
          </Text>
        </Space>
      </div>
    </Card>
  );
};

// ── Main Component ──
const StockKLineDeep: React.FC = () => {
  const [selectedPeriod, setSelectedPeriod] = useState('1d');
  const [chartType, setChartType] = useState<'candle' | 'line'>('candle');
  const [indicators, setIndicators] = useState<string[]>(['ma20']);

  return (
    <div style={{ padding: 16, maxWidth: 1600, margin: '0 auto' }}>
      {/* Search Bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <Input.Search
          placeholder="搜索股票代码或名称..."
          defaultValue="NVDA"
          style={{ maxWidth: 400 }}
          enterButton={<StockOutlined />}
        />
        <Space>
          <Select value={selectedPeriod} onChange={setSelectedPeriod} size="small" style={{ width: 80 }}
            options={[
              { label: '1分', value: '1m' }, { label: '5分', value: '5m' }, { label: '15分', value: '15m' },
              { label: '1时', value: '1h' }, { label: '1日', value: '1d' }, { label: '1周', value: '1w' },
            ]} />
          <Segmented size="small" value={chartType} onChange={v => setChartType(v as any)}
            options={[
              { label: 'K线', value: 'candle' },
              { label: '折线', value: 'line' },
            ]} />
          <Select size="small" mode="multiple" value={indicators} onChange={setIndicators}
            style={{ minWidth: 130 }} placeholder="指标"
            options={[
              { label: 'MA5', value: 'ma5' }, { label: 'MA10', value: 'ma10' },
              { label: 'MA20', value: 'ma20' }, { label: 'MA60', value: 'ma60' },
              { label: 'MACD', value: 'macd' }, { label: 'RSI', value: 'rsi' },
              { label: 'BOLL', value: 'boll' },
            ]} />
        </Space>
      </div>

      {/* Quote Header */}
      <QuoteHeader q={mockQuote} />

      {/* Chart */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <SimpleKLineChart data={mockKLines} />
      </Card>

      {/* Main Content */}
      <Row gutter={[12, 12]}>
        {/* Left: AI + Indicators */}
        <Col xs={24} lg={16}>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <TechnicalPanel indicators={mockIndicators} />
            <AIInsightPanel insight={mockAIInsight} />
            <NewsTimeline news={mockNews} />
          </Space>
        </Col>

        {/* Right: Order + Quick Stats */}
        <Col xs={24} lg={8}>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <MiniOrderPanel q={mockQuote} />
            <Card size="small" title={<Space><PieChartOutlined /> 资金流向</Space>}>
              <Row gutter={[8, 8]}>
                <Col span={8}>
                  <Statistic title="主力净流入" value={3.2} suffix="B" valueStyle={{ color: '#52c41a', fontSize: 16 }} />
                </Col>
                <Col span={8}>
                  <Statistic title="散户净流出" value={0.8} suffix="B" valueStyle={{ color: '#ff4d4f', fontSize: 16 }} />
                </Col>
                <Col span={8}>
                  <Statistic title="机构持仓" value={68.5} suffix="%" valueStyle={{ fontSize: 16 }} />
                </Col>
              </Row>
            </Card>
            <Card size="small" title={<Space><BranchesOutlined /> 关联股票</Space>}>
              {[{ s: 'SMCI', p: 892, c: 12.1 }, { s: 'TSM', p: 185, c: 1.8 }, { s: 'AMD', p: 185, c: 3.2 }, { s: 'ARM', p: 162, c: 2.5 }]
                .map(r => (
                  <div key={r.s} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f5f5f5' }}>
                    <Text strong style={{ fontSize: 12 }}>{r.s}</Text>
                    <Space size={4}>
                      <Text style={{ fontSize: 12 }}>${r.p}</Text>
                      <Text type={r.c >= 0 ? 'success' : 'danger'} style={{ fontSize: 11 }}>
                        {r.c >= 0 ? '+' : ''}{r.c}%
                      </Text>
                    </Space>
                  </div>
                ))}
            </Card>
          </Space>
        </Col>
      </Row>
    </div>
  );
};

export default StockKLineDeep;
