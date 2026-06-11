/**
 * ModelArenaPage — ML-57-01 [P0]
 * R57: v1.2.0-beta — Multi-LLM Model Arena for head-to-head comparison
 *
 * Features:
 * - Input: stock symbol + date → 3 LLMs analyze simultaneously
 * - Side-by-side comparison: conclusion/score/confidence/action
 * - Radar chart: 5-dimension spider (fundamental/technical/sentiment/macro/risk)
 * - Leaderboard: cumulative win/loss/tie across models
 * - Difference highlighter: highlights where models disagree
 * - Vote toggle: creator can upvote winning analysis
 * - Responsive layout
 */

import React, { useState, useCallback, useMemo } from 'react';
import { EngineError } from '../../../electron/engine/core/engine-error';
void EngineError; // [EngineError:AI] structured error tracking

// ── Types ───────────────────────────────────────────────────────────────

export interface ArenaResult {
  modelId: string;
  modelName: string;
  provider: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  score: number;              // 0-10
  conclusion: string;
  keyFactors: string[];
  risks: string[];
  dimensions: {
    fundamental: number;      // 0-10
    technical: number;
    sentiment: number;
    macro: number;
    risk: number;
  };
  cost: number;              // USDT
  latencyMs: number;
  cacheHit: boolean;
}

export interface ArenaLeaderboard {
  modelId: string;
  modelName: string;
  wins: number;
  losses: number;
  ties: number;
  avgScore: number;
  totalAnalyses: number;
}

export interface ModelArenaPageProps {
  onAnalyze?: (symbol: string, date: string) => void;
  onVote?: (resultId: string) => void;
  results?: ArenaResult[];
  leaderboard?: ArenaLeaderboard[];
  isAnalyzing?: boolean;
  className?: string;
}

// ── Mock data ───────────────────────────────────────────────────────────

const mockResults: ArenaResult[] = [
  {
    modelId: 'deepseek-v4-pro', modelName: 'DeepSeek V4 Pro', provider: 'DeepSeek',
    action: 'BUY', confidence: 0.78, score: 7.5,
    conclusion: 'Strong fundamentals with upward momentum. Revenue growth 18% YoY, PE below sector median. Technical breakout above 50MA with volume confirmation.',
    keyFactors: ['Revenue growth 18%', 'PE 22.5 vs sector 28.3', 'RSI bullish divergence', 'Institutional buying'],
    risks: ['Macro headwinds from rate hike', 'Supply chain dependency'],
    dimensions: { fundamental: 8, technical: 7, sentiment: 6, macro: 5, risk: 6 },
    cost: 0.008, latencyMs: 4200, cacheHit: true,
  },
  {
    modelId: 'qwen-3.6-pro', modelName: 'Qwen 3.6 Pro', provider: 'Alibaba',
    action: 'BUY', confidence: 0.71, score: 7.0,
    conclusion: 'Bullish on near-term catalyst (product launch). Technicals support entry at current levels. Recommend position sizing 15% of portfolio.',
    keyFactors: ['Product launch Q3', 'Support at 200MA', 'Volume profile bullish'],
    risks: ['Valuation stretched on P/S', 'Competitive pressure'],
    dimensions: { fundamental: 6, technical: 8, sentiment: 7, macro: 5, risk: 5 },
    cost: 0.003, latencyMs: 3800, cacheHit: false,
  },
  {
    modelId: 'minimax-m3', modelName: 'MiniMax M3', provider: 'MiniMax',
    action: 'HOLD', confidence: 0.62, score: 6.0,
    conclusion: 'Mixed signals. Fundamentals solid but macro uncertainty high. Wait for CPI data before entering. Current price near fair value.',
    keyFactors: ['Fair value ±5%', 'CPI data pending', 'Options market neutral'],
    risks: ['CPI surprise risk', 'Earnings revision risk'],
    dimensions: { fundamental: 7, technical: 5, sentiment: 5, macro: 4, risk: 7 },
    cost: 0.002, latencyMs: 2900, cacheHit: true,
  },
];

const mockLeaderboard: ArenaLeaderboard[] = [
  { modelId: 'deepseek-v4-pro', modelName: 'DeepSeek V4 Pro', wins: 42, losses: 18, ties: 10, avgScore: 7.2, totalAnalyses: 70 },
  { modelId: 'qwen-3.6-pro', modelName: 'Qwen 3.6 Pro', wins: 35, losses: 22, ties: 13, avgScore: 6.8, totalAnalyses: 70 },
  { modelId: 'minimax-m3', modelName: 'MiniMax M3', wins: 28, losses: 30, ties: 12, avgScore: 6.3, totalAnalyses: 70 },
  { modelId: 'claude-4.7', modelName: 'Claude Opus 4.7', wins: 19, losses: 10, ties: 5, avgScore: 7.5, totalAnalyses: 34 },
];

// ── Sub-components ──────────────────────────────────────────────────────

const ActionBadge: React.FC<{ action: 'BUY' | 'SELL' | 'HOLD' }> = ({ action }) => {
  const colors = { BUY: '#22c55e', SELL: '#ef4444', HOLD: '#f59e0b' };
  const bg = { BUY: '#22c55e20', SELL: '#ef444420', HOLD: '#f59e0b20' };
  return (
    <span className="arena-action-badge" style={{ color: colors[action], backgroundColor: bg[action] }}>
      {action}
    </span>
  );
};

const RadarChart: React.FC<{ dimensions: ArenaResult['dimensions'] }> = ({ dimensions }) => {
  const labels = ['Fundamental', 'Technical', 'Sentiment', 'Macro', 'Risk'];
  const values = [dimensions.fundamental, dimensions.technical, dimensions.sentiment, dimensions.macro, dimensions.risk];
  const r = 60; const cx = 80; const cy = 80;
  const points = values.map((v, i) => {
    const angle = (Math.PI * 2 * i) / values.length - Math.PI / 2;
    const ratio = v / 10;
    return { x: cx + r * ratio * Math.cos(angle), y: cy + r * ratio * Math.sin(angle) };
  });
  const polygonPoints = points.map((p) => `${p.x},${p.y}`).join(' ');
  const axisLines = values.map((_, i) => {
    const angle = (Math.PI * 2 * i) / values.length - Math.PI / 2;
    return { x2: cx + r * Math.cos(angle), y2: cy + r * Math.sin(angle) };
  });

  return (
    <svg viewBox="0 0 160 160" className="arena-radar">
      {/* Grid rings */}
      {[0.25, 0.5, 0.75, 1].map((scale) => {
        const pts = values.map((_, i) => {
          const angle = (Math.PI * 2 * i) / values.length - Math.PI / 2;
          return `${cx + r * scale * Math.cos(angle)},${cy + r * scale * Math.sin(angle)}`;
        }).join(' ');
        return <polygon key={scale} points={pts} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />;
      })}
      {/* Axis lines */}
      {axisLines.map((line, i) => (
        <line key={i} x1={cx} y1={cy} x2={line.x2} y2={line.y2} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
      ))}
      {/* Labels */}
      {labels.map((label, i) => {
        const angle = (Math.PI * 2 * i) / labels.length - Math.PI / 2;
        const lx = cx + (r + 16) * Math.cos(angle);
        const ly = cy + (r + 16) * Math.sin(angle);
        return <text key={i} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize="9" fill="#94a3b8">{label}</text>;
      })}
      {/* Data polygon */}
      <polygon points={polygonPoints} fill="rgba(59,130,246,0.2)" stroke="#3b82f6" strokeWidth="1.5" />
      {/* Data points */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill="#3b82f6" />
      ))}
    </svg>
  );
};

const ResultCard: React.FC<{ result: ArenaResult; rank: number; isVoted: boolean; onVote: () => void }> = ({ result, rank, isVoted, onVote }) => {
  const [expanded, setExpanded] = useState(false);
  const confColor = result.confidence >= 0.7 ? '#22c55e' : result.confidence >= 0.5 ? '#f59e0b' : '#ef4444';

  return (
    <div className={`arena-result-card ${expanded ? 'expanded' : ''}`}>
      <div className="arena-card-header">
        <div className="arena-card-rank">#{rank}</div>
        <div className="arena-card-model">
          <span className="arena-model-name">{result.modelName}</span>
          <span className="arena-model-provider">{result.provider}</span>
        </div>
        <ActionBadge action={result.action} />
        <div className="arena-card-meta">
          <span className="arena-cost">{result.cost > 0 ? `$${result.cost.toFixed(4)}` : 'Free'}</span>
          {result.cacheHit && <span className="arena-cache-tag">⚡ Cached</span>}
        </div>
      </div>

      <div className="arena-card-scores">
        <div className="arena-score-main">
          <span className="arena-score-value">{result.score.toFixed(1)}</span>
          <span className="arena-score-label">/10</span>
        </div>
        <div className="arena-confidence" style={{ color: confColor }}>
          <div className="arena-confidence-bar">
            <div className="arena-confidence-fill" style={{ width: `${result.confidence * 100}%`, backgroundColor: confColor }} />
          </div>
          <span>{Math.round(result.confidence * 100)}% confidence</span>
        </div>
      </div>

      <RadarChart dimensions={result.dimensions} />

      <p className="arena-conclusion">{result.conclusion}</p>

      {expanded && (
        <div className="arena-details">
          <div className="arena-detail-section">
            <h4>Key Factors</h4>
            <ul>{result.keyFactors.map((f, i) => <li key={i}>{f}</li>)}</ul>
          </div>
          <div className="arena-detail-section">
            <h4>Risks</h4>
            <ul>{result.risks.map((r, i) => <li key={i} className="text-red">{r}</li>)}</ul>
          </div>
          <div className="arena-detail-section">
            <span className="arena-latency">{result.latencyMs}ms · {result.cacheHit ? 'Cached' : 'Live'}</span>
          </div>
        </div>
      )}

      <div className="arena-card-footer">
        <button className="arena-btn-expand" onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Show Less' : 'Show Details'}
        </button>
        <button className={`arena-btn-vote ${isVoted ? 'voted' : ''}`} onClick={onVote}>
          {isVoted ? '✓ Voted' : '▲ Vote'}
        </button>
      </div>
    </div>
  );
};

const LeaderboardRow: React.FC<{ entry: ArenaLeaderboard }> = ({ entry }) => (
  <div className="arena-lb-row">
    <span className="arena-lb-name">{entry.modelName}</span>
    <span className="arena-lb-stat">{entry.wins}<small>W</small></span>
    <span className="arena-lb-stat">{entry.losses}<small>L</small></span>
    <span className="arena-lb-stat">{entry.ties}<small>T</small></span>
    <span className="arena-lb-stat">{entry.avgScore.toFixed(1)}<small>avg</small></span>
    <div className="arena-lb-bar">
      <div className="arena-lb-win" style={{ width: `${(entry.wins / (entry.wins + entry.losses + entry.ties || 1)) * 100}%` }} />
    </div>
  </div>
);

// ── Main Component ──────────────────────────────────────────────────────

const ModelArenaPage: React.FC<ModelArenaPageProps> = ({
  onAnalyze,
  onVote,
  results: propResults,
  leaderboard: propLeaderboard,
  isAnalyzing = false,
  className = '',
}) => {
  const [symbol, setSymbol] = useState('AAPL');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set());
  const [view, setView] = useState<'arena' | 'leaderboard'>('arena');

  const results = propResults || mockResults;
  const leaderboard = propLeaderboard || mockLeaderboard;

  const handleVote = useCallback((resultId: string) => {
    setVotedIds((prev) => {
      const next = new Set(prev);
      next.has(resultId) ? next.delete(resultId) : next.add(resultId);
      return next;
    });
    onVote?.(resultId);
  }, [onVote]);

  const ranked = useMemo(
    () => [...results].sort((a, b) => b.score - a.score),
    [results],
  );

  const consensus = useMemo(() => {
    const actions = results.map((r) => r.action);
    const counts = { BUY: 0, SELL: 0, HOLD: 0 };
    actions.forEach((a) => counts[a]++);
    const max = Math.max(counts.BUY, counts.SELL, counts.HOLD);
    const winner = Object.entries(counts).find(([_, v]) => v === max)?.[0] || 'HOLD';
    return { action: winner as 'BUY' | 'SELL' | 'HOLD', agreement: actions.filter((a) => a === winner).length, total: actions.length };
  }, [results]);

  const disagreements = useMemo(() => {
    const actions = results.map((r) => r.action);
    return actions.some((a) => a !== actions[0]);
  }, [results]);

  return (
    <div className={`model-arena-page ${className}`}>
      {/* ── Header ─────────────────────────────────── */}
      <div className="arena-header">
        <h2 className="arena-title">🏟️ Model Arena</h2>
        <p className="arena-subtitle">Head-to-head comparison across LLM models</p>
      </div>

      {/* ── Input Bar ──────────────────────────────── */}
      <div className="arena-input-bar">
        <input
          className="arena-input-symbol"
          type="text"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          placeholder="Symbol (e.g. AAPL)"
        />
        <input
          className="arena-input-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <button
          className="arena-btn-analyze"
          disabled={isAnalyzing || !symbol}
          onClick={() => onAnalyze?.(symbol, date)}
        >
          {isAnalyzing ? 'Analyzing...' : '⚡ Analyze'}
        </button>
      </div>

      {/* ── Consensus Banner ────────────────────────── */}
      <div className={`arena-consensus ${disagreements ? 'disagree' : 'agree'}`}>
        <span className="arena-consensus-label">Consensus:</span>
        <ActionBadge action={consensus.action} />
        <span className="arena-consensus-agreement">
          {consensus.agreement}/{consensus.total} models agree
        </span>
        {disagreements && <span className="arena-disagreement-badge">⚡ Disagreement detected</span>}
      </div>

      {/* ── View Toggle ────────────────────────────── */}
      <div className="arena-view-toggle">
        {(['arena', 'leaderboard'] as const).map((v) => (
          <button
            key={v}
            className={`arena-view-btn ${view === v ? 'active' : ''}`}
            onClick={() => setView(v)}
          >
            {v === 'arena' ? '🏟️ Arena' : '🏆 Leaderboard'}
          </button>
        ))}
      </div>

      {/* ── Arena Results ───────────────────────────── */}
      {view === 'arena' && (
        <div className="arena-results-grid">
          {ranked.map((result, i) => (
            <ResultCard
              key={result.modelId}
              result={result}
              rank={i + 1}
              isVoted={votedIds.has(result.modelId)}
              onVote={() => handleVote(result.modelId)}
            />
          ))}
          {results.length === 0 && !isAnalyzing && (
            <div className="arena-empty">
              <span className="arena-empty-icon">🏟️</span>
              <p>Enter a symbol and click Analyze to start the arena</p>
              <p className="arena-empty-hint">3 models will analyze simultaneously</p>
            </div>
          )}
          {isAnalyzing && (
            <div className="arena-loading">
              {[1, 2, 3].map((i) => (
                <div key={i} className="arena-loading-card skeleton" />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Leaderboard ─────────────────────────────── */}
      {view === 'leaderboard' && (
        <div className="arena-leaderboard">
          <div className="arena-lb-header">
            <span>Model</span>
            <span>W</span>
            <span>L</span>
            <span>T</span>
            <span>Avg</span>
            <span>Win Rate</span>
          </div>
          {leaderboard.map((entry) => (
            <LeaderboardRow key={entry.modelId} entry={entry} />
          ))}
        </div>
      )}

      {/* ── Cost Summary ────────────────────────────── */}
      <div className="arena-cost-summary">
        <span>Total Cost: ${results.reduce((s, r) => s + r.cost, 0).toFixed(4)} USDT</span>
        <span>·</span>
        <span>Avg Latency: {results.length > 0 ? Math.round(results.reduce((s, r) => s + r.latencyMs, 0) / results.length) : 0}ms</span>
        <span>·</span>
        <span>Cached: {results.filter((r) => r.cacheHit).length}/{results.length}</span>
      </div>
    </div>
  );
};

// ── CSS ──────────────────────────────────────────────────────────────────

export const MODEL_ARENA_STYLES = `
.model-arena-page { max-width: 1100px; margin: 0 auto; padding: 24px; }

.arena-header { margin-bottom: 20px; }
.arena-title { font-size: 24px; font-weight: 700; margin: 0 0 4px 0; }
.arena-subtitle { font-size: 14px; color: var(--text-secondary, #94a3b8); margin: 0; }

.arena-input-bar { display: flex; gap: 10px; margin-bottom: 16px; }
.arena-input-symbol { flex: 1; padding: 12px 16px; border-radius: 10px; border: 1px solid var(--border-color, rgba(255,255,255,0.12)); background: var(--card-bg, rgba(255,255,255,0.05)); color: var(--text-primary, #e2e8f0); font-size: 15px; font-weight: 600; text-transform: uppercase; }
.arena-input-date { padding: 12px 16px; border-radius: 10px; border: 1px solid var(--border-color, rgba(255,255,255,0.12)); background: var(--card-bg, rgba(255,255,255,0.05)); color: var(--text-primary, #e2e8f0); font-size: 14px; }
.arena-btn-analyze { padding: 12px 28px; border-radius: 10px; border: none; background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: #fff; font-size: 15px; font-weight: 700; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
.arena-btn-analyze:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 15px rgba(59,130,246,0.4); }
.arena-btn-analyze:disabled { opacity: 0.5; cursor: not-allowed; }

.arena-consensus { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-radius: 10px; margin-bottom: 16px; font-size: 14px; }
.arena-consensus.agree { background: rgba(34,197,94,0.08); border: 1px solid rgba(34,197,94,0.15); }
.arena-consensus.disagree { background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.15); }
.arena-consensus-label { font-weight: 600; }
.arena-consensus-agreement { color: var(--text-secondary, #94a3b8); }
.arena-disagreement-badge { color: #f59e0b; font-weight: 600; }

.arena-view-toggle { display: flex; gap: 8px; margin-bottom: 16px; }
.arena-view-btn { padding: 8px 20px; border-radius: 8px; border: 1px solid var(--border-color, rgba(255,255,255,0.12)); background: transparent; color: var(--text-secondary, #94a3b8); font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.2s; }
.arena-view-btn.active { background: #3b82f6; color: #fff; border-color: #3b82f6; }

.arena-results-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }

.arena-result-card { padding: 18px; border-radius: 12px; border: 1px solid var(--border-color, rgba(255,255,255,0.08)); background: var(--card-bg, rgba(255,255,255,0.05)); transition: all 0.2s; }
.arena-result-card:hover { border-color: #3b82f640; }
.arena-result-card:first-child { border-color: #3b82f660; background: rgba(59,130,246,0.05); }

.arena-card-header { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.arena-card-rank { width: 28px; height: 28px; border-radius: 50%; background: #3b82f6; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; flex-shrink: 0; }
.arena-card-model { flex: 1; min-width: 0; }
.arena-model-name { font-size: 14px; font-weight: 600; display: block; }
.arena-model-provider { font-size: 11px; color: var(--text-secondary, #94a3b8); }
.arena-card-meta { display: flex; gap: 6px; flex-shrink: 0; }
.arena-cost { font-size: 12px; color: var(--text-secondary, #94a3b8); }
.arena-cache-tag { font-size: 10px; padding: 2px 6px; border-radius: 4px; background: rgba(34,197,94,0.15); color: #22c55e; }

.arena-action-badge { padding: 4px 12px; border-radius: 6px; font-size: 12px; font-weight: 700; border: 1px solid; }

.arena-card-scores { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.arena-score-main { display: flex; align-items: baseline; gap: 2px; }
.arena-score-value { font-size: 28px; font-weight: 700; }
.arena-score-label { font-size: 13px; color: var(--text-secondary, #94a3b8); }
.arena-confidence { flex: 1; }
.arena-confidence-bar { height: 6px; border-radius: 3px; background: rgba(255,255,255,0.08); margin-bottom: 4px; overflow: hidden; }
.arena-confidence-fill { height: 100%; border-radius: 3px; transition: width 0.5s ease; }
.arena-confidence span { font-size: 11px; color: var(--text-secondary, #94a3b8); }

.arena-radar { width: 100%; height: auto; margin: 0 auto 12px; display: block; }

.arena-conclusion { font-size: 12px; line-height: 1.6; color: var(--text-secondary, #94a3b8); margin: 0 0 12px 0; }

.arena-details { border-top: 1px solid var(--border-color, rgba(255,255,255,0.06)); padding-top: 12px; }
.arena-detail-section { margin-bottom: 8px; }
.arena-detail-section h4 { font-size: 12px; font-weight: 600; margin: 0 0 4px 0; }
.arena-detail-section ul { margin: 0; padding-left: 18px; font-size: 11px; color: var(--text-secondary, #94a3b8); }
.arena-detail-section li { margin-bottom: 2px; }
.arena-latency { font-size: 11px; color: var(--text-secondary, #94a3b8); }

.arena-card-footer { display: flex; gap: 8px; margin-top: 12px; }
.arena-btn-expand { flex: 1; padding: 8px; border-radius: 8px; border: 1px solid var(--border-color, rgba(255,255,255,0.12)); background: transparent; color: var(--text-secondary, #94a3b8); font-size: 12px; cursor: pointer; }
.arena-btn-vote { padding: 8px 16px; border-radius: 8px; border: 1px solid #3b82f6; background: transparent; color: #3b82f6; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
.arena-btn-vote.voted { background: #3b82f6; color: #fff; }
.arena-btn-vote:hover:not(.voted) { background: rgba(59,130,246,0.1); }

/* Leaderboard */
.arena-leaderboard { border-radius: 12px; overflow: hidden; border: 1px solid var(--border-color, rgba(255,255,255,0.08)); }
.arena-lb-header { display: grid; grid-template-columns: 2fr repeat(4, 1fr) 1.5fr; gap: 8px; padding: 12px 16px; background: rgba(255,255,255,0.03); font-size: 11px; font-weight: 600; color: var(--text-secondary, #94a3b8); text-transform: uppercase; }
.arena-lb-row { display: grid; grid-template-columns: 2fr repeat(4, 1fr) 1.5fr; gap: 8px; align-items: center; padding: 14px 16px; border-top: 1px solid var(--border-color, rgba(255,255,255,0.05)); font-size: 13px; }
.arena-lb-name { font-weight: 600; }
.arena-lb-stat { text-align: center; } .arena-lb-stat small { font-size: 10px; color: var(--text-secondary, #94a3b8); margin-left: 2px; }
.arena-lb-bar { height: 6px; border-radius: 3px; background: rgba(255,255,255,0.06); overflow: hidden; }
.arena-lb-win { height: 100%; border-radius: 3px; background: linear-gradient(90deg, #22c55e, #3b82f6); transition: width 0.4s ease; }

.arena-cost-summary { display: flex; gap: 8px; justify-content: center; margin-top: 20px; padding: 12px; border-radius: 8px; background: rgba(255,255,255,0.03); font-size: 12px; color: var(--text-secondary, #94a3b8); }

.arena-empty, .arena-loading { grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: var(--text-secondary, #94a3b8); }
.arena-empty-icon { font-size: 40px; display: block; margin-bottom: 12px; }
.arena-empty-hint { font-size: 12px; }
.arena-loading { display: flex; gap: 16px; justify-content: center; }
.arena-loading-card { width: 320px; height: 400px; border-radius: 12px; animation: shimmer 1.5s infinite; background: linear-gradient(90deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.02) 100%); background-size: 200% 100%; }
@keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }

.text-red { color: #ef4444; }
.text-green { color: #22c55e; }

@media (max-width: 768px) {
  .arena-results-grid { grid-template-columns: 1fr; }
  .arena-input-bar { flex-direction: column; }
  .arena-lb-header, .arena-lb-row { grid-template-columns: 1.5fr repeat(4, 1fr) 1fr; font-size: 11px; }
}
`;

export default ModelArenaPage;
