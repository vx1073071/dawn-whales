// ── DAWN WHALES — NotificationCenter (通知中心) ────────────────────────────

import { useState, useEffect } from 'react'
import { useState, useEffect } from 'react-i18next';

export interface NotificationItem {
  id: string;
  type: 'risk' | 'order' | 'signal' | 'system' | 'market';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  severity: 'info' | 'warning' | 'critical';
}

interface NotificationCenterProps {
  notifications?: NotificationItem[];
  onClear?: () => void;
  onMarkRead?: (id: string) => void;
}

const TYPE_CONFIG: Record<string, { icon: string; label: string; color: string }> = {
  risk: { icon: '🛡️', label: '风控', color: 'text-red-400' },
  order: { icon: '📋', label: '订单', color: 'text-blue-400' },
  signal: { icon: '📡', label: '信号', color: 'text-[#D4A853]' },
  system: { icon: '⚙️', label: '系统', color: 'text-gray-400' },
  market: { icon: '📈', label: '市场', color: 'text-emerald-400' },
};

const SEVERITY_CONFIG: Record<string, { bg: string; border: string }> = {
  info: { bg: 'bg-blue-500/5', border: 'border-blue-500/10' },
  warning: { bg: 'bg-yellow-500/5', border: 'border-yellow-500/10' },
  critical: { bg: 'bg-red-500/5', border: 'border-red-500/10' },
};

export default function NotificationCenter({
  notifications = [],
  onClear,
  onMarkRead,
}: NotificationCenterProps) {
  const { t } = useTranslation();

  const [filter, setFilter] = useState<'all' | 'unread' | 'risk' | 'order' | 'signal'>('all');
  const [items, setItems] = useState<NotificationItem[]>(notifications);

  // Listen for real-time notifications via IPC
  useEffect(() => {
    if (typeof window !== 'undefined' && window.api?.on) {
      const handler = (data: unknown) => {
        const newItem: NotificationItem = {
          id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          type: data.type || 'system',
          title: data.title || t('components.notification'),
          message: data.message || '',
          timestamp: Date.now(),
          read: false,
          severity: data.severity || 'info',
        };
        setItems((prev) => [newItem, ...prev].slice(0, 100));
      };
      window.api.on('notification', handler);
      return () => {
        // Cleanup not available for simple IPC, but ok for this pattern
      };
    }
  }, []);

  const filtered = items.filter((n) => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !n.read;
    return n.type === filter;
  });

  const unreadCount = items.filter((n) => !n.read).length;
  const riskCount = items.filter((n) => n.type === 'risk' && !n.read).length;

  const handleMarkRead = (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    onMarkRead?.(id);
  };

  const handleClear = () => {
    setItems([]);
    onClear?.();
  };

  return (
    <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-white font-semibold text-sm">🔔 通知中心</h2>
          {unreadCount > 0 && (
            <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full">
              {unreadCount}
            </span>
          )}
          {riskCount > 0 && (
            <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full">
              🛡️ {riskCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleClear}
            className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
          >
            清空全部
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-1 mb-3">
        {([
          { key: 'all' as const, label: t('components.all') },
          { key: 'unread' as const, label: `未读${unreadCount > 0 ? `(${unreadCount})` : ''}` },
          { key: 'risk' as const, label: '风控' },
          { key: 'order' as const, label: t('components.orders') },
          { key: 'signal' as const, label: t('components.signal') },
        ]).map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
              filter === f.key ? 'bg-[#C9A046] text-black' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Notifications */}
      {filtered.length === 0 ? (
        <div className="text-center py-6">
          <div className="text-2xl mb-2 opacity-40">🔔</div>
          <p className="text-gray-500 text-sm">暂无通知</p>
          <p className="text-gray-600 text-xs mt-1">风控/订单/信号通知将显示在这里</p>
        </div>
      ) : (
        <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
          {filtered.map((n) => {
            const config = TYPE_CONFIG[n.type] || TYPE_CONFIG.system;
            const sev = SEVERITY_CONFIG[n.severity] || SEVERITY_CONFIG.info;
            return (
              <div
                key={n.id}
                onClick={() => handleMarkRead(n.id)}
                className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs cursor-pointer transition-colors ${
                  n.read ? 'bg-[#12121a] opacity-60' : `${sev.bg} border ${sev.border}`
                }`}
              >
                <span className="text-sm flex-shrink-0">{config.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`font-medium ${config.color}`}>{config.label}</span>
                    <span className="text-white font-medium truncate">{n.title}</span>
                    {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-[#C9A046] flex-shrink-0" />}
                  </div>
                  <div className="text-gray-400 text-[10px] mt-0.5">{n.message}</div>
                  <div className="text-gray-600 text-[10px] mt-0.5">
                    {new Date(n.timestamp).toLocaleTimeString('zh-CN')}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
