// ── R169 P2-D6: Factor Decay Dashboard ──────────────────────────────────────
// ⚠️ [R284] Contains demo/mock data. Production mode: use isProduction() guard or real API.

// Multi-factor decay monitoring dashboard:
//   - Decay Heatmap: factor × month IC grid with color scale
//   - Half-Life Trend: IC decay curves over lag days with half-life annotations
//   - Summary cards: monitored / declining / stable / avg half-life
//   - Factor toggle for chart filtering
//
// Data: electron/engine/factors/factor-decay-monitor.ts via IPC
//       Falls back to realistic mock data
//
// ECharts heatmap + multi-line chart, dark theme, responsive

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import { Card, Checkbox, Spin, Tag, Tooltip } from 'antd';
import {
  InfoCircleOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

// ── Types ────────────────────────────────────────────────────────────────────

interface DecaySeries {
  factorId: string;
  nameCN: string;
  decayCurve: number[];
  halfLife: number;
  color: string;
  status?: 'stable' | 'declining' | 'accelerating' | 'recovering';
}

interface ICRow {
  factorId: string;
  nameCN: string;
  months: number[];
  currentIC: number;
}

// ── Factor metadata ──────────────────────────────────────────────────────────

const FACTOR_COLORS: Record<string, string> = {
  MOM_12M: '#00e676',
  HML: '#448aff',
  SMB: '#69f0ae',
  VOL_60D: '#e040fb',
  QUAL: '#ffc107',
  LIQ: '#ff6e40',
  MKT: '#00bcd4',
  YIELD: '#ffee58',
  RSI_14: '#40c4ff',
  ADX: '#b2ff59',
};

const FACTOR_NAMES: Record<string, string> = {
  MOM_12M: '12月动量',
  HML: '价值因子',
  SMB: '小盘因子',
  VOL_60D: '60日低波',
  QUAL: '品质因子',
  LIQ: '流动性因子',
  MKT: '市场Beta',
  YIELD: '股息率',
  RSI_14: 'RSI',
  ADX: 'ADX趋势',
};

// ── Mock data generators ─────────────────────────────────────────────────────

function generateMockDecaySeries(): DecaySeries[] {
  const factors: Array<{ id: string; baseIC: number; decayRate: number }> = [
    { id: 'MOM_12M', baseIC: 0.045, decayRate: 0.03 },
    { id: 'HML', baseIC: 0.035, decayRate: 0.012 },
    { id: 'SMB', baseIC: 0.018, decayRate: 0.008 },
    { id: 'VOL_60D', baseIC: -0.040, decayRate: 0.025 },
    { id: 'QUAL', baseIC: 0.038, decayRate: 0.018 },
    { id: 'LIQ', baseIC: 0.025, decayRate: 0.040 },
    { id: 'MKT', baseIC: 0.055, decayRate: 0.015 },
    { id: 'YIELD', baseIC: 0.028, decayRate: 0.010 },
    { id: 'RSI_14', baseIC: 0.032, decayRate: 0.022 },
    { id: 'ADX', baseIC: 0.020, decayRate: 0.028 },
  ];

  return factors.map((f) => {
    const curve: number[] = [];
    let halfLife = 60;
    for (let lag = 0; lag < 60; lag++) {
      const ic = f.baseIC * Math.exp(-f.decayRate * lag) + (Math.random() - 0.5) * 0.005;
      curve.push(Number(ic.toFixed(4)));
      if (halfLife === 60 && Math.abs(ic) < Math.abs(f.baseIC) / 2) {
        halfLife = lag;
      }
    }
    const status: DecaySeries['status'] =
      halfLife < 15 ? 'accelerating' : halfLife < 30 ? 'declining' : 'stable';
    return {
      factorId: f.id,
      nameCN: FACTOR_NAMES[f.id] || f.id,
      decayCurve: curve,
      halfLife,
      color: FACTOR_COLORS[f.id] || '#ffffff',
      status,
    };
  });
}

function generateMockICGrid(): ICRow[] {
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const factorIds = Object.keys(FACTOR_NAMES);

  return factorIds.map((fid) => {
    const baseIC =
      fid === 'MKT' ? 0.055 : fid === 'MOM_12M' ? 0.045 : fid === 'HML' ? 0.035 : fid === 'QUAL' ? 0.038 : 0.025;
    const decay = fid === 'LIQ' ? 0.04 : fid === 'VOL_60D' ? 0.025 : fid === 'RSI_14' ? 0.022 : 0.01;
    const ics = months.map((_, i) => {
      const val = baseIC * Math.exp(-decay * i) + (Math.random() - 0.5) * 0.015;
      return Number(val.toFixed(4));
    });
    return {
      factorId: fid,
      nameCN: FACTOR_NAMES[fid] || fid,
      months: ics,
      currentIC: ics[ics.length - 1],
    };
  });
}

// ── Dark theme ECharts defaults ──────────────────────────────────────────────

const darkText = '#e5e7eb';
const darkGrid = '#21262d';
const darkCard = '#161b22';

// ── Component ────────────────────────────────────────────────────────────────

const FactorDecayDashboard: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [decaySeries, setDecaySeries] = useState<DecaySeries[]>([]);
  const [icGrid, setIcGrid] = useState<ICRow[]>([]);
  const [enabledFactors, setEnabledFactors] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Simulate async data load — in production, call IPC bridge-api
    const timer = setTimeout(() => {
      const series = generateMockDecaySeries();
      const grid = generateMockICGrid();
      setDecaySeries(series);
      setIcGrid(grid);
      setEnabledFactors(new Set(series.map((s) => s.factorId)));
      setLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  const toggleFactor = useCallback((factorId: string) => {
    setEnabledFactors((prev) => {
      const next = new Set(prev);
      if (next.has(factorId)) next.delete(factorId);
      else next.add(factorId);
      return next;
    });
  }, []);

  // ── Summary stats ──────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const total = decaySeries.length;
    const declining = decaySeries.filter((s) => s.status === 'declining' || s.status === 'accelerating').length;
    const stable = decaySeries.filter((s) => s.status === 'stable' || s.status === 'recovering').length;
    const avgHL = total > 0
      ? Math.round(decaySeries.reduce((sum, s) => sum + s.halfLife, 0) / total)
      : 0;
    return { total, declining, stable, avgHL };
  }, [decaySeries]);

  // ── Heatmap option ─────────────────────────────────────────────────────────

  const heatmapOption = useMemo(() => {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    const factorLabels = icGrid.map((r) => r.nameCN);
    const data: Array<[number, number, number]> = [];
    const visualMin = -0.06;
    const visualMax = 0.06;

    icGrid.forEach((row, rowIdx) => {
      row.months.forEach((ic, colIdx) => {
        data.push([colIdx, rowIdx, ic]);
      });
    });

    return {
      tooltip: {
        backgroundColor: 'rgba(0,0,0,0.85)',
        borderColor: darkGrid,
        textStyle: { color: darkText, fontSize: 11 },
        formatter: (params: { value: [number, number, number] }) => {
          const [col, row, val] = params.value;
          return `<b>${factorLabels[row]}</b> · ${months[col]}<br/>IC: <b>${val.toFixed(4)}</b>`;
        },
      },
      grid: {
        left: 110,
        right: 20,
        top: 10,
        bottom: 30,
      },
      xAxis: {
        type: 'category',
        data: months,
        axisLabel: { color: '#8b949e', fontSize: 10 },
        axisLine: { lineStyle: { color: darkGrid } },
        splitArea: { show: true, areaStyle: { color: ['rgba(255,255,255,0.02)', 'transparent'] } },
      },
      yAxis: {
        type: 'category',
        data: factorLabels,
        axisLabel: { color: darkText, fontSize: 11 },
        axisLine: { lineStyle: { color: darkGrid } },
      },
      visualMap: {
        min: visualMin,
        max: visualMax,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        inRange: { color: ['#d50000', '#ff5252', '#ffab00', '#aeea00', '#64dd17', '#00c853'] },
        textStyle: { color: darkText },
        itemWidth: 14,
        itemHeight: 100,
      },
      series: [
        {
          type: 'heatmap',
          data,
          label: {
            show: true,
            color: darkText,
            fontSize: 10,
            formatter: (p: { value: [number, number, number] }) => p.value[2].toFixed(2),
          },
          emphasis: {
            itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' },
          },
          itemStyle: { borderColor: darkCard, borderWidth: 1 },
        },
      ],
    };
  }, [icGrid]);

  // ── Half-life trend option ─────────────────────────────────────────────────

  const halfLifeOption = useMemo(() => {
    const filtered = decaySeries.filter((s) => enabledFactors.has(s.factorId));
    const series = filtered.map((s) => ({
      name: `${s.nameCN} (HL:${s.halfLife}d)`,
      type: 'line' as const,
      data: s.decayCurve,
      smooth: true,
      symbol: 'none',
      lineStyle: { color: s.color, width: 2 },
      itemStyle: { color: s.color },
    }));

    // Mark half-life points
    const markPoints = filtered
      .filter((s) => s.halfLife < 60)
      .map((s) => ({
        name: `${s.nameCN}`,
        coord: [s.halfLife - 1, s.decayCurve[s.halfLife - 1] ?? 0],
        value: `HL:${s.halfLife}d`,
        symbol: 'pin',
        symbolSize: 20,
        itemStyle: { color: s.color },
        label: { color: darkText, fontSize: 9 },
      }));

    return {
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(0,0,0,0.85)',
        borderColor: darkGrid,
        textStyle: { color: darkText, fontSize: 11 },
      },
      legend: {
        type: 'scroll',
        bottom: 0,
        textStyle: { color: darkText, fontSize: 10 },
        pageTextStyle: { color: darkText },
      },
      grid: { left: 50, right: 20, top: 15, bottom: 40 },
      xAxis: {
        type: 'category',
        name: 'Lag (days)',
        nameTextStyle: { color: '#8b949e', fontSize: 10 },
        axisLabel: {
          color: '#8b949e',
          fontSize: 10,
          interval: 9,
          formatter: (v: string) => `D${Number(v) + 1}`,
        },
        axisLine: { lineStyle: { color: darkGrid } },
        splitLine: { lineStyle: { color: darkGrid, type: 'dashed' } },
      },
      yAxis: {
        type: 'value',
        name: 'IC',
        nameTextStyle: { color: '#8b949e', fontSize: 10 },
        axisLabel: { color: '#8b949e', fontSize: 10 },
        axisLine: { lineStyle: { color: darkGrid } },
        splitLine: { lineStyle: { color: darkGrid, type: 'dashed' } },
        min: -0.07,
        max: 0.07,
      },
      series: [
        ...series,
        // Reference lines
        {
          type: 'line',
          name: 'IC=0',
          data: Array(60).fill(0),
          symbol: 'none',
          lineStyle: { color: '#555', width: 1, type: 'dashed' },
          silent: true,
        },
        {
          type: 'line',
          name: 'IC=±0.03',
          data: Array(60).fill(0.03),
          symbol: 'none',
          lineStyle: { color: '#444', width: 1, type: 'dotted' },
          silent: true,
        },
        {
          type: 'line',
          name: '',
          data: Array(60).fill(-0.03),
          symbol: 'none',
          lineStyle: { color: '#444', width: 1, type: 'dotted' },
          silent: true,
        },
        ...(markPoints.length > 0
          ? [
              {
                type: 'scatter' as const,
                data: markPoints.map((mp) => ({
                  name: mp.name,
                  value: mp.coord,
                  symbol: 'pin',
                  symbolSize: 20,
                  itemStyle: { color: mp.itemStyle?.color || '#fff' },
                  label: { show: true, formatter: mp.value, color: darkText, fontSize: 9 },
                })),
                z: 10,
              },
            ]
          : []),
      ],
    };
  }, [decaySeries, enabledFactors]);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" style={{ background: darkCard }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4" style={{ background: darkCard, minHeight: '100vh' }}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold" style={{ color: darkText }}>
          📉 {t('factorDecay.title', 'Factor Decay Monitor')}
        </h2>
        <Tag color="blue" style={{ background: '#1f2937', border: 'none' }}>
          {t('factorDecay.simulatedBanner', 'Simulated Data')}
        </Tag>
      </div>

      {/* ── Summary Cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card size="small" className="text-center" style={{ background: '#1a1f2e', borderColor: darkGrid }}>
          <div className="text-2xl font-bold" style={{ color: '#00bcd4' }}>{stats.total}</div>
          <div className="text-xs" style={{ color: '#8b949e' }}>
            {t('factorDecay.monitored', 'Monitored')}
          </div>
        </Card>
        <Card size="small" className="text-center" style={{ background: '#1a1f2e', borderColor: darkGrid }}>
          <div className="text-2xl font-bold" style={{ color: '#64dd17' }}>{stats.stable}</div>
          <div className="text-xs" style={{ color: '#8b949e' }}>
            {t('factorDecay.stable', 'Stable')}
          </div>
        </Card>
        <Card size="small" className="text-center" style={{ background: '#1a1f2e', borderColor: darkGrid }}>
          <div className="text-2xl font-bold" style={{ color: stats.declining > 2 ? '#ff5252' : '#ffab00' }}>
            {stats.declining}
          </div>
          <div className="text-xs" style={{ color: '#8b949e' }}>
            {t('factorDecay.declining', 'Declining')}
          </div>
        </Card>
        <Card size="small" className="text-center" style={{ background: '#1a1f2e', borderColor: darkGrid }}>
          <div className="text-2xl font-bold" style={{ color: '#e5e7eb' }}>{stats.avgHL}d</div>
          <Tooltip title={t('factorDecay.avgHalfLifeTip', 'Average days until IC drops to 50%')}>
            <div className="text-xs" style={{ color: '#8b949e', cursor: 'help' }}>
              {t('factorDecay.avgHalfLife', 'Avg Half-Life')} <InfoCircleOutlined />
            </div>
          </Tooltip>
        </Card>
      </div>

      {/* ── Decay Heatmap ─────────────────────────────────────────────────── */}
      <Card
        size="small"
        title={
          <span style={{ color: darkText, fontSize: 14 }}>
            🔥 {t('factorDecay.heatmapTitle', 'IC Decay Heatmap')}
          </span>
        }
        style={{ background: '#1a1f2e', borderColor: darkGrid }}
        styles={{ header: { background: '#1a1f2e', borderColor: darkGrid } }}
      >
        <ReactECharts
          option={heatmapOption}
          style={{ height: 340 }}
          opts={{ renderer: 'svg' }}
          theme="dark"
        />
      </Card>

      {/* ── Half-Life Trend ────────────────────────────────────────────────── */}
      <Card
        size="small"
        title={
          <span style={{ color: darkText, fontSize: 14 }}>
            📈 {t('factorDecay.trendTitle', 'Half-Life Trend')}
          </span>
        }
        style={{ background: '#1a1f2e', borderColor: darkGrid }}
        styles={{ header: { background: '#1a1f2e', borderColor: darkGrid } }}
      >
        <ReactECharts
          option={halfLifeOption}
          style={{ height: 400 }}
          opts={{ renderer: 'svg' }}
          theme="dark"
        />
      </Card>

      {/* ── Factor Toggle ──────────────────────────────────────────────────── */}
      <Card
        size="small"
        title={
          <span style={{ color: darkText, fontSize: 14 }}>
            🔘 {t('factorDecay.toggleTitle', 'Toggle Factors')}
          </span>
        }
        style={{ background: '#1a1f2e', borderColor: darkGrid }}
        styles={{ header: { background: '#1a1f2e', borderColor: darkGrid } }}
      >
        <div className="flex flex-wrap gap-3">
          {decaySeries.map((s) => {
            const isEnabled = enabledFactors.has(s.factorId);
            const statusIcon =
              s.status === 'accelerating'
                ? '🔴'
                : s.status === 'declining'
                  ? '🟡'
                  : '🟢';
            return (
              <Checkbox
                key={s.factorId}
                checked={isEnabled}
                onChange={() => toggleFactor(s.factorId)}
                style={{ color: isEnabled ? s.color : '#555' }}
              >
                <span style={{ color: isEnabled ? s.color : '#555' }}>
                  {statusIcon} {s.nameCN}
                </span>
                <span style={{ color: '#8b949e', fontSize: 11, marginLeft: 4 }}>
                  HL:{s.halfLife}d
                </span>
              </Checkbox>
            );
          })}
        </div>
      </Card>
    </div>
  );
};

export default FactorDecayDashboard;
