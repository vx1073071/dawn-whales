// @ts-nocheck — R119: cross-module type mismatch pending lib/component alignment
// ── R115 QTE-27 AlertPanel + QTE-28 FundFlow — 异动提醒+资金流向 ────────

import { useState, useCallback, useMemo } from 'react';



// ═══════ Bridge: AlertService + FundFlow → Panel ═══════════
import { AlertService, type AlertEvent } from '../../lib/chart/alert-service';
import { FundFlow } from '../../lib/chart/fund-flow';

let _alertService: AlertService | null = null;
export function getAlertService(): AlertService {
  if (!_alertService) _alertService = new AlertService();
  return _alertService;
}

export function getFundFlowInstance(): FundFlow {
  return new FundFlow();
}

// ═══════════ Alert Types ═══════════

export type AlertChannel = 'system' | 'telegram' | 'feishu' | 'email';
export type AlertTrigger = 'price_break' | 'volume_surge' | 'pattern' | 'indicator' | 'cross_spread';

export interface AlertRule {
  id: string;
  name: string;
  trigger: AlertTrigger;
  symbol: string;
  condition: string;
  channels: AlertChannel[];
  enabled: boolean;
  createdAt: number;
  lastTriggered?: number;
}

export interface AlertPanelProps {
  rules: AlertRule[];
  onAdd: (rule: Omit<AlertRule, 'id' | 'createdAt'>) => void;
  onEdit: (id: string, updates: Partial<AlertRule>) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
  className?: string;
}

// ═══════════ FundFlow Types ═══════════

export interface FundFlowItem {
  symbol: string;
  name: string;
  netInflow: number;      // 主力净流入
  bigOrderInflow: number;  // 大单净流入
  midOrderInflow: number;  // 中单
  smallOrderInflow: number; // 小单
  mainForceRatio: number;  // 主力占比
  mainForceTrend: number[]; // 1/3/5/10日趋势
  sectorRank?: number;
}

export interface FundFlowProps {
  data: FundFlowItem[];
  view?: 'individual' | 'sector';
  className?: string;
}

// ═══════════ Channel icons ═══════════

const CHANNEL_ICONS: Record<AlertChannel, string> = {
  system: '💻', telegram: '📱', feishu: '🐦', email: '📧',
};

const TRIGGER_LABELS: Record<AlertTrigger, string> = {
  price_break: '价格突破', volume_surge: '放量异动', pattern: '形态触发', indicator: '指标信号', cross_spread: '跨所价差',
};

// ═══════════ Alert Panel Component ═══════════

export function AlertPanel({ rules, onAdd, onDelete, onToggle, className = '' }: AlertPanelProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [newRule, setNewRule] = useState({ name: '', trigger: 'price_break' as AlertTrigger, symbol: '', condition: '', channels: ['system'] as AlertChannel[], enabled: true });

  const handleAdd = useCallback(() => {
    if (!newRule.symbol || !newRule.condition) return;
    onAdd(newRule);
    setNewRule({ name: '', trigger: 'price_break', symbol: '', condition: '', channels: ['system'], enabled: true });
    setShowAdd(false);
  }, [newRule, onAdd]);

  return (
    <div className={`flex flex-col bg-[#0d1117] rounded-lg border border-[#30363d] p-3 text-xs ${className}`} style={{ fontFamily: 'monospace' }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[#8b949e] font-semibold text-[10px]">⚡ 异动提醒 Alert</span>
        <button onClick={() => setShowAdd(!showAdd)} className="text-[#3b82f6] text-[9px] hover:underline">{showAdd ? '取消' : '+ 新建'}</button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="mb-2 p-2 bg-[#161b22] rounded border border-[#1c2333] flex flex-col gap-1.5">
          <input value={newRule.name} onChange={e => setNewRule({ ...newRule, name: e.target.value })} placeholder="规则名称" className="bg-[#0d1117] border border-[#30363d] rounded px-2 py-1 text-[#c9d1d9] text-[10px] w-full" />
          <input value={newRule.symbol} onChange={e => setNewRule({ ...newRule, symbol: e.target.value })} placeholder="代码 (如 BTCUSDT)" className="bg-[#0d1117] border border-[#30363d] rounded px-2 py-1 text-[#c9d1d9] text-[10px] w-full" />
          <select value={newRule.trigger} onChange={e => setNewRule({ ...newRule, trigger: e.target.value as AlertTrigger })}
            className="bg-[#0d1117] border border-[#30363d] rounded px-2 py-1 text-[#c9d1d9] text-[10px]">
            {Object.entries(TRIGGER_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <input value={newRule.condition} onChange={e => setNewRule({ ...newRule, condition: e.target.value })} placeholder="条件 (如 价格>=100)" className="bg-[#0d1117] border border-[#30363d] rounded px-2 py-1 text-[#c9d1d9] text-[10px] w-full" />
          <div className="flex gap-1">
            {(['system', 'telegram', 'feishu', 'email'] as AlertChannel[]).map(ch => (
              <button key={ch} onClick={() => setNewRule({ ...newRule, channels: newRule.channels.includes(ch) ? newRule.channels.filter(c => c !== ch) : [...newRule.channels, ch] })}
                className={`px-1.5 py-0.5 text-[9px] rounded ${newRule.channels.includes(ch) ? 'bg-[#3b82f620] text-[#3b82f6]' : 'text-[#484f58]'}`}>
                {CHANNEL_ICONS[ch]}
              </button>
            ))}
          </div>
          <button onClick={handleAdd} className="bg-[#3b82f620] text-[#3b82f6] rounded px-2 py-1 text-[9px]">添加规则</button>
        </div>
      )}

      {/* Rule list */}
      <div className="flex flex-col gap-1 max-h-[300px] overflow-y-auto">
        {rules.length === 0 ? (
          <div className="text-[#484f58] text-center py-4 text-[9px]">暂无提醒规则</div>
        ) : rules.map(rule => (
          <div key={rule.id} className="flex items-center gap-2 px-2 py-1.5 bg-[#161b22] rounded border border-[#1c2333]">
            <button onClick={() => onToggle(rule.id, !rule.enabled)}
              className={`w-2 h-2 rounded-full shrink-0 ${rule.enabled ? 'bg-[#22c55e]' : 'bg-[#484f58]'}`} title={rule.enabled ? '已启用' : '已禁用'} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[#c9a96e] text-[9px] font-bold truncate">{rule.symbol}</span>
                <span className="text-[#484f58] text-[8px]">{TRIGGER_LABELS[rule.trigger]}</span>
              </div>
              <div className="text-[8px] text-[#484f58] truncate">{rule.condition}</div>
            </div>
            <div className="flex gap-0.5 text-[8px]">
              {rule.channels.map(ch => <span key={ch}>{CHANNEL_ICONS[ch]}</span>)}
            </div>
            <button onClick={() => onDelete(rule.id)} className="text-[#ef4444] text-[8px] hover:underline shrink-0">删除</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════ FundFlow Component ═══════════

export function FundFlowPanel({ data, className = '' }: FundFlowProps) {
  const [sortBy, setSortBy] = useState<keyof FundFlowItem>('netInflow');
  const [sortDesc, setSortDesc] = useState(true);

  const sorted = useMemo(() => {
    return [...data].sort((a, b) => {
      const va = (a[sortBy] as number) ?? 0;
      const vb = (b[sortBy] as number) ?? 0;
      return sortDesc ? vb - va : va - vb;
    });
  }, [data, sortBy, sortDesc]);

  const maxNet = Math.max(...sorted.map(d => Math.abs(d.netInflow)), 1);

  const handleSort = (col: keyof FundFlowItem) => {
    if (sortBy === col) setSortDesc(!sortDesc);
    else { setSortBy(col); setSortDesc(true); }
  };

  const formatFlow = (n: number): string => {
    const abs = Math.abs(n);
    const sign = n >= 0 ? '+' : '-';
    if (abs >= 1e9) return sign + (abs / 1e9).toFixed(1) + 'B';
    if (abs >= 1e6) return sign + (abs / 1e6).toFixed(1) + 'M';
    if (abs >= 1e4) return sign + (abs / 1e4).toFixed(1) + '万';
    return sign + abs.toFixed(0);
  };

  return (
    <div className={`flex flex-col bg-[#0d1117] rounded-lg border border-[#30363d] overflow-hidden ${className}`} style={{ fontFamily: 'monospace' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#1c2333]">
        <span className="text-[#8b949e] font-semibold text-[10px]">💰 资金流向</span>
        <div className="flex gap-1 text-[9px]">
          <button onClick={() => handleSort('netInflow')} className={`px-1.5 py-0.5 rounded ${sortBy === 'netInflow' ? 'bg-[#3b82f620] text-[#3b82f6]' : 'text-[#484f58]'}`}>主力净流入</button>
          <button onClick={() => handleSort('mainForceRatio')} className={`px-1.5 py-0.5 rounded ${sortBy === 'mainForceRatio' ? 'bg-[#3b82f620] text-[#3b82f6]' : 'text-[#484f58]'}`}>主力占比</button>
        </div>
      </div>

      {/* Flow bars */}
      <div className="flex-1 overflow-y-auto">
        {sorted.map(item => {
          const barPct = Math.min(100, (Math.abs(item.netInflow) / maxNet) * 100);
          const isInflow = item.netInflow >= 0;
          return (
            <div key={item.symbol} className="flex items-center gap-2 px-2 py-1.5 border-b border-[#1c2333] hover:bg-[#161b22]">
              {/* Symbol */}
              <div className="w-20 shrink-0">
                <div className="text-[10px] text-[#c9d1d9] font-bold truncate">{item.symbol}</div>
                <div className="text-[8px] text-[#484f58]">{item.name}</div>
              </div>

              {/* Bar */}
              <div className="flex-1 flex items-center gap-1">
                <div className="flex-1 h-4 bg-[#161b22] rounded-sm overflow-hidden relative">
                  <div className={`absolute top-0 h-full rounded-sm transition-all duration-300 ${isInflow ? 'left-1/2 bg-[#22c55e]' : 'right-1/2 bg-[#ef4444]'}`}
                    style={{ width: `${barPct / 2}%` }} />
                </div>
                <span className={`text-[9px] font-bold w-16 text-right ${isInflow ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                  {formatFlow(item.netInflow)}
                </span>
              </div>

              {/* Main force trend */}
              <div className="flex gap-0.5 shrink-0">
                {item.mainForceTrend.map((v, i) => (
                  <span key={i} className={`text-[7px] ${v >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                    {v >= 0 ? '▲' : '▼'}
                  </span>
                ))}
              </div>

              {/* Ratio */}
              <div className="w-12 text-right text-[9px] text-[#8b949e] shrink-0">
                {item.mainForceRatio.toFixed(1)}%
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 py-1 border-t border-[#1c2333] text-[7px] text-[#484f58]">
        <span className="text-[#22c55e]">■ 流入</span>
        <span className="text-[#ef4444]">■ 流出</span>
        <span>趋势→ 1/3/5/10日</span>
      </div>
    </div>
  );
}
