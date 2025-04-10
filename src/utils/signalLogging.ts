/**
 * Signal processing logging and error monitoring system
 * Provides robust tracking and diagnostic information for signal processing
 */

// Standard log levels
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  CRITICAL = 4
}

// Performance tracking settings
const PERFORMANCE_TRACKING_ENABLED = true;
const ANOMALY_DETECTION_ENABLED = true;
const LOG_RETENTION_LIMIT = 1000; // Maximum number of log entries to keep
const MAX_ERROR_COUNT = 100; // Maximum number of errors to keep in memory
const ERROR_COOLDOWN_MS = 5000; // Minimum time between duplicate errors

// Storage for logs and performance metrics
const signalLogs: Array<{
  timestamp: number;
  level: LogLevel;
  module: string;
  message: string;
  data?: any;
}> = [];

// Performance history for different modules
const performanceMetrics: Record<string, {
  calls: number;
  totalTime: number;
  minTime: number;
  maxTime: number;
  recentTimes: number[];
  lastAnomalyTime?: number;
}> = {};

// Error tracking to prevent duplicates
const recentErrors: Map<string, {
  count: number;
  lastReported: number;
}> = new Map();

/**
 * Record a signal processing log entry
 */
export function logSignalProcessing(
  level: LogLevel,
  module: string,
  message: string,
  data?: any
): void {
  try {
    // Create log entry
    const logEntry = {
      timestamp: Date.now(),
      level,
      module,
      message,
      data
    };
    
    // Add to logs with retention limit
    signalLogs.push(logEntry);
    if (signalLogs.length > LOG_RETENTION_LIMIT) {
      signalLogs.shift();
    }
    
    // Only output to console for higher severity or when debugging is enabled
    const shouldLog = level >= LogLevel.INFO || 
                      localStorage.getItem('ppg_debug_mode') === 'true';
                      
    if (shouldLog) {
      switch (level) {
        case LogLevel.DEBUG:
          console.debug(`[${module}] ${message}`, data);
          break;
        case LogLevel.INFO:
          console.info(`[${module}] ${message}`, data);
          break;
        case LogLevel.WARN:
          console.warn(`[${module}] ${message}`, data);
          break;
        case LogLevel.ERROR:
        case LogLevel.CRITICAL:
          // Generate error key to prevent duplicates
          const errorKey = `${module}:${message}`;
          const now = Date.now();
          const errorRecord = recentErrors.get(errorKey);
          
          if (!errorRecord || now - errorRecord.lastReported > ERROR_COOLDOWN_MS) {
            // Log new error or error after cooldown
            console.error(`[${module}] ${message}`, data);
            recentErrors.set(errorKey, {
              count: errorRecord ? errorRecord.count + 1 : 1,
              lastReported: now
            });
          } else {
            // Update counter but don't log duplicate
            recentErrors.set(errorKey, {
              count: errorRecord.count + 1,
              lastReported: errorRecord.lastReported
            });
          }
          
          // Clean up error tracking map if it gets too large
          if (recentErrors.size > MAX_ERROR_COUNT) {
            // Remove oldest entries
            const entries = [...recentErrors.entries()];
            entries.sort((a, b) => a[1].lastReported - b[1].lastReported);
            for (let i = 0; i < entries.length / 2; i++) {
              recentErrors.delete(entries[i][0]);
            }
          }
          break;
      }
    }
  } catch (error) {
    // Fallback logging if our logging system itself fails
    console.error('Error in logging system:', error);
  }
}

/**
 * Track performance of a function execution
 */
export function trackPerformance<T>(
  moduleName: string,
  operation: string, 
  func: () => T
): T {
  if (!PERFORMANCE_TRACKING_ENABLED) {
    return func();
  }
  
  const startTime = performance.now();
  
  try {
    return func();
  } catch (error) {
    logSignalProcessing(
      LogLevel.ERROR,
      moduleName,
      `Error in operation ${operation}`,
      { error }
    );
    throw error;
  } finally {
    const endTime = performance.now();
    const executionTime = endTime - startTime;
    
    // Create metric key
    const metricKey = `${moduleName}:${operation}`;
    
    // Get or create metrics record
    if (!performanceMetrics[metricKey]) {
      performanceMetrics[metricKey] = {
        calls: 0,
        totalTime: 0,
        minTime: Infinity,
        maxTime: 0,
        recentTimes: []
      };
    }
    
    const metrics = performanceMetrics[metricKey];
    
    // Update metrics
    metrics.calls++;
    metrics.totalTime += executionTime;
    metrics.minTime = Math.min(metrics.minTime, executionTime);
    metrics.maxTime = Math.max(metrics.maxTime, executionTime);
    
    // Keep track of recent execution times (last 20)
    metrics.recentTimes.push(executionTime);
    if (metrics.recentTimes.length > 20) {
      metrics.recentTimes.shift();
    }
    
    // Detect performance anomalies if enabled
    if (ANOMALY_DETECTION_ENABLED && metrics.recentTimes.length >= 5) {
      const recentAvg = metrics.recentTimes.reduce((sum, time) => sum + time, 0) / 
                       metrics.recentTimes.length;
      
      const anomalyThreshold = recentAvg * 3; // 3x average is an anomaly
      const now = Date.now();
      
      // Report anomaly if exceeding threshold and not reported recently
      if (
        executionTime > anomalyThreshold && 
        executionTime > 100 && // Only care about significant slowdowns
        (!metrics.lastAnomalyTime || now - metrics.lastAnomalyTime > 60000) // Max once per minute
      ) {
        logSignalProcessing(
          LogLevel.WARN,
          moduleName,
          `Performance anomaly detected in ${operation}`,
          {
            executionTime,
            average: recentAvg,
            threshold: anomalyThreshold
          }
        );
        metrics.lastAnomalyTime = now;
      }
    }
  }
}

/**
 * Track performance of an async function execution
 */
export async function trackPerformanceAsync<T>(
  moduleName: string,
  operation: string, 
  func: () => Promise<T>
): Promise<T> {
  if (!PERFORMANCE_TRACKING_ENABLED) {
    return await func();
  }
  
  const startTime = performance.now();
  
  try {
    return await func();
  } catch (error) {
    logSignalProcessing(
      LogLevel.ERROR,
      moduleName,
      `Error in async operation ${operation}`,
      { error }
    );
    throw error;
  } finally {
    const endTime = performance.now();
    const executionTime = endTime - startTime;
    
    // Create metric key
    const metricKey = `${moduleName}:${operation}`;
    
    // Get or create metrics record
    if (!performanceMetrics[metricKey]) {
      performanceMetrics[metricKey] = {
        calls: 0,
        totalTime: 0,
        minTime: Infinity,
        maxTime: 0,
        recentTimes: []
      };
    }
    
    const metrics = performanceMetrics[metricKey];
    
    // Update metrics
    metrics.calls++;
    metrics.totalTime += executionTime;
    metrics.minTime = Math.min(metrics.minTime, executionTime);
    metrics.maxTime = Math.max(metrics.maxTime, executionTime);
    
    // Keep track of recent execution times (last 20)
    metrics.recentTimes.push(executionTime);
    if (metrics.recentTimes.length > 20) {
      metrics.recentTimes.shift();
    }
    
    // Long operation logging
    if (executionTime > 1000) {
      logSignalProcessing(
        LogLevel.INFO,
        moduleName,
        `Long operation detected: ${operation}`,
        { executionTime: `${executionTime.toFixed(2)}ms` }
      );
    }
  }
}

/**
 * Get performance metrics by module
 */
export function getPerformanceMetrics(filterModule?: string): Record<string, any> {
  const metrics: Record<string, any> = {};
  
  for (const [key, data] of Object.entries(performanceMetrics)) {
    // Skip if filter applied and doesn't match
    if (filterModule && !key.startsWith(filterModule)) {
      continue;
    }
    
    const [module, operation] = key.split(':');
    
    if (!metrics[module]) {
      metrics[module] = {};
    }
    
    // Calculate average
    const avgTime = data.calls > 0 ? data.totalTime / data.calls : 0;
    
    // Add metric
    metrics[module][operation] = {
      calls: data.calls,
      avgTime,
      minTime: data.minTime === Infinity ? 0 : data.minTime,
      maxTime: data.maxTime,
      totalTime: data.totalTime
    };
  }
  
  return metrics;
}

/**
 * Get recent log entries
 */
export function getRecentLogs(
  count: number = 100, 
  minLevel: LogLevel = LogLevel.INFO,
  moduleFilter?: string
): typeof signalLogs {
  return signalLogs
    .filter(log => log.level >= minLevel && (!moduleFilter || log.module === moduleFilter))
    .slice(-count);
}

/**
 * Get error statistics
 */
export function getErrorStats(): {
  totalErrors: number,
  recentErrors: number,
  topErrors: Array<{key: string, count: number, lastReported: number}>
} {
  // Count total errors
  const totalErrors = signalLogs.filter(log => log.level >= LogLevel.ERROR).length;
  
  // Count recent errors (last hour)
  const now = Date.now();
  const hourAgo = now - (60 * 60 * 1000);
  const recentErrors = signalLogs.filter(
    log => log.level >= LogLevel.ERROR && log.timestamp > hourAgo
  ).length;
  
  // Get top errors
  const topErrors = [...recentErrors.entries()]
    .map(([key, data]) => ({
      key,
      count: data.count,
      lastReported: data.lastReported
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  
  return {
    totalErrors,
    recentErrors,
    topErrors
  };
}

/**
 * Enable debug mode
 */
export function enableDebugMode(enable: boolean = true): void {
  if (enable) {
    localStorage.setItem('ppg_debug_mode', 'true');
    logSignalProcessing(LogLevel.INFO, 'System', 'Debug mode enabled');
  } else {
    localStorage.removeItem('ppg_debug_mode');
    logSignalProcessing(LogLevel.INFO, 'System', 'Debug mode disabled');
  }
}

/**
 * Check if debug mode is enabled
 */
export function isDebugModeEnabled(): boolean {
  return localStorage.getItem('ppg_debug_mode') === 'true';
}

/**
 * Clear all logs and metrics
 */
export function clearLogs(): void {
  signalLogs.length = 0;
  for (const key in performanceMetrics) {
    delete performanceMetrics[key];
  }
  recentErrors.clear();
  logSignalProcessing(LogLevel.INFO, 'System', 'Logs and metrics cleared');
}

// Initialize system
logSignalProcessing(LogLevel.INFO, 'System', 'Signal logging system initialized');
