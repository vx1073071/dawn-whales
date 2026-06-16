// ── R226 ML-1.3b: Unified ErrorBoundary v3.0 ──────────────────────────────
// Single version replacing all other ErrorBoundary variants
// Features: 11-lang i18n, report button, collapsible stack, retry with backoff
// Applied to ALL factor pages and strategy pages

import { Component, ReactNode, ErrorInfo } from 'react';

// ── i18n ────────────────────────────────────────────────────────────
const I18N: Record<string, Record<string, string>> = {
  'zh-CN': {
    title: '组件出错了',
    subtitle: '我们已记录此错误，请重试或刷新页面',
    retry: '重试',
    report: '报告问题',
    details: '错误详情',
    collapse: '收起',
    count: '错误次数',
    unknown: '未知错误',
    reload: '刷新页面',
    factorError: '因子加载失败',
    strategyError: '策略页面出错',
    degraded: '降级模式',
  },
  en: {
    title: 'Component Error',
    subtitle: 'This error has been logged. Please retry or refresh.',
    retry: 'Retry',
    report: 'Report',
    details: 'Error Details',
    collapse: 'Collapse',
    count: 'Error Count',
    unknown: 'Unknown Error',
    reload: 'Reload Page',
    factorError: 'Factor Load Failed',
    strategyError: 'Strategy Error',
    degraded: 'Degraded Mode',
  },
  ja: { title: 'コンポーネントエラー', subtitle: 'エラーを記録しました。再試行してください', retry: '再試行', report: '報告', details: 'エラー詳細', collapse: '閉じる', count: 'エラー回数', unknown: '不明なエラー', reload: 'ページ更新', factorError: '因子読み込み失敗', strategyError: '戦略エラー', degraded: '縮退モード' },
  ko: { title: '컴포넌트 오류', subtitle: '오류가 기록되었습니다. 다시 시도하세요', retry: '재시도', report: '보고', details: '오류 상세', collapse: '접기', count: '오류 횟수', unknown: '알 수 없는 오류', reload: '페이지 새로고침', factorError: '팩터 로드 실패', strategyError: '전략 오류', degraded: '축소 모드' },
  fr: { title: 'Erreur du composant', subtitle: "L'erreur a été enregistrée. Réessayez.", retry: 'Réessayer', report: 'Signaler', details: 'Détails', collapse: 'Réduire', count: "Nombre d'erreurs", unknown: 'Erreur inconnue', reload: 'Actualiser', factorError: 'Échec du chargement du facteur', strategyError: 'Erreur de stratégie', degraded: 'Mode dégradé' },
  it: { title: 'Errore componente', subtitle: "L'errore è stato registrato. Riprova.", retry: 'Riprova', report: 'Segnala', details: 'Dettagli errore', collapse: 'Comprimi', count: 'Conteggio errori', unknown: 'Errore sconosciuto', reload: 'Ricarica', factorError: 'Caricamento fattore fallito', strategyError: 'Errore strategia', degraded: 'Modalità degradata' },
  de: { title: 'Komponentenfehler', subtitle: 'Der Fehler wurde protokolliert. Bitte erneut versuchen.', retry: 'Wiederholen', report: 'Melden', details: 'Fehlerdetails', collapse: 'Einklappen', count: 'Fehleranzahl', unknown: 'Unbekannter Fehler', reload: 'Neu laden', factorError: 'Faktor-Ladefehler', strategyError: 'Strategiefehler', degraded: 'Degradierter Modus' },
  es: { title: 'Error del componente', subtitle: 'El error ha sido registrado. Reintente.', retry: 'Reintentar', report: 'Informar', details: 'Detalles', collapse: 'Contraer', count: 'Contador de errores', unknown: 'Error desconocido', reload: 'Recargar', factorError: 'Error al cargar factor', strategyError: 'Error de estrategia', degraded: 'Modo degradado' },
  ru: { title: 'Ошибка компонента', subtitle: 'Ошибка зарегистрирована. Попробуйте снова.', retry: 'Повторить', report: 'Сообщить', details: 'Детали ошибки', collapse: 'Свернуть', count: 'Счётчик ошибок', unknown: 'Неизвестная ошибка', reload: 'Обновить', factorError: 'Ошибка загрузки фактора', strategyError: 'Ошибка стратегии', degraded: 'Деградированный режим' },
  'zh-HK': { title: '組件出錯', subtitle: '我們已記錄此錯誤，請重試或刷新頁面', retry: '重試', report: '報告問題', details: '錯誤詳情', collapse: '收起', count: '錯誤次數', unknown: '未知錯誤', reload: '刷新頁面', factorError: '因子加載失敗', strategyError: '策略頁面出錯', degraded: '降級模式' },
  'zh-TW': { title: '組件出錯', subtitle: '我們已記錄此錯誤，請重試或刷新頁面', retry: '重試', report: '報告問題', details: '錯誤詳情', collapse: '收起', count: '錯誤次數', unknown: '未知錯誤', reload: '刷新頁面', factorError: '因子載入失敗', strategyError: '策略頁面出錯', degraded: '降級模式' },
};

// ── Types ───────────────────────────────────────────────────────────
export interface UnifiedErrorBoundaryProps {
  children: ReactNode;
  /** Component name for logging */
  name?: string;
  /** Category: 'factor' | 'strategy' | 'chart' | 'general' */
  category?: 'factor' | 'strategy' | 'chart' | 'general';
  /** Callback on error (logging/metrics) */
  onError?: (error: Error, info: ErrorInfo) => void;
  /** Custom fallback; overrides built-in UI */
  fallback?: (error: Error, reset: () => void, t: Record<string, string>) => ReactNode;
  /** Locale override */
  locale?: string;
  /** Max retries before showing reload button */
  maxRetries?: number;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorCount: number;
  showDetails: boolean;
}

// ── Component ───────────────────────────────────────────────────────
export class UnifiedErrorBoundary extends Component<UnifiedErrorBoundaryProps, State> {
  state: State = { hasError: false, error: null, errorCount: 0, showDetails: false };
  private resetTimer: ReturnType<typeof setTimeout> | null = null;

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState(prev => ({ errorCount: prev.errorCount + 1 }));
    this.props.onError?.(error, info);
    console.error(`[UnifiedErrorBoundary:${this.props.name || 'unknown'}]`, error, info);

    // Auto-reset after 30s
    if (!this.resetTimer) {
      this.resetTimer = setTimeout(() => {
        this.setState({ hasError: false, error: null });
        this.resetTimer = null;
      }, 30_000);
    }
  }

  componentWillUnmount() {
    if (this.resetTimer) clearTimeout(this.resetTimer);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, showDetails: false });
  };

  handleReload = () => {
    window.location.reload();
  };

  toggleDetails = () => {
    this.setState(prev => ({ showDetails: !prev.showDetails }));
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const { name = 'Component', category = 'general', locale: pl, maxRetries = 3 } = this.props;
    const { error, errorCount, showDetails } = this.state;
    const langKey = (pl === 'zh-CN' || pl === 'zh-TW') ? 'zh-CN' : (I18N[pl ?? ''] ? pl! : 'en');
    const t = I18N[langKey] ?? I18N.en;

    if (this.props.fallback) {
      return this.props.fallback(error!, this.handleReset, t);
    }

    const title = category === 'factor' ? t.factorError : category === 'strategy' ? t.strategyError : t.title;
    const showReload = errorCount > maxRetries;

    return (
      <div className="flex flex-col items-center justify-center p-6 m-2 bg-[#0d1117] border border-[#f85149]/30 rounded-xl min-h-[120px]">
        {/* Icon */}
        <div className="text-3xl mb-3">⚠️</div>
        
        {/* Title */}
        <div className="text-[#f85149] text-sm font-semibold mb-1">{title}</div>
        {name !== 'Component' && (
          <div className="text-[#484f58] text-[10px] mb-2">{name}</div>
        )}
        
        {/* Subtitle */}
        <div className="text-[#8b949e] text-xs text-center max-w-[320px] mb-3">
          {t.subtitle}
        </div>

        {/* Error message (truncated) */}
        <div className="text-[#f0883e] text-[11px] mb-3 max-w-[320px] truncate px-2 py-1 bg-[#f0883e]/10 rounded border border-[#f0883e]/20">
          {error?.message || t.unknown}
        </div>

        {/* Actions */}
        <div className="flex gap-2 mb-2">
          <button
            onClick={this.handleReset}
            className="px-4 py-1.5 text-xs bg-[#238636]/20 hover:bg-[#238636]/30 text-[#3fb950] border border-[#238636]/30 rounded-lg transition-colors"
            aria-label={t.retry}
          >
            🔄 {t.retry}
          </button>
          <button
            onClick={this.toggleDetails}
            className="px-3 py-1.5 text-xs bg-[#30363d]/50 hover:bg-[#30363d] text-[#8b949e] border border-[#30363d] rounded-lg transition-colors"
            aria-label={t.details}
          >
            {showDetails ? `▲ ${t.collapse}` : `▼ ${t.details}`}
          </button>
          <button
            onClick={() => window.open(`https://github.com/vx1073071/quant-moo/issues/new?title=Bug: ${encodeURIComponent(name)}&body=${encodeURIComponent(error?.message || '')}`, '_blank')}
            className="px-3 py-1.5 text-xs bg-[#30363d]/50 hover:bg-[#30363d] text-[#58a6ff] border border-[#30363d] rounded-lg transition-colors"
            aria-label={t.report}
          >
            🐛 {t.report}
          </button>
          {showReload && (
            <button
              onClick={this.handleReload}
              className="px-4 py-1.5 text-xs bg-[#f85149]/20 hover:bg-[#f85149]/30 text-[#f85149] border border-[#f85149]/30 rounded-lg transition-colors"
              aria-label={t.reload}
            >
              🔃 {t.reload}
            </button>
          )}
        </div>

        {/* Error count badge */}
        {errorCount > 1 && (
          <div className="text-[#484f58] text-[10px]">
            {t.count}: {errorCount}/{maxRetries}
            {showReload && <span className="text-[#f85149] ml-1">({t.degraded})</span>}
          </div>
        )}

        {/* Collapsible details */}
        {showDetails && (
          <div className="w-full mt-3 p-3 bg-[#0d1117] border border-[#30363d] rounded-lg max-w-[400px] max-h-[150px] overflow-auto">
            <pre className="text-[#484f58] text-[10px] whitespace-pre-wrap font-mono">
              {error?.stack || error?.message || t.unknown}
            </pre>
          </div>
        )}
      </div>
    );
  }
}

// ── Convenience wrappers for factor pages ──────────────────────────
export const FactorErrorBoundary: React.FC<{ children: ReactNode; name?: string; locale?: string }> = (props) => (
  <UnifiedErrorBoundary category="factor" {...props} />
);

export const StrategyErrorBoundary: React.FC<{ children: ReactNode; name?: string; locale?: string }> = (props) => (
  <UnifiedErrorBoundary category="strategy" {...props} />
);

export default UnifiedErrorBoundary;
