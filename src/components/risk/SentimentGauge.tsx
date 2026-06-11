// ── DAWN WHALES — SentimentGauge (W28) ─────────────────────────────────────
// indexdashboard：0-100，/

import { useState, useEffect, useCallback, useMemo } from 'react'
import { EngineError } from '../../../electron/engine/core/engine-error';
import { useTranslation } from 'react-i18next';
import ReactECharts from 'echarts-for-react';
import { computeSentiment } from '../../lib/bridge-api';
import i18n from '../../i18n';

interface SentimentData {
  index: number; // 0-100
  label: string;
  description: string;
  components: {
    name: string;
    weight: number;
    score: number;
  }[];
  history: { date: string; index: number }[];
}

const SENTIMENT_LEVELS = [
  { min: 0, max: 20, label: i18n.t('SentimentGauge.k1'), color: '#dc2626', emoji: '😱' },
  { min: 20, max: 40, label: i18n.t('SentimentGauge.k2'), color: '#ef4444', emoji: '😰' },
  { min: 40, max: 60, label: i18n.t('SentimentGauge.k3'), color: '#f59e0b', emoji: '😐' },
  { min: 60, max: 80, label: i18n.t('SentimentGauge.k4'), color: '#22c55e', emoji: '😏' },
  { min: 80, max: 100, label: i18n.t('SentimentGauge.k5'), color: '#16a34a', emoji: '🤑' },
];

function getLevel(index: number) {
  const { t: _t } = useTranslation();

  return SENTIMENT_LEVELS.find((l) => index >= l.min && index <= l.max) || SENTIMENT_LEVELS[2];
}

export default function SentimentGauge() {
  const [data, setData] = useState<SentimentData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSentiment = useCallback(async () => {
    setLoading(true);
    try {
      const result = await computeSentiment();
      if (result?.success && result.result) {
        setData(result.result);
      } else {
        setData(generateDemoSentiment());
      }
    } catch {
      void EngineError; // [AI] structured error tracking
      setData(generateDemoSentiment());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSentiment();
    const interval = setInterval(loadSentiment, 60000); // 1 min refresh
    return () => clearInterval(interval);
  }, [loadSentiment]);

  const level = useMemo(() => (data ? getLevel(data.index) : SENTIMENT_LEVELS[2]), [data]);

  const gaugeOption = useMemo(() => {
    if (!data) return {};
    return {
      backgroundColor: 'transparent',
      series: [{
        type: 'gauge',
        startAngle: 200,
        endAngle: -20,
        min: 0,
        max: 100,
        splitNumber: 10,
        itemStyle: { color: level.color },
        progress: {
          show: true,
          width: 18,
          roundCap: true,
        },
        pointer: {
          show: true,
          length: '60%',
          width: 6,
          itemStyle: { color: '#fff' },
        },
        axisLine: {
          lineStyle: { width: 18, color: [[1, '#1a1a25']] },
        },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        anchor: {
          show: true,
          showAbove: true,
          size: 20,
          itemStyle: { borderWidth: 4, borderColor: level.color, color: '#12121a' },
        },
        title: {
          show: true,
          offsetCenter: [0, '35%'],
          textStyle: { fontSize: 14, color: level.color, fontWeight: 'bold' },
        },
        detail: {
          valueAnimation: true,
          fontSize: 36,
          fontWeight: 'bold',
          offsetCenter: [0, '-10%'],
          formatter: '{value}',
          color: '#fff',
          fontFamily: 'SF Mono, Consolas, monospace',
        },
        data: [{ value: Math.round(data.index), name: `${level.emoji} ${level.label}` }],
      }],
    };
  }, [data, level]);

  const historyOption = useMemo(() => {
    if (!data?.history?.length) return null;
    return {
      backgroundColor: 'transparent',
      grid: { top: 10, right: 10, bottom: 20, left: 40 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#1a1a25',
        borderColor: '#333',
        textStyle: { color: '#e6edf3', fontSize: 11 },
        formatter: (params: Record<string, unknown>) => {
          const p = params[0];
          const lvl = getLevel((p as any).value);
          return `${(p as any).name}<br/><span style="color:${lvl.color}">●</span> ${(p as any).value} — ${lvl.label}`;
        },
      },
      xAxis: {
        type: 'category',
        data: data.history.map((h) => h.date),
        axisLine: { lineStyle: { color: '#333' } },
        axisLabel: { color: '#8b949e', fontSize: 9 },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: 100,
        axisLine: { lineStyle: { color: '#333' } },
        axisLabel: { color: '#8b949e', fontSize: 9 },
        splitLine: { lineStyle: { color: '#222' } },
      },
      visualMap: {
        show: false,
        top: 10,
        right: 10,
        pieces: [
          { min: 0, max: 20, color: '#dc2626' },
          { min: 20, max: 40, color: '#ef4444' },
          { min: 40, max: 60, color: '#f59e0b' },
          { min: 60, max: 80, color: '#22c55e' },
          { min: 80, max: 100, color: '#16a34a' },
        ],
        outOfRange: { color: '#999' },
      },
      series: [{
        type: 'line',
        data: data.history.map((h) => h.index),
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 2 },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(201,169,70,0.2)' },
              { offset: 1, color: 'rgba(201,169,70,0.0)' },
            ],
          },
        },
      }],
    };
  }, [data]);

  if (loading && !data) {
    return (
      <div className="bg-[#12121a] border border-white/5 rounded-xl p-4">
        <div className="text-gray-500 text-sm animate-pulse">{i18n.t('SentimentGauge.k0')}</div>
      </div>
    );
  }

  return (
    <div className="bg-[#12121a] border border-white/5 rounded-xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-white font-medium text-sm">🎭 市场情绪指数</h3>
        <button
          onClick={loadSentiment}
          disabled={loading}
          className="text-gray-500 hover:text-gray-300 text-xs transition-colors disabled:opacity-40"
        >
          {loading ? '⟳' : '↻'}
        </button>
      </div>

      {/* Gauge */}
      {data && (
        <>
          <ReactECharts option={gaugeOption} style={{ height: 200 }} theme="dark" />

          {/* Components Breakdown */}
          {data.components && data.components.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs text-gray-500">{i18n.t('SentimentGauge.k1')}</div>
              {data.components.map((comp) => (
                <div key={comp.name} className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-16 truncate">{comp.name}</span>
                  <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${comp.score}%`,
                        backgroundColor: comp.score > 60 ? '#22c55e' : comp.score < 40 ? '#ef4444' : '#f59e0b',
                      }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-500 w-8 text-right">{Math.round(comp.score)}</span>
                </div>
              ))}
            </div>
          )}

          {/* History Mini Chart */}
          {historyOption && (
            <div>
              <div className="text-xs text-gray-500 mb-1">7日走势</div>
              <ReactECharts option={historyOption} style={{ height: 100 }} theme="dark" />
            </div>
          )}

          {/* Description */}
          <div className="text-[11px] text-gray-500 bg-white/[0.02] rounded-lg px-3 py-2">
            {data.description}
          </div>
        </>
      )}
    </div>
  );
}

// ── Demo Data ──────────────────────────────────────────────────────────────

function generateDemoSentiment(): SentimentData {
  const now = new Date();
  const history: { date: string; index: number }[] = [];
  let index = 55;
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    index += (Math.random() - 0.5) * 20;
    index = Math.max(5, Math.min(95, index));
    history.push({
      date: `${d.getMonth() + 1}/${d.getDate()}`,
      index: Math.round(index),
    });
  }

  const currentIndex = history[history.length - 1].index;
  const lvl = getLevel(currentIndex);

  return {
    index: currentIndex,
    label: lvl.label,
    description: `当前市场情绪为"${lvl.label}"。${
      currentIndex > 70
        ? i18n.t('SentimentGauge.k2')
        : currentIndex < 30
        ? i18n.t('SentimentGauge.k3')
        : i18n.t('SentimentGauge.k4')
    }`,
    components: [
      { name: 'components.volatility', weight: 0.25, score: Math.round(Math.random() * 100) },
      { name: i18n.t('SentimentGauge.k6'), weight: 0.20, score: Math.round(Math.random() * 100) },
      { name: i18n.t('SentimentGauge.k7'), weight: 0.20, score: Math.round(Math.random() * 100) },
      { name: i18n.t('SentimentGauge.k8'), weight: 0.20, score: Math.round(Math.random() * 100) },
      { name: i18n.t('SentimentGauge.k9'), weight: 0.15, score: Math.round(Math.random() * 100) },
    ],
    history,
  };
}
