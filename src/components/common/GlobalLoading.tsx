/**
 * GlobalLoading — Full-page / section loading states with skeleton screens.
 * Supports overlay, inline, and skeleton modes.
 */
import { type CSSProperties } from 'react';

export interface GlobalLoadingProps {
  /** Loading mode: overlay covers the whole screen, inline is within a container, skeleton shows placeholder blocks */
  mode?: 'overlay' | 'inline' | 'skeleton';
  /** Text to display below the spinner */
  text?: string;
  /** Number of skeleton rows (skeleton mode only, default 5) */
  skeletonRows?: number;
  /** Spinner size in px (default 40) */
  size?: number;
  /** Custom overlay background (default dark translucent) */
  overlayBg?: string;
  /** Additional CSS class */
  className?: string;
}

const spinnerKeyframes = `
@keyframes dw-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
@keyframes dw-pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.8; }
}
`;

function Spinner({ size = 40, color = '#6366F1' }: { size?: number; color?: string }) {
  return (
    <>
      <style>{spinnerKeyframes}</style>
      <svg width={size} height={size} viewBox="0 0 40 40" style={{ animation: 'dw-spin 1s linear infinite' }}>
        <circle cx="20" cy="20" r="16" fill="none" stroke={color} strokeWidth="3" strokeDasharray="80 20" strokeLinecap="round" opacity="0.3" />
        <circle cx="20" cy="20" r="16" fill="none" stroke={color} strokeWidth="3" strokeDasharray="25 75" strokeLinecap="round" />
      </svg>
    </>
  );
}

function SkeletonRow({ delay = 0 }: { delay?: number }) {
  const baseStyle: CSSProperties = {
    height: 16,
    borderRadius: 6,
    background: 'linear-gradient(90deg, #1F2937 25%, #374151 50%, #1F2937 75%)',
    backgroundSize: '200% 100%',
    animation: `dw-pulse 1.5s ease-in-out ${delay}ms infinite`,
  };
  return (
    <div style={{ display: 'flex', gap: 12, padding: '8px 0' }}>
      <div style={{ ...baseStyle, width: '40%', opacity: 0.7 }} />
      <div style={{ ...baseStyle, width: '30%', opacity: 0.5 }} />
      <div style={{ ...baseStyle, width: '20%', opacity: 0.4 }} />
    </div>
  );
}

export default function GlobalLoading({
  mode = 'inline',
  text,
  skeletonRows = 5,
  size = 40,
  overlayBg = 'rgba(0, 0, 0, 0.6)',
  className = '',
}: GlobalLoadingProps) {
  if (mode === 'skeleton') {
    return (
      <div className={className} style={{ padding: '16px 20px' }}>
        <style>{spinnerKeyframes}</style>
        {Array.from({ length: skeletonRows }, (_, i) => (
          <SkeletonRow key={i} delay={i * 100} />
        ))}
      </div>
    );
  }

  const content = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
      <Spinner size={size} />
      {text && <span style={{ fontSize: 14, color: '#9CA3AF', fontWeight: 500 }}>{text}</span>}
    </div>
  );

  if (mode === 'overlay') {
    return (
      <div className={className} style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: overlayBg, backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {content}
      </div>
    );
  }

  // inline
  return (
    <div className={className} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: 200, padding: 24,
    }}>
      {content}
    </div>
  );
}
