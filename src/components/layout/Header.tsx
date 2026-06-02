import React from 'react';
import { useAppStore } from '@/stores/appStore';

export default function Header() {
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const conn = useAppStore((s) => s.connectionStatus);

  return (
    <header className="h-12 bg-surface-2 border-b border-border flex items-center px-4 gap-3 flex-shrink-0">
      <button
        onClick={toggleSidebar}
        className="text-gray-400 hover:text-gray-200 text-lg p-1"
        title="折叠侧边栏"
      >
        ☰
      </button>

      <div className="flex items-center gap-2">
        <span className="text-primary text-lg">🐋</span>
        <span className="text-primary font-bold text-sm tracking-wide">DAWN WHALES</span>
        <span className="text-gray-400 text-xs">道鲸</span>
        <span className="text-gray-500 text-[10px]">v0.1.0</span>
      </div>

      <div className="flex-1" />

      {/* Connection indicators */}
      <div className="flex items-center gap-4 text-xs">
        <StatusBadge
          label="OpenD"
          connected={conn?.connected ?? false}
          detail={conn?.connected ? `${conn.latencyMs}ms` : conn?.lastError}
        />
        <StatusBadge label="Cloud" connected={false} />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 ml-4">
        <button className="text-gray-400 hover:text-gray-200 p-1.5 rounded hover:bg-surface-hover" title="通知">
          🔔
        </button>
        <button className="text-gray-400 hover:text-gray-200 p-1.5 rounded hover:bg-surface-hover" title="紧急停止">
          ⏸️
        </button>
      </div>
    </header>
  );
}

function StatusBadge({ label, connected, detail }: { label: string; connected: boolean; detail?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-400' : 'bg-gray-500'}`} />
      <span className={connected ? 'text-gray-300' : 'text-gray-500'}>{label}</span>
      {detail && <span className="text-gray-500">{detail}</span>}
    </div>
  );
}
