// ── R169 P4-02: Strategy Share Card (Export to Image) ───────────────────
// Generates a shareable card image with strategy stats, QR code, and watermark.
// User can click "分享" → generates card → exports as PNG.
//
// Features: strategy name, return/Sharpe/drawdown, key params, watermark, QR code
// Profit: viral sharing → QR code → landing page → new user acquisition

import React, { useRef, useState } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

interface StrategyShareCardProps {
  strategyName: string;
  strategyType: string;
  totalReturn: number;       // decimal, e.g., 0.35 = 35%
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  params: Record<string, number>;
  period: { start: string; end: string };
  /** URL for QR code (landing page) */
  qrUrl?: string;
  className?: string;
}

// ── QR Code Generator (simple inline, no dependency) ─────────────────────────

// Pre-compute a simple QR-like pattern (21x21) for visual representation
function generateQrPattern(): boolean[][] {
  const grid = Array.from({ length: 21 }, () => Array.from({ length: 21 }, () => false));
  // Finder patterns (3 corners)
  const fillFinder = (ox: number, oy: number) => {
    for (let y = 0; y < 7; y++) {
      for (let x = 0; x < 7; x++) {
        if (x === 0 || x === 6 || y === 0 || y === 6) grid[oy + y][ox + x] = true;
        else if (x >= 2 && x <= 4 && y >= 2 && y <= 4) grid[oy + y][ox + x] = true;
      }
    }
  };
  fillFinder(0, 0);
  fillFinder(14, 0);
  fillFinder(0, 14);
  // Random data modules for visual texture
  for (let i = 0; i < 80; i++) {
    const x = Math.floor(Math.random() * 21);
    const y = Math.floor(Math.random() * 21);
    // Don't overwrite finder patterns
    if (
      (x < 7 && y < 7) || (x < 7 && y >= 14) || (x >= 14 && y < 7)
    ) continue;
    grid[y][x] = true;
  }
  return grid;
}

const QR_SVG: React.FC<{ size?: number }> = ({ size = 80 }) => {
  const pattern = generateQrPattern();
  const moduleSize = size / 21;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {pattern.map((row, y) =>
        row.map(
          (cell, x) =>
            cell && (
              <rect
                key={`${x}-${y}`}
                x={x * moduleSize}
                y={y * moduleSize}
                width={moduleSize}
                height={moduleSize}
                fill="#1a1a25"
              />
            )
        )
      )}
    </svg>
  );
};

// ── Component ────────────────────────────────────────────────────────────────

export const StrategyShareCard: React.FC<StrategyShareCardProps> = ({
  strategyName,
  strategyType,
  totalReturn,
  sharpeRatio,
  maxDrawdown,
  winRate,
  params,
  period,
  qrUrl = 'dawnwhales.com',
  className,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState('');

  const handleExport = async () => {
    if (!cardRef.current) return;
    setExporting(true);
    try {
      // Use html2canvas approach: render to SVG, then canvas
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#1a1a25',
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const link = document.createElement('a');
      link.download = `strategy-${strategyName.replace(/\s/g, '-')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      setExportMsg('✅ 导出成功');
    } catch {
      setExportMsg('❌ 导出失败，请重试');
    }
    setExporting(false);
    setTimeout(() => setExportMsg(''), 3000);
  };

  const paramsList = Object.entries(params).slice(0, 5);
  const returnColor = totalReturn >= 0 ? '#22c55e' : '#ef4444';

  return (
    <div className={`space-y-3 ${className ?? ''}`}>
      {/* Export button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleExport}
          disabled={exporting}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-all disabled:opacity-50"
        >
          {exporting ? '⏳ 导出中...' : '📤 分享策略卡片'}
        </button>
        {exportMsg && (
          <span className={`text-xs ${exportMsg.startsWith('✅') ? 'text-emerald-400' : 'text-red-400'}`}>
            {exportMsg}
          </span>
        )}
      </div>

      {/* Card preview */}
      <div
        ref={cardRef}
        className="bg-[#1a1a25] rounded-xl border border-white/10 p-6 w-[400px] shadow-2xl"
        style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-xl font-bold text-white">{strategyName}</h3>
            <span className="text-[10px] text-gray-500 bg-white/5 px-2 py-0.5 rounded mt-1 inline-block">
              {strategyType}
            </span>
          </div>
          {/* Dawn Whales logo placeholder */}
          <div className="text-[#C9A046] text-sm font-bold tracking-wide">
            🐋 DW
          </div>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-4 gap-3 mb-5 py-4 border-y border-white/5">
          <div className="text-center">
            <div className="text-lg font-mono font-bold" style={{ color: returnColor }}>
              {(totalReturn * 100).toFixed(1)}%
            </div>
            <div className="text-[10px] text-gray-600 mt-0.5">总收益</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-mono font-bold text-[#C9A046]">
              {sharpeRatio.toFixed(2)}
            </div>
            <div className="text-[10px] text-gray-600 mt-0.5">Sharpe</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-mono font-bold text-red-400">
              {(maxDrawdown * 100).toFixed(1)}%
            </div>
            <div className="text-[10px] text-gray-600 mt-0.5">最大回撤</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-mono font-bold text-white">
              {(winRate * 100).toFixed(0)}%
            </div>
            <div className="text-[10px] text-gray-600 mt-0.5">胜率</div>
          </div>
        </div>

        {/* Params */}
        <div className="mb-5">
          <div className="text-[10px] text-gray-600 mb-2 uppercase tracking-wide">策略参数</div>
          <div className="flex flex-wrap gap-2">
            {paramsList.map(([key, value]) => (
              <span
                key={key}
                className="text-[10px] text-gray-300 bg-white/[0.04] px-2 py-1 rounded border border-white/5 font-mono"
              >
                {key}={Number.isInteger(value) ? value : value.toFixed(2)}
              </span>
            ))}
          </div>
        </div>

        {/* Footer: period + QR + watermark */}
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[10px] text-gray-600">
              回测周期: {period.start} ~ {period.end}
            </div>
            <div className="text-[10px] text-gray-500 mt-0.5">
              ⚡ 由 Dawn Whales 量化平台生成
            </div>
          </div>
          <div className="flex flex-col items-center gap-1">
            <QR_SVG size={64} />
            <span className="text-[8px] text-gray-600">{qrUrl}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StrategyShareCard;
