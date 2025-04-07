
/**
 * Signal quality check utility function
 */
import { SignalQualityParams } from "../../hooks/vital-signs/types";

/**
 * Check if a PPG signal is too weak or unusable
 * @param value PPG signal value
 * @param currentWeakCount Current count of consecutive weak signals
 * @param params Signal quality parameters
 * @returns Result with signal status and updated weak signals count
 */
export function checkSignalQuality(
  value: number,
  currentWeakCount: number,
  params: SignalQualityParams
) {
  const { lowSignalThreshold, maxWeakSignalCount } = params;
  
  // Check if signal is too weak
  const isCurrentSignalWeak = Math.abs(value) < lowSignalThreshold;
  
  let updatedWeakSignalsCount = isCurrentSignalWeak 
    ? currentWeakCount + 1 
    : Math.max(0, currentWeakCount - 0.5);
  
  // Consider signal weak if we've had too many consecutive weak readings
  const isWeakSignal = updatedWeakSignalsCount >= maxWeakSignalCount;
  
  return {
    isWeakSignal,
    updatedWeakSignalsCount
  };
}
