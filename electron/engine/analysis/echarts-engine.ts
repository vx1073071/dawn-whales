/**
 * JVS-45-01: ECharts Engine - 图表数据引擎
 * 生成 ECharts 图表配置，支持 K线图、折线图、柱状图、饼图等
 */

import log from 'electron-log';

// ── Types ──────────────────────────────────────────────────────────────────

export type ChartType = 'kline' | 'line' | 'bar' | 'pie' | 'heatmap' | 'scatter' | 'radar';

export interface KlineData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ChartOption {
  type: ChartType;
  title: string;
  xAxis?: { type: string; data?: any[]; axisLabel?: any };
  yAxis?: { type: string; min?: number; max?: number; axisLabel?: any };
  series: ChartSeries[];
  tooltip?: { trigger?: string; formatter?: string };
  legend?: { show: boolean; data?: string[] };
  grid?: { top: number; right: number; bottom: number; left: number };
  dataZoom?: any[];
  toolbox?: unknown;
}

export interface ChartSeries {
  name: string;
  type: string;
  data: unknown[];
  color?: string;
  smooth?: boolean;
  areaStyle?: { opacity: number; color?: string };
  itemStyle?: { color?: string };
  markLine?: unknown;
  markPoint?: unknown;
  symbol?: string;
  symbolSize?: number;
}

export interface ChartCompareData {
  labels: string[];
  series: { name: string; data: number[] }[];
}

export interface PortfolioPosition {
  symbol: string;
  value: number;
  pnl?: number;
}

export interface RadarIndicator {
  name: string;
  max: number;
  min?: number;
}

// ── Color Palette ──────────────────────────────────────────────────────────

const COLORS = {
  primary: '#5470c6',
  success: '#91cc75',
  danger: '#ee6666',
  warning: '#fac858',
  info: '#73c0de',
  secondary: '#3ba272',
  muted: '#9a60b4',
  gray: '#999',
};

const CHART_COLORS = ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4'];

// ── ECharts Engine ─────────────────────────────────────────────────────────

export class EChartsEngine {
  private defaultGrid = { top: 60, right: 30, bottom: 60, left: 60 };

  constructor() {
    log.info('[EChartsEngine] Initialized');
  }

  // ── K-Line Chart ─────────────────────────────────────────────────────────

  generateKlineChart(data: KlineData[], title: string = 'K线图'): ChartOption {
    const times = data.map(d => this.formatTime(d.time));
    const ohlc = data.map(d => [d.open, d.close, d.low, d.high]);
    const volumes = data.map(d => d.volume);

    const option: ChartOption = {
      type: 'kline',
      title,
      xAxis: {
        type: 'category',
        data: times,
        axisLabel: { rotate: 45, fontSize: 10 },
      },
      yAxis: [
        { type: 'value', axisLabel: { formatter: '${value}' } },
        { type: 'value', axisLabel: { formatter: (v: number) => this.formatVolume(v) } },
      ],
      series: [
        {
          name: 'K线',
          type: 'candlestick',
          data: ohlc,
          itemStyle: {
            color: '#ec0000',
            color0: '#00da3c',
            borderColor: '#ec0000',
            borderColor0: '#00da3c',
          },
        },
        {
          name: '成交量',
          type: 'bar',
          data: volumes,
          yAxisIndex: 1,
          itemStyle: { color: '#5470c6', opacity: 0.3 },
        },
      ],
      tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
      legend: { show: true, data: ['K线', '成交量'] },
      grid: this.defaultGrid,
      dataZoom: [
        { type: 'inside', start: 0, end: 100 },
        { type: 'slider', start: 0, end: 100, height: 20, bottom: 10 },
      ],
      toolbox: {
        feature: {
          dataZoom: { yAxisIndex: 'none' },
          restore: {},
          saveAsImage: {},
        },
      },
    };

    log.info(`[EChartsEngine] Generated K-line chart: ${title} (${data.length} points)`);
    return option;
  }

  // ── Line Chart ───────────────────────────────────────────────────────────

  generateLineChart(
    labels: string[],
    series: ChartSeries[],
    title: string = '折线图'
  ): ChartOption {
    const option: ChartOption = {
      type: 'line',
      title,
      xAxis: {
        type: 'category',
        data: labels,
        axisLabel: { rotate: labels.length > 10 ? 45 : 0 },
      },
      yAxis: { type: 'value' },
      series: series.map((s, i) => ({
        ...s,
        color: s.color || CHART_COLORS[i % CHART_COLORS.length],
        smooth: s.smooth !== false,
        symbol: 'circle',
        symbolSize: 6,
      })),
      tooltip: { trigger: 'axis' },
      legend: { show: series.length > 1, data: series.map(s => s.name) },
      grid: this.defaultGrid,
    };

    log.info(`[EChartsEngine] Generated line chart: ${title}`);
    return option;
  }

  // ── Bar Chart ────────────────────────────────────────────────────────────

  generateBarChart(
    labels: string[],
    series: ChartSeries[],
    title: string = '柱状图'
  ): ChartOption {
    const option: ChartOption = {
      type: 'bar',
      title,
      xAxis: {
        type: 'category',
        data: labels,
        axisLabel: { rotate: labels.length > 8 ? 45 : 0 },
      },
      yAxis: { type: 'value' },
      series: series.map((s, i) => ({
        ...s,
        itemStyle: { color: s.itemStyle?.color || CHART_COLORS[i % CHART_COLORS.length] },
      })),
      tooltip: { trigger: 'axis' },
      legend: { show: series.length > 1, data: series.map(s => s.name) },
      grid: this.defaultGrid,
    };

    log.info(`[EChartsEngine] Generated bar chart: ${title}`);
    return option;
  }

  // ── Pie Chart ────────────────────────────────────────────────────────────

  generatePieChart(
    data: { name: string; value: number }[],
    title: string = '饼图'
  ): ChartOption {
    const option: ChartOption = {
      type: 'pie',
      title,
      series: [
        {
          name: title,
          type: 'pie',
          data: data,
          radius: ['40%', '70%'],
          label: { show: true, formatter: '{b}: {c} ({d}%)' },
          itemStyle: {
            borderRadius: 6,
            borderColor: '#fff',
            borderWidth: 2,
          },
        },
      ],
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: { show: true, orient: 'vertical', right: 10, top: 'center' },
    };

    log.info(`[EChartsEngine] Generated pie chart: ${title}`);
    return option;
  }

  // ── Heatmap Chart ────────────────────────────────────────────────────────

  generateHeatmapChart(
    data: number[][],
    xLabels: string[],
    yLabels: string[],
    title: string = '热力图'
  ): ChartOption {
    const heatData: number[][] = [];
    data.forEach((row, yi) => {
      row.forEach((val, xi) => {
        heatData.push([xi, yi, val]);
      });
    });

    const allValues = data.flat();
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);

    const option: ChartOption = {
      type: 'heatmap',
      title,
      xAxis: {
        type: 'category',
        data: xLabels,
        axisLabel: { rotate: 45 },
      },
      yAxis: {
        type: 'category',
        data: yLabels,
      },
      series: [
        {
          name: '热力图',
          type: 'heatmap',
          data: heatData,
          itemStyle: { borderColor: '#fff', borderWidth: 1 },
        },
      ],
      tooltip: {
        trigger: 'item',
        formatter: (params: unknown) => `${xLabels[params.data[0]]} / ${yLabels[params.data[1]]}: ${params.data[2]}`,
      },
      grid: { top: 60, right: 80, bottom: 60, left: 80 },
    };

    log.info(`[EChartsEngine] Generated heatmap chart: ${title}`);
    return option;
  }

  // ── Scatter Chart ────────────────────────────────────────────────────────

  generateScatterChart(
    data: [number, number][],
    title: string = '散点图'
  ): ChartOption {
    const option: ChartOption = {
      type: 'scatter',
      title,
      xAxis: { type: 'value', name: 'X' },
      yAxis: { type: 'value', name: 'Y' },
      series: [
        {
          name: '数据点',
          type: 'scatter',
          data: data,
          symbolSize: 10,
          itemStyle: { color: CHART_COLORS[0], opacity: 0.7 },
        },
      ],
      tooltip: { trigger: 'item', formatter: (p: unknown) => `(${p.data[0]}, ${p.data[1]})` },
      grid: this.defaultGrid,
    };

    log.info(`[EChartsEngine] Generated scatter chart: ${title}`);
    return option;
  }

  // ── Radar Chart ──────────────────────────────────────────────────────────

  generateRadarChart(
    indicators: RadarIndicator[],
    series: ChartSeries[],
    title: string = '雷达图'
  ): ChartOption {
    const option: ChartOption = {
      type: 'radar',
      title,
      series: [
        {
          name: '雷达图',
          type: 'radar',
          data: series.map((s, i) => ({
            name: s.name,
            value: s.data,
            areaStyle: { opacity: 0.2, color: CHART_COLORS[i % CHART_COLORS.length] },
            itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] },
          })),
        },
      ],
      radar: {
        indicator: indicators.map(ind => ({
          name: ind.name,
          max: ind.max,
          min: ind.min || 0,
        })),
        shape: 'polygon',
        splitNumber: 5,
      },
      tooltip: { trigger: 'item' },
      legend: { show: series.length > 1, data: series.map(s => s.name) },
    };

    log.info(`[EChartsEngine] Generated radar chart: ${title}`);
    return option;
  }

  // ── Performance Comparison ───────────────────────────────────────────────

  comparePerformance(compareData: ChartCompareData): ChartOption {
    const series: ChartSeries[] = compareData.series.map((s, i) => ({
      name: s.name,
      type: 'line',
      data: s.data,
      color: CHART_COLORS[i % CHART_COLORS.length],
      smooth: true,
      areaStyle: { opacity: 0.1, color: CHART_COLORS[i % CHART_COLORS.length] },
    }));

    const option: ChartOption = {
      type: 'line',
      title: '策略收益对比',
      xAxis: {
        type: 'category',
        data: compareData.labels,
        axisLabel: { rotate: compareData.labels.length > 10 ? 45 : 0 },
      },
      yAxis: {
        type: 'value',
        axisLabel: { formatter: '{value}%' },
      },
      series,
      tooltip: { trigger: 'axis', formatter: (params: unknown) => {
        let result = `${params[0].axisValue}<br/>`;
        params.forEach((p: unknown) => {
          result += `${p.marker} ${p.seriesName}: ${p.value}%<br/>`;
        });
        return result;
      }},
      legend: { show: true, data: compareData.series.map(s => s.name) },
      grid: this.defaultGrid,
    };

    log.info(`[EChartsEngine] Generated performance comparison chart`);
    return option;
  }

  // ── Portfolio Allocation ─────────────────────────────────────────────────

  generatePortfolioAllocation(positions: PortfolioPosition[]): ChartOption {
    const data = positions.map(p => ({
      name: p.symbol,
      value: p.value,
    }));

    return this.generatePieChart(data, '资产配置');
  }

  // ── Helper Methods ───────────────────────────────────────────────────────

  private formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
  }

  private formatVolume(vol: number): string {
    if (vol >= 1e9) return `${(vol / 1e9).toFixed(1)}B`;
    if (vol >= 1e6) return `${(vol / 1e6).toFixed(1)}M`;
    if (vol >= 1e3) return `${(vol / 1e3).toFixed(1)}K`;
    return String(vol);
  }

  // ── Get Available Chart Types ────────────────────────────────────────────

  getChartTypes(): ChartType[] {
    return ['kline', 'line', 'bar', 'pie', 'heatmap', 'scatter', 'radar'];
  }

  // ── Validate Data ────────────────────────────────────────────────────────

  validateKlineData(data: unknown[]): boolean {
    if (!Array.isArray(data) || data.length === 0) return false;
    return data.every(d =>
      typeof d.time === 'number' &&
      typeof d.open === 'number' &&
      typeof d.high === 'number' &&
      typeof d.low === 'number' &&
      typeof d.close === 'number' &&
      typeof d.volume === 'number'
    );
  }

  validateChartData(data: unknown[]): boolean {
    if (!Array.isArray(data)) return false;
    return data.length > 0;
  }

  // ── Statistics ───────────────────────────────────────────────────────────

  calculateStats(data: number[]): { mean: number; std: number; min: number; max: number } {
    if (data.length === 0) return { mean: 0, std: 0, min: 0, max: 0 };
    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    const variance = data.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / data.length;
    return {
      mean,
      std: Math.sqrt(variance),
      min: Math.min(...data),
      max: Math.max(...data),
    };
  }

  calculateReturns(prices: number[]): number[] {
    if (prices.length < 2) return [];
    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
    return returns;
  }

  calculateMovingAverage(data: number[], period: number): number[] {
    if (data.length < period) return [];
    const result: number[] = [];
    for (let i = period - 1; i < data.length; i++) {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += data[i - j];
      }
      result.push(sum / period);
    }
    return result;
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _instance: EChartsEngine | null = null;

export function getEChartsEngine(): EChartsEngine {
  if (!_instance) {
    _instance = new EChartsEngine();
  }
  return _instance;
}

export function resetEChartsEngine(): void {
  _instance = null;
}

export default EChartsEngine;
