/**
 * GuestModeShell — ML-69-01 [P0]
 * R69: v1.7.0-beta — Guest mode UI for unregistered user acquisition
 *
 * Features:
 * - "免费体验" entry button → enter read-only browse mode
 * - Top banner: "注册解锁AI分析+交易" with register CTA
 * - Usage limit prompts: "今日免费回测还剩X次"
 * - Guest session: signal square browse (read-only), basic backtest (5/day), market data, download
 * - Upgrade nudges at key interaction points
 */

import { useState, useCallback } from 'react';

// ── Types ───────────────────────────────────────────────────────────────

export interface GuestQuota {
  backtestUsed: number;
  backtestLimit: number;
  aiAnalysisUsed: number;
  aiAnalysisLimit: number;
  signalViewsUsed: number;
}

export interface GuestModeShellProps {
  isGuest?: boolean;
  guestQuota?: GuestQuota;
  onUpgrade?: () => void;
  onRegister?: () => void;
  onEnterGuest?: () => void;
  onExitGuest?: () => void;
  children?: React.ReactNode;
  className?: string;
}

// ── Default Quota ───────────────────────────────────────────────────────

const DEFAULT_QUOTA: GuestQuota = {
  backtestUsed: 2,
  backtestLimit: 5,
  aiAnalysisUsed: 0,
  aiAnalysisLimit: 3,
  signalViewsUsed: 12,
};

// ── Guest Banner ────────────────────────────────────────────────────────

function GuestBanner({ onRegister, onUpgrade }: { onRegister?: () => void; onUpgrade?: () => void }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap',
      padding: '10px 20px', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', color: '#fff',
      fontSize: 13, fontWeight: 600,
    }}>
      <span>👋 你正在以访客身份浏览 · 注册解锁AI分析+交易+信号订阅</span>
      <button onClick={onRegister}
        style={{ padding: '6px 18px', fontSize: 12, fontWeight: 700, background: '#fff', color: '#3b82f6', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
        免费注册 → Register Free
      </button>
      <button onClick={onUpgrade}
        style={{ padding: '6px 18px', fontSize: 12, fontWeight: 600, background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, cursor: 'pointer' }}>
        了解更多 Learn More
      </button>
    </div>
  );
}

// ── Quota Indicator ──────────────────────────────────────────────────────

function QuotaBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = Math.min(100, (used / limit) * 100);
  const isLow = limit - used <= 2;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: '#94a3b8' }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: isLow ? '#fbbf24' : '#94a3b8' }}>
          {used}/{limit}
        </span>
      </div>
      <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 2, width: `${pct}%`,
          background: isLow ? '#fbbf24' : '#3b82f6',
          transition: 'width 0.3s ease',
        }} />
      </div>
    </div>
  );
}

// ── Upgrade Nudge ────────────────────────────────────────────────────────

function UpgradeNudge({ feature, onUpgrade }: { feature: string; onUpgrade?: () => void }) {
  return (
    <div style={{
      padding: '12px 16px', background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)',
      borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#60a5fa' }}>🔒 {feature}</div>
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>注册后解锁全部功能 · Unlock after registration</div>
      </div>
      <button onClick={onUpgrade}
        style={{ padding: '6px 16px', fontSize: 12, fontWeight: 700, background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', whiteSpace: 'nowrap' }}>
        注册解锁 →
      </button>
    </div>
  );
}

// ── Guest Entry Screen ──────────────────────────────────────────────────

function GuestEntryScreen({ onEnter, onRegister }: { onEnter?: () => void; onRegister?: () => void }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: '#0D0D14', color: '#fff', padding: 40,
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
    }}>
      <span style={{ fontSize: 64, marginBottom: 16 }}>🐋</span>
      <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 8 }}>DAWN WHALES</h1>
      <p style={{ fontSize: 15, color: '#94a3b8', marginBottom: 32, textAlign: 'center', maxWidth: 480 }}>
        AI量化交易平台 · 4 Agent协作 · 港股美股A股
        <br /><span style={{ fontSize: 12, color: '#64748b' }}>AI-Powered Quantitative Trading · 3 Markets</span>
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 340 }}>
        <button onClick={onRegister}
          style={{
            padding: '14px 0', fontSize: 15, fontWeight: 700, background: '#3b82f6', color: '#fff',
            border: 'none', borderRadius: 12, cursor: 'pointer',
          }}>
          🚀 免费注册 · Register Free
        </button>
        <button onClick={onEnter}
          style={{
            padding: '14px 0', fontSize: 15, fontWeight: 600, background: 'rgba(255,255,255,0.05)',
            color: '#cbd5e1', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, cursor: 'pointer',
          }}>
          👀 免费体验 · Try Without Account
        </button>
      </div>

      <div style={{ marginTop: 32, fontSize: 12, color: '#64748b', textAlign: 'center' }}>
        访客模式可浏览信号广场+基础回测(5次/天)+行情+下载
        <br />Guest mode: browse signals, basic backtest (5/day), market data, download
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────

export default function GuestModeShell({
  isGuest = false,
  guestQuota = DEFAULT_QUOTA,
  onUpgrade,
  onRegister,
  onEnterGuest,
  onExitGuest: _onExitGuest,
  children,
  className = '',
}: GuestModeShellProps) {
  const [showEntry, setShowEntry] = useState(true);

  const handleEnterGuest = useCallback(() => {
    setShowEntry(false);
    onEnterGuest?.();
  }, [onEnterGuest]);

  const handleRegister = useCallback(() => {
    setShowEntry(false);
    onRegister?.();
  }, [onRegister]);

  // ── Entry screen (not yet in guest mode, no auth) ────────────────────
  if (showEntry && !isGuest) {
    return <GuestEntryScreen onEnter={handleEnterGuest} onRegister={handleRegister} />;
  }

  // ── Guest mode active ─────────────────────────────────────────────────
  return (
    <div className={`guest-mode-shell ${className}`} style={{ minHeight: '100vh', background: '#0D0D14' }}>
      {/* Top banner */}
      {isGuest && <GuestBanner onRegister={onRegister} onUpgrade={onUpgrade} />}

      {/* Main content */}
      <div style={{ flex: 1 }}>
        {children}
      </div>

      {/* Bottom quota bar (guest only) */}
      {isGuest && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: 'rgba(13,13,20,0.95)', backdropFilter: 'blur(8px)',
          borderTop: '1px solid rgba(255,255,255,0.06)', padding: '12px 20px',
          zIndex: 40,
        }}>
          <div style={{ maxWidth: 600, margin: '0 auto' }}>
            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <QuotaBar label="🔬 基础回测 Basic Backtest" used={guestQuota.backtestUsed} limit={guestQuota.backtestLimit} />
              </div>
              <div style={{ flex: 1 }}>
                <QuotaBar label="🤖 AI分析 AI Analysis" used={guestQuota.aiAnalysisUsed} limit={guestQuota.aiAnalysisLimit} />
              </div>
              <div style={{ fontSize: 11, color: '#64748b', alignSelf: 'center', whiteSpace: 'nowrap' }}>
                📡 已浏览 {guestQuota.signalViewsUsed} 信号
              </div>
            </div>
            {guestQuota.backtestUsed >= guestQuota.backtestLimit && (
              <div style={{ marginTop: 8, textAlign: 'center' }}>
                <span style={{ fontSize: 11, color: '#fbbf24' }}>⚠️ 今日免费回测已用完 </span>
                <button onClick={onUpgrade}
                  style={{ fontSize: 11, fontWeight: 700, background: 'none', color: '#3b82f6', border: 'none', cursor: 'pointer', marginLeft: 8 }}>
                  注册解锁无限 Backtest →
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export { GuestBanner, QuotaBar, UpgradeNudge, GuestEntryScreen };
