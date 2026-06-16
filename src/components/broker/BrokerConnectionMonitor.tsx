// @ts-nocheck
// QUANT MOO — 券商断线可视提示 (Broker Disconnect Visual Indicator)
// R259 ML#3 P1-09 — 多券商连接状态监控+断线提醒+一键重连 (6h)

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Row, Col, Space, Typography, Tag, Button, Timeline,
  Badge, Tooltip, Progress, Statistic, Divider, Popconfirm,
  Switch, Table, Alert, Empty, message, Modal
} from 'antd';
import {
  CheckCircleOutlined, CloseCircleOutlined, WarningOutlined,
  DisconnectOutlined, LinkOutlined, ReloadOutlined,
  ApiOutlined, CloudServerOutlined, ThunderboltOutlined,
  ClockCircleOutlined, BellOutlined, EyeOutlined,
  SettingOutlined, SyncOutlined, CaretUpOutlined,
  CaretDownOutlined, ExperimentOutlined, HistoryOutlined,
  SafetyOutlined
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

// ── Types ──
interface BrokerConnection {
  id: string;
  name: string;
  provider: string;
  markets: string[];
  status: 'connected' | 'connecting' | 'disconnected' | 'degraded' | 'error';
  latency: number;
  health: number;
  uptime: number;
  lastPing: number;
  lastError?: string;
  lastErrorTime?: number;
  activeSubscriptions: number;
  reconnectAttempts: number;
  ipcStatus: 'ok' | 'slow' | 'dead';
}

interface DisconnectEvent {
  id: string;
  brokerId: string;
  brokerName: string;
  type: 'disconnect' | 'degraded' | 'reconnected' | 'error';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: number;
  duration?: number;
}

// ── Mock Data ──
const mockBrokers: BrokerConnection[] = [
  { id: 'br-futu', name: '富途 OpenD', provider: 'futu', markets: ['HK', 'US', 'CN'], status: 'connected', latency: 12, health: 98, uptime: 99.95, lastPing: Date.now() - 2000, activeSubscriptions: 15, reconnectAttempts: 0, ipcStatus: 'ok' },
  { id: 'br-moomoo', name: 'moomoo OpenD', provider: 'moomoo', markets: ['HK', 'US'], status: 'connected', latency: 15, health: 96, uptime: 99.8, lastPing: Date.now() - 3000, activeSubscriptions: 8, reconnectAttempts: 0, ipcStatus: 'ok' },
  { id: 'br-ibkr', name: '盈透 IB TWS', provider: 'ibkr', markets: ['US', 'HK', 'JP', 'UK'], status: 'degraded', latency: 185, health: 72, uptime: 97.2, lastPing: Date.now() - 60000, lastError: 'TWS网关响应超时(>180ms)', lastErrorTime: Date.now() - 120000, activeSubscriptions: 5, reconnectAttempts: 2, ipcStatus: 'slow' },
  { id: 'br-binance', name: 'Binance WS', provider: 'binance', markets: ['CRYPTO'], status: 'connected', latency: 28, health: 95, uptime: 99.98, lastPing: Date.now() - 1000, activeSubscriptions: 20, reconnectAttempts: 0, ipcStatus: 'ok' },
  { id: 'br-eastern', name: '东方财富', provider: 'eastmoney', markets: ['CN'], status: 'disconnected', latency: 0, health: 0, uptime: 0, lastPing: 0, lastError: '连接超时(30s无响应)', lastErrorTime: Date.now() - 3600000, activeSubscriptions: 0, reconnectAttempts: 5, ipcStatus: 'dead' },
];

const mockEvents: DisconnectEvent[] = [
  { id: 'e1', brokerId: 'br-ibkr', brokerName: '盈透IB', type: 'degraded', severity: 'warning', message: '延迟升至185ms，降级运行', timestamp: Date.now() - 120000 },
  { id: 'e2', brokerId: 'br-eastern', brokerName: '东方财富', type: 'disconnect', severity: 'critical', message: '连接超时(30s)，自动重连中...', timestamp: Date.now() - 3600000, duration: 3540000 },
  { id: 'e3', brokerId: 'br-ibkr', brokerName: '盈透IB', type: 'error', severity: 'warning', message: 'TWS API返回错误 code=502', timestamp: Date.now() - 600000 },
  { id: 'e4', brokerId: 'br-futu', brokerName: '富途', type: 'reconnected', severity: 'info', message: '断线3秒后自动重连成功', timestamp: Date.now() - 86400000, duration: 3000 },
  { id: 'e5', brokerId: 'br-binance', brokerName: 'Binance', type: 'degraded', severity: 'info', message: 'WS连接短暂降级(45ms→120ms)，已恢复', timestamp: Date.now() - 7200000, duration: 15000 },
];

// ── Status Badge ──
const BrokerStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, { color: string; icon: React.ReactNode; text: string }> = {
    connected: { color: 'green', icon: <CheckCircleOutlined />, text: '已连接' },
    connecting: { color: 'gold', icon: <SyncOutlined spin />, text: '连接中' },
    disconnected: { color: 'default', icon: <DisconnectOutlined />, text: '未连接' },
    degraded: { color: 'orange', icon: <WarningOutlined />, text: '降级' },
    error: { color: 'red', icon: <CloseCircleOutlined />, text: '错误' },
  };
  const m = map[status] || map.disconnected;
  return <Tag color={m.color} icon={m.icon}>{m.text}</Tag>;
};

// ── Broker Card ──
const BrokerCard: React.FC<{
  broker: BrokerConnection;
  onReconnect: (id: string) => void;
  onDisconnect: (id: string) => void;
}> = ({ broker, onReconnect, onDisconnect }) => {
  const isOk = broker.status === 'connected';
  return (
    <Card
      size="small"
      hoverable
      style={{
        borderLeft: `4px solid ${isOk ? '#52c41a' : broker.status === 'degraded' ? '#fa8c16' : broker.status === 'error' ? '#ff4d4f' : '#d9d9d9'}`,
        opacity: broker.status === 'disconnected' ? 0.6 : 1,
      }}
    >
      <Space direction="vertical" size={4} style={{ width: '100%' }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space size={4}>
            <ApiOutlined style={{ color: isOk ? '#52c41a' : '#8c8c8c' }} />
            <Text strong style={{ fontSize: 12 }}>{broker.name}</Text>
          </Space>
          <BrokerStatusBadge status={broker.status} />
        </Space>

        {/* Health + Latency */}
        <Space size={4}>
          <Tooltip title={`健康度 ${broker.health}%`}>
            <Progress percent={broker.health} size="small" showInfo={false}
              strokeColor={broker.health >= 90 ? '#52c41a' : broker.health >= 70 ? '#fa8c16' : '#ff4d4f'}
              style={{ width: 60, margin: 0 }} />
          </Tooltip>
          {broker.status === 'connected' && (
            <Tooltip title="延迟">
              <Tag color={broker.latency < 50 ? 'green' : 'orange'} style={{ fontSize: 9 }}>
                {broker.latency}ms
              </Tag>
            </Tooltip>
          )}
          <Tag style={{ fontSize: 9 }}>{broker.activeSubscriptions}条订阅</Tag>
        </Space>

        {/* Markets */}
        <Space size={2} wrap>
          {broker.markets.map(m => <Tag key={m} style={{ fontSize: 9 }}>{m}</Tag>)}
        </Space>

        {/* IPC */}
        <Space size={4}>
          <Tooltip title="IPC状态">
            <Badge status={broker.ipcStatus === 'ok' ? 'success' : broker.ipcStatus === 'slow' ? 'warning' : 'error'} />
          </Tooltip>
          <Text type="secondary" style={{ fontSize: 9 }}>
            IPC {broker.ipcStatus === 'ok' ? '正常' : broker.ipcStatus === 'slow' ? '缓慢' : '断开'}
          </Text>
        </Space>

        {/* Last error */}
        {broker.lastError && (
          <Alert message={broker.lastError} type={broker.status === 'error' ? 'error' : 'warning'}
            style={{ fontSize: 10, padding: '2px 8px' }} showIcon={false} />
        )}

        {/* Actions */}
        <div style={{ marginTop: 4 }}>
          {broker.status === 'connected' || broker.status === 'degraded' ? (
            <Popconfirm title="断开此券商连接?" onConfirm={() => onDisconnect(broker.id)}>
              <Button size="small" danger block icon={<DisconnectOutlined />}>断开</Button>
            </Popconfirm>
          ) : (
            <Button size="small" type="primary" block icon={<LinkOutlined />}
              loading={broker.status === 'connecting'}
              onClick={() => onReconnect(broker.id)}>
              {broker.reconnectAttempts > 0 ? `重连 (${broker.reconnectAttempts}次)` : '连接'}
            </Button>
          )}
        </div>
      </Space>
    </Card>
  );
};

// ── Event Log ──
const EventLog: React.FC<{ events: DisconnectEvent[] }> = ({ events }) => (
  <Card size="small" title={<Space><HistoryOutlined /> 断线事件记录</Space>}>
    <div style={{ maxHeight: 300, overflowY: 'auto' }}>
      {events.map(e => {
        const sevColor = { info: 'blue', warning: 'orange', critical: 'red' };
        const typeLabel = { disconnect: '断线', degraded: '降级', reconnected: '重连', error: '错误' };
        return (
          <div key={e.id} style={{ padding: '4px 0', borderBottom: '1px solid #f5f5f5', fontSize: 11 }}>
            <Space size={4} style={{ width: '100%', justifyContent: 'space-between' }}>
              <Space size={4}>
                <Tag color={sevColor[e.severity]} style={{ fontSize: 9 }}>{typeLabel[e.type]}</Tag>
                <Text>{e.brokerName}</Text>
              </Space>
              <Text type="secondary" style={{ fontSize: 9 }}>
                {new Date(e.timestamp).toLocaleTimeString()}
              </Text>
            </Space>
            <Text type="secondary" style={{ marginTop: 2, display: 'block' }}>{e.message}</Text>
            {e.duration && (
              <Text type="secondary" style={{ fontSize: 9 }}>
                {e.type === 'reconnected' ? '断线' : '持续'} {(e.duration / 1000).toFixed(1)}秒
              </Text>
            )}
          </div>
        );
      })}
    </div>
  </Card>
);

// ── Quick Overview Banner ──
const OverviewBanner: React.FC<{ brokers: BrokerConnection[] }> = ({ brokers }) => {
  const connected = brokers.filter(b => b.status === 'connected').length;
  const degraded = brokers.filter(b => b.status === 'degraded').length;
  const disconnected = brokers.filter(b => b.status === 'disconnected' || b.status === 'error').length;
  const avgLatency = brokers.filter(b => b.status === 'connected').reduce((s, b) => s + b.latency, 0) / Math.max(1, connected);

  const allOk = degraded === 0 && disconnected === 0;

  return (
    <Alert
      type={allOk ? 'success' : 'warning'}
      showIcon
      icon={allOk ? <CheckCircleOutlined /> : <WarningOutlined />}
      message={
        <Space size={16}>
          <Space size={4}>
            <Text strong>券商连接:</Text>
            <Space size={4}>
              <Tag color={connected > 0 ? 'green' : 'default'}>{connected} 正常</Tag>
              {degraded > 0 && <Tag color="orange">{degraded} 降级</Tag>}
              {disconnected > 0 && <Tag color="red">{disconnected} 断开</Tag>}
            </Space>
          </Space>
          {connected > 0 && <Text type="secondary" style={{ fontSize: 11 }}>平均延迟 {Math.round(avgLatency)}ms</Text>}
        </Space>
      }
      action={
        <Button size="small" onClick={() => message.success('全部重连已发起')}>一键重连全部</Button>
      }
      style={{ marginBottom: 12 }}
    />
  );
};

// ── Main Component ──
const BrokerConnectionMonitor: React.FC = () => {
  const [brokers, setBrokers] = useState<BrokerConnection[]>(mockBrokers);
  const [events, setEvents] = useState<DisconnectEvent[]>(mockEvents);

  const handleReconnect = (id: string) => {
    setBrokers(prev => prev.map(b => b.id === id ? { ...b, status: 'connecting' as const } : b));
    setTimeout(() => {
      setBrokers(prev => prev.map(b => b.id === id ? {
        ...b, status: 'connected' as const, health: 95, latency: 15 + Math.floor(Math.random() * 30),
        lastPing: Date.now(), lastError: undefined, reconnectAttempts: 0, ipcStatus: 'ok' as const,
      } : b));
      setEvents(prev => [{
        id: `e${Date.now()}`, brokerId: id, brokerName: brokers.find(b => b.id === id)?.name || '',
        type: 'reconnected', severity: 'info', message: '手动重连成功', timestamp: Date.now(),
      }, ...prev]);
      message.success('重连成功');
    }, 1500);
  };

  const handleDisconnect = (id: string) => {
    setBrokers(prev => prev.map(b => b.id === id ? {
      ...b, status: 'disconnected' as const, health: 0, latency: 0, activeSubscriptions: 0,
      lastError: '用户手动断开', lastErrorTime: Date.now(), ipcStatus: 'dead' as const,
    } : b));
    message.info('已断开');
  };

  return (
    <div style={{ padding: 16, maxWidth: 1400, margin: '0 auto' }}>
      <Space style={{ marginBottom: 12 }}>
        <CloudServerOutlined style={{ fontSize: 24, color: '#1677ff' }} />
        <Title level={3} style={{ margin: 0 }}>券商连接监控</Title>
      </Space>

      <OverviewBanner brokers={brokers} />

      <Row gutter={[12, 12]}>
        <Col xs={24} lg={16}>
          <Row gutter={[12, 12]}>
            {brokers.map(b => (
              <Col xs={24} sm={12} md={8} lg={8} key={b.id}>
                <BrokerCard broker={b} onReconnect={handleReconnect} onDisconnect={handleDisconnect} />
              </Col>
            ))}
          </Row>
        </Col>

        <Col xs={24} lg={8}>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            {/* Stats */}
            <Row gutter={[8, 8]}>
              <Col span={8}>
                <Card size="small"><Statistic title="已连接" value={brokers.filter(b => b.status === 'connected').length}
                  suffix={`/${brokers.length}`} valueStyle={{ color: '#52c41a', fontSize: 22 }} /></Card>
              </Col>
              <Col span={8}>
                <Card size="small"><Statistic title="总订阅" value={brokers.reduce((s, b) => s + b.activeSubscriptions, 0)}
                  suffix="条" valueStyle={{ color: '#1677ff', fontSize: 22 }} /></Card>
              </Col>
              <Col span={8}>
                <Card size="small"><Statistic title="在线率" value={brokers.filter(b => b.status === 'connected').length / brokers.length * 100}
                  suffix="%" valueStyle={{ fontSize: 22 }} /></Card>
              </Col>
            </Row>

            <EventLog events={events} />
          </Space>
        </Col>
      </Row>
    </div>
  );
};

export default BrokerConnectionMonitor;
