import { ChevronDown, ChevronUp, Loader2, TriangleAlert } from 'lucide-react';
import { Component, useState, type ReactNode } from 'react';

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error?: Error;
  retrying: boolean;
};

function ErrorDisplay({
  error,
  onRetry,
}: {
  error?: Error;
  onRetry: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const showDetails = import.meta.env.DEV && !!error?.stack;

  return (
    <div className="flex h-[calc(100vh-60px)] items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <TriangleAlert className="size-5" />
            <span className="font-semibold">Something went wrong</span>
          </div>
          {error?.message && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">
              {error.message}
            </p>
          )}
          {showDetails && (
            <div className="mt-3">
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
              >
                {expanded ? (
                  <ChevronUp className="size-3" />
                ) : (
                  <ChevronDown className="size-3" />
                )}
                {expanded ? 'Hide' : 'Show'} details
              </button>
              {expanded && (
                <pre className="mt-2 max-h-48 overflow-auto rounded bg-red-100 p-2 text-xs text-red-700 dark:bg-red-900 dark:text-red-200">
                  {error.stack}
                </pre>
              )}
            </div>
          )}
        </div>
        <div className="mt-4 text-center">
          <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">
            Please try again or refresh the page.
          </p>
          <button
            onClick={onRetry}
            className="rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Retry
          </button>
        </div>
      </div>
    </div>
  );
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, retrying: false };
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error, retrying: false };
  }

  componentDidCatch(error: Error) {
    // Keep a minimal log hook for now; swap with Sentry/etc. if needed.
    console.error('Route error boundary caught:', error);
  }

  componentWillUnmount() {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
    }
  }

  handleRetry = () => {
    this.setState({ retrying: true });
    this.retryTimer = setTimeout(() => {
      this.setState({ hasError: false, error: undefined, retrying: false });
    }, 300);
  };

  render() {
    if (this.state.retrying) {
      return (
        <div className="flex h-[calc(100vh-60px)] items-center justify-center">
          <Loader2 className="size-6 animate-spin" />
        </div>
      );
    }

    if (this.state.hasError) {
      return (
        <ErrorDisplay error={this.state.error} onRetry={this.handleRetry} />
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
