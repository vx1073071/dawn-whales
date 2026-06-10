/**
 * AgentCollaborationPanel — ML-56-01 [P0]
 * R56: v1.2.0-alpha — AI 协作按钮 + 4 Agent 状态可视化
 *
 * Features:
 * - "AI 协作" 触发按钮 (一键启动 4 Agent 圆桌辩论)
 * - 4 Agent 头像 + 实时状态 (基本面/情绪/新闻/技术)
 * - 辩论动画 (打字效果 + 进度条)
 * - 缓存命中提示 (创作者可见实时命中率)
 * - 降级提示 (LLM 降级时显示"正在使用备用模型")
 * - 最终决策展示 (推荐+置信度+投票明细)
 * - 3 档选择 (标准/高级/旗舰)
 *
 * ≥300L
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from "react-i18next";

// ── Types ───────────────────────────────────────────────────────────────

export type AgentType = 'fundamentals' | 'sentiment' | 'news' | 'technical';
export type AgentStatus = 'idle' | 'running' | 'completed' | 'error' | 'timeout';
export type Tier = 'standard' | 'premium' | 'flagship';
export type SessionStage = 'idle' | 'initializing' | 'debating' | 'voting' | 'completed' | 'failed';

export interface AgentState {
  type: AgentType;
  name: string;
  emoji: string;
  color: string;
  status: AgentStatus;
  summary: string;
  recommendation: 'buy' | 'sell' | 'hold' | 'neutral' | null;
  confidence: number;
  keyFactors: string[];
}

export interface DebateRound {
  round: number;
  bullArguments: string[];
  bearArguments: string[];
  bullScore: number;
  bearScore: number;
}

export interface CollaborationResult {
  symbol: string;
  stage: SessionStage;
  agents: AgentState[];
  debateRounds: DebateRound[];
  finalDecision: {
    recommendation: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
    confidence: number;
    reasoning: string;
    votes: Record<AgentType, 'buy' | 'sell' | 'hold'>;
  } | null;
  cacheHitRate: number;
  costEstimate: number;
  degraded: boolean;
  degradedModel?: string;
}

export interface AgentCollaborationPanelProps {
  symbol?: string;
  onCollaborate?: (symbol: string, tier: Tier) => void;
  onResult?: (result: CollaborationResult) => void;
  isConnected?: boolean;
}

// ── Agent Definitions ──────────────────────────────────────────────────

const AGENT_DEFS: Omit<AgentState, 'status' | 'summary' | 'recommendation' | 'confidence' | 'keyFactors'>[] = [
  { type: 'fundamentals', name: {t('基本面分析师')}, emoji: '📊', color: '#4CAF50' },
  { type: 'sentiment', name: {t('情绪分析师')}, emoji: '😤', color: '#FF9800' },
  { type: 'news', name: {t('新闻分析师')}, emoji: '📰', color: '#2196F3' },
  { type: 'technical', name: {t('技术分析师')}, emoji: '📈', color: '#9C27B0' },
];

const TIER_CONFIG: Record<Tier, { label: string; agents: number; rounds: number; cost: number; price: number; emoji: string }> = {
  standard: { label: {t('标准')}, agents: 2, rounds: 2, cost: 0.008, price: 1.0, emoji: '⚡' },
  premium: { label: {t('高级')}, agents: 3, rounds: 2, cost: 0.012, price: 1.5, emoji: '🔥' },
  flagship: { label: {t('旗舰')}, agents: 4, rounds: 2, cost: 0.016, price: 2.0, emoji: '👑' },
};

// Moved: RECOMMENDATION_LABELS now inside component (needs useTranslation t())

const RECOMMENDATION_COLORS: Record<string, string> = {
  strong_buy: '#00C853',
  buy: '#4CAF50',
  hold: '#FFC107',
  sell: '#FF5722',
  strong_sell: '#D50000',
};

// ── Component ──────────────────────────────────────────────────────────

export const AgentCollaborationPanel: React.FC<AgentCollaborationPanelProps> = ({
  symbol = '',
  onCollaborate,
  onResult,
  isConnected = true,
}) => {
  const { t } = useTranslation();

  const RECOMMENDATION_LABELS: Record<string, string> = {
    strong_buy: '强烈买入',
    buy: '买入',
    hold: '持有',
    sell: '卖出',
    strong_sell: '强烈卖出',
  };

  const [ticker, setTicker] = useState(symbol);
  const [tier, setTier] = useState<Tier>('flagship');
  const [stage, setStage] = useState<SessionStage>('idle');
  const [agents, setAgents] = useState<AgentState[]>(() =>
    AGENT_DEFS.map(a => ({ ...a, status: 'idle', summary: '', recommendation: null, confidence: 0, keyFactors: [] }))
  );
  const [debateRounds, setDebateRounds] = useState<DebateRound[]>([]);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [costEstimate, setCostEstimate] = useState(0);
  const [cacheHitRate, setCacheHitRate] = useState(0);
  const [degraded, setDegraded] = useState(false);
  const [degradedModel, setDegradedModel] = useState('');
  const [finalDecision, setFinalDecision] = useState<CollaborationResult['finalDecision']>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Simulate Collaboration ──────────────────────────────────────────

  const startCollaboration = useCallback(() => {
    if (!ticker.trim()) return;
    if (!isConnected) {
      setProgressMessage({t('❌ 未连接到 AI 服务')});
      return;
    }

    const cfg = TIER_CONFIG[tier];
    setStage('initializing');
    setProgress(5);
    setProgressMessage({t('正在初始化 AI Agent...')});
    setFinalDecision(null);
    setDebateRounds([]);
    setDegraded(false);
    setDegradedModel('');

    onCollaborate?.(ticker.toUpperCase(), tier);

    // Reset agents
    setAgents(AGENT_DEFS.map(a => ({
      ...a,
      status: 'idle',
      summary: '',
      recommendation: null,
      confidence: 0,
      keyFactors: [],
    })));

    // Simulate with timeouts (production would use real WebSocket events)
    const steps = [
      // Step 1: Initialize (delay 600ms)
      {
        delay: 600,
        action: () => {
          setStage('debating');
          setProgress(10);
          setProgressMessage({t('Agent 正在分析数据...')});
          // Activate agents based on tier
          setAgents(prev => prev.map((a, i) => {
            if (i < cfg.agents) return { ...a, status: 'running' as AgentStatus, summary: {t('分析中...')} };
            return a;
          }));
        },
      },
      // Step 2-5: Each agent completes (delay 800ms each)
      { delay: 800, action: () => {
        setProgress(25);
        setProgressMessage({t('📊 基本面分析师 完成分析')});
        setAgents(prev => prev.map(a => a.type === 'fundamentals' && a.status === 'running' ? {
          ...a, status: 'completed', summary: {t('PE 估值合理，营收增长稳定')}, recommendation: 'buy', confidence: 78,
          keyFactors: [{t('PE 23x 低于行业均值')}, {t('营收 YoY +18%')}, 'ROE 15%'],
        } : a));
      }},
      { delay: 800, action: () => {
        setProgress(40);
        setProgressMessage({t('😤 情绪分析师 完成分析')});
        setAgents(prev => prev.map(a => a.type === 'sentiment' && a.status === 'running' ? {
          ...a, status: 'completed', summary: {t('市场情绪中性偏多')}, recommendation: 'buy', confidence: 65,
          keyFactors: [{t('社交媒体情绪 +0.3σ')}, {t('恐惧贪婪指数 62')}, {t('期权 Put/Call 0.85')}],
        } : a));
      }},
      { delay: 800, action: () => {
        if (cfg.agents < 3) return;
        setProgress(55);
        setProgressMessage({t('📰 新闻分析师 完成分析')});
        setAgents(prev => prev.map(a => a.type === 'news' && a.status === 'running' ? {
          ...a, status: 'completed', summary: {t('近期利好消息偏多')}, recommendation: 'buy', confidence: 72,
          keyFactors: [{t('财报超预期')}, {t('新产品发布')}, {t('分析师上调目标价 +10%')}],
        } : a));
      }},
      { delay: 800, action: () => {
        if (cfg.agents < 4) return;
        setProgress(70);
        setProgressMessage({t('📈 技术分析师 完成分析')});
        setAgents(prev => prev.map(a => a.type === 'technical' && a.status === 'running' ? {
          ...a, status: 'completed', summary: {t('技术面多头排列')}, recommendation: 'buy', confidence: 80,
          keyFactors: [{t('MA20 上穿 MA60')}, {t('MACD 金叉')}, {t('布林带收窄即将突破')}],
        } : a));
      }},
      // Step 6: Debate rounds (delay 1000ms each)
      { delay: 1000, action: () => {
        setStage('debating');
        setProgress(80);
        setProgressMessage(`正在辩论 (Round 1/${cfg.rounds})...`);
        setDebateRounds([{
          round: 1,
          bullArguments: [{t('估值合理，上行空间 20%+')}, {t('技术面多头信号明确')}],
          bearArguments: [{t('宏观不确定性仍存')}, {t('短期获利盘压力')}],
          bullScore: 65,
          bearScore: 35,
        }]);
      }},
      { delay: cfg.rounds >= 2 ? 1000 : 0, action: () => {
        if (cfg.rounds < 2) return;
        setProgress(88);
        setProgressMessage(`正在辩论 (Round 2/${cfg.rounds})...`);
        setDebateRounds(prev => [...prev, {
          round: 2,
          bullArguments: [{t('行业景气度回升')}, {t('大资金持续流入')}],
          bearArguments: [{t('估值已部分反映预期')}],
          bullScore: 58,
          bearScore: 42,
        }]);
      }},
      // Step 7: Voting (delay 600ms)
      { delay: 600, action: () => {
        setStage('voting');
        setProgress(95);
        setProgressMessage({t('Agent 正在投票...')});
      }},
      // Step 8: Final result
      { delay: 800, action: () => {
        setStage('completed');
        setProgress(100);
        setProgressMessage({t('✅ AI 协作完成')});
        const cacheRate = 87 + Math.floor(Math.random() * 10);
        setCacheHitRate(cacheRate);

        // Simulate occasional degradation
        const isDegraded = Math.random() < 0.05;
        if (isDegraded) {
          setDegraded(true);
          setDegradedModel(Math.random() > 0.5 ? 'DeepSeek V4 Flash' : 'MiniMax M3');
        }

        const cost = cfg.cost * (1 - cacheRate / 100 * 0.99);
        setCostEstimate(Math.round(cost * 1000000) / 1000000);

        const decision: CollaborationResult['finalDecision'] = {
          recommendation: 'buy',
          confidence: 75,
          reasoning: '4 位 AI 分析师综合研判：基本面估值合理、情绪中性偏多、新闻面利好、技术面多头信号。建议买入。',
          votes: {
            fundamentals: 'buy',
            sentiment: 'buy',
            news: 'buy',
            technical: 'buy',
          },
        };
        setFinalDecision(decision);

        onResult?.({
          symbol: ticker.toUpperCase(),
          stage: 'completed',
          agents: agents.map(a =>
            a.status === 'running' ? { ...a, status: 'completed' } : a
          ),
          debateRounds,
          finalDecision: decision,
          cacheHitRate: cacheRate,
          costEstimate: cost,
          degraded: isDegraded,
          degradedModel: isDegraded ? degradedModel : undefined,
        });
      }},
    ];

    steps.forEach(({ delay, action }) => {
      setTimeout(action, delay);
    });

    // Cleanup timer
    timerRef.current = setTimeout(() => {
      setStage('idle');
      timerRef.current = null;
    }, 10000);
  }, [ticker, tier, isConnected, agents, debateRounds, degradedModel, onCollaborate, onResult]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // ── Render Agent Card ────────────────────────────────────────────────

  const renderAgentCard = (agent: AgentState, active: boolean) => {
    const isActive = active && agent.status !== 'idle';
    return (
      <div
        key={agent.type}
        style={{
          ...styles.agentCard,
          opacity: isActive ? 1 : 0.4,
          borderColor: isActive && agent.status === 'running' ? agent.color : 'transparent',
          animation: agent.status === 'running' ? 'pulse 1.5s ease-in-out infinite' : 'none',
        }}
      >
        <div style={styles.agentHeader}>
          <span style={styles.agentEmoji}>{agent.emoji}</span>
          <span style={styles.agentName}>{agent.name}</span>
          <span style={{
            ...styles.agentStatusDot,
            background:
              agent.status === 'completed' ? '#4CAF50' :
              agent.status === 'running' ? '#FF9800' :
              agent.status === 'error' ? '#F44336' :
              '#9E9E9E',
          }} />
        </div>
        {agent.status === 'running' && (
          <div style={styles.typingIndicator}>
            <span style={styles.typingDot} />
            <span style={{ ...styles.typingDot, animationDelay: '0.2s' }} />
            <span style={{ ...styles.typingDot, animationDelay: '0.4s' }} />
            <span style={styles.typingText}>分析中...</span>
          </div>
        )}
        {agent.status === 'completed' && (
          <>
            <div style={styles.agentSummary}>{agent.summary}</div>
            <div style={styles.agentRecBadge}>
              <span style={{ color: agent.recommendation === 'buy' ? '#4CAF50' : agent.recommendation === 'sell' ? '#F44336' : '#FFC107' }}>
                {agent.recommendation === 'buy' ? {t('看多')} : agent.recommendation === 'sell' ? {t('看空')} : {t('中性')}}
              </span>
              <span style={styles.confidenceBadge}>{agent.confidence}%</span>
            </div>
            <div style={styles.factorList}>
              {agent.keyFactors.map((f, i) => (
                <div key={i} style={styles.factorItem}>• {f}</div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  };

  // ── Render Debate Round ──────────────────────────────────────────────

  const renderDebate = (round: DebateRound) => (
    <div key={round.round} style={styles.debateRound}>
      <div style={styles.debateTitle}>🗣️ 辩论 Round {round.round}</div>
      <div style={styles.debateBars}>
        <div style={styles.barSide}>
          <span style={styles.bullLabel}>🐂 多方</span>
          <div style={styles.barTrack}>
            <div style={{ ...styles.barFill, width: `${round.bullScore}%`, background: '#4CAF50' }} />
          </div>
          <span style={styles.barScore}>{round.bullScore}%</span>
        </div>
        <div style={styles.barSide}>
          <span style={styles.bearLabel}>🐻 空方</span>
          <div style={styles.barTrack}>
            <div style={{ ...styles.barFill, width: `${round.bearScore}%`, background: '#F44336' }} />
          </div>
          <span style={styles.barScore}>{round.bearScore}%</span>
        </div>
      </div>
      <div style={styles.argumentSection}>
        <div style={styles.argColumn}>
          {round.bullArguments.map((a, i) => (
            <div key={i} style={styles.argBull}>✅ {a}</div>
          ))}
        </div>
        <div style={styles.argColumn}>
          {round.bearArguments.map((a, i) => (
            <div key={i} style={styles.argBear}>⚠️ {a}</div>
          ))}
        </div>
      </div>
    </div>
  );

  // ── Render ───────────────────────────────────────────────────────────

  const cfg = TIER_CONFIG[tier];
  const isRunning = stage !== 'idle' && stage !== 'completed' && stage !== 'failed';

  return (
    <div style={styles.container}>
      {/* Header with tier selector */}
      <div style={styles.header}>
        <h3 style={styles.title}>🤖 AI 协作分析</h3>
        <div style={styles.tierSelector}>
          {(['standard', 'premium', 'flagship'] as Tier[]).map(t => (
            <button
              key={t}
              style={{
                ...styles.tierBtn,
                background: tier === t ? '#1a237e' : 'rgba(255,255,255,0.05)',
                borderColor: tier === t ? '#3f51b5' : 'rgba(255,255,255,0.1)',
              }}
              onClick={() => setTier(t)}
              disabled={isRunning}
            >
              {TIER_CONFIG[t].emoji} {TIER_CONFIG[t].label}
              <span style={styles.tierPrice}>{TIER_CONFIG[t].price} USDT</span>
            </button>
          ))}
        </div>
      </div>

      {/* Input area */}
      <div style={styles.inputRow}>
        <input
          style={styles.symbolInput}
          placeholder={t("输入股票代码，如 TQQQ、00700")}
          value={ticker}
          onChange={e => setTicker(e.target.value)}
          disabled={isRunning}
          onKeyDown={e => e.key === 'Enter' && startCollaboration()}
        />
        <button
          style={{
            ...styles.collabBtn,
            opacity: isRunning || !ticker.trim() || !isConnected ? 0.6 : 1,
            cursor: isRunning || !ticker.trim() || !isConnected ? 'not-allowed' : 'pointer',
          }}
          onClick={startCollaboration}
          disabled={isRunning || !ticker.trim() || !isConnected}
        >
          {isRunning ? {t('⏳ 分析中...')} : {t('🚀 AI 协作')}}
        </button>
      </div>

      {/* Progress bar */}
      {isRunning && (
        <div style={styles.progressSection}>
          <div style={styles.progressBar}>
            <div style={{ ...styles.progressFill, width: `${progress}%` }} />
          </div>
          <div style={styles.progressText}>{progressMessage}</div>
          <div style={styles.estimatedTime}>预估耗时: 10-15 秒</div>
        </div>
      )}

      {/* Agent grid */}
      {(isRunning || stage === 'completed') && (
        <div style={styles.agentGrid}>
          {agents.map((agent, i) => renderAgentCard(agent, i < cfg.agents))}
        </div>
      )}

      {/* Debate rounds */}
      {debateRounds.length > 0 && (
        <div style={styles.debateSection}>
          {debateRounds.map(renderDebate)}
        </div>
      )}

      {/* Degradation notice */}
      {degraded && (
        <div style={styles.degradeNotice}>
          ⚠️ 正在使用备用模型: <strong>{degradedModel}</strong> (降级链已触发)
        </div>
      )}

      {/* Cache info */}
      {stage === 'completed' && (
        <div style={styles.cacheInfo}>
          <span>💾 缓存命中率: <strong>{cacheHitRate}%</strong></span>
          <span style={cacheHitRate >= 90 ? styles.cacheGood : styles.cacheWarn}>
            {cacheHitRate >= 90 ? '✅ 达标 (>90%)' : `⚠️ 未达标 (目标 ≥90%)`}
          </span>
          <span>💰 本次费用: <strong>{costEstimate.toFixed(4)} USDT</strong></span>
        </div>
      )}

      {/* Final decision */}
      {finalDecision && (
        <div style={styles.decisionCard}>
          <div style={styles.decisionHeader}>
            <span style={{
              ...styles.decisionBadge,
              background: RECOMMENDATION_COLORS[finalDecision.recommendation] || '#666',
            }}>
              {RECOMMENDATION_LABELS[finalDecision.recommendation]}
            </span>
            <span style={styles.decisionConfidence}>置信度 {finalDecision.confidence}%</span>
          </div>
          <div style={styles.decisionReasoning}>{finalDecision.reasoning}</div>
          <div style={styles.voteGrid}>
            {Object.entries(finalDecision.votes).map(([agent, vote]) => {
              const def = AGENT_DEFS.find(a => a.type === agent);
              return (
                <div key={agent} style={styles.voteItem}>
                  <span>{def?.emoji}</span>
                  <span style={{ color: vote === 'buy' ? '#4CAF50' : vote === 'sell' ? '#F44336' : '#FFC107' }}>
                    {vote === 'buy' ? {t('买入')} : vote === 'sell' ? {t('卖出')} : {t('持有')}}
                  </span>
                </div>
              );
            })}
          </div>
          <div style={styles.decisionActions}>
            <button style={styles.actionBtn}>📋 复制策略</button>
            <button style={{ ...styles.actionBtn, background: '#1a237e' }}>📊 查看详情</button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(63, 81, 181, 0.4); }
          50% { box-shadow: 0 0 0 6px rgba(63, 81, 181, 0); }
        }
        @keyframes typingBounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.3; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

// ── Styles ──────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    padding: 20,
    border: '1px solid rgba(255,255,255,0.08)',
    color: '#e0e0e0',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 12,
  },
  title: {
    margin: 0,
    fontSize: 18,
    fontWeight: 600,
    color: '#fff',
  },
  tierSelector: {
    display: 'flex',
    gap: 8,
  },
  tierBtn: {
    padding: '6px 12px',
    borderRadius: 8,
    border: '1px solid',
    color: '#e0e0e0',
    fontSize: 13,
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 2,
    transition: 'all 0.2s',
  },
  tierPrice: {
    fontSize: 11,
    color: '#999',
  },
  inputRow: {
    display: 'flex',
    gap: 10,
    marginBottom: 16,
  },
  symbolInput: {
    flex: 1,
    padding: '10px 14px',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.05)',
    color: '#fff',
    fontSize: 15,
    outline: 'none',
    fontFamily: 'monospace',
  },
  collabBtn: {
    padding: '10px 24px',
    borderRadius: 8,
    border: 'none',
    background: 'linear-gradient(135deg, #3f51b5, #1a237e)',
    color: '#fff',
    fontWeight: 600,
    fontSize: 15,
    transition: 'all 0.3s',
    whiteSpace: 'nowrap' as const,
  },
  progressSection: {
    marginBottom: 16,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    background: 'rgba(255,255,255,0.1)',
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    background: 'linear-gradient(90deg, #3f51b5, #00BCD4)',
    transition: 'width 0.5s ease',
  },
  progressText: {
    fontSize: 13,
    color: '#b0b0b0',
    marginBottom: 4,
  },
  estimatedTime: {
    fontSize: 11,
    color: '#666',
  },
  agentGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: 12,
    marginBottom: 16,
  },
  agentCard: {
    background: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    padding: 14,
    border: '2px solid transparent',
    transition: 'all 0.3s',
  },
  agentHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  agentEmoji: {
    fontSize: 20,
  },
  agentName: {
    fontSize: 14,
    fontWeight: 600,
    flex: 1,
  },
  agentStatusDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
  },
  typingIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: '#999',
    animation: 'typingBounce 1.4s ease-in-out infinite',
  },
  typingText: {
    fontSize: 12,
    color: '#999',
    marginLeft: 4,
  },
  agentSummary: {
    fontSize: 13,
    color: '#ccc',
    marginBottom: 8,
    lineHeight: 1.4,
  },
  agentRecBadge: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    marginBottom: 6,
    fontSize: 13,
    fontWeight: 600,
  },
  confidenceBadge: {
    fontSize: 11,
    padding: '1px 6px',
    borderRadius: 4,
    background: 'rgba(255,255,255,0.08)',
    color: '#999',
  },
  factorList: {
    fontSize: 12,
    color: '#999',
    lineHeight: 1.6,
  },
  factorItem: {
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  debateSection: {
    marginBottom: 16,
  },
  debateRound: {
    background: 'rgba(255,255,255,0.03)',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    border: '1px solid rgba(255,255,255,0.06)',
  },
  debateTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: '#fff',
    marginBottom: 10,
  },
  debateBars: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
    marginBottom: 12,
  },
  barSide: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  bullLabel: {
    fontSize: 13,
    minWidth: 70,
    color: '#4CAF50',
  },
  bearLabel: {
    fontSize: 13,
    minWidth: 70,
    color: '#F44336',
  },
  barTrack: {
    flex: 1,
    height: 14,
    borderRadius: 7,
    background: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 7,
    transition: 'width 0.8s ease',
  },
  barScore: {
    fontSize: 13,
    fontWeight: 600,
    minWidth: 40,
    textAlign: 'right' as const,
  },
  argumentSection: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
  },
  argColumn: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 4,
  },
  argBull: {
    fontSize: 12,
    color: '#a5d6a7',
    padding: '4px 8px',
    background: 'rgba(76,175,80,0.08)',
    borderRadius: 6,
  },
  argBear: {
    fontSize: 12,
    color: '#ef9a9a',
    padding: '4px 8px',
    background: 'rgba(244,67,54,0.08)',
    borderRadius: 6,
  },
  degradeNotice: {
    padding: '10px 14px',
    borderRadius: 8,
    background: 'rgba(255,152,0,0.15)',
    border: '1px solid rgba(255,152,0,0.3)',
    color: '#FFB74D',
    fontSize: 13,
    marginBottom: 16,
  },
  cacheInfo: {
    display: 'flex',
    gap: 20,
    padding: '10px 14px',
    borderRadius: 8,
    background: 'rgba(255,255,255,0.04)',
    fontSize: 13,
    marginBottom: 16,
    flexWrap: 'wrap' as const,
  },
  cacheGood: {
    color: '#4CAF50',
  },
  cacheWarn: {
    color: '#FF9800',
  },
  decisionCard: {
    background: 'linear-gradient(135deg, rgba(63,81,181,0.12), rgba(26,35,126,0.12))',
    borderRadius: 12,
    padding: 18,
    border: '1px solid rgba(63,81,181,0.2)',
  },
  decisionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  decisionBadge: {
    padding: '6px 18px',
    borderRadius: 8,
    fontSize: 16,
    fontWeight: 700,
    color: '#fff',
  },
  decisionConfidence: {
    fontSize: 14,
    color: '#b0b0b0',
  },
  decisionReasoning: {
    fontSize: 13,
    color: '#ccc',
    lineHeight: 1.6,
    marginBottom: 12,
    padding: 12,
    background: 'rgba(255,255,255,0.04)',
    borderRadius: 8,
  },
  voteGrid: {
    display: 'flex',
    gap: 16,
    marginBottom: 12,
    justifyContent: 'center',
  },
  voteItem: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 4,
    fontSize: 13,
  },
  decisionActions: {
    display: 'flex',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    padding: '8px 16px',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.06)',
    color: '#e0e0e0',
    fontSize: 13,
    cursor: 'pointer',
    fontWeight: 500,
  },
};

export default AgentCollaborationPanel;
