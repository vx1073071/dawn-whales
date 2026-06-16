// @ts-nocheck
import React, { useState, useMemo } from 'react';

/* ====== Types ====== */
type ReportType = 'daily' | 'weekly' | 'monthly' | 'strategy_review' | 'risk_audit';
interface ReportPreview { id: string; type: ReportType; title: string; date: string; summary: string; pages: number; isGenerated: boolean; }
interface ReportSection { title: string; content: string; icon: string; }

/* ====== Mock Data ====== */
const reportTypes: { type: ReportType; label: string; icon: string; desc: string; price: string; pages: number; }[] = [
  { type: 'daily', label: '每日早报', icon: '📰', desc: '市场概况+持仓分析+今日关注', price: '1U', pages: 1 },
  { type: 'weekly', label: '每周总结', icon: '📊', desc: '本周回顾+策略表现+下周展望', price: '2U', pages: 3 },
  { type: 'monthly', label: '月度报告', icon: '📋', desc: '完整月报+因子回顾+AI学习总结', price: '5U', pages: 8 },
  { type: 'strategy_review', label: '策略体检', icon: '🩺', desc: '策略健康度+过拟合检测+优化建议', price: '3U', pages: 4 },
  { type: 'risk_audit', label: '风险审计', icon: '🔍', desc: '持仓风险+压力测试+尾部风险', price: '3U', pages: 5 },
];

const mockHistory: ReportPreview[] = [
  { id: 'rp1', type: 'daily', title: '2026-06-16 每日早报', date: '2026-06-16', summary: 'Fed鸽派信号推动科技股上涨，NVDA财报超预期。BTC突破$120K。', pages: 1, isGenerated: true },
  { id: 'rp2', type: 'weekly', title: '第24周 每周总结', date: '2026-06-14', summary: '本周组合+2.3%，跑赢标普+1.1%。MACD策略贡献最大。', pages: 3, isGenerated: true },
  { id: 'rp3', type: 'strategy_review', title: 'MACD策略健康体检', date: '2026-06-13', summary: '策略健康度B+，近30天胜率从58%降至42%，建议暂停观察。', pages: 4, isGenerated: true }
];

const mockSections: ReportSection[] = [
  { title: '市场概况', content: '• 标普500收于6,285 (+0.8%)\n• BTC/USD $122,500 (+3.5%)\n• VIX 15.2 (偏低，注意突袭)', icon: '📊' },
  { title: '持仓分析', content: '• NVDA 38%仓位 → 集中度过高\n• 00700 连续5天上涨 → RSI 72\n• 总体收益 +1.2%', icon: '📈' },
  { title: 'AI建议', content: '维持仓位不变。设止损-5%。\n加仓黄金ETF对冲政策风险。\n关注Fed官员今晚讲话。', icon: '🤖' },
  { title: '风险提示', content: '🔴 NVDA集中度高\n🟡 Fed讲话可能引发波动\n🟢 其他指标正常', icon: '⚠️' }
];

/* ====== Main Component ====== */

export default function ReportGenerator() {
  const [selectedType, setSelectedType] = useState<ReportType | null>(null);
  const [generating, setGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleGenerate = (type: ReportType) => {
    setSelectedType(type);
    setGenerating(true);
    setProgress(0);
    // Simulate progress
    const steps = [20, 45, 70, 90, 100];
    steps.forEach((p, i) => {
      setTimeout(() => { setProgress(p); if (p === 100) { setGenerating(false); setShowPreview(true); } }, i * 600);
    });
  };

  const selected = reportTypes.find(r => r.type === selectedType);

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-violet-500 to-purple-600 text-white">
        <h2 className="text-lg font-bold">📄 AI报告生成器</h2>
        <p className="text-xs text-white/80">一键生成专业分析报告 · 支持PDF/HTML导出</p>
      </div>

      {/* Report Types */}
      <div className="px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">选择报告类型</h3>
        <div className="grid grid-cols-2 gap-2">
          {reportTypes.map(r => (
            <button key={r.type} onClick={() => handleGenerate(r.type)} disabled={generating} className={`flex items-start gap-2 p-3 rounded-xl border text-left transition-all ${selectedType === r.type ? 'border-purple-400 ring-1 ring-purple-200 bg-purple-50/30' : 'border-gray-200 dark:border-gray-700 hover:shadow-md'} disabled:opacity-50`}>
              <span className="text-xl">{r.icon}</span>
              <div>
                <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{r.label}</p>
                <p className="text-xs text-gray-500">{r.desc}</p>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-xs text-amber-600 font-bold">{r.price}</span>
                  <span className="text-xs text-gray-400">· {r.pages}页</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Generating Progress */}
      {generating && (
        <div className="px-4 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">🤖</span>
            <span className="text-sm font-medium text-gray-700">鲸灵正在生成 {selected?.label}...</span>
          </div>
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-purple-500 to-violet-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-gray-400 mt-1">{progress}% 完成</p>
        </div>
      )}

      {/* Preview Sections */}
      {showPreview && (
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-900">📄 {selected?.label} 预览</h3>
            <div className="flex gap-2">
              <button className="px-3 py-1 rounded text-xs bg-purple-100 text-purple-700 hover:bg-purple-200 font-medium">导出 PDF</button>
              <button className="px-3 py-1 rounded text-xs border border-gray-300 text-gray-600 hover:bg-gray-50">分享</button>
            </div>
          </div>
          {mockSections.map((s, i) => (
            <div key={i} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 mb-3">
              <h4 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                <span>{s.icon}</span> {s.title}
              </h4>
              <p className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-line leading-relaxed">{s.content}</p>
            </div>
          ))}
        </div>
      )}

      {/* History */}
      <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3">
        <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">📚 历史报告</h3>
        {mockHistory.map(r => (
          <div key={r.id} className="flex items-center gap-2 py-2 border-b border-gray-100 last:border-0 cursor-pointer hover:bg-gray-50 rounded px-1">
            <span className="text-lg">{reportTypes.find(t => t.type === r.type)?.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-700 dark:text-gray-300 font-medium truncate">{r.title}</p>
              <p className="text-xs text-gray-400">{r.date} · {r.pages}页</p>
            </div>
            <button className="text-xs text-blue-600">查看</button>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t bg-white dark:bg-gray-800 text-xs text-gray-400 flex items-center justify-between">
        <span>📄 支持 PDF/HTML/Word 导出</span>
        <span>1U-5U/份</span>
      </div>
    </div>
  );
}
