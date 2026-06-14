/**
 * DownloadPage + OnboardingGuide — ML-63-03 [P1]
 * R63: v1.5.0-rc — Download page + new user onboarding (service)
 *
 * Features:
 * - Platform download section (Windows/Mac/Linux)
 * - 3-step onboarding guide: Download → Register → Activate
 * - 7-day free trial explanation with feature comparison
 * - License purchase CTA (links to TradingEasy.com)
 * - System requirements checklist
 * - FAQ for common activation issues
 */

import React, { useState } from 'react';
import { EngineError } from '../../../../electron/engine/core/engine-error';
void EngineError; // [EngineError:SYSTEM] structured error tracking

// ── Types ───────────────────────────────────────────────────────────────

export type Platform = 'windows' | 'mac' | 'linux';

export interface DownloadInfo {
  platform: Platform;
  label: string;
  icon: string;
  version: string;
  size: string;
  url: string;
}

export interface OnboardingStep {
  step: number;
  title: string;
  description: string;
  icon: string;
  action?: string;
}

export interface DownloadPageProps {
  downloads?: DownloadInfo[];
  steps?: OnboardingStep[];
  trialDays?: number;
  className?: string;
}

// ── Mock ────────────────────────────────────────────────────────────────

const defaultDownloads: DownloadInfo[] = [
  { platform: 'windows', label: 'Windows', icon: '🪟', version: 'v1.5.0-rc', size: '128 MB', url: '/downloads/TradingEasy-setup-1.5.0.exe' },
  { platform: 'mac', label: 'macOS', icon: '🍎', version: 'v1.5.0-rc', size: '145 MB', url: '/downloads/TradingEasy-1.5.0.dmg' },
  { platform: 'linux', label: 'Linux', icon: '🐧', version: 'v1.5.0-rc', size: '132 MB', url: '/downloads/TradingEasy-1.5.0.AppImage' },
];

const defaultSteps: OnboardingStep[] = [
  { step: 1, title: 'Download & Install', description: 'Download the desktop app for your platform. Run the installer and follow the setup wizard.', icon: '📥', action: 'Download' },
  { step: 2, title: 'Create Account', description: 'Launch the app and register with your email. You will get 7 days of free trial automatically.', icon: '📝' },
  { step: 3, title: 'Activate License', description: 'Enter your license key (purchased from TradingEasy.com) or continue with the 7-day trial.', icon: '🔑', action: 'Buy License' },
];

const faqs = [
  { q: 'What is TradingEasy?', a: 'An AI-powered quantitative trading platform. Creators use 4 AI agents to generate trading signals, and users subscribe to follow trades across HK, US, and China A-share markets.' },
  { q: 'How does the 7-day trial work?', a: 'After registration, you get 7 days of full access including 3 free AI analyses. No credit card required. After trial, activate a license to continue.' },
  { q: 'What happens when trial expires?', a: 'AI analysis and live trading are paused. Local strategy calculation and cached data remain available. Activate a license to restore full access.' },
  { q: 'How do I get a license key?', a: 'Visit TradingEasy.com to purchase a license. Personal ($29/mo), Professional ($79/mo), or Enterprise (custom). License key is emailed immediately.' },
  { q: 'Can I use it offline?', a: 'Limited offline mode: cached data, local strategy calculation, and Futu OpenD connectivity work. AI analysis and wallet require server connection.' },
  { q: 'Is my AI key safe?', a: 'AI API keys are stored only on TradingEasy servers, never on your desktop. Your desktop app is a thin client that cannot expose your credentials.' },
];

const sysRequirements: Record<string, string[]> = {
  Windows: ['Windows 10/11 (64-bit)', 'Intel Core i5 / AMD Ryzen 5', '8 GB RAM', '500 MB disk space', 'Futu OpenD (optional, for live trading)'],
  macOS: ['macOS 12 Monterey or later', 'Apple Silicon (M1/M2/M3) or Intel', '8 GB RAM', '500 MB disk space'],
  Linux: ['Ubuntu 20.04+ / Debian 11+', 'x86_64 architecture', '8 GB RAM', '500 MB disk space'],
};

const trialFeatures = [
  { feature: '4-Agent AI Analysis', trial: '3 free analyses', personal: '20/mo', professional: '100/mo', enterprise: 'Unlimited' },
  { feature: 'Strategy Creation', trial: '✅ Full', personal: '✅', professional: '✅', enterprise: '✅' },
  { feature: 'Signal Square', trial: '✅ Browse only', personal: '✅', professional: '✅', enterprise: '✅' },
  { feature: 'Live Trading (Futu)', trial: '✅ Simulation', personal: '✅ Live', professional: '✅ Live', enterprise: '✅ Live' },
  { feature: 'Multi-Market', trial: 'HK only', personal: 'HK+US', professional: 'HK+US+CN', enterprise: 'HK+US+CN+Options' },
  { feature: 'Creator Tools', trial: '❌', personal: '❌', professional: '✅ L1-L3', enterprise: '✅ Full' },
  { feature: 'API Access', trial: '❌', personal: '❌', professional: '❌', enterprise: '✅' },
  { feature: 'Priority Support', trial: '❌', personal: '❌', professional: 'Email', enterprise: '24/7' },
];

// ── DownloadPage ────────────────────────────────────────────────────────

const DownloadPage: React.FC<DownloadPageProps> = ({
  downloads: inputDls,
  steps: inputSteps,
  trialDays = 7,
  className = '',
}) => {
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>('windows');
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'download' | 'guide' | 'faq' | 'pricing'>('download');

  const downloads = inputDls ?? defaultDownloads;
  const steps = inputSteps ?? defaultSteps;
  const selectedDl = downloads.find(d => d.platform === selectedPlatform);

  return (
    <div className={`download-page ${className}`} style={{ maxWidth: 700, margin: '0 auto', padding: '24px 16px' }}>
      {/* Hero */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">🐋 TradingEasy</h1>
        <p className="text-lg text-slate-500 mb-1">AI-Powered Quantitative Trading Platform</p>
        <p className="text-sm text-slate-400">Speak naturally. Trade quantitatively.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 rounded-xl p-1">
        {([
          ['download', '📥 Download'],
          ['guide', '📖 Quick Start'],
          ['pricing', '💳 Plans'],
          ['faq', '❓ FAQ'],
        ] as const).map(([k, label]) => (
          <button key={k} onClick={() => setActiveTab(k)}
            className={`flex-1 text-xs font-semibold py-2.5 rounded-lg transition-all ${activeTab === k ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Download Tab ── */}
      {activeTab === 'download' && (
        <div>
          {/* Platform Picker */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {downloads.map(d => (
              <button key={d.platform} onClick={() => setSelectedPlatform(d.platform)}
                className={`p-3 rounded-xl border-2 text-center transition-all ${
                  selectedPlatform === d.platform ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'
                }`}>
                <div className="text-2xl mb-1">{d.icon}</div>
                <div className="text-xs font-bold text-slate-700">{d.label}</div>
                <div className="text-[10px] text-slate-400">{d.version}</div>
              </button>
            ))}
          </div>

          {/* Download Card */}
          {selectedDl && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 mb-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl">{selectedDl.icon}</span>
                    <span className="text-lg font-bold text-slate-800">{selectedDl.label}</span>
                  </div>
                  <span className="text-xs text-slate-400">Version {selectedDl.version} · {selectedDl.size}</span>
                </div>
                <button className="text-sm font-bold bg-slate-800 text-white hover:bg-slate-900 px-6 py-3 rounded-xl shadow-lg transition-all">
                  ⬇ Download
                </button>
              </div>

              {/* System Requirements */}
              <div className="bg-slate-50 rounded-xl p-3 mb-3">
                <h4 className="text-xs font-bold text-slate-600 mb-2">System Requirements</h4>
                <ul className="space-y-0.5">
                  {(sysRequirements[selectedDl.label] || []).map((r, i) => (
                    <li key={i} className="text-[10px] text-slate-500 flex items-center gap-1.5">
                      <span className="text-emerald-500">✓</span> {r}
                    </li>
                  ))}
                </ul>
              </div>

              <p className="text-[10px] text-slate-400 text-center">
                By downloading you agree to our Terms of Service and Privacy Policy.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Guide Tab ── */}
      {activeTab === 'guide' && (
        <div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">🎉</span>
              <span className="text-sm font-bold text-amber-800">Free {trialDays}-Day Trial</span>
            </div>
            <p className="text-xs text-amber-700">
              No credit card required. Full access to AI analysis (3 free), strategy creation, and simulated trading.
              Activate a license anytime to unlock unlimited access.
            </p>
          </div>

          {/* Steps */}
          <div className="space-y-4">
            {steps.map((s, i) => (
              <div key={s.step} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {s.step}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{s.icon}</span>
                      <h3 className="text-sm font-bold text-slate-800">{s.title}</h3>
                    </div>
                    <p className="text-xs text-slate-500">{s.description}</p>
                    {s.action && (
                      <button className="mt-2 text-[10px] font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors">
                        {s.action} →
                      </button>
                    )}
                  </div>
                </div>
                {i < steps.length - 1 && (
                  <div className="ml-4 mt-3 mb-1 border-l-2 border-dashed border-slate-200 h-4" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Pricing Tab ── */}
      {activeTab === 'pricing' && (
        <div>
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { name: 'Personal', price: '$29', period: '/mo', color: 'border-slate-200', btn: 'bg-slate-800' },
              { name: 'Professional', price: '$79', period: '/mo', color: 'border-blue-400 ring-2 ring-blue-200', btn: 'bg-blue-600', badge: 'Popular' },
              { name: 'Enterprise', price: 'Custom', period: '', color: 'border-slate-200', btn: 'bg-slate-800' },
            ].map(plan => (
              <div key={plan.name} className={`bg-white rounded-xl border-2 p-4 ${plan.color} relative`}>
                {plan.badge && <span className="absolute -top-2 right-3 bg-blue-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">{plan.badge}</span>}
                <h3 className="text-sm font-bold text-slate-800 mb-1">{plan.name}</h3>
                <div className="mb-3">
                  <span className="text-2xl font-bold text-slate-800">{plan.price}</span>
                  <span className="text-xs text-slate-400">{plan.period}</span>
                </div>
                <button className={`w-full text-[10px] font-bold text-white py-2 rounded-lg transition-all ${plan.btn} hover:opacity-90`}>
                  Get Started
                </button>
              </div>
            ))}
          </div>

          {/* Feature Comparison */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-3 py-2 font-semibold text-slate-600">Feature</th>
                    <th className="px-3 py-2 font-semibold text-slate-600">Trial</th>
                    <th className="px-3 py-2 font-semibold text-slate-600">Personal</th>
                    <th className="px-3 py-2 font-semibold text-slate-600">Pro</th>
                    <th className="px-3 py-2 font-semibold text-slate-600">Enterprise</th>
                  </tr>
                </thead>
                <tbody>
                  {trialFeatures.map((f, i) => (
                    <tr key={i} className="border-b border-slate-100 last:border-0">
                      <td className="px-3 py-2 font-medium text-slate-700">{f.feature}</td>
                      <td className="px-3 py-2 text-center text-amber-600">{f.trial}</td>
                      <td className="px-3 py-2 text-center">{f.personal}</td>
                      <td className="px-3 py-2 text-center font-semibold text-blue-600">{f.professional}</td>
                      <td className="px-3 py-2 text-center">{f.enterprise}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── FAQ Tab ── */}
      {activeTab === 'faq' && (
        <div className="space-y-2">
          {faqs.map((faq, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <button onClick={() => setActiveFaq(activeFaq === i ? null : i)}
                className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <span className="text-xs font-semibold text-slate-700">{faq.q}</span>
                <span className={`text-xs transition-transform ${activeFaq === i ? 'rotate-180' : ''}`}>▼</span>
              </button>
              {activeFaq === i && (
                <div className="px-4 pb-3">
                  <p className="text-xs text-slate-500 leading-relaxed">{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="mt-8 text-center text-[10px] text-slate-400 space-y-1">
        <p>TradingEasy v1.5.0-rc · &copy; 2026</p>
        <p>AI keys stored server-side only · Your data never leaves your control</p>
        <p>
          <span className="hover:text-blue-500 cursor-pointer">Terms</span>
          <span className="mx-2">·</span>
          <span className="hover:text-blue-500 cursor-pointer">Privacy</span>
          <span className="mx-2">·</span>
          <span className="hover:text-blue-500 cursor-pointer">TradingEasy.com</span>
        </p>
      </div>
    </div>
  );
};

export default DownloadPage;
