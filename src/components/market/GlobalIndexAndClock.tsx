// @ts-nocheck
// QUANT MOO — 全球指数条 + 多市场时钟 (Global Index Ticker + Multi-Market Clock)
// R255 ML#2 UI-05 (4h) + ML#3 UI-06 (3h) — 7小时合并组件

import React, { useState, useEffect, useMemo } from 'react';
import {
  Card, Tag, Space, Typography, Row, Col, Timeline, Tooltip,
  Statistic, Badge, Segmented, Select, Progress, Divider
} from 'antd';
import {
  GlobalOutlined, ClockCircleOutlined, CaretUpOutlined, CaretDownOutlined,
  MinusOutlined, StockOutlined, DollarOutlined, ThunderboltOutlined,
  InfoCircleOutlined, SunOutlined, MoonOutlined, SwapOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

// ── Types ──
interface IndexQuote {
  id: string;
  name: string;
  market: string;
  marketCN: string;
  currency: string;
  price: number;
  change: number;
  changePct: number;
  flag: string;
  volume?: number;
  status: 'open' | 'pre' | 'post' | 'closed' | 'lunch_break';
  timezone: string;
  openTime: string;
  closeTime: string;
  lunchStart?: string;
  lunchEnd?: string;
}

interface MarketSession {
  market: string;
  marketCN: string;
  timezone: string;
  utcOffset: number;
  status: 'open' | 'pre' | 'lunch' | 'post' | 'closed';
  openTime: string;
  closeTime: string;
  lunchStart?: string;
  lunchEnd?: string;
  currentTime: Date;
  nextEvent: string;
  nextEventTime: Date;
  progressPct: number; // session progress 0-100
  isDST: boolean;
}

// ── Mock Data ──
const mockIndexQuotes: IndexQuote[] = [
  { id: 'spx', name: 'S&P 500', market: 'US', marketCN: '美股', currency: 'USD', price: 6047.82, change: 32.15, changePct: 0.53, flag: '🇺🇸', volume: 2.1e9, status: 'open', timezone: 'America/New_York', openTime: '09:30', closeTime: '16:00' },
  { id: 'ndx', name: 'NASDAQ 100', market: 'US', marketCN: '美股', currency: 'USD', price: 21634.50, change: 142.30, changePct: 0.66, flag: '🇺🇸', volume: 3.8e9, status: 'open', timezone: 'America/New_York', openTime: '09:30', closeTime: '16:00' },
  { id: 'dji', name: 'DJIA', market: 'US', marketCN: '美股', currency: 'USD', price: 43397.20, change: -18.40, changePct: -0.04, flag: '🇺🇸', volume: 0.98e9, status: 'open', timezone: 'America/New_York', openTime: '09:30', closeTime: '16:00' },
  { id: 'vix', name: 'VIX', market: 'US', marketCN: '美股', currency: 'USD', price: 14.52, change: -0.83, changePct: -5.41, flag: '🇺🇸', status: 'open', timezone: 'America/New_York', openTime: '09:30', closeTime: '16:15' },
  { id: 'hsi', name: '恒生指数', market: 'HK', marketCN: '港股', currency: 'HKD', price: 24580.90, change: -312.60, changePct: -1.25, flag: '🇭🇰', status: 'closed', timezone: 'Asia/Hong_Kong', openTime: '09:30', closeTime: '16:00', lunchStart: '12:00', lunchEnd: '13:00' },
  { id: 'hstech', name: '恒生科技', market: 'HK', marketCN: '港股', currency: 'HKD', price: 5520.30, change: -85.40, changePct: -1.52, flag: '🇭🇰', status: 'closed', timezone: 'Asia/Hong_Kong', openTime: '09:30', closeTime: '16:00' },
  { id: 'shcomp', name: '上证指数', market: 'CN', marketCN: 'A股', currency: 'CNY', price: 3420.50, change: 18.30, changePct: 0.54, flag: '🇨🇳', status: 'closed', timezone: 'Asia/Shanghai', openTime: '09:30', closeTime: '15:00', lunchStart: '11:30', lunchEnd: '13:00' },
  { id: 'szcomp', name: '深证成指', market: 'CN', marketCN: 'A股', currency: 'CNY', price: 11850.20, change: 45.60, changePct: 0.39, flag: '🇨🇳', status: 'closed', timezone: 'Asia/Shanghai', openTime: '09:30', closeTime: '15:00' },
  { id: 'n225', name: '日経225', market: 'JP', marketCN: '日股', currency: 'JPY', price: 41532.00, change: 285.00, changePct: 0.69, flag: '🇯🇵', status: 'closed', timezone: 'Asia/Tokyo', openTime: '09:00', closeTime: '15:00', lunchStart: '11:30', lunchEnd: '12:30' },
  { id: 'ftse', name: 'FTSE 100', market: 'UK', marketCN: '英股', currency: 'GBP', price: 8420.50, change: -28.30, changePct: -0.34, flag: '🇬🇧', status: 'closed', timezone: 'Europe/London', openTime: '08:00', closeTime: '16:30' },
  { id: 'dax', name: 'DAX 40', market: 'EU', marketCN: '欧股', currency: 'EUR', price: 18680.00, change: 52.40, changePct: 0.28, flag: '🇩🇪', status: 'closed', timezone: 'Europe/Berlin', openTime: '09:00', closeTime: '17:30' },
  { id: 'btc', name: 'Bitcoin', market: 'CRYPTO', marketCN: '加密', currency: 'USD', price: 98450.00, change: 1250.00, changePct: 1.29, flag: '₿', status: 'open', timezone: 'UTC', openTime: '00:00', closeTime: '24:00' },
  { id: 'eth', name: 'Ethereum', market: 'CRYPTO', marketCN: '加密', currency: 'USD', price: 4520.00, change: 95.00, changePct: 2.15, flag: 'Ξ', status: 'open', timezone: 'UTC', openTime: '00:00', closeTime: '24:00' },
];

const marketSessions: MarketSession[] = [
  {
    market: 'US', marketCN: '美股', timezone: 'America/New_York', utcOffset: -4,
    status: 'open', openTime: '09:30', closeTime: '16:00',
    currentTime: new Date('2026-06-17T11:30:00-04:00'),
    nextEvent: '收市', nextEventTime: new Date('2026-06-17T16:00:00-04:00'),
    progressPct: 42, isDST: true,
  },
  {
    market: 'HK', marketCN: '港股', timezone: 'Asia/Hong_Kong', utcOffset: 8,
    status: 'closed', openTime: '09:30', closeTime: '16:00',
    lunchStart: '12:00', lunchEnd: '13:00',
    currentTime: new Date('2026-06-17T05:00:00+08:00'),
    nextEvent: '开市', nextEventTime: new Date('2026-06-17T09:30:00+08:00'),
    progressPct: 0, isDST: false,
  },
  {
    market: 'CN', marketCN: 'A股', timezone: 'Asia/Shanghai', utcOffset: 8,
    status: 'closed', openTime: '09:30', closeTime: '15:00',
    lunchStart: '11:30', lunchEnd: '13:00',
    currentTime: new Date('2026-06-17T05:00:00+08:00'),
    nextEvent: '开市', nextEventTime: new Date('2026-06-17T09:30:00+08:00'),
    progressPct: 0, isDST: false,
  },
  {
    market: 'JP', marketCN: '日股', timezone: 'Asia/Tokyo', utcOffset: 9,
    status: 'closed', openTime: '09:00', closeTime: '15:00',
    lunchStart: '11:30', lunchEnd: '12:30',
    currentTime: new Date('2026-06-17T06:00:00+09:00'),
    nextEvent: '开市', nextEventTime: new Date('2026-06-17T09:00:00+09:00'),
    progressPct: 0, isDST: false,
  },
  {
    market: 'UK', marketCN: '英股', timezone: 'Europe/London', utcOffset: 1,
    status: 'closed', openTime: '08:00', closeTime: '16:30',
    currentTime: new Date('2026-06-16T22:00:00+01:00'),
    nextEvent: '开市', nextEventTime: new Date('2026-06-17T08:00:00+01:00'),
    progressPct: 0, isDST: true,
  },
  {
    market: 'EU', marketCN: '欧股', timezone: 'Europe/Berlin', utcOffset: 2,
    status: 'closed', openTime: '09:00', closeTime: '17:30',
    currentTime: new Date('2026-06-16T23:00:00+02:00'),
    nextEvent: '开市', nextEventTime: new Date('2026-06-17T09:00:00+02:00'),
    progressPct: 0, isDST: true,
  },
];

// ── Global Market Clock Timeline ──
const MarketClockTimeline: React.FC = () => {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <Card
      title={<Space><ClockCircleOutlined /> 全球市场时钟 (北京时间 {now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })})</Space>}
      size="small"
    >
      <div style={{ display: 'flex', overflowX: 'auto', gap: 0 }}>
        {marketSessions.map(session => {
          const isOpen = session.status === 'open';
          const isPre = session.status === 'pre';
          const isLunch = session.status === 'lunch';
          const isActive = isOpen || isPre;
          const bgColor = isOpen ? '#f6ffed' : isPre ? '#fffbe6' : isLunch ? '#fff7e6' : '#fafafa';
          const borderColor = isOpen ? '#52c41a' : isPre ? '#faad14' : isLunch ? '#fa8c16' : '#d9d9d9';
          const statusColor = isOpen ? 'green' : isPre ? 'gold' : isLunch ? 'orange' : 'default';

          return (
            <div key={session.market} style={{
              flex: '0 0 180px', padding: '12px', margin: '0 4px',
              background: bgColor, border: `1px solid ${borderColor}`, borderRadius: 8,
            }}>
              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                <Text strong>{session.marketCN}</Text>
                <Badge
                  status={isOpen ? 'processing' : 'default'}
                  text={isOpen ? '交易中' : isPre ? '盘前' : isLunch ? '午休' : '已收市'}
                />
              </Space>
              <div style={{ marginTop: 8 }}>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  UTC{session.utcOffset >= 0 ? '+' : ''}{session.utcOffset}:00
                  {session.isDST && <Tag style={{ fontSize: 9, marginLeft: 4 }} color="blue">夏令时</Tag>}
                </Text>
              </div>
              <div style={{ marginTop: 4 }}>
                <Text style={{ fontSize: 12 }}>
                  {session.openTime} - {session.closeTime}
                </Text>
                {session.lunchStart && (
                  <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>
                    午休 {session.lunchStart}-{session.lunchEnd}
                  </Text>
                )}
              </div>
              {isOpen && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                    <Text type="secondary">进度</Text>
                    <Text>{session.progressPct}%</Text>
                  </div>
                  <Progress percent={session.progressPct} size="small" showInfo={false}
                    strokeColor={{ '0%': '#52c41a', '100%': '#1677ff' }} style={{ margin: '2px 0' }} />
                </div>
              )}
              <div style={{ marginTop: 6, fontSize: 10, color: '#999' }}>
                {session.nextEvent} {session.nextEventTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: session.timezone })}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};

// ── Global Index Ticker (horizontal scroll) ──
const GlobalIndexTicker: React.FC<{ quotes: IndexQuote[] }> = ({ quotes }) => {
  const byMarket: Record<string, IndexQuote[]> = {};
  for (const q of quotes) {
    if (!byMarket[q.marketCN]) byMarket[q.marketCN] = [];
    byMarket[q.marketCN].push(q);
  }

  return (
    <Card
      title={<Space><GlobalOutlined /> 全球指数 <Tag color="green">实时</Tag></Space>}
      size="small"
      extra={<Text type="secondary" style={{ fontSize: 11 }}>数据更新于 {new Date().toLocaleTimeString()}</Text>}
    >
      <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
        <div style={{ display: 'flex', gap: 0, minWidth: 1200 }}>
          {Object.entries(byMarket).map(([marketCN, indices]) => (
            <div key={marketCN} style={{
              flex: '0 0 auto', minWidth: 180, padding: '0 12px',
              borderRight: '1px solid #f0f0f0',
            }}>
              <Text strong style={{ fontSize: 12, marginBottom: 8, display: 'block' }}>{marketCN}</Text>
              {indices.map(idx => {
                const isUp = idx.change >= 0;
                const statusColor = idx.status === 'open' ? 'green' : idx.status === 'pre' ? 'gold' : idx.status === 'lunch_break' ? 'orange' : 'default';
                return (
                  <div key={idx.id} style={{
                    padding: '4px 0', borderBottom: '1px solid #fafafa',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <Space size={4}>
                      <Text style={{ fontSize: 14 }}>{idx.flag}</Text>
                      <Tooltip title={idx.name}>
                        <Text strong style={{ fontSize: 12 }}>{idx.id.toUpperCase()}</Text>
                      </Tooltip>
                      <Badge status={statusColor as any} />
                    </Space>
                    <Space size={4}>
                      <Text style={{ fontSize: 12, fontFamily: 'monospace' }}>
                        {idx.price >= 1000 ? idx.price.toLocaleString() : idx.price.toFixed(2)}
                      </Text>
                      <Text
                        type={isUp ? 'success' : 'danger'}
                        strong
                        style={{ fontSize: 11 }}
                      >
                        {isUp ? <CaretUpOutlined /> : <CaretDownOutlined />}
                        {isUp ? '+' : ''}{idx.changePct.toFixed(2)}%
                      </Text>
                    </Space>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Summary row */}
      <Divider style={{ margin: '8px 0' }} />
      <Row gutter={[8, 4]}>
        {[
          { label: '上涨', count: mockIndexQuotes.filter(q => q.change >= 0).length, color: '#52c41a' },
          { label: '下跌', count: mockIndexQuotes.filter(q => q.change < 0).length, color: '#ff4d4f' },
          { label: '交易中', count: mockIndexQuotes.filter(q => q.status === 'open').length, color: '#1677ff' },
          { label: '已收市', count: mockIndexQuotes.filter(q => q.status === 'closed').length, color: '#999' },
        ].map(s => (
          <Col span={6} key={s.label}>
            <Space size={4}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />
              <Text type="secondary" style={{ fontSize: 11 }}>{s.label} <Text strong>{s.count}</Text></Text>
            </Space>
          </Col>
        ))}
      </Row>
    </Card>
  );
};

// ── Market Open/Close Calendar ──
const MarketCalendar: React.FC = () => {
  const today = new Date().toLocaleDateString('zh-CN', { weekday: 'long', month: 'long', day: 'numeric' });
  return (
    <Card size="small" title={<Space><SunOutlined /> 今日市场</Space>}
      extra={<Text type="secondary">{today}</Text>}>
      <Row gutter={[8, 8]}>
        {[
          { market: '🇺🇸 美股', time: '21:30 开市 (北京时间)', status: 'soon' },
          { market: '🇭🇰 港股', time: '09:30 开市 (北京时间)', status: 'next' },
          { market: '🇨🇳 A股', time: '09:30 开市 (北京时间)', status: 'next' },
          { market: '🇯🇵 日股', time: '08:00 开市 (北京时间)', status: 'next' },
          { market: '🇬🇧 英股', time: '15:00 开市 (北京时间)', status: 'later' },
          { market: '🇩🇪 欧股', time: '15:00 开市 (北京时间)', status: 'later' },
        ].map(m => (
          <Col span={12} key={m.market}>
            <div style={{
              padding: '6px 10px', borderRadius: 6,
              background: m.status === 'soon' ? '#f6ffed' : m.status === 'next' ? '#e6f7ff' : '#fafafa',
              border: `1px solid ${m.status === 'soon' ? '#b7eb8f' : m.status === 'next' ? '#91d5ff' : '#d9d9d9'}`,
            }}>
              <Text style={{ fontSize: 12 }}>{m.market}</Text>
              <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>{m.time}</Text>
            </div>
          </Col>
        ))}
      </Row>
    </Card>
  );
};

// ── Main Component ──
const GlobalIndexAndClock: React.FC = () => {
  const [quotes] = useState<IndexQuote[]>(mockIndexQuotes);

  return (
    <div style={{ padding: 16, maxWidth: 1600, margin: '0 auto' }}>
      <Space style={{ marginBottom: 12 }}>
        <GlobalOutlined style={{ fontSize: 24, color: '#1677ff' }} />
        <Title level={3} style={{ margin: 0 }}>全球市场</Title>
      </Space>

      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        {/* Index Ticker */}
        <GlobalIndexTicker quotes={quotes} />

        {/* Market Clock */}
        <MarketClockTimeline />

        {/* Next Open Calendar */}
        <MarketCalendar />
      </Space>
    </div>
  );
};

export default GlobalIndexAndClock;
