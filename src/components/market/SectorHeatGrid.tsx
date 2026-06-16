// @ts-nocheck
// QUANT MOO — 10板块热力图方格 (10-Sector Heat Map Grid)
// R261 ML#2 P1-04 — 10板块×3色阶可视化 (6h)

import React, { useMemo } from 'react';
import {
  Card, Row, Col, Space, Typography, Tag, Tooltip, Segmented, Select,
  Progress, Statistic, Divider, Empty
} from 'antd';
import {
  FireOutlined, CaretUpOutlined, CaretDownOutlined, MinusOutlined,
  EyeOutlined, AppstoreOutlined, TableOutlined, FundOutlined
} from '@ant-design/icons';
import type { SectorData } from '../../hooks/useMarketData';
import { useSectorData, DataMode } from '../../hooks/useMarketData';

const { Title, Text } = Typography;

// ── 3-Step Color Scale ──
// Hot (>+2%): dark green
// Neutral (-2% to +2%): light green / light red / gray
// Cold (<-2%): dark red
const getSectorHeatColor = (changePct: number): string => {
  if (changePct >= 5) return '#237804';   // extreme up
  if (changePct >= 2) return '#389e0d';   // strong up
  if (changePct >= 0.5) return '#52c41a'; // moderate up
  if (changePct >= 0) return '#b7eb8f';   // slight up
  if (changePct >= -0.5) return '#fff1f0'; // slight down
  if (changePct >= -2) return '#ffa39e';   // moderate down
  if (changePct >= -5) return '#ff4d4f';   // strong down
  return '#a8071a';                        // extreme down
};

const getBgColor = (changePct: number): string => {
  if (changePct >= 2) return '#f6ffed';
  if (changePct >= 0) return '#fcffe6';
  if (changePct >= -2) return '#fff2f0';
  return '#fff1f0';
};

// ── Sector Card ──
const SectorCard: React.FC<{ sector: SectorData; rank: number }> = ({ sector, rank }) => {
  const heatColor = getSectorHeatColor(sector.changePct);
  const bgColor = getBgColor(sector.changePct);
  const up = sector.changePct >= 0;

  return (
    <Card
      size="small"
      style={{
        background: bgColor,
        borderLeft: `5px solid ${heatColor}`,
        height: '100%',
        transition: 'transform 0.2s, box-shadow 0.2s',
      }}
      hoverable
      bodyStyle={{ padding: '10px 12px' }}
    >
      <Space direction="vertical" size={4} style={{ width: '100%' }}>
        {/* Header */}
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space size={4}>
            <Text strong style={{ fontSize: 14 }}>#{rank}</Text>
            <Text strong style={{ fontSize: 13 }}>{sector.sectorCN}</Text>
          </Space>
          <Tag color={up ? 'green' : 'red'} style={{ fontSize: 11, fontWeight: 'bold' }}>
            {up ? '▲' : '▼'} {up ? '+' : ''}{sector.changePct.toFixed(2)}%
          </Tag>
        </Space>

        {/* Heat bar */}
        <div style={{ height: 8, background: '#f0f0f0', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{
            width: `${Math.min(100, Math.abs(sector.changePct) * 8)}%`,
            height: '100%', background: heatColor, borderRadius: 4,
            transition: 'width 0.5s ease-out',
          }} />
        </div>

        {/* Stats */}
        <Row gutter={[4, 2]}>
          <Col span={8}>
            <Text type="secondary" style={{ fontSize: 10 }}>热度</Text>
            <Text strong style={{ fontSize: 12, display: 'block' }}>{sector.heatScore}</Text>
          </Col>
          <Col span={8}>
            <Text type="secondary" style={{ fontSize: 10 }}>涨/跌</Text>
            <Text style={{ fontSize: 12, display: 'block' }}>
              <Text type="success">{sector.upCount}</Text>/<Text type="danger">{sector.downCount}</Text>
            </Text>
          </Col>
          <Col span={8}>
            <Text type="secondary" style={{ fontSize: 10 }}>市值</Text>
            <Text style={{ fontSize: 11, display: 'block' }}>
              {sector.marketCap >= 1000 ? `$${(sector.marketCap / 1000).toFixed(1)}T` : `$${sector.marketCap}B`}
            </Text>
          </Col>
        </Row>

        {/* Top performer */}
        <div style={{ fontSize: 10, color: '#999', textAlign: 'right' }}>
          <EyeOutlined /> {sector.topPerformer} {sector.topPerformerPct > 0 ? '+' : ''}{sector.topPerformerPct}%
        </div>
      </Space>
    </Card>
  );
};

// ── Legend ──
const HeatLegend: React.FC = () => (
  <div style={{ marginBottom: 12, padding: '4px 10px', background: '#fafafa', borderRadius: 6 }}>
    <Space size={6} wrap>
      <Text type="secondary" style={{ fontSize: 11 }}>热度:</Text>
      {[
        { label: '+5%', color: '#237804' }, { label: '+2%', color: '#389e0d' },
        { label: '+0.5%', color: '#52c41a' }, { label: '0%', color: '#b7eb8f' },
        { label: '-0.5%', color: '#fff1f0' }, { label: '-2%', color: '#ffa39e' },
        { label: '-5%', color: '#ff4d4f' }, { label: '<-5%', color: '#a8071a' },
      ].map(h => (
        <Space key={h.label} size={2}>
          <div style={{ width: 14, height: 14, borderRadius: 3, background: h.color }} />
          <Text style={{ fontSize: 9 }}>{h.label}</Text>
        </Space>
      ))}
    </Space>
  </div>
);

// ── Summary stats ──
const SectorSummaryBar: React.FC<{ sectors: SectorData[] }> = ({ sectors }) => {
  const avgChange = sectors.reduce((s, sec) => s + sec.changePct, 0) / sectors.length;
  const upSectors = sectors.filter(s => s.changePct >= 0).length;
  const hottest = sectors.reduce((a, b) => a.heatScore > b.heatScore ? a : b);
  const coldest = sectors.reduce((a, b) => a.heatScore < b.heatScore ? a : b);

  return (
    <Row gutter={[8, 8]} style={{ marginBottom: 12 }}>
      {[
        { label: '板块数', value: sectors.length, icon: <AppstoreOutlined /> },
        { label: '平均涨跌', value: `${avgChange >= 0 ? '+' : ''}${avgChange.toFixed(2)}%`, color: avgChange >= 0 ? '#52c41a' : '#ff4d4f' },
        { label: '上涨板块', value: `${upSectors}/${sectors.length}`, color: '#52c41a' },
        { label: '最热板块', value: hottest.sectorCN, icon: <FireOutlined />, color: '#ff4d4f' },
        { label: '最冷板块', value: coldest.sectorCN, color: '#1677ff' },
      ].map(s => (
        <Col xs={12} sm={6} lg={4} key={s.label}>
          <Card size="small" bodyStyle={{ padding: '6px 10px' }}>
            <Text type="secondary" style={{ fontSize: 10 }}>{s.icon} {s.label}</Text>
            <Text strong style={{ fontSize: 14, color: s.color, display: 'block' }}>{s.value}</Text>
          </Card>
        </Col>
      ))}
    </Row>
  );
};

// ── Main Component ──
const SectorHeatGrid: React.FC = () => {
  const { sectors, loading } = useSectorData('mock');

  const sorted = useMemo(() =>
    [...sectors].sort((a, b) => b.changePct - a.changePct),
    [sectors]
  );

  return (
    <div style={{ padding: 16, maxWidth: 1400, margin: '0 auto' }}>
      <Space style={{ marginBottom: 12 }}>
        <FireOutlined style={{ fontSize: 24, color: '#ff4d4f' }} />
        <Title level={3} style={{ margin: 0 }}>板块热力图</Title>
        <Tag color="orange">10大板块</Tag>
      </Space>

      <HeatLegend />
      <SectorSummaryBar sectors={sectors} />

      <Divider style={{ margin: '4px 0 12px' }} />

      <Row gutter={[12, 12]}>
        {sorted.map((s, i) => (
          <Col xs={24} sm={12} md={8} lg={6} xl={Math.floor(24 / 5)} key={s.sector}>
            <SectorCard sector={s} rank={i + 1} />
          </Col>
        ))}
      </Row>

      {sorted.length === 0 && <Empty description="暂无板块数据" />}
    </div>
  );
};

export default SectorHeatGrid;
