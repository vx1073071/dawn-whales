import React, { useState } from 'react';

type CreateMode = null | 'ai' | 'template' | 'form';

export default function StrategyPage() {
  const [mode, setMode] = useState<CreateMode>(null);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">策略工坊</h1>
        <p className="text-gray-400 text-sm">创建、回测、优化你的量化策略</p>
      </div>

      {!mode && <ModeSelector onSelect={setMode} />}
      {mode === 'ai' && <AICreator onBack={() => setMode(null)} />}
      {mode === 'template' && <TemplateBrowser onBack={() => setMode(null)} />}
      {mode === 'form' && <FormCreator onBack={() => setMode(null)} />}

      {/* Existing strategies */}
      <MyStrategies />
    </div>
  );
}

// ── Mode Selector ──────────────────────────────────────────────────────────

function ModeSelector({ onSelect }: { onSelect: (m: CreateMode) => void }) {
  return (
    <div className="grid grid-cols-3 gap-4 mb-8">
      <button
        onClick={() => onSelect('ai')}
        className="bg-surface-2 border border-border rounded-xl p-6 text-left hover:border-primary/50 hover:bg-surface-3 transition-all group"
      >
        <div className="text-3xl mb-3">💬</div>
        <h3 className="text-white font-semibold mb-1 group-hover:text-primary transition-colors">说出来</h3>
        <p className="text-gray-400 text-xs leading-relaxed">
          用自然语言描述你的策略思路<br />
          AI 帮你自动生成可执行策略
        </p>
        <div className="mt-3 text-primary text-xs font-medium">推荐新手 →</div>
      </button>

      <button
        onClick={() => onSelect('template')}
        className="bg-surface-2 border border-border rounded-xl p-6 text-left hover:border-primary/50 hover:bg-surface-3 transition-all group"
      >
        <div className="text-3xl mb-3">📋</div>
        <h3 className="text-white font-semibold mb-1 group-hover:text-primary transition-colors">选模板</h3>
        <p className="text-gray-400 text-xs leading-relaxed">
          经典策略模板库<br />
          选一个改改参数就能用
        </p>
        <div className="mt-3 text-gray-500 text-xs">10+ 策略模板</div>
      </button>

      <button
        onClick={() => onSelect('form')}
        className="bg-surface-2 border border-border rounded-xl p-6 text-left hover:border-primary/50 hover:bg-surface-3 transition-all group"
      >
        <div className="text-3xl mb-3">📊</div>
        <h3 className="text-white font-semibold mb-1 group-hover:text-primary transition-colors">填表单</h3>
        <p className="text-gray-400 text-xs leading-relaxed">
          下拉菜单 + 滑块 + 数字输入<br />
          精确控制每个参数
        </p>
        <div className="mt-3 text-gray-500 text-xs">完全自定义</div>
      </button>
    </div>
  );
}

// ── AI Natural Language Creator ────────────────────────────────────────────

function AICreator({ onBack }: { onBack: () => void }) {
  const [input, setInput] = useState('');
  const [generated, setGenerated] = useState(false);

  const examples = [
    'RSI低于30时买入AAPL，仓位20%，RSI超过70全部卖出，止损5%',
    '当5日均线上穿20日均线时买入，下穿时卖出，最多持有5只股票',
    '每月初选过去3个月涨幅最大的3只科技股，等权持有，月末轮动',
    '布林带下轨买入，上轨卖出，止损3%，适合震荡市',
  ];

  return (
    <div className="mb-8">
      <button onClick={onBack} className="text-gray-400 hover:text-gray-200 text-sm mb-4 flex items-center gap-1">
        ← 返回
      </button>

      <div className="bg-surface-2 border border-border rounded-xl p-6">
        <h2 className="text-white font-semibold mb-1 flex items-center gap-2">
          💬 用自然语言描述你的策略
        </h2>
        <p className="text-gray-400 text-xs mb-4">像跟朋友聊天一样说就行，AI 会帮你转成可执行的策略</p>

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="例如：当 RSI 低于 30 的时候买入苹果股票，每次投入 20% 的资金，RSI 超过 70 就全部卖掉，如果亏了 5% 就止损..."
          className="w-full h-32 bg-surface-1 border border-border rounded-lg p-4 text-sm text-gray-200 placeholder-gray-600 resize-none focus:outline-none focus:border-primary/50"
        />

        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={() => setGenerated(true)}
            disabled={!input.trim()}
            className="px-4 py-2 bg-primary text-black font-medium rounded-lg text-sm hover:bg-primary-bright disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            生成策略
          </button>
          <span className="text-gray-500 text-xs">或试试这些例子：</span>
        </div>

        <div className="flex flex-wrap gap-2 mt-2">
          {examples.map((ex, i) => (
            <button
              key={i}
              onClick={() => setInput(ex)}
              className="text-xs text-gray-400 bg-surface-3 px-3 py-1.5 rounded-lg hover:text-gray-200 hover:bg-surface-hover transition-colors"
            >
              {ex.slice(0, 20)}...
            </button>
          ))}
        </div>
      </div>

      {/* Generated strategy card (mock) */}
      {generated && input && (
        <div className="mt-4 bg-surface-2 border border-primary/30 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-primary">✓</span>
            <h3 className="text-white font-semibold">策略已生成</h3>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-500 text-xs mb-1">买入条件</div>
              <div className="text-gray-200">RSI(14) &lt; 30 → 买入 AAPL</div>
            </div>
            <div>
              <div className="text-gray-500 text-xs mb-1">卖出条件</div>
              <div className="text-gray-200">RSI(14) &gt; 70 → 全部卖出</div>
            </div>
            <div>
              <div className="text-gray-500 text-xs mb-1">仓位</div>
              <div className="text-gray-200">每笔 20%</div>
            </div>
            <div>
              <div className="text-gray-500 text-xs mb-1">止损</div>
              <div className="text-up">固定止损 5%</div>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button className="px-4 py-2 bg-primary text-black font-medium rounded-lg text-sm hover:bg-primary-bright transition-colors">
              📈 回测 3 年
            </button>
            <button className="px-4 py-2 bg-surface-3 text-gray-300 rounded-lg text-sm hover:bg-surface-hover transition-colors">
              修改条件
            </button>
            <button className="px-4 py-2 bg-surface-3 text-gray-300 rounded-lg text-sm hover:bg-surface-hover transition-colors">
              ⚡ 一键实盘
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Template Browser ───────────────────────────────────────────────────────

const TEMPLATES = [
  { id: 'dual_ma', name: '双均线交叉', desc: 'MA金叉买入，死叉卖出', stars: 3, tag: '趋势', returnPct: '~12%' },
  { id: 'rsi_reversal', name: 'RSI 反转', desc: 'RSI<30买入，>70卖出', stars: 3, tag: '均值回归', returnPct: '~10%' },
  { id: 'boll_breakout', name: '布林带突破', desc: '突破上轨买，跌破下轨卖', stars: 3, tag: '趋势', returnPct: '~14%' },
  { id: 'momentum_rotation', name: '动量轮动', desc: '每月选最强N只，轮动持有', stars: 4, tag: '动量', returnPct: '~18%' },
  { id: 'turtle', name: '海龟交易法', desc: 'Donchian通道突破+ATR加仓', stars: 4, tag: '趋势', returnPct: '~15%' },
  { id: 'faber_trend', name: 'Faber 趋势跟踪', desc: '价格>10月MA持有，否则现金', stars: 3, tag: '趋势', returnPct: '~11%' },
  { id: 'faith_strategy', name: '信仰战法', desc: 'RSI入场+浮亏加仓+整仓止盈', stars: 5, tag: '高级', returnPct: '~25%' },
  { id: 'grid_trade', name: '网格交易', desc: '价格网格挂单，震荡市获利', stars: 3, tag: '震荡', returnPct: '~14%' },
  { id: 'pair_trade', name: '配对交易', desc: '协整配对，均值回归', stars: 4, tag: '统计套利', returnPct: '~8%' },
  { id: 'multi_factor', name: '多因子选股', desc: '价值+动量+质量 多因子打分', stars: 4, tag: '选股', returnPct: '~16%' },
];

function TemplateBrowser({ onBack }: { onBack: () => void }) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="mb-8">
      <button onClick={onBack} className="text-gray-400 hover:text-gray-200 text-sm mb-4 flex items-center gap-1">
        ← 返回
      </button>

      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-white font-semibold">📋 策略模板库</h2>
        <div className="flex gap-2 text-xs">
          <button className="px-3 py-1 bg-primary/20 text-primary rounded-full">全部</button>
          <button className="px-3 py-1 bg-surface-3 text-gray-400 rounded-full hover:text-gray-200">趋势</button>
          <button className="px-3 py-1 bg-surface-3 text-gray-400 rounded-full hover:text-gray-200">动量</button>
          <button className="px-3 py-1 bg-surface-3 text-gray-400 rounded-full hover:text-gray-200">均值回归</button>
          <button className="px-3 py-1 bg-surface-3 text-gray-400 rounded-full hover:text-gray-200">震荡</button>
          <button className="px-3 py-1 bg-surface-3 text-gray-400 rounded-full hover:text-gray-200">高级</button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            onClick={() => setSelected(t.id === selected ? null : t.id)}
            className={`bg-surface-2 border rounded-lg p-4 text-left transition-all ${
              selected === t.id
                ? 'border-primary/50 bg-surface-3'
                : 'border-border hover:border-border-light'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-white text-sm font-medium">{t.name}</h4>
              <span className="text-xs text-gray-500 bg-surface-3 px-2 py-0.5 rounded">{t.tag}</span>
            </div>
            <p className="text-gray-400 text-xs mb-3">{t.desc}</p>
            <div className="flex items-center justify-between">
              <span className="text-primary text-xs">{'⭐'.repeat(t.stars)}</span>
              <span className="text-gray-500 text-xs">年化 {t.returnPct}</span>
            </div>
            {selected === t.id && (
              <div className="mt-3 pt-3 border-t border-border">
                <button className="w-full px-3 py-2 bg-primary text-black text-xs font-medium rounded-lg hover:bg-primary-bright transition-colors">
                  使用此模板 →
                </button>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Form Creator ───────────────────────────────────────────────────────────

function FormCreator({ onBack }: { onBack: () => void }) {
  return (
    <div className="mb-8">
      <button onClick={onBack} className="text-gray-400 hover:text-gray-200 text-sm mb-4 flex items-center gap-1">
        ← 返回
      </button>

      <div className="bg-surface-2 border border-border rounded-xl p-6 space-y-6">
        <h2 className="text-white font-semibold">📊 表单模式 — 精确配置</h2>

        {/* Strategy type */}
        <Section title="策略类型">
          <Select label="策略类型" options={['趋势跟踪', '均值回归', '动量轮动', '震荡交易', '统计套利']} />
          <Select label="交易市场" options={['美股', '港股', 'A股', '加密货币']} />
          <Select label="股票池" options={['科技巨头', '纳斯达克100', '标普500', '自定义...', '全市场']} />
        </Section>

        {/* Entry conditions */}
        <Section title="入场条件">
          <Select label="买入信号" options={['均线交叉', 'RSI 超卖', 'MACD 金叉', '布林带突破', '动量排名', '自定义']} />
          <div className="grid grid-cols-2 gap-4">
            <Slider label="快速周期" min={2} max={50} defaultValue={5} />
            <Slider label="慢速周期" min={10} max={200} defaultValue={20} />
          </div>
        </Section>

        {/* Exit conditions */}
        <Section title="出场条件">
          <Select label="卖出信号" options={['均线交叉(反向)', 'RSI 超买', 'MACD 死叉', '布林带突破(反向)', '固定收益']} />
          <div className="grid grid-cols-2 gap-4">
            <Slider label="止损 %" min={1} max={30} defaultValue={5} unit="%" />
            <Slider label="止盈 %" min={5} max={100} defaultValue={15} unit="%" />
          </div>
        </Section>

        {/* Position sizing */}
        <Section title="仓位管理">
          <Select label="仓位方式" options={['等权分配', '固定金额', '固定比例', 'ATR波动率调整']} />
          <div className="grid grid-cols-2 gap-4">
            <Slider label="最大持仓数" min={1} max={20} defaultValue={5} />
            <Slider label="单只上限 %" min={5} max={50} defaultValue={20} unit="%" />
          </div>
        </Section>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button className="px-5 py-2.5 bg-primary text-black font-medium rounded-lg text-sm hover:bg-primary-bright transition-colors">
            生成策略
          </button>
          <button className="px-5 py-2.5 bg-surface-3 text-gray-300 rounded-lg text-sm hover:bg-surface-hover transition-colors">
            保存草稿
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Form helpers ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-gray-300 text-xs font-medium uppercase tracking-wider mb-3 pb-2 border-b border-border">
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Select({ label, options }: { label: string; options: string[] }) {
  return (
    <div>
      <label className="block text-gray-400 text-xs mb-1">{label}</label>
      <select className="w-full bg-surface-1 border border-border rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-primary/50">
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

function Slider({ label, min, max, defaultValue, unit = '' }: { label: string; min: number; max: number; defaultValue: number; unit?: string }) {
  const [val, setVal] = React.useState(defaultValue);
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-400">{label}</span>
        <span className="text-gray-200 font-mono">{val}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={val}
        onChange={(e) => setVal(Number(e.target.value))}
        className="w-full h-1.5 bg-surface-1 rounded-lg appearance-none cursor-pointer accent-primary"
      />
    </div>
  );
}

// ── My Strategies ──────────────────────────────────────────────────────────

function MyStrategies() {
  return (
    <div>
      <h2 className="text-white font-semibold mb-3">我的策略</h2>
      <div className="bg-surface-2 border border-border rounded-xl p-8 text-center">
        <div className="text-3xl mb-2 opacity-40">🧠</div>
        <p className="text-gray-400 text-sm">还没有策略</p>
        <p className="text-gray-500 text-xs mt-1">用上面三种方式创建你的第一个策略</p>
      </div>
    </div>
  );
}
