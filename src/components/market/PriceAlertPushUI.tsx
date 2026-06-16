// @ts-nocheck
// QUANT MOO — 价格提醒推送UI (Price Alert Push Notification)
// R257 ML#1 P0-1 — 自选提醒设置面板+推送卡片+CTA (8h)

import React, { useState, useMemo } from 'react';
import {
  Card, Switch, InputNumber, Button, Space, Typography, Select, Tag,
  Table, Tabs, Badge, Modal, Form, Row, Col, Statistic, Divider,
  Progress, Tooltip, Popconfirm, Timeline, Segmented, message, Empty
} from 'antd';
import {
  BellOutlined, BellFilled, PlusOutlined, DeleteOutlined,
  SettingOutlined, ThunderboltOutlined, RiseOutlined,
  FallOutlined, CaretUpOutlined, CaretDownOutlined,
  CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined,
  HistoryOutlined, DollarOutlined, GiftOutlined, StarOutlined,
  ApiOutlined, ArrowRightOutlined, RobotOutlined
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

// ── Types ──
interface PriceAlert {
  id: string;
  symbol: string;
  name: string;
  market: string;
  currentPrice: number;
  type: 'price_up' | 'price_down' | 'change_pct' | 'volume_spike' | 'breakout' | 'earnings';
  threshold: number;
  direction?: 'above' | 'below';
  enabled: boolean;
  triggeredLast?: number;
  lastTriggered?: number;
  cooldownMinutes: number;
  notifyVia: ('desktop' | 'mobile')[];
}

interface PushNotification {
  id: string;
  symbol: string;
  name: string;
  type: string;
  title: string;
  body: string;
  changePct: number;
  severity: 'extreme' | 'major' | 'notable' | 'info';
  timestamp: number;
  read: boolean;
  actionUrl: string;
  actionLabel: string;
}

interface AlertStats {
  totalAlerts: number;
  activeAlerts: number;
  triggeredToday: number;
  triggeredThisWeek: number;
  ctaClicks: number;
  conversionRate: number;
}

// ── Mock Data ──
const mockAlerts: PriceAlert[] = [
  { id: 'a1', symbol: 'NVDA', name: 'NVIDIA', market: 'US', currentPrice: 148.35, type: 'price_up', threshold: 155, direction: 'above', enabled: true, cooldownMinutes: 30, notifyVia: ['desktop', 'mobile'], triggeredLast: Date.now() - 600000, lastTriggered: 3 },
  { id: 'a2', symbol: 'NVDA', name: 'NVIDIA', market: 'US', currentPrice: 148.35, type: 'price_down', threshold: 135, direction: 'below', enabled: true, cooldownMinutes: 30, notifyVia: ['desktop'], lastTriggered: 1 },
  { id: 'a3', symbol: 'TSLA', name: 'Tesla', market: 'US', currentPrice: 342.80, type: 'price_down', threshold: 330, direction: 'below', enabled: true, cooldownMinutes: 60, notifyVia: ['desktop', 'mobile'], lastTriggered: 2 },
  { id: 'a4', symbol: '0700', name: '腾讯', market: 'HK', currentPrice: 485.60, type: 'change_pct', threshold: 5, enabled: true, cooldownMinutes: 60, notifyVia: ['mobile'], lastTriggered: 0 },
  { id: 'a5', symbol: 'BTC', name: 'Bitcoin', market: 'CRYPTO', currentPrice: 98450, type: 'price_up', threshold: 100000, direction: 'above', enabled: true, cooldownMinutes: 15, notifyVia: ['desktop', 'mobile'], triggeredLast: Date.now() - 300000, lastTriggered: 5 },
  { id: 'a6', symbol: '9988', name: '阿里巴巴', market: 'HK', currentPrice: 112.30, type: 'price_down', threshold: 108, direction: 'below', enabled: false, cooldownMinutes: 60, notifyVia: ['desktop'], lastTriggered: 0 },
  { id: 'a7', symbol: 'SMCI', name: 'Super Micro', market: 'US', currentPrice: 892.00, type: 'volume_spike', threshold: 3, enabled: true, cooldownMinutes: 30, notifyVia: ['desktop'], lastTriggered: 1 },
  { id: 'a8', symbol: 'MSFT', name: 'Microsoft', market: 'US', currentPrice: 468.50, type: 'breakout', threshold: 475, direction: 'above', enabled: true, cooldownMinutes: 60, notifyVia: ['mobile'], lastTriggered: 0 },
  { id: 'a9', symbol: 'ETH', name: 'Ethereum', market: 'CRYPTO', currentPrice: 4520, type: 'change_pct', threshold: 3, enabled: true, cooldownMinutes: 15, notifyVia: ['desktop', 'mobile'], lastTriggered: 2 },
];

const mockNotifications: PushNotification[] = [
  { id: 'n1', symbol: 'NVDA', name: 'NVIDIA', type: 'price_up', title: '🚀 NVDA 突破$150!', body: 'NVDA +8.5% → $148.35 | 新AI芯片发布超预期 | 成交82.3M', changePct: 8.5, severity: 'extreme', timestamp: Date.now() - 600000, read: false, actionUrl: '/chart/NVDA', actionLabel: 'AI解读 →' },
  { id: 'n2', symbol: 'BTC', name: 'Bitcoin', type: 'price_up', title: '₿ BTC 逼近10万!', body: 'BTC +1.3% → $98,450 | ETF连续5日净流入', changePct: 1.3, severity: 'major', timestamp: Date.now() - 300000, read: false, actionUrl: '/chart/BTC', actionLabel: '查看详情 →' },
  { id: 'n3', symbol: 'TSLA', name: 'Tesla', type: 'price_down', title: '⚠️ TSLA -6.2%', body: '交付量不及预期 + 欧盟关税提高', changePct: -6.2, severity: 'major', timestamp: Date.now() - 1200000, read: true, actionUrl: '/chart/TSLA', actionLabel: '风险分析 →' },
  { id: 'n4', symbol: 'SMCI', name: 'Super Micro', type: 'volume_spike', title: '📊 SMCI 放量突破', body: '量比5.8x | AI服务器订单暴增', changePct: 12.1, severity: 'extreme', timestamp: Date.now() - 2400000, read: true, actionUrl: '/chart/SMCI', actionLabel: '查看策略 →' },
  { id: 'n5', symbol: '0700', name: '腾讯', type: 'breakout', title: '📈 0700 突破485', body: '+4.3% | 游戏版号+广告复苏 | 突破60日均线', changePct: 4.3, severity: 'notable', timestamp: Date.now() - 3600000, read: true, actionUrl: '/chart/0700', actionLabel: 'AI解读 →' },
  { id: 'n6', symbol: '9988', name: '阿里巴巴', type: 'earnings', title: '📅 9988 财报预览', body: '6月25日盘后发布Q2财报 | 预期EPS ¥8.50', changePct: 0, severity: 'info', timestamp: Date.now() - 7200000, read: true, actionUrl: '/earnings/9988', actionLabel: '查看预期 →' },
];

const mockStats: AlertStats = {
  totalAlerts: 9,
  activeAlerts: 8,
  triggeredToday: 12,
  triggeredThisWeek: 47,
  ctaClicks: 28,
  conversionRate: 59.6,
};

// ── Alert Settings Form ──
const AlertForm: React.FC<{
  visible: boolean;
  onClose: () => void;
  onSave: (alert: Partial<PriceAlert>) => void;
  editAlert?: PriceAlert;
}> = ({ visible, onClose, onSave, editAlert }) => {
  const [form] = Form.useForm();
  return (
    <Modal title={editAlert ? '编辑提醒' : '新建提醒'} open={visible} onCancel={onClose}
      onOk={() => { form.validateFields().then(v => { onSave(v); onClose(); }); }}
      okText="保存">
      <Form form={form} layout="vertical" initialValues={editAlert || { type: 'price_up', cooldownMinutes: 30, notifyVia: ['desktop'] }}>
        <Form.Item label="股票" name="symbol" rules={[{ required: true }]}>
          <Select showSearch placeholder="搜索股票代码..." options={[
            { label: 'NVDA - NVIDIA', value: 'NVDA' }, { label: 'TSLA - Tesla', value: 'TSLA' },
            { label: 'BTC - Bitcoin', value: 'BTC' }, { label: '0700 - 腾讯', value: '0700' },
            { label: '9988 - 阿里巴巴', value: '9988' }, { label: 'ETH - Ethereum', value: 'ETH' },
          ]} />
        </Form.Item>
        <Form.Item label="提醒类型" name="type">
          <Select options={[
            { label: '📈 价格上涨到', value: 'price_up' }, { label: '📉 价格下跌到', value: 'price_down' },
            { label: '📊 涨跌幅超', value: 'change_pct' }, { label: '🔥 成交量放大', value: 'volume_spike' },
            { label: '💥 突破关键位', value: 'breakout' }, { label: '📅 财报发布', value: 'earnings' },
          ]} />
        </Form.Item>
        <Form.Item label="阈值" name="threshold" rules={[{ required: true }]}>
          <InputNumber style={{ width: '100%' }} placeholder="如: 155" />
        </Form.Item>
        <Form.Item label="冷却时间" name="cooldownMinutes">
          <Select options={[
            { label: '15分钟', value: 15 }, { label: '30分钟', value: 30 },
            { label: '1小时', value: 60 }, { label: '4小时', value: 240 },
            { label: '1天', value: 1440 },
          ]} />
        </Form.Item>
        <Form.Item label="通知渠道" name="notifyVia">
          <Select mode="multiple" options={[
            { label: '🖥 桌面通知', value: 'desktop' }, { label: '📱 移动推送', value: 'mobile' },
          ]} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

// ── Alert List Panel ──
const AlertList: React.FC<{
  alerts: PriceAlert[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (alert: PriceAlert) => void;
}> = ({ alerts, onToggle, onDelete, onEdit }) => (
  <Card title={<Space><BellFilled style={{ color: '#fa8c16' }} /> 我的提醒</Space>} size="small"
    extra={
      <Space>
        <Tag>{alerts.filter(a => a.enabled).length}/{alerts.length} 启用</Tag>
        <Text type="secondary" style={{ fontSize: 11 }}>
          免费3只 · <Text type="danger">不限量 4.9U/月</Text>
        </Text>
      </Space>
    }>
    <div style={{ maxHeight: 480, overflowY: 'auto' }}>
      {alerts.map(a => (
        <div key={a.id} style={{ padding: '6px 0', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space size={4}>
            <Switch size="small" checked={a.enabled} onChange={() => onToggle(a.id)} />
            <Space size={2} direction="vertical" style={{ lineHeight: 1.1 }}>
              <Space size={4}>
                <Text strong style={{ fontSize: 12 }}>{a.symbol}</Text>
                <Text type="secondary" style={{ fontSize: 10 }}>{a.name}</Text>
              </Space>
              <Space size={4}>
                <Tag style={{ fontSize: 9, padding: '0 3px' }}>
                  {a.type === 'price_up' ? '📈 涨到' : a.type === 'price_down' ? '📉 跌到' : a.type === 'change_pct' ? '📊 涨跌超' : a.type === 'volume_spike' ? '🔥 放量' : a.type === 'breakout' ? '💥 突破' : '📅 财报'}
                </Tag>
                <Text style={{ fontSize: 11 }}>
                  {a.threshold}{a.type === 'change_pct' ? '%' : a.type === 'volume_spike' ? 'x' : ''}
                </Text>
                <Text type="secondary" style={{ fontSize: 9 }}>· {a.cooldownMinutes}分冷却</Text>
              </Space>
            </Space>
          </Space>
          <Space size={4}>
            {a.lastTriggered && a.lastTriggered > 0 && (
              <Tooltip title={`今日触发${a.lastTriggered}次`}>
                <Badge count={a.lastTriggered} overflowCount={9} size="small" />
              </Tooltip>
            )}
            <Button size="small" type="text" icon={<SettingOutlined />} onClick={() => onEdit(a)} />
            <Popconfirm title="删除此提醒?" onConfirm={() => onDelete(a.id)}>
              <Button size="small" type="text" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Space>
        </div>
      ))}
      {alerts.length === 0 && <Empty description={'暂无提醒，点击「新建」添加'} />}
    </div>
  </Card>
);

// ── Notification Panel ──
const NotificationPanel: React.FC<{
  notifications: PushNotification[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
}> = ({ notifications, onMarkRead, onMarkAllRead }) => {
  const unread = notifications.filter(n => !n.read).length;
  return (
    <Card title={<Space><ThunderboltOutlined style={{ color: '#fa8c16' }} /> 推送记录</Space>} size="small"
      extra={<Button size="small" type="link" onClick={onMarkAllRead} disabled={unread === 0}>全部已读</Button>}>
      <div style={{ maxHeight: 400, overflowY: 'auto' }}>
        {notifications.map(n => {
          const isPositive = n.changePct >= 0;
          return (
            <div key={n.id} style={{
              padding: '8px 0', borderBottom: '1px solid #f0f0f0',
              opacity: n.read ? 0.6 : 1, cursor: 'pointer',
              background: n.read ? undefined : '#fafafa',
            }} onClick={() => onMarkRead(n.id)}>
              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                <Space size={4}>
                  {!n.read && <Badge status="processing" />}
                  <Tag color={n.severity === 'extreme' ? 'red' : n.severity === 'major' ? 'orange' : n.severity === 'notable' ? 'blue' : 'default'}
                    style={{ fontSize: 9 }}>
                    {n.severity === 'extreme' ? '极端' : n.severity === 'major' ? '重大' : n.severity === 'notable' ? '显著' : '资讯'}
                  </Tag>
                  <Text strong style={{ fontSize: 12 }}>{n.title}</Text>
                </Space>
                <Text type="secondary" style={{ fontSize: 10 }}>
                  {Math.floor((Date.now() - n.timestamp) / 60000)}分前
                </Text>
              </Space>
              <div style={{ marginTop: 4, fontSize: 11, color: '#666' }}>{n.body}</div>
              <div style={{ marginTop: 4 }}>
                <Button size="small" type="link" style={{ padding: 0, fontSize: 11 }}
                  icon={<RobotOutlined />}>
                  {n.actionLabel}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};

// ── Push CTA Card (a single notification displayed as a rich card) ──
const PushCTACard: React.FC<{ notification: PushNotification }> = ({ notification }) => {
  const isUp = notification.changePct >= 0;
  return (
    <Card size="small" style={{
      borderLeft: `4px solid ${notification.severity === 'extreme' ? '#ff4d4f' : isUp ? '#52c41a' : '#ff4d4f'}`,
      background: isUp ? '#f6ffed' : '#fff2f0',
      maxWidth: 360,
    }}>
      <Space direction="vertical" size={4} style={{ width: '100%' }}>
        <Space>
          <Text strong style={{ fontSize: 14 }}>{notification.title}</Text>
        </Space>
        <Paragraph style={{ fontSize: 12, margin: 0 }}>{notification.body}</Paragraph>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <Button size="small" type="primary" icon={<RobotOutlined />}>
            {notification.actionLabel}
          </Button>
          <Button size="small" icon={<ArrowRightOutlined />}>
            查看K线
          </Button>
        </div>
      </Space>
    </Card>
  );
};

// ── Stats Panel ──
const AlertStatsPanel: React.FC<{ stats: AlertStats }> = ({ stats }) => (
  <Card size="small" title={<Space><HistoryOutlined /> 推送统计</Space>}>
    <Row gutter={[8, 8]}>
      {[
        { title: '活跃提醒', value: stats.activeAlerts, suffix: `/${stats.totalAlerts}`, icon: <BellFilled />, color: '#fa8c16' },
        { title: '今日触发', value: stats.triggeredToday, suffix: '次', icon: <ThunderboltOutlined />, color: '#1677ff' },
        { title: '本周触发', value: stats.triggeredThisWeek, suffix: '次', icon: <HistoryOutlined />, color: '#722ed1' },
        { title: 'CTA转化', value: `${stats.conversionRate}%`, suffix: `(${stats.ctaClicks}次)`, icon: <ArrowRightOutlined />, color: '#52c41a' },
      ].map(s => (
        <Col span={12} key={s.title}>
          <Statistic title={s.title} value={s.value} suffix={s.suffix}
            valueStyle={{ fontSize: 20, color: s.color }} prefix={s.icon} />
        </Col>
      ))}
    </Row>
  </Card>
);

// ── Upgrade Banner ──
const UpgradeBanner: React.FC = () => (
  <Card size="small" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', border: 'none' }}>
    <Space direction="vertical" size={4} style={{ width: '100%' }}>
      <Text strong style={{ color: '#fff', fontSize: 14 }}>
        <GiftOutlined /> 免费版: 3只提醒 · 升级不限量
      </Text>
      <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>
        无限提醒 + 桌面通知 + 移动推送 + AI解读链接
      </Text>
      <Space>
        <Button size="small" type="primary" ghost icon={<StarOutlined />}>
          升级专业版 4.9U/月
        </Button>
        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>
          已帮助128位用户捕获12%+收益
        </Text>
      </Space>
    </Space>
  </Card>
);

// ── Main Component ──
const PriceAlertPushUI: React.FC = () => {
  const [alerts, setAlerts] = useState<PriceAlert[]>(mockAlerts);
  const [notifications, setNotifications] = useState<PushNotification[]>(mockNotifications);
  const [formVisible, setFormVisible] = useState(false);
  const [editAlert, setEditAlert] = useState<PriceAlert | undefined>();
  const [stats] = useState<AlertStats>(mockStats);

  const toggleAlert = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a));
    message.success('已更新');
  };
  const deleteAlert = (id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
    message.info('已删除');
  };
  const handleEdit = (alert: PriceAlert) => {
    setEditAlert(alert);
    setFormVisible(true);
  };
  const handleSave = (data: Partial<PriceAlert>) => {
    if (editAlert) {
      setAlerts(prev => prev.map(a => a.id === editAlert.id ? { ...a, ...data } : a));
    } else {
      const newAlert: PriceAlert = {
        id: `a${Date.now()}`, symbol: data.symbol || 'NVDA', name: data.symbol || '',
        market: 'US', currentPrice: 100, type: data.type || 'price_up',
        threshold: data.threshold || 0, enabled: true,
        cooldownMinutes: data.cooldownMinutes || 30,
        notifyVia: data.notifyVia || ['desktop'], lastTriggered: 0,
      };
      setAlerts(prev => [...prev, newAlert]);
    }
    setEditAlert(undefined);
  };
  const markRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };
  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  return (
    <div style={{ padding: 16, maxWidth: 1400, margin: '0 auto' }}>
      <Space style={{ marginBottom: 12 }}>
        <BellOutlined style={{ fontSize: 24, color: '#fa8c16' }} />
        <Title level={3} style={{ margin: 0 }}>价格提醒</Title>
      </Space>

      <Row gutter={[12, 12]}>
        <Col xs={24} lg={16}>
          <Tabs defaultActiveKey="alerts" items={[
            {
              key: 'alerts',
              label: <span><BellFilled /> 提醒设置</span>,
              children: (
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <Button type="dashed" icon={<PlusOutlined />} block
                    onClick={() => { setEditAlert(undefined); setFormVisible(true); }}>
                    新建提醒
                  </Button>
                  <AlertList alerts={alerts} onToggle={toggleAlert} onDelete={deleteAlert} onEdit={handleEdit} />
                </Space>
              )
            },
            {
              key: 'history',
              label: <span><ThunderboltOutlined /> 推送记录 ({notifications.filter(n => !n.read).length})</span>,
              children: <NotificationPanel notifications={notifications} onMarkRead={markRead} onMarkAllRead={markAllRead} />
            },
            {
              key: 'preview',
              label: <span><ApiOutlined /> 推送预览</span>,
              children: (
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  {mockNotifications.slice(0, 3).map(n => (
                    <PushCTACard key={n.id} notification={n} />
                  ))}
                </Space>
              )
            },
          ]} />
        </Col>
        <Col xs={24} lg={8}>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <AlertStatsPanel stats={stats} />
            <UpgradeBanner />
          </Space>
        </Col>
      </Row>

      <AlertForm visible={formVisible} onClose={() => { setFormVisible(false); setEditAlert(undefined); }}
        onSave={handleSave} editAlert={editAlert} />
    </div>
  );
};

export default PriceAlertPushUI;
