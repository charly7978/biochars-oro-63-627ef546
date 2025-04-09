/**
 * Comprehensive error detection and prevention system
 * Provides early warning of potential issues and recovery mechanisms
 */

import { logSignalProcessing, LogLevel, getErrorStats } from './signalLogging';
import { toast } from '@/hooks/use-toast';

// Error thresholds
const ERROR_RATE_THRESHOLD = 0.1; // 10% of operations resulting in errors
const CONSECUTIVE_ERROR_THRESHOLD = 5; // Max consecutive errors before action
const RECOVERY_COOLDOWN_MS = 60000; // 1 minute between auto-recovery attempts
const MEMORY_THRESHOLD_MB = 200; // Memory threshold for warnings (MB)
const TENSOR_COUNT_THRESHOLD = 1000; // Tensor count threshold for warnings

// Error tracking state
let totalOperations = 0;
let errorCount = 0;
let consecutiveErrorCount = 0;
let lastErrorTime = 0;
let lastRecoveryTime = 0;
let isRecoveryMode = false;
let abnormalStateDetected = false;

// Monitor state
const perfData: Array<{
  timestamp: number;
  fps: number;
  memory: number | null;
  tensors: number | null;
}> = [];

// Error categories
const errorCategories: Record<string, {
  count: number;
  lastTime: number;
  isCritical: boolean;
  recoveryAttempted: boolean;
}> = {};

/**
 * Initialize error detection system
 */
export function initializeErrorDetection(): void {
  resetErrorMetrics();
  startPerformanceMonitoring();
  
  logSignalProcessing(LogLevel.INFO, 'ErrorDetection', 'Error detection system initialized');
}

/**
 * Reset error metrics
 */
export function resetErrorMetrics(): void {
  totalOperations = 0;
  errorCount = 0;
  consecutiveErrorCount = 0;
  lastErrorTime = 0;
  lastRecoveryTime = 0;
  isRecoveryMode = false;
  abnormalStateDetected = false;
  
  // Reset categories but keep the keys
  for (const category in errorCategories) {
    errorCategories[category] = {
      count: 0,
      lastTime: 0,
      isCritical: errorCategories[category].isCritical,
      recoveryAttempted: false
    };
  }
  
  perfData.length = 0;
}

/**
 * Log a successful operation
 */
export function logSuccess(operation: string): void {
  totalOperations++;
  consecutiveErrorCount = 0;
  
  // If we were in recovery mode and have had several successes, exit recovery mode
  if (isRecoveryMode && totalOperations % 10 === 0) {
    const recentErrors = getErrorStats().recentErrors;
    
    if (recentErrors === 0) {
      isRecoveryMode = false;
      logSignalProcessing(LogLevel.INFO, 'ErrorDetection', 'Exited recovery mode after successful operations');
    }
  }
}

/**
 * Log an error with categorization and potential recovery actions
 */
export function logError(
  category: string,
  operation: string,
  error: any,
  isCritical: boolean = false
): void {
  try {
    const now = Date.now();
    totalOperations++;
    errorCount++;
    consecutiveErrorCount++;
    lastErrorTime = now;
    
    // Create category if it doesn't exist
    if (!errorCategories[category]) {
      errorCategories[category] = {
        count: 0,
        lastTime: 0,
        isCritical,
        recoveryAttempted: false
      };
    }
    
    // Update category stats
    const categoryData = errorCategories[category];
    categoryData.count++;
    categoryData.lastTime = now;
    categoryData.isCritical = isCritical;
    
    // Calculate error rate
    const errorRate = totalOperations > 0 ? errorCount / totalOperations : 0;
    
    // Log based on severity
    const logLevel = isCritical ? LogLevel.ERROR : (errorRate > ERROR_RATE_THRESHOLD ? LogLevel.ERROR : LogLevel.WARN);
    
    logSignalProcessing(
      logLevel,
      'ErrorDetection',
      `Error in operation: ${operation} (${category})`,
      {
        error,
        errorRate: errorRate.toFixed(3),
        consecutive: consecutiveErrorCount,
        category,
        totalErrorsInCategory: categoryData.count
      }
    );
    
    // Check if we need to enter recovery mode
    if (
      (consecutiveErrorCount >= CONSECUTIVE_ERROR_THRESHOLD || isCritical) &&
      !isRecoveryMode &&
      now - lastRecoveryTime > RECOVERY_COOLDOWN_MS
    ) {
      enterRecoveryMode(category, operation);
    }
    
    // Alert user for critical or high-frequency errors
    if (
      isCritical || 
      categoryData.count % 10 === 1 || // First, then every 10th error
      (errorRate > ERROR_RATE_THRESHOLD && now - categoryData.lastTime > 30000) // High rate but not too frequent alerts
    ) {
      const variant = errorCount > 5 ? "destructive" : "default";
      toast({
        title: isCritical ? "Error Detected" : "Warning",
        description: `Issue detected in ${category}. Some features may not work correctly.`,
        variant: variant
      });
    }
    
    // If abnormal state persists, suggest page reload
    if (abnormalStateDetected && consecutiveErrorCount > CONSECUTIVE_ERROR_THRESHOLD * 2) {
      const variant = "destructive";
      toast({
        title: "Application Error",
        description: "Several issues detected. Consider reloading the page.",
        variant: variant
      });
    }
  } catch (metaError) {
    // Last resort if our error handling itself fails
    console.error("Error in error detection system:", metaError);
  }
}

/**
 * Enter recovery mode to attempt automatic error resolution
 */
function enterRecoveryMode(category: string, operation: string): void {
  const now = Date.now();
  isRecoveryMode = true;
  lastRecoveryTime = now;
  abnormalStateDetected = true;
  
  const categoryData = errorCategories[category];
  categoryData.recoveryAttempted = true;
  
  logSignalProcessing(
    LogLevel.WARN,
    'ErrorDetection',
    'Entering recovery mode',
    { category, operation, consecutiveErrors: consecutiveErrorCount }
  );
  
  // Attempt recovery based on error category
  try {
    // Different recovery strategies based on category
    switch (category) {
      case 'tensorflow':
        // This will be handled by the TensorFlow integration
        import('../hooks/useTensorFlowIntegration')
          .then(module => {
            // This will trigger a reinitialize on next render
            abnormalStateDetected = true;
          })
          .catch(error => {
            logSignalProcessing(
              LogLevel.ERROR,
              'ErrorDetection',
              'Failed to import TensorFlow module for recovery',
              { error }
            );
          });
        break;
        
      case 'camera':
        // For camera errors, we'll let the application handle reconnection
        logSignalProcessing(
          LogLevel.INFO,
          'ErrorDetection',
          'Camera recovery will be handled by camera management system'
        );
        break;
        
      case 'signal-processing':
        // Signal processing issues might require resetting the processor
        // This will be communicated to components that use signal processing
        logSignalProcessing(
          LogLevel.INFO,
          'ErrorDetection',
          'Signal processing recovery initiated'
        );
        break;
        
      default:
        // General recovery - clear caches and state
        try {
          // Clear any non-essential caches
          if ('caches' in window) {
            caches.keys().then(names => {
              for (const name of names) {
                if (name.includes('dynamic') || name.includes('temp')) {
                  caches.delete(name);
                }
              }
            });
          }
          
          logSignalProcessing(
            LogLevel.INFO,
            'ErrorDetection',
            'General recovery initiated - cleared caches'
          );
        } catch (cacheError) {
          logSignalProcessing(
            LogLevel.ERROR,
            'ErrorDetection',
            'Error during cache clearing in recovery',
            { error: cacheError }
          );
        }
    }
    
    // Notify user
    toast({
      title: "Automatic Recovery",
      description: "System is attempting to recover from errors",
      variant: "warning"
    });
  } catch (recoveryError) {
    logSignalProcessing(
      LogLevel.ERROR,
      'ErrorDetection',
      'Error during recovery attempt',
      { error: recoveryError }
    );
  }
}

/**
 * Get error detection status
 */
export function getErrorDetectionStatus(): {
  isRecoveryMode: boolean;
  errorRate: number;
  abnormalStateDetected: boolean;
  categories: typeof errorCategories;
  recentPerformance: typeof perfData;
} {
  const errorRate = totalOperations > 0 ? errorCount / totalOperations : 0;
  
  return {
    isRecoveryMode,
    errorRate,
    abnormalStateDetected,
    categories: { ...errorCategories },
    recentPerformance: [...perfData.slice(-20)] // Last 20 performance data points
  };
}

/**
 * Start monitoring application performance
 */
function startPerformanceMonitoring(): void {
  if (typeof window === 'undefined') return;
  
  let lastFrameTime = performance.now();
  let frameCount = 0;
  let lastFpsUpdateTime = lastFrameTime;
  
  // Monitor frame rate
  function checkFrameRate() {
    const now = performance.now();
    frameCount++;
    
    // Update FPS every second
    if (now - lastFpsUpdateTime > 1000) {
      const fps = Math.round((frameCount * 1000) / (now - lastFpsUpdateTime));
      
      // Get memory info if available
      let memoryInfo: { jsHeapSizeLimit?: number; totalJSHeapSize?: number; usedJSHeapSize?: number } = {};
      let memoryUsageMB: number | null = null;
      let tensorCount: number | null = null;
      
      try {
        // Try to get browser memory info
        if (performance && (performance as any).memory) {
          memoryInfo = (performance as any).memory;
          memoryUsageMB = memoryInfo.usedJSHeapSize ? memoryInfo.usedJSHeapSize / (1024 * 1024) : null;
        }
        
        // Try to get TensorFlow memory info
        if (typeof window !== 'undefined' && window.tf) {
          const tfMemory = window.tf.memory();
          tensorCount = tfMemory.numTensors;
          
          // If browser memory not available, use TensorFlow's
          if (memoryUsageMB === null && tfMemory.numBytes) {
            memoryUsageMB = tfMemory.numBytes / (1024 * 1024);
          }
        }
      } catch (memoryError) {
        // Ignore memory access errors
      }
      
      // Store performance data
      perfData.push({
        timestamp: now,
        fps,
        memory: memoryUsageMB,
        tensors: tensorCount
      });
      
      // Keep history limited
      if (perfData.length > 100) {
        perfData.shift();
      }
      
      // Check for performance issues
      if (fps < 10) {  // Severe frame rate drop
        logSignalProcessing(
          LogLevel.WARN,
          'Performance',
          'Low frame rate detected',
          { fps, expected: '30-60' }
        );
      }
      
      // Check memory usage if available
      if (memoryUsageMB !== null && memoryUsageMB > MEMORY_THRESHOLD_MB) {
        logSignalProcessing(
          LogLevel.WARN,
          'Performance',
          'High memory usage detected',
          { memoryMB: memoryUsageMB, threshold: MEMORY_THRESHOLD_MB }
        );
      }
      
      // Check tensor count if available
      if (tensorCount !== null && tensorCount > TENSOR_COUNT_THRESHOLD) {
        logSignalProcessing(
          LogLevel.WARN,
          'Performance',
          'High tensor count detected',
          { tensors: tensorCount, threshold: TENSOR_COUNT_THRESHOLD }
        );
        
        // Try to clean up tensors
        try {
          if (window.tf) {
            window.tf.tidy(() => {}); // Clean up unused tensors
          }
        } catch (tensorError) {
          // Ignore tensor cleanup errors
        }
      }
      
      // Reset counters
      frameCount = 0;
      lastFpsUpdateTime = now;
    }
    
    lastFrameTime = now;
    requestAnimationFrame(checkFrameRate);
  }
  
  // Start monitoring
  requestAnimationFrame(checkFrameRate);
}

/**
 * Add window.tf typing
 */
declare global {
  interface Window {
    tf?: {
      memory: () => { numTensors: number; numBytes: number };
      tidy: (fn: () => any) => any;
    };
  }
}

// Initialize the system
initializeErrorDetection();
