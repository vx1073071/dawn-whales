/**
* StrategyShareCard — ML R176 G2 [P0] 分享卡片+水印二维码
* PNG export + "Dawn Whales" watermark + QR code
*/

import { useState, useRef, useCallback } from 'react';

// ── Types ───────────────────────────────────────────────────────────────

interface StrategySummary {
  name: string;
  annualReturn: number;
  sharpe: number;
  maxDrawdown: number;
  winRate: number;
  factors: { nameZh: string; weight: number }[];
  period: string;
  benchmark: string;
}

interface StrategyShareCardProps {
  strategy: StrategySummary;
  qrData?: string; // URL encoded in QR
  className?: string;
}

// ── Helper ──────────────────────────────────────────────────────────────

function renderQRCode(canvas: HTMLCanvasElement, data: string) {
  // Simple QR generation matrix (mock visual for now; real impl uses qrcode.js)
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const size = canvas.width;
  const moduleSize = size / 25; // simple 25x25 grid
  ctx.fillStyle = '#0D0D14';
  ctx.fillRect(0, 0, size, size);

  // Generate deterministic pattern from data hash
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash + data.charCodeAt(i)) | 0;
  }
  const seed = Math.abs(hash);

  // Draw pseudo-QR pattern
  ctx.fillStyle = '#D4A853';
  for (let y = 0; y < 25; y++) {
    for (let x = 0; x < 25; x++) {
      // Corner finder patterns
      if ((x < 7 && y < 7) || (x > 17 && y < 7) || (x < 7 && y > 17)) {
        if ((x === 0 || x === 6 || y === 0 || y === 6) || (x >= 2 && x <= 4 && y >= 2 && y <= 4)) {
          ctx.fillRect(x * moduleSize, y * moduleSize, moduleSize, moduleSize);
        }
        continue;
      }
      // Pseudo-random data modules
      const pseudo = ((seed * (x * 25 + y)) & 0xffff) % 3;
      if (pseudo === 0) {
        ctx.fillRect(x * moduleSize, y * moduleSize, moduleSize, moduleSize);
      }
    }
  }
}

// ── Card Preview ────────────────────────────────────────────────────────

function ShareCardPreview({
  strategy,
  qrData,
  cardRef,
}: {
  strategy: StrategySummary;
  qrData?: string;
  cardRef: React.RefObject<HTMLDivElement | null>;
}) {
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  // Render QR on mount
  if (qrCanvasRef.current && qrData) {
    renderQRCode(qrCanvasRef.current, qrData);
  }

  return (
    <div
      ref={cardRef as React.Ref<HTMLDivElement>}
      className="bg-[#0D0D14] border border-white/10 rounded-xl overflow-hidden relative select-none"
      style={{ width: 400, minHeight: 500 }}
    >
      {/* Dawne Whales Watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03]">
        <span className="text-6xl font-black text-white rotate-[-20deg] tracking-widest whitespace-nowrap">
          DAWN WHALES
        </span>
      </div>

      {/* Header */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🐋</span>
          <div>
            <div className="text-xs text-gray-500">Dawn Whales · 策略分析</div>
            <div className="text-white font-bold text-sm">{strategy.name}</div>
          </div>
        </div>
        <span className="text-[10px] bg-[#D4A853]/20 text-[#D4A853] px-2 py-0.5 rounded">
          {strategy.period}
        </span>
      </div>

      {/* Performance */}
      <div className="grid grid-cols-4 gap-0 relative z-10">
        {[
          { label: '年化收益', value: `${strategy.annualReturn >= 0 ? '+' : ''}${strategy.annualReturn.toFixed(1)}%`, color: strategy.annualReturn >= 0 ? 'text-green-400' : 'text-red-400' },
          { label: 'Sharpe', value: strategy.sharpe.toFixed(2), color: 'text-white' },
          { label: '最大回撤', value: `${strategy.maxDrawdown.toFixed(1)}%`, color: 'text-red-400' },
          { label: '胜率', value: `${strategy.winRate.toFixed(0)}%`, color: 'text-white' },
        ].map(({ label, value, color }) => (
          <div key={label} className="p-3 text-center border-r border-b border-white/5 last:border-r-0">
            <div className="text-[9px] text-gray-500 mb-0.5">{label}</div>
            <div className={`text-sm font-bold ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Factors */}
      <div className="p-4 relative z-10">
        <div className="text-[10px] text-gray-500 mb-2">因子组成</div>
        <div className="space-y-1.5">
          {strategy.factors.map((f) => (
            <div key={f.nameZh} className="flex items-center gap-2">
              <span className="text-xs text-gray-300 flex-1">{f.nameZh}</span>
              <span className="text-[10px] text-gray-500 font-mono">{(f.weight * 100).toFixed(0)}%</span>
              <div className="w-20 bg-white/5 rounded-full h-1.5">
                <div
                  className="h-1.5 rounded-full bg-[#D4A853]"
                  style={{ width: `${Math.min(f.weight * 100, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Benchmark */}
      <div className="px-4 pb-2 relative z-10">
        <div className="text-[9px] text-gray-500">基准: {strategy.benchmark}</div>
      </div>

      {/* Footer with Logo + QR */}
      <div className="p-3 border-t border-white/5 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-1.5">
          <span className="text-lg">🐋</span>
          <span className="text-[10px] text-gray-500 font-bold tracking-wide">DAWN WHALES</span>
        </div>
        {qrData && (
          <div className="bg-white rounded p-0.5">
            <canvas ref={qrCanvasRef} width={64} height={64} className="w-16 h-16 rounded" />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────

export default function StrategyShareCard({
  strategy,
  qrData = 'https://dawnwhales.com',
  className = '',
}: StrategyShareCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(qrData).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // Fallback for older browsers
      const el = document.createElement('textarea');
      el.value = qrData;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [qrData]);

  const handleExportPNG = useCallback(async () => {
    // Use html2canvas-like approach with canvas API
    const img = new Image();
    img.src = 'data:image/svg+xml,' + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500">
        <rect width="400" height="500" fill="#0D0D14" rx="12"/>
        <text x="200" y="50" fill="#D4A853" font-size="14" text-anchor="middle" font-weight="bold">🐋 DAWN WHALES</text>
        <text x="200" y="260" fill="white" font-size="16" text-anchor="middle">${strategy.name}</text>
        <text x="200" y="300" fill="#9ca3af" font-size="12" text-anchor="middle">年化: ${strategy.annualReturn >= 0 ? '+' : ''}${strategy.annualReturn.toFixed(1)}% | Sharpe: ${strategy.sharpe.toFixed(2)}</text>
        <text x="200" y="480" fill="#6b7280" font-size="10" text-anchor="middle">Generated by Dawn Whales</text>
      </svg>`
    );
    
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 1000;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#0D0D14';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Trigger download
    const link = document.createElement('a');
    link.download = `dawn-whales-${strategy.name.replace(/\s/g, '-')}-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }, [strategy]);

  return (
    <div className={`flex flex-col items-center gap-4 ${className}`}>
      {/* Preview */}
      <ShareCardPreview
        strategy={strategy}
        qrData={qrData}
        cardRef={cardRef}
      />

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleExportPNG}
          className="px-4 py-2 rounded-lg bg-[#C9A046] hover:bg-[#D4A853] text-black font-semibold text-sm transition-colors"
        >
          📥 下载PNG
        </button>
        <button
          onClick={handleCopyLink}
          className="px-4 py-2 rounded-lg border border-white/10 text-gray-300 hover:text-white hover:border-white/20 text-sm transition-colors"
        >
          {copied ? '✓ 已复制' : '🔗 复制链接'}
        </button>
      </div>
    </div>
  );
}
