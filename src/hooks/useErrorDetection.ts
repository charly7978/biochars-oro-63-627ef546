
import { useState, useCallback, useEffect } from 'react';

export interface ErrorState {
  hasErrors: boolean;
  errorType: string | null;
  lastErrorTime: number | null;
  recoveryAttempts: number;
  errorMessages: string[];
}

export const useErrorDetection = () => {
  const [errorState, setErrorState] = useState<ErrorState>({
    hasErrors: false,
    errorType: null,
    lastErrorTime: null,
    recoveryAttempts: 0,
    errorMessages: []
  });

  // Check for system issues
  const checkForIssues = useCallback(() => {
    // Get browser memory usage if available
    let memoryUsage = 0;
    if ((performance as any).memory) {
      memoryUsage = ((performance as any).memory.usedJSHeapSize / (performance as any).memory.jsHeapSizeLimit) * 100;
    }
    
    // Check for common issue indicators
    const slowResponsiveness = document.body ? document.body.getAttribute('data-slow') === 'true' : false;
    const hasHighCPU = memoryUsage > 80;
    const hasNetworkIssues = !navigator.onLine;
    
    const hasIssues = slowResponsiveness || hasHighCPU || hasNetworkIssues || errorState.hasErrors;
    const criticalIssues = hasNetworkIssues || (memoryUsage > 90) || errorState.recoveryAttempts > 3;
    
    // Formulate message based on detected issues
    let message = 'System issues detected';
    if (slowResponsiveness) message = 'System responding slowly';
    if (hasHighCPU) message = 'High resource usage detected';
    if (hasNetworkIssues) message = 'Network connection issues detected';
    if (errorState.hasErrors) message = 'Error recovery in progress';
    
    return {
      hasIssues,
      criticalIssues,
      message
    };
  }, [errorState.hasErrors, errorState.recoveryAttempts]);

  // Update error status
  const updateStatus = useCallback(() => {
    setErrorState(prev => ({
      ...prev,
      hasErrors: false,
      errorType: null
    }));
  }, []);

  // Attempt recovery
  const attemptRecovery = useCallback(async () => {
    try {
      // Increment recovery counter
      setErrorState(prev => ({
        ...prev,
        recoveryAttempts: prev.recoveryAttempts + 1
      }));
      
      // Clear caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(name => caches.delete(name))
        );
      }
      
      // Clear memory
      if (window.gc) {
        window.gc();
      }
      
      // Refresh all data stores
      localStorage.removeItem('error_state');
      
      // Check if camera is in use and reset
      if (navigator.mediaDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        
        if (videoDevices.length > 0) {
          const streams = await navigator.mediaDevices.getUserMedia({ video: true });
          streams.getTracks().forEach(track => track.stop());
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error during recovery:', error);
      
      // Update error state
      setErrorState(prev => ({
        ...prev,
        hasErrors: true,
        errorType: 'recovery_failed',
        lastErrorTime: Date.now(),
        errorMessages: [...prev.errorMessages, 'Recovery attempt failed']
      }));
      
      return false;
    }
  }, []);

  // Listen for errors
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      setErrorState(prev => ({
        ...prev,
        hasErrors: true,
        errorType: 'uncaught_error',
        lastErrorTime: Date.now(),
        errorMessages: [...prev.errorMessages, event.message].slice(-5)
      }));
    };
    
    window.addEventListener('error', handleError);
    
    return () => {
      window.removeEventListener('error', handleError);
    };
  }, []);

  return {
    errorState,
    attemptRecovery,
    checkForIssues,
    updateStatus
  };
};
