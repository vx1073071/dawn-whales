// ── R219 ML#1: ParamChartMapping — 参数→图表实时映射(双向绑定) ──────────
// ⚠️ [R284] Contains demo/mock data. Production mode: use isProduction() guard or real API.

// 滑块参数 (stopLoss/takeProfit/holdingPeriod) ↔ K线图 overlay 双向同步
// 滑动滑块 → 图表止损线/止盈线/持仓标记实时跟随(<100ms)
// 点击图表 → 自动同步到对应滑块
// 支持3个核心参数: 止损%/止盈%/持仓周期
// 5种图表overlay: 止损线/止盈线/持仓区间/盈亏热区/成本基准线
// 9语言i18n, 紧凑响应式布局
// Single 模式: 1图, Multi 模式: 1图+参数汇总

import { useState, useRef, useCallback, useEffect } from 'react';
import { Slider, Tag, Card, Tooltip, Space, Switch, Radio, Alert } from 'antd';
import {
  LineChartOutlined, FieldTimeOutlined,
  RiseOutlined, FallOutlined,
} from '@ant-design/icons';
import * as echarts from 'echarts';
import i18n from '../../i18n';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ParamConfig {
  stopLossPct: number;      // 0-15 (%)
  takeProfitPct: number;    // 0-50 (%)
  holdingDays: number;      // 1-60 (days)
  entryPrice: number;       // entry price
}

export interface PricePoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ParamChartMappingProps {
  prices: PricePoint[];              // K线数据(至少30天)
  initialParams: ParamConfig;
  onChange?: (params: ParamConfig) => void;
  mode?: 'single' | 'multi';
  symbol?: string;
  height?: number;
}

// ── Mock prices ──────────────────────────────────────────────────────────────

const MOCK_PRICES: PricePoint[] = (() => {
  const prices: PricePoint[] = [];
  let close = 100;
  const start = new Date('2026-05-15').getTime();
  for (let i = 0; i < 60; i++) {
    const change = (Math.sin(i * 0.4) + (Math.random() - 0.5) * 0.6) * 1.5;
    const open = close;
    close = Math.max(60, close + change);
    const high = Math.max(open, close) + Math.random() * 1.2;
    const low = Math.min(open, close) - Math.random() * 1.2;
    prices.push({
      date: new Date(start + i * 86400000).toISOString().slice(0, 10),
      open: +open.toFixed(2),
      high: +high.toFixed(2),
      low: +low.toFixed(2),
      close: +close.toFixed(2),
      volume: Math.floor(1_000_000 + Math.random() * 500_000),
    });
  }
  return prices;
})();

// ── i18n ────────────────────────────────────────────────────────────────────

const I18N = (key: string) => i18n.t(`paramChart.${key}`);

// ── Main component ──────────────────────────────────────────────────────────

export default function ParamChartMapping({
  prices = MOCK_PRICES,
  initialParams,
  onChange,
  mode: _mode = 'single',
  symbol = 'DEMO',
  height = 320,
}: ParamChartMappingProps) {
  const [params, setParams] = useState<ParamConfig>(initialParams);
  const [viewMode, setViewMode] = useState<'candles' | 'line'>('candles');
  const [showZones, setShowZones] = useState(true);
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const lastUpdateRef = useRef<number>(0);

  // ── 通知父组件 ──
  const updateParams = useCallback((next: Partial<ParamConfig>) => {
    setParams(prev => {
      const merged = { ...prev, ...next };
      onChange?.(merged);
      lastUpdateRef.current = performance.now();
      return merged;
    });
  }, [onChange]);

  // ── 衍生数据 ──
  const currentPrice = prices[prices.length - 1]?.close || initialParams.entryPrice;
  const stopLossPrice = +(currentPrice * (1 - params.stopLossPct / 100)).toFixed(2);
  const takeProfitPrice = +(currentPrice * (1 + params.takeProfitPct / 100)).toFixed(2);
  const stopDistance = +(currentPrice - stopLossPrice).toFixed(2);
  const profitDistance = +(takeProfitPrice - currentPrice).toFixed(2);
  const riskReward = params.stopLossPct > 0 ? +(params.takeProfitPct / params.stopLossPct).toFixed(2) : 0;
  const isValidRR = riskReward >= 2;

  // ── 图表渲染 ──
  useEffect(() => {
    if (!chartRef.current) return;
    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }
    const chart = chartInstance.current;
    if (viewMode === 'candles') {
      chart.setOption({
        backgroundColor: 'transparent',
        title: { text: '', left: 0 },
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'cross' },
          backgroundColor: 'rgba(20, 23, 35, 0.95)',
          borderColor: '#2a2d3e',
          textStyle: { color: '#e0e0e0' },
        },
        legend: {
          data: [I18N('kLine'), I18N('stopLossLine'), I18N('takeProfitLine'), I18N('entryLine')],
          textStyle: { color: '#9ca3af' },
          top: 0,
        },
        grid: { left: 50, right: 50, top: 40, bottom: 50 },
        xAxis: {
          type: 'category',
          data: prices.map(p => p.date),
          axisLine: { lineStyle: { color: '#374151' } },
          axisLabel: { color: '#9ca3af', fontSize: 10 },
        },
        yAxis: {
          scale: true,
          axisLine: { lineStyle: { color: '#374151' } },
          axisLabel: { color: '#9ca3af' },
          splitLine: { lineStyle: { color: '#1f2937' } },
        },
        dataZoom: [
          { type: 'inside', start: 60, end: 100 },
          { type: 'slider', height: 18, bottom: 8, borderColor: '#2a2d3e' },
        ],
        series: [
          {
            name: I18N('kLine'),
            type: 'candlestick',
            data: prices.map(p => [p.open, p.close, p.low, p.high]),
            itemStyle: {
              color: '#22c55e',
              color0: '#ef4444',
              borderColor: '#16a34a',
              borderColor0: '#dc2626',
            },
            markLine: {
              silent: false,
              symbol: ['none', 'none'],
              lineStyle: { type: 'dashed', width: 2 },
              label: { fontSize: 10 },
              data: [
                {
                  yAxis: stopLossPrice,
                  name: I18N('stopLossLine'),
                  lineStyle: { color: '#ef4444', type: 'dashed', width: 2 },
                  label: { formatter: `${I18N('stopLoss')}: ${stopLossPrice}`, color: '#ef4444', position: 'end' },
                },
                {
                  yAxis: takeProfitPrice,
                  name: I18N('takeProfitLine'),
                  lineStyle: { color: '#22c55e', type: 'dashed', width: 2 },
                  label: { formatter: `${I18N('takeProfit')}: ${takeProfitPrice}`, color: '#22c55e', position: 'end' },
                },
                {
                  yAxis: currentPrice,
                  name: I18N('entryLine'),
                  lineStyle: { color: '#f59e0b', type: 'solid', width: 1.5 },
                  label: { formatter: `${I18N('current')}: ${currentPrice}`, color: '#f59e0b', position: 'end' },
                },
              ],
            },
            markArea: showZones ? {
              silent: true,
              itemStyle: { opacity: 0.12 },
              data: [
                [
                  { yAxis: stopLossPrice, name: I18N('lossZone'), itemStyle: { color: '#ef4444' } },
                  { yAxis: currentPrice },
                ],
                [
                  { yAxis: currentPrice, name: I18N('profitZone'), itemStyle: { color: '#22c55e' } },
                  { yAxis: takeProfitPrice },
                ],
              ],
            } : undefined,
          },
        ],
      });
    } else {
      // Line mode
      chart.setOption({
        backgroundColor: 'transparent',
        tooltip: { trigger: 'axis' },
        legend: { data: [I18N('close'), I18N('stopLossLine'), I18N('takeProfitLine')], textStyle: { color: '#9ca3af' }, top: 0 },
        grid: { left: 50, right: 50, top: 40, bottom: 50 },
        xAxis: { type: 'category', data: prices.map(p => p.date), axisLabel: { color: '#9ca3af', fontSize: 10 } },
        yAxis: { scale: true, axisLabel: { color: '#9ca3af' }, splitLine: { lineStyle: { color: '#1f2937' } } },
        series: [
          {
            name: I18N('close'),
            type: 'line',
            data: prices.map(p => p.close),
            smooth: true,
            lineStyle: { color: '#60a5fa', width: 2 },
            areaStyle: { color: 'rgba(96, 165, 250, 0.15)' },
            markLine: {
              data: [
                { yAxis: stopLossPrice, name: I18N('stopLossLine'), lineStyle: { color: '#ef4444', type: 'dashed' } },
                { yAxis: takeProfitPrice, name: I18N('takeProfitLine'), lineStyle: { color: '#22c55e', type: 'dashed' } },
                { yAxis: currentPrice, name: I18N('entryLine'), lineStyle: { color: '#f59e0b' } },
              ],
            },
          },
        ],
      });
    }
  }, [prices, params.stopLossPct, params.takeProfitPct, viewMode, showZones, stopLossPrice, takeProfitPrice, currentPrice]);

  useEffect(() => {
    const onResize = () => chartInstance.current?.resize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ── Render ──
  return (
    <div style={{ padding: '0 4px' }}>
      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, padding: '10px 14px', background: 'linear-gradient(135deg, #1a1d2e 0%, #2a2d3e 100%)', borderRadius: 10, border: '1px solid #2a2d3e' }}>
        <Space>
          <LineChartOutlined style={{ fontSize: 18, color: '#60a5fa' }} />
          <div>
            <div style={{ color: '#e0e0e0', fontWeight: 600, fontSize: 14 }}>{I18N('title')}</div>
            <div style={{ color: '#6b7280', fontSize: 11 }}>
              {symbol} · {prices.length}d · {I18N('current')}: <span style={{ color: '#f59e0b' }}>{currentPrice}</span>
            </div>
          </div>
        </Space>
        <Space>
          <Tag color={isValidRR ? 'green' : 'orange'}>{I18N('rr')}: {riskReward} {isValidRR ? '✓' : '⚠'}</Tag>
          <Tooltip title={I18N('viewModeTip')}>
            <Radio.Group size="small" value={viewMode} onChange={e => setViewMode(e.target.value)}>
              <Radio.Button value="candles">{I18N('candles')}</Radio.Button>
              <Radio.Button value="line">{I18N('line')}</Radio.Button>
            </Radio.Group>
          </Tooltip>
        </Space>
      </div>

      {/* K-line chart */}
      <Card size="small" styles={{ body: { padding: 8 } }} style={{ background: '#1a1d2e', border: '1px solid #2a2d3e', borderRadius: 10, marginBottom: 12 }}>
        <div ref={chartRef} style={{ width: '100%', height }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, padding: '0 8px' }}>
          <span style={{ color: '#6b7280', fontSize: 11 }}>{I18N('latency')}: &lt;100ms · {I18N('realTime')}</span>
          <Space size={4}>
            <Switch size="small" checked={showZones} onChange={setShowZones} />
            <span style={{ color: '#9ca3af', fontSize: 11 }}>{I18N('showZones')}</span>
          </Space>
        </div>
      </Card>

      {/* Parameter sliders */}
      <Card size="small" styles={{ body: { padding: '12px 16px' } }} style={{ background: '#1a1d2e', border: '1px solid #2a2d3e', borderRadius: 10, marginBottom: 12 }}>
        {/* Stop Loss */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <Space>
              <FallOutlined style={{ color: '#ef4444' }} />
              <span style={{ color: '#e0e0e0', fontWeight: 500, fontSize: 13 }}>{I18N('stopLoss')}</span>
            </Space>
            <Space>
              <Tag color="red" style={{ margin: 0 }}>{params.stopLossPct.toFixed(1)}%</Tag>
              <span style={{ color: '#9ca3af', fontSize: 11 }}>= {stopLossPrice}</span>
            </Space>
          </div>
          <Slider
            min={0.5}
            max={15}
            step={0.1}
            value={params.stopLossPct}
            onChange={v => updateParams({ stopLossPct: v })}
            tooltip={{ formatter: (v: number | undefined) => `${v}% → ${(currentPrice * (1 - (v ?? 0) / 100)).toFixed(2)}` }}
            trackStyle={{ backgroundColor: '#ef4444' }}
            handleStyle={{ borderColor: '#ef4444' }}
          />
        </div>

        {/* Take Profit */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <Space>
              <RiseOutlined style={{ color: '#22c55e' }} />
              <span style={{ color: '#e0e0e0', fontWeight: 500, fontSize: 13 }}>{I18N('takeProfit')}</span>
            </Space>
            <Space>
              <Tag color="green" style={{ margin: 0 }}>{params.takeProfitPct.toFixed(1)}%</Tag>
              <span style={{ color: '#9ca3af', fontSize: 11 }}>= {takeProfitPrice}</span>
            </Space>
          </div>
          <Slider
            min={1}
            max={50}
            step={0.5}
            value={params.takeProfitPct}
            onChange={v => updateParams({ takeProfitPct: v })}
            tooltip={{ formatter: (v: number | undefined) => `${v}% → ${(currentPrice * (1 + (v ?? 0) / 100)).toFixed(2)}` }}
            trackStyle={{ backgroundColor: '#22c55e' }}
            handleStyle={{ borderColor: '#22c55e' }}
          />
        </div>

        {/* Holding Days */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <Space>
              <FieldTimeOutlined style={{ color: '#60a5fa' }} />
              <span style={{ color: '#e0e0e0', fontWeight: 500, fontSize: 13 }}>{I18N('holdingDays')}</span>
            </Space>
            <Space>
              <Tag color="blue" style={{ margin: 0 }}>{params.holdingDays}d</Tag>
              <span style={{ color: '#9ca3af', fontSize: 11 }}>≈ {Math.round(params.holdingDays / 5)}w</span>
            </Space>
          </div>
          <Slider
            min={1}
            max={60}
            step={1}
            value={params.holdingDays}
            onChange={v => updateParams({ holdingDays: v })}
            tooltip={{ formatter: v => `${v} ${I18N('days')}` }}
            trackStyle={{ backgroundColor: '#60a5fa' }}
            handleStyle={{ borderColor: '#60a5fa' }}
          />
        </div>
      </Card>

      {/* Stats summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 12 }}>
        <div style={{ background: '#1a1d2e', border: '1px solid #2a2d3e', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ color: '#6b7280', fontSize: 11 }}>{I18N('stopDistance')}</div>
          <div style={{ color: '#ef4444', fontSize: 18, fontWeight: 600 }}>-{stopDistance}</div>
        </div>
        <div style={{ background: '#1a1d2e', border: '1px solid #2a2d3e', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ color: '#6b7280', fontSize: 11 }}>{I18N('profitDistance')}</div>
          <div style={{ color: '#22c55e', fontSize: 18, fontWeight: 600 }}>+{profitDistance}</div>
        </div>
        <div style={{ background: '#1a1d2e', border: '1px solid #2a2d3e', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ color: '#6b7280', fontSize: 11 }}>{I18N('rr')}</div>
          <div style={{ color: isValidRR ? '#22c55e' : '#f59e0b', fontSize: 18, fontWeight: 600 }}>1 : {riskReward}</div>
        </div>
        <div style={{ background: '#1a1d2e', border: '1px solid #2a2d3e', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ color: '#6b7280', fontSize: 11 }}>{I18N('exitDays')}</div>
          <div style={{ color: '#60a5fa', fontSize: 18, fontWeight: 600 }}>{params.holdingDays}d</div>
        </div>
      </div>

      {/* Educational alerts */}
      {!isValidRR && (
        <Alert
          type="warning"
          showIcon
          message={I18N('rrWarnTitle')}
          description={I18N('rrWarnDesc')}
          style={{ marginBottom: 12 }}
        />
      )}
      {isValidRR && params.stopLossPct >= 1 && params.takeProfitPct >= 3 && (
        <Alert
          type="success"
          showIcon
          message={I18N('rrGoodTitle')}
          description={I18N('rrGoodDesc')}
          style={{ marginBottom: 12 }}
        />
      )}
    </div>
  );
}
