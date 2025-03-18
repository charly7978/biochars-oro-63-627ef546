
/**
 * Functions for detecting peaks in PPG signals
 * Enhanced to ensure one real heartbeat = one peak = one beep
 */

/**
 * Detects if the current sample represents a peak in the signal
 * Improved for more responsive peak detection while maintaining accuracy
 */
export function detectPeak(
  normalizedValue: number,
  derivative: number,
  baseline: number,
  lastValue: number,
  lastPeakTime: number | null,
  currentTime: number,
  config: {
    minPeakTimeMs: number,
    derivativeThreshold: number,
    signalThreshold: number,
  }
): {
  isPeak: boolean;
  confidence: number;
} {
  // Check minimum time between peaks
  if (lastPeakTime !== null) {
    const timeSinceLastPeak = currentTime - lastPeakTime;
    // Ensure reasonable timing between peaks (minimum 500ms = 120 BPM max)
    if (timeSinceLastPeak < config.minPeakTimeMs) {
      return { isPeak: false, confidence: 0 };
    }
  }

  // Enhanced peak detection logic with less strict thresholds
  // to ensure more responsive beep while maintaining accuracy
  const isPeak =
    derivative < config.derivativeThreshold && // Standard derivative check
    normalizedValue > config.signalThreshold && // Amplitude check
    lastValue > baseline * 1.01; // Ensure we're above baseline

  // Calculate confidence based on signal characteristics
  const amplitudeConfidence = Math.min(
    Math.max(Math.abs(normalizedValue) / (config.signalThreshold * 1.5), 0),
    1
  );
  
  const derivativeConfidence = Math.min(
    Math.max(Math.abs(derivative) / Math.abs(config.derivativeThreshold * 0.8), 0),
    1
  );

  // Combined confidence score with appropriate weighting
  const confidence = (amplitudeConfidence * 0.7 + derivativeConfidence * 0.3);

  return { isPeak, confidence };
}

/**
 * Confirms a peak by examining neighboring samples
 * Modified to be more responsive while maintaining accuracy
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
  // Add value to confirmation buffer
  const updatedBuffer = [...peakConfirmationBuffer, normalizedValue];
  if (updatedBuffer.length > 5) { // Reduced buffer size for faster confirmation
    updatedBuffer.shift();
  }

  let isConfirmedPeak = false;
  let updatedLastConfirmedPeak = lastConfirmedPeak;

  // Proceed with peak confirmation
  if (isPeak && !lastConfirmedPeak && confidence >= minConfidence) {
    // Need enough samples in buffer for confirmation
    if (updatedBuffer.length >= 3) { // Reduced required samples for faster confirmation
      const len = updatedBuffer.length;
      
      // Confirm peak with less strict downward pattern
      // This ensures we detect the peak more responsively
      const goingDown1 = updatedBuffer[len - 1] < updatedBuffer[len - 2];
      const goingDown2 = updatedBuffer.length >= 3 ? 
        updatedBuffer[len - 2] < updatedBuffer[len - 3] : true;

      // Less strict pattern requirement
      if (goingDown1 || goingDown2) {
        isConfirmedPeak = true;
        updatedLastConfirmedPeak = true;
      }
    }
  } else if (!isPeak) {
    updatedLastConfirmedPeak = false;
  }

  return {
    isConfirmedPeak,
    updatedBuffer,
    updatedLastConfirmedPeak
  };
}
