/**
 * CreatorLLMConfigPanel — ML-58-01 [P0]
 * R58: v1.2.0-rc — Creator LLM configuration + budget management
 *
 * Features:
 * - 11 LLM provider selection with status (online/offline/rate-limited)
 * - Model picker per provider with pricing info
 * - Monthly budget slider + current usage tracking
 * - Alert thresholds (80% yellow / 100% red auto-stop)
 * - Cost estimator: input symbol count → estimated USDT
 * - Real-time balance + recharge CTA
 * - Per-agent toggle (fundamental/technical/sentiment/macro)
 */

import React, { useState, useCallback, useMemo } from 'react';

// ── Types ───────────────────────────────────────────────────────────────

export interface LLMProvider {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'rate-limited';
  models: LLMModel[];
  region: 'cn' | 'global' | 'both';
  defaultModel: string;
}

export interface LLMModel {
  id: string;
  name: string;
  contextWindow: number;
  inputPrice: number;      // USDT per 1M tokens
  outputPrice: number;
  cacheDiscount: number;   // 0-1 (e.g. 0.99 = 99% off)
  capability: string[];    // ['chat', 'reasoning', 'structured']
}

export interface CreatorBudget {
  monthlyLimit: number;       // USDT
  currentUsage: number;       // USDT this month
  alertThreshold: number;     // 0-1 (e.g. 0.8 = 80%)
  exceeded: boolean;
}

export interface AgentToggle {
  id: string; name: string; enabled: boolean; estimatedCost: number;
}

export interface CreatorLLMConfigPanelProps {
  providers?: LLMProvider[];
  budget?: CreatorBudget;
  agents?: AgentToggle[];
  onProviderChange?: (providerId: string, modelId: string) => void;
  onBudgetChange?: (limit: number, threshold: number) => void;
  onAgentToggle?: (agentId: string, enabled: boolean) => void;
  onRecharge?: () => void;
  className?: string;
}

// ── Mock data ───────────────────────────────────────────────────────────

const mockProviders: LLMProvider[] = [
  { id: 'deepseek', name: 'DeepSeek', status: 'online', region: 'both',
    models: [
      { id: 'deepseek-v4-pro', name: 'V4 Pro', contextWindow: 128000, inputPrice: 0.50, outputPrice: 2.00, cacheDiscount: 0.99, capability: ['chat', 'reasoning', 'structured'] },
      { id: 'deepseek-v4-flash', name: 'V4 Flash', contextWindow: 128000, inputPrice: 0.10, outputPrice: 0.40, cacheDiscount: 0.95, capability: ['chat', 'structured'] },
      { id: 'deepseek-v4-reasoner', name: 'V4 Reasoner', contextWindow: 64000, inputPrice: 0.50, outputPrice: 2.00, cacheDiscount: 0.99, capability: ['reasoning', 'structured'] },
    ],
    defaultModel: 'deepseek-v4-pro',
  },
  { id: 'qwen', name: 'Qwen (Alibaba)', status: 'online', region: 'both',
    models: [
      { id: 'qwen-3.6-pro', name: 'Qwen 3.6 Pro', contextWindow: 131072, inputPrice: 0.35, outputPrice: 1.40, cacheDiscount: 0.90, capability: ['chat', 'structured'] },
      { id: 'qwen-3.6-flash', name: 'Qwen 3.6 Flash', contextWindow: 131072, inputPrice: 0.07, outputPrice: 0.28, cacheDiscount: 0.85, capability: ['chat'] },
    ],
    defaultModel: 'qwen-3.6-pro',
  },
  { id: 'minimax', name: 'MiniMax', status: 'online', region: 'both',
    models: [
      { id: 'minimax-m3', name: 'M3', contextWindow: 204000, inputPrice: 0.20, outputPrice: 0.80, cacheDiscount: 0.80, capability: ['chat', 'reasoning', 'structured'] },
    ],
    defaultModel: 'minimax-m3',
  },
  { id: 'glm', name: 'GLM (Zhipu)', status: 'online', region: 'both',
    models: [
      { id: 'glm-5.1', name: 'GLM 5.1', contextWindow: 128000, inputPrice: 0.30, outputPrice: 1.20, cacheDiscount: 0.85, capability: ['chat', 'structured'] },
    ],
    defaultModel: 'glm-5.1',
  },
  { id: 'openai', name: 'OpenAI', status: 'online', region: 'global',
    models: [
      { id: 'gpt-5.5', name: 'GPT-5.5', contextWindow: 256000, inputPrice: 2.50, outputPrice: 10.00, cacheDiscount: 0.50, capability: ['chat', 'reasoning', 'structured'] },
    ],
    defaultModel: 'gpt-5.5',
  },
  { id: 'anthropic', name: 'Anthropic', status: 'online', region: 'global',
    models: [
      { id: 'claude-opus-4.7', name: 'Claude Opus 4.7', contextWindow: 200000, inputPrice: 15.00, outputPrice: 75.00, cacheDiscount: 0.90, capability: ['chat', 'reasoning', 'structured'] },
    ],
    defaultModel: 'claude-opus-4.7',
  },
  { id: 'google', name: 'Google', status: 'rate-limited', region: 'global',
    models: [
      { id: 'gemini-3.1-pro', name: 'Gemini 3.1 Pro', contextWindow: 1000000, inputPrice: 1.25, outputPrice: 5.00, cacheDiscount: 0.75, capability: ['chat', 'reasoning', 'structured'] },
    ],
    defaultModel: 'gemini-3.1-pro',
  },
  { id: 'ollama', name: 'Ollama (Local)', status: 'offline', region: 'both',
    models: [
      { id: 'llama-4', name: 'Llama 4', contextWindow: 128000, inputPrice: 0, outputPrice: 0, cacheDiscount: 0, capability: ['chat'] },
    ],
    defaultModel: 'llama-4',
  },
  { id: 'moonshot', name: 'Moonshot (Kimi)', status: 'online', region: 'cn',
    models: [
      { id: 'kimi-k2.6', name: 'Kimi K2.6', contextWindow: 128000, inputPrice: 0.40, outputPrice: 1.60, cacheDiscount: 0.70, capability: ['chat', 'reasoning'] },
    ],
    defaultModel: 'kimi-k2.6',
  },
];

const mockBudget: CreatorBudget = {
  monthlyLimit: 50,
  currentUsage: 12.35,
  alertThreshold: 0.8,
  exceeded: false,
};

const mockAgents: AgentToggle[] = [
  { id: 'fundamentals', name: 'Fundamentals Agent', enabled: true, estimatedCost: 0.003 },
  { id: 'technical', name: 'Technical Agent', enabled: true, estimatedCost: 0.002 },
  { id: 'sentiment', name: 'Sentiment Agent', enabled: true, estimatedCost: 0.002 },
  { id: 'macro', name: 'Macro Agent', enabled: false, estimatedCost: 0.003 },
];

// ── Sub-components ──────────────────────────────────────────────────────

const StatusDot: React.FC<{ status: LLMProvider['status'] }> = ({ status }) => {
  const colors = { online: '#22c55e', offline: '#6b7280', 'rate-limited': '#f59e0b' };
  const labels = { online: 'Online', offline: 'Offline', 'rate-limited': 'Limited' };
  return (
    <span className="creator-status-dot" style={{ color: colors[status] }} title={labels[status]}>
      ● {labels[status]}
    </span>
  );
};

const BudgetGauge: React.FC<{ budget: CreatorBudget }> = ({ budget }) => {
  const pct = Math.min((budget.currentUsage / budget.monthlyLimit) * 100, 100);
  const barColor = pct >= 100 ? '#ef4444' : pct >= budget.alertThreshold * 100 ? '#f59e0b' : '#22c55e';
  return (
    <div className="creator-budget-gauge">
      <div className="creator-budget-labels">
        <span className="creator-budget-used">${budget.currentUsage.toFixed(2)} used</span>
        <span className="creator-budget-remaining">${(budget.monthlyLimit - budget.currentUsage).toFixed(2)} left</span>
      </div>
      <div className="creator-budget-bar">
        <div className="creator-budget-fill" style={{ width: `${pct}%`, backgroundColor: barColor }} />
        <div className="creator-budget-threshold" style={{ left: `${budget.alertThreshold * 100}%` }} title="Alert threshold" />
      </div>
      <div className="creator-budget-meta">
        <span>${budget.monthlyLimit}/mo limit</span>
        <span className="creator-budget-threshold-label">Alert at {budget.alertThreshold * 100}%</span>
      </div>
    </div>
  );
};

const ProviderCard: React.FC<{
  provider: LLMProvider;
  selectedModelId: string;
  onSelect: (modelId: string) => void;
}> = ({ provider, selectedModelId, onSelect }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={`creator-provider-card ${expanded ? 'expanded' : ''}`} onClick={() => setExpanded(!expanded)}>
      <div className="creator-provider-header">
        <div className="creator-provider-name">
          <span>{provider.name}</span>
          <span className="creator-provider-region">{provider.region === 'cn' ? '🇨🇳' : provider.region === 'global' ? '🌍' : '🌏'}</span>
        </div>
        <StatusDot status={provider.status} />
      </div>
      {expanded && (
        <div className="creator-provider-models">
          {provider.models.map((model) => {
            const isSelected = model.id === selectedModelId;
            const effectivePrice = model.inputPrice * (1 - model.cacheDiscount);
            return (
              <div
                key={model.id}
                className={`creator-model-row ${isSelected ? 'selected' : ''}`}
                onClick={(e) => { e.stopPropagation(); onSelect(model.id); }}
              >
                <div className="creator-model-info">
                  <span className="creator-model-name">{model.name}</span>
                  <span className="creator-model-ctx">{model.contextWindow >= 1000 ? `${Math.round(model.contextWindow / 1000)}K ctx` : `${model.contextWindow} ctx`}</span>
                </div>
                <div className="creator-model-price">
                  <span className="creator-price-original">${model.inputPrice.toFixed(2)}/M</span>
                  {model.cacheDiscount > 0 && (
                    <span className="creator-price-cached">→ ${effectivePrice.toFixed(4)} cached</span>
                  )}
                </div>
                {isSelected && <span className="creator-model-selected">✓ Active</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ── Main Component ──────────────────────────────────────────────────────

const CreatorLLMConfigPanel: React.FC<CreatorLLMConfigPanelProps> = ({
  providers: propProviders,
  budget: propBudget,
  agents: propAgents,
  onProviderChange,
  onBudgetChange,
  onAgentToggle,
  onRecharge,
  className = '',
}) => {
  const [selectedProvider, setSelectedProvider] = useState('deepseek');
  const [selectedModel, setSelectedModel] = useState('deepseek-v4-pro');
  const [budget, setBudget] = useState<CreatorBudget>(propBudget || mockBudget);
  const [agents, setAgents] = useState<AgentToggle[]>(propAgents || mockAgents);
  const [budgetLimit, setBudgetLimit] = useState(budget.monthlyLimit);
  const [alertPct, setAlertPct] = useState(budget.alertThreshold * 100);
  const [symbolCount, setSymbolCount] = useState(5);

  const providers = propProviders || mockProviders;

  const handleProviderModelChange = useCallback((provId: string, modelId: string) => {
    setSelectedProvider(provId);
    setSelectedModel(modelId);
    onProviderChange?.(provId, modelId);
  }, [onProviderChange]);

  const handleBudgetSave = useCallback(() => {
    const newBudget: CreatorBudget = {
      ...budget,
      monthlyLimit: budgetLimit,
      alertThreshold: alertPct / 100,
      exceeded: budget.currentUsage > budgetLimit,
    };
    setBudget(newBudget);
    onBudgetChange?.(budgetLimit, alertPct / 100);
  }, [budget, budgetLimit, alertPct, onBudgetChange]);

  const estimatedCost = useMemo(() => {
    const activeAgents = agents.filter((a) => a.enabled);
    const costPerAgent = 0.003; // ~avg per analysis
    const arenaMultiplier = 3; // 3 models in arena
    return activeAgents.length * costPerAgent * symbolCount * arenaMultiplier;
  }, [agents, symbolCount]);

  const estimatedMonthlyCost = useMemo(() => {
    const dailyAnalyses = 5; // ~5 analyses per day as creator
    return estimatedCost * dailyAnalyses * 30;
  }, [estimatedCost]);

  return (
    <div className={`creator-llm-config ${className}`}>
      <h2 className="creator-title">⚙️ LLM Configuration</h2>

      {/* ── Budget Overview ─────────────────────────── */}
      <div className="creator-section">
        <h3 className="creator-section-title">💰 Budget</h3>
        <BudgetGauge budget={budget} />
        <div className="creator-budget-editor">
          <div className="creator-budget-row">
            <label>Monthly Limit (USDT)</label>
            <div className="creator-budget-slider-group">
              <input type="range" min={5} max={500} step={5} value={budgetLimit}
                onChange={(e) => setBudgetLimit(Number(e.target.value))} />
              <span className="creator-budget-value">${budgetLimit}</span>
            </div>
          </div>
          <div className="creator-budget-row">
            <label>Alert at</label>
            <div className="creator-budget-slider-group">
              <input type="range" min={50} max={100} step={5} value={alertPct}
                onChange={(e) => setAlertPct(Number(e.target.value))} />
              <span className="creator-budget-value">{alertPct}%</span>
            </div>
          </div>
          <button className="creator-btn-save" onClick={handleBudgetSave}>Save Budget</button>
        </div>
      </div>

      {/* ── Provider Selection ──────────────────────── */}
      <div className="creator-section">
        <h3 className="creator-section-title">🔌 LLM Provider</h3>
        <div className="creator-provider-grid">
          {providers.map((p) => (
            <ProviderCard
              key={p.id}
              provider={p}
              selectedModelId={p.id === selectedProvider ? selectedModel : ''}
              onSelect={(modelId) => handleProviderModelChange(p.id, modelId)}
            />
          ))}
        </div>
      </div>

      {/* ── Agent Configuration ─────────────────────── */}
      <div className="creator-section">
        <h3 className="creator-section-title">🤖 Active Agents</h3>
        <div className="creator-agent-list">
          {agents.map((agent) => (
            <div key={agent.id} className="creator-agent-row">
              <div className="creator-agent-info">
                <span className="creator-agent-name">{agent.name}</span>
                <span className="creator-agent-cost">~${agent.estimatedCost.toFixed(4)}/analysis</span>
              </div>
              <label className="creator-toggle">
                <input type="checkbox" checked={agent.enabled}
                  onChange={(e) => {
                    setAgents((prev) => prev.map((a) => a.id === agent.id ? { ...a, enabled: e.target.checked } : a));
                    onAgentToggle?.(agent.id, e.target.checked);
                  }} />
                <span className="creator-toggle-slider" />
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* ── Cost Estimator ──────────────────────────── */}
      <div className="creator-section">
        <h3 className="creator-section-title">📊 Cost Estimator</h3>
        <div className="creator-estimator">
          <div className="creator-estimator-row">
            <label>Symbols per analysis</label>
            <input type="number" min={1} max={100} value={symbolCount}
              onChange={(e) => setSymbolCount(Number(e.target.value))} />
          </div>
          <div className="creator-estimator-result">
            <div className="creator-estimate-item">
              <span className="creator-estimate-value">${estimatedCost.toFixed(3)}</span>
              <span className="creator-estimate-label">Per Arena Analysis</span>
            </div>
            <div className="creator-estimate-item">
              <span className="creator-estimate-value">${estimatedMonthlyCost.toFixed(2)}</span>
              <span className="creator-estimate-label">Est. Monthly (5×/day)</span>
            </div>
            <div className={`creator-estimate-item ${estimatedMonthlyCost > budget.monthlyLimit ? 'over-budget' : ''}`}>
              <span className="creator-estimate-value">
                {estimatedMonthlyCost > budget.monthlyLimit ? '⚠️ Over' : 'OK'}
              </span>
              <span className="creator-estimate-label">vs ${budget.monthlyLimit}/mo limit</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Balance + Recharge ──────────────────────── */}
      <div className="creator-balance-bar">
        <span>Balance: <strong>${(budget.monthlyLimit - budget.currentUsage).toFixed(2)} USDT</strong></span>
        <button className="creator-btn-recharge" onClick={onRecharge}>+ Recharge</button>
      </div>
    </div>
  );
};

// ── CSS ──────────────────────────────────────────────────────────────────

export const CREATOR_LLM_STYLES = `
.creator-llm-config { max-width: 800px; margin: 0 auto; padding: 24px; }
.creator-title { font-size: 22px; font-weight: 700; margin: 0 0 20px 0; }

.creator-section { margin-bottom: 24px; padding: 20px; border-radius: 12px; background: var(--card-bg, rgba(255,255,255,0.05)); border: 1px solid var(--border-color, rgba(255,255,255,0.08)); }
.creator-section-title { font-size: 15px; font-weight: 600; margin: 0 0 14px 0; }

/* Budget */
.creator-budget-gauge { margin-bottom: 12px; }
.creator-budget-labels { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px; }
.creator-budget-used { color: var(--text-secondary, #94a3b8); }
.creator-budget-remaining { font-weight: 600; }
.creator-budget-bar { height: 8px; border-radius: 4px; background: rgba(255,255,255,0.06); position: relative; overflow: visible; }
.creator-budget-fill { height: 100%; border-radius: 4px; transition: width 0.5s ease; }
.creator-budget-threshold { position: absolute; top: -3px; width: 2px; height: 14px; background: #f59e0b; }
.creator-budget-meta { display: flex; justify-content: space-between; margin-top: 6px; font-size: 11px; color: var(--text-secondary, #94a3b8); }
.creator-budget-threshold-label { color: #f59e0b; }

.creator-budget-editor { margin-top: 14px; }
.creator-budget-row { margin-bottom: 10px; }
.creator-budget-row label { display: block; font-size: 12px; color: var(--text-secondary, #94a3b8); margin-bottom: 4px; }
.creator-budget-slider-group { display: flex; align-items: center; gap: 12px; }
.creator-budget-slider-group input[type="range"] { flex: 1; }
.creator-budget-value { font-size: 16px; font-weight: 700; min-width: 50px; }
.creator-btn-save { padding: 8px 20px; border-radius: 8px; border: none; background: #3b82f6; color: #fff; font-size: 13px; font-weight: 600; cursor: pointer; margin-top: 8px; }

/* Providers */
.creator-provider-grid { display: flex; flex-direction: column; gap: 8px; }
.creator-provider-card { padding: 12px 16px; border-radius: 10px; border: 1px solid var(--border-color, rgba(255,255,255,0.08)); cursor: pointer; transition: all 0.15s; }
.creator-provider-card:hover { border-color: #3b82f640; }
.creator-provider-card.expanded { border-color: #3b82f6; background: rgba(59,130,246,0.03); }
.creator-provider-header { display: flex; justify-content: space-between; align-items: center; }
.creator-provider-name { font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 6px; }
.creator-provider-region { font-size: 12px; }
.creator-status-dot { font-size: 11px; font-weight: 500; }

.creator-provider-models { margin-top: 12px; display: flex; flex-direction: column; gap: 6px; }
.creator-model-row { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-radius: 8px; border: 1px solid var(--border-color, rgba(255,255,255,0.06)); transition: all 0.15s; cursor: pointer; }
.creator-model-row:hover { background: rgba(59,130,246,0.05); }
.creator-model-row.selected { border-color: #3b82f6; background: rgba(59,130,246,0.08); }
.creator-model-info { flex: 1; }
.creator-model-name { font-size: 13px; font-weight: 500; display: block; }
.creator-model-ctx { font-size: 10px; color: var(--text-secondary, #94a3b8); }
.creator-model-price { display: flex; gap: 6px; align-items: center; font-size: 12px; }
.creator-price-original { color: var(--text-secondary, #94a3b8); text-decoration: line-through; }
.creator-price-cached { color: #22c55e; font-weight: 600; }
.creator-model-selected { font-size: 11px; color: #22c55e; font-weight: 600; }

/* Agents */
.creator-agent-list { display: flex; flex-direction: column; gap: 8px; }
.creator-agent-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-radius: 8px; border: 1px solid var(--border-color, rgba(255,255,255,0.06)); }
.creator-agent-name { font-size: 14px; font-weight: 500; display: block; }
.creator-agent-cost { font-size: 11px; color: var(--text-secondary, #94a3b8); }

.creator-toggle { position: relative; width: 44px; height: 24px; flex-shrink: 0; }
.creator-toggle input { opacity: 0; width: 0; height: 0; }
.creator-toggle-slider { position: absolute; inset: 0; background: #374151; border-radius: 24px; cursor: pointer; transition: 0.2s; }
.creator-toggle-slider::before { content: ''; position: absolute; width: 18px; height: 18px; left: 3px; bottom: 3px; background: #fff; border-radius: 50%; transition: 0.2s; }
.creator-toggle input:checked + .creator-toggle-slider { background: #22c55e; }
.creator-toggle input:checked + .creator-toggle-slider::before { transform: translateX(20px); }

/* Estimator */
.creator-estimator-row { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
.creator-estimator-row label { font-size: 13px; color: var(--text-secondary, #94a3b8); }
.creator-estimator-row input { width: 80px; padding: 6px 10px; border-radius: 6px; border: 1px solid var(--border-color, rgba(255,255,255,0.12)); background: rgba(255,255,255,0.05); color: var(--text-primary, #e2e8f0); font-size: 14px; text-align: center; }
.creator-estimator-result { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.creator-estimate-item { display: flex; flex-direction: column; align-items: center; padding: 12px; border-radius: 8px; background: rgba(255,255,255,0.03); }
.creator-estimate-item.over-budget { background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.15); }
.creator-estimate-value { font-size: 18px; font-weight: 700; }
.creator-estimate-label { font-size: 10px; color: var(--text-secondary, #94a3b8); margin-top: 2px; }

.creator-balance-bar { display: flex; justify-content: space-between; align-items: center; padding: 14px 20px; border-radius: 10px; background: rgba(59,130,246,0.06); border: 1px solid rgba(59,130,246,0.12); font-size: 14px; }
.creator-btn-recharge { padding: 8px 20px; border-radius: 8px; border: none; background: #22c55e; color: #fff; font-size: 13px; font-weight: 600; cursor: pointer; }

@media (max-width: 768px) {
  .creator-provider-grid { gap: 4px; }
  .creator-estimator-result { grid-template-columns: 1fr; }
}
`;

export default CreatorLLMConfigPanel;
