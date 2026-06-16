// @ts-nocheck
// QUANT MOO — 社交证明FOMO前端 (Social Proof FOMO)
// R260 ML#1 P2-01 — 实时社交动态+持仓证明+社区热度 (6h)

import React, { useState, useEffect, useRef } from 'react';
import {
  Card, Row, Col, Space, Typography, Tag, Button, Avatar,
  Timeline, Badge, Statistic, Divider, Tooltip, Skeleton,
  Segmented, Progress
} from 'antd';
import {
  FireOutlined, ThunderboltOutlined, StarOutlined, StarFilled,
  TeamOutlined, UserOutlined, RiseOutlined, FallOutlined,
  TrophyOutlined, RocketOutlined, EyeOutlined,
  HeartOutlined, HeartFilled, ShareAltOutlined,
  DollarOutlined, LineChartOutlined, RobotOutlined,
  MessageOutlined, BellOutlined, CrownOutlined,
  CheckCircleOutlined, GiftOutlined, SmileOutlined
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

// ── Types ──
interface SocialProof {
  id: string;
  type: 'purchase' | 'profit' | 'milestone' | 'strategy_win' | 'new_user' | 'large_trade' | 'copy_trade' | 'achievement';
  user: string;
  avatar: string;
  action: string;
  symbol?: string;
  changePct?: number;
  amount?: string;
  time: string;
  likes: number;
  comments: number;
  verified: boolean;
}

interface LeaderboardEntry {
  rank: number;
  user: string;
  avatar: string;
  strategy: string;
  return1M: number;
  return3M: number;
  winRate: number;
  followers: number;
  verified: boolean;
}

interface HotTopic {
  id: string;
  topic: string;
  posts: number;
  sentiment: 'bullish' | 'bearish' | 'mixed';
  symbol?: string;
  changePct?: number;
}

// ── Mock Data ──
const mockProofs: SocialProof[] = [
  { id: 'p1', type: 'profit', user: 'Trader_Zhao', avatar: '🐉', action: 'NVDA日内交易获利', symbol: 'NVDA', changePct: 8.5, amount: '+$4,250', time: '2分钟前', likes: 128, comments: 35, verified: true },
  { id: 'p2', type: 'strategy_win', user: 'Whale_Quant', avatar: '🐋', action: '「MACD金叉策略」本周收益', changePct: 5.2, amount: '+$8,200', time: '8分钟前', likes: 92, comments: 18, verified: true },
  { id: 'p3', type: 'large_trade', user: '匿名用户', avatar: '💼', action: 'BTC大单买入: 50 BTC @ $98,450', symbol: 'BTC', amount: '$4.92M', time: '15分钟前', likes: 45, comments: 12, verified: false },
  { id: 'p4', type: 'milestone', user: 'CryptoKing', avatar: '👑', action: 'BTC持仓突破100万美元', symbol: 'BTC', time: '25分钟前', likes: 210, comments: 48, verified: true },
  { id: 'p5', type: 'copy_trade', user: 'CopyMaster', avatar: '🎯', action: '跟单Whale_Quant赚取', changePct: 3.8, amount: '+$1,520', time: '32分钟前', likes: 56, comments: 8, verified: true },
  { id: 'p6', type: 'new_user', user: '小白股民', avatar: '🌟', action: '刚刚加入QUANT MOO', time: '刚刚', likes: 15, comments: 5, verified: false },
  { id: 'p7', type: 'achievement', user: 'AI_Strategist', avatar: '🤖', action: '解锁「连续10笔盈利」成就', time: '1小时前', likes: 320, comments: 65, verified: true },
  { id: 'p8', type: 'profit', user: 'ValueHunter', avatar: '📚', action: 'TSM持仓浮盈', symbol: 'TSM', changePct: 12.5, amount: '+$3,800', time: '1小时前', likes: 78, comments: 22, verified: true },
];

const mockLeaderboard: LeaderboardEntry[] = [
  { rank: 1, user: 'Whale_Quant', avatar: '🐋', strategy: '动量+AI组合', return1M: 18.5, return3M: 45.2, winRate: 78, followers: 1240, verified: true },
  { rank: 2, user: 'AI_Strategist', avatar: '🤖', strategy: '深度学习因子', return1M: 15.2, return3M: 38.6, winRate: 72, followers: 890, verified: true },
  { rank: 3, user: 'CryptoKing', avatar: '👑', strategy: '加密动量策略', return1M: 22.1, return3M: 52.8, winRate: 65, followers: 1560, verified: true },
  { rank: 4, user: 'Trader_Zhao', avatar: '🐉', strategy: '日内突破策略', return1M: 12.8, return3M: 28.5, winRate: 68, followers: 450, verified: true },
  { rank: 5, user: 'ValueHunter', avatar: '📚', strategy: '价值+因子混合', return1M: 9.5, return3M: 22.1, winRate: 82, followers: 320, verified: false },
];

const mockTopics: HotTopic[] = [
  { id: 't1', topic: 'NVDA 新芯片发布', posts: 485, sentiment: 'bullish', symbol: 'NVDA', changePct: 8.5 },
  { id: 't2', topic: 'BTC 冲击10万', posts: 352, sentiment: 'bullish', symbol: 'BTC', changePct: 1.3 },
  { id: 't3', topic: 'TSLA 交付不及预期', posts: 218, sentiment: 'bearish', symbol: 'TSLA', changePct: -6.2 },
  { id: 't4', topic: '港股分化讨论', posts: 156, sentiment: 'mixed' },
  { id: 't5', topic: 'FOMC 今晚公布', posts: 312, sentiment: 'mixed' },
  { id: 't6', topic: 'AI芯片板块暴涨', posts: 198, sentiment: 'bullish' },
];

// ── Social Feed Card ──
const SocialFeedCard: React.FC<{ proofs: SocialProof[] }> = ({ proofs }) => {
  const [likedSet, setLikedSet] = useState<Set<string>>(new Set());
  const toggleLike = (id: string) => {
    setLikedSet(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  };

  return (
    <div style={{ maxHeight: 560, overflowY: 'auto', paddingRight: 4 }}>
      {proofs.map(p => {
        const typeIcons: Record<string, string> = {
          profit: '💰', strategy_win: '📈', large_trade: '💼',
          milestone: '🏆', copy_trade: '🎯', new_user: '👋', achievement: '⭐',
        };
        const isSuper = p.likes > 100;
        return (
          <Card key={p.id} size="small" style={{ marginBottom: 8 }}
            bodyStyle={{ padding: '8px 10px' }}>
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                <Space size={4}>
                  <Avatar size={24} style={{ background: isSuper ? '#faad14' : '#f0f0f0', fontSize: 14 }}>
                    {p.avatar}
                  </Avatar>
                  <Space size={2} direction="vertical" style={{ lineHeight: 1.2 }}>
                    <Space size={4}>
                      <Text strong style={{ fontSize: 11 }}>{p.user}</Text>
                      {p.verified && <CheckCircleOutlined style={{ color: '#1677ff', fontSize: 10 }} />}
                    </Space>
                    <Text type="secondary" style={{ fontSize: 9 }}>{p.time}</Text>
                  </Space>
                </Space>
                {isSuper && <Tag color="gold" style={{ fontSize: 9 }}><FireOutlined /> 热门</Tag>}
              </Space>

              <div style={{ background: '#fafafa', borderRadius: 6, padding: '6px 8px', borderLeft: '3px solid #1677ff' }}>
                <Text style={{ fontSize: 11 }}>
                  {typeIcons[p.type]} {p.action}
                  {p.symbol && <Text strong> {p.symbol}</Text>}
                  {p.changePct && (
                    <Text type={p.changePct >= 0 ? 'success' : 'danger'} strong>
                      {' '}{p.changePct >= 0 ? '+' : ''}{p.changePct}%
                    </Text>
                  )}
                  {p.amount && (
                    <Text strong style={{ color: '#52c41a' }}> {p.amount}</Text>
                  )}
                </Text>
              </div>

              <Space style={{ width: '100%', justifyContent: 'flex-end' }} size={8}>
                <Button size="small" type="text" style={{ padding: '0 4px', fontSize: 10 }}
                  icon={likedSet.has(p.id) ? <HeartFilled style={{ color: '#ff4d4f' }} /> : <HeartOutlined />}
                  onClick={() => toggleLike(p.id)}>
                  {likedSet.has(p.id) ? p.likes + 1 : p.likes}
                </Button>
                <Button size="small" type="text" style={{ padding: '0 4px', fontSize: 10 }}
                  icon={<MessageOutlined />}>
                  {p.comments}
                </Button>
                <Button size="small" type="text" style={{ padding: '0 4px', fontSize: 10 }}
                  icon={<ShareAltOutlined />} />
              </Space>
            </Space>
          </Card>
        );
      })}
    </div>
  );
};

// ── Leaderboard ──
const LeaderboardPanel: React.FC<{ entries: LeaderboardEntry[] }> = ({ entries }) => (
  <Card size="small" title={<Space><TrophyOutlined /> 收益排行</Space>}
    extra={<Text type="secondary" style={{ fontSize: 10 }}>本月</Text>}>
    {entries.map(e => {
      const medal = e.rank === 1 ? '🥇' : e.rank === 2 ? '🥈' : e.rank === 3 ? '🥉' : `#${e.rank}`;
      return (
        <div key={e.rank} style={{
          padding: '6px 0', borderBottom: '1px solid #f0f0f0',
          background: e.rank <= 3 ? '#fffbe6' : undefined, borderRadius: 4,
        }}>
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Space size={4}>
              <Text style={{ fontSize: 16 }}>{medal}</Text>
              <Avatar size={20} style={{ background: '#f0f0f0', fontSize: 12 }}>{e.avatar}</Avatar>
              <Space size={2} direction="vertical" style={{ lineHeight: 1.1 }}>
                <Space size={4}>
                  <Text strong style={{ fontSize: 11 }}>{e.user}</Text>
                  {e.verified && <CheckCircleOutlined style={{ color: '#1677ff', fontSize: 9 }} />}
                </Space>
                <Text type="secondary" style={{ fontSize: 9 }}>{e.strategy}</Text>
              </Space>
            </Space>
            <Space size={8}>
              <Text type="success" strong style={{ fontSize: 13 }}>+{e.return1M}%</Text>
              <Tooltip title={`3月收益: +${e.return3M}% | 胜率: ${e.winRate}% | 粉丝: ${e.followers}`}>
                <Text type="secondary" style={{ fontSize: 10 }}>{e.followers}粉</Text>
              </Tooltip>
              <Button size="small" type="link" style={{ padding: 0, fontSize: 10 }}>跟单</Button>
            </Space>
          </Space>
        </div>
      );
    })}
  </Card>
);

// ── Hot Topics ──
const HotTopicsPanel: React.FC<{ topics: HotTopic[] }> = ({ topics }) => (
  <Card size="small" title={<Space><FireOutlined style={{ color: '#ff4d4f' }} /> 热议话题</Space>}>
    {topics.map(t => (
      <div key={t.id} style={{ padding: '4px 0', borderBottom: '1px solid #f5f5f5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space size={4}>
          <Tag color={t.sentiment === 'bullish' ? 'green' : t.sentiment === 'bearish' ? 'red' : 'default'}
            style={{ fontSize: 9 }}>
            {t.sentiment === 'bullish' ? '🐂多' : t.sentiment === 'bearish' ? '🐻空' : '🤔混'}
          </Tag>
          <Text style={{ fontSize: 12 }}>{t.topic}</Text>
          {t.changePct && (
            <Text type={t.changePct >= 0 ? 'success' : 'danger'} strong style={{ fontSize: 11 }}>
              {t.changePct >= 0 ? '+' : ''}{t.changePct}%
            </Text>
          )}
        </Space>
        <Badge count={t.posts} overflowCount={999} style={{ backgroundColor: '#1677ff' }} />
      </div>
    ))}
  </Card>
);

// ── FOMO Stats Hero ──
const FOMOHero: React.FC = () => (
  <Card size="small" style={{
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    border: 'none', marginBottom: 12,
  }}>
    <Row gutter={[16, 8]}>
      {[
        { label: '在线交易者', value: '1,248', icon: <TeamOutlined /> },
        { label: '今日盈利', value: '$32.5K', icon: <DollarOutlined /> },
        { label: '热门策略', value: '18个', icon: <StarOutlined /> },
        { label: '社区互动', value: '2.4K', icon: <MessageOutlined /> },
      ].map(s => (
        <Col span={6} key={s.label}>
          <div style={{ textAlign: 'center' }}>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>{s.icon} {s.label}</Text>
            <Text strong style={{ color: '#fff', fontSize: 18, display: 'block' }}>{s.value}</Text>
          </div>
        </Col>
      ))}
    </Row>
  </Card>
);

// ── Main Component ──
const SocialProofFOMO: React.FC = () => {
  return (
    <div style={{ padding: 16, maxWidth: 1400, margin: '0 auto' }}>
      <Space style={{ marginBottom: 12 }}>
        <FireOutlined style={{ fontSize: 24, color: '#ff4d4f' }} />
        <Title level={3} style={{ margin: 0 }}>社区广场</Title>
        <Tag color="red">LIVE</Tag>
      </Space>

      <FOMOHero />

      <Row gutter={[12, 12]}>
        {/* Center: Feed */}
        <Col xs={24} lg={15}>
          <Card size="small" title={<Space><ThunderboltOutlined /> 实时动态</Space>}
            extra={<Segmented size="small" defaultValue="all" options={[
              { label: '全部', value: 'all' }, { label: '盈利', value: 'profit' }, { label: '大单', value: 'trade' },
            ]} />}>
            <SocialFeedCard proofs={mockProofs} />
          </Card>
        </Col>

        {/* Right Sidebar */}
        <Col xs={24} lg={9}>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <LeaderboardPanel entries={mockLeaderboard} />
            <HotTopicsPanel topics={mockTopics} />

            {/* CTA */}
            <Card size="small" style={{
              background: 'linear-gradient(135deg, #52c41a, #237804)',
              border: 'none',
            }}>
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                <Text strong style={{ color: '#fff' }}>🚀 分享你的交易，获得粉丝</Text>
                <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11 }}>
                  晒单可得信用分+交易返佣
                </Text>
                <Button size="small" type="primary" ghost block>立即分享</Button>
              </Space>
            </Card>
          </Space>
        </Col>
      </Row>
    </div>
  );
};

export default SocialProofFOMO;
