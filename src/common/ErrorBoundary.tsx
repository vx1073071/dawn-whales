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
          {i18n.t('ErrorBoundary.r92_title')}
        </h1>
        <p style={{ fontSize: 14, color: '#9CA3AF', lineHeight: 1.7, marginBottom: 8 }}>
          {i18n.t('ErrorBoundary.r92_desc1')}<br />
          {i18n.t('ErrorBoundary.r92_desc2')}
        </p>

        {/* Error info */}
        <div style={{
          padding: '12px 16px', borderRadius: 10, background: '#EF44440A', border: '1px solid #EF444433',
          marginBottom: 24, textAlign: 'left',
        }}>
          <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>
            ⚠️ {now} · {i18n.t('ErrorBoundary.r92_detail')}
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
            🔄 {i18n.t('ErrorBoundary.r92_recover')}
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
          🛡️ {i18n.t('ErrorBoundary.r92_safe')} · {i18n.t('ErrorBoundary.r92_reported')}
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
        🧪 {i18n.t('ErrorBoundary.r92_demo_title')} — {i18n.t('ErrorBoundary.r92_demo_desc')}
      </div>
      <button
        onClick={() => setShouldCrash(true)}
        style={{
          padding: '12px 28px', borderRadius: 10, border: 'none', background: '#EF4444',
          color: '#FFF', fontSize: 15, fontWeight: 700, cursor: 'pointer',
        }}
      >
        💥 {i18n.t('ErrorBoundary.r92_simulate')}
      </button>
      <div style={{ marginTop: 8, fontSize: 11, color: '#6B7280' }}>
        {i18n.t('ErrorBoundary.r92_demo_hint')}
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
        🛡️ ErrorBoundary {i18n.t('ErrorBoundary.r92_protection')}
      </h2>
      <p style={{ margin: '0 0 20px', fontSize: 13, color: '#9CA3AF' }}>
        {i18n.t('ErrorBoundary.r92_features')}
      </p>

      <ErrorBoundary>
        <CrashDemo />
      </ErrorBoundary>

      <div style={{ marginTop: 20, padding: '14px 16px', borderRadius: 10, background: '#111827', border: '1px solid #1F2937', fontSize: 12, color: '#D1D5DB', lineHeight: 1.8 }}>
        <div style={{ fontWeight: 600, color: '#F9FAFB', marginBottom: 8 }}>{i18n.t('ErrorBoundary.r92_0')}</div>
        <div>{i18n.t('ErrorBoundary.r92_1')}</div>
        <div>{i18n.t('ErrorBoundary.r92_2')}</div>
        <div>{i18n.t('ErrorBoundary.r92_3')}</div>
        <div>{i18n.t('ErrorBoundary.r92_4')}</div>
        <div>{i18n.t('ErrorBoundary.r92_5')}</div>
        <div>✅ {i18n.t('ErrorBoundary.r92_dataProtect')}</div>
      </div>
    </div>
  );
}
