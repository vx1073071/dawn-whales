// R126-Q01: nocheck cleared — cleared
/**
 * TraderProfilePage — ML-53-01 [P0]
 * R53: v1.1.0-beta Social Trading — Trader Profile + Dashboard
 *
 * Features:
 * - Avatar / Bio / Stats / Performance chart
 * - Follower count + follow button
 * - Strategy list (published strategies)
 * - Trade history timeline
 * - Rating + review summary
 * - Responsive layout
 */

import React, { useState, useCallback, useMemo } from 'react';

// ── Types ───────────────────────────────────────────────────────────────

export interface TraderProfile {
  id: string;
  name: string;
  avatar: string;
  bio: string;
  joinDate: string;
  totalReturn: number;         // %
  annualizedReturn: number;    // %
  sharpeRatio: number;
  maxDrawdown: number;         // %
  winRate: number;             // %
  totalTrades: number;
  avgHoldingDays: number;
  followers: number;
  following: number;
  verified: boolean;
  rank: number;
  badges: string[];
  preferredMarket: string;
  preferredTimeframe: string;
  strategies: TraderStrategy[];
  recentSignals: TradeSignal[];
}

export interface TraderStrategy {
  id: string;
  name: string;
  description: string;
  category: string;
  annualReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  subscribers: number;
  price: number;
  priceCurrency: string;
}

export interface TradeSignal {
  id: string;
  symbol: string;
  direction: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;          // 0-1
  price: number;
  timestamp: string;
  result: string;
  pnl: number;
}

export interface TraderProfilePageProps {
  profile: TraderProfile;
  currentUserId?: string;
  isFollowing?: boolean;
  onFollow?: (traderId: string) => void;
  onUnfollow?: (traderId: string) => void;
  onStrategyClick?: (strategyId: string) => void;
  onSignalClick?: (signalId: string) => void;
  className?: string;
}

// ── Mock data helpers ───────────────────────────────────────────────────

const mockTrader: TraderProfile = {
  id: 'trader-001',
  name: 'AlphaSeeker',
  avatar: '',
  bio: 'Quantitative trader specializing in momentum strategies across US equities. 12 years experience. Focus on risk-adjusted returns with systematic approach.',
  joinDate: '2024-03-15',
  totalReturn: 187.5,
  annualizedReturn: 42.3,
  sharpeRatio: 2.15,
  maxDrawdown: -18.7,
  winRate: 61.2,
  totalTrades: 847,
  avgHoldingDays: 14,
  followers: 2341,
  following: 12,
  verified: true,
  rank: 3,
  badges: ['Top Performer', 'Verified', '3-Month Streak'],
  preferredMarket: 'US',
  preferredTimeframe: 'Daily',
  strategies: [
    { id: 's-001', name: 'Momentum Swing', description: 'Mid-cap momentum strategy with mean-reversion exit', category: 'Momentum', annualReturn: 52.1, sharpeRatio: 2.8, maxDrawdown: -15.2, subscribers: 892, price: 29.99, priceCurrency: 'USD' },
    { id: 's-002', name: 'Earnings Surprise', description: 'Post-earnings drift capture with volume confirmation', category: 'Event', annualReturn: 38.7, sharpeRatio: 2.1, maxDrawdown: -22.3, subscribers: 567, price: 19.99, priceCurrency: 'USD' },
    { id: 's-003', name: 'Sector Rotation Pro', description: 'Top-down sector rotation using relative strength', category: 'Macro', annualReturn: 31.5, sharpeRatio: 1.9, maxDrawdown: -12.8, subscribers: 1203, price: 0, priceCurrency: 'USD' },
  ],
  recentSignals: [
    { id: 'sig-01', symbol: 'AAPL', direction: 'BUY', confidence: 0.85, price: 195.20, timestamp: '2026-06-07T14:30:00Z', result: 'Open', pnl: 0 },
    { id: 'sig-02', symbol: 'NVDA', direction: 'BUY', confidence: 0.92, price: 142.80, timestamp: '2026-06-07T09:45:00Z', result: 'Open', pnl: 0 },
    { id: 'sig-03', symbol: 'MSFT', direction: 'SELL', confidence: 0.78, price: 448.50, timestamp: '2026-06-06T15:20:00Z', result: 'Win', pnl: 2450 },
    { id: 'sig-04', symbol: 'GOOGL', direction: 'HOLD', confidence: 0.65, price: 185.30, timestamp: '2026-06-06T10:00:00Z', result: 'Win', pnl: 1200 },
  ],
};

// ── Sub-components ──────────────────────────────────────────────────────

const StatCard: React.FC<{ label: string; value: string; trend?: 'up' | 'down'; subtitle?: string }> = ({ label, value, trend, subtitle }) => (
  <div className="trader-stat-card">
    <div className="trader-stat-label">{label}</div>
    <div className={`trader-stat-value ${trend === 'up' ? 'text-green' : trend === 'down' ? 'text-red' : ''}`}>{value}</div>
    {subtitle && <div className="trader-stat-subtitle">{subtitle}</div>}
  </div>
);

const SignalBadge: React.FC<{ direction: 'BUY' | 'SELL' | 'HOLD'; confidence: number }> = ({ direction, confidence }) => {
  const colorMap = { BUY: '#22c55e', SELL: '#ef4444', HOLD: '#f59e0b' };
  return (
    <span className="signal-badge" style={{ backgroundColor: colorMap[direction] + '20', color: colorMap[direction], borderColor: colorMap[direction] + '40' }}>
      {direction} {Math.round(confidence * 100)}%
    </span>
  );
};

const StrategyRow: React.FC<{ strategy: TraderStrategy; onClick?: (id: string) => void }> = ({ strategy, onClick }) => (
  <div className="trader-strategy-row" onClick={() => onClick?.(strategy.id)}>
    <div className="trader-strategy-info">
      <div className="trader-strategy-name">{strategy.name}</div>
      <div className="trader-strategy-desc">{strategy.description}</div>
      <div className="trader-strategy-meta">
        <span className="trader-strategy-category">{strategy.category}</span>
        <span className="trader-strategy-subscribers">{strategy.subscribers} subscribers</span>
      </div>
    </div>
    <div className="trader-strategy-stats">
      <div className="trader-strategy-return">
        <span className={`${strategy.annualReturn > 0 ? 'text-green' : 'text-red'}`}>{strategy.annualReturn > 0 ? '+' : ''}{strategy.annualReturn}%</span>
        <span className="trader-stat-subtitle">Annual</span>
      </div>
      <div className="trader-strategy-sharpe">
        <span>{strategy.sharpeRatio.toFixed(2)}</span>
        <span className="trader-stat-subtitle">Sharpe</span>
      </div>
      <div className="trader-strategy-drawdown">
        <span className="text-red">{strategy.maxDrawdown}%</span>
        <span className="trader-stat-subtitle">Max DD</span>
      </div>
      <div className="trader-strategy-price">
        {strategy.price === 0 ? <span className="trader-free-badge">Free</span> : <span>${strategy.price}/mo</span>}
      </div>
    </div>
  </div>
);

// ── Main Component ──────────────────────────────────────────────────────

const TraderProfilePage: React.FC<TraderProfilePageProps> = ({
  profile = mockTrader,
  isFollowing: initialFollow = false,
  onFollow,
  onUnfollow,
  onStrategyClick,
  onSignalClick,
  className = '',
}) => {
  const [isFollowing, setIsFollowing] = useState(initialFollow);
  const [activeTab, setActiveTab] = useState<'strategies' | 'signals' | 'performance'>('strategies');

  const handleFollow = useCallback(() => {
    setIsFollowing(true);
    onFollow?.(profile.id);
  }, [profile.id, onFollow]);

  const handleUnfollow = useCallback(() => {
    setIsFollowing(false);
    onUnfollow?.(profile.id);
  }, [profile.id, onUnfollow]);

  const monthlyReturn = useMemo(() => (profile.annualizedReturn / 12).toFixed(1), [profile.annualizedReturn]);

  return (
    <div className={`trader-profile-page ${className}`}>

      {/* ── Header Section ────────────────────────────────────────────── */}
      <div className="trader-profile-header">
        <div className="trader-profile-avatar-section">
          <div className="trader-avatar">
            {profile.avatar ? (
              <img src={profile.avatar} alt={profile.name} />
            ) : (
              <div className="trader-avatar-placeholder">{profile.name.charAt(0).toUpperCase()}</div>
            )}
            {profile.verified && <span className="trader-verified-badge" title="Verified Trader">✓</span>}
          </div>
        </div>

        <div className="trader-profile-main">
          <div className="trader-profile-name-row">
            <h1 className="trader-profile-name">{profile.name}</h1>
            {profile.badges.map((badge) => (
              <span key={badge} className="trader-badge">{badge}</span>
            ))}
          </div>
          <div className="trader-profile-meta">
            <span>#{profile.rank} Rank</span>
            <span>·</span>
            <span>Joined {new Date(profile.joinDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}</span>
            <span>·</span>
            <span>{profile.preferredMarket} Market</span>
            <span>·</span>
            <span>{profile.preferredTimeframe}</span>
          </div>
          <p className="trader-profile-bio">{profile.bio}</p>
          <div className="trader-profile-actions">
            <div className="trader-social-stats">
              <span><strong>{profile.followers.toLocaleString()}</strong> Followers</span>
              <span><strong>{profile.following}</strong> Following</span>
            </div>
            {isFollowing ? (
              <button className="trader-btn-following" onClick={handleUnfollow}>Following</button>
            ) : (
              <button className="trader-btn-follow" onClick={handleFollow}>+ Follow</button>
            )}
          </div>
        </div>
      </div>

      {/* ── Stats Grid ─────────────────────────────────────────────────── */}
      <div className="trader-stats-grid">
        <StatCard label="Total Return" value={`+${profile.totalReturn}%`} trend="up" />
        <StatCard label="Annual Return" value={`${profile.annualizedReturn}%`} trend="up" subtitle={`≈${monthlyReturn}%/mo`} />
        <StatCard label="Sharpe Ratio" value={profile.sharpeRatio.toFixed(2)} />
        <StatCard label="Max Drawdown" value={`${profile.maxDrawdown}%`} trend="down" />
        <StatCard label="Win Rate" value={`${profile.winRate}%`} trend="up" />
        <StatCard label="Total Trades" value={profile.totalTrades.toLocaleString()} />
        <StatCard label="Avg Holding" value={`${profile.avgHoldingDays}d`} />
      </div>

      {/* ── Tab Navigation ─────────────────────────────────────────────── */}
      <div className="trader-tabs">
        {(['strategies', 'signals', 'performance'] as const).map((tab) => (
          <button
            key={tab}
            className={`trader-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'strategies' && `Strategies (${profile.strategies.length})`}
            {tab === 'signals' && `Signals (${profile.recentSignals.length})`}
            {tab === 'performance' && 'Performance'}
          </button>
        ))}
      </div>

      {/* ── Tab Content ────────────────────────────────────────────────── */}
      <div className="trader-tab-content">
        {activeTab === 'strategies' && (
          <div className="trader-strategies-section">
            {profile.strategies.length === 0 ? (
              <div className="trader-empty-state">
                <div className="trader-empty-icon">📊</div>
                <p>No strategies published yet</p>
              </div>
            ) : (
              profile.strategies.map((strategy) => (
                <StrategyRow key={strategy.id} strategy={strategy} onClick={onStrategyClick} />
              ))
            )}
          </div>
        )}

        {activeTab === 'signals' && (
          <div className="trader-signals-section">
            {profile.recentSignals.length === 0 ? (
              <div className="trader-empty-state">
                <div className="trader-empty-icon">📡</div>
                <p>No recent signals</p>
              </div>
            ) : (
              <div className="trader-signals-list">
                {profile.recentSignals.map((signal) => (
                  <div key={signal.id} className="trader-signal-row" onClick={() => onSignalClick?.(signal.id)}>
                    <div className="trader-signal-main">
                      <span className="trader-signal-symbol">{signal.symbol}</span>
                      <SignalBadge direction={signal.direction} confidence={signal.confidence} />
                    </div>
                    <div className="trader-signal-details">
                      <span>Price: ${signal.price}</span>
                      <span>{new Date(signal.timestamp).toLocaleDateString()}</span>
                      <span className={`trader-signal-result ${signal.result === 'Win' ? 'text-green' : signal.result === 'Loss' ? 'text-red' : ''}`}>
                        {signal.result}{signal.pnl !== 0 ? ` (${signal.pnl > 0 ? '+' : ''}$${signal.pnl.toLocaleString()})` : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'performance' && (
          <div className="trader-performance-section">
            <div className="trader-performance-chart-placeholder">
              <svg viewBox="0 0 600 200" className="trader-equity-curve">
                <polyline
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="2"
                  points="0,150 50,140 100,130 150,120 200,110 250,100 300,95 350,85 400,75 450,60 500,50 550,40 600,30"
                />
                <polyline
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                  points="0,130 100,115 200,100 300,85 400,70 500,55 600,40"
                />
              </svg>
              <div className="trader-performance-legend">
                <span><span className="legend-dot" style={{ backgroundColor: '#22c55e' }} /> Portfolio</span>
                <span><span className="legend-dot" style={{ backgroundColor: '#ef4444' }} /> Benchmark (S&P 500)</span>
              </div>
            </div>
            <div className="trader-performance-metrics">
              <StatCard label="Best Month" value="+18.2%" trend="up" subtitle="2025-11" />
              <StatCard label="Worst Month" value="-9.8%" trend="down" subtitle="2025-03" />
              <StatCard label="Profitable Months" value="68%" />
              <StatCard label="Avg Win/Loss" value="2.4" />
            </div>
          </div>
        )}
      </div>

    </div>
  );
};

// ── CSS-in-JS Styles (injected via style tag) ──────────────────────────

export const TRADER_PROFILE_STYLES = `
.trader-profile-page {
  max-width: 960px;
  margin: 0 auto;
  padding: 24px;
  color: inherit;
}

.trader-profile-header {
  display: flex;
  gap: 24px;
  padding: 24px;
  background: var(--card-bg, rgba(255,255,255,0.05));
  border-radius: 12px;
  border: 1px solid var(--border-color, rgba(255,255,255,0.1));
  margin-bottom: 20px;
}

.trader-profile-avatar-section {
  flex-shrink: 0;
}

.trader-avatar {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  overflow: hidden;
  position: relative;
  border: 3px solid var(--primary-color, #3b82f6);
}

.trader-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.trader-avatar-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36px;
  font-weight: 700;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  color: #fff;
}

.trader-verified-badge {
  position: absolute;
  bottom: 2px;
  right: 2px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #22c55e;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  border: 2px solid var(--card-bg, #1a1a2e);
}

.trader-profile-main {
  flex: 1;
  min-width: 0;
}

.trader-profile-name-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 6px;
}

.trader-profile-name {
  font-size: 24px;
  font-weight: 700;
  margin: 0;
}

.trader-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  background: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
  border: 1px solid rgba(59, 130, 246, 0.3);
}

.trader-profile-meta {
  display: flex;
  gap: 6px;
  font-size: 13px;
  color: var(--text-secondary, #94a3b8);
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.trader-profile-bio {
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-primary, #e2e8f0);
  margin: 0 0 12px 0;
}

.trader-profile-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.trader-social-stats {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: var(--text-secondary, #94a3b8);
}

.trader-social-stats strong {
  color: var(--text-primary, #e2e8f0);
}

.trader-btn-follow {
  padding: 8px 20px;
  border-radius: 8px;
  border: none;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  background: #3b82f6;
  color: #fff;
  transition: all 0.2s;
}

.trader-btn-follow:hover {
  background: #2563eb;
  transform: translateY(-1px);
}

.trader-btn-following {
  padding: 8px 20px;
  border-radius: 8px;
  border: 1px solid var(--border-color, rgba(255,255,255,0.2));
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  background: transparent;
  color: var(--text-primary, #e2e8f0);
  transition: all 0.2s;
}

.trader-btn-following:hover {
  border-color: #ef4444;
  color: #ef4444;
}

.trader-stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
}

.trader-stat-card {
  padding: 14px;
  background: var(--card-bg, rgba(255,255,255,0.05));
  border-radius: 10px;
  border: 1px solid var(--border-color, rgba(255,255,255,0.08));
  text-align: center;
}

.trader-stat-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-secondary, #94a3b8);
  margin-bottom: 4px;
}

.trader-stat-value {
  font-size: 20px;
  font-weight: 700;
}

.trader-stat-subtitle {
  font-size: 11px;
  color: var(--text-secondary, #94a3b8);
  margin-top: 2px;
}

.text-green { color: #22c55e; }
.text-red { color: #ef4444; }

.trader-tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--border-color, rgba(255,255,255,0.1));
  margin-bottom: 20px;
}

.trader-tab {
  padding: 12px 24px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary, #94a3b8);
  cursor: pointer;
  transition: all 0.2s;
}

.trader-tab:hover {
  color: var(--text-primary, #e2e8f0);
}

.trader-tab.active {
  color: #3b82f6;
  border-bottom-color: #3b82f6;
}

.trader-tab-content {
  min-height: 200px;
}

.trader-strategy-row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: var(--card-bg, rgba(255,255,255,0.05));
  border-radius: 10px;
  border: 1px solid var(--border-color, rgba(255,255,255,0.08));
  margin-bottom: 10px;
  cursor: pointer;
  transition: all 0.2s;
}

.trader-strategy-row:hover {
  border-color: #3b82f6;
  transform: translateY(-1px);
}

.trader-strategy-info {
  flex: 1;
  min-width: 0;
}

.trader-strategy-name {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 2px;
}

.trader-strategy-desc {
  font-size: 12px;
  color: var(--text-secondary, #94a3b8);
  margin-bottom: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.trader-strategy-meta {
  display: flex;
  gap: 12px;
  font-size: 11px;
  color: var(--text-secondary, #94a3b8);
}

.trader-strategy-category {
  padding: 2px 8px;
  background: rgba(139, 92, 246, 0.15);
  border-radius: 6px;
  color: #a78bfa;
}

.trader-strategy-stats {
  display: flex;
  gap: 20px;
  align-items: center;
  text-align: center;
  font-size: 14px;
  font-weight: 600;
  flex-shrink: 0;
}

.trader-strategy-price {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #e2e8f0);
}

.trader-free-badge {
  padding: 4px 12px;
  background: rgba(34, 197, 94, 0.15);
  border-radius: 8px;
  color: #22c55e;
  font-size: 12px;
  font-weight: 600;
}

.trader-signals-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.trader-signal-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  background: var(--card-bg, rgba(255,255,255,0.05));
  border-radius: 10px;
  border: 1px solid var(--border-color, rgba(255,255,255,0.08));
  cursor: pointer;
  transition: all 0.2s;
}

.trader-signal-row:hover {
  border-color: #3b82f6;
}

.trader-signal-main {
  display: flex;
  align-items: center;
  gap: 12px;
}

.trader-signal-symbol {
  font-size: 16px;
  font-weight: 700;
}

.signal-badge {
  padding: 3px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid;
}

.trader-signal-details {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: var(--text-secondary, #94a3b8);
}

.trader-signal-result {
  font-weight: 600;
}

.trader-empty-state {
  text-align: center;
  padding: 48px 24px;
  color: var(--text-secondary, #94a3b8);
}

.trader-empty-icon {
  font-size: 36px;
  margin-bottom: 8px;
}

.trader-performance-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.trader-performance-chart-placeholder {
  padding: 20px;
  background: var(--card-bg, rgba(255,255,255,0.05));
  border-radius: 10px;
  border: 1px solid var(--border-color, rgba(255,255,255,0.08));
}

.trader-equity-curve {
  width: 100%;
  height: auto;
}

.trader-performance-legend {
  display: flex;
  justify-content: center;
  gap: 20px;
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-secondary, #94a3b8);
}

.legend-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 4px;
}

.trader-performance-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 12px;
}

/* ── Responsive ──────────────────────────────────────── */
@media (max-width: 768px) {
  .trader-profile-header {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .trader-profile-name-row {
    justify-content: center;
  }

  .trader-profile-actions {
    justify-content: center;
    flex-direction: column;
  }

  .trader-stats-grid {
    grid-template-columns: repeat(3, 1fr);
  }

  .trader-strategy-row {
    flex-direction: column;
    align-items: flex-start;
  }

  .trader-strategy-stats {
    width: 100%;
    justify-content: space-between;
    gap: 10px;
  }

  .trader-signal-row {
    flex-direction: column;
    gap: 8px;
  }

  .trader-signal-details {
    width: 100%;
    justify-content: space-between;
  }
}
`;

export default TraderProfilePage;
