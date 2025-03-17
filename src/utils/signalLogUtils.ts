/**
 * Updates the signal log, maintaining a manageable size
 */
export function updateSignalLog(
  signalLog: {timestamp: number, value: number, result: any}[],
  currentTime: number,
  value: number,
  result: any,
  processedSignals: number
): {timestamp: number, value: number, result: any}[] {
  // Only log every X signals to avoid memory overload
  if (processedSignals % 20 !== 0) {
    return signalLog;
  }
  
  const updatedLog = [
    ...signalLog,
    {
      timestamp: currentTime,
      value,
      result: {...result}
    }
  ];
  
  // Keep the log at a manageable size
  const trimmedLog = updatedLog.length > 50 ? updatedLog.slice(-50) : updatedLog;
  
  // Log for debugging
  console.log("useVitalSignsProcessor: Signal log", {
    totalEntries: trimmedLog.length,
    latestEntries: trimmedLog.slice(-3)
  });
  
  return trimmedLog;
}
