// @ts-nocheck
// ── R133-M01 USBrokerPanel — 美股券商管理面板 (IB/Tiger/Schwab 3家) ──────
// PM: 添加/配置/测试连接 3家美股券商

import { useState, useCallback } from 'react';
import {
  Card, Button, Badge, Tag, Descriptions, Modal, Form, Input, Select,
  Space, message, Steps, Progress, Tooltip, Switch,
} from 'antd';
import {
  ApiOutlined, CheckCircleOutlined, CloseCircleOutlined, SyncOutlined,
  KeyOutlined, LinkOutlined, SettingOutlined, ThunderboltOutlined,
  SafetyCertificateOutlined, BankOutlined, GlobalOutlined,
} from '@ant-design/icons';

// ═══════════ Types ═══════════

interface USBrokerConfig {
  brokerId: string;
  brokerName: string;
  icon: string;
  market: string[];
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  protocol: 'TWS' | 'TigerSDK' | 'OAuth2';
  authType: 'api_key' | 'username_password' | 'oauth2';
  features: string[];
  configured: boolean;
  tested: boolean;
  lastChecked?: number;
  latency?: number;
  feeRate: string;
  marginAvailable: boolean;
  shortSelling: boolean;
  prePostMarket: boolean;
}

// ═══════════ Mock data ═══════════

const MOCK_US_BROKERS: USBrokerConfig[] = [
  {
    brokerId: 'ib',
    brokerName: 'Interactive Brokers',
    icon: '🏦',
    market: ['US', 'Global'],
    status: 'disconnected',
    protocol: 'TWS',
    authType: 'api_key',
    features: ['股票', '期权', '期货', '外汇', '债券'],
    configured: true,
    tested: true,
    feeRate: '$0.005/share',
    marginAvailable: true,
    shortSelling: true,
    prePostMarket: true,
  },
  {
    brokerId: 'tiger',
    brokerName: 'Tiger Brokers',
    icon: '🐯',
    market: ['US', 'HK'],
    status: 'connecting',
    protocol: 'TigerSDK',
    authType: 'api_key',
    features: ['股票', '期权', '港股打新'],
    configured: true,
    tested: false,
    feeRate: '0.03%',
    marginAvailable: true,
    shortSelling: true,
    prePostMarket: true,
  },
  {
    brokerId: 'schwab',
    brokerName: 'Charles Schwab',
    icon: '🔵',
    market: ['US'],
    status: 'disconnected',
    protocol: 'OAuth2',
    authType: 'oauth2',
    features: ['股票', 'ETF', '共同基金', '债券'],
    configured: false,
    tested: false,
    feeRate: '$0.00 (零佣金)',
    marginAvailable: true,
    shortSelling: true,
    prePostMarket: true,
  },
];

// ═══════════ Components ═══════════

const STATUS_MAP: Record<string, { color: string; icon: React.ReactNode; text: string }> = {
  connected: { color: '#22c55e', icon: <CheckCircleOutlined />, text: '已连接' },
  connecting: { color: '#f59e0b', icon: <SyncOutlined spin />, text: '连接中' },
  disconnected: { color: '#8b949e', icon: <CloseCircleOutlined />, text: '未连接' },
  error: { color: '#ef4444', icon: <CloseCircleOutlined />, text: '错误' },
};

const PROTOCOL_ICONS: Record<string, React.ReactNode> = {
  TWS: <ApiOutlined />,
  TigerSDK: <ThunderboltOutlined />,
  OAuth2: <SafetyCertificateOutlined />,
};

// ── Broker Card ──

function BrokerCard({
  broker,
  onTest,
  onConfigure,
}: {
  broker: USBrokerConfig;
  onTest: (id: string) => void;
  onConfigure: (id: string) => void;
}) {
  const s = STATUS_MAP[broker.status] || STATUS_MAP.disconnected;

  return (
    <Card
      size="small"
      style={{
        background: '#1a1d2e',
        border: `1px solid ${broker.status === 'connected' ? '#22c55e33' : '#2a2d3e'}`,
        borderRadius: 10,
        marginBottom: 12,
      }}
      styles={{ body: { padding: '16px' } }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Space size={10}>
          <span style={{ fontSize: 28 }}>{broker.icon}</span>
          <div>
            <div style={{ color: '#e0e0e0', fontWeight: 600, fontSize: 15 }}>
              {broker.brokerName}
            </div>
            <Space size={6} style={{ marginTop: 2 }}>
              <Badge color={s.color} text={<span style={{ color: '#8b949e', fontSize: 12 }}>{s.text}</span>} />
              <Tag color={broker.protocol === 'TWS' ? 'blue' : broker.protocol === 'TigerSDK' ? 'orange' : 'purple'} style={{ fontSize: 11 }}>
                {PROTOCOL_ICONS[broker.protocol]} {broker.protocol}
              </Tag>
            </Space>
          </div>
        </Space>

        <Space>
          <Tooltip title="测试连接">
            <Button
              size="small"
              icon={<LinkOutlined />}
              onClick={() => onTest(broker.brokerId)}
              disabled={!broker.configured}
            >
              测试
            </Button>
          </Tooltip>
          <Tooltip title="配置">
            <Button
              size="small"
              type="primary"
              ghost
              icon={<SettingOutlined />}
              onClick={() => onConfigure(broker.brokerId)}
            >
              配置
            </Button>
          </Tooltip>
        </Space>
      </div>

      {/* Features tags */}
      <div style={{ marginBottom: 10 }}>
        {broker.features.map((f) => (
          <Tag key={f} color="geekblue" style={{ marginBottom: 4 }}>{f}</Tag>
        ))}
      </div>

      {/* Details grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '8px 16px',
        color: '#8b949e',
        fontSize: 12,
      }}>
        <div><span style={{ color: '#6b7280' }}>费率</span><br /><span style={{ color: '#e0e0e0' }}>{broker.feeRate}</span></div>
        <div>
          <span style={{ color: '#6b7280' }}>市场</span><br />
          <Space size={2}>
            {broker.market.map((m) => <Tag key={m} color="cyan" style={{ fontSize: 10, lineHeight: '16px' }}>{m}</Tag>)}
          </Space>
        </div>
        <div>
          <span style={{ color: '#6b7280' }}>特性</span><br />
          <Space size={2}>
            {broker.marginAvailable && <Tag color="green" style={{ fontSize: 10, lineHeight: '16px' }}>保证金</Tag>}
            {broker.shortSelling && <Tag color="red" style={{ fontSize: 10, lineHeight: '16px' }}>做空</Tag>}
            {broker.prePostMarket && <Tag color="gold" style={{ fontSize: 10, lineHeight: '16px' }}>盘前/后</Tag>}
          </Space>
        </div>
      </div>

      {/* Status bar */}
      <div style={{
        marginTop: 12,
        padding: '8px 12px',
        background: '#0d0f1a',
        borderRadius: 6,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: 12,
      }}>
        <Space>
          <span style={{ color: '#6b7280' }}>
            <KeyOutlined /> {broker.configured ? '已配置' : '未配置'}
          </span>
          <span style={{ color: '#6b7280' }}>
            <CheckCircleOutlined /> {broker.tested ? '已测试' : '未测试'}
          </span>
        </Space>
        {broker.status === 'connected' && (
          <span style={{ color: '#22c55e' }}>
            {broker.latency}ms
          </span>
        )}
      </div>
    </Card>
  );
}

// ── Connection Test Modal ──

function ConnectionTestModal({
  broker,
  visible,
  onClose,
}: {
  broker: USBrokerConfig | null;
  visible: boolean;
  onClose: () => void;
}) {
  const [step, setStep] = useState(0);
  const [results, setResults] = useState<{ step: string; ok: boolean; latency?: number }[]>([]);
  const [testing, setTesting] = useState(false);

  const steps = [
    { title: 'DNS 解析', key: 'dns' },
    { title: 'TCP 连接', key: 'tcp' },
    { title: 'TLS 握手', key: 'tls' },
    { title: '认证', key: 'auth' },
    { title: '行情订阅', key: 'quote' },
  ];

  const runTest = useCallback(async () => {
    setTesting(true);
    for (let i = 0; i < steps.length; i++) {
      setStep(i);
      // Simulate network test
      await new Promise((r) => setTimeout(r, 600 + Math.random() * 400));
      const latency = Math.floor(20 + Math.random() * 150);
      const ok = Math.random() > 0.1;
      setResults((prev) => [...prev, { step: steps[i].key, ok, latency }]);
      if (!ok) break;
    }
    setTesting(false);
    if (broker) {
      try {
        const saved = JSON.parse(localStorage.getItem('dw-us-brokers') || '[]');
        const idx = saved.findIndex((b: any) => b.brokerId === broker.brokerId);
        if (idx >= 0) {
          saved[idx].tested = true;
          saved[idx].lastChecked = Date.now();
          localStorage.setItem('dw-us-brokers', JSON.stringify(saved));
        }
      } catch { /* ignore */ }
    }
    message.success(`${broker?.brokerName} 连接测试完成`);
  }, [broker]);

  return (
    <Modal
      title={
        <Space>
          <span>{broker?.icon}</span>
          <span>{broker?.brokerName} 连接测试</span>
          <Tag color="blue">{broker?.protocol}</Tag>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>关闭</Button>,
        <Button key="retest" type="primary" onClick={runTest} loading={testing} disabled={!broker?.configured}>
          {testing ? '测试中...' : '开始测试'}
        </Button>,
      ]}
      width={480}
    >
      <div style={{
        background: '#0d0f1a',
        borderRadius: 8,
        padding: '16px',
        marginBottom: 16,
      }}>
        <Steps
          direction="vertical"
          size="small"
          current={step}
          items={steps.map((s, i) => {
            const r = results[i];
            return {
              title: s.title,
              description: r
                ? <span style={{ color: r.ok ? '#22c55e' : '#ef4444' }}>
                    {r.ok ? `✅ ${r.latency}ms` : '❌ 失败'}
                  </span>
                : (i === step && testing ? <SyncOutlined spin style={{ color: '#f59e0b' }} /> : null),
              status: r ? (r.ok ? 'finish' as const : 'error' as const) : (i === step && testing ? 'process' as const : 'wait' as const),
            };
          })}
        />
      </div>

      {results.length > 0 && (
        <div style={{ fontSize: 12, color: '#8b949e' }}>
          总延迟: {results.reduce((a, r) => a + (r.latency || 0), 0)}ms |
          成功率: {results.filter((r) => r.ok).length}/{results.length}
        </div>
      )}
    </Modal>
  );
}

// ── Configure Modal ──

function ConfigureModal({
  broker,
  visible,
  onClose,
}: {
  broker: USBrokerConfig | null;
  visible: boolean;
  onClose: () => void;
}) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 500));
    try {
      const values = form.getFieldsValue();
      const saved = JSON.parse(localStorage.getItem('dw-us-brokers') || '[]');
      const idx = saved.findIndex((b: any) => b.brokerId === broker?.brokerId);
      const cfg = {
        brokerId: broker?.brokerId,
        brokerName: broker?.brokerName,
        configured: true,
        ...values,
        updatedAt: Date.now(),
      };
      if (idx >= 0) saved[idx] = cfg;
      else saved.push(cfg);
      localStorage.setItem('dw-us-brokers', JSON.stringify(saved));
      message.success(`${broker?.brokerName} 配置已保存`);
      onClose();
    } catch {
      message.error('保存失败');
    }
    setSaving(false);
  }, [broker, form]);

  return (
    <Modal
      title={
        <Space>
          <span>{broker?.icon}</span>
          <span>{broker?.brokerName} 配置</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      onOk={handleSave}
      confirmLoading={saving}
      width={520}
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        {broker?.authType === 'api_key' && (
          <>
            <Form.Item label="API Key" name="apiKey" rules={[{ required: true, message: '请输入 API Key' }]}>
              <Input.Password placeholder="输入 API Key" />
            </Form.Item>
            <Form.Item label="Secret Key" name="secretKey" rules={[{ required: true, message: '请输入 Secret Key' }]}>
              <Input.Password placeholder="输入 Secret Key" />
            </Form.Item>
            {broker.protocol === 'TWS' && (
              <Form.Item label="TWS 端口" name="twsPort" initialValue={7497}>
                <Input type="number" placeholder="7497 (实盘) / 7496 (模拟)" />
              </Form.Item>
            )}
          </>
        )}

        {broker?.authType === 'oauth2' && (
          <div style={{
            padding: '16px',
            background: '#0d0f1a',
            borderRadius: 8,
            textAlign: 'center',
            marginBottom: 16,
          }}>
            <div style={{ color: '#e0e0e0', marginBottom: 8 }}>OAuth2 授权</div>
            <div style={{ color: '#8b949e', fontSize: 12, marginBottom: 12 }}>
              点击下方按钮跳转至 Schwab 授权页面
            </div>
            <Button type="primary" icon={<LinkOutlined />} block>
              跳转授权
            </Button>
          </div>
        )}

        <Form.Item label="别名" name="alias">
          <Input placeholder={`我的 ${broker?.brokerName} 账户`} />
        </Form.Item>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
        }}>
          <Form.Item label="最大仓位 (USD)" name="maxPositionSize" initialValue={50000}>
            <Input type="number" />
          </Form.Item>
          <Form.Item label="每单上限 (USD)" name="maxOrderSize" initialValue={10000}>
            <Input type="number" />
          </Form.Item>
        </div>

        <Form.Item label="备注" name="note">
          <Input.TextArea rows={2} placeholder="可选备注..." />
        </Form.Item>
      </Form>
    </Modal>
  );
}

// ── Main USBrokerPanel ──

export default function USBrokerPanel() {
  const [brokers, setBrokers] = useState<USBrokerConfig[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('dw-us-brokers') || '[]');
      if (saved.length > 0) {
        return MOCK_US_BROKERS.map((b) => {
          const savedCfg = saved.find((s: any) => s.brokerId === b.brokerId);
          return savedCfg ? { ...b, ...savedCfg } : b;
        });
      }
    } catch { /* fallback */ }
    return MOCK_US_BROKERS;
  });

  const [testBroker, setTestBroker] = useState<USBrokerConfig | null>(null);
  const [configBroker, setConfigBroker] = useState<USBrokerConfig | null>(null);
  const [testVisible, setTestVisible] = useState(false);
  const [configVisible, setConfigVisible] = useState(false);

  const handleTest = useCallback((id: string) => {
    const b = brokers.find((x) => x.brokerId === id);
    if (b) {
      setTestBroker(b);
      setTestVisible(true);
    }
  }, [brokers]);

  const handleConfigure = useCallback((id: string) => {
    const b = brokers.find((x) => x.brokerId === id);
    if (b) {
      setConfigBroker(b);
      setConfigVisible(true);
    }
  }, [brokers]);

  const connectedCount = brokers.filter((b) => b.status === 'connected').length;
  const configuredCount = brokers.filter((b) => b.configured).length;

  return (
    <div style={{ padding: '0 4px' }}>
      {/* Summary Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        padding: '12px 16px',
        background: 'linear-gradient(135deg, #1a1d2e 0%, #232740 100%)',
        borderRadius: 10,
        border: '1px solid #2a2d3e',
      }}>
        <Space size={20}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#e0e0e0' }}>{brokers.length}</div>
            <div style={{ fontSize: 11, color: '#6b7280' }}>券商</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#22c55e' }}>{connectedCount}</div>
            <div style={{ fontSize: 11, color: '#6b7280' }}>已连接</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#f59e0b' }}>{configuredCount}</div>
            <div style={{ fontSize: 11, color: '#6b7280' }}>已配置</div>
          </div>
          <div style={{ width: 1, height: 36, background: '#2a2d3e' }} />
          <div>
            <Progress
              percent={Math.round((configuredCount / brokers.length) * 100)}
              size="small"
              style={{ width: 120, margin: 0 }}
              strokeColor="#3b82f6"
              trailColor="#1e2030"
              format={(p) => `配置 ${p}%`}
            />
          </div>
        </Space>

        <Space size={8}>
          {brokers.map((b) => (
            <Tooltip key={b.brokerId} title={`${b.brokerName}: ${STATUS_MAP[b.status]?.text}`}>
              <span style={{
                display: 'inline-block',
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: STATUS_MAP[b.status]?.color || '#8b949e',
                border: '2px solid #1a1d2e',
              }} />
            </Tooltip>
          ))}
        </Space>
      </div>

      {/* Broker Cards */}
      {brokers.map((broker) => (
        <BrokerCard
          key={broker.brokerId}
          broker={broker}
          onTest={handleTest}
          onConfigure={handleConfigure}
        />
      ))}

      {/* Feature comparison table */}
      <Card
        size="small"
        title={<span style={{ color: '#e0e0e0', fontSize: 14 }}>📊 功能对比</span>}
        style={{
          background: '#1a1d2e',
          border: '1px solid #2a2d3e',
          borderRadius: 10,
          marginTop: 12,
        }}
        styles={{ body: { padding: '12px' } }}
      >
        <table style={{ width: '100%', fontSize: 12, color: '#c0c0c0', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ color: '#6b7280' }}>
              <th style={{ textAlign: 'left', padding: '6px 8px' }}>功能</th>
              {brokers.map((b) => (
                <th key={b.brokerId} style={{ textAlign: 'center', padding: '6px 8px' }}>
                  <span>{b.icon}</span> {b.brokerName.split(' ')[0]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { label: '美股', keys: ['股票'] },
              { label: '期权', keys: ['期权'] },
              { label: '期货', keys: ['期货'] },
              { label: '保证金', keys: [] },
              { label: '做空', keys: [] },
              { label: '盘前/后', keys: [] },
              { label: '佣金', keys: [] },
            ].map((row) => (
              <tr key={row.label} style={{ borderTop: '1px solid #1e2030' }}>
                <td style={{ padding: '6px 8px', color: '#8b949e' }}>{row.label}</td>
                {brokers.map((b) => {
                  if (row.label === '保证金') {
                    return (
                      <td key={b.brokerId} style={{ textAlign: 'center', padding: '6px 8px' }}>
                        {b.marginAvailable ? <CheckCircleOutlined style={{ color: '#22c55e' }} /> : <CloseCircleOutlined style={{ color: '#ef4444' }} />}
                      </td>
                    );
                  }
                  if (row.label === '做空') {
                    return (
                      <td key={b.brokerId} style={{ textAlign: 'center', padding: '6px 8px' }}>
                        {b.shortSelling ? <CheckCircleOutlined style={{ color: '#22c55e' }} /> : <CloseCircleOutlined style={{ color: '#ef4444' }} />}
                      </td>
                    );
                  }
                  if (row.label === '盘前/后') {
                    return (
                      <td key={b.brokerId} style={{ textAlign: 'center', padding: '6px 8px' }}>
                        {b.prePostMarket ? <CheckCircleOutlined style={{ color: '#22c55e' }} /> : <CloseCircleOutlined style={{ color: '#ef4444' }} />}
                      </td>
                    );
                  }
                  if (row.label === '佣金') {
                    return (
                      <td key={b.brokerId} style={{ textAlign: 'center', padding: '6px 8px', color: '#e0e0e0' }}>
                        {b.feeRate}
                      </td>
                    );
                  }
                  // Feature check
                  return (
                    <td key={b.brokerId} style={{ textAlign: 'center', padding: '6px 8px' }}>
                      {b.features.some((f) => row.keys.includes(f))
                        ? <CheckCircleOutlined style={{ color: '#22c55e' }} />
                        : <CloseCircleOutlined style={{ color: '#ef4444' }} />}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Modals */}
      <ConnectionTestModal broker={testBroker} visible={testVisible} onClose={() => setTestVisible(false)} />
      <ConfigureModal broker={configBroker} visible={configVisible} onClose={() => { setConfigVisible(false); setConfigBroker(null); }} />
    </div>
  );
}
