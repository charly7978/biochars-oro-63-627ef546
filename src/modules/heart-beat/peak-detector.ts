
/**
 * Peak detection functionality for heart beat processing
 */

interface PeakDetectionOptions {
  minPeakTimeMs: number;
  derivativeThreshold: number;
  signalThreshold: number;
}

/**
 * Detect a peak in the heart rate signal
 * 
 * @param normalizedValue The normalized signal value
 * @param smoothDerivative The smoothed derivative of the signal
 * @param baseline The signal baseline
 * @param lastValue The previous signal value
 * @param lastPeakTime Time of the last detected peak
 * @param currentTime Current time
 * @param options Detection configuration options
 * @returns Result indicating if a peak was detected and with what confidence
 */
export function detectPeak(
  normalizedValue: number,
  smoothDerivative: number,
  baseline: number,
  lastValue: number,
  lastPeakTime: number | null,
  currentTime: number,
  options: PeakDetectionOptions
): { isPeak: boolean; confidence: number } {
  const { minPeakTimeMs, derivativeThreshold, signalThreshold } = options;
  
  // Check if enough time has passed since the last peak
  if (lastPeakTime && currentTime - lastPeakTime < minPeakTimeMs) {
    return { isPeak: false, confidence: 0 };
  }
  
  // Check if the signal value is strong enough
  if (Math.abs(normalizedValue) < signalThreshold) {
    return { isPeak: false, confidence: 0 };
  }
  
  // Detect peak by derivative sign change (from positive to negative)
  const isPeak = smoothDerivative < -derivativeThreshold && lastValue > baseline;
  
  // Calculate confidence based on signal strength and derivative magnitude
  const confidence = isPeak 
    ? Math.min(1, (Math.abs(normalizedValue) / signalThreshold) * 0.5 + 
               (Math.abs(smoothDerivative) / derivativeThreshold) * 0.5)
    : 0;
  
  return { isPeak, confidence };
}

/**
 * Confirm a peak to reduce false positives
 * 
 * @param isPeak Whether a peak was detected
 * @param value Current signal value
 * @param lastConfirmedPeak Whether the last processed value was a confirmed peak
 * @param buffer Buffer for peak confirmation
 * @param minConfidence Minimum confidence threshold for confirmation
 * @param confidence Confidence of the current peak detection
 * @returns Updated confirmation state
 */
export function confirmPeak(
  isPeak: boolean,
  value: number,
  lastConfirmedPeak: boolean,
  buffer: number[],
  minConfidence: number,
  confidence: number
): { isConfirmedPeak: boolean; updatedBuffer: number[]; updatedLastConfirmedPeak: boolean } {
  // If we already confirmed a peak, we need to wait for non-peak values
  if (lastConfirmedPeak) {
    return {
      isConfirmedPeak: false,
      updatedBuffer: buffer,
      updatedLastConfirmedPeak: isPeak // Keep true until no more peak
    };
  }
  
  // Update confirmation buffer
  const updatedBuffer = [...buffer, value].slice(-5);
  
  // Confirm the peak if the detection has sufficient confidence
  const isConfirmedPeak = isPeak && confidence >= minConfidence;
  
  return {
    isConfirmedPeak,
    updatedBuffer,
    updatedLastConfirmedPeak: isConfirmedPeak
  };
}
