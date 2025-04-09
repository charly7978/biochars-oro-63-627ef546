
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
  // Safety checks for invalid input
  if (isNaN(normalizedValue) || isNaN(derivative)) {
    console.log("Peak detector received invalid inputs:", { normalizedValue, derivative });
    return { isPeak: false, confidence: 0 };
  }

  // Check minimum time between peaks
  if (lastPeakTime !== null) {
    const timeSinceLastPeak = currentTime - lastPeakTime;
    if (timeSinceLastPeak < config.minPeakTimeMs) {
      return { isPeak: false, confidence: 0 };
    }
  }

  // Enhanced peak detection logic
  const thresholdCheck = normalizedValue > config.signalThreshold;
  const derivativeCheck = derivative < config.derivativeThreshold;
  // Relaxed baseline check for better sensitivity
  const baselineCheck = lastValue > baseline * 0.85;
  
  const isPeak = derivativeCheck && thresholdCheck && baselineCheck;

  // Calculate confidence based on signal characteristics
  const amplitudeConfidence = Math.min(
    Math.max(Math.abs(normalizedValue) / (config.signalThreshold * 1.5), 0),
    1
  );
  
  const derivativeConfidence = Math.min(
    Math.max(Math.abs(derivative) / Math.abs(config.derivativeThreshold * 0.7), 0),
    1
  );

  // Combined confidence score
  const confidence = (amplitudeConfidence + derivativeConfidence) / 2;

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
  // Safety check for invalid buffer
  const safeBuffer = peakConfirmationBuffer || [];
  
  // Add value to confirmation buffer
  const updatedBuffer = [...safeBuffer, normalizedValue];
  if (updatedBuffer.length > 5) {
    updatedBuffer.shift();
  }

  let isConfirmedPeak = false;
  let updatedLastConfirmedPeak = lastConfirmedPeak;

  // Only proceed with peak confirmation if needed
  if (isPeak && !lastConfirmedPeak && confidence >= minConfidence * 0.85) { // Lower confidence requirement
    // Need enough samples in buffer for confirmation
    if (updatedBuffer.length >= 2) { // Reduced from 3 for faster confirmation
      const len = updatedBuffer.length;
      
      // Confirm peak if followed by decreasing values - relaxed conditions
      const goingDown1 = updatedBuffer[len - 1] < updatedBuffer[len - 2];
      const goingDown2 = len >= 3 && updatedBuffer[len - 2] < updatedBuffer[len - 3];

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
