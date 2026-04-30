import React, { ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { errorLogger, ErrorSeverity } from '../lib/errorLogger';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });
    
    errorLogger.logError(
      error.message,
      ErrorSeverity.CRITICAL,
      { componentStack: errorInfo.componentStack },
      error.stack
    );
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4 font-sans text-white">
          <div className="bg-neutral-900 border border-red-500/50 rounded-xl p-8 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="w-8 h-8 text-red-500" />
              <h1 className="text-2xl font-bold text-red-100">حدث خطأ غير متوقع!</h1>
            </div>
            
            <p className="text-gray-400 mb-6 text-sm">
              عذراً، واجه النظام مشكلة أثناء المعالجة. يرجى محاولة إعادة تحميل التطبيق.
            </p>

            {this.state.error && (
              <details className="mb-6 bg-black/50 p-3 rounded-lg border border-red-900/30 overflow-hidden">
                <summary className="cursor-pointer text-red-400 text-xs font-semibold uppercase tracking-wider outline-none">
                  تفاصيل الخطأ التقنية
                </summary>
                <pre className="mt-3 text-[10px] text-gray-500 overflow-auto max-h-32 font-mono scrollbar-thin">
                  {this.state.error.toString()}
                  {'\n'}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

            <div className="flex gap-3">
              <button
                onClick={this.handleReset}
                className="flex-1 bg-red-600/20 hover:bg-red-600/30 text-red-400 font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors border border-red-500/20 text-sm"
              >
                <RefreshCw className="w-4 h-4" />
                إعادة المحاولة
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-2.5 px-4 rounded-lg transition-colors border border-white/10 text-sm"
              >
                الرئيسية
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
