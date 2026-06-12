// R125-Q01: ts-nocheck cleared
// src/components/trading/ConditionRulePanel.tsx
// conditionrule — Phase 4.2 R30 Q-30-02

import { useState, useCallback } from 'react';
import type { ConditionRule, PriceCondition, TriggerEvent } from '../../../electron/types/condition.js';
import i18n from '../../i18n';
interface Props {
  onBack?: () => void;
}

// ── Mock IPC (real implementation uses window.api) ──────────────────────────────

const mockEngine = {
  rules: [] as ConditionRule[],
  history: [] as TriggerEvent[],
  _idCounter: 0,
  generateId() {return `rule_${++this._idCounter}_${Date.now()}`;},
  createRule(input: unknown): ConditionRule {
    const rule: ConditionRule = {
      ...input,
      id: this.generateId(),
      createdAt: new Date(),
      lastTriggeredAt: undefined,
      triggerCount: 0
    };
    this.rules.push(rule);
    return rule;
  },
  deleteRule(id: string) {
    this.rules = this.rules.filter((r) => r.id !== id);
    return true;
  },
  updateRule(id: string, patch: unknown) {
    const idx = this.rules.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    this.rules[idx] = { ...this.rules[idx], ...patch };
    return this.rules[idx];
  },
  enableRule(id: string) {
    const r = this.rules.find((r) => r.id === id);
    if (!r) return false;
    r.enabled = true;return true;
  },
  disableRule(id: string) {
    const r = this.rules.find((r) => r.id === id);
    if (!r) return false;
    r.enabled = false;return true;
  },
  getHistory() {return this.history;}
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function describeCondition(c: PriceCondition): string {
  const ref = c.reference || 'close';
  return `price ${c.operator} ${c.targetPrice} (${ref})`;
}

function isPriceCondition(c: unknown): c is PriceCondition {
  return c?.type === 'price';
}

// ── Sub-components ──────────────────────────────────────────────────────────────

function RuleCard({ rule, onDelete, onToggle, onViewHistory




}: {rule: ConditionRule;onDelete: (id: string) => void;onToggle: (id: string, enabled: boolean) => void;onViewHistory: (id: string) => void;}) {
  const cond = rule.condition;
  const desc = isPriceCondition(cond) ? describeCondition(cond) : `${cond.type}`;
  const statusColor = !rule.enabled ? 'text-gray-500' : rule.triggerCount > 0 ? 'text-green-400' : 'text-yellow-400';

  return (
    <div className="bg-[#1e1e2e] border border-white/10 rounded-lg p-4 flex flex-col gap-2">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-white font-mono font-semibold text-sm">{rule.symbol}</span>
            <span className={`text-xs ${statusColor}`}>
              {rule.enabled ? '● ACTIVE' : '○ DISABLED'}
            </span>
          </div>
          <div className="text-gray-300 text-xs font-mono">{desc}</div>
          <div className="text-gray-500 text-xs mt-1">
            cooldown {rule.cooldownMs}ms · max {rule.maxTriggersPerDay}/day
          </div>
        </div>
        <div className="flex items-center gap-2 ml-3">
          <button
            onClick={() => onToggle(rule.id, !rule.enabled)}
            className={`text-xs px-2 py-1 rounded ${rule.enabled ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'} transition-colors`}>
            
            {rule.enabled ? 'components.disable' : 'components.enable'}
          </button>
          <button
            onClick={() => onViewHistory(rule.id)}
            className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 transition-colors">
            
            {i18n.t('ConditionRulePanel.k1')}
          </button>
          <button
            onClick={() => onDelete(rule.id)}
            className="text-xs px-2 py-1 bg-white/5 text-gray-400 rounded hover:bg-red-500/20 hover:text-red-400 transition-colors">
            
            {i18n.t('ConditionRulePanel.k2')}
          </button>
        </div>
      </div>
      {rule.lastTriggeredAt &&
      <div className="text-gray-600 text-xs">{i18n.t("ConditionRulePanel.r92_d024")}
        {new Date(rule.lastTriggeredAt).toLocaleTimeString()}{i18n.t("ConditionRulePanel.r92_cbae")}{rule.triggerCount}{i18n.t("ConditionRulePanel.r92_b389")}
      </div>
      }
    </div>);

}

function HistoryModal({ ruleId, history, onClose



}: {ruleId: string;history: TriggerEvent[];onClose: () => void;}) {
  const filtered = history.filter((e) => e.ruleId === ruleId);
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-[#1a1a25] border border-white/10 rounded-xl p-6 max-w-lg w-full mx-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-white font-semibold mb-4">{i18n.t('ConditionRulePanel.k3')}</h3>
        {filtered.length === 0 ?
        <p className="text-gray-400 text-sm">{i18n.t('ConditionRulePanel.k4')}</p> :

        <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
            {filtered.slice().reverse().map((e, i) =>
          <div key={i} className="bg-[#252535] rounded p-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-white font-mono">${e.priceAtTrigger.toFixed(2)}</span>
                  <span className="text-gray-500">{new Date(e.triggeredAt).toLocaleString()}</span>
                </div>
                <div className="text-gray-400 mt-1">{isPriceCondition(e.condition) ? describeCondition(e.condition) : ''}</div>
              </div>
          )}
          </div>
        }
        <button onClick={onClose} className="mt-4 w-full py-2 bg-[#C9A046] text-black font-medium rounded-lg text-sm hover:bg-[#D4A853] transition-colors">{i18n.t("ConditionRulePanel.r92_8122")}

        </button>
      </div>
    </div>);

}

function CreateRuleForm({ onSubmit, onCancel


}: {onSubmit: (rule: Omit<ConditionRule, 'id' | 'createdAt' | 'lastTriggeredAt' | 'triggerCount'>) => void;onCancel: () => void;}) {
  const [symbol, setSymbol] = useState('');
  const [operator, setOperator] = useState<PriceCondition['operator']>('above');
  const [targetPrice, setTargetPrice] = useState('');
  const [reference, setReference] = useState<PriceCondition['reference']>('close');
  const [cooldownMs, setCooldownMs] = useState('5000');
  const [maxTriggers, setMaxTriggers] = useState('10');

  const handleSubmit = () => {
    if (!symbol.trim() || !targetPrice) return;
    onSubmit({
      symbol: symbol.trim().toUpperCase(),
      condition: { type: 'price', operator, targetPrice: parseFloat(targetPrice), reference },
      strategyId: '',
      cooldownMs: parseInt(cooldownMs) || 5000,
      maxTriggersPerDay: parseInt(maxTriggers) || 10,
      enabled: true
    });
  };

  return (
    <div className="bg-[#1e1e2e] border border-white/10 rounded-xl p-5 flex flex-col gap-4">
      <h3 className="text-white font-semibold">{i18n.t('ConditionRulePanel.k0')}</h3>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-gray-400 text-xs mb-1 block">{i18n.t('ConditionRulePanel.k1')}</label>
          <input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            placeholder="US.AAPL"
            className="w-full bg-[#111] border border-white/10 rounded px-3 py-2 text-white text-sm focus:border-[#C9A046] focus:outline-none" />
          
        </div>
        <div>
          <label className="text-gray-400 text-xs mb-1 block">{i18n.t('ConditionRulePanel.k2')}</label>
          <select
            value={reference}
            onChange={(e) => setReference(e.target.value as PriceCondition['reference'])}
            className="w-full bg-[#111] border border-white/10 rounded px-3 py-2 text-white text-sm focus:border-[#C9A046] focus:outline-none">
            
            <option value="close">close</option>
            <option value="open">open</option>
            <option value="high">high</option>
            <option value="low">low</option>
            <option value="vwap">vwap</option>
          </select>
        </div>
        <div>
          <label className="text-gray-400 text-xs mb-1 block">{i18n.t('ConditionRulePanel.k3')}</label>
          <select
            value={operator}
            onChange={(e) => setOperator(e.target.value as PriceCondition['operator'])}
            className="w-full bg-[#111] border border-white/10 rounded px-3 py-2 text-white text-sm focus:border-[#C9A046] focus:outline-none">
            
            <option value="above">{i18n.t("ConditionRulePanel.r92_937c")}</option>
            <option value="below">{i18n.t("ConditionRulePanel.r92_6670")}</option>
            <option value="crosses_above">{i18n.t("ConditionRulePanel.r92_b9c6")}</option>
            <option value="crosses_below">{i18n.t("ConditionRulePanel.r92_9855")}</option>
          </select>
        </div>
        <div>
          <label className="text-gray-400 text-xs mb-1 block">{i18n.t('ConditionRulePanel.k4')}</label>
          <input
            value={targetPrice}
            onChange={(e) => setTargetPrice(e.target.value)}
            type="number"
            placeholder="200"
            className="w-full bg-[#111] border border-white/10 rounded px-3 py-2 text-white text-sm focus:border-[#C9A046] focus:outline-none" />
          
        </div>
        <div>
          <label className="text-gray-400 text-xs mb-1 block">{i18n.t("ConditionRulePanel.r92_afb3")}</label>
          <input
            value={cooldownMs}
            onChange={(e) => setCooldownMs(e.target.value)}
            type="number"
            className="w-full bg-[#111] border border-white/10 rounded px-3 py-2 text-white text-sm focus:border-[#C9A046] focus:outline-none" />
          
        </div>
        <div>
          <label className="text-gray-400 text-xs mb-1 block">{i18n.t('ConditionRulePanel.k5')}</label>
          <input
            value={maxTriggers}
            onChange={(e) => setMaxTriggers(e.target.value)}
            type="number"
            className="w-full bg-[#111] border border-white/10 rounded px-3 py-2 text-white text-sm focus:border-[#C9A046] focus:outline-none" />
          
        </div>
      </div>

      <div className="text-xs text-gray-500 bg-[#111] rounded p-2 font-mono">
        {symbol || 'US.AAPL'} {operator} {targetPrice || '?'} ({reference})
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={!symbol.trim() || !targetPrice}
          className="flex-1 py-2 bg-[#C9A046] text-black font-medium rounded-lg text-sm hover:bg-[#D4A853] disabled:opacity-40 transition-colors">{i18n.t("ConditionRulePanel.r92_9b39")}


        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-white/5 text-gray-300 rounded-lg text-sm hover:bg-white/10 transition-colors">{i18n.t("ConditionRulePanel.r92_588e")}


        </button>
      </div>
    </div>);

}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ConditionRulePanel({ onBack }: Props) {
  const [rules, setRules] = useState<ConditionRule[]>([]);
  const [history, setHistory] = useState<TriggerEvent[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [historyRuleId, setHistoryRuleId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'disabled'>('all');

  const reload = useCallback(() => {
    setRules([...mockEngine.rules]);
    setHistory([...mockEngine.history]);
  }, []);

  const handleCreate = useCallback((input: Omit<ConditionRule, 'id' | 'createdAt' | 'lastTriggeredAt' | 'triggerCount'>) => {
    mockEngine.createRule(input);
    setShowCreate(false);
    reload();
  }, [reload]);

  const handleDelete = useCallback((id: string) => {
    mockEngine.deleteRule(id);
    reload();
  }, [reload]);

  const handleToggle = useCallback((id: string, enabled: boolean) => {
    if (enabled) mockEngine.enableRule(id);else
    mockEngine.disableRule(id);
    reload();
  }, [reload]);

  const filteredRules = rules.filter((r) => {
    if (filter === 'active') return r.enabled;
    if (filter === 'disabled') return !r.enabled;
    return true;
  });

  return (
    <div className="min-h-screen bg-[#0f0f18] text-white p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            {onBack &&
            <button onClick={onBack} className="text-gray-400 hover:text-gray-200 text-sm">{"components.back"}</button>
            }
            <h1 className="text-xl font-bold">{"components.conditionRule"}</h1>
            <span className="text-xs bg-[#C9A046]/20 text-[#C9A046] px-2 py-0.5 rounded">Phase 4.2</span>
          </div>
          <div className="flex gap-2">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="bg-[#1a1a25] border border-white/10 rounded px-3 py-1.5 text-sm text-gray-300 focus:border-[#C9A046] focus:outline-none">
              
              <option value="all">{"components.all"}</option>
              <option value="active">{i18n.t('ConditionRulePanel.k6')}</option>
              <option value="disabled">{i18n.t('ConditionRulePanel.k7')}</option>
            </select>
            <button
              onClick={() => setShowCreate(true)}
              className="px-4 py-1.5 bg-[#C9A046] text-black font-medium rounded-lg text-sm hover:bg-[#D4A853] transition-colors">{i18n.t("ConditionRulePanel.r92_2291")}


            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex gap-4 mb-4 text-xs">
          <span className="text-gray-400">{i18n.t('ConditionRulePanel.k8')}<span className="text-white font-semibold">{rules.length}</span></span>
          <span className="text-gray-400">{i18n.t('ConditionRulePanel.k9')}<span className="text-green-400 font-semibold">{rules.filter((r) => r.enabled).length}</span></span>
          <span className="text-gray-400">{i18n.t('ConditionRulePanel.k10')}<span className="text-yellow-400 font-semibold">{rules.reduce((s, r) => s + r.triggerCount, 0)}</span></span>
          <span className="text-gray-400">{i18n.t('ConditionRulePanel.k11')}<span className="text-blue-400 font-semibold">{history.length}</span></span>
        </div>

        {/* Create form */}
        {showCreate &&
        <div className="mb-4">
            <CreateRuleForm onSubmit={handleCreate} onCancel={() => setShowCreate(false)} />
          </div>
        }

        {/* Rules list */}
        {filteredRules.length === 0 ?
        <div className="text-center py-16 text-gray-500">
            <div className="text-4xl mb-3">📋</div>
            <div className="text-sm">{i18n.t('ConditionRulePanel.k12')}</div>
            <div className="text-xs mt-1">{i18n.t("ConditionRulePanel.r92_0744")}</div>
          </div> :

        <div className="flex flex-col gap-3">
            {filteredRules.map((rule) =>
          <RuleCard
            key={rule.id}
            rule={rule}
            onDelete={handleDelete}
            onToggle={handleToggle}
            onViewHistory={(id) => setHistoryRuleId(id)} />

          )}
          </div>
        }

        {/* History modal */}
        {historyRuleId &&
        <HistoryModal
          ruleId={historyRuleId}
          history={history}
          onClose={() => setHistoryRuleId(null)} />

        }
      </div>
    </div>);

}