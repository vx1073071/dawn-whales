// @ts-nocheck
// QUANT MOO — 行情回放 (Market Replay)
// R256 ML#1 UI-08 — 历史行情逐帧回放+变速控制+对比分析 (6h)

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Card, Slider, Button, Space, Typography, Select, Segmented,
  Row, Col, Statistic, Timeline, Tag, Tooltip, Input, DatePicker,
  Switch, Divider, Progress, Badge, Table, message
} from 'antd';
import {
  PlayCircleOutlined, PauseCircleOutlined, StepForwardOutlined,
  StepBackwardOutlined, FastForwardOutlined, FastBackwardOutlined,
  ReloadOutlined, SettingOutlined, CaretUpOutlined, CaretDownOutlined,
  ThunderboltOutlined, StockOutlined, HistoryOutlined,
  CameraOutlined, DownloadOutlined, InfoCircleOutlined,
  ForwardOutlined, BackwardOutlined, FieldTimeOutlined,
  DashboardOutlined, NodeIndexOutlined, SwapOutlined
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

// ── Types ──
interface ReplayFrame {
  timestamp: number;
  time: string;
  price: number;
  changePct: number;
  volume: number;
  bid: number;
  ask: number;
  spread: number;
  vwap: number;
  event?: ReplayEvent;
}

interface ReplayEvent {
  type: 'news' | 'earnings' | 'alert' | 'order' | 'breakout' | 'catalyst';
  description: string;
  impact: 'high' | 'medium' | 'low';
  direction?: 'up' | 'down';
}

interface ReplayConfig {
  symbol: string;
  date: string;
  startTime: string;
  endTime: string;
  speed: number;
  playMode: 'normal' | 'fast' | 'event_only';
  showEvents: boolean;
  showVolume: boolean;
  showOrderBook: boolean;
  compareSymbol?: string;
}

// ── Mock Data: Generate 480 frames (1 day, 1 frame per minute × 8 hours = 480) ──
const generateFrames = (symbol: string, basePrice: number, volatility: number): ReplayFrame[] => {
  const events: { minute: number; event: ReplayEvent }[] = [
    { minute: 15, event: { type: 'news', description: '盘前消息: AI芯片需求超预期', impact: 'high', direction: 'up' } },
    { minute: 45, event: { type: 'catalyst', description: '机构上调目标价至$180', impact: 'medium', direction: 'up' } },
    { minute: 90, event: { type: 'breakout', description: '突破日内高点$150', impact: 'high', direction: 'up' } },
    { minute: 135, event: { type: 'order', description: '大单买入: 50万股 $148.35', impact: 'high', direction: 'up' } },
    { minute: 180, event: { type: 'news', description: '出口管制新规传闻', impact: 'high', direction: 'down' } },
    { minute: 210, event: { type: 'alert', description: 'RSI触发超买警告 (>70)', impact: 'medium', direction: 'down' } },
    { minute: 270, event: { type: 'catalyst', description: '数据中心Q2数据泄露: 超预期', impact: 'high', direction: 'up' } },
    { minute: 330, event: { type: 'breakout', description: 'VWAP突破+量能放大', impact: 'medium', direction: 'up' } },
    { minute: 390, event: { type: 'earnings', description: '盘后财报预览: 预期EPS $2.85', impact: 'high', direction: 'up' } },
  ];

  const frames: ReplayFrame[] = [];
  let price = basePrice * (1 - volatility * 0.3);

  for (let m = 0; m < 480; m++) {
    const hour = 9 + Math.floor(m / 60);
    const minute = m % 60;
    if (hour > 16 || (hour === 16 && minute > 0)) continue;

    const drift = Math.sin(m * 0.03) * volatility * 0.02 + (Math.random() - 0.48) * volatility * 0.005;
    price += drift;

    const event = events.find(e => e.minute === m);
    if (event) {
      const jump = event.event.direction === 'up' ? volatility * 0.25 : -volatility * 0.25;
      price += jump;
    }

    const bid = price - 0.02 - Math.random() * 0.05;
    const ask = price + 0.02 + Math.random() * 0.05;

    frames.push({
      timestamp: m * 60000,
      time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
      price: +price.toFixed(2),
      changePct: +(((price - basePrice) / basePrice) * 100).toFixed(2),
      volume: Math.round(0.5e6 + Math.random() * 2e6 + (event ? 5e6 : 0)),
      bid: +bid.toFixed(2),
      ask: +ask.toFixed(2),
      spread: +(ask - bid).toFixed(3),
      vwap: +(price * 0.998 + Math.random() * 0.02).toFixed(2),
      event: event?.event,
    });
  }
  return frames;
};

const mockFrames = generateFrames('NVDA', 148.35, 12);

// ── Replay Controls ──
const ReplayControls: React.FC<{
  playing: boolean;
  speed: number;
  currentIdx: number;
  totalFrames: number;
  onPlay: () => void;
  onPause: () => void;
  onStep: (dir: 1 | -1) => void;
  onSpeed: (s: number) => void;
  onReset: () => void;
  onSeek: (pct: number) => void;
}> = ({ playing, speed, currentIdx, totalFrames, onPlay, onPause, onStep, onSpeed, onReset, onSeek }) => (
  <Card size="small" style={{ marginBottom: 12 }}>
    <Row align="middle" gutter={[12, 8]}>
      <Col>
        <Space size={4}>
          <Button size="small" icon={<StepBackwardOutlined />} onClick={() => onStep(-1)} disabled={currentIdx <= 0} />
          {playing
            ? <Button size="small" type="primary" danger icon={<PauseCircleOutlined />} onClick={onPause}>暂停</Button>
            : <Button size="small" type="primary" icon={<PlayCircleOutlined />} onClick={onPlay}>播放</Button>
          }
          <Button size="small" icon={<StepForwardOutlined />} onClick={() => onStep(1)} disabled={currentIdx >= totalFrames - 1} />
          <Button size="small" icon={<ReloadOutlined />} onClick={onReset}>重置</Button>
        </Space>
      </Col>
      <Col flex="auto">
        <Slider
          min={0} max={100} value={Math.round((currentIdx / totalFrames) * 100)}
          onChange={v => onSeek(v)}
          tooltip={{ formatter: v => `${v}%` }}
        />
      </Col>
      <Col>
        <Space size={4}>
          <Text type="secondary" style={{ fontSize: 11 }}>速度:</Text>
          <Segmented size="small" value={speed} onChange={v => onSpeed(v as number)}
            options={[
              { label: '0.5x', value: 0.5 },
              { label: '1x', value: 1 },
              { label: '2x', value: 2 },
              { label: '4x', value: 4 },
              { label: '8x', value: 8 },
            ]} />
        </Space>
      </Col>
    </Row>
    <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between' }}>
      <Text type="secondary" style={{ fontSize: 11 }}>
        帧 {currentIdx + 1}/{totalFrames} · {speed}x
      </Text>
      <Text type="secondary" style={{ fontSize: 11 }}>
        {mockFrames[currentIdx]?.time || '--:--'} · {mockFrames[currentIdx]?.price.toFixed(2) || '--'}
      </Text>
    </div>
  </Card>
);

// ── Price Chart Mini (SVG) ──
const PriceChartMini: React.FC<{
  frames: ReplayFrame[];
  currentIdx: number;
  width?: number;
  height?: number;
}> = ({ frames, currentIdx, width = 800, height = 200 }) => {
  const allPrices = frames.map(f => f.price);
  const hi = Math.max(...allPrices);
  const lo = Math.min(...allPrices);
  const range = hi - lo || 1;
  const pad = { top: 10, right: 10, bottom: 20, left: 50 };

  const x = (i: number) => pad.left + (i / (frames.length - 1)) * (width - pad.left - pad.right);
  const y = (v: number) => pad.top + ((hi - v) / range) * (height - pad.top - pad.bottom);

  const pathData = frames.map((f, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(f.price).toFixed(1)}`).join(' ');

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height}>
        <defs>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(22,119,255,0.15)" />
            <stop offset="100%" stopColor="rgba(22,119,255,0.01)" />
          </linearGradient>
        </defs>

        {/* Grid */}
        {[hi, (hi + lo) / 2, lo].map(v => (
          <g key={v}>
            <line x1={pad.left} y1={y(v)} x2={width - pad.right} y2={y(v)} stroke="#f0f0f0" strokeWidth={0.5} />
            <text x={pad.left - 4} y={y(v) + 4} textAnchor="end" fontSize={9} fill="#999">{v.toFixed(1)}</text>
          </g>
        ))}

        {/* Area */}
        <path d={`${pathData} L ${x(frames.length - 1)} ${y(lo)} L ${x(0)} ${y(lo)} Z`} fill="url(#areaFill)" />

        {/* Price line */}
        <path d={pathData} stroke="#1677ff" strokeWidth={1.5} fill="none" />

        {/* Events markers */}
        {frames.map((f, i) => {
          if (!f.event) return null;
          const isHigh = f.event.impact === 'high';
          return (
            <g key={`ev-${i}`}>
              <circle cx={x(i)} cy={y(f.price)} r={isHigh ? 4 : 2.5}
                fill={f.event.direction === 'down' ? '#ff4d4f' : '#52c41a'}
                stroke="#fff" strokeWidth={1}
                opacity={i <= currentIdx ? 1 : 0.3} />
            </g>
          );
        })}

        {/* Current position */}
        {currentIdx < frames.length && (
          <g>
            <line x1={x(currentIdx)} y1={pad.top} x2={x(currentIdx)} y2={height - pad.bottom}
              stroke="#1677ff" strokeWidth={1.5} strokeDasharray="4,2" />
            <circle cx={x(currentIdx)} cy={y(frames[currentIdx].price)} r={4}
              fill="#1677ff" stroke="#fff" strokeWidth={2} />
          </g>
        )}
      </svg>
    </div>
  );
};

// ── Volume Bar Chart ──
const VolumeBarChart: React.FC<{
  frames: ReplayFrame[];
  currentIdx: number;
  height?: number;
}> = ({ frames, currentIdx, height = 60 }) => {
  const maxVol = Math.max(...frames.map(f => f.volume));
  const barW = Math.max(2, 100 / frames.length);
  return (
    <div style={{ height, position: 'relative', display: 'flex', alignItems: 'flex-end', gap: 0 }}>
      {frames.map((f, i) => {
        const h = f.volume / maxVol * height;
        return (
          <Tooltip key={i} title={`${f.time} 量: ${(f.volume / 1e6).toFixed(1)}M`}>
            <div style={{
              width: `${barW}%`, height: h,
              background: i <= currentIdx ? (f.price >= (frames[Math.max(0, i - 1)]?.price || f.price) ? 'rgba(82,196,26,0.6)' : 'rgba(255,77,79,0.6)') : '#eee',
              transition: 'background 0.2s',
              minWidth: 1,
            }} />
          </Tooltip>
        );
      })}
    </div>
  );
};

// ── Order Book Panel ──
const OrderBookPanel: React.FC<{ frame: ReplayFrame }> = ({ frame }) => {
  const bids = Array.from({ length: 5 }, (_, i) => ({
    price: +(frame.price - 0.02 * (i + 1) - Math.random() * 0.05).toFixed(2),
    size: Math.round(500 + Math.random() * 2000) * 100,
  }));
  const asks = Array.from({ length: 5 }, (_, i) => ({
    price: +(frame.price + 0.02 * (i + 1) + Math.random() * 0.05).toFixed(2),
    size: Math.round(500 + Math.random() * 2000) * 100,
  }));
  const maxSize = Math.max(...[...bids, ...asks].map(x => x.size));

  return (
    <Card size="small" title={<Space><NodeIndexOutlined /> 订单簿 @{frame.time}</Space>}>
      {/* Asks */}
      {asks.reverse().map((a, i) => (
        <div key={`ask-${i}`} style={{ display: 'flex', alignItems: 'center', marginBottom: 1 }}>
          <div style={{ flex: 1 }} />
          <Text type="secondary" style={{ fontSize: 10, width: 50, textAlign: 'right' }}>{a.size.toLocaleString()}</Text>
          <div style={{
            width: `${(a.size / maxSize) * 60}%`, height: 14, marginLeft: 4,
            background: 'rgba(255,77,79,0.15)', borderRadius: '2px 0 0 2px',
          }} />
          <Text type="danger" style={{ fontSize: 11, width: 60, textAlign: 'right', fontFamily: 'monospace' }}>
            {a.price.toFixed(2)}
          </Text>
        </div>
      ))}

      {/* Spread */}
      <div style={{ padding: '2px 0', borderTop: '1px solid #e8e8e8', borderBottom: '1px solid #e8e8e8', textAlign: 'center', margin: '4px 0' }}>
        <Space size={4}>
          <Text strong style={{ fontSize: 14 }}>${frame.price.toFixed(2)}</Text>
          <Tag style={{ fontSize: 10 }} color="orange">点差 {frame.spread.toFixed(3)}</Tag>
        </Space>
      </div>

      {/* Bids */}
      {bids.map((b, i) => (
        <div key={`bid-${i}`} style={{ display: 'flex', alignItems: 'center', marginBottom: 1 }}>
          <Text type="success" style={{ fontSize: 11, width: 60, fontFamily: 'monospace' }}>
            {b.price.toFixed(2)}
          </Text>
          <div style={{
            width: `${(b.size / maxSize) * 60}%`, height: 14, marginRight: 4,
            background: 'rgba(82,196,26,0.15)', borderRadius: '0 2px 2px 0',
          }} />
          <Text type="secondary" style={{ fontSize: 10, width: 50 }}>{b.size.toLocaleString()}</Text>
        </div>
      ))}
    </Card>
  );
};

// ── Event Timeline ──
const EventTimeline: React.FC<{
  frames: ReplayFrame[];
  currentIdx: number;
  onJumpToEvent: (idx: number) => void;
}> = ({ frames, currentIdx, onJumpToEvent }) => {
  const eventFrames = frames.map((f, i) => ({ ...f, idx: i })).filter(f => f.event);
  return (
    <Card size="small" title={<Space><ThunderboltOutlined /> 事件时间线</Space>}>
      <Timeline
        items={eventFrames.map(ef => {
          const isPast = ef.idx <= currentIdx;
          const isCurrent = ef.idx === currentIdx;
          const ev = ef.event!;
          const typeMap: Record<string, { color: string; label: string }> = {
            news: { color: 'blue', label: '📰 新闻' },
            earnings: { color: 'purple', label: '📊 财报' },
            alert: { color: 'orange', label: '⚠️ 警告' },
            order: { color: 'cyan', label: '📋 大单' },
            breakout: { color: 'gold', label: '💥 突破' },
            catalyst: { color: 'green', label: '🚀 催化' },
          };
          const t = typeMap[ev.type] || { color: 'default', label: ev.type };
          return {
            color: isPast ? t.color : '#d9d9d9',
            dot: isCurrent ? <Badge status="processing" color={t.color} /> : undefined,
            children: (
              <div
                onClick={() => onJumpToEvent(ef.idx)}
                style={{ cursor: 'pointer', opacity: isPast ? 1 : 0.4, padding: '2px 0' }}
              >
                <Space size={4}>
                  <Tag color={t.color}>{t.label}</Tag>
                  <Tag color={ev.impact === 'high' ? 'red' : ev.impact === 'medium' ? 'orange' : 'default'}
                    style={{ fontSize: 10 }}>
                    {ev.impact === 'high' ? '高' : ev.impact === 'medium' ? '中' : '低'}
                  </Tag>
                </Space>
                <div style={{ fontSize: 12, marginTop: 2 }}>
                  <Text type={isPast ? undefined : 'secondary'}>{ef.time}</Text>
                  <Divider type="vertical" />
                  <Text style={{ fontSize: 11 }}>{ev.description}</Text>
                </div>
              </div>
            ),
          };
        })}
      />
    </Card>
  );
};

// ── Stats Panel ──
const ReplayStats: React.FC<{
  frames: ReplayFrame[];
  currentIdx: number;
}> = ({ frames, currentIdx }) => {
  const played = frames.slice(0, currentIdx + 1);
  if (played.length === 0) return null;
  const prices = played.map(f => f.price);
  const changes = played.map(f => f.changePct);
  const volumes = played.map(f => f.volume);
  const totalVol = volumes.reduce((a, b) => a + b, 0);
  const avgVol = totalVol / played.length;
  const maxUp = Math.max(...changes);
  const maxDown = Math.min(...changes);
  const firstPrice = prices[0];
  const lastPrice = prices[prices.length - 1];
  const returnPct = ((lastPrice - firstPrice) / firstPrice * 100);

  return (
    <Row gutter={[8, 8]}>
      {[
        { title: '时段收益', value: `${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(2)}%`, color: returnPct >= 0 ? '#52c41a' : '#ff4d4f' },
        { title: '最高涨幅', value: `${maxUp >= 0 ? '+' : ''}${maxUp.toFixed(2)}%`, color: '#52c41a' },
        { title: '最大跌幅', value: `${maxDown.toFixed(2)}%`, color: '#ff4d4f' },
        { title: '总成交量', value: `${(totalVol / 1e6).toFixed(1)}M` },
        { title: '均价', value: `$${(prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2)}` },
        { title: 'VWAP', value: `$${(played[played.length - 1]?.vwap || 0).toFixed(2)}` },
        { title: '事件数', value: played.filter(f => f.event).length },
        { title: '高影响事件', value: played.filter(f => f.event?.impact === 'high').length, color: '#cf1322' },
      ].map(s => (
        <Col xs={12} sm={6} md={3} key={s.title}>
          <Statistic title={s.title} value={s.value}
            valueStyle={{ fontSize: 16, color: s.color }} />
        </Col>
      ))}
    </Row>
  );
};

// ── Main Component ──
const MarketReplay: React.FC = () => {
  const [frames] = useState<ReplayFrame[]>(mockFrames);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showOrderBook, setShowOrderBook] = useState(false);
  const [config, setConfig] = useState<ReplayConfig>({
    symbol: 'NVDA', date: '2026-06-17', startTime: '09:30', endTime: '16:00',
    speed: 1, playMode: 'normal', showEvents: true, showVolume: true, showOrderBook: false,
  });

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto play
  useEffect(() => {
    if (playing) {
      timerRef.current = setInterval(() => {
        setCurrentIdx(prev => {
          if (prev >= frames.length - 1) {
            setPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1000 / speed);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [playing, speed, frames.length]);

  const play = () => { if (currentIdx >= frames.length - 1) setCurrentIdx(0); setPlaying(true); };
  const pause = () => setPlaying(false);
  const step = (dir: 1 | -1) => setCurrentIdx(prev => Math.max(0, Math.min(frames.length - 1, prev + dir)));
  const reset = () => { setPlaying(false); setCurrentIdx(0); };
  const seek = (pct: number) => {
    setCurrentIdx(Math.min(frames.length - 1, Math.floor((pct / 100) * frames.length)));
  };
  const jumpToEvent = (idx: number) => { setCurrentIdx(idx); setPlaying(false); };

  const currentFrame = frames[currentIdx];

  return (
    <div style={{ padding: 16, maxWidth: 1600, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Space>
          <HistoryOutlined style={{ fontSize: 24, color: '#722ed1' }} />
          <Title level={3} style={{ margin: 0 }}>行情回放</Title>
        </Space>
        <Space>
          <Select size="small" value={config.symbol} onChange={v => setConfig(c => ({ ...c, symbol: v }))}
            style={{ width: 100 }}
            options={[{ label: 'NVDA', value: 'NVDA' }, { label: 'TSLA', value: 'TSLA' }, { label: 'AAPL', value: 'AAPL' }]} />
          <Select size="small" value={config.date} style={{ width: 110 }}
            options={[{ label: '2026-06-17', value: '2026-06-17' }]} />
        </Space>
      </div>

      {/* Controls */}
      <ReplayControls
        playing={playing} speed={speed} currentIdx={currentIdx} totalFrames={frames.length}
        onPlay={play} onPause={pause} onStep={step} onSpeed={setSpeed}
        onReset={reset} onSeek={seek}
      />

      {/* Stats */}
      <ReplayStats frames={frames} currentIdx={currentIdx} />

      <Divider style={{ margin: '8px 0' }} />

      <Row gutter={[12, 12]}>
        {/* Main chart */}
        <Col xs={24} lg={16}>
          <Card size="small" title={
            <Space>
              <StockOutlined /> {config.symbol}
              <Text type="secondary">· 当前价 ${currentFrame?.price.toFixed(2) || '--'}</Text>
              {currentFrame && (
                <Text type={currentFrame.changePct >= 0 ? 'success' : 'danger'} strong>
                  {currentFrame.changePct >= 0 ? <CaretUpOutlined /> : <CaretDownOutlined />}
                  {currentFrame.changePct >= 0 ? '+' : ''}{currentFrame.changePct.toFixed(2)}%
                </Text>
              )}
            </Space>
          }>
            <PriceChartMini frames={frames} currentIdx={currentIdx} />
            <div style={{ marginTop: 8 }}>
              <Text type="secondary" style={{ fontSize: 10 }}>成交量</Text>
              <VolumeBarChart frames={frames} currentIdx={currentIdx} />
            </div>
          </Card>
        </Col>

        {/* Right panel: order book + events */}
        <Col xs={24} lg={8}>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            {showOrderBook && currentFrame && <OrderBookPanel frame={currentFrame} />}
            <EventTimeline frames={frames} currentIdx={currentIdx} onJumpToEvent={jumpToEvent} />
          </Space>
        </Col>
      </Row>
    </div>
  );
};

export default MarketReplay;
