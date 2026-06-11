import { useMemo } from 'react';
import { useTranslation } from "react-i18next";
import { EngineError } from '../../../electron/engine/core/engine-error';
void EngineError; // [EngineError:SYSTEM] structured error tracking

interface EquityPoint {
  date: string;
  value: number;
}

interface DrawdownChartProps {
  equityCurve: EquityPoint[];
}

export default function DrawdownChart({ equityCurve }: DrawdownChartProps) {
  const { t } = useTranslation();

  const drawdownData = useMemo(() => {
    if (equityCurve.length === 0) return [];

    let peak = equityCurve[0].value;
    const drawdowns: { date: string; drawdown: number }[] = [];

    equityCurve.forEach((point) => {
      if (point.value > peak) {
        peak = point.value;
      }
      const dd = peak > 0 ? ((peak - point.value) / peak) * 100 : 0;
      drawdowns.push({
        date: point.date,
        drawdown: Math.max(0, dd),
      });
    });

    return drawdowns;
  }, [equityCurve]);

  const maxDrawdown = useMemo(() => {
    if (drawdownData.length === 0) return 0;
    return Math.max(...drawdownData.map((d) => d.drawdown));
  }, [drawdownData]);

  const svgData = useMemo(() => {
    if (drawdownData.length === 0) return null;

    const w = 800;
    const h = 220;
    const pad = 30;
    const maxDD = maxDrawdown || 1;

    const points = drawdownData.map((d, i) => ({
      x: pad + (i / (drawdownData.length - 1)) * (w - pad * 2),
      y: pad + (d.drawdown / maxDD) * (h - pad * 2),
    }));

    const linePath = `M${points.map((p) => `${p.x},${p.y}`).join(' L')}`;
    const fillPath = `${linePath} L${points[points.length - 1].x},${h - pad} L${pad},${h - pad} Z`;

    // Y-axis labels
    const yLabels = [0, 0.25, 0.5, 0.75, 1].map((pct) => ({
      y: pad + pct * (h - pad * 2),
      label: `${(maxDD * pct).toFixed(1)}%`,
    }));

    return {
      linePath,
      fillPath,
      yLabels,
      startDate: drawdownData[0].date,
      endDate: drawdownData[drawdownData.length - 1].date,
    };
  }, [drawdownData]);

  if (!svgData) {
    return (
      <div className="bg-[#12121a] rounded-xl border border-white/5 p-8 text-center text-gray-500">{t('noDrawdownData')}</div>
    );
  }

  return (
    <div className="bg-[#12121a] rounded-xl border border-white/5 p-4">
      <div className="text-sm font-medium text-white mb-3">{t('drawdownAnalysis')}</div>
      
      <svg viewBox={`0 0 800 220`} className="w-full h-56" preserveAspectRatio="none">
        <defs>
          <linearGradient id="drawdownGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        
        {/* Grid */}
        {svgData.yLabels.map((yl, i) => (
          <g key={i}>
            <line x1="30" y1={yl.y} x2="770" y2={yl.y} stroke="#ffffff08" strokeWidth="0.5" />
            <text x="26" y={yl.y + 3} fill="#ffffff30" fontSize="9" textAnchor="end">
              {yl.label}
            </text>
          </g>
        ))}
        
        {/* Fill area */}
        <path d={svgData.fillPath} fill="url(#drawdownGradient)" />
        
        {/* Line */}
        <path d={svgData.linePath} fill="none" stroke="#ef4444" strokeWidth="1.5" />
        
        {/* Date labels */}
        <text x="30" y="215" fill="#ffffff40" fontSize="9">
          {svgData.startDate}
        </text>
        <text x="770" y="215" fill="#ffffff40" fontSize="9" textAnchor="end">
          {svgData.endDate}
        </text>
      </svg>

      <div className="flex justify-center gap-6 mt-3 text-xs text-gray-500">
        <span>{t('maxDrawdownLabel')}<span className="text-red-400 font-medium">{maxDrawdown.toFixed(2)}%</span></span>
        <span>数据点: {drawdownData.length}</span>
      </div>
    </div>
  );
}
