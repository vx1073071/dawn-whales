// @ts-nocheck
// QUANT MOO — AI快评按钮嵌入 (AI Quick Take Embedded Button)
// R258 ML#3 P1-02 — 浮动AI按钮+嵌入式快评+一键回测CTA (3h)

import React, { useState, useEffect, useRef } from 'react';
import {
  Button, Card, Space, Typography, Tag, Progress, Divider,
  Tooltip, Badge, Popover, Drawer, Segmented, message
} from 'antd';
import {
  RobotOutlined, ThunderboltOutlined, ArrowRightOutlined,
  CloseOutlined, ReloadOutlined, SoundOutlined,
  StarOutlined, QuestionCircleOutlined, BulbOutlined,
  FundOutlined, LineChartOutlined, DollarOutlined,
  BellOutlined, FireOutlined, CaretUpOutlined, CaretDownOutlined,
  RocketOutlined
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

// ── Types ──
interface AIQuickTakeResult {
  id: string;
  context: string; // what triggered it (page, stock, event)
  timestamp: number;
  sentiment: 'bullish' | 'bearish' | 'neutral' | 'cautious' | 'excited';
  headline: string;
  body: string;
  confidence: number;
  keyFactors: string[];
  actionableInsight: string;
  ctaType: 'backtest' | 'strategy' | 'chart' | 'order' | 'news';
  ctaLabel: string;
  ctaUrl: string;
  cost: number; // USDT
  free?: boolean;
}

// ── Mock ──
const getMockTake = (context: string): AIQuickTakeResult => ({
  id: `ai-${Date.now()}`,
  context,
  timestamp: Date.now(),
  sentiment: context.includes('NVDA') ? 'bullish' : context.includes('TSLA') ? 'bearish' : 'neutral',
  headline: context.includes('NVDA')
    ? '🐂 NVDA 短期看多: 技术面多头排列+基本面AI芯片强劲'
    : context.includes('TSLA')
      ? '🐻 TSLA 短期承压: 交付不及预期+技术面跌破MA60'
      : '📊 当前市场中性偏多，动能因子加速上行',
  body: context.includes('NVDA')
    ? '技术面: MACD金叉+放量突破MA20+RSI 68.5(未超买)。基本面: Q2数据中心收入+112%超预期，Blackwell Ultra发布形成新催化剂。建议设置止盈$175, 止损$128。'
    : context.includes('TSLA')
      ? '技术面: MACD死叉+跌破MA60+RSI 32(接近超卖)。基本面: Q2交付量不及预期，欧盟关税提高压缩利润率。建议观望等企稳信号。'
      : '当前市场动能因子IC=0.082为本周最强信号，价值因子持续走弱。建议关注AI芯片+加密板块的联动效应。',
  confidence: 82,
  keyFactors: ['mom_12m1m', 'roe_ttm', 'sector_ai_corr'],
  actionableInsight: context.includes('NVDA')
    ? '建议用AI回测解读验证NVDA突破$155的持续性 (1U)'
    : context.includes('TSLA')
      ? '建议用AI策略健康检查评估TSLA持仓风险 (1U)'
      : '建议查看今日最强因子组合 (免费)',
  ctaType: 'backtest',
  ctaLabel: 'AI回测解读 (1U)',
  ctaUrl: '/backtest',
  cost: 1,
});

// ── FAB Button ──
const AIFAB: React.FC<{
  onClick: () => void;
  loading: boolean;
  unread: boolean;
}> = ({ onClick, loading, unread }) => (
  <Tooltip title="AI快评：一键分析当前股票/市场" placement="left">
    <Button
      type="primary"
      shape="circle"
      size="large"
      icon={<RobotOutlined style={{ fontSize: 20 }} />}
      loading={loading}
      onClick={onClick}
      style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 1000,
        width: 56, height: 56, boxShadow: '0 4px 16px rgba(22,119,255,0.4)',
        animation: unread ? 'pulse-ai 2s infinite' : undefined,
      }}
    >
      {unread && <Badge dot style={{ position: 'absolute', top: 4, right: 4 }} />}
    </Button>
  </Tooltip>
);

// ── Quick Take Card ──
const QuickTakeCard: React.FC<{
  take: AIQuickTakeResult;
  onDismiss: () => void;
  onAction: (cta: string) => void;
}> = ({ take, onDismiss, onAction }) => {
  const sentEmoji: Record<string, string> = { bullish: '🐂', bearish: '🐻', neutral: '😐', cautious: '⚠️', excited: '🚀' };
  const sentColor: Record<string, string> = { bullish: 'green', bearish: 'red', neutral: 'default', cautious: 'orange', excited: 'gold' };

  return (
    <Card
      size="small"
      style={{
        width: 340, boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
        borderLeft: `4px solid ${sentColor[take.sentiment] === 'green' ? '#52c41a' : sentColor[take.sentiment] === 'red' ? '#ff4d4f' : '#fa8c16'}`,
      }}
      title={
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space size={4}>
            <RobotOutlined style={{ color: '#722ed1' }} />
            <Text strong style={{ fontSize: 13 }}>AI 快评</Text>
            <Tag color="purple" style={{ fontSize: 9 }}>{take.cost}U</Tag>
          </Space>
          <Space size={4}>
            <Text type="secondary" style={{ fontSize: 10 }}>
              置信 {take.confidence}%
            </Text>
            <Button size="small" type="text" icon={<CloseOutlined />} onClick={onDismiss} />
          </Space>
        </Space>
      }
      actions={[
        <Button key="action" type="primary" size="small" icon={<ArrowRightOutlined />}
          onClick={() => onAction(take.ctaUrl)}>
          {take.ctaLabel}
        </Button>,
        <Button key="dismiss" size="small" onClick={onDismiss}>关闭</Button>,
      ]}
    >
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        {/* Headline */}
        <Space>
          <Text style={{ fontSize: 28 }}>{sentEmoji[take.sentiment]}</Text>
          <Text strong style={{ fontSize: 14, lineHeight: 1.3 }}>{take.headline}</Text>
        </Space>

        {/* Body */}
        <Paragraph ellipsis={{ rows: 3 }} style={{ fontSize: 12, color: '#666', margin: 0 }}>
          {take.body}
        </Paragraph>

        {/* Key factors */}
        <Space size={2} wrap>
          {take.keyFactors.map(kf => (
            <Tag key={kf} style={{ fontSize: 9 }}>{kf}</Tag>
          ))}
        </Space>

        {/* Insight */}
        <Card size="small" style={{ background: take.free ? '#f6ffed' : '#fffbe6' }}>
          <Space>
            <BulbOutlined style={{ color: '#faad14' }} />
            <Text style={{ fontSize: 11 }}>{take.actionableInsight}</Text>
          </Space>
        </Card>
      </Space>
    </Card>
  );
};

// ── Embedded Inline Button (for embedding inside other pages) ──
const AIInlineButton: React.FC<{
  context?: string;
  variant?: 'default' | 'compact';
  label?: string;
}> = ({ context = 'market', variant = 'default', label }) => {
  const [result, setResult] = useState<AIQuickTakeResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleClick = () => {
    setLoading(true);
    setTimeout(() => {
      setResult(getMockTake(context));
      setLoading(false);
    }, 800);
  };

  if (variant === 'compact') {
    return (
      <Tooltip title="AI快评: 一键分析当前股票">
        <Button
          size="small"
          type="text"
          icon={<RobotOutlined style={{ color: '#722ed1' }} />}
          loading={loading}
          onClick={handleClick}
        >
          {label || 'AI快评'}
        </Button>
      </Tooltip>
    );
  }

  return (
    <div>
      <Button
        size="small"
        icon={<RobotOutlined />}
        loading={loading}
        onClick={handleClick}
        style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', border: 'none' }}
      >
        {label || 'AI快评 (1U)'}
      </Button>
      {result && (
        <div style={{ marginTop: 8 }}>
          <QuickTakeCard
            take={result}
            onDismiss={() => setResult(null)}
            onAction={(url) => message.info(`跳转到 ${url}`)}
          />
        </div>
      )}
    </div>
  );
};

// ── AI Drawer (slide-in from right) ──
const AIDrawer: React.FC<{
  open: boolean;
  onClose: () => void;
  context?: string;
}> = ({ open, onClose, context }) => {
  const [take, setTake] = useState<AIQuickTakeResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setLoading(true);
      setTake(null);
      setTimeout(() => {
        setTake(getMockTake(context || 'market'));
        setLoading(false);
      }, 600);
    }
  }, [open, context]);

  return (
    <Drawer
      title={<Space><RobotOutlined style={{ color: '#722ed1' }} /> AI 快评 <Tag color="purple">{take?.cost || 1}U/次</Tag></Space>}
      placement="right"
      width={380}
      open={open}
      onClose={onClose}
      extra={
        <Button size="small" type="text" icon={<ReloadOutlined />}
          onClick={() => { setLoading(true); setTimeout(() => { setTake(getMockTake(context || 'market')); setLoading(false); }, 500); }}>
          重新分析
        </Button>
      }
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <RobotOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
          <Paragraph style={{ marginTop: 16, color: '#999' }}>AI正在分析...</Paragraph>
          <Progress percent={100} status="active" showInfo={false} />
        </div>
      ) : take ? (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          {/* Sentiment badge */}
          <div style={{ textAlign: 'center' }}>
            <Tag color={take.sentiment === 'bullish' || take.sentiment === 'excited' ? 'green' : take.sentiment === 'bearish' ? 'red' : 'orange'}
              style={{ fontSize: 14, padding: '4px 16px' }}>
              {take.sentiment === 'bullish' ? '🐂 看多' : take.sentiment === 'bearish' ? '🐻 看空' : take.sentiment === 'excited' ? '🚀 兴奋' : take.sentiment === 'cautious' ? '⚠️ 谨慎' : '😐 中性'}
            </Tag>
          </div>

          <Card size="small">
            <Text strong>{take.headline}</Text>
            <Paragraph style={{ marginTop: 8, fontSize: 13 }}>{take.body}</Paragraph>
          </Card>

          {/* Factors */}
          <Card size="small" title="🧬 相关因子">
            <Space wrap>
              {take.keyFactors.map(f => <Tag key={f}>{f}</Tag>)}
            </Space>
          </Card>

          {/* Actionable */}
          <Card size="small" style={{ background: '#fffbe6' }}>
            <Space>
              <BulbOutlined style={{ color: '#faad14' }} />
              <Text style={{ fontSize: 12 }}>{take.actionableInsight}</Text>
            </Space>
          </Card>

          {/* CTA */}
          <Button type="primary" block size="large" icon={<RocketOutlined />}>
            {take.ctaLabel}
          </Button>

          <Text type="secondary" style={{ fontSize: 10, textAlign: 'center', display: 'block' }}>
            分析置信度: {take.confidence}% · 每次消费 {take.cost} USDT · 免费3次/天
          </Text>
        </Space>
      ) : null}
    </Drawer>
  );
};

// ── Main Export: All three variants ──
export { AIFAB, AIInlineButton, AIDrawer, QuickTakeCard };

// ── Demo page showing all variants ──
const AIQuickTakeDemo: React.FC = () => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [fabCount, setFabCount] = useState(0);

  return (
    <div style={{ padding: 16, maxWidth: 800, margin: '0 auto' }}>
      <Title level={3}>AI快评按钮 · 三种嵌入方式</Title>

      <Space direction="vertical" size={24} style={{ width: '100%' }}>
        {/* Variant 1: Floating FAB + Drawer */}
        <Card size="small" title="方式1: FAB悬浮按钮 + AI抽屉">
          <Text type="secondary" style={{ fontSize: 12 }}>
            固定在页面右下角的浮动按钮，点击滑出AI分析抽屉。适合全局嵌入。
          </Text>
          <div style={{ marginTop: 12 }}>
            <Button type="primary" onClick={() => setDrawerOpen(true)} icon={<RobotOutlined />}>
              模拟FAB点击 → 打开AI快评
            </Button>
          </div>
        </Card>

        {/* Variant 2: Inline with card */}
        <Card size="small" title="方式2: 内联按钮 + 卡片弹出">
          <Text type="secondary" style={{ fontSize: 12 }}>
            嵌入在行情页/策略页的具体位置，点击后在原位展开分析卡片。适合个股/策略页面。
          </Text>
          <div style={{ marginTop: 12 }}>
            <AIInlineButton context="NVDA" label="分析NVDA" />
          </div>
        </Card>

        {/* Variant 3: Compact inline */}
        <Card size="small" title="方式3: 紧凑按钮(无卡片)">
          <Text type="secondary" style={{ fontSize: 12 }}>
            极简按钮，适合顶部工具栏嵌入。点击仅触发toast/message，不展开卡片。
          </Text>
          <div style={{ marginTop: 12 }}>
            <Space>
              <AIInlineButton context="TSLA" variant="compact" label="TSLA快评" />
              <AIInlineButton context="BTC" variant="compact" label="BTC快评" />
              <AIInlineButton context="market" variant="compact" label="大盘快评" />
            </Space>
          </div>
        </Card>
      </Space>

      <AIDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} context="NVDA" />
    </div>
  );
};

export default AIQuickTakeDemo;
