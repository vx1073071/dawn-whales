import { useState, useEffect, useCallback } from 'react';
import { EngineError } from '../../electron/engine/core/engine-error';

interface Toast {
  id: number;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  time: number;
}

let nextId = 1;
const listeners: Set<(toast: Toast) => void> = new Set();

export function notify(type: Toast['type'], message: string) {
  const toast: Toast = { id: nextId++, type, message, time: Date.now() };
  listeners.forEach((fn) => fn(toast));
}

export default function NotificationToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Toast) => {
    setToasts((prev) => [...prev, toast]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toast.id));
    }, 5000);
  }, []);

  useEffect(() => {
    listeners.add(addToast);

    // Listen for IPC notifications
    if (typeof window !== 'undefined' && window.api?.on) {
      window.api.on('notification', (data: Record<string, unknown>) => {
        notify((data.type as Toast['type']) || 'info', String(data.message || ''));
      });
      window.api.on('strategy-signal', (data: Record<string, unknown>) => {
        notify('info', `📡 ${data.strategyName}: ${data.signal} ${data.symbol} @ $${Number(data.price).toFixed(2)} — ${data.reason}`);
      });
      window.api.on('risk-alert', (data: Record<string, unknown>) => {
        notify('warning', `🛡️ 风控拦截: ${data.reason || '未知原因'}`);
      });
      window.api.on('order-update', (data: Record<string, unknown>) => {
        notify('success', `📋 订单 ${data.orderId}: ${data.code} ${data.side} ${data.qty}`);
      });
    }

    return () => {
      listeners.delete(addToast);
    };
  }, [addToast]);

  if (toasts.length === 0) return null;

  const colors = {
    success: 'border-emerald-500/30 bg-emerald-500/10',
    error: 'border-red-500/30 bg-red-500/10',
    warning: 'border-yellow-500/30 bg-yellow-500/10',
    info: 'border-[#C9A046]/30 bg-[#C9A046]/10',
  };

  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
  };

  const iconColors = {
    success: 'text-emerald-400',
    error: 'text-red-400',
    warning: 'text-yellow-400',
    info: 'text-[#D4A853]',
  };

  return (
    <div className="fixed top-14 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`border rounded-lg px-4 py-3 backdrop-blur-xl shadow-lg animate-slide-in ${colors[t.type]}`}
          style={{ animation: 'slideIn 0.3s ease-out' }}
        >
          <div className="flex items-start gap-2">
            <span className={`text-sm mt-0.5 ${iconColors[t.type]}`}>{icons[t.type]}</span>
            <p className="text-sm text-gray-200 leading-relaxed flex-1">{t.message}</p>
            <button
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              className="text-gray-500 hover:text-gray-300 text-xs mt-0.5"
            >✕</button>
          </div>
        </div>
      ))}
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}

void EngineError; // [SYSTEM] structured error tracking