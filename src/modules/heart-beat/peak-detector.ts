
/**
 * Peak detection utilities for heart rate processing
 * Provides functions to detect and confirm peaks in PPG signals
 */

/**
 * Interface for peak detection parameters
 */
interface PeakDetectionOptions {
  minPeakTimeMs: number;
  derivativeThreshold: number;
  signalThreshold: number;
}

/**
 * Detects potential peaks in the PPG signal
 * 
 * @param normalizedValue Current normalized signal value
 * @param derivative Current signal derivative
 * @param baseline Current signal baseline
 * @param lastValue Previous signal value
 * @param lastPeakTime Time of last detected peak
 * @param currentTime Current timestamp
 * @param options Detection parameters
 * @returns Object with peak detection result and confidence
 */
export function detectPeak(
  normalizedValue: number,
  derivative: number,
  baseline: number,
  lastValue: number,
  lastPeakTime: number | null,
  currentTime: number,
  options: PeakDetectionOptions
): { isPeak: boolean; confidence: number } {
  // Check if enough time has passed since the last peak
  if (lastPeakTime !== null) {
    const timeSinceLastPeak = currentTime - lastPeakTime;
    if (timeSinceLastPeak < options.minPeakTimeMs) {
      return { isPeak: false, confidence: 0 };
    }
  }

  // Basic peak detection: negative derivative (coming down from peak) and sufficient amplitude
  const isPeak = 
    derivative < options.derivativeThreshold &&
    normalizedValue > options.signalThreshold &&
    lastValue > baseline * 0.98;

  // Calculate confidence based on signal strength and derivative magnitude
  let amplitudeConfidence = 0;
  let derivativeConfidence = 0;
  
  if (isPeak) {
    // Calculate confidence based on how far above the threshold we are
    amplitudeConfidence = Math.min(
      Math.max(Math.abs(normalizedValue) / (options.signalThreshold * 1.8), 0),
      1
    );
    
    // Calculate confidence based on derivative strength
    derivativeConfidence = Math.min(
      Math.max(Math.abs(derivative) / Math.abs(options.derivativeThreshold * 0.8), 0),
      1
    );
  }

  // Combine confidence metrics
  const confidence = (amplitudeConfidence + derivativeConfidence) / 2;

  return { isPeak, confidence };
}

/**
 * Confirms a peak detection to reduce false positives
 * 
 * @param isPeak Whether initial peak detection was positive
 * @param normalizedValue Current normalized signal value
 * @param lastConfirmedPeak Whether last point was already confirmed as peak
 * @param peakConfirmationBuffer Buffer of recent values for confirmation
 * @param minConfidence Minimum required confidence
 * @param confidence Current confidence value
 * @returns Object with confirmation result and updated state
 */
export function confirmPeak(
  isPeak: boolean,
  normalizedValue: number,
  lastConfirmedPeak: boolean,
  peakConfirmationBuffer: number[],
  minConfidence: number,
  confidence: number
): { 
  isConfirmedPeak: boolean; 
  updatedBuffer: number[]; 
  updatedLastConfirmedPeak: boolean;
} {
  // Add current value to the confirmation buffer
  const updatedBuffer = [...peakConfirmationBuffer, normalizedValue];
  if (updatedBuffer.length > 5) {
    updatedBuffer.shift();
  }

  // Default result - no peak confirmed
  let isConfirmedPeak = false;
  let updatedLastConfirmedPeak = lastConfirmedPeak;

  // Only proceed if this is a potential peak, not already confirmed, and confidence is sufficient
  if (isPeak && !lastConfirmedPeak && confidence >= minConfidence) {
    // We need a few samples to confirm the peak
    if (updatedBuffer.length >= 3) {
      const len = updatedBuffer.length;
      
      // Confirm peak if values after it are going down (indicating we passed the peak)
      const goingDown1 = updatedBuffer[len - 1] < updatedBuffer[len - 2];
      const goingDown2 = updatedBuffer[len - 2] < updatedBuffer[len - 3];

      if (goingDown1 || goingDown2) {
        isConfirmedPeak = true;
        updatedLastConfirmedPeak = true;
      }
    }
  } else if (!isPeak) {
    // Reset confirmed flag when not at a peak
    updatedLastConfirmedPeak = false;
  }

  return {
    isConfirmedPeak,
    updatedBuffer,
    updatedLastConfirmedPeak
  };
}
