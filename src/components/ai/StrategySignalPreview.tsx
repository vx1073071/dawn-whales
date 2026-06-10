/**
 * StrategySignalPreview — ML-56-03 [P1]
 * R56: v1.2.0-alpha — 策略信号预览 + 4 Agent 决策详情
 *
 * Features:
 * - 保存前预览 + 可编辑参数
 * - 4 Agent 决策详情展示 (每个 Agent 的分析)
 * - 信号参数调节 (方向/置信度/止损/止盈)
 * - 一键保存/分享策略
 *
 * ≥150L
 */

import React, { useState, useCallback } from 'react';

// ── Types ───────────────────────────────────────────────────────────────

export type AgentType = 'fundamentals' | 'sentiment' | 'news' | 'technical';

export interface AgentDecision {
  agentType: AgentType;
  agentName: string;
  emoji: string;
  color: string;
  recommendation: 'buy' | 'sell' | 'hold';
  confidence: number;
  reasoning: string;
  keyFactors: string[];
  riskFlags: string[];
}

export interface SignalPreview {
  symbol: string;
  direction: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  stopLoss: number;
  takeProfit: number;
  timeHorizon: string;
  agentDecisions: AgentDecision[];
  llmProvider: string;
  llmModel: string;
  costUSDT: number;
  cacheHitRate: number;
  generatedAt: string;
}

export interface StrategySignalPreviewProps {
  preview: SignalPreview;
  onSave?: (preview: SignalPreview) => void;
  onEdit?: (preview: SignalPreview) => void;
  onDiscard?: () => void;
}

// ── Component ──────────────────────────────────────────────────────────

export const StrategySignalPreview: React.FC<StrategySignalPreviewProps> = ({
  const { t } = useTranslation();
  preview,
  onSave,
  onEdit,
  onDiscard,
}) => {
  const [editing, setEditing] = useState(false);
  const [editedDirection, setEditedDirection] = useState(preview.direction);
  const [editedConfidence, setEditedConfidence] = useState(preview.confidence);
  const [editedStopLoss, setEditedStopLoss] = useState(preview.stopLoss);
  const [editedTakeProfit, setEditedTakeProfit] = useState(preview.takeProfit);
  const [expandedAgent, setExpandedAgent] = useState<AgentType | null>(null);
  const [saved, setSaved] = useState(false);

  const handleSave = useCallback(() => {
    const edited: SignalPreview = {
      ...preview,
      direction: editedDirection,
      confidence: editedConfidence,
      stopLoss: editedStopLoss,
      takeProfit: editedTakeProfit,
    };
    setSaved(true);
    onSave?.(edited);
    onEdit?.(edited);
  }, [preview, editedDirection, editedConfidence, editedStopLoss, editedTakeProfit, onSave, onEdit]);

  const getDirectionColor = (d: string) => {
    switch (d) {
      case 'BUY': return '#4CAF50';
      case 'SELL': return '#F44336';
      default: return '#FFC107';
    }
  };

  const getConfidenceColor = (c: number) => {
    if (c >= 80) return '#4CAF50';
    if (c >= 60) return '#FFC107';
    return '#FF5722';
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h3 style={styles.title}>{t('strategySignalPreview')}</h3>
        <span style={styles.symbol}>{preview.symbol}</span>
      </div>

      {/* Main signal card */}
      <div style={styles.signalCard}>
        <div style={styles.signalRow}>
          <div style={styles.signalMain}>
            <span style={styles.label}>{t("components.direction")}</span>
            {editing ? (
              <div style={styles.directionBtns}>
                {(['BUY', 'SELL', 'HOLD'] as const).map(d => (
                  <button
                    key={d}
                    style={{
                      ...styles.dirBtn,
                      background: editedDirection === d ? getDirectionColor(d) : 'rgba(255,255,255,0.05)',
                      color: editedDirection === d ? '#fff' : '#999',
                    }}
                    onClick={() => setEditedDirection(d)}
                  >
                    {d === 'BUY' ? t('components.buy') : d === 'SELL' ? t('components.sell') : t('hold')}
                  </button>
                ))}
              </div>
            ) : (
              <span style={{ ...styles.signalValue, color: getDirectionColor(editedDirection), fontSize: 22 }}>
                {editedDirection === 'BUY' ? '📈 买入' : editedDirection === 'SELL' ? '📉 卖出' : '⏸️ 持有'}
              </span>
            )}
          </div>

          <div style={styles.signalMain}>
            <span style={styles.label}>置信度</span>
            {editing ? (
              <div style={styles.confidenceSlider}>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={editedConfidence}
                  onChange={e => setEditedConfidence(Number(e.target.value))}
                  style={styles.slider}
                />
                <span style={{ ...styles.signalValue, color: getConfidenceColor(editedConfidence) }}>
                  {editedConfidence}%
                </span>
              </div>
            ) : (
              <div style={styles.confidenceBar}>
                <div style={styles.confTrack}>
                  <div style={{
                    ...styles.confFill,
                    width: `${editedConfidence}%`,
                    background: getConfidenceColor(editedConfidence),
                  }} />
                </div>
                <span style={styles.signalValue}>{editedConfidence}%</span>
              </div>
            )}
          </div>
        </div>

        {/* Stop Loss / Take Profit */}
        <div style={styles.slTpRow}>
          <div style={styles.slTpItem}>
            <span style={styles.label}>🛑 止损</span>
            {editing ? (
              <input
                type="number"
                style={styles.slTpInput}
                value={editedStopLoss}
                onChange={e => setEditedStopLoss(Number(e.target.value))}
                step={0.01}
              />
            ) : (
              <span style={styles.signalValue}>{editedStopLoss.toFixed(2)}</span>
            )}
          </div>
          <div style={styles.slTpItem}>
            <span style={styles.label}>🎯 止盈</span>
            {editing ? (
              <input
                type="number"
                style={styles.slTpInput}
                value={editedTakeProfit}
                onChange={e => setEditedTakeProfit(Number(e.target.value))}
                step={0.01}
              />
            ) : (
              <span style={styles.signalValue}>{editedTakeProfit.toFixed(2)}</span>
            )}
          </div>
          <div style={styles.slTpItem}>
            <span style={styles.label}>⏰ 时间周期</span>
            <span style={styles.signalValue}>{preview.timeHorizon}</span>
          </div>
        </div>
      </div>

      {/* Agent decisions detail */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>🤖 4 Agent 决策详情</div>
        {preview.agentDecisions.map(ad => (
          <div
            key={ad.agentType}
            style={{
              ...styles.agentRow,
              borderColor: expandedAgent === ad.agentType ? ad.color : 'rgba(255,255,255,0.08)',
            }}
          >
            <div
              style={styles.agentRowHeader}
              onClick={() => setExpandedAgent(expandedAgent === ad.agentType ? null : ad.agentType)}
            >
              <span style={styles.agentEmoji}>{ad.emoji}</span>
              <span style={styles.agentName}>{ad.agentName}</span>
              <span style={{ ...styles.agentVote, color: getDirectionColor(ad.recommendation === 'buy' ? 'BUY' : ad.recommendation === 'sell' ? 'SELL' : 'HOLD') }}>
                {ad.recommendation === 'buy' ? '看多' : ad.recommendation === 'sell' ? '看空' : t('components.neutral')}
              </span>
              <span style={{
                ...styles.agentConf,
                color: getConfidenceColor(ad.confidence),
              }}>
                {ad.confidence}%
              </span>
              <span style={styles.expandIcon}>{expandedAgent === ad.agentType ? '▼' : '▶'}</span>
            </div>

            {expandedAgent === ad.agentType && (
              <div style={styles.agentDetail}>
                <div style={styles.agentReasoning}>{ad.reasoning}</div>
                <div style={styles.factorSection}>
                  <div style={styles.factorTitle}>✅ 关键因素</div>
                  {ad.keyFactors.map((f, i) => (
                    <div key={i} style={styles.factorItem}>• {f}</div>
                  ))}
                </div>
                {ad.riskFlags.length > 0 && (
                  <div style={styles.riskSection}>
                    <div style={styles.riskTitle}>⚠️ 风险提示</div>
                    {ad.riskFlags.map((r, i) => (
                      <div key={i} style={styles.riskItem}>⚠️ {r}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Metadata */}
      <div style={styles.metaRow}>
        <span>💾 缓存命中率: <strong>{preview.cacheHitRate}%</strong></span>
        <span>💰 本次费用: <strong>{preview.costUSDT.toFixed(4)} USDT</strong></span>
        <span>🔧 {preview.llmProvider} / {preview.llmModel}</span>
      </div>

      {/* Actions */}
      {!saved ? (
        <div style={styles.actions}>
          {!editing ? (
            <>
              <button style={styles.editBtn} onClick={() => setEditing(true)}>
                ✏️ 编辑参数
              </button>
              <button style={styles.saveBtn} onClick={handleSave}>
                💾 保存策略
              </button>
              <button style={styles.discardBtn} onClick={onDiscard}>
                🗑️ 放弃
              </button>
            </>
          ) : (
            <>
              <button style={styles.cancelBtn} onClick={() => setEditing(false)}>{t('cancel')}</button>
              <button style={styles.confirmBtn} onClick={() => {
                setEditing(false);
                handleSave();
              }}>
                ✅ 确认保存
              </button>
            </>
          )}
        </div>
      ) : (
        <div style={styles.savedMessage}>
          ✅ 策略已保存！
        </div>
      )}
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
  },
  title: {
    margin: 0,
    fontSize: 18,
    fontWeight: 600,
    color: '#fff',
  },
  symbol: {
    fontSize: 18,
    fontWeight: 700,
    fontFamily: 'monospace',
    padding: '4px 12px',
    borderRadius: 6,
    background: 'rgba(63,81,181,0.2)',
    color: '#7986cb',
  },
  signalCard: {
    padding: 18,
    borderRadius: 12,
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
    marginBottom: 20,
  },
  signalRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 24,
    marginBottom: 16,
  },
  signalMain: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
  },
  label: {
    fontSize: 12,
    color: '#888',
    fontWeight: 500,
  },
  signalValue: {
    fontSize: 18,
    fontWeight: 700,
    fontFamily: 'monospace',
  },
  directionBtns: {
    display: 'flex',
    gap: 8,
  },
  dirBtn: {
    padding: '8px 18px',
    borderRadius: 8,
    border: 'none',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  confidenceSlider: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  slider: {
    flex: 1,
    accentColor: '#3f51b5',
  },
  confidenceBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  confTrack: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    background: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  confFill: {
    height: '100%',
    borderRadius: 5,
    transition: 'width 0.5s ease',
  },
  slTpRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: 16,
  },
  slTpItem: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 6,
  },
  slTpInput: {
    padding: '6px 10px',
    borderRadius: 6,
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.05)',
    color: '#fff',
    fontSize: 14,
    width: '100%',
    fontFamily: 'monospace',
    outline: 'none',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: '#b0b0b0',
    marginBottom: 10,
  },
  agentRow: {
    borderRadius: 8,
    border: '1px solid',
    marginBottom: 6,
    overflow: 'hidden',
    transition: 'all 0.2s',
  },
  agentRowHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 14px',
    cursor: 'pointer',
    background: 'rgba(255,255,255,0.03)',
  },
  agentEmoji: {
    fontSize: 18,
  },
  agentName: {
    fontSize: 14,
    fontWeight: 600,
    flex: 1,
  },
  agentVote: {
    fontSize: 13,
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 4,
    background: 'rgba(255,255,255,0.06)',
  },
  agentConf: {
    fontSize: 13,
    fontWeight: 700,
    fontFamily: 'monospace',
  },
  expandIcon: {
    fontSize: 10,
    color: '#666',
  },
  agentDetail: {
    padding: '12px 14px',
    borderTop: '1px solid rgba(255,255,255,0.06)',
  },
  agentReasoning: {
    fontSize: 13,
    color: '#ccc',
    lineHeight: 1.5,
    marginBottom: 10,
    padding: 10,
    background: 'rgba(255,255,255,0.03)',
    borderRadius: 6,
  },
  factorSection: {
    marginBottom: 8,
  },
  factorTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: '#4CAF50',
    marginBottom: 4,
  },
  factorItem: {
    fontSize: 12,
    color: '#a5d6a7',
    padding: '2px 8px',
  },
  riskSection: {
    marginTop: 8,
  },
  riskTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: '#FF9800',
    marginBottom: 4,
  },
  riskItem: {
    fontSize: 12,
    color: '#FFB74D',
    padding: '2px 8px',
  },
  metaRow: {
    display: 'flex',
    gap: 20,
    padding: '10px 14px',
    borderRadius: 8,
    background: 'rgba(255,255,255,0.04)',
    fontSize: 12,
    color: '#999',
    flexWrap: 'wrap' as const,
    marginBottom: 20,
  },
  actions: {
    display: 'flex',
    gap: 10,
  },
  editBtn: {
    padding: '10px 20px',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.06)',
    color: '#e0e0e0',
    fontSize: 14,
    cursor: 'pointer',
  },
  saveBtn: {
    padding: '10px 24px',
    borderRadius: 8,
    border: 'none',
    background: 'linear-gradient(135deg, #3f51b5, #1a237e)',
    color: '#fff',
    fontWeight: 600,
    fontSize: 14,
    cursor: 'pointer',
    flex: 1,
  },
  discardBtn: {
    padding: '10px 20px',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'transparent',
    color: '#999',
    fontSize: 14,
    cursor: 'pointer',
  },
  cancelBtn: {
    padding: '10px 20px',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.05)',
    color: '#e0e0e0',
    fontSize: 14,
    cursor: 'pointer',
  },
  confirmBtn: {
    padding: '10px 24px',
    borderRadius: 8,
    border: 'none',
    background: 'linear-gradient(135deg, #4CAF50, #2E7D32)',
    color: '#fff',
    fontWeight: 600,
    fontSize: 14,
    cursor: 'pointer',
    flex: 1,
  },
  savedMessage: {
    padding: '12px 20px',
    borderRadius: 8,
    background: 'rgba(76,175,80,0.15)',
    border: '1px solid rgba(76,175,80,0.3)',
    color: '#4CAF50',
    fontSize: 15,
    fontWeight: 600,
    textAlign: 'center' as const,
  },
};

export default StrategySignalPreview;
