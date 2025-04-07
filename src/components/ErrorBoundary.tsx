import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { showToast } from '@/utils/toast-utils';
import { logSignalProcessing, LogLevel } from '@/utils/signalLogging';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetOnPropsChange?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorCount: number;
}

/**
 * Error Boundary component to catch and handle rendering errors
 * Prevents the entire application from crashing due to component errors
 */
class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    errorCount: 0
  };
  
  private lastError: number = 0;
  private mountTime: number = Date.now();

  public static getDerivedStateFromError(error: Error): Pick<State, 'hasError'> {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState(prevState => ({
      error,
      errorInfo,
      errorCount: prevState.errorCount + 1
    }));
    
    // Log error
    logSignalProcessing(
      LogLevel.ERROR,
      'ErrorBoundary',
      `React component error: ${error.message}`,
      {
        componentStack: errorInfo.componentStack,
        error: error.toString(),
        errorCount: this.state.errorCount + 1
      }
    );
    
    // Call onError prop if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
    
    // Limit error toasts to once per 30 seconds and only for critical errors
    const now = Date.now();
    if (now - this.lastError > 30000) {
      showToast(
        'Error Crítico', 
        error.message.substring(0, 100) + (error.message.length > 100 ? '...' : ''), 
        'error',
        { important: true }
      );
      this.lastError = now;
    }
  }

  public componentDidUpdate(prevProps: Props): void {
    // Reset error state when props change, if enabled
    if (
      this.state.hasError &&
      this.props.resetOnPropsChange &&
      prevProps !== this.props
    ) {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null
      });
    }
  }

  private handleReset = (): void => {
    // Reset error state
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
    
    // Log recovery attempt
    logSignalProcessing(
      LogLevel.INFO,
      'ErrorBoundary',
      'User initiated error recovery',
      { errorCount: this.state.errorCount }
    );
  };

  public render(): ReactNode {
    const { hasError, error, errorInfo, errorCount } = this.state;
    const { children, fallback } = this.props;
    
    // Custom recovery UI for production
    if (hasError) {
      // If a custom fallback is provided, use it
      if (fallback) {
        return fallback;
      }

      // Render error UI with recovery option
      return (
        <div className="p-4 flex flex-col items-center justify-center min-h-[200px]">
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription className="mt-2">
              {error?.message || 'An unexpected error occurred'}
            </AlertDescription>
          </Alert>
          
          {errorCount > 3 && (
            <div className="text-center text-red-600 mb-4 text-sm">
              Multiple errors detected. Consider reloading the page.
            </div>
          )}
          
          <div className="flex gap-2">
            <Button 
              onClick={this.handleReset} 
              variant="outline" 
              size="sm"
              className="flex items-center gap-1"
            >
              <RefreshCw className="h-4 w-4" /> Try Again
            </Button>
            
            <Button
              onClick={() => window.location.reload()}
              variant="default"
              size="sm"
            >
              Reload Page
            </Button>
          </div>
          
          {process.env.NODE_ENV === 'development' && errorInfo && (
            <details className="mt-4 p-2 border border-gray-300 rounded bg-slate-50 w-full overflow-auto max-h-[300px]">
              <summary className="font-medium cursor-pointer">Error Details</summary>
              <pre className="mt-2 text-xs whitespace-pre-wrap">
                {error?.stack || error?.toString()}
              </pre>
              <pre className="mt-2 text-xs whitespace-pre-wrap text-slate-600">
                {errorInfo.componentStack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    // Render children when no error
    return children;
  }
}

export default ErrorBoundary;
