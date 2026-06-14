/**
 * TradingEasy R123 J04 — Notification History + Do Not Disturb
 * 
 * - Stores last 50 notifications in localStorage
 * - Do Not Disturb toggle with timer
 * - Desktop notification forwarding through IPC
 */

import React, { useEffect, useState, useCallback } from 'react';

// ═══════════ Types ════════════════════════════════════

export interface NotificationItem {
  id: string;
  type: 'alert' | 'trade' | 'signal' | 'system' | 'order';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  body: string;
  code?: string;
  price?: number;
  timestamp: number;
  read: boolean;
}

const STORAGE_KEY = 'dw-notification-history';
const DND_KEY = 'dw-dnd-state';
const MAX_HISTORY = 50;

// ═══════════ NotificationStore ═══════════════════════

class NotificationStore {
  private items: NotificationItem[] = [];
  private dnd = false;
  private dndEndTime = 0;

  load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) this.items = JSON.parse(raw);
      const dndRaw = localStorage.getItem(DND_KEY);
      if (dndRaw) {
        const d = JSON.parse(dndRaw);
        this.dnd = d.dnd || false;
        this.dndEndTime = d.dndEndTime || 0;
      }
    } catch {}
    // Auto-expire DND
    if (this.dnd && Date.now() > this.dndEndTime) {
      this.dnd = false;
      this.dndEndTime = 0;
    }
  }

  save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.items.slice(0, MAX_HISTORY)));
      localStorage.setItem(DND_KEY, JSON.stringify({ dnd: this.dnd, dndEndTime: this.dndEndTime }));
    } catch {}
  }

  add(item: Omit<NotificationItem, 'id' | 'read'>): NotificationItem {
    const full: NotificationItem = {
      ...item,
      id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      read: false,
    };
    this.items.unshift(full);
    if (this.items.length > MAX_HISTORY) this.items = this.items.slice(0, MAX_HISTORY);
    this.save();
    return full;
  }

  getAll(): NotificationItem[] { return this.items; }

  getUnread(): NotificationItem[] { return this.items.filter(i => !i.read); }

  getUnreadCount(): number { return this.items.filter(i => !i.read).length; }

  markAllRead(): void {
    this.items.forEach(i => { i.read = true; });
    this.save();
  }

  markRead(id: string): void {
    const item = this.items.find(i => i.id === id);
    if (item) { item.read = true; this.save(); }
  }

  clear(): void {
    this.items = [];
    this.save();
  }

  isDnd(): boolean { return this.dnd && Date.now() < this.dndEndTime; }

  setDnd(durationMinutes: number): void {
    this.dnd = true;
    this.dndEndTime = Date.now() + durationMinutes * 60000;
    this.save();
  }

  cancelDnd(): void {
    this.dnd = false;
    this.dndEndTime = 0;
    this.save();
  }

  getDndRemaining(): number {
    if (!this.dnd) return 0;
    return Math.max(0, Math.ceil((this.dndEndTime - Date.now()) / 60000));
  }
}

// Global singleton
const store = new NotificationStore();
store.load();

// ═══════════ Hook: useNotifications ═══════════════════

export function useNotifications() {
  const [items, setItems] = useState<NotificationItem[]>(store.getAll());
  const [unreadCount, setUnreadCount] = useState(store.getUnreadCount());
  const [dndRemaining, setDndRemaining] = useState(store.getDndRemaining());

  // Listen for new notifications from IPC
  useEffect(() => {
    const api = (window as any).api;
    if (!api?.on) return;

    const unsub = api.on('alert:push', (data: any) => {
      if (store.isDnd()) return; // Skip if DND

      store.add({
        type: data.type || 'alert',
        severity: data.severity || 'info',
        title: data.title || data.message || 'Alert',
        body: data.message || '',
        code: data.code,
        price: data.price,
        timestamp: data.timestamp || Date.now(),
      });

      setItems([...store.getAll()]);
      setUnreadCount(store.getUnreadCount());
    });

    // DND timer
    const timer = setInterval(() => {
      setDndRemaining(store.getDndRemaining());
    }, 30000);

    return () => { unsub?.(); clearInterval(timer); };
  }, []);

  const markAllRead = useCallback(() => {
    store.markAllRead();
    setItems([...store.getAll()]);
    setUnreadCount(0);
  }, []);

  const enableDnd = useCallback((minutes: number) => {
    store.setDnd(minutes);
    setDndRemaining(minutes);
  }, []);

  const disableDnd = useCallback(() => {
    store.cancelDnd();
    setDndRemaining(0);
  }, []);

  const clearAll = useCallback(() => {
    store.clear();
    setItems([]);
  }, []);

  return { items, unreadCount, dndRemaining, markAllRead, enableDnd, disableDnd, clearAll };
}

// ═══════════ NotificationHistory Component ═══════════════

export const NotificationHistoryPanel: React.FC = () => {
  const { items, unreadCount, dndRemaining, markAllRead, enableDnd, disableDnd } = useNotifications();
  const [expanded, setExpanded] = useState(false);

  const dndOptions = [30, 60, 120, 240]; // minutes

  return (
    <div className="p-4 bg-[#0d1117] text-[#c9d1d9] h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-[#58a6ff]">
          Notifications
          {unreadCount > 0 && (
            <span className="ml-2 px-2 py-0.5 text-[10px] rounded-full bg-[#f0883e20] text-[#f0883e]">
              {unreadCount} new
            </span>
          )}
        </h2>
        <div className="flex items-center gap-2">
          {/* DND Toggle */}
          {dndRemaining > 0 ? (
            <button
              onClick={disableDnd}
              className="px-2 py-1 text-[10px] rounded-full bg-[#330d17] text-[#f85149] border border-[#ef444440]"
              title="Disable Do Not Disturb"
            >
              🔕 DND: {dndRemaining}min left
            </button>
          ) : (
            <div className="relative">
              <button
                onClick={() => setExpanded(!expanded)}
                className="px-2 py-1 text-[10px] rounded-full bg-[#1c2333] text-[#8b949e] border border-[#30363d] hover:bg-[#21262d]"
              >
                🔕 DND
              </button>
              {expanded && (
                <div className="absolute right-0 top-7 bg-[#161b22] border border-[#30363d] rounded-lg shadow-xl p-1 z-50">
                  {dndOptions.map(min => (
                    <button
                      key={min}
                      onClick={() => { enableDnd(min); setExpanded(false); }}
                      className="block w-full px-3 py-1.5 text-[11px] text-[#c9d1d9] hover:bg-[#1c2333] rounded text-left whitespace-nowrap"
                    >
                      {min} minutes
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <button onClick={markAllRead} className="text-[10px] text-[#58a6ff] hover:underline">
            Mark all read
          </button>
        </div>
      </div>

      {/* Notification List */}
      {items.length === 0 ? (
        <div className="text-center py-8 text-[#484f58] text-sm">
          No notifications yet
        </div>
      ) : (
        <div className="space-y-1">
          {items.slice(0, 50).map(item => (
            <div
              key={item.id}
              className={`flex items-start gap-3 p-2.5 rounded-lg border transition-colors ${
                item.read ? 'bg-[#0d1117] border-[#21262d]' : 'bg-[#161b22] border-[#30363d]'
              }`}
            >
              {/* Severity indicator */}
              <span className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                item.severity === 'critical' ? 'bg-[#ef4444]' :
                item.severity === 'warning' ? 'bg-[#f59e0b]' :
                'bg-[#58a6ff]'
              }`} />

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-[#c9d1d9]">{item.title}</span>
                  {item.code && <span className="font-mono text-[#58a6ff]">{item.code}</span>}
                  {item.price != null && (
                    <span className="font-mono text-[#c9d1d9]">${item.price}</span>
                  )}
                </div>
                <div className="text-[10px] text-[#484f58] truncate">{item.body}</div>
                <div className="text-[9px] text-[#30363d] mt-0.5">
                  {new Date(item.timestamp).toLocaleString()}
                </div>
              </div>

              {/* Unread dot */}
              {!item.read && <span className="w-1.5 h-1.5 rounded-full bg-[#58a6ff] flex-shrink-0 mt-1" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
