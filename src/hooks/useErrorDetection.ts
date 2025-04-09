
import { useState, useEffect, useCallback } from 'react';
import { toast } from './use-toast';
import { 
  logError, 
  logSuccess,
  resetErrorMetrics,
  getErrorDetectionStatus, 
  ErrorDetectionStatus 
} from '../utils/errorDetection';
import { disposeTensors } from '../utils/tfModelInitializer';

interface ErrorDetectionState {
  isRecoveryMode: boolean;
  errorRate: number;
  abnormalStateDetected: boolean;
  categoryErrors: Record<string, { count: number; lastTime: number }>;
  performanceIssues: boolean;
  lastPerformanceCheck: number;
}

/**
 * Hook for accessing and managing the error detection system
 * Provides error logging, status checking, and recovery mechanisms
 */
export function useErrorDetection() {
  const [state, setState] = useState<ErrorDetectionState>({
    isRecoveryMode: false,
    errorRate: 0,
    abnormalStateDetected: false,
    categoryErrors: {},
    performanceIssues: false,
    lastPerformanceCheck: 0
  });

  // Update state from global error detection system
  const updateStatus = useCallback(() => {
    const status = getErrorDetectionStatus();
    
    // Extract category error counts
    const categoryErrors: Record<string, { count: number; lastTime: number }> = {};
    for (const [category, data] of Object.entries(status.categories)) {
      categoryErrors[category] = {
        count: data.count,
        lastTime: data.lastTime
      };
    }
    
    // Check performance issues
    let performanceIssues = false;
    if (status.recentPerformance.length > 0) {
      // Check for low FPS
      const recentFps = status.recentPerformance
        .filter(p => p.fps !== null)
        .map(p => p.fps);
      
      if (recentFps.length > 0) {
        const avgFps = recentFps.reduce((sum, fps) => sum + (fps || 0), 0) / recentFps.length;
        performanceIssues = avgFps < 15; // Consider below 15 FPS problematic
      }
      
      // Check for high memory usage
      const recentMemory = status.recentPerformance
        .filter(p => p.memory !== null)
        .map(p => p.memory);
      
      if (recentMemory.length > 0) {
        const maxMemory = Math.max(...recentMemory.filter(m => m !== null) as number[]);
        performanceIssues = performanceIssues || maxMemory > 200; // Over 200MB is problematic
      }
    }
    
    setState({
      isRecoveryMode: status.isRecoveryMode,
      errorRate: status.errorRate,
      abnormalStateDetected: status.abnormalStateDetected,
      categoryErrors,
      performanceIssues,
      lastPerformanceCheck: Date.now()
    });
  }, []);

  // Set up periodic status checking
  useEffect(() => {
    // Initial update
    updateStatus();
    
    // Check status periodically
    const intervalId = setInterval(updateStatus, 5000); // Every 5 seconds
    
    return () => {
      clearInterval(intervalId);
    };
  }, [updateStatus]);

  /**
   * Log a successful operation
   */
  const recordSuccess = useCallback((operation: string) => {
    logSuccess(operation);
  }, []);

  /**
   * Log an error with proper categorization
   */
  const recordError = useCallback((
    category: string,
    operation: string,
    error: any,
    isCritical: boolean = false
  ) => {
    logError(category, operation, error, isCritical);
    
    // Force status update after critical errors
    if (isCritical) {
      updateStatus();
    }
  }, [updateStatus]);

  /**
   * Attempt to recover from error state
   */
  const attemptRecovery = useCallback(async () => {
    try {
      toast({
        title: "Recovery Attempt",
        description: "Attempting to recover from error state...",
        variant: "default"
      });
      
      // Clean up TensorFlow resources
      disposeTensors();
      
      // Reset error metrics
      resetErrorMetrics();
      
      // Force update status
      updateStatus();
      
      toast({
        title: "Recovery Complete",
        description: "System has attempted to recover from errors",
        variant: "default"
      });
      
      // Return after short delay to allow system to stabilize
      await new Promise(resolve => setTimeout(resolve, 300));
      
      return true;
    } catch (error) {
      toast({
        title: "Recovery Failed",
        description: "Could not recover from error state. Try reloading the page.",
        variant: "destructive"
      });
      
      return false;
    }
  }, [updateStatus]);

  /**
   * Check if there are any issues that should be addressed
   */
  const checkForIssues = useCallback((): {
    hasIssues: boolean;
    criticalIssues: boolean;
    message: string | null;
  } => {
    // Check if we're in an error state
    if (state.isRecoveryMode || state.abnormalStateDetected) {
      return {
        hasIssues: true,
        criticalIssues: true,
        message: "System is in recovery mode due to errors"
      };
    }
    
    // Check error rate
    if (state.errorRate > 0.1) { // More than 10% errors
      return {
        hasIssues: true,
        criticalIssues: state.errorRate > 0.3,
        message: `High error rate detected (${(state.errorRate * 100).toFixed(1)}%)`
      };
    }
    
    // Check for critical category errors
    let totalErrors = 0;
    for (const category in state.categoryErrors) {
      totalErrors += state.categoryErrors[category].count;
      
      // If there are many errors in a specific category
      if (state.categoryErrors[category].count > 10) {
        return {
          hasIssues: true,
          criticalIssues: state.categoryErrors[category].count > 50,
          message: `Multiple errors detected in ${category}`
        };
      }
    }
    
    // Check for performance issues
    if (state.performanceIssues) {
      return {
        hasIssues: true,
        criticalIssues: false,
        message: "Performance issues detected"
      };
    }
    
    // No issues detected
    return {
      hasIssues: false,
      criticalIssues: false,
      message: null
    };
  }, [state]);

  return {
    errorState: state,
    recordSuccess,
    recordError,
    attemptRecovery,
    checkForIssues,
    updateStatus
  };
}
