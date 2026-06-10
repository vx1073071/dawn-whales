// ── BrokerSelector — Sprint1: Multi-broker switcher UI ──────────────────────
import { useState, useEffect, useRef , useTranslation} from 'react';
import { getBrokerStatus, setActiveBroker } from '@/lib/bridge-api';

interface BrokerStatus {
  id: string;
  name: string;
  type: string;
  connected: boolean;
  accountCount: number;
  lastError?: string;
}

const BROKER_ICONS: Record<string, string> = {
  futu: '🐂',
  moomoo: '🐮',
  ib: '🌐',
  longbridge: '🌉',
  custom: '⚙️',
};

const BROKER_LABELS: Record<string, string> = {
  futu: '富途',
  moomoo: 'moomoo',
  ib: 'IBKR',
  longbridge: '长桥',
  custom: '自定义',
};

export default function BrokerSelector() {
  const { t } = useTranslation();

  const [open, setOpen] = useState(false);
  const [statuses, setStatuses] = useState<BrokerStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeBroker = statuses.find((s) => s.connected);

  async function refreshStatus() {
    const result = await getBrokerStatus();
    setStatuses(result);
  }

  useEffect(() => {
    refreshStatus();
    // Poll every 5s
    const interval = setInterval(refreshStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  async function handleSwitch(id: string) {
    if (loading) return;
    setLoading(true);
    try {
      const result = await setActiveBroker(id);
      if (result?.success) {
        await refreshStatus();
        setOpen(false);
      }
    } finally {
      setLoading(false);
    }
  }

  if (statuses.length <= 1) {
    // Only one broker — show compact indicator
    return (
      <div className="flex items-center gap-1.5 text-xs">
        <span className={`w-1.5 h-1.5 rounded-full ${activeBroker ? 'bg-emerald-400' : 'bg-gray-500'}`} />
        <span className="text-gray-400">{activeBroker ? (BROKER_LABELS[activeBroker.type] || activeBroker.name) : t('components.disconnected')}</span>
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-xs px-2 py-1 rounded hover:bg-white/5 transition-colors text-gray-300 hover:text-white"
        title="切换券商"
      >
        <span className={`w-1.5 h-1.5 rounded-full ${activeBroker ? 'bg-emerald-400' : 'bg-gray-500'}`} />
        <span>{activeBroker ? (BROKER_LABELS[activeBroker.type] || activeBroker.name) : '选择券商'}</span>
        <span className="text-gray-500 text-[10px]">▾</span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-1 w-52 bg-[#1e1e2e] border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-white/5">
            <span className="text-[10px] text-gray-500 uppercase tracking-wider">切换券商</span>
          </div>

          {statuses.map((broker) => {
            const isActive = broker.id === activeBroker?.id;
            return (
              <button
                key={broker.id}
                onClick={() => handleSwitch(broker.id)}
                disabled={loading}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-white/5 transition-colors ${
                  isActive ? 'bg-emerald-500/10' : ''
                }`}
              >
                {/* Status dot */}
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${broker.connected ? 'bg-emerald-400' : 'bg-gray-500'}`} />

                {/* Broker icon */}
                <span className="text-sm">{BROKER_ICONS[broker.type] || '📦'}</span>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className={`text-xs font-medium truncate ${isActive ? 'text-emerald-400' : 'text-gray-200'}`}>
                    {broker.name}
                  </div>
                  <div className="text-[10px] text-gray-500">
                    {broker.connected ? t('components.connected') : t('components.disconnected')}
                    {!broker.connected && broker.lastError && (
                      <span className="text-red-400 ml-1">· {broker.lastError}</span>
                    )}
                  </div>
                </div>

                {/* Active indicator */}
                {isActive && (
                  <span className="text-emerald-400 text-xs">✓</span>
                )}
              </button>
            );
          })}

          {/* Footer */}
          <div className="px-3 py-1.5 border-t border-white/5 flex justify-end">
            <button
              onClick={refreshStatus}
              className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
            >
              🔄 刷新
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
