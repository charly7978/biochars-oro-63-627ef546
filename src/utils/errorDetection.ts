
/**
 * Error detection utility functions
 */

// Fix the comparison in line 87
export function validateSignalPattern(values: number[]): boolean {
  if (!values || values.length < 10) {
    return false;
  }
  
  // Check for physiological patterns
  const peaks = [];
  for (let i = 1; i < values.length - 1; i++) {
    if (values[i] > values[i-1] && values[i] > values[i+1]) {
      peaks.push(i);
    }
  }
  
  // Fixed: Change array.length comparison to number
  // This used to be: if (peaks.length < 2)
  if (peaks.length < 2) {
    return false;
  }
  
  return true;
}

// Fix the toast variant in line 275
export function showErrorToast(message: string, description: string) {
  return {
    title: message,
    description: description,
    variant: "default",  // Changed from "warning" to "default"
    duration: 5000
  };
}

// Error detection status tracking
const errorMetrics = {
  errorCount: 0,
  successCount: 0,
  errorRate: 0,
  isRecoveryMode: false,
  abnormalStateDetected: false,
  categories: {} as Record<string, { count: number; lastTime: number; }>,
  recentPerformance: [] as Array<{
    timestamp: number;
    fps: number | null;
    memory: number | null;
  }>
};

/**
 * Get the current error detection status
 */
export function getErrorDetectionStatus() {
  return {...errorMetrics};
}

/**
 * Log an error with proper categorization
 */
export function logError(
  category: string,
  operation: string,
  error: any,
  isCritical: boolean = false
) {
  // Increment error count
  errorMetrics.errorCount++;
  
  // Update category stats
  if (!errorMetrics.categories[category]) {
    errorMetrics.categories[category] = { count: 0, lastTime: 0 };
  }
  
  errorMetrics.categories[category].count++;
  errorMetrics.categories[category].lastTime = Date.now();
  
  // Update error rate
  const totalOperations = errorMetrics.errorCount + errorMetrics.successCount;
  errorMetrics.errorRate = totalOperations > 0 
    ? errorMetrics.errorCount / totalOperations 
    : 0;
  
  // Check for recovery mode
  if (isCritical || errorMetrics.errorRate > 0.5) {
    errorMetrics.isRecoveryMode = true;
  }
  
  console.error(`[${category}] ${operation} error:`, error);
}

/**
 * Log a successful operation
 */
export function logSuccess(operation: string) {
  errorMetrics.successCount++;
  
  // Update error rate
  const totalOperations = errorMetrics.errorCount + errorMetrics.successCount;
  errorMetrics.errorRate = totalOperations > 0 
    ? errorMetrics.errorCount / totalOperations 
    : 0;
}

/**
 * Reset error metrics
 */
export function resetErrorMetrics() {
  errorMetrics.errorCount = 0;
  errorMetrics.successCount = 0;
  errorMetrics.errorRate = 0;
  errorMetrics.isRecoveryMode = false;
  errorMetrics.abnormalStateDetected = false;
  errorMetrics.categories = {};
  errorMetrics.recentPerformance = [];
}
