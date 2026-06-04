import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { createStrategy, getAllStrategies, runBacktest, startLive, stopLive, parseNL, getTemplates, deleteStrategy } from '../../lib/bridge-api';
import StrategyExplainCard from './StrategyExplainCard';
import StrategyCompareModal from './StrategyCompareModal';
// import TemplateBrowser from './TemplateBrowser';
import PaperTraderPanel from './PaperTraderPanel';

type CreateMode = null | 'ai' | 'template' | 'form' | 'paper';

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
  const { t } = useTranslation();
  const [mode, setMode] = useState<CreateMode>(null);
  const [strategies, setStrategies] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nlPrefill, setNlPrefill] = useState<ParsedStrategy | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareDefaultA, setCompareDefaultA] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStrategies();
  }, [refreshKey]);

  async function loadStrategies() {
    setLoading(true);
    setError(null);
    try {
      const list = await getAllStrategies();
      setStrategies(list);
    } catch (e: any) {
      setError(e?.message || t('common.loadingFailed'));
    } finally {
      setLoading(false);
    }
  }

  function refresh() {
    setRefreshKey((k) => k + 1);
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Page header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">{t('strategy.title')}</h1>
          <p className="text-gray-400 text-sm">{t('strategy.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">{strategies.length} {t('strategy.strategyCount')}</span>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <div className="text-gray-500 text-sm">{t('common.loading')}</div>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4 text-red-400 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={loadStrategies} className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 rounded text-xs transition-colors">{t('common.retry')}</button>
        </div>
      )}

      {!mode && !selectedId && (
        <>
          <button
            onClick={() => setMode('paper')}
            className="w-full bg-[#0d1a0d] border border-green-500/20 rounded-xl p-4 text-left hover:border-green-500/40 transition-all mb-4"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">🎯</span>
              <div>
            <div className="text-green-400 font-semibold text-sm">{t('strategy.paperTrading')}</div>
            <div className="text-gray-400 text-xs">{t('strategy.paperTradingDesc')}</div>
              </div>
              <div className="ml-auto text-green-500/60 text-xs">→ 进入</div>
            </div>
          </button>
          <ModeSelector onSelect={setMode} />
        </>
      )}
      {mode === 'paper' && (
        <div className="mb-4">
          <button onClick={() => setMode(null)} className="text-gray-400 hover:text-white text-xs flex items-center gap-1 mb-4 transition-colors">← {t('strategy.backToLab')}</button>
          <PaperTraderPanel />
        </div>
      )}
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
          strategies={strategies}
          defaultStrategyA={compareDefaultA}
          onClose={() => setCompareOpen(false)}
        />
      )}
    </div>
  );
}

// ── Mode Selector ──────────────────────────────────────────────────────────

function ModeSelector({ onSelect }: { onSelect: (m: CreateMode) => void }) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-3 gap-4 mb-8">
      <button onClick={() => onSelect('ai')} className="bg-[#1a1a25] border border-white/5 rounded-xl p-6 text-left hover:border-[#C9A046]/50 transition-all group">
        <div className="text-3xl mb-3">💬</div>
        <h3 className="text-white font-semibold mb-1 group-hover:text-[#D4A853] transition-colors">{t('strategy.speakIt')}</h3>
        <p className="text-gray-400 text-xs leading-relaxed">{t('strategy.speakItDesc')}</p>
        <div className="mt-3 text-[#D4A853] text-xs font-medium">{t('strategy.recommendedForBeginners')} →</div>
      </button>
      <button onClick={() => onSelect('template')} className="bg-[#1a1a25] border border-white/5 rounded-xl p-6 text-left hover:border-[#C9A046]/50 transition-all group">
        <div className="text-3xl mb-3">📋</div>
        <h3 className="text-white font-semibold mb-1 group-hover:text-[#D4A853] transition-colors">{t('strategy.chooseTemplate')}</h3>
        <p className="text-gray-400 text-xs leading-relaxed">{t('strategy.chooseTemplateDesc')}</p>
        <div className="mt-3 text-gray-500 text-xs">8 {t('strategy.templateCount')}</div>
      </button>
      <button onClick={() => onSelect('form')} className="bg-[#1a1a25] border border-white/5 rounded-xl p-6 text-left hover:border-[#C9A046]/50 transition-all group">
        <div className="text-3xl mb-3">📊</div>
        <h3 className="text-white font-semibold mb-1 group-hover:text-[#D4A853] transition-colors">{t('strategy.fillForm')}</h3>
        <p className="text-gray-400 text-xs leading-relaxed">{t('strategy.fillFormDesc')}</p>
        <div className="mt-3 text-gray-500 text-xs">{t('strategy.fullyCustomizable')}</div>
      </button>
    </div>
  );
}

// ── AI Natural Language Creator ────────────────────────────────────────────

function AICreator({ onBack, onCreated, onFillForm }: { onBack: () => void; onCreated: () => void; onFillForm?: (parsed: ParsedStrategy) => void }) {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [parsed, setParsed] = useState<ParsedStrategy | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const [backtestLoading, setBacktestLoading] = useState(false);
  const [strategyId, setStrategyId] = useState<string | null>(null);

  const examples = [
    'MA5 上穿 MA20 买入 TQQQ，止损 5%',
    'RSI 低于 30 买入 AAPL，RSI 高于 70 卖出',
    'MACD 金叉买入 QQQ，止盈 10% 止损 3%',
    '布林带下轨买入 NVDA，上轨卖出',
    '20日动量突破 5% 买入 SOXL',
  ];

  async function handleParse() {
    if (!input.trim()) return;
    setLoading(true);
    setError('');
    setParsed(null);
    setBacktestResult(null);

    try {
      const result = await parseNL(input);
      setParsed(result);
      if (!result.success) {
        setError(result.error || '无法识别策略模式');
      }
    } catch (e: any) {
      setError(e.message || '解析失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
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
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleBacktest() {
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
    } catch (e: any) {
      // silent
    } finally {
      setBacktestLoading(false);
    }
  }

  return (
    <div className="mb-8">
      <button onClick={onBack} className="text-gray-400 hover:text-gray-200 text-sm mb-4 flex items-center gap-1">← {t('common.back')}</button>

      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-6">
        <h2 className="text-white font-semibold mb-1 flex items-center gap-2">💬 {t('strategy.describeStrategy')}</h2>
        <p className="text-gray-400 text-xs mb-4">{t('strategy.aiParseDesc')}</p>

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('strategy.examplePlaceholder')}
          className="w-full h-28 bg-[#12121a] border border-white/10 rounded-lg p-4 text-sm text-gray-200 placeholder-gray-600 resize-none focus:outline-none focus:border-[#C9A046]/50"
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleParse(); }}
        />

        <div className="flex items-center gap-2 mt-3">
          <button onClick={handleParse} disabled={!input.trim() || loading} className="px-4 py-2 bg-[#C9A046] text-black font-medium rounded-lg text-sm hover:bg-[#D4A853] disabled:opacity-40 transition-colors">
            {loading ? t('common.parsing') : `🤖 ${t('strategy.parseStrategy')}`}
          </button>
          <span className="text-gray-500 text-xs">{t('common.orTry')}：</span>
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
              <div className="text-gray-500 text-xs mb-1">策略类型</div>
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
              {strategyId ? '✓ 已保存' : '💾 保存策略'}
            </button>
            <button onClick={handleBacktest} disabled={backtestLoading} className="px-4 py-2 bg-[#22222f] text-gray-300 rounded-lg text-sm hover:bg-[#2a2a3a] transition-colors">
              {backtestLoading ? '⏳ 回测中...' : '📈 回测 200 天'}
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
        <MetricCard label="总收益" value={`${result.totalReturn > 0 ? '+' : ''}${result.totalReturn}%`} color={returnColor} />
        <MetricCard label="年化收益" value={`${result.annualReturn > 0 ? '+' : ''}${result.annualReturn}%`} color={returnColor} />
        <MetricCard label="夏普比率" value={result.sharpeRatio.toFixed(2)} color={result.sharpeRatio > 1 ? 'text-emerald-400' : result.sharpeRatio > 0 ? 'text-yellow-400' : 'text-red-400'} />
        <MetricCard label="最大回撤" value={`-${result.maxDrawdown}%`} color="text-red-400" />
        <MetricCard label="胜率" value={`${result.winRate}%`} color={result.winRate > 50 ? 'text-emerald-400' : 'text-yellow-400'} />
        <MetricCard label="盈亏比" value={result.profitFactor === Infinity ? '∞' : result.profitFactor.toFixed(2)} color={result.profitFactor > 1.5 ? 'text-emerald-400' : 'text-yellow-400'} />
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
  const [templates, setTemplates] = useState<any[]>([]);
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
    } catch (e) { console.error('[Error:StrategyPage]', e); } finally {
      setLoading(false);
    }
  }

  const riskColors: Record<string, string> = { '低': 'text-emerald-400 bg-emerald-500/20', '中': 'text-yellow-400 bg-yellow-500/20', '高': 'text-red-400 bg-red-500/20' };

  return (
    <div className="mb-8">
      <button onClick={onBack} className="text-gray-400 hover:text-gray-200 text-sm mb-4 flex items-center gap-1">← 返回</button>

      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-white font-semibold">📋 策略模板库</h2>
        <div className="flex gap-2 text-xs">
          <button className="px-3 py-1 bg-[#C9A046]/20 text-[#D4A853] rounded-full">全部</button>
          <button className="px-3 py-1 bg-[#22222f] text-gray-400 rounded-full hover:text-gray-200">趋势</button>
          <button className="px-3 py-1 bg-[#22222f] text-gray-400 rounded-full hover:text-gray-200">动量</button>
          <button className="px-3 py-1 bg-[#22222f] text-gray-400 rounded-full hover:text-gray-200">均值回归</button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {templates.map((t) => (
          <button
            key={t.id}
            onClick={() => setSelected(t.id === selected ? null : t.id)}
            className={`bg-[#1a1a25] border rounded-lg p-4 text-left transition-all ${
              selected === t.id ? 'border-[#C9A046]/50 bg-[#22222f]' : 'border-white/5 hover:border-white/10'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-white text-sm font-medium">{t.name}</h4>
              <span className={`text-xs px-2 py-0.5 rounded ${riskColors[t.risk] || 'text-gray-400 bg-gray-500/20'}`}>{t.risk}风险</span>
            </div>
            <p className="text-gray-400 text-xs mb-3 leading-relaxed">{t.description}</p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 bg-[#22222f] px-2 py-0.5 rounded">{t.category}</span>
            </div>
            {selected === t.id && (
              <div className="mt-3 pt-3 border-t border-white/5">
                <button onClick={(e) => { e.stopPropagation(); handleUse(t); }} disabled={loading} className="w-full px-3 py-2 bg-[#C9A046] text-black text-xs font-medium rounded-lg hover:bg-[#D4A853] disabled:opacity-40 transition-colors">
                  {loading ? '创建中...' : '使用此模板 →'}
                </button>
              </div>
            )}
          </button>
        ))}
        {templates.length === 0 && (
          <div className="col-span-3 text-center py-8 text-gray-500 text-sm">加载模板中...</div>
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
        } catch (e) { console.error('[Error:StrategyPage]', e); }
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
    } catch (e) { console.error('[Error:StrategyPage]', e); } finally {
      setCreating(false);
    }
  }

  const typeLabels: Record<string, string> = {
    ma_cross: '均线交叉', rsi: 'RSI 超买超卖', macd: 'MACD 金叉死叉',
    momentum: '动量突破', bollinger: '布林带突破',
  };

  return (
    <div className="mb-8">
      <button onClick={onBack} className="text-gray-400 hover:text-gray-200 text-sm mb-4 flex items-center gap-1">← 返回</button>

      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-6 space-y-5">
        <h2 className="text-white font-semibold">{editId ? '✏️ 编辑策略' : '📊 表单模式 — 精确配置'}</h2>

        {/* Strategy name */}
        <div>
          <label className="block text-gray-400 text-xs mb-1">策略名称</label>
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
          <label className="block text-gray-400 text-xs mb-1">策略类型</label>
          <select value={strategyType} onChange={(e) => setStrategyType(e.target.value)} className="w-full bg-[#12121a] border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-[#C9A046]/50">
            {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>

        {/* Symbol */}
        <div>
          <label className="block text-gray-400 text-xs mb-1">交易标的</label>
          <select value={symbol} onChange={(e) => setSymbol(e.target.value)} className="w-full bg-[#12121a] border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-[#C9A046]/50">
            {['US.TQQQ','US.SQQQ','US.QQQ','US.SPY','US.SOXL','US.AAPL','US.NVDA','US.MSFT','US.TSLA','US.AMD'].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Parameters (dynamic based on type) */}
        {strategyType === 'ma_cross' && (
          <div className="grid grid-cols-2 gap-4">
            <SliderInput label="快速均线" value={shortPeriod} min={2} max={50} onChange={setShortPeriod} />
            <SliderInput label="慢速均线" value={longPeriod} min={10} max={200} onChange={setLongPeriod} />
          </div>
        )}
        {strategyType === 'rsi' && (
          <div className="grid grid-cols-2 gap-4">
            <SliderInput label="超卖线" value={rsiOversold} min={10} max={45} onChange={setRsiOversold} />
            <SliderInput label="超买线" value={rsiOverbought} min={55} max={90} onChange={setRsiOverbought} />
          </div>
        )}

        {/* Risk management */}
        <div className="border-t border-white/5 pt-4">
          <h3 className="text-gray-300 text-xs font-medium uppercase tracking-wider mb-3">风控参数</h3>
          <div className="grid grid-cols-2 gap-4">
            <SliderInput label="止损" value={stopLoss} min={1} max={30} onChange={setStopLoss} unit="%" />
            <SliderInput label="止盈" value={takeProfit} min={5} max={100} onChange={setTakeProfit} unit="%" />
          </div>
        </div>

        <button onClick={handleCreate} disabled={creating} className="px-5 py-2.5 bg-[#C9A046] text-black font-medium rounded-lg text-sm hover:bg-[#D4A853] disabled:opacity-40 transition-colors">
          {creating ? (editId ? '保存中...' : '创建中...') : (editId ? '💾 保存修改' : '✅ 创建策略')}
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

function MyStrategies({ strategies, onSelect, onEdit, onDelete, onCompare }: { strategies: any[]; onSelect: (id: string) => void; onEdit: (id: string) => void; onDelete: (id: string) => void; onCompare: (strategy: any) => void }) {
  const statusColors: Record<string, string> = {
    draft: 'text-gray-400 bg-gray-500/20',
    backtested: 'text-blue-400 bg-blue-500/20',
    live: 'text-emerald-400 bg-emerald-500/20',
    stopped: 'text-red-400 bg-red-500/20',
    simulating: 'text-yellow-400 bg-yellow-500/20',
  };

  const statusLabels: Record<string, string> = {
    draft: '草稿', backtested: '已回测', live: '🟢 运行中', stopped: '已停止', simulating: '模拟中',
  };

  if (strategies.length === 0) {
    return (
      <div>
        <h2 className="text-white font-semibold mb-3">我的策略</h2>
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-8 text-center">
          <div className="text-3xl mb-2 opacity-40">🐋</div>
          <p className="text-gray-400 text-sm">还没有策略</p>
          <p className="text-gray-500 text-xs mt-1">用上面三种方式创建你的第一个策略</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-white font-semibold mb-3">我的策略</h2>
      <div className="space-y-2">
        {strategies.map((s) => (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className="w-full bg-[#1a1a25] border border-white/5 rounded-xl p-4 text-left hover:border-[#C9A046]/30 transition-all flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div>
                <h4 className="text-white text-sm font-medium">{s.name || '未命名策略'}</h4>
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
                title="AI 对比策略"
              >⚖️</button>
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(s.id); }}
                className="text-xs px-2 py-1 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
                title="编辑策略"
              >✏️</button>
              <button
                onClick={(e) => { e.stopPropagation(); if (confirm(`确认删除策略「${s.name}」？`)) onDelete(s.id); }}
                className="text-xs px-2 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20"
                title="删除策略"
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
  const [strategy, setStrategy] = useState<any>(null);
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
        symbol: strategy?.symbol || 'US.TQQQ',
        period: 'daily',
        count: 200,
        strategy: strategy?.strategy,
        initialCapital: 100000,
        commission: 0.001,
        slippage: 0.0005,
      });
      if (result.success) setBacktestResult(result.result);
    } catch (e) { console.error('[Error:StrategyPage]', e); } finally {
      setBacktestLoading(false);
    }
  }

  async function handleStartLive() {
    setActionLoading(true);
    try {
      await startLive(strategyId);
      onRefresh();
      loadDetail();
    } catch (e) { console.error('[Error:StrategyPage]', e); } finally {
      setActionLoading(false);
    }
  }

  async function handleStopLive() {
    setActionLoading(true);
    try {
      await stopLive(strategyId);
      onRefresh();
      loadDetail();
    } catch (e) { console.error('[Error:StrategyPage]', e); } finally {
      setActionLoading(false);
    }
  }

  if (!strategy) {
    return (
      <div>
        <button onClick={onBack} className="text-gray-400 hover:text-gray-200 text-sm mb-4 flex items-center gap-1">← 返回</button>
        <p className="text-gray-500">加载中...</p>
      </div>
    );
  }

  const isLive = strategy.status === 'live';

  return (
    <div>
      <button onClick={onBack} className="text-gray-400 hover:text-gray-200 text-sm mb-4 flex items-center gap-1">← 返回</button>

      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-6 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-white font-semibold text-lg">{strategy.name}</h2>
            <p className="text-gray-400 text-sm mt-1">{strategy.description}</p>
          </div>
          <span className={`text-xs px-3 py-1 rounded-lg ${isLive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-500/20 text-gray-400'}`}>
            {isLive ? '🟢 运行中' : strategy.status}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-[#12121a] rounded-lg p-3">
            <div className="text-gray-500 text-xs mb-1">标的</div>
            <div className="text-[#D4A853] font-mono text-sm">{strategy.symbol}</div>
          </div>
          <div className="bg-[#12121a] rounded-lg p-3">
            <div className="text-gray-500 text-xs mb-1">类型</div>
            <div className="text-gray-200 text-sm">{strategy.strategy?.type}</div>
          </div>
          {strategy.strategy?.stopLoss && (
            <div className="bg-[#12121a] rounded-lg p-3">
              <div className="text-gray-500 text-xs mb-1">止损</div>
              <div className="text-red-400 text-sm">{strategy.strategy.stopLoss}%</div>
            </div>
          )}
          {strategy.strategy?.takeProfit && (
            <div className="bg-[#12121a] rounded-lg p-3">
              <div className="text-gray-500 text-xs mb-1">止盈</div>
              <div className="text-emerald-400 text-sm">{strategy.strategy.takeProfit}%</div>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button onClick={handleBacktest} disabled={backtestLoading} className="px-4 py-2 bg-[#22222f] text-gray-300 rounded-lg text-sm hover:bg-[#2a2a3a] transition-colors">
            {backtestLoading ? '⏳ 回测中...' : '📈 回测'}
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
