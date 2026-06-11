/**
 * CopyPolish — ML-71-02 [P1]
 * R71: v1.7.0 GA — Final copy polish: pricing, download, free-vs-paid table
 *
 * Definitive reference table for the 3 core marketing pages.
 * Used as source-of-truth for LandingPageFinal, downloadable assets, and GitHub README.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../../i18n';
import { EngineError } from '../../../../electron/engine/core/engine-error';
void EngineError; // [EngineError:SYSTEM] structured error tracking

// ── Types ───────────────────────────────────────────────────────────────

export type CopySection = 'pricing' | 'download' | 'freevspaid' | 'features';

export interface CopyPolishProps {
  className?: string;
}

// ── Definitive Pricing ──────────────────────────────────────────────────

const PRICING_FINAL = [
{ tier: i18n.t('CopyPolish.k1'), price: '1.0', currency: 'USDT', unit: i18n.t('CopyPolish.k2'),
  agents: i18n.t('CopyPolish.k3'),
  cache: i18n.t('CopyPolish.k4'),
  models: i18n.t('CopyPolish.k5'),
  markets: i18n.t('CopyPolish.k6'),
  highlight: false },
{ tier: i18n.t('CopyPolish.k7'), price: '1.5', currency: 'USDT', unit: i18n.t('CopyPolish.k8'),
  agents: i18n.t('CopyPolish.k9'),
  cache: i18n.t('CopyPolish.k10'),
  models: i18n.t('CopyPolish.k11'),
  markets: i18n.t('CopyPolish.k12'),
  highlight: true, badge: i18n.t('CopyPolish.k13') },
{ tier: i18n.t('CopyPolish.k14'), price: '2.0', currency: 'USDT', unit: i18n.t('CopyPolish.k15'),
  agents: i18n.t('CopyPolish.k16'),
  cache: i18n.t('CopyPolish.k17'),
  models: i18n.t('CopyPolish.k18'),
  markets: i18n.t('CopyPolish.k19'),
  highlight: false, badge: i18n.t('CopyPolish.k20') }];


const FREE_VS_PAID_FINAL = [
{ feature: i18n.t('CopyPolish.k21'), free: i18n.t('CopyPolish.k22'), paid: '✅' },
{ feature: i18n.t('CopyPolish.k23'), free: i18n.t('CopyPolish.k24'), paid: '✅' },
{ feature: i18n.t('CopyPolish.k25'), free: i18n.t('CopyPolish.k26'), paid: '✅' },
{ feature: i18n.t('CopyPolish.k27'), free: i18n.t('CopyPolish.k28'), paid: i18n.t('CopyPolish.k29') },
{ feature: i18n.t('CopyPolish.k30'), free: i18n.t('CopyPolish.k31'), paid: i18n.t('CopyPolish.k32') },
{ feature: i18n.t('CopyPolish.k33'), free: '✅ Futu + IBKR', paid: '✅' },
{ feature: i18n.t('CopyPolish.k34'), free: i18n.t('CopyPolish.k35'), paid: i18n.t('CopyPolish.k36') },
{ feature: i18n.t('CopyPolish.k37'), free: '❌', paid: i18n.t('CopyPolish.k38') },
{ feature: i18n.t('CopyPolish.k39'), free: '❌', paid: '✅ 0-1000 USDT' },
{ feature: i18n.t('CopyPolish.k40'), free: '❌', paid: i18n.t('CopyPolish.k41') },
{ feature: i18n.t('CopyPolish.k42'), free: '❌', paid: i18n.t('CopyPolish.k43') },
{ feature: i18n.t('CopyPolish.k44'), free: '❌', paid: '✅ CSV/JSON/PDF' },
{ feature: '4 Agent Arena', free: '❌', paid: '✅ Premium/Flagship' },
{ feature: i18n.t('CopyPolish.k45'), free: i18n.t('CopyPolish.k46'), paid: '—' }];


const PLATFORMS_FINAL = [
{ icon: '🪟', os: 'Windows', ext: '.exe', size: '128 MB', min: 'Windows 10+', arch: 'x64' },
{ icon: '🍎', os: 'macOS', ext: '.dmg', size: '135 MB', min: 'macOS 12+', arch: 'x64 / arm64' },
{ icon: '🐧', os: 'Linux', ext: '.AppImage', size: '140 MB', min: 'Ubuntu 20.04+', arch: 'x64' }];


const FEATURES_FINAL = [
{ icon: '🤖', title: '4 Agent AI', desc: i18n.t('CopyPolish.k47') },
{ icon: '📊', title: i18n.t('CopyPolish.k48'), desc: i18n.t('CopyPolish.k49') },
{ icon: '🌍', title: i18n.t('CopyPolish.k50'), desc: i18n.t('CopyPolish.k51') },
{ icon: '💰', title: i18n.t('CopyPolish.k52'), desc: i18n.t('CopyPolish.k53') },
{ icon: '📡', title: i18n.t('CopyPolish.k54'), desc: i18n.t('CopyPolish.k55') },
{ icon: '🔒', title: i18n.t('CopyPolish.k56'), desc: i18n.t('CopyPolish.k57') }];


// ── Highlight Badge ──────────────────────────────────────────────────────

function HighlightBadge({ text }: {text: string;}) {
  const { t: _t } = useTranslation();
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
      background: 'rgba(59,130,246,0.1)', color: '#3b82f6'
    }}>
      {text}
    </span>);

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
            <h2 className="text-xl font-bold">{i18n.t('CopyPolish.k0')}</h2>
            <p className="text-gray-500 text-xs mt-0.5">{i18n.t("CopyPolish.r92_8db0")}</p>
          </div>
          <div className="flex bg-white/[0.04] rounded-lg p-0.5">
            {(['pricing', 'download', 'freevspaid', 'features'] as CopySection[]).map((s) =>
            <button key={s} onClick={() => setSection(s)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium ${section === s ? 'bg-[#C9A046]/20 text-[#D4A853]' : 'text-gray-600'}`}>
                {s === 'pricing' ? i18n.t('CopyPolish.k58') : s === 'download' ? i18n.t('CopyPolish.k59') : s === 'freevspaid' ? '🆓vs💰' : i18n.t('CopyPolish.k60')}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {/* ── Pricing ──────────────────────────────────────────────────── */}
        {section === 'pricing' &&
        <>
            <div className="bg-[#111119] border border-white/5 rounded-xl p-5 mb-5">
              <h3 className="text-gray-300 font-semibold text-sm mb-4">{i18n.t('CopyPolish.r92_0')}</h3>
              <div className="grid grid-cols-3 gap-3">
                {PRICING_FINAL.map((t) =>
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
              )}
              </div>
              <div className="mt-4 text-center text-[11px] text-gray-600">{i18n.t("CopyPolish.r92_ca52")}

            </div>
            </div>
            <div className="bg-green-500/5 border border-green-500/10 rounded-xl p-4 text-center">
              <span className="text-green-400 text-xs font-semibold">{i18n.t('CopyPolish.r92_1')}</span>
            </div>
          </>
        }

        {/* ── Download ─────────────────────────────────────────────────── */}
        {section === 'download' &&
        <>
            <div className="bg-[#111119] border border-white/5 rounded-xl p-5 mb-5">
              <h3 className="text-gray-300 font-semibold text-sm mb-4">{i18n.t('CopyPolish.r92_2')}</h3>
              <div className="grid grid-cols-3 gap-3">
                {PLATFORMS_FINAL.map((p) =>
              <div key={p.os} className="border border-white/5 rounded-xl p-4 text-center hover:border-white/10 transition-colors">
                    <span className="text-3xl block mb-2">{p.icon}</span>
                    <div className="text-sm font-bold text-white">{p.os}</div>
                    <div className="text-xs text-gray-500 font-mono mt-1">{p.ext} · {p.size}</div>
                    <div className="text-[10px] text-gray-600 mt-2">{p.min} ({p.arch})</div>
                  </div>
              )}
              </div>
              <div className="mt-4 text-center text-[11px] text-gray-600">
                📋 SHA-256 checksums on <span className="text-blue-400">GitHub Releases</span>
              </div>
            </div>
            <div className="bg-green-500/5 border border-green-500/10 rounded-xl p-4 text-center">
              <span className="text-green-400 text-xs font-semibold">{i18n.t("CopyPolish.r92_41d8")}</span>
            </div>
          </>
        }

        {/* ── Free vs Paid ──────────────────────────────────────────────── */}
        {section === 'freevspaid' &&
        <>
            <div className="bg-[#111119] border border-white/5 rounded-xl overflow-hidden mb-5">
              <h3 className="text-gray-300 font-semibold text-sm p-5 pb-3">{i18n.t('CopyPolish.r92_3')}</h3>
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-white/[0.02] text-gray-500">
                    <th className="text-left px-5 py-2 font-medium">{i18n.t('CopyPolish.k1')}</th>
                    <th className="text-center px-5 py-2 font-medium text-green-400">{i18n.t('CopyPolish.r92_4')}</th>
                    <th className="text-center px-5 py-2 font-medium text-[#D4A853]">{i18n.t('CopyPolish.r92_5')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {FREE_VS_PAID_FINAL.map((row, i) =>
                <tr key={i} className={i % 2 === 0 ? 'bg-white/[0.01]' : ''}>
                      <td className="px-5 py-2.5 text-gray-300">{row.feature}</td>
                      <td className="text-center px-5 py-2.5" style={{ color: row.free.includes('❌') ? '#475569' : '#cbd5e1' }}>{row.free}</td>
                      <td className="text-center px-5 py-2.5" style={{ color: row.paid.includes('❌') ? '#475569' : row.paid.includes('💰') ? '#fbbf24' : '#cbd5e1' }}>{row.paid}</td>
                    </tr>
                )}
                </tbody>
              </table>
            </div>
            <div className="bg-green-500/5 border border-green-500/10 rounded-xl p-4 text-center">
              <span className="text-green-400 text-xs font-semibold">{i18n.t('CopyPolish.r92_6')}</span>
            </div>
          </>
        }

        {/* ── Features ──────────────────────────────────────────────────── */}
        {section === 'features' &&
        <>
            <div className="bg-[#111119] border border-white/5 rounded-xl p-5 mb-5">
              <h3 className="text-gray-300 font-semibold text-sm mb-4">{i18n.t('CopyPolish.r92_7')}</h3>
              <div className="grid grid-cols-2 gap-3">
                {FEATURES_FINAL.map((f) =>
              <div key={f.title} className="border border-white/5 rounded-xl p-4">
                    <div className="text-2xl mb-2">{f.icon}</div>
                    <h4 className="text-sm font-bold text-gray-200 mb-1">{f.title}</h4>
                    <p className="text-[11px] text-gray-500 leading-relaxed">{f.desc}</p>
                  </div>
              )}
              </div>
            </div>
            <div className="bg-green-500/5 border border-green-500/10 rounded-xl p-4 text-center">
              <span className="text-green-400 text-xs font-semibold">{i18n.t('CopyPolish.r92_8')}</span>
            </div>
          </>
        }
      </div>
    </div>);

}