
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { 
  getErrorDetectionStatus,
  logError,
  logSuccess,
  resetErrorMetrics 
} from '../utils/errorDetection';
import { disposeTensors } from '../utils/tfModelInitializer';

export const useErrorDetection = () => {
  const [isActive, setIsActive] = useState(false);
  const [errorStats, setErrorStats] = useState({ count: 0, lastTime: 0 });
  
  useEffect(() => {
    if (!isActive) return;
    
    const updateInterval = setInterval(() => {
      const status = getErrorDetectionStatus();
      setErrorStats({
        count: status.count,
        lastTime: status.lastTime
      });
    }, 5000);
    
    return () => {
      clearInterval(updateInterval);
    };
  }, [isActive]);
  
  const startMonitoring = useCallback(() => {
    setIsActive(true);
    resetErrorMetrics();
    logSuccess('MONITOR_START', 'Error detection monitoring started');
  }, []);
  
  const stopMonitoring = useCallback(() => {
    setIsActive(false);
    logSuccess('MONITOR_STOP', 'Error detection monitoring stopped');
  }, []);
  
  const resetMonitoring = useCallback(() => {
    resetErrorMetrics();
    setErrorStats({ count: 0, lastTime: 0 });
    logSuccess('MONITOR_RESET', 'Error detection metrics reset');
  }, []);
  
  const reportError = useCallback((code: string, message: string, data?: any) => {
    logError(code, message, data);
    // Disabled toast notification
    // toast.error(`Error: ${message}`);
  }, []);
  
  return {
    isActive,
    errorStats,
    startMonitoring,
    stopMonitoring,
    resetMonitoring,
    reportError
  };
};
