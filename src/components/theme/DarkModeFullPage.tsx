// @ts-nocheck
// QUANT MOO — 暗色模式全页面 (Dark Mode Full Page)
// R254 ML#3 UI-07 — 全局暗色主题+预览+对比 (6h)

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Switch, Row, Col, Typography, Space, Tabs, Segmented,
  Tag, Statistic, Button, Select, Slider, ColorPicker, Divider,
  Table, Progress, Radio, message, Alert
} from 'antd';
import {
  BulbOutlined, SunOutlined, MoonOutlined, SettingOutlined,
  CheckCircleOutlined, DesktopOutlined, MobileOutlined,
  TabletOutlined, EyeOutlined, SwapOutlined, CopyOutlined,
  DownloadOutlined, AppstoreOutlined, LayoutOutlined,
  ExperimentOutlined, StarOutlined, InfoCircleOutlined
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

// ── Types ──
interface ThemeConfig {
  mode: 'light' | 'dark' | 'auto';
  autoFollow: boolean;
  darkStartHour: number;
  darkEndHour: number;
  primaryColor: string;
  borderRadius: number;
  fontSize: number;
  fontFamily: string;
}

interface PagePreview {
  id: string;
  name: string;
  nameCN: string;
  icon: React.ReactNode;
  route: string;
  lightPreview: string;
  darkPreview: string;
  status: 'done' | 'partial' | 'pending';
}

// ── Mock ──
const defaultConfig: ThemeConfig = {
  mode: 'auto',
  autoFollow: true,
  darkStartHour: 19,
  darkEndHour: 7,
  primaryColor: '#1677ff',
  borderRadius: 6,
  fontSize: 14,
  fontFamily: 'system-ui',
};

const pagePreviews: PagePreview[] = [
  { id: 'cockpit', name: 'Cockpit', nameCN: '驾驶舱', icon: <AppstoreOutlined />, route: '/cockpit', lightPreview: '■ dark header + white bg + blue accents', darkPreview: '■ dark header + dark bg + blue accents', status: 'done' },
  { id: 'heatmap', name: 'HeatMap', nameCN: '热力图', icon: <EyeOutlined />, route: '/market/heatmap', lightPreview: '■ light bg + green/red heat tiles', darkPreview: '■ dark bg + muted green/red tiles', status: 'done' },
  { id: 'watchlist', name: 'Watchlist', nameCN: '自选', icon: <StarOutlined />, route: '/market/watchlist', lightPreview: '■ white rows + blue links', darkPreview: '■ dark rows + lighter blue links', status: 'done' },
  { id: 'strategy', name: 'Strategy', nameCN: '策略', icon: <ExperimentOutlined />, route: '/strategy', lightPreview: '■ white cards + green/red PnL', darkPreview: '■ dark cards + bright green/red', status: 'partial' },
  { id: 'backtest', name: 'Backtest', nameCN: '回测', icon: <LayoutOutlined />, route: '/backtest', lightPreview: '■ white bg + echarts light theme', darkPreview: '■ dark bg + echarts dark theme', status: 'partial' },
  { id: 'portfolio', name: 'Portfolio', nameCN: '持仓', icon: <DesktopOutlined />, route: '/portfolio', lightPreview: '■ light cards + colored stats', darkPreview: '■ dark cards + bright stats', status: 'partial' },
  { id: 'settings', name: 'Settings', nameCN: '设置', icon: <SettingOutlined />, route: '/settings', lightPreview: '■ white form + blue buttons', darkPreview: '■ dark form + blue buttons', status: 'done' },
  { id: 'market', name: 'Market', nameCN: '行情', icon: <SwapOutlined />, route: '/market', lightPreview: '■ light bg + green/red tickers', darkPreview: '■ dark bg + bright tickers', status: 'pending' },
];

// ── Theme Preview Card ──
const ThemePreviewCard: React.FC<{ mode: 'light' | 'dark' }> = ({ mode }) => {
  const isDark = mode === 'dark';
  const bg = isDark ? '#141414' : '#ffffff';
  const surface = isDark ? '#1f1f1f' : '#fafafa';
  const text = isDark ? '#e8e8e8' : '#333333';
  const muted = isDark ? '#8c8c8c' : '#999999';
  const border = isDark ? '#303030' : '#f0f0f0';
  const accent = '#1677ff';
  const success = isDark ? '#49aa19' : '#52c41a';
  const danger = isDark ? '#d32029' : '#ff4d4f';

  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 8, padding: 16, width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, padding: '8px 12px', background: surface, borderRadius: 6 }}>
        <Space>
          <div style={{ width: 24, height: 24, background: accent, borderRadius: 6 }} />
          <Text strong style={{ fontSize: 13, color: text }}>QUANT MOO</Text>
        </Space>
        <Space>
          <div style={{ width: 20, height: 20, background: muted, borderRadius: 10 }} />
          <div style={{ width: 20, height: 20, background: muted, borderRadius: 10 }} />
        </Space>
      </div>

      {/* Stats Row */}
      <Row gutter={[6, 6]} style={{ marginBottom: 12 }}>
        {[{ label: 'SPX', val: '+0.53%', up: true }, { label: 'BTC', val: '+1.29%', up: true }, { label: 'HSI', val: '-1.25%', up: false }]
          .map(s => (
            <Col span={8} key={s.label}>
              <div style={{ background: surface, borderRadius: 6, padding: '6px 8px' }}>
                <Text style={{ fontSize: 10, color: muted }}>{s.label}</Text>
                <Text strong style={{ fontSize: 13, color: s.up ? success : danger, display: 'block' }}>
                  {s.val}
                </Text>
              </div>
            </Col>
          ))}
      </Row>

      {/* Content cards */}
      <Row gutter={[6, 6]}>
        <Col span={12}>
          <div style={{ background: surface, borderRadius: 6, padding: '8px' }}>
            <Text style={{ fontSize: 10, color: muted }}>AI 快评</Text>
            <Paragraph ellipsis={{ rows: 2 }} style={{ fontSize: 10, color: text, margin: '4px 0 0' }}>
              NVDA新芯片发布 + AI需求超预期，半导体板块领涨...
            </Paragraph>
          </div>
        </Col>
        <Col span={12}>
          <div style={{ background: surface, borderRadius: 6, padding: '8px' }}>
            <Text style={{ fontSize: 10, color: muted }}>今日因子</Text>
            <div style={{ marginTop: 4 }}>
              <Tag color="green" style={{ fontSize: 9 }}>动量 强多</Tag>
              <Tag color="orange" style={{ fontSize: 9 }}>低波 偏空</Tag>
            </div>
          </div>
        </Col>
      </Row>

      {/* Chart placeholder */}
      <div style={{
        background: surface, borderRadius: 6, padding: '12px', marginTop: 8,
        display: 'flex', alignItems: 'center', justifyContent: 'center', height: 60,
      }}>
        <Text style={{ fontSize: 11, color: muted }}>━━━━ 📈 K线图区域 ━━━━</Text>
      </div>

      {/* Table placeholder */}
      <div style={{
        background: surface, borderRadius: 6, padding: '8px', marginTop: 8,
      }}>
        <Text style={{ fontSize: 10, color: muted }}>自选列表 · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·</Text>
      </div>
    </div>
  );
};

// ── Page Coverage Grid ──
const CoverageGrid: React.FC = () => {
  const done = pagePreviews.filter(p => p.status === 'done').length;
  const partial = pagePreviews.filter(p => p.status === 'partial').length;
  const pending = pagePreviews.filter(p => p.status === 'pending').length;

  return (
    <Card title={<Space><LayoutOutlined /> 页面覆盖</Space>} size="small">
      <Row gutter={[8, 8]}>
        <Col xs={8}>
          <Statistic title={<Text type="success">✅ 完成</Text>} value={done} suffix={`/${pagePreviews.length}`} />
        </Col>
        <Col xs={8}>
          <Statistic title={<Text type="warning">⚠️ 部分</Text>} value={partial} suffix={`/${pagePreviews.length}`} />
        </Col>
        <Col xs={8}>
          <Statistic title={<Text type="secondary">⬜ 待做</Text>} value={pending} suffix={`/${pagePreviews.length}`} />
        </Col>
      </Row>
      <Progress percent={Math.round((done / pagePreviews.length) * 100)} style={{ margin: '8px 0' }}
        strokeColor={{ '0%': '#52c41a', '100%': '#1677ff' }} />
      <Table dataSource={pagePreviews} rowKey="id" size="small" pagination={false}
        columns={[
          {
            title: '页面', key: 'name', render: (_: any, r: PagePreview) => (
              <Space size={4}>
                {r.icon}
                <Text>{r.nameCN}</Text>
              </Space>
            )
          },
          {
            title: '亮色', key: 'light', width: 240, render: (_: any, r: PagePreview) => (
              <Text style={{ fontSize: 11, color: '#999' }}>{r.lightPreview}</Text>
            )
          },
          {
            title: '暗色', key: 'dark', width: 240, render: (_: any, r: PagePreview) => (
              <Text style={{ fontSize: 11, color: '#999' }}>{r.darkPreview}</Text>
            )
          },
          {
            title: '状态', key: 'status', width: 70, render: (_: any, r: PagePreview) => (
              <Tag color={r.status === 'done' ? 'success' : r.status === 'partial' ? 'warning' : 'default'}>
                {r.status === 'done' ? '完成' : r.status === 'partial' ? '部分' : '待做'}
              </Tag>
            )
          },
        ]} />
    </Card>
  );
};

// ── Config Panel ──
const ThemeConfigPanel: React.FC = () => {
  const [config, setConfig] = useState<ThemeConfig>(defaultConfig);

  const update = (patch: Partial<ThemeConfig>) => {
    setConfig(prev => ({ ...prev, ...patch }));
    message.success('主题配置已更新（预览模式）');
  };

  return (
    <Card title={<Space><SettingOutlined /> 主题配置</Space>} size="small">
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        {/* Mode */}
        <div>
          <Text strong style={{ display: 'block', marginBottom: 4 }}>主题模式</Text>
          <Radio.Group value={config.mode} onChange={e => update({ mode: e.target.value })}>
            <Radio.Button value="light"><SunOutlined /> 亮色</Radio.Button>
            <Radio.Button value="dark"><MoonOutlined /> 暗色</Radio.Button>
            <Radio.Button value="auto"><DesktopOutlined /> 自动</Radio.Button>
          </Radio.Group>
        </div>

        {/* Auto schedule */}
        {config.mode === 'auto' && (
          <div>
            <Space>
              <Switch checked={config.autoFollow} onChange={v => update({ autoFollow: v })} />
              <Text>跟随系统自动切换</Text>
            </Space>
            {!config.autoFollow && (
              <Space style={{ marginTop: 8 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>暗色:</Text>
                <Select size="small" value={config.darkStartHour} onChange={v => update({ darkStartHour: v })}
                  options={Array.from({ length: 24 }, (_, i) => ({ label: `${i}:00`, value: i }))}
                  style={{ width: 80 }} />
                <Text type="secondary" style={{ fontSize: 12 }}>至</Text>
                <Select size="small" value={config.darkEndHour} onChange={v => update({ darkEndHour: v })}
                  options={Array.from({ length: 24 }, (_, i) => ({ label: `${i}:00`, value: i }))}
                  style={{ width: 80 }} />
              </Space>
            )}
          </div>
        )}

        {/* Primary Color */}
        <div>
          <Text strong style={{ display: 'block', marginBottom: 4 }}>主色调</Text>
          <Space>
            <ColorPicker value={config.primaryColor} onChange={(_: any, hex: string) => update({ primaryColor: hex })} />
            <Text type="secondary" style={{ fontSize: 12 }}>{config.primaryColor}</Text>
          </Space>
        </div>

        {/* Border Radius */}
        <div>
          <Text strong style={{ display: 'block', marginBottom: 4 }}>圆角大小</Text>
          <Slider min={0} max={16} value={config.borderRadius} onChange={v => update({ borderRadius: v })}
            marks={{ 0: '0', 4: '4', 8: '8', 12: '12', 16: '16' }} />
        </div>

        {/* Font Size */}
        <div>
          <Text strong style={{ display: 'block', marginBottom: 4 }}>字号</Text>
          <Slider min={12} max={20} value={config.fontSize} onChange={v => update({ fontSize: v })}
            marks={{ 12: '12', 14: '14', 16: '16', 18: '18', 20: '20' }} />
        </div>

        {/* Font Family */}
        <div>
          <Text strong style={{ display: 'block', marginBottom: 4 }}>字体</Text>
          <Select size="small" value={config.fontFamily} onChange={v => update({ fontFamily: v })}
            style={{ width: '100%' }}
            options={[
              { label: 'System UI', value: 'system-ui' },
              { label: 'Inter', value: 'Inter, sans-serif' },
              { label: 'PingFang SC (中文)', value: 'PingFang SC, Microsoft YaHei' },
              { label: 'Noto Sans SC', value: 'Noto Sans SC, sans-serif' },
            ]} />
        </div>

        {/* Action */}
        <Button type="primary" block icon={<CheckCircleOutlined />}
          onClick={() => message.success('主题已应用 (模拟)')}>
          应用主题
        </Button>
      </Space>
    </Card>
  );
};

// ── Main Component ──
const DarkModeFullPage: React.FC = () => {
  const [previewMode, setPreviewMode] = useState<'light' | 'dark'>('light');

  return (
    <div style={{ padding: 16, maxWidth: 1600, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <BulbOutlined style={{ fontSize: 24, color: '#faad14' }} />
          <Title level={3} style={{ margin: 0 }}>暗色模式</Title>
          <Tag color="blue">全局主题</Tag>
        </Space>
        <Segmented value={previewMode} onChange={v => setPreviewMode(v as any)}
          options={[
            { label: <Space size={2}><SunOutlined /> 亮色预览</Space>, value: 'light' },
            { label: <Space size={2}><MoonOutlined /> 暗色预览</Space>, value: 'dark' },
          ]} />
      </div>

      <Alert
        message="暗色模式已覆盖 4/8 页面（50%），策略、回测、持仓为部分覆盖，行情页面待开发"
        type="info" showIcon style={{ marginBottom: 16 }}
        action={<Button size="small" type="link">查看清单</Button>}
      />

      <Row gutter={[16, 16]}>
        {/* Left: Side-by-side preview */}
        <Col xs={24} lg={12}>
          <Tabs defaultActiveKey="compare" items={[
            {
              key: 'compare',
              label: <Space size={2}><SwapOutlined /> 对比预览</Space>,
              children: (
                <Row gutter={[12, 12]}>
                  <Col span={12}>
                    <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginBottom: 4 }}>
                      <SunOutlined /> 亮色模式
                    </Text>
                    <ThemePreviewCard mode="light" />
                  </Col>
                  <Col span={12}>
                    <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginBottom: 4 }}>
                      <MoonOutlined /> 暗色模式
                    </Text>
                    <ThemePreviewCard mode="dark" />
                  </Col>
                </Row>
              )
            },
            {
              key: 'single',
              label: <Space size={2}><EyeOutlined /> {previewMode === 'light' ? '亮色' : '暗色'}预览</Space>,
              children: (
                <div style={{ maxWidth: 600, margin: '0 auto' }}>
                  <ThemePreviewCard mode={previewMode} />
                </div>
              )
            },
          ]} />
        </Col>

        {/* Right: Config + Coverage */}
        <Col xs={24} lg={12}>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <ThemeConfigPanel />
            <CoverageGrid />
          </Space>
        </Col>
      </Row>
    </div>
  );
};

export default DarkModeFullPage;
