import { useState, type ReactNode, type CSSProperties } from 'react';
import { useTranslation } from "react-i18next";

// ── ML-79: UI 质量打磨 — 三态统一·私行风·a11y·触控 ──

// Shared polished constants
export const PRIVATE_BANKING = {
  colors: { bg: '#0A0A10', surface: '#1F2937', border: '#374151', gold: '#D4A853', accent: '#6366F1', text: '#F9FAFB', textSecondary: '#D1D5DB', textMuted: '#9CA3AF', success: '#10B981', warning: '#F59E0B', danger: '#EF4444' },
  grid: 8,
  radius: { sm: 6, md: 8, lg: 12, xl: 16 },
  font: { body: '-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif', mono: '"JetBrains Mono","Fira Code",monospace' },
  a11y: { touchMin: 44, focusOutline: '2px solid #818CF8', focusOffset: '2px' },
};

// ── Loading State ──
export function LoadingState({ label = t('components.loading'), fullPage }: { label?: string; fullPage?: boolean }) {
  const style: CSSProperties = fullPage
    ? { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', background: PRIVATE_BANKING.colors.bg }
    : { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', background: 'transparent' };

  return (
    <div style={style} role="status" aria-live="polite" aria-label={label}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 12, animation: 'spin 1s linear infinite' }}>⏳</div>
        <div style={{ fontSize: 14, color: PRIVATE_BANKING.colors.textMuted }}>{label}</div>
      </div>
    </div>
  );
}

// ── Empty State ──
export function EmptyState({ icon = '📭', title = t('components.noData'), description, action }: {
  icon?: string; title?: string; description?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px 24px' }}
      role="status" aria-live="polite"
    >
      <div style={{ textAlign: 'center', maxWidth: 320 }}>
        <div style={{ fontSize: 44, marginBottom: 12, opacity: 0.6 }}>{icon}</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: PRIVATE_BANKING.colors.textSecondary, marginBottom: 6 }}>{title}</div>
        {description && <div style={{ fontSize: 13, color: PRIVATE_BANKING.colors.textMuted, lineHeight: 1.6, marginBottom: 16 }}>{description}</div>}
        {action && (
          <button
            onClick={action.onClick}
            style={{
              padding: '10px 24px', borderRadius: PRIVATE_BANKING.radius.md, border: `1px solid ${PRIVATE_BANKING.colors.gold}`,
              background: 'transparent', color: PRIVATE_BANKING.colors.gold, fontSize: 14, fontWeight: 600,
              cursor: 'pointer', minWidth: PRIVATE_BANKING.a11y.touchMin, minHeight: PRIVATE_BANKING.a11y.touchMin,
            }}
            aria-label={action.label}
          >
            {action.label}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Error State ──
export function ErrorState({ error, onRetry }: { error?: string; onRetry?: () => void }) {
  const msg = error || '出错了，请稍后重试';
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px 24px' }}
      role="alert" aria-live="assertive"
    >
      <div style={{ textAlign: 'center', maxWidth: 380 }}>
        <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.7 }}>⚠️</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: PRIVATE_BANKING.colors.warning, marginBottom: 8 }}>出了点问题</div>
        <div style={{
          fontSize: 13, color: PRIVATE_BANKING.colors.textMuted, lineHeight: 1.6, marginBottom: 18,
          padding: '10px 14px', borderRadius: PRIVATE_BANKING.radius.md, background: PRIVATE_BANKING.colors.surface,
          border: `1px solid ${PRIVATE_BANKING.colors.border}`,
          wordBreak: 'break-all',
        }}>
          {msg}
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            style={{
              padding: '10px 28px', borderRadius: PRIVATE_BANKING.radius.md, border: 'none', background: PRIVATE_BANKING.colors.accent,
              color: '#FFF', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              minWidth: PRIVATE_BANKING.a11y.touchMin, minHeight: PRIVATE_BANKING.a11y.touchMin,
            }}
            aria-label={t("components.retry")}
          >
            🔄 重试
          </button>
        )}
        <div style={{ marginTop: 14, fontSize: 11, color: PRIVATE_BANKING.colors.textMuted }}>
          或 <span style={{ color: PRIVATE_BANKING.colors.accent, cursor: 'pointer', textDecoration: 'underline' }} tabIndex={0} role="button" aria-label="联系支持">联系支持</span>
        </div>
      </div>
    </div>
  );
}

// ── Offline Banner ──
export function OfflineBanner() {
  const { t } = useTranslation();

  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        padding: '10px 16px', background: `${PRIVATE_BANKING.colors.warning}14`, borderBottom: `1px solid ${PRIVATE_BANKING.colors.warning}33`,
        fontSize: 13, color: PRIVATE_BANKING.colors.warning,
      }}
      role="alert"
    >
      <span>🔌</span>
      <span>网络连接已断开 — 数据显示可能不是最新的</span>
      <button
        onClick={() => setDismissed(true)}
        style={{
          padding: '4px 10px', borderRadius: 4, border: `1px solid ${PRIVATE_BANKING.colors.warning}33`,
          background: 'transparent', color: PRIVATE_BANKING.colors.warning, cursor: 'pointer', fontSize: 11,
          minWidth: 36, minHeight: 36,
        }}
        aria-label="关闭离线提示"
      >
        ✕
      </button>
    </div>
  );
}

// ── Skip Link (a11y) ──
export function SkipLink({ targetId }: { targetId: string }) {
  return (
    <a
      href={`#${targetId}`}
      style={{
        position: 'absolute', top: 8, left: 8, padding: '8px 16px', zIndex: 9999,
        background: PRIVATE_BANKING.colors.accent, color: '#FFF', borderRadius: 8, fontWeight: 700, fontSize: 14,
        textDecoration: 'none', transform: 'translateY(-200%)', transition: 'transform 0.1s',
      }}
    >
      跳到主内容
    </a>
  );
}

// ── A11y Focus Ring utility ──
export const focusRing: CSSProperties = {
  outline: PRIVATE_BANKING.a11y.focusOutline,
  outlineOffset: 2,
};

// ── Touch-friendly button wrapper ──
export function TouchButton({ onClick, children, style, ...rest }: {
  onClick: () => void; children: ReactNode; style?: CSSProperties;
  [key: string]: any;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        minWidth: PRIVATE_BANKING.a11y.touchMin,
        minHeight: PRIVATE_BANKING.a11y.touchMin,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        padding: '8px 16px', borderRadius: PRIVATE_BANKING.radius.md,
        border: 'none', background: PRIVATE_BANKING.colors.accent, color: '#FFF',
        fontSize: 14, fontWeight: 600, cursor: 'pointer',
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

// ── Number abbreviation (monospace for alignment) ──
export function MonoNumber({ value, currency }: { value: number; currency?: string }) {
  const abs = Math.abs(value);
  let display: string;
  if (abs >= 1e8) display = (value / 1e8).toFixed(2) + '亿';
  else if (abs >= 1e6) display = (value / 1e6).toFixed(2) + 'M';
  else if (abs >= 1e4) display = (value / 1e4).toFixed(2) + '万';
  else display = value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  return (
    <span style={{ fontFamily: PRIVATE_BANKING.font.mono, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
      {currency || ''}{display}
    </span>
  );
}

// ── Dashboard Demo combining all ──
export default function UIPolishKit() {
  const [demo, setDemo] = useState<'loading' | 'empty' | 'error' | 'offline' | 'normal'>('normal');

  const theme: CSSProperties = {
    background: PRIVATE_BANKING.colors.bg, borderRadius: PRIVATE_BANKING.radius.xl, padding: 24,
    border: `1px solid ${PRIVATE_BANKING.colors.border}`, color: PRIVATE_BANKING.colors.text,
    maxWidth: 780, margin: '0 auto',
  };

  return (
    <div style={theme}>
      <SkipLink targetId="main-content" />

      <div id="main-content">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: PRIVATE_BANKING.colors.text }}>
              🎨 UI 质量打磨面板
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: PRIVATE_BANKING.colors.textMuted }}>
              三态统一·私行风·a11y·触控·离线恢复
            </p>
          </div>
        </div>

        {/* Demo controls */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { key: 'normal' as const, label: '正常' },
            { key: 'loading' as const, label: '⏳ 加载' },
            { key: 'empty' as const, label: '📭 空' },
            { key: 'error' as const, label: '⚠️ 错误' },
            { key: 'offline' as const, label: '🔌 离线' },
          ].map(d => (
            <button key={d.key} onClick={() => setDemo(d.key)} style={{
              padding: '6px 14px', borderRadius: PRIVATE_BANKING.radius.md, border: `1px solid ${demo === d.key ? PRIVATE_BANKING.colors.accent : PRIVATE_BANKING.colors.border}`,
              background: demo === d.key ? `${PRIVATE_BANKING.colors.accent}18` : PRIVATE_BANKING.colors.surface,
              color: demo === d.key ? PRIVATE_BANKING.colors.accent : PRIVATE_BANKING.colors.textSecondary,
              fontSize: 13, cursor: 'pointer', transition: 'all 0.15s',
              minWidth: PRIVATE_BANKING.a11y.touchMin, minHeight: PRIVATE_BANKING.a11y.touchMin,
            }}>
              {d.label}
            </button>
          ))}
        </div>

        {/* Render demo state */}
        <div style={{ padding: '20px', borderRadius: PRIVATE_BANKING.radius.lg, background: PRIVATE_BANKING.colors.surface, border: `1px solid ${PRIVATE_BANKING.colors.border}`, minHeight: 200 }}>
          {demo === 'offline' && <OfflineBanner />}

          {demo === 'loading' && <LoadingState label="正在加载信号回测数据..." />}

          {demo === 'empty' && (
            <EmptyState
              icon="📊"
              title="暂无回测记录"
              description="运行第一个策略回测后这里会显示结果"
              action={{ label: '创建策略', onClick: () => {} }}
            />
          )}

          {demo === 'error' && (
            <ErrorState
              error="TypeError: Cannot read properties of undefined (reading 'signals') — StrategyEngine.parse@line:234"
              onRetry={() => setDemo('normal')}
            />
          )}

          {demo === 'normal' && (
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: PRIVATE_BANKING.colors.text, marginBottom: 8 }}>✅ 正常运行</div>

              {/* Accessibility demo */}
              <div style={{ display: 'grid', gap: 10 }}>
                <div style={{ padding: '12px 16px', borderRadius: PRIVATE_BANKING.radius.md, background: PRIVATE_BANKING.colors.bg, border: `1px solid ${PRIVATE_BANKING.colors.border}` }}>
                  <div style={{ fontSize: 13, color: PRIVATE_BANKING.colors.textMuted, marginBottom: 6 }}>🎯 a11y: 屏幕阅读器友好 + 键盘导航</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button style={{ padding: '8px 16px', borderRadius: PRIVATE_BANKING.radius.md, background: PRIVATE_BANKING.colors.accent, color: '#FFF', border: 'none', cursor: 'pointer', minWidth: 44, minHeight: 44, fontSize: 14 }} aria-label="买入腾讯股份">{t("components.buy")}</button>
                    <button style={{ padding: '8px 16px', borderRadius: PRIVATE_BANKING.radius.md, background: PRIVATE_BANKING.colors.surface, color: PRIVATE_BANKING.colors.textSecondary, border: `1px solid ${PRIVATE_BANKING.colors.border}`, cursor: 'pointer', minWidth: 44, minHeight: 44, fontSize: 14 }} aria-label="卖出腾讯股份">{t("components.sell")}</button>
                    <span style={{ fontSize: 12, color: PRIVATE_BANKING.colors.textMuted, display: 'flex', alignItems: 'center' }}>← 44px 触控区</span>
                  </div>
                </div>

                <div style={{ padding: '12px 16px', borderRadius: PRIVATE_BANKING.radius.md, background: PRIVATE_BANKING.colors.bg, border: `1px solid ${PRIVATE_BANKING.colors.border}` }}>
                  <div style={{ fontSize: 13, color: PRIVATE_BANKING.colors.textMuted, marginBottom: 6 }}>💎 私行风: 等宽数字 + 缩写</div>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <MonoNumber value={1234567.89} currency="HK$ " />
                    <MonoNumber value={876543210} />
                    <MonoNumber value={-45678} currency="USDT " />
                  </div>
                </div>

                <div style={{ padding: '12px 16px', borderRadius: PRIVATE_BANKING.radius.md, background: PRIVATE_BANKING.colors.bg, border: `1px solid ${PRIVATE_BANKING.colors.border}` }}>
                  <div style={{ fontSize: 13, color: PRIVATE_BANKING.colors.textMuted, marginBottom: 6 }}>🌟 私行配色预览</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {Object.entries(PRIVATE_BANKING.colors).slice(0, 8).map(([k, v]) => (
                      <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 20, height: 20, borderRadius: 4, background: v, border: '1px solid #374151' }} />
                        <span style={{ fontSize: 10, color: PRIVATE_BANKING.colors.textMuted }}>{k}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
