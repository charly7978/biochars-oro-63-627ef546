
/**
 * Hook to access the diagnostics system from React components
 */
import { useState, useEffect, useCallback } from 'react';
import { SignalDiagnosticInfo } from '../types/signal';
import { 
  SignalProcessingDiagnostics, 
  DiagnosticsSubscriber 
} from '../modules/signal-processing/diagnostics';

export interface DiagnosticsState {
  history: SignalDiagnosticInfo[];
  enabled: boolean;
  performanceMetrics: Record<string, { 
    avg: number, 
    min: number, 
    max: number,
    current: number 
  }>;
  errorCount: number;
  lastError?: {
    code?: string;
    message?: string;
    timestamp: number;
  };
}

export function useDiagnostics() {
  const [state, setState] = useState<DiagnosticsState>({
    history: [],
    enabled: true,
    performanceMetrics: {},
    errorCount: 0
  });

  const diagnostics = SignalProcessingDiagnostics.getInstance();

  // Update state when new diagnostic info is received
  useEffect(() => {
    const subscriber: DiagnosticsSubscriber = {
      onDiagnosticUpdate: (info: SignalDiagnosticInfo) => {
        setState(prev => {
          // Check if this is an error
          const isError = !info.validationPassed;
          
          return {
            ...prev,
            history: [...prev.history.slice(-99), info], // Keep last 100 items
            errorCount: isError ? prev.errorCount + 1 : prev.errorCount,
            lastError: isError ? {
              code: info.errorCode,
              message: info.errorMessage,
              timestamp: Date.now()
            } : prev.lastError,
            performanceMetrics: diagnostics.getPerformanceMetrics()
          };
        });
      }
    };

    // Subscribe to diagnostics updates
    diagnostics.subscribe(subscriber);

    // Initial state
    setState({
      history: diagnostics.getDiagnosticHistory().slice(-100),
      enabled: true,
      performanceMetrics: diagnostics.getPerformanceMetrics(),
      errorCount: 0
    });

    // Cleanup
    return () => {
      diagnostics.unsubscribe(subscriber);
    };
  }, []);

  // Toggle diagnostics
  const toggleDiagnostics = useCallback((enabled: boolean) => {
    diagnostics.setEnabled(enabled);
    setState(prev => ({ ...prev, enabled }));
  }, []);

  // Clear diagnostic data
  const clearDiagnostics = useCallback(() => {
    diagnostics.clearDiagnosticData();
    setState({
      history: [],
      enabled: state.enabled,
      performanceMetrics: {},
      errorCount: 0
    });
  }, [state.enabled]);

  // Get diagnostics for a specific stage
  const getStageData = useCallback((stage: string) => {
    return diagnostics.getStageHistory(stage);
  }, []);

  return {
    ...state,
    toggleDiagnostics,
    clearDiagnostics,
    getStageData
  };
}

