import React, { Component, ReactNode } from 'react';
import i18next from 'i18next';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    const t = (key: string) => i18next.t(key, { ns: 'common' });
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[300px] p-6">
          <div className="text-4xl mb-3">⚠️</div>
          <h3 className="text-lg font-semibold text-white mb-2">{t('errorBoundary.title')}</h3>
          <p className="text-sm text-gray-400 mb-4 text-center max-w-md">
            {this.state.error?.message || t('unknownError')}
          </p>
          <button
            onClick={this.handleReset}
            className="px-4 py-2 bg-[#C9A046] hover:bg-[#D4A853] text-black text-sm font-medium rounded-lg transition-colors"
          >
            {t('errorBoundary.retry')}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
