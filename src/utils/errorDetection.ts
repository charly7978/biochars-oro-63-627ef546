
/**
 * Error detection and logging utilities
 */

let errorCount = 0;
let lastErrorTime = 0;
const errors: Record<string, number> = {};

/**
 * Check error detection status
 * @returns Current error detection statistics
 */
export function getErrorDetectionStatus(): { count: number; lastTime: number; errors: Record<string, number> } {
  return {
    count: errorCount,
    lastTime: lastErrorTime,
    errors
  };
}

/**
 * Log an error
 * @param code Error code
 * @param message Error message
 * @param data Additional error data
 */
export function logError(code: string, message: string, data?: any): void {
  errorCount++;
  lastErrorTime = Date.now();
  
  if (!errors[code]) {
    errors[code] = 0;
  }
  errors[code]++;
  
  console.error(`[${code}] ${message}`, data);
}

/**
 * Log a success
 * @param code Success code
 * @param message Success message
 * @param data Additional success data
 */
export function logSuccess(code: string, message: string, data?: any): void {
  console.log(`[${code}] ${message}`, data);
}

/**
 * Reset error metrics
 */
export function resetErrorMetrics(): void {
  errorCount = 0;
  lastErrorTime = 0;
  Object.keys(errors).forEach(key => {
    errors[key] = 0;
  });
}

