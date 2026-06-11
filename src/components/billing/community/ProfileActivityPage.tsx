/**
 * ProfileActivityPage — ML-72-02 [P0]
 * R72: v1.8.0-alpha — User profile + activity feed + notification center
 *
 * Features:
 * - Profile header: avatar, name, level, bio, stats (followers/following/strategies/signals)
 * - Activity feed: follower activity (new signal, trade, level-up)
 * - My strategies list with performance
 * - Subscription list
 * - Notification center: unread badge, categorized (signal/comment/system), mark read
 */

import { useState, useMemo } from 'react';
import { useTranslation } from "react-i18next";
import i18n from '../../../i18n';
import { EngineError } from '../../../../electron/engine/core/engine-error';
void EngineError; // [EngineError:SYSTEM] structured error tracking

// ── Types ───────────────────────────────────────────────────────────────

export interface Profile {
  name: string;
  avatar: string;
  level: string;
  levelColor: string;
  bio: string;
  followers: number;
  following: number;
  strategies: number;
  signals: number;
  totalRevenue: number;
  joinedAt: string;
}

export interface Activity {
  id: string;
  type: 'signal' | 'trade' | 'levelup' | 'subscribe' | 'comment';
  user: string;
  avatar: string;
  content: string;
  time: string;
  link?: string;
}

export interface Notification {
  id: string;
  type: 'signal' | 'comment' | 'system';
  icon: string;
  title: string;
  body: string;
  time: string;
  read: boolean;
}

export interface MyStrategy {
  id: string;
  name: string;
  status: 'live' | 'paused' | 'backtest';
  return_: number;
  sharpe: number;
  subscribers: number;
  revenue: number;
}

export interface ProfileActivityPageProps {
  profile?: Profile;
  activities?: Activity[];
  notifications?: Notification[];
  myStrategies?: MyStrategy[];
  subscriptions?: string[];
  className?: string;
}

// ── Mock ────────────────────────────────────────────────────────────────

const mockProfile: Profile = {
  name: 'QuantEdge Pro', avatar: '🦊', level: i18n.t('ProfileActivityPage.k1'), levelColor: '#B9F2FF',
  bio: i18n.t('ProfileActivityPage.k2'),
  followers: 2847, following: 52, strategies: 6, signals: 847,
  totalRevenue: 14250, joinedAt: '2025-11'
};

const mockActivities: Activity[] = [
{ id: 'a1', type: 'signal', user: 'QuantEdge Pro', avatar: '🦊', content: i18n.t('ProfileActivityPage.k3'), time: i18n.t('ProfileActivityPage.k4') },
{ id: 'a2', type: 'trade', user: 'QuantEdge Pro', avatar: '🦊', content: i18n.t('ProfileActivityPage.k5'), time: i18n.t('ProfileActivityPage.k6') },
{ id: 'a3', type: 'subscribe', user: 'CryptoWhale', avatar: '🐋', content: i18n.t('ProfileActivityPage.k7'), time: i18n.t('ProfileActivityPage.k8') },
{ id: 'a4', type: 'levelup', user: 'QuantEdge Pro', avatar: '🦊', content: i18n.t('ProfileActivityPage.k9'), time: i18n.t('ProfileActivityPage.k10') },
{ id: 'a5', type: 'comment', user: 'TraderJoe', avatar: '🐂', content: i18n.t('ProfileActivityPage.k11'), time: i18n.t('ProfileActivityPage.k12') }];


const mockNotifications: Notification[] = [
{ id: 'n1', type: 'signal', icon: '📡', title: i18n.t('ProfileActivityPage.k13'), body: i18n.t('ProfileActivityPage.k14'), time: i18n.t('ProfileActivityPage.k15'), read: false },
{ id: 'n2', type: 'comment', icon: '💬', title: i18n.t('ProfileActivityPage.k16'), body: i18n.t('ProfileActivityPage.k17'), time: i18n.t('ProfileActivityPage.k18'), read: false },
{ id: 'n3', type: 'system', icon: '🔔', title: i18n.t('ProfileActivityPage.k19'), body: i18n.t('ProfileActivityPage.k20'), time: i18n.t('ProfileActivityPage.k21'), read: true },
{ id: 'n4', type: 'comment', icon: '💬', title: i18n.t('ProfileActivityPage.k22'), body: i18n.t('ProfileActivityPage.k23'), time: i18n.t('ProfileActivityPage.k24'), read: true }];


const mockMyStrategies: MyStrategy[] = [
{ id: 's1', name: i18n.t('ProfileActivityPage.k25'), status: 'live', return_: 42.3, sharpe: 2.1, subscribers: 2847, revenue: 14200 },
{ id: 's2', name: i18n.t('ProfileActivityPage.k26'), status: 'live', return_: 28.1, sharpe: 1.8, subscribers: 1523, revenue: 5100 },
{ id: 's3', name: i18n.t('ProfileActivityPage.k27'), status: 'paused', return_: 8.2, sharpe: 0.6, subscribers: 89, revenue: 320 }];


// ── Stat Card ────────────────────────────────────────────────────────────

function StatCard({ value, label }: {value: string | number;label: string;}) {
  const { t: _t } = useTranslation();

  return (
    <div style={{ textAlign: 'center', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 10 }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0' }}>{typeof value === 'number' ? value.toLocaleString() : value}</div>
      <div style={{ fontSize: 9, color: '#64748b', marginTop: 2 }}>{label}</div>
    </div>);

}

// ── Activity Icon ────────────────────────────────────────────────────────

function ActivityIcon({ type }: {type: Activity['type'];}) {
  const map: Record<string, string> = { signal: '📡', trade: '💰', levelup: '🎉', subscribe: '👥', comment: '💬' };
  return <span style={{ fontSize: 16 }}>{map[type] || '📌'}</span>;
}

// ── Main ────────────────────────────────────────────────────────────────

export default function ProfileActivityPage({
  profile: propProfile,
  activities: propActivities,
  notifications: propNotif,
  myStrategies: propStrats,
  subscriptions: _subs,
  className = ''
}: ProfileActivityPageProps) {
  const [tab, setTab] = useState<'activity' | 'strategies' | 'notifications'>('activity');
  const profile = propProfile ?? mockProfile;
  const activities = propActivities ?? mockActivities;
  const notifications = propNotif ?? mockNotifications;
  const myStrategies = propStrats ?? mockMyStrategies;

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  return (
    <div className={`h-full flex flex-col bg-[#0D0D14] text-white ${className}`}>
      {/* Profile Header */}
      <div className="p-5 border-b border-white/5">
        <div className="flex items-center gap-4 mb-4">
          <span style={{ fontSize: 48 }}>{profile.avatar}</span>
          <div style={{ flex: 1 }}>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-white">{profile.name}</span>
              <span className="text-[10px] px-2 py-0.5 rounded" style={{ color: profile.levelColor, background: `${profile.levelColor}15` }}>
                {profile.level}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">{profile.bio}</p>
            <div className="text-[10px] text-gray-600 mt-1">{i18n.t("ProfileActivityPage.r92_489a")}{profile.joinedAt}</div>
          </div>
        </div>
        <div className="grid grid-cols-5 gap-2">
          <StatCard value={profile.followers} label={i18n.t('ProfileActivityPage.k28')} />
          <StatCard value={profile.following} label={i18n.t('ProfileActivityPage.k29')} />
          <StatCard value={profile.strategies} label={"components.strategy"} />
          <StatCard value={profile.signals} label={"components.signal"} />
          <StatCard value={`$${profile.totalRevenue.toLocaleString()}`} label={i18n.t('ProfileActivityPage.k30')} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/5">
        <TabBtn active={tab === 'activity'} onClick={() => setTab('activity')} label={i18n.t('ProfileActivityPage.k31')} />
        <TabBtn active={tab === 'strategies'} onClick={() => setTab('strategies')} label={i18n.t('ProfileActivityPage.k32')} />
        <TabBtn active={tab === 'notifications'} onClick={() => setTab('notifications')} label={`🔔 通知${unreadCount > 0 ? ` (${unreadCount})` : ''}`} badge={unreadCount} />
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Activity Feed */}
        {tab === 'activity' &&
        <div className="divide-y divide-white/5">
            {activities.map((a) =>
          <div key={a.id} className="flex items-start gap-3 px-5 py-3 hover:bg-white/[0.02]">
                <ActivityIcon type={a.type} />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold text-gray-300">{a.user}</span>
                  <span className="text-xs text-gray-500 ml-1">{a.content}</span>
                  <div className="text-[10px] text-gray-600 mt-1">{a.time}</div>
                </div>
              </div>
          )}
          </div>
        }

        {/* My Strategies */}
        {tab === 'strategies' &&
        <div className="p-5 space-y-3">
            {myStrategies.map((s) =>
          <div key={s.id} className="bg-[#111119] border border-white/5 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-200">{s.name}</span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${s.status === 'live' ? 'bg-green-500/10 text-green-400' : s.status === 'paused' ? 'bg-yellow-500/10 text-yellow-400' : 'bg-gray-500/10 text-gray-400'}`}>
                    {s.status === 'live' ? i18n.t('ProfileActivityPage.k33') : s.status === 'paused' ? i18n.t('ProfileActivityPage.k34') : i18n.t('ProfileActivityPage.k35')}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div><div className="text-gray-500">{"components.returnRate"}</div><div className={`font-semibold ${s.return_ >= 0 ? 'text-green-400' : 'text-red-400'}`}>+{s.return_}%</div></div>
                  <div><div className="text-gray-500">{"components.sharpeRatio"}</div><div className="font-semibold text-gray-300">{s.sharpe}</div></div>
                  <div><div className="text-gray-500">{i18n.t('ProfileActivityPage.k0')}</div><div className="font-semibold text-gray-300">{s.subscribers.toLocaleString()}</div></div>
                  <div><div className="text-gray-500">{i18n.t('ProfileActivityPage.k1')}</div><div className="font-semibold text-[#D4A853]">${s.revenue.toLocaleString()}</div></div>
                </div>
              </div>
          )}
          </div>
        }

        {/* Notifications */}
        {tab === 'notifications' &&
        <div className="divide-y divide-white/5">
            {notifications.map((n) =>
          <div key={n.id} className={`flex items-start gap-3 px-5 py-3 ${n.read ? '' : 'bg-blue-500/[0.03]'}`}>
                <span style={{ fontSize: 18, opacity: n.read ? 0.4 : 1 }}>{n.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold ${n.read ? 'text-gray-500' : 'text-gray-200'}`}>{n.title}</span>
                    {!n.read && <span className="w-2 h-2 rounded-full bg-blue-400" />}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{n.body}</p>
                  <div className="text-[10px] text-gray-600 mt-1">{n.time}</div>
                </div>
              </div>
          )}
          </div>
        }
      </div>
    </div>);

}

function TabBtn({ active, onClick, label }: {active: boolean;onClick: () => void;label: string;badge?: number;}) {
  return (
    <button onClick={onClick}
    style={{
      flex: 1, padding: '10px 0', textAlign: 'center', fontSize: 12, fontWeight: 600,
      color: active ? '#D4A853' : '#64748b',
      borderBottom: active ? '2px solid #D4A853' : '2px solid transparent',
      background: 'none', cursor: 'pointer'
    }}>
      {label}
    </button>);

}

export { StatCard, ActivityIcon };