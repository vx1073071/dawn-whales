// @ts-nocheck -- R107 S-24: StrategyPage split into 10 sub-components
import { useState, useEffect, useCallback } from 'react';
import { Modal } from 'antd';
import { createStrategy, getAllStrategies, runBacktest, startLive, stopLive, parseNL, getTemplates, deleteStrategy } from '../../lib/bridge-api';

import StrategyExplainCard from './StrategyExplainCard';
import StrategyCompareModal from './StrategyCompareModal';
import ConditionRulePanel from '../trading/ConditionRulePanel';
import ClosedLoopConfigPanel from './ClosedLoopConfigPanel';
import AdaptiveParamPanel from './AdaptiveParamPanel';

// Sub-components (R107 S-24 split)
import { ModeSelector } from './StrategyPage/ModeSelector';
import { AICreator } from './StrategyPage/AICreator';
import { BacktestPanel } from './StrategyPage/BacktestPanel';
import { MetricCard } from './StrategyPage/MetricCard';
import { EquityChart } from './StrategyPage/EquityChart';
import { TemplateBrowser } from './StrategyPage/TemplateBrowser';
import { FormCreator } from './StrategyPage/FormCreator';
import { SliderInput } from './StrategyPage/SliderInput';
import { MyStrategies } from './StrategyPage/MyStrategies';
import { StrategyDetail } from './StrategyPage/StrategyDetail';

// Re-export types
export type CreateMode = null | 'ai' | 'template' | 'form' | 'condition' | 'closedLoop' | 'adaptive';

export interface ParsedStrategy {
  success: boolean;
  name: string;
  description: string;
  symbol?: string;
  strategy: {
    type: string;
    params: Record<string, number>;
    stopLoss?: number;
    takeProfit?: number;
  };
  error?: string;
}

export interface BacktestResult {
  totalReturn: number;
  annualReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  totalTrades: number;
  equityCurve: {time: number;value: number;}[];
  trades: unknown[];
}

export default function StrategyPage() {
  const { t } = (() => {try {return require('react-i18next').useTranslation();} catch (_e: unknown) {return { t: (k: string) => k };}})();
  const [mode, setMode] = useState<CreateMode>(null);
  const [strategies, setStrategies] = useState<unknown[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nlPrefill, setNlPrefill] = useState<ParsedStrategy | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareDefaultA, setCompareDefaultA] = useState<unknown>(null);

  const loadStrategies = useCallback(async () => {
    const list = await getAllStrategies();
    setStrategies(list);
  }, []);

  const refresh = useCallback(() => {setRefreshKey((k) => k + 1);}, []);

  useEffect(() => {loadStrategies();}, [refreshKey, loadStrategies]);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Page header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">{'strategyWorkshop'}</h1>
          <p className="text-gray-400 text-sm">{'strategyWorkshopDesc'}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">{t('strategyCount', { count: strategies.length })}</span>
        </div>
      </div>

      {!mode && !selectedId && <ModeSelector onSelect={setMode} />}
      {mode === 'condition' && <ConditionRulePanel onBack={() => setMode(null)} />}
      {mode === 'closedLoop' && <ClosedLoopConfigPanel onBack={() => setMode(null)} onSave={() => {}} strategyId={selectedId || undefined} />}
      {mode === 'adaptive' && <AdaptiveParamPanel onBack={() => setMode(null)} strategyId={selectedId || 'ma_cross'} onApply={() => {}} />}
      {mode === 'ai' && <AICreator onBack={() => setMode(null)} onCreated={() => {setMode(null);refresh();}} onFillForm={(parsed) => {setNlPrefill(parsed);setMode('form');}} />}
      {mode === 'template' && <TemplateBrowser onBack={() => setMode(null)} onCreated={() => {setMode(null);refresh();}} />}
      {mode === 'form' && <FormCreator onBack={() => {setMode(null);setNlPrefill(null);}} onCreated={() => {setMode(null);setNlPrefill(null);refresh();}} nlPrefill={nlPrefill || undefined} />}

      {/* My strategies */}
      {!mode && !selectedId &&
      <MyStrategies
        strategies={strategies}
        onSelect={(id) => setSelectedId(id)}
        onEdit={(id) => setEditingId(id)}
        onDelete={async (id) => {
          await deleteStrategy(id);
          refresh();
        }}
        onCompare={(strategy) => {
          setCompareDefaultA(strategy);
          setCompareOpen(true);
        }} />

      }

      {/* Edit strategy */}
      {!mode && editingId &&
      <FormCreator
        onBack={() => setEditingId(null)}
        onCreated={() => {setEditingId(null);refresh();}}
        editId={editingId} />

      }

      {/* Strategy detail */}
      {selectedId &&
      <StrategyDetail
        strategyId={selectedId}
        onBack={() => setSelectedId(null)}
        onRefresh={refresh} />

      }

      {compareOpen &&
      <StrategyCompareModal
        strategies={strategies as any}
        defaultStrategyA={compareDefaultA as any}
        onClose={() => setCompareOpen(false)} />

      }
    </div>);
}
