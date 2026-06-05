import { useState, useEffect } from 'react';
import { useAppStore } from '@/stores/appStore';
import { getAccounts } from '@/lib/bridge-api';

export default function StatusBar() {
  const [time, setTime] = useState(new Date());
  const [mem, setMem] = useState<number | null>(null);
  const [opendLatency, setOpendLatency] = useState<number | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [errorCount, setErrorCount] = useState(0);
  const conn = useAppStore((s) => s.connectionStatus);
  const opendConnected = conn?.connected ?? false;

  useEffect(() => {
    let errors = 0;
    const t = setInterval(async () => {
      setTime(new Date());
      // Check OpenD health via bridge
      const t0 = performance.now();
      try {
        const accounts = await getAccounts();
        const latency = performance.now() - t0;
        setOpendLatency(Math.round(latency));
        if (!accounts || accounts.length === 0) errors++;
        else errors = 0;
      } catch {
        errors++;
        setOpendLatency(null);
      }
      setErrorCount(errors);
      // Poll memory usage
      if (window.api?.app) {
        window.api.app.getMemoryUsage().then((info: any) => {
          if (info?.total) setMem(info.total);
        }).catch(() => {});
      }
    }, 5000);
    return () => clearInterval(t);
  }, []);

  async function handleReconnect() {
    setReconnecting(true);
    try {
      if (window.api?.broker) {
        await window.api.broker.reconnect();
      }
      setErrorCount(0);
      setOpendLatency(null);
    } finally {
      setReconnecting(false);
    }
  }

  const statusColor = opendConnected
    ? errorCount > 2 ? 'bg-amber-400' : 'bg-emerald-400'
    : 'bg-red-500';

  return (
    <footer className="h-6 bg-[#0a0a12] border-t border-white/5 flex items-center px-3 gap-3 text-[10px] text-gray-600 flex-shrink-0">
      {/* OpenD 状态 */}
      <div className="flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full ${statusColor}`} />
        <span>
          {opendConnected
            ? `OpenD ${opendLatency !== null ? opendLatency + 'ms' : ''}${errorCount > 0 ? ' · ' + errorCount + ' err' : ''}`
            : 'OpenD 未连接'
          }
        </span>
        {errorCount > 3 && (
          <button
            onClick={handleReconnect}
            disabled={reconnecting}
            className="text-[10px] text-blue-400 hover:text-blue-300 ml-1"
          >
            {reconnecting ? '重连中…' : '🔄 重连'}
          </button>
        )}
      </div>
      <span className="text-gray-700">|</span>
      <span>{errorCount > 0 ? 'Pull 模式' : 'Push 模式'}</span>
      <span className="text-gray-700">|</span>
      <span>道鲸 v0.7.0</span>
      <div className="flex-1" />
      {mem && <span>内存: {mem}MB</span>}
      {mem && <span className="text-gray-700">|</span>}
      <span>{time.toLocaleTimeString('zh-CN', { hour12: false })}</span>
    </footer>
  );
}
