/**
 * LLMCreatorConfigPanel — ML-56-02 [P0]
 * R56: v1.2.0-alpha — LLM 创作者配置面板
 *
 * Features:
 * - 11 家 LLM 选择 (默认 DeepSeek V4 Pro 折后)
 * - 成本预估 (按档位 + 缓存命中率 + 折后失效预警)
 * - 余额提示 (USDT)
 * - 缓存命中率实时显示
 * - 降级链可视化
 * - API key 管理入口
 *
 * ≥250L
 */

import { useTranslation } from "react-i18next";
import React, { useState, useCallback, useMemo } from 'react';

// ── Types ───────────────────────────────────────────────────────────────

export type LLMProvider = 'deepseek' | 'qwen' | 'minimax' | 'zhipu' | 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'moonshot' | 'baichuan' | 'yi';

export interface ProviderInfo {
  id: LLMProvider;
  name: string;
  logo: string;
  models: ModelInfo[];
  enabled: boolean;
  defaultModel: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  displayName: string;
  inputCostPer1M: number;     // USDT per 1M tokens
  outputCostPer1M: number;
  cachedInputCostPer1M?: number;
  cacheDiscountPct?: number;  // e.g. 99 = 99% off
  contextWindow: number;
  capabilities: string[];
  recommended: boolean;
}

export interface CostEstimate {
  tier: 'standard' | 'premium' | 'flagship';
  agentCount: number;
  debateRounds: number;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  llmCost: number;
  price: number;
  profit: number;
  profitRate: number;
  cacheHitRate: number;
  isPromo: boolean;
  promoExpiry?: string;
}

export interface LLMCreatorConfigPanelProps {
  selectedProvider?: LLMProvider;
  selectedModel?: string;
  cacheHitRate?: number;
  balanceUSDT?: number;
  isPromoActive?: boolean;
  promoExpiryDate?: string;
  degradationChain?: string[];
  onProviderChange?: (provider: LLMProvider, model: string) => void;
  onTopUp?: () => void;
}

// ── Provider Catalog ────────────────────────────────────────────────────

const PROVIDER_CATALOG: ProviderInfo[] = [
  {
    id: 'deepseek', name: 'DeepSeek', logo: '🐳',
    enabled: true, defaultModel: 'deepseek-v4-pro-cached',
    models: [
      { id: 'deepseek-v4-pro-cached', name: 'V4 Pro', displayName: 'V4 Pro (Cached 99%)', inputCostPer1M: 0.435, outputCostPer1M: 0.87, cachedInputCostPer1M: 0.003625, cacheDiscountPct: 99, contextWindow: 128000, capabilities: ['chat', 'analysis', 'reasoning', 'code'], recommended: true },
      { id: 'deepseek-v4-pro', name: 'V4 Pro', displayName: 'V4 Pro (Full)', inputCostPer1M: 1.74, outputCostPer1M: 3.48, contextWindow: 128000, capabilities: ['chat', 'analysis', 'reasoning', 'code'], recommended: false },
      { id: 'deepseek-v4-flash', name: 'V4 Flash', displayName: 'V4 Flash (Cached 98%)', inputCostPer1M: 0.14, outputCostPer1M: 0.28, cachedInputCostPer1M: 0.0028, cacheDiscountPct: 98, contextWindow: 128000, capabilities: ['chat', 'analysis', 'code'], recommended: false },
      { id: 'deepseek-r1', name: 'R1', displayName: 'DeepSeek R1 (Reasoning)', inputCostPer1M: 0.55, outputCostPer1M: 2.19, contextWindow: 128000, capabilities: ['reasoning', 'analysis'], recommended: false },
    ],
  },
  {
    id: 'qwen', name: 'Qwen (通义千问)', logo: '☁️',
    enabled: true, defaultModel: 'qwen-turbo',
    models: [
      { id: 'qwen-turbo', name: 'Turbo', displayName: 'Qwen Turbo', inputCostPer1M: 0.2, outputCostPer1M: 0.6, contextWindow: 128000, capabilities: ['chat', 'analysis'], recommended: false },
      { id: 'qwen-max', name: 'Max', displayName: 'Qwen Max', inputCostPer1M: 2.0, outputCostPer1M: 6.0, contextWindow: 128000, capabilities: ['chat', 'analysis', 'reasoning', 'code'], recommended: false },
    ],
  },
  {
    id: 'minimax', name: 'MiniMax', logo: '⚡',
    enabled: true, defaultModel: 'minimax-m3',
    models: [
      { id: 'minimax-m3', name: 'M3', displayName: 'MiniMax M3 (免费)', inputCostPer1M: 0, outputCostPer1M: 0, contextWindow: 204800, capabilities: ['chat', 'analysis', 'code'], recommended: false },
      { id: 'minimax-abab6', name: 'ABAB6', displayName: 'ABAB6.5', inputCostPer1M: 1.0, outputCostPer1M: 1.0, contextWindow: 32768, capabilities: ['chat', 'analysis'], recommended: false },
    ],
  },
  {
    id: 'zhipu', name: '智谱 GLM', logo: '🧠',
    enabled: true, defaultModel: 'glm-4',
    models: [
      { id: 'glm-4', name: 'GLM-4', displayName: 'GLM-4', inputCostPer1M: 1.0, outputCostPer1M: 1.0, contextWindow: 128000, capabilities: ['chat', 'analysis', 'code'], recommended: false },
    ],
  },
  {
    id: 'openai', name: 'OpenAI', logo: '🤖',
    enabled: true, defaultModel: 'gpt-4o',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', displayName: 'GPT-4o', inputCostPer1M: 2.5, outputCostPer1M: 10.0, contextWindow: 128000, capabilities: ['chat', 'analysis', 'reasoning', 'code', 'multimodal'], recommended: false },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', displayName: 'GPT-4o Mini', inputCostPer1M: 0.15, outputCostPer1M: 0.6, contextWindow: 128000, capabilities: ['chat', 'analysis', 'code'], recommended: false },
    ],
  },
  {
    id: 'anthropic', name: 'Anthropic', logo: '🎯',
    enabled: true, defaultModel: 'claude-sonnet',
    models: [
      { id: 'claude-sonnet', name: 'Sonnet', displayName: 'Claude 3.5 Sonnet', inputCostPer1M: 3.0, outputCostPer1M: 15.0, contextWindow: 200000, capabilities: ['chat', 'analysis', 'reasoning', 'code'], recommended: false },
    ],
  },
  {
    id: 'gemini', name: 'Google', logo: '🔮',
    enabled: true, defaultModel: 'gemini-2-pro',
    models: [
      { id: 'gemini-2-pro', name: 'Gemini 2.0 Pro', displayName: 'Gemini 2.0 Pro', inputCostPer1M: 1.25, outputCostPer1M: 5.0, contextWindow: 2000000, capabilities: ['chat', 'analysis', 'reasoning', 'multimodal'], recommended: false },
    ],
  },
  {
    id: 'ollama', name: 'Ollama (本地)', logo: '🦙',
    enabled: true, defaultModel: 'llama3-8b',
    models: [
      { id: 'llama3-8b', name: 'Llama3 8B', displayName: 'Llama3 8B (本地免费)', inputCostPer1M: 0, outputCostPer1M: 0, contextWindow: 8192, capabilities: ['chat'], recommended: false },
    ],
  },
  {
    id: 'moonshot', name: 'Moonshot', logo: '🌙',
    enabled: true, defaultModel: 'moonshot-v1',
    models: [
      { id: 'moonshot-v1', name: 'V1 128K', displayName: 'Moonshot 128K', inputCostPer1M: 0.8, outputCostPer1M: 0.8, contextWindow: 128000, capabilities: ['chat', 'analysis'], recommended: false },
    ],
  },
  {
    id: 'baichuan', name: '百川', logo: '💧',
    enabled: true, defaultModel: 'baichuan4',
    models: [
      { id: 'baichuan4', name: 'Baichuan4', displayName: '百川 4', inputCostPer1M: 1.0, outputCostPer1M: 1.0, contextWindow: 32768, capabilities: ['chat', 'analysis'], recommended: false },
    ],
  },
  {
    id: 'yi', name: '零一万物', logo: '01️⃣',
    enabled: true, defaultModel: 'yi-large',
    models: [
      { id: 'yi-large', name: 'Yi Large', displayName: 'Yi Large', inputCostPer1M: 1.5, outputCostPer1M: 1.5, contextWindow: 32768, capabilities: ['chat', 'analysis', 'reasoning'], recommended: false },
    ],
  },
];

// ── Component ──────────────────────────────────────────────────────────

export const LLMCreatorConfigPanel: React.FC<LLMCreatorConfigPanelProps> = ({
  selectedProvider: initialProvider = 'deepseek',
  selectedModel: initialModel = 'deepseek-v4-pro-cached',
  cacheHitRate = 90,
  balanceUSDT = 100,
  isPromoActive = true,
  promoExpiryDate = '2026-05-31',
  degradationChain = ['deepseek-v4-pro-cached', 'deepseek-v4-pro', 'deepseek-v4-flash', 'minimax-m3'],
  onProviderChange,
  onTopUp,
}) => {
  const [provider, setProvider] = useState<LLMProvider>(initialProvider);
  const [model, setModel] = useState(initialModel);
  const [_expandedProvider, setExpandedProvider] = useState<LLMProvider | null>('deepseek');
  const [showDegradationChain, setShowDegradationChain] = useState(false);

  const currentProvider = useMemo(() =>
    PROVIDER_CATALOG.find(p => p.id === provider) || PROVIDER_CATALOG[0],
    [provider]
  );

  const currentModel = useMemo(() =>
    currentProvider.models.find(m => m.id === model) || currentProvider.models[0],
    [currentProvider, model]
  );

  // ── Cost Calculation ─────────────────────────────────────────────────

  const costEstimates = useMemo((): CostEstimate[] => {
    const tiers: Array<{ tier: CostEstimate['tier']; agents: number; rounds: number; price: number }> = [
      { tier: 'standard', agents: 2, rounds: 2, price: 1.0 },
      { tier: 'premium', agents: 3, rounds: 2, price: 1.5 },
      { tier: 'flagship', agents: 4, rounds: 2, price: 2.0 },
    ];

    return tiers.map(t => {
      const inputTokens = 2000 * t.agents * t.rounds;
      const outputTokens = 500 * t.agents * t.rounds;

      const cachedCost = currentModel.cachedInputCostPer1M ?? currentModel.inputCostPer1M;
      const uncachedCost = currentModel.inputCostPer1M;
      const blendedInputCost = (cachedCost * cacheHitRate / 100) + (uncachedCost * (1 - cacheHitRate / 100));

      const llmCost = (inputTokens / 1_000_000) * blendedInputCost + (outputTokens / 1_000_000) * currentModel.outputCostPer1M;

      return {
        tier: t.tier,
        agentCount: t.agents,
        debateRounds: t.rounds,
        estimatedInputTokens: inputTokens,
        estimatedOutputTokens: outputTokens,
        llmCost: Math.round(llmCost * 1_000_000) / 1_000_000,
        price: t.price,
        profit: Math.round((t.price - llmCost) * 1_000_000) / 1_000_000,
        profitRate: Math.round((1 - llmCost / t.price) * 10000) / 100,
        cacheHitRate,
        isPromo: isPromoActive && currentModel.cacheDiscountPct !== undefined,
        promoExpiry: currentModel.cacheDiscountPct ? promoExpiryDate : undefined,
      };
    });
  }, [currentModel, cacheHitRate, isPromoActive, promoExpiryDate]);

  // ── Handlers ─────────────────────────────────────────────────────────

  const handleProviderSelect = useCallback((p: LLMProvider) => {
    const prov = PROVIDER_CATALOG.find(x => x.id === p);
    setProvider(p);
    const defaultM = prov?.defaultModel || prov?.models[0]?.id || '';
    setModel(defaultM);
    setExpandedProvider(p);
    onProviderChange?.(p, defaultM);
  }, [onProviderChange]);

  const handleModelSelect = useCallback((m: string) => {
    setModel(m);
    onProviderChange?.(provider, m);
  }, [provider, onProviderChange]);

  const promoExpired = !isPromoActive || new Date() > new Date(promoExpiryDate);

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>⚙️ LLM 配置</h3>

      {/* Balance */}
      <div style={styles.balanceRow}>
        <span>💳 余额</span>
        <span style={styles.balanceAmount}>{balanceUSDT.toFixed(2)} USDT</span>
        <button style={styles.topUpBtn} onClick={onTopUp}>{t("components.deposit")}</button>
      </div>

      {/* Provider list */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>选择 LLM 提供商</div>
        <div style={styles.providerGrid}>
          {PROVIDER_CATALOG.map(p => (
            <button
              key={p.id}
              style={{
                ...styles.providerCard,
                borderColor: provider === p.id ? '#3f51b5' : 'rgba(255,255,255,0.1)',
                background: provider === p.id ? 'rgba(63,81,181,0.15)' : 'rgba(255,255,255,0.03)',
              }}
              onClick={() => handleProviderSelect(p.id)}
              title={`${p.name}: ${p.models.length} models`}
            >
              <span style={styles.providerLogo}>{p.logo}</span>
              <span style={styles.providerName}>{p.name}</span>
              {p.models.length > 1 && (
                <span style={styles.modelCount}>{p.models.length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Model selection */}
      {currentProvider.models.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>
            {currentProvider.logo} {currentProvider.name} 模型选择
          </div>
          <div style={styles.modelList}>
            {currentProvider.models.map(m => (
              <div
                key={m.id}
                style={{
                  ...styles.modelRow,
                  borderColor: model === m.id ? '#3f51b5' : 'rgba(255,255,255,0.06)',
                  background: model === m.id ? 'rgba(63,81,181,0.08)' : 'transparent',
                }}
                onClick={() => handleModelSelect(m.id)}
              >
                <div style={styles.modelInfo}>
                  <div style={styles.modelNameRow}>
                    <span style={styles.modelName}>{m.displayName}</span>
                    {m.recommended && <span style={styles.recommendedBadge}>{t("components.recommend")}</span>}
                    {m.cacheDiscountPct && <span style={styles.cacheBadge}>缓存{m.cacheDiscountPct}%off</span>}
                  </div>
                  <div style={styles.modelMeta}>
                    <span>{m.contextWindow.toLocaleString()} tokens</span>
                    <span>•</span>
                    <span>输入 ${m.inputCostPer1M}/M</span>
                    <span>•</span>
                    <span>输出 ${m.outputCostPer1M}/M</span>
                    {m.cachedInputCostPer1M && (
                      <>
                        <span>•</span>
                        <span style={{ color: '#4CAF50' }}>缓存 ${m.cachedInputCostPer1M}/M</span>
                      </>
                    )}
                  </div>
                </div>
                <div style={{
                  ...styles.radio,
                  borderColor: model === m.id ? '#3f51b5' : 'rgba(255,255,255,0.2)',
                }}>
                  {model === m.id && <div style={styles.radioDot} />}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cost estimation table */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>💰 成本预估 (缓存命中率 {cacheHitRate}%)</div>
        <table style={styles.costTable}>
          <thead>
            <tr style={styles.tableHeaderRow}>
              <th style={styles.th}>档位</th>
              <th style={styles.th}>Agent</th>
              <th style={styles.th}>LLM成本</th>
              <th style={styles.th}>售价</th>
              <th style={styles.th}>毛利</th>
              <th style={styles.th}>{t("components.grossMargin")}</th>
            </tr>
          </thead>
          <tbody>
            {costEstimates.map(est => (
              <tr key={est.tier} style={styles.tableRow}>
                <td style={styles.td}>
                  {est.tier === 'flagship' ? '👑 旗舰' : est.tier === 'premium' ? '🔥 高级' : '⚡ 标准'}
                </td>
                <td style={styles.td}>{est.agentCount} 位</td>
                <td style={styles.td}>{est.llmCost.toFixed(4)} USDT</td>
                <td style={styles.td}>{est.price} USDT</td>
                <td style={{ ...styles.td, color: '#4CAF50' }}>{est.profit.toFixed(4)} USDT</td>
                <td style={{ ...styles.td, color: '#4CAF50', fontWeight: 600 }}>{est.profitRate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Promo expiry warning */}
      {promoExpired && (
        <div style={styles.promoWarning}>
          ⚠️ V4 Pro 折后价已于 {promoExpiryDate} 到期。切换到原价或 V4 Flash。
        </div>
      )}

      {/* Degradation chain */}
      <div style={styles.section}>
        <div
          style={styles.collapsibleHeader}
          onClick={() => setShowDegradationChain(!showDegradationChain)}
        >
          <span>🔗 降级链</span>
          <span>{showDegradationChain ? '▼' : '▶'}</span>
        </div>
        {showDegradationChain && (
          <div style={styles.chainVisual}>
            {degradationChain.map((m, i) => {
              const modelInfo = PROVIDER_CATALOG.flatMap(p => p.models).find(x => x.id === m);
              return (
                <React.Fragment key={m}>
                  {i > 0 && <span style={styles.chainArrow}>→</span>}
                  <div style={{
                    ...styles.chainItem,
                    background: i === 0 ? 'rgba(63,81,181,0.2)' : 'rgba(255,255,255,0.05)',
                  }}>
                    <span style={styles.chainIndex}>{i + 1}</span>
                    <span>{modelInfo?.displayName || m}</span>
                    {modelInfo && (
                      <span style={styles.chainCost}>
                        ${modelInfo.inputCostPer1M}/M
                      </span>
                    )}
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>

      {/* Usage summary */}
      <div style={styles.usageSummary}>
        <div style={styles.usageStat}>
          <span style={styles.usageLabel}>缓存命中率</span>
          <span style={{
            ...styles.usageValue,
            color: cacheHitRate >= 90 ? '#4CAF50' : '#FF9800',
          }}>
            {cacheHitRate}%
          </span>
        </div>
        <div style={styles.usageStat}>
          <span style={styles.usageLabel}>当前模型</span>
          <span style={styles.usageValue}>{currentModel.displayName}</span>
        </div>
        <div style={styles.usageStat}>
          <span style={styles.usageLabel}>单次旗舰成本</span>
          <span style={styles.usageValue}>{costEstimates.find(e => e.tier === 'flagship')?.llmCost.toFixed(4)} USDT</span>
        </div>
      </div>
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
  title: {
    margin: '0 0 16px 0',
    fontSize: 18,
    fontWeight: 600,
    color: '#fff',
  },
  balanceRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 16px',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
    marginBottom: 20,
  },
  balanceAmount: {
    fontSize: 20,
    fontWeight: 700,
    color: '#4CAF50',
    fontFamily: 'monospace',
    flex: 1,
  },
  topUpBtn: {
    padding: '6px 16px',
    borderRadius: 8,
    border: '1px solid #3f51b5',
    background: 'rgba(63,81,181,0.15)',
    color: '#7986cb',
    fontSize: 13,
    cursor: 'pointer',
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
  providerGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
    gap: 8,
  },
  providerCard: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 4,
    padding: '10px 8px',
    borderRadius: 10,
    border: '1px solid',
    background: 'transparent',
    cursor: 'pointer',
    transition: 'all 0.2s',
    color: '#e0e0e0',
    fontSize: 12,
  },
  providerLogo: {
    fontSize: 24,
  },
  providerName: {
    fontSize: 11,
    fontWeight: 500,
  },
  modelCount: {
    fontSize: 10,
    padding: '1px 5px',
    borderRadius: 4,
    background: 'rgba(255,255,255,0.1)',
    color: '#999',
  },
  modelList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
  },
  modelRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 14px',
    borderRadius: 8,
    border: '1px solid',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  modelInfo: {
    flex: 1,
  },
  modelNameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  modelName: {
    fontSize: 14,
    fontWeight: 600,
    color: '#fff',
  },
  recommendedBadge: {
    fontSize: 10,
    padding: '1px 6px',
    borderRadius: 4,
    background: 'rgba(63,81,181,0.3)',
    color: '#7986cb',
    fontWeight: 600,
  },
  cacheBadge: {
    fontSize: 10,
    padding: '1px 6px',
    borderRadius: 4,
    background: 'rgba(76,175,80,0.2)',
    color: '#4CAF50',
    fontWeight: 600,
  },
  modelMeta: {
    display: 'flex',
    gap: 6,
    fontSize: 11,
    color: '#888',
    flexWrap: 'wrap' as const,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: '50%',
    border: '2px solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    background: '#3f51b5',
  },
  costTable: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: 13,
  },
  tableHeaderRow: {
    borderBottom: '1px solid rgba(255,255,255,0.1)',
  },
  th: {
    padding: '8px 10px',
    textAlign: 'left' as const,
    color: '#999',
    fontSize: 12,
    fontWeight: 500,
  },
  tableRow: {
    borderBottom: '1px solid rgba(255,255,255,0.05)',
  },
  td: {
    padding: '8px 10px',
    color: '#ccc',
  },
  promoWarning: {
    padding: '10px 14px',
    borderRadius: 8,
    background: 'rgba(255,87,34,0.15)',
    border: '1px solid rgba(255,87,34,0.3)',
    color: '#FF8A65',
    fontSize: 13,
    marginBottom: 20,
  },
  collapsibleHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 14px',
    background: 'rgba(255,255,255,0.04)',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 500,
  },
  chainVisual: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    alignItems: 'center',
    gap: 6,
    padding: '10px 14px',
    marginTop: 8,
  },
  chainArrow: {
    color: '#666',
    fontSize: 16,
    fontWeight: 'bold',
  },
  chainItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    borderRadius: 8,
    fontSize: 12,
    border: '1px solid rgba(255,255,255,0.08)',
  },
  chainIndex: {
    width: 18,
    height: 18,
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 10,
    fontWeight: 600,
  },
  chainCost: {
    fontSize: 10,
    color: '#888',
  },
  usageSummary: {
    display: 'flex',
    gap: 16,
    padding: '14px',
    borderRadius: 10,
    background: 'rgba(255,255,255,0.04)',
    flexWrap: 'wrap' as const,
  },
  usageStat: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 4,
    flex: 1,
    minWidth: 120,
  },
  usageLabel: {
    fontSize: 11,
    color: '#888',
  },
  usageValue: {
    fontSize: 15,
    fontWeight: 600,
    color: '#fff',
    fontFamily: 'monospace',
  },
};

export default LLMCreatorConfigPanel;
