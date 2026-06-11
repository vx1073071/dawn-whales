/**
 * AchievementOnboarding — ML-73-02 [P0]
 * R73: v1.8.0-beta — 7 achievements + 3-step onboarding guide + milestone popups
 *
 * Features:
 * - 7 achievements: first order, 10-win streak, 100 AI analyses, strategy published,
 *   1000 subscribers, diamond level, $10k revenue
 * - Progress bars per achievement
 * - 3-step onboarding wizard: connect broker → first AI analysis → first trade
 * - Milestone popup animation for new achievements
 * - Badge collection gallery
 */

import { useState } from 'react';
import i18n from '../../../i18n';

// ── Types ───────────────────────────────────────────────────────────────

export interface Achievement {
  id: string;
  icon: string;
  title: string;
  description: string;
  progress: number;   // 0-100
  unlocked: boolean;
  unlockedAt?: string;
  color: string;
}

export interface OnboardingStep {
  step: number;
  icon: string;
  title: string;
  description: string;
  action: string;
  done: boolean;
}

export interface AchievementOnboardingProps {
  achievements?: Achievement[];
  onboardingSteps?: OnboardingStep[];
  className?: string;
}

// ── Mock ────────────────────────────────────────────────────────────────

const mockAchievements: Achievement[] = [
  { id: 'first-order', icon: '📋', title: i18n.t('AchievementOnboarding.k1'), description: i18n.t('AchievementOnboarding.k2'), progress: 100, unlocked: true, unlockedAt: '2026-05-15', color: '#22C55E' },
  { id: '10-streak', icon: '🔥', title: i18n.t('AchievementOnboarding.k3'), description: i18n.t('AchievementOnboarding.k4'), progress: 70, unlocked: false, color: '#f59e0b' },
  { id: '100-ai', icon: '🤖', title: i18n.t('AchievementOnboarding.k5'), description: i18n.t('AchievementOnboarding.k6'), progress: 84, unlocked: false, color: '#3b82f6' },
  { id: 'published', icon: '📢', title: i18n.t('AchievementOnboarding.k7'), description: i18n.t('AchievementOnboarding.k8'), progress: 100, unlocked: true, unlockedAt: '2026-06-01', color: '#8b5cf6' },
  { id: '1k-sub', icon: '👥', title: i18n.t('AchievementOnboarding.k9'), description: i18n.t('AchievementOnboarding.k10'), progress: 28, unlocked: false, color: '#06b6d4' },
  { id: 'diamond', icon: '💎', title: i18n.t('AchievementOnboarding.k11'), description: i18n.t('AchievementOnboarding.k12'), progress: 100, unlocked: true, unlockedAt: '2026-06-08', color: '#B9F2FF' },
  { id: '10k-rev', icon: '💰', title: i18n.t('AchievementOnboarding.k13'), description: i18n.t('AchievementOnboarding.k14'), progress: 42, unlocked: false, color: '#D4A853' },
];

const mockSteps: OnboardingStep[] = [
  { step: 1, icon: '🔌', title: i18n.t('AchievementOnboarding.k15'), description: i18n.t('AchievementOnboarding.k16'), action: i18n.t('AchievementOnboarding.k17'), done: true },
  { step: 2, icon: '🤖', title: i18n.t('AchievementOnboarding.k18'), description: i18n.t('AchievementOnboarding.k19'), action: i18n.t('AchievementOnboarding.k20'), done: true },
  { step: 3, icon: '💹', title: i18n.t('AchievementOnboarding.k21'), description: i18n.t('AchievementOnboarding.k22'), action: i18n.t('AchievementOnboarding.k23'), done: false },
];

// ── Milestone Popup ─────────────────────────────────────────────────────

function MilestonePopup({ achievement, onClose }: { achievement: Achievement; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#1A1A24] border border-white/10 rounded-2xl p-8 text-center max-w-sm mx-4 shadow-2xl animate-bounce-in">
        <div className="text-6xl mb-4">{achievement.icon}</div>
        <div className="text-lg font-bold text-white mb-2">🎉 成就解锁!</div>
        <div className="text-xl font-black mb-1" style={{ color: achievement.color }}>{achievement.title}</div>
        <p className="text-sm text-gray-400 mb-4">{achievement.description}</p>
        <button onClick={onClose}
          className="px-8 py-2.5 rounded-xl bg-[#C9A046] hover:bg-[#D4A853] text-black font-bold text-sm">
          太棒了! Cool!
        </button>
      </div>
      <style>{`@keyframes bounce-in { 0%{transform:scale(.5);opacity:0} 60%{transform:scale(1.1)} 100%{transform:scale(1);opacity:1} } .animate-bounce-in{animation:bounce-in .5s ease}`}</style>
    </div>
  );
}

// ── Progress Bar ────────────────────────────────────────────────────────

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

// ── Main ────────────────────────────────────────────────────────────────

export default function AchievementOnboarding({
  achievements: propAch,
  onboardingSteps: propSteps,
  className = '',
}: AchievementOnboardingProps) {
  const [tab, setTab] = useState<'achievements' | 'onboarding'>('achievements');
  const [showMilestone, setShowMilestone] = useState(false);
  const [newAch, _setNewAch] = useState<Achievement | null>(null);
  const achievements = propAch ?? mockAchievements;
  const steps = propSteps ?? mockSteps;

  const unlocked = achievements.filter(a => a.unlocked).length;

  return (
    <div className={`h-full flex flex-col bg-[#0D0D14] text-white ${className}`}>
      <div className="p-5 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">成就 & 引导</h2>
            <p className="text-gray-500 text-xs mt-0.5">{unlocked}/{achievements.length} 成就解锁</p>
          </div>
          <div className="flex gap-1">
            <button onClick={() => setTab('achievements')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium ${tab === 'achievements' ? 'bg-[#C9A046]/20 text-[#D4A853]' : 'text-gray-600'}`}>
              🏆 成就
            </button>
            <button onClick={() => setTab('onboarding')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium ${tab === 'onboarding' ? 'bg-[#C9A046]/20 text-[#D4A853]' : 'text-gray-600'}`}>
              📖 引导
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {/* Achievements */}
        {tab === 'achievements' && (
          <div className="grid grid-cols-1 gap-3">
            {achievements.map(a => (
              <div key={a.id} className={`bg-[#111119] border rounded-xl p-4 flex items-center gap-4 ${a.unlocked ? 'border-[#D4A853]/20' : 'border-white/5 opacity-70'}`}>
                <div className="text-3xl flex-shrink-0" style={{ filter: a.unlocked ? 'none' : 'grayscale(1)' }}>
                  {a.unlocked ? a.icon : '🔒'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold" style={{ color: a.unlocked ? a.color : '#64748b' }}>{a.title}</span>
                    {a.unlocked && <span className="text-[10px] text-green-400">✓ {a.unlockedAt}</span>}
                  </div>
                  <p className="text-xs text-gray-500 mb-2">{a.description}</p>
                  <ProgressBar pct={a.progress} color={a.color} />
                  <div className="text-[9px] text-gray-600 mt-1 text-right">{a.progress}%</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Onboarding */}
        {tab === 'onboarding' && (
          <div className="space-y-4">
            {steps.map((s, i) => (
              <div key={s.step} className="bg-[#111119] border border-white/5 rounded-xl p-5">
                <div className="flex items-start gap-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${s.done ? 'bg-green-500/20 text-green-400' : 'bg-white/[0.04] text-gray-600'}`}>
                    {s.done ? '✓' : s.step}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{s.icon}</span>
                      <span className="text-sm font-semibold" style={{ color: s.done ? '#4ade80' : '#94a3b8' }}>第{s.step}{i18n.t('AchievementOnboarding.k0')}{s.title}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{s.description}</p>
                    {!s.done && (
                      <button className="mt-3 px-4 py-1.5 rounded-lg bg-[#3b82f6] text-white text-xs font-semibold">
                        {s.action}
                      </button>
                    )}
                  </div>
                </div>
                {i < steps.length - 1 && (
                  <div className="ml-4 mt-2 w-0.5 h-4 bg-white/[0.06]" />
                )}
              </div>
            ))}
            <div className="text-center text-[10px] text-gray-600">
              完成全部3步引导，解锁 i18n.t('AchievementOnboarding.k24') 成就 🎓
            </div>
          </div>
        )}
      </div>

      {showMilestone && newAch && (
        <MilestonePopup achievement={newAch} onClose={() => setShowMilestone(false)} />
      )}
    </div>
  );
}
