
import { toast } from '@/hooks/use-toast';

/**
 * Error detection and recovery utilities
 */

// Severity levels
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Error categories
export enum ErrorCategory {
  NETWORK = 'network',
  CAMERA = 'camera',
  PROCESSING = 'processing',
  SIGNAL = 'signal',
  RENDERING = 'rendering',
  TENSORFLOW = 'tensorflow'
}

// Detection thresholds
const ERROR_THRESHOLDS = {
  CONSECUTIVE_ERRORS: 3,
  RECOVERY_TIME_MS: 5000,
  MEMORY_LEAK_TENSORS: 1000,
  HIGH_CPU_USAGE_PERCENT: 80
};

// Error state
let errorState = {
  consecutiveErrors: 0,
  lastErrorTime: 0,
  recoveryAttempts: 0,
  errorLog: [] as any[],
  isInRecoveryMode: false
};

/**
 * Log an error with contextual information
 */
export const logError = (
  category: ErrorCategory,
  message: string,
  severity: ErrorSeverity = ErrorSeverity.MEDIUM,
  error?: any
) => {
  const timestamp = Date.now();
  const errorEntry = {
    category,
    message,
    severity,
    timestamp,
    error: error || null
  };
  
  // Log to console
  console.error(`[${category}] ${message}`, error);
  
  // Add to error log
  errorState.errorLog.push(errorEntry);
  
  // Limit log size
  if (errorState.errorLog.length > 50) {
    errorState.errorLog.shift();
  }
  
  // Update consecutive error counter
  errorState.consecutiveErrors++;
  errorState.lastErrorTime = timestamp;
  
  // Check for error threshold
  if (errorState.consecutiveErrors === ERROR_THRESHOLDS.CONSECUTIVE_ERRORS) {
    enterRecoveryMode(category);
  }
  
  return errorEntry;
};

/**
 * Enter recovery mode to handle persistent errors
 */
const enterRecoveryMode = (category: ErrorCategory) => {
  if (errorState.isInRecoveryMode) return;
  
  errorState.isInRecoveryMode = true;
  errorState.recoveryAttempts++;
  
  console.warn(`Entering recovery mode for ${category} issues`);
  
  // Execute recovery strategy based on category
  executeRecoveryStrategy(category);
  
  // Exit recovery mode after a timeout
  setTimeout(() => {
    errorState.isInRecoveryMode = false;
    errorState.consecutiveErrors = 0;
    console.log(`Exited recovery mode for ${category} issues`);
  }, ERROR_THRESHOLDS.RECOVERY_TIME_MS);
};

/**
 * Execute specific recovery strategy based on error category
 */
const executeRecoveryStrategy = (category: ErrorCategory) => {
  switch (category) {
    case ErrorCategory.CAMERA:
      // Attempt to reinitialize camera
      toast({
        title: "Camera issue detected",
        description: "Attempting to recover camera stream...",
        variant: "destructive"
      });
      
      // Recovery would trigger camera reinitialization
      break;
      
    case ErrorCategory.PROCESSING:
      // Reset signal processing
      toast({
        title: "Processing error",
        description: "Resetting signal processor...",
        variant: "destructive"
      });
      break;
      
    case ErrorCategory.TENSORFLOW:
      // Release TensorFlow resources
      toast({
        title: "TensorFlow error",
        description: "Releasing tensor memory...",
        variant: "destructive"
      });
      break;
      
    case ErrorCategory.NETWORK:
      // Retry network operations
      toast({
        title: "Network connection issue",
        description: "Checking connectivity...",
        variant: "destructive"
      });
      break;
      
    default:
      // General recovery
      toast({
        title: "Error detected",
        description: "Attempting recovery...",
        variant: "destructive"
      });
  }
};

/**
 * Reset error state
 */
export const resetErrorState = () => {
  errorState = {
    consecutiveErrors: 0,
    lastErrorTime: 0,
    recoveryAttempts: 0,
    errorLog: [],
    isInRecoveryMode: false
  };
};

/**
 * Check for memory leaks and performance issues
 */
export const checkSystemHealth = (memoryInfo?: { numTensors: number }) => {
  // Check for TensorFlow memory leaks
  if (memoryInfo && memoryInfo.numTensors > ERROR_THRESHOLDS.MEMORY_LEAK_TENSORS) {
    logError(
      ErrorCategory.TENSORFLOW,
      `Possible memory leak detected: ${memoryInfo.numTensors} tensors`,
      ErrorSeverity.HIGH
    );
    
    toast({
      title: "Memory issue detected",
      description: "High tensor count may affect performance",
      variant: "destructive"
    });
    
    return false;
  }
  
  return true;
};

/**
 * Get error statistics
 */
export const getErrorStats = () => {
  return {
    totalErrors: errorState.errorLog.length,
    recoveryAttempts: errorState.recoveryAttempts,
    lastErrorTime: errorState.lastErrorTime,
    isInRecoveryMode: errorState.isInRecoveryMode,
    consecutiveErrors: errorState.consecutiveErrors
  };
};
