// @ts-nocheck
// QUANT MOO — 行情源配置面板 (Data Source Configuration UI)
// R253 ML#2 BR-01 — 多券商/数据源配置面板 (2h)

import React, { useState } from 'react';
import {
  Card, Table, Tag, Switch, Button, Space, Typography, Descriptions,
  Select, Slider, InputNumber, Tooltip, Badge, Popconfirm, Modal,
  Progress, Divider, Row, Col, Alert, Statistic, Steps, message
} from 'antd';
import {
  ApiOutlined, PlusOutlined, CheckCircleOutlined, ExclamationCircleOutlined,
  CloseCircleOutlined, ReloadOutlined, SettingOutlined, DeleteOutlined,
  ExperimentOutlined, ThunderboltOutlined, ClockCircleOutlined,
  GlobalOutlined, DollarOutlined, FundOutlined, LinkOutlined,
  DisconnectOutlined, SyncOutlined, WarningOutlined, CloudServerOutlined
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

// ── Types ──
interface DataSource {
  id: string;
  name: string;
  provider: 'yahoo' | 'binance' | 'futu' | 'moomoo' | 'ibkr' | 'longbridge' | 'tiger' | 'eastmoney' | 'custom';
  category: 'stock' | 'crypto' | 'forex' | 'macro' | 'news';
  status: 'connected' | 'disconnected' | 'degraded' | 'error';
  health: number;
  latency: number;
  uptime: number;
  lastSync: number;
  endpoint: string;
  apiVersion: string;
  rateLimit: { used: number; total: number };
  features: string[];
  priority: number;
  enabled: boolean;
}

interface UnifiedBrokerConfig {
  brokerId: string;
  brokerName: string;
  market: string[];
  status: 'connected' | 'disconnected';
  health: number;
  latency: number;
  protocols: string[];
}

// ── Mock Data ──
const mockSources: DataSource[] = [
  {
    id: 'ds-yahoo', name: 'Yahoo Finance', provider: 'yahoo', category: 'stock',
    status: 'connected', health: 98, latency: 45, uptime: 99.95, lastSync: Date.now() - 30000,
    endpoint: 'wss://streamer.finance.yahoo.com', apiVersion: 'v8',
    rateLimit: { used: 320, total: 2000 },
    features: ['实时行情', '历史K线', '基本面', '新闻'],
    priority: 1, enabled: true
  },
  {
    id: 'ds-binance', name: 'Binance', provider: 'binance', category: 'crypto',
    status: 'connected', health: 95, latency: 28, uptime: 99.98, lastSync: Date.now() - 15000,
    endpoint: 'wss://stream.binance.com:9443/ws', apiVersion: 'v3',
    rateLimit: { used: 450, total: 1200 },
    features: ['实时行情', '深度', 'K线', '合约'],
    priority: 2, enabled: true
  },
  {
    id: 'ds-futu', name: '富途 OpenD', provider: 'futu', category: 'stock',
    status: 'connected', health: 92, latency: 15, uptime: 99.7, lastSync: Date.now() - 15000,
    endpoint: '127.0.0.1:11111', apiVersion: 'v9.6',
    rateLimit: { used: 180, total: 500 },
    features: ['实时行情', '深度(L2)', '逐笔', '历史K线', '财报'],
    priority: 0, enabled: true
  },
  {
    id: 'ds-moomoo', name: 'moomoo OpenD', provider: 'moomoo', category: 'stock',
    status: 'connected', health: 95, latency: 12, uptime: 99.8, lastSync: Date.now() - 15000,
    endpoint: '127.0.0.1:11112', apiVersion: 'v10.6',
    rateLimit: { used: 120, total: 400 },
    features: ['实时行情', '深度(L2)', '逐笔', '历史K线'],
    priority: 1, enabled: true
  },
  {
    id: 'ds-ibkr', name: 'Interactive Brokers', provider: 'ibkr', category: 'stock',
    status: 'degraded', health: 75, latency: 180, uptime: 97.2, lastSync: Date.now() - 300000,
    endpoint: '127.0.0.1:4001', apiVersion: 'TWS 10.30',
    rateLimit: { used: 80, total: 250 },
    features: ['实时行情', '深度', '历史K线', '基本面', '期权链'],
    priority: 2, enabled: true
  },
  {
    id: 'ds-eastern', name: '东方财富', provider: 'eastmoney', category: 'stock',
    status: 'disconnected', health: 0, latency: 0, uptime: 0, lastSync: 0,
    endpoint: '', apiVersion: 'N/A',
    rateLimit: { used: 0, total: 5000 },
    features: ['实时行情', '历史K线', '龙虎榜', '资金流向', '基金'],
    priority: 3, enabled: false
  },
];

const mockBrokers: UnifiedBrokerConfig[] = [
  { brokerId: 'br-futu', brokerName: '富途 (Futu)', market: ['HK', 'US', 'CN'], status: 'connected', health: 92, latency: 15, protocols: ['TCP', 'Protobuf'] },
  { brokerId: 'br-moomoo', brokerName: 'moomoo', market: ['HK', 'US'], status: 'connected', health: 95, latency: 12, protocols: ['TCP', 'Protobuf'] },
  { brokerId: 'br-ibkr', brokerName: '盈透证券 (IBKR)', market: ['US', 'HK', 'JP', 'UK', 'EU'], status: 'disconnected', health: 0, latency: 0, protocols: ['TCP', 'TWS API'] },
  { brokerId: 'br-longbridge', brokerName: '长桥 (Longbridge)', market: ['HK', 'US'], status: 'connected', health: 88, latency: 22, protocols: ['REST', 'WS'] },
  { brokerId: 'br-binance', brokerName: 'Binance', market: ['CRYPTO'], status: 'connected', health: 95, latency: 28, protocols: ['REST', 'WS'] },
  { brokerId: 'br-okx', brokerName: 'OKX', market: ['CRYPTO'], status: 'disconnected', health: 0, latency: 0, protocols: ['REST', 'WS'] },
];

// ── Sub-components ──

const SourceStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, { color: string; icon: React.ReactNode; text: string }> = {
    connected: { color: 'green', icon: <CheckCircleOutlined />, text: '已连接' },
    disconnected: { color: 'default', icon: <DisconnectOutlined />, text: '未连接' },
    degraded: { color: 'orange', icon: <WarningOutlined />, text: '降级' },
    error: { color: 'red', icon: <CloseCircleOutlined />, text: '错误' },
  };
  const { color, icon, text } = map[status] || map.disconnected;
  return <Tag color={color} icon={icon}>{text}</Tag>;
};

const HealthBar: React.FC<{ health: number }> = ({ health }) => {
  const color = health >= 90 ? '#52c41a' : health >= 70 ? '#faad14' : health >= 40 ? '#fa8c16' : '#ff4d4f';
  return (
    <Tooltip title={`健康度: ${health}%`}>
      <Progress percent={health} size="small" strokeColor={color} showInfo={false} style={{ width: 80, margin: 0 }} />
    </Tooltip>
  );
};

// ── Data Source Panel ──
const DataSourcePanel: React.FC = () => {
  const [sources, setSources] = useState<DataSource[]>(mockSources);
  const [testModal, setTestModal] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const toggleSource = (id: string, enabled: boolean) => {
    setSources(prev => prev.map(s => s.id === id ? { ...s, enabled } : s));
    message.success(`已${enabled ? '启用' : '禁用'}数据源`);
  };

  const testConnection = (id: string) => {
    setTesting(true);
    setTimeout(() => {
      setSources(prev => prev.map(s => s.id === id ? {
        ...s, status: 'connected' as const, health: 95 + Math.floor(Math.random() * 5),
        latency: 10 + Math.floor(Math.random() * 40), lastSync: Date.now()
      } : s));
      setTesting(false);
      setTestModal(null);
      message.success('连接测试通过');
    }, 1500);
  };

  const columns = [
    {
      title: '数据源', key: 'name', render: (_: any, r: DataSource) => (
        <Space>
          <ApiOutlined style={{ color: '#1677ff' }} />
          <Text strong>{r.name}</Text>
          <Tag>{r.provider}</Tag>
        </Space>
      )
    },
    {
      title: '分类', dataIndex: 'category', key: 'category', render: (c: string) => {
        const map: Record<string, string> = { stock: '股票', crypto: '加密', forex: '外汇', macro: '宏观', news: '新闻' };
        return <Tag>{map[c] || c}</Tag>;
      }
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', render: (_: any, r: DataSource) => (
        <Space>
          <SourceStatusBadge status={r.status} />
          <HealthBar health={r.health} />
        </Space>
      )
    },
    {
      title: '延迟', dataIndex: 'latency', key: 'latency', render: (v: number) => (
        <Text>{v > 0 ? `${v}ms` : 'N/A'}</Text>
      )
    },
    {
      title: '限流', key: 'rate', render: (_: any, r: DataSource) => (
        <Tooltip title={`${r.rateLimit.used}/${r.rateLimit.total}`}>
          <Progress percent={Math.round((r.rateLimit.used / r.rateLimit.total) * 100)} size="small" showInfo={false}
            strokeColor={r.rateLimit.used / r.rateLimit.total > 0.8 ? '#ff4d4f' : '#52c41a'} style={{ width: 60, margin: 0 }} />
        </Tooltip>
      )
    },
    {
      title: '功能', key: 'features', render: (_: any, r: DataSource) => (
        <Space size={2} wrap>
          {r.features.slice(0, 3).map(f => <Tag key={f} style={{ fontSize: 10 }}>{f}</Tag>)}
          {r.features.length > 3 && <Tag style={{ fontSize: 10 }}>+{r.features.length - 3}</Tag>}
        </Space>
      )
    },
    {
      title: '操作', key: 'actions', render: (_: any, r: DataSource) => (
        <Space size={4}>
          <Switch size="small" checked={r.enabled} onChange={v => toggleSource(r.id, v)} />
          <Tooltip title="测试连接">
            <Button size="small" icon={<ExperimentOutlined />} loading={testing && testModal === r.id}
              onClick={() => { setTestModal(r.id); testConnection(r.id); }} />
          </Tooltip>
          <Tooltip title="配置">
            <Button size="small" icon={<SettingOutlined />} />
          </Tooltip>
        </Space>
      )
    }
  ];

  return (
    <div>
      <Card title={<Space><CloudServerOutlined /> 数据源管理</Space>} size="small"
        extra={<Button size="small" icon={<PlusOutlined />}>添加数据源</Button>}>
        <Table dataSource={sources} columns={columns} rowKey="id" pagination={false} size="small" />
      </Card>
    </div>
  );
};

// ── Broker Connection Panel ──
const BrokerConnectionPanel: React.FC = () => {
  const [brokers, setBrokers] = useState<UnifiedBrokerConfig[]>(mockBrokers);
  const [connecting, setConnecting] = useState<string | null>(null);

  const handleConnect = (id: string) => {
    setConnecting(id);
    setTimeout(() => {
      setBrokers(prev => prev.map(b => b.brokerId === id ? {
        ...b, status: 'connected' as const, health: 88 + Math.floor(Math.random() * 12),
        latency: 10 + Math.floor(Math.random() * 50)
      } : b));
      setConnecting(null);
      message.success('连接成功');
    }, 2000);
  };

  const handleDisconnect = (id: string) => {
    setBrokers(prev => prev.map(b => b.brokerId === id ? {
      ...b, status: 'disconnected' as const, health: 0, latency: 0
    } : b));
    message.info('已断开');
  };

  return (
    <Card title={<Space><LinkOutlined /> 统一券商连接</Space>} size="small">
      <Row gutter={[12, 12]}>
        {brokers.map(b => (
          <Col xs={24} sm={12} md={8} lg={6} key={b.brokerId}>
            <Card size="small" hoverable style={{
              borderLeft: `3px solid ${b.status === 'connected' ? '#52c41a' : '#d9d9d9'}`,
              opacity: b.status === 'connected' ? 1 : 0.7
            }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Text strong>{b.brokerName}</Text>
                  <Badge status={b.status === 'connected' ? 'success' : 'default'} text="" />
                </Space>
                <Space size={2} wrap>
                  {b.market.map(m => <Tag key={m} style={{ fontSize: 10 }}>{m}</Tag>)}
                </Space>
                {b.status === 'connected' ? (
                  <>
                    <Space size={4}>
                      <HealthBar health={b.health} />
                      <Text type="secondary" style={{ fontSize: 11 }}>{b.latency}ms</Text>
                    </Space>
                    <Popconfirm title="确定断开连接？" onConfirm={() => handleDisconnect(b.brokerId)}>
                      <Button size="small" danger block icon={<DisconnectOutlined />}>断开</Button>
                    </Popconfirm>
                  </>
                ) : (
                  <Button size="small" type="primary" block icon={<LinkOutlined />}
                    loading={connecting === b.brokerId}
                    onClick={() => handleConnect(b.brokerId)}>
                    连接
                  </Button>
                )}
              </Space>
            </Card>
          </Col>
        ))}
      </Row>
    </Card>
  );
};

// ── Performance Monitor ──
const DataPerformancePanel: React.FC = () => {
  return (
    <Card title={<Space><ThunderboltOutlined /> 数据性能监控</Space>} size="small">
      <Row gutter={[12, 12]}>
        <Col xs={12} sm={6}>
          <Statistic title="平均延迟" value={25} suffix="ms" prefix={<ClockCircleOutlined />} valueStyle={{ color: '#52c41a' }} />
        </Col>
        <Col xs={12} sm={6}>
          <Statistic title="数据准确率" value={99.97} suffix="%" prefix={<CheckCircleOutlined />} valueStyle={{ color: '#52c41a' }} />
        </Col>
        <Col xs={12} sm={6}>
          <Statistic title="每日调用" value="1.2M" prefix={<ApiOutlined />} valueStyle={{ color: '#1677ff' }} />
        </Col>
        <Col xs={12} sm={6}>
          <Statistic title="缓存命中率" value={92.3} suffix="%" prefix={<SyncOutlined />} valueStyle={{ color: '#722ed1' }} />
        </Col>
      </Row>
      <Divider style={{ margin: '12px 0' }} />
      <Alert message="✅ 所有主要数据源运行正常" type="success" showIcon
        description="Yahoo/Binance/富途/moomoo 延迟均低于50ms。IBKR 略有降级(180ms)，建议检查TWS网关。" />
    </Card>
  );
};

// ── Main Panel ──
const DataSourceConfigUI: React.FC = () => {
  return (
    <div style={{ padding: 16, maxWidth: 1400, margin: '0 auto' }}>
      <Space style={{ marginBottom: 16 }}>
        <ApiOutlined style={{ fontSize: 24, color: '#1677ff' }} />
        <Title level={3} style={{ margin: 0 }}>QUANT MOO 行情源配置</Title>
      </Space>

      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <DataPerformancePanel />
        <BrokerConnectionPanel />
        <DataSourcePanel />
      </Space>
    </div>
  );
};

export default DataSourceConfigUI;
