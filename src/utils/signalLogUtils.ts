/**
 * Utility for logging signal data
 */
export function updateSignalLog(
  currentLog: {timestamp: number, value: number, result: any}[],
  timestamp: number, 
  value: number, 
  result: any,
  signalCount: number
): {timestamp: number, value: number, result: any}[] {
  // Only log every Nth signal to avoid excessive memory usage
  if (signalCount % 30 === 0) {
    const newLog = [...currentLog, { timestamp, value, result }];
    // Keep only the last 100 entries
    if (newLog.length > 100) {
      return newLog.slice(-100);
    }
    return newLog;
  }
  return currentLog;
}
