// @ts-nocheck
// QUANT MOO — 去Mock版驾驶舱 (De-Mocked Cockpit)
// R261 ML#1 P0-03 — 使用useAllMarketData hook重连数据源 (8h)

import React, { useState, useEffect } from 'react';
import {
  Card, Tabs, Tag, Progress, Badge, Space, Tooltip, Statistic,
  Select, Switch, Button, Spin, Row, Col, Table, Typography, Divider,
  Segmented, Alert
} from 'antd';
import {
  ThunderboltOutlined, RiseOutlined, FallOutlined, FireOutlined,
  StockOutlined, LineChartOutlined, DashboardOutlined, WarningOutlined,
  ReloadOutlined, SettingOutlined, BellOutlined, EyeOutlined,
  RightOutlined, CaretUpOutlined, CaretDownOutlined, MinusOutlined,
  ApiOutlined, GlobalOutlined, CheckCircleOutlined, ExclamationCircleOutlined,
  ExperimentOutlined, LinkOutlined
} from '@ant-design/icons';
import {
  useAllMarketData, DataMode, MarketQuote, SectorData, MoverItem, FactorSignal, AIQuickTake, IndexSnapshot
} from '../../hooks/useMarketData';

const { Title, Text, Paragraph } = Typography;

// ── Sub-components ──

const DataSourceBadge: React.FC<{ mode: DataMode; connected: boolean }> = ({ mode, connected }) => {
  if (mode === 'mock') return <Tag color="orange"><ExperimentOutlined /> Mock数据</Tag>;
  if (mode === 'hybrid') return <Tag color="blue"><LinkOutlined /> 混合模式</Tag>;
  if (connected) return <Tag color="green"><ApiOutlined /> Yahoo LS 实时</Tag>;
  return <Tag color="red"><ExclamationCircleOutlined /> 未连接(回退Mock)</Tag>;
};

const MarketIndexCard: React.FC<{ m: IndexSnapshot }> = ({ m }) => {
  const isUp = m.change >= 0;
  return (
    <Card size="small" style={{ borderLeft: `3px solid ${isUp ? '#52c41a' : '#ff4d4f'}` }}>
      <Space direction="vertical" size={0} style={{ width: '100%' }}>
        <Space>
          <Text strong>{m.index}</Text>
          <Tag color={m.status === 'open' ? 'green' : 'default'}>
            {m.status === 'open' ? '● 交易中' : '已收市'}
          </Tag>
        </Space>
        <Text strong style={{ fontSize: 16 }}>{m.price.toLocaleString()}</Text>
        <Text type={isUp ? 'success' : 'danger'} strong>
          {isUp ? <CaretUpOutlined /> : <CaretDownOutlined />}
          {Math.abs(m.change).toFixed(2)} ({isUp ? '+' : ''}{m.changePct.toFixed(2)}%)
        </Text>
      </Space>
    </Card>
  );
};

const SectorHeatmap: React.FC<{ sectors: SectorData[] }> = ({ sectors }) => {
  const maxAbs = Math.max(...sectors.map(s => Math.abs(s.changePct)), 1);
  return (
    <Card title="🔥 板块热度" size="small">
      {sectors.map(s => (
        <div key={s.sector} style={{ marginBottom: 6 }}>
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 12 }}>{s.sectorCN}</Text>
            <Text type={s.changePct >= 0 ? 'success' : 'danger'} strong style={{ fontSize: 11 }}>
              {s.changePct >= 0 ? <CaretUpOutlined /> : <CaretDownOutlined />}
              {s.changePct >= 0 ? '+' : ''}{s.changePct}%
            </Text>
          </Space>
          <div style={{ background: '#f0f0f0', borderRadius: 4, height: 6, overflow: 'hidden' }}>
            <div style={{
              width: `${(Math.abs(s.changePct) / maxAbs) * 100}%`,
              height: '100%', borderRadius: 4,
              background: s.changePct >= 0 ? '#52c41a' : '#ff4d4f',
              transition: 'width 0.3s',
            }} />
          </div>
          <div style={{ fontSize: 10, color: '#999', marginTop: 2 }}>
            {s.upCount}↑{s.downCount}↓ · {s.topPerformer} {s.topPerformerPct > 0 ? '+' : ''}{s.topPerformerPct}%
          </div>
        </div>
      ))}
    </Card>
  );
};

const TopMoversTable: React.FC<{ movers: MoverItem[] }> = ({ movers }) => {
  const severityColor = (s: string) => s === 'extreme' ? 'red' : s === 'major' ? 'volcano' : s === 'notable' ? 'blue' : 'default';
  return (
    <Card title="⚡ 今日异动" size="small">
      <div style={{ maxHeight: 320, overflowY: 'auto' }}>
        {movers.map(m => (
          <div key={m.symbol + m.timestamp} style={{ padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              <Space size={4}>
                {m.isNew && <Badge status="processing" />}
                <Tag color={severityColor(m.severity)} style={{ fontSize: 9 }}>{m.severity}</Tag>
                <Text strong style={{ fontSize: 11 }}>{m.symbol}</Text>
                <Text type="secondary" style={{ fontSize: 10 }}>{m.name}</Text>
              </Space>
              <Text type={m.changePct >= 0 ? 'success' : 'danger'} strong style={{ fontSize: 11 }}>
                {m.changePct >= 0 ? '+' : ''}{m.changePct}%
              </Text>
            </Space>
            <Text type="secondary" style={{ fontSize: 10, marginTop: 2, display: 'block' }}>{m.reason}</Text>
          </div>
        ))}
      </div>
    </Card>
  );
};

const FactorSignalBar: React.FC<{ factors: FactorSignal[] }> = ({ factors }) => {
  const signalColor = (s: string) => {
    const m: Record<string, string> = { strong_bull: '#237804', bull: '#52c41a', neutral: '#8c8c8c', bear: '#fa8c16', strong_bear: '#ff4d4f' };
    return m[s] || '#8c8c8c';
  };
  const signalLabel = (s: string) => {
    const m: Record<string, string> = { strong_bull: '强多', bull: '偏多', neutral: '中性', bear: '偏空', strong_bear: '强空' };
    return m[s] || '未知';
  };
  return (
    <Card title="🧬 因子信号" size="small">
      {factors.map(f => (
        <div key={f.factor} style={{ marginBottom: 6 }}>
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Space size={4}>
              <Tag color={f.category === '动量' ? 'blue' : f.category === '质量' ? 'purple' : 'default'} style={{ fontSize: 9 }}>{f.category}</Tag>
              <Text style={{ fontSize: 11 }}>{f.factor}</Text>
            </Space>
            <Space size={4}>
              <Tag color={signalColor(f.signal)} style={{ fontSize: 9 }}>{signalLabel(f.signal)}</Tag>
              <Text type="secondary" style={{ fontSize: 9 }}>IC {f.ic.toFixed(3)}</Text>
            </Space>
          </Space>
        </div>
      ))}
    </Card>
  );
};

const AIQuickTakePanel: React.FC<{ takes: AIQuickTake[] }> = ({ takes }) => {
  const sentEmoji: Record<string, string> = { bullish: '🐂', bearish: '🐻', neutral: '😐', cautious: '⚠️', excited: '🚀' };
  const sentColor: Record<string, string> = { bullish: 'green', bearish: 'red', neutral: 'default', cautious: 'orange', excited: 'gold' };
  return (
    <Card title="🤖 AI 快评" size="small">
      {takes.map(t => (
        <div key={t.id} style={{ padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
          <Space>
            <Tag color={sentColor[t.sentiment]}>{sentEmoji[t.sentiment]} {t.market.toUpperCase()}</Tag>
            <Text strong style={{ fontSize: 12 }}>{t.headline}</Text>
          </Space>
          <Paragraph ellipsis={{ rows: 2 }} style={{ fontSize: 11, color: '#666', marginTop: 4 }}>{t.body}</Paragraph>
          <Space size={2} style={{ marginTop: 4 }}>
            {t.keyFactors.map(kf => <Tag key={kf} style={{ fontSize: 9 }}>{kf}</Tag>)}
            <Text type="secondary" style={{ fontSize: 9 }}>置信 {t.confidence}%</Text>
          </Space>
        </div>
      ))}
    </Card>
  );
};

// ── Main Cockpit ──
const DeMockedCockpit: React.FC = () => {
  const [dataMode, setDataMode] = useState<DataMode>('mock');
  const { quotes, connected, sectors, sectorsLoading, movers, factors, takes, indices, lastUpdate } = useAllMarketData(dataMode);

  return (
    <div style={{ padding: 16, maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <DashboardOutlined style={{ fontSize: 24, color: '#1677ff' }} />
          <Title level={3} style={{ margin: 0 }}>QUANT MOO 驾驶舱</Title>
          <DataSourceBadge mode={dataMode} connected={connected} />
        </Space>
        <Space>
          <Select size="small" value={dataMode} onChange={v => setDataMode(v as DataMode)} style={{ width: 100 }}
            options={[
              { label: 'Mock', value: 'mock' },
              { label: 'Hybrid', value: 'hybrid' },
              { label: 'Live', value: 'live' },
            ]} />
          <Tooltip title={`数据源: ${quotes.length}条行情 · ${connected ? '已连接' : 'Mock模式'}`}>
            <Tag color={connected ? 'green' : 'orange'}>
              {quotes.length}条 · {new Date(lastUpdate).toLocaleTimeString()}
            </Tag>
          </Tooltip>
        </Space>
      </div>

      {/* Mock → Live transition banner */}
      {dataMode === 'mock' && (
        <Alert
          type="info"
          showIcon
          icon={<ExperimentOutlined />}
          message="当前使用模拟数据 (Mock模式)"
          description="切换到 Live 模式连接Yahoo Finance WebSocket获取真实数据流。需先启动后端引擎。"
          style={{ marginBottom: 12 }}
          action={
            <Button size="small" type="primary" onClick={() => setDataMode('live')}>
              切换到 Live
            </Button>
          }
        />
      )}

      <Spin spinning={sectorsLoading}>
        {/* Indices */}
        <Divider orientation="left" style={{ fontSize: 13, margin: '12px 0 8px' }}>
          <GlobalOutlined /> 全球指数
        </Divider>
        <Row gutter={[8, 8]}>
          {indices.map(m => (
            <Col xs={12} sm={8} md={8} lg={4} key={m.index}>
              <MarketIndexCard m={m} />
            </Col>
          ))}
        </Row>

        {/* Overview Panels */}
        <Divider orientation="left" style={{ fontSize: 13, margin: '12px 0 8px' }}>
          <StockOutlined /> 概览面板
        </Divider>
        <Row gutter={[8, 8]}>
          <Col xs={24} md={12} lg={8}>
            <SectorHeatmap sectors={sectors} />
          </Col>
          <Col xs={24} md={12} lg={8}>
            <TopMoversTable movers={movers} />
          </Col>
          <Col xs={24} md={12} lg={8}>
            <FactorSignalBar factors={factors} />
          </Col>
        </Row>

        {/* AI Takes */}
        <Divider orientation="left" style={{ fontSize: 13, margin: '12px 0 8px' }}>
          <ThunderboltOutlined /> AI 快评
        </Divider>
        <Row gutter={[8, 8]}>
          {takes.map(t => (
            <Col xs={24} md={12} lg={8} key={t.id}>
              <AIQuickTakePanel takes={[t]} />
            </Col>
          ))}
        </Row>
      </Spin>
    </div>
  );
};

export default DeMockedCockpit;
