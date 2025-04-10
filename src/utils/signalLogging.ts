
/**
 * Signal logging utilities for debugging and monitoring
 */

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

/**
 * Log signal processing events with different severity levels
 */
export function logSignalProcessing(
  level: LogLevel, 
  source: string, 
  message: string, 
  data?: any
) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    level,
    source,
    message,
    timestamp,
    data
  };
  
  switch (level) {
    case LogLevel.ERROR:
      console.error(`[${source}] ${message}`, data || '');
      break;
    case LogLevel.WARN:
      console.warn(`[${source}] ${message}`, data || '');
      break;
    case LogLevel.INFO:
      console.info(`[${source}] ${message}`, data || '');
      break;
    case LogLevel.DEBUG:
    default:
      console.log(`[${source}] ${message}`, data || '');
      break;
  }
  
  // Add to in-memory log if needed
  addToInMemoryLog(logEntry);
  
  return logEntry;
}

// In-memory log for recent entries
const MAX_LOG_ENTRIES = 1000;
const inMemoryLog: any[] = [];

function addToInMemoryLog(entry: any) {
  inMemoryLog.push(entry);
  if (inMemoryLog.length > MAX_LOG_ENTRIES) {
    inMemoryLog.shift();
  }
}

/**
 * Get all recent log entries
 */
export function getLogEntries() {
  return [...inMemoryLog];
}

/**
 * Clear all log entries
 */
export function clearLogEntries() {
  inMemoryLog.length = 0;
}

/**
 * Track performance metrics for signal processing
 */
export function trackPerformance(label: string, startTime: number) {
  const endTime = performance.now();
  const duration = endTime - startTime;
  
  logSignalProcessing(
    LogLevel.DEBUG, 
    'Performance', 
    `${label} took ${duration.toFixed(2)}ms`
  );
  
  return duration;
}

/**
 * Track performance metrics for async operations
 * Updated to support optional category parameter for better organization
 */
export async function trackPerformanceAsync<T>(
  category: string,
  label: string, 
  fn: () => Promise<T>
): Promise<T> {
  const startTime = performance.now();
  try {
    const result = await fn();
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    logSignalProcessing(
      LogLevel.DEBUG, 
      category, 
      `Async ${label} took ${duration.toFixed(2)}ms`
    );
    
    return result;
  } catch (error) {
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    logSignalProcessing(
      LogLevel.ERROR, 
      category, 
      `Async ${label} failed after ${duration.toFixed(2)}ms`,
      error
    );
    
    throw error;
  }
}

/**
 * Get error statistics from log entries
 */
export function getErrorStats(timeWindow: number = 60000) {
  const now = Date.now();
  const cutoff = now - timeWindow;
  
  const recentErrors = inMemoryLog.filter(entry => 
    entry.level === LogLevel.ERROR && 
    new Date(entry.timestamp).getTime() > cutoff
  );
  
  const sourceCounts: Record<string, number> = {};
  recentErrors.forEach(error => {
    sourceCounts[error.source] = (sourceCounts[error.source] || 0) + 1;
  });
  
  return {
    total: recentErrors.length,
    sourceCounts,
    recentErrors: recentErrors.slice(-10) // Last 10 errors
  };
}
