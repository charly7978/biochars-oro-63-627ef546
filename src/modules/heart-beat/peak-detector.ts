
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
  // Check minimum time between peaks
  if (lastPeakTime !== null) {
    const timeSinceLastPeak = currentTime - lastPeakTime;
    if (timeSinceLastPeak < config.minPeakTimeMs) {
      return { isPeak: false, confidence: 0 };
    }
  }

  // Enhanced peak detection logic with improved sensitivity
  const isPeak =
    derivative < config.derivativeThreshold * 0.88 && // Reduced threshold by 12% for better sensitivity
    normalizedValue > config.signalThreshold * 0.92 && // Reduced threshold by 8% for better sensitivity
    lastValue > baseline * 0.95; // Further reduced from 0.97 for better detection

  // Calculate confidence based on signal characteristics with improved weighting
  const amplitudeConfidence = Math.min(
    Math.max(Math.abs(normalizedValue) / (config.signalThreshold * 1.6), 0), // Reduced from 1.7 for better sensitivity
    1
  );
  
  const derivativeConfidence = Math.min(
    Math.max(Math.abs(derivative) / Math.abs(config.derivativeThreshold * 0.72), 0), // Reduced from 0.75 for better sensitivity
    1
  );

  // Combined confidence score with improved distribution
  const confidence = (amplitudeConfidence * 0.6 + derivativeConfidence * 0.4); // Weighted more toward amplitude

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
  if (updatedBuffer.length > 5) {
    updatedBuffer.shift();
  }

  let isConfirmedPeak = false;
  let updatedLastConfirmedPeak = lastConfirmedPeak;

  // Enhanced peak confirmation with improved sensitivity
  if (isPeak && !lastConfirmedPeak && confidence >= minConfidence * 0.92) { // Reduced threshold by 8%
    // Need enough samples in buffer for confirmation
    if (updatedBuffer.length >= 3) {
      const len = updatedBuffer.length;
      
      // Improved confirmation logic for more subtle peaks
      const goingDown1 = updatedBuffer[len - 1] < updatedBuffer[len - 2] * 0.97; // Added 3% tolerance
      const goingDown2 = updatedBuffer[len - 2] < updatedBuffer[len - 3] * 0.97; // Added 3% tolerance

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
