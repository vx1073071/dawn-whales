/**
 * AIDailyDigestPanel — AI-generated daily/weekly summary dashboard
 * (ML-44-02, R44 Phase 6.0)
 *
 * Integrates with ai-report-generator.ts (11,033L) to display:
 * - Today's market overview with sentiment
 * - Portfolio snapshot with top movers
 * - Active strategy signals summary
 * - Risk alerts + recommendations
 * - Regenerate / schedule controls
 */

import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

// ── Types ───────────────────────────────────────────────────────────────

interface DigestSection {
  heading: string;
  content: string;
  icon: string;
}

interface DailyDigest {
  date: string;
  generatedAt: number;
  marketSentiment: 'bullish' | 'bearish' | 'neutral';
  sections: DigestSection[];
  topMovers: { symbol: string; name: string; change: number }[];
  activeSignals: { strategy: string; symbol: string; signal: string; time: string }[];
  riskAlerts: { level: 'info' | 'warning' | 'critical'; message: string }[];
}

type DigestType = 'daily' | 'weekly' | 'monthly';

// ── Mock digest ──────────────────────────────────────────────────────────

const MOCK_DIGEST: Record<DigestType, DailyDigest> = {
  daily: {
    date: '2026-06-07',
    generatedAt: Date.now(),
    marketSentiment: 'bullish',
    sections: [
      { heading: '市场概览', content: '今日港股市场走强，恒指涨0.82%报19,450点，科指涨1.25%。成交额1,280亿港元，较昨日放量15%。南向资金净流入52.3亿港元，为连续第5日净流入。', icon: '📈' },
      { heading: '组合表现', content: '主账户今日盈利+28,500 HKD (+0.16%)，跑赢恒指。最大贡献: 腾讯(+1.2%)、友邦(+1.5%)。拖累: 比亚迪(-0.5%)。API账户今日亏损-3,200 HKD (-0.21%)，主要受小米(-1.1%)拖累。', icon: '💰' },
      { heading: '策略信号', content: '双均线交叉策略发出买入信号: US.AAPL @ $150.00，快线(10日均线)上穿慢线(30日均线)。动量突破策略维持持仓，未触发止损。均值回归策略触发卖出: HK.00700 @ $385.00，布林带上轨触及。', icon: '📊' },
      { heading: '风险提醒', content: '组合整体VaR(95%)为-26.4万HKD，CVaR(95%)为-33.5万HKD。当前回撤-3.2%，远低于15%硬限制。多周期引擎显示4/7周期做多、2周期观望、1周期做空，整体偏多。', icon: '⚠️' },
      { heading: 'AI建议', content: '基于当前组合风险敞口和策略信号，建议: 1) 执行AAPL买入信号，仓位控制在5%以内; 2) 关注00700卖出信号，如确认可减仓至半仓; 3) 组合分散度72%，风险可控，暂不需要大规模调仓。', icon: '🤖' },
    ],
    topMovers: [
      { symbol: '00700', name: '腾讯控股', change: 1.2 },
      { symbol: '01299', name: '友邦保险', change: 1.5 },
      { symbol: '09988', name: '阿里巴巴', change: 0.6 },
      { symbol: '01810', name: '小米集团', change: -1.1 },
      { symbol: '01211', name: '比亚迪', change: -0.5 },
    ],
    activeSignals: [
      { strategy: '双均线交叉', symbol: 'US.AAPL', signal: '买入', time: '09:35' },
      { strategy: '均值回归', symbol: 'HK.00700', signal: '卖出', time: '10:12' },
      { strategy: '动量突破', symbol: 'US.NVDA', signal: t('components.positions'), time: '08:00' },
    ],
    riskAlerts: [
      { level: 'info', message: '组合VaR在正常范围内' },
      { level: 'info', message: '多周期引擎 4/7 做多' },
      { level: 'warning', message: 'API账户今日亏损-0.21%，关注小米走势' },
    ],
  },
  weekly: {
    date: '2026-06-01 ~ 06-07',
    generatedAt: Date.now(),
    marketSentiment: 'neutral',
    sections: [
      { heading: '本周回顾', content: '本周港股震荡上行，恒指累计上涨1.6%，科指上涨3.2%。市场情绪从谨慎转向乐观，成交额稳步放大。', icon: '📅' },
      { heading: '组合周报', content: '主账户本周累计盈利+15.2万HKD (+0.86%)。API账户本周累计亏损-1.8万HKD (-1.2%)。双账户合计+13.4万HKD。', icon: '💰' },
      { heading: '策略表现', content: '双均线交叉策略本周胜率58%，累计收益+0.35%。均值回归策略胜率63%，累计收益+0.42%。动量突破策略表现最弱，胜率52%，收益+0.28%。', icon: '📊' },
      { heading: 'AI建议', content: '建议下周关注: 1) 动量突破策略参数可能需要重新优化; 2) 考虑增加均值回归策略的仓位分配; 3) 下周五非农数据公布，注意美股波动。', icon: '🤖' },
    ],
    topMovers: [
      { symbol: '00700', name: '腾讯控股', change: 3.5 },
      { symbol: '09988', name: '阿里巴巴', change: 2.8 },
      { symbol: '01810', name: '小米集团', change: -2.1 },
    ],
    activeSignals: [
      { strategy: '双均线交叉', symbol: 'US.AAPL', signal: '买入', time: '周一' },
      { strategy: '均值回归', symbol: 'HK.00700', signal: '卖出', time: '周四' },
    ],
    riskAlerts: [
      { level: 'info', message: '周度VaR稳定在0.8%以内' },
    ],
  },
  monthly: {
    date: '2026年6月',
    generatedAt: Date.now(),
    marketSentiment: 'bullish',
    sections: [
      { heading: '月度总结', content: '6月港股整体上涨，恒指上涨3.2%，科指上涨5.6%。流动性充裕，科技板块领涨。', icon: '📅' },
      { heading: '组合月报', content: '主账户6月盈利+52.8万HKD (+3.0%)。年化Sharpe 2.1，最大回撤-4.2%，远优于基准。', icon: '💰' },
      { heading: 'AI展望', content: '7月展望: 1) 中报季来临，关注业绩超预期个股; 2) 关注美联储7月议息; 3) 建议保持当前仓位，不追高。', icon: '🤖' },
    ],
    topMovers: [
      { symbol: '00700', name: '腾讯控股', change: 8.2 },
      { symbol: '01299', name: '友邦保险', change: 6.8 },
    ],
    activeSignals: [],
    riskAlerts: [
      { level: 'info', message: '月度量化评分: A级 (综合92分)' },
    ],
  },
};

// ── Main Component ──────────────────────────────────────────────────────

interface AIDailyDigestPanelProps {
  className?: string;
}

const SENTIMENT_ICONS: Record<string, string> = {
  bullish: '🐂', bearish: '🐻', neutral: '😐',
};
const SENTIMENT_LABELS: Record<string, string> = {
  bullish: '看多', bearish: '看空', neutral: '中性',
};
const SENTIMENT_COLORS: Record<string, string> = {
  bullish: 'text-emerald-400', bearish: 'text-red-400', neutral: 'text-gray-400',
};

const ALERT_COLORS = {
  info: 'border-blue-500/20 bg-blue-500/5 text-blue-400',
  warning: 'border-amber-500/20 bg-amber-500/5 text-amber-400',
  critical: 'border-red-500/20 bg-red-500/5 text-red-400',
};

export const AIDailyDigestPanel: React.FC<AIDailyDigestPanelProps> = ({ className }) => {
  const { t } = useTranslation();
  const [digestType, setDigestType] = useState<DigestType>('daily');
  const [regenerating, setRegenerating] = useState(false);

  const digest = MOCK_DIGEST[digestType];

  const handleRegenerate = useCallback(async () => {
    setRegenerating(true);
    // Simulate AI generation
    await new Promise(r => setTimeout(r, 1500));
    setRegenerating(false);
  }, []);

  return (
    <div className={`bg-gray-900 rounded-xl border border-gray-800 p-5 ${className ?? ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-lg font-bold text-white">
            AI 每日摘要
            <span className="ml-2 px-2 py-0.5 text-[10px] bg-amber-500/20 text-amber-400 rounded-full font-normal">
              Phase 6.0
            </span>
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {digest.date} · 生成于 {new Date(digest.generatedAt).toLocaleTimeString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Digest type tabs */}
          {([
            { key: 'daily' as const, label: '日报' },
            { key: 'weekly' as const, label: '周报' },
            { key: 'monthly' as const, label: '月报' },
          ]).map(t => (
            <button
              key={t.key}
              onClick={() => setDigestType(t.key)}
              className={`px-2.5 py-1 rounded text-[10px] font-medium transition-colors ${
                digestType === t.key
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {t.label}
            </button>
          ))}
          {/* Regenerate */}
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className={`px-2.5 py-1 rounded text-[10px] font-medium transition-colors ${
              regenerating
                ? 'bg-gray-800 text-gray-600'
                : 'bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-200'
            }`}
          >
            {regenerating ? '⏳ 生成中...' : '🔄 重新生成'}
          </button>
        </div>
      </div>

      {/* Market sentiment bar */}
      <div className={`rounded-lg p-4 mb-5 border ${
        digest.marketSentiment === 'bullish' ? 'border-emerald-500/20 bg-emerald-500/5' :
        digest.marketSentiment === 'bearish' ? 'border-red-500/20 bg-red-500/5' :
        'border-gray-700/30 bg-gray-800/20'
      }`}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">{SENTIMENT_ICONS[digest.marketSentiment]}</span>
          <div>
            <div className={`text-sm font-bold ${SENTIMENT_COLORS[digest.marketSentiment]}`}>
              市场情绪: {SENTIMENT_LABELS[digest.marketSentiment]}
            </div>
            <div className="text-[10px] text-gray-500">{t('AI 综合分析量化信号 + 新闻情绪')}</div>
          </div>
        </div>
      </div>

      {/* Digest sections */}
      <div className="space-y-4 mb-5">
        {digest.sections.map((section, i) => (
          <div key={i} className="bg-gray-800/40 rounded-lg p-4 border border-gray-700/30">
            <h4 className="text-xs font-semibold text-gray-400 mb-2 flex items-center gap-2">
              <span>{section.icon}</span> {section.heading}
            </h4>
            <p className="text-xs text-gray-400 leading-relaxed">{section.content}</p>
          </div>
        ))}
      </div>

      {/* Two-column: movers + signals */}
      <div className={`grid ${digestType === 'daily' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'} gap-4`}>
        {/* Top movers */}
        {digest.topMovers.length > 0 && (
          <div className="bg-gray-800/40 rounded-lg p-4 border border-gray-700/30">
            <h4 className="text-xs font-semibold text-gray-400 mb-3">{t('📌 涨跌榜')}</h4>
            <div className="space-y-2">
              {digest.topMovers.map(m => (
                <div key={m.symbol} className="flex items-center justify-between text-xs">
                  <div>
                    <span className="text-gray-300 font-mono">{m.symbol}</span>
                    <span className="text-gray-600 ml-2">{m.name}</span>
                  </div>
                  <span className={`font-mono ${m.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {m.change >= 0 ? '+' : ''}{m.change}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active signals */}
        {digest.activeSignals.length > 0 && (
          <div className="bg-gray-800/40 rounded-lg p-4 border border-gray-700/30">
            <h4 className="text-xs font-semibold text-gray-400 mb-3">{t('📊 活跃信号')}</h4>
            <div className="space-y-2">
              {digest.activeSignals.map((s, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div>
                    <span className="text-gray-400">{s.strategy}</span>
                    <span className="text-gray-600 ml-1.5">{s.symbol}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                      s.signal === '买入' ? 'bg-emerald-500/10 text-emerald-400' :
                      s.signal === '卖出' ? 'bg-red-500/10 text-red-400' :
                      'bg-gray-500/10 text-gray-400'
                    }`}>
                      {s.signal}
                    </span>
                    <span className="text-[10px] text-gray-600">{s.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Risk alerts */}
      {digest.riskAlerts.length > 0 && (
        <div className="mt-4 space-y-1.5">
          {digest.riskAlerts.map((alert, i) => (
            <div key={i} className={`rounded px-3 py-1.5 text-[10px] border ${ALERT_COLORS[alert.level]}`}>
              {alert.level === 'critical' ? '🔴' : alert.level === 'warning' ? '🟡' : '🔵'} {alert.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AIDailyDigestPanel;
