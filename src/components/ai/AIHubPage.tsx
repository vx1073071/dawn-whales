/**
 * AIHubPage — R244 P0-03 Claw(PM): AI收费服务总入口
 *
 * 问题: 7项AI收费功能分散在wallet/子面板,用户从侧边栏看不到
 * 修复: 统一AI Hub页面, 一目了然展示所有AI付费服务+定价+入口
 *
 * 14项AI服务 (v17.9):
 *   图表AI: 自动画线(1U) / AI对话(1U) / 参数填充(1U)
 *   策略AI: 策略组合(2U) / 回测解读(1U) / 优化建议(1.5U) / 健康检查(1U)
 *   因子AI: 因子推荐(1U) / 因子诊断(1U) / 因子优化(1.5U) / 替代数据(2U)
 *   事件AI: 事件策略生成(1.5U)
 *
 * 规则: 纯按次无免费轮无折扣, 执行失败不收费, 不弹窗静默扣款
 * 铁律: 不退款(唯一例外: AI服务执行失败→自动退费)
 */

import { useMemo, useState } from 'react';
import { AI_PRICE_TABLE } from '@/constants/fees';
import { useAIBalance } from '@/components/common/AIPriceBadge';

// ── Types ───────────────────────────────────────────────────────────────────

interface AIServiceCard {
  id: string;
  icon: string;
  title: string;
  titleCN: string;
  priceKey: keyof typeof AI_PRICE_TABLE;
  priceUSDT: number;
  description: string;
  descriptionCN: string;
  category: 'chart' | 'strategy' | 'factor' | 'event';
  route: string;        // sidebar view to navigate to
  tabKey?: string;       // tab key within the target page
  badge?: 'new' | 'hot' | 'popular';
  ComingSoon?: boolean;
}

// ── Service Definitions ──────────────────────────────────────────────────────

const AI_SERVICES: AIServiceCard[] = [
  // ── 图表AI ──
  {
    id: 'ai-draw',
    icon: '📐',
    title: 'Auto Draw + Pattern',
    titleCN: '自动画线+形态识别',
    priceKey: 'AI_DRAW_LINES',
    priceUSDT: 1.0,
    description: 'Auto-detect trend lines, support/resistance, and 68 chart patterns',
    descriptionCN: '自动检测趋势线、支撑阻力、68种K线形态，一键标注',
    category: 'chart',
    route: 'wallet',
    tabKey: 'draw',
    badge: 'popular',
  },
  {
    id: 'ai-chat',
    icon: '💬',
    title: 'AI Chat',
    titleCN: 'AI对话',
    priceKey: 'AI_CHAT',
    priceUSDT: 1.0,
    description: 'Chat with AI about any stock, strategy, or market question',
    descriptionCN: 'AI实时对话，回答策略、市场、风险等任何问题',
    category: 'chart',
    route: 'wallet',
    tabKey: 'chat',
  },
  {
    id: 'ai-param',
    icon: '🔧',
    title: 'Smart Param Fill',
    titleCN: '智能参数填充',
    priceKey: 'AI_PARAM_FILL',
    priceUSDT: 1.0,
    description: 'AI fills strategy parameters based on market conditions',
    descriptionCN: 'AI根据当前市场环境智能填充策略参数，不生成代码',
    category: 'chart',
    route: 'wallet',
    tabKey: 'param',
  },

  // ── 策略AI ──
  {
    id: 'ai-portfolio',
    icon: '🎯',
    title: 'Portfolio Generator',
    titleCN: '策略组合生成',
    priceKey: 'AI_PORTFOLIO',
    priceUSDT: 2.0,
    description: 'AI generates multi-strategy portfolio with optimal weight allocation',
    descriptionCN: 'AI生成多策略组合，自动优化权重配置，回测预览',
    category: 'strategy',
    route: 'wallet',
    tabKey: 'combo',
    badge: 'hot',
  },
  {
    id: 'ai-backtest',
    icon: '📊',
    title: 'Backtest Interpretation',
    titleCN: '回测解读',
    priceKey: 'AI_BACKTEST_READ',
    priceUSDT: 1.0,
    description: 'Deep interpretation of backtest results with actionable insights',
    descriptionCN: 'AI深度解读回测报告，找出问题+给出可操作改进建议',
    category: 'strategy',
    route: 'wallet',
    tabKey: 'backtest',
  },
  {
    id: 'ai-optimize',
    icon: '⚡',
    title: 'Strategy Optimization',
    titleCN: '策略优化建议',
    priceKey: 'AI_OPTIMIZE',
    priceUSDT: 1.5,
    description: 'AI optimizes strategy parameters with 5000+ weight combinations',
    descriptionCN: 'AI遍历5000+权重组合，给出优化参数+预期改善幅度',
    category: 'strategy',
    route: 'wallet',
    tabKey: 'optimize',
  },
  {
    id: 'ai-health',
    icon: '❤️',
    title: 'Health Check',
    titleCN: '策略健康检查',
    priceKey: 'AI_HEALTH_CHECK',
    priceUSDT: 1.0,
    description: 'Full strategy health radar: decay, staleness, drawdown analysis',
    descriptionCN: '策略5维健康雷达：衰减检测+30天连续亏损+90天未更新警报',
    category: 'strategy',
    route: 'wallet',
    tabKey: 'health',
  },

  // ── 因子AI ──
  {
    id: 'ai-factor',
    icon: '🧬',
    title: 'Factor Advisor',
    titleCN: 'AI因子推荐',
    priceKey: 'AI_FACTOR_ADVISOR',
    priceUSDT: 1.0,
    description: 'Natural language → optimal factor combination with backtest preview',
    descriptionCN: '自然语言→最优因子组合推荐+回测预览，"我想做高成长低波动"',
    category: 'factor',
    route: 'ai',
    badge: 'popular',
  },
  {
    id: 'ai-diagnosis',
    icon: '🔬',
    title: 'Factor Deep Diagnosis',
    titleCN: '因子深度诊断',
    priceKey: 'AI_FACTOR_DIAGNOSIS',
    priceUSDT: 1.0,
    description: '5-dimension radar + 8-metric health check for factor portfolio',
    descriptionCN: '因子5维雷达+8指标健康检查，IC衰减+拥挤度+相关性深度扫描',
    category: 'factor',
    route: 'ai',
    badge: 'new',
  },
  {
    id: 'ai-factor-opt',
    icon: '🔄',
    title: 'Factor Param Optimization',
    titleCN: '因子参数优化',
    priceKey: 'AI_FACTOR_OPTIMIZE',
    priceUSDT: 1.5,
    description: 'AI optimizes factor weights with VIF/correlation constraints',
    descriptionCN: 'AI优化因子权重，VIF+相关性约束，自动排除高共线因子',
    category: 'factor',
    route: 'ai',
  },
  {
    id: 'ai-alt-factor',
    icon: '🌐',
    title: 'Alt Data Factor Unlock',
    titleCN: '替代数据因子解锁',
    priceKey: 'AI_ALT_FACTOR',
    priceUSDT: 2.0,
    description: 'Unlock alternative data factors: satellite, sentiment, supply chain',
    descriptionCN: '解锁替代数据因子：卫星数据+供应链+社交情绪等另类因子',
    category: 'factor',
    route: 'ai',
    badge: 'new',
  },

  // ── 事件AI ──
  {
    id: 'ai-event',
    icon: '📅',
    title: 'Event Strategy Generator',
    titleCN: '事件策略生成',
    priceKey: 'AI_EVENT_STRATEGY',
    priceUSDT: 1.5,
    description: 'Corporate events → AI strategy parameter adjustments (earnings, Fed, CPI)',
    descriptionCN: '公司事件→AI策略参数调整建议(财报/加息/CPI/并购)，一键应用',
    category: 'event',
    route: 'ai',
    badge: 'new',
  },
];

// ── Category Config ─────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: 'chart',    icon: '📈', label: 'Chart AI',    labelCN: '图表AI',  color: '#3b82f6', bg: 'rgba(59,130,246,0.08)' },
  { id: 'strategy', icon: '🎯', label: 'Strategy AI', labelCN: '策略AI',  color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
  { id: 'factor',   icon: '🧬', label: 'Factor AI',   labelCN: '因子AI',  color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)' },
  { id: 'event',    icon: '📅', label: 'Event AI',    labelCN: '事件AI',  color: '#ef4444', bg: 'rgba(239,68,68,0.08)' },
] as const;

// ── Component ────────────────────────────────────────────────────────────────

export default function AIHubPage() {
  const { balance, canAfford } = useAIBalance();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredServices = useMemo(() => {
    let services = AI_SERVICES;
    if (selectedCategory) {
      services = services.filter(s => s.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      services = services.filter(s =>
        s.titleCN.toLowerCase().includes(q) ||
        s.title.toLowerCase().includes(q) ||
        s.descriptionCN.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q)
      );
    }
    return services;
  }, [selectedCategory, searchQuery]);

  const totalSpent = useMemo(() => {
    return AI_SERVICES.reduce((sum, s) => sum + s.priceUSDT, 0);
  }, []);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Header ── */}
      <div className="px-6 pt-5 pb-4 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              🤖 AI Service Hub
              <span className="text-xs font-normal text-gray-500">
                {AI_SERVICES.length} services · 1-2U per use
              </span>
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              按次付费 · 执行失败不收费 · 非AI故障不退款 · 静默扣款不弹窗
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-[10px] text-gray-500">Balance</div>
              <div className={`text-sm font-mono font-bold ${balance >= 1 ? 'text-[#D4A853]' : 'text-red-400'}`}>
                {balance.toFixed(2)} USDT
              </div>
            </div>
          </div>
        </div>

        {/* ── Search ── */}
        <div className="mt-3 relative">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search AI services... / 搜索AI服务..."
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#D4A853]/50"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {/* ── Category Tabs ── */}
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
              !selectedCategory
                ? 'bg-white/10 text-white'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            All ({AI_SERVICES.length})
          </button>
          {CATEGORIES.map(cat => {
            const count = AI_SERVICES.filter(s => s.category === cat.id).length;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1 ${
                  selectedCategory === cat.id
                    ? 'text-white'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
                style={selectedCategory === cat.id ? { background: cat.bg, color: cat.color, border: `1px solid ${cat.color}30` } : {}}
              >
                <span>{cat.icon}</span>
                {cat.labelCN} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Service Cards Grid ── */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filteredServices.map(service => {
            const catConfig = CATEGORIES.find(c => c.id === service.category)!;
            const affordable = canAfford(service.priceUSDT);

            return (
              <div
                key={service.id}
                className="group relative rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10 transition-all p-4"
              >
                {/* Category indicator bar */}
                <div
                  className="absolute top-0 left-4 right-4 h-[2px] rounded-b"
                  style={{ background: catConfig.color + '40' }}
                />

                {/* Header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{service.icon}</span>
                    <div>
                      <div className="text-sm font-semibold text-white leading-tight">
                        {service.titleCN}
                      </div>
                      <div className="text-[10px] text-gray-500">{service.title}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {service.badge && (
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                          service.badge === 'new' ? 'bg-green-500/15 text-green-400' :
                          service.badge === 'hot' ? 'bg-orange-500/15 text-orange-400' :
                          'bg-blue-500/15 text-blue-400'
                        }`}
                      >
                        {service.badge.toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-gray-400 leading-relaxed mb-3">
                  {service.descriptionCN}
                </p>

                {/* Price + Action */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-mono font-bold ${
                      affordable ? 'text-[#D4A853]' : 'text-red-400'
                    }`}>
                      {service.priceUSDT.toFixed(1)}U
                    </span>
                    <span className="text-[10px] text-gray-600">/次</span>
                    {!affordable && (
                      <span className="text-[9px] text-red-400/80">余额不足</span>
                    )}
                  </div>
                  <button
                    disabled={!affordable}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                      affordable
                        ? 'bg-[#C9A046] hover:bg-[#D4A853] text-black'
                        : 'bg-gray-500/10 text-gray-500 cursor-not-allowed'
                    }`}
                    title={!affordable ? 'USDT余额不足' : `${service.titleCN} — ${service.priceUSDT}U/次`}
                  >
                    {affordable ? '使用' : '充值'}
                  </button>
                </div>

                {/* No-refund notice */}
                <div className="mt-2 text-[9px] text-gray-600 leading-tight">
                  服务一经消费，非AI故障不退款
                </div>
              </div>
            );
          })}
        </div>

        {filteredServices.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <span className="text-3xl mb-2">🔍</span>
            <span className="text-sm">No matching AI services</span>
            <span className="text-xs mt-1">没有匹配的AI服务</span>
          </div>
        )}

        {/* ── Bottom Summary ── */}
        <div className="mt-6 p-4 rounded-xl border border-white/5 bg-white/[0.01]">
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-400">
              💡 Tip: 所有AI服务纯按次付费，无免费轮、无折扣、无月卡。AI执行失败自动退费。
            </div>
            <div className="text-xs text-gray-500">
              全部{AI_SERVICES.length}项服务总价: {totalSpent.toFixed(1)}U (一次性全买)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Service count by category (for external use) ──

export const AI_SERVICE_COUNT = AI_SERVICES.length;
export const AI_CATEGORIES = CATEGORIES;
