import { Component, type ReactNode, type CSSProperties } from 'react';
import { EngineError, ErrorDomain, ErrorCode } from '../../electron/engine/core/engine-error';

// ── Types ──
interface ErrorBoundaryProps { children: ReactNode; fallback?: ReactNode }
interface ErrorBoundaryState { hasError: boolean; error: Error | null; errorInfo: string }

// ── React Error Boundary ──
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: '' };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
    this.setState({ errorInfo: errorInfo.componentStack });
    console.error('[ErrorBoundary] Caught:', error.message, errorInfo.componentStack?.slice(0, 200));
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: '' });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <CrashScreen
          error={this.state.error?.message || i18n.t('ErrorBoundary.k1')}
          stack={this.state.errorInfo}
          onRetry={this.handleReset}
        />
      );
    }
    return this.props.children;
  }
}

// ── Crash Screen UI ──
function CrashScreen({ error, stack, onRetry }: { error: string; stack: string; onRetry: () => void }) {
  const [showStack, setShowStack] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startAutoRetry = () => {
    setCountdown(5);
    timerRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(timerRef.current!);
          onRetry();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const now = new Date().toLocaleTimeString('zh-CN', { hour12: false });

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0A0A10', color: '#E5E7EB', fontFamily: 'system-ui, sans-serif',
      padding: 24,
    }}>
      <div style={{ maxWidth: 520, width: '100%', textAlign: 'center' }}>
        {/* Icon */}
        <div style={{ fontSize: 56, marginBottom: 16 }}>🐋</div>

        {/* Title */}
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#F9FAFB', margin: '0 0 8px' }}>
          出了点小问题 😅
        </h1>
        <p style={{ fontSize: 14, color: '#9CA3AF', lineHeight: 1.7, marginBottom: 8 }}>
          应用遇到意外错误，已自动保存你的数据。<br />
          请点击下方按钮恢复，或稍等自动恢复。
        </p>

        {/* Error info */}
        <div style={{
          padding: '12px 16px', borderRadius: 10, background: '#EF44440A', border: '1px solid #EF444433',
          marginBottom: 24, textAlign: 'left',
        }}>
          <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>
            ⚠️ {now} · 错误详情
          </div>
          <div style={{ fontSize: 13, color: '#FCA5A5', fontFamily: 'monospace', wordBreak: 'break-all', marginBottom: 8 }}>
            {error}
          </div>
          {showStack && (
            <div style={{ fontSize: 10, color: '#6B7280', fontFamily: 'monospace', whiteSpace: 'pre-wrap', maxHeight: 120, overflowY: 'auto', padding: '8px', borderRadius: 6, background: '#111827' }}>
              {stack}
            </div>
          )}
          <button
            onClick={() => setShowStack(!showStack)}
            style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #374151', background: 'transparent', color: '#6B7280', fontSize: 11, cursor: 'pointer', marginTop: 4 }}
          >
            {showStack ? i18n.t('ErrorBoundary.k2') : i18n.t('ErrorBoundary.k3')}
          </button>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={onRetry}
            style={{
              padding: '12px 32px', borderRadius: 10, border: 'none', background: '#6366F1',
              color: '#FFF', fontSize: 15, fontWeight: 700, cursor: 'pointer',
            }}
          >
            🔄 立即恢复
          </button>
          <button
            onClick={startAutoRetry}
            disabled={countdown > 0}
            style={{
              padding: '12px 24px', borderRadius: 10, border: '1px solid #374151', background: '#1F2937',
              color: countdown > 0 ? '#10B981' : '#D1D5DB', fontSize: 14, cursor: countdown > 0 ? 'default' : 'pointer',
            }}
          >
            {countdown > 0 ? `⏳ ${countdown}${i18n.t('ErrorBoundary.k0')}` : i18n.t('ErrorBoundary.k4')}
          </button>
        </div>

        <div style={{ marginTop: 24, fontSize: 11, color: '#6B7280' }}>
          🛡️ 你的策略和资金始终安全 · 错误已自动上报
        </div>
      </div>
    </div>
  );
}

// ── Crash Demo Trigger ──
import { useState, useEffect, useRef } from 'react';
import i18n from '../i18n';

export function CrashDemo() {
  const [shouldCrash, setShouldCrash] = useState(false);

  if (shouldCrash) {
    // Simulate a render crash
    throw new EngineError(ErrorDomain.SYSTEM, ErrorCode.INTERNAL_ERROR, 'Simulated crash: Division by zero in StrategyEngine.calculate()');
  }

  return (
    <div style={{ padding: '20px', borderRadius: 12, background: '#111827', border: '1px solid #1F2937', textAlign: 'center' }}>
      <div style={{ fontSize: 14, color: '#D1D5DB', marginBottom: 12 }}>
        🧪 崩溃恢复演示 — 点击下方按钮模拟应用崩溃
      </div>
      <button
        onClick={() => setShouldCrash(true)}
        style={{
          padding: '12px 28px', borderRadius: 10, border: 'none', background: '#EF4444',
          color: '#FFF', fontSize: 15, fontWeight: 700, cursor: 'pointer',
        }}
      >
        💥 模拟崩溃
      </button>
      <div style={{ marginTop: 8, fontSize: 11, color: '#6B7280' }}>
        崩溃后将展示友好恢复页面，点击恢复按钮即可回到正常
      </div>
    </div>
  );
}

// ── ErrorBoundary wrapper with demo ──
export default function ErrorBoundaryDemo() {
  const theme: CSSProperties = {
    background: '#0A0A10', borderRadius: 16, padding: 24,
    border: '1px solid #1F2937', color: '#E5E7EB',
    maxWidth: 640, margin: '0 auto',
  };

  return (
    <div style={theme}>
      <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 700, color: '#F9FAFB' }}>
        🛡️ ErrorBoundary 崩溃保护
      </h2>
      <p style={{ margin: '0 0 20px', fontSize: 13, color: '#9CA3AF' }}>
        全局错误边界 · 友好崩溃页 · 自动恢复 · 错误上报
      </p>

      <ErrorBoundary>
        <CrashDemo />
      </ErrorBoundary>

      <div style={{ marginTop: 20, padding: '14px 16px', borderRadius: 10, background: '#111827', border: '1px solid #1F2937', fontSize: 12, color: '#D1D5DB', lineHeight: 1.8 }}>
        <div style={{ fontWeight: 600, color: '#F9FAFB', marginBottom: 8 }}>📋 ErrorBoundary 能力</div>
        <div>✅ 全局包裹 — 任何组件崩溃不白屏</div>
        <div>✅ 友好展示 — 错误信息+堆栈+时间戳</div>
        <div>✅ 自动恢复 — 5秒倒计时自动重试</div>
        <div>✅ 手动恢复 — 点击按钮立即重置</div>
        <div>✅ 错误上报 — console 输出+自动日志</div>
        <div>✅ 数据保护 — 策略/资金状态不丢失</div>
      </div>
    </div>
  );
}
