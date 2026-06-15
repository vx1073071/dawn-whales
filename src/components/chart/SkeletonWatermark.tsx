// ── R224 ML#2 (G3+G4): 加载骨架屏 + 截图水印 ──────────────────────────
// G3: Skeleton loader for K-line/chart/table loading states
// G4: html2canvas watermark on screenshot export (brand+timestamp)
// 9语言i18n

import { useState, useCallback } from 'react';
import { message } from 'antd';
import { CameraOutlined } from '@ant-design/icons';
import html2canvas from 'html2canvas';
import i18n from '../../i18n';

const I18N = (k: string) => i18n.t(`skeletonWatermark.${k}`);

// ═══════════════════════════════════════════════════════════════════════
// G3: 加载骨架屏组件
// ═══════════════════════════════════════════════════════════════════════

export function KLineSkeleton({ height = 400 }: { height?: number }) {
  return (
    <div style={{ width: '100%', height, background: '#1a1a25', borderRadius: 8, padding: 16, overflow: 'hidden' }}>
      {/* Header pulse */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <div style={{ width: 60, height: 12, background: '#2a2d3e', borderRadius: 4, animation: 'pulse 1.5s infinite' }} />
        <div style={{ width: 80, height: 12, background: '#2a2d3e', borderRadius: 4, animation: 'pulse 1.5s infinite 0.1s' }} />
        <div style={{ width: 40, height: 12, background: '#2a2d3e', borderRadius: 4, animation: 'pulse 1.5s infinite 0.2s' }} />
      </div>
      {/* Candlestick-like bars */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: height - 80 }}>
        {Array.from({ length: 50 }, (_, i) => {
          const h = 40 + Math.sin(i * 0.5) * 30 + Math.random() * 80;
          const color = i % 3 === 0 ? '#374151' : '#1f2937';
          return (
            <div key={i} style={{ flex: 1, height: `${h}%`, background: color, borderRadius: 2, animation: `pulse 1.5s infinite ${i * 0.02}s` }} />
          );
        })}
      </div>
      {/* Price axis skeleton */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} style={{ width: 40, height: 10, background: '#2a2d3e', borderRadius: 4 }} />
        ))}
      </div>
      <style>{'@keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }'}</style>
    </div>
  );
}

/** Table skeleton */
export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div style={{ padding: 8 }}>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} style={{ display: 'flex', gap: 8, padding: '10px 0', borderBottom: '1px solid #1f2937', animation: `pulse 1.5s infinite ${r * 0.1}s` }}>
          {Array.from({ length: cols }, (_, c) => (
            <div key={c} style={{
              flex: c === 0 ? 2 : 1, height: 14,
              background: '#2a2d3e', borderRadius: 4,
            }} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Card skeleton */
export function CardSkeleton() {
  return (
    <div style={{ background: '#1a1a25', border: '1px solid #2a2d3e', borderRadius: 8, padding: 16, animation: 'pulse 1.5s infinite' }}>
      <div style={{ width: 120, height: 14, background: '#374151', borderRadius: 4, marginBottom: 8 }} />
      <div style={{ width: '60%', height: 28, background: '#2a2d3e', borderRadius: 6, marginBottom: 12 }} />
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ width: 80, height: 10, background: '#2a2d3e', borderRadius: 4 }} />
        <div style={{ width: 100, height: 10, background: '#2a2d3e', borderRadius: 4 }} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// G4: 截图水印
// ═══════════════════════════════════════════════════════════════════════

export function useScreenshotWatermark(ref: React.RefObject<HTMLElement>) {
  const [capturing, setCapturing] = useState(false);

  const capture = useCallback(async (options?: { filename?: string; quality?: number }) => {
    if (!ref.current) return;
    setCapturing(true);
    try {
      const canvas = await html2canvas(ref.current, {
        backgroundColor: '#0a0a14',
        scale: options?.quality ?? 2,
        useCORS: true,
        logging: false,
      });

      // Add watermark
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.save();
        const fontSize = Math.max(10, canvas.width * 0.02);
        ctx.font = `${fontSize}px monospace`;
        ctx.fillStyle = 'rgba(156, 163, 175, 0.3)';
        ctx.textAlign = 'right';
        const ts = new Date().toISOString().slice(0, 10);
        ctx.fillText(`TradingEasy · ${I18N('screenshot')} · ${ts}`, canvas.width - fontSize, canvas.height - fontSize);
        ctx.fillStyle = 'rgba(156, 163, 175, 0.15)';
        ctx.textAlign = 'left';
        ctx.font = `${fontSize * 0.7}px monospace`;
        ctx.fillText('dawnwhales.com', fontSize, fontSize);

        // Diagonal watermark
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(-25 * Math.PI / 180);
        ctx.font = `bold ${fontSize * 2}px -apple-system, sans-serif`;
        ctx.fillStyle = 'rgba(212, 168, 83, 0.04)';
        ctx.textAlign = 'center';
        ctx.fillText('TRADINGEASY', 0, 0);
        ctx.restore();
        ctx.restore();
      }

      // Download
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = options?.filename || `tradingeasy-chart-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
      message.success(I18N('screenshotSaved'));
    } catch (e: unknown) {
      message.error(`${I18N('screenshotFailed')}: ${(e as Error).message}`);
    } finally {
      setCapturing(false);
    }
  }, [ref]);

  return { capture, capturing };
}

/** Screenshot button */
export function ScreenshotButton({ onClick, loading }: { onClick: () => void; loading?: boolean }) {
  return (
    <span
      onClick={onClick}
      style={{
        cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
        color: loading ? '#6b7280' : '#60a5fa', fontSize: 12, padding: '4px 8px',
        borderRadius: 4, border: '1px solid #2a2d3e',
        background: loading ? '#1a1a25' : '#1a1d2e',
      }}
    >
      <CameraOutlined spin={loading} />
      <span>{loading ? I18N('capturing') : I18N('screenshot')}</span>
    </span>
  );
}
