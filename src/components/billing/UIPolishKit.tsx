/**
 * UIPolishKit — ML-69-03 [P1]
 * R69: v1.7.0-beta — UI polish: skeleton screens, empty states, error-friendly messages
 *
 * Features:
 * - SkeletonScreen: shimmer loading placeholder for cards/tables
 * - EmptyState: friendly empty placeholders with CTA (8 scenarios)
 * - ErrorDisplay: error-friendly messages with retry + help links (6 scenarios)
 * - LoadingSpinner: branded spinner with optional message
 */


// ── Types ───────────────────────────────────────────────────────────────

export type SkeletonVariant = 'card' | 'table-row' | 'chart' | 'text-block' | 'stats-grid';

export interface SkeletonScreenProps {
  variant?: SkeletonVariant;
  count?: number;
  className?: string;
}

export type EmptyScenario = 'no-signals' | 'no-strategies' | 'no-orders' | 'no-positions' | 'no-creators' | 'no-results' | 'no-notifications' | 'no-backtests';

export interface EmptyStateProps {
  scenario: EmptyScenario;
  onAction?: () => void;
  className?: string;
}

export type ErrorScenario = 'connection' | 'timeout' | 'auth' | 'permission' | 'server' | 'data-load';

export interface ErrorDisplayProps {
  scenario: ErrorScenario;
  message?: string;
  onRetry?: () => void;
  onHelp?: () => void;
  className?: string;
}

export interface LoadingSpinnerProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

// ── Shimmer CSS ─────────────────────────────────────────────────────────

const shimmerStyle = `
@keyframes shimmer {
  0% { background-position: -400px 0; }
  100% { background-position: 400px 0; }
}
.shimmer {
  animation: shimmer 1.5s ease-in-out infinite;
  background: linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 75%);
  background-size: 800px 100%;
}
`;

// ── SkeletonScreen ──────────────────────────────────────────────────────

export function SkeletonScreen({ variant = 'card', count = 3, className = '' }: SkeletonScreenProps) {
  const renderSkeleton = () => {
    switch (variant) {
      case 'card':
        return (
          <div className={`shimmer bg-[#111119] border border-white/5 rounded-xl p-4`} style={{ height: 180 }}>
            <div className="shimmer rounded-full w-10 h-10 mb-3" />
            <div className="shimmer rounded h-4 w-3/4 mb-2" />
            <div className="shimmer rounded h-3 w-full mb-2" />
            <div className="shimmer rounded h-3 w-2/3 mb-3" />
            <div className="flex gap-2">
              <div className="shimmer rounded h-6 w-16" />
              <div className="shimmer rounded h-6 w-16" />
            </div>
          </div>
        );

      case 'table-row':
        return (
          <div className="shimmer flex items-center gap-4 px-4 py-3 border-b border-white/5">
            <div className="shimmer rounded-full w-8 h-8" />
            <div className="flex-1">
              <div className="shimmer rounded h-3 w-1/3 mb-1" />
              <div className="shimmer rounded h-2 w-1/4" />
            </div>
            <div className="shimmer rounded h-3 w-16" />
            <div className="shimmer rounded h-3 w-12" />
          </div>
        );

      case 'chart':
        return (
          <div className="shimmer bg-[#111119] border border-white/5 rounded-xl p-5" style={{ height: 220 }}>
            <div className="shimmer rounded h-4 w-1/3 mb-4" />
            <div className="shimmer rounded" style={{ height: 150, width: '100%' }} />
            <div className="flex justify-between mt-3">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="shimmer rounded h-2 w-8" />
              ))}
            </div>
          </div>
        );

      case 'text-block':
        return (
          <div className="shimmer bg-[#111119] border border-white/5 rounded-xl p-5">
            <div className="shimmer rounded h-4 w-1/2 mb-3" />
            <div className="shimmer rounded h-3 w-full mb-2" />
            <div className="shimmer rounded h-3 w-full mb-2" />
            <div className="shimmer rounded h-3 w-3/4 mb-2" />
            <div className="shimmer rounded h-3 w-1/2" />
          </div>
        );

      case 'stats-grid':
        return (
          <div className="bg-[#111119] border border-white/5 rounded-xl p-4 flex flex-col items-center gap-2" style={{ minHeight: 100 }}>
            <div className="shimmer rounded-full w-10 h-10" />
            <div className="shimmer rounded h-5 w-16" />
            <div className="shimmer rounded h-2 w-12" />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={`ui-skeleton ${className}`}>
      <style>{shimmerStyle}</style>
      <div className={variant === 'table-row' ? '' : variant === 'stats-grid' ? 'grid grid-cols-4 gap-3' : 'space-y-4'}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i}>{renderSkeleton()}</div>
        ))}
      </div>
    </div>
  );
}

// ── EmptyState ──────────────────────────────────────────────────────────

const EMPTY_CONFIG: Record<EmptyScenario, { icon: string; title: string; subtitle: string; action: string }> = {
  'no-signals':      { icon: '📡', title: '暂无信号', subtitle: '创作者还未发布信号。订阅创作者后信号会出现在这里。', action: '浏览信号广场' },
  'no-strategies':   { icon: '🧠', title: '暂无策略', subtitle: '使用自然语言创建你的第一个量化策略，或从市场购买。', action: '创建策略' },
  'no-orders':       { icon: '📋', title: '暂无订单', subtitle: '创建策略并启动实盘后，订单将出现在这里。', action: '去策略工坊' },
  'no-positions':    { icon: '💼', title: '持仓为空', subtitle: '连接券商并下单后，持仓信息会实时更新。', action: '连接券商' },
  'no-creators':     { icon: '⭐', title: '暂无创作者', subtitle: '成为第一个创作者！发布你的交易策略并赚取USDT。', action: '成为创作者' },
  'no-results':      { icon: '🔍', title: '无搜索结果', subtitle: '试试调整搜索条件或筛选器。', action: '清除筛选' },
  'no-notifications':{ icon: '🔔', title: '暂无通知', subtitle: '当有信号提醒、交易更新或系统消息时，会在这里显示。', action: '查看设置' },
  'no-backtests':    { icon: '🔬', title: '暂无回测', subtitle: '创建策略后运行回测，结果会出现在这里。', action: '去策略工坊' },
};

export function EmptyState({ scenario, onAction, className = '' }: EmptyStateProps) {
  const cfg = EMPTY_CONFIG[scenario];
  return (
    <div className={`flex flex-col items-center justify-center py-16 px-4 text-center ${className}`}>
      <span style={{ fontSize: 48, marginBottom: 16, opacity: 0.6 }}>{cfg.icon}</span>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: '#cbd5e1', marginBottom: 8 }}>{cfg.title}</h3>
      <p style={{ fontSize: 13, color: '#64748b', maxWidth: 360, lineHeight: 1.6, marginBottom: 20 }}>
        {cfg.subtitle}
      </p>
      {onAction && (
        <button onClick={onAction}
          style={{ padding: '10px 24px', fontSize: 13, fontWeight: 700, background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer' }}>
          {cfg.action}
        </button>
      )}
    </div>
  );
}

// ── ErrorDisplay ────────────────────────────────────────────────────────

const ERROR_CONFIG: Record<ErrorScenario, { icon: string; title: string; defaultMessage: string; showRetry: boolean; showHelp: boolean }> = {
  'connection': { icon: '🔌', title: '连接失败', defaultMessage: '无法连接到交易服务器。请检查网络连接和OpenD状态。', showRetry: true, showHelp: true },
  'timeout':    { icon: '⏰', title: '请求超时', defaultMessage: '响应时间超过30秒。服务器可能繁忙，请稍后重试。', showRetry: true, showHelp: false },
  'auth':       { icon: '🔐', title: '认证失败', defaultMessage: '许可证已过期或无效。请重新登录或续费激活。', showRetry: true, showHelp: true },
  'permission': { icon: '🚫', title: '权限不足', defaultMessage: '当前账户没有访问此功能的权限。请升级账户或联系管理员。', showRetry: false, showHelp: true },
  'server':     { icon: '💥', title: '服务器错误', defaultMessage: '服务器遇到内部错误(500)。我们的团队正在处理。', showRetry: true, showHelp: false },
  'data-load':  { icon: '📭', title: '数据加载失败', defaultMessage: '无法加载市场数据。可能原因: 数据源超时、网络波动、非交易时段。', showRetry: true, showHelp: true },
};

export function ErrorDisplay({ scenario, message, onRetry, onHelp, className = '' }: ErrorDisplayProps) {
  const cfg = ERROR_CONFIG[scenario];
  return (
    <div className={`flex flex-col items-center justify-center py-16 px-4 text-center ${className}`}>
      <span style={{ fontSize: 48, marginBottom: 16 }}>{cfg.icon}</span>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: '#f87171', marginBottom: 8 }}>{cfg.title}</h3>
      <p style={{ fontSize: 13, color: '#94a3b8', maxWidth: 440, lineHeight: 1.7, marginBottom: 24 }}>
        {message ?? cfg.defaultMessage}
      </p>
      <div style={{ display: 'flex', gap: 10 }}>
        {cfg.showRetry && onRetry && (
          <button onClick={onRetry}
            style={{ padding: '10px 24px', fontSize: 13, fontWeight: 700, background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer' }}>
            🔄 重试 Retry
          </button>
        )}
        {cfg.showHelp && onHelp && (
          <button onClick={onHelp}
            style={{ padding: '10px 24px', fontSize: 13, fontWeight: 600, background: 'rgba(255,255,255,0.05)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, cursor: 'pointer' }}>
            📖 帮助 Help
          </button>
        )}
      </div>
    </div>
  );
}

// ── LoadingSpinner ──────────────────────────────────────────────────────

export function LoadingSpinner({ message, size = 'md', className = '' }: LoadingSpinnerProps) {
  const sizes = { sm: 24, md: 36, lg: 48 };
  const s = sizes[size];
  return (
    <div className={`flex flex-col items-center justify-center py-12 gap-4 ${className}`}>
      <div style={{
        width: s, height: s, borderRadius: '50%',
        border: '3px solid rgba(255,255,255,0.06)',
        borderTopColor: '#D4A853',
        animation: 'spin 0.8s linear infinite',
      }} />
      {message && <span style={{ fontSize: 13, color: '#64748b' }}>{message}</span>}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Badge: Friendly Status ──────────────────────────────────────────────

export function StatusBadge({ status, label }: { status: 'success' | 'warning' | 'error' | 'info'; label: string }) {
  const colors = {
    success: { bg: 'rgba(34,197,94,0.1)', color: '#4ade80', border: 'rgba(34,197,94,0.2)' },
    warning: { bg: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: 'rgba(251,191,36,0.2)' },
    error:   { bg: 'rgba(239,68,68,0.1)', color: '#f87171', border: 'rgba(239,68,68,0.2)' },
    info:    { bg: 'rgba(59,130,246,0.1)', color: '#60a5fa', border: 'rgba(59,130,246,0.2)' },
  };
  const c = colors[status];
  return (
    <span style={{ display: 'inline-flex', padding: '2px 10px', fontSize: 11, fontWeight: 600, borderRadius: 6, background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
      {label}
    </span>
  );
}
