// @ts-nocheck
import React, { useState } from 'react';

/* ====== Types ====== */
interface ReferralTier { level: string; inviteCount: string; reward: string; icon: string; color: string; desc: string; }
interface ShareTemplate { id: string; title: string; body: string; icon: string; channel: string; }
interface ReferralStats { totalInvited: number; activeInvites: number; rewardEarned: number; nextTierAt: number; }

/* ====== Mock Data ====== */
const tiers: ReferralTier[] = [
  { level: '新朋友', inviteCount: '邀请1人', reward: '免费1个月', icon: '👋', color: 'from-green-400 to-emerald-500', desc: '你朋友完成1次回测，你俩各得1个月免费' },
  { level: '好朋友', inviteCount: '邀请5人', reward: '免费6个月', icon: '🤝', color: 'from-blue-400 to-indigo-500', desc: '5位朋友各完成1次回测，你获得6个月免费会员' },
  { level: '死党', inviteCount: '邀请20人', reward: '永久免费', icon: '👑', color: 'from-purple-400 to-pink-500', desc: '20位朋友激活后，你和其中3位好友永久免费' }
];

const shareTemplates: ShareTemplate[] = [
  { id: 'st1', title: '邀请朋友一起赚钱', body: '我发现一个AI量化交易平台，免费试用鲸灵AI做回测。用我的邀请码注册，你我各得1个月免费。试试看: https://QuantMoo.com/invite/ABC123', icon: '💌', channel: '微信' },
  { id: 'st2', title: '分享我的策略收益', body: '我的MACD策略本月+8.2%！在QUANT MOO上用AI选因子、做回测，免费试用3天。', icon: '📊', channel: '朋友圈' },
  { id: 'st3', title: '分享鲸灵名言', body: '"别追高，等它回踩" — 鲸灵🐋。DW AI交易伙伴真的比我自己瞎买靠谱多了。', icon: '🐋', channel: '投资群' }
];

const mockStats: ReferralStats = { totalInvited: 3, activeInvites: 2, rewardEarned: 1, nextTierAt: 5 };

/* ====== Main Component ====== */

export default function SocialViral() {
  const [referralCode] = useState('ABC123');
  const [showCopied, setShowCopied] = useState(false);
  const [activeShare, setActiveShare] = useState<string | null>(null);

  const copyCode = () => { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); };
  const progressPct = Math.min((mockStats.totalInvited / mockStats.nextTierAt) * 100, 100);

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-green-400 to-emerald-600 text-white">
        <h2 className="text-lg font-bold">🎁 邀请好友 & 赚奖励</h2>
        <p className="text-xs text-white/80">邀请朋友体验DW · 你们俩都得到免费会员</p>
      </div>

      {/* Referral Code */}
      <div className="px-4 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <p className="text-xs font-bold text-gray-500 uppercase mb-2">你的专属邀请码</p>
        <div className="flex items-center gap-2">
          <div className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-2 border-dashed border-green-400 text-center">
            <p className="text-2xl font-bold text-green-700 dark:text-green-400 tracking-widest">{referralCode}</p>
          </div>
          <button onClick={copyCode} className="px-4 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-bold">
            {showCopied ? '✅ 已复制' : '复制'}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1">分享链接: https://dw.sh/{referralCode}</p>
      </div>

      {/* Progress */}
      <div className="px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-gray-500">邀请进度</span>
          <span className="text-xs text-gray-500">{mockStats.totalInvited}/{mockStats.nextTierAt} 到下一级</span>
        </div>
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {/* Tiers */}
      <div className="px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">奖励等级</h3>
        <div className="space-y-2">
          {tiers.map(t => (
            <div key={t.level} className={`rounded-xl bg-gradient-to-r ${t.color} p-0.5`}>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">{t.icon}</span>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{t.level}</p>
                    <p className="text-xs text-gray-500">{t.inviteCount} → {t.reward}</p>
                  </div>
                </div>
                <p className="text-xs text-gray-500">{t.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Share Templates */}
      <div className="px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">一键分享</h3>
        {shareTemplates.map(s => (
          <div key={s.id} className="mb-2 last:mb-0">
            <button onClick={() => setActiveShare(activeShare === s.id ? null : s.id)} className="w-full flex items-center gap-2 p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 text-left">
              <span className="text-lg">{s.icon}</span>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-800">{s.title}</p>
                <p className="text-xs text-gray-400">{s.channel}</p>
              </div>
              <span className="text-gray-400">{activeShare === s.id ? '▲' : '▼'}</span>
            </button>
            {activeShare === s.id && (
              <div className="p-3 mt-1 rounded-lg bg-gray-50 dark:bg-gray-700 text-xs text-gray-600 leading-relaxed">
                <p>{s.body}</p>
                <button onClick={copyCode} className="mt-2 px-3 py-1 rounded bg-green-600 text-white text-xs font-bold">{showCopied ? '✅' : '复制文案'}</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Stats */}
      <div className="px-4 py-3 bg-white dark:bg-gray-800">
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          {[
            { label: '已邀请', value: mockStats.totalInvited, icon: '👥' },
            { label: '已激活', value: mockStats.activeInvites, icon: '✅' },
            { label: '已赚', value: `${mockStats.rewardEarned}月`, icon: '🎉' }
          ].map(s => (
            <div key={s.label} className="p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50">
              <p className="text-lg">{s.icon}</p>
              <p className="font-bold text-gray-900">{s.value}</p>
              <p className="text-gray-400">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t bg-white dark:bg-gray-800 text-xs text-gray-400 flex items-center justify-between">
        <span>🎁 奖励规则: 朋友完成1次回测即激活</span>
        <span>social-viral v2.7</span>
      </div>
    </div>
  );
}
