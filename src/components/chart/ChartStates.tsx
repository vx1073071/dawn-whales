// ── R119 #33 Unified Chart State Components ────────────────────────────
// ChartSkeleton / ChartError / ChartEmpty — 所有chart组件统一使用



// ═══════════ ChartSkeleton — Loading placeholder ═══════════

export function ChartSkeleton({ height = 300, rows = 8, className = '' }: { height?: number; rows?: number; className?: string }) {
  return (
    <div className={`flex flex-col bg-[#0d1117] rounded-lg border border-[#30363d] p-3 gap-2 animate-pulse ${className}`} style={{ height, fontFamily: 'monospace' }}>
      <div className="h-4 w-24 bg-[#1c2333] rounded" />
      <div className="flex-1 flex flex-col gap-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="h-3 bg-[#1c2333] rounded" style={{
              width: `${60 + Math.random() * 40}%`,
              opacity: 1 - i * 0.1,
            }} />
          </div>
        ))}
      </div>
      <div className="h-3 w-32 bg-[#1c2333] rounded" />
    </div>
  );
}

// ═══════════ ChartError — Error with retry ═══════════

export function ChartError({
  title = '数据加载失败',
  message = '请检查券商连接或网络',
  onRetry,
  className = '',
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center bg-[#0d1117] rounded-lg border border-[#30363d] p-6 gap-3 ${className}`} style={{ fontFamily: 'monospace' }}>
      <span className="text-2xl">⚠️</span>
      <span className="text-[#ef4444] text-xs font-bold">{title}</span>
      <span className="text-[#8b949e] text-[10px] text-center">{message}</span>
      {onRetry && (
        <button onClick={onRetry} className="px-3 py-1 bg-[#3b82f620] text-[#3b82f6] text-[10px] rounded hover:bg-[#3b82f630] transition-colors">
          重试
        </button>
      )}
    </div>
  );
}

// ═══════════ ChartEmpty — No data placeholder ═══════════

export function ChartEmpty({
  icon = '📊',
  title = '暂无数据',
  message = '连接券商或订阅行情后显示',
  action,
  className = '',
}: {
  icon?: string;
  title?: string;
  message?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center bg-[#0d1117] rounded-lg border border-[#30363d] p-6 gap-2 ${className}`} style={{ fontFamily: 'monospace' }}>
      <span className="text-3xl opacity-30">{icon}</span>
      <span className="text-[#8b949e] text-xs font-bold">{title}</span>
      <span className="text-[#484f58] text-[10px] text-center max-w-[200px]">{message}</span>
      {action && (
        <button onClick={action.onClick} className="mt-2 px-3 py-1 bg-[#3b82f620] text-[#3b82f6] text-[10px] rounded hover:bg-[#3b82f630] transition-colors">
          {action.label}
        </button>
      )}
    </div>
  );
}

// ═══════════ BrokerStatusBar — 常驻券商连接状态 ─────────────────────────

export interface BrokerStatus {
  brokerId: string;
  brokerName: string;
  status: 'connected' | 'connecting' | 'stale' | 'disconnected';
  latency?: number;
  lastUpdate?: number;
}

export function BrokerStatusBar({ brokers, onClick, className = '' }: {
  brokers: BrokerStatus[];
  onClick?: (brokerId: string) => void;
  className?: string;
}) {
  const connected = brokers.filter(b => b.status === 'connected').length;
  const total = brokers.length;

  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 bg-[#0d1117] rounded border border-[#30363d] ${className}`} style={{ fontFamily: 'monospace' }}>
      <span className="text-[8px] text-[#484f58]">券商</span>
      {brokers.map(b => (
        <button
          key={b.brokerId}
          onClick={() => onClick?.(b.brokerId)}
          className="flex items-center gap-1 px-1 py-0.5 rounded hover:bg-[#161b22] transition-colors"
          title={`${b.brokerName}: ${b.status}${b.latency != null ? ` ${b.latency}ms` : ''}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${
            b.status === 'connected' ? 'bg-[#22c55e]' :
            b.status === 'connecting' ? 'bg-[#f59e0b] animate-pulse' :
            b.status === 'stale' ? 'bg-[#f59e0b]' : 'bg-[#ef4444]'
          }`} />
          <span className="text-[8px] text-[#8b949e]">{b.brokerName.slice(0, 4)}</span>
        </button>
      ))}
      <span className={`text-[8px] ml-auto ${connected === total ? 'text-[#22c55e]' : connected > 0 ? 'text-[#f59e0b]' : 'text-[#ef4444]'}`}>
        {connected}/{total}
      </span>
    </div>
  );
}
