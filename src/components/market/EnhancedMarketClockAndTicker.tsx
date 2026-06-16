// @ts-nocheck
// QUANT MOO — 增强多市场时钟 + 全球指数条 (Enhanced Multi-Market Clock & Global Ticker)
// R260 ML#2 P2-03 (3h) + ML#3 P2-04 (4h) — 7h合并组件

import React, { useState, useEffect } from 'react';
import {
  Card, Row, Col, Space, Typography, Tag, Tooltip, Progress,
  Badge, Divider, Segmented, Select, Button, Statistic, Alert
} from 'antd';
import {
  GlobalOutlined, ClockCircleOutlined, CaretUpOutlined, CaretDownOutlined,
  MinusOutlined, SunOutlined, MoonOutlined, ThunderboltOutlined,
  ApiOutlined, ReloadOutlined, BellOutlined, FireOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

// ── Types ──
interface MarketTimeBlock {
  market: string; name: string; flag: string;
  timezone: string; utcOffset: number; isDST: boolean;
  status: 'open' | 'pre' | 'lunch' | 'post' | 'closed';
  openTime: string; closeTime: string;
  lunchStart?: string; lunchEnd?: string;
  progressPct: number;
  nextEvent: string; nextEventDelta: string;
  currentLocalTime: string;
}

interface TickerQuote {
  symbol: string; name: string; market: string; flag: string;
  price: number; changePct: number; status: string;
}

// ── Mock ──
const mockClockBlocks: MarketTimeBlock[] = [
  { market: 'JP', name: '日股', flag: '🇯🇵', timezone: 'Asia/Tokyo', utcOffset: 9, isDST: false, status: 'closed', openTime: '09:00', closeTime: '15:00', lunchStart: '11:30', lunchEnd: '12:30', progressPct: 0, nextEvent: '开市', nextEventDelta: '2时55分', currentLocalTime: '06:05' },
  { market: 'CN', name: 'A股', flag: '🇨🇳', timezone: 'Asia/Shanghai', utcOffset: 8, isDST: false, status: 'closed', openTime: '09:30', closeTime: '15:00', lunchStart: '11:30', lunchEnd: '13:00', progressPct: 0, nextEvent: '开市', nextEventDelta: '3时25分', currentLocalTime: '05:05' },
  { market: 'HK', name: '港股', flag: '🇭🇰', timezone: 'Asia/Hong_Kong', utcOffset: 8, isDST: false, status: 'closed', openTime: '09:30', closeTime: '16:00', lunchStart: '12:00', lunchEnd: '13:00', progressPct: 0, nextEvent: '开市', nextEventDelta: '3时25分', currentLocalTime: '05:05' },
  { market: 'KR', name: '韩国', flag: '🇰🇷', timezone: 'Asia/Seoul', utcOffset: 9, isDST: false, status: 'closed', openTime: '09:00', closeTime: '15:30', progressPct: 0, nextEvent: '开市', nextEventDelta: '2时55分', currentLocalTime: '06:05' },
  { market: 'IN', name: '印度', flag: '🇮🇳', timezone: 'Asia/Kolkata', utcOffset: 5.5, isDST: false, status: 'closed', openTime: '09:15', closeTime: '15:30', progressPct: 0, nextEvent: '开市', nextEventDelta: '6时40分', currentLocalTime: '02:35' },
  { market: 'AU', name: '澳洲', flag: '🇦🇺', timezone: 'Australia/Sydney', utcOffset: 10, isDST: false, status: 'closed', openTime: '10:00', closeTime: '16:00', progressPct: 0, nextEvent: '开市', nextEventDelta: '2时55分', currentLocalTime: '07:05' },
  { market: 'SA', name: '沙特', flag: '🇸🇦', timezone: 'Asia/Riyadh', utcOffset: 3, isDST: false, status: 'closed', openTime: '10:00', closeTime: '15:00', progressPct: 0, nextEvent: '开市', nextEventDelta: '10时', currentLocalTime: '00:05' },
  { market: 'ZA', name: '南非', flag: '🇿🇦', timezone: 'Africa/Johannesburg', utcOffset: 2, isDST: false, status: 'closed', openTime: '09:00', closeTime: '17:00', progressPct: 0, nextEvent: '开市', nextEventDelta: '10时', currentLocalTime: '23:05' },
  { market: 'UK', name: '英股', flag: '🇬🇧', timezone: 'Europe/London', utcOffset: 1, isDST: true, status: 'closed', openTime: '08:00', closeTime: '16:30', progressPct: 0, nextEvent: '开市', nextEventDelta: '6时', currentLocalTime: '22:05' },
  { market: 'DE', name: '德股', flag: '🇩🇪', timezone: 'Europe/Berlin', utcOffset: 2, isDST: true, status: 'closed', openTime: '09:00', closeTime: '17:30', progressPct: 0, nextEvent: '开市', nextEventDelta: '7时', currentLocalTime: '23:05' },
  { market: 'US', name: '美股', flag: '🇺🇸', timezone: 'America/New_York', utcOffset: -4, isDST: true, status: 'open', openTime: '09:30', closeTime: '16:00', progressPct: 38, nextEvent: '收市', nextEventDelta: '4时30分', currentLocalTime: '11:30' },
  { market: 'CA', name: '加拿大', flag: '🇨🇦', timezone: 'America/Toronto', utcOffset: -4, isDST: true, status: 'open', openTime: '09:30', closeTime: '16:00', progressPct: 38, nextEvent: '收市', nextEventDelta: '4时30分', currentLocalTime: '11:30' },
  { market: 'BR', name: '巴西', flag: '🇧🇷', timezone: 'America/Sao_Paulo', utcOffset: -3, isDST: false, status: 'closed', openTime: '10:00', closeTime: '17:00', progressPct: 0, nextEvent: '开市', nextEventDelta: '10时', currentLocalTime: '22:05' },
];

const mockGlobalTickers: TickerQuote[] = [
  // 美洲
  { symbol: 'SPX', name: 'S&P 500', market: 'US', flag: '🇺🇸', price: 6047.82, changePct: 0.53, status: 'open' },
  { symbol: 'NDX', name: 'NASDAQ', market: 'US', flag: '🇺🇸', price: 21634, changePct: 0.66, status: 'open' },
  { symbol: 'DJI', name: 'DJIA', market: 'US', flag: '🇺🇸', price: 43397, changePct: -0.04, status: 'open' },
  { symbol: 'TSX', name: 'TSX 60', market: 'CA', flag: '🇨🇦', price: 1512, changePct: 0.82, status: 'open' },
  // 亚太
  { symbol: 'HSI', name: '恒生', market: 'HK', flag: '🇭🇰', price: 24580, changePct: -1.25, status: 'closed' },
  { symbol: 'SHCOMP', name: '上证', market: 'CN', flag: '🇨🇳', price: 3420, changePct: 0.54, status: 'closed' },
  { symbol: 'N225', name: '日経', market: 'JP', flag: '🇯🇵', price: 41532, changePct: 0.69, status: 'closed' },
  { symbol: 'KOSPI', name: 'KOSPI', market: 'KR', flag: '🇰🇷', price: 2820, changePct: -0.44, status: 'closed' },
  { symbol: 'ASX200', name: 'ASX200', market: 'AU', flag: '🇦🇺', price: 7850, changePct: 0.54, status: 'closed' },
  { symbol: 'NIFTY', name: 'Nifty50', market: 'IN', flag: '🇮🇳', price: 24180, changePct: 0.69, status: 'closed' },
  // 欧洲
  { symbol: 'FTSE', name: 'FTSE100', market: 'UK', flag: '🇬🇧', price: 8420, changePct: -0.34, status: 'closed' },
  { symbol: 'DAX', name: 'DAX40', market: 'DE', flag: '🇩🇪', price: 18680, changePct: 0.28, status: 'closed' },
  { symbol: 'CAC', name: 'CAC40', market: 'FR', flag: '🇫🇷', price: 8120, changePct: -0.35, status: 'closed' },
  // 加密+商品
  { symbol: 'BTC', name: 'Bitcoin', market: 'CRYPTO', flag: '₿', price: 98450, changePct: 1.29, status: 'open' },
  { symbol: 'ETH', name: 'Ethereum', market: 'CRYPTO', flag: 'Ξ', price: 4520, changePct: 2.15, status: 'open' },
  { symbol: 'GOLD', name: 'Gold', market: 'COMMODITY', flag: '🥇', price: 2685, changePct: 0.69, status: 'open' },
  { symbol: 'OIL', name: 'WTI Crude', market: 'COMMODITY', flag: '🛢️', price: 72.40, changePct: 1.19, status: 'open' },
  // 外汇
  { symbol: 'EURUSD', name: 'EUR/USD', market: 'FOREX', flag: '💶', price: 1.0852, changePct: 0.14, status: 'open' },
  { symbol: 'USDJPY', name: 'USD/JPY', market: 'FOREX', flag: '💴', price: 156.80, changePct: -0.29, status: 'open' },
  { symbol: 'USDCNH', name: 'USD/CNH', market: 'FOREX', flag: '🇨🇳', price: 7.185, changePct: -0.12, status: 'open' },
];

// ── Market Clock Grid ──
const MarketClockGrid: React.FC<{ blocks: MarketTimeBlock[] }> = ({ blocks }) => (
  <Card size="small" title={<Space><ClockCircleOutlined /> 全球市场时钟</Space>}
    extra={<Badge status="processing" text={`${blocks.filter(b => b.status === 'open').length}个交易中`} />}>
    <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
      <div style={{ display: 'flex', gap: 6, minWidth: 1400 }}>
        {blocks.map(b => {
          const isOpen = b.status === 'open';
          const bg = isOpen ? '#f6ffed' : b.status === 'pre' ? '#fffbe6' : b.status === 'lunch' ? '#fff7e6' : '#fafafa';
          const border = isOpen ? '#52c41a' : b.status === 'pre' ? '#faad14' : b.status === 'lunch' ? '#fa8c16' : '#d9d9d9';
          return (
            <div key={b.market} style={{
              flex: '0 0 155px', padding: '8px 10px', background: bg,
              border: `1px solid ${border}`, borderRadius: 8,
              opacity: isOpen ? 1 : 0.7,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space size={2}>
                  <Text style={{ fontSize: 16 }}>{b.flag}</Text>
                  <Text strong style={{ fontSize: 11 }}>{b.name}</Text>
                </Space>
                <Badge status={isOpen ? 'processing' : 'default'} />
              </div>
              <Text type="secondary" style={{ fontSize: 9 }}>
                UTC{b.utcOffset >= 0 ? '+' : ''}{b.utcOffset}:00
                {b.isDST && <Tag color="blue" style={{ fontSize: 8, marginLeft: 2, padding: '0 2px' }}>夏令</Tag>}
              </Text>
              <div style={{ marginTop: 2 }}>
                <Text style={{ fontSize: 10 }}>{b.openTime}-{b.closeTime}</Text>
                {b.lunchStart && <Text type="secondary" style={{ fontSize: 9, display: 'block' }}>午休 {b.lunchStart}-{b.lunchEnd}</Text>}
              </div>
              {isOpen && (
                <div style={{ marginTop: 4 }}>
                  <Progress percent={b.progressPct} size="small" showInfo={false} strokeColor="#52c41a" style={{ margin: 0 }} />
                  <Text type="secondary" style={{ fontSize: 9 }}>{b.progressPct}%</Text>
                </div>
              )}
              <div style={{ marginTop: 4 }}>
                <Text type="secondary" style={{ fontSize: 9 }}>🕐 {b.currentLocalTime}</Text>
              </div>
              <div style={{ marginTop: 2 }}>
                <Tag color={isOpen ? 'green' : 'default'} style={{ fontSize: 9 }}>
                  {b.nextEvent} {b.nextEventDelta}
                </Tag>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  </Card>
);

// ── Global Ticker Expandable ──
const GlobalTicker: React.FC<{ quotes: TickerQuote[] }> = ({ quotes }) => {
  const categories = [
    { key: 'americas', label: '🌎 美洲', markets: ['US', 'CA'] },
    { key: 'asia', label: '🌏 亚太', markets: ['HK', 'CN', 'JP', 'KR', 'AU', 'IN'] },
    { key: 'europe', label: '🌍 欧洲', markets: ['UK', 'DE', 'FR'] },
    { key: 'crypto', label: '₿ 加密/商品', markets: ['CRYPTO', 'COMMODITY'] },
    { key: 'forex', label: '💱 外汇', markets: ['FOREX'] },
  ];

  const upCount = quotes.filter(q => q.changePct >= 0).length;
  const downCount = quotes.filter(q => q.changePct < 0).length;

  return (
    <Card size="small" title={<Space><GlobalOutlined /> 全球指数</Space>}
      extra={
        <Space size={4}>
          <Tag color="green" style={{ fontSize: 9 }}>{upCount}↑</Tag>
          <Tag color="red" style={{ fontSize: 9 }}>{downCount}↓</Tag>
          <Tag style={{ fontSize: 9 }}>{quotes.length}总</Tag>
        </Space>
      }>
      <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
        <div style={{ display: 'flex', gap: 12, minWidth: 1200 }}>
          {categories.map(cat => {
            const catQuotes = quotes.filter(q => cat.markets.includes(q.market));
            if (catQuotes.length === 0) return null;
            return (
              <div key={cat.key} style={{ flex: `0 0 ${Math.max(120, catQuotes.length * 95)}px`, borderRight: '1px solid #f0f0f0', paddingRight: 8 }}>
                <Text strong style={{ fontSize: 10, display: 'block', marginBottom: 4 }}>{cat.label}</Text>
                {catQuotes.map(q => {
                  const up = q.changePct >= 0;
                  return (
                    <div key={q.symbol} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0' }}>
                      <Space size={2}>
                        <Text style={{ fontSize: 12 }}>{q.flag}</Text>
                        <Tooltip title={q.name}>
                          <Text strong style={{ fontSize: 11 }}>{q.symbol}</Text>
                        </Tooltip>
                      </Space>
                      <Space size={4}>
                        <Text style={{ fontSize: 10, fontFamily: 'monospace' }}>
                          {q.price >= 1000 ? q.price.toLocaleString() : q.price.toFixed(2)}
                        </Text>
                        <Text type={up ? 'success' : 'danger'} strong style={{ fontSize: 10 }}>
                          {up ? <CaretUpOutlined /> : <CaretDownOutlined />}
                          {Math.abs(q.changePct).toFixed(2)}%
                        </Text>
                      </Space>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
};

// ── Next Open Alert Bar ──
const NextOpenAlert: React.FC<{ blocks: MarketTimeBlock[] }> = ({ blocks }) => {
  const nextOpens = blocks
    .filter(b => b.status === 'closed' && b.nextEvent === '开市')
    .sort((a, b) => a.nextEventDelta.localeCompare(b.nextEventDelta))
    .slice(0, 8);

  return (
    <Alert
      type="info"
      showIcon
      icon={<BellOutlined />}
      message={
        <Space size={6} wrap>
          <Text style={{ fontSize: 11 }}>即将开市:</Text>
          {nextOpens.map(b => (
            <Tag key={b.market} style={{ fontSize: 9 }}>
              {b.flag} {b.name} {b.nextEventDelta}
            </Tag>
          ))}
        </Space>
      }
      style={{ marginBottom: 12 }}
    />
  );
};

// ── Main Component ──
const EnhancedMarketClockAndTicker: React.FC = () => {
  return (
    <div style={{ padding: 16, maxWidth: 1600, margin: '0 auto' }}>
      <Space style={{ marginBottom: 12 }}>
        <GlobalOutlined style={{ fontSize: 24, color: '#1677ff' }} />
        <Title level={3} style={{ margin: 0 }}>全球行情</Title>
        <Tag color="green">20指数 · 13市场 · 实时</Tag>
      </Space>

      <NextOpenAlert blocks={mockClockBlocks} />

      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <GlobalTicker quotes={mockGlobalTickers} />
        <MarketClockGrid blocks={mockClockBlocks} />
      </Space>
    </div>
  );
};

export default EnhancedMarketClockAndTicker;
