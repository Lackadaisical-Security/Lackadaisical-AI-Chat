import React, { Component, ErrorInfo } from 'react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Enterprise-grade React Error Boundary.
 * Catches rendering errors in child components and displays a recovery UI.
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    // Log to console (in production, send to error reporting service)
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex items-center justify-center min-h-[400px] p-8">
          <div className="max-w-lg w-full bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-8 shadow-lg text-center">
            <div className="text-5xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-[var(--color-text)] mb-2">
              Something went wrong
            </h2>
            <p className="text-sm text-[var(--color-textMuted)] mb-4">
              An unexpected error occurred in this component. You can try recovering or refreshing the page.
            </p>
            {this.state.error && (
              <details className="text-left mb-4 p-3 bg-[var(--color-backgroundSecondary)] rounded-lg text-xs">
                <summary className="cursor-pointer text-[var(--color-textSecondary)] font-medium">
                  Error details
                </summary>
                <pre className="mt-2 overflow-auto text-[var(--color-danger)] whitespace-pre-wrap">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:opacity-90 transition-opacity text-sm font-medium"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-[var(--color-backgroundSecondary)] text-[var(--color-text)] rounded-lg hover:opacity-90 transition-opacity text-sm font-medium border border-[var(--color-border)]"
              >
                Refresh Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
