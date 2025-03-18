
/**
 * Functions for detecting peaks in PPG signals
 */

/**
 * Detects if the current sample represents a peak in the signal
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
  // Check minimum time between peaks - increased for better discrimination
  if (lastPeakTime !== null) {
    const timeSinceLastPeak = currentTime - lastPeakTime;
    if (timeSinceLastPeak < config.minPeakTimeMs) {
      return { isPeak: false, confidence: 0 };
    }
  }

  // Improved peak detection logic with stricter requirements
  const isPeak =
    derivative < config.derivativeThreshold * 0.8 && // More sensitive derivative check
    normalizedValue > config.signalThreshold * 1.2 && // Higher amplitude requirement
    lastValue > baseline * 0.98;

  // Calculate confidence based on signal characteristics with stricter criteria
  const amplitudeConfidence = Math.min(
    Math.max(Math.abs(normalizedValue) / (config.signalThreshold * 2.2), 0),
    1
  );
  
  const derivativeConfidence = Math.min(
    Math.max(Math.abs(derivative) / Math.abs(config.derivativeThreshold * 0.7), 0),
    1
  );

  // Combined confidence score with higher threshold
  const confidence = (amplitudeConfidence * 0.6 + derivativeConfidence * 0.4);

  return { isPeak, confidence };
}

/**
 * Confirms a peak by examining neighboring samples
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
  if (updatedBuffer.length > 7) { // Increased buffer size for better confirmation
    updatedBuffer.shift();
  }

  let isConfirmedPeak = false;
  let updatedLastConfirmedPeak = lastConfirmedPeak;

  // Only proceed with peak confirmation if needed with higher confidence requirement
  if (isPeak && !lastConfirmedPeak && confidence >= minConfidence * 1.2) {
    // Need enough samples in buffer for confirmation
    if (updatedBuffer.length >= 5) { // Require more samples for confirmation
      const len = updatedBuffer.length;
      
      // Confirm peak if followed by consistently decreasing values
      const goingDown1 = updatedBuffer[len - 1] < updatedBuffer[len - 2];
      const goingDown2 = updatedBuffer[len - 2] < updatedBuffer[len - 3];
      const goingDown3 = updatedBuffer[len - 3] < updatedBuffer[len - 4];

      if (goingDown1 && (goingDown2 || goingDown3)) {
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
