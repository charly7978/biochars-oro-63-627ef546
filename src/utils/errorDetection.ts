
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
  errors: [] as string[]
};

// Error detection status retrieval
export const getErrorDetectionStatus = (): { active: boolean; count: number } => {
  return {
    active: errorMetrics.count > 0,
    count: errorMetrics.count
  };
};

// Log an error occurrence
export const logError = (message: string): void => {
  errorMetrics.count++;
  errorMetrics.lastTime = Date.now();
  errorMetrics.errors.push(message);
  
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
};
