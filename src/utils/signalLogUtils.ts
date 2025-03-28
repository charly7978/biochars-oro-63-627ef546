/**
 * Signal Log Utilities
 * Helper functions for logging and analyzing signal data
 */

/**
 * Update signal log with a new entry
 */
export const updateSignalLog = <T extends object>(
  logArray: { timestamp: number; value: number; result: T }[],
  currentTime: number,
  value: number,
  result: T,
  processedSignals: number
): { timestamp: number; value: number; result: T }[] => {
  // Add new entry
  const newLog = [...logArray, { timestamp: currentTime, value, result }];
  
  // Keep log at a reasonable size
  if (newLog.length > 100) {
    return newLog.slice(-100);
  }
  
  return newLog;
};

/**
 * Extract a specific property from signal log entries
 */
export const extractLogProperty = <T extends object, K extends keyof T>(
  logArray: { timestamp: number; value: number; result: T }[],
  property: K
): { timestamp: number; value: T[K] }[] => {
  return logArray.map(entry => ({
    timestamp: entry.timestamp,
    value: entry.result[property]
  }));
};

/**
 * Calculate statistics for a signal log property
 */
export const calculateLogStatistics = <T>(
  values: T[]
): { min: T; max: T; avg: number; count: number } | null => {
  if (values.length === 0 || typeof values[0] !== 'number') {
    return null;
  }
  
  const numericValues = values as unknown as number[];
  const min = Math.min(...numericValues);
  const max = Math.max(...numericValues);
  const avg = numericValues.reduce((sum, val) => sum + val, 0) / numericValues.length;
  
  return {
    min: min as unknown as T,
    max: max as unknown as T,
    avg,
    count: values.length
  };
};

/**
 * Create a circular buffer for signal data
 */
export class CircularBuffer<T> {
  private buffer: T[] = [];
  private maxSize: number;
  
  constructor(size: number) {
    this.maxSize = size;
  }
  
  /**
   * Add an item to the buffer
   */
  push(item: T): void {
    this.buffer.push(item);
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift();
    }
  }
  
  /**
   * Get all values in the buffer
   */
  getValues(): T[] {
    return [...this.buffer];
  }
  
  /**
   * Get the most recent value
   */
  getLatest(): T | undefined {
    if (this.buffer.length === 0) return undefined;
    return this.buffer[this.buffer.length - 1];
  }
  
  /**
   * Clear the buffer
   */
  clear(): void {
    this.buffer = [];
  }
  
  /**
   * Get the current size of the buffer
   */
  size(): number {
    return this.buffer.length;
  }
  
  /**
   * Check if the buffer is full
   */
  isFull(): boolean {
    return this.buffer.length === this.maxSize;
  }
}

/**
 * Format a timestamp for logging
 */
export const formatTimestamp = (timestamp: number): string => {
  return new Date(timestamp).toISOString();
};

/**
 * Calculate the time difference between log entries
 */
export const calculateTimeDifferences = (
  logArray: { timestamp: number; value: any }[]
): number[] => {
  if (logArray.length < 2) return [];
  
  const differences: number[] = [];
  for (let i = 1; i < logArray.length; i++) {
    differences.push(logArray[i].timestamp - logArray[i-1].timestamp);
  }
  
  return differences;
};
