// @ts-nocheck
// QUANT MOO — 推送通知UI (Push Notification Center)
// R259 ML#1 P1-06 — 通知中心+个性化设置+智能摘要 (4h)

import React, { useState, useMemo } from 'react';
import {
  Card, Tabs, Tag, Space, Typography, Button, Switch, Select,
  Timeline, Badge, Row, Col, Statistic, Popconfirm, Empty,
  Divider, Segmented, Input, message
} from 'antd';
import {
  BellOutlined, BellFilled, ThunderboltOutlined, FireOutlined,
  CheckCircleOutlined, CloseCircleOutlined, SettingOutlined,
  SoundOutlined, MutedOutlined, ClockCircleOutlined,
  EyeOutlined, DeleteOutlined, CheckOutlined,
  StarOutlined, RobotOutlined, RiseOutlined, FallOutlined,
  GiftOutlined, HistoryOutlined, ReloadOutlined
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

// ── Types ──
interface NotificationItem {
  id: string;
  type: 'price_alert' | 'anomaly' | 'briefing' | 'earnings' | 'community' | 'system';
  title: string;
  body: string;
  severity: 'critical' | 'warning' | 'info' | 'success';
  timestamp: number;
  read: boolean;
  actionUrl?: string;
  actionLabel?: string;
  symbol?: string;
}

interface NotificationPrefs {
  priceAlert: boolean;
  anomalyAlert: boolean;
  dailyBriefing: boolean;
  earningsAlert: boolean;
  communityAlert: boolean;
  quietStart: number;
  quietEnd: number;
  maxPerDay: number;
  sound: boolean;
  desktop: boolean;
}

// ── Mock ──
const mockNotifications: NotificationItem[] = [
  { id: 'n1', type: 'price_alert', title: '🚀 NVDA 突破$150!', body: 'NVDA +8.5% → $148.35 · 新AI芯片发布超预期', severity: 'critical', timestamp: Date.now() - 300000, read: false, symbol: 'NVDA', actionUrl: '/chart/NVDA', actionLabel: '查看K线' },
  { id: 'n2', type: 'anomaly', title: '⚠️ SMCI 成交量异常', body: '量比5.8x · AI服务器订单暴增 · 近1年99分位', severity: 'warning', timestamp: Date.now() - 600000, read: false, symbol: 'SMCI', actionUrl: '/chart/SMCI', actionLabel: '查看详情' },
  { id: 'n3', type: 'briefing', title: '📊 今日AI简报已生成', body: '美股强韧: AI芯片领涨 · 动能因子加速 · FOMC今晚公布', severity: 'info', timestamp: Date.now() - 1800000, read: false, actionUrl: '/briefing', actionLabel: '阅读简报' },
  { id: 'n4', type: 'earnings', title: '📅 NVDA 财报预览', body: '6月25日盘后发布Q2财报 · 预期EPS $2.85 · 已连续4次超预期', severity: 'info', timestamp: Date.now() - 3600000, read: true, symbol: 'NVDA', actionUrl: '/earnings/NVDA', actionLabel: '查看预期' },
  { id: 'n5', type: 'price_alert', title: '📉 TSLA 跌破$330', body: 'TSLA -6.2% → $342.80 · 触及你的止损警报线', severity: 'warning', timestamp: Date.now() - 4800000, read: true, symbol: 'TSLA', actionUrl: '/chart/TSLA', actionLabel: '风险分析' },
  { id: 'n6', type: 'community', title: '💬 你的策略被点赞', body: 'User_8842 点赞了你的「MACD金叉策略」· 该策略本周收益+4.2%', severity: 'success', timestamp: Date.now() - 7200000, read: true, actionUrl: '/community', actionLabel: '查看' },
  { id: 'n7', type: 'system', title: '✅ 富途OpenD已连接', body: '延迟12ms · A股/港股/美股行情就绪', severity: 'success', timestamp: Date.now() - 86400000, read: true },
  { id: 'n8', type: 'anomaly', title: '🔥 黄金创历史新高', body: '$2,685 · 央行购金+地缘风险 · 相关因子IC 0.085', severity: 'warning', timestamp: Date.now() - 7200000, read: false, symbol: 'GOLD', actionUrl: '/chart/GOLD', actionLabel: '查看' },
];

// ── Notification Card ──
const NotifCard: React.FC<{ n: NotificationItem; onRead: () => void; onDismiss: () => void }> = ({ n, onRead, onDismiss }) => {
  const typeConfig: Record<string, { icon: React.ReactNode; color: string }> = {
    price_alert: { icon: <BellFilled />, color: '#fa8c16' },
    anomaly: { icon: <FireOutlined />, color: '#ff4d4f' },
    briefing: { icon: <RobotOutlined />, color: '#722ed1' },
    earnings: { icon: <ClockCircleOutlined />, color: '#1677ff' },
    community: { icon: <StarOutlined />, color: '#eb2f96' },
    system: { icon: <CheckCircleOutlined />, color: '#52c41a' },
  };
  const sevColor = { critical: 'red', warning: 'orange', info: 'blue', success: 'green' };
  const tc = typeConfig[n.type] || typeConfig.system;

  return (
    <div style={{
      padding: '8px 0', borderBottom: '1px solid #f0f0f0',
      opacity: n.read ? 0.55 : 1, background: n.read ? undefined : '#fafafa',
      cursor: 'pointer', transition: 'opacity 0.2s',
    }} onClick={onRead}>
      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
        <Space size={4}>
          <span style={{ color: tc.color }}>{tc.icon}</span>
          <Space size={4}>
            {!n.read && <Badge status="processing" />}
            <Text strong style={{ fontSize: 12 }}>{n.title}</Text>
            <Tag color={sevColor[n.severity]} style={{ fontSize: 9 }}>
              {n.severity === 'critical' ? '紧急' : n.severity === 'warning' ? '警告' : n.severity === 'info' ? '信息' : '成功'}
            </Tag>
          </Space>
        </Space>
        <Space size={4}>
          <Text type="secondary" style={{ fontSize: 10 }}>
            {Math.floor((Date.now() - n.timestamp) / 60000)}分前
          </Text>
          <Button size="small" type="text" danger style={{ padding: 0 }} icon={<DeleteOutlined />}
            onClick={e => { e.stopPropagation(); onDismiss(); }} />
        </Space>
      </Space>
      <Paragraph style={{ fontSize: 11, color: '#666', margin: '4px 0 0' }} ellipsis={{ rows: 1 }}>
        {n.body}
      </Paragraph>
      {n.actionUrl && (
        <Button size="small" type="link" style={{ padding: 0, fontSize: 11, marginTop: 2 }}>
          {n.actionLabel || '查看详情'} →
        </Button>
      )}
    </div>
  );
};

// ── Preferences Panel ──
const NotificationPrefsPanel: React.FC = () => {
  const [prefs, setPrefs] = useState<NotificationPrefs>({
    priceAlert: true, anomalyAlert: true, dailyBriefing: true,
    earningsAlert: true, communityAlert: false,
    quietStart: 22, quietEnd: 8, maxPerDay: 50, sound: true, desktop: true,
  });

  return (
    <Card size="small" title={<Space><SettingOutlined /> 通知偏好</Space>}>
      <Space direction="vertical" size={6} style={{ width: '100%' }}>
        {[
          { key: 'priceAlert', label: '🔔 价格提醒', desc: '自选股价格突破阈值' },
          { key: 'anomalyAlert', label: '🔥 异动警报', desc: '成交量/涨跌幅异常检测' },
          { key: 'dailyBriefing', label: '📊 每日简报', desc: 'AI市场早报/晚报推送' },
          { key: 'earningsAlert', label: '📅 财报提醒', desc: '自选股财报日历推送' },
          { key: 'communityAlert', label: '💬 社区动态', desc: '策略被赞/评论/跟单' },
        ].map(p => (
          <div key={p.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Text style={{ fontSize: 12 }}>{p.label}</Text>
              <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>{p.desc}</Text>
            </div>
            <Switch size="small" checked={(prefs as any)[p.key]}
              onChange={v => setPrefs(pr => ({ ...pr, [p.key]: v }))} />
          </div>
        ))}
        <Divider style={{ margin: '8px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 12 }}>🤫 免打扰时段</Text>
          <Space size={4}>
            <Select size="small" value={prefs.quietStart} style={{ width: 60 }}
              options={Array.from({ length: 24 }, (_, i) => ({ label: `${i}:00`, value: i }))} />
            <Text type="secondary">-</Text>
            <Select size="small" value={prefs.quietEnd} style={{ width: 60 }}
              options={Array.from({ length: 24 }, (_, i) => ({ label: `${i}:00`, value: i }))} />
          </Space>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 12 }}>📱 每日上限</Text>
          <Select size="small" value={prefs.maxPerDay} style={{ width: 100 }}
            options={[
              { label: '20条/天', value: 20 }, { label: '50条/天', value: 50 },
              { label: '100条/天', value: 100 }, { label: '不限制', value: 999 },
            ]} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 12 }}>🔊 提示音</Text>
          <Switch size="small" checked={prefs.sound} onChange={v => setPrefs(p => ({ ...p, sound: v }))} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 12 }}>🖥 桌面通知</Text>
          <Switch size="small" checked={prefs.desktop} onChange={v => setPrefs(p => ({ ...p, desktop: v }))} />
        </div>
        <Button size="small" type="primary" block icon={<CheckOutlined />} onClick={() => message.success('偏好已保存')}>
          保存偏好
        </Button>
      </Space>
    </Card>
  );
};

// ── Daily Digest Summary ──
const DailyDigest: React.FC<{ notifications: NotificationItem[] }> = ({ notifications }) => {
  const today = notifications.filter(n => new Date(n.timestamp).toDateString() === new Date().toDateString());
  const critical = today.filter(n => n.severity === 'critical').length;
  const warning = today.filter(n => n.severity === 'warning').length;
  const info = today.filter(n => n.severity === 'info').length;

  return (
    <Card size="small" title={<Space><HistoryOutlined /> 今日摘要</Space>}>
      <Row gutter={[8, 8]}>
        <Col span={8}>
          <Statistic title={<Text type="danger">紧急</Text>} value={critical} suffix="条" valueStyle={{ color: '#ff4d4f', fontSize: 20 }} />
        </Col>
        <Col span={8}>
          <Statistic title={<Text type="warning">警告</Text>} value={warning} suffix="条" valueStyle={{ color: '#fa8c16', fontSize: 20 }} />
        </Col>
        <Col span={8}>
          <Statistic title="今日" value={today.length} suffix="条" valueStyle={{ fontSize: 20 }} />
        </Col>
      </Row>
      <Divider style={{ margin: '8px 0' }} />
      <div style={{ background: '#e6f7ff', borderRadius: 6, padding: '8px 12px' }}>
        <Space>
          <GiftOutlined style={{ color: '#1677ff' }} />
          <Text style={{ fontSize: 11 }}>
            免费3条/天 · <Text strong>升级4.9U/月</Text> 不限量+AI摘要
          </Text>
        </Space>
      </div>
    </Card>
  );
};

// ── Main Component ──
const PushNotificationCenter: React.FC = () => {
  const [notifications, setNotifications] = useState<NotificationItem[]>(mockNotifications);
  const [filter, setFilter] = useState('all');
  const unreadCount = notifications.filter(n => !n.read).length;

  const filtered = useMemo(() => {
    if (filter === 'all') return notifications;
    if (filter === 'unread') return notifications.filter(n => !n.read);
    return notifications.filter(n => n.type === filter);
  }, [notifications, filter]);

  const markRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };
  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };
  const dismiss = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };
  const clearAll = () => {
    setNotifications([]);
  };

  return (
    <div style={{ padding: 16, maxWidth: 1200, margin: '0 auto' }}>
      <Space style={{ marginBottom: 12 }}>
        <BellOutlined style={{ fontSize: 24, color: '#fa8c16' }} />
        <Title level={3} style={{ margin: 0 }}>通知中心</Title>
        <Badge count={unreadCount} overflowCount={99} style={{ backgroundColor: '#ff4d4f' }} />
      </Space>

      <Row gutter={[12, 12]}>
        <Col xs={24} lg={17}>
          <Card size="small" extra={
            <Space size={4}>
              <Button size="small" type="link" onClick={markAllRead} disabled={unreadCount === 0}>
                全部已读
              </Button>
              <Popconfirm title="清除所有通知?" onConfirm={clearAll}>
                <Button size="small" type="link" danger>清空</Button>
              </Popconfirm>
            </Space>
          }>
            <Segmented value={filter} onChange={setFilter} style={{ marginBottom: 12 }}
              options={[
                { label: `全部 (${notifications.length})`, value: 'all' },
                { label: `未读 (${unreadCount})`, value: 'unread' },
                { label: '价格', value: 'price_alert' },
                { label: '异动', value: 'anomaly' },
                { label: '简报', value: 'briefing' },
              ]} />
            <div style={{ maxHeight: 520, overflowY: 'auto' }}>
              {filtered.map(n => (
                <NotifCard key={n.id} n={n} onRead={() => markRead(n.id)} onDismiss={() => dismiss(n.id)} />
              ))}
              {filtered.length === 0 && <Empty description="暂无通知" />}
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={7}>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <DailyDigest notifications={notifications} />
            <NotificationPrefsPanel />
          </Space>
        </Col>
      </Row>
    </div>
  );
};

export default PushNotificationCenter;
