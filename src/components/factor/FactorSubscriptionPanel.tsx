// @ts-nocheck
// R276 ML#3: Factor Subscription Panel — Push notification & daily digest UI
// User subscribes to factors, receives daily IC ranking + anomaly alerts

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

interface FactorSubscription {
  factorId: string;
  name: string;
  nameCN: string;
  category: string;
  frequency: 'daily' | 'weekly' | 'realtime';
  channels: ('push' | 'email' | 'inapp')[];
  threshold: 'any' | 'STRONG_LONG' | 'STRONG_SHORT' | 'both';
  lastAlert?: string;
  enabled: boolean;
}

const DEFAULT_SUBSCRIPTIONS: FactorSubscription[] = [
  { factorId: 'CN_EARNINGS_YOY', name: 'Earnings YoY', nameCN: '净利YoY', category: 'Growth', frequency: 'daily', channels: ['push', 'inapp'], threshold: 'both', enabled: true },
  { factorId: 'CN_MOMENTUM_1M', name: '1M Momentum', nameCN: '1月动量', category: 'Momentum', frequency: 'daily', channels: ['push'], threshold: 'STRONG_LONG', enabled: true },
  { factorId: 'CN_PE_TTM', name: 'PE TTM', nameCN: '市盈率TTM', category: 'Value', frequency: 'weekly', channels: ['inapp'], threshold: 'STRONG_SHORT', enabled: true },
  { factorId: 'CN_NORTHBOUND_FLOW', name: 'Northbound Flow', nameCN: '北向资金', category: 'Flow', frequency: 'daily', channels: ['push', 'email', 'inapp'], threshold: 'any', enabled: true },
  { factorId: 'CN_MAJOR_FLOW_5D', name: '5D Major Flow', nameCN: '5日主力', category: 'Flow', frequency: 'daily', channels: ['push', 'inapp'], threshold: 'both', enabled: false },
  { factorId: 'CN_DRAGON_TIGER', name: 'Dragon Tiger', nameCN: '龙虎榜', category: 'Sentiment', frequency: 'realtime', channels: ['push', 'inapp'], threshold: 'both', enabled: true },
];

export default function FactorSubscriptionPanel() {
  const { i18n } = useTranslation();
  const isZh = i18n.language?.startsWith('zh');
  const [subs, setSubs] = useState<FactorSubscription[]>(DEFAULT_SUBSCRIPTIONS);
  const [saving, setSaving] = useState(false);

  const toggleEnabled = useCallback((factorId: string) => {
    setSubs(prev => prev.map(s => s.factorId === factorId ? { ...s, enabled: !s.enabled } : s));
  }, []);

  const changeFrequency = useCallback((factorId: string, freq: FactorSubscription['frequency']) => {
    setSubs(prev => prev.map(s => s.factorId === factorId ? { ...s, frequency: freq } : s));
  }, []);

  const toggleChannel = useCallback((factorId: string, channel: 'push' | 'email' | 'inapp') => {
    setSubs(prev => prev.map(s => {
      if (s.factorId !== factorId) return s;
      const channels = s.channels.includes(channel)
        ? s.channels.filter(c => c !== channel)
        : [...s.channels, channel];
      return { ...s, channels };
    }));
  }, []);

  const changeThreshold = useCallback((factorId: string, threshold: FactorSubscription['threshold']) => {
    setSubs(prev => prev.map(s => s.factorId === factorId ? { ...s, threshold } : s));
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    const api = (window as any).api;
    if (api?.factor?.saveSubscriptions) {
      await api.factor.saveSubscriptions(subs.filter(s => s.enabled));
    }
    setTimeout(() => setSaving(false), 500);
  }, [subs]);

  const activeCount = subs.filter(s => s.enabled).length;

  return (
    <div className="p-4 bg-[#1a1a25] border border-white/5 rounded-xl text-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-bold text-lg">🔔 {isZh ? '因子订阅管理' : 'Factor Subscriptions'}</h2>
          <p className="text-xs text-gray-500 mt-1">
            {isZh
              ? `${activeCount}/${subs.length} 个活跃订阅 · 每日推送IC排名与异常事件`
              : `${activeCount}/${subs.length} active · Daily IC ranking & anomaly alerts`}
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-1.5 rounded bg-[#D4A853] hover:bg-[#C9A046] text-black text-xs font-medium disabled:opacity-50 transition-colors"
        >
          {saving ? (isZh ? '保存中...' : 'Saving...') : (isZh ? '保存通知设置' : 'Save Settings')}
        </button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="p-3 rounded-lg bg-gray-800/50 text-center">
          <div className="text-lg font-bold text-indigo-400">{activeCount}</div>
          <div className="text-[10px] text-gray-500">{isZh ? '活跃订阅' : 'Active Subs'}</div>
        </div>
        <div className="p-3 rounded-lg bg-gray-800/50 text-center">
          <div className="text-lg font-bold text-green-400">
            {subs.filter(s => s.enabled && s.channels.includes('push')).length}
          </div>
          <div className="text-[10px] text-gray-500">{isZh ? '推送通道' : 'Push Enabled'}</div>
        </div>
        <div className="p-3 rounded-lg bg-gray-800/50 text-center">
          <div className="text-lg font-bold text-[#D4A853]">
            {subs.filter(s => s.frequency === 'realtime').length}
          </div>
          <div className="text-[10px] text-gray-500">{isZh ? '实时监控' : 'Realtime'}</div>
        </div>
      </div>

      {/* Subscription List */}
      <div className="space-y-2 max-h-[500px] overflow-y-auto">
        {subs.map(sub => (
          <div
            key={sub.factorId}
            className={`p-3 rounded-lg border transition-all ${
              sub.enabled
                ? 'bg-gray-800/30 border-white/5'
                : 'bg-gray-800/10 border-white/5 opacity-60'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{isZh ? sub.nameCN : sub.name}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-400">
                  {isZh ? (sub.category === 'Growth' ? '成长' : sub.category === 'Value' ? '价值' : sub.category === 'Momentum' ? '动量' : sub.category === 'Flow' ? '资金流' : sub.category) : sub.category}
                </span>
              </div>
              <button
                onClick={() => toggleEnabled(sub.factorId)}
                className={`w-10 h-5 rounded-full transition-colors ${
                  sub.enabled ? 'bg-indigo-600' : 'bg-gray-600'
                }`}
              >
                <span className={`block w-4 h-4 mt-0.5 rounded-full bg-white transition-all ${
                  sub.enabled ? 'ml-5' : 'ml-0.5'
                }`} />
              </button>
            </div>

            {sub.enabled && (
              <div className="space-y-1.5 ml-2">
                {/* Frequency */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-gray-500 w-16">{isZh ? '频率' : 'Frequency'}:</span>
                  <div className="flex gap-1">
                    {(['daily', 'weekly', 'realtime'] as const).map(freq => (
                      <button
                        key={freq}
                        onClick={() => changeFrequency(sub.factorId, freq)}
                        className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                          sub.frequency === freq
                            ? 'bg-indigo-600/30 text-indigo-400'
                            : 'bg-gray-700 text-gray-500 hover:text-gray-300'
                        }`}
                      >
                        {freq === 'daily' ? (isZh ? '每日' : 'Daily') :
                         freq === 'weekly' ? (isZh ? '每周' : 'Weekly') :
                         (isZh ? '实时' : 'Live')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Channels */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-gray-500 w-16">{isZh ? '通道' : 'Channel'}:</span>
                  <div className="flex gap-2">
                    {[
                      { key: 'push' as const, icon: '📱', label: isZh ? '推送' : 'Push' },
                      { key: 'email' as const, icon: '📧', label: isZh ? '邮件' : 'Email' },
                      { key: 'inapp' as const, icon: '🔔', label: isZh ? '站内' : 'In-app' },
                    ].map(ch => (
                      <button
                        key={ch.key}
                        onClick={() => toggleChannel(sub.factorId, ch.key)}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] transition-colors ${
                          sub.channels.includes(ch.key)
                            ? 'bg-indigo-600/20 text-indigo-400'
                            : 'bg-gray-700 text-gray-500 hover:text-gray-300'
                        }`}
                      >
                        {ch.icon} {ch.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Threshold */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-gray-500 w-16">{isZh ? '触发' : 'Alert on'}:</span>
                  <div className="flex gap-1">
                    {[
                      { key: 'any' as const, label: isZh ? '任意' : 'Any' },
                      { key: 'STRONG_LONG' as const, label: isZh ? '强烈做多' : 'Strong Buy' },
                      { key: 'STRONG_SHORT' as const, label: isZh ? '强烈做空' : 'Strong Sell' },
                      { key: 'both' as const, label: isZh ? '两极' : 'Both' },
                    ].map(th => (
                      <button
                        key={th.key}
                        onClick={() => changeThreshold(sub.factorId, th.key)}
                        className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                          sub.threshold === th.key
                            ? th.key === 'both' || th.key === 'any'
                              ? 'bg-indigo-600/30 text-indigo-400'
                              : th.key === 'STRONG_LONG'
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-red-500/20 text-red-400'
                            : 'bg-gray-700 text-gray-500 hover:text-gray-300'
                        }`}
                      >
                        {th.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Last Alert */}
            {sub.lastAlert && sub.enabled && (
              <div className="mt-1.5 text-[10px] text-gray-600 ml-2">
                {isZh ? '上次警报' : 'Last alert'}: {sub.lastAlert}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Bulk Actions */}
      <div className="mt-4 pt-3 border-t border-white/5 flex items-center gap-3 text-xs">
        <button
          onClick={() => setSubs(prev => prev.map(s => ({ ...s, enabled: true })))}
          className="text-indigo-400 hover:text-indigo-300"
        >
          {isZh ? '全部启用' : 'Enable All'}
        </button>
        <button
          onClick={() => setSubs(prev => prev.map(s => ({ ...s, enabled: false })))}
          className="text-gray-500 hover:text-gray-400"
        >
          {isZh ? '全部停用' : 'Disable All'}
        </button>
        <span className="text-gray-600">
          {isZh ? '每日最大推送 20条' : 'Max 20 pushes/day'}
        </span>
      </div>
    </div>
  );
}
