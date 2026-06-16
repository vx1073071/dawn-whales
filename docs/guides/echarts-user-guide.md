<!-- META
version: 1.12.0
last_updated: 2026-06-12
round: R108
owner: youdao
purpose: (auto-generated, needs review)
-->

# ECharts 用户指南

**版本**: v0.11.0  
**作者**: dao  
**时间**: 2026-06-07T10:08:00+08:00  
**状态**: Phase 6.2 数据可视化增强

---

## 目录

1. [ECharts 概述](#echarts-概述)
2. [安装和配置](#安装和配置)
3. [K线图](#k线图)
4. [收益曲线](#收益曲线)
5. [风险矩阵](#风险矩阵)
6. [高级功能](#高级功能)
7. [最佳实践](#最佳实践)
8. [常见问题](#常见问题)

---

## ECharts 概述

### 什么是 ECharts？

ECharts 是百度开源的数据可视化库，提供直观、交互丰富、可高度个性化定制的数据可视化图表。

### 为什么选择 ECharts？

| 特性 | ECharts | Chart.js | D3.js |
|-----|---------|----------|-------|
| 学习曲线 | 低 | 低 | 高 |
| 图表类型 | 丰富 | 中等 | 无限 |
| 交互性 | 强 | 中等 | 强 |
| 性能 | 高 | 中等 | 高 |
| 文档 | 中文友好 | 英文 | 英文 |
| 社区 | 活跃 | 活跃 | 活跃 |

### quant-moo ECharts 特性

| 特性 | 说明 | 状态 |
|-----|------|------|
| K线图 | 支持缩放/拖拽/十字光标 | ✅ R45 实现 |
| 收益曲线 | 对比多条策略曲线 | ✅ R45 实现 |
| 风险矩阵 | 热力图展示 | ✅ R45 实现 |
| 主题切换 | 暗色/亮色自适应 | ✅ R45 实现 |
| 响应式 | 自动调整尺寸 | ✅ R45 实现 |
| 数据导出 | PNG/SVG 导出 | ✅ R45 实现 |

---

## 安装和配置

### 安装 ECharts

```bash
# 使用 npm
npm install echarts

# 使用 yarn
yarn add echarts

# 使用 pnpm
pnpm add echarts
```

### 按需引入（推荐）

```typescript
// src/lib/echarts.ts

import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { LineChart, CandlestickChart, HeatmapChart } from 'echarts/charts';
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  DataZoomComponent,
  ToolboxComponent,
} from 'echarts/components';

// 注册组件
echarts.use([
  CanvasRenderer,
  LineChart,
  CandlestickChart,
  HeatmapChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  DataZoomComponent,
  ToolboxComponent,
]);

export default echarts;
```

### React 集成

```typescript
// src/components/charts/EChart.tsx

import React, { useEffect, useRef } from 'react';
import echarts from '@/lib/echarts';

interface EChartProps {
  option: echarts.EChartsOption;
  style?: React.CSSProperties;
  theme?: 'dark' | 'light';
}

export const EChart: React.FC<EChartProps> = ({ option, style, theme = 'dark' }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    // 初始化图表
    chartInstance.current = echarts.init(chartRef.current, theme);

    // 设置配置
    chartInstance.current.setOption(option);

    // 响应式
    const resizeObserver = new ResizeObserver(() => {
      chartInstance.current?.resize();
    });
    resizeObserver.observe(chartRef.current);

    // 清理
    return () => {
      resizeObserver.disconnect();
      chartInstance.current?.dispose();
    };
  }, [option, theme]);

  return <div ref={chartRef} style={{ width: '100%', height: '400px', ...style }} />;
};

export default EChart;
```

---

## K线图

### 基础 K线图

```typescript
import React from 'react';
import EChart from '@/components/charts/EChart';

interface KLineChartProps {
  data: {
    date: string;
    open: number;
    close: number;
    low: number;
    high: number;
    volume: number;
  }[];
}

export const KLineChart: React.FC<KLineChartProps> = ({ data }) => {
  const dates = data.map(d => d.date);
  const values = data.map(d => [d.open, d.close, d.low, d.high]);

  const option: echarts.EChartsOption = {
    title: {
      text: 'K线图',
      left: 'center',
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
      },
    },
    grid: {
      left: '10%',
      right: '10%',
      bottom: '15%',
    },
    xAxis: {
      type: 'category',
      data: dates,
      scale: true,
      boundaryGap: false,
      axisLine: { onZero: false },
      splitLine: { show: false },
      min: 'dataMin',
      max: 'dataMax',
    },
    yAxis: {
      type: 'value',
      scale: true,
      splitArea: {
        show: true,
      },
    },
    dataZoom: [
      {
        type: 'inside',
        start: 50,
        end: 100,
      },
      {
        show: true,
        type: 'slider',
        top: '90%',
        start: 50,
        end: 100,
      },
    ],
    series: [
      {
        name: 'K线',
        type: 'candlestick',
        data: values,
        itemStyle: {
          color: '#ef5350',        // 上涨颜色（红色）
          color0: '#26a69a',       // 下跌颜色（绿色）
          borderColor: '#ef5350',
          borderColor0: '#26a69a',
        },
      },
    ],
  };

  return <EChart option={option} style={{ height: '500px' }} />;
};
```

### 带成交量的 K线图

```typescript
export const KLineWithVolumeChart: React.FC<KLineChartProps> = ({ data }) => {
  const dates = data.map(d => d.date);
  const values = data.map(d => [d.open, d.close, d.low, d.high]);
  const volumes = data.map(d => d.volume);

  const option: echarts.EChartsOption = {
    title: {
      text: 'K线图 + 成交量',
      left: 'center',
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
      },
    },
    grid: [
      {
        left: '10%',
        right: '10%',
        height: '60%',
      },
      {
        left: '10%',
        right: '10%',
        top: '75%',
        height: '15%',
      },
    ],
    xAxis: [
      {
        type: 'category',
        data: dates,
        scale: true,
        boundaryGap: false,
        axisLine: { onZero: false },
        splitLine: { show: false },
        gridIndex: 0,
      },
      {
        type: 'category',
        data: dates,
        gridIndex: 1,
      },
    ],
    yAxis: [
      {
        scale: true,
        gridIndex: 0,
      },
      {
        gridIndex: 1,
        scale: true,
      },
    ],
    dataZoom: [
      {
        type: 'inside',
        xAxisIndex: [0, 1],
        start: 50,
        end: 100,
      },
      {
        show: true,
        type: 'slider',
        xAxisIndex: [0, 1],
        top: '95%',
        start: 50,
        end: 100,
      },
    ],
    series: [
      {
        name: 'K线',
        type: 'candlestick',
        data: values,
        xAxisIndex: 0,
        yAxisIndex: 0,
      },
      {
        name: '成交量',
        type: 'bar',
        data: volumes,
        xAxisIndex: 1,
        yAxisIndex: 1,
        itemStyle: {
          color: (params) => {
            const klineData = data[params.dataIndex];
            return klineData.close >= klineData.open ? '#ef5350' : '#26a69a';
          },
        },
      },
    ],
  };

  return <EChart option={option} style={{ height: '600px' }} />;
};
```

### K线图交互功能

```typescript
// 十字光标
tooltip: {
  trigger: 'axis',
  axisPointer: {
    type: 'cross',
    crossStyle: {
      color: '#999',
    },
  },
},

// 工具箱（导出图片、数据视图等）
toolbox: {
  feature: {
    dataZoom: {
      yAxisIndex: 'none',
    },
    brush: {
      type: ['lineX', 'lineY', 'keep', 'clear'],
    },
    saveAsImage: {
      name: 'kline',
      type: 'png',
    },
  },
},

// 区域缩放
dataZoom: [
  {
    type: 'inside',
    start: 50,
    end: 100,
  },
  {
    type: 'slider',
    start: 50,
    end: 100,
  },
],
```

---

## 收益曲线

### 单条收益曲线

```typescript
interface ReturnCurveProps {
  data: {
    date: string;
    return: number;
  }[];
}

export const ReturnCurveChart: React.FC<ReturnCurveProps> = ({ data }) => {
  const dates = data.map(d => d.date);
  const returns = data.map(d => d.return);

  const option: echarts.EChartsOption = {
    title: {
      text: '收益曲线',
      left: 'center',
    },
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        const param = params[0];
        return `${param.name}<br/>收益: ${(param.value as number * 100).toFixed(2)}%`;
      },
    },
    grid: {
      left: '10%',
      right: '10%',
      bottom: '15%',
    },
    xAxis: {
      type: 'category',
      data: dates,
      boundaryGap: false,
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: (value) => `${(value * 100).toFixed(0)}%`,
      },
    },
    series: [
      {
        name: '收益',
        type: 'line',
        data: returns,
        smooth: true,
        showSymbol: false,
        lineStyle: {
          width: 2,
          color: '#5470c6',
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(84, 112, 198, 0.3)' },
            { offset: 1, color: 'rgba(84, 112, 198, 0.05)' },
          ]),
        },
      },
    ],
  };

  return <EChart option={option} style={{ height: '400px' }} />;
};
```

### 多策略对比

```typescript
interface MultiStrategyReturnProps {
  strategies: {
    name: string;
    data: { date: string; return: number }[];
  }[];
}

export const MultiStrategyReturnChart: React.FC<MultiStrategyReturnProps> = ({ strategies }) => {
  const dates = strategies[0].data.map(d => d.date);
  
  const series = strategies.map((strategy, index) => ({
    name: strategy.name,
    type: 'line' as const,
    data: strategy.data.map(d => d.return),
    smooth: true,
    showSymbol: false,
    lineStyle: {
      width: 2,
    },
  }));

  const option: echarts.EChartsOption = {
    title: {
      text: '多策略收益对比',
      left: 'center',
    },
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        let result = `${params[0].name}<br/>`;
        params.forEach((param) => {
          result += `${param.marker}${param.seriesName}: ${((param.value as number) * 100).toFixed(2)}%<br/>`;
        });
        return result;
      },
    },
    legend: {
      data: strategies.map(s => s.name),
      top: '10%',
    },
    grid: {
      left: '10%',
      right: '10%',
      bottom: '15%',
    },
    xAxis: {
      type: 'category',
      data: dates,
      boundaryGap: false,
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: (value) => `${(value * 100).toFixed(0)}%`,
      },
    },
    series,
  };

  return <EChart option={option} style={{ height: '500px' }} />;
};
```

### 带基准对比

```typescript
export const ReturnWithBenchmarkChart: React.FC<{
  strategy: { date: string; return: number }[];
  benchmark: { date: string; return: number }[];
}> = ({ strategy, benchmark }) => {
  const dates = strategy.map(d => d.date);
  
  const option: echarts.EChartsOption = {
    title: {
      text: '策略 vs 基准',
      left: 'center',
    },
    tooltip: {
      trigger: 'axis',
    },
    legend: {
      data: ['策略', '基准'],
      top: '10%',
    },
    grid: {
      left: '10%',
      right: '10%',
      bottom: '15%',
    },
    xAxis: {
      type: 'category',
      data: dates,
      boundaryGap: false,
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: (value) => `${(value * 100).toFixed(0)}%`,
      },
    },
    series: [
      {
        name: '策略',
        type: 'line',
        data: strategy.map(d => d.return),
        smooth: true,
        showSymbol: false,
        lineStyle: {
          width: 2,
          color: '#5470c6',
        },
      },
      {
        name: '基准',
        type: 'line',
        data: benchmark.map(d => d.return),
        smooth: true,
        showSymbol: false,
        lineStyle: {
          width: 2,
          color: '#91cc75',
          type: 'dashed',
        },
      },
    ],
  };

  return <EChart option={option} style={{ height: '400px' }} />;
};
```

---

## 风险矩阵

### 热力图

```typescript
interface RiskMatrixProps {
  data: {
    x: string;
    y: string;
    value: number;
  }[];
}

export const RiskMatrixChart: React.FC<RiskMatrixProps> = ({ data }) => {
  const xLabels = Array.from(new Set(data.map(d => d.x)));
  const yLabels = Array.from(new Set(data.map(d => d.y)));
  
  const chartData = data.map(d => [
    xLabels.indexOf(d.x),
    yLabels.indexOf(d.y),
    d.value,
  ]);

  const option: echarts.EChartsOption = {
    title: {
      text: '风险矩阵',
      left: 'center',
    },
    tooltip: {
      position: 'top',
      formatter: (params) => {
        const value = params.value as number[];
        return `${xLabels[value[0]]} vs ${yLabels[value[1]]}<br/>相关性: ${value[2].toFixed(2)}`;
      },
    },
    grid: {
      left: '15%',
      right: '15%',
      bottom: '15%',
    },
    xAxis: {
      type: 'category',
      data: xLabels,
      splitArea: {
        show: true,
      },
    },
    yAxis: {
      type: 'category',
      data: yLabels,
      splitArea: {
        show: true,
      },
    },
    visualMap: {
      min: -1,
      max: 1,
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: '5%',
      inRange: {
        color: ['#26a69a', '#eeeeee', '#ef5350'],
      },
    },
    series: [
      {
        name: '相关性',
        type: 'heatmap',
        data: chartData,
        label: {
          show: true,
          formatter: (params) => {
            const value = params.value as number[];
            return value[2].toFixed(2);
          },
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: 'rgba(0, 0, 0, 0.5)',
          },
        },
      },
    ],
  };

  return <EChart option={option} style={{ height: '500px' }} />;
};
```

### 风险因子暴露

```typescript
interface RiskFactorExposureProps {
  data: {
    factor: string;
    exposure: number;
  }[];
}

export const RiskFactorExposureChart: React.FC<RiskFactorExposureProps> = ({ data }) => {
  const factors = data.map(d => d.factor);
  const exposures = data.map(d => d.exposure);

  const option: echarts.EChartsOption = {
    title: {
      text: '风险因子暴露',
      left: 'center',
    },
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        const param = params[0];
        return `${param.name}<br/>暴露: ${(param.value as number * 100).toFixed(2)}%`;
      },
    },
    grid: {
      left: '15%',
      right: '10%',
      bottom: '15%',
    },
    xAxis: {
      type: 'category',
      data: factors,
      axisLabel: {
        rotate: 45,
      },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: (value) => `${(value * 100).toFixed(0)}%`,
      },
    },
    series: [
      {
        name: '暴露',
        type: 'bar',
        data: exposures,
        itemStyle: {
          color: (params) => {
            const value = params.value as number;
            return value >= 0 ? '#ef5350' : '#26a69a';
          },
        },
        label: {
          show: true,
          position: 'top',
          formatter: (params) => `${((params.value as number) * 100).toFixed(1)}%`,
        },
      },
    ],
  };

  return <EChart option={option} style={{ height: '400px' }} />;
};
```

---

## 高级功能

### 主题切换

```typescript
// 暗色主题
const darkTheme = {
  backgroundColor: '#1a1a25',
  textStyle: {
    color: '#fff',
  },
  title: {
    textStyle: {
      color: '#fff',
    },
  },
  legend: {
    textStyle: {
      color: '#fff',
    },
  },
};

// 亮色主题
const lightTheme = {
  backgroundColor: '#fff',
  textStyle: {
    color: '#333',
  },
  title: {
    textStyle: {
      color: '#333',
    },
  },
  legend: {
    textStyle: {
      color: '#333',
    },
  },
};

// 使用主题
<EChart option={option} theme={isDark ? 'dark' : 'light'} />
```

### 响应式配置

```typescript
// 根据屏幕尺寸调整配置
const getResponsiveOption = (width: number) => {
  const isMobile = width < 768;
  
  return {
    grid: {
      left: isMobile ? '5%' : '10%',
      right: isMobile ? '5%' : '10%',
    },
    legend: {
      orient: isMobile ? 'vertical' : 'horizontal',
      top: isMobile ? 'auto' : '10%',
      bottom: isMobile ? '5%' : 'auto',
    },
    dataZoom: isMobile ? [
      { type: 'inside' },
    ] : [
      { type: 'inside' },
      { type: 'slider' },
    ],
  };
};
```

### 数据导出

```typescript
// 导出为 PNG
const exportPNG = (chartInstance: echarts.ECharts, name: string) => {
  const url = chartInstance.getDataURL({
    type: 'png',
    pixelRatio: 2,
    backgroundColor: '#fff',
  });
  
  const link = document.createElement('a');
  link.download = `${name}.png`;
  link.href = url;
  link.click();
};

// 导出为 SVG
const exportSVG = (chartInstance: echarts.ECharts, name: string) => {
  const url = chartInstance.getDataURL({
    type: 'svg',
  });
  
  const link = document.createElement('a');
  link.download = `${name}.svg`;
  link.href = url;
  link.click();
};
```

### 动画效果

```typescript
// 入场动画
series: [
  {
    type: 'line',
    data: data,
    animationDuration: 1000,
    animationEasing: 'cubicOut',
  },
],

// 数据更新动画
chartInstance.setOption(newOption, {
  notMerge: false,
  lazyUpdate: false,
});
```

---

## 最佳实践

### 1. 性能优化

```typescript
// ✅ 推荐：按需引入
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';

// ❌ 避免：全量引入
import * as echarts from 'echarts';

// ✅ 推荐：大数据量使用降采样
series: [
  {
    type: 'line',
    data: largeData,
    sampling: 'lttb', // Largest Triangle Three Buckets
  },
],

// ✅ 推荐：使用 canvas 渲染器
echarts.init(dom, null, {
  renderer: 'canvas',
});
```

### 2. 内存管理

```typescript
// ✅ 推荐：组件卸载时销毁图表
useEffect(() => {
  const chart = echarts.init(dom);
  
  return () => {
    chart.dispose();
  };
}, []);

// ✅ 推荐：避免重复创建实例
const chartRef = useRef<echarts.ECharts | null>(null);

if (!chartRef.current) {
  chartRef.current = echarts.init(dom);
}
```

### 3. 错误处理

```typescript
// ✅ 推荐：捕获图表错误
try {
  chartInstance.setOption(option);
} catch (error) {
  console.error('Chart error:', error);
  // 显示友好的错误提示
}

// ✅ 推荐：数据验证
if (!data || data.length === 0) {
  return <div>暂无数据</div>;
}
```

### 4. 可访问性

```typescript
// ✅ 推荐：添加 aria 标签
<div 
  ref={chartRef} 
  role="img" 
  aria-label="收益曲线图表"
  tabIndex={0}
/>

// ✅ 推荐：提供数据表格备选
<div>
  <EChart option={option} />
  <DataTable data={data} /> {/* 屏幕阅读器可读 */}
</div>
```

---

## 常见问题

### Q1: 图表不显示？

**A**: 检查以下几点：
1. 容器是否有明确的宽高
2. ECharts 是否正确初始化
3. 配置项是否正确
4. 浏览器控制台是否有错误

### Q2: 图表渲染慢？

**A**: 检查以下几点：
1. 数据量是否过大（> 10000 点）
2. 是否使用了按需引入
3. 是否启用了动画
4. 是否使用了 canvas 渲染器

### Q3: 响应式不生效？

**A**: 检查以下几点：
1. 是否使用了 ResizeObserver
2. 是否调用了 chart.resize()
3. 容器是否使用了 flex/grid 布局

### Q4: 主题切换不生效？

**A**: 检查以下几点：
1. 是否重新初始化了图表
2. 主题配置是否正确
3. 是否使用了 echarts.registerTheme()

### Q5: 数据更新不生效？

**A**: 检查以下几点：
1. 是否调用了 setOption()
2. 是否使用了 notMerge: false
3. 数据格式是否正确

---

## 附录

### 相关文档

- [ECharts 官方文档](https://echarts.apache.org/zh/index.html)
- [ECharts 配置项手册](https://echarts.apache.org/zh/option.html)
- [Phase 6.2 架构文档](../architecture/phase6-architecture.md)
- [v0.11.0 用户手册](./v0.11.0-user-manual.md)

### 工具推荐

- **ECharts Editor**: VS Code 插件，提供配置项提示
- **ECharts Gallery**: 官方图表示例库
- **DataV**: 数据可视化工具

---

**文档版本**: v0.11.0  
**最后更新**: 2026-06-07T10:12:00+08:00  
**作者**: dao  
**状态**: ✅ ECharts 用户指南完成
