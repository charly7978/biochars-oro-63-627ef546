
/**
 * Simple error detection utilities
 */

// Safe array check function
export const safeArrayCheck = (arr: any[] | null | undefined): boolean => {
  return Array.isArray(arr) && arr.length > 0;
};

// Variant definition for UI components
export const variant = 'default'; // Changed from 'warning' to match the expected type

// Error metrics tracking object
export const errorMetrics = {
  count: 0,
  lastTime: 0,
  errors: [] as string[],
  categories: {} as Record<string, number>,
  recentPerformance: [] as number[],
  isRecoveryMode: false,
  errorRate: 0,
  abnormalStateDetected: false
};

// Error detection status retrieval
export const getErrorDetectionStatus = (): { 
  active: boolean; 
  count: number;
  categories?: Record<string, number>;
  recentPerformance?: number[];
  isRecoveryMode?: boolean;
  errorRate?: number;
  abnormalStateDetected?: boolean;
} => {
  return {
    active: errorMetrics.count > 0,
    count: errorMetrics.count,
    categories: errorMetrics.categories,
    recentPerformance: errorMetrics.recentPerformance,
    isRecoveryMode: errorMetrics.isRecoveryMode,
    errorRate: errorMetrics.errorRate,
    abnormalStateDetected: errorMetrics.abnormalStateDetected
  };
};

// Log an error occurrence
export const logError = (message: string, category: string = 'general'): void => {
  errorMetrics.count++;
  errorMetrics.lastTime = Date.now();
  errorMetrics.errors.push(message);
  
  // Update category counts
  if (!errorMetrics.categories[category]) {
    errorMetrics.categories[category] = 0;
  }
  errorMetrics.categories[category]++;
  
  // Limit the size of the errors array
  if (errorMetrics.errors.length > 50) {
    errorMetrics.errors.shift();
  }
  
  console.error(`Error detected: ${message}`);
};

// Log a successful operation
export const logSuccess = (message: string): void => {
  console.log(`Success: ${message}`);
};

// Reset error tracking metrics
export const resetErrorMetrics = (): void => {
  errorMetrics.count = 0;
  errorMetrics.lastTime = 0;
  errorMetrics.errors = [];
  errorMetrics.categories = {};
  errorMetrics.recentPerformance = [];
  errorMetrics.isRecoveryMode = false;
  errorMetrics.errorRate = 0;
  errorMetrics.abnormalStateDetected = false;
};
