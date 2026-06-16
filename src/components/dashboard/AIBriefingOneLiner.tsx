// @ts-nocheck
// QUANT MOO — 一句话AI简报 (One-Line AI Briefing)
// R257 ML#2 P0-2 — 加载页第一屏简报+语音播报按钮 (4h)

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Row, Col, Space, Typography, Tag, Button, Skeleton,
  Progress, Divider, Segmented, Badge, Tooltip, Statistic, Spin
} from 'antd';
import {
  SoundOutlined, PauseOutlined, CaretRightOutlined,
  ThunderboltOutlined, RobotOutlined, RiseOutlined,
  FallOutlined, ArrowRightOutlined, ReloadOutlined,
  GlobalOutlined, CheckCircleOutlined, ExclamationCircleOutlined,
  FireOutlined, StarOutlined, RocketOutlined, WarningOutlined
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

// ── Types ──
interface AIBriefing {
  id: string;
  timestamp: number;
  market: 'us' | 'hk' | 'cn' | 'global';
  sentiment: 'bullish' | 'bearish' | 'neutral' | 'cautious' | 'excited' | 'panicked' | 'mixed';
  oneLiner: string;
  headline: string;
  summary: string;
  keyMovers: { symbol: string; name: string; changePct: number; reason: string }[];
  topFactors: { name: string; signal: string; change: string }[];
  riskLevel: 'low' | 'medium' | 'high';
  confidence: number;
  aiTip: string;
}

interface MarketPulse {
  market: string;
  name: string;
  changePct: number;
  pulse: 'strong_up' | 'up' | 'flat' | 'down' | 'strong_down';
}

// ── Mock Data ──
const mockBriefings: AIBriefing[] = [
  {
    id: 'br1', timestamp: Date.now() - 600000, market: 'us',
    sentiment: 'bullish', oneLiner: '🐂 美股强韧: AI芯片领涨, 动能因子加速',
    headline: 'NVDA +8.5% 领涨半导体, SMCI +12.1% 创年内新高',
    summary: '美股今日受AI芯片需求超预期推动。NVDA发布Blackwell Ultra带动半导体板块+2.8%。SMCI订单暴增+12.1%。动能因子IC 0.082创本周最强。FOMC会议纪要今日公布, 关注利率预期。',
    keyMovers: [
      { symbol: 'NVDA', name: 'NVIDIA', changePct: 8.5, reason: '新芯片发布' },
      { symbol: 'SMCI', name: 'Super Micro', changePct: 12.1, reason: 'AI订单暴增' },
      { symbol: 'MRVL', name: 'Marvell', changePct: 5.3, reason: 'AI芯片超预期' },
    ],
    topFactors: [
      { name: 'mom_12m1m', signal: '强多', change: '↑ IC +0.082' },
      { name: 'roe_ttm', signal: '偏多', change: '↑ IC +0.065' },
    ],
    riskLevel: 'medium', confidence: 85,
    aiTip: '建议关注NVDA MA20支撑位$142。若FOMC偏鸽, 科技股有望突破$155阻力。使用AI回测解读(1U)验证持续性。',
  },
  {
    id: 'br2', timestamp: Date.now() - 3600000, market: 'hk',
    sentiment: 'cautious', oneLiner: '⚠️ 港股分化: 腾讯+4.3% vs 阿里-3.1%, 防御为主',
    headline: '恒指-1.25% | 科技板块严重分化 | 南向资金放缓',
    summary: '港股今日承压。恒生指数-1.25%至24580。腾讯受游戏版号利好+4.3%, 但阿里因竞争加剧-3.1%。南向资金净流入放缓至12亿。价值因子减弱, 建议转向防御型配置。',
    keyMovers: [
      { symbol: '0700', name: '腾讯', changePct: 4.3, reason: '游戏版号' },
      { symbol: '9988', name: '阿里巴巴', changePct: -3.1, reason: '竞争利空' },
    ],
    topFactors: [
      { name: 'southbound_flow', signal: '偏空', change: '↓ 放缓' },
      { name: 'pe_ttm_inv', signal: '中性', change: '→ 持平' },
    ],
    riskLevel: 'medium', confidence: 72,
    aiTip: '港股权重分化加剧, 建议关注腾讯+4.3%突破能否带动板块。使用AI策略优化(1.5U)检查持仓风险敞口。',
  },
  {
    id: 'br3', timestamp: Date.now() - 7200000, market: 'global',
    sentiment: 'excited', oneLiner: '🚀 全球共振: BTC逼近10万 + AI芯片狂潮 + 黄金历史新高',
    headline: '比特币$98,450 | NVDA+8.5% | 黄金$2,685创纪录',
    summary: '全球市场今日呈现"Risk-On"格局。加密货币受ETF持续流入推动, BTC逼近10万心理关口。美股AI板块领涨。黄金避险需求叠加央行购金创新高至$2,685。关注今晚FOMC对全球流动性的指引。',
    keyMovers: [
      { symbol: 'BTC', name: 'Bitcoin', changePct: 1.3, reason: 'ETF流入' },
      { symbol: 'NVDA', name: 'NVIDIA', changePct: 8.5, reason: 'AI芯片' },
      { symbol: 'GOLD', name: 'Gold', changePct: 0.7, reason: '央行购金' },
    ],
    topFactors: [
      { name: 'btc_ret_7d', signal: '强多', change: '↑ IC 0.095' },
      { name: 'gold_momentum', signal: '强多', change: '↑ 新高' },
    ],
    riskLevel: 'high', confidence: 82,
    aiTip: 'BTC逼近10万, 突破后关注逼空行情。黄金与美股同涨暗示"Risk-On"+"避险"并存, 警惕拐点。',
  },
];

const mockPulse: MarketPulse[] = [
  { market: 'US', name: '美股', changePct: 0.5, pulse: 'up' },
  { market: 'HK', name: '港股', changePct: -1.3, pulse: 'down' },
  { market: 'CN', name: 'A股', changePct: 0.5, pulse: 'up' },
  { market: 'JP', name: '日股', changePct: 0.7, pulse: 'up' },
  { market: 'CRYPTO', name: '加密', changePct: 1.3, pulse: 'strong_up' },
  { market: 'COMMODITY', name: '商品', changePct: 0.7, pulse: 'up' },
  { market: 'FOREX', name: '外汇', changePct: 0.1, pulse: 'flat' },
];

// ── Voice TTS Button ──
const VoiceButton: React.FC<{ briefing: AIBriefing }> = ({ briefing }) => {
  const [playing, setPlaying] = useState(false);
  const togglePlay = () => {
    if (playing) {
      setPlaying(false);
      // In production: window.speechSynthesis.cancel()
    } else {
      setPlaying(true);
      // In production: speak(briefing.oneLiner + '. ' + briefing.headline + '. ' + briefing.summary)
      setTimeout(() => setPlaying(false), 8000);
    }
  };
  return (
    <Tooltip title={playing ? '暂停播报' : '语音播报（开车/跑步时听）'}>
      <Button
        type={playing ? 'primary' : 'default'}
        shape="circle"
        size="large"
        icon={playing ? <PauseOutlined /> : <SoundOutlined />}
        onClick={togglePlay}
        style={{
          animation: playing ? 'pulse 1.5s infinite' : undefined,
        }}
      />
    </Tooltip>
  );
};

// ── Market Pulse Bar ──
const MarketPulseBar: React.FC<{ pulses: MarketPulse[] }> = ({ pulses }) => {
  const pulseColor = (p: string) => {
    const m: Record<string, string> = { strong_up: '#237804', up: '#52c41a', flat: '#8c8c8c', down: '#fa8c16', strong_down: '#ff4d4f' };
    return m[p] || '#8c8c8c';
  };
  return (
    <div style={{ display: 'flex', gap: 0, marginBottom: 4 }}>
      {pulses.map(p => (
        <div key={p.market} style={{
          flex: 1, padding: '4px 8px', textAlign: 'center',
          borderRight: '1px solid #f0f0f0',
        }}>
          <Text strong style={{ fontSize: 11, color: pulseColor(p.pulse) }}>
            {p.name} {p.changePct >= 0 ? '↑' : '↓'}
          </Text>
        </div>
      ))}
    </div>
  );
};

// ── One-Liner Hero Section ──
const OneLinerHero: React.FC<{ briefing: AIBriefing }> = ({ briefing }) => {
  const emojis: Record<string, string> = {
    bullish: '🐂', bearish: '🐻', neutral: '😐', cautious: '⚠️', excited: '🚀', panicked: '😱', mixed: '🤔',
  };
  const sentimentLabel: Record<string, string> = {
    bullish: '看多', bearish: '看空', neutral: '中性', cautious: '谨慎', excited: '兴奋', panicked: '恐慌', mixed: '分化',
  };

  return (
    <div style={{ textAlign: 'center', padding: '32px 16px' }}>
      {/* Big emoji + one-liner */}
      <div style={{ fontSize: 48, marginBottom: 8 }}>{emojis[briefing.sentiment]}</div>
      <Title level={2} style={{ marginBottom: 4 }}>
        {briefing.oneLiner}
      </Title>
      <Space size={8} style={{ marginBottom: 8 }}>
        <Tag color={briefing.sentiment === 'bullish' || briefing.sentiment === 'excited' ? 'green' : briefing.sentiment === 'bearish' || briefing.sentiment === 'panicked' ? 'red' : briefing.sentiment === 'cautious' ? 'orange' : 'default'}>
          {emojis[briefing.sentiment]} {sentimentLabel[briefing.sentiment]}
        </Tag>
        <Tag color="purple">置信 {briefing.confidence}%</Tag>
        <VoiceButton briefing={briefing} />
      </Space>

      {/* Market Pulse */}
      <MarketPulseBar pulses={mockPulse} />

      {/* Headline */}
      <Text strong style={{ fontSize: 16 }}>{briefing.headline}</Text>
    </div>
  );
};

// ── Summary + Movers ──
const BriefingDetail: React.FC<{ briefing: AIBriefing }> = ({ briefing }) => (
  <Row gutter={[16, 16]}>
    {/* Summary */}
    <Col xs={24} lg={14}>
      <Card size="small" title={<Space><RobotOutlined /> AI市场总结</Space>}>
        <Paragraph style={{ fontSize: 13, lineHeight: 1.8 }}>{briefing.summary}</Paragraph>

        <Divider style={{ margin: '12px 0' }} />

        {/* Key Movers */}
        <Text strong style={{ display: 'block', marginBottom: 8 }}>今日重点关注</Text>
        {briefing.keyMovers.map(m => (
          <div key={m.symbol} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f5f5f5' }}>
            <Space size={4}>
              <Text strong style={{ fontSize: 13 }}>{m.symbol}</Text>
              <Text type="secondary" style={{ fontSize: 11 }}>{m.name}</Text>
            </Space>
            <Space size={8}>
              <Text type="secondary" style={{ fontSize: 11 }}>{m.reason}</Text>
              <Text type={m.changePct >= 0 ? 'success' : 'danger'} strong style={{ fontSize: 13 }}>
                {m.changePct >= 0 ? '+' : ''}{m.changePct}%
              </Text>
              <Button size="small" type="link" icon={<ArrowRightOutlined />}>查看</Button>
            </Space>
          </div>
        ))}
      </Card>
    </Col>

    {/* Side panel */}
    <Col xs={24} lg={10}>
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        {/* Factor Signals */}
        <Card size="small" title={<Space><ThunderboltOutlined /> 因子信号</Space>}>
          {briefing.topFactors.map(f => (
            <div key={f.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
              <Text style={{ fontSize: 12 }}>{f.name}</Text>
              <Space size={4}>
                <Tag color={f.signal.includes('多') ? 'green' : f.signal.includes('空') ? 'red' : 'default'} style={{ fontSize: 10 }}>{f.signal}</Tag>
                <Text type="secondary" style={{ fontSize: 10 }}>{f.change}</Text>
              </Space>
            </div>
          ))}
        </Card>

        {/* Risk Level */}
        <Card size="small">
          <Space direction="vertical" style={{ width: '100%' }}>
            <Space>
              <WarningOutlined style={{ color: briefing.riskLevel === 'high' ? '#ff4d4f' : briefing.riskLevel === 'medium' ? '#fa8c16' : '#52c41a' }} />
              <Text strong>风险等级: {
                briefing.riskLevel === 'high' ? '偏高' : briefing.riskLevel === 'medium' ? '中等' : '偏低'
              }</Text>
            </Space>
            <Progress
              percent={briefing.riskLevel === 'high' ? 75 : briefing.riskLevel === 'medium' ? 50 : 25}
              strokeColor={briefing.riskLevel === 'high' ? '#ff4d4f' : briefing.riskLevel === 'medium' ? '#fa8c16' : '#52c41a'}
              size="small" showInfo={false}
            />
          </Space>
        </Card>

        {/* AI Tip */}
        <Card size="small" style={{ background: '#f6ffed', border: '1px solid #b7eb8f' }}>
          <Space>
            <RocketOutlined style={{ color: '#52c41a' }} />
            <Text strong style={{ fontSize: 13 }}>AI 建议</Text>
          </Space>
          <Paragraph style={{ fontSize: 12, marginTop: 4 }}>{briefing.aiTip}</Paragraph>
          <Button size="small" type="primary" ghost block icon={<ArrowRightOutlined />}>
            AI回测解读 (1U)
          </Button>
        </Card>
      </Space>
    </Col>
  </Row>
);

// ── Main Component ──
const AIBriefingOneLiner: React.FC = () => {
  const [briefings] = useState<AIBriefing[]>(mockBriefings);
  const [activeIdx, setActiveIdx] = useState(0);
  const [loading, setLoading] = useState(false);

  const active = briefings[activeIdx];

  const marketTabs = useCallback(() => {
    return briefings.map((b, i) => ({
      key: String(i),
      label: (
        <Space size={2}>
          <Text>{b.market === 'us' ? '🇺🇸' : b.market === 'hk' ? '🇭🇰' : '🌍'}</Text>
          <Text style={{ fontSize: 12 }}>{b.market === 'us' ? '美股' : b.market === 'hk' ? '港股' : '全球'}</Text>
        </Space>
      ),
    }));
  }, [briefings]);

  return (
    <div style={{ padding: 16, maxWidth: 1200, margin: '0 auto' }}>
      {/* Market Selector */}
      <Segmented
        value={String(activeIdx)}
        onChange={v => { setLoading(true); setActiveIdx(Number(v)); setTimeout(() => setLoading(false), 600); }}
        options={marketTabs()}
        style={{ marginBottom: 16 }}
      />

      <Spin spinning={loading}>
        {/* Hero: One-liner */}
        <OneLinerHero briefing={active} />

        <Divider />

        {/* Detail */}
        <BriefingDetail briefing={active} />
      </Spin>
    </div>
  );
};

// Inject keyframes for pulse animation
const styleEl = document.createElement('style');
styleEl.textContent = `
  @keyframes pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(22, 119, 255, 0.4); }
    50% { box-shadow: 0 0 0 8px rgba(22, 119, 255, 0); }
  }
`;
document.head.appendChild(styleEl);

export default AIBriefingOneLiner;
