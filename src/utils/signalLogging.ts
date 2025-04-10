
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
