/**
 * Signal logging utilities that coordinate validation and quality analysis
 */

import { validateSignalValue, validateResultData } from './validateSignal';
import { calculateSignalQuality } from './qualityAnalyzer';

/**
 * Updates the signal log with strict validation to prevent invalid data
 */
export function updateSignalLog(
  signalLog: {timestamp: number, value: number, result: any}[],
  currentTime: number,
  value: number,
  result: any,
  processedSignals: number
): {timestamp: number, value: number, result: any}[] {
  // Apply strict physiological validation
  if (!validateSignalValue(value)) {
    console.warn("signalLogUtils: Rejected invalid signal value", { value });
    return signalLog;
  }
  
  if (isNaN(currentTime) || currentTime <= 0) {
    console.warn("signalLogUtils: Rejected invalid timestamp");
    return signalLog;
  }
  
  if (!result) {
    console.warn("signalLogUtils: Rejected null result");
    return signalLog;
  }
  
  // Only log every 10th signal to prevent memory issues
  if (processedSignals % 10 !== 0) {
    return signalLog;
  }
  
  // Validate result data
  const safeResult = validateResultData(result);
  
  const updatedLog = [
    ...signalLog,
    {
      timestamp: currentTime,
      value,
      result: safeResult
    }
  ];
  
  // Keep log at manageable size
  const trimmedLog = updatedLog.length > 100 ? updatedLog.slice(-100) : updatedLog;
  
  // Log quality info
  console.log("signalLogUtils: Log updated", {
    totalEntries: trimmedLog.length,
    lastEntry: trimmedLog[trimmedLog.length - 1],
    signalQuality: calculateSignalQuality(trimmedLog.slice(-20).map(entry => entry.value))
  });
  
  return trimmedLog;
}
