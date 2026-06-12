// ── R132-M01 CopyTradeNotifications — 跟单实时通知UI ────────────────────
// @ts-nocheck — complex notification system, window.api contextBridge access
// PM: Toast弹出 + 通知中心 + 声音反馈
// 桌面端接收WebSocket推送的跟单状态变化

import { useState, useCallback, useEffect, useRef } from 'react';
import { Button, Badge, Tooltip, Drawer, Tag, Empty } from 'antd';
import { BellOutlined, CheckCircleOutlined, CloseCircleOutlined, SyncOutlined, DollarOutlined, NotificationOutlined, SoundOutlined, SoundFilled } from '@ant-design/icons';

// ═══════════ Types ═══════════

type NotificationType = 'order_filled' | 'order_failed' | 'order_retrying' | 'signal_received' | 'stop_loss' | 'take_profit' | 'error';

interface CopyTradeNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  data?: {
    symbol?: string;
    side?: string;
    amount?: number;
    price?: number;
    pnl?: number;
    providerName?: string;
    brokerName?: string;
    orderId?: string;
  };
}

// ═══════════ Icon + Color mapping ═══════════

const NOTIFICATION_CONFIG: Record<NotificationType, { icon: React.ReactNode; color: string; soundFile?: string }> = {
  order_filled:   { icon: <CheckCircleOutlined />, color: '#22c55e', soundFile: 'order-filled' },
  order_failed:   { icon: <CloseCircleOutlined />,  color: '#ef4444', soundFile: 'order-failed' },
  order_retrying: { icon: <SyncOutlined spin />,     color: '#f59e0b' },
  signal_received:{ icon: <BellOutlined />,           color: '#3b82f6' },
  stop_loss:      { icon: <CloseCircleOutlined />,  color: '#ef4444', soundFile: 'stop-loss' },
  take_profit:    { icon: <CheckCircleOutlined />,  color: '#22c55e', soundFile: 'take-profit' },
  error:          { icon: <CloseCircleOutlined />,  color: '#ef4444' },
};

// ═══════════ Mock data ═══════════

const MOCK_NOTIFICATIONS: CopyTradeNotification[] = [
  { id: 'n1', type: 'order_filled', title: '跟单成交', message: 'AlphaQuant: BTC-USDT 买入 0.01 @ $97,234.00', timestamp: Date.now() - 60000, read: false, data: { symbol: 'BTC-USDT', side: 'buy', amount: 0.01, price: 97234, pnl: 156.8, providerName: 'AlphaQuant', brokerName: 'Binance' } },
  { id: 'n2', type: 'signal_received', title: '收到信号', message: 'GoldenCross 发出 SOL-USDT 卖出信号', timestamp: Date.now() - 180000, read: false },
  { id: 'n3', type: 'order_failed', title: '跟单失败', message: 'AlphaQuant: BNB-USDT 买入失败 - 余额不足', timestamp: Date.now() - 600000, read: true },
  { id: 'n4', type: 'order_retrying', title: '正在重试', message: 'ScalperBot: DOGE-USDT 买入 第2次重试', timestamp: Date.now() - 1200000, read: true },
  { id: 'n5', type: 'stop_loss', title: '止损触发', message: 'WhaleTracker: ETH-USDT 触发止损 -2.5%', timestamp: Date.now() - 3600000, read: true, data: { symbol: 'ETH-USDT', pnl: -125, providerName: 'WhaleTracker' } },
  { id: 'n6', type: 'take_profit', title: '止盈触发', message: 'AlphaQuant: BTC-USDT 触发止盈 +3.2%', timestamp: Date.now() - 7200000, read: true, data: { symbol: 'BTC-USDT', pnl: 320, providerName: 'AlphaQuant' } },
];

// ═══════════ Audio context ═══════════
// Simple beep sounds without external files

const SOUND_FREQUENCIES: Record<string, number[]> = {
  'order-filled':  [800, 1000],
  'order-failed':  [300, 200],
  'stop-loss':     [400, 300, 200],
  'take-profit':   [1000, 1200, 1400],
};

function playBeep(type: string) {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const freqs = SOUND_FREQUENCIES[type] || [600];
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.value = 0.1;
      osc.start(ctx.currentTime + i * 0.12);
      osc.stop(ctx.currentTime + i * 0.12 + 0.08);
    });
    setTimeout(() => ctx.close(), 2000);
  } catch {}
}

// ═══════════ Toast helper ═══════════

function showToast(notification: CopyTradeNotification) {
  const cfg = NOTIFICATION_CONFIG[notification.type];
  const el = document.createElement('div');
  el.className = 'fixed top-4 right-4 z-[200] px-4 py-2.5 rounded-lg shadow-xl border transition-all animate-slide-in font-mono';
  el.style.cssText = `background:#161b22;border-color:${cfg.color}40;max-width:360px;`;
  el.innerHTML = `
    <div class="flex items-start gap-2">
      <span style="color:${cfg.color};font-size:14px;">${cfg.icon ? '🔔' : '📢'}</span>
      <div class="flex-1 min-w-0">
        <div class="text-xs font-bold" style="color:${cfg.color}">${notification.title}</div>
        <div class="text-[10px] text-[#8b949e] mt-0.5">${notification.message}</div>
      </div>
      <button class="text-[#484f58] hover:text-[#8b949e] text-xs" onclick="this.parentElement.parentElement.remove()">×</button>
    </div>`;
  document.body.appendChild(el);
  setTimeout(() => { if (el.parentElement) el.remove(); }, 5000);
}

// ═══════════ Component ═══════════

export function CopyTradeNotificationBell() {
  const [notifications, setNotifications] = useState<CopyTradeNotification[]>(() => {
    try { const s = localStorage.getItem('dw-notifications'); return s ? JSON.parse(s) : MOCK_NOTIFICATIONS; }
    catch { return MOCK_NOTIFICATIONS; }
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try { return localStorage.getItem('dw-sound') !== 'off'; } catch { return true; }
  });
  const prevCount = useRef(notifications.length);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Simulate incoming notifications
  useEffect(() => {
    const timer = setInterval(() => {
      const types: NotificationType[] = ['order_filled', 'order_failed', 'signal_received', 'stop_loss'];
      const type = types[Math.floor(Math.random() * types.length)];
      const symbols = ['BTC-USDT', 'ETH-USDT', 'SOL-USDT', 'DOGE-USDT'];
      const providers = ['AlphaQuant', 'WhaleTracker', 'GoldenCross'];
      const newNotif: CopyTradeNotification = {
        id: `n-${Date.now()}`,
        type, title: NOTIFICATION_CONFIG[type].color === '#22c55e' ? '跟单成交' : type === 'order_failed' ? '跟单失败' : '收到信号',
        message: `${providers[Math.floor(Math.random()*3)]}: ${symbols[Math.floor(Math.random()*4)]} ${type === 'order_filled' ? '成交' : type === 'signal_received' ? '信号' : '事件'}`,
        timestamp: Date.now(), read: false,
      };
      setNotifications(prev => {
        const updated = [newNotif, ...prev].slice(0, 50);
        try { localStorage.setItem('dw-notifications', JSON.stringify(updated)); } catch {}
        return updated;
      });
      showToast(newNotif);
      if (soundEnabled) playBeep(type);
    }, 30000); // Simulate every 30s
    return () => clearInterval(timer);
  }, [soundEnabled]);

  const markAllRead = useCallback(() => {
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, read: true }));
      try { localStorage.setItem('dw-notifications', JSON.stringify(updated)); } catch {}
      return updated;
    });
  }, []);

  const markRead = useCallback((id: string) => {
    setNotifications(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, read: true } : n);
      try { localStorage.setItem('dw-notifications', JSON.stringify(updated)); } catch {}
      return updated;
    });
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    try { localStorage.removeItem('dw-notifications'); } catch {}
  }, []);

  const toggleSound = useCallback(() => {
    setSoundEnabled(prev => {
      const next = !prev;
      try { localStorage.setItem('dw-sound', next ? 'on' : 'off'); } catch {}
      return next;
    });
  }, []);

  return (
    <>
      {/* Bell icon */}
      <Tooltip title="跟单通知">
        <div className="relative cursor-pointer" onClick={() => setDrawerOpen(true)} style={{ fontFamily: 'monospace' }}>
          <BellOutlined className="text-[#8b949e] text-sm hover:text-[#c9d1d9] transition-colors" />
          {unreadCount > 0 && (
            <Badge count={unreadCount} size="small" offset={[-2, 0]}
              className="absolute -top-1 -right-1 [&_.ant-badge-count]:text-[8px] [&_.ant-badge-count]:h-4 [&_.ant-badge-count]:leading-4" />
          )}
        </div>
      </Tooltip>

      {/* Notification Drawer */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={
          <div className="flex items-center justify-between" style={{ fontFamily: 'monospace' }}>
            <div className="flex items-center gap-2">
              <NotificationOutlined className="text-[#c9d1d9]" />
              <span className="text-[#e6edf3] text-sm font-bold">通知中心</span>
              <Tag color="blue" className="text-[9px]">{unreadCount} 未读</Tag>
            </div>
            <div className="flex items-center gap-1">
              <Tooltip title={soundEnabled ? '关闭声音' : '开启声音'}>
                <Button size="small" type="text"
                  icon={soundEnabled ? <SoundFilled className="text-[10px]" /> : <SoundOutlined className="text-[10px]" />}
                  onClick={toggleSound} />
              </Tooltip>
              <Button size="small" type="text" className="text-[10px]" onClick={markAllRead}>全部已读</Button>
              <Button size="small" type="text" danger className="text-[10px]" onClick={clearAll}>清空</Button>
            </div>
          </div>
        }
        styles={{ body: { background: '#0d1117', padding: 0 }, header: { background: '#0d1117', borderColor: '#1c2333' } }}
        width={380}
      >
        <div className="flex flex-col" style={{ fontFamily: 'monospace' }}>
          {notifications.map(n => {
            const cfg = NOTIFICATION_CONFIG[n.type];
            return (
              <div key={n.id}
                onClick={() => markRead(n.id)}
                className={`flex items-start gap-2 px-3 py-2 border-b border-[#1c2333] cursor-pointer transition-colors ${n.read ? 'opacity-60' : 'bg-[#3b82f608]'}`}
              >
                {/* Status icon */}
                <span className="mt-0.5 text-xs" style={{ color: cfg.color }}>
                  {cfg.icon}
                </span>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-[#c9d1d9]">{n.title}</span>
                    <span className="text-[8px] text-[#484f58]">
                      {new Date(n.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="text-[9px] text-[#8b949e] mt-0.5">{n.message}</div>

                  {/* PnL display */}
                  {n.data?.pnl != null && (
                    <div className={`text-[9px] font-bold mt-0.5 ${n.data.pnl >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                      <DollarOutlined /> {n.data.pnl >= 0 ? '+' : ''}{n.data.pnl.toFixed(2)} USDT
                    </div>
                  )}
                </div>

                {/* Unread dot */}
                {!n.read && <div className="w-1.5 h-1.5 rounded-full bg-[#3b82f6] mt-1.5 shrink-0" />}
              </div>
            );
          })}

          {notifications.length === 0 && (
            <Empty description={<span className="text-[#484f58] text-xs">暂无通知</span>}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              className="py-12" />
          )}
        </div>
      </Drawer>
    </>
  );
}

export default CopyTradeNotificationBell;
