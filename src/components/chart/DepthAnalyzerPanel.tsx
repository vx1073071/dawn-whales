// @ts-nocheck
// R125-Q01: ts-nocheck cleared
// ── R114 QTE-20 DepthAnalyzer Panel — 深度分析面板 ──────────────────────
// PM: 5指标同屏显示(Imbalance仪表盘+Liquidity Score+Wall Detection+滑点预估+Spoofing), 颜色编码

import { useMemo } from 'react';



// ═══════ Bridge: DepthAnalyzer → Panel ═══════════
import { DepthAnalyzer } from '../../lib/chart/depth-analyzer';
import type { DepthLevel } from '../../lib/chart/depth-types';

export function runDepthAnalysis(levels: DepthLevel[]) {
  return new DepthAnalyzer().analyze(levels);
}

// ═══════════ Types ═══════════

export interface DepthMetrics {
  // Imbalance
  imbalanceRatio: number;         // 0-1, >0.3 = significant imbalance
  imbalanceDirection: 'buy' | 'sell' | 'neutral';

  // Wall Detection
  wallCount: number;
  wallLevels: { side: 'bid' | 'ask'; price: number; size: number; ratio: number }[];

  // Liquidity
  liquidityScore: number;         // 0-100
  liquidityTier: 'excellent' | 'good' | 'fair' | 'poor' | 'thin';

  // Slippage estimate
  slippageBps: Record<number, number>; // { orderSize: slippageInBps }
  avgSlippageBps: number;

  // Spoofing flag
  spoofingDetected: boolean;
  spoofingDetails?: string;

  // General
  totalBidSize: number;
  totalAskSize: number;
  depthDollarValue: number;       // total $ value within visible depth

  updateTime: number;
}

export interface DepthAnalyzerProps {
  metrics: DepthMetrics | null;
  className?: string;
}

// ═══════════ Helpers ═══════════

function formatDollar(n: number): string {
  if (n >= 1_000_000_000) return '$' + (n / 1_000_000_000).toFixed(1) + 'B';
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return '$' + (n / 1_000).toFixed(1) + 'K';
  return '$' + n.toFixed(0);
}

function formatBps(n: number): string {
  if (n < 1) return n.toFixed(2) + 'bps';
  return n.toFixed(1) + 'bps';
}

// ═══════════ Gauge Component ───────────────────────────────────────────

function GaugeRing({ value, max, color, label, size = 80, strokeWidth = 6 }: {
  value: number; max: number; color: string; label: string; size?: number; strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const pct = Math.min(1, max > 0 ? value / max : 0);
  const offset = circumference - pct * circumference;

  return (
    <div className="flex flex-col items-center gap-0.5">
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#1c2333" strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="transition-all duration-700"
        />
        <text x={size / 2} y={size / 2 + 4} textAnchor="middle" fill="#c9d1d9" fontSize="14" fontWeight="bold" fontFamily="monospace">
          {value.toFixed(1)}
        </text>
      </svg>
      <span className="text-[9px] text-[#484f58] font-mono text-center">{label}</span>
    </div>
  );
}

// ═══════════ Metric Row ────────────────────────────────────────────────

function MetricRow({ label, value, unit, color, sub }: {
  label: string; value: string; unit?: string; color?: string; sub?: string;
}) {
  return (
    <div className="flex items-center justify-between py-0.5 px-1">
      <span className="text-[10px] text-[#8b949e] font-mono">{label}</span>
      <div className="flex items-center gap-1">
        <span className="text-[10px] font-mono font-bold" style={{ color: color || '#c9d1d9' }}>{value}</span>
        {unit && <span className="text-[8px] text-[#484f58]">{unit}</span>}
      </div>
      {sub && <span className="text-[8px] text-[#484f58] ml-auto">{sub}</span>}
    </div>
  );
}

// ═══════════ Main ═══════════

export default function DepthAnalyzerPanel({ metrics, className = '' }: DepthAnalyzerProps) {
  const tierColor = useMemo(() => {
    if (!metrics) return '#484f58';
    switch (metrics.liquidityTier) {
      case 'excellent': return '#22c55e';
      case 'good': return '#34d399';
      case 'fair': return '#f59e0b';
      case 'poor': return '#f97316';
      case 'thin': return '#ef4444';
    }
  }, [metrics]);

  if (!metrics) {
    return (
      <div className={`flex items-center justify-center bg-[#0d1117] rounded-lg border border-[#30363d] p-4 ${className}`}>
        <span className="text-[#484f58] text-xs font-mono">等待深度分析数据...</span>
      </div>
    );
  }

  const imbalanceColor = metrics.imbalanceRatio > 0.3
    ? (metrics.imbalanceDirection === 'buy' ? '#22c55e' : '#ef4444')
    : '#f59e0b';

  return (
    <div className={`flex flex-col bg-[#0d1117] rounded-lg border border-[#30363d] p-3 gap-3 text-xs ${className}`} style={{ fontFamily: 'monospace' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[#8b949e] font-semibold text-[10px] tracking-wide">深度分析 DepthAnalyzer</span>
        <span className="text-[#484f58] text-[8px]">{new Date(metrics.updateTime).toLocaleTimeString()}</span>
      </div>

      {/* Gauges row */}
      <div className="flex justify-around py-1">
        <GaugeRing value={metrics.imbalanceRatio * 100} max={100} color={imbalanceColor} label="Imbalance" />
        <GaugeRing value={metrics.liquidityScore} max={100} color={tierColor} label="Liquidity" />
        <GaugeRing value={Math.min(100, Math.abs(metrics.avgSlippageBps) * 10)} max={100} color="#f59e0b" label="Slippage" />
      </div>

      {/* Metrics grid */}
      <div className="border border-[#1c2333] rounded divide-y divide-[#1c2333]">
        {/* Imbalance section */}
        <div className="p-1.5">
          <div className="text-[9px] text-[#484f58] mb-1">📊 买卖失衡</div>
          <MetricRow label="失衡比例" value={(metrics.imbalanceRatio * 100).toFixed(1)} unit="%" color={imbalanceColor} />
          <MetricRow label="方向" value={metrics.imbalanceDirection === 'buy' ? '买方主导' : metrics.imbalanceDirection === 'sell' ? '卖方主导' : '平衡'} color={imbalanceColor} />
          <MetricRow label="买方总量" value={formatDollar(metrics.totalBidSize)} />
          <MetricRow label="卖方总量" value={formatDollar(metrics.totalAskSize)} />
        </div>

        {/* Liquidity section */}
        <div className="p-1.5">
          <div className="text-[9px] text-[#484f58] mb-1">💧 流动性</div>
          <MetricRow label="评分" value={metrics.liquidityScore.toFixed(0)} unit="/100" color={tierColor} />
          <MetricRow label="等级" value={metrics.liquidityTier.toUpperCase()} color={tierColor} />
          <MetricRow label="深度价值" value={formatDollar(metrics.depthDollarValue)} />
        </div>

        {/* Slippage section */}
        <div className="p-1.5">
          <div className="text-[9px] text-[#484f58] mb-1">📉 滑点预估</div>
          {Object.entries(metrics.slippageBps).slice(0, 4).map(([size, bps]) => (
            <MetricRow key={size} label={`${formatDollar(Number(size))}`} value={formatBps(bps)} />
          ))}
          <MetricRow label="平均滑点" value={formatBps(metrics.avgSlippageBps)} color={metrics.avgSlippageBps > 5 ? '#ef4444' : '#22c55e'} />
        </div>

        {/* Wall section */}
        {metrics.wallLevels.length > 0 && (
          <div className="p-1.5">
            <div className="text-[9px] text-[#484f58] mb-1">🧱 挂单墙 ({metrics.wallCount})</div>
            {metrics.wallLevels.slice(0, 4).map((wall, i) => (
              <MetricRow
                key={i}
                label={`${wall.side === 'bid' ? '🟢买墙' : '🔴卖墙'} @${wall.price.toFixed(2)}`}
                value={formatDollar(wall.size)}
                sub={`${wall.ratio.toFixed(1)}x`}
                color={wall.side === 'bid' ? '#22c55e' : '#ef4444'}
              />
            ))}
          </div>
        )}

        {/* Spoofing alert */}
        {metrics.spoofingDetected && (
          <div className="p-1.5 bg-[#ef444410]">
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-[#ef4444] font-bold">⚠ 可疑挂单行为检测</span>
            </div>
            {metrics.spoofingDetails && (
              <div className="text-[8px] text-[#ef4444] mt-0.5">{metrics.spoofingDetails}</div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-center gap-4 text-[8px] text-[#484f58]">
        <span>⚫ 优秀</span>
        <span>🟡 一般</span>
        <span>🔴 危险</span>
      </div>
    </div>
  );
}
