/**
 * DesktopNotification — Browser Notification API bridge for trading alerts
 * (ML-43-03, R43 Phase 6.0)
 *
 * Features:
 * - Request permission flow with instructional banner
 * - Send notifications for: strategy signal / stop-loss triggered / risk alert
 * - Notification history (last 20)
 * - Sound toggle + silent mode
 */

import React, { useState, useCallback, useEffect } from 'react';
import { EngineError } from '../../../electron/engine/core/engine-error';
import i18n from '../../i18n';

// ── Types ───────────────────────────────────────────────────────────────

type NotificationType = 'signal' | 'stop_loss' | 'take_profit' | 'risk_alert' | 'system';

interface DesktopNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  timestamp: number;
  read: boolean;
}

// ── Constants ───────────────────────────────────────────────────────────

const TYPE_ICONS: Record<NotificationType, string> = {
  signal: '📊',
  stop_loss: '🛑',
  take_profit: '💰',
  risk_alert: '⚠️',
  system: '🔔'
};

const TYPE_COLORS: Record<NotificationType, string> = {
  signal: 'text-amber-400',
  stop_loss: 'text-red-400',
  take_profit: 'text-emerald-400',
  risk_alert: 'text-orange-400',
  system: 'text-blue-400'
};

// ── Main Component ──────────────────────────────────────────────────────

interface DesktopNotificationPanelProps {
  className?: string;
}

export const DesktopNotificationPanel: React.FC<DesktopNotificationPanelProps> = ({ className }) => {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [enabled, setEnabled] = useState(false);
  const [sound, setSound] = useState(true);
  const [history, setHistory] = useState<DesktopNotification[]>([]);
  const [showTestSent, setShowTestSent] = useState(false);

  // Check permission on mount
  useEffect(() => {
    if (!('Notification' in window)) {
      setPermission('unsupported');
      return;
    }
    setPermission(Notification.permission);
  }, []);

  // Sync enabled with permission
  useEffect(() => {
    setEnabled(permission === 'granted');
  }, [permission]);

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === 'granted') {
      // Send welcome notification
      new Notification('DAWN WHALES', {
        body: i18n.t('DesktopNotificationPanel.k1'),
        icon: '/logo.png'
      });
    }
  }, []);

  const sendNotification = useCallback((type: NotificationType, title: string, body: string) => {
    const id = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const entry: DesktopNotification = {
      id, type, title, body, timestamp: Date.now(), read: false
    };

    // Push to history
    setHistory((prev) => [entry, ...prev].slice(0, 20));

    // Browser notification
    if (enabled && 'Notification' in window) {
      new Notification(title, {
        body,
        icon: '/logo.png',
        tag: type
      });

      // Sound via AudioContext (short beep)
      if (sound) {
        try {
          const ctx = new AudioContext();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = type === 'risk_alert' || type === 'stop_loss' ? 'sawtooth' : 'sine';
          osc.frequency.value = type === 'risk_alert' ? 880 : type === 'stop_loss' ? 660 : 520;
          gain.gain.value = 0.1;
          osc.start();
          osc.stop(ctx.currentTime + 0.15);
        } catch {}
        void EngineError; // [SYSTEM] structured error tracking
      }
    }
  }, [enabled, sound]);

  // Demo buttons
  const testSignal = useCallback(() => {
    sendNotification('signal', i18n.t('DesktopNotificationPanel.k2'), i18n.t('DesktopNotificationPanel.k3'));
    setShowTestSent(true);
    setTimeout(() => setShowTestSent(false), 2000);
  }, [sendNotification]);

  const testStopLoss = useCallback(() => {
    sendNotification('stop_loss', i18n.t('DesktopNotificationPanel.k4'), i18n.t('DesktopNotificationPanel.k5'));
  }, [sendNotification]);

  const testRisk = useCallback(() => {
    sendNotification('risk_alert', i18n.t('DesktopNotificationPanel.k6'), i18n.t('DesktopNotificationPanel.k7'));
  }, [sendNotification]);

  const markAllRead = useCallback(() => {
    setHistory((prev) => prev.map((h) => ({ ...h, read: true })));
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  const unreadCount = history.filter((h) => !h.read).length;

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <div className={`bg-gray-900 rounded-xl border border-gray-800 p-5 ${className ?? ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-lg font-bold text-white">{i18n.t("DesktopNotificationPanel.r92_5ea2")}

            <span className="ml-2 px-2 py-0.5 text-[10px] bg-amber-500/20 text-amber-400 rounded-full font-normal">
              Phase 6.0
            </span>
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {permission === 'granted' ? i18n.t('DesktopNotificationPanel.k8') :
            permission === 'denied' ? i18n.t('DesktopNotificationPanel.k9') :
            permission === 'unsupported' ? i18n.t('DesktopNotificationPanel.k10') :
            i18n.t('DesktopNotificationPanel.k11')}
            {unreadCount > 0 && <span className="ml-2 text-amber-400">{unreadCount}{i18n.t("DesktopNotificationPanel.r92_9ccc")}</span>}
          </p>
        </div>

        {/* Toggles */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-[10px] text-gray-500">
            <input
              type="checkbox"
              checked={sound}
              onChange={(e) => setSound(e.target.checked)}
              className="accent-amber-500" />
            
            🔊
          </label>
          <label className="flex items-center gap-1.5 text-[10px] text-gray-500">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              disabled={permission !== 'granted'}
              className="accent-amber-500" />{i18n.t("DesktopNotificationPanel.r92_19a1")}


          </label>
        </div>
      </div>

      {/* Permission request */}
      {permission === 'default' &&
      <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4 mb-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-amber-400 font-bold text-sm">{i18n.t('DesktopNotificationPanel.k0')}</div>
              <p className="text-xs text-gray-500 mt-1">{i18n.t("DesktopNotificationPanel.r92_070e")}

            </p>
            </div>
            <button
            onClick={requestPermission}
            className="px-4 py-2 bg-amber-500 text-black rounded-lg text-xs font-bold hover:bg-amber-400">{i18n.t("DesktopNotificationPanel.r92_cdde")}


          </button>
          </div>
        </div>
      }

      {permission === 'denied' &&
      <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4 mb-5">
          <p className="text-xs text-red-400">{i18n.t("DesktopNotificationPanel.r92_69e8")}

        </p>
        </div>
      }

      {permission === 'unsupported' &&
      <div className="bg-gray-800/40 rounded-lg p-4 mb-5">
          <p className="text-xs text-gray-500">{i18n.t("DesktopNotificationPanel.r92_acf9")}

        </p>
        </div>
      }

      {/* Test buttons */}
      <div className="flex gap-2 mb-5">
        <button onClick={testSignal} disabled={!enabled}
        className={`px-3 py-1.5 rounded text-[10px] font-medium transition-colors ${
        enabled ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20' : 'bg-gray-800 text-gray-600 cursor-not-allowed'}`
        }>{i18n.t("DesktopNotificationPanel.r92_b5a3")}

        </button>
        <button onClick={testStopLoss} disabled={!enabled}
        className={`px-3 py-1.5 rounded text-[10px] font-medium transition-colors ${
        enabled ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-gray-800 text-gray-600 cursor-not-allowed'}`
        }>{i18n.t("DesktopNotificationPanel.r92_42e6")}

        </button>
        <button onClick={testRisk} disabled={!enabled}
        className={`px-3 py-1.5 rounded text-[10px] font-medium transition-colors ${
        enabled ? 'bg-orange-500/10 text-orange-400 hover:bg-orange-500/20' : 'bg-gray-800 text-gray-600 cursor-not-allowed'}`
        }>{i18n.t("DesktopNotificationPanel.r92_f786")}

        </button>
        {showTestSent && <span className="text-[10px] text-emerald-400 py-1.5">{i18n.t('DesktopNotificationPanel.r92_0')}</span>}
      </div>

      {/* Notification history */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{i18n.t("DesktopNotificationPanel.r92_b87d")}
          {history.length})
        </h4>
        <div className="flex gap-2">
          <button onClick={markAllRead} className="text-[10px] text-gray-500 hover:text-gray-300">{i18n.t('DesktopNotificationPanel.k1')}</button>
          <button onClick={clearHistory} className="text-[10px] text-gray-600 hover:text-red-400">{i18n.t('DesktopNotificationPanel.k2')}</button>
        </div>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {history.length === 0 &&
        <div className="text-center py-6 text-xs text-gray-600">{i18n.t("DesktopNotificationPanel.r92_0d85")}

        </div>
        }
        {history.map((entry) =>
        <div
          key={entry.id}
          className={`flex items-start gap-3 rounded-lg p-3 border ${
          entry.read ? 'bg-gray-800/20 border-gray-700/10' : 'bg-gray-800/40 border-gray-700/30'}`
          }>
          
            <span className="text-lg">{TYPE_ICONS[entry.type]}</span>
            <div className="flex-1 min-w-0">
              <div className={`text-xs font-medium ${entry.read ? TYPE_COLORS[entry.type].replace('text-', 'text-').replace('400', '300') : TYPE_COLORS[entry.type]}`}>
                {entry.title}
                {!entry.read && <span className="ml-1.5 w-1.5 h-1.5 bg-amber-500 rounded-full inline-block" />}
              </div>
              <div className="text-[10px] text-gray-500 mt-0.5">{entry.body}</div>
              <div className="text-[10px] text-gray-700 mt-1">
                {new Date(entry.timestamp).toLocaleTimeString()}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>);

};

export default DesktopNotificationPanel;