import { useState, useEffect } from 'react';
import { getAISuggest } from '@/lib/bridge-api';

interface AIAdvice {
  marketView: string;
  score: number; // 0-100
  recommendation: 'strong_buy' | 'buy' | 'hold' | 'reduce' | 'sell';
  portfolioSuggestions: { action: string; code: string; name: string; reason: string }[];
  riskWarnings: string[];
  keyThemes: string[];
  nextWeekOutlook: string;
}

const RECOMMENDATION_MAP: Record<string, { label: string; color: string; bg: string }> = {
  strong_buy: { label: '强烈买入', color: 'text-red-500', bg: 'bg-red-500/10 border-red-500/20' },
  buy: { label: '买入', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
  hold: { label: '持有', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
  reduce: { label: '减仓', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
  sell: { label: '卖出', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
};

const MOCK_ADVICE: AIAdvice = {
  marketView: '当前市场处于震荡整理阶段，AI和科技板块表现强势，传统行业相对疲软。美联储维持利率不变，市场预期年内降息1-2次。建议关注结构性机会。',
  score: 62,
  recommendation: 'hold',
  portfolioSuggestions: [
    { action: '增持', code: 'NVDA', name: '英伟达', reason: 'AI芯片需求持续强劲，Blackwell架构推出带来新增长点' },
    { action: '增持', code: 'AVGO', name: '博通', reason: 'AI定制芯片业务快速增长，VMware整合效应显现' },
    { action: '减持', code: 'TSLA', name: '特斯拉', reason: '价格战压缩利润率，FSD商业化进度慢于预期' },
    { action: '持有', code: 'AAPL', name: '苹果', reason: '服务收入稳健增长，Vision Pro长期看好但短期影响有限' },
    { action: '关注', code: 'SMCI', name: '超微电脑', reason: 'AI服务器需求爆发，但估值较高需等待回调' },
  ],
  riskWarnings: [
    '地缘政治风险：中美关系紧张可能影响科技股估值',
    '通胀反复风险：若通胀数据超预期，可能推迟降息时间',
    'AI泡沫风险：部分AI概念股估值已透支未来2-3年增长',
    '流动性风险：季度末资金面可能趋紧',
  ],
  keyThemes: [
    'AI算力基建',
    '高股息防御',
    '新能源出海',
    '消费复苏',
    '医药创新',
  ],
  nextWeekOutlook: '预计下周市场维持震荡格局，重点关注：1) 美联储会议纪要；2) 英伟达GTC大会后续影响；3) 中概股财报季。建议控制仓位，保持灵活性。',
};

export default function AIAdvisorPage() {
  const [advice, setAdvice] = useState<AIAdvice>(MOCK_ADVICE);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await getAISuggest();
      if (res?.success && res.data) setAdvice(res.data);
    } catch (e) { console.error('[Error:AIAdvisorPage]', e); }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const rec = RECOMMENDATION_MAP[advice.recommendation] || RECOMMENDATION_MAP.hold;

  return (
    <div className="p-6 space-y-6 bg-deep min-h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">🤖 AI 投顾</h1>
          <p className="text-gray-400 text-sm">基于多维度数据分析的智能投资建议</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="text-xs bg-[#C9A046] hover:bg-[#D4A853] text-black font-medium px-4 py-2 rounded-lg transition-colors"
        >
          {loading ? '分析中...' : '重新分析'}
        </button>
      </div>

      {/* Market Score */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`border rounded-xl p-5 ${rec.bg}`}>
          <div className="text-xs text-gray-500 mb-1">市场建议</div>
          <div className={`text-2xl font-bold ${rec.color}`}>{rec.label}</div>
          <div className="text-xs text-gray-400 mt-1">综合评分: {advice.score}/100</div>
        </div>
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
          <div className="text-xs text-gray-500 mb-1">市场情绪</div>
          <div className="text-2xl font-bold text-white">{advice.score >= 70 ? '乐观' : advice.score >= 50 ? '中性' : '谨慎'}</div>
          <div className="w-full bg-white/5 rounded-full h-2 mt-2">
            <div
              className="h-2 rounded-full transition-all"
              style={{
                width: `${advice.score}%`,
                background: advice.score >= 70 ? '#16a34a' : advice.score >= 50 ? '#ca8a04' : '#dc2626',
              }}
            />
          </div>
        </div>
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
          <div className="text-xs text-gray-500 mb-1">关键主题</div>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {advice.keyThemes.map((t) => (
              <span key={t} className="text-xs bg-[#C9A046]/10 text-[#D4A853] px-2 py-1 rounded-lg">{t}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Market View */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
        <h2 className="text-lg font-semibold text-white mb-3">市场观点</h2>
        <p className="text-sm text-gray-300 leading-relaxed">{advice.marketView}</p>
      </div>

      {/* Portfolio Suggestions */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
        <h2 className="text-lg font-semibold text-white mb-4">调仓建议</h2>
        <div className="space-y-3">
          {advice.portfolioSuggestions.map((s, idx) => (
            <div key={idx} className="flex items-start gap-3 bg-deep rounded-lg p-3">
              <span className={`text-xs font-bold px-2 py-1 rounded flex-shrink-0 ${
                s.action === '增持' ? 'bg-red-500/20 text-red-400' :
                s.action === '减持' ? 'bg-emerald-500/20 text-emerald-400' :
                s.action === '卖出' ? 'bg-emerald-500/20 text-emerald-400' :
                'bg-yellow-500/20 text-yellow-400'
              }`}>
                {s.action}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">{s.name}</span>
                  <span className="text-xs text-gray-500">{s.code}</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">{s.reason}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Risk Warnings */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
        <h2 className="text-lg font-semibold text-white mb-4">⚠️ 风险提示</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {advice.riskWarnings.map((w, idx) => (
            <div key={idx} className="flex items-start gap-2 bg-deep rounded-lg p-3">
              <span className="text-red-400 flex-shrink-0 mt-0.5">•</span>
              <span className="text-sm text-gray-300">{w}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Next Week Outlook */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
        <h2 className="text-lg font-semibold text-white mb-3">下周展望</h2>
        <p className="text-sm text-gray-300 leading-relaxed">{advice.nextWeekOutlook}</p>
      </div>
    </div>
  );
}
