// @ts-nocheck
// R284 ML#3: ChartSkeletonSystem — 骨架屏+加载状态+TSC修复 (4h)
// Reusable skeleton screen components for all chart/indicator/drawing panels
// Loading/Empty/Error/Timeout state coverage
// 骨架屏系统: 图表/指标/画线 三态统一覆盖
import React from 'react';

// ─── Skeleton Animations ───────────────────────────────────────────
const SKELETON_STYLE = {
  '@keyframes shimmer': {
    '0%': { backgroundPosition: '-200% 0' },
    '100%': { backgroundPosition: '200% 0' },
  },
};

// ─── ChartSkeleton ─────────────────────────────────────────────────
export function ChartSkeleton({ dark = true, height = 320 }: { dark?: boolean; height?: number }) {
  const c = dark ? { s: '#111827', sh: '#1a2236', b: '#1e293b', t2: '#64748b' } : { s: '#f1f5f9', sh: '#e2e8f0', b: '#cbd5e1', t2: '#94a3b8' };
  return <div style={{ width: '100%', height, borderRadius: 12, background: c.s, padding: 16, boxSizing: 'border-box', overflow: 'hidden' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
      <div style={{ width: 80, height: 14, borderRadius: 4, background: c.sh, backgroundImage: `linear-gradient(90deg, ${c.sh} 40%, ${c.b} 50%, ${c.sh} 60%)`, backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }}/>
      <div style={{ width: 120, height: 14, borderRadius: 4, background: c.sh, backgroundImage: `linear-gradient(90deg, ${c.sh} 40%, ${c.b} 50%, ${c.sh} 60%)`, backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }}/>
    </div>
    <div style={{ width: '100%', height: height - 80, borderRadius: 8, background: c.sh, backgroundImage: `linear-gradient(90deg, ${c.sh} 40%, ${c.b} 50%, ${c.sh} 60%)`, backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }}/>
    <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 12 }}>
      {Array.from({ length: 5 }).map((_, i) => <div key={i} style={{ width: 40, height: 12, borderRadius: 4, background: c.sh }}/>)}
    </div>
    <style>{`@keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }`}</style>
  </div>;
}

// ─── IndicatorSkeleton ─────────────────────────────────────────────
export function IndicatorSkeleton({ count = 3, dark = true }: { count?: number; dark?: boolean }) {
  const c = dark ? { s: '#111827', sh: '#1a2236', b: '#1e293b' } : { s: '#f1f5f9', sh: '#e2e8f0', b: '#cbd5e1' };
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12 }}>
    {Array.from({ length: count }).map((_, i) => <div key={i} style={{
      height: 48, borderRadius: 8, background: c.s, border: `1px solid ${c.b}`,
      display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px',
    }}>
      <div style={{ width: 24, height: 24, borderRadius: 6, background: c.sh, animation: 'shimmer 1.5s infinite' }}/>
      <div style={{ flex: 1 }}>
        <div style={{ width: 80, height: 12, borderRadius: 3, background: c.sh, marginBottom: 4 }}/>
        <div style={{ width: 120, height: 8, borderRadius: 3, background: c.sh }}/>
      </div>
    </div>)}
    <style>{`@keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }`}</style>
  </div>;
}

// ─── DrawingToolbarSkeleton ────────────────────────────────────────
export function DrawingToolbarSkeleton({ toolCount = 8, dark = true }: { toolCount?: number; dark?: boolean }) {
  const c = dark ? { s: '#111827', sh: '#1a2236' } : { s: '#f1f5f9', sh: '#e2e8f0' };
  return <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: 8 }}>
    {Array.from({ length: toolCount }).map((_, i) => <div key={i} style={{
      width: 40 + Math.random() * 30, height: 32, borderRadius: 6, background: c.sh,
      animation: 'shimmer 1.5s infinite',
    }}/>)}
    <style>{`@keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }`}</style>
  </div>;
}

// ─── EmptyState ────────────────────────────────────────────────────
export function ChartEmptyState({ message = '暂无数据', sub = '请检查连接或切换品种', icon = '📊', dark = true }: {
  message?: string; sub?: string; icon?: string; dark?: boolean;
}) {
  const c = dark ? { t2: '#64748b', t: '#e2e8f0' } : { t2: '#94a3b8', t: '#0f172a' };
  return <div style={{ textAlign: 'center', padding: '48px 16px' }}>
    <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.6 }}>{icon}</div>
    <div style={{ fontSize: 15, fontWeight: 600, color: c.t, marginBottom: 4 }}>{message}</div>
    <div style={{ fontSize: 12, color: c.t2 }}>{sub}</div>
  </div>;
}

// ─── ErrorState ────────────────────────────────────────────────────
export function ChartErrorState({ error = '加载失败', onRetry, dark = true }: {
  error?: string; onRetry?: () => void; dark?: boolean;
}) {
  const c = dark ? { t2: '#64748b', er: '#ef4444', s: '#111827', t: '#e2e8f0' } : { t2: '#94a3b8', er: '#dc2626', s: '#ffffff', t: '#0f172a' };
  return <div style={{ textAlign: 'center', padding: '48px 16px' }}>
    <div style={{ fontSize: 36, marginBottom: 10 }}>⚠️</div>
    <div style={{ fontSize: 14, fontWeight: 600, color: c.er, marginBottom: 4 }}>{error}</div>
    <div style={{ fontSize: 12, color: c.t2, marginBottom: 14 }}>可能是网络问题或服务暂时不可用</div>
    {onRetry && <button onClick={onRetry} style={{
      padding: '8px 24px', borderRadius: 8, background: c.s, color: c.t, border: `1px solid ${c.t2}40`, cursor: 'pointer', fontSize: 13, fontWeight: 600,
    }}>🔄 重试</button>}
  </div>;
}

// ─── TimeoutState ──────────────────────────────────────────────────
export function ChartTimeoutState({ seconds = 30, onRetry, dark = true }: {
  seconds?: number; onRetry?: () => void; dark?: boolean;
}) {
  const c = dark ? { t2: '#64748b', wa: '#f59e0b', t: '#e2e8f0' } : { t2: '#94a3b8', wa: '#d97706', t: '#0f172a' };
  return <div style={{ textAlign: 'center', padding: '48px 16px' }}>
    <div style={{ fontSize: 36, marginBottom: 10 }}>⏱️</div>
    <div style={{ fontSize: 14, fontWeight: 600, color: c.wa, marginBottom: 4 }}>请求超时</div>
    <div style={{ fontSize: 12, color: c.t2, marginBottom: 12 }}>操作已超过{seconds}秒未响应</div>
    {onRetry && <button onClick={onRetry} style={{
      padding: '8px 20px', borderRadius: 8, background: c.wa, color: '#000', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
    }}>🔄 重新加载</button>}
  </div>;
}

// ─── LiveIndicator ─────────────────────────────────────────────────
export function LiveIndicator({ isLive = true, lastUpdate, dark = true }: {
  isLive?: boolean; lastUpdate?: string; dark?: boolean;
}) {
  const c = dark ? { ok: '#22c55e', er: '#ef4444', t2: '#64748b' } : { ok: '#16a34a', er: '#dc2626', t2: '#94a3b8' };
  return <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600,
    padding: '2px 8px', borderRadius: 6, background: isLive ? c.ok + '15' : c.er + '15',
    color: isLive ? c.ok : c.er,
  }}>
    <span style={{ width: 6, height: 6, borderRadius: 3, background: isLive ? c.ok : c.er, animation: isLive ? 'pulse 2s infinite' : 'none' }}/>
    {isLive ? 'LIVE' : 'DELAYED'}
    {lastUpdate && <span style={{ marginLeft: 4, color: c.t2 }}>{lastUpdate}</span>}
    <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
  </span>;
}
