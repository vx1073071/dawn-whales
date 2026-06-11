import { useState, useEffect, useCallback } from 'react';
import { createStrategy, getAllStrategies, runBacktest, startLive, stopLive, parseNL, getTemplates, deleteStrategy } from '../../lib/bridge-api';

import StrategyExplainCard from './StrategyExplainCard';
import StrategyCompareModal from './StrategyCompareModal';
import ConditionRulePanel from '../trading/ConditionRulePanel';
import ClosedLoopConfigPanel from './ClosedLoopConfigPanel';
import AdaptiveParamPanel from './AdaptiveParamPanel';
import i18n from '../../i18n';
import { EngineError } from '../../../electron/engine/core/engine-error';

type CreateMode = null | 'ai' | 'template' | 'form' | 'condition' | 'closedLoop' | 'adaptive';

interface ParsedStrategy {
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

interface BacktestResult {
  totalReturn: number;
  annualReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  totalTrades: number;
  equityCurve: { time: number; value: number }[];
  trades: any[];
}

export default function StrategyPage() {
  const { t } = (() => { try { return require('react-i18next').useTranslation(); } catch (_e: unknown) { return { t: (k: string) => k }; } })();
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

  const refresh = useCallback(() => { setRefreshKey((k) => k + 1); }, []);

  useEffect(() => { loadStrategies(); }, [refreshKey, loadStrategies]);

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
      {mode === 'closedLoop' && <ClosedLoopConfigPanel onBack={() => setMode(null)} onSave={(config) => console.log('Loop config saved:', config)} strategyId={selectedId || undefined} />}
      {mode === 'adaptive' && <AdaptiveParamPanel onBack={() => setMode(null)} strategyId={selectedId || 'ma_cross'} onApply={(params) => console.log('Adaptive params applied:', params)} />}
      {mode === 'ai' && <AICreator onBack={() => setMode(null)} onCreated={() => { setMode(null); refresh(); }} onFillForm={(parsed) => { setNlPrefill(parsed); setMode('form'); }} />}
      {mode === 'template' && <TemplateBrowser onBack={() => setMode(null)} onCreated={() => { setMode(null); refresh(); }} />}
      {mode === 'form' && <FormCreator onBack={() => { setMode(null); setNlPrefill(null); }} onCreated={() => { setMode(null); setNlPrefill(null); refresh(); }} nlPrefill={nlPrefill || undefined} />}

      {/* My strategies */}
      {!mode && !selectedId && (
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
          }}
        />
      )}

      {/* Edit strategy */}
      {!mode && editingId && (
        <FormCreator
          onBack={() => setEditingId(null)}
          onCreated={() => { setEditingId(null); refresh(); }}
          editId={editingId}
        />
      )}

      {/* Strategy detail */}
      {selectedId && (
        <StrategyDetail
          strategyId={selectedId}
          onBack={() => setSelectedId(null)}
          onRefresh={refresh}
        />
      )}

      {compareOpen && (
        <StrategyCompareModal
          strategies={strategies as any}
          defaultStrategyA={compareDefaultA as any}
          onClose={() => setCompareOpen(false)}
        />
      )}
    </div>
  );
}

// ── Mode Selector ──────────────────────────────────────────────────────────

function ModeSelector({ onSelect }: { onSelect: (m: CreateMode) => void }) {
  return (
    <div className="space-y-4 mb-8">
      <div className="grid grid-cols-3 gap-4">
        <button onClick={() => onSelect('ai')} className="bg-[#1a1a25] border border-white/5 rounded-xl p-6 text-left hover:border-[#C9A046]/50 transition-all group">
          <div className="text-3xl mb-3">💬</div>
          <h3 className="text-white font-semibold mb-1 group-hover:text-[#D4A853] transition-colors">{i18n.t('StrategyPage.k1')}</h3>
          <p className="text-gray-400 text-xs leading-relaxed">{i18n.t('StrategyPage.k2')}<br/>{i18n.t('StrategyPage.k3')}</p>
          <div className="mt-3 text-[#D4A853] text-xs font-medium">{i18n.t('StrategyPage.k4')}</div>
        </button>
        <button onClick={() => onSelect('template')} className="bg-[#1a1a25] border border-white/5 rounded-xl p-6 text-left hover:border-[#C9A046]/50 transition-all group">
          <div className="text-3xl mb-3">📋</div>
          <h3 className="text-white font-semibold mb-1 group-hover:text-[#D4A853] transition-colors">{i18n.t('StrategyPage.k5')}</h3>
          <p className="text-gray-400 text-xs leading-relaxed">{i18n.t('StrategyPage.k6')}<br/>{i18n.t('StrategyPage.k7')}</p>
          <div className="mt-3 text-gray-500 text-xs">{i18n.t('StrategyPage.k8')}</div>
        </button>
        <button onClick={() => onSelect('form')} className="bg-[#1a1a25] border border-white/5 rounded-xl p-6 text-left hover:border-[#C9A046]/50 transition-all group">
          <div className="text-3xl mb-3">📊</div>
          <h3 className="text-white font-semibold mb-1 group-hover:text-[#D4A853] transition-colors">{i18n.t('StrategyPage.k9')}</h3>
          <p className="text-gray-400 text-xs leading-relaxed">{i18n.t('StrategyPage.k10')}<br/>{i18n.t('StrategyPage.k11')}</p>
          <div className="mt-3 text-gray-500 text-xs">{i18n.t('StrategyPage.k12')}</div>
        </button>
      </div>
      {/* Phase 4.2: Condition Rules */}
      <button onClick={() => onSelect('condition')} className="w-full bg-[#C9A046]/5 border border-[#C9A046]/20 rounded-xl p-4 text-left hover:border-[#C9A046]/40 hover:bg-[#C9A046]/10 transition-all group">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-2xl">⚡</div>
            <div>
              <h3 className="text-white font-semibold text-sm group-hover:text-[#D4A853] transition-colors">{i18n.t('StrategyPage.k13')}</h3>
              <p className="text-gray-400 text-xs leading-relaxed">{i18n.t('StrategyPage.k14')}</p>
            </div>
          </div>
          <span className="text-[#D4A853] text-xs font-medium">Phase 4.2 →</span>
        </div>
      </button>
      {/* Phase 4.3: Closed Loop Config */}
      <button onClick={() => onSelect('closedLoop')} className="w-full bg-[#C9A046]/5 border border-[#C9A046]/20 rounded-xl p-4 text-left hover:border-[#C9A046]/40 hover:bg-[#C9A046]/10 transition-all group">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-2xl">🔄</div>
            <div>
              <h3 className="text-white font-semibold text-sm group-hover:text-[#D4A853] transition-colors">{i18n.t('StrategyPage.k15')}</h3>
              <p className="text-gray-400 text-xs leading-relaxed">{i18n.t('StrategyPage.k16')}</p>
            </div>
          </div>
          <span className="text-[#D4A853] text-xs font-medium">Phase 4.3 →</span>
        </div>
      </button>
      {/* Phase 4.4: Adaptive Parameter Learning */}
      <button onClick={() => onSelect('adaptive')} className="w-full bg-[#C9A046]/5 border border-[#C9A046]/20 rounded-xl p-4 text-left hover:border-[#C9A046]/40 hover:bg-[#C9A046]/10 transition-all group">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-2xl">🧬</div>
            <div>
              <h3 className="text-white font-semibold text-sm group-hover:text-[#D4A853] transition-colors">{i18n.t('StrategyPage.k17')}</h3>
              <p className="text-gray-400 text-xs leading-relaxed">{i18n.t('StrategyPage.k18')}</p>
            </div>
          </div>
          <span className="text-[#D4A853] text-xs font-medium">Phase 4.4 →</span>
        </div>
      </button>
    </div>
  );
}

// ── AI Natural Language Creator ────────────────────────────────────────────

function AICreator({ onBack, onCreated, onFillForm }: { onBack: () => void; onCreated: () => void; onFillForm?: (parsed: ParsedStrategy) => void }) {
  const [input, setInput] = useState('');
  const [parsed, setParsed] = useState<ParsedStrategy | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const [backtestLoading, setBacktestLoading] = useState(false);
  const [strategyId, setStrategyId] = useState<string | null>(null);

  const examples = [
    i18n.t('StrategyPage.k19'),
    i18n.t('StrategyPage.k20'),
    i18n.t('StrategyPage.k21'),
    i18n.t('StrategyPage.k22'),
    i18n.t('StrategyPage.k23'),
  ];

  const handleParse = useCallback(async () => {
    if (!input.trim()) return;
    setLoading(true);
    setError('');
    setParsed(null);
    setBacktestResult(null);

    try {
      const result = await parseNL(input);
      setParsed(result);
      if (!result.success) {
        setError(result.error || i18n.t('StrategyPage.k24'));
      }
    } catch (e: unknown) {
      setError((e as any).message || i18n.t('StrategyPage.k25'));
    } finally {
      setLoading(false);
    }
  }, [input]);

  const handleCreate = useCallback(async () => {
    if (!parsed?.success) return;
    setLoading(true);
    try {
      const result = await createStrategy({
        text: input,
        strategy: parsed.strategy,
        symbol: parsed.symbol || 'US.TQQQ',
      });
      if (result.success) {
        setStrategyId(result.id);
        onCreated();
      }
    } catch (e: unknown) {
      setError((e as any).message);
    } finally {
      setLoading(false);
    }
  }, [input, parsed, onCreated]);

  const handleBacktest = useCallback(async () => {
    if (!strategyId && !parsed?.success) return;
    setBacktestLoading(true);
    try {
      const result = await runBacktest({
        strategyId,
        symbol: parsed?.symbol || 'US.TQQQ',
        period: 'daily',
        count: 200,
        strategy: parsed?.strategy,
        initialCapital: 100000,
        commission: 0.001,
        slippage: 0.0005,
      });
      if (result.success) {
        setBacktestResult(result.result);
      }
    } catch (e: unknown) {
      // silent
    } finally {
      setBacktestLoading(false);
    }
  }, [strategyId, parsed]);

  return (
    <div className="mb-8">
      <button onClick={onBack} className="text-gray-400 hover:text-gray-200 text-sm mb-4 flex items-center gap-1">{"components.back"}</button>

      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-6">
        <h2 className="text-white font-semibold mb-1 flex items-center gap-2">{i18n.t('StrategyPage.k26')}</h2>
        <p className="text-gray-400 text-xs mb-4">{i18n.t('StrategyPage.k27')}</p>

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="例如：MA5 上穿 MA20 买入 TQQQ，止损 5%"
          className="w-full h-28 bg-[#12121a] border border-white/10 rounded-lg p-4 text-sm text-gray-200 placeholder-gray-600 resize-none focus:outline-none focus:border-[#C9A046]/50"
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleParse(); }}
        />

        <div className="flex items-center gap-2 mt-3">
          <button onClick={handleParse} disabled={!input.trim() || loading} className="px-4 py-2 bg-[#C9A046] text-black font-medium rounded-lg text-sm hover:bg-[#D4A853] disabled:opacity-40 transition-colors">
            {loading ? i18n.t('StrategyPage.k28') : i18n.t('StrategyPage.k29')}
          </button>
          <span className="text-gray-500 text-xs">{i18n.t('StrategyPage.k30')}</span>
        </div>

        <div className="flex flex-wrap gap-2 mt-2">
          {examples.map((ex, i) => (
            <button key={i} onClick={() => setInput(ex)} className="text-xs text-gray-400 bg-[#22222f] px-3 py-1.5 rounded-lg hover:text-gray-200 transition-colors">
              {ex}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Parsed result */}
      {parsed?.success && (
        <div className="mt-4 bg-[#1a1a25] border border-[#C9A046]/30 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[#D4A853]">✓</span>
            <h3 className="text-white font-semibold">{parsed.name}</h3>
            {parsed.symbol && <span className="text-xs bg-[#C9A046]/20 text-[#D4A853] px-2 py-0.5 rounded">{parsed.symbol}</span>}
          </div>

          <p className="text-gray-400 text-sm mb-4">{parsed.description}</p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-4">
            <div className="bg-[#12121a] rounded-lg p-3">
              <div className="text-gray-500 text-xs mb-1">{i18n.t('StrategyPage.k31')}</div>
              <div className="text-gray-200 font-mono text-xs">{parsed.strategy.type}</div>
            </div>
            {Object.entries(parsed.strategy.params).slice(0, 3).map(([k, v]) => (
              <div key={k} className="bg-[#12121a] rounded-lg p-3">
                <div className="text-gray-500 text-xs mb-1">{k}</div>
                <div className="text-[#D4A853] font-mono">{v}</div>
              </div>
            ))}
          </div>

          {(parsed.strategy.stopLoss || parsed.strategy.takeProfit) && (
            <div className="flex gap-3 mb-4">
              {parsed.strategy.stopLoss && (
                <span className="text-xs bg-red-500/20 text-red-400 px-3 py-1 rounded-lg">止损 {parsed.strategy.stopLoss}%</span>
              )}
              {parsed.strategy.takeProfit && (
                <span className="text-xs bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-lg">止盈 {parsed.strategy.takeProfit}%</span>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={handleCreate} disabled={loading || !!strategyId} className="px-4 py-2 bg-[#C9A046] text-black font-medium rounded-lg text-sm hover:bg-[#D4A853] disabled:opacity-40 transition-colors">
              {strategyId ? i18n.t('StrategyPage.k32') : i18n.t('StrategyPage.k33')}
            </button>
            <button onClick={handleBacktest} disabled={backtestLoading} className="px-4 py-2 bg-[#22222f] text-gray-300 rounded-lg text-sm hover:bg-[#2a2a3a] transition-colors">
              {backtestLoading ? i18n.t('StrategyPage.k34') : i18n.t('StrategyPage.k35')}
            </button>
            {onFillForm && (
              <button onClick={() => onFillForm(parsed)} className="px-4 py-2 bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-lg text-sm hover:bg-blue-500/30 transition-colors">
                📊 填充表单调整
              </button>
            )}
          </div>
        </div>
      )}

      {/* Backtest result */}
      {backtestResult && <BacktestPanel result={backtestResult} />}
    </div>
  );
}

// ── Backtest Result Panel ──────────────────────────────────────────────────

function BacktestPanel({ result }: { result: BacktestResult }) {
  const returnColor = result.totalReturn >= 0 ? 'text-emerald-400' : 'text-red-400';

  return (
    <div className="mt-4 bg-[#1a1a25] border border-white/5 rounded-xl p-6">
      <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
        📈 回测结果
      </h3>

      {/* Metrics grid */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-4">
        <MetricCard label={i18n.t('StrategyPage.k36')} value={`${result.totalReturn > 0 ? '+' : ''}${result.totalReturn}%`} color={returnColor} />
        <MetricCard label={i18n.t('StrategyPage.k37')} value={`${result.annualReturn > 0 ? '+' : ''}${result.annualReturn}%`} color={returnColor} />
        <MetricCard label={i18n.t('StrategyPage.k38')} value={result.sharpeRatio.toFixed(2)} color={result.sharpeRatio > 1 ? 'text-emerald-400' : result.sharpeRatio > 0 ? 'text-yellow-400' : 'text-red-400'} />
        <MetricCard label={'maxDrawdown'} value={`-${result.maxDrawdown}%`} color="text-red-400" />
        <MetricCard label={'winRate'} value={`${result.winRate}%`} color={result.winRate > 50 ? 'text-emerald-400' : 'text-yellow-400'} />
        <MetricCard label={'profitFactor'} value={result.profitFactor === Infinity ? '∞' : result.profitFactor.toFixed(2)} color={result.profitFactor > 1.5 ? 'text-emerald-400' : 'text-yellow-400'} />
      </div>

      {/* Equity curve */}
      {result.equityCurve.length > 0 && (
        <div className="bg-[#12121a] rounded-lg p-3 mb-4">
          <div className="text-xs text-gray-500 mb-2">权益曲线 · {result.totalTrades} 笔交易</div>
          <EquityChart data={result.equityCurve} />
        </div>
      )}

      {/* Recent trades */}
      {result.trades.length > 0 && (
        <div>
          <div className="text-xs text-gray-500 mb-2">最近交易（共 {result.trades.length} 笔）</div>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {result.trades.slice(-10).reverse().map((t, i) => (
              <div key={i} className="flex items-center justify-between text-xs bg-[#12121a] rounded px-3 py-2">
                <span className="text-gray-400">{new Date(t.entryTime * 1000).toLocaleDateString()}</span>
                <span className="text-emerald-400">BUY @ ${t.entryPrice.toFixed(2)}</span>
                <span>→</span>
                <span className="text-red-400">SELL @ ${t.exitPrice.toFixed(2)}</span>
                <span className={t.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                  {t.pnlPct >= 0 ? '+' : ''}{t.pnlPct.toFixed(1)}%
                </span>
                <span className="text-gray-600">{t.bars}天</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-[#12121a] rounded-lg p-3 text-center">
      <div className="text-gray-500 text-xs mb-1">{label}</div>
      <div className={`font-bold text-sm ${color}`}>{value}</div>
    </div>
  );
}

function EquityChart({ data }: { data: { time: number; value: number }[] }) {
  if (data.length < 2) return null;

  const width = 600;
  const height = 80;
  const padding = 4;

  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2);
    const y = height - padding - ((d.value - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  });

  const startVal = data[0].value;
  const endVal = data[data.length - 1].value;
  const isUp = endVal >= startVal;
  const strokeColor = isUp ? '#22c55e' : '#ef4444';

  const pathD = `M${points.join(' L')}`;
  const fillD = `${pathD} L${width - padding},${height - padding} L${padding},${height - padding} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-20" preserveAspectRatio="none">
      <defs>
        <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.3" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fillD} fill="url(#eqGrad)" />
      <path d={pathD} fill="none" stroke={strokeColor} strokeWidth="1.5" />
      {/* Start/end labels */}
      <text x={padding} y={height - 2} fontSize="8" fill="#666">${startVal.toFixed(0)}</text>
      <text x={width - padding} y={height - 2} fontSize="8" fill={strokeColor} textAnchor="end">${endVal.toFixed(0)}</text>
    </svg>
  );
}

// ── Template Browser ───────────────────────────────────────────────────────

function TemplateBrowser({ onBack, onCreated }: { onBack: () => void; onCreated: () => void }) {
  const [templates, setTemplates] = useState<unknown[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    const list = await getTemplates();
    setTemplates(list);
  }

  async function handleUse(template: any) {
    setLoading(true);
    try {
      await createStrategy({ templateId: template.id, symbol: template.symbol || 'US.TQQQ' });
      onCreated();
    } catch (_e: unknown) { /* silent */ } finally {
      setLoading(false);
    }
  }

  const riskColors: Record<string, string> = { [i18n.t('StrategyPage.k39')]: 'text-emerald-400 bg-emerald-500/20', [i18n.t('StrategyPage.k40')]: 'text-yellow-400 bg-yellow-500/20', [i18n.t('StrategyPage.k41')]: 'text-red-400 bg-red-500/20' };

  return (
    <div className="mb-8">
      <button onClick={onBack} className="text-gray-400 hover:text-gray-200 text-sm mb-4 flex items-center gap-1">{"components.back"}</button>

      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-white font-semibold">{i18n.t('StrategyPage.k42')}</h2>
        <div className="flex gap-2 text-xs">
          <button className="px-3 py-1 bg-[#C9A046]/20 text-[#D4A853] rounded-full">{"components.all"}</button>
          <button className="px-3 py-1 bg-[#22222f] text-gray-400 rounded-full hover:text-gray-200">{"components.trend"}</button>
          <button className="px-3 py-1 bg-[#22222f] text-gray-400 rounded-full hover:text-gray-200">{i18n.t('StrategyPage.k43')}</button>
          <button className="px-3 py-1 bg-[#22222f] text-gray-400 rounded-full hover:text-gray-200">{i18n.t('StrategyPage.k44')}</button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {templates.map((t) => (
          <button
            key={(t as any).id}
            onClick={() => setSelected((t as any).id === selected ? null : (t as any).id)}
            className={`bg-[#1a1a25] border rounded-lg p-4 text-left transition-all ${
              selected === (t as any).id ? 'border-[#C9A046]/50 bg-[#22222f]' : 'border-white/5 hover:border-white/10'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-white text-sm font-medium">{(t as any).name}</h4>
              <span className={`text-xs px-2 py-0.5 rounded ${riskColors[(t as any).risk] || 'text-gray-400 bg-gray-500/20'}`}>{(t as any).risk}风险</span>
            </div>
            <p className="text-gray-400 text-xs mb-3 leading-relaxed">{(t as any).description}</p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 bg-[#22222f] px-2 py-0.5 rounded">{(t as any).category}</span>
            </div>
            {selected === (t as any).id && (
              <div className="mt-3 pt-3 border-t border-white/5">
                <button onClick={(e) => { e.stopPropagation(); handleUse(t); }} disabled={loading} className="w-full px-3 py-2 bg-[#C9A046] text-black text-xs font-medium rounded-lg hover:bg-[#D4A853] disabled:opacity-40 transition-colors">
                  {loading ? i18n.t('StrategyPage.k45') : i18n.t('StrategyPage.k46')}
                </button>
              </div>
            )}
          </button>
        ))}
        {templates.length === 0 && (
          <div className="col-span-3 text-center py-8 text-gray-500 text-sm">{i18n.t('StrategyPage.k47')}</div>
        )}
      </div>
    </div>
  );
}

// ── Form Creator ───────────────────────────────────────────────────────────

function FormCreator({ onBack, onCreated, editId, nlPrefill }: { onBack: () => void; onCreated: () => void; editId?: string; nlPrefill?: ParsedStrategy }) {
  const [strategyType, setStrategyType] = useState(nlPrefill?.strategy?.type || 'ma_cross');
  const [symbol, setSymbol] = useState(nlPrefill?.symbol || 'US.TQQQ');
  const [shortPeriod, setShortPeriod] = useState(nlPrefill?.strategy?.params?.shortPeriod || 10);
  const [longPeriod, setLongPeriod] = useState(nlPrefill?.strategy?.params?.longPeriod || 30);
  const [rsiOversold, setRsiOversold] = useState(nlPrefill?.strategy?.params?.oversold || 30);
  const [rsiOverbought, setRsiOverbought] = useState(nlPrefill?.strategy?.params?.overbought || 70);
  const [stopLoss, setStopLoss] = useState(nlPrefill?.strategy?.stopLoss || 5);
  const [takeProfit, setTakeProfit] = useState(nlPrefill?.strategy?.takeProfit || 15);
  const [creating, setCreating] = useState(false);
  const [strategyName, setStrategyName] = useState('');

  // Load existing strategy data for edit mode
  useEffect(() => {
    if (editId) {
      const load = async () => {
        try {
          const list = await getAllStrategies();
          const existing = list.find((s: any) => s.id === editId);
          if (existing) {
            setStrategyName(existing.name || '');
            setSymbol(existing.symbol || existing.targetCode || 'US.TQQQ');
            const st = existing.strategy || {};
            setStrategyType(st.type || 'ma_cross');
            if (st.params) {
              if (st.params.shortPeriod) setShortPeriod(st.params.shortPeriod);
              if (st.params.longPeriod) setLongPeriod(st.params.longPeriod);
              if (st.params.oversold) setRsiOversold(st.params.oversold);
              if (st.params.overbought) setRsiOverbought(st.params.overbought);
            }
            if (st.stopLoss) setStopLoss(st.stopLoss);
            if (st.takeProfit) setTakeProfit(st.takeProfit);
          }
        } catch (_e: unknown) { /* silent */ }
      };
      load();
    }
  }, [editId]);

  async function handleCreate() {
    setCreating(true);
    try {
      let params: Record<string, number> = {};
      if (strategyType === 'ma_cross') params = { shortPeriod, longPeriod };
      else if (strategyType === 'rsi') params = { oversold: rsiOversold, overbought: rsiOverbought, rsiPeriod: 14 };
      else if (strategyType === 'macd') params = { macdFast: 12, macdSlow: 26, macdSignal: 9 };
      else if (strategyType === 'momentum') params = { lookback: longPeriod, threshold: takeProfit };
      else if (strategyType === 'bollinger') params = { bbPeriod: longPeriod, bbStdDev: 2 };

      const name = strategyName || `${strategyType.toUpperCase()} ${symbol}`;
      const config = { name, strategy: { type: strategyType, params, stopLoss, takeProfit }, symbol };

      if (editId) {
        // Update existing
        if (typeof window !== 'undefined' && window.api?.strategy?.update) {
          await window.api.strategy.update(editId, config);
        }
      } else {
        await createStrategy(config);
      }
      onCreated();
    } catch (_e: unknown) { /* silent */ } finally {
      setCreating(false);
    }
  }

  const typeLabels: Record<string, string> = {
    ma_cross: i18n.t('StrategyPage.k48'), rsi: i18n.t('StrategyPage.k49'), macd: i18n.t('StrategyPage.k50'),
    momentum: i18n.t('StrategyPage.k51'), bollinger: i18n.t('StrategyPage.k52'),
  };

  return (
    <div className="mb-8">
      <button onClick={onBack} className="text-gray-400 hover:text-gray-200 text-sm mb-4 flex items-center gap-1">{"components.back"}</button>

      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-6 space-y-5">
        <h2 className="text-white font-semibold">{editId ? i18n.t('StrategyPage.k53') : i18n.t('StrategyPage.k54')}</h2>

        {/* Strategy name */}
        <div>
          <label className="block text-gray-400 text-xs mb-1">{'strategyName'}</label>
          <input
            type="text"
            value={strategyName}
            onChange={(e) => setStrategyName(e.target.value)}
            placeholder={strategyName || `${strategyType.toUpperCase()} ${symbol}`}
            className="w-full bg-[#12121a] border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-[#C9A046]/50"
          />
        </div>

        {/* Strategy type */}
        <div>
          <label className="block text-gray-400 text-xs mb-1">{i18n.t('StrategyPage.k55')}</label>
          <select value={strategyType} onChange={(e) => setStrategyType(e.target.value)} className="w-full bg-[#12121a] border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-[#C9A046]/50">
            {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>

        {/* Symbol */}
        <div>
          <label className="block text-gray-400 text-xs mb-1">{i18n.t('StrategyPage.k56')}</label>
          <select value={symbol} onChange={(e) => setSymbol(e.target.value)} className="w-full bg-[#12121a] border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-[#C9A046]/50">
            {['US.TQQQ','US.SQQQ','US.QQQ','US.SPY','US.SOXL','US.AAPL','US.NVDA','US.MSFT','US.TSLA','US.AMD'].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Parameters (dynamic based on type) */}
        {strategyType === 'ma_cross' && (
          <div className="grid grid-cols-2 gap-4">
            <SliderInput label={i18n.t('StrategyPage.k57')} value={shortPeriod} min={2} max={50} onChange={setShortPeriod} />
            <SliderInput label={i18n.t('StrategyPage.k58')} value={longPeriod} min={10} max={200} onChange={setLongPeriod} />
          </div>
        )}
        {strategyType === 'rsi' && (
          <div className="grid grid-cols-2 gap-4">
            <SliderInput label={i18n.t('StrategyPage.k59')} value={rsiOversold} min={10} max={45} onChange={setRsiOversold} />
            <SliderInput label={i18n.t('StrategyPage.k60')} value={rsiOverbought} min={55} max={90} onChange={setRsiOverbought} />
          </div>
        )}

        {/* Risk management */}
        <div className="border-t border-white/5 pt-4">
          <h3 className="text-gray-300 text-xs font-medium uppercase tracking-wider mb-3">{i18n.t('StrategyPage.k61')}</h3>
          <div className="grid grid-cols-2 gap-4">
            <SliderInput label={'stopLoss'} value={stopLoss} min={1} max={30} onChange={setStopLoss} unit="%" />
            <SliderInput label={'takeProfit'} value={takeProfit} min={5} max={100} onChange={setTakeProfit} unit="%" />
          </div>
        </div>

        <button onClick={handleCreate} disabled={creating} className="px-5 py-2.5 bg-[#C9A046] text-black font-medium rounded-lg text-sm hover:bg-[#D4A853] disabled:opacity-40 transition-colors">
          {creating ? (editId ? i18n.t('StrategyPage.k62') : i18n.t('StrategyPage.k63')) : (editId ? i18n.t('StrategyPage.k64') : i18n.t('StrategyPage.k65'))}
        </button>
      </div>
    </div>
  );
}

function SliderInput({ label, value, min, max, onChange, unit = '' }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void; unit?: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-400">{label}</span>
        <span className="text-[#D4A853] font-mono">{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full h-1.5 bg-[#12121a] rounded-lg appearance-none cursor-pointer accent-[#C9A046]" />
    </div>
  );
}

// ── My Strategies ──────────────────────────────────────────────────────────

function MyStrategies({ strategies, onSelect, onEdit, onDelete, onCompare }: { strategies: any[]; onSelect: (id: string) => void; onEdit: (id: string) => void; onDelete: (id: string) => void; onCompare: (strategy: Record<string, unknown>) => void }) {
  const statusColors: Record<string, string> = {
    draft: 'text-gray-400 bg-gray-500/20',
    backtested: 'text-blue-400 bg-blue-500/20',
    live: 'text-emerald-400 bg-emerald-500/20',
    stopped: 'text-red-400 bg-red-500/20',
    simulating: 'text-yellow-400 bg-yellow-500/20',
  };

  const statusLabels: Record<string, string> = {
    draft: i18n.t('StrategyPage.k66'), backtested: i18n.t('StrategyPage.k67'), live: i18n.t('StrategyPage.k68'), stopped: 'stopped', simulating: i18n.t('StrategyPage.k69'),
  };

  if (strategies.length === 0) {
    return (
      <div>
        <h2 className="text-white font-semibold mb-3">{i18n.t('StrategyPage.k70')}</h2>
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-8 text-center">
          <div className="text-3xl mb-2 opacity-40">🐋</div>
          <p className="text-gray-400 text-sm">{i18n.t('StrategyPage.k71')}</p>
          <p className="text-gray-500 text-xs mt-1">{i18n.t('StrategyPage.k72')}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-white font-semibold mb-3">{i18n.t('StrategyPage.k73')}</h2>
      <div className="space-y-2">
        {strategies.map((s) => (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className="w-full bg-[#1a1a25] border border-white/5 rounded-xl p-4 text-left hover:border-[#C9A046]/30 transition-all flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div>
                <h4 className="text-white text-sm font-medium">{s.name || i18n.t('StrategyPage.k74')}</h4>
                <p className="text-gray-500 text-xs mt-0.5">{s.symbol || 'US.TQQQ'} · {s.strategy?.type || 'unknown'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-xs px-2 py-1 rounded ${statusColors[s.status] || 'text-gray-400 bg-gray-500/20'}`}>
                {statusLabels[s.status] || s.status}
              </span>
              <span className="text-gray-600 text-xs">{s.createdAt ? new Date(s.createdAt).toLocaleDateString() : ''}</span>
              <button
                onClick={(e) => { e.stopPropagation(); onCompare(s); }}
                className="text-xs px-2 py-1 rounded bg-[#C9A046]/10 text-[#D4A853] hover:bg-[#C9A046]/20"
                title={i18n.t('StrategyPage.k75')}
              >⚖️</button>
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(s.id); }}
                className="text-xs px-2 py-1 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
                title={i18n.t('StrategyPage.k76')}
              >✏️</button>
              <button
                onClick={(e) => { e.stopPropagation(); if (confirm(`确认删除策略「${s.name}」？`)) onDelete(s.id); }}
                className="text-xs px-2 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20"
                title={i18n.t('StrategyPage.k77')}
              >🗑️</button>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Strategy Detail ────────────────────────────────────────────────────────

function StrategyDetail({ strategyId, onBack, onRefresh }: { strategyId: string; onBack: () => void; onRefresh: () => void }) {
  const [strategy, setStrategy] = useState<unknown>(null);
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const [backtestLoading, setBacktestLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadDetail();
  }, [strategyId]);

  async function loadDetail() {
    const list = await getAllStrategies();
    const found = list.find((s: any) => s.id === strategyId);
    setStrategy(found || null);
    if (found?.backtestResult) {
      setBacktestResult(found.backtestResult);
    }
  }

  async function handleBacktest() {
    setBacktestLoading(true);
    try {
      const result = await runBacktest({
        strategyId,
        // @ts-ignore — R89 type fix
        symbol: strategy?.symbol || 'US.TQQQ',
        period: 'daily',
        // @ts-ignore — R89 type fix
        count: 200,
        // @ts-ignore — R89 type fix
        strategy: strategy?.strategy,
        initialCapital: 100000,
        commission: 0.001,
        slippage: 0.0005,
      });
      if (result.success) setBacktestResult(result.result);
    } catch (_e: unknown) { /* silent */ } finally {
      setBacktestLoading(false);
    }
  }

  async function handleStartLive() {
    setActionLoading(true);
    try {
      await startLive(strategyId);
      onRefresh();
      loadDetail();
    } catch (_e: unknown) { /* silent */ } finally {
      setActionLoading(false);
    }
  }

  async function handleStopLive() {
    setActionLoading(true);
    try {
      await stopLive(strategyId);
      onRefresh();
      loadDetail();
    } catch (_e: unknown) { /* silent */ } finally {
      setActionLoading(false);
    }
  }

  if (!strategy) {
    return (
      <div>
        <button onClick={onBack} className="text-gray-400 hover:text-gray-200 text-sm mb-4 flex items-center gap-1">{"components.back"}</button>
        <p className="text-gray-500">{"components.loading"}</p>
      </div>
    );
  }

  const isLive = (strategy as any).status === 'live';

  return (
    <div>
      <button onClick={onBack} className="text-gray-400 hover:text-gray-200 text-sm mb-4 flex items-center gap-1">{"components.back"}</button>

      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-6 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-white font-semibold text-lg">{(strategy as any).name}</h2>
            <p className="text-gray-400 text-sm mt-1">{(strategy as any).description}</p>
          </div>
          <span className={`text-xs px-3 py-1 rounded-lg ${isLive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-500/20 text-gray-400'}`}>
            {isLive ? i18n.t('StrategyPage.k78') : (strategy as any).status}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-[#12121a] rounded-lg p-3">
            <div className="text-gray-500 text-xs mb-1">{i18n.t('StrategyPage.k79')}</div>
            <div className="text-[#D4A853] font-mono text-sm">{(strategy as any).symbol}</div>
          </div>
          <div className="bg-[#12121a] rounded-lg p-3">
            <div className="text-gray-500 text-xs mb-1">{"components.type"}</div>
            <div className="text-gray-200 text-sm">{(strategy as any).strategy?.type}</div>
          </div>
          {(strategy as any).strategy?.stopLoss && (
            <div className="bg-[#12121a] rounded-lg p-3">
              <div className="text-gray-500 text-xs mb-1">{"components.stopLoss"}</div>
              <div className="text-red-400 text-sm">{(strategy as any).strategy.stopLoss}%</div>
            </div>
          )}
          {(strategy as any).strategy?.takeProfit && (
            <div className="bg-[#12121a] rounded-lg p-3">
              <div className="text-gray-500 text-xs mb-1">{"components.takeProfit"}</div>
              <div className="text-emerald-400 text-sm">{(strategy as any).strategy.takeProfit}%</div>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button onClick={handleBacktest} disabled={backtestLoading} className="px-4 py-2 bg-[#22222f] text-gray-300 rounded-lg text-sm hover:bg-[#2a2a3a] transition-colors">
            {backtestLoading ? i18n.t('StrategyPage.k80') : i18n.t('StrategyPage.k81')}
          </button>
          {isLive ? (
            <button onClick={handleStopLive} disabled={actionLoading} className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm hover:bg-red-500/30 transition-colors">
              ⏹ 停止
            </button>
          ) : (
            <button onClick={handleStartLive} disabled={actionLoading} className="px-4 py-2 bg-[#C9A046] text-black font-medium rounded-lg text-sm hover:bg-[#D4A853] transition-colors">
              ⚡ 启动实盘
            </button>
          )}
        </div>
      </div>

      {backtestResult && <BacktestPanel result={backtestResult} />}

      <StrategyExplainCard strategy={strategy} />
    </div>
  );
}
