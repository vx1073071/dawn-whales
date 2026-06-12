// ── R113b PatternOverlay — K线形态自动标注覆盖层 ──────────────────────
// PM: QTE-06 形态标注覆盖层UI (模块4 PatternRecognition)
// 在 KLineChart 上叠加 TA-Lib 61种K线形态识别结果

import { useMemo } from 'react';
import type { KlineBar } from '../../lib/chart/types';

// ═══════════ Types ═══════════

export interface PatternResult {
  id: string;
  name: string;
  shortName: string;
  index: number;       // bar index
  type: 'bullish' | 'bearish' | 'neutral';
  reliability: 'high' | 'medium' | 'low';
  confidence: number;  // 0-100
}

export interface PatternOverlayProps {
  bars: KlineBar[];
  patterns: PatternResult[];
  chartWidth: number;
  chartHeight: number;
  visibleStart: number;
  visibleCount: number;
  barWidth: number;
  gapWidth: number;
  toY: (price: number) => number;
  className?: string;
}

// ═══════════ Pattern definitions ═══════════

export const PATTERN_CATALOG: { id: string; name: string; shortName: string; type: 'bullish' | 'bearish' | 'neutral'; description: string }[] = [
  // Single candle
  { id: 'doji', name: '十字星', shortName: '十字星', type: 'neutral', description: 'Doji — 开盘价=收盘价, 多空平衡' },
  { id: 'hammer', name: '锤子线', shortName: '锤子', type: 'bullish', description: 'Hammer — 长下影线, 底部反转' },
  { id: 'hanging-man', name: '上吊线', shortName: '上吊', type: 'bearish', description: 'Hanging Man — 顶部反转信号' },
  { id: 'shooting-star', name: '射击之星', shortName: '流星', type: 'bearish', description: 'Shooting Star — 长上影线, 顶部反转' },
  { id: 'inverted-hammer', name: '倒锤子', shortName: '倒锤', type: 'bullish', description: 'Inverted Hammer — 底部反转' },
  { id: 'marubozu', name: '光头光脚', shortName: '光脚', type: 'neutral', description: 'Marubozu — 趋势强劲' },
  { id: 'spinning-top', name: '陀螺线', shortName: '陀螺', type: 'neutral', description: 'Spinning Top — 犹豫不决' },

  // Two candle
  { id: 'bullish-engulfing', name: '看涨吞没', shortName: '吞没↑', type: 'bullish', description: 'Bullish Engulfing — 阳包阴' },
  { id: 'bearish-engulfing', name: '看跌吞没', shortName: '吞没↓', type: 'bearish', description: 'Bearish Engulfing — 阴包阳' },
  { id: 'bullish-harami', name: '看涨孕线', shortName: '孕线↑', type: 'bullish', description: 'Bullish Harami' },
  { id: 'bearish-harami', name: '看跌孕线', shortName: '孕线↓', type: 'bearish', description: 'Bearish Harami' },
  { id: 'piercing-line', name: '刺透线', shortName: '刺透', type: 'bullish', description: 'Piercing Line' },
  { id: 'dark-cloud-cover', name: '乌云盖顶', shortName: '乌云', type: 'bearish', description: 'Dark Cloud Cover' },
  { id: 'tweezer-top', name: '平头顶', shortName: '平头↓', type: 'bearish', description: 'Tweezer Top' },
  { id: 'tweezer-bottom', name: '平头底', shortName: '平头↑', type: 'bullish', description: 'Tweezer Bottom' },

  // Three candle
  { id: 'morning-star', name: '启明星', shortName: '启明星', type: 'bullish', description: 'Morning Star — 三线底部反转' },
  { id: 'evening-star', name: '黄昏星', shortName: '黄昏星', type: 'bearish', description: 'Evening Star — 三线顶部反转' },
  { id: 'three-white-soldiers', name: '三白兵', shortName: '三白兵', type: 'bullish', description: 'Three White Soldiers' },
  { id: 'three-black-crows', name: '三乌鸦', shortName: '三乌鸦', type: 'bearish', description: 'Three Black Crows' },
  { id: 'three-inside-up', name: '三内升', shortName: '三内升', type: 'bullish', description: 'Three Inside Up' },
  { id: 'three-inside-down', name: '三内降', shortName: '三内降', type: 'bearish', description: 'Three Inside Down' },
];

// ═══════════ Pattern colors ═══════════

const PATTERN_COLORS: Record<string, string> = {
  bullish: '#22c55e', bearish: '#ef4444', neutral: '#f59e0b',
};

const RELIABILITY_OPACITY: Record<string, number> = {
  high: 1, medium: 0.7, low: 0.4,
};

// ═══════════ Pure pattern detection (no React) ═══════════

function isDoji(bar: KlineBar, threshold = 0.001): boolean {
  return Math.abs(bar.open - bar.close) / bar.open < threshold;
}

function isHammer(bar: KlineBar, prevBar?: KlineBar): boolean {
  const body = Math.abs(bar.close - bar.open);
  const lowerShadow = Math.min(bar.open, bar.close) - bar.low;
  const upperShadow = bar.high - Math.max(bar.open, bar.close);
  return lowerShadow > body * 2 && upperShadow < body * 0.5 && (!prevBar || bar.low < prevBar.low);
}

function isShootingStar(bar: KlineBar, prevBar?: KlineBar): boolean {
  const body = Math.abs(bar.close - bar.open);
  const upperShadow = bar.high - Math.max(bar.open, bar.close);
  const lowerShadow = Math.min(bar.open, bar.close) - bar.low;
  return upperShadow > body * 2 && lowerShadow < body * 0.5 && (!prevBar || bar.high > prevBar.high);
}

function isBullishEngulfing(bars: KlineBar[]): boolean {
  if (bars.length < 2) return false;
  const [prev, curr] = [bars[bars.length - 2], bars[bars.length - 1]];
  return prev.close < prev.open && curr.close > curr.open && curr.open < prev.close && curr.close > prev.open;
}

function isBearishEngulfing(bars: KlineBar[]): boolean {
  if (bars.length < 2) return false;
  const [prev, curr] = [bars[bars.length - 2], bars[bars.length - 1]];
  return prev.close > prev.open && curr.close < curr.open && curr.open > prev.close && curr.close < prev.open;
}

function isThreeWhiteSoldiers(bars: KlineBar[]): boolean {
  if (bars.length < 3) return false;
  const [a, b, c] = [bars[bars.length - 3], bars[bars.length - 2], bars[bars.length - 1]];
  return a.close > a.open && b.close > b.open && c.close > c.open
    && b.close > a.close && c.close > b.close && b.open < a.close && c.open < b.close;
}

function isThreeBlackCrows(bars: KlineBar[]): boolean {
  if (bars.length < 3) return false;
  const [a, b, c] = [bars[bars.length - 3], bars[bars.length - 2], bars[bars.length - 1]];
  return a.close < a.open && b.close < b.open && c.close < c.open
    && b.close < a.close && c.close < b.close && b.open > a.close && c.open > b.close;
}

/** Detect all patterns on visible bars */
export function detectPatterns(bars: KlineBar[], startIdx: number, endIdx: number): PatternResult[] {
  const results: PatternResult[] = [];
  for (let i = Math.max(startIdx, 2); i <= endIdx && i < bars.length; i++) {
    const bar = bars[i];

    if (isDoji(bar)) results.push({ id: 'doji', name: '十字星', shortName: '十字星', index: i, type: 'neutral', reliability: 'medium', confidence: 65 });
    if (isHammer(bar, bars[i - 1])) results.push({ id: 'hammer', name: '锤子线', shortName: '锤子', index: i, type: 'bullish', reliability: 'high', confidence: 80 });
    if (isShootingStar(bar, bars[i - 1])) results.push({ id: 'shooting-star', name: '射击之星', shortName: '流星', index: i, type: 'bearish', reliability: 'high', confidence: 80 });

    if (i >= 1) {
      const twoBars = [bars[i - 1], bar];
      if (isBullishEngulfing(twoBars)) results.push({ id: 'bullish-engulfing', name: '看涨吞没', shortName: '吞没↑', index: i, type: 'bullish', reliability: 'high', confidence: 85 });
      if (isBearishEngulfing(twoBars)) results.push({ id: 'bearish-engulfing', name: '看跌吞没', shortName: '吞没↓', index: i, type: 'bearish', reliability: 'high', confidence: 85 });
    }

    if (i >= 2) {
      const threeBars = [bars[i - 2], bars[i - 1], bar];
      if (isThreeWhiteSoldiers(threeBars)) results.push({ id: 'three-white-soldiers', name: '三白兵', shortName: '三白兵', index: i, type: 'bullish', reliability: 'high', confidence: 90 });
      if (isThreeBlackCrows(threeBars)) results.push({ id: 'three-black-crows', name: '三乌鸦', shortName: '三乌鸦', index: i, type: 'bearish', reliability: 'high', confidence: 90 });
    }
  }
  return results;
}

// ═══════════ Overlay Component ═══════════

export default function PatternOverlay({
  bars, patterns, chartWidth, visibleStart, visibleCount, barWidth, gapWidth, toY, className = '',
}: PatternOverlayProps) {
  const visiblePatterns = useMemo(() => {
    const endIdx = Math.min(visibleStart + visibleCount, bars.length);
    return patterns.filter(p => p.index >= visibleStart && p.index < endIdx);
  }, [patterns, visibleStart, visibleCount, bars.length]);

  const toX = (i: number) => (i - visibleStart) * (barWidth + gapWidth) + barWidth / 2;

  const getPatternInfo = (id: string) => PATTERN_CATALOG.find(p => p.id === id);

  return (
    <div className={`absolute top-0 left-0 pointer-events-none ${className}`} style={{ width: chartWidth, height: '100%' }}>
      <svg width={chartWidth} height="100%" viewBox={`0 0 ${chartWidth} 100`} preserveAspectRatio="none" className="absolute top-0 left-0">
        {visiblePatterns.map((p, i) => {
          const x = toX(p.index);
          const bar = bars[p.index];
          if (!bar) return null;
          const y = toY(bar.low) / 5; // normalize to 0-100
          const color = PATTERN_COLORS[p.type];
          const opacity = RELIABILITY_OPACITY[p.reliability];
          return (
            <g key={`${p.id}-${p.index}-${i}`}>
              {/* Marker triangle */}
              <polygon
                points={`${x - 4},0 ${x + 4},0 ${x},6`}
                fill={color}
                opacity={opacity}
              />
              {/* Connecting line */}
              <line x1={x} y1={6} x2={x} y2={Math.min(y + 2, 98)} stroke={color} strokeWidth="0.5" opacity={opacity * 0.6} />
              {/* Label */}
              <text x={x} y={Math.min(y + 12, 98)} textAnchor="middle" fill={color} fontSize="6" fontWeight="bold" opacity={opacity} fontFamily="monospace">
                {p.shortName}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Pattern legend (bottom-left tooltip on hover) */}
      {visiblePatterns.length > 0 && (
        <div className="absolute bottom-2 left-2 flex flex-wrap gap-1 pointer-events-auto">
          {visiblePatterns.slice(0, 5).map((p, i) => {
            const info = getPatternInfo(p.id);
            if (!info) return null;
            return (
              <div key={`legend-${i}`}
                className="px-1.5 py-0.5 rounded text-[9px] font-mono border cursor-help"
                style={{
                  color: PATTERN_COLORS[p.type],
                  backgroundColor: PATTERN_COLORS[p.type] + '15',
                  borderColor: PATTERN_COLORS[p.type] + '30',
                }}
                title={`${info.name}: ${info.description} (置信度: ${p.confidence}%)`}
              >
                {p.shortName} {p.confidence}%
              </div>
            );
          })}
          {visiblePatterns.length > 5 && (
            <span className="text-[9px] text-[#484f58] py-0.5">+{visiblePatterns.length - 5}</span>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════ Pattern Summary Panel ═══════════

export interface PatternSummaryProps {
  patterns: PatternResult[];
  className?: string;
}

export function PatternSummary({ patterns, className = '' }: PatternSummaryProps) {
  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of patterns) map[p.shortName] = (map[p.shortName] || 0) + 1;
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [patterns]);

  if (patterns.length === 0) {
    return (
      <div className={`text-[10px] text-[#484f58] p-2 text-center ${className}`}>
        暂无检测到的K线形态
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-1 p-2 text-[10px] font-mono ${className}`}>
      <div className="flex items-center justify-between text-[#8b949e] font-semibold mb-1">
        <span>形态检测 Pattern</span>
        <span className="text-[#484f58]">{patterns.length}个</span>
      </div>
      {counts.slice(0, 8).map(([name, count]) => {
        const pattern = PATTERN_CATALOG.find(p => p.shortName === name);
        const type = pattern?.type || 'neutral';
        return (
          <div key={name} className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: PATTERN_COLORS[type] }} />
            <span className="text-[#c9d1d9] flex-1">{name}</span>
            <span className="text-[#484f58]">×{count}</span>
          </div>
        );
      })}
    </div>
  );
}
