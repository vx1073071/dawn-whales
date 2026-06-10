/**
 * CopyPolish — ML-71-02 [P1]
 * R71: v1.7.0 GA — Final copy polish: pricing, download, free-vs-paid table
 *
 * Definitive reference table for the 3 core marketing pages.
 * Used as source-of-truth for LandingPageFinal, downloadable assets, and GitHub README.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';

// ── Types ───────────────────────────────────────────────────────────────

export type CopySection = 'pricing' | 'download' | 'freevspaid' | 'features';

export interface CopyPolishProps {
  className?: string;
}

// ── Definitive Pricing ──────────────────────────────────────────────────

const PRICING_FINAL = [
  { tier: t('标准 Standard'), price: '1.0', currency: 'USDT', unit: '/次 per analysis',
    agents: t('2 Agent (基本面+技术面)'),
    cache: t('基础缓存 Basic'),
    models: t('单模型 Single model'),
    markets: t('🇭🇰 港股 HK'),
    highlight: false },
  { tier: t('高级 Premium'), price: '1.5', currency: 'USDT', unit: '/次 per analysis',
    agents: t('3 Agent (基本面+技术面+情绪)'),
    cache: t('95% 命中率 Hit rate'),
    models: t('双模型辩论 2-Model debate'),
    markets: t('🇭🇰 港股 + 🇺🇸 美股'),
    highlight: true, badge: t('🔥 推荐 Recommended') },
  { tier: t('旗舰 Flagship'), price: '2.0', currency: 'USDT', unit: '/次 per analysis',
    agents: t('4 Agent Arena (全维度 All 4)'),
    cache: t('99% 命中率 Hit rate'),
    models: t('三模型竞技 3-Model arena'),
    markets: t('🇭🇰 港股 + 🇺🇸 美股'),
    highlight: false, badge: t('👑 旗舰 Flagship') },
];

const FREE_VS_PAID_FINAL = [
  { feature: t('行情查看 Market Quotes'), free: t('✅ 实时 Realtime'), paid: t('✅') },
  { feature: t('技术指标 Technical Indicators'), free: t('✅ 12 指标 All'), paid: t('✅') },
  { feature: t('K线图表 Charting'), free: t('✅ 多周期 Multi'), paid: t('✅') },
  { feature: t('基础回测 Basic Backtest'), free: t('✅ 无限 Unlimited'), paid: t('✅ 高级 Advanced') },
  { feature: t('AI策略分析 AI Analysis'), free: t('🆓 3次/终身 3 free'), paid: t('💰 1.0-2.0 USDT/次') },
  { feature: t('实盘交易 Live Trading'), free: t('✅ Futu + IBKR'), paid: t('✅') },
  { feature: t('信号广场浏览 Browse Signals'), free: t('✅ 只读 Read-only'), paid: t('✅ 完整 Full') },
  { feature: t('信号订阅 Signal Subscribe'), free: t('❌'), paid: t('✅ 创作者定价') },
  { feature: t('策略模板购买 Strategy Templates'), free: t('❌'), paid: t('✅ 0-1000 USDT') },
  { feature: t('创作者发布 Creator Publishing'), free: t('❌'), paid: t('✅ L1-L3 分成') },
  { feature: t('P2P转账 P2P Transfer'), free: t('❌'), paid: t('✅ 0.3% 双向') },
  { feature: t('数据导出 Data Export'), free: t('❌'), paid: t('✅ CSV/JSON/PDF') },
  { feature: '4 Agent Arena', free: t('❌'), paid: t('✅ Premium/Flagship') },
  { feature: t('访客模式 Guest Mode'), free: t('✅ 浏览+5次回测/天'), paid: t('—') },
];

const PLATFORMS_FINAL = [
  { icon: t('🪟'), os: 'Windows', ext: '.exe', size: '128 MB', min: 'Windows 10+', arch: 'x64' },
  { icon: t('🍎'), os: 'macOS', ext: '.dmg', size: '135 MB', min: 'macOS 12+', arch: 'x64 / arm64' },
  { icon: t('🐧'), os: 'Linux', ext: '.AppImage', size: '140 MB', min: 'Ubuntu 20.04+', arch: 'x64' },
];

const FEATURES_FINAL = [
  { icon: t('🤖'), title: '4 Agent AI', desc: t('基本面·技术面·情绪·宏观 Agent 协作。自然语言→交易信号。Fundamentals · Technical · Sentiment · Macro.') },
  { icon: t('📊'), title: t('策略因子引擎'), desc: t('Fama-French 5因子 + Barra定制 + 自研选股。NL→DSL→Signal。') },
  { icon: t('🌍'), title: t('双市场券商'), desc: t('港股HKEX·美股NYSE。Futu OpenD + IBKR Gateway 双通道。') },
  { icon: t('💰'), title: t('USDT按次付费'), desc: t('Pay-per-use。不绑套餐。不强制订阅。TRC-20充值。P2P转账。') },
  { icon: t('📡'), title: t('信号广场'), desc: t('发现·订阅·跟单。实时信号推送+质量评分(A+~F)+表现追踪。') },
  { icon: t('🔒'), title: t('服务器端安全'), desc: t('AI密钥仅在服务器。桌面端瘦客户端。破解=React组件。2FA保护。') },
];

// ── Highlight Badge ──────────────────────────────────────────────────────

function HighlightBadge({ text }: { text: string }) {
  const { t } = useTranslation();
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
      background: 'rgba(59,130,246,0.1)', color: '#3b82f6',
    }}>
      {text}
    </span>
  );
}

// ── Main ────────────────────────────────────────────────────────────────

export default function CopyPolish({ className = '' }: CopyPolishProps) {
  const [section, setSection] = useState<CopySection>('pricing');

  return (
    <div className={`h-full flex flex-col bg-[#0D0D14] text-white ${className}`}>
      {/* Header */}
      <div className="p-5 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">最终文案确认</h2>
            <p className="text-gray-500 text-xs mt-0.5">定稿: 定价/下载/免费边界/功能 四表 v1.7.0 GA</p>
          </div>
          <div className="flex bg-white/[0.04] rounded-lg p-0.5">
            {(['pricing', 'download', 'freevspaid', 'features'] as CopySection[]).map(s => (
              <button key={s} onClick={() => setSection(s)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium ${section === s ? 'bg-[#C9A046]/20 text-[#D4A853]' : 'text-gray-600'}`}>
                {s === 'pricing' ? t('💰 定价') : s === 'download' ? t('📦 下载') : s === 'freevspaid' ? t('🆓vs💰') : t('📋 功能')}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {/* ── Pricing ──────────────────────────────────────────────────── */}
        {section === 'pricing' && (
          <>
            <div className="bg-[#111119] border border-white/5 rounded-xl p-5 mb-5">
              <h3 className="text-gray-300 font-semibold text-sm mb-4">💰 AI分析定价 (最终)</h3>
              <div className="grid grid-cols-3 gap-3">
                {PRICING_FINAL.map(t => (
                  <div key={t.tier} className={`rounded-xl p-4 text-center border ${t.highlight ? 'border-blue-500/30 bg-blue-500/5' : 'border-white/5'}`}>
                    {t.badge && <HighlightBadge text={t.badge} />}
                    <h4 className="text-sm font-bold mt-2 mb-1" style={{ color: t.highlight ? '#60a5fa' : '#cbd5e1' }}>{t.tier}</h4>
                    <div className="my-2">
                      <span className="text-2xl font-black text-white">${t.price}</span>
                      <span className="text-xs text-gray-500 ml-1">{t.unit}</span>
                    </div>
                    <div className="space-y-1 text-[11px] text-gray-400">
                      <div>{t.agents}</div>
                      <div className="text-gray-600">{t.cache}</div>
                      <div className="text-gray-600">{t.models}</div>
                      <div>{t.markets}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 text-center text-[11px] text-gray-600">
                💡 前3次免费 · 按次付费 · 不绑套餐 · First 3 free · Pay-per-use · No lock-in
              </div>
            </div>
            <div className="bg-green-500/5 border border-green-500/10 rounded-xl p-4 text-center">
              <span className="text-green-400 text-xs font-semibold">✅ 定价文案最终确认 — v1.7.0 GA 上线用</span>
            </div>
          </>
        )}

        {/* ── Download ─────────────────────────────────────────────────── */}
        {section === 'download' && (
          <>
            <div className="bg-[#111119] border border-white/5 rounded-xl p-5 mb-5">
              <h3 className="text-gray-300 font-semibold text-sm mb-4">📦 下载平台 (最终)</h3>
              <div className="grid grid-cols-3 gap-3">
                {PLATFORMS_FINAL.map(p => (
                  <div key={p.os} className="border border-white/5 rounded-xl p-4 text-center hover:border-white/10 transition-colors">
                    <span className="text-3xl block mb-2">{p.icon}</span>
                    <div className="text-sm font-bold text-white">{p.os}</div>
                    <div className="text-xs text-gray-500 font-mono mt-1">{p.ext} · {p.size}</div>
                    <div className="text-[10px] text-gray-600 mt-2">{p.min} ({p.arch})</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 text-center text-[11px] text-gray-600">
                📋 SHA-256 checksums on <span className="text-blue-400">GitHub Releases</span>
              </div>
            </div>
            <div className="bg-green-500/5 border border-green-500/10 rounded-xl p-4 text-center">
              <span className="text-green-400 text-xs font-semibold">✅ 下载文案最终确认 — Win/Mac/Linux 三平台</span>
            </div>
          </>
        )}

        {/* ── Free vs Paid ──────────────────────────────────────────────── */}
        {section === 'freevspaid' && (
          <>
            <div className="bg-[#111119] border border-white/5 rounded-xl overflow-hidden mb-5">
              <h3 className="text-gray-300 font-semibold text-sm p-5 pb-3">🆓 vs 💰 功能边界 (最终)</h3>
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-white/[0.02] text-gray-500">
                    <th className="text-left px-5 py-2 font-medium">功能 Feature</th>
                    <th className="text-center px-5 py-2 font-medium text-green-400">🆓 免费 Free</th>
                    <th className="text-center px-5 py-2 font-medium text-[#D4A853]">💰 付费 Paid</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {FREE_VS_PAID_FINAL.map((row, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white/[0.01]' : ''}>
                      <td className="px-5 py-2.5 text-gray-300">{row.feature}</td>
                      <td className="text-center px-5 py-2.5" style={{ color: row.free.includes(t('❌')) ? '#475569' : '#cbd5e1' }}>{row.free}</td>
                      <td className="text-center px-5 py-2.5" style={{ color: row.paid.includes(t('❌')) ? '#475569' : row.paid.includes(t('💰')) ? '#fbbf24' : '#cbd5e1' }}>{row.paid}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bg-green-500/5 border border-green-500/10 rounded-xl p-4 text-center">
              <span className="text-green-400 text-xs font-semibold">✅ 免费边界最终确认 — 14项功能对照</span>
            </div>
          </>
        )}

        {/* ── Features ──────────────────────────────────────────────────── */}
        {section === 'features' && (
          <>
            <div className="bg-[#111119] border border-white/5 rounded-xl p-5 mb-5">
              <h3 className="text-gray-300 font-semibold text-sm mb-4">📋 核心功能 (最终)</h3>
              <div className="grid grid-cols-2 gap-3">
                {FEATURES_FINAL.map(f => (
                  <div key={f.title} className="border border-white/5 rounded-xl p-4">
                    <div className="text-2xl mb-2">{f.icon}</div>
                    <h4 className="text-sm font-bold text-gray-200 mb-1">{f.title}</h4>
                    <p className="text-[11px] text-gray-500 leading-relaxed">{f.desc}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-green-500/5 border border-green-500/10 rounded-xl p-4 text-center">
              <span className="text-green-400 text-xs font-semibold">✅ 功能文案最终确认 — 6大核心能力</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
